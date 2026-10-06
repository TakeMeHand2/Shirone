/**
 * Live2D 看板娘配置类型（第三方运行时：oh-my-live2d）。
 *
 * 遵循「零额外负担」原则：默认全局关闭（enable: false），
 * 关闭时不产生任何外部网络请求、零 DOM 占位与零 bundle 膨胀；
 * 开启时 SDK 由 CDN 动态注入，不进主 bundle。
 */
export interface Live2dConfig {
	/** 全局开关：false 时完全不注入 SDK 脚本与引导代码 */
	enable: boolean;
	/** oh-my-live2d SDK 脚本地址（默认 fastly jsdelivr，国内可达）；自托管或换 CDN 时替换 */
	scriptUrl: string;
	/**
	 * 透传给 `OML2D.loadOml2d()` 的选项对象，键值与官方文档一一对应：
	 * `models`（必填，`models[].path` 为模型 json 地址，`scale` 缩放默认 0.1）、
	 * `dockedPosition`（"left" | "right"）、`mobileDisplay`（移动端显示，默认 false）、
	 * `primaryColor`、`statusBar`、`menus`、`tips` 等；完整文档见 https://oml2d.com
	 */
	options: Record<string, unknown>;
}

/** 解析后的 Live2D 运行时选项（关闭或参数缺失时为 null） */
export interface ResolvedLive2dOptions {
	scriptUrl: string;
	options: Record<string, unknown>;
}
