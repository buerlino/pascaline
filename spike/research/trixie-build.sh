#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
# Build the Giac wasm with Debian trixie's apt `emscripten` (what F-Droid recipes use), in a Podman container.
# usage: trixie-build.sh <dir containing engine/giac from the branch to test> <download cache dir>
# Takes the host-cpu lock by hand: run `spike/tools/devlock.sh acquire host-cpu sandra` first.
# The mounts use :Z (SELinux relabel), so pass a scratch copy (git archive of engine/giac + spike/{node,home,solve}, plus a copy of the tarballs), not the main checkout or _downloads/. Files written by the container belong to its root user: clean up with `podman unshare rm -rf`.
set -euo pipefail
SRC="${1:?dir with engine/giac}"
DL="${2:?download cache (engine/giac/_downloads)}"
podman run --rm -v "$SRC:/src:Z" -v "$DL:/dl:ro,Z" -e PASCALINE_DL_DIR=/dl -e EMSDK_DIR=system -e JOBS=8 docker.io/library/debian:trixie bash -euxc '
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq
  apt-get install -y -qq emscripten patch make gcc g++ curl xz-utils bzip2 m4 perl pkg-config ca-certificates python3 >/dev/null
  emcc --version | head -1
  cd /src
  engine/giac/build-wasm.sh
'
