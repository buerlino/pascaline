#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
# Release engine build (decision P2): Giac + GSL + GMP + MPFR -> wasm with Debian trixie's `emscripten`
# package, in a pinned container. Every release channel ships this build; emsdk (build-wasm.sh) is for development.
# usage: engine/giac/build-wasm-release.sh            -> engine/giac/_out/release/giac.{mjs,wasm}
# Env: PASCALINE_DL_DIR (tarball cache, default engine/giac/_downloads), JOBS (default 8),
#      NO_LOCK=1 (caller holds the host-cpu lock), CONTAINER_ENGINE (default podman).
# Safety: the container only ever sees scratch copies of engine/giac and of the tarballs. The :Z mount relabels
# files for SELinux, so it must never touch the checkout or _downloads/.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
CE="${CONTAINER_ENGINE:-podman}"
DL="${PASCALINE_DL_DIR:-$HERE/_downloads}"
JOBS="${JOBS:-8}"

# Pins. Update both together, then re-run the golden gate.
# Index (multi-arch) digest of debian:trixie; the package version is what trixie ships.
IMAGE="docker.io/library/debian@sha256:913f6706df59a68922d1dd08f78c2476560a8d367897200a6005b00e5f67c2d5"
EMSCRIPTEN_PKG_VERSION="3.1.69+dfsg-3"

[[ -d "$DL" ]] || { echo "no download cache at $DL (set PASCALINE_DL_DIR)" >&2; exit 1; }
SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/pascaline-release.XXXXXX")"
cleanup() {
  [[ "${NO_LOCK:-0}" == 1 ]] || "$ROOT/spike/tools/devlock.sh" release host-cpu annabell >/dev/null 2>&1 || true
  "$CE" unshare rm -rf "$SCRATCH" 2>/dev/null || rm -rf "$SCRATCH"
}
trap cleanup EXIT
[[ "${NO_LOCK:-0}" == 1 ]] || "$ROOT/spike/tools/devlock.sh" acquire host-cpu annabell 1800

mkdir -p "$SCRATCH/src" "$SCRATCH/dl"
(cd "$ROOT" && tar --exclude=engine/giac/_out --exclude=engine/giac/_downloads -cf - engine/giac) | tar -xf - -C "$SCRATCH/src"
cp -a "$DL"/. "$SCRATCH/dl"/

"$CE" run --rm -v "$SCRATCH/src:/src:Z" -v "$SCRATCH/dl:/dl:ro,Z" \
  -e PASCALINE_DL_DIR=/dl -e EMSDK_DIR=system -e JOBS="$JOBS" -e EMSCRIPTEN_PKG_VERSION="$EMSCRIPTEN_PKG_VERSION" \
  "$IMAGE" bash -euxc '
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq
  apt-get install -y -qq emscripten="$EMSCRIPTEN_PKG_VERSION" patch make gcc g++ curl xz-utils bzip2 m4 perl pkg-config ca-certificates python3 >/dev/null
  emcc --version | head -1
  cd /src
  engine/giac/build-wasm.sh
'
OUT="$HERE/_out/release"
mkdir -p "$OUT"
cp "$SCRATCH/src/engine/giac/_out/gsl/giac.mjs" "$SCRATCH/src/engine/giac/_out/gsl/giac.wasm" "$OUT/"
(cd "$OUT" && sha256sum giac.mjs giac.wasm | tee SHA256SUMS)
echo "release engine -> $OUT (emscripten $EMSCRIPTEN_PKG_VERSION, $IMAGE)"
