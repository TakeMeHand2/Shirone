import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	buildPostJsonLd,
	buildWebsiteJsonLd,
	serializeJsonLd,
} from "../src/utils/json-ld.ts";

/**
 * 结构化数据的两个风险点：
 * 1. `JSON.stringify` 不转义 `<`，frontmatter 里出现 `</script>` 就能提前闭合
 *    承载 JSON-LD 的脚本标签 —— 序列化必须转义；
 * 2. 空字段（如没有 tags / cover 时）不该输出空数组占位，否则会给出
 *    「这篇文章没有关键词」这种无意义声明。
 */
describe("JSON-LD", () => {
	it("escapes `<` so a value cannot close the script tag", () => {
		const payload = {
			headline: 'x</script><img src=x onerror=alert(1)>',
		};
		const serialized = serializeJsonLd(payload);

		assert.ok(
			!serialized.includes("<"),
			"serialized JSON-LD must not contain a raw `<`",
		);
		assert.ok(serialized.includes("\\u003c"), "expected the \\u003c escape");
		// 转义不能破坏 JSON 语义：必须仍能解析回原值
		assert.deepEqual(JSON.parse(serialized), payload);
	});

	it("builds a BlogPosting with absolute identifiers", () => {
		const jsonLd = buildPostJsonLd({
			title: "Title",
			description: "Description",
			tags: ["a", "b"],
			url: "https://example.com/posts/x/",
			image: "https://example.com/x.webp",
			authorName: "Author",
			siteName: "Site",
			siteUrl: "https://example.com/",
			datePublished: "2026-01-01T00:00:00.000Z",
			dateModified: "2026-01-02T00:00:00.000Z",
			lang: "zh-CN",
		});

		assert.equal(jsonLd["@type"], "BlogPosting");
		assert.equal(jsonLd.url, "https://example.com/posts/x/");
		assert.deepEqual(jsonLd.mainEntityOfPage, {
			"@type": "WebPage",
			"@id": "https://example.com/posts/x/",
		});
		assert.deepEqual(jsonLd.image, ["https://example.com/x.webp"]);
		assert.deepEqual(jsonLd.publisher, {
			"@type": "Organization",
			name: "Site",
			url: "https://example.com/",
		});
		assert.equal(jsonLd.inLanguage, "zh-CN");
	});

	it("omits optional fields instead of emitting empty placeholders", () => {
		const jsonLd = buildPostJsonLd({
			title: "Title",
			description: "Description",
			url: "https://example.com/posts/x/",
			authorName: "Author",
			siteName: "Site",
			datePublished: "2026-01-01T00:00:00.000Z",
			dateModified: "2026-01-01T00:00:00.000Z",
			lang: "en",
		});

		assert.ok(!("keywords" in jsonLd), "no tags -> no keywords field");
		assert.ok(!("image" in jsonLd), "no cover -> no image field");
		assert.ok(
			!("url" in jsonLd.author),
			"no site url -> author has no url field",
		);
	});

	it("declares WebSite without a fabricated SearchAction", () => {
		// 站内搜索是客户端覆盖层，没有可索引的搜索 URL；
		// 声明假的 urlTemplate 会产出无效结构化数据。
		const jsonLd = buildWebsiteJsonLd({
			name: "Site",
			url: "https://example.com/",
			description: "Desc",
			lang: "zh-CN",
		});

		assert.equal(jsonLd["@type"], "WebSite");
		assert.ok(!("potentialAction" in jsonLd));
		assert.equal(jsonLd.inLanguage, "zh-CN");
	});
});
