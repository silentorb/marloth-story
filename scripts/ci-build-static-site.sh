#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MARLOTH_CI_IMAGE="${MARLOTH_CI_IMAGE:-marloth-ci:local}"
MARLOTH_CI_WORKSPACE="${MARLOTH_CI_WORKSPACE:-/workspaces/marloth-story}"

usage() {
  cat <<EOF
Usage: ci-build-static-site.sh [--run-only | -h | --help]

Build the static site the same way GitHub Actions does.

NOTE: Static site packages now live in the sibling tome repo. This script
requires a Phase 2 update (checkout tome alongside marloth). Use
silentorb-workbench scripts/ci-build-static-site.sh for devcontainer CI parity.

  (default)   docker build + docker run
  --run-only  docker run only (CI after build-push-action)
EOF
}

require_docker() {
  if ! command -v docker >/dev/null 2>&1; then
    echo "docker not found on PATH." >&2
    exit 1
  fi
}

build_image() {
  echo "Building devcontainer image → ${MARLOTH_CI_IMAGE}"
  docker build -f "${ROOT}/.devcontainer/Dockerfile" -t "${MARLOTH_CI_IMAGE}" "${ROOT}"
}

run_build() {
  echo "ERROR: marloth-only static site CI requires the tome repo (Phase 2)." >&2
  echo "Use silentorb-workbench with both repos mounted, or update this script to checkout tome." >&2
  exit 1
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
