/**
 * 设备展示页数据源（纯内容）。
 * 页面展示与筛选规则由 src/config/devicesConfig.ts 控制。
 */
import type { DeviceItem } from "@/types/devicesConfig";

export const devicesData: DeviceItem[] = [
	{
		id: "kuangshi-g16",
		name: "旷世 G16 游戏本",
		brand: "机械革命",
		category: "desk",
		status: "active",
		specs:
			"i7-12650H / RTX 4060 Laptop / 16GB (8G×2) 3200MHz / 1TB 长江存储 SSD",
		description:
			"日常主力机：写代码、打游戏、看番、折腾这个博客都在它上面，系统是 Windows 11 专业工作站版。",
		icon: "material-symbols:laptop-windows",
		featured: true,
	},
	{
		id: "oneplus-ace-5-ultra",
		name: "一加 Ace 5 至尊版",
		brand: "一加",
		category: "mobile",
		status: "active",
		specs: "天玑 9400+ / 12GB + 512GB",
		description: "随身主力机：刷 B 站、听歌、拍照和地铁上的游戏时间全靠它。",
		icon: "material-symbols:smartphone",
		featured: true,
	},
];

/** 获取所有设备数据列表 */
export function getDevicesList(): DeviceItem[] {
	return devicesData;
}
