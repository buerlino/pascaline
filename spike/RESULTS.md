<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Phase 0 spike results
Date range: 2026-10-10 → (open) | Devices: slow = old tablet (Android 8 or 9, model tbd), low-end = Lenovo Tab One TB305FU (Android 15, MediaTek MT8786 / mt6768, 8 cores, 3.9 GB RAM, Android WebView 131.0.6778.260 as found; adb serial HA24BZ2Y, stay-awake on since 2026-10-10 23:30), mid/high = Fairphone 6 (Android 16); exact SoC/RAM/WebView to be read via adb | Reference calculator: HP Prime G2 (black-box use only, by the user) | Build: desktop only so far (Vite production build served by `vite preview`)

Desktop machine for all numbers below: Rocky Linux 10.2, 16 cores, 28 GB RAM. Desktop numbers only show relative cost; the Q1 pass criteria are about a **low-end phone** and are still open.

## Decision
**Open, pending device measurements (skill steps 3+).** Desktop results so far support **GO**: our own source build of Giac 2.1.0 works, is about 30% smaller than the published prebuilt (raw and brotli) and starts 8–17× faster (0.1–0.2 s vs ≈1.8 s), and typical calculator inputs answer in single-digit milliseconds. Whether that holds on a low-end phone is the open question.

## Decisions taken (user, 2026-10-10)
1. **Solver stack: GSL**, linked into the Giac wasm and used through Giac `fsolve` (Q5). Boost.Math + cminpack were tested and removed: MINPACK's licence has an acknowledgment clause whose GPL compatibility we don't want to depend on, while GSL is GPL-3.0 like Giac, covers the same algorithms (Brent, Newton/secant/Steffensen, Powell hybrid `hybrids`), and costs only +68 KB brotli (≈3% of the engine). `engine/giac/build-wasm.sh` now builds with GSL by default; `engine/solvers/` was deleted (history: commit df187eb). docs/02 section 4 updated.
2. **Giac tarball: mirror it.** The pinned file goes into a GitHub release asset of this repo (tag `deps-giac-2.1.0-1d9536e0`); the build script tries the mirror first and upstream second, both hash-checked. Backup copy: `../pascaline-deps/giac-2.1.0.tar.gz`. **Still to do by the user:** run the `gh release create` command in engine/giac/README.md (needs `gh auth login`).
3. **Email to Bernard Parisse after the device measurements**, with real numbers and the upstream reports below. Asking him about MINPACK isn't needed any more (and he isn't the right person for it).

## Results per question
| # | Question | Measured (median of ≥5) | Pass? | Notes |
|---|---|---|---|---|
| Q1 | Giac-wasm cold start / ops | **Low-end, Lenovo Tab One** (Android 15, WebView 131.0.6778.260, Capacitor 8.5.3, **release** build): cold launch → engine ready **975 ms**, → first result **1071 ms** (n=7); first launch after install 1107 / 1199 ms (n=5); warm resume 82 ms (n=5). 55 cases × 5 launches: first call p50 **7.5 ms**, p95 **75.8 ms**, max 123 ms (`solve(sin(x)=1/2,x)`); warm p50 1.8 / p95 8.1 ms; 0 errors, 0 mismatches; cancel → ready 381 ms, variables replayed. Debug build ≈2× slower (2147 / 2267 ms). Desktop: see below. Mid-range and old devices: **not measured** | **pass on low-end** (< 2 s; typical solve/int/factor < 200 ms) | Tab One detail below |
| Q2 | MathLive + own keyboard; round-trip | – | not started | step 4 |
| Q3 | Exact-first Home | – | not started | Confirmed it's needed: plain Giac gives `1-0.9-0.1` → `1.7763568394e-15` |
| Q4 | MicroPython / Pyodide | **Desktop only (Node 22).** MicroPython v1.29.0: wasm 1.12 MB raw / 328 KB brotli, start **11 ms**; `calc.cas` bridge to the Giac worker 1.2 ms round trip. Pyodide 314.0.7 pack (core + numpy + sympy + mpmath): 12.7 MB brotli; start core 1.8 s, core + numpy ≈4.5 s, + sympy ≈6.9 s (host shared, load 3–5). Tab One: not measured yet | MicroPython: desktop pass; Pyodide + sympy: **fails** 4 s even on desktop | Details in `spike/python/NOTES.md`. `calc.cas` is async (`await`); a sync API needs COOP/COEP. Giac's bundled `micropython-1.12/` is 17 releases older: reference only |
| Q5 | GSL in Giac-wasm? Boost.Math + cminpack linked? | **GSL: no** in Parisse's prebuilt and not in a build without it. With GSL 2.8 linked: all GSL methods work, **+197 KB raw / +68 KB brotli**, no change to the 55 benchmark outputs. Boost.Math TOMS 748 + MINPACK hybrd1 also linked and worked (+14 KB raw / +5 KB brotli) | **decided: GSL** | see "Decisions taken" |
| Q6 | Plot FPS | – | not started | step 7 |

