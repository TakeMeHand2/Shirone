# Live2D 看板娘资源（自托管）

- SDK 脚本（[oh-my-live2d](https://github.com/oh-my-live2d/oh-my-live2d) v0.19.3 构建产物，MIT License）**不在本目录**：已移入 `src/assets/live2d/oml2d.min.js` 由 bundler 解析分发，这样 npm 包模式也能拿到脚本（`public/` 不随包发布）。本副本移除了初始化时向 unpkg.com 的版本检查请求（保持零第三方请求），升级替换时如需同样效果，删除 `initialize(){z2(),` 中的 `z2(),` 即可。
- `ds-whale/`：**DS鲸鱼娘**（Cubism 3）。模型制作：B站[@氵六青](https://space.bilibili.com/11272072)；形象版权：@上善无形 与 @ZipZipPin。采用 [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/deed.zh) 许可——可自由分享与改编，需署名、非商业、相同方式共享。本目录在原模型基础上去除了 VTube Studio 专用配置文件，并在 `c_0120.model3.json` 中注册了 `Idle`/`Tap` 动作组与表情清单（改动同样以 CC BY-NC-SA 4.0 共享）。

> 模型文件必须留在 `public/`（包模式使用者放进自己项目的 `public/live2d/`）：SDK 在运行期按模型 json 的相对路径抓取同级资源（moc3 / 贴图 / 动作），这类资源无法走 bundler 打包。

切换模型：在 `src/config/live2dConfig.ts` 的 `options.models[].path` 中填 `/live2d/<目录>/<模型>.json`。

新增模型：把模型目录（含 `.model.json`（Cubism 2）或 `.model3.json`（Cubism 3/5）及其相对引用资源）整体放入本目录，并在本 README 记录来源与许可。注意：从游戏中提取的模型版权归厂商所有，请勿使用；挑选时优先官方免费素材或明确开放许可的模型。
