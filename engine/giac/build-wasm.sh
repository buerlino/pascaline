#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
#
# Build Giac + GSL + GMP + MPFR to WebAssembly from pinned, hash-checked sources.
#
#   [WITH_GSL=0] engine/giac/build-wasm.sh [stage...]
#
# Stages: fetch gmp mpfr gsl giac link (default: all, gsl skipped with WITH_GSL=0)
# Output: engine/giac/_out/<variant>/giac.{mjs,wasm}; variant = gsl (default) | base (WITH_GSL=0, comparisons only)
# Needs: emsdk (EMSDK_DIR, default ~/emsdk) at $EMSDK_VERSION, or EMSDK_DIR=system for an emcc already on PATH (unpinned; F-Droid tests).
# PASCALINE_DL_DIR overrides the download cache (e.g. to share one cache between git worktrees).
# Nothing here touches the user's shell rc files.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DL="${PASCALINE_DL_DIR:-$HERE/_downloads}"
BUILD="$HERE/_build"
OUT="$HERE/_out"
PREFIX="$BUILD/prefix"
JOBS="${JOBS:-$(nproc)}"
WITH_GSL="${WITH_GSL:-1}"

EMSDK_DIR="${EMSDK_DIR:-$HOME/emsdk}"
EMSDK_VERSION="6.0.12"

GMP_VERSION="6.3.0"
GMP_URLS=("https://ftp.gnu.org/gnu/gmp/gmp-$GMP_VERSION.tar.xz")
GMP_SHA256="a3c2b80201b89e68616f4ad30bc66aee4927c3ce50e33929ca819d5c43538898"

MPFR_VERSION="4.2.2"
MPFR_URLS=("https://ftp.gnu.org/gnu/mpfr/mpfr-$MPFR_VERSION.tar.xz")
MPFR_SHA256="b67ba0383ef7e8a8563734e2e889ef5ec3c3b898a01d00fa0a6869ad81c6ce01"

# GSL gives Giac's fsolve its Brent/secant/Steffensen and Powell-hybrid (hybrids/hybridj) methods.
GSL_VERSION="2.8"
GSL_URLS=("https://ftp.gnu.org/gnu/gsl/gsl-$GSL_VERSION.tar.gz")
GSL_SHA256="6a99eeed15632c6354895b1dd542ed5a855c0f15d9ad1326c6fe2b2c9e423190"

# Upstream re-publishes giac-2.1.0.tar.gz in place, so the hash pins one snapshot. Our mirror
# (a GitHub release asset holding that exact file) comes first; upstream is the fallback and
# only works while upstream still serves the pinned snapshot. See engine/giac/README.md.
GIAC_VERSION="2.1.0"
GIAC_SHA256="1d9536e02ce6a336793ebf11c02b93f084e28af2350871914acafa60282b5a67"
GIAC_URLS=(
  "https://github.com/buerlino/pascaline/releases/download/deps-giac-$GIAC_VERSION-${GIAC_SHA256:0:8}/giac-$GIAC_VERSION.tar.gz"
  "https://www-fourier.univ-grenoble-alpes.fr/~parisse/giac/giac-$GIAC_VERSION.tar.gz"
)

log() { printf '\n==> %s\n' "$*"; }

emsdk_env() {
  local v
  if [[ "$EMSDK_DIR" == system ]]; then
    # Emscripten already on PATH (e.g. a distro package, as F-Droid's build server uses). Any version
    # is accepted, but it is not the pinned one, so the output is not the reference build.
    command -v emcc >/dev/null || { echo "EMSDK_DIR=system but no emcc on PATH" >&2; exit 1; }
    v="$(emcc --version | head -1 | sed -E 's/.* ([0-9]+\.[0-9]+\.[0-9]+).*/\1/')"
    echo "using system emcc $v (pinned: $EMSDK_VERSION)" >&2
    return 0
  fi
  # shellcheck disable=SC1091
  source "$EMSDK_DIR/emsdk_env.sh" >/dev/null 2>&1
  v="$(emcc --version | head -1 | sed -E 's/.* ([0-9]+\.[0-9]+\.[0-9]+).*/\1/')"
  if [[ "$v" != "$EMSDK_VERSION" ]]; then
    echo "emcc $v found, $EMSDK_VERSION required (cd $EMSDK_DIR && ./emsdk install $EMSDK_VERSION && ./emsdk activate $EMSDK_VERSION)" >&2
    exit 1
  fi
}

