#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MARLOTH_CI_IMAGE="${MARLOTH_CI_IMAGE:-marloth-ci:local}"
MARLOTH_CI_WORKSPACE="${MARLOTH_CI_WORKSPACE:-/workspaces/marloth-story}"

usage() {
  cat <<EOF
Usage: ci-build-static-site.sh [--run-only | -h | --help]

Build the static site the same way GitHub Actions does: devcontainer image,
bind-mounted repo, host UID/GID, frozen lockfile, tests, then web:build.

  (default)   docker build + docker run
  --run-only  docker run only (CI after build-push-action)

Requires Docker on PATH (host/WSL — not available inside all devcontainers).

Environment:
  MARLOTH_CI_IMAGE       Image tag (default: marloth-ci:local)
  MARLOTH_CI_WORKSPACE   Mount path inside container (default: /workspaces/marloth-story)
EOF
}

require_docker() {
  if ! command -v docker >/dev/null 2>&1; then
    echo "docker not found on PATH." >&2
    echo "Run this script on the host (or WSL) where Docker is installed." >&2
    exit 1
  fi
}

build_image() {
  echo "Building devcontainer image → ${MARLOTH_CI_IMAGE}"
  docker build -f "${ROOT}/.devcontainer/Dockerfile" -t "${MARLOTH_CI_IMAGE}" "${ROOT}"
}

run_build() {
  echo "Building static site in container (bind mount ${ROOT})"
  docker run --rm \
    --user "$(id -u):$(id -g)" \
    -e HOME=/tmp \
    -v "${ROOT}:${MARLOTH_CI_WORKSPACE}" \
    -w "${MARLOTH_CI_WORKSPACE}" \
    "${MARLOTH_CI_IMAGE}" \
    bash -c 'bun install --frozen-lockfile && bun run --filter tome-static-site test && bun run web:build'
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
