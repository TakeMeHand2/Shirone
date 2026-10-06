/**
 * 趣味彩蛋配置。
 * 所有彩蛋均为自包含实现（无外部请求、不进第三方依赖），
 * 关闭时零 DOM、零监听器；样式在触发时才注入（零常驻 CSS）。
 */
export type FunConfig = {
	/** 总开关（false 时全部彩蛋零开销） */
	enable: boolean;
	/** Konami 秘技樱花雨（↑ ↑ ↓ ↓ ← → ← → B A 触发） */
	konami: boolean;
};
