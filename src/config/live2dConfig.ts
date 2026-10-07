import type { Live2dConfig, ResolvedLive2dOptions } from "@/types/live2dConfig";
import { withUserConfig } from "../utils/config-overlay.ts";

/**
 * Live2D 看板娘配置单一真源（第三方运行时：oh-my-live2d，MIT License）。
 *
 * 遵循「零额外负担」原则：默认全局关闭（enable: false），
 * 关闭时不产生任何外部网络请求、零 DOM 占位与零 bundle 膨胀；
 * 开启时 SDK 与模型均同源自托管（public/live2d/），不进主 bundle，零第三方请求。
 *
 * 【开启步骤】
 * 1. 将 `enable` 置为 `true`；
 * 2. 在 `options.models` 填入至少一个模型地址（`models[].path`，缩放 `scale` 默认 0.1）。
 *    本仓库已内置两个模型（均为自托管，许可见 public/live2d/README.md）：
 *    - DS鲸鱼娘：`/live2d/ds-whale/c_0120.model3.json`（Cubism 3，CC BY-NC-SA 4.0，
 *      模型：B站@氵六青，形象：@上善无形 / @ZipZipPin，已注册 idle 与点击动作）；
 *    - shizuku：`/live2d/shizuku/shizuku.model.json`（Cubism 2，Live2D 免费素材许可）。
 * 3. 其余选项（停靠侧 `dockedPosition`、移动端 `mobileDisplay`、主题色 `primaryColor`、
 *    状态条 `statusBar`、菜单 `menus`、提示 `tips` 等）按 https://oml2d.com 文档填入 `options`；
 * 4. `scriptUrl` 默认指向本地 SDK；如需换用其他 oh-my-live2d 版本，
 *    可替换 public/live2d/oml2d.min.js 或改为 CDN 地址。
 */
export const live2dConfig: Live2dConfig = withUserConfig("live2d", {
	enable: true,
	scriptUrl: "/live2d/oml2d.min.js",
	options: {
		// 右下角停靠：right 偏移须给 FAB 返回顶部按钮让出通道（FAB 右偏移 24 + 按钮宽 56 + 间隙），
		// 否则滚动后 FAB 会被舞台画布挡住无法点击
		dockedPosition: "right",
		stageStyle: {
			right: "104px",
			bottom: "0px",
		},
		// 关闭 oml2d 自带的悬浮菜单（休息/换装/切换模型/关于）：
		// 单模型站点下均无实用价值，「关于」还会跳转外站
		menus: { disable: true },
		// SDK 把模型画布硬编码为舞台内 z-index:9998，而对话框气泡（tips）没有 z-index，
		// 会被人物挡住；经 tips.style 透传为气泡内联样式，须取更高值才能盖过画布
		tips: {
			style: { zIndex: "9999" },
			mobileStyle: { zIndex: "9999" },
		},
		models: [
			{
				path: "/live2d/ds-whale/c_0120.model3.json",
				scale: 0.06,
			},
		],
	},
});

/**
 * 解析并校验 Live2D 配置。未启用或关键参数缺失时返回 null。
 */
export function resolveLive2dOptions(
	config: Live2dConfig,
): ResolvedLive2dOptions | null {
	if (!config.enable) {
		return null;
	}
	const scriptUrl = config.scriptUrl?.trim();
	if (!scriptUrl) {
		return null;
	}
	const options =
		config.options &&
		typeof config.options === "object" &&
		!Array.isArray(config.options)
			? config.options
			: {};
	return {
		scriptUrl,
		options,
	};
}

export type { ResolvedLive2dOptions };
