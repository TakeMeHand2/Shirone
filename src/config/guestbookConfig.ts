import type { GuestbookConfig } from "../types/guestbookConfig.ts";
import { withUserConfig } from "../utils/config-overlay.ts";

/**
 * 留言板页面配置。
 *
 * 与「关于」页同构：`enable: false` 时访问返回软 404、导航入口被裁掉。
 * 评论区本身没有第二个开关——是否显示、用哪个 provider 一律由 `commentConfig`
 * 决定（`resolveCommentOptions()` 为 null 时页面只剩开场白，零额外负担）。
 * 开场白正文在 `src/content/spec/guestbook.md`。
 */
export const guestbookConfig: GuestbookConfig = withUserConfig("guestbook", {
	enable: true,
	// 标题与副标题默认走 i18n；想写死成个人化的文案就直接改成字面量。
	title: "$t:guestbook",
	description: "$t:guestbook",
});
