#!/usr/bin/env bash
set -euo pipefail

VERSION="0.1.0"
PACKAGE="@talocode/gatelane"
NPM_REGISTRY="https://registry.npmjs.org"

print_usage() {
  cat <<EOF
GateLane Installer v${VERSION}

Usage: install.sh [options]

Options:
  --version           Print version and exit
  --help              Print this help and exit
  --local FILE        Install from local .tgz file
  --npm               Install via npm (default)
  --global            Install globally (default)
  --prefix DIR        npm install prefix

Examples:
  curl -fsSL https://talocode.site/install/gatelane | bash
  ./install.sh --local ./talocode-gatelane-${VERSION}.tgz
  ./install.sh --prefix /usr/local
EOF
}

install_via_npm() {
  echo "Installing ${PACKAGE}@${VERSION} via npm..."

  if ! command -v node &>/dev/null; then
    echo "Error: Node.js is required. Install from https://nodejs.org" >&2
    exit 1
  fi

  if ! command -v npm &>/dev/null; then
    echo "Error: npm is required." >&2
    exit 1
  fi

  local npm_args=("install" "-g" "${PACKAGE}@${VERSION}")
  if [ -n "${PREFIX:-}" ]; then
    npm_args=("install" "--prefix" "$PREFIX" "${PACKAGE}@${VERSION}")
  fi

  npm "${npm_args[@]}"

  echo ""
  echo "GateLane v${VERSION} installed successfully!"
  echo "Run 'gatelane --help' to get started."
}

install_local() {
  local tarball="$1"

  if [ ! -f "$tarball" ]; then
    echo "Error: File not found: $tarball" >&2
    exit 1
  fi

  echo "Installing from local tarball: $tarball"

  local npm_args=("install" "-g" "$tarball")
  if [ -n "${PREFIX:-}" ]; then
    npm_args=("install" "--prefix" "$PREFIX" "$tarball")
  fi

  npm "${npm_args[@]}"

  echo ""
  echo "GateLane v${VERSION} installed successfully (local)!"
  echo "Run 'gatelane --help' to get started."
}

main() {
  local mode="npm"
  local tarball=""

  while [ $# -gt 0 ]; do
    case "$1" in
      --version) echo "v${VERSION}"; exit 0 ;;
      --help) print_usage; exit 0 ;;
      --local) mode="local"; tarball="$2"; shift ;;
      --npm) mode="npm" ;;
      --global) : ;;
      --prefix) PREFIX="$2"; shift ;;
      *) echo "Unknown option: $1"; print_usage; exit 1 ;;
    esac
    shift
  done

  case "$mode" in
    npm) install_via_npm ;;
    local) install_local "$tarball" ;;
  esac
}

main "$@"
