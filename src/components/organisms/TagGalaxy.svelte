<script lang="ts">
/**
 * 标签星图：手写力导向布局（库仑斥力 + 共现弹簧 + 向心力）的 Canvas 可视化。
 * 无 D3 依赖；布局在初始化时同步收敛（≤600 步），不做常驻 rAF 空转，
 * 仅在指针事件与尺寸变化时按需重绘；prefers-reduced-motion 下同样只画静态帧。
 * 色彩全部取自语义 token（getComputedStyle 读取），暗色模式自动跟随。
 * 键盘与读屏用户使用上方 SSR 标签 Chip 云（本组件 role="img" 不参与焦点链）。
 */
interface TagGalaxyNode {
	name: string;
	count: number;
	url: string;
}

interface Props {
	nodes: TagGalaxyNode[];
	/** [i, j, weight] 三元组，i/j 为 nodes 下标 */
	links: [number, number, number][];
	ariaLabel: string;
	hint: string;
}

let { nodes, links, ariaLabel, hint }: Props = $props();

let canvas: HTMLCanvasElement | undefined = $state();
let hovered = $state(-1);

const NODE_MIN_RADIUS = 9;
const NODE_MAX_RADIUS = 26;
const TICKS_MAX = 600;
const ENERGY_EPS = 0.05;
const PADDING = 34;
const LABEL_BASELINE_GAP = 4;

