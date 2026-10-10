<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Phase 0 spike results
Date range: 2026-10-10 → (open) | Devices: low-end = *not yet chosen*, mid-range = *not yet chosen* | Build: desktop only so far (Vite production build served by `vite preview`)

Desktop machine for all numbers below: Rocky Linux 10.2, 16 cores, 28 GB RAM. Desktop numbers only show relative cost; the Q1 pass criteria are about a **low-end phone** and are still open.

## Decision
**Open, pending device measurements (skill steps 3+).** Desktop results so far support **GO**: our own source build of Giac 2.1.0 works, is about 30% smaller than the published prebuilt (raw and brotli) and starts 8–17× faster (0.1–0.2 s vs ≈1.8 s), and typical calculator inputs answer in single-digit milliseconds. Whether that holds on a low-end phone is the open question.

## Results per question
| # | Question | Measured (median of ≥5) | Pass? | Notes |
|---|---|---|---|---|
| Q1 | Giac-wasm cold start / ops | **Desktop only.** Source build: ready 108 ms (Chromium) / 211 ms (Firefox); first call p50 1.9 / 1 ms, p95 19.4 / 2 ms, max 23 / 10 ms over 55 cases. Low-end / mid: not measured | open | Phone numbers are needed. Details below. |
| Q2 | MathLive + own keyboard; round-trip | – | not started | step 4 |
| Q3 | Exact-first Home | – | not started | Confirmed it's needed: plain Giac gives `1-0.9-0.1` → `1.7763568394e-15` |
| Q4 | MicroPython / Pyodide | – | not started | Giac 2.1.0 tarball bundles MicroPython 1.12 sources (`micropython-1.12/`); worth a look in step 6 |
| Q5 | GSL in Giac-wasm? Boost.Math + cminpack linked? | **GSL: no** in Parisse's prebuilt and not in our default build. With GSL 2.8 linked: all GSL methods work, **+197 KB raw / +68 KB brotli**. **Boost.Math TOMS 748 + MINPACK hybrd1 linked into the same wasm: +14 KB raw / +5 KB brotli**, both working with residuals evaluated by Giac | decision proposed | Solver decision proposed below; cminpack licence question open |
| Q6 | Plot FPS | – | not started | step 7 |

### Q1 desktop detail
Benchmark: `spike/bench/cases.yaml`, 55 inputs across arithmetic, trig, algebra, solve, calculus, matrix, stats and "heavy" (`factor(x^20-1)`, `int(1/(x^4+1),x)`, `ifactor(2^64+1)`). Each input runs through `MathEngine.eval` in a Web Worker. **First call** = the first evaluation of that input in a fresh session (what a user sees), median over 7 fresh sessions. **Warm** = the same input repeated (median of 3 repeats × 7 sessions). The p50/p95 are taken across the 55 per-case medians. Times are measured inside the worker (`engineMs`); round trip including `postMessage` adds about 0.1–1 ms.

| Browser | Engine | Ready cold (ms) | Ready warm reload (ms) | Nav→ready (ms) | First call p50 / p95 / max (ms) | Warm p50 / p95 (ms) | Cancel→ready (ms) | Errors | `derived` mismatches |
|---|---|---|---|---|---|---|---|---|---|
| Chromium 156.0.8078.4 | **source** (base-solvers) | 108 | 123 | 126 | 1.9 / 19.4 / 23.1 | 0.2 / 1.9 | 82 | 0 | 0 / 15 |
| Chromium 156.0.8078.4 | prebuilt | 1855 | – | 1869 | 1.5 / 16.8 / 17.9 | 0.2 / 1.6 | 1642 | 0 | 0 / 15 |
| Firefox 157.0 | **source** (base-solvers) | 211 | 216 | 248 | 1 / 2 / 10 | 0 / 2 | 199 | 0 | 0 / 15 |
| Firefox 157.0 | prebuilt | 1790 | – | 1845 | 1 / 5 / 12 | 0 / 2 | 798 | 0 | 0 / 15 |

