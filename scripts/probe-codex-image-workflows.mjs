import assert from "node:assert/strict";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { PageRecordType, createTLStore } from "tldraw";

import {
  IMAGE_FIXTURES,
  cleanupWorkspaces,
  imageItemEvent,
  makeWorkspace,
  runCli,
  soleJson,
  sse,
  startMockProvider,
  startSse,
  writeImage,
} from "../vendor/codex-image/tests/helpers.mjs";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PROJECT_DIR = await mkdtemp(path.join(tmpdir(), "any-cowart-codex-image-probe-"));
const workspace = await makeWorkspace();
const provider = await startMockProvider(({ response }) => {
  startSse(response, { "x-request-id": "req_any_cowart_probe" });
  response.write(sse(imageItemEvent(IMAGE_FIXTURES.png.toString("base64"))));
  response.end();
});

const transportEnvironment = Object.fromEntries(
  Object.entries(process.env).filter(([, value]) => typeof value === "string"),
);
transportEnvironment.ANY_COWART_PLUGIN_ROOT = ROOT_DIR;
const transport = new StdioClientTransport({
  command: process.execPath,
  args: ["./scripts/start-mcp.mjs"],
  cwd: ROOT_DIR,
  env: transportEnvironment,
});
const client = new Client({ name: "any-cowart-codex-image-probe", version: "1.0.0" });

