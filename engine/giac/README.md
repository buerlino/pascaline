<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Giac → WebAssembly

`build-wasm.sh` builds Giac with GMP and MPFR (and optionally GSL, Boost.Math and cminpack) from pinned, SHA-256-checked source tarballs. Nothing prebuilt is used: the Giac tarball ships `doc/giacwasm.{js,wasm}`, and the script deletes both right after unpacking.

```bash
# once: Emscripten into ~/emsdk (the script sources emsdk_env.sh itself; your shell rc is not touched)
git clone https://github.com/emscripten-core/emsdk.git ~/emsdk
~/emsdk/emsdk install 6.0.12 && ~/emsdk/emsdk activate 6.0.12

engine/giac/build-wasm.sh                                    # fetch gmp mpfr giac link → _out/base/
WITH_SOLVERS=1 engine/giac/build-wasm.sh fetch link          # + Boost.Math/cminpack → _out/base-solvers/ (after a base build)
WITH_GSL=1 engine/giac/build-wasm.sh fetch gsl giac link     # + GSL → _out/gsl/
```

Stages: `fetch gmp mpfr gsl giac solvers link`. `JOBS` sets parallelism (default `nproc`). On a 16-core machine, a clean build of all three libraries plus Giac takes about 3.5 minutes.

Output: `_out/<variant>/giac.mjs` (ES module factory `createGiacModule`) + `giac.wasm`.

## Exported C API (`wasm/api.cc`)
- `giac_init()`
- `giac_eval(const char*) → const char*` (Giac `caseval`; the result is valid until the next call)
- `giac_latex(const char*)`
- `giac_set_setting(name, value)` (runs `name:=value`)
- `caseval` (raw)
- with `WITH_SOLVERS=1`: `pas_solve1(expr, var, a, b)` (TOMS 748) and `pas_solve_n(eqs, vars, double* guess, n)` (MINPACK `hybrd1`), from `engine/solvers/solvers.cc`

The host must define a global `UI = { add_evalf: 0, js_bigint: 0, disable3d: -1, Datestart: Date.now() }` before evaluating. Giac's `EMCC2` code reads it; without it, fractions print as `1/3=0.333…`.

## Build choices
Compile flags follow GeoGebra's Emscripten build (github.com/geogebra/giac, `build.gradle`: `-DIN_GIAC -DGIAC_GENERIC_CONSTANTS -DHAVE_CONFIG_H -DEMCC2 -DTIMEOUT -fwasm-exceptions -Oz`), minus `GIAC_GGB`, which switches Giac into GeoGebra-specific behaviour. `config.h` comes from Giac's own `configure`, run under `emconfigure` with `--host=i686-pc-linux-gnu` (Giac's `config.sub` predates wasm32), with every optional library disabled and pthreads removed afterwards. See `patches/README.md` for the patch and the files left out.

## Bumping Giac
Parisse re-publishes `giac-2.1.0.tar.gz` under the same name as fixes land, so the pinned SHA-256 identifies one snapshot. To update: download it, check `version()` and the regression tests, then update `GIAC_SHA256` in `build-wasm.sh` and the row in `THIRD_PARTY.md`. For reproducible F-Droid builds we will need to mirror the exact tarball we pinned (open question in spike/RESULTS.md).