fetch_one() { # sha256 url... ; tries each url until one gives a file with the right hash
  local sha="$1"; shift
  local f="$DL/${1##*/}" url
  mkdir -p "$DL"
  if [[ -f "$f" ]]; then
    echo "$sha  $f" | sha256sum -c --quiet - && return 0
    echo "SHA-256 mismatch for cached $f" >&2
    exit 1
  fi
  for url in "$@"; do
    if curl -fSL --retry 3 -o "$f.part.$$" "$url" && echo "$sha  $f.part.$$" | sha256sum -c --quiet - 2>/dev/null; then
      mv "$f.part.$$" "$f"
      echo "fetched ${f##*/} from $url"
      return 0
    fi
    echo "no usable ${f##*/} at $url" >&2
    rm -f "$f.part.$$"
  done
  echo "could not fetch ${f##*/} with SHA-256 $sha" >&2
  exit 1
}

stage_fetch() {
  log "fetch"
  fetch_one "$GMP_SHA256" "${GMP_URLS[@]}"
  fetch_one "$MPFR_SHA256" "${MPFR_URLS[@]}"
  fetch_one "$GIAC_SHA256" "${GIAC_URLS[@]}"
  [[ "$WITH_GSL" != 1 ]] || fetch_one "$GSL_SHA256" "${GSL_URLS[@]}"
}

unpack() { # tarball dir
  rm -rf "$2"; mkdir -p "$(dirname "$2")"
  tar -xf "$1" -C "$(dirname "$2")"
}

stage_gmp() {
  log "gmp $GMP_VERSION"
  local src="$BUILD/gmp-$GMP_VERSION"
  unpack "$DL/gmp-$GMP_VERSION.tar.xz" "$src"
  (cd "$src" && emconfigure ./configure --build=none --host=none --disable-assembly \
      --disable-shared --enable-static --prefix="$PREFIX" CFLAGS="-O2" \
    && emmake make -j"$JOBS" && emmake make install)
}

stage_mpfr() {
  log "mpfr $MPFR_VERSION"
  local src="$BUILD/mpfr-$MPFR_VERSION"
  unpack "$DL/mpfr-$MPFR_VERSION.tar.xz" "$src"
  (cd "$src" && emconfigure ./configure --build=none --host=none --disable-assembly \
      --disable-shared --enable-static --prefix="$PREFIX" --with-gmp="$PREFIX" CFLAGS="-O2" \
    && emmake make -j"$JOBS" && emmake make install)
}

stage_gsl() {
  [[ "$WITH_GSL" == 1 ]] || return 0
  log "gsl $GSL_VERSION"
  local src="$BUILD/gsl-$GSL_VERSION"
  unpack "$DL/gsl-$GSL_VERSION.tar.gz" "$src"
  (cd "$src" && emconfigure ./configure --build=x86_64-pc-linux-gnu --host=i686-pc-linux-gnu \
      --disable-shared --enable-static --prefix="$PREFIX" CFLAGS="-Oz" \
    && emmake make -j"$JOBS" && emmake make install) > "$BUILD/gsl-build.log" 2>&1
}

# Every optional library except GSL is off.
GIAC_CONFIGURE_FLAGS=(
  --build=x86_64-pc-linux-gnu --host=i686-pc-linux-gnu  # config.sub predates wasm32; i686 gives the same type sizes
  --disable-shared --enable-static --without-x
  --disable-gmpxx --disable-ecm --disable-bernmm --disable-ntl --disable-pari --disable-gc
  --disable-png --disable-dl --disable-lapack --disable-cocoa --disable-ao --disable-glpk
  --disable-samplerate --disable-curl --disable-fltk --disable-gui --disable-gettext --disable-nls
  --disable-micropy --disable-quickjs
)
# Same defines GeoGebra's emscripten build uses, minus GIAC_GGB (GeoGebra-specific syntax mode).
GIAC_CXXFLAGS=(-Oz -fwasm-exceptions -DIN_GIAC -DGIAC_GENERIC_CONSTANTS -DHAVE_CONFIG_H -DEMCC2 -DTIMEOUT
  -DHAVE_UNISTD_H -Dgammaf=tgammaf -Wno-everything)
# libgiac_la_SOURCES from src/Makefile.am, without the QuickJS and KhiCAS-UI files.
GIAC_SOURCES=(input_lexer.cc sym2poly.cc gausspol.cc threaded.cc moyal.cc maple.cc ti89.cc mathml.cc
  misc.cc permu.cc quater.cc desolve.cc input_parser.cc symbolic.cc index.cc modpoly.cc modfactor.cc
  ezgcd.cc derive.cc solve.cc intg.cc intgab.cc risch.cc lin.cc series.cc subst.cc vecteur.cc
  sparse.cc csturm.cc tex.cc global.cc ifactor.cc alg_ext.cc gauss.cc isom.cc plot.cc plot3d.cc
  rpn.cc prog.cc pari.cc cocoa.cc unary.cc usual.cc identificateur.cc gen.cc tinymt32.cc first.cc
  proba.cc TmpLESystemSolver.C TmpFGLM.C help.cc lpsolve.cc optimization.cc signalprocessing.cc
  graphe.cc graphtheory.cc nautywrapper.c)
