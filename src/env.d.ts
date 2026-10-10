/// <reference types="astro/client" />
/// <reference path="../.astro/types.d.ts" />

declare module "virtual:shirone-music-sidebar" {
	const component:
		| typeof import("@components/organisms/music/MusicSidebar.astro").default
		| null;
	export default component;
}

/**
 * 动态 OG 分享卡的字体通道，由 `src/integration/index.ts` 的 `shirones:og-font`
 * 插件提供（原因见 `OG_FONT_VIRTUAL_ID` 的注释）。
 *
 * `ogCardFontAvailable` 是文字层唯一可信的开关：字体缺失时它与端点一起退到
 * 「不产出 / 不引用」，因此页面必须用它而不是只看 `articleConfig.ogImage.enable`，
 * 否则 `og:image` 会指向一张永远不会生成的图片。
 */
declare module "virtual:shirone-og-font" {
	export const ogCardFontAvailable: boolean;
	/** 由集成从绝对路径 `readFileSync` 读入并进程内缓存；`null` 表示不可用。 */
	const loadOgCardFont: () => Buffer | null;
	export default loadOgCardFont;
}

declare module "*scripts/anime/providers/bangumi.mjs" {
	export function fetchBangumiData(config: unknown): Promise<{
		provider: "bangumi";
		accountRef: string;
		rawItems: unknown[];
	}>;
}

declare module "*scripts/anime/providers/bilibili.mjs" {
	export function fetchBilibiliData(config: unknown): Promise<{
		provider: "bilibili";
		accountRef: string;
		rawItems: unknown[];
	}>;
}