try {
  await assertShippedContracts();

  const referencePath = await writeImage(workspace, "reference.png");
  const annotationPath = await writeImage(workspace, "image-annotation.png");
  const htmlAnnotationPath = await writeImage(workspace, "html-annotation.png");
  const scenarios = [
    {
      name: "text generation",
      expectedMode: "generate",
      expectedAction: "generate",
      args: ["--prompt", "text-only any-cowart probe", "--mode", "generate"],
    },
    {
      name: "reference generation",
      expectedMode: "reference",
      expectedAction: "generate",
      args: [
        "--prompt",
        "reference any-cowart probe",
        "--mode",
        "reference",
        "--image",
        referencePath,
      ],
    },
    {
      name: "image annotation edit",
      expectedMode: "edit",
      expectedAction: "edit",
      args: [
        "--prompt",
        "image annotation any-cowart probe",
        "--mode",
        "edit",
        "--image",
        annotationPath,
      ],
    },
    {
      name: "HTML annotation image",
      expectedMode: "edit",
      expectedAction: "edit",
      args: [
        "--prompt",
        "HTML annotation any-cowart probe",
        "--mode",
        "edit",
        "--image",
        htmlAnnotationPath,
      ],
    },
  ];

  const outputs = [];
  for (const [index, scenario] of scenarios.entries()) {
    const result = await runCli(
      [
        ...scenario.args,
        "--label",
        `any-cowart-probe-${index + 1}`,
        "--output-dir",
        path.join(workspace.root, "outputs"),
        "--json",
      ],
      {
        workspace,
        env: {
          CODEX_IMAGE_BASE_URL: provider.url,
          CODEX_IMAGE_API_KEY: "any-cowart-offline-test-key",
          CODEX_IMAGE_MODEL: "any-cowart-top-level-test-model",
        },
      },
    );
    const payload = soleJson(result);
    assert.equal(payload.ok, true, `${scenario.name}: ${result.stderr || result.stdout}`);
    assert.equal(payload.mode, scenario.expectedMode, scenario.name);
    assert.equal(path.isAbsolute(payload.path), true, `${scenario.name} path must be absolute`);
    await access(payload.path);
    outputs.push(payload);
  }

  assert.deepEqual(
    provider.requests.map((request) => request.body?.tools?.[0]?.action),
    scenarios.map((scenario) => scenario.expectedAction),
  );
  assert.equal(provider.requests[0].body.input, "text-only any-cowart probe");
  assert.deepEqual(
    provider.requests.slice(1).map((request) => request.body?.input?.[0]?.content?.[1]?.type),
    ["input_image", "input_image", "input_image"],
  );

  await client.connect(transport);
  const fixture = createCanvasFixture();
  const saveResult = await client.callTool({
    name: "save_any_cowart_canvas_state",
    arguments: { projectDir: PROJECT_DIR, snapshot: fixture.snapshot },
  });
  assert.equal(saveResult.structuredContent?.ok, true, "fixture canvas must save");

  const textInsert = await insertImage(outputs[0].path, {
    anchorShapeId: fixture.textHolderId,
    shapeMeta: { anyCowartProbeFlow: "generate" },
  });
  assert.equal(textInsert.replacedAiImageHolder, true);
  assert.ok(textInsert.replacedShapeIds.includes(fixture.textHolderId));
  assert.equal(textInsert.sourceImagePath, outputs[0].path);

  const referenceInsert = await insertImage(outputs[1].path, {
    anchorShapeId: fixture.referenceHolderId,
    shapeMeta: { anyCowartProbeFlow: "reference" },
  });
  assert.equal(referenceInsert.replacedAiImageHolder, true);
  assert.ok(referenceInsert.replacedShapeIds.includes(fixture.referenceHolderId));
  assert.equal(referenceInsert.sourceImagePath, outputs[1].path);

  const annotationInsert = await insertImage(outputs[2].path, {
    anchorShapeId: textInsert.shapeId,
    replaceAiImageHolder: false,
    placement: "right",
    margin: 40,
    matchAnchor: true,
    shapeMeta: { anyCowartGeneratedFromAnnotationEdit: true },
  });
  assert.equal(annotationInsert.replacedAiImageHolder, false);
  assert.equal(annotationInsert.sourceImagePath, outputs[2].path);
  assert.equal(annotationInsert.bounds.x, textInsert.bounds.x + textInsert.bounds.w + 40);

  const htmlAnnotationInsert = await insertImage(outputs[3].path, {
    anchorShapeId: fixture.htmlDraftId,
    replaceAiImageHolder: false,
    placement: "right",
    margin: 40,
    matchAnchor: true,
    shapeMeta: { anyCowartGeneratedFromHtmlDraftAnnotation: true },
  });
  assert.equal(htmlAnnotationInsert.replacedAiImageHolder, false);
  assert.equal(htmlAnnotationInsert.sourceImagePath, outputs[3].path);
  assert.equal(htmlAnnotationInsert.bounds.x, fixture.htmlDraftX + fixture.width + 40);

  const savedState = await readCanvasState();
  const savedStore = savedState.snapshot.store;
  assert.equal(savedStore[fixture.textHolderId], undefined);
  assert.equal(savedStore[fixture.referenceHolderId], undefined);
  assert.equal(savedStore[textInsert.shapeId]?.type, "image");
  assert.equal(savedStore[referenceInsert.shapeId]?.type, "image");
  assert.equal(savedStore[annotationInsert.shapeId]?.meta?.anyCowartGeneratedFromAnnotationEdit, true);
  assert.equal(
    savedStore[htmlAnnotationInsert.shapeId]?.meta?.anyCowartGeneratedFromHtmlDraftAnnotation,
    true,
  );
  assert.equal(savedStore[fixture.htmlDraftId]?.type, "embed", "HTML source must remain unchanged");
  await Promise.all(
    [textInsert, referenceInsert, annotationInsert, htmlAnnotationInsert].map((result) =>
      access(result.assetFile),
    ),
  );

  const beforeFailure = JSON.stringify(savedState.snapshot);
  const failedRun = await runCli(
    ["--prompt", "must fail before canvas insertion", "--mode", "generate", "--json"],
    { workspace },
  );
  const failedPayload = soleJson(failedRun);
  assert.equal(failedPayload.ok, false);
  assert.ok(failedPayload.error?.code, "failure must include a stable error code");
  assert.equal(JSON.stringify((await readCanvasState()).snapshot), beforeFailure);

  console.log(
    "OK: four any-cowart bitmap workflows use bundled Codex-Image JSON paths and preserve the canvas on generation failure.",
  );
} finally {
  await client.close().catch(() => undefined);
  await provider.close();
  await cleanupWorkspaces();
  await rm(PROJECT_DIR, { recursive: true, force: true });
}

