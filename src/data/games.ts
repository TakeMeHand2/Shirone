/**
 * 游戏展示页数据源（纯内容）。
 * 页面展示与筛选规则由 src/config/gamesConfig.ts 控制。
 *
 * 封面支持三种写法：
 * - src/assets 相对路径（如本文件所用，走 Astro 图片管线自动优化为 webp/avif）；
 * - /public 绝对路径（如 "/assets/games/xxx.webp"，原样输出）；
 * - 远程 URL（https://…）。
 */
import type { GameItem } from "@/types/gamesConfig";

export const gamesData: GameItem[] = [
	{
		id: "genshin-impact",
		name: "原神",
		developer: "HoYoverse",
		category: "open-world",
		status: "playing",
		cover: "assets/games/genshin-hero.jpg",
		icon: "material-symbols:explore-outline-rounded",
		platform: "PC",
		year: "2020",
		tags: ["开放世界", "二次元", "冒险"],
		description:
			"提瓦特大陆悠闲旅行中，每天清体力做日常。至于十连三金？根本没有的事。",
		link: "https://ys.mihoyo.com/",
		featured: true,
	},
	{
		id: "honkai-star-rail",
		name: "崩坏：星穹铁道",
		developer: "HoYoverse",
		category: "rpg",
		status: "playing",
		cover: "assets/games/hkrpg-hero.png",
		icon: "material-symbols:rocket-launch-outline-rounded",
		platform: "PC",
		year: "2023",
		tags: ["回合制", "RPG", "二次元"],
		description:
			"跟着星穹列车穿越银河的开拓之旅。回合制玩的是配队与策略，就是抽卡规划永远赶不上版本更新。",
		link: "https://sr.mihoyo.com/",
		featured: true,
	},
	{
		id: "zenless-zone-zero",
		name: "绝区零",
		developer: "HoYoverse",
		category: "action",
		status: "playing",
		cover: "assets/games/zzz-hero.png",
		icon: "material-symbols:sports-esports-outline-rounded",
		platform: "PC",
		year: "2024",
		tags: ["动作", "都市", "二次元"],
		description:
			"新艾利都的绳匠日常。切人、闪避、连携打击感一流，打完一场空洞副本格外解压。",
		link: "https://zzz.mihoyo.com/",
		featured: true,
	},
];
