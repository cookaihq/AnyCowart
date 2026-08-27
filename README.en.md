# any-cowart

any-cowart is a native infinite-canvas widget plugin for Codex. It brings a tldraw-powered canvas into Codex for visual thinking, annotation, image generation, and annotation-driven image edits. The canvas opens directly as an MCP widget, and its data is saved in the active user project under `canvas/` instead of inside the plugin repository.

The repository also conforms to [Agent Plugins v1.0.0](https://agent-plugins.org/specification): root-level `plugin.json`, `skills/`, and `mcp.json` provide the portable plugin entry points, while `.codex-plugin/plugin.json`, `.mcp.json`, and `.agents/plugins/marketplace.json` retain Codex-specific interface and installation metadata.

中文说明: [README.md](README.md)

## Features

- Open a native tldraw infinite-canvas widget from Codex; normal use no longer opens a local page through a web browser or the in-app browser.
- Persist canvas pages and image assets in the active project directory.
- Create AI image slots on the canvas, enter a prompt directly, choose reference images, and use the bundled Codex-Image runtime to generate an image that replaces the selected slot at the same position and aspect ratio.
- Create a 16:9 `AI HTML` slot, generate a runnable single-file HTML page from a prompt and reference images, and embed it directly on the canvas for further editing and iteration.
- Create `AI Slides` to organize images and HTML into a deck, or ask Codex to generate a specified number of coordinated 16:9 HTML pages; preview the deck with thumbnails or play it fullscreen.
- After annotating an image or HTML draft, submit the annotation screenshot directly from the canvas so Codex-Image can generate a clean bitmap beside the original content.
- Use any-cowart MCP tools to read selection state, save the canvas, insert images or HTML, and save page-local assets.

## Installation

> [!IMPORTANT]
> After installation, completely quit and restart Codex once before using any-cowart. Restarting ensures that any-cowart's new skills and MCP tools are fully loaded.

### Ask Codex To Install It

Send the following message to Codex:

```text
Please install the any-cowart Codex plugin through the Git marketplace bundled with its repository.
First run codex plugin marketplace add cookaihq/AnyCowart --ref main,
then run codex plugin add any-cowart@any-cowart-github and use codex plugin list to confirm it is enabled.
any-cowart ships a self-contained MCP server, a prebuilt widget, and Codex-Image; it never runs npm install in the plugin cache and does not require new users to preinstall tldraw or Codex-Image;
do not install dependencies manually in the current repository, plugin cache, or marketplace snapshot.
Do not clone the repository into the personal marketplace. When installation finishes, clearly remind me
to completely quit and restart Codex once before using any-cowart.
```

### Manual Install

First register the any-cowart Git repository as a Codex marketplace:

```bash
codex plugin marketplace add cookaihq/AnyCowart --ref main
```

Then install any-cowart from that marketplace and verify it:

```bash
codex plugin add any-cowart@any-cowart-github
codex plugin list
```

You do not need to locate the plugin cache manually. any-cowart's Git release tracks a self-contained MCP bundle, a prebuilt single-file widget, and the dependency-free Codex-Image v3.2.0 Node.js runtime under `vendor/codex-image/`. Codex can discover `render_any_cowart_canvas_widget`, and image workflows do not depend on a separately installed Codex-Image Skill. Runtime startup does not execute `npm install` or depend on `node_modules`, tldraw, or npm inside the plugin cache. Development dependencies are used only by maintainers to regenerate and verify release artifacts.

If `any-cowart-github` is already registered, skip the first `marketplace add` command. After installation, completely quit and restart Codex once so the new skills, MCP tools, and release artifacts are fully loaded.

Codex automatically checks this Git marketplace when its plugin system starts and refreshes the installed any-cowart plugin when the remote `main` branch changes. To check for an update immediately, run:

```bash
codex plugin marketplace upgrade any-cowart-github
```

An update may replace the plugin cache. After updating, completely quit and restart Codex; any-cowart loads the MCP and widget artifacts shipped with the release and does not install dependencies into the new cache.

## Usage

### Open The Canvas

Ask Codex:

```text
Open the any-cowart canvas for this project.
```

any-cowart opens a native Codex widget through `render_any_cowart_canvas_widget`; it no longer needs a localhost page or manual in-app-browser navigation. `scripts/start-canvas.sh` remains only as a local-development fallback.

Canvas data is saved in the active project:

```text
canvas/pages/<page-id>/any-cowart-canvas.json
canvas/pages/<page-id>/assets/
```

Existing `cowart-canvas.json`, `cowart-selection.json`, and `cowart-view-state.json` files remain readable after upgrading. Once a save occurs, any-cowart writes only the corresponding new `any-cowart-*` files and leaves the old files unchanged.

![Open any-cowart canvas in Codex](assets/open-canvas.png)

### Generate A New Image

1. Open the any-cowart canvas.
2. Create and select an `AI 图片` slot on the canvas.
3. In the generation panel, enter a prompt, optionally choose one or more reference images, then send the request.

any-cowart sends the prompt, reference images, and selected `AI 图片` slot dimensions to Codex. Codex calls the bundled Codex-Image runtime in `generate` mode when there are no reference images and in `reference` mode when local reference-image paths are present.

On success, Codex-Image returns JSON containing a local image `path`. The any-cowart Skill passes that exact path to `insert_any_cowart_image`, which copies the page asset, creates the tldraw image asset and shape, replaces the `AI 图片` slot, and saves the canvas. The Skill does not rewrite the tldraw snapshot directly.

![Generate and insert a new image with any-cowart](assets/generate-image.png)

### Generate AI HTML

1. Create and select an `AI HTML` slot from the toolbar. New slots default to `1024 × 576` (16:9).
2. Enter a prompt in the generation panel below the slot. You can also choose or paste one or more reference images.
3. Send the request. Codex generates a complete runnable single-file HTML page and embeds it into the selected `AI HTML` slot.

The generated HTML is stored as an embedded canvas page in the current page's `assets/` directory. Select it to download a rendered image, edit text directly, or continue revising it with canvas annotations. Clicking `按标注生图` sends the rendered HTML screenshot and annotations to Codex-Image in `edit` mode; the successful result is placed to the right through `insert_any_cowart_image`, while the original HTML and annotations remain unchanged.

![Edit any-cowart AI HTML](assets/edit-html.png)

### Create And Present AI Slides

1. Create `AI Slides` from the toolbar. The default frame is `1048 × 600`, providing room for one `1024 × 576` (16:9) page with `12px` padding on every side.
2. Drag images or HTML from the canvas into the Slides frame. You can also copy an image, select the Slides frame, and paste it; items are arranged horizontally in order.
3. Selecting an empty Slides frame opens its generation panel. Describe the deck, optionally add reference images, and choose 3, 5, 10, or a custom number of pages. The default is 5 pages.
4. After you send the request, Codex generates the requested number of visually and narratively coordinated standalone 16:9 HTML pages and appends them to the current Slides frame. The generation panel is hidden once the frame contains content.
5. Select the Slides frame and click `演示 Slides` to preview and navigate with the thumbnail sidebar or enter fullscreen playback. In fullscreen, use the arrow keys, Space, or click static slide content to advance. Buttons, links, and form controls inside HTML remain interactive, and the playback controls stay at the top.

![Present and navigate any-cowart AI Slides](assets/view-slides.png)

### Generate From An Annotation Screenshot

1. Annotate an image on the any-cowart canvas.
2. Select the annotated image and click `按标注修改`.
3. any-cowart exports a screenshot containing the original image, arrows, and annotation text, then sends it to Codex through the widget bridge.

Codex passes the local annotation screenshot to Codex-Image in `edit` mode, reads the image `path` from successful JSON, and uses `insert_any_cowart_image` to place the clean result beside the original. The original image and annotations are not deleted or moved. You can also manually send an any-cowart annotation screenshot to Codex and use the same revision workflow.

![Generate a revised image from an any-cowart annotation screenshot](assets/annotation-edit.png)

## Skills

- `any-cowart:any-cowart-open-canvas`: open the native any-cowart canvas widget.
- `any-cowart:any-cowart-image-gen`: call Codex-Image `generate` for text-only requests and `reference` when input images are present, then use the JSON `path` to replace the selected `AI 图片` slot or insert the result on the current page.
- `any-cowart:any-cowart-image-edit`: call Codex-Image `edit` for both image annotation edits and HTML annotation image generation, then use the JSON `path` to place the result beside the source.

## Image Generation Configuration And Errors

Codex-Image is installed with any-cowart. It prefers the HTTP route configured by `CODEX_IMAGE_BASE_URL`, `CODEX_IMAGE_API_KEY`, and `CODEX_IMAGE_MODEL`. When no usable key is available, it can delegate to a compatible local Codex CLI logged in with a ChatGPT account. Configuration may come from process environment variables, `.env.local` / `.env` in the active project, `~/.config/codex-image/.env`, or the current Codex configuration. This repository contains no API key.

`CODEX_IMAGE_MODEL` is the top-level model that requests the image tool, not the server-side image model. any-cowart does not select the server-side image model and reports it only when the provider returns one.

If the bundled script is missing, Node.js is too old, configuration is absent, authentication fails, the network or provider fails, or the returned image is invalid, the Skill reports the explicit Codex-Image error code and message and stops before calling `insert_any_cowart_image`. The canvas remains unchanged, with no fallback to native Codex `imagegen` or another image service.

## Local Development

```bash
npm install
npm run dev
npm run build
```

`npm run build` regenerates and validates the self-contained MCP and widget release artifacts under `mcp/generated/`; those files must be committed with the Git release. Before committing source changes, also run `npm run quality`, which runs the upstream Codex-Image offline tests, an end-to-end probe for the four any-cowart bitmap workflows, and a cold-start probe with no `node_modules`, a fresh temporary directory, and an npm sentinel that fails if runtime installation is attempted.

For local development, you can still start the Vite canvas service directly and pass the active user project directory:

```bash
./scripts/start-canvas.sh /path/to/user/project
```

Useful environment variables:

- `ANY_COWART_PORT`: local service port, default `43217`.
- `ANY_COWART_PROJECT_DIR`: the user project directory that owns the canvas data.
- `ANY_COWART_CANVAS_DIR`: canvas data directory, default `$ANY_COWART_PROJECT_DIR/canvas`.

The old `COWART_PORT`, `COWART_PROJECT_DIR`, and `COWART_CANVAS_DIR` variables remain readable as compatibility fallbacks. The corresponding `ANY_COWART_*` variable always takes precedence when both are set.

## Developer

cookaihq

263483889+cookaihq@users.noreply.github.com

https://github.com/cookaihq/AnyCowart

## Acknowledgments

any-cowart's canvas experience is built on [tldraw/tldraw](https://github.com/tldraw/tldraw). Bitmap generation uses the bundled [Codex-Image](vendor/codex-image/UPSTREAM.md) v3.2.0 runtime; its MIT license is retained at [vendor/codex-image/LICENSE](vendor/codex-image/LICENSE).
