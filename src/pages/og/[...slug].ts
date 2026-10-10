import loadOgCardFont, { ogCardFontAvailable } from "virtual:shirone-og-font";
import I18nKey from "@i18n/i18nKey";
import { i18n } from "@i18n/translation";
import { Resvg } from "@resvg/resvg-js";
import { getSortedPosts } from "@utils/content-utils";
import { formatDateToYYYYMMDD } from "@utils/date-utils";
import { isMcSpec, isMcStyle, resolveScheme } from "@utils/mc-utils";
import {
	buildOgCardColors,
	buildPostOgCardElement,
	hostFromSiteUrl,
	OG_CARD_HEIGHT,
	OG_CARD_WIDTH,
	OG_FONT_FAMILY,
} from "@utils/og-card";
import { isEncryptedPost } from "@utils/post-encryption";
import { getPostOgFileName } from "@utils/url-utils";
import type { APIRoute } from "astro";
import satori from "satori";
import {
	articleConfig,
	profileConfig,
	resolveOgImageOptions,
	siteConfig,
} from "@/config";

/**
 * 文章动态 OG 分享卡：`/og/<文章 id>.png`（1200×630）。
 *
 * ── 为什么是端点而不是组件 ──────────────────────────────────────────────
 * 社交平台只认 og:image 指向的**位图**，所以卡片不能靠页面 DOM 截屏，只能在
 * 构建期用 satori 把元素树画成 SVG、再交给 resvg 栅格化。整条链路都在构建期
 * 完成：不引入客户端 JS，也不引入任何运行时依赖。
 *
 * ── 与文章页的契约 ─────────────────────────────────────────────────────
 * 文件名只由 `getPostOgFileName()` 决定，文章页的 `og:image` 走
 * `getPostOgImageUrl()`，两者同源，避免「页面指向一个永不生成的地址」。
 * 以下两种情况端点零产出，页面侧同时不产出 `og:image`，两边一起退化：
 *   1. `articleConfig.ogImage.enable` 为 false；
 *   2. 站点没有任何 satori 可用的本地 TTF/OTF（例如 `fontConfig.mode: "system"`），
 *      由 `virtual:shirone-og-font` 的 `ogCardFontAvailable` 表达。
 *
 * ── 色板 ──────────────────────────────────────────────────────────────
 * OG 卡是脱离站点运行时的静态图片（同 giscus iframe：取不到父页面 CSS 变量），
 * 色值必须构建期烘焙。这里复用站点同一台 HCT 引擎（`resolveScheme`）按
 * `siteConfig.themeColor` 解析，站点换 hue/style/spec 卡片跟着变，不维护第二套配色。
 * 固定取**浅色**方案：`DEFAULT_THEME` 是 `auto`（跟随访客系统），而明暗状态只存在
 * 访客的 localStorage 里，爬虫抓取时没有这份状态——浅色是唯一确定、且在任何
 * 预览界面上都清晰的选择。
 */

type OgCardPathProps = {
	/** 已完成加密降级的展示标题。 */
	title: string;
	/** YYYY-MM-DD。 */
	date: string;
};

export async function getStaticPaths() {
	// 双开关：功能关闭、或站点没有任何可渲染字体时不产出图片。
	if (!resolveOgImageOptions(articleConfig) || !ogCardFontAvailable) return [];

	// 与 `src/pages/posts/[...slug].astro` 共用数据源，保证「有页面必有卡片」：
	// 草稿过滤（PROD 下 `draft: true` 不出现）与排序口径完全一致。
	const posts = await getSortedPosts();

	// 只有**没有封面**的文章才会把 og:image 指向这里（有封面时文章页直接用封面，
	// 那本来就是作者的意图，且分享平台的裁切表现更好）。所以端点也只给这些文章
	// 产出图片：否则每篇有封面的文章都会白渲染一张（satori 单张约 0.25s、PNG 约
	// 33KB），而那份产物永远不会被引用。
	// 改动这里的判据时，必须同步改文章页那两处 `entry.data.image ? … : …`。
	return posts
		.filter((entry) => !entry.data.image)
		.map((entry) => {
			// 复用全站共用的 fail-closed 加密契约，而不是就地重写一遍密码判定。
			const isEncrypted = isEncryptedPost(entry.data);
			// 卡片是公开产物，加密文章的标题不能从这里漏出去：与文章页的
			// `hideHomeContent` 分支保持同一份占位文案。
			const title =
				isEncrypted && entry.data.hideHomeContent
					? i18n(I18nKey.postEncryptedSummary)
					: entry.data.title;

			const props: OgCardPathProps = {
				title,
				date: formatDateToYYYYMMDD(entry.data.published),
			};
			return { params: { slug: getPostOgFileName(entry.id) }, props };
		});
}

/** satori 的元素树类型；`og-card.ts` 有意只声明它用到的那部分 CSS 子集。 */
type SatoriRoot = Parameters<typeof satori>[0];

export const GET: APIRoute<OgCardPathProps> = async ({ props }) => {
	const font = loadOgCardFont();
	if (!font) {
		// 只有 `getStaticPaths` 与实际能力不一致时才会走到这里，属防御分支：
		// 宁可让构建期显式报错，也不要静默产出一张空图。
		return new Response("OG share card font unavailable", { status: 500 });
	}

	const { hue, style, spec } = siteConfig.themeColor;
	// 配置层把 style/spec 声明为宽松的 `string`（支持用户叠加配置），引擎只接受
	// 枚举值。取值非法时**直接让构建失败**：静默换一套配色会让 OG 卡与站点配色
	// 不一致，而这比构建报错难发现得多。
	if (!isMcStyle(style) || !isMcSpec(spec)) {
		throw new Error(
			"[og] siteConfig.themeColor.style/spec must be a supported value " +
				`(got style="${style}", spec="${spec}").`,
		);
	}

	const scheme = resolveScheme(hue, false, style, spec);

	const element = buildPostOgCardElement({
		title: props.title,
		siteTitle: siteConfig.title,
		author: profileConfig.name,
		date: props.date,
		siteHost: hostFromSiteUrl(siteConfig.site),
		colors: buildOgCardColors(scheme),
	});

	const svg = await satori(element as unknown as SatoriRoot, {
		width: OG_CARD_WIDTH,
		height: OG_CARD_HEIGHT,
		fonts: [
			// 同一份缓冲区注册两次：卡片里标题用 700、站点名用 500，而 Yozai 只有
			// 500 一个字重。显式登记两个权重，satori 才不会走「就近取字重」的隐式回退。
			{ name: OG_FONT_FAMILY, data: font, weight: 500, style: "normal" },
			{ name: OG_FONT_FAMILY, data: font, weight: 700, style: "normal" },
		],
	});

	const png = new Resvg(svg).render().asPng();
	// resvg 交回的是 Node Buffer；复制成独立的 `ArrayBuffer` 再交给 Response——
	// @types/node 22 的 `Buffer<ArrayBufferLike>` 与 lib.dom 的 `BodyInit` 不兼容，
	// 而 `new Uint8Array(...)` 的 `buffer` 是确定的 `ArrayBuffer`（card 只有几十 KB，
	// 这一次复制可以忽略）。
	const body = new Uint8Array(png).buffer;
	return new Response(body, {
		headers: {
			"content-type": "image/png",
			// 产物随标题 / 主题色变化，因此不能用 immutable；具体时长交给宿主的
			// `_headers` / `vercel.json`（见 public/_headers），这里只保证
			// 「不是 HTML」这个关键头正确。
			"cache-control": "public, max-age=604800",
		},
	});
};
