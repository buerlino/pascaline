#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
#
# Build Giac + GMP + MPFR to WebAssembly from pinned, hash-checked sources.
#
#   [WITH_GSL=1] [WITH_SOLVERS=1] engine/giac/build-wasm.sh [stage...]
#
# Stages: fetch gmp mpfr gsl giac solvers link (default: fetch gmp mpfr giac link)
# Output: engine/giac/_out/<variant>/giac.{mjs,wasm}; variant = base|gsl, plus -solvers with WITH_SOLVERS=1
# Needs: emsdk (EMSDK_DIR, default ~/emsdk) activated at $EMSDK_VERSION.
# Nothing here touches the user's shell rc files.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DL="$HERE/_downloads"
BUILD="$HERE/_build"
OUT="$HERE/_out"
PREFIX="$BUILD/prefix"
JOBS="${JOBS:-$(nproc)}"

EMSDK_DIR="${EMSDK_DIR:-$HOME/emsdk}"
EMSDK_VERSION="6.0.12"

GMP_VERSION="6.3.0"
GMP_URL="https://ftp.gnu.org/gnu/gmp/gmp-$GMP_VERSION.tar.xz"
GMP_SHA256="a3c2b80201b89e68616f4ad30bc66aee4927c3ce50e33929ca819d5c43538898"

MPFR_VERSION="4.2.2"
MPFR_URL="https://ftp.gnu.org/gnu/mpfr/mpfr-$MPFR_VERSION.tar.xz"
MPFR_SHA256="b67ba0383ef7e8a8563734e2e889ef5ec3c3b898a01d00fa0a6869ad81c6ce01"

# Optional (WITH_GSL=1): enables Giac's GSL-based fsolve methods. Measured for spike Q5.
GSL_VERSION="2.8"
GSL_URL="https://ftp.gnu.org/gnu/gsl/gsl-$GSL_VERSION.tar.gz"
GSL_SHA256="6a99eeed15632c6354895b1dd542ed5a855c0f15d9ad1326c6fe2b2c9e423190"

# Optional (WITH_SOLVERS=1): engine/solvers (Boost.Math TOMS 748 + MINPACK hybrd1). Header-only / C.
# GitHub tag archives; their hashes are stable in practice but not guaranteed by GitHub.
BOOSTMATH_VERSION="1.92.0"
BOOSTMATH_URL="https://github.com/boostorg/math/archive/refs/tags/boost-$BOOSTMATH_VERSION.tar.gz"
BOOSTMATH_FILE="boost-math-$BOOSTMATH_VERSION.tar.gz"
BOOSTMATH_SHA256="aa84eec67402a51cb98172ece53b82f0500e95a80656de109074a71920cd2c48"
CMINPACK_VERSION="1.3.14"
CMINPACK_URL="https://github.com/devernay/cminpack/archive/refs/tags/v$CMINPACK_VERSION.tar.gz"
CMINPACK_FILE="cminpack-$CMINPACK_VERSION.tar.gz"
CMINPACK_SHA256="10a76d214e01baa0480828fa473c2ef6209983c80941eca10b5a69df4de02cee"

# Upstream re-rolls giac-2.1.0.tar.gz in place, so the hash pins one snapshot.
# See engine/giac/README.md for how to bump it.
GIAC_VERSION="2.1.0"
GIAC_URL="https://www-fourier.univ-grenoble-alpes.fr/~parisse/giac/giac-$GIAC_VERSION.tar.gz"
GIAC_SHA256="1d9536e02ce6a336793ebf11c02b93f084e28af2350871914acafa60282b5a67"

log() { printf '\n==> %s\n' "$*"; }

