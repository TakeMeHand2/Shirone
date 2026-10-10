/**
 * 结构化数据（JSON-LD）构造与序列化。
 *
 * 两个页面（`posts/[...slug]` 与 `[...permalink]`）此前各自内联了一份几乎相同的
 * `BlogPosting`，改一处容易漏另一处；这里收敛成单一来源，同时补上缺失字段。
 *
 * **关于 `serializeJsonLd` 的转义**：`JSON.stringify` 不转义 `<`，因此 frontmatter
 * 里只要出现 `</script>`，就能提前闭合承载它的 `<script type="application/ld+json">`，
 * 把结构化数据变成可控的 HTML 注入点。把 `<` 写成 `\u003c` 既保持 JSON 合法，
 * 又让它在 HTML 解析器眼里不再是标签起始。
 *
 * **有意未声明的两项**：
 * - `potentialAction` / `SearchAction`：本站搜索是客户端覆盖层，**没有可索引的搜索
 *   URL**，声明一个假的 urlTemplate 属于虚假结构化数据，会被判为无效标记；
 * - `BreadcrumbList`：文章页没有可见面包屑，而 Google 要求面包屑标记必须与页面上
 *   可见的层级一致。要加标记，先加可见面包屑。
 */

/** 把值序列化为可安全内联进 `<script>` 的 JSON 字符串。 */
export function serializeJsonLd(value: unknown): string {
	return JSON.stringify(value).replace(/</g, "\\u003c");
}

export interface PostJsonLdInput {
	title: string;
	description: string;
	tags?: string[];
	/** 该文章的绝对 URL */
	url: string;
	/** 封面图绝对 URL；缺省时省略该字段 */
	image?: string;
	authorName: string;
	/** 站点名，用于 `publisher` */
	siteName: string;
	/** 站点根绝对 URL，用于 author/publisher 的 url */
	siteUrl?: string;
	datePublished: string;
	dateModified: string;
	/** BCP-47 语言码 */
	lang: string;
}

/** 构造 `BlogPosting` 结构化数据。 */
export function buildPostJsonLd(
	input: PostJsonLdInput,
): Record<string, unknown> {
	const {
		title,
		description,
		tags,
		url,
		image,
		authorName,
		siteName,
		siteUrl,
		datePublished,
		dateModified,
		lang,
	} = input;

	return {
		"@context": "https://schema.org",
		"@type": "BlogPosting",
		headline: title,
		description,
		...(tags && tags.length > 0 ? { keywords: tags } : {}),
		...(image ? { image: [image] } : {}),
		url,
		// 声明主实体，避免同一内容在多条路径下被当作不同 URL
		mainEntityOfPage: { "@type": "WebPage", "@id": url },
		author: {
			"@type": "Person",
			name: authorName,
			...(siteUrl ? { url: siteUrl } : {}),
		},
		publisher: {
			"@type": "Organization",
			name: siteName,
			...(siteUrl ? { url: siteUrl } : {}),
		},
		datePublished,
		dateModified,
		inLanguage: lang,
	};
}

export interface WebsiteJsonLdInput {
	name: string;
	/** 站点根绝对 URL */
	url: string;
	description?: string;
	/** BCP-47 语言码 */
	lang: string;
}

/** 构造站点级 `WebSite` 结构化数据。 */
export function buildWebsiteJsonLd(
	input: WebsiteJsonLdInput,
): Record<string, unknown> {
	const { name, url: siteUrl, description, lang } = input;
	return {
		"@context": "https://schema.org",
		"@type": "WebSite",
		name,
		url: siteUrl,
		...(description ? { description } : {}),
		inLanguage: lang,
	};
}