- Source rows are from the final run (after the `latex()` fix); prebuilt rows are from the previous full run with the same benchmark. Cold = new browser context per run (empty HTTP and code cache). Warm reload = same context reloaded. Nav→ready = page navigation start until the engine answers.
- Slowest first calls (Chromium, source): `solve(sin(x)=1/2,x)` 23 ms, `solve(x^2=2,x)` 22 ms, `simplify(sin(x)^2+cos(x)^2)` 19 ms, `int(1/(1+x^2),x)` 13 ms, `int(x^2,x,0,3)` 8.5 ms. The order changes a little between runs. Chromium's first calls are slower than Firefox's, probably because V8 compiles wasm functions lazily on first use (*assumed*, not verified).
- On this desktop, warm reload is no faster than cold: compiling the 9.6 MB wasm takes ≈90 ms (Chromium) / ≈170 ms (Firefox) with 16 cores, so caching barely helps. On a phone, compile time and the WebView code cache will matter much more; measure both in step 3.
- **Firefox rounds `performance.now()` to 1 ms** here (no cross-origin isolation), so its sub-millisecond values show as 0 or 1.
- Both engines gave **identical output on all 55 cases** in both browsers. All 15 cases with a provable expected value (`source: derived`) matched.
- **Cancel** (terminate worker → new worker → replay settings and variable log): a long `ifactor` was interrupted every time (`EngineCancelled`), and a variable defined before the cancel (`pasvar:=7`) was intact afterwards (`pasvar*6` → `42`, 5/5 runs). Replay of the log took ≤1 ms.
- Raw per-case data: `spike/app/bench/results/*.json` (gitignored; regenerate with `npm run bench`).

### Engine size and startup
| Build | Giac | wasm raw | gzip -9 | brotli -q 11 | Node instantiate+init |
|---|---|---|---|---|---|
| **Our source build, base** | 2.1.0 | 9,555,713 B | 3,340,148 B | **2,441,533 B** | ≈60–90 ms |
| Our source build, base + Boost.Math + cminpack | 2.1.0 | 9,569,835 B (+14 KB) | 3,346,165 B | 2,446,975 B (+5 KB) | |
| Our source build, base + GSL 2.8 | 2.1.0 | 9,752,927 B (+197 KB) | 3,428,110 B | 2,509,333 B (+68 KB) | |
| Parisse prebuilt `giacwasm.js` (wasm extracted from base64) | 1.9.0-xx | 14,016,856 B | 4,783,520 B | 3,415,983 B | ≈233 ms |
| Parisse prebuilt `giacwasm.js` as shipped (JS + base64 wasm) | 1.9.0-xx | 19,016,229 B | 6,657,623 B | 4,470,789 B | |
| Our JS glue `giac.mjs` | | 70,987 B | 20,154 B | 18,084 B | |

Why ours is smaller and faster: Parisse's build also contains MicroPython, QuickJS, the KhiCAS UI and GL emulation. It ships the wasm as base64 inside JS, so there's no streaming compile, and it uses a much older Emscripten (fastcomp-era runtime). Ours is Giac + GMP + MPFR only, with `-Oz`, wasm exceptions and an ES-module factory.

### Q5 detail: GSL and the solver stack
`fsolve` method results (`x^3-2` from 1; `[x^2+y^2=4, x=y]` from `[1,1]`):

| Method | Prebuilt 1.9 | Ours, base | Ours, + GSL |
|---|---|---|---|
| default `fsolve(x^3-2,x=1)` / system default | ✔ 1.25992104989 / ✔ [1.41421356237, 1.41421356237] | ✔ / ✔ | ✔ / ✔ |
| `newton_solver` | ✔ | ✔ | ✔ |
| interval form `x=0..3` with `brent_solver` / `bisection_solver` / `falsepos_solver` | ✔ | ✔ | ✔ |
| `brent_solver`, `bisection_solver`, `falsepos_solver` with a single guess | ✘ "Not linked with GSL" | ✘ same | `brent_solver` ✘ "Bad Argument Type" (Brent needs a bracket) |
| `secant_solver`, `steffenson_solver` | ✘ "Not linked with GSL" | ✘ | ✔ |
| `hybrid_solver`, `hybrids_solver`, `hybridj_solver`, `newtonj_solver` | ✘ "Not linked with GSL" | ✘ | ✔ |

