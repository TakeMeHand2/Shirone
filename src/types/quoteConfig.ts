/**
 * 今日一言配置。
 * 侧栏 quote widget 消费：每日按日期轮换一句语料；
 * provider 为 "hitokoto" 时运行时从一言 API 拉取（失败自动回退本地语料）。
 */
export type QuoteConfig = {
	/** 总开关（false 时 widget 不渲染，零 DOM、零请求） */
	enable: boolean;
	/**
	 * 数据源：
	 * - "local"：构建期语料（src/data/quotes.ts），零外部请求（默认）
	 * - "hitokoto"：运行时拉取一言 API（外部请求，需显式开启）
	 */
	provider: "local" | "hitokoto";
	/** 一言 API 地址（provider 为 "hitokoto" 时生效，默认官方接口） */
	api?: string;
	/** 一言请求超时（毫秒，默认 5000；超时或失败回退本地语料） */
	timeout?: number;
};
