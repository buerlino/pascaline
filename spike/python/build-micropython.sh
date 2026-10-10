#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
# Build MicroPython ports/webassembly from a pinned release with the repo's emsdk.
# Output: spike/python/_out/micropython.{mjs,wasm}   (VARIANT=standard default)
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TAG=v1.29.0
COMMIT=0fd6c573ea815774668bbb16b8e197c8822368b2
VARIANT="${VARIANT:-standard}"
SRC="$HERE/_build/micropython"
if [ ! -d "$SRC" ]; then
  git clone --depth 1 --branch "$TAG" https://github.com/micropython/micropython "$SRC"
fi
[ "$(git -C "$SRC" rev-parse HEAD)" = "$COMMIT" ] || { echo "unexpected commit"; exit 1; }
# shellcheck disable=SC1091
source "$HOME/emsdk/emsdk_env.sh" >/dev/null 2>&1
make -C "$SRC/mpy-cross" -j8
make -C "$SRC/ports/webassembly" submodules
make -C "$SRC/ports/webassembly" -j8 VARIANT="$VARIANT"
mkdir -p "$HERE/_out/$VARIANT"
cp "$SRC/ports/webassembly/build-$VARIANT/micropython.mjs" "$SRC/ports/webassembly/build-$VARIANT/micropython.wasm" "$HERE/_out/$VARIANT/"
ls -l "$HERE/_out/$VARIANT"
