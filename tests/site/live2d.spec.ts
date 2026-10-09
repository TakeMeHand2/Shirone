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
					page.evaluate(() => Boolean(document.querySelector("[id^='oml2d']"))),
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
			sdkScripts: document.querySelectorAll("script[data-shirone-live2d]")
				.length,
		}));
		expect(afterNav.stage).toBe(true);
		expect(afterNav.sdkScripts).toBeLessThanOrEqual(1);
	});

	// 气泡契约（对应 Live2dWidget.astro 内的 !important boundary）：
	// 1) 气泡底边必须落在舞台盒顶边之上 —— 人物恒在舞台盒内，故结构上不可能被压住；
	// 2) 皮肤归 Shirone 所有，不再是 SDK 硬编码的 #38B0DE 与 2px 白描边；
	// 3) 指向人物的尾巴由主题伪元素提供。
	test("speech bubble floats above the stage and uses theme tokens", async ({
		page,
	}) => {
		await page.goto("/");
		if (!resolveLive2dOptions(live2dConfig)) {
			test.skip();
			return;
		}
		// 计算样式断言前先等主题初始化（tests/AGENTS.md）
		await page.waitForFunction(
			() =>
				getComputedStyle(document.documentElement)
					.getPropertyValue("--mc-primary")
					.trim() !== "",
			{ timeout: 30_000 },
		);

		const readMetrics = () =>
			page.evaluate(() => {
				const tips = document.getElementById("oml2d-tips");
				const stage = document.getElementById("oml2d-stage");
				if (!tips || !stage) return null;
				const tipsRect = tips.getBoundingClientRect();
				const stageRect = stage.getBoundingClientRect();
				const style = getComputedStyle(tips);
				return {
					verticalOverlap: Math.max(
						0,
						Math.min(tipsRect.bottom, stageRect.bottom) -
							Math.max(tipsRect.top, stageRect.top),
					),
					background: style.backgroundColor,
					borderWidth: style.borderTopWidth,
					tailContent: getComputedStyle(tips, "::after").content,
				};
			});

		// 等 SDK 应用定位后收敛：气泡底边稳定落在舞台顶边之上（抖动动画幅度远小于 8px 间隙）
		await expect
			.poll(async () => (await readMetrics())?.verticalOverlap ?? -1, {
				timeout: 30_000,
			})
			.toBe(0);

		const metrics = await readMetrics();
		expect(metrics).not.toBeNull();
		if (!metrics) return;
		// 皮肤 token 化：不再是 SDK 的 #38B0DE，且白描边被移除
		expect(metrics.background).not.toBe("rgb(56, 176, 222)");
		expect(metrics.borderWidth).toBe("0px");
		// 尾巴存在（内容为 ""，而非 none）
		expect(metrics.tailContent).not.toBe("none");

		// 气泡挂在持久 shell（body）上，客户端导航后契约必须保持
		await page.locator('a[href="/archive/"]').first().click();
		await page.waitForURL("**/archive/", { timeout: 15_000 });
		await expect
			.poll(async () => (await readMetrics())?.verticalOverlap ?? -1, {
				timeout: 15_000,
			})
			.toBe(0);
	});
});

/**
 * 点击交互契约：模型必须自带 HitAreas，且命中区名要能被 oml2d 映射到某个动作组。
 *
 * 背景：oml2d 的点击链路是
 *   pixi 命中测试 → model.emit("hit", names) → oml2d.playRandomMotion(names)
 * 而 pixi 的 hitTest() 只遍历 model.settings.hitAreas —— 即 *.model3.json 顶层的
 * HitAreas 数组。文件里没有这个字段时 hitTest 恒返回空数组，hit 永不触发，
 * 表现为「点击看板娘没有任何反应」。
 *
 * playRandomMotion 用命中区名去匹配动作组键（大小写敏感的子串匹配）：
 *   groups.find(g => names[0].includes(g.toLowerCase()) || g.toLowerCase().includes(names[0]))
 * 所以命中区名必须包含小写 "tap" 才能定向到 Tap 动作组；否则只能随机落到某个组。
 */