Boost.Math + cminpack inside the same wasm (`engine/solvers/solvers.cc`, residuals evaluated by Giac in `caseval`'s context, so user variables apply):
- `pas_solve1("x^3-2","x",0,3)` → 1.2599210498948783, residual 1.4e-14, 14 iterations
- `pas_solve1("x*exp(x)=5","x",0,2)` → 1.3267246652422069, 9 iterations
- with `k:=3`, `pas_solve1("x^2-k","x",0,3)` → 1.7320508075688827
- no sign change → clean error ("Parameters a and b do not bracket the root")
- `pas_solve_n("[x^2+y^2=4,x=y]","[x,y]",[1,1])` → info 1 (converged), residual 0, [1.4142135623731007, 1.4142135623731007]

**Proposed solver decision (needs your OK, since it touches docs/02 section 4):** keep the plan. Use **Boost.Math TOMS 748 + MINPACK hybrd1 from `engine/solvers`** as Pascaline's Solve-app engine. They cost only +5 KB brotli and we control bracketing, Newton fallback and the residual check. **Don't add GSL to the default build**: Giac's own interval and Newton methods cover the CAS `fsolve` cases above, and GSL costs 13× more bytes for methods the Solve app won't use. GSL stays one flag away (`WITH_GSL=1`). This depends on the cminpack licence question below. If MINPACK's clause 3 turns out to be a problem, the fallbacks are GSL `hybrids` (GPL, +68 KB) or Boost-only Newton for systems.

## Components used (name, version, licence, URL, prebuilt?)
| Component | Version | Licence | URL | Prebuilt? | Used for |
|---|---|---|---|---|---|
| Emscripten SDK | 6.0.12 (emsdk git 35ff8a6) | MIT / UIUC | https://github.com/emscripten-core/emsdk | toolchain binaries from emsdk (not in repo, not shipped) | wasm builds. F-Droid would use Debian's emscripten package instead (version to check) |
| Giac | 2.1.0 (tarball sha256 1d9536e0…5a67, upstream Last-Modified 2026-10-04) | GPL-3.0-or-later | https://www-fourier.univ-grenoble-alpes.fr/~parisse/giac/giac-2.1.0.tar.gz | no, built from source | engine |
| GMP | 6.3.0 | LGPL-3.0+ / GPL-2.0+ | https://ftp.gnu.org/gnu/gmp/ | no | engine |
| MPFR | 4.2.2 | LGPL-3.0+ | https://ftp.gnu.org/gnu/mpfr/ | no | engine |
| GSL | 2.8 | GPL-3.0-or-later | https://ftp.gnu.org/gnu/gsl/ | no | Q5 measurement only |
| Boost.Math | 1.92.0 (standalone headers) | BSL-1.0 | https://github.com/boostorg/math | no | Q5, `engine/solvers` |
| cminpack | 1.3.14 | MINPACK licence (see open questions) | https://github.com/devernay/cminpack | no | Q5, `engine/solvers` |
| **Parisse `giacwasm.js`** | Giac 1.9.0-xx, Last-Modified 2025-10-22 | GPL-3.0 (Giac) | https://www-fourier.univ-grenoble-alpes.fr/~parisse/giacjs/giacwasm.js | **YES, prebuilt shortcut**, in `spike/prebuilt/` (gitignored) | step 1.1 shortcut and benchmark comparison only |
| Parisse `giacsimple.js`, `simple.html` | Last-Modified 2024-12-13 / 2020-12-31 | GPL-3.0 (Giac) | same directory | yes, `spike/prebuilt/` (gitignored) | read to learn the loading API (`caseval` via cwrap); not used |
| GeoGebra giac repo | commit bdbb1c4 (2026-09-11) | no licence file at repo root (mirror of GPL Giac) | https://github.com/geogebra/giac | its prebuilt `libgmp.a`/`libmpfr.a` were **not** used | read `build.gradle` for Emscripten flags only; no code copied |
| Vite | 8.3.4 | MIT | https://vite.dev | npm | spike app |
| TypeScript | 7.0.2 | Apache-2.0 | https://www.typescriptlang.org | npm | spike app |
| @playwright/test | 1.64.0 (Chromium 156.0.8078.4, Firefox 157.0 test builds) | Apache-2.0 | https://playwright.dev | npm + browser downloads | benchmark |
| yaml | 2.9.1 | ISC | https://eemeli.org/yaml | npm | benchmark case loader |
| @types/node | 26.6.5 | MIT | DefinitelyTyped | npm | types |

## Build notes and patches
- `engine/giac/build-wasm.sh`: a clean build (GMP, MPFR, Giac, link; then the solvers variant) takes **3 min 55 s** on 16 cores. GMP + MPFR take ≈1 min 55 s; GSL ≈1 min 30 s; Giac compile + link ≈1 min 40 s. All tarballs are SHA-256-checked; GMP, MPFR and GSL GPG signatures were checked by hand against the GNU keyring.
- **Reproducible on this machine:** a second clean build produced bit-identical `giac.wasm` (sha256 `b495feed…abe8` base, `811756ae…42f2` base-solvers). Not yet tested across machines or paths.
- Giac's `configure` is run under `emconfigure` with `--host=i686-pc-linux-gnu` (its `config.sub` doesn't know wasm32), all optional libraries off, and pthreads removed from `config.h` afterwards.
- Flags follow GeoGebra's build (`-DEMCC2 -DTIMEOUT -fwasm-exceptions -Oz`), **without `GIAC_GGB`**.
- Left out: QuickJS, MicroPython, KhiCAS UI files and `markup.cc` (with `EMCC2`, `tex.cc` provides stand-ins; so we get the older LaTeX exporter).
- Link stubs (`engine/giac/wasm/stubs.cc`): `sigsuspend` (desktop-GUI child processes only) and `giac_gen_renderer` (WebGL 3D, not built; `UI.disable3d=-1` makes `plot3d` return `gl3d_not_supported`). Identity `gettext()` in `wasm/api.cc`.
- One patch: `engine/giac/patches/0001-gen-remove-add_evalf-debug-log.patch` removes a debug `console.log` that fires on every evaluation (it also reads a misspelt `UI.addevalf`). Not reported upstream yet.
- Host contract: the worker must define a global `UI = { add_evalf: 0, js_bigint: 0, disable3d: -1, Datestart }`. Without `add_evalf: 0`, `1/3` prints as `1/3=0.333…`.
- **The Giac tarball contains prebuilt `doc/giacwasm.js` and `doc/giacwasm.wasm`.** The script deletes them right after unpacking; F-Droid's scanner would flag them too.
- Output formatting seen in `caseval` results: lists print as `list[…]` and `eigenvals` returns a bare sequence `3,1`. The UI should render through `latex()` or our own printer, never raw `caseval` text.
- Observation for later (Q3/CAS defaults): `factor(x^20-1)` factors over ℚ(√5) (`x^2+(-sqrt(5)-1)/2*x+1`…) in this configuration. How the reference calculator's CAS shows this needs checking on a device.

