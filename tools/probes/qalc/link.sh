#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
# Builds the qalc probe (probe.cc) against the static libraries of a P3 spike build (spike/qalc/build-wasm.sh),
# for Node only. Output: tools/probes/_out/qalc/qprobe.{mjs,wasm} (gitignored). Takes the host-cpu lock.
#   tools/probes/qalc/link.sh                         # prefix: $QALC_PREFIX, else $QALC_WORK/build/prefix,
#                                                     #         else ../pascaline-deps/qalc-spike/build/prefix
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/../../.." && pwd)"
PREFIX="${QALC_PREFIX:-${QALC_WORK:+$QALC_WORK/build/prefix}}"
PREFIX="${PREFIX:-$REPO/../pascaline-deps/qalc-spike/build/prefix}"
OUT="$REPO/tools/probes/_out/qalc"
[[ -f "$PREFIX/lib/libqalculate.a" ]] || { echo "no libqalculate.a under $PREFIX: run spike/qalc/build-wasm.sh first" >&2; exit 1; }
mkdir -p "$OUT/tmp"
# shellcheck disable=SC1091
source "${EMSDK_DIR:-$HOME/emsdk}/emsdk_env.sh" >/dev/null 2>&1
export TMPDIR="$OUT/tmp"
"$REPO/tools/devlock.sh" acquire host-cpu "${LOCK_OWNER:-probe}" 900
trap '"$REPO/tools/devlock.sh" release host-cpu "${LOCK_OWNER:-probe}"' EXIT
timeout 900 em++ -Oz -std=c++17 -I"$PREFIX/include" -I"$PREFIX/include/libxml2" -c "$HERE/probe.cc" -o "$OUT/probe.o"
timeout 900 em++ -O1 "$OUT/probe.o" "$PREFIX/lib/libqalculate.a" "$PREFIX/lib/libxml2.a" "$PREFIX/lib/libmpfr.a" "$PREFIX/lib/libgmp.a" \
  -sMODULARIZE=1 -sEXPORT_ES6=1 -sENVIRONMENT=node -sALLOW_MEMORY_GROWTH=1 \
  -sEXPORTED_FUNCTIONS=_qp_init,_qp -sEXPORTED_RUNTIME_METHODS=cwrap -fexceptions -o "$OUT/qprobe.mjs"
ls -l "$OUT"
