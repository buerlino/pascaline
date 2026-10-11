#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
# Build our APK for a device with the existing dev engine (a thin wrapper over ./build.sh):
#
#   tools/device-build.sh [--measure] [--no-python] [--install] [--serial S] [--engine-dir DIR]
#
# Engine: --engine-dir, else $GIAC_OUT, else the main checkout's engine/giac/_out/gsl (works from a worktree).
# Signed with the throwaway key in android/_keys/ (gitignored). --install runs `adb install -r` for
# org.pascaline.app only (never other apps); annabell only. --measure adds the timing marks (never for release).
# Output: prints the APK path on the last line (dist/pascaline.apk). build.sh takes the host-cpu lock.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MAIN="${REPO%%/.claude/worktrees/*}"
export PASCALINE_DL_DIR="${PASCALINE_DL_DIR:-$MAIN/engine/giac/_downloads}"
ENGINE="${GIAC_OUT:-$MAIN/engine/giac/_out/gsl}"
ARGS=() SERIAL="${ANDROID_SERIAL:-}" INSTALL=0
while (( $# )); do
  case "$1" in
    --measure) ARGS+=(--measure); shift ;;
    --no-python) ARGS+=(--no-python); shift ;;
    --install) INSTALL=1; shift ;;
    --serial) SERIAL="$2"; shift 2 ;;
    --engine-dir) ENGINE="$2"; shift 2 ;;
    *) echo "unknown option $1" >&2; exit 2 ;;
  esac
done
if (( INSTALL )); then
  ARGS+=(--install)
  [[ -n "$SERIAL" ]] && ARGS+=("$SERIAL")
fi
exec "$REPO/build.sh" --engine-dir "$ENGINE" "${ARGS[@]}"
