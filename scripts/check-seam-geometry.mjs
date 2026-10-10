/**
 * 几何自检：不依赖视频帧，直接读出「波浪视觉峰值」与「面板叠压量」，
 * 校验收口不变量：叠压 < 峰值 < 波浪带高。任一不满足即判定收口破相
 * （波峰被面板整条盖掉 → 只剩平直色带）。
 * 用法：node scripts/check-seam-geometry.mjs
 */
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { chromium } from "@playwright/test";

const DIST = resolve("dist");
const PORT = 4175;
const CDP_PORT = 9341;
const BINARY =
	"C:/Users/User/AppData/Local/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe";
const MIME = {
	".html": "text/html; charset=utf-8",
	".css": "text/css; charset=utf-8",
	".js": "text/javascript; charset=utf-8",
	".json": "application/json; charset=utf-8",
	".webp": "image/webp",
	".png": "image/png",
	".svg": "image/svg+xml",
	".webm": "video/webm",
	".woff2": "font/woff2",
	".xml": "application/xml",
};

const server = createServer((req, res) => {
	const p = decodeURIComponent((req.url ?? "/").split("?")[0]);
	const fp = normalize(join(DIST, p));
	if (!fp.startsWith(DIST)) return void res.writeHead(403).end();
	if (existsSync(fp) && !fp.endsWith("/")) {
		try {
			const buf = readFileSync(fp);
			res.writeHead(200, { "content-type": MIME[extname(fp)] ?? "application/octet-stream" });
			return void res.end(buf);
		} catch {
			/* 目录 */
		}
	}
	for (const c of [join(fp, "index.html"), join(DIST, "index.html")]) {
		if (existsSync(c)) {
			res.writeHead(200, { "content-type": MIME[".html"] });
			return void res.end(readFileSync(c));
		}
	}
	res.writeHead(404).end();
});

await new Promise((r) => server.listen(PORT, "127.0.0.1", r));

const child = spawn(
	BINARY,
	[
		`--remote-debugging-port=${CDP_PORT}`,
		`--user-data-dir=${resolve(process.env.TEMP ?? "/tmp", `shirone-geo-${Date.now()}`)}`,
		"--no-first-run",
		"--disable-gpu",
		"--hide-scrollbars",
		"--autoplay-policy=no-user-gesture-required",
		"--no-sandbox",
		"about:blank",
	],
	{ stdio: "ignore" },
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

try {
	const deadline = Date.now() + 20000;
	let ready = false;
	while (Date.now() < deadline && !ready) {
		try {
			ready = (await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)).ok;
		} catch {
			/* 等待 */
		}
		if (!ready) await sleep(300);
	}
	if (!ready) throw new Error("CDP 未就绪");

	const browser = await chromium.connectOverCDP(`http://127.0.0.1:${CDP_PORT}`);
	const context = browser.contexts()[0] ?? (await browser.newContext());

	const results = [];
	for (const vp of [
		{ name: "desktop", width: 1600, height: 900 },
		{ name: "tablet", width: 768, height: 900 },
		{ name: "mobile", width: 390, height: 844 },
	]) {
		const page = await context.newPage();
		await page.setViewportSize({ width: vp.width, height: vp.height });
		await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: "domcontentloaded" });
		await page
			.waitForFunction(() => document.body.dataset.bannerVisible === "true", undefined, { timeout: 15000 })
			.catch(() => {});
		await sleep(4000);

		const m = await page.evaluate(() => {
			const root = getComputedStyle(document.documentElement);
			const rem = Number.parseFloat(root.fontSize);
			const parse = (v) => (v.endsWith("rem") ? Number.parseFloat(v) * rem : Number.parseFloat(v));

			const wavesEl = document.querySelector(".banner-waves");
			const layerEl = document.querySelector(".banner-waves__layer--near");
			const barEl = document.getElementById("category-bar-region");
			if (!wavesEl || !layerEl || !barEl) return null;

			const wavesH = wavesEl.getBoundingClientRect().height;
			const scaleY = Number.parseFloat(
				getComputedStyle(layerEl).getPropertyValue("--banner-wave-scale-y") || "1",
			);
			// 近景层波峰：基线 20 - 振幅 12 = 8（viewBox 用户单位），
			// 见 BannerWaves.astro 的 buildWavePath 参数。viewBox 高 42。
			const PEAK_USER = 20 - 12;
			const VIEWBOX_H = 42;
			const peakPx = (1 - PEAK_USER / VIEWBOX_H) * wavesH * scaleY;

			const overlapPx = parse(root.getPropertyValue("--banner-panel-overlap").trim());
			const barTop = barEl.getBoundingClientRect().top;
			const wavesTop = wavesEl.getBoundingClientRect().top;
			const wavesBottom = wavesEl.getBoundingClientRect().bottom;
			// 波浪层向上越界，实际可见峰值位置。
			// 峰值以「视口坐标」表示：带底减去峰值到带底的距离。
			// 判据：峰值必须高于面板顶（peakViewportY < barTop），波峰才可见。
			const peakViewportY = wavesBottom - peakPx;

			return {
				viewport: `${window.innerWidth}x${window.innerHeight}`,
				overlapRaw: root.getPropertyValue("--banner-panel-overlap").trim(),
				overlapPx: Math.round(overlapPx * 10) / 10,
				wavesHeight: Math.round(wavesH),
				scaleY,
				peakPx: Math.round(peakPx * 10) / 10,
				// >0 表示波峰露在面板之上（可见收口）；<=0 表示被面板完全盖掉
				peakAbovePanel: Math.round((barTop - peakViewportY) * 10) / 10,
				barTop: Math.round(barTop),
				wavesTop: Math.round(wavesTop),
				wavesBottom: Math.round(wavesBottom),
			};
		});
		results.push({ name: vp.name, ...m });
		await page.close();
	}

	console.log(JSON.stringify(results, null, 2));

	let allOk = true;
	for (const r of results) {
		if (!r.peakAbovePanel || r.peakAbovePanel <= 0) allOk = false;
	}
	console.log(
		`\n收口不变量（叠压 < 峰值，即波峰可见）：${allOk ? "全部通过 ✓" : "存在失败 ✗"}`,
	);
	if (!allOk) process.exitCode = 1;

	await browser.close();
} catch (err) {
	console.error("FAILED", err);
	process.exitCode = 1;
} finally {
	child.kill();
	server.close();
}
