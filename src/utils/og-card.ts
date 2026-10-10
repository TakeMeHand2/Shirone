import type { McScheme } from "./mc-utils";

/**
 * 动态 OG 分享卡（satori 渲染）。
 *
 * 本模块保持零运行时依赖（不 import mc-utils——material-color-utilities
 * 的内部 ESM 无扩展名，node:test 无法直接加载；颜色 scheme 由端点用
 * 站点 HCT 引擎解析后传入），使全部函数可被 node:test 单测覆盖。
 *
 * 色彩说明：OG 卡是脱离站点运行时的静态图片（等价于 giscus iframe 的
 * 跨源场景——取不到 CSS 变量），因此色值必须在构建期烘焙。这里不引入
 * 第二套配色，而是复用站点同一台 HCT 引擎（`resolveScheme`），按
 * `siteConfig.themeColor` 的 hue/style/spec 解析——站点换 hue，OG 卡随之
 * 变化。仅当某角色解析为 null（防御路径）时才回退到下方近似常量。
 *
 * 字体说明：satori 只接受 TTF/OTF（woff/woff2 需先解码才能取到字形轮廓），
 * 而仓库内唯一的 TTF 源是 Yozai-Medium.ttf。字节由 `virtual:shirone-og-font`
 * 在构建期从**绝对路径**读取（路径解析见 `src/integration/fonts.ts` 的
 * `resolveOgFontSource`；packaging-contract 禁止 `process.cwd()` 读主题文件，
 * 也禁止用 `?url` 把 15MB 的原始 TTF 复制进 dist 再读回来）。西文与 CJK 统一
 * 用 Yozai 渲染，保持圆润字形一致。
 *
 * 本模块是**纯函数**：不碰文件系统、不 import 站点配置。因此色板必须由调用方
 * 传入，字体字节由调用方提供——这样全部行为都能被 node:test 直接覆盖。
 */

export const OG_CARD_WIDTH = 1200;
export const OG_CARD_HEIGHT = 630;
export const OG_FONT_FAMILY = "Yozai Medium";

/** 防御性回退色（hue≈315 紫系近似值；实际路径 resolveScheme 恒有值）。 */
const FALLBACK_COLORS = {
	primary: "#7C3AA8",
	onPrimary: "#FFFFFF",
	primaryContainer: "#F2D9FA",
	onPrimaryContainer: "#2D0B4E",
	surface: "#F8F4FA",
	onSurface: "#1D1B20",
	onSurfaceVariant: "#49454F",
	outlineVariant: "#CAC4D0",
} as const;

export interface OgCardColors {
	primary: string;
	onPrimary: string;
	primaryContainer: string;
	onPrimaryContainer: string;
	surface: string;
	onSurface: string;
	onSurfaceVariant: string;
	outlineVariant: string;
}

/** 从 HCT 引擎输出的 scheme 提取 OG 卡色板；缺角色时逐项回退。 */
export function buildOgCardColors(scheme: McScheme): OgCardColors {
	const pick = (role: keyof OgCardColors): string =>
		typeof scheme[role] === "string"
			? (scheme[role] as string)
			: FALLBACK_COLORS[role];
	return {
		primary: pick("primary"),
		onPrimary: pick("onPrimary"),
		primaryContainer: pick("primaryContainer"),
		onPrimaryContainer: pick("onPrimaryContainer"),
		surface: pick("surface"),
		onSurface: pick("onSurface"),
		onSurfaceVariant: pick("onSurfaceVariant"),
		outlineVariant: pick("outlineVariant"),
	};
}

/**
 * 清理 satori 无法渲染的文本：emoji（Yozai 无 emoji 字形，会渲染成豆腐块）、
 * 控制符、零宽字符。后续如需 emoji，可走 satori `loadAdditionalAsset` +
 * 本地 twemoji SVG，此处保持零网络依赖。
 */
export function sanitizeOgText(text: string): string {
	return (
		text
			// biome-ignore lint/suspicious/noControlCharactersInRegex: 目标就是过滤控制符（C0 与 DEL），与 rules/../feed.ts 里 XML 字符集过滤同理
			.replace(/[\u0000-\u001F\u007F]/g, " ")
			.replace(/[\u200B-\u200F\u2028\u2029\uFEFF]/g, "")
			.replace(/[\u{1F1E6}-\u{1F1FF}]/gu, "") // 区域标记（旗帜）
			.replace(/[\u{E0020}-\u{E007F}]/gu, "") // 键帽/标签变体
			.replace(/\uFE0F?\u20E3/gu, "")
			.replace(/\p{Extended_Pictographic}/gu, "")
			.replace(/\uFE0F/g, "")
			.replace(/\s{2,}/g, " ")
			.trim()
	);
}

