/**
 * 文章封面回退配置。
 * 无封面（frontmatter 未填 image）的文章按 slug 确定性轮换使用回退封面池，
 * 让列表与文章页横幅保持视觉完整；池为空时功能完全关闭（零开销）。
 */
export type CoverConfig = {
	/**
	 * 回退封面池。支持 /public 绝对路径（如 "/covers/01.webp"）与远程 URL
	 * （https://...）。留空数组 = 关闭（默认），不产生任何额外处理。
	 */
	fallbackCovers?: string[];
};
