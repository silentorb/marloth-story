#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${MARLOTH_WEB_PORT:-8787}"
OUT="${MARLOTH_WEB_OUT_DIR:-$ROOT/dist/web}"

if [[ ! -f "$OUT/index.html" ]]; then
  echo "Missing $OUT/index.html — run: bun run web:build" >&2
  exit 1
fi

echo "Marloth static site → http://127.0.0.1:${PORT}/"
exec python3 -m http.server "$PORT" --directory "$OUT"
