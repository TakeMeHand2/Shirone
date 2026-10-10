import type { PageMeta } from "./pageMeta.ts";

/**
 * 留言板页面配置。
 *
 * 只继承通用的页面身份（开关 / 标题 / 副标题）：留言板没有独立的数据源，
 * 开场白是 `src/content/spec/guestbook.md` 的内容，评论区则完全复用
 * `commentConfig`（全局开关与 provider 由它决定，不在这里再开一套）。
 */
export interface GuestbookConfig extends PageMeta {}
