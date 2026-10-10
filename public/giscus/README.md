# giscus 换皮（分格漫画）

`shirone-light.css` / `shirone-dark.css` 是评论区 giscus（GitHub Discussions）
的**自定义主题**，让 iframe 内部的条目、输入框、按钮与站点外壳共用同一套
「分格漫画」语言：2px 墨线、8/10px 圆角、primary 主色、跟随站点明暗。

由 `src/config/commentConfig.ts` 的 `giscus.theme` 指向：

```ts
theme: {
	light: "/giscus/shirone-light.css",
	dark: "/giscus/shirone-dark.css",
},
```

## 三条必须知道的约束

**1. 必须由站点返回 CORS 头。**
giscus 是在**它自己的 iframe** 里以 `<link crossorigin="anonymous">` 加载这两个文件的。
缺 `Access-Control-Allow-Origin` 会被浏览器直接拦掉，giscus 于是回退到内置主题 ——
页面不报错，只是外观退回 GitHub 原味。规则在仓库根 `vercel.json`，
`tests/giscus-shell-contract.test.mjs` 会守着它。

**2. 色值是烘焙的常量，不能用站点 CSS 变量。**
iframe 是独立文档，取不到父页面的 `--surface`、`--on-surface` 等令牌。
因此这里所有颜色都是站点某套主题的**实测值**，每个变量后面注明了它对应哪个令牌。
**站点换了种子色之后，这两份文件需要同步更新**（取值方法见下）。

**3. 主题值以 `/` 开头时是站点内路径。**
giscus 的 iframe 会把相对路径解析到 `giscus.app`，所以 `Giscus.astro` 会在运行时
把 `/giscus/xxx.css` 补成绝对 URL（自动适配预览域名与自定义域名）。
写绝对 URL 或 giscus 内置主题键（`"light"` / `"dark"`）也可以，组件会原样透传。

## 取新色值的办法

站点令牌在运行时由主题引擎算出，最直接的方式是在浏览器控制台取：

```js
getComputedStyle(document.documentElement).getPropertyValue("--primary");
```

需要对应关系的变量见两份 CSS 里的注释（`/* on-surface */` 这种）。改完刷新即可，
`vercel.json` 里这两个文件设了 `max-age=0, must-revalidate`，不会卡缓存。

## 已知取舍

- **代码语法高亮保留 Primer 默认配色**，只把注释色拉回站点中性色。
  代码块的可读性优先于配色统一（VS Code 等也是这个取舍）。
- **字体栈是写死的回退链**，不是站点自托管的 Outfit / Yozai Medium。
  在 iframe 里用站点字体需要 `@font-face` + 字体文件同样开 CORS，收益不大，暂不做。
- **自定义主题是 giscus 的 experimental 功能**。上游若调整结构类名（`.gsc-*`），
  这里的选择器需要跟着更新；退化的表现是「内层样式失效、配色仍在」，不会白屏。
