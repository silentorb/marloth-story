#!/usr/bin/env bash
set -euo pipefail
cd "${MARLOTH_WORKSPACE:-/workspaces/marloth-story}"
bun install --frozen-lockfile
exec "$@"
