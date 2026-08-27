#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CALLER_DIR="$PWD"
PORT="${ANY_COWART_PORT:-${COWART_PORT:-43217}}"
PROJECT_DIR="${ANY_COWART_PROJECT_DIR:-${COWART_PROJECT_DIR:-${1:-$CALLER_DIR}}}"
CANVAS_DIR="${ANY_COWART_CANVAS_DIR:-${COWART_CANVAS_DIR:-${PROJECT_DIR}/canvas}}"

export ANY_COWART_PROJECT_DIR="$PROJECT_DIR"
export ANY_COWART_CANVAS_DIR="$CANVAS_DIR"

cd "$ROOT_DIR"

if [ ! -d node_modules ] || [ ! -x node_modules/.bin/vite ]; then
  npm install
fi

echo "any-cowart canvas: http://127.0.0.1:${PORT}"
echo "any-cowart canvas data: ${CANVAS_DIR}/pages/<page-id>/any-cowart-canvas.json"
echo "any-cowart page assets: ${CANVAS_DIR}/pages/<page-id>/assets -> http://127.0.0.1:${PORT}/page-assets/<page-id>/"
exec npm run dev -- --host 127.0.0.1 --port "$PORT"
