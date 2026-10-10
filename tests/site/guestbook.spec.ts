import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, type Page, test } from "@playwright/test";
import { guestbookConfig } from "../../src/config/guestbookConfig";
import { navBarConfig } from "../../src/config/navBarConfig";
import { siteConfig } from "../../src/config/siteConfig";
import I18nKey from "../../src/i18n/i18nKey";
import { getTranslation } from "../../src/i18n/translation";
import type { NavBarLink } from "../../src/types/navBarConfig";
import { resolvePageKey } from "../../src/utils/nav-utils";

/**
 * 留言板页面契约。
 *
 * 三件事在这里锁定，都是「不报错但坏掉」的类型：
 * 1. 导航高亮靠 `pageKey` 与 `resolvePageKey(URL)` 相等，加了导航项却忘了在
 *    `resolvePageKey` 里登记，导航会永远不亮——没有构建期反馈；
 * 2. 顶栏与抽屉在 Swup 容器之外，站内导航后不重渲染，必须靠 `page:view` 重新同步；
 * 3. 开场白是可选内容（升级上来的用户没有 `spec/guestbook.md`），缺失时页面
 *    仍须可用：只剩评论区，不报错。
 */
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const introFile = join(repoRoot, "src", "content", "spec", "guestbook.md");

const dictionary = getTranslation(siteConfig.lang);
const guestbookLabel = dictionary[I18nKey.guestbook];

function flattenLinks(links: readonly NavBarLink[]): NavBarLink[] {
	return links.flatMap((link) => [
		link,
		...(link.children ? flattenLinks(link.children) : []),
	]);
}

async function navigateViaSwup(page: Page, path: string) {
	await page.waitForFunction(() => Boolean(window.swup?.navigate));
	await page.evaluate((target: string) => window.swup?.navigate(target), path);
	await expect(page).toHaveURL(new RegExp(`${path.replace(/\//g, "\\/")}$`));
}

test.describe("Guestbook 页面", () => {
	test("站内导航入口的 pageKey 与 resolvePageKey 一一对应", () => {
		// 防断言空转：这个用例只有真的遍历到入口才有意义。
		const checked: string[] = [];

		for (const link of flattenLinks(navBarConfig.links)) {
			if (!link.pageKey || !link.url) continue;
			if (link.external || !link.url.startsWith("/")) continue;
			const url = new URL(link.url, "https://example.com");
			expect(
				resolvePageKey(url),
				`「${link.name}」(${link.url}) 的 pageKey="${link.pageKey}" 在 resolvePageKey 里没有对应分支`,
			).toBe(link.pageKey);
			checked.push(link.pageKey);
		}

		expect(checked.length).toBeGreaterThan(0);
		expect(checked).toContain("guestbook");
	});

	test("渲染本地化标题、页面标识与评论外壳", async ({ page }) => {
		test.skip(!guestbookConfig.enable, "留言板未启用，跳过页面断言");

		await page.goto("/guestbook/", { waitUntil: "domcontentloaded" });

		await expect(page).toHaveTitle(new RegExp(guestbookLabel));
		await expect(page.locator("#swup-container")).toHaveAttribute(
			"data-current-page",
			"guestbook",
		);
		// hasComments 驱动「跳到评论」悬浮按钮；评论未启用时这里是 false
		await expect(page.locator("#swup-container")).toHaveAttribute(
			"data-has-comments",
			"true",
		);
		await expect(page.locator("#comments")).toHaveCount(1);
		await expect(page.locator("[data-nav-key=guestbook]")).toHaveCount(1);
	});

	test("开场白内容存在时渲染进卡片", async ({ page }) => {
		test.skip(!guestbookConfig.enable, "留言板未启用，跳过页面断言");
		test.skip(!existsSync(introFile), "未提供 src/content/spec/guestbook.md");

		await page.goto("/guestbook/", { waitUntil: "domcontentloaded" });

		// 正文来自 Markdown，因此在 #swup-container 里应能找到渲染后的标题元素
		await expect(
			page.locator("#swup-container").getByRole("heading", {
				name: guestbookLabel,
				level: 1,
			}),
		).toHaveCount(1);
	});

	test("Swup 站内导航后顶栏高亮同步到留言板", async ({ page }) => {
		test.skip(!guestbookConfig.enable, "留言板未启用，跳过导航断言");

		await page.goto("/", { waitUntil: "domcontentloaded" });
		await navigateViaSwup(page, "/guestbook/");

		await expect(page.locator("#swup-container")).toHaveAttribute(
			"data-current-page",
			"guestbook",
		);

		// 顶栏在 Swup 容器之外，只有 page:view 同步之后才会亮
		const navItem = page.locator("[data-nav-key=guestbook]");
		await expect(navItem).toHaveAttribute("aria-current", "page");
		// 它挂在「更多」下拉里，父级触发器也要跟着点亮
		await expect(
			page.locator("[data-nav-group]:has([data-nav-key=guestbook]) > button"),
		).toHaveClass(/top-app-bar__nav-link--active/);
	});
});
