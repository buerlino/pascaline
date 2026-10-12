#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
#
# libqalculate + libxml2 + GMP + MPFR -> WebAssembly, from pinned, SHA-256-checked sources (P3, P8; docs/04 7.1).
# Promoted from the P3 spike. Milestone 4 builds it for the Find index (constant values and unit factors, run in Node);
# the worker and the Units app that load it in the browser are milestone 5.
#
#   engine/qalc/build-wasm.sh [dev|release] [stage...]      (default: dev; stages: fetch gmp mpfr xml2 qalc link)
#   dev      local emsdk (~/emsdk, 6.0.12), fast iteration            -> engine/qalc/_out/dev/qalc.{mjs,wasm}
#   release  Debian trixie's emscripten in the pinned container (P2)  -> engine/qalc/_out/release/qalc.{mjs,wasm} + SHA256SUMS
#
# Env: PASCALINE_DL_DIR (GMP/MPFR tarballs shared with Giac, default engine/giac/_downloads),
#      PASCALINE_QALC_DL_DIR (libxml2 and libqalculate tarballs, default engine/qalc/_downloads, gitignored),
#      QALC_WORK (dev build tree, default engine/qalc/_work, gitignored; keep it under /home), JOBS (default 8),
#      EMSDK_DIR (default ~/emsdk; "system" = an emcc already on PATH, for the F-Droid VM),
#      NO_LOCK=1 (the caller holds the host-cpu lock), CONTAINER_ENGINE (default podman), KEEP_SCRATCH=1.
# Reproducible output: like the Giac engine, the release build runs under `setarch -R` (ASLR off) with the default seccomp
# profile relaxed for personality(); two release builds give the same qalc.wasm (measured, see the A2 report).
# Safety: the container only ever sees scratch copies of engine/qalc and of the tarballs. The :Z mount relabels files for
# SELinux, so it must never touch the checkout or the download caches.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
MODE="${1:-dev}"; shift || true
JOBS="${JOBS:-8}"
CE="${CONTAINER_ENGINE:-podman}"
WORK="${QALC_WORK:-$HERE/_work}"
DL="${PASCALINE_QALC_DL_DIR:-$HERE/_downloads}"
GMPDL="${PASCALINE_DL_DIR:-$REPO/engine/giac/_downloads}"
BUILD="$WORK/build"
PREFIX="$BUILD/prefix"
export TMPDIR="$WORK/tmp"

# Same GMP/MPFR as the Giac engine (engine/giac/build-wasm.sh); keep both in step.
GMP_VERSION="6.3.0";  GMP_SHA256="a3c2b80201b89e68616f4ad30bc66aee4927c3ce50e33929ca819d5c43538898"
MPFR_VERSION="4.2.2"; MPFR_SHA256="b67ba0383ef7e8a8563734e2e889ef5ec3c3b898a01d00fa0a6869ad81c6ce01"
# libxml2: hash matches upstream's libxml2-2.15.1.sha256sum on download.gnome.org.
XML2_VERSION="2.15.1"
XML2_URL="https://download.gnome.org/sources/libxml2/2.15/libxml2-$XML2_VERSION.tar.xz"
XML2_SHA256="c008bac08fd5c7b4a87f7b8a71f283fa581d80d80ff8d2efd3b26224c39bc54c"
# libqalculate: release tarball from GitHub (no upstream hash published; pinned at first download, 2026-10-11).
QALC_VERSION="5.13.1"
QALC_URL="https://github.com/Qalculate/libqalculate/releases/download/v$QALC_VERSION/libqalculate-$QALC_VERSION.tar.gz"
QALC_SHA256="cf8d3eaf3d85030115701e997b6585e69573e71add88e7758486c5d1b01d3cc3"

# Same container pins as engine/giac/build-wasm-release.sh and python/build-micropython.sh (keep all three in step).
IMAGE="docker.io/library/debian@sha256:913f6706df59a68922d1dd08f78c2476560a8d367897200a6005b00e5f67c2d5"
EMSCRIPTEN_PKG_VERSION="3.1.69+dfsg-3"

EMSDK_DIR="${EMSDK_DIR:-$HOME/emsdk}"
EMSDK_VERSION="6.0.12"

log() { printf '\n==> %s\n' "$*" >&2; }

emsdk_env() {
  if [[ "$EMSDK_DIR" == system ]]; then
    command -v emcc >/dev/null || { echo "EMSDK_DIR=system but no emcc on PATH" >&2; exit 1; }
    echo "using system emcc $(emcc --version | head -1) (pinned: $EMSDK_VERSION)" >&2
    return
  fi
  # shellcheck disable=SC1091
  source "$EMSDK_DIR/emsdk_env.sh" >/dev/null 2>&1
  local v; v="$(emcc --version | head -1 | sed -E 's/.* ([0-9]+\.[0-9]+\.[0-9]+).*/\1/')"
  [[ "$v" == "$EMSDK_VERSION" ]] || { echo "emcc $v found, $EMSDK_VERSION required" >&2; exit 1; }
}