# markup.cc (improved LaTeX export) is excluded: with EMCC2, tex.cc defines stand-ins for it.

variant() { [[ "$WITH_GSL" == 1 ]] && echo gsl || echo base; }

stage_giac() {
  log "giac $GIAC_VERSION ($(variant))"
  local src="$BUILD/giac-$GIAC_VERSION"
  unpack "$DL/giac-$GIAC_VERSION.tar.gz" "$src"
  # The tarball bundles prebuilt web binaries; never use or ship them.
  rm -f "$src"/doc/giacwasm.js "$src"/doc/giacwasm.wasm
  local p
  for p in "$HERE"/patches/*.patch; do
    [[ -e "$p" ]] || continue
    echo "patch: ${p##*/}"
    patch -d "$src" -p1 --forward < "$p"
  done
  local gsl_flag=--disable-gsl
  [[ "$WITH_GSL" == 1 ]] && gsl_flag=--enable-gsl
  (cd "$src" && emconfigure ./configure "${GIAC_CONFIGURE_FLAGS[@]}" "$gsl_flag" \
      CPPFLAGS="-I$PREFIX/include" LDFLAGS="-L$PREFIX/lib" > "$BUILD/giac-configure.log" 2>&1)
  # No threads in the browser build (would need SharedArrayBuffer + COOP/COEP).
  sed -i -E 's@^#define (HAVE_LIBPTHREAD|HAVE_PTHREAD_H|HAVE_LIBRT) .*@/* & (disabled for wasm) */@' "$src/config.h"
  local obj="$BUILD/giac-obj-$(variant)"
  rm -rf "$obj"; mkdir -p "$obj"
  local f
  for f in "${GIAC_SOURCES[@]}"; do echo "$f"; done | (cd "$src/src" && xargs -P "$JOBS" -I{} \
    sh -c 'case "$1" in *.c) c=emcc; x="-x c";; *) c=em++; x="-x c++ -std=c++17";; esac
           $c $x '"${GIAC_CXXFLAGS[*]}"' -I.. -I. -I'"$PREFIX"'/include -c "$1" -o '"$obj"'/"$1".o \
           || { echo "FAILED: $1" >&2; exit 255; }' _ {})
}

# Exported C API (wasm/api.cc) plus what the JS glue needs.
GIAC_EXPORTS='["_giac_init","_giac_eval","_giac_latex","_giac_set_setting","_giac_set_pow_limit","_caseval","_malloc","_free"]'
GIAC_LDFLAGS=(-Oz -fwasm-exceptions
  -sMODULARIZE=1 -sEXPORT_ES6=1 -sEXPORT_NAME=createGiacModule -sENVIRONMENT=web,worker,node
  -sALLOW_MEMORY_GROWTH=1 -sINITIAL_MEMORY=64MB -sSTACK_SIZE=8MB
  -sEXPORTED_FUNCTIONS="$GIAC_EXPORTS" -sEXPORTED_RUNTIME_METHODS='["cwrap","UTF8ToString"]')

stage_link() {
  log "link ($(variant))"
  local obj="$BUILD/giac-obj-$(variant)" out="$OUT/$(variant)"
  mkdir -p "$out"
  local f
  for f in api stubs; do em++ -std=c++17 "${GIAC_CXXFLAGS[@]}" -c "$HERE/wasm/$f.cc" -o "$obj/$f.o"; done
  local libs=("$PREFIX/lib/libmpfr.a" "$PREFIX/lib/libgmp.a")  # mpfr before gmp
  [[ "$WITH_GSL" == 1 ]] && libs=("$PREFIX/lib/libgsl.a" "$PREFIX/lib/libgslcblas.a" "${libs[@]}")
  em++ "${GIAC_LDFLAGS[@]}" "$obj"/*.o "${libs[@]}" -o "$out/giac.mjs"
  ls -l "$out"
}

main() {
  local stages=("$@")
  [[ ${#stages[@]} -gt 0 ]] || stages=(fetch gmp mpfr gsl giac link)
  emsdk_env
  local s
  for s in "${stages[@]}"; do "stage_$s"; done
}

# Run only when executed, so tests can source the functions.
if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then main "$@"; fi
