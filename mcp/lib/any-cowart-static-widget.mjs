import { readFile } from "node:fs/promises";
import path from "node:path";

import { pluginPath } from "./plugin-root.mjs";

const PREBUILT_WIDGET_FILE = pluginPath(
  "mcp",
  "generated",
  "any-cowart-widget.html",
);

export const ANY_COWART_STATIC_BUILD_DIR = path.dirname(PREBUILT_WIDGET_FILE);

let cachedStaticHtml = "";

export async function anyCowartStaticHtml() {
  if (cachedStaticHtml) return cachedStaticHtml;

  try {
    cachedStaticHtml = await readFile(PREBUILT_WIDGET_FILE, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") {
      throw new Error(
        "any-cowart's prebuilt widget artifact is missing. Run npm run build:artifacts before publishing the plugin.",
      );
    }
    throw error;
  }

  if (!cachedStaticHtml.includes("any-cowart Canvas")) {
    throw new Error("any-cowart's prebuilt widget artifact is invalid.");
  }

  return cachedStaticHtml;
}
