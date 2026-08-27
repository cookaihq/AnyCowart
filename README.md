# any-cowart

any-cowart 是一个面向 Codex 的原生无限画布 widget 插件。它基于 tldraw 提供可视化画布，用于构思、标注、生成图片和根据标注图迭代图片。画布由 MCP widget 直接打开，数据默认保存到当前用户项目的 `canvas/` 目录，而不是保存到插件仓库里。

仓库同时遵循 [Agent Plugins v1.0.0](https://agent-plugins.org/specification)：根目录的 `plugin.json`、`skills/` 和 `mcp.json` 提供可移植插件入口；`.codex-plugin/plugin.json`、`.mcp.json` 和 `.agents/plugins/marketplace.json` 保留 Codex 专用的界面与安装元数据。

English README: [README.en.md](README.en.md)

## 功能

- 在 Codex 中打开一个原生 tldraw 无限画布 widget；正常使用不再通过网页浏览器或 in-app browser 打开本地页面。
- 在当前项目目录中持久化画布页面和图片资源。
- 在画布中创建 AI 图片框，直接输入 prompt、选择参考图，并让随插件分发的 Codex-Image 按选中框的位置和比例生成图片后替换它。
- 创建 16:9 的 `AI HTML` 框，通过 prompt 和参考图生成可运行的单文件 HTML，并直接嵌入画布继续编辑或迭代。
- 创建 `AI Slides`，将图片和 HTML 组织成演示文稿，或让 Codex 按指定页数生成一组 16:9 HTML 页面；支持缩略图预览和全屏播放。
- 标注好图片或 HTML 后，可从画布里直接提交标注截图，让 Codex-Image 根据标注生成干净的新图并放到原内容旁边。
- 通过 any-cowart MCP 工具读取选择状态、保存画布、插入图片或 HTML，并保存到页面本地资源目录。

## 安装

> [!IMPORTANT]
> 安装完成后，请务必完全退出并重新启动一次 Codex，再开始使用 any-cowart。重启后，any-cowart 的新技能和 MCP 工具才能完整加载。

### 让 Codex 自动安装

把下面这段发给 Codex：

```text
请通过 any-cowart 仓库自带的 Git marketplace 安装 any-cowart Codex 插件。
先运行 codex plugin marketplace add cookaihq/AnyCowart --ref main，
再运行 codex plugin add any-cowart@any-cowart-github，并用 codex plugin list 确认插件已启用。
any-cowart 发布包已经包含自包含 MCP、预构建 Widget 和 Codex-Image；安装后不会在插件缓存里执行 npm install，也不要求新用户预装 tldraw 或 Codex-Image；
不要在当前仓库、插件缓存或 marketplace 快照目录手动安装依赖。
不要把仓库 clone 到 personal marketplace。安装完成后请明确提醒我：
必须完全退出并重新启动一次 Codex，再开始使用 any-cowart。
```

### 手动安装

先把 any-cowart 的 Git 仓库注册为 Codex marketplace：

```bash
codex plugin marketplace add cookaihq/AnyCowart --ref main
```

再从这个 marketplace 安装并检查 any-cowart：

```bash
codex plugin add any-cowart@any-cowart-github
codex plugin list
```

不需要手动查找插件缓存目录。any-cowart 的 Git 版本已经跟踪自包含 MCP bundle、预构建的单文件 Widget，以及 `vendor/codex-image/` 下的 Codex-Image v3.2.0 零依赖 Node.js 运行时；Codex 可以直接发现 `render_any_cowart_canvas_widget`，图片流程也不依赖用户预先安装同名 Skill。运行时不会执行 `npm install`，也不依赖插件缓存中的 `node_modules`、tldraw 或 npm。开发依赖只用于 any-cowart 维护者在发布前重新生成和验证产物。

如果 `any-cowart-github` 已经注册，可以跳过第一条 `marketplace add` 命令。安装后请完全退出并重新启动一次 Codex，让新的 skill、MCP 工具和发布产物完整加载。

Codex 会在启动插件系统时自动检查这个 Git marketplace，并在远程 `main` 分支发生变化后刷新已安装的 any-cowart。需要立即检查更新时，可以手动运行：

```bash
codex plugin marketplace upgrade any-cowart-github
```

更新可能会替换插件缓存。更新后请完全退出并重新启动 Codex；any-cowart 会直接加载随版本发布的 MCP 和 Widget 产物，不会在新缓存中安装依赖。

## 使用

### 打开画布

在 Codex 中说：

```text
Open the any-cowart canvas for this project.
```

any-cowart 会通过 `render_any_cowart_canvas_widget` 打开 Codex 原生 widget，不需要再启动本地网页服务或手动打开 in-app browser。`scripts/start-canvas.sh` 只保留为本地开发 fallback。

画布数据会保存在当前项目目录下：

```text
canvas/pages/<page-id>/any-cowart-canvas.json
canvas/pages/<page-id>/assets/
```

升级前已有的 `cowart-canvas.json`、`cowart-selection.json` 和 `cowart-view-state.json` 仍可读取。首次保存后，any-cowart 只写入对应的 `any-cowart-*` 新文件；旧文件不会被覆盖。

![在 Codex 中打开 any-cowart 画布](assets/open-canvas.png)

### 生成新图

1. 打开 any-cowart 画布。
2. 在画布里创建并选中一个 `AI 图片` 框。
3. 在弹出的生成面板里输入 prompt，也可以选择一张或多张参考图，然后点击发送。

any-cowart 会把 prompt、参考图和选中 `AI 图片` 框的尺寸信息发送给 Codex。没有参考图时，Codex 调用随插件分发的 Codex-Image `generate` 模式；有参考图时调用 `reference` 模式，并把保存在当前 page `assets/` 目录中的本地图片路径作为输入。

Codex-Image 成功时返回一个 JSON 对象。any-cowart Skill 读取其中的本地图片 `path`，再把该路径交给 `insert_any_cowart_image`；这个 MCP 工具负责复制页面资源、创建 tldraw image asset 和 shape、替换 `AI 图片` 框并保存画布。Skill 不直接改写 tldraw snapshot。

![使用 any-cowart 生成并插入新图](assets/generate-image.png)

### 根据标注图生成新图

1. 在 any-cowart 画布中对图片做标注。
2. 选中被标注的图片，点击 `按标注修改`。
3. any-cowart 会导出包含原图、箭头和标注文字的截图，并通过 widget bridge 发送给 Codex。

Codex 会把本地标注截图交给 Codex-Image `edit` 模式，读取成功 JSON 中的图片 `path`，再通过 `insert_any_cowart_image` 把去掉标注痕迹的新图放在原图旁边。原图和标注不会被删除或移动。你也可以手动把 any-cowart 标注截图发给 Codex，走同样的修订流程。

![根据 any-cowart 标注截图生成修订图](assets/annotation-edit.png)

### 生成 AI HTML

1. 在工具栏中创建并选中一个 `AI HTML` 框；新建框默认是 `1024 × 576`（16:9）。
2. 在框下方的生成面板中输入 prompt，也可以选择或粘贴一张或多张参考图。
3. 点击发送后，Codex 会生成完整可运行的单文件 HTML，并把它嵌入选中的 `AI HTML` 框。

生成后的 HTML 会作为画布中的嵌入页面保存在当前 page 的 `assets/` 目录。选中它后可以下载渲染图、直接编辑文本，也可以结合画布标注继续修改 HTML。点击 `按标注生图` 时，HTML 截图和标注会交给 Codex-Image `edit` 模式，成功结果仍通过 `insert_any_cowart_image` 放到原 HTML 右侧，原 HTML 和标注保持不变。

![编辑 any-cowart AI HTML](assets/edit-html.png)

### 创建和演示 AI Slides

1. 在工具栏中创建一个 `AI Slides`。默认外框是 `1048 × 600`，对应一页 `1024 × 576`（16:9）内容和四周各 `12px` 的留白。
2. 可以把画布中的图片或 HTML 拖入 Slides，也可以复制图片后选中 Slides，再粘贴进去；内容会自动按顺序横向排列。
3. 空 Slides 被选中时会显示生成面板。输入整套演示的描述、按需添加参考图，并选择 3、5、10 页或自定义页数；默认是 5 页。
4. 发送后，Codex 会生成指定数量、视觉与叙事连贯的独立 16:9 HTML 页面，并依次加入当前 Slides。Slides 已有内容时不再显示生成面板。
5. 选中 Slides 后点击 `演示 Slides`，可以通过左侧缩略图预览和切换页面，也可以进入全屏播放。全屏时支持方向键、空格键和点击静态画面翻页；HTML 自身的按钮、链接和表单交互会保留，播放控制栏固定在顶部。

![演示和切换 any-cowart AI Slides](assets/view-slides.png)

## 技能

- `any-cowart:any-cowart-open-canvas`：打开 any-cowart 原生画布 widget。
- `any-cowart:any-cowart-image-gen`：纯文生图调用 Codex-Image `generate`，参考图生成调用 `reference`；读取 JSON `path` 后，用生成图片替换选中的 `AI 图片` 框，或插入当前页面。
- `any-cowart:any-cowart-image-edit`：图片标注修改和 HTML 按标注生图都调用 Codex-Image `edit`；读取 JSON `path` 后，把新图放在原内容旁边。

## 图片生成配置与错误

Codex-Image 随 any-cowart 一起安装，不需要单独安装。它优先使用 `CODEX_IMAGE_BASE_URL`、`CODEX_IMAGE_API_KEY` 和 `CODEX_IMAGE_MODEL` 配置的 HTTP 路径；没有可用 Key 时，也可以委托给已通过 ChatGPT 账号登录且版本符合要求的本机 Codex CLI。配置可来自进程环境变量、当前项目的 `.env.local` / `.env`、`~/.config/codex-image/.env`，或当前 Codex 配置。仓库不包含 API Key。

`CODEX_IMAGE_MODEL` 是负责发起图片工具调用的顶层模型，不是服务端实际图片模型。any-cowart 不指定服务端实际图片模型，实际值只在服务端返回时报告。

缺少随附脚本、Node.js 版本过低、配置缺失、鉴权失败、网络错误、服务端拒绝或图片校验失败时，Skill 会返回 Codex-Image 的明确错误码和消息，并在调用 `insert_any_cowart_image` 前停止。画布保持不变，不会退回 Codex 原生 `imagegen` 或其他图片服务。

## 本地开发

```bash
npm install
npm run dev
npm run build
```

`npm run build` 会重新生成并校验 `mcp/generated/` 下需要随 Git 版本提交的自包含 MCP 和 Widget 发布产物。提交源码改动前还应运行 `npm run quality`；它会运行 Codex-Image 上游离线测试、四条 any-cowart 位图流程探针，以及一个没有 `node_modules`、使用全新临时目录且禁止调用 npm 的冷启动探针。

本地开发时仍可以直接启动 Vite 画布服务，并指定用户项目目录：

```bash
./scripts/start-canvas.sh /path/to/user/project
```

常用环境变量：

- `ANY_COWART_PORT`：本地服务端口，默认 `43217`。
- `ANY_COWART_PROJECT_DIR`：画布数据所属的用户项目目录。
- `ANY_COWART_CANVAS_DIR`：画布数据目录，默认是 `$ANY_COWART_PROJECT_DIR/canvas`。

旧的 `COWART_PORT`、`COWART_PROJECT_DIR` 和 `COWART_CANVAS_DIR` 仍可作为兼容配置读取；同名的 `ANY_COWART_*` 变量存在时始终优先。

## 开发者

cookaihq

263483889+cookaihq@users.noreply.github.com

https://github.com/cookaihq/AnyCowart

## 致谢

any-cowart 的画布能力基于 [tldraw/tldraw](https://github.com/tldraw/tldraw) 实现。位图生成运行时使用随仓分发的 [Codex-Image](vendor/codex-image/UPSTREAM.md) v3.2.0；其 MIT 许可证保留在 [vendor/codex-image/LICENSE](vendor/codex-image/LICENSE)。
