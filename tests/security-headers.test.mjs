import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

/**
 * 基线安全响应头：两个静态托管入口（Vercel 的 vercel.json、Netlify/Cloudflare
 * 的 public/_headers）必须下发同一组头。
 *
 * 为什么要测：两处都是声明式配置，改一处漏另一处不会有任何构建期反馈；
 * 而缺失的后果（MIME 嗅探、跨源referrer 泄漏、被第三方 iframe 套壳）不体现在页面上，
 * 只能靠断言守住。
 */
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

const BASELINE_HEADERS = [
	"Referrer-Policy",
	"X-Content-Type-Options",
	"X-Frame-Options",
	"Permissions-Policy",
];

describe("baseline security headers", () => {
	it("vercel.json declares a catch-all rule carrying every baseline header", () => {
		const config = JSON.parse(
			readFileSync(join(repoRoot, "vercel.json"), "utf8"),
		);
		const catchAll = config.headers?.find((rule) => rule.source === "/(.*)");
		assert.ok(catchAll, "vercel.json has no catch-all `/(.*)` header rule");
		const keys = new Set(catchAll.headers.map((header) => header.key));
		for (const key of BASELINE_HEADERS) {
			assert.ok(keys.has(key), `vercel.json catch-all rule is missing ${key}`);
		}
	});

	it("public/_headers declares the same headers for Netlify/Cloudflare", () => {
		const content = readFileSync(join(repoRoot, "public", "_headers"), "utf8");
		assert.match(content, /^\/\*/m, "public/_headers has no catch-all `/*` block");
		for (const key of BASELINE_HEADERS) {
			assert.ok(content.includes(key), `public/_headers is missing ${key}`);
		}
	});

	it("keeps Content-Security-Policy out of the shipped defaults", () => {
		// 这是**有意的缺失**，不是遗漏：静态输出无法为内联脚本生成 nonce，
		// 而可选集成让一份静态 CSP 必然与部分用户配置冲突；写错的 CSP 会
		// 静默打断内容。要加 CSP，请按站点实际启用的集成单独下发。
		const headers = readFileSync(join(repoRoot, "public", "_headers"), "utf8");
		const vercel = readFileSync(join(repoRoot, "vercel.json"), "utf8");
		assert.ok(
			!/^\s*Content-Security-Policy:/m.test(headers),
			"public/_headers must not ship a CSP by default (see the comment in that file)",
		);
		assert.ok(
			!vercel.includes("Content-Security-Policy"),
			"vercel.json must not ship a CSP by default",
		);
	});

	it("declares the same /og/ cache policy in both static hosts", () => {
		// 端点在响应里也带了 cache-control，但静态托管只认自己那份声明式配置：
		// 两处不一致时，线上生效的是宿主的那份，而端点里的值只对 dev / 自托管有意义。
		const headers = readFileSync(join(repoRoot, "public", "_headers"), "utf8");
		const config = JSON.parse(
			readFileSync(join(repoRoot, "vercel.json"), "utf8"),
		);
		const ogRule = config.headers?.find((rule) =>
			rule.source.startsWith("/og"),
		);
		assert.ok(ogRule, "vercel.json has no /og/* header rule");
		const vercelCache = ogRule.headers.find(
			(header) => header.key === "Cache-Control",
		)?.value;
		assert.ok(vercelCache, "vercel.json /og/* rule is missing Cache-Control");

		const netlifyBlock = headers
			.split(/\n(?=\S)/)
			.find((block) => block.startsWith("/og/"));
		assert.ok(netlifyBlock, "public/_headers has no /og/* block");
		assert.ok(
			netlifyBlock.includes(`Cache-Control: ${vercelCache}`),
			`public/_headers /og/* block must carry the same Cache-Control as vercel.json (${vercelCache})`,
		);
	});

	it("does not put a blank line between a path and its headers", () => {
		// Netlify 的 `_headers` 语法里，空行 = 规则块结束。路径行和它的响应头之间
		// 插一行空行，整块头就会静默失效（页面照常渲染，只是不再下发）。
		// 这个断言是唯一会为这件事报警的地方。
		const lines = readFileSync(join(repoRoot, "public", "_headers"), "utf8")
			.split(/\r?\n/)
			.filter((line) => !/^\s*#/.test(line));
		for (let i = 0; i < lines.length - 1; i += 1) {
			if (!lines[i].startsWith("/")) continue;
			assert.ok(
				lines[i + 1].trim().length > 0,
				`public/_headers: the block for "${lines[i]}" starts with a blank line, which ends the rule`,
			);
		}
	});
});
