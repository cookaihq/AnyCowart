const CANVAS_ENDPOINT = '/api/canvas'
const SELECTION_ENDPOINT = '/api/selection'
const VIEW_STATE_ENDPOINT = '/api/view-state'

const TOOL_GET_CANVAS_STATE = 'get_any_cowart_canvas_state'
const TOOL_SAVE_CANVAS_STATE = 'save_any_cowart_canvas_state'
const TOOL_SAVE_SELECTION_STATE = 'save_any_cowart_selection_state'
const TOOL_SAVE_VIEW_STATE = 'save_any_cowart_view_state'
const TOOL_SAVE_REFERENCE_IMAGE = 'save_any_cowart_reference_image'
const TOOL_READ_PAGE_ASSET = 'read_any_cowart_page_asset'
const TOOL_DOWNLOAD_FILE = 'download_any_cowart_file'
const TOOL_COPY_IMAGE_TO_CLIPBOARD = 'copy_any_cowart_image_to_clipboard'
const TOOL_INSERT_HTML_DRAFT = 'insert_any_cowart_html_draft'
const WIDGET_PAYLOAD_TIMEOUT_MS = 5000

globalThis.__ANY_COWART_WIDGET_FETCH_GUARD__ = true

export const IS_ANY_COWART_WIDGET_BUILD =
  typeof __ANY_COWART_WIDGET_BUILD__ !== 'undefined' && __ANY_COWART_WIDGET_BUILD__

export function hasAnyCowartWidgetBridge() {
  return Boolean(window.anyCowartMcp && typeof window.anyCowartMcp.callServerTool === 'function')
}

function currentWidgetPayload() {
  return window.openai?.toolOutput && typeof window.openai.toolOutput === 'object'
    ? window.openai.toolOutput
    : {}
}

function hasWidgetStorageTarget() {
  const payload = currentWidgetPayload()
  return Boolean(payload.projectDir || payload.canvasDir)
}

function serverToolArgs(extra = {}) {
  const payload = currentWidgetPayload()
  return removeUndefined({
    projectDir: payload.projectDir,
    canvasDir: payload.canvasDir,
    ...extra
  })
}

function removeUndefined(value) {
  return Object.fromEntries(Object.entries(value).filter(([_key, item]) => item !== undefined))
}

function abortError() {
  return new DOMException('The operation was aborted.', 'AbortError')
}

async function waitForWidgetPayload(signal) {
  if (!hasAnyCowartWidgetBridge()) return
  if (hasWidgetStorageTarget()) return

  await new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError())
      return
    }

    const timer = window.setTimeout(() => {
      cleanup()
      reject(new Error('any-cowart widget storage target was not ready. Refusing to read or write without projectDir/canvasDir.'))
    }, WIDGET_PAYLOAD_TIMEOUT_MS)
    const cleanup = () => {
      window.clearTimeout(timer)
      window.removeEventListener('openai:set_globals', handleGlobals)
      signal?.removeEventListener('abort', handleAbort)
    }
    const finish = () => {
      cleanup()
      resolve()
    }
    const handleGlobals = () => {
      if (hasWidgetStorageTarget()) finish()
    }
    const handleAbort = () => {
      cleanup()
      reject(abortError())
    }

    window.addEventListener('openai:set_globals', handleGlobals, { once: true })
    signal?.addEventListener('abort', handleAbort, { once: true })
  })
}

async function callAnyCowartServerTool(name, args = {}, options = {}) {
  await waitForWidgetPayload(options.signal)
  if (options.signal?.aborted) throw abortError()
  const result = await window.anyCowartMcp.callServerTool({
    name,
    arguments: serverToolArgs(args)
  })
  if (result?.isError) {
    const message = result.content?.find((item) => item.type === 'text')?.text
    throw new Error(message || `any-cowart server tool failed: ${name}`)
  }
  return result.structuredContent ?? result
}

async function fetchJson(url, options = {}) {
  const response = await window.fetch(url, options)
  if (!response.ok) {
    throw new Error(`any-cowart request failed: ${response.status} - ${response.statusText}`)
  }
  return response.json()
}

