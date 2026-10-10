import { permalinkConfig } from "../config/permalinkConfig.ts";
import type I18nKey from "../i18n/i18nKey.ts";
import { i18n } from "../i18n/translation.ts";
import {
	generatePermalinkSlug,
	type PostLikeForPermalink,
} from "./permalink-utils.ts";

/**
 * 移除文件扩展名（.md, .mdx, .markdown）
 */
export function removeFileExtension(id: string): string {
	return id.replace(/\.(md|mdx|markdown)$/i, "");
}

/**
 * 动态 OG 分享卡的目录前缀（站点 URL 形态，无前导斜杠）。
 * 端点路由 `src/pages/og/[...slug].ts` 必须落在同一前缀下。
 */
export const OG_IMAGE_ROUTE_PREFIX = "og/";

/**
 * 文章集合条目 id → OG 卡相对路径（如 `guide/foo.png`）。
 *
 * 这是**唯一**一处把条目 id 映射成 OG 文件名的地方：文章页拼 `og:image`
 * 与端点派生 `getStaticPaths` 参数都走它。两处各写一遍正则的话，
 * 一旦 ext 列表或命名规则改动，页面会静默指向不存在的图片（图挂了但构建全绿），
 * 而任何构建期校验都发现不了。
 */
export function getPostOgFileName(entryId: string): string {
	return `${removeFileExtension(entryId)}.png`;
}

/**
 * 文章集合条目 id → 站点内的 OG 卡 URL（如 `/og/guide/foo.png`，含 base）。
 *
 * 注意：端点本身命名参数为 `[...slug]`，其值就是 `getPostOgFileName()` 的结果；
 * 不要手工拼 `og/` —— 前缀只应来自 `OG_IMAGE_ROUTE_PREFIX`。
 */
export function getPostOgImageUrl(
	entryId: string,
	baseUrlOverride?: string,
): string {
	return url(
		`/${OG_IMAGE_ROUTE_PREFIX}${getPostOgFileName(entryId)}`,
		baseUrlOverride,
	);
}

export function pathsEqual(path1: string, path2: string): boolean {
	const normalizedPath1 = path1.replace(/^\/|\/$/g, "").toLowerCase();
	const normalizedPath2 = path2.replace(/^\/|\/$/g, "").toLowerCase();
	return normalizedPath1 === normalizedPath2;
}

function joinUrl(...parts: string[]): string {
	const joined = parts.join("/");
	return joined.replace(/\/+/g, "/");
}

export function getPostUrlBySlug(slug: string): string {
	let slugWithoutExt = removeFileExtension(slug)
		.replace(/^\/+/, "")
		.replace(/\/+$/, "");
	if (slugWithoutExt.startsWith("posts/")) {
		slugWithoutExt = slugWithoutExt.replace(/^posts\//, "");
	}
	return url(`/posts/${slugWithoutExt}/`);
}

export function getPostUrlByAlias(alias: string): string {
	let cleanAlias = alias.replace(/^\/+/, "").replace(/\/+$/, "");
	if (cleanAlias.startsWith("posts/")) {
		cleanAlias = cleanAlias.replace(/^posts\//, "");
	}
	return url(`/posts/${cleanAlias}/`);
}

export function getPostUrl(
	post:
		| PostLikeForPermalink
		| {
				id?: string;
				slug?: string;
				url?: string;
				data?: {
					alias?: string;
					permalink?: string;
					published?: Date;
					publishedAt?: Date;
					category?: string | null;
					draft?: boolean;
				};
		  },
): string {
	if ("url" in post && typeof post.url === "string" && post.url.length > 0) {
		return post.url;
	}

	if (post.data?.permalink && post.data.permalink.trim().length > 0) {
		const slug = post.data.permalink.replace(/^\/+/, "").replace(/\/+$/, "");
		return url(`/${slug}/`);
	}

	if (permalinkConfig.enable) {
		const slug = generatePermalinkSlug(post as PostLikeForPermalink);
		return url(`/${slug}/`);
	}

	if (post.data?.alias && post.data.alias.trim().length > 0) {
		return getPostUrlByAlias(post.data.alias);
	}

	const postId =
		(post as { id?: string; slug?: string }).id ??
		(post as { id?: string; slug?: string }).slug ??
		"";
	return getPostUrlBySlug(postId);
}

export function getTagUrl(tag: string): string {
	if (!tag) return url("/archive/");
	return url(`/archive/?tag=${encodeURIComponent(tag.trim())}`);
}

export function getCategoryUrl(category: string | null): string {
	if (
		!category ||
		category.trim() === "" ||
		category.trim().toLowerCase() ===
			i18n("uncategorized" as I18nKey).toLowerCase()
	)
		return url("/archive/?uncategorized=true");
	return url(`/archive/?category=${encodeURIComponent(category.trim())}`);
}

export function getSeriesUrl(series: string): string {
	if (!series?.trim()) return url("/series/");
	return url(`/series/${encodeURIComponent(series.trim())}/`);
}

export function getDir(path: string): string {
	const lastSlashIndex = path.lastIndexOf("/");
	if (lastSlashIndex < 0) {
		return "/";
	}
	return path.substring(0, lastSlashIndex + 1);
}

export function url(path: string, baseUrlOverride?: string): string {
	if (!path) {
		return baseUrlOverride ?? import.meta.env?.BASE_URL ?? "/";
	}
	if (
		path.startsWith("http://") ||
		path.startsWith("https://") ||
		path.startsWith("data:") ||
		path.startsWith("#") ||
		path.startsWith("mailto:") ||
		path.startsWith("tel:") ||
		path.startsWith("javascript:")
	) {
		return path;
	}
	const baseUrl = baseUrlOverride ?? import.meta.env?.BASE_URL ?? "/";
	const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
	const normalizedPath = path.startsWith("/") ? path : `/${path}`;

	if (
		normalizedBase !== "/" &&
		(normalizedPath === baseUrl || normalizedPath.startsWith(normalizedBase))
	) {
		return normalizedPath;
	}
	return joinUrl("", baseUrl, path);
}

/**
 * 将相对路径或绝对路径解析为完整的绝对 URL（附带域名与 base 路径）。
 * 针对已包含协议的外部 URL 或 Data URL 原样返回；
 * 若未提供 baseOrigin 则回退为带 base 的相对路径。
 */
export function toAbsoluteUrl(
	path: string,
	baseOrigin?: string | URL,
	baseUrlOverride?: string,
): string {
	if (!path) return "";
	if (
		path.startsWith("http://") ||
		path.startsWith("https://") ||
		path.startsWith("data:")
	) {
		return path;
	}
	const pathWithBase = url(path, baseUrlOverride);
	if (!baseOrigin) return pathWithBase;
	try {
		return new URL(pathWithBase, baseOrigin).href;
	} catch {
		return pathWithBase;
	}
}
