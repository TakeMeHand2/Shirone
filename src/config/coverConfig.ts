import type { CoverConfig } from "@/types/coverConfig";
import { withUserConfig } from "../utils/config-overlay.ts";

/**
 * 回退封面池：无封面文章按 slug 确定性轮换取图（列表卡片 + 文章页横幅）。
 * 默认留空（关闭）；条目支持 /public 绝对路径与远程 URL，例：
 *   fallbackCovers: ["/covers/01.webp", "/covers/02.webp"]
 */
export const coverConfig: CoverConfig = withUserConfig("cover", {
	fallbackCovers: [],
});