// 确定性随机：固定种子保证每次构建/重排布局一致
function mulberry32(seed: number): () => number {
	let a = seed;
	return () => {
		a |= 0;
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

interface Layout {
	x: number[];
	y: number[];
	r: number[];
}

// 布局缓存：模拟收敛结果按画布尺寸复用，指针命中测试不重跑模拟
let layoutCache: { width: number; height: number; layout: Layout } | null =
	null;

function getLayout(width: number, height: number): Layout {
	if (
		layoutCache &&
		layoutCache.width === width &&
		layoutCache.height === height
	) {
		return layoutCache.layout;
	}
	const layout = buildLayout(width, height);
	layoutCache = { width, height, layout };
	return layout;
}

function buildLayout(width: number, height: number): Layout {
	const n = nodes.length;
	const rand = mulberry32(20261006);
	const cx = width / 2;
	const cy = height / 2;
	const maxCount = Math.max(1, ...nodes.map((node) => node.count));
	const r = nodes.map((node) => {
		const scaled =
			NODE_MIN_RADIUS +
			(NODE_MAX_RADIUS - NODE_MIN_RADIUS) * Math.sqrt(node.count / maxCount);
		return Math.min(NODE_MAX_RADIUS, Math.max(NODE_MIN_RADIUS, scaled));
	});

	// 黄金角螺旋初始化，避免重叠导致的早期震荡
	const x: number[] = [];
	const y: number[] = [];
	const golden = Math.PI * (3 - Math.sqrt(5));
	const spread = Math.min(width, height) / 2 - PADDING;
	for (let i = 0; i < n; i++) {
		const radius = spread * Math.sqrt((i + 0.5) / n) * (0.85 + rand() * 0.3);
		const angle = i * golden + rand() * 0.4;
		x.push(cx + radius * Math.cos(angle));
		y.push(cy + radius * Math.sin(angle));
	}

	// 同步收敛：库仑斥力 + 弹簧 + 向心力
	const vx = new Array<number>(n).fill(0);
	const vy = new Array<number>(n).fill(0);
	for (let tick = 0; tick < TICKS_MAX; tick++) {
		let energy = 0;
		for (let i = 0; i < n; i++) {
			for (let j = i + 1; j < n; j++) {
				let dx = x[i] - x[j];
				let dy = y[i] - y[j];
				let dist = Math.hypot(dx, dy) || 0.01;
				if (dist < 1) {
					dx = 0.5 + rand() * 0.1;
					dy = 0.5 + rand() * 0.1;
					dist = Math.hypot(dx, dy);
				}
				const force = Math.min(2400 / (dist * dist), 6);
				const fx = (dx / dist) * force;
				const fy = (dy / dist) * force;
				vx[i] += fx;
				vy[i] += fy;
				vx[j] -= fx;
				vy[j] -= fy;
			}
		}
		for (const [i, j, weight] of links) {
			if (i >= n || j >= n || i === j) continue;
			const rest = r[i] + r[j] + 46;
			const dx = x[j] - x[i];
			const dy = y[j] - y[i];
			const dist = Math.hypot(dx, dy) || 0.01;
			const force = Math.min(((dist - rest) * (1 + weight)) / 90, 4);
			const fx = (dx / dist) * force;
			const fy = (dy / dist) * force;
			vx[i] += fx;
			vy[i] += fy;
			vx[j] -= fx;
			vy[j] -= fy;
		}
		for (let i = 0; i < n; i++) {
			vx[i] += (cx - x[i]) * 0.02;
			vy[i] += (cy - y[i]) * 0.02;
			vx[i] *= 0.82;
			vy[i] *= 0.82;
			x[i] += Math.max(-8, Math.min(8, vx[i]));
			y[i] += Math.max(-8, Math.min(8, vy[i]));
			energy += vx[i] * vx[i] + vy[i] * vy[i];
		}
		if (energy < ENERGY_EPS) break;
	}

	// 收敛后整体缩放进画布内边距
	let minX = Number.POSITIVE_INFINITY;
	let maxX = Number.NEGATIVE_INFINITY;
	let minY = Number.POSITIVE_INFINITY;
	let maxY = Number.NEGATIVE_INFINITY;
	for (let i = 0; i < n; i++) {
		minX = Math.min(minX, x[i] - r[i]);
		maxX = Math.max(maxX, x[i] + r[i]);
		minY = Math.min(minY, y[i] - r[i]);
		maxY = Math.max(maxY, y[i] + r[i]);
	}
	const scaleX = (width - PADDING * 2) / Math.max(maxX - minX, 1);
	const scaleY = (height - PADDING * 2) / Math.max(maxY - minY, 1);
	const scale = Math.min(scaleX, scaleY, 1.6);
	const offsetX = (width - (maxX - minX) * scale) / 2 - minX * scale;
	const offsetY = (height - (maxY - minY) * scale) / 2 - minY * scale;
	return {
		x: x.map((px) => px * scale + offsetX),
		y: y.map((py) => py * scale + offsetY),
		r,
	};
}

function readTokens(element: HTMLCanvasElement): CSSStyleDeclaration {
	return getComputedStyle(element);
}

function paint(): void {
	if (!canvas || nodes.length === 0) return;
	const dpr = Math.min(window.devicePixelRatio || 1, 2);
	const width = canvas.clientWidth;
	const height = canvas.clientHeight;
	if (width === 0 || height === 0) return;
	canvas.width = Math.round(width * dpr);
	canvas.height = Math.round(height * dpr);
	const ctx = canvas.getContext("2d");
	if (!ctx) return;
	ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	ctx.clearRect(0, 0, width, height);

	const tokens = readTokens(canvas);
	const primary = tokens.getPropertyValue("--primary").trim() || "#888";
	const outline = tokens.getPropertyValue("--outline-variant").trim() || "#ccc";
	const labelColor =
		tokens.getPropertyValue("--on-surface-variant").trim() || "#666";
	const labelStrong = tokens.getPropertyValue("--on-surface").trim() || "#222";
	const fontStack =
		tokens.getPropertyValue("--font-sans").trim() || "system-ui, sans-serif";

	const layout = getLayout(width, height);

	// 连线：共现权重 → 透明度
	for (const [i, j, weight] of links) {
		if (i >= nodes.length || j >= nodes.length) continue;
		const active = hovered === i || hovered === j;
		ctx.strokeStyle = active ? primary : outline;
		ctx.globalAlpha = active ? 0.75 : Math.min(0.28 + weight * 0.12, 0.55);
		ctx.lineWidth = active ? 1.6 : 1;
		ctx.beginPath();
		ctx.moveTo(layout.x[i], layout.y[i]);
		ctx.lineTo(layout.x[j], layout.y[j]);
		ctx.stroke();
	}

	// 节点与标签
	ctx.globalAlpha = 1;
	ctx.textAlign = "center";
	ctx.textBaseline = "top";
	for (let i = 0; i < nodes.length; i++) {
		const active = hovered === i;
		const linked =
			hovered >= 0 &&
			links.some(
				([a, b]) => (a === hovered && b === i) || (b === hovered && a === i),
			);
		ctx.globalAlpha = hovered < 0 || active || linked ? 1 : 0.35;
		ctx.fillStyle = primary;
		ctx.beginPath();
		ctx.arc(layout.x[i], layout.y[i], layout.r[i], 0, Math.PI * 2);
		ctx.fill();
		if (active) {
			ctx.globalAlpha = 0.3;
			ctx.beginPath();
			ctx.arc(layout.x[i], layout.y[i], layout.r[i] + 5, 0, Math.PI * 2);
			ctx.fill();
			ctx.globalAlpha = 1;
		}
		ctx.fillStyle = active ? labelStrong : labelColor;
		ctx.globalAlpha = active ? 1 : hovered >= 0 ? 0.5 : 0.85;
		ctx.font = `${active ? "600 " : ""}12px ${fontStack}`;
		ctx.fillText(
			nodes[i].name,
			layout.x[i],
			layout.y[i] + layout.r[i] + LABEL_BASELINE_GAP,
		);
	}
	ctx.globalAlpha = 1;
}

function nodeAt(clientX: number, clientY: number): number {
	if (!canvas) return -1;
	const rect = canvas.getBoundingClientRect();
	const px = clientX - rect.left;
	const py = clientY - rect.top;
	const width = canvas.clientWidth;
	const height = canvas.clientHeight;
	const layout = getLayout(width, height);
	let best = -1;
	let bestDist = Number.POSITIVE_INFINITY;
	for (let i = 0; i < nodes.length; i++) {
		const dist = Math.hypot(px - layout.x[i], py - layout.y[i]);
		if (dist <= layout.r[i] + 6 && dist < bestDist) {
			best = i;
			bestDist = dist;
		}
	}
	return best;
}

function onPointerMove(event: PointerEvent): void {
	const index = nodeAt(event.clientX, event.clientY);
	if (index !== hovered) {
		hovered = index;
		paint();
	}
	if (canvas) {
		canvas.style.cursor = index >= 0 ? "pointer" : "default";
	}
}

function onPointerLeave(): void {
	if (hovered !== -1) {
		hovered = -1;
		paint();
	}
}

function onClick(event: MouseEvent): void {
	const index = nodeAt(event.clientX, event.clientY);
	if (index < 0) return;
	const url = nodes[index].url;
	const swup = (
		window as unknown as { swup?: { navigate: (u: string) => void } }
	).swup;
	if (swup?.navigate) {
		swup.navigate(url);
	} else {
		window.location.assign(url);
	}
}

$effect(() => {
	if (!canvas) return;
	paint();
	const observer = new ResizeObserver(() => paint());
	observer.observe(canvas);
	return () => observer.disconnect();
});
</script>

<div class="tag-galaxy">
	<canvas
		bind:this={canvas}
		class="tag-galaxy__canvas"
		role="img"
		aria-label={ariaLabel}
		onpointermove={onPointerMove}
		onpointerleave={onPointerLeave}
		onclick={onClick}
	></canvas>
	<p class="tag-galaxy__hint">{hint}</p>
</div>

<style lang="stylus">
.tag-galaxy
	display: block

	&__canvas
		display: block
		width: 100%
		height: 21rem
		border-radius: var(--shape-corner-m)
		background: unquote("color-mix(in oklab, var(--primary) 4%, transparent)")
		touch-action: pan-y

	&__hint
		margin-top: var(--m3e-space-2)
		text-align: center
		font: var(--m3e-type-label-medium)
		color: var(--text-50)
</style>
