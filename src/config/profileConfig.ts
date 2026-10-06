import type { ProfileConfig } from "@/types/config";
import { withUserConfig } from "../utils/config-overlay.ts";

/**
 * 博主资料：头像 / 名称 / 简介 / 社交链接（侧栏 Profile 卡片、页脚、RSS 作者等消费）。
 * 类型见 src/types/config.ts。
 */
export const profileConfig: ProfileConfig = withUserConfig("profile", {
	avatar: "assets/images/t1.webp", // Relative to the /src directory. Relative to the /public directory if it starts with '/'
	name: "序号",
	bio: "与你在一起的每天便是奇迹",
	links: [
		{
			name: "Bilibili",
			icon: "fa6-brands:bilibili", // Visit https://icones.js.org/ for icon codes
			// You will need to install the corresponding icon set if it's not already included
			// `pnpm add @iconify-json/<icon-set-name>`
			url: "https://space.bilibili.com/3494377393490309?spm_id_from=333.1007.0.0",
		},
		{
			name: "Steam",
			icon: "fa6-brands:steam",
			url: "https://steamcommunity.com/profiles/76561199597550355/",
		},
		{
			name: "GitHub",
			icon: "fa6-brands:github",
			url: "https://github.com/TakeMeHand2",
		},
	],
});
