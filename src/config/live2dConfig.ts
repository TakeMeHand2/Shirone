import type {
	Live2dConfig,
	Live2dExpressionMenuOptions,
	ResolvedExpressionMenuOptions,
	ResolvedLive2dOptions,
} from "@/types/live2dConfig";
import { withUserConfig } from "../utils/config-overlay.ts";

/**
 * Live2D 看板娘配置单一真源（第三方运行时：oh-my-live2d，MIT License）。
 *
 * 遵循「零额外负担」原则：默认全局关闭（enable: false），
 * 关闭时不产生任何外部网络请求、零 DOM 占位与零 bundle 膨胀；
 * 开启时 SDK 与模型均同源自托管（public/live2d/），不进主 bundle，零第三方请求。
 *
 * 【运行成本】开启后挂件是常驻 WebGL 渲染循环（桌面端），存在持续的 GPU/电量开销；
 * SDK 注入已延迟到浏览器空闲（不与首屏抢资源），模型与 SDK 均同源可缓存；
 * 移动端默认不显示（mobileDisplay: false）。
 *
 * 【CSP】挂件含一处内联引导脚本与一处内联定位样式；站点启用严格 CSP 时二选一：
 * 1. 哈希白名单——把构建产物里该脚本/样式的 sha256 加进 script-src / style-src，
 *    适合构建期生成（配置一改哈希即变，需随构建更新）；
 * 2. nonce——服务端每请求生成 nonce 写入 `cspNonce`，并把同一个值放进 CSP 响应头。
 *
 * 【开启步骤】
 * 1. 将 `enable` 置为 `true`；
 * 2. 在 `options.models` 填入至少一个模型地址（`models[].path`，缩放 `scale` 默认 0.1），
 *    未配置有效模型时挂件会跳过加载并提示一次。仓库内置一个示例模型
 *    （自托管，来源与许可见 public/live2d/README.md）：
 *    DS鲸鱼娘：`/live2d/ds-whale/c_0120.model3.json`（Cubism 3，CC BY-NC-SA 4.0，
 *    模型：B站@氵六青，形象：@上善无形 / @ZipZipPin，已注册 idle 与点击动作）；
 *    **模型必须自带 `HitAreas`**，否则 pixi 的 hitTest 恒为空、`hit` 永不触发，
 *    点击看板娘不会有任何反应（链路与命名要求见 public/live2d/README.md）；
 *    模型目录须留在 `public/`（SDK 运行期按 json 相对路径取同级资源，无法打包），
 *    npm 包模式请先把模型目录复制进自己项目的 public/live2d/。
 * 3. 其余选项（停靠侧 `dockedPosition`、移动端 `mobileDisplay`、主题色 `primaryColor`、
 *    状态条 `statusBar`、菜单 `menus`、提示 `tips` 等）按 https://oml2d.com 文档填入 `options`；
 * 4. SDK 随主题分发（`src/assets/live2d/oml2d.min.js`，bundler 解析，两种模式都可用）。
 *    换 oh-my-live2d 版本时替换该文件，或设置 `scriptUrl` 指向 CDN / 自托管副本。
 */
