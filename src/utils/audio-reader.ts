const AUDIO_READER_SELECTOR = "[data-audio-reader]";
const AUDIO_MEDIA_SELECTOR = "[data-audio-reader-media]";
const boundReaders = new WeakSet<HTMLElement>();
let teardownBound = false;

/**
 * Swup 换页只替换内容容器：`<audio>` 被移出文档后**不会自动停止**，
 * 上一篇文章的音频会继续在后台播放。导航开始时主动暂停并回到开头。
 */
function bindNavigationTeardown(): void {
	if (teardownBound || typeof document === "undefined") return;
	teardownBound = true;
	document.addEventListener("swup:visit:start", () => {
		document
			.querySelectorAll<HTMLAudioElement>(AUDIO_MEDIA_SELECTOR)
			.forEach((audio) => {
				if (audio.paused) return;
				audio.pause();
				audio.currentTime = 0;
			});
	});
}

function setState(
	reader: HTMLElement,
	toggle: HTMLButtonElement,
	state: "paused" | "playing" | "error",
): void {
	reader.dataset.audioReaderState = state;
	toggle.setAttribute("aria-pressed", String(state === "playing"));
}

function wire(reader: HTMLElement): void {
	if (boundReaders.has(reader)) return;
	const audio = reader.querySelector<HTMLAudioElement>(
		"[data-audio-reader-media]",
	);
	const toggle = reader.querySelector<HTMLButtonElement>(
		"[data-audio-reader-toggle]",
	);
	if (!audio || !toggle) return;
	boundReaders.add(reader);

	audio.addEventListener("play", () => setState(reader, toggle, "playing"));
	audio.addEventListener("pause", () => setState(reader, toggle, "paused"));
	audio.addEventListener("ended", () => setState(reader, toggle, "paused"));
	audio.addEventListener("error", () => setState(reader, toggle, "error"));
	const togglePlayback = () => {
		if (audio.paused) {
			void audio.play().catch(() => setState(reader, toggle, "error"));
			return;
		}
		audio.pause();
	};
	toggle.addEventListener("click", () => {
		togglePlayback();
	});
}

/** Adds idempotent playback controls to compact audio reader markup. */
export function initAudioReaders(container: ParentNode = document): void {
	if (typeof document === "undefined") return;
	bindNavigationTeardown();
	container.querySelectorAll<HTMLElement>(AUDIO_READER_SELECTOR).forEach(wire);
}
