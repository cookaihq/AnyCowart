---
name: any-cowart-image-gen
version: 1.0.0
description: v1.0.0｜Generate a bitmap with any-cowart's bundled Codex-Image runtime and place it on the canvas, replacing a selected AI 图片 holder or inserting it into the current page.
---

# any-cowart Image Gen

Use this skill when the user wants an AI-generated image placed onto the any-cowart canvas. A selected `AI 图片` holder gives a precise size and placement target, but it is not required. By default, a selected holder is a temporary target and should be replaced by the generated image.

## Preconditions

Ensure the `any_cowart_mcp` tools required by this workflow are available. Do not call `render_any_cowart_canvas_widget` as a routine prerequisite: requests sent from the any-cowart widget already have an open canvas, and the existing widget synchronizes inserted images from MCP-backed storage. If the user separately asks to open, reopen, or explicitly refresh the canvas, handle that request once with the canvas-opening workflow.

any-cowart state is read and written through any-cowart MCP tools, not through a localhost browser service.

Use the Codex-Image runtime bundled inside the same plugin. Resolve the runtime relative to this Skill directory:

```text
../../vendor/codex-image/scripts/generate-image.mjs
```

Normalize that path to an absolute path before executing it. Do not require a separately installed `codex-image` Skill. If the bundled script or Node.js is unavailable, report that concrete error and stop. Never fall back to native `imagegen`, another image provider, or a hand-written image request.

New holders are tldraw `frame` shapes with:

```json
{
  "type": "frame",
  "meta": {
    "anyCowartAiImageHolder": true
  }
}
```

Older canvases may still contain legacy `geo` rectangle holders with the same
meta flag. Support both shapes.

## Workflow

1. Read the selected shape from any-cowart with the MCP `get_any_cowart_selection` tool. Pass the active user project directory as `projectDir`.

2. Check whether exactly one selected shape is an AI image holder. A holder is any selected shape with either:

   ```text
   isAiImageHolder: true
   ```

   or:

   ```text
   meta.anyCowartAiImageHolder: true
   ```

   If yes, use the holder replacement workflow below. If not, do not ask the user to select a holder; use the standalone workflow below and insert the generated image into the current any-cowart page.

3. Choose the placement workflow.

   Holder replacement workflow: use the selected holder's `props.w` and `props.h` as the size contract for both generation and placement. Before generating, derive and keep these values:

   - `targetWidth`: selected holder `props.w`
   - `targetHeight`: selected holder `props.h`
   - `targetAspectRatio`: the reduced `targetWidth:targetHeight` ratio when it maps cleanly, plus the decimal `targetWidth / targetHeight`

   If the selected holder matches an any-cowart ratio preset such as `1:1`, `3:2`, `2:3`, `4:3`, `3:4`, `16:9`, or `9:16`, use that preset label as the human-readable aspect ratio. The generated image should be composed for this target size and aspect ratio, and should not rely on later stretching or cropping to fit the holder.

   The generated image should replace the selected holder as a normal tldraw image shape:

   - `parentId`: same parent as the holder
   - `x`, `y`, `rotation`: same as the holder
   - `props.w`, `props.h`: same as the holder

   This leaves the final canvas with an image shape at the holder's position, not an AI holder that contains an image. Only preserve the holder when the user explicitly asks to keep the reusable slot.

   Standalone workflow: when no AI holder is selected, generate the image anyway and insert it as a normal image shape on the current page. Prefer the current page from any-cowart view state; if there is a selected non-holder shape and it is useful as context, place the image beside it, otherwise place it in a clear page area. If the user requested a size or aspect ratio, pass that size and ratio into generation and use it for display. Otherwise, use the generated bitmap's natural aspect ratio and a practical display width such as 512 canvas units.

