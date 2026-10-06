import type { QuoteConfig } from "@/types/quoteConfig";
import { withUserConfig } from "../utils/config-overlay.ts";

/**
 * 今日一言：侧栏每日轮换一句话。
 * 本地语料维护在 src/data/quotes.ts；切换 provider: "hitokoto" 后
 * 运行时从一言 API 拉取（外部请求，失败回退本地语料）。
 */
export const quoteConfig: QuoteConfig = withUserConfig("quote", {
	enable: true,
	provider: "local",
	api: "https://v1.hitokoto.cn/",
	timeout: 5000,
});
