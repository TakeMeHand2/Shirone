import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import stylus from "stylus";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const GISCUS_COMPONENT = "src/components/organisms/comment/Giscus.astro";
const COMMENT_CONFIG = "src/config/commentConfig.ts";
const VERCEL_CONFIG = "vercel.json";

async function compiledGiscusShellCss() {
	const source = await readFile(join(ROOT, GISCUS_COMPONENT), "utf8");
	const block = source.match(/const giscusStylus = `([\s\S]*?)`;/);
	assert.ok(block, "Giscus.astro must embed its shell styles in giscusStylus");
	return stylus.render(block[1]);
}

test("giscus iframe shell keeps both color schemes enabled", async () => {
	const css = await compiledGiscusShellCss();

	// 浏览器偏好暗色而站点为亮色时，light-only 的 iframe 会被 Chromium 强制铺上
	// 不透明深色画布，评论区出现黑底（Shirone#80）。外壳必须声明 light dark。
	assert.match(css, /\.giscus-frame\s*\{[^}]*color-scheme:\s*light dark\s*;/);
	assert.doesNotMatch(css, /color-scheme:\s*(?:normal|only light)\s*;/);
});

/**
 * 「分格漫画」换皮以站点内路径（"/giscus/xxx.css"）声明，由 Giscus.astro 在运行时
 * 补成绝对 URL。这条链路有两个容易静默失效的点，锁在这里：
 *  1. 换皮文件被删或搬到别处 → giscus 只会回退内置主题，外观退化但页面不报错；
 *  2. 站点没给 /giscus/* 返回 CORS 头 → giscus 在它自己的 iframe 里以
 *     `<link crossorigin="anonymous">` 加载，缺头会被浏览器直接拦掉。
 * 换回 giscus 内置主题键（如 "light"）时本测试自动失效，不需要同步修改。
 */
test("site-local giscus skins ship with a matching CORS rule", async () => {
	const config = await readFile(join(ROOT, COMMENT_CONFIG), "utf8");
	const localSkins = [...config.matchAll(/"(\/giscus\/[^"]+\.css)"/g)].map(
		(match) => match[1],
	);
	if (localSkins.length === 0) return;

	for (const href of localSkins) {
		const file = await readFile(
			join(ROOT, "public", href.replace(/^\//, "")),
			"utf8",
		);
		// 必须真的重声明 Primer 变量，否则「换皮」只是引用了一个空文件
		assert.match(file, /--color-fg-default:/, `${href} 未覆盖正文色`);
		assert.match(file, /--color-btn-primary-bg:/, `${href} 未覆盖主按钮底色`);
		assert.match(file, /--color-canvas-default:/, `${href} 未覆盖画布底色`);
	}

	const vercel = JSON.parse(await readFile(join(ROOT, VERCEL_CONFIG), "utf8"));
	const coversGiscus = (vercel.headers ?? []).some(
		(rule) =>
			rule.source?.includes("giscus") &&
			(rule.headers ?? []).some(
				(header) => header.key?.toLowerCase() === "access-control-allow-origin",
			),
	);
	assert.ok(
		coversGiscus,
		"vercel.json 必须为 /giscus/* 返回 Access-Control-Allow-Origin",
	);
});
