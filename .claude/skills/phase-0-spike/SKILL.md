---
name: phase-0-spike
description: Run or continue Pascaline's Phase 0 technical spike. It covers the Giac→WebAssembly build, Capacitor Android shell, MathLive with our own keyboard, the exact-first Home evaluation, the Python runtime, and plotting performance, then writes measured go/no-go results to spike/RESULTS.md. Use when the user asks to start, continue or report on phase 0 or the spike.
---

# Phase 0 spike: de-risk Pascaline before building it

**Goal:** answer the six spike questions from `docs/02-architecture-plan.md` section 7 with **measured numbers on real devices**, then make a go / go-with-native-fallback / no-go decision. The spike code is throwaway and lives in `spike/`. What we keep are the findings, the build scripts that worked, and the pinned versions.

**Time box:** 2–3 weeks of calendar time. If one step gets stuck for more than 2 working days, record the blocker in `spike/RESULTS.md`, take the documented shortcut, and move on.

## Ground rules
- Read `CLAUDE.md` first. The legal and clean-room rules apply to spike code too.
- Record every third-party component with version, licence and source URL in `spike/RESULTS.md` under "Components used".
- Prebuilt binaries (e.g. Parisse's `giacwasm.js`) are **allowed only inside `spike/`** as a shortcut. Gitignore them and flag them in RESULTS.md. The final product must build from source.
- Measurements need device, Android version, build type (debug/release) and the median of at least 5 runs. Never report a single run.
- **Expected values for Prime-like behaviour must not be invented.** Use `source: assumed` and list them for the user to verify on a real Prime or the official Virtual Calculator.
- **Device steps need the user.** If a phone is connected (`adb devices` lists it), you can install builds and read timings via `adb logcat`. Otherwise, ask the user to run the measurement and paste the numbers.

## The six questions and pass criteria
| # | Question | Pass |
|---|---|---|
| Q1 | Giac-wasm cold start and speed in Capacitor on a **low-end** Android phone | Cold start (app launch → engine ready) under about 2 s; typical `solve`/`int`/`factor` under 200 ms |
| Q2 | MathLive driven by **our** keyboard; MathJSON → Giac round-trip | System keyboard never appears; 100% of 200 sample expressions round-trip |
| Q3 | "Exact-first" Home evaluation | Matches the expected Home results on the test set; no case over 500 ms |
| Q4 | Python runtime: MicroPython-wasm start time and size; Pyodide (numpy, sympy) size and start time | MicroPython under 0.5 s; Pyodide under about 4 s after install (it's optional) |
| Q5 | Is GSL included in Giac-wasm? Can Boost.Math + cminpack be linked into the same wasm? | A decision on the solver stack (docs/02 section 4) |
| Q6 | JSXGraph pinch-zoom smoothness with 3 functions | About 60 fps on a mid-range phone, at least 30 fps on low-end |

## Steps

### 0. Repo and toolchain
1. `cd` to the pascaline root. It's already a clone of https://github.com/buerlino/pascaline (`master`, GPL-3.0 `LICENSE` present). Create a branch `spike/phase-0` and add a `.gitignore` (node_modules, dist, android build outputs, `spike/**/prebuilt/`, `*.wasm` outside build output). Commit or push only when the user asks.
2. Install Emscripten:
   ```bash
   git clone https://github.com/emscripten-core/emsdk.git ~/emsdk
   cd ~/emsdk && ./emsdk install latest && ./emsdk activate latest
   source ~/emsdk/emsdk_env.sh   # each shell; never add it to the user's shell rc without asking
   emcc --version
   ```
3. Check the Android toolchain: `ls ~/Android/Sdk/platforms ~/Android/Sdk/build-tools`, `java -version` (21), `adb devices`.
4. Create `spike/RESULTS.md` from the template at the end of this file.

### 1. Giac → WebAssembly (Q5, prerequisite for everything)
1. **Shortcut first (half a day):** get a working Giac in the browser using Parisse's published web build (`giacwasm.js`, see https://www-fourier.univ-grenoble-alpes.fr/~parisse/giacjs/simple.html and https://xcas.univ-grenoble-alpes.fr/backup/install_en). Put it in `spike/prebuilt/` (gitignored). That unblocks steps 2–6 while the source build runs in parallel.
2. **Source build:** download the Giac source (stable tarball from the Giac page, https://xcas.univ-grenoble-alpes.fr/backup/giac.html), plus GMP and MPFR from gnu.org. Look for existing Emscripten build support in the Giac tree and in GeoGebra's Giac repo (github.com/geogebra/giac builds Giac to wasm for GeoGebra; reuse its flags as a reference). Write `engine/giac/build-wasm.sh`, which pins versions and checks SHA-256 hashes. Wrap it in a Docker/Podman image if that's needed for reproducibility.
3. Export a minimal C API: `giac_init()`, `giac_eval(const char*) → char*`, `giac_set_setting(...)`, plus `latex()` output. Test in Node first: `factor(x^4-1)`, `int(1/(1+x^2),x)`, `solve(x^2=2,x)`.
4. Check for GSL: `fsolve(x^3-2,x=1,brent_solver)` and `fsolve([x^2+y^2=4,x=y],[x,y],[1,1],hybrid_solver)`. Record whether the methods work.
5. Try linking Boost.Math (header-only; `toms748_solve` on a C callback) and cminpack (`hybrd1`) into the same wasm. Record size deltas.
6. Record: wasm size (raw/gzip/brotli), build time, any patches needed.

### 2. MathEngine + benchmark (Q1, desktop part)
1. `spike/app`: Vite + TypeScript (+ Svelte 5 if you're testing the framework choice). Put Giac in a Web Worker behind a typed `MathEngine` interface: `eval`, `cancel`, `setSettings`, `latex`.
2. Cancellation: terminate the worker on Cancel, then restart it and replay variable definitions from a log kept outside the worker. Measure restart time.
3. Benchmark set `spike/bench/cases.yaml` with about 50 typical calculator inputs (arithmetic, trig, `solve`, `int`, `diff`, `limit`, `factor`, matrix ops, regressions). Report p50/p95 in desktop Chromium (Playwright) and Firefox.

### 3. Capacitor Android shell (Q1, device part)
1. In `spike/app`: `npm i @capacitor/core @capacitor/cli @capacitor/android`, `npx cap init Pascaline org.pascaline.app --web-dir dist`, `npx cap add android`, `npm run build && npx cap sync android`, `cd android && ./gradlew assembleDebug` (and `assembleRelease` with a throwaway key; use release builds for timing).
   The `org.pascaline.app` ID is a placeholder until the domain is checked. It must not be published.
2. Add timing marks (`performance.now()` → `console.log` → `adb logcat`): process start, WebView ready, wasm compiled, engine ready, first result.
3. Measure on a **low-end** device (e.g. 3–4 GB RAM, Android 10–12) and a **mid-range** one. Ask the user which phones are available.

### 4. MathLive with our keyboard (Q2)
1. Make sure the system keyboard never shows: set MathLive `mathVirtualKeyboardPolicy = "manual"`, suppress the native input method (test `inputmode="none"` behaviour in WebView), and keep focus and the caret working.
2. Prototype keyboard: a 4×6 subset of the Prime's logical layout (digits, operators, x^y, √, fraction template, parentheses, sin/cos/tan, shift layer, Enter, backspace, cursor keys). Our own styling. Keys call `mf.executeCommand(['insert', …])` / `mf.executeCommand('moveToNextChar')`, etc.
3. Serializer prototype: LaTeX → MathJSON (Compute Engine) → Giac string. Round-trip test over 200 expressions (`spike/serializer/cases.yaml`). Equality check: Giac `simplify((a)-(b))==0`, plus numeric evaluation at 3 random points when simplify can't decide.
4. Note gaps (implicit multiplication, function names, `ln` vs `log`, `e`/`i`, derivatives, integrals, matrices, units).

### 5. Exact-first Home evaluation (Q3)
1. Implement `homeEval(input, settings)`: convert decimal literals to exact rationals, evaluate exactly in Giac, approximate to 12 significant digits at the end. Guard: if any intermediate numerator or denominator goes over 20 digits, or time goes over the budget, re-evaluate in float mode (higher precision) and round.
2. Test set `spike/home/cases.yaml` with about 100 cases. Include the binary-float traps (`1-0.9-0.1`, `(1/3)*3`, `0.1+0.2`, `0.1*3`), transcendental functions, big and small exponents, loops and sums that blow up rationals (`sum(1.1^k,k,1,500)`), degree and radian modes, and complex results. Expected values come from `oracle` (mpmath at 30 digits, rounded to 12) or `derived`. Prime-specific display expectations are marked `assumed` and listed for the user to verify.
3. If the pass criteria fail, prototype the decimal.js fallback for basic arithmetic and compare.

### 6. Python runtime (Q4)
1. MicroPython: build `ports/webassembly` from the MicroPython repo with emsdk. Measure size and start time, and run a sample program with a stub `calc` module (`calc.cas("factor(x^2-1)")` routed to the Giac worker via messages).
2. Pyodide (optional pack): load it from local assets (no CDN) in the Capacitor app with numpy + sympy. Measure download size and start time on both phones. Note the scipy size but don't bundle it.

### 7. Plotting (Q6)
1. Draw `sin(x)`, `x^3-2x`, `1/x` with JSXGraph in the Capacitor app. Add pinch zoom and pan, plus an FPS overlay (`requestAnimationFrame` counter). Use Compute Engine `compile()` (or a Giac-generated JS function) for point evaluation.
2. Measure on both phones.

### 8. Write up and decide
1. Fill in `spike/RESULTS.md` completely (template below).
2. Update `docs/02-architecture-plan.md` wherever the spike changed a decision (solver stack, Home engine, Python default, UI framework, performance fallback). Add pinned versions and real commands to `CLAUDE.md` (Commands section).
3. Give the user a one-paragraph summary and a recommendation: **go**, **go with native-Giac fallback**, or **no-go**, with the numbers behind it.

## `spike/RESULTS.md` template
```markdown
# Phase 0 spike results
Date range: … | Devices: low-end = …, mid-range = … | Build: release/debug

## Decision
GO / GO WITH NATIVE FALLBACK / NO-GO, plus one paragraph explaining why.

## Results per question
| # | Question | Measured (median of ≥5) | Pass? | Notes |
|---|---|---|---|---|
| Q1 | Giac-wasm cold start / ops | low-end: … s, … ms p50 / mid: … | | |
| Q2 | MathLive + own keyboard; round-trip | …/200 | | gaps: … |
| Q3 | Exact-first Home | …/100, max … ms | | |
| Q4 | MicroPython / Pyodide | … s, … MB / … s, … MB | | |
| Q5 | GSL in Giac-wasm? Boost.Math + cminpack linked? | yes/no, +… KB | | solver decision: … |
| Q6 | Plot FPS | low-end … / mid … | | |

## Components used (name, version, licence, URL, prebuilt?)
## Build notes and patches
## Open questions for the user (incl. `assumed` values to verify on a real Prime)
## Changes made to docs/02 and CLAUDE.md
```
