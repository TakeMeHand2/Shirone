/** 文章详情页配置。 */
export interface ArticleConfig {
	lastUpdated: {
		/** 是否显示文章最后更新提示。 */
		enable: boolean;
		/** 距最后更新达到该日历天数时显示；0 表示立即显示。 */
		minimumAgeDays: number;
	};
	discovery: {
		/** 是否启用文章尾部的延伸阅读区域。 */
		enable: boolean;
		/** 按标签与分类证据筛选的相关文章。 */
		related: {
			enable: boolean;
			/** 最多显示的相关文章数量。 */
			count: number;
		};
		/** 从剩余候选中按当前文章稳定抽样的随机文章。 */
		random: {
			enable: boolean;
			/** 最多显示的随机文章数量。 */
			count: number;
		};
	};
	share: {
		/** 是否启用文章分享与海报生成。 */
		enable: boolean;
		/** 分享海报是否默认包含文章封面（封面不可用时自动降级为无封面排版）。 */
		includeCover: boolean;
	};
	ogImage: {
		/**
		 * 是否为**没有封面**的文章构建动态 OG 分享卡（`/og/<文章 id>.png`，1200×630）。
		 *
		 * 纯构建期产物：不引入任何客户端 JS。有封面时文章页优先用封面，端点也
		 * 不为这些文章出图。关闭时（或站点没有任何本地 TTF/OTF 字体时）端点零产出，
		 * `og:image` 回退到站点默认图（与历史行为一致）。
		 */
		enable: boolean;
	};
}