check() { echo "$1  $2" | sha256sum -c --quiet - || { echo "SHA-256 mismatch: $2" >&2; exit 1; }; }

fetch_one() { # sha256 url
  local f="$DL/${2##*/}"
  mkdir -p "$DL"
  if [[ ! -f "$f" ]]; then curl -fSL --retry 3 -o "$f.part" "$2"; mv -f "$f.part" "$f"; fi
  check "$1" "$f"
}

stage_fetch() {
  log "fetch"
  check "$GMP_SHA256" "$GMPDL/gmp-$GMP_VERSION.tar.xz"
  check "$MPFR_SHA256" "$GMPDL/mpfr-$MPFR_VERSION.tar.xz"
  fetch_one "$XML2_SHA256" "$XML2_URL"
  fetch_one "$QALC_SHA256" "$QALC_URL"
}

unpack() { rm -rf "$2"; mkdir -p "$(dirname "$2")"; tar -xf "$1" -C "$(dirname "$2")"; }

stage_gmp() {
  log "gmp $GMP_VERSION"
  local src="$BUILD/gmp-$GMP_VERSION"
  unpack "$GMPDL/gmp-$GMP_VERSION.tar.xz" "$src"
  (cd "$src" && emconfigure ./configure --build=none --host=none --disable-assembly --enable-cxx=no \
      --disable-shared --enable-static --prefix="$PREFIX" CFLAGS="-O2" && emmake make -j"$JOBS" && emmake make install) \
      > "$BUILD/gmp.log" 2>&1
}

stage_mpfr() {
  log "mpfr $MPFR_VERSION"
  local src="$BUILD/mpfr-$MPFR_VERSION"
  unpack "$GMPDL/mpfr-$MPFR_VERSION.tar.xz" "$src"
  (cd "$src" && emconfigure ./configure --build=none --host=none --disable-assembly \
      --disable-shared --enable-static --prefix="$PREFIX" --with-gmp="$PREFIX" CFLAGS="-O2" \
      && emmake make -j"$JOBS" && emmake make install) > "$BUILD/mpfr.log" 2>&1
}

stage_xml2() {
  log "libxml2 $XML2_VERSION"
  local src="$BUILD/libxml2-$XML2_VERSION"
  unpack "$DL/libxml2-$XML2_VERSION.tar.xz" "$src"
  # Only the parser + tree API is needed (libqalculate reads its definitions with it). UTF-8 only, so no iconv.
  (cd "$src" && emconfigure ./configure --host=wasm32-unknown-emscripten --disable-shared --enable-static \
      --prefix="$PREFIX" --without-python --without-zlib --without-iconv --without-icu \
      --without-http --without-threads --without-modules --without-debug --without-readline \
      --without-history --without-catalog --without-schematron --without-schemas \
      --without-relaxng --without-xinclude --without-c14n --without-xptr --without-valid CFLAGS="-Oz" \
      && emmake make -j"$JOBS" && emmake make install) > "$BUILD/xml2.log" 2>&1
}

stage_qalc() {
  log "libqalculate $QALC_VERSION"
  local src="$BUILD/libqalculate-$QALC_VERSION"
  unpack "$DL/libqalculate-$QALC_VERSION.tar.gz" "$src"
  # Definitions compiled in (no files to load at run time); no curl, icu, readline, NLS, external commands.
  (cd "$src" && LIBXML_CFLAGS="-I$PREFIX/include/libxml2" LIBXML_LIBS="-L$PREFIX/lib -lxml2" \
      emconfigure ./configure --host=wasm32-unknown-emscripten --disable-shared --enable-static \
      --prefix="$PREFIX" --enable-compiled-definitions --disable-textport --disable-nls \
      --disable-insecure --without-libcurl --without-icu --without-gnuplot-call --without-readline \
      CPPFLAGS="-I$PREFIX/include" LDFLAGS="-L$PREFIX/lib" CXXFLAGS="-Oz" CFLAGS="-Oz" \
      && emmake make -j"$JOBS" && emmake make install) > "$BUILD/qalc.log" 2>&1
}

