---
name: any-cowart-image-edit
version: 1.0.0
description: v1.0.0｜Use any-cowart's bundled Codex-Image runtime to turn annotated image or HTML screenshots into clean bitmaps placed beside the source without changing the original or its annotations.
---

# any-cowart Image Edit

Use this skill to turn any-cowart annotation screenshots into revised bitmaps placed next to the corresponding source image or HTML draft.

## Preconditions

Ensure the `any_cowart_mcp` tools required by this workflow are available. Do not call `render_any_cowart_canvas_widget` as a routine prerequisite: annotation requests sent from the any-cowart widget already have an open canvas, and the existing widget synchronizes inserted results from MCP-backed storage. If the user separately asks to open, reopen, or explicitly refresh the canvas, handle that request once with the canvas-opening workflow.

any-cowart state is read and written through any-cowart MCP tools, not through a localhost browser service.

Use the Codex-Image runtime bundled inside the same plugin. Resolve `../../vendor/codex-image/scripts/generate-image.mjs` relative to this Skill directory and normalize it to an absolute path. Do not require a separately installed `codex-image` Skill. If the bundled script or Node.js is unavailable, report that concrete error and stop. Never fall back to native `imagegen`, another provider, or a hand-written image request.

The user is responsible for providing the relevant screenshot(s). Do not auto-capture the current canvas and do not scan the whole canvas to infer edit requests; a canvas may contain many images with different annotations.

## Workflow

1. Read the user-provided screenshot(s).

   Treat each screenshot as the authoritative edit brief for one output image unless the user says multiple screenshots belong to the same image.

   If the user provides multiple screenshots, process them independently and keep their generated outputs separate. Do not merge annotations across screenshots unless explicitly requested.

2. Extract the edit requirements from each screenshot.

   Read visible 批注 labels, arrows, and nearby edit notes from the screenshot itself. Use the arrow tip or marked region to understand where each note applies.

   Ignore editor chrome such as toolbars, blue selection outlines, resize handles, cursor icons, and unrelated neighboring images.

3. Identify the source type and visual input.

   For image annotation editing, use the annotated screenshot as the edit input, plus a cleaner source image when the user supplied one. For HTML annotation image generation, use the screenshot of the rendered HTML and its annotations as the edit input; the output is a new bitmap and the HTML source remains unchanged.

   If the screenshot is too cropped, obstructed, or low-resolution to serve as a usable visual base, ask for a cleaner screenshot of that specific source.

   Do not read the current any-cowart canvas to discover edit intent. Use the screenshot for the requested changes. any-cowart state may be read later only to place the generated result without covering existing content.

4. Prepare the Codex-Image edit input.

   Every `--image` argument must be an absolute path to a readable local file. Requests sent from the any-cowart widget include an `Annotation screenshot local path` created by `save_any_cowart_reference_image`; use that path. If no readable local path is available, report the missing input and stop before generation.

   The generation prompt should:

   - apply the 批注 text as edit instructions
   - preserve the original image's subject, composition, aspect ratio, and style unless an annotation asks otherwise
   - remove all annotation artifacts from the output, including red arrows, labels, blue selection outlines, handles, and tool UI
   - output only the revised clean image

5. Generate a new bitmap in Codex-Image `edit` mode.

   Create a unique temporary output directory. Do not overwrite the screenshot, original image, or HTML asset. Execute:

   ```bash
   node <absolute-bundled-codex-image-script> \
     --prompt "<final edit prompt>" \
     --image <absolute-annotation-screenshot-path> \
     [--image <absolute-clean-source-path>]... \
     --mode edit \
     [--size <supported-provider-size>] \
     --label "any-cowart-annotation-edit" \
     --output-dir <unique-temporary-directory> \
     --json
   ```

   Include the target dimensions and aspect ratio from the any-cowart request in the prompt. Pass `--size` only when Codex-Image accepts a matching provider size. Never invent a provider size or specify the server-side image model.

   Parse the command's single JSON object from stdout. Continue only when the process exits with code `0`, JSON `ok` is `true`, JSON `mode` is `edit`, and JSON `path` is an absolute path to a readable local image created by this invocation.

   Treat any other result as a failure. Report the stable `error.code` and `error.message` when present, keep the source and the rest of the canvas unchanged, and do not call any any-cowart write tool. Do not inspect Codex session JSONL, search `$CODEX_HOME/generated_images`, reuse an older file, retry through native `imagegen`, or choose a different provider.

   Before insertion, visually inspect JSON `path` and confirm it is the requested clean output without annotation artifacts.

