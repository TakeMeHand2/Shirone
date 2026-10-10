import assert from "node:assert/strict";
import test from "node:test";
import {
	buildOgCardColors,
	buildPostOgCardElement,
	clampOgTitle,
	hostFromSiteUrl,
	OG_CARD_HEIGHT,
	OG_CARD_WIDTH,
	OG_TITLE_BOX_WIDTH,
	OG_TITLE_MAX_LINES,
	OG_TITLE_TEXT_WIDTH,
	ogTextUnits,
	ogTitleBlock,
	ogTitleFontSize,
	ogTitleLines,
	ogTitleMaxUnits,
	ogTitleUnitsPerLine,
	sanitizeOgText,
} from "../src/utils/og-card.ts";

test("sanitizeOgText() strips emoji, control and zero-width characters", () => {
	assert.equal(sanitizeOgText("你好👋世界"), "你好世界");
	assert.equal(sanitizeOgText("flag 🇨🇳 done"), "flag done");
	assert.equal(sanitizeOgText("a\u0000b\u007Fc"), "a b c");
	assert.equal(sanitizeOgText("零\u200B宽\uFEFF字"), "零宽字");
	// CJK 与拉丁原样保留
	assert.equal(sanitizeOgText("Hello 世界 123"), "Hello 世界 123");
	// 连续空白折叠
	assert.equal(sanitizeOgText("a   b"), "a b");
});

test("sanitizeOgText() keeps CJK punctuation intact", () => {
	assert.equal(sanitizeOgText("标题：「测试」——第一篇"), "标题：「测试」——第一篇");
});

test("ogTextUnits() counts CJK as 2 and Latin as 1", () => {
	assert.equal(ogTextUnits("ab"), 2);
	assert.equal(ogTextUnits("中文"), 4);
	assert.equal(ogTextUnits("a中"), 3);
	// 全角标点按 2 计
	assert.equal(ogTextUnits("，。"), 4);
});

test("clampOgTitle() keeps short titles untouched", () => {
	assert.equal(clampOgTitle("短标题", 20), "短标题");
	assert.equal(clampOgTitle("A normal title", 40), "A normal title");
});

test("clampOgTitle() truncates long titles with an ellipsis", () => {
	const long = "一".repeat(40); // 80 units, budget 20
	const clamped = clampOgTitle(long, 20);
	assert.ok(clamped.endsWith("…"));
	assert.ok(ogTextUnits(clamped) <= 20);
	assert.ok(clamped.startsWith("一"));
	// 省略号占 1 单位：正文保留 19 单位
	assert.equal(clamped.length, 10); // 9 个「一」+「…」
});

test("ogTitleFontSize() adapts to title weight", () => {
	assert.equal(ogTitleFontSize("短题"), 64);
	assert.equal(ogTitleFontSize("a".repeat(20)), 56); // 20 units
	assert.equal(ogTitleFontSize("中".repeat(20)), 48); // 40 units
});

