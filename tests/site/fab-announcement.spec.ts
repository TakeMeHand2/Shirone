import { expect, test } from "@playwright/test";

/**
 * FAB 公告板弹窗回归：
 * - announcementConfig 有内容时渲染按钮与面板（默认 mobile/tablet）；
 * - 按钮开合（data-open + aria-expanded）、关闭按钮与 Escape 收起；
 * - 桌面端视口（≥ 1024px）默认零 DOM。
 */
test.describe("fab announcement board", () => {
	test("toggles panel on mobile viewport", async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await page.goto("/", { waitUntil: "networkidle" });

		const button = page.locator("#fab-announcement-btn button");
		await expect(button).toBeVisible();
		await expect(button).toHaveAttribute("aria-expanded", "false");

		const panel = page.locator("#fab-announcement-panel");
		await expect(panel).toHaveAttribute("data-open", "false");
		await expect(panel).toBeHidden();

		await button.click();
		await expect(panel).toHaveAttribute("data-open", "true");
		await expect(panel).toBeVisible();
		await expect(panel.locator(".m3-fab-announcement__text")).toHaveText(/.+/);

		// Escape 收起
		await page.keyboard.press("Escape");
		await expect(panel).toHaveAttribute("data-open", "false");
		await expect(panel).toBeHidden();

		// 再次打开后点关闭按钮
		await button.click();
		await expect(panel).toHaveAttribute("data-open", "true");
		await panel.locator("[data-announcement-close]").click();
		await expect(panel).toHaveAttribute("data-open", "false");
	});

	test("renders zero DOM on desktop viewport", async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 900 });
		await page.goto("/", { waitUntil: "networkidle" });

		await expect(page.locator("#fab-announcement-btn")).toHaveCount(0);
		await expect(page.locator("#fab-announcement-panel")).toHaveCount(0);
	});
});