async function assertShippedContracts() {
  const [appSource, imageGenSkill, imageEditSkill, license, upstream] = await Promise.all([
    readFile(path.join(ROOT_DIR, "src", "App.jsx"), "utf8"),
    readFile(path.join(ROOT_DIR, "skills", "any-cowart-image-gen", "SKILL.md"), "utf8"),
    readFile(path.join(ROOT_DIR, "skills", "any-cowart-image-edit", "SKILL.md"), "utf8"),
    readFile(path.join(ROOT_DIR, "vendor", "codex-image", "LICENSE"), "utf8"),
    readFile(path.join(ROOT_DIR, "vendor", "codex-image", "UPSTREAM.md"), "utf8"),
  ]);

  assert.match(imageGenSkill, /--mode generate/u);
  assert.match(imageGenSkill, /--mode reference/u);
  assert.match(imageGenSkill, /JSON `path`/u);
  assert.match(imageGenSkill, /\.\.\/\.\.\/vendor\/codex-image\/scripts\/generate-image\.mjs/u);
  assert.match(imageEditSkill, /--mode edit/u);
  assert.match(imageEditSkill, /HTML annotation image generation/u);
  assert.match(imageEditSkill, /JSON `path`/u);
  assert.match(appSource, /Required Codex-Image mode:.*reference.*generate/u);
  assert.match(appSource, /Codex-Image.*edit 模式.*当前选中的图片/u);
  assert.match(appSource, /Codex-Image.*edit 模式.*HTML 草稿/u);
  assert.doesNotMatch(appSource, /请使用内置 imagegen/u);
  assert.match(license, /MIT License/u);
  assert.match(license, /Copyright \(c\) 2026 cookaihq/u);
  assert.match(upstream, /Version: `3\.2\.0`/u);
}

function createCanvasFixture() {
  const store = createTLStore();
  const page = PageRecordType.create({ name: "Codex-Image Probe", index: "a1" });
  const width = 512;
  const height = 683;
  const textHolder = store.schema.types.shape.create({
    type: "frame",
    parentId: page.id,
    index: "a1",
    x: 0,
    y: 0,
    props: { w: width, h: height, name: "AI 图片", color: "blue" },
    meta: { anyCowartAiImageHolder: true },
  });
  const referenceHolder = store.schema.types.shape.create({
    type: "frame",
    parentId: page.id,
    index: "a2",
    x: 1800,
    y: 0,
    props: { w: width, h: height, name: "AI 图片", color: "blue" },
    meta: { anyCowartAiImageHolder: true },
  });
  const htmlDraftX = 3600;
  const htmlDraft = store.schema.types.shape.create({
    type: "embed",
    parentId: page.id,
    index: "a3",
    x: htmlDraftX,
    y: 0,
    props: {
      w: width,
      h: height,
      url: "data:text/html;base64,PGh0bWw+PGJvZHk+UHJvYmU8L2JvZHk+PC9odG1sPg==",
    },
    meta: { anyCowartHtmlDraft: true },
  });
  store.put([page, textHolder, referenceHolder, htmlDraft]);
  const snapshot = store.getStoreSnapshot();
  store.dispose();
  return {
    snapshot,
    textHolderId: textHolder.id,
    referenceHolderId: referenceHolder.id,
    htmlDraftId: htmlDraft.id,
    htmlDraftX,
    width,
  };
}

async function insertImage(imagePath, args) {
  const result = await client.callTool({
    name: "insert_any_cowart_image",
    arguments: { projectDir: PROJECT_DIR, imagePath, ...args },
  });
  assert.notEqual(result.isError, true, JSON.stringify(result.content));
  assert.equal(result.structuredContent?.sourceImagePath, imagePath);
  return result.structuredContent;
}

async function readCanvasState() {
  const result = await client.callTool({
    name: "get_any_cowart_canvas_state",
    arguments: { projectDir: PROJECT_DIR },
  });
  assert.notEqual(result.isError, true, JSON.stringify(result.content));
  return result.structuredContent;
}

// tldraw keeps runtime handles alive after the one-shot probe has completed.
process.exit(0);