/** CJK/全角按 2 个宽度单位、其余按 1 计。 */
export function ogTextUnits(text: string): number {
	let units = 0;
	for (const char of text) {
		const code = char.codePointAt(0) ?? 0;
		units +=
			(code >= 0x1100 && code <= 0x115f) ||
			(code >= 0x2e80 && code <= 0xa4cf) ||
			(code >= 0xac00 && code <= 0xd7a3) ||
			(code >= 0xf900 && code <= 0xfaff) ||
			(code >= 0xfe30 && code <= 0xfe6f) ||
			(code >= 0xff00 && code <= 0xff60) ||
			(code >= 0xffe0 && code <= 0xffe6) ||
			(code >= 0x20000 && code <= 0x3fffd)
				? 2
				: 1;
	}
	return units;
}

const ELLIPSIS = "…";

/**
 * 卡片内边距（px）。所有内容带都按它绝对定位。
 */
export const OG_CARD_PADDING_X = 88;
export const OG_CARD_PADDING_Y = 68;

/**
 * 标题排版区间（px）：上边界是站点名 pill 的下沿，下边界是元信息行的上沿。
 * 标题块在其中垂直居中，因此一行标题与三行标题都落在视觉重心上。
 */
export const OG_TITLE_ZONE_TOP = 104;
export const OG_TITLE_ZONE_BOTTOM = 534;

/**
 * 标题/元信息列的宽度（px）。
 *
 * 卡片内宽是 1200 − 88×2 = 1024，这里只取 800：右侧 224px 是留给三枚装饰圆
 * 的呼吸区，文字压上去会让卡片显得脏。`ogTitleMaxUnits` 的换行预算按它计算。
 */
export const OG_TITLE_BOX_WIDTH = 800;

/** 标题左侧 accent bar 的宽度与它到文字的间距（px）。 */
export const OG_TITLE_ACCENT_WIDTH = 12;
export const OG_TITLE_ACCENT_GAP = 28;

/**
 * 标题文字真正可用的宽度：列宽减去 accent bar 与间距。
 * 换行预算必须按它算，按列宽算会高估约 5%，长标题的最后一行会压到装饰圆上。
 */
export const OG_TITLE_TEXT_WIDTH =
	OG_TITLE_BOX_WIDTH - OG_TITLE_ACCENT_WIDTH - OG_TITLE_ACCENT_GAP;

/** 标题最多占几行。超出的部分由 `clampOgTitle` 截断成省略号。 */
export const OG_TITLE_MAX_LINES = 3;

/** 标题行高。accent bar 的固定高度按它计算，两者必须同源。 */
export const OG_TITLE_LINE_HEIGHT = 1.3;

/**
 * 给定字号时标题的宽度预算（单位数）。
 *
 * 单位模型见 `ogTextUnits`：1 个汉字 = 2 单位 = 1 个 `fontSize` 见方的字身，
 * 所以 1 单位 ≈ `fontSize / 2` px。三种字号下预算分别是 71 / 81 / 95 单位，
 * 换算回汉字即约 35 / 40 / 47 个字 × 3 行。
 */
export function ogTitleMaxUnits(fontSize: number): number {
	return Math.floor(ogTitleUnitsPerLine(fontSize) * OG_TITLE_MAX_LINES);
}

/** 一行的容量（单位数）。 */
export function ogTitleUnitsPerLine(fontSize: number): number {
	return OG_TITLE_TEXT_WIDTH / (fontSize / 2);
}

/**
 * 标题实际占几行。截断已经保证单位数不超过 `ogTitleMaxUnits`，所以结果恒在 1..3。
 */
export function ogTitleLines(title: string, fontSize: number): number {
	const perLine = ogTitleUnitsPerLine(fontSize);
	return Math.min(
		OG_TITLE_MAX_LINES,
		Math.max(1, Math.ceil(ogTextUnits(title) / perLine)),
	);
}

export interface OgTitleBlock {
	/** 绝对定位用的顶部坐标。 */
	top: number;
	/** 块高，也是左侧 accent bar 的高度。 */
	height: number;
	lines: number;
}

