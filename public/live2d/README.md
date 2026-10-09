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

### 一个必须绕过的 SDK 缺陷

**直接调 `model.expression(name)` 是无效的**：它会返回 `true`、`currentExpression._weight` 也会涨到 1，
但表情声明的参数一个都不会写进模型 —— 表现就是「点了没反应」。原因是这个 oml2d 内置的 pixi 版本里，
Cubism4 表情管理器把参数更新交给 `queueManager.doUpdateMotion(model, now)`，
而 `_setExpression` 写入条目起始时间用的是 `performance.now()`，与每帧传进来的 `now` 基准/单位对不上，
自动更新路径于是从不真正写参数（实测：播放后逐个对照表情声明参数，值完全不变；而手工 `setParameterValueByIndex`
立刻读到新值，说明渲染链路本身是好的）。

绕过方式（`Live2dWidget.astro` 里已实现）：`await model.expression(name)` 之后补一次
`expressionManager.queueManager.doUpdateMotion(internalModel.coreModel, performance.now())`。
实测这样能立即生效、连续切换、并持续保持（不会被 Idle 动作擦掉）。注意**不能**简单地把每帧的 `now` 换成
`performance.now()` —— 第一次调用会发生在淡入权重≈0 时并消费掉条目的 available 状态，之后就不再写入。