stage_link() {
  log "link"
  mkdir -p "$WORK/out"
  em++ -Oz -std=c++17 -I"$PREFIX/include" -I"$PREFIX/include/libxml2" -c "$HERE/glue.cc" -o "$BUILD/glue.o"
  em++ -Oz "$BUILD/glue.o" "$PREFIX/lib/libqalculate.a" "$PREFIX/lib/libxml2.a" \
      "$PREFIX/lib/libmpfr.a" "$PREFIX/lib/libgmp.a" \
      -sMODULARIZE=1 -sEXPORT_ES6=1 -sENVIRONMENT=web,worker,node -sALLOW_MEMORY_GROWTH=1 \
      -sEXPORTED_FUNCTIONS=_qalc_init,_qalc_calc,_qalc_set_precision,_qalc_parse,_qalc_print,_qalc_eval -sEXPORTED_RUNTIME_METHODS=ccall,cwrap \
      -fexceptions -o "$WORK/out/qalc.mjs"
  ls -l "$WORK/out" >&2
}

# All stages (or the named ones) on the local toolchain; the result is in $WORK/out.
build_here() {
  local stages=("$@")
  [[ ${#stages[@]} -gt 0 ]] || stages=(fetch gmp mpfr xml2 qalc link)
  mkdir -p "$BUILD" "$TMPDIR"
  emsdk_env
  local s
  for s in "${stages[@]}"; do "stage_$s"; done
}

publish() { # <mode>: copy $WORK/out to _out/<mode> and print checksums
  local out="$HERE/_out/$1"
  mkdir -p "$out"
  cp "$WORK/out/qalc.mjs" "$WORK/out/qalc.wasm" "$out/"
  (cd "$out" && sha256sum qalc.mjs qalc.wasm | tee SHA256SUMS)
  echo "libqalculate $QALC_VERSION ($1) -> $out" >&2
}

LOCK="$REPO/tools/devlock.sh"
take_lock() { [[ "${NO_LOCK:-0}" == 1 ]] || "$LOCK" acquire host-cpu annabell-qalc 1800 >&2; }
drop_lock() { [[ "${NO_LOCK:-0}" == 1 ]] || "$LOCK" release host-cpu annabell-qalc >/dev/null 2>&1 || true; }

case "$MODE" in
  dev)
    take_lock; trap drop_lock EXIT
    build_here "$@"
    publish dev
    ;;
  inner)
    # Used inside the release container only: build in the scratch copy, no lock, no publish.
    build_here "$@"
    ;;
  release)
    [[ -d "$GMPDL" ]] || { echo "no download cache at $GMPDL (set PASCALINE_DL_DIR)" >&2; exit 1; }
    SCRATCH="$(mktemp -d "/tmp/pascaline-qalc.XXXXXX")"
    cleanup() {
      drop_lock
      if [[ "${KEEP_SCRATCH:-0}" == 1 ]]; then echo "scratch kept: $SCRATCH" >&2; else "$CE" unshare rm -rf "$SCRATCH" 2>/dev/null || rm -rf "$SCRATCH"; fi
    }
    trap cleanup EXIT
    take_lock
    # Fetch (SHA-256 checked) on the host; the container needs the network only for apt.
    stage_fetch
    mkdir -p "$SCRATCH/src" "$SCRATCH/dl" "$SCRATCH/qdl"
    (cd "$REPO" && tar --exclude=engine/qalc/_out --exclude=engine/qalc/_work --exclude=engine/qalc/_downloads -cf - engine/qalc) | tar -xf - -C "$SCRATCH/src"
    cp "$GMPDL/gmp-$GMP_VERSION.tar.xz" "$GMPDL/mpfr-$MPFR_VERSION.tar.xz" "$SCRATCH/dl/"
    cp "$DL/libxml2-$XML2_VERSION.tar.xz" "$DL/libqalculate-$QALC_VERSION.tar.gz" "$SCRATCH/qdl/"
    "$CE" run --rm --security-opt seccomp=unconfined -v "$SCRATCH/src:/src:Z" -v "$SCRATCH/dl:/dl:ro,Z" -v "$SCRATCH/qdl:/qdl:ro,Z" \
      -e PASCALINE_DL_DIR=/dl -e PASCALINE_QALC_DL_DIR=/qdl -e QALC_WORK=/src/engine/qalc/_work -e EMSDK_DIR=system \
      -e JOBS="$JOBS" -e EMSCRIPTEN_PKG_VERSION="$EMSCRIPTEN_PKG_VERSION" \
      "$IMAGE" bash -euxc '
      export DEBIAN_FRONTEND=noninteractive
      apt-get update -qq
      apt-get install -y -qq emscripten="$EMSCRIPTEN_PKG_VERSION" patch make gcc g++ curl xz-utils bzip2 m4 perl pkg-config ca-certificates python3 >/dev/null
      emcc --version | head -1
      cd /src
      setarch "$(uname -m)" -R engine/qalc/build-wasm.sh inner
    ' >&2
    WORK="$SCRATCH/src/engine/qalc/_work"
    publish release
    echo "release qalc: emscripten $EMSCRIPTEN_PKG_VERSION, $IMAGE" >&2
    ;;
  *) echo "usage: $0 [dev|release] [stage...]" >&2; exit 2 ;;
esac