export const live2dConfig: Live2dConfig = withUserConfig("live2d", {
	enable: true,
	// scriptUrl 省略即用随主题分发的 SDK（src/assets/live2d/oml2d.min.js，
	// bundler 解析出 URL，源码态与 npm 包态都可用）；换版本 / 走 CDN 时再填完整 URL。
	options: {
		// 停靠位：把看板娘锚在「博客主体列」的右下角，而不是视口右下角。
		// 主体列右边缘 = 页框居中留白 + --main-content-column-inset（见 variables.styl，
		// 该变量已含栅格内边距与 xl 起的次级侧栏列）。居中外框随视口变化、窄于页框时贴边，
		// 故用 max(0px, ...) 兜住，不能写死像素值。
		dockedPosition: "right",
		stageStyle: {
			right:
				"calc(max(0px, (100% - var(--page-width)) / 2) + var(--main-content-column-inset))",
			bottom: "0px",
			// 舞台必须落在悬浮控件之下：FAB 容器 z-45、顶栏与显示设置面板 z-50。
			// SDK 默认 z-index 9997（画布 9998、气泡 9999）会让看板娘盖住展开的
			// 「主题配色」面板选项，并吞掉同区域 FAB 的点击；取 40 使其位于
			// 页面内容（≤30）之上、悬浮控件（FAB 45 / 顶栏 50 / 目录 60）之下。
			zIndex: 40,
		},
		// 关闭 oml2d 自带的悬浮菜单（休息/换装/切换模型/关于）：
		// 单模型站点下均无实用价值，「关于」还会跳转外站。
		// 注意：这不是「菜单整体关闭」——`expressionMenu.enable` 开启时组件会接管菜单，
		// 用主题自己的「换表情」项重建 items，SDK 内置四项仍然不会出现。
		menus: { disable: true },
		// 气泡（tips）：几何与语义在这里，皮肤（配色/圆角/阴影/字体/尾巴）由
		// Live2dWidget 注入的样式表接管（见该组件内的 !important boundary 注释）。
		//
		// 实测依据：舞台盒是模型的等比取景框——把舞台加高，人物会跟着等比放大、
		// 在盒内的占比纹丝不动（183×183 与 183×268 下人物均为 上 9.3% / 右 100%），
		// 所以盒内没有可用留白。留白带只能放到舞台盒之上：气泡底边锚在
		// 「舞台顶边 + space-2」，人物恒在盒内 → 结构上不可能被压住，换模型也成立。
		// 水平锚点 57% 对准人物（实测人物包围盒在舞台内 x 26→183，中心 57%）。
		// 宽度 72% 让中文按正常规则折行，避免 SDK 默认 60% 下出现孤字行。
		//
		// 约束：显隐与抖动动画独占 transform: translate(-50%, …)，
		// 所以水平位置只能靠 left 调，不能用 transform 搬。
		tips: {
			style: {
				top: "auto",
				bottom: "calc(100% + var(--m3e-space-2))",
				left: "57%",
				width: "72%",
				minHeight: "0",
				zIndex: "9999",
			},
			mobileStyle: {
				top: "auto",
				bottom: "calc(100% + var(--m3e-space-2))",
				left: "57%",
				width: "72%",
				minHeight: "0",
				zIndex: "9999",
			},
		},
		models: [
			{
				path: "/live2d/ds-whale/c_0120.model3.json",
				// 实测：oml2d 的舞台盒边长 ≈ 4068 × scale（该值来自模型画布宽度），
				// 0.045 对应约 183px 见方，比 0.06（244px）小一圈，
				// 收在右下角时不至于压住侧栏卡片与设置面板
				scale: 0.045,
			},
		],
	},
	// 表情菜单：模型自带 44 个表情，但既不会被动作触发（motion 曲线只驱动 Parameter，
	// 没有可见性曲线也没有 Meta.ExpressionIds），oml2d 也没有换表情入口，
	// 所以不额外提供入口的话，表情清单等于闲置。这里给出「换表情」菜单项：点一次换一个。
	//
	// 切换语义是「替换」而不是「过渡」：组件会先清空表情队列、并把表情动作的淡入/淡出压成 0
	// （表情声明全是 Blend:"Add"，两条条目同时存活就会把同一组参数加两次）。因此 cooldown
	// 只承担「连点节流」的职责，不需要大于淡出时长。
	expressionMenu: {
		enable: true,
		// sequential：按 model3.json 的注册顺序依次循环，可预期、便于回到某个表情；
		// 换 random 则每次随机且不与当前重复。
		order: "sequential",
	},
});

/** 同一进程内只提示一次，避免逐页渲染刷屏 */
let warnedMissingModels = false;

/**
 * 归一化表情菜单配置。未开启时返回 undefined，
 * 组件据此短路：不重建菜单、不注入图标 symbol、不拼装点击逻辑。
 */
function resolveExpressionMenu(
	menu: Live2dExpressionMenuOptions | undefined,
): ResolvedExpressionMenuOptions | undefined {
	if (menu?.enable !== true) {
		return undefined;
	}
	const names = Array.isArray(menu.names)
		? menu.names.filter(
				(name) => typeof name === "string" && name.trim() !== "",
			)
		: [];
	const cooldown =
		typeof menu.cooldown === "number" &&
		Number.isFinite(menu.cooldown) &&
		menu.cooldown >= 0
			? menu.cooldown
			: 400;
	return {
		order: menu.order === "random" ? "random" : "sequential",
		...(names.length > 0 ? { names } : {}),
		cooldown,
	};
}

/**
 * 解析并校验 Live2D 配置。以下情况返回 null（零额外负担的短路点）：
 * 未启用、或启用但 `options.models` 里没有带有效 `path` 的模型
 * （此时只在首次调用时提示一次，SDK 不注入）。
 * `scriptUrl` 是可选的覆盖项：省略时由组件用随包分发的 SDK 兜底。
 */
export function resolveLive2dOptions(
	config: Live2dConfig,
): ResolvedLive2dOptions | null {
	if (!config.enable) {
		return null;
	}
	const scriptUrl = config.scriptUrl?.trim();
	const cspNonce = config.cspNonce?.trim();
	const expressionMenu = resolveExpressionMenu(config.expressionMenu);
	const options =
		config.options &&
		typeof config.options === "object" &&
		!Array.isArray(config.options)
			? config.options
			: {};
	const models = Array.isArray(options.models) ? options.models : [];
	const validModels = models.filter(
		(model) => typeof model?.path === "string" && model.path.trim() !== "",
	);
	if (validModels.length === 0) {
		if (!warnedMissingModels) {
			warnedMissingModels = true;
			console.warn(
				"[shirone] Live2D 已开启但 options.models 里没有有效模型（models[].path 为空），已跳过加载。请在 src/config/live2dConfig.ts 配置模型地址。",
			);
		}
		return null;
	}
	return {
		...(scriptUrl ? { scriptUrl } : {}),
		...(cspNonce ? { cspNonce } : {}),
		...(expressionMenu ? { expressionMenu } : {}),
		// 不修改调用方的 options 对象（配置单例），返回剔除无效项后的新对象
		options:
			validModels.length === models.length
				? options
				: { ...options, models: validModels },
	};
}

export type { ResolvedLive2dOptions };
