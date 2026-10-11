#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
# MicroPython (ports/webassembly) -> wasm from the pinned v1.29.0 release tarball (D6: the default Python),
# plus our user C modules from python/modules/ (unmodified upstream tree; USER_C_MODULES).
#   python/build-micropython.sh [dev|release]      (default: dev)
#   dev      local emsdk (~/emsdk), fast iteration -> python/_out/dev/micropython.{mjs,wasm}
#   release  Debian trixie's emscripten in the pinned container, as the engine (P2) -> python/_out/release/
# Env: PASCALINE_PY_DL_DIR (tarball cache, default python/_downloads), VARIANT (default standard), JOBS (default 8),
#      NO_LOCK=1 (caller holds the host-cpu lock), CONTAINER_ENGINE (default podman), KEEP_SCRATCH=1.
# Safety: the container only ever sees a scratch copy; the :Z mount relabels files for SELinux, so never mount the checkout.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
MODE="${1:-dev}"
VARIANT="${VARIANT:-standard}"
JOBS="${JOBS:-8}"
CE="${CONTAINER_ENGINE:-podman}"
DL="${PASCALINE_PY_DL_DIR:-$HERE/_downloads}"

# Pins. Tag v1.29.0 = commit 0fd6c573ea815774668bbb16b8e197c8822368b2. The release tarball already contains all submodules.
VERSION=1.29.0
TARBALL="micropython-$VERSION.tar.xz"
URL="https://micropython.org/resources/source/$TARBALL"
SHA256=d925a7c664e79a2bdf3dfcb285ba5e2237041cc35a0bd4ee573b6c5711efeca0
# Same container pins as engine/giac/build-wasm-release.sh (keep both in step).
IMAGE="docker.io/library/debian@sha256:913f6706df59a68922d1dd08f78c2476560a8d367897200a6005b00e5f67c2d5"
EMSCRIPTEN_PKG_VERSION="3.1.69+dfsg-3"

mkdir -p "$DL"
if [[ ! -f "$DL/$TARBALL" ]]; then
  curl -fL --retry 3 -o "$DL/$TARBALL.part" "$URL"
  mv -f "$DL/$TARBALL.part" "$DL/$TARBALL"
fi
echo "$SHA256  $DL/$TARBALL" | sha256sum -c - >&2 || { echo "SHA-256 mismatch for $TARBALL" >&2; exit 1; }

# The build steps, run inside a work dir that holds a copy of the tarball (also written to the container as a script).
STEPS='
set -euo pipefail
tar -xJf "$W/$TARBALL" -C "$W"
SRC="$W/micropython-$VERSION"
make -C "$SRC/mpy-cross" -j"$JOBS"
make -C "$SRC/ports/webassembly" -j"$JOBS" VARIANT="$VARIANT" USER_C_MODULES="$W/modules"
'

OUT="$HERE/_out/$MODE"
mkdir -p "$OUT"
LOCK="$ROOT/tools/devlock.sh"
SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/pascaline-mp.XXXXXX")"
cleanup() {
  [[ "${NO_LOCK:-0}" == 1 ]] || "$LOCK" release host-cpu annabell-py >/dev/null 2>&1 || true
  if [[ "${KEEP_SCRATCH:-0}" == 1 ]]; then echo "scratch kept: $SCRATCH" >&2; else "$CE" unshare rm -rf "$SCRATCH" 2>/dev/null || rm -rf "$SCRATCH"; fi
}
trap cleanup EXIT
[[ "${NO_LOCK:-0}" == 1 ]] || "$LOCK" acquire host-cpu annabell-py 1800 >&2
mkdir -p "$SCRATCH/w"
cp "$DL/$TARBALL" "$SCRATCH/w/"
# Our user C modules (python/modules/: `_host`, the synchronous calc bridge) are built into the port.
cp -r "$HERE/modules" "$SCRATCH/w/modules"

case "$MODE" in
  dev)
    # EMSDK_DIR=system: emcc already on PATH (the F-Droid build VM installs Debian's emscripten package)
    if [[ "${EMSDK_DIR:-$HOME/emsdk}" == system ]]; then
      command -v emcc >/dev/null || { echo "EMSDK_DIR=system but no emcc on PATH" >&2; exit 1; }
    else
      # shellcheck disable=SC1091
      source "${EMSDK_DIR:-$HOME/emsdk}/emsdk_env.sh" >/dev/null 2>&1
    fi
    W="$SCRATCH/w" VERSION="$VERSION" TARBALL="$TARBALL" VARIANT="$VARIANT" JOBS="$JOBS" bash -c "$STEPS" >&2
    ;;
  release)
    "$CE" run --rm --security-opt seccomp=unconfined -v "$SCRATCH/w:/w:Z" \
      -e W=/w -e VERSION="$VERSION" -e TARBALL="$TARBALL" -e VARIANT="$VARIANT" -e JOBS="$JOBS" -e STEPS="$STEPS" \
      -e EMSCRIPTEN_PKG_VERSION="$EMSCRIPTEN_PKG_VERSION" \
      "$IMAGE" bash -euxc '
      export DEBIAN_FRONTEND=noninteractive
      apt-get update -qq
      apt-get install -y -qq emscripten="$EMSCRIPTEN_PKG_VERSION" make gcc g++ xz-utils python3 pkg-config libffi-dev ca-certificates >/dev/null
      emcc --version | head -1
      setarch "$(uname -m)" -R bash -c "$STEPS"
    ' >&2
    ;;
  *) echo "usage: $0 [dev|release]" >&2; exit 2 ;;
esac
B="$SCRATCH/w/micropython-$VERSION/ports/webassembly/build-$VARIANT"
cp "$B/micropython.mjs" "$B/micropython.wasm" "$OUT/"
(cd "$OUT" && sha256sum micropython.mjs micropython.wasm | tee SHA256SUMS)
echo "micropython $VERSION ($MODE, $VARIANT) -> $OUT"