### Q1 desktop detail
Benchmark: `spike/bench/cases.yaml`, 55 inputs across arithmetic, trig, algebra, solve, calculus, matrix, stats and "heavy" (`factor(x^20-1)`, `int(1/(x^4+1),x)`, `ifactor(2^64+1)`). Each input runs through `MathEngine.eval` in a Web Worker. **First call** = the first evaluation of that input in a fresh session (what a user sees), median over 7 fresh sessions. **Warm** = the same input repeated (median of 3 repeats × 7 sessions). The p50/p95 are taken across the 55 per-case medians. Times are measured inside the worker (`engineMs`); round trip including `postMessage` adds about 0.1–1 ms.

| Browser | Engine | Ready cold (ms) | Ready warm reload (ms) | Nav→ready (ms) | First call p50 / p95 / max (ms) | Warm p50 / p95 (ms) | Cancel→ready (ms) | Errors | `derived` mismatches |
|---|---|---|---|---|---|---|---|---|---|
| Chromium 156.0.8078.4 | **source** (base + Boost/cminpack) | 108 | 123 | 126 | 1.9 / 19.4 / 23.1 | 0.2 / 1.9 | 82 | 0 | 0 / 15 |
| Chromium 156.0.8078.4 | prebuilt | 1855 | – | 1869 | 1.5 / 16.8 / 17.9 | 0.2 / 1.6 | 1642 | 0 | 0 / 15 |
| Firefox 157.0 | **source** (base + Boost/cminpack) | 211 | 216 | 248 | 1 / 2 / 10 | 0 / 2 | 199 | 0 | 0 / 15 |
| Firefox 157.0 | prebuilt | 1790 | – | 1845 | 1 / 5 / 12 | 0 / 2 | 798 | 0 | 0 / 15 |

- The source engine in this table is the Boost/cminpack build measured before the GSL decision; the GSL build (now default) gave the same picture in a re-check on Chromium: ready 107 ms, first call p50 1.5 / p95 21 / max 24 ms, no errors, cancel/replay OK. Source rows are from the final run (after the `latex()` fix); prebuilt rows are from the previous full run with the same benchmark. Cold = new browser context per run (empty HTTP and code cache). Warm reload = same context reloaded. Nav→ready = page navigation start until the engine answers.
- Slowest first calls (Chromium, source): `solve(sin(x)=1/2,x)` 23 ms, `solve(x^2=2,x)` 22 ms, `simplify(sin(x)^2+cos(x)^2)` 19 ms, `int(1/(1+x^2),x)` 13 ms, `int(x^2,x,0,3)` 8.5 ms. The order changes a little between runs. Chromium's first calls are slower than Firefox's, probably because V8 compiles wasm functions lazily on first use (*assumed*, not verified).
- On this desktop, warm reload is no faster than cold: compiling the 9.6 MB wasm takes ≈90 ms (Chromium) / ≈170 ms (Firefox) with 16 cores, so caching barely helps. On a phone, compile time and the WebView code cache will matter much more; measure both in step 3.
- **Firefox rounds `performance.now()` to 1 ms** here (no cross-origin isolation), so its sub-millisecond values show as 0 or 1.
- Both engines gave **identical output on all 55 cases** in both browsers. All 15 cases with a provable expected value (`source: derived`) matched.
- **Cancel** (terminate worker → new worker → replay settings and variable log): a long `ifactor` was interrupted every time (`EngineCancelled`), and a variable defined before the cancel (`pasvar:=7`) was intact afterwards (`pasvar*6` → `42`, 5/5 runs). Replay of the log took ≤1 ms.
- Raw per-case data: `spike/app/bench/results/*.json` (gitignored; regenerate with `npm run bench`).