/**
 * 标题块几何：按实际行数算高度，再在编排区间内垂直居中。
 *
 * accent bar 的高度必须等于这里的 `height`——早期实现把它写成固定「三行」高度，
 * 结果一行标题旁边立着一根 250px 的紫条，比例明显失衡。
 */
export function ogTitleBlock(title: string, fontSize: number): OgTitleBlock {
	const lines = ogTitleLines(title, fontSize);
	const height = lines * fontSize * OG_TITLE_LINE_HEIGHT;
	const zone = OG_TITLE_ZONE_BOTTOM - OG_TITLE_ZONE_TOP;
	return {
		top: OG_TITLE_ZONE_TOP + Math.max(0, (zone - height) / 2),
		height,
		lines,
	};
}

/** 标题截断：超出宽度预算时按权重裁剪并追加省略号。 */
export function clampOgTitle(title: string, maxUnits: number): string {
	if (ogTextUnits(title) <= maxUnits) return title;
	let kept = "";
	let units = 0;
	const budget = maxUnits - ogTextUnits(ELLIPSIS);
	for (const char of title) {
		const cost = ogTextUnits(char);
		if (units + cost > budget) break;
		kept += char;
		units += cost;
	}
	return `${kept.trimEnd()}${ELLIPSIS}`;
}

/** 按标题长度自适应字号（单位数越少字号越大，保持视觉节奏）。 */
export function ogTitleFontSize(title: string): number {
	const units = ogTextUnits(title);
	if (units <= 16) return 64;
	if (units <= 28) return 56;
	return 48;
}

/**
 * `siteConfig.site` → 卡片右下角展示的域名。
 *
 * 未配置 `site` 时返回空串（调用方据此省略域名），因此这里必须容忍
 * `http://` / `https://` / 结尾斜杠 / 带端口 / 带路径的各种写法。
 */
export function hostFromSiteUrl(site: string | undefined): string {
	if (!site) return "";
	const withoutProtocol = site.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "");
	const host = withoutProtocol.split("/")[0];
	return host.replace(/\/+$/, "");
}

export interface PostOgCardInput {
	/** 文章标题（调用方需先处理加密文章的占位文案）。 */
	title: string;
	/** 站点名（siteConfig.title）。 */
	siteTitle: string;
	/** 作者名（profileConfig.name）。 */
	author: string;
	/** 发布日期，YYYY-MM-DD。 */
	date: string;
	/** 站点域名（如 example.com）；无 site 配置时传空串即可。 */
	siteHost: string;
	colors: OgCardColors;
}

interface OgStyle {
	display?: string;
	flexDirection?: string;
	justifyContent?: string;
	alignItems?: string;
	position?: string;
	width?: number | string;
	height?: number | string;
	backgroundColor?: string;
	color?: string;
	borderRadius?: number | string;
	borderWidth?: number;
	borderColor?: string;
	borderStyle?: string;
	padding?: string;
	marginBottom?: number;
	fontSize?: number;
	fontWeight?: number;
	letterSpacing?: number;
	lineHeight?: number;
	top?: number;
	right?: number;
	bottom?: number;
	left?: number;
	zIndex?: number;
	overflow?: string;
	gap?: number;
	opacity?: number;
}

export interface OgElement {
	type: "div" | "span";
	props: {
		style: OgStyle;
		children: string | OgElement[];
	};
}

/** 调用点写法：样式与 children 平铺在一个对象里（读起来接近 JSX）。 */
type OgNodeProps = OgStyle & { children: string | OgElement[] };

/**
 * 构造 satori 节点。
 *
 * 注意调用点**只传一个 props 对象**，`children` 与样式平铺在一起：satori 会把
 * `props` 里除 `style`/`children` 之外的键当 CSS 声明去解析，而 `style` 里若混进
 * `children`（把整棵子树当 CSS 值），就会抛 `inputValue.trim is not a function`——
 * 报错信息里只显示一个数组，极难定位。这里由 `el()` 唯一负责把它拆开，
 * 调用点无法再写错。
 */
function el(type: OgElement["type"], props: OgNodeProps): OgElement {
	const { children, ...style } = props;
	return { type, props: { style, children } };
}

