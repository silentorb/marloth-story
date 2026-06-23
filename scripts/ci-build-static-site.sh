#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MARLOTH_CI_IMAGE="${MARLOTH_CI_IMAGE:-marloth-ci:local}"
MARLOTH_CI_WORKSPACE="${MARLOTH_CI_WORKSPACE:-/workspaces/marloth-story}"
TOME_ROOT="${TOME_ROOT:-${ROOT}/tome}"
TOME_CI_WORKSPACE="${TOME_CI_WORKSPACE:-/workspaces/tome}"

usage() {
  cat <<EOF
Usage: ci-build-static-site.sh [--run-only | -h | --help]

Build the static site the same way GitHub Actions does.

Requires the tome repo at TOME_ROOT (default: ./tome next to marloth-story).

  (default)   docker build + docker run
  --run-only  docker run only (CI after build-push-action)

Environment:
  TOME_ROOT              Path to silentorb/tome checkout (default: \${ROOT}/tome)
  MARLOTH_CI_IMAGE       Docker image tag (default: marloth-ci:local)
  MARLOTH_CI_WORKSPACE   Mount path for marloth inside container
  TOME_WEB_BASE          Site base path for embedding (optional)
  MARLOTH_WEB_BASE       Legacy alias for TOME_WEB_BASE (optional)
EOF
}

require_docker() {
  if ! command -v docker >/dev/null 2>&1; then
    echo "docker not found on PATH." >&2
    exit 1
  fi
}

require_tome() {
  if [[ ! -d "${TOME_ROOT}/packages/tome-static-site" ]]; then
    echo "tome repo not found at ${TOME_ROOT}" >&2
    echo "Checkout silentorb/tome into ./tome or set TOME_ROOT." >&2
    exit 1
  fi
}

build_image() {
  echo "Building devcontainer image → ${MARLOTH_CI_IMAGE}"
  docker build -f "${ROOT}/.devcontainer/Dockerfile" -t "${MARLOTH_CI_IMAGE}" "${ROOT}"
}

run_build() {
  require_tome

  local web_base_args=()
  local web_base="${TOME_WEB_BASE:-${MARLOTH_WEB_BASE:-}}"
  if [[ -n "${web_base}" ]]; then
    web_base_args=(--base "${web_base}")
  fi

  echo "Building static site in ${MARLOTH_CI_IMAGE}"
  echo "  marloth: ${ROOT} → ${MARLOTH_CI_WORKSPACE}"
  echo "  tome:    ${TOME_ROOT} → ${TOME_CI_WORKSPACE}"

  docker run --rm \
    --user "$(id -u):$(id -g)" \
    -v "${ROOT}:${MARLOTH_CI_WORKSPACE}:rw" \
    -v "${TOME_ROOT}:${TOME_CI_WORKSPACE}:rw" \
    -e "TOME_CONTENT_PATH=${MARLOTH_CI_WORKSPACE}/content" \
    -e "TOME_DB_PATH=${MARLOTH_CI_WORKSPACE}/data/tome.sqlite" \
    -e "TOME_WEB_BASE=${web_base}" \
    -e "MARLOTH_WEB_BASE=${web_base}" \
    -w "${TOME_CI_WORKSPACE}" \
    "${MARLOTH_CI_IMAGE}" \
    bash -lc "
      set -euo pipefail
      bun install --frozen-lockfile
      bun run --filter tome-static-site test
      bun run web:build -- \
        --repo ${TOME_CI_WORKSPACE} \
        --content-dir ${MARLOTH_CI_WORKSPACE}/content \
        --out-dir ${MARLOTH_CI_WORKSPACE}/dist/web \
        ${web_base_args[*]}
    "
}

case "${1:-}" in
  -h | --help)
    usage
    exit 0
    ;;
  --run-only)
    require_docker
    run_build
    ;;
  "")
    require_docker
    build_image
    run_build
    ;;
  *)
    echo "Unknown option: $1" >&2
    usage >&2
    exit 1
    ;;
esac