### Q1 on the Lenovo Tab One (2026-10-10, 23:45–23:50)
Device HA24BZ2Y: Android 15 (SDK 35), MediaTek MT8786 (mt6768), 8 cores, 3.9 GB RAM, Android WebView 131.0.6778.260 as found. Plugged into USB, screen on, battery 66–68 %, 27.9–29.5 °C. Capacitor 8.5.3, compileSdk/targetSdk 36, AGP 8.13, Gradle 8.14.3, Java 21. APK 6.6 MB (release; the 9.75 MB wasm is 3.4 MB deflated inside). Tools: `spike/tools/device-build.sh`, `spike/tools/device_run.py`, raw runs in `.coord/device-runs.jsonl` (gitignored), medians by `spike/tools/runs_summary.py`; see `spike/android/NOTES.md`.

| Release build, medians | Cold (`am force-stop` + `am start -W`, n=7) | First launch after install (n=5) | Debug, cold (n=7) |
|---|---|---|---|
| `am start -W` TotalTime | 639 ms | 640 ms | 1419 ms |
| Activity created | 366 ms | 357 ms | 958 ms |
| JS starts | 559 ms | 554 ms | 1695 ms |
| wasm fetch + compile + instantiate | 366 ms | 498 ms | 430 ms |
| `giac_init` | 0.7 ms | 0.8 ms | 0.8 ms |
| **Engine ready** (from process start) | **975 ms** | 1107 ms | 2147 ms |
| **First result** | **1071 ms** | 1199 ms | 2267 ms |

- Cold first-result raw values (ms): 1115, 1066, 1057, 1295, 1061, 1071, 1078. Warm resume (`am start -W`, app in background): 78, 82, 69, 82, 85 → 82 ms.
- Benchmark on device (55 cases, 5 launches, release): first call p50 7.5 / p95 75.8 / max 123.2 ms; warm p50 1.8 / p95 8.1 ms. Slowest first calls: `solve-trig` 123 ms, `trig-simplify` 101 ms, `int-atan` 76 ms, `solve-quad` 55 ms, `int-def` 40 ms. Debug: p50 10 / p95 75.8 / max 158 ms, cancel 435 ms. Roughly 4–5× the desktop Chromium times.
- The wasm instantiate time doesn't shrink on later launches, so the WebView doesn't seem to cache the compiled code for files served by Capacitor (*assumed* from timings, to check). That is the biggest single slice still to cut (research note R2).
- Only one low-end device was measured. Mid-range (Fairphone 6) and the old Android 8/9 tablet stay open; don't extrapolate.

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

Does linking GSL change other results? `spike/node/compare-variants.mjs base gsl` on the 55 benchmark inputs plus 19 numeric/special-function inputs: **all 55 benchmark outputs identical**. 4 of 74 differ:
- `evalf(Airy_Ai(1))`: base returns it unevaluated (`Airy_Ai(1.0)`), GSL gives `0.135292416313`.
- Numeric `eigenvals`, `eigenvects`, `svd` on float matrices: **same values, different order/sign** (GSL sorts eigenvalues ascending, e.g. `1.26794919243,3.0,4.73205080757` vs base `3.0,1.26794919243,4.73205080757`). Both are correct. Which order the reference calculator shows is a black-box check for the G2 (to verify, not assumed).