/** 构建 satori 元素树（纯函数，便于单测快照）。 */
export function buildPostOgCardElement(input: PostOgCardInput): OgElement {
	const { colors } = input;
	const sanitized =
		sanitizeOgText(input.title) || sanitizeOgText(input.siteTitle);
	// 先定字号、再按该字号的预算截断：字号决定预算，预算不该反过来挑字号，
	// 否则超长标题会拿到小字号却仍然溢出（-clamp 不生效的旧行为）。
	const titleFontSize = ogTitleFontSize(sanitized);
	const title = clampOgTitle(sanitized, ogTitleMaxUnits(titleFontSize));
	const titleBlock = ogTitleBlock(title, titleFontSize);
	const meta = [
		sanitizeOgText(input.author),
		sanitizeOgText(input.date),
	].filter(Boolean);
	const metaLine = meta.join("  ·  ");
	const host = sanitizeOgText(input.siteHost);

	// 画布尺寸固定（1200×630），因此所有内容带一律**绝对定位**，不用流式布局：
	//  1. satori 0.47 的 `justifyContent: "space-between"` 在列方向会把最后一个
	//     子节点整个丢掉（最小复现：三个 div + height 100% + padding，第三行不出现）。
	//     纯绝对定位不碰这条路径；
	//  2. 固定画布下「顶部站点名 / 中部标题 / 底部元信息」本来就是三个固定锚点，
	//     绝对定位让版面可预测，也不受标题行数影响。
	return el("div", {
		width: OG_CARD_WIDTH,
		height: OG_CARD_HEIGHT,
		display: "flex",
		backgroundColor: colors.surface,
		position: "relative",
		overflow: "hidden",
		children: [
			// ── M3E 装饰圆（Expressive 大形状语言；纹理与站点壁纸一致使用 primary 系） ──
			el("div", {
				position: "absolute",
				width: 520,
				height: 520,
				borderRadius: 9999,
				backgroundColor: colors.primaryContainer,
				top: -210,
				right: -140,
				children: [],
			}),
			el("div", {
				position: "absolute",
				width: 340,
				height: 340,
				borderRadius: 9999,
				borderWidth: 26,
				borderStyle: "solid",
				borderColor: colors.primary,
				opacity: 0.45,
				bottom: -120,
				right: 90,
				children: [],
			}),
			el("div", {
				position: "absolute",
				width: 120,
				height: 120,
				borderRadius: 9999,
				backgroundColor: colors.primary,
				opacity: 0.85,
				bottom: 150,
				right: 120,
				children: [],
			}),
			// ── 左上：站点名 pill ──
			el("div", {
				position: "absolute",
				left: OG_CARD_PADDING_X,
				top: OG_CARD_PADDING_Y,
				display: "flex",
				alignItems: "center",
				gap: 14,
				children: [
					el("div", {
						width: 18,
						height: 18,
						borderRadius: 9999,
						backgroundColor: colors.primary,
						children: [],
					}),
					el("span", {
						fontSize: 30,
						fontWeight: 500,
						letterSpacing: 1,
						color: colors.onSurfaceVariant,
						children: sanitizeOgText(input.siteTitle) || input.siteTitle,
					}),
				],
			}),
			// ── 中部：accent bar + 标题 ──
			el("div", {
				position: "absolute",
				left: OG_CARD_PADDING_X,
				top: titleBlock.top,
				display: "flex",
				gap: OG_TITLE_ACCENT_GAP,
				alignItems: "flex-start",
				width: OG_TITLE_BOX_WIDTH,
				children: [
					el("div", {
						width: OG_TITLE_ACCENT_WIDTH,
						borderRadius: 9999,
						backgroundColor: colors.primary,
						// alignSelf stretch 在 satori 中用 height 百分比不可靠，
						// 用标题块的实际块高（按行数算出）。
						height: titleBlock.height,
						children: [],
					}),
					el("span", {
						fontSize: titleFontSize,
						fontWeight: 700,
						lineHeight: OG_TITLE_LINE_HEIGHT,
						color: colors.onSurface,
						children: title,
					}),
				],
			}),
			// ── 左下：作者 · 日期（两者都为空时不渲染这一行） ──
			...(metaLine
				? [
						el("span", {
							position: "absolute",
							left: OG_CARD_PADDING_X,
							bottom: OG_CARD_PADDING_Y,
							fontSize: 28,
							color: colors.onSurfaceVariant,
							children: metaLine,
						}),
					]
				: []),
			// ── 右下：域名。只有 right 一个横向锚点，宽度由内容决定（未配置
			//    `siteConfig.site` 时整块不渲染，而不是留一个空节点） ──
			...(host
				? [
						el("span", {
							position: "absolute",
							right: OG_CARD_PADDING_X,
							bottom: OG_CARD_PADDING_Y,
							fontSize: 28,
							color: colors.primary,
							children: host,
						}),
					]
				: []),
		],
	});
}
