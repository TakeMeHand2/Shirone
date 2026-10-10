import { expect, type Page, test } from "@playwright/test";
import { siteConfig } from "../../src/config/siteConfig";
import I18nKey from "../../src/i18n/i18nKey";
import { getTranslation } from "../../src/i18n/translation";

/**
 * 站内导航（Swup）后的无障碍契约。
 *
 * 锁定两件事，两者都曾被第三方插件的默认值悄悄接管：
 * 1. 焦点落点——导航后焦点必须在主内容容器，而不是 `<body>`；
 * 2. 播报——文案取当前页标题，且**不能**落到 Banner 的 `<h1>` 上
 *    （Banner 的 `<h1>` 在每页都存在于 DOM，只靠 CSS 切换可见性）。
 *
 * 契约与实现位置见 `rules/a11y.md` §3.1 与 `src/layouts/Layout.astro` 的 a11y 内联脚本。
 * 站点语言可配置，因此断言用的文案从词典取，不硬编码。
 */
const dictionary = getTranslation(siteConfig.lang);
const visitTemplate = dictionary[I18nKey.a11yNavigatedTo];
const visitPrefix = visitTemplate.split("{title}")[0].trim();
const announcedFor = (title: string) => visitTemplate.replace("{title}", title);

async function navigateViaSwup(page: Page, path: string) {
	await page.waitForFunction(() => Boolean(window.swup?.navigate));
	await page.evaluate((target: string) => window.swup?.navigate(target), path);
	await expect(page).toHaveURL(new RegExp(`${path.replace(/\//g, "\\/")}$`));
}

test.describe("Swup 站内导航后的无障碍契约", () => {
	test("焦点落到主内容容器而不是 body", async ({ page }) => {
		await page.goto("/", { waitUntil: "domcontentloaded" });
		await navigateViaSwup(page, "/posts/first-post/");

		await expect
			.poll(() => page.evaluate(() => document.activeElement?.id ?? ""))
			.toBe("swup-container");
	});

	test("播报当前页标题，且不复用 Banner 的 h1", async ({ page }) => {
		await page.goto("/", { waitUntil: "domcontentloaded" });
		await navigateViaSwup(page, "/posts/first-post/");

		const announcer = page.locator("#swup-announcer");
		await expect.poll(() => announcer.textContent()).toContain(visitPrefix);

		const snapshot = await page.evaluate(() => {
			const heading = document.querySelector(
				"#swup-container h1, #swup-container h2",
			);
			return {
				heading:
					heading?.getAttribute("aria-label") ||
					heading?.textContent?.trim() ||
					null,
				banner:
					document
						.querySelector("[data-banner-home-copy] h1")
						?.textContent?.trim() ?? null,
				announced:
					document.getElementById("swup-announcer")?.textContent?.trim() ?? "",
				pageTitle: document.title,
			};
		});

		// 容器内有标题就用它，没有才退 document.title
		expect(snapshot.announced).toBe(
			announcedFor(snapshot.heading ?? snapshot.pageTitle),
		);

		// 反例：Banner 的 <h1> 在每页都存在于 DOM，插件的文档级查询会命中它。
		if (snapshot.banner) {
			expect(snapshot.announced).not.toBe(announcedFor(snapshot.banner));
		}
	});

	test("整页加载不播报（只在站内导航时出声）", async ({ page }) => {
		await page.goto("/posts/first-post/", { waitUntil: "networkidle" });
		await page.waitForTimeout(300);

		expect(
			(await page.locator("#swup-announcer").textContent())?.trim() ?? "",
		).toBe("");
	});
});
