import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { createTLStore } from "tldraw";

import {
  readAnyCowartCanvasState,
  readAnyCowartSelectionState,
  readAnyCowartViewState,
  resolveAnyCowartPaths,
  saveAnyCowartCanvasSnapshot,
  writeAnyCowartSelectionState,
  writeAnyCowartViewState,
} from "../mcp/lib/canvas-storage.mjs";

const sandboxDir = await mkdtemp(path.join(tmpdir(), "any-cowart-storage-migration-"));
const canvasDir = path.join(sandboxDir, "canvas");
const legacyCanvasFile = path.join(canvasDir, "cowart-canvas.json");
const legacySelectionFile = path.join(canvasDir, "cowart-selection.json");
const legacyViewStateFile = path.join(canvasDir, "cowart-view-state.json");
const newCanvasFile = path.join(canvasDir, "any-cowart-canvas.json");
const newSelectionFile = path.join(canvasDir, "any-cowart-selection.json");
const newViewStateFile = path.join(canvasDir, "any-cowart-view-state.json");
const originalEnvironment = {
  ANY_COWART_PROJECT_DIR: process.env.ANY_COWART_PROJECT_DIR,
  ANY_COWART_CANVAS_DIR: process.env.ANY_COWART_CANVAS_DIR,
  COWART_PROJECT_DIR: process.env.COWART_PROJECT_DIR,
  COWART_CANVAS_DIR: process.env.COWART_CANVAS_DIR,
};

try {
  const snapshot = createTLStore().getStoreSnapshot();
  const selection = { selectedShapes: [], updatedAt: "2026-08-27T00:00:00.000Z" };
  const viewState = {
    version: 1,
    currentPageId: null,
    camera: { x: 12, y: 34, z: 1.25 },
    updatedAt: "2026-08-27T00:00:00.000Z",
  };

  await mkdir(canvasDir, { recursive: true });
  await writeFile(legacyCanvasFile, `${JSON.stringify(snapshot)}\n`);
  await writeFile(legacySelectionFile, `${JSON.stringify(selection)}\n`);
  await writeFile(legacyViewStateFile, `${JSON.stringify(viewState)}\n`);

  const args = { projectDir: sandboxDir };
  const canvasState = await readAnyCowartCanvasState(args);
  assert.equal(canvasState.path, legacyCanvasFile);
  assert.deepEqual(canvasState.snapshot, snapshot);

  const loadedSelection = await readAnyCowartSelectionState(args);
  assert.equal(loadedSelection.selectionFile, legacySelectionFile);
  assert.deepEqual(loadedSelection.selection, selection);

  const loadedViewState = await readAnyCowartViewState(args);
  assert.equal(loadedViewState.viewStateFile, legacyViewStateFile);
  assert.deepEqual(loadedViewState.viewState, viewState);

  const savedCanvas = await saveAnyCowartCanvasSnapshot(args, snapshot);
  assert.equal(savedCanvas.ok, true);
  await access(newCanvasFile);

  const nextSelection = { selectedShapes: [], updatedAt: "2026-08-27T01:00:00.000Z" };
  await writeAnyCowartSelectionState(args, nextSelection);
  assert.deepEqual(JSON.parse(await readFile(newSelectionFile, "utf8")), nextSelection);
  assert.deepEqual((await readAnyCowartSelectionState(args)).selection, nextSelection);

  const nextViewState = {
    ...viewState,
    camera: { x: 56, y: 78, z: 2 },
    updatedAt: "2026-08-27T01:00:00.000Z",
  };
  await writeAnyCowartViewState(args, nextViewState);
  assert.deepEqual(JSON.parse(await readFile(newViewStateFile, "utf8")), nextViewState);
  assert.deepEqual((await readAnyCowartViewState(args)).viewState, nextViewState);

  delete process.env.ANY_COWART_PROJECT_DIR;
  delete process.env.ANY_COWART_CANVAS_DIR;
  process.env.COWART_PROJECT_DIR = sandboxDir;
  process.env.COWART_CANVAS_DIR = canvasDir;
  assert.equal(resolveAnyCowartPaths().canvasDir, canvasDir);

  const preferredCanvasDir = path.join(sandboxDir, "preferred-canvas");
  process.env.ANY_COWART_CANVAS_DIR = preferredCanvasDir;
  assert.equal(resolveAnyCowartPaths().canvasDir, preferredCanvasDir);

  console.log("OK: any-cowart reads legacy storage and writes only the new names.");
} finally {
  for (const [name, value] of Object.entries(originalEnvironment)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  await rm(sandboxDir, { recursive: true, force: true });
}

// tldraw keeps runtime handles alive; this one-shot probe has completed all cleanup.
process.exit(0);
