# Live2D 看板娘资源（自托管）

- SDK 脚本（[oh-my-live2d](https://github.com/oh-my-live2d/oh-my-live2d) v0.19.3 构建产物，MIT License）**不在本目录**：已移入 `src/assets/live2d/oml2d.min.js` 由 bundler 解析分发，这样 npm 包模式也能拿到脚本（`public/` 不随包发布）。本副本移除了初始化时向 unpkg.com 的版本检查请求（保持零第三方请求），升级替换时如需同样效果，删除 `initialize(){z2(),` 中的 `z2(),` 即可。
- `ds-whale/`：**DS鲸鱼娘**（Cubism 3）。模型制作：B站[@氵六青](https://space.bilibili.com/11272072)；形象版权：@上善无形 与 @ZipZipPin。采用 [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/deed.zh) 许可——可自由分享与改编，需署名、非商业、相同方式共享。本目录在原模型基础上去除了 VTube Studio 专用配置文件，并在 `c_0120.model3.json` 中注册了 `Idle`/`Tap` 动作组、表情清单，以及 8 个命中区（`HitAreas`）（改动同样以 CC BY-NC-SA 4.0 共享）。

> 模型文件必须留在 `public/`（包模式使用者放进自己项目的 `public/live2d/`）：SDK 在运行期按模型 json 的相对路径抓取同级资源（moc3 / 贴图 / 动作），这类资源无法走 bundler 打包。

切换模型：在 `src/config/live2dConfig.ts` 的 `options.models[].path` 中填 `/live2d/<目录>/<模型>.json`。

## 点击交互必须配 `HitAreas`（易踩的坑）

点击看板娘播放动作的链路是：

```
pixi 命中测试 → model.emit("hit", 命中区名) → oml2d.playRandomMotion(命中区名)
```

而 pixi 的 `hitTest()` **只遍历 `*.model3.json` 顶层的 `HitAreas` 数组**。模型若没有这个字段，`hitTest()` 恒返回空数组 → `hit` 事件永不触发 → 表现为「点击看板娘完全没有反应」。VTube Studio 模型通常靠热键而不是命中区，所以从 VTS 迁移过来的模型往往就缺这一段。

`oml2d.playRandomMotion` 拿命中区名去匹配动作组键，匹配规则是**大小写敏感的子串比较**：

```js
groups.find(g => names[0].includes(g.toLowerCase()) || g.toLowerCase().includes(names[0]))
```

匹配不上时会**随机挑一个动作组**播放。因此命中区名必须包含小写 `tap`，才能定向到 `Tap` 动作组——本模型用的是 `tap_hair` / `tap_face` 这类命名，**改名前请先确认不会打断这条映射**。

写法（Cubism 3/4 规范，`Id` 用 ArtMesh 的 drawable id，可用 Cubism Viewer 或 `Live2DCubismCore` 的 `getDrawableId()` 查）：

```json
"HitAreas": [
  { "Name": "tap_hair", "Id": "YM_hair_B_2" },
  { "Name": "tap_face", "Id": "face_m2" }
]
```

命中判定用的是该 drawable **顶点包围盒**，所以尽量选能代表角色可见轮廓的大网格（头发/脸/身体），命中区太碎会导致点不中。`HitAreas` 的覆盖范围不要超出 `public/live2d/` 其他资源之外——它只影响舞台盒内的点击判定，不会改变舞台本身的 `pointer-events`。

新增模型：把模型目录（含 `.model.json`（Cubism 2）或 `.model3.json`（Cubism 3/5）及其相对引用资源）整体放入本目录，**确认它带 `HitAreas`**（没有就自己补，见上），并在本 README 记录来源与许可。注意：从游戏中提取的模型版权归厂商所有，请勿使用；挑选时优先官方免费素材或明确开放许可的模型。

## 表情：模型有、但需要主题补入口

`c_0120.model3.json` 注册了 44 个表情，但**没有任何现成触发路径**：

- 7 个动作文件的曲线 `Target` 全是 `Parameter`，既没有可见性曲线，也没有 `Meta.ExpressionIds` → **动作不会触发表情**；
- oml2d 没有换表情的 API，SDK 内置菜单（休息/换装/切换模型/关于）里也没有这一项。

所以主题补了 `src/config/live2dConfig.ts` 的 `expressionMenu`：开启后在看板娘悬浮菜单里插入一个「换表情」项，
点一次换一个（`order: sequential` 按注册顺序循环 / `random` 随机且不重复）。菜单项文案走主题 i18n，图标是组件自带的
内联 `<symbol>`（SDK 的 sprite 里没有表情语义的图标）。

### 两个必须知道的运行时事实（都已在真实运行时实测）

**1）`model.expression(name)` 本身是有效的 —— 不要自己补帧。**

Cubism4 的时间基准是**秒**：`Cubism4InternalModel.update()` 会把 `now` 除以 1000 再交给
`motionManager.update()` / `expressionManager.update()`，后者内部调
`queueManager.doUpdateMotion(coreModel, now[秒])`。而 `performance.now()` 是**毫秒**。

一旦在 `setExpression` 之后用 `performance.now()` 手动补一次 `doUpdateMotion`，这个条目就被
锚定在毫秒值上（实测 `_fadeInStartTime ≈ 9000`）；此后每帧算出的
`(now[秒] − 起始[毫秒]) / 淡入时长` 恒为负，`getEasingSine` 一律夹到 0 —— **混合权重永远是 0**。
表现是「点了没反应」：`model.expression()` 返回 `true`、`currentExpression` 也换了，但模型一个参数都不变
（实测 `_stateWeight` 恒为 0；把条目的 `_started` 复位、交给帧循环重新锚定后，权重立刻从 0 涨到 1）。

所以正确做法就是 `await model.expression(name)` 之后什么都不做，让 SDK 自己的帧循环（秒基准）
完成第一次更新。

> 想验证表情是否真的生效，不能直接读 `coreModel.getParameterValueById()`：一帧的顺序是
> `saveParameters()` → 写表情参数 → `coreModel.update()` → `loadParameters()`，帧外读到的永远是
> 被还原的基准值。要在 `coreModel.update()` 内部读，或直接看 `queueManager._motions[]._stateWeight`。

**2）切换必须先清空队列，否则会「叠加」。**

`setExpression → startMotion` 只是把新表情**压入**队列，并把旧条目标记为淡出（SDK 给表情的默认
淡出是 **1 秒**，比菜单 400ms 的连点冷却还长）。而本模型每个表情都声明 `Blend: "Add"` —— 参数是
**相加**的，所以只要有两条表情条目同时存活，同一组参数就会被加两次，表现为表情状态叠加
（实测：600ms 内切两个表情，队列里同时存在 `_stateWeight` 0.817 与 0.111 的两条条目）。

`Live2dWidget.astro` 的换表情逻辑因此先调 `expressionManager.stopAllExpressions()` 清队列，
再把该表情动作自身的 `_fadeInSeconds` / `_fadeOutSeconds` 压成 0 —— 表情是「状态」而不是「过渡」，
切换在下一帧即时替换、旧条目当帧回收，连点也不会留下任何重叠窗口（即使将来 SDK 去掉
`stopAllExpressions()`，也只是退化成硬切换，而不是叠加）。

### 切换结果如何被感知（三条通道）

| 通道 | 面向谁 | 实现 |
| --- | --- | --- |
| 模型本身 | 所有人 | 表情当帧替换，无需额外反馈 —— 但不少表情差异细微 |
| 气泡文案 | 视觉用户 | `oml2d.tipsMessage(name, 1600, 3)`；气泡属装饰性内容，被标 `aria-hidden` |
| 播报区 | 读屏用户 | 可视隐藏的 `#shirone-expression-status`（`role="status"` + `aria-live="polite"`），文案走 i18n `live2dExpressionSwitched` 的 `{name}` 占位符 |

因为气泡对辅助技术不可见，**播报区是读屏用户唯一的反馈**，不要把它删掉或改成 `aria-hidden`。

### 菜单在触屏上的可达性

菜单平时靠 `#oml2d-stage:hover` / `#oml2d-menus:focus-within` 展开。触屏既没有 hover、
也没有「先聚焦再展开」的路径（`visibility: hidden` 已在主题里改成 `opacity: 0`，但依然要点得到才行），
所以 `@media (hover: none)` 下让菜单**常驻可见可点**。注意这条规则随 `expressionMenu` 一起注入 ——
不启用表情菜单时 `menus.disable: true`，本来就没有菜单。
