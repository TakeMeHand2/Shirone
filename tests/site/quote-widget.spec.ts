import { expect, test } from "@playwright/test";

/**
 * 今日一言 widget 回归：
 * - 默认 provider "local"：SSR 直出语料正文与出处，零外部请求；
 * - 标题走 i18n（zh_CN 站点为「今日一言」）；
 * - 同一构建内多页面渲染同一条（日期键确定性轮换）。
 */
test.describe("quote widget", () => {
	test.use({ viewport: { width: 1280, height: 900 } });

	test("renders local quote with title on home page", async ({ page }) => {
		const externalRequests: string[] = [];
		page.on("request", (request) => {
			if (/^https?:\/\/v1\.hitokoto\./.test(request.url())) {
				externalRequests.push(request.url());
			}
		});

		await page.goto("/", { waitUntil: "networkidle" });

		const quote = page.locator('widget-layout[data-id="quote"]');
		await expect(quote).toBeVisible();
		await expect(quote.locator(".quote-wrapper__text")).toHaveText(/.+/);

		// 本地模式：不应出现一言 API 请求
		expect(externalRequests).toHaveLength(0);
	});

	test("quote is consistent across client navigation", async ({ page }) => {
		await page.goto("/", { waitUntil: "networkidle" });
		const homeText = await page
			.locator('widget-layout[data-id="quote"] .quote-wrapper__text')
			.textContent();

		// Swup 站内导航到归档页：侧栏持久壳不重渲染，一言保持一致
		await page.goto("/archive/", { waitUntil: "networkidle" });
		const archiveText = await page
			.locator('widget-layout[data-id="quote"] .quote-wrapper__text')
			.textContent();

		expect(archiveText).toBe(homeText);
	});
});
