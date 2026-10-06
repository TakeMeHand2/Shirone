import { expect, test } from "@playwright/test";

/**
 * 标签星图回归（/tags/）：
 * - SSR Chip 云始终渲染（星图的无障碍替代与无 JS 回退）；
 * - 门控：标签数 ≥ 3 时渲染星图卡片（Canvas + aria-label + 提示文案），
 *   否则整体不输出（零 DOM）；
 * - 星图 Canvas 按需水合（client:visible），不阻塞首屏。
 */
test.describe("tag galaxy", () => {
	test.use({ viewport: { width: 1280, height: 900 } });

	test("chip cloud always renders as the accessible fallback", async ({
		page,
	}) => {
		await page.goto("/tags/", { waitUntil: "networkidle" });

		const cloud = page.locator(".tag-index__cloud");
		await expect(cloud).toBeVisible();
		expect(await cloud.locator(".tag-index__chip").count()).toBeGreaterThan(0);
	});

	test("galaxy renders only when at least three tags exist", async ({
		page,
	}) => {
		await page.goto("/tags/", { waitUntil: "networkidle" });

		const chipCount = await page.locator(".tag-index__chip").count();
		const galaxy = page.locator(".tag-galaxy");

		if (chipCount >= 3) {
			await expect(galaxy).toBeVisible();
			const canvas = galaxy.locator("canvas");
			await expect(canvas).toHaveAttribute("role", "img");
			await expect(canvas).toHaveAttribute("aria-label", /.+/);
			await expect(galaxy.locator(".tag-galaxy__hint")).toBeVisible();
		} else {
			await expect(galaxy).toHaveCount(0);
		}
	});
});