emsdk_env() {
  # shellcheck disable=SC1091
  source "$EMSDK_DIR/emsdk_env.sh" >/dev/null 2>&1
  local v
  v="$(emcc --version | head -1 | sed -E 's/.* ([0-9]+\.[0-9]+\.[0-9]+).*/\1/')"
  if [[ "$v" != "$EMSDK_VERSION" ]]; then
    echo "emcc $v found, $EMSDK_VERSION required (cd $EMSDK_DIR && ./emsdk install $EMSDK_VERSION && ./emsdk activate $EMSDK_VERSION)" >&2
    exit 1
  fi
}

fetch_one() { # url sha256 [filename]
  local url="$1" sha="$2" f="$DL/${3:-${1##*/}}"
  mkdir -p "$DL"
  if [[ ! -f "$f" ]]; then
    curl -fSL --retry 3 -o "$f.part" "$url"
    mv "$f.part" "$f"
  fi
  echo "$sha  $f" | sha256sum -c - || { echo "SHA-256 mismatch for $f" >&2; exit 1; }
}

stage_fetch() {
  log "fetch"
  fetch_one "$GMP_URL" "$GMP_SHA256"
  fetch_one "$MPFR_URL" "$MPFR_SHA256"
  fetch_one "$GIAC_URL" "$GIAC_SHA256"
  [[ "${WITH_GSL:-0}" != 1 ]] || fetch_one "$GSL_URL" "$GSL_SHA256"
  if [[ "${WITH_SOLVERS:-0}" == 1 ]]; then
    fetch_one "$BOOSTMATH_URL" "$BOOSTMATH_SHA256" "$BOOSTMATH_FILE"
    fetch_one "$CMINPACK_URL" "$CMINPACK_SHA256" "$CMINPACK_FILE"
  fi
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

# Optional libraries are off; WITH_GSL=1 adds GSL (see stage_gsl).
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

giac_src() { echo "$BUILD/giac-$GIAC_VERSION"; }
giac_variant() { [[ "${WITH_GSL:-0}" == 1 ]] && echo gsl || echo base; }
variant() { echo "$(giac_variant)$([[ "${WITH_SOLVERS:-0}" == 1 ]] && echo -solvers)"; }

stage_giac() {
  log "giac $GIAC_VERSION"
  local src; src="$(giac_src)"
  unpack "$DL/giac-$GIAC_VERSION.tar.gz" "$src"
  # The tarball bundles prebuilt web binaries; never use or ship them.
  rm -f "$src"/doc/giacwasm.js "$src"/doc/giacwasm.wasm
  local p
  for p in "$HERE"/patches/*.patch; do
    [[ -e "$p" ]] || continue
    echo "patch: ${p##*/}"
    patch -d "$src" -p1 --forward < "$p"
  done
  local extra=()
  [[ "${WITH_GSL:-0}" == 1 ]] && extra+=(--enable-gsl) || extra+=(--disable-gsl)
  (cd "$src" && emconfigure ./configure "${GIAC_CONFIGURE_FLAGS[@]}" "${extra[@]}" \
      CPPFLAGS="-I$PREFIX/include" LDFLAGS="-L$PREFIX/lib" > "$BUILD/giac-configure.log" 2>&1)
  # No threads in the browser build (would need SharedArrayBuffer + COOP/COEP).
  sed -i -E 's@^#define (HAVE_LIBPTHREAD|HAVE_PTHREAD_H|HAVE_LIBRT) .*@/* & (disabled for wasm) */@' "$src/config.h"
  local obj="$BUILD/giac-obj-$(giac_variant)"
  rm -rf "$obj"; mkdir -p "$obj"
  local f
  for f in "${GIAC_SOURCES[@]}"; do echo "$f"; done | (cd "$src/src" && xargs -P "$JOBS" -I{} \
    sh -c 'case "$1" in *.c) c=emcc; x="-x c";; *) c=em++; x="-x c++ -std=c++17";; esac
           $c $x '"${GIAC_CXXFLAGS[*]}"' -I.. -I. -I'"$PREFIX"'/include -c "$1" -o '"$obj"'/"$1".o \
           || { echo "FAILED: $1" >&2; exit 255; }' _ {})
}

# Exported C API (wasm/api.cc) plus what the JS glue needs.
GIAC_EXPORTS='["_giac_init","_giac_eval","_giac_latex","_giac_set_setting","_caseval","_malloc","_free"]'
GIAC_LDFLAGS=(-Oz -fwasm-exceptions
  -sMODULARIZE=1 -sEXPORT_ES6=1 -sEXPORT_NAME=createGiacModule -sENVIRONMENT=web,worker,node
  -sALLOW_MEMORY_GROWTH=1 -sINITIAL_MEMORY=64MB -sSTACK_SIZE=8MB
  -sEXPORTED_RUNTIME_METHODS='["cwrap","UTF8ToString","HEAPF64"]')

stage_link() {
  log "link"
  local obj="$BUILD/giac-obj-$(giac_variant)"
  local out="$OUT/$(variant)"
  mkdir -p "$out"
  local f
  for f in api stubs; do em++ -std=c++17 "${GIAC_CXXFLAGS[@]}" -c "$HERE/wasm/$f.cc" -o "$obj/$f.o"; done
  local libs=("$PREFIX/lib/libmpfr.a" "$PREFIX/lib/libgmp.a")  # mpfr before gmp
  [[ "${WITH_GSL:-0}" == 1 ]] && libs=("$PREFIX/lib/libgsl.a" "$PREFIX/lib/libgslcblas.a" "${libs[@]}")
  local extra_obj=() exports="$GIAC_EXPORTS"
  if [[ "${WITH_SOLVERS:-0}" == 1 ]]; then
    stage_solvers
    extra_obj=("$BUILD/solvers-obj"/*.o)
    exports="${exports%]},\"_pas_solve1\",\"_pas_solve_n\"]"
  fi
  em++ "${GIAC_LDFLAGS[@]}" -sEXPORTED_FUNCTIONS="$exports" "$obj"/*.o "${extra_obj[@]}" "${libs[@]}" -o "$out/giac.mjs"
  ls -l "$out"
}

stage_gsl() {
  log "gsl $GSL_VERSION"
  local src="$BUILD/gsl-$GSL_VERSION"
  unpack "$DL/gsl-$GSL_VERSION.tar.gz" "$src"
  (cd "$src" && emconfigure ./configure --build=x86_64-pc-linux-gnu --host=i686-pc-linux-gnu \
      --disable-shared --enable-static --prefix="$PREFIX" CFLAGS="-Oz" \
    && emmake make -j"$JOBS" && emmake make install) > "$BUILD/gsl-build.log" 2>&1
}

stage_solvers() {
  log "solvers (Boost.Math $BOOSTMATH_VERSION, cminpack $CMINPACK_VERSION)"
  local bm="$BUILD/math-boost-$BOOSTMATH_VERSION" cm="$BUILD/cminpack-$CMINPACK_VERSION" o="$BUILD/solvers-obj"
  unpack "$DL/$BOOSTMATH_FILE" "$bm"
  unpack "$DL/$CMINPACK_FILE" "$cm"
  rm -rf "$o"; mkdir -p "$o"
  local f
  for f in hybrd1 hybrd dogleg dpmpar enorm fdjac1 qform qrfac r1mpyq r1updt; do
    emcc -Oz -DCMINPACK_NO_DLL -I"$cm/include" -c "$cm/src/$f.c" -o "$o/cminpack_$f.o"
  done
  em++ -std=c++17 "${GIAC_CXXFLAGS[@]}" -DCMINPACK_NO_DLL -I"$bm/include" -I"$cm/include" \
    -I"$(giac_src)" -I"$(giac_src)/src" -I"$PREFIX/include" -c "$HERE/../solvers/solvers.cc" -o "$o/solvers.o"
}

main() {
  local stages=("$@")
  [[ ${#stages[@]} -gt 0 ]] || stages=(fetch gmp mpfr giac link)
  emsdk_env
  local s
  for s in "${stages[@]}"; do "stage_$s"; done
}

main "$@"
