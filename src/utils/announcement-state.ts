/**
 * 公告「已关闭」状态的持久化契约 —— 全仓唯一持有该 localStorage 的位置。
 *
 * 为什么独立成模块：关闭状态要跨 Swup 换页与跨会话保持，属持久化状态；
 * 按分层约定 molecules 不得自己持有 localStorage，读写集中在这里的显式契约里，
 * 组件只负责 DOM 呈现。
 *
 * 契约：
 * - 键 `announcementClosed`：值为 `"true"` 表示用户关闭过公告；
 * - 键 `announcementClosedTime`：关闭时刻的毫秒时间戳字符串，配合 closeDuration 过期；
 * - localStorage 不可用（SSR、隐私模式抛错）时所有读写降级为「未关闭」，不抛异常；
 * - 键名是已发布契约，勿改名（站点测试与访客浏览器里的存量值都依赖它）。
 */

const KEY_CLOSED = "announcementClosed";
const KEY_CLOSED_TIME = "announcementClosedTime";

export interface AnnouncementDismissal {
	/** 用户是否关闭过公告 */
	closed: boolean;
	/** 关闭时刻（毫秒）；缺失或非法时为 null */
	closedAt: number | null;
}

function getStorage(): Storage | null {
	try {
		return typeof window === "undefined" ? null : window.localStorage;
	} catch {
		return null;
	}
}

export function readAnnouncementDismissal(): AnnouncementDismissal {
	const store = getStorage();
	if (!store) return { closed: false, closedAt: null };
	const rawTime = Number(store.getItem(KEY_CLOSED_TIME));
	return {
		closed: store.getItem(KEY_CLOSED) === "true",
		closedAt: Number.isFinite(rawTime) && rawTime > 0 ? rawTime : null,
	};
}

export function markAnnouncementDismissed(now: number = Date.now()): void {
	const store = getStorage();
	if (!store) return;
	store.setItem(KEY_CLOSED, "true");
	store.setItem(KEY_CLOSED_TIME, String(now));
}

export function clearAnnouncementDismissal(): void {
	const store = getStorage();
	if (!store) return;
	store.removeItem(KEY_CLOSED);
	store.removeItem(KEY_CLOSED_TIME);
}

/**
 * 关闭状态是否已过期。`durationSeconds` 非正数或非法表示永不过期；
 * 关闭时间缺失（历史数据损坏）按已过期处理，让公告重新露面。
 */
export function isAnnouncementDismissalExpired(
	dismissal: AnnouncementDismissal,
	durationSeconds: number,
	now: number = Date.now(),
): boolean {
	if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return false;
	if (!dismissal.closed || dismissal.closedAt === null) return true;
	return (now - dismissal.closedAt) / 1000 > durationSeconds;
}
