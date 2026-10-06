/**
 * Konami 秘技樱花雨彩蛋。
 * 全键盘序列（↑ ↑ ↓ ↓ ← → ← → B A）触发一次性樱花粒子迸发 + Snackbar 风提示；
 * 粒子样式随容器内联注入（触发才产生，零常驻 CSS），色彩全部取自语义 token，
 * reduced-motion 下只弹提示不播放粒子。文本框聚焦时序列进度归零，避免误触。
 */
import { funConfig } from "@/config/funConfig";
import I18nKey from "@/i18n/i18nKey";
import { i18n } from "@/i18n/translation";
import { prefersReducedMotion } from "@/utils/motion";

const KONAMI_SEQUENCE = [
	"ArrowUp",
	"ArrowUp",
	"ArrowDown",
	"ArrowDown",
	"ArrowLeft",
	"ArrowRight",
	"ArrowLeft",
	"ArrowRight",
	"b",
	"a",
] as const;

const PETAL_COUNT = 26;
const BURST_MAX_MS = 5200;

declare global {
	interface Window {
		__shironeKonamiBound?: boolean;
	}
}

function isTextEntryTarget(target: EventTarget | null): boolean {
	return (
		target instanceof HTMLElement &&
		(target.tagName === "INPUT" ||
			target.tagName === "TEXTAREA" ||
			target.tagName === "SELECT" ||
			target.isContentEditable)
	);
}

/** 容器级内联样式（触发时注入，随容器一同移除） */
function burstStyles(): string {
	return `
.burst-sakura { position: fixed; inset: 0; z-index: 70; pointer-events: none; overflow: hidden; }
.burst-sakura__petal {
  position: absolute; top: -4vh; display: block; border-radius: 100% 0 100% 0;
  background: var(--primary);
  opacity: 0.9;
  animation: burst-sakura-fall var(--fall-duration) var(--fall-delay) cubic-bezier(0.4, 0, 0.6, 1) forwards;
}
.burst-sakura__toast {
  position: absolute; left: 50%; bottom: 3rem; transform: translateX(-50%);
  padding: 0.625rem 1rem; border-radius: var(--shape-corner-xs);
  background: var(--inverse-surface); color: var(--inverse-on-surface);
  font: var(--m3e-type-body-medium); white-space: nowrap;
  animation: burst-sakura-toast 2.8s var(--m3e-easing-standard) forwards;
}
@keyframes burst-sakura-fall {
  0% { transform: translate3d(0, 0, 0) rotate(0deg); opacity: 0; }
  8% { opacity: var(--fall-opacity); }
  100% { transform: translate3d(var(--fall-drift), 108vh, 0) rotate(var(--fall-spin)); opacity: 0; }
}
@keyframes burst-sakura-toast {
  0% { opacity: 0; transform: translate(-50%, 0.5rem); }
  12%, 82% { opacity: 1; transform: translate(-50%, 0); }
  100% { opacity: 0; transform: translate(-50%, -0.25rem); }
}
@media (prefers-reduced-motion: reduce) {
  .burst-sakura__petal { animation: none; opacity: 0; }
  .burst-sakura__toast { animation-duration: 1.2s; }
}`;
}

function triggerSakuraBurst(): void {
	if (document.querySelector(".burst-sakura")) return;
	const reducedMotion = prefersReducedMotion();
	const stage = document.createElement("div");
	stage.className = "burst-sakura";
	stage.setAttribute("aria-hidden", "true");

	const styleEl = document.createElement("style");
	styleEl.textContent = burstStyles();
	stage.appendChild(styleEl);

	if (!reducedMotion) {
		// 花瓣尺寸/落点/时长均为装饰性随机（Math.random），不涉及任何安全用途
		for (let i = 0; i < PETAL_COUNT; i += 1) {
			const petal = document.createElement("i");
			petal.className = "burst-sakura__petal";
			const size = 6 + Math.round(Math.random() * 9);
			const style = petal.style;
			style.width = `${size}px`;
			style.height = `${size}px`;
			style.left = `${Math.round(Math.random() * 100)}vw`;
			style.setProperty("--fall-duration", `${2.6 + Math.random() * 2.2}s`);
			style.setProperty("--fall-delay", `${(Math.random() * 1.8).toFixed(2)}s`);
			style.setProperty(
				"--fall-drift",
				`${(Math.random() * 18 - 9).toFixed(1)}vw`,
			);
			style.setProperty(
				"--fall-spin",
				`${Math.round(Math.random() * 540 - 270)}deg`,
			);
			style.setProperty(
				"--fall-opacity",
				(0.55 + Math.random() * 0.35).toFixed(2),
			);
			if (i % 3 === 1) style.background = "var(--tertiary)";
			if (i % 5 === 2) style.background = "var(--secondary)";
			stage.appendChild(petal);
		}
	}

	const toast = document.createElement("div");
	toast.className = "burst-sakura__toast";
	toast.textContent = i18n(I18nKey.easterEggKonami);
	stage.appendChild(toast);

	document.body.appendChild(stage);
	window.setTimeout(() => stage.remove(), BURST_MAX_MS);
}

export function initKonami(): void {
	if (!funConfig.enable || !funConfig.konami) return;
	if (typeof window === "undefined" || window.__shironeKonamiBound) return;
	window.__shironeKonamiBound = true;

	let progress = 0;
	document.addEventListener(
		"keydown",
		(event) => {
			if (isTextEntryTarget(event.target)) {
				progress = 0;
				return;
			}
			const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
			progress =
				key === KONAMI_SEQUENCE[progress]
					? progress + 1
					: key === KONAMI_SEQUENCE[0]
						? 1
						: 0;
			if (progress === KONAMI_SEQUENCE.length) {
				progress = 0;
				triggerSakuraBurst();
			}
		},
		{ passive: true },
	);
}