## Blockers
None so far. The source build was done in about one working session, so the shortcut (prebuilt) wasn't needed beyond the comparison.

## Open questions for the user
1. **cminpack / MINPACK licence:** clause 3 requires the acknowledgment *"This product includes software developed by the University of Chicago, as Operator of Argonne National Laboratory"* in end-user documentation or in the software. That's an extra requirement beyond the GPL, similar to Apache-1.1-style clauses. Is it GPL-3.0-compatible for us? (Debian and Fedora treat it as free; I couldn't find an FSF ruling.) If it's unclear, we can use GSL `hybrids` instead. Please decide or ask someone with licensing expertise.
2. **Solver stack** as proposed above (Boost.Math + cminpack, no GSL by default)? If yes, I'll update docs/02 section 4.
3. **Giac tarball pinning:** Parisse re-rolls `giac-2.1.0.tar.gz` in place, so our SHA-256 will break when he updates it. Options: mirror the exact tarball (e.g. a release asset in our repo or on Codeberg) or ask Parisse for immutable versioned tarballs. This matters for F-Droid.
4. **Upstream reports to Parisse** (could go into the outreach email): the `add_evalf` debug log and `UI.addevalf` typo; `markup.cc` vs `EMCC2` (can the improved LaTeX exporter be enabled in web builds?); immutable tarballs.
5. **Devices for steps 3+:** which low-end and mid-range phones (model, Android version, RAM)? A phone connected over `adb` lets me install and read timings myself.
6. **Reference calculator** (real G2 or the official Virtual Calculator) for the `assumed` values in steps 4–5.
7. `assumed` values so far: only the remark that V8's lazy wasm compilation explains Chromium's slower first calls. No Prime-behaviour values have been assumed yet.

## Changes made to docs/02 and CLAUDE.md
- CLAUDE.md: "Commands" section filled with the real build, smoke-test and benchmark commands; status line updated.
- docs/02: **not changed yet.** The solver decision (Q5) waits for your answer to open questions 1–2.
