<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Giac → WebAssembly

`build-wasm.sh` builds Giac with GSL, GMP and MPFR from pinned, SHA-256-checked source tarballs. Nothing prebuilt is used: the Giac tarball ships `doc/giacwasm.{js,wasm}`, and the script deletes both right after unpacking.

```bash
# once: Emscripten into ~/emsdk (the script sources emsdk_env.sh itself; your shell rc is not touched)
git clone https://github.com/emscripten-core/emsdk.git ~/emsdk
~/emsdk/emsdk install 6.0.12 && ~/emsdk/emsdk activate 6.0.12

engine/giac/build-wasm.sh                              # fetch gmp mpfr gsl giac link → _out/gsl/ (the default build)
WITH_GSL=0 engine/giac/build-wasm.sh fetch giac link   # without GSL → _out/base/ (comparisons only)
```

Stages: `fetch gmp mpfr gsl giac link`. `JOBS` sets parallelism (default `nproc`). `PASCALINE_DL_DIR` points the download cache somewhere else, e.g. at the main checkout's `_downloads` from a git worktree. On a 16-core machine a clean build takes about 5 minutes (GMP + MPFR ≈2 min, GSL ≈1.5 min, Giac ≈1.7 min). Two clean builds on the same machine produced byte-identical `giac.wasm`.

Output: `_out/<variant>/giac.mjs` (ES module factory `createGiacModule`) + `giac.wasm` (9.75 MB raw, 2.51 MB brotli).

## Exported C API (`wasm/api.cc`)
- `giac_init()`
- `giac_eval(const char*) → const char*` (Giac `caseval`; the result is valid until the next call)
- `giac_latex(const char*)` (returns a Giac string, printed with surrounding quotes)
- `giac_set_setting(name, value)` (runs `name:=value`)
- `caseval` (raw)

The host must define a global `UI = { add_evalf: 0, js_bigint: 0, disable3d: -1, Datestart: Date.now() }` before evaluating. Giac's `EMCC2` code reads it; without it, fractions print as `1/3=0.333…`.

## Numeric solving
GSL gives Giac's `fsolve` its extra methods: `brent_solver`, `bisection_solver`, `falsepos_solver` (with an interval `x=a..b`), `newton_solver`, `secant_solver`, `steffenson_solver`, and for systems `hybrids_solver`, `hybridsj_solver`, `hybrid_solver`, `hybridj_solver`, `dnewton_solver`, `newtonj_solver`. The Solve-app strategy (bracket search, method choice, residual check) is planned in docs/02 section 4.

## Build choices
Compile flags follow GeoGebra's Emscripten build (github.com/geogebra/giac, `build.gradle`: `-DIN_GIAC -DGIAC_GENERIC_CONSTANTS -DHAVE_CONFIG_H -DEMCC2 -DTIMEOUT -fwasm-exceptions -Oz`), minus `GIAC_GGB`, which switches Giac into GeoGebra-specific behaviour. `config.h` comes from Giac's own `configure`, run under `emconfigure` with `--host=i686-pc-linux-gnu` (Giac's `config.sub` predates wasm32). Every optional library except GSL is disabled, and pthreads are commented out of the root `config.h` afterwards (G77 found that `src/config.h`, which `configure` copies before that edit, keeps them: see `patches/README.md`). See `patches/README.md` for the patch and the files left out.

## Pinning and mirroring Giac
P21 (G77): Giac is pinned to Parisse's numbered Debian source archive, `giac_<version>-<n>.tar.gz` in `https://www-fourier.univ-grenoble-alpes.fr/~parisse/debian/dists/stable/main/source/`, which never changes once published (Parisse, 2026-10-19); the unnumbered `giac-2.1.0.tar.gz` is re-published in place as fixes land. The pin is `giac_2.1.0-1.tar.gz`, SHA-256 `cdec2989…3f57`, the tarball's line in the `giac_2.1.0-1.dsc` beside it. `build-wasm.sh` (`fetch_giac`) fetches the `.dsc` and the tarball from Parisse's folder first and our mirror second (a release asset of this repository, tag `deps-giac-<version>-<n>-<first 8 hex of sha256>`, holding both exact files): the tarball must match the pin and the pin must be the `.dsc` line (`tests/engine/fetch-test.mjs`, golden stage `flags`). The release script fetches on the host with the same pins. The snapshot pinned before, `giac-2.1.0.tar.gz` (`1d9536e0…`, release `deps-giac-2.1.0-1d9536e0`), stays in the download cache and in `../pascaline-deps/`.

The numbered archive is a configured tree (Debian's `config.h`, `src/config.h`, Makefiles, `libtool`); our `configure` rewrites them, and `configure.ac:688` copies its `config.h` to `src/`.

Creating the mirror (needs a logged-in `gh` and the maintainer's OK):
```bash
gh release create deps-giac-2.1.0-1-cdec2989 engine/giac/_downloads/giac_2.1.0-1.tar.gz engine/giac/_downloads/giac_2.1.0-1.dsc \
  --repo buerlino/pascaline --title "Giac 2.1.0-1 source (pinned, sha256 cdec2989…)" \
  --notes "Unmodified Giac 2.1.0-1 source tarball and .dsc (GPL-3.0-or-later) by B. Parisse and R. De Graeve, mirrored from https://www-fourier.univ-grenoble-alpes.fr/~parisse/debian/dists/stable/main/source/ so builds stay reproducible. SHA-256 cdec29897d6a55f9e53f82285ffd85cd82bcaba0bd90a494f710be002bd73f57."
```

Bumping Giac (P21): take the next numbered archive, copy its `Checksums-Sha256` line from the `.dsc` into `GIAC_SHA256` (and `GIAC_DEBIAN_REVISION`) in `build-wasm.sh` and into `tools/find-index/state.mjs`, check the patches apply, then the golden gate (its `flags` stage runs the canaries: a flipped row names a workaround that may go), `app/scripts/compare-engines.ts` old against new and the interrupt test; update the row in `THIRD_PARTY.md` and mirror both files under a new tag.
