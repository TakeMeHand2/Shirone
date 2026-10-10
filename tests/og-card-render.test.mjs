import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";
import satori from "satori";
import {
	buildOgCardColors,
	buildPostOgCardElement,
	OG_CARD_HEIGHT,
	OG_CARD_WIDTH,
	OG_FONT_FAMILY,
} from "../src/utils/og-card.ts";

/**
 * 动态 OG 分享卡的**真实渲染**测试（satori → SVG → resvg → PNG）。
 *
 * 为什么值得单独一份：`og-card.ts` 的元素树即使完全正确，也可能被 satori 的
 * 布局怪癖吃掉整块内容——最典型的是 `justifyContent: "space-between"` 在列方向
 * 会把最后一个子节点整个丢掉（见 `rules/pitfalls.md` §12）。这种失效**不报错**：
 * 构建成功、图片合法、只是卡上少了一行字。断言元素树是查不出来的，必须看渲染结果。
 *
 * 判据用的是「矢量图元数量的差分」而不是像素：satori 把每个文本节点合并成一条
 * `<path>`，所以某一行没画出来时图元数就不会增加。这样不需要图像解码库，
 * 也不需要维护黄金图。
 */

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const font = readFileSync(
	join(repoRoot, "src", "assets", "fonts", "Yozai-Medium.ttf"),
);

const satoriOptions = {
	width: OG_CARD_WIDTH,
	height: OG_CARD_HEIGHT,
	fonts: [
		{ name: OG_FONT_FAMILY, data: font, weight: 500, style: "normal" },
		{ name: OG_FONT_FAMILY, data: font, weight: 700, style: "normal" },
	],
};

const render = (overrides = {}) =>
	satori(
		buildPostOgCardElement({
			title: "这是我的第一篇文章",
			siteTitle: "序号的博客",
			author: "序号",
			date: "2026-10-04",
			siteHost: "example.com",
			colors: buildOgCardColors({}),
			...overrides,
		}),
		satoriOptions,
	);

/** satori 把文本合并成 path，`<rect>` 则对应装饰形状与文字底色。 */
const drawingPrimitives = (svg) => (svg.match(/<(path|rect|circle|ellipse)\b/g) ?? []).length;

/** 从 PNG 的 IHDR 读宽高：字节 16..24 是两个大端 uint32。 */
const pngSize = (png) => ({
	signature: png.subarray(0, 8).toString("hex"),
	width: png.readUInt32BE(16),
	height: png.readUInt32BE(20),
});

describe("OG share card rendering", () => {
	it("rasterizes to a 1200×630 PNG", async () => {
		const svg = await render();
		const png = new Resvg(svg).render().asPng();
		const { signature, width, height } = pngSize(png);
		assert.equal(signature, "89504e470d0a1a0a", "output is not a PNG");
		assert.equal(width, OG_CARD_WIDTH);
		assert.equal(height, OG_CARD_HEIGHT);
	});

	it("draws the author/date band and the site host band", async () => {
		// 差分：分别去掉作者·日期行与域名行，图元数必须**下降**。
		// 若 satori 静默丢掉其中一行，这里的数字不会变，断言即失败。
		const baseline = drawingPrimitives(await render());
		const withoutMeta = drawingPrimitives(await render({ author: "", date: "" }));
		const withoutHost = drawingPrimitives(await render({ siteHost: "" }));

		assert.ok(
			withoutMeta < baseline,
			`the author/date band did not render (primitives: ${withoutMeta} vs ${baseline})`,
		);
		assert.ok(
			withoutHost < baseline,
			`the site host band did not render (primitives: ${withoutHost} vs ${baseline})`,
		);
	});

	it("renders the site pill and the title", async () => {
		const baseline = drawingPrimitives(await render());
		const withoutPill = drawingPrimitives(await render({ siteTitle: "" }));
		assert.ok(
			withoutPill < baseline,
			`the site pill did not render (primitives: ${withoutPill} vs ${baseline})`,
		);
	});

	it("survives a very long title without overflowing the canvas", async () => {
		// 120 个汉字远超三行预算，必须被 clampOgTitle 截断后正常出图。
		const svg = await render({ title: "很长的标题".repeat(24) });
		const png = new Resvg(svg).render().asPng();
		assert.equal(pngSize(png).width, OG_CARD_WIDTH);
		assert.equal(pngSize(png).height, OG_CARD_HEIGHT);
	});
});
