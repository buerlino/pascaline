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
Compile flags follow GeoGebra's Emscripten build (github.com/geogebra/giac, `build.gradle`: `-DIN_GIAC -DGIAC_GENERIC_CONSTANTS -DHAVE_CONFIG_H -DEMCC2 -DTIMEOUT -fwasm-exceptions -Oz`), minus `GIAC_GGB`, which switches Giac into GeoGebra-specific behaviour. `config.h` comes from Giac's own `configure`, run under `emconfigure` with `--host=i686-pc-linux-gnu` (Giac's `config.sub` predates wasm32). Every optional library except GSL is disabled, and pthreads are removed afterwards. See `patches/README.md` for the patch and the files left out.

## Pinning and mirroring Giac
Parisse re-publishes `giac-2.1.0.tar.gz` under the same name as fixes land, so the pinned SHA-256 identifies one snapshot. We mirror that exact file as a release asset of this repository (tag `deps-giac-<version>-<first 8 hex of sha256>`), and `build-wasm.sh` tries the mirror first and upstream second. Both must match the hash.

Creating the mirror (needs a logged-in `gh` and the maintainer's OK; the pinned file is backed up in `../pascaline-deps/`):
```bash
gh release create deps-giac-2.1.0-1d9536e0 ../pascaline-deps/giac-2.1.0.tar.gz \
  --repo buerlino/pascaline --title "Giac 2.1.0 source (pinned, sha256 1d9536e0…)" \
  --notes "Unmodified Giac 2.1.0 source tarball (GPL-3.0-or-later) by B. Parisse and R. De Graeve, mirrored from https://www-fourier.univ-grenoble-alpes.fr/~parisse/giac/ so builds stay reproducible. SHA-256 1d9536e02ce6a336793ebf11c02b93f084e28af2350871914acafa60282b5a67."
```

Bumping Giac: download the new tarball, check `version()` and the regression tests, update `GIAC_SHA256` in `build-wasm.sh` and the row in `THIRD_PARTY.md`, and mirror the new file under a new tag.
