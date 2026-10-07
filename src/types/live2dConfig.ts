/**
 * Live2D 看板娘配置类型（第三方运行时：oh-my-live2d）。
 *
 * 遵循「零额外负担」原则：默认全局关闭（enable: false），
 * 关闭时不产生任何外部网络请求、零 DOM 占位与零 bundle 膨胀；
 * 开启时 SDK 由本地延迟注入，不进主 bundle。
 */

/** 透传给 oml2d 的样式覆盖（键名为小驼峰 CSS 属性，值为带单位字符串或数字） */
export type Live2dStyleOverrides = Record<string, string | number>;

/** 单个模型条目（models[]） */
export interface Live2dModelOptions {
	/** 模型 json 地址（Cubism 3/5 为 *.model3.json，Cubism 2 为 *.model.json） */
	path: string;
	/** 模型缩放，默认 0.1 */
	scale?: number;
	/** 桌面端舞台样式覆盖（仅作用于该模型） */
	stageStyle?: Live2dStyleOverrides;
	/** 移动端舞台样式覆盖（仅作用于该模型） */
	mobileStageStyle?: Live2dStyleOverrides;
}

/** 问候语时段映射（键与 oml2d 的小时分段一一对应，缺项由主题 i18n 补齐） */
export type Live2dWelcomeMessages = Partial<
	Record<
		| "daybreak"
		| "morning"
		| "noon"
		| "afternoon"
		| "dusk"
		| "night"
		| "lateNight"
		| "weeHours",
		string
	>
>;

export interface Live2dWelcomeTipsOptions {
	/** 时段问候语；省略整组时由主题按站点语言注入 */
	message?: Live2dWelcomeMessages;
	duration?: number;
	priority?: number;
}

export interface Live2dCopyTipsOptions {
	/** 复制内容时的提示语（随机取一条）；省略时由主题按站点语言注入 */
	message?: string[];
	duration?: number;
	priority?: number;
}

export interface Live2dIdleTipsOptions {
	wordTheDay?: boolean;
	message?: string[];
	duration?: number;
	interval?: number;
	priority?: number;
}

export interface Live2dTipsOptions {
	style?: Live2dStyleOverrides;
	mobileStyle?: Live2dStyleOverrides;
	/** 气泡最大行数 */
	messageLine?: number;
	idleTips?: Live2dIdleTipsOptions;
	welcomeTips?: Live2dWelcomeTipsOptions;
	copyTips?: Live2dCopyTipsOptions;
}

export interface Live2dStatusBarOptions {
	disable?: boolean;
	transitionTime?: number;
	switchingMessage?: string;
	loadingMessage?: string;
	loadSuccessMessage?: string;
	loadFailMessage?: string;
	reloadMessage?: string;
	restMessage?: string;
	restMessageDuration?: number;
	loadingIcon?: string;
	errorColor?: string;
	style?: Live2dStyleOverrides;
	mobileStyle?: Live2dStyleOverrides;
}

export interface Live2dMenusOptions {
	disable?: boolean;
	/** 自定义菜单项；省略时使用 SDK 内置四项（休息/换装/切换模型/关于） */
	items?: Array<{
		id: string;
		icon: string;
		title: string;
		onClick?: (oml2d: unknown) => void;
	}>;
	style?: Live2dStyleOverrides;
	itemStyle?: Live2dStyleOverrides;
	mobileStyle?: Live2dStyleOverrides;
	mobileItemStyle?: Live2dStyleOverrides;
}

/** 透传给 loadOml2d() 的运行时选项（键名与官方文档一一对应，见 https://oml2d.com） */
export interface Live2dRuntimeOptions {
	dockedPosition?: "left" | "right";
	mobileDisplay?: boolean;
	primaryColor?: string;
	transitionTime?: number;
	sayHello?: boolean;
	stageStyle?: Live2dStyleOverrides;
	models?: Live2dModelOptions[];
	menus?: Live2dMenusOptions;
	tips?: Live2dTipsOptions;
	statusBar?: Live2dStatusBarOptions;
	/** 其余进阶键（parentElement / importType / libraryUrls 等）不做约束，原样透传 */
	[key: string]: unknown;
}

export interface Live2dConfig {
	/** 全局开关：false 时完全不注入 SDK 脚本与引导代码 */
	enable: boolean;
	/** oh-my-live2d SDK 脚本地址（默认本地自托管 public/live2d/）；换版本或走 CDN 时替换 */
	scriptUrl: string;
	/** 透传选项：常用键已建类型，拼错的键过不了 astro check */
	options: Live2dRuntimeOptions;
}

/** 解析后的 Live2D 运行时选项（关闭或参数缺失时为 null） */
export interface ResolvedLive2dOptions {
	scriptUrl: string;
	options: Live2dRuntimeOptions;
}