4. Generate each bitmap with the bundled Codex-Image script. If the requested asset needs visible copy, labels, poster text, ad text, UI text, or typography, include that text directly in the generation prompt. Do not default to generating a text-free background and then adding text locally unless the user explicitly asks for local typography, deterministic text overlay, SVG/vector output, or another non-bitmap layout step.

   Select the Codex-Image mode from the actual inputs:

   - no input images: pass `--mode generate` and no `--image`
   - one or more reference images: pass `--mode reference` and one `--image <absolute-local-path>` per image

   Every reference sent from the any-cowart widget should have a project-local path returned by `save_any_cowart_reference_image`. If a reference has no readable local path, report which reference is unavailable and stop before generation. Do not silently omit it or substitute native image generation.

   For the holder workflow, the image generation request must explicitly include the selected holder's target size and aspect ratio. Add this information to the model prompt, for example:

   ```text
   Target canvas slot: 512 x 683 canvas units.
   Target aspect ratio: 3:4 (0.75 width/height).
   Compose the final bitmap for this portrait ratio so it fits the slot without cropping or stretching.
   ```

   If Codex-Image accepts a provider size that matches the requested dimensions, pass it with `--size` in addition to the prompt text. Otherwise rely on the explicit size and aspect-ratio text; never invent a provider size or specify the server-side image model.

   Create a unique temporary output directory and execute one command per requested bitmap:

   ```bash
   node <absolute-bundled-codex-image-script> \
     --prompt "<final prompt>" \
     [--image <absolute-reference-path>]... \
     --mode <generate-or-reference> \
     [--size <supported-provider-size>] \
     --label "any-cowart-image" \
     --output-dir <unique-temporary-directory> \
     --json
   ```

   Parse the command's single JSON object from stdout. Continue only when all of these conditions hold:

   - the process exits with code `0`
   - JSON `ok` is `true`
   - JSON `mode` matches the requested `generate` or `reference` mode
   - JSON `path` is an absolute path to a readable local image created by this invocation

   Treat any other result as a failure. Report the stable `error.code` and `error.message` when present, keep the selected holder and the rest of the canvas unchanged, and do not call any any-cowart write tool. Do not inspect Codex session JSONL, search `$CODEX_HOME/generated_images`, reuse an older file, retry through native `imagegen`, or choose a different provider.

   Before insertion, visually inspect JSON `path` and confirm it is the newly generated image for this request. Pass this exact `path` to `insert_any_cowart_image`; that MCP tool owns the copy into the page-local assets directory.

5. Insert the generated image as a new tldraw image shape.

   For the holder replacement workflow, call `insert_any_cowart_image` with the holder id as `anchorShapeId` and leave `replaceAiImageHolder` unset or set it to `true`. The MCP tool will place the image exactly where the holder was and remove the holder shape:

   - `type`: `image`
   - `parentId`: same as holder parent
   - `x`, `y`, `rotation`: same as holder
   - `props.w`, `props.h`: same as holder
   - `props.assetId`: the new image asset id
   - `meta.anyCowartGeneratedForAiImageHolder`: holder shape id
   - `meta.anyCowartReplacedAiImageHolder`: `true`

   If the user explicitly asks to keep the AI holder reusable, call `insert_any_cowart_image` with `replaceAiImageHolder: false`; for frame holders that legacy mode inserts the generated image as a child of the frame.

   For the standalone workflow, insert it into the current page as a normal image:

   - `type`: `image`
   - `parentId`: current page id, unless placing beside a selected non-holder shape requires the same parent
   - `x`, `y`: a clear page area or beside the selected non-holder shape
   - `rotation`: `0`
   - `props.w`, `props.h`: display size matching the generated bitmap aspect ratio
   - `props.assetId`: the new image asset id
   - `meta.anyCowartGeneratedStandalone`: `true`

6. Delete the selected holder by default as part of replacement. In the standalone workflow, do not create a holder first unless the user explicitly asks for one.

7. Save only through the any-cowart MCP `insert_any_cowart_image` call described above. Do not hand-write or replace the tldraw snapshot for this workflow.

   Prefer page-local asset URLs in the image asset:

   ```text
   /page-assets/<page-id-without-page-prefix>/<filename>
   ```

8. Let the any-cowart widget refresh from MCP-backed storage, then confirm the inserted shape id, final dimensions, target aspect ratio, saved asset path, and replaced holder id when the holder replacement workflow was used.

## Notes

- If the holder is a legacy rotated `geo` rectangle, preserve the same `rotation` on the replacement image.
- If there is already a generated image inside the holder from an older any-cowart version, replacing the holder should remove the holder and its child image shape, then create one normal image shape in the holder's former position.
- Do not refuse generation solely because no `AI 图片` holder is selected. Generate the bitmap and insert it into the current any-cowart page.
- Never overwrite an existing asset file; use a timestamped filename.
- Delete only the unique temporary output directory after `insert_any_cowart_image` has copied the result or after a generation failure. Never delete a configured shared output directory.
- If Codex-Image is missing, unconfigured, or fails, return the concrete failure and leave every any-cowart shape and record unchanged.