export async function loadAnyCowartCanvasState(signal) {
  if (hasAnyCowartWidgetBridge()) {
    const state = await callAnyCowartServerTool(
      TOOL_GET_CANVAS_STATE,
      { hydrateAssets: false },
      { signal }
    )
    return {
      snapshot: state.snapshot,
      viewState: state.viewState ?? null,
      storage: state.storage,
      skippedRecords: []
    }
  }

  const [canvasData, viewStateData] = await Promise.all([
    fetchJson(CANVAS_ENDPOINT, { signal }),
    fetchJson(VIEW_STATE_ENDPOINT, { signal })
  ])
  return {
    snapshot: canvasData.snapshot,
    viewState: viewStateData.viewState ?? null,
    storage: canvasData.storage,
    skippedRecords: []
  }
}

export async function refreshAnyCowartCanvasSnapshot(signal) {
  if (hasAnyCowartWidgetBridge()) {
    const state = await callAnyCowartServerTool(
      TOOL_GET_CANVAS_STATE,
      { hydrateAssets: false },
      { signal }
    )
    return state.snapshot
  }

  const canvasData = await fetchJson(CANVAS_ENDPOINT, { signal })
  return canvasData.snapshot
}

export async function saveAnyCowartCanvasSnapshot(snapshot, options = {}) {
  if (hasAnyCowartWidgetBridge()) {
    return callAnyCowartServerTool(TOOL_SAVE_CANVAS_STATE, {
      snapshot,
      protectImageRecords: options.protectImageRecords,
      acknowledgedImageShapeDeletes: options.acknowledgedImageShapeDeletes
    })
  }

  return fetchJson(CANVAS_ENDPOINT, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(snapshot)
  })
}

export async function saveAnyCowartSelectionState(selection) {
  if (hasAnyCowartWidgetBridge()) {
    return callAnyCowartServerTool(TOOL_SAVE_SELECTION_STATE, { selection })
  }

  return fetchJson(SELECTION_ENDPOINT, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(selection)
  })
}

export async function saveAnyCowartViewState(viewState) {
  if (hasAnyCowartWidgetBridge()) {
    return callAnyCowartServerTool(TOOL_SAVE_VIEW_STATE, { viewState })
  }

  return fetchJson(VIEW_STATE_ENDPOINT, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(viewState)
  })
}

export async function saveAnyCowartReferenceImage(reference) {
  if (!hasAnyCowartWidgetBridge()) {
    throw new Error('当前 any-cowart 画布没有可用的 Codex MCP 文件保存桥。')
  }

  return callAnyCowartServerTool(TOOL_SAVE_REFERENCE_IMAGE, reference)
}

export async function downloadAnyCowartFile(download) {
  if (!hasAnyCowartWidgetBridge()) {
    throw new Error('当前 any-cowart 画布没有可用的 Codex MCP 文件下载桥。')
  }

  return callAnyCowartServerTool(TOOL_DOWNLOAD_FILE, download)
}

export async function copyAnyCowartImageToClipboard(image) {
  if (!hasAnyCowartWidgetBridge()) {
    throw new Error('当前 any-cowart 画布没有可用的系统剪贴板桥。')
  }

  return callAnyCowartServerTool(TOOL_COPY_IMAGE_TO_CLIPBOARD, image)
}

export async function updateAnyCowartHtmlDraft({ draftShapeId, htmlContent }) {
  if (!hasAnyCowartWidgetBridge()) {
    return fetchJson('/api/html-draft', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ draftShapeId, htmlContent })
    })
  }

  return callAnyCowartServerTool(TOOL_INSERT_HTML_DRAFT, {
    draftShapeId,
    htmlContent,
    updateExistingDraft: true
  })
}

export async function readAnyCowartPageAsset(assetUrl, options = {}) {
  if (!hasAnyCowartWidgetBridge()) {
    throw new Error('当前 any-cowart 画布没有可用的 Codex MCP 文件读取桥。')
  }

  return callAnyCowartServerTool(TOOL_READ_PAGE_ASSET, { assetUrl }, options)
}