Boost.Math + cminpack inside the same wasm (`engine/solvers/solvers.cc`, since deleted, residuals evaluated by Giac in `caseval`'s context, so user variables apply):
- `pas_solve1("x^3-2","x",0,3)` → 1.2599210498948783, residual 1.4e-14, 14 iterations
- `pas_solve1("x*exp(x)=5","x",0,2)` → 1.3267246652422069, 9 iterations
- with `k:=3`, `pas_solve1("x^2-k","x",0,3)` → 1.7320508075688827
- no sign change → clean error ("Parameters a and b do not bracket the root")
- `pas_solve_n("[x^2+y^2=4,x=y]","[x,y]",[1,1])` → info 1 (converged), residual 0, [1.4142135623731007, 1.4142135623731007]

**Decision: GSL** (see "Decisions taken"). The first proposal here was Boost.Math + cminpack for its smaller size; it was dropped because of the MINPACK licence clause, and because 68 KB is small next to a 2.5 MB engine. `hybridsj_solver` and `dnewton_solver` were also checked and work in the GSL build.

## Components used (name, version, licence, URL, prebuilt?)
| Component | Version | Licence | URL | Prebuilt? | Used for |
|---|---|---|---|---|---|
| Emscripten SDK | 6.0.12 (emsdk git 35ff8a6) | MIT / UIUC | https://github.com/emscripten-core/emsdk | toolchain binaries from emsdk (not in repo, not shipped) | wasm builds. F-Droid would use Debian's emscripten package instead (version to check) |
| Giac | 2.1.0 (tarball sha256 1d9536e0…5a67, upstream Last-Modified 2026-10-04) | GPL-3.0-or-later | https://www-fourier.univ-grenoble-alpes.fr/~parisse/giac/giac-2.1.0.tar.gz | no, built from source | engine |
| GMP | 6.3.0 | LGPL-3.0+ / GPL-2.0+ | https://ftp.gnu.org/gnu/gmp/ | no | engine |
| MPFR | 4.2.2 | LGPL-3.0+ | https://ftp.gnu.org/gnu/mpfr/ | no | engine |
| GSL | 2.8 | GPL-3.0-or-later | https://ftp.gnu.org/gnu/gsl/ | no | engine (default since the Q5 decision) |
| Boost.Math | 1.92.0 (standalone headers) | BSL-1.0 | https://github.com/boostorg/math | no | Q5 test only; removed |
| cminpack | 1.3.14 | MINPACK licence (acknowledgment clause) | https://github.com/devernay/cminpack | no | Q5 test only; removed |
| **Parisse `giacwasm.js`** | Giac 1.9.0-xx, Last-Modified 2025-10-22 | GPL-3.0 (Giac) | https://www-fourier.univ-grenoble-alpes.fr/~parisse/giacjs/giacwasm.js | **YES, prebuilt shortcut**, in `spike/prebuilt/` (gitignored) | step 1.1 shortcut and benchmark comparison only |
| Parisse `giacsimple.js`, `simple.html` | Last-Modified 2024-12-13 / 2020-12-31 | GPL-3.0 (Giac) | same directory | yes, `spike/prebuilt/` (gitignored) | read to learn the loading API (`caseval` via cwrap); not used |
| GeoGebra giac repo | commit bdbb1c4 (2026-09-11) | no licence file at repo root (mirror of GPL Giac) | https://github.com/geogebra/giac | its prebuilt `libgmp.a`/`libmpfr.a` were **not** used | read `build.gradle` for Emscripten flags only; no code copied |
| MicroPython | v1.29.0 (commit 0fd6c573ea81) | MIT | https://github.com/micropython/micropython | no, built by `spike/python/build-micropython.sh` | default Python runtime (Q4) |
| Pyodide | 314.0.7 (release tarball sha256 192b5864…6645) | MPL-2.0 (bundles CPython PSF, numpy/sympy/mpmath BSD-3) | https://github.com/pyodide/pyodide | **YES, prebuilt** wasm and wheels, gitignored `spike/python/_build/` | optional "Python+" pack, download-only, never in F-Droid builds (Q4) |
| Capacitor (`@capacitor/core`, `/android`, `/cli`) | 8.5.3 | MIT | https://github.com/ionic-team/capacitor | npm (Android project generated by `cap add android`, gitignored) | Android shell (Q1); needs API 24+ |
| Vite | 8.3.4 | MIT | https://vite.dev | npm | spike app |
| TypeScript | 7.0.2 | Apache-2.0 | https://www.typescriptlang.org | npm | spike app |
| @playwright/test | 1.64.0 (Chromium 156.0.8078.4, Firefox 157.0 test builds) | Apache-2.0 | https://playwright.dev | npm + browser downloads | benchmark |
| yaml | 2.9.1 | ISC | https://eemeli.org/yaml | npm | benchmark case loader |
| @types/node | 26.6.5 | MIT | DefinitelyTyped | npm | types |

## Build notes and patches
- `engine/giac/build-wasm.sh`: a clean build without GSL (GMP, MPFR, Giac, link; then the old solvers variant) took **3 min 55 s** on 16 cores; with GSL (now the default) it is about 5 min. GMP + MPFR take ≈1 min 55 s; GSL ≈1 min 30 s; Giac compile + link ≈1 min 40 s. All tarballs are SHA-256-checked; GMP, MPFR and GSL GPG signatures were checked by hand against the GNU keyring.
- **Reproducible on this machine:** a second clean build produced bit-identical `giac.wasm` (sha256 `b495feed…abe8` base, `811756ae…42f2` base-solvers); the GSL build was also identical across two builds (`c7d71113…79fb`). Not yet tested across machines or paths.
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
1. **Mirror upload** (decision 2): run the `gh release create …` command from engine/giac/README.md once `gh` is logged in. Until then the build falls back to upstream, which works only while Parisse still serves the pinned snapshot.
2. **Upstream reports for the Parisse email** (send after the device measurements): the `add_evalf` debug log and `UI.addevalf` typo in `gen.cc`; `markup.cc` vs `EMCC2` (can the improved LaTeX exporter be enabled in web builds?); a request for versioned, immutable tarballs.
3. **G2 checks** (the user does these by hand; the G2 never gets connected to the laptop): the list is collected during the night shift in `spike/G2-CHECKLIST.md`. First item: in which order does the G2 show numeric eigenvalues, e.g. `eigenvals([[2.,1.,0.],[1.,3.,1.],[0.,1.,4.]])`?
4. **Devices:** model of the old Android 8/9 tablet; per device SoC, RAM and Android WebView version are recorded by `spike/tools/stay-awake.sh` once connected. Each device must be authorised once by tapping "Allow USB debugging" on its screen (tick "Always allow from this computer").
5. `assumed` values so far: only the remark that V8's lazy wasm compilation explains Chromium's slower first calls. No Prime-behaviour values have been assumed yet.

## Changes made to docs/02 and CLAUDE.md
- CLAUDE.md: "Commands" section filled with the real build, smoke-test, benchmark and device-tool commands; status line; architecture and solver lines now say GSL; `engine/solvers/` removed from the planned layout.
- docs/02: section 4 rewritten for GSL (decision box, solver table, strategy steps; residual check now re-evaluates with Giac/MPFR at 30+ digits, since mpmath is only in the optional Python+ pack); TL;DR table, architecture diagram, sections 7, 9, 11 and 12 (email after device measurements, device list) updated.
- README.md: solver row now says Giac + GSL. THIRD_PARTY.md: GSL is a regular dependency; Boost.Math and cminpack removed; Giac mirror noted.
