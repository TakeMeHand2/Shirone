export const LIGHT_MODE = "light",
	DARK_MODE = "dark",
	AUTO_MODE = "auto";
export const DEFAULT_THEME: typeof AUTO_MODE = AUTO_MODE;
export const THEME_CHANGE_EVENT = "shirone:theme-change";

export const WALLPAPER_MODE_KEY = "wallpaper-mode";
export const WALLPAPER_MODE_CHANGE_EVENT = "wallpaper-mode:change";

export const TEXTURE_PRESET_KEY = "texture-preset";
export const TEXTURE_OPACITY_KEY = "texture-opacity";
export const TEXTURE_CHANGE_EVENT = "texture:change";
export const TEXTURE_PRESETS = [
	"none",
	"starlight",
	"cyber-dots",
	"topography",
	"geometric",
	"sakura",
] as const;

// Banner height unit: vh
export const BANNER_HEIGHT = 35;
export const BANNER_HEIGHT_EXTEND = 30;
export const BANNER_HEIGHT_HOME: number = BANNER_HEIGHT + BANNER_HEIGHT_EXTEND;

// The height the main panel overlaps the banner, unit: rem
// 桌面档需高于波浪视觉峰值（约 28px = 1.75rem），让波峰被面板圆角自然裁掉，
// 只留下圆角下沿的收口边，而不是露出一条平直的色带。
// 单列（移动端）波浪经 scaleY(0.72) 压扁，峰值随之降低，叠压同步收窄，否则
// 收口边显得过厚。取值与 BannerWaves.astro 的收口带高度成对，且必须满足
// 「峰值 > 叠压」。
// 用数字而非字符串：Layout.astro 的行内脚本靠 define:vars 注入这些常量，
// 注入的是标识符本身，只有模板字面量才能取到值；字符串常量会被原样内联成
// 未定义标识符，运行时拿到空值。两者统一以 rem 数字下发。
export const MAIN_PANEL_OVERLAPS_BANNER_HEIGHT = 2;
export const COMPACT_PANEL_OVERLAPS_BANNER_HEIGHT = 1.25;

// Page width: rem. Single sidebar uses PAGE_WIDTH; dual-column
// arrangement widens the frame one tier (resolved in responsive-utils).
export const PAGE_WIDTH = 85;
export const PAGE_WIDTH_DUAL = 96;
