#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
# A42: the engine the APK carries (engine/giac/_out/release, pinned trixie container, P2) through the gates the dev engine passes:
# the golden gate, the canaries, the core list. One line per stage, last line RELEASE GATE PASSED or RELEASE GATE FAILED: <stages>.
#   tools/release-gate.sh [--dry-run] [--no-build]
# The release engine is rebuilt (engine/giac/build-wasm-release.sh, which takes host-cpu itself) unless _out/release carries a stamp
# equal to the current key (build-wasm.sh, patches, wasm/, and the release script with its pins). This script holds host-cpu around the
# heavy stages (golden, core); the build holds it by itself. GIAC_OUT, when set, must be this checkout's _out/release.
# Env: PASCALINE_DL_DIR (default: the main checkout's engine/giac/_downloads), PW_PORT (default: a free port), logs in app/_out/release-gate/.
set -uo pipefail
export PASCALINE_LOCK_PID=$$
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MAIN="${REPO%%/.claude/worktrees/*}"
ENGINE="$REPO/engine/giac/_out/release"
DRY=0 BUILD=1
for a in "$@"; do case "$a" in --dry-run) DRY=1;; --no-build) BUILD=0;; *) echo "unknown option $a" >&2; exit 2;; esac; done
if [[ -n "${GIAC_OUT:-}" && "${GIAC_OUT%/}" != "$ENGINE" ]]; then
  echo "release-gate: GIAC_OUT=$GIAC_OUT is not the release build ($ENGINE)" >&2; exit 2
fi
export GIAC_OUT="$ENGINE"
export PASCALINE_DL_DIR="${PASCALINE_DL_DIR:-$MAIN/engine/giac/_downloads}"

key() {
  { git -C "$REPO" ls-tree -r HEAD -- engine/giac/build-wasm.sh engine/giac/build-wasm-release.sh engine/giac/patches engine/giac/wasm | grep -v 'patches/README.md'; } | sha256sum | cut -c1-16
}
free_port() { node -e 'const s=require("net").createServer().listen(0,()=>{console.log(s.address().port);s.close()})'; }

if (( DRY )); then
  echo "STAGE build   engine/giac/build-wasm-release.sh -> $ENGINE unless its .release-key is $(key)"
  echo "STAGE golden  (cd app && GIAC_OUT=$ENGINE npm run golden) under host-cpu"
  echo "STAGE canaries GIAC_OUT=$ENGINE node tests/engine/canaries.mjs"
  echo "STAGE core    (cd app && GIAC_OUT=$ENGINE PW_PORT=<free> npm run test:core) under host-cpu"
  echo "RELEASE GATE: DRY RUN"; exit 0
fi

LOGS="$REPO/app/_out/release-gate"; mkdir -p "$LOGS"
failed=()
stage() { # stage <name> <log> <cmd...>
  local name="$1" log="$LOGS/$2.log" t=$SECONDS rc=0; shift 2
  timeout -k 60 3600 "$@" > "$log" 2>&1 || rc=$?
  if (( rc == 0 )); then echo "PASS $name ($((SECONDS - t)) s) $(tail -n1 "$log" | cut -c1-120)"
  else echo "FAIL $name (exit $rc, $((SECONDS - t)) s) $(tail -n1 "$log" | cut -c1-120); log $log"; failed+=("$name"); fi
}

k="$(key)"
if (( BUILD )) && [[ ! -f "$ENGINE/giac.wasm" || "$(cat "$ENGINE/.release-key" 2>/dev/null)" != "$k" ]]; then
  stage build build "$REPO/engine/giac/build-wasm-release.sh" && [[ ${#failed[@]} -eq 0 ]] && echo "$k" > "$ENGINE/.release-key"
else echo "SKIP build (stamp $k matches)"; fi
[[ -f "$ENGINE/giac.wasm" ]] || { echo "RELEASE GATE FAILED: build (no $ENGINE/giac.wasm)"; exit 1; }
echo "engine: $(cd "$ENGINE" && sha256sum giac.wasm | cut -c1-16) emscripten-release"

cd "$REPO/app" || exit 1
"$REPO/tools/devlock.sh" acquire host-cpu release-gate 1800 >/dev/null || { echo "RELEASE GATE FAILED: host-cpu lock busy"; exit 1; }
trap '"$REPO/tools/devlock.sh" release host-cpu release-gate >/dev/null 2>&1 || true' EXIT
stage golden golden npm run golden
stage canaries canaries node "$REPO/tests/engine/canaries.mjs"
stage core core env PW_PORT="${PW_PORT:-$(free_port)}" npm run test:core

if (( ${#failed[@]} == 0 )); then echo "RELEASE GATE PASSED"; exit 0; fi
echo "RELEASE GATE FAILED: ${failed[*]}"; exit 1