test("buildOgCardColors() reads scheme roles and falls back per-role", () => {
	const full = buildOgCardColors({
		primary: "#111111",
		onPrimary: "#222222",
		primaryContainer: "#333333",
		onPrimaryContainer: "#444444",
		surface: "#555555",
		onSurface: "#666666",
		onSurfaceVariant: "#777777",
		outlineVariant: "#888888",
	});
	assert.equal(full.primary, "#111111");

	// 缺失角色逐项回退，不整体失效
	const partial = buildOgCardColors({ primary: "#ABCDEF" });
	assert.equal(partial.primary, "#ABCDEF");
	assert.equal(partial.surface, "#F8F4FA");
	assert.match(partial.onSurfaceVariant, /^#[0-9A-F]{6}$/i);
});

test("buildPostOgCardElement() renders a fixed-size card with sanitized text", () => {
	const element = buildPostOgCardElement({
		title: "这是我的第一篇文章🎉",
		siteTitle: "Shirone Demo",
		author: "White",
		date: "2026-10-04",
		siteHost: "example.com",
		colors: buildOgCardColors({}),
	});

	assert.equal(element.props.style.width, OG_CARD_WIDTH);
	assert.equal(element.props.style.height, OG_CARD_HEIGHT);
	const serialized = JSON.stringify(element);
	// emoji 被清理
	assert.ok(!serialized.includes("🎉"));
	assert.ok(serialized.includes("这是我的第一篇文章"));
	assert.ok(serialized.includes("Shirone Demo"));
	assert.ok(serialized.includes("example.com"));
	// 空标题回退站点名
	const fallback = buildPostOgCardElement({
		title: "",
		siteTitle: "My Site",
		author: "",
		date: "",
		siteHost: "",
		colors: buildOgCardColors({}),
	});
	assert.ok(JSON.stringify(fallback).includes("My Site"));
});

test("hostFromSiteUrl() strips protocol, path and trailing slash", () => {
	assert.equal(hostFromSiteUrl("https://example.com"), "example.com");
	assert.equal(hostFromSiteUrl("http://example.com/"), "example.com");
	assert.equal(hostFromSiteUrl("https://example.com/blog/"), "example.com");
	assert.equal(hostFromSiteUrl("https://blog.example.com:8443"), "blog.example.com:8443");
	assert.equal(hostFromSiteUrl("example.com"), "example.com");
	// 未配置 siteConfig.site 时卡片不显示域名
	assert.equal(hostFromSiteUrl(undefined), "");
	assert.equal(hostFromSiteUrl(""), "");
});

test("ogTitle* geometry keeps the budget and the block consistent", () => {
	// 预算 = 单行容量 × 最大行数（向下取整），保证截断后行数不超过上限
	for (const fontSize of [64, 56, 48]) {
		assert.equal(
			ogTitleMaxUnits(fontSize),
			Math.floor(ogTitleUnitsPerLine(fontSize) * OG_TITLE_MAX_LINES),
		);
	}
	// 单行容量按「去掉 accent bar 与间距」后的文字宽度算，不能按列宽算
	assert.equal(ogTitleUnitsPerLine(64), OG_TITLE_TEXT_WIDTH / 32);
	assert.ok(OG_TITLE_TEXT_WIDTH < OG_TITLE_BOX_WIDTH);

	assert.equal(ogTitleLines("短标题", 64), 1);
	assert.equal(ogTitleLines("一".repeat(40), 48), 3);
	// 截断之后行数不会再超过上限
	const clamped = clampOgTitle("一".repeat(400), ogTitleMaxUnits(48));
	assert.ok(ogTitleLines(clamped, 48) <= OG_TITLE_MAX_LINES);
});

test("ogTitleBlock() sizes the accent bar to the real line count", () => {
	const oneLine = ogTitleBlock("短标题", 64);
	assert.equal(oneLine.lines, 1);
	assert.equal(oneLine.height, 64 * 1.3);

	const threeLines = ogTitleBlock("一".repeat(40), 48);
	assert.equal(threeLines.lines, 3);
	assert.equal(threeLines.height, 3 * 48 * 1.3);

	// 块高越大，顶部越靠上；不论行数，块都落在编排区间内
	assert.ok(threeLines.top < oneLine.top);
	assert.ok(oneLine.top > 0);
	assert.ok(threeLines.top + threeLines.height < OG_CARD_HEIGHT);
});

/** 深度优先展开整棵元素树。 */
function collectNodes(node, out = []) {
	out.push(node);
	if (Array.isArray(node.props.children)) {
		for (const child of node.props.children) collectNodes(child, out);
	}
	return out;
}

test("every node carries children outside the style object", () => {
	// 回归：早期实现把 children 写进了 style 对象（`el(type, {...style, children})`），
	// satori 会把 style 里的每个键当 CSS 声明解析，于是整棵子树被当成一个 CSS 值，
	// 报出 `inputValue.trim is not a function` —— 报错信息里只有一个数组，极难定位。
	const element = buildPostOgCardElement({
		title: "标题",
		siteTitle: "站点",
		author: "作者",
		date: "2026-10-01",
		siteHost: "example.com",
		colors: buildOgCardColors({}),
	});

	const nodes = collectNodes(element);
	for (const node of nodes) {
		assert.ok(
			!Object.hasOwn(node.props.style, "children"),
			"children must not live inside the style object",
		);
		assert.ok(
			Object.hasOwn(node.props, "children"),
			"every node must declare children (empty array when leaf)",
		);
	}
	assert.ok(nodes.length >= 8, `expected a non-trivial tree, got ${nodes.length}`);
});

test("long titles are clamped to the width budget", () => {
	// 回归：clampOgTitle 一度定义了却没有被调用，超长标题会直接溢出卡片。
	const long = "一".repeat(120);
	const element = buildPostOgCardElement({
		title: long,
		siteTitle: "站点",
		author: "",
		date: "",
		siteHost: "",
		colors: buildOgCardColors({}),
	});
	const titleNode = collectNodes(element).find(
		(node) => node.type === "span" && node.props.style.fontWeight === 700,
	);
	assert.ok(titleNode, "title span not found");
	const rendered = titleNode.props.children;
	assert.notEqual(rendered, long);
	assert.ok(rendered.endsWith("…"));
	assert.ok(
		ogTextUnits(rendered) <= ogTitleMaxUnits(titleNode.props.style.fontSize),
		"clamped title must fit the budget for its own font size",
	);
});
