import assert from "node:assert/strict";
import { test } from "node:test";

import { en } from "../src/i18n/languages/en.ts";
import { es } from "../src/i18n/languages/es.ts";
import { id } from "../src/i18n/languages/id.ts";
import { ja } from "../src/i18n/languages/ja.ts";
import { ko } from "../src/i18n/languages/ko.ts";
import { th } from "../src/i18n/languages/th.ts";
import { tr } from "../src/i18n/languages/tr.ts";
import { vi } from "../src/i18n/languages/vi.ts";
import { zh_CN } from "../src/i18n/languages/zh_CN.ts";
import { zh_TW } from "../src/i18n/languages/zh_TW.ts";

/**
 * i18n 全量一致性守卫。
 *
 * 为什么需要它：`Translation` 映射类型只保证「key 存在且是 string」，
 * `astro check` 因此抓不到空串、也抓不到占位符写错。而单元测试对 i18n 的
 * 覆盖此前只散落在少数 `.spec.ts`（且 CI 不跑 Playwright）——中间的空档靠人工。
 * 这里把两个客观可判定的事实固化成 `node --test` 用例，纳入 CI 的 checks 作业。
 *
 * key 全集取 `en` 的键：`Translation` 映射类型已保证十个语言包的键集合与
 * `I18nKey` 枚举一一对应，所以 `en` 的键就是枚举全集。
 *
 * 参见 `src/i18n/AGENTS.md`。
 */
const locales = { en, es, id, ja, ko, th, tr, vi, zh_CN, zh_TW };
const keys = Object.keys(en);

test("locale 模块导出的 key 全集非空（防止断言空转）", () => {
	assert.ok(
		keys.length > 0,
		"en 语言包没有导出任何 key，后续断言会形同虚设",
	);
});

test("每个 key 在十个语言包里都有非空文案", () => {
	const missing = [];
	for (const [locale, dict] of Object.entries(locales)) {
		for (const key of keys) {
			const value = dict[key];
			if (typeof value !== "string" || value.trim() === "") {
				missing.push(`${locale}:${key}`);
			}
		}
	}
	assert.deepEqual(missing, [], `存在空文案或缺失：\n${missing.join("\n")}`);
});

test("十个语言包之间没有多余 key", () => {
	const known = new Set(keys);
	const extra = [];
	for (const [locale, dict] of Object.entries(locales)) {
		for (const key of Object.keys(dict)) {
			if (!known.has(key)) extra.push(`${locale}:${key}`);
		}
	}
	assert.deepEqual(extra, [], `存在未知 key：\n${extra.join("\n")}`);
});

test("参数化文案的占位符集合与 en 完全一致", () => {
	const placeholdersOf = (value) =>
		[...String(value).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

	const mismatched = [];
	for (const key of keys) {
		const expected = placeholdersOf(en[key]);
		if (expected.length === 0) continue;
		for (const [locale, dict] of Object.entries(locales)) {
			const actual = placeholdersOf(dict[key]);
			if (actual.join(",") !== expected.join(",")) {
				mismatched.push(
					`${locale}:${key} 期望 [${expected.join("+")}] 实得 [${actual.join("+") || "无"}]`,
				);
			}
		}
	}
	assert.deepEqual(
		mismatched,
		[],
		`占位符不一致：\n${mismatched.join("\n")}`,
	);
});
