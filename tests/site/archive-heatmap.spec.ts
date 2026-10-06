import { expect, test } from "@playwright/test";

/**
 * 归档热力图回归（SSR 直出，无水合岛）：
 * - 有文章时渲染年份分段网格（新年份在前）+ 图例；
 * - 有文章的日期存在填色档位格，并带 "{date} · {count}" native title；
 * - 网格 role="img" 不进读屏焦点链，摘要通过 aria-label 提供。
 */
test.describe("archive heatmap", () => {
	test.use({ viewport: { width: 1280, height: 900 } });

	test("renders year sections with filled cells when posts exist", async ({
		page,
	}) => {
		await page.goto("/archive/", { waitUntil: "networkidle" });

		const heatmap = page.locator(".heatmap");
		await expect(heatmap).toBeVisible();

		// 年份分段：至少一段，且标题为纯数字年份
		const years = heatmap.locator(".heatmap__year");
		const yearCount = await years.count();
		expect(yearCount).toBeGreaterThanOrEqual(1);
		await expect(years.first().locator(".heatmap__year-title")).toHaveText(
			/^\d{4}$/,
		);

		// 至少一个填色档位格（demo 数据始终有已发布文章）
		const filled = heatmap.locator(
			".heatmap__cell--l1, .heatmap__cell--l2, .heatmap__cell--l3, .heatmap__cell--l4",
		);
		expect(await filled.count()).toBeGreaterThanOrEqual(1);

		// 有文章的格子带 native title（YYYY-MM-DD · N 篇/posts）
		const titled = heatmap.locator(".heatmap__cell[title]");
		expect(await titled.count()).toBeGreaterThanOrEqual(1);
		await expect(titled.first()).toHaveAttribute(
			"title",
			/\d{4}-\d{2}-\d{2} · \d+/,
		);
	});

	test("grid is presentational and legend is provided", async ({ page }) => {
		await page.goto("/archive/", { waitUntil: "networkidle" });

		const canvas = page.locator(".heatmap__canvas").first();
		await expect(canvas).toHaveAttribute("role", "img");
		await expect(canvas).toHaveAttribute("aria-label", /.+/);

		await expect(page.locator(".heatmap__legend")).toBeVisible();
	});
});
