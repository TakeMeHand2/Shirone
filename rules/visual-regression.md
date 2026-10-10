# 视觉回归管理规范

> Shirone 真实页面的视觉回归（黄金截图）约定。
> 锁定首页（列表 / 网格）/ 归档 / 动态 / 关于 / 文章页在 light/dark 双模式下的布局、圆角、阴影。
> 配套：`tests/site/visual.spec.ts`、`playwright.config.ts`。

---

## 1. 目标

- 锁定真实页面的**整体视觉基线**：布局、圆角、阴影、间距；
- 与 token 断言互补：token 断言证明「样式值算得对」，视觉回归证明「看起来对」；
- 捕获 token 断言抓不到的回归：布局塌陷、间距失衡、溢出换行错位。

---

## 2. 截图范围

6 个截图用例 × light/dark 双模式 = 12 张黄金图：

| 用例 | 路径 | 覆盖 |
|---|---|---|
| 首页 | `/` | Navbar + SideBar + PostCard 列表 + Footer |
| 首页-网格 | `/`（注入 `post-list-mode=grid`） | 瀑布流打包与列分配 |
| 归档 | `/archive/` | ArchivePanel（ArchiveList 时间轴） |
| 动态 | `/moments/` | MomentCard（`client:only` 岛水合完成后） |
| 关于 | `/about/` | Card + Markdown（含 GitHub 卡片） |
| 文章页 | `/posts/guide/` | 标题 AccentBar + PostMeta + 正文 + prev/next |

---

## 3. 确定性保证（防 flaky）

截图前必须：

1. **折叠动效**：`page.emulateMedia({ reducedMotion: "reduce" })`——把 onload/主题过渡折叠为 0.01ms，保证每次渲染到相同最终态（最终态 opacity 1 / transform none，与正常渲染视觉一致）；
2. **mock 外部 API**：GitHub 卡片 `page.route("https://api.github.com/**")` 返回固定响应，避免限流导致骨架屏抖动；
3. **等待主题初始化**：等 `--mc-primary` 写入 `:root`；
4. **等待动画收敛**：等 `.onload-animation` 全部 opacity 1（跳过 display:none 元素）；
5. **等待 `client:only` 岛水合**：如动态页需要 `.moment-card` 出现后再截，否则会截到 fallback；
6. **滚动触发懒加载后回顶**：逐屏滚动到全部图片 `complete`，再回到顶部，保证 `fullPage` 拼接稳定；
7. **固定 viewport**：1280×900（`playwright.config.ts` 全局默认）。

---

## 4. 黄金图管理

- 存放路径：`tests/site/visual.spec.ts-snapshots/`（由 `snapshotPathTemplate` 固定，去掉 `-win32` 平台后缀）；
- **必须入库**：该目录不再被 `.gitignore` 忽略。基线不入库的后果是 CI 与全新克隆都没有可比的基准，首次运行只会写入 actual 而不能比对，回归测试形同虚设；
- 生成/更新：`npx playwright test tests/site/visual.spec.ts --update-snapshots`。

**命名约定**：`{用例}-{模式}.png`，如 `首页-light.png`、`文章页-dark.png`。

---

## 5. 何时更新黄金图

只有**视觉有意变更**时才更新黄金图，且必须先确认变更正确：

1. 跑 `--update-snapshots` 生成新图；
2. 人工抽查新图（对比旧图 diff）确认观感无误；
3. 提交时**代码与黄金图一起入库**——基线是回归契约的一部分，分开提交会让中间态无法比对。

**反例**：布局 bug（如 flex 被 scoped 样式压掉）导致的视觉变化，绝不能 `--update-snapshots` 掩盖，必须修 bug 而非更新基线。

---

## 6. 断言配置

```ts
await expect(page).toHaveScreenshot(`${name}-${mode}.png`, {
    fullPage: true,
    maxDiffPixelRatio: 0.01,  // 抗锯齿容差 1%
});
```

- `fullPage: true`：锁定完整页面（含首屏外内容）；
- `maxDiffPixelRatio: 0.01`：容忍字体抗锯齿等微小差异，超过即失败。

---

## 7. 新增用例到视觉回归

新增真实页面（如后续友链/留言板/动态页）时：

1. 在 `tests/site/visual.spec.ts` 的 `cases` 数组加一项；
2. 运行 `--update-snapshots` 生成该用例黄金图；
3. 人工抽查确认观感，与代码一并提交。

同时应更新 `tests/site/a11y.spec.ts` 的页面列表（视觉与 a11y 同步锁定）。

---

## 8. 与 CI 的关系

像素级基线**只对生成它的平台有效**：字体栅格化、抗锯齿与滚动条宽度在 Windows 与 Linux 之间
存在系统性差异，同一份 PNG 无法在两边同时通过。因此：

- 视觉回归用例在 `test.describe` 标题带 `@visual` 标记；
- CI 跑 `pnpm test:ci`（等价 `playwright test --grep-invert @visual`），排除该组；
- **发布前必须在维护者本机跑一次全量 `pnpm test`**，视觉回归才算真正被检查过；
- 若将来把基线统一到 Linux 生成，可把 `test:ci` 改回 `pnpm test` 并移除 `@visual` 标记。

CI 的其余部分（`astro check`、`pnpm type-check`、清单校验、`node --test`、`pnpm build`）见
[`docs/ci-and-node-tests.md`](../docs/ci-and-node-tests.md)。
