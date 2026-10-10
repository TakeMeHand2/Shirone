#!/usr/bin/env node

/**
 * 评论区角色贴纸生成器
 * ---------------------------------------------------------------------------
 * 把透明底的 Q 版二创图加工成「印刷贴纸」：烘焙三层边
 *
 *     墨线钥匙边（约 2px） → 白色刀模（约 5px） → 原图
 *
 * 为什么必须有墨线那一层：纯白刀模在浅色卡片底上完全看不见，贴纸形状会塌掉；
 * 加一圈墨色钥匙边之后，亮底与暗底都能保持清晰轮廓。
 *
 * 用法：
 *   node scripts/images/generate-comment-stickers.mjs [源目录]
 *
 * 默认源目录 `scripts/images/sources/comment`（不入库，自行放置）：
 *   wink.png   → public/comment/castorice-wink.webp  （默认状态）
 *   shy.png    → public/comment/castorice-shy.webp   （悬停时）
 *   calm.png   → public/comment/castorice-calm.webp  （评论数为 0 时）
 *
 * ⚠️ sharp 的 `threshold().raw().toBuffer()` **不保证单通道**（实测为 3 通道，
 *    长度 = W×H×3）。按单通道索引取 alpha 会让整层错位，表现为「角落冒出一块
 *    不透明底」。所以这里按 info.channels 解析，并且**只以四角 alpha 实测值**
 *    判断成功与否 —— 叠了背景色的自检图会把这个问题盖住。
 *
 * 素材版权提示：默认素材为《崩坏：星穹铁道》遐蝶（Castorice）的 Q 版二创，
 * 来源与授权说明见 public/comment/README.md。
 */

import { existsSync } from "node:fs";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const SRC_DIR = resolve(
	process.argv[2] ?? join(ROOT, "scripts/images/sources/comment"),
);
const OUT_DIR = join(ROOT, "public/comment");

/** 墨线钥匙边的颜色：近黑偏暖，避免纯黑在暗色主题里过于突兀 */
const INK = { r: 31, g: 26, b: 32 };
/** 四周留白：必须大于膨胀半径，否则描边会被画布边缘截断 */
const PAD = 26;

/** 输出宽度与文件名映射 */
const TARGETS = [
	{ source: "wink", out: "castorice-wink", width: 400 },
	{ source: "shy", out: "castorice-shy", width: 400 },
	{ source: "calm", out: "castorice-calm", width: 380 },
];

/** 找出源目录里匹配的图片（允许 png/jpg/webp 扩展名） */
async function findSource(dir, base) {
	const entries = await readdir(dir, { withFileTypes: true });
	const hit = entries.find(
		(entry) => entry.isFile() && entry.name.replace(/\.[^.]+$/, "") === base,
	);
	return hit ? join(dir, hit.name) : null;
}

/**
 * 从带 alpha 的图导出「膨胀后的灰度遮罩」，返回严格单通道 Buffer（长度 = W×H）。
 * 用 blur + threshold 近似形态学膨胀 —— 比 feMorphology 更可控，且不需要额外依赖。
 */
async function grownMask(artBuffer, sigma, threshold) {
	const { data, info } = await sharp(artBuffer)
		.ensureAlpha()
		.raw()
		.toBuffer({ resolveWithObject: true });
	const { width: W, height: H } = info;
	const alphaIndex = info.channels - 1;

	const alpha = Buffer.alloc(W * H);
	for (let i = 0; i < W * H; i++) {
		alpha[i] = data[i * info.channels + alphaIndex];
	}

	const { data: maskData, info: maskInfo } = await sharp(alpha, {
		raw: { width: W, height: H, channels: 1 },
	})
		.blur(sigma)
		.threshold(threshold)
		.raw()
		.toBuffer({ resolveWithObject: true });

	// threshold 可能把图变回 3 通道 —— 务必按实际通道数步进
	const mask = Buffer.alloc(W * H);
	for (let i = 0; i < W * H; i++) {
		mask[i] = maskData[i * maskInfo.channels];
	}
	return { mask, W, H };
}

/** 单通道遮罩 → 指定颜色的带 alpha 图层（PNG Buffer） */
function colourise(mask, W, H, { r, g, b }) {
	const out = Buffer.alloc(W * H * 4);
	for (let i = 0; i < W * H; i++) {
		out[i * 4] = r;
		out[i * 4 + 1] = g;
		out[i * 4 + 2] = b;
		out[i * 4 + 3] = mask[i];
	}
	return sharp(out, { raw: { width: W, height: H, channels: 4 } })
		.png()
		.toBuffer();
}

/** 读四角 alpha —— 判定「有没有残留不透明底」的唯一可靠依据 */
async function cornerAlpha(buffer) {
	const { data, info } = await sharp(buffer)
		.ensureAlpha()
		.raw()
		.toBuffer({ resolveWithObject: true });
	const { width: W, height: H } = info;
	const alphaIndex = info.channels - 1;
	const at = (x, y) => data[(y * W + x) * info.channels + alphaIndex];
	return [at(0, 0), at(W - 1, 0), at(0, H - 1), at(W - 1, H - 1)];
}

async function build(sourcePath, outName, width) {
	const resized = await sharp(sourcePath)
		.resize({ width, withoutEnlargement: true })
		.png()
		.toBuffer();
	const meta = await sharp(resized).metadata();

	const art = await sharp({
		create: {
			width: meta.width + PAD * 2,
			height: meta.height + PAD * 2,
			channels: 4,
			background: { r: 0, g: 0, b: 0, alpha: 0 },
		},
	})
		.composite([{ input: resized, left: PAD, top: PAD }])
		.png()
		.toBuffer();

	const ink = await grownMask(art, 9, 12);
	const white = await grownMask(art, 6, 12);

	const out = await sharp({
		create: {
			width: ink.W,
			height: ink.H,
			channels: 4,
			background: { r: 0, g: 0, b: 0, alpha: 0 },
		},
	})
		.composite([
			{ input: await colourise(ink.mask, ink.W, ink.H, INK) },
			{
				input: await colourise(white.mask, white.W, white.H, {
					r: 255,
					g: 255,
					b: 255,
				}),
			},
			{ input: art },
		])
		.webp({ quality: 92, effort: 6 })
		.toBuffer();

	await writeFile(join(OUT_DIR, `${outName}.webp`), out);

	const corners = await cornerAlpha(out);
	const ok = corners.every((value) => value === 0);
	console.log(
		`${ok ? "✓" : "✗"} ${outName.padEnd(18)} ${ink.W}x${ink.H} ` +
			`${(out.length / 1024).toFixed(0)}KB  corners=[${corners.join(",")}]`,
	);
	return ok;
}

async function main() {
	if (!existsSync(SRC_DIR)) {
		console.error(`源目录不存在：${SRC_DIR}`);
		console.error(
			"把 wink.png / shy.png / calm.png 放进去，或用参数指定其它目录。",
		);
		process.exitCode = 1;
		return;
	}

	await mkdir(OUT_DIR, { recursive: true });
	let allOk = true;

	for (const target of TARGETS) {
		const sourcePath = await findSource(SRC_DIR, target.source);
		if (!sourcePath) {
			console.warn(`⚠ 跳过 ${target.source}：源目录里找不到同名图片`);
			allOk = false;
			continue;
		}
		allOk = (await build(sourcePath, target.out, target.width)) && allOk;
	}

	if (!allOk) {
		console.error("\n有贴纸未通过四角 alpha 检查，请检查源图是否四角透明。");
		process.exitCode = 1;
	} else {
		console.log(`\n完成 → ${OUT_DIR}`);
	}
}

await main();
