#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
#
# P3 spike: libqalculate + libxml2 + GMP + MPFR -> WebAssembly, from pinned, SHA-256-checked sources.
# Throwaway spike code (spike/RESULTS.md); not part of the app build.
#
#   spike/qalc/build-wasm.sh [stage...]        stages: fetch gmp mpfr xml2 qalc link (default: all)
#
# QALC_WORK   build tree + downloads + output (default spike/qalc/_work, gitignored). Keep it under /home.
# PASCALINE_DL_DIR  where the GMP/MPFR tarballs already are (default: engine/giac/_downloads of this checkout).
# Output: $QALC_WORK/out/qalc.{mjs,wasm}
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
WORK="${QALC_WORK:-$HERE/_work}"
DL="$WORK/dl"
GMPDL="${PASCALINE_DL_DIR:-$REPO/engine/giac/_downloads}"
BUILD="$WORK/build"
OUT="$WORK/out"
PREFIX="$BUILD/prefix"
JOBS="${JOBS:-$(nproc)}"
export TMPDIR="$WORK/tmp"

# Same GMP/MPFR as the Giac engine (engine/giac/build-wasm.sh).
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

EMSDK_DIR="${EMSDK_DIR:-$HOME/emsdk}"
EMSDK_VERSION="6.0.12"

log() { printf '\n==> %s\n' "$*"; }

emsdk_env() {
  # shellcheck disable=SC1091
  source "$EMSDK_DIR/emsdk_env.sh" >/dev/null 2>&1
  local v; v="$(emcc --version | head -1 | sed -E 's/.* ([0-9]+\.[0-9]+\.[0-9]+).*/\1/')"
  [[ "$v" == "$EMSDK_VERSION" ]] || { echo "emcc $v found, $EMSDK_VERSION required" >&2; exit 1; }
}

check() { echo "$1  $2" | sha256sum -c --quiet - || { echo "SHA-256 mismatch: $2" >&2; exit 1; }; }

fetch_one() { # sha256 url
  local f="$DL/${2##*/}"
  mkdir -p "$DL"
  [[ -f "$f" ]] || curl -fSL --retry 3 -o "$f" "$2"
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
  mkdir -p "$OUT"
  em++ -Oz -std=c++17 -I"$PREFIX/include" -I"$PREFIX/include/libxml2" -c "$HERE/glue.cc" -o "$BUILD/glue.o"
  em++ -Oz "$BUILD/glue.o" "$PREFIX/lib/libqalculate.a" "$PREFIX/lib/libxml2.a" \
      "$PREFIX/lib/libmpfr.a" "$PREFIX/lib/libgmp.a" \
      -sMODULARIZE=1 -sEXPORT_ES6=1 -sENVIRONMENT=web,worker,node -sALLOW_MEMORY_GROWTH=1 \
      -sEXPORTED_FUNCTIONS=_qalc_init,_qalc_calc -sEXPORTED_RUNTIME_METHODS=ccall,cwrap \
      -fexceptions -o "$OUT/qalc.mjs"
  ls -l "$OUT"
}

main() {
  local stages=("$@")
  [[ ${#stages[@]} -gt 0 ]] || stages=(fetch gmp mpfr xml2 qalc link)
  mkdir -p "$BUILD" "$TMPDIR"
  emsdk_env
  local s
  for s in "${stages[@]}"; do "stage_$s"; done
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then main "$@"; fi
