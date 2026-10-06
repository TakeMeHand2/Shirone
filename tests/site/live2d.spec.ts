import { expect, test } from "@playwright/test";
import {
	live2dConfig,
	resolveLive2dOptions,
} from "../../src/config/live2dConfig";

test.describe("Live2D Widget", () => {
	// 零额外负担验证：关闭时 SSR 零引导、零外链；开启时 SDK 由 CDN 注入且不进主 bundle。
	test("bootstraps only when enabled", async ({ page }) => {
		await page.goto("/");
		const options = resolveLive2dOptions(live2dConfig);
		const html = await page.content();

		if (!options) {
			expect(html).not.toContain("loadOml2d");
			expect(html).not.toContain("shironeLive2d");
			return;
		}

		// 开启状态：SSR 输出引导脚本，运行时恰好注入一次 SDK
		expect(html).toContain("loadOml2d");
		await expect(page.locator("script[data-shirone-live2d]")).toHaveCount(1);

		await expect
			.poll(
				async () =>
					page.evaluate(() => Boolean((window as { OML2D?: unknown }).OML2D)),
				{ timeout: 30_000 },
			)
			.toBe(true);

		// 舞台挂载到 body（不在 Swup 容器内，切页持久）
		await expect
			.poll(
				async () =>
					page.evaluate(
						() => Boolean(document.querySelector("[id^='oml2d']")),
					),
				{ timeout: 30_000 },
			)
			.toBe(true);
	});

	test("persists across Swup navigation without double-injecting the SDK", async ({
		page,
	}) => {
		await page.goto("/");
		if (!resolveLive2dOptions(live2dConfig)) {
			test.skip();
			return;
		}

		await expect
			.poll(
				async () =>
					page.evaluate(() => Boolean((window as { OML2D?: unknown }).OML2D)),
				{ timeout: 30_000 },
			)
			.toBe(true);

		// 客户端导航（Swup 替换容器）后：舞台仍挂载在 body 上，
		// SDK 脚本至多一份（Swup 的 head 更新可能移除标签，但绝不重复注入）
		await page.locator('a[href="/archive/"]').first().click();
		await page.waitForURL("**/archive/", { timeout: 15_000 });
		const afterNav = await page.evaluate(() => ({
			stage: Boolean(document.querySelector("#oml2d-stage")),
			sdkScripts: document.querySelectorAll("script[data-shirone-live2d]").length,
		}));
		expect(afterNav.stage).toBe(true);
		expect(afterNav.sdkScripts).toBeLessThanOrEqual(1);
	});
});