test.describe("Live2D hit areas", () => {
	test("configured model defines hitAreas that map to a motion group", async () => {
		const options = resolveLive2dOptions(live2dConfig);
		if (!options) {
			test.skip();
			return;
		}

		const { readFile } = await import("node:fs/promises");
		const { join } = await import("node:path");

		for (const model of options.options.models ?? []) {
			const path = model.path?.trim();
			if (!path) continue;

			// models[].path 是 public/ 下的站点绝对路径，映射回源文件
			const filePath = join(process.cwd(), "public", path.replace(/^\//, ""));
			const settings = JSON.parse(await readFile(filePath, "utf8"));

			const hitAreas: Array<{ Name?: string; Id?: string }> =
				settings.HitAreas ?? [];
			expect(
				hitAreas.length,
				`${path} 未定义 HitAreas：点击命中测试会恒为空，看板娘无法响应点击`,
			).toBeGreaterThan(0);

			// 复刻 oml2d playRandomMotion 的分组匹配规则
			const groups = Object.keys(settings.FileReferences?.Motions ?? {});
			expect(groups.length).toBeGreaterThan(0);

			for (const area of hitAreas) {
				expect(area.Id, `HitAreas 缺 Id：${JSON.stringify(area)}`).toBeTruthy();
				const name = area.Name ?? "";
				expect(name, `HitAreas 缺 Name：${JSON.stringify(area)}`).toBeTruthy();
				const matched = groups.find(
					(group) =>
						name.includes(group.toLowerCase()) ||
						group.toLowerCase().includes(name),
				);
				expect(
					matched,
					`命中区 "${name}" 无法映射到任何动作组 ${JSON.stringify(groups)}；oml2d 只能随机挑组播放`,
				).toBeTruthy();
			}
		}
	});
});

/**
 * 表情菜单契约。
 *
 * 模型自带的表情既不会被动作触发（motion 曲线只驱动 Parameter，没有可见性曲线也没有
 * Meta.ExpressionIds），oml2d 也没有换表情入口，所以主题补了一个菜单项。
 * 这里锁住两件事：配置归一化（未开启时零副作用）与真实点击能逐个切换表情。
 */
test.describe("Live2D expression menu", () => {
	test("menu config normalises and stays opt-in", () => {
		const base = {
			enable: true,
			options: { models: [{ path: "/live2d/ds-whale/c_0120.model3.json" }] },
		};

		// 未配置 → 不产出任何菜单配置（组件据此短路）
		expect(resolveLive2dOptions(base)?.expressionMenu).toBeUndefined();

		// 显式关闭同样短路
		expect(
			resolveLive2dOptions({ ...base, expressionMenu: { enable: false } })
				?.expressionMenu,
		).toBeUndefined();

		// 开启后补齐默认值
		const enabled = resolveLive2dOptions({
			...base,
			expressionMenu: { enable: true },
		})?.expressionMenu;
		expect(enabled).toEqual({ order: "sequential", cooldown: 400 });

		// 非法值回落到默认，空白名单被丢弃
		const sanitized = resolveLive2dOptions({
			...base,
			expressionMenu: {
				enable: true,
				order: "random",
				cooldown: -1,
				names: ["爱心眼", "  ", ""],
			},
		})?.expressionMenu;
		expect(sanitized).toEqual({
			order: "random",
			cooldown: 400,
			names: ["爱心眼"],
		});
	});

	test("clicking the menu item cycles expressions", async ({ page }) => {
		const options = resolveLive2dOptions(live2dConfig);
		if (!options?.expressionMenu) {
			test.skip();
			return;
		}

		await page.goto("/");
		const item = page.locator("#shirone-expression");
		await expect(item).toHaveCount(1, { timeout: 60_000 });

		// 语义与键盘可达性
		await expect(item).toHaveAttribute("role", "button");
		await expect(item).toHaveAttribute("tabindex", "0");
		const id = await item.getAttribute("id");
		await expect(item).toHaveAttribute(
			"aria-label",
			(await item.getAttribute("title")) ?? "",
		);

		// 舞台是装饰性内容，但菜单是可交互控件，不能被 aria-hidden 连带藏掉
		await expect(page.locator("#oml2d-stage")).not.toHaveAttribute(
			"aria-hidden",
			"true",
		);

		// 菜单闲置时用 opacity 收起，悬停展开后才可点（走真实交互路径）
		await page.locator("#oml2d-stage").hover();
		await expect
			.poll(
				async () =>
					page.evaluate(() => {
						const menus = document.getElementById("oml2d-menus");
						return menus ? getComputedStyle(menus).opacity : "0";
					}),
				{ timeout: 10_000 },
			)
			.toBe("1");

		const readTip = async () => {
			const text = await page
				.locator("#oml2d-tips")
				.textContent({ timeout: 5_000 });
			return (text ?? "").trim();
		};

		await item.click();
		await expect.poll(readTip, { timeout: 10_000 }).not.toBe("");
		const first = await readTip();

		// 配置里带连点冷却，等过冷却再点第二次
		await page.waitForTimeout((options.expressionMenu.cooldown ?? 400) + 300);
		await item.click();
		await expect
			.poll(
				async () => {
					const text = await readTip();
					return text && text !== first ? text : "";
				},
				{ timeout: 10_000 },
			)
			.not.toBe("");

		expect(id).toBe("shirone-expression");
	});
});

/**
 * 状态条配色契约。
 *
 * oml2d 把状态条的 background-color 写成内联样式（常规态 primaryColor #38B0DE、
 * 失败态 errorColor #F08080），文字固定纯白 —— 白字配这两块底色只有 2.49:1 / 约 2.0:1，
 * 远低于 WCAG AA 的 4.5:1，且亮暗主题下完全相同。主题已用 !important 边界接管配色，
 * 这里把结果锁住：以后 SDK 换色或主题令牌漂移都会在这里失败。
 */
test.describe("Live2D status bar contrast", () => {
	for (const theme of ["light", "dark"]) {
		test(`${theme} theme meets WCAG AA`, async ({ page }) => {
			const options = resolveLive2dOptions(live2dConfig);
			if (!options) {
				test.skip();
				return;
			}
			await page.addInitScript(
				(value) => localStorage.setItem("theme", value as string),
				theme,
			);
			await page.goto("/");
			await page.waitForFunction(
				() =>
					getComputedStyle(document.documentElement)
						.getPropertyValue("--mc-primary")
						.trim()
						.startsWith("#"),
				{ timeout: 60_000 },
			);
			// 状态条由 SDK 在空闲时注入，等它出现
			await page.waitForFunction(
				() => Boolean(document.getElementById("oml2d-statusBar")),
				{ timeout: 90_000 },
			);
			await page.waitForTimeout(500);

			const measure = async () =>
				page.evaluate(() => {
					const bar = document.getElementById("oml2d-statusBar");
					if (!bar) return null;
					const cs = getComputedStyle(bar);
					const parse = (value: string) => {
						const match = value.match(/rgba?\(([^)]+)\)/);
						if (!match) return null;
						const parts = match[1].split(",").map(Number);
						return { r: parts[0], g: parts[1], b: parts[2] };
					};
					const luminance = (c: { r: number; g: number; b: number }) => {
						const channel = (v: number) => {
							const s = v / 255;
							return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
						};
						return (
							0.2126 * channel(c.r) +
							0.7152 * channel(c.g) +
							0.0722 * channel(c.b)
						);
					};
					const fg = parse(cs.color);
					const bg = parse(cs.backgroundColor);
					if (!fg || !bg) return null;
					const a = luminance(fg);
					const b = luminance(bg);
					return {
						color: cs.color,
						background: cs.backgroundColor,
						ratio:
							Math.round(
								((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)) * 100,
							) / 100,
						fontSize: cs.fontSize,
					};
				});

			const assertContrast = async (stage: string) => {
				const result = await measure();
				expect(result, `${stage}：读不到状态条计算样式`).not.toBeNull();
				expect(
					result?.ratio,
					`${stage} 状态条对比度不足：${result?.color} on ${result?.background} = ${result?.ratio}:1`,
				).toBeGreaterThanOrEqual(4.5);
			};

			await assertContrast("direct load");

			// 舞台挂在 body 上、不随 Swup 重建，但 !important 边界规则要求
			// 覆盖客户端导航后的计算样式（状态条可能在导航期间被 SDK 重写配色）。
			await page.locator('a[href="/archive/"]').first().click();
			await page.waitForURL("**/archive/", { timeout: 15_000 });
			await expect
				.poll(async () => (await measure())?.ratio ?? 0, { timeout: 15_000 })
				.toBeGreaterThanOrEqual(4.5);
			await assertContrast("Swup 导航后");
		});
	}
});