6. Insert the revised image beside the original with any-cowart MCP.

   Use the any-cowart MCP `insert_any_cowart_image` tool. Do not hand-write
   tldraw `asset` / `shape` records or fractional `index` keys. The tool copies JSON `path` into the page-local assets
   folder, creates the tldraw image asset and image shape, generates a valid
   tldraw fractional index, places the image beside the anchor while avoiding
   overlaps, and saves through the project-backed any-cowart canvas files.

   Add a new tldraw image asset and a new image shape. Do not update, remove, hide, reparent, or reorder the original image, HTML draft, `AI 图片` frame, or any annotation shapes.

   Prefer a clear placement anchor when one is already available:

   - If the user has selected the original image, use that image as the anchor.
   - If the user has selected the original `AI 图片` frame, use that frame as the anchor.
   - For HTML annotation image generation, use the `AnyCowart HTML draft shape` id supplied by the widget as the anchor.
   - If the screenshot clearly shows the original image and there is a unique matching generated/original image or `AI 图片` frame on the current any-cowart page, use that as the anchor without asking the user to select it.
   - If there are multiple screenshots/outputs and the matching anchors are not uniquely identifiable, ask the user to select each corresponding anchor or provide an explicit placement order.
   - If no anchor is clear and the user has not required a specific side-by-side comparison, place the result in a nearby clear area on the current page where it does not cover, move, hide, or delete the original image or annotations.

   Placement rules:

   - If the source image is inside an `AI 图片` frame, use the frame's page-level bounds as the anchor and place the new image as a sibling of that frame.
   - Otherwise use the source image's own bounds and parent.
   - When the annotated source appears to have earlier revision images nearby, prefer placing the new revised image to the right of the currently annotated/source image, because older annotation outputs may already live on the left.
   - Place the new image to the right of the anchor with a margin of about `40` canvas units.
   - Match the displayed width and height of the anchor unless the user asks for a different size.
   - If that position would overlap existing content, keep moving right by `anchor width + 40` until the new image is clear.
   - If using a clear-area fallback with no anchor, keep the generated image near the annotated source page, match the likely source image size when known, and choose a position that does not overlap existing shapes.

   Recommended shape metadata for image annotation editing:

   ```json
   {
     "anyCowartGeneratedFromAnnotationEdit": true,
     "anyCowartAnnotationSourceShapeId": "<selected source image or frame id>",
     "anyCowartAnnotationScreenshot": "<source screenshot file name when available>"
   }
   ```

   For HTML annotation image generation use:

   ```json
   {
     "anyCowartGeneratedFromHtmlDraftAnnotation": true,
     "anyCowartAnnotationSourceShapeId": "<source HTML draft shape id>",
     "anyCowartAnnotationScreenshot": "<source screenshot file name when available>"
   }
   ```

7. Save through any-cowart.

   Only do any-cowart state access after the bitmap is generated. Use this access only to insert the new image beside the anchor or in a nearby clear area, not to discover edit intent.

   Preferred MCP call shape:

   ```json
   {
     "imagePath": "<JSON path from the successful Codex-Image result>",
     "projectDir": "/absolute/path/to/user/codex-project",
     "anchorShapeId": "<selected source image or frame id>",
     "placement": "right",
     "margin": 40,
     "matchAnchor": true,
     "fileName": "annotation-edit-20260620-153012.png",
     "annotationScreenshot": "<source screenshot file name when available>",
     "shapeMeta": {
       "anyCowartGeneratedFromAnnotationEdit": true
     },
     "altText": "Revised image generated from any-cowart annotation screenshot"
   }
   ```

   The MCP tool must return the new `assetId`, `shapeId`, saved asset path,
   page id, bounds, and generated `index`. Confirm that the returned `index` is
   a valid tldraw fractional index and not a custom descriptive string.

   If `insert_any_cowart_image` is unavailable, report that error and leave the canvas unchanged. Do not use `save_any_cowart_canvas_state` as a fallback.

8. Verify visually.

   Let the any-cowart widget refresh from MCP-backed storage, then confirm:

   - the original image is still in the same place
   - the original 批注 arrows and labels are still visible
   - the new revised image appears beside the original
   - the new image does not include annotation arrows, labels, selections, or UI chrome

## Guardrails

- Never replace the original image unless the user explicitly asks for replacement.
- Never replace or modify the source HTML draft during HTML annotation image generation.
- Never delete or move annotation shapes; they are the visible edit brief.
- Never put the revised image inside the original `AI 图片` frame, because that can cover the old image and make the before/after comparison harder.
- Never auto-capture or scan the current canvas for edit intent; use the screenshot(s) supplied by the user.
- If the annotations contradict each other, generate the most literal combined interpretation and mention the ambiguity.
- If a supplied screenshot shows selected-state outlines or toolbar UI, treat them as context only, not as content to generate.
- Delete only the unique temporary output directory after `insert_any_cowart_image` has copied the result or after a generation failure. Never delete a configured shared output directory.
- If Codex-Image is missing, unconfigured, or fails, return the concrete failure and leave every any-cowart shape and record unchanged.
