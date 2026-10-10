import { existsSync } from "node:fs";
import { defineConfig } from "@playwright/test";

/**
 * 组件质量专项 — Playwright 配置
 * 说明：测试针对 Astro 开发服务器上的真实站点页面与组件验证页。
 */
const CHROME_CANDIDATES: Record<string, string[]> = {
	win32: [
		"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
		"C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
		`${process.env.LOCALAPPDATA ?? ""}\\Google\\Chrome\\Application\\chrome.exe`,
	],
	darwin: ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"],
	linux: ["/usr/bin/google-chrome", "/opt/google/chrome/chrome"],
};

/**
 * 浏览器选择。
 *
 * **不能把 `channel` 写死成 `"chrome"`**：系统未安装 Chrome 时 Playwright 不会自动
 * 回退到自带浏览器，而是直接抛
 * `Chromium distribution 'chrome' is not found` —— 于是「装没装 Chrome」变成了
 * 测试能否运行的隐藏前提。这里改成：装了系统 Chrome 就复用（省一次下载），
 * 没装就回落到 Playwright 自带的 chromium。
 * 需要固定时用 `PLAYWRIGHT_CHANNEL=chrome` 或 `PLAYWRIGHT_CHANNEL=bundled` 覆盖。
 */
function resolveChannel(): string | undefined {
	const override = process.env.PLAYWRIGHT_CHANNEL;
	if (override) return override === "bundled" ? undefined : override;

	const candidates = (CHROME_CANDIDATES[process.platform] ?? []).filter(Boolean);
	return candidates.some((candidate) => existsSync(candidate))
		? "chrome"
		: undefined;
}

export default defineConfig({
	testDir: "./tests",
	// 显式限定 spec：Playwright 默认的 testMatch 既匹配 *.spec.ts 也匹配
	// *.test.mjs，会把 node:test 用例一并纳入选择器（它们不是 Playwright 测试）。
	testMatch: "**/*.spec.ts",
	timeout: 30_000,
	expect: { timeout: 5_000 },
	// 截图命名去掉平台/项目后缀（-win32），且随 spec 文件旁存放
	snapshotPathTemplate:
		"{snapshotDir}/{testFileDir}/{testFileName}-snapshots/{arg}{ext}",
	fullyParallel: false,
	// 单文件内保持串行（多个 spec 依赖页面内的稳定顺序），文件之间允许并行
	workers: process.env.CI ? 2 : 1,
	retries: process.env.CI ? 1 : 0,
	reporter: [["list"]],
	use: {
		baseURL: "http://localhost:4321",
		channel: resolveChannel(),
		viewport: { width: 1280, height: 900 },
		trace: "retain-on-failure",
	},
	webServer: {
		command:
			process.platform === "win32"
				? "pnpm.cmd astro dev --port 4321 --host"
				: "pnpm astro dev --port 4321 --host",
		url: "http://localhost:4321",
		reuseExistingServer: true,
		timeout: 120_000,
		env: {
			ASTRO_DEV_BACKGROUND: "false",
		},
	},
});
