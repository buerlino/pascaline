# Pascaline: architecture and project plan

*Pascaline is an open-source graphing CAS calculator that feels like an HP Prime: a "spiritual clone". The name comes from Blaise Pascal's 1642 calculating machine and was chosen on 2026-10-10.*

*Date: 2026-10-10. This follows up [01-feasibility-report.md](01-feasibility-report.md) and replaces its "1:1 clone" approach. The legal advice (section 3 of 01-feasibility-report.md) still applies.*

**New goal:** an app that *feels* like an HP Prime G2, with the same key layout, the same apps and the same functions, but with our own look and name. It doesn't have to be bit-for-bit identical, it may improve on the original, and it should be built **mostly from existing open-source projects** to keep development time low.

---

## 1. TL;DR: the recommended approach

**Build it as a web app wrapped in a native Android shell (Capacitor)**, using the same engine the real Prime uses (Giac) compiled to WebAssembly, and well-known open-source JS libraries for everything else.

| Prime feature | We reuse | Licence |
|---|---|---|
| CAS **and** Home calculations | **Giac** (the Prime's real CAS) compiled to WebAssembly (`giacwasm.js`, already maintained by Parisse) | GPLv3 |
| Textbook-style 2D math entry ("MathPrint") | **MathLive** (math editor web component) + our own small LaTeX-subset parser to Giac (decided 2026-10-11, replaces Compute Engine) | MIT, GPLv3 |
| Pretty-printed results (MathPrint) | Giac `latex()` output, rendered by MathLive's static renderer | MIT |
| Function / Parametric / Polar / Sequence / Advanced Graphing / 3D plots | **JSXGraph** (2D, implicit curves, 3D view) | LGPL / MIT dual |
| Geometry app | **JSXGraph** (interactive geometry) + Giac (symbolic geometry) | LGPL / MIT, GPLv3 |
| Numerical solver (Solve app) | Giac `fsolve`/`proot` with **GSL** (GNU Scientific Library) compiled into the same wasm (section 4) | GPLv3 |
| Statistics 1Var/2Var, regressions, distributions | Giac (has them all) + **jStat** for hypothesis tests | GPLv3, MIT |
| Spreadsheet | **Jspreadsheet CE** grid, formulas evaluated by Giac | MIT |
| Programming | **MicroPython** compiled to wasm as the default (small, instant start, builds from source for F-Droid), plus optional **Pyodide** "Python+" pack (CPython with numpy, sympy, mpmath, scipy). See section 11.5. | MIT; MPL-2.0 (+BSD) |
| Code editor | **CodeMirror 6** | MIT |
| Android, iOS and desktop packaging | **Capacitor** | MIT |

**PPL: drop it.** Python replaces it, as section 3 explains. This one decision saves about 5–8 person-months, and it's the better language for a phone app.

**Effort:** about **26–41 person-months** for the full spiritual clone, down from 52–85 for the 1:1 clone. An **MVP** (keyboard, Home/CAS, Function app, Solve app, Python) takes about **6–9 person-months**. Most of the time saved comes from not writing a math engine, a decimal engine, a language interpreter, a math editor, a geometry engine or a plotting library.

We also get **web, iOS and desktop versions for nearly free**, because it's the same codebase.

---

## 1b. Does something like this already exist? (checked 2026-10-10)

| Existing project | What it is | Why it's not "the Prime on Android, open source" |
|---|---|---|
| **HP Prime Pro / Lite** (Moravia) | Official app with the full Prime | Closed source and paid. **Gone from Google Play since about October 2024**, with Android problems since late 2023. Still on iOS. It could come back. |
| **HP Prime Virtual Calculator** | Official desktop simulator (Windows, macOS, Linux beta), v2.4.15515 | Closed source, desktop only |
| **PrimeU2** (GitHub) | Open-source emulator that runs HP's *original firmware* | Needs HP's firmware, which is legally grey to distribute. It's a research tool, not an app. |
| **Xcas Pad** (Android) | Giac on Android with a worksheet UI, by L. Hernandez | Worksheet style, not a calculator. Tablet-oriented, last activity seen around 2018. |
| **KhiCAS** (Parisse) | Giac + calculator UI on Casio, TI and NumWorks hardware | Runs on calculators (and in a browser via the NumWorks emulator). No Prime UX, no Android app. |
| **GeoGebra Calculator Suite / CAS** | Free, polished, offline, uses **Giac** too: graphing, CAS, geometry, 3D | Not open source as a whole. Worksheet/touch UX, not a calculator keyboard. **This is the strongest competitor on features.** |
| **NumWorks app** | Free official emulator of the NumWorks calculator for Android/iOS | NumWorks UX and functions (no CAS), non-commercial licence |
| **Qalculate!, microMathematics Plus, ArityCalc** (F-Droid) | Open-source maths apps | Excellent, but none is a graphing CAS *calculator* with apps |

**Verdict:** I found **no open-source, Prime-style graphing CAS calculator for Android**. The niche is free. But the *functionality* is already available for free through GeoGebra, Desmos and Wolfram Alpha. Our differentiators are the **calculator keyboard and Prime workflow** (muscle memory for Prime owners), **fully open source and offline** with no tracking, **F-Droid**, Python, and result verification. Phones aren't allowed in exams, so the audience is Prime owners, HP enthusiasts, FOSS users and students doing homework. That's a real but niche audience, so this is a good open-source or portfolio project, not a business.

---

## 2. Options I considered

| Option | Description | Verdict |
|---|---|---|
| **A. Fork KhiCAS** | Parisse's calculator front-end for Giac. It already has a CAS shell, 2D editor, 2D/3D graphs, interactive geometry, spreadsheet, finance app and MicroPython, all for **320×240 calculator screens** (the Prime's resolution). It runs in browsers via the NumWorks/Upsilon emulator. | **Fastest to *something* (2–4 PM)**, but the UX is KhiCAS's, not the Prime's (no Symb/Plot/Num app model, weak touch support). The code is dense C++ written mostly by one person and hard to reshape. Worth studying and borrowing from, but not a good base for "Prime in disguise". |
| **B. Web stack + Capacitor** *(recommended)* | Giac-wasm, MathLive, JSXGraph, Pyodide and so on. Our code is the UI, keyboard, app framework and the glue. | **Most reuse, fastest path to a polished Prime-like UX**, and cross-platform. Risks: WebView performance on cheap phones, and Pyodide download size. Both get checked in a 2–3 week spike (section 7). |
| **C. Native Kotlin/Compose + Giac via NDK + Chaquopy (CPython)** | Fully native app. | Best raw performance, but there's **no open-source native math editor, geometry engine or plotting library** of comparable quality, so we'd build those ourselves (+8–12 PM). Keep it as a fallback: our engine interface allows swapping in native Giac later (section 6.3). |
| Others | **GeoGebra** (GPL code, but its non-free assets, size and complexity make it a poor fit); **Qalculate/libqalculate** (great units and precision, but it duplicates Giac); **NumWorks Epsilon** (CC BY-NC-SA, *not* open source and not GPL-compatible, so don't use it) | Rejected |

---

## 3. PPL or Python?

**Recommendation: Python only**, plus Giac's built-in function definitions. No PPL.

Why:
- **Users:** students already learn Python at school. Very few people learn PPL unless they own a Prime.
- **HP went the same way.** The Prime itself added a Python app (MicroPython) in firmware 2.x.
- **Ecosystem:** with Pyodide we get *real* CPython with `numpy`, `sympy`, `mpmath`, `fractions`, `decimal` and (optionally) `scipy`. That's a big step up from the Prime, which only has MicroPython at roughly Python 3.4 level.
- **Cost:** a PPL interpreter with graphics, debugger and editor is about 5–8 PM. Pyodide integration plus our calculator module is about 2–3 PM.
- **Simple programs need no language at all.** `f(x):=x^2+1`, piecewise functions and loops work in Giac directly, the same way the Prime's CAS does it.

What we add on top of Python:
1. A **`calc` module** that reads and writes calculator variables (A–Z, L1…, M1…, app functions F1–F9), calls Giac (`calc.cas("factor(x^4-1)")`), opens menus and reads keys.
2. An **`hpprime`-compatible graphics module** that draws on a 320×240 canvas (`fillrect`, `line`, `circle`, `textout`, `pixon`, `blit`, `keyboard`, `mouse`…). Many existing Prime Python programs would then run unchanged. That's a cheap compatibility win that touches no HP code: we just implement the same function names.
3. Later: **"Python apps"**, where users write their own app with Symb/Plot/Num hooks in Python, our equivalent of Prime user apps.

**If PPL ever matters:** a community **PPL→Python transpiler** for importing old `.hpprgm` programs can be an optional add-on (about 1–2 PM). It's not part of the core.

---

## 4. The numerical solver: which open-source project?

Yes, there are several excellent ones. The Prime's **Solve app** needs three solver types. Here's what to use for each:

> **Decided 2026-10-10 (Phase 0 spike, Q5):** GSL, linked into Giac's wasm, is the solver library. Boost.Math + cminpack were tested and work (+5 KB brotli), but MINPACK's licence has an acknowledgment clause whose GPL compatibility we didn't want to depend on. GSL is GPL-3.0 like Giac, covers the same algorithms, and Giac already calls it through `fsolve`. Cost: +68 KB brotli (≈3% of the engine). Details: [spike/RESULTS.md](../spike/RESULTS.md).

| Problem | What the Prime does | Our solver | Why |
|---|---|---|---|
| **One equation, one unknown** (e.g. `x·eˣ = 5`, solve for `x` near a guess) | Iterates from the user's guess | Our bracket search, then **Brent** (GSL, via Giac `fsolve(…, x=a..b, brent_solver)`, guaranteed convergence); **Newton/secant/Steffensen** (GSL/Giac) with **exact derivatives from Giac** when there is no sign change | GSL's root finders are standard, well-tested implementations. Exact symbolic derivatives make Newton very robust. |
| **System of N equations, N unknowns** | Newton-type iteration from guesses | **GSL `hybrids` / `hybridsj`** (Powell's hybrid "dog-leg" method, the algorithm behind MINPACK and `scipy.optimize.fsolve`), via Giac `fsolve(…, hybrids_solver)` | Robust from poor starting guesses; Giac supplies the exact Jacobian for the `j` variants. |
| **Polynomials** (all roots, including complex) | `proot` / CAS | **Giac `proot`** (already included). Optionally **MPSolve** (GPLv3) for certified high-degree roots | `proot` covers calculator needs; MPSolve is overkill unless we want "certified" roots. |
| Least-squares fits / overdetermined systems | Statistics regressions | Giac's regression commands; for general nonlinear fits later, a small wrapper around GSL's nonlinear least squares (Levenberg–Marquardt) | Same library, no extra dependency |

Without GSL, Giac's wasm build only has Newton and interval bisection; every other `fsolve` method fails with "Not linked with GSL" (measured in the spike). Linking GSL changed none of the 55 benchmark results; numeric eigenvalue/eigenvector/SVD output comes out in a different (still correct) order or sign, and Airy functions gain numeric values.

The **Python app** gets `scipy.optimize` (`brentq`, `root`, `least_squares`) and `mpmath.findroot` (arbitrary precision) for free.

**An improvement over the Prime:** after every numeric solve, we **plug the root back into the equation** (the residual check) and re-evaluate with **Giac at 30+ digits** (MPFR; mpmath is only available when the optional Python+ pack is installed). If the residual is not tiny, we show a ⚠ next to the answer. The real Prime silently returns wrong roots in some known cases (see 01-feasibility-report.md section 6), so this check directly addresses "how do we avoid wrong answers?".

**Solver strategy for a single equation:**
1. Use Giac to get exact `f(x)` and `f'(x)`. For the many evaluations of the bracket search, compile both to fast JS functions with our LaTeX-subset parser's evaluator (or evaluate in Giac if that's fast enough; measure). Numbers shown to the user always come from Giac.
2. Starting from the guess, expand outward until the sign changes (bracket search).
3. If a bracket is found, run **Brent** (GSL via Giac `fsolve`). It's guaranteed to converge.
4. If there's no sign change (a double root like `x² = 0`), run **Newton** (or Steffensen) with the exact derivative and damping.
5. Polish the result with Newton at high precision (Giac `evalf` with more digits or mpmath), then run the residual check.
6. Report the result, the residual, and which method was used (visible as an "info" line, like the Prime's "Zero"/"Sign reversal" messages).

---

## 5. Mapping every Prime app to reused components

| Prime app / feature | Built from | Our own work |
|---|---|---|
| **Home view** | Giac in "exact-first" mode (section 6.2), 12-digit display (configurable, an improvement) | History UI, settings, Ans, variables |
| **CAS view** | Giac (same commands as the Prime CAS, since it's the same engine) | History, CAS settings page |
| **Textbook entry (MathPrint)** | MathLive with **our** on-screen keyboard driving it; our LaTeX-subset → Giac parser | Parser grammar (one rule + one round-trip case per keyboard template), templates key |
| **Function, Parametric, Polar, Sequence** | JSXGraph plots, our parser's evaluator for fast point evaluation, Giac for roots/extrema/area ("Fcn" menu) | Symb/Plot/Num framework, trace, zoom, tables |
| **Advanced Graphing** (implicit curves, inequalities) | JSXGraph `implicitcurve` and inequality shading; optional interval arithmetic library for robust plotting | Equation classification |
| **Graph 3D** | JSXGraph 3D (`view3d`), or three.js if we need more | Camera controls |
| **Geometry** | JSXGraph constructions; Giac for symbolic answers (equations, exact lengths) | Prime-style tool menus |
| **Solve, Linear Solver, Triangle Solver** | Section 4 solvers; Giac `linsolve`/`rref`; simple trigonometry | Small UIs |
| **Statistics 1Var / 2Var** | Giac (`mean`, `stddev`, `median`, `linear_regression`, `exponential_regression`, `polynomial_regression`, …) | Data editor, plot types (histogram, box plot, scatter) |
| **Inference** (tests, confidence intervals) | jStat + Giac distributions (`normald_cdf`, `studentd_icdf`, `chisquare_cdf`…) | Test wizards (about 2 weeks) |
| **Finance** (time value of money, amortization) | Our own small TVM module (well-known formulas) + the section 4 solver; cross-checked against `numpy-financial` in tests | About 1 week |
| **Spreadsheet** | Jspreadsheet CE grid + Giac evaluation (Prime-style formulas, even symbolic ones) | Cell dependency graph |
| **Explorers** (Linear/Quadratic/Trig) | JSXGraph sliders | Small |
| **Units, constants** | Giac (Prime CAS units are Giac units, e.g. `_m`, `_s`) | Units menu |
| **Lists, matrices** | Giac | List/matrix editors (grid) |
| **Python** | MicroPython (default, D6) + `calc` and `hpprime`-compatible modules + CodeMirror editor; Pyodide "Python+" (numpy) as an optional download | Section 3 |
| **Help** | Giac ships short help with syntax and examples for every command (as in Xcas/KhiCAS); *check the licence*, which is likely GPL like the rest of Giac | Help texts for apps and keys |
| **Notes** | CodeMirror (Markdown) | Small |
| **Keyboard** | — | **Ours.** Same logical layout as the Prime, our own visual design |
| **RPN entry mode** | Giac operations on a stack | About 2–3 weeks (Phase 2) |
| **Exam mode, USB connectivity, `.hpprgm` files** | — | **Dropped.** Not useful on a phone. |

---

## 6. Architecture

```
┌──────────────────────────── Capacitor shell (Android / iOS / desktop / plain web) ─────────────────────────────┐
│                                                                                                                │
│  UI thread (TypeScript)                                                                                        │
│  ┌──────────────┐ ┌───────────────┐ ┌────────────────────────┐ ┌────────────────┐ ┌──────────────────────────┐ │
│  │ Keyboard     │ │ MathLive      │ │ App framework          │ │ JSXGraph views │ │ Spreadsheet / editors    │ │
│  │ (shift/alpha │ │ entry+output │ │ Symb / Plot / Num      │ │ 2D/3D/geometry │ │ CodeMirror (Python)      │ │
│  │  layers)     │ │ output        │ │ app registry, settings │ │                │ │                          │ │
│  └──────┬───────┘ └───────┬───────┘ └───────────┬────────────┘ └────────┬───────┘ └────────────┬─────────────┘ │
│         └─────────────────┴──────── MathEngine interface (async) ───────┴──────────────────────┘               │
│                     │                                             │                                            │
│  Web Worker 1: giac.wasm (+ GSL, GMP, MPFR)               Web Worker 2: Python (MicroPython; Pyodide optional) │
│  - eval / exact / approx / latex()                        - numpy, sympy, mpmath (+ scipy on demand)           │
│  - solve, fsolve, regressions, units...                   - calc / hpprime modules → message bridge            │
│                                                                                                                │
│  Storage: IndexedDB (history, variables, app data) + Capacitor Filesystem (import/export, share)               │
└────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 6.1 Principles
1. **All maths goes through one async `MathEngine` interface.** The UI never calls Giac directly, so we can swap the engine implementation (option C) without touching the UI.
2. **Engines run in Web Workers.** The UI never freezes, and the "ON/Cancel" key can abort a calculation that runs too long (terminate the worker, then restore its variable state from our own store).
3. **Same logical key layout as the Prime, our own design.** The layout lives in a data file (`keyboard.yaml`: key → primary/shift/alpha actions), so we can tweak layouts, offer a portrait/landscape variant, and let advanced users remap keys.
4. **Not stuck at 320×240.** We use the phone's full resolution and landscape mode. Only the Python `hpprime` graphics module uses a 320×240 virtual canvas, for compatibility.

### 6.2 Home calculations: "exact-first" in Giac, with no separate decimal engine
The real Prime has a separate 12-digit decimal engine so that `1 − 0.9 − 0.1` gives `0`. Plain binary floats would give `−2.8E−17`. Writing our own decimal engine plus ~400 functions would cost 6–9 PM. Instead:
- Read decimal numbers typed by the user as **exact fractions** (`0.9` → `9/10`), compute exactly in Giac, and convert to decimal only at the end, showing 12 significant digits. That gives `1−0.9−0.1 = 0` and `(1/3)·3 = 1`. Firmware 2.4 recently added the same idea to the Prime.
- **Guard:** if fractions grow too large (more than about 20 digits) or exact evaluation exceeds a time budget, fall back to Giac floats at higher precision, then round. The Prime 2.4 also switches to decimals at about 19 digits.
- Transcendental functions (sin, ln…) are evaluated with extra digits, then rounded to the display precision.
- This needs to be **validated in the spike** (performance in loops and big sums). The fallback, if it fails, is **decimal.js** (MIT; arbitrary-precision decimal *including* trig/exp/ln) for basic Home arithmetic only.

### 6.3 Performance fallback
Giac in WebAssembly is about **2× slower than native, and sometimes 15× slower** on heavy algebra (e.g. Gröbner bases). For calculator-sized problems that's still fast on a modern phone. If the spike shows problems on low-end devices, we add a **Capacitor native plugin** that runs Giac compiled with the NDK behind the same `MathEngine` interface. The UI doesn't change.

---

## 7. Phase 0: spike (2–3 weeks) to de-risk before committing

| # | Question | Pass criterion |
|---|---|---|
| 1 | Does Giac-wasm load fast in a Capacitor app on a **low-end Android** (e.g. 3–4 GB RAM device)? | Cold start under about 2 s; `solve`, `int` and `factor` typical cases under 200 ms |
| 2 | Does MathLive work with **our** keyboard (no system keyboard), and does the MathJSON→Giac round-trip hold up for 200 sample expressions? | 100% round-trip on the sample set |
| 3 | Does "exact-first" Home evaluation (section 6.2) give Prime-like results without slowdowns? | Matches the Prime on 300 golden Home cases, no case over 500 ms |
| 4 | Pyodide: download size and start time with numpy/sympy; how big is scipy? | Python app opens under about 4 s after the first install; scipy offered as optional download |
| 5 | Is GSL included in Giac-wasm (`fsolve` methods)? Can Boost.Math and cminpack be linked into the same wasm? | Decide the solver stack from section 4. **Done 2026-10-10: GSL** |
| 6 | Plotting smoothness: JSXGraph pinch-zoom with 3 functions | 60 fps on a mid-range phone |

---

## 8. Effort: refined estimate

PM = person-months, experienced TypeScript developers with some maths background.

| Work package | PM |
|---|---|
| Phase 0 spike | 0.75 |
| Shell: keyboard + layers, menus/Toolbox/Catalog, history, settings, persistence, theming | 3–4 |
| Math entry/output: MathLive integration, LaTeX-subset → Giac parser, LaTeX output (MathPrint) | 1.5–2.5 |
| Home + CAS views on Giac (exact-first, Prime-style function aliases) | 1.5–2.5 |
| App framework (Symb/Plot/Num, zoom, trace, tables) | 2–3 |
| Function, Parametric, Polar, Sequence | 2–3 |
| Solve + Linear/Triangle Solver + Finance (section 4) | 1.5–2.5 |
| Statistics 1Var/2Var + Inference | 2–3 |
| Advanced Graphing | 1–2 |
| Geometry | 2.5–4 |
| Graph 3D | 1–1.5 |
| Spreadsheet | 1–2 |
| Python app (Pyodide, editor, `calc`/`hpprime` modules) | 2–3 |
| Help (reuse Giac's, write app help) | 0.5–1.5 |
| Testing infrastructure (section 9) | 2–3 |
| Polish, i18n, accessibility, store releases | 1.5–2.5 |
| **Total** | **≈ 26–41 PM** |

**Phases**
- **MVP (≈ 6–9 PM):** keyboard, Home, CAS, textbook entry, Function app, Solve app, Python (numpy/sympy). Release on Play (testing track) and as a web app.
- **v1 (≈ +10–15 PM):** Stats, Inference, Parametric/Polar/Sequence, Spreadsheet, Finance, Linear/Triangle solvers, RPN.
- **v2 (≈ +10–17 PM):** Geometry, Advanced Graphing, 3D, Python apps, Explorers, polish.

With 2 developers, MVP is about 4 months and the full app about 1.5 years. With 3–4 developers, the full app takes about 9–12 months.

---

## 9. Bugs: what changes with the reuse approach

Most of the maths is now **well-tested third-party code** (Giac is used by GeoGebra and HP, millions of users; GSL, GMP/MPFR, numpy). Our biggest bug risk moves to the **glue**: the LaTeX → Giac parser, exact-first evaluation, app logic, and settings handling.

1. **Parser round-trip fuzzing:** generate random expressions → LaTeX → Giac → `latex()` → MathLive → LaTeX → Giac, and check equality with Giac `simplify(a-b)==0` plus numeric spot checks.
2. **Cross-engine oracle tests:** run the same question through Giac and through **SymPy/mpmath** (we ship them anyway in Pyodide; in CI they run natively). Disagreements get reviewed by a human.
3. **Self-check in the product:** residual checks after `solve`/`fsolve` (section 4), and `diff(int(f)) == f` checks in tests.
4. **A small golden set from a real Prime** (a few hundred to a few thousand cases for Home/CAS/Solve/Stats), so that "feels like a Prime" stays true. That's enough for a spiritual clone; no need for 40k cases.
5. **Upstream first:** report and fix Giac bugs upstream with Parisse, so the whole Giac community benefits and our fork stays small.
6. **UI tests:** Playwright key-sequence scripts (e.g. "2 Shift x² ENTER" shows `√2 … 1.41421356237`) with screenshot diffs, run in CI on desktop Chromium plus an Android emulator.
7. **In-app "report wrong result"** that exports the expression, settings and engine version as a ready-made test case.

---

## 10. Legal, revisited for the spiritual clone

The risk is now **lower** than for the 1:1 clone. We have no file-format reverse engineering, no PPL compatibility claims, and our own look. Remaining rules:
- No "HP" or "Prime" in the name, icon or store title. Nominative mention in the description is fine ("familiar to HP Prime users; not affiliated with HP Inc. or Moravia").
- Same **logical** key layout, our own colours, shapes and icons.
- The whole app is **GPLv3** (because of Giac). All other components listed (MIT, BSD, BSL, MPL-2.0, LGPL/MIT, Apache-2.0) are compatible.
- **F-Droid caveat:** F-Droid requires everything to be built from source on its servers. Giac-wasm and Pyodide are large builds, so F-Droid packaging means extra build work. Google Play and GitHub Releases are straightforward.

---

## 11. Languages, WebAssembly, distribution and licence

### 11.1 What we write code in
| Language | Share of *our* code | Used for |
|---|---|---|
| **TypeScript** | ~85% | UI, keyboard, app framework (Symb/Plot/Num), all apps, glue to the engines, tests (Vitest, Playwright) |
| **C++** | ~1–5% (thin wrappers) | Emscripten bindings around Giac (and GSL if we ever call it directly). Giac itself is existing code we compile, not code we write. |
| **Python** | ~5% | The `calc` and `hpprime` modules that run *inside* the Python app |
| **Kotlin** | ~0–5% | Only if a Capacitor native plugin is needed (e.g. a native Giac fallback, file sharing) |
| CMake / shell / YAML | build | Wasm build scripts, CI, F-Droid recipe |

### 11.2 What WebAssembly actually is (it isn't native code)
- Emscripten compiles Giac's C++ (plus GMP, MPFR and GSL) to a **`.wasm` file**. That file is a portable, sandboxed bytecode, *not* machine code.
- At load time, the browser engine (V8 in Android WebView/Chrome, JavaScriptCore in Safari) compiles the wasm to **real machine code** for the device's CPU. The result runs close to native speed. For Giac that means about 2× slower than a native build, and up to 15× on heavy algebra.
- One `.wasm` file runs on every platform (ARM/x86, Android/iOS/desktop/web). That's the whole point, and it's why we don't need per-ABI native builds.
- If a device turns out too slow, the fallback is native Giac via the NDK behind the same `MathEngine` interface (section 6.3).

### 11.3 One codebase, several release channels
The same web build (`dist/`) is shipped in different wrappers:

| Channel | How | Notes |
|---|---|---|
| **Web / PWA (all platforms)** | Static hosting (e.g. Codeberg/GitHub Pages) + service worker for offline use + web app manifest | **Android:** Chrome installs it as an app, works offline. **iOS/iPadOS:** "Add to Home Screen" in Safari works offline, but there's no install prompt and storage/memory limits are stricter, so test with the full Giac + Python download. **Desktop:** installable from Chrome/Edge. |
| **Android APK/AAB** | Capacitor wraps `dist/` into a native app | Google Play, F-Droid, IzzyOnDroid, GitHub Releases |
| **iOS App Store** | Capacitor iOS | **Problematic because of GPLv3** (11.4). Use the PWA for iOS unless the Giac authors grant an exception. |
| **Desktop app** (optional) | Capacitor/Electron or just the PWA | PWA is usually enough |

### 11.4 Licence: GPL-3.0-or-later
- **Yes, GPLv3 is required**, because Giac is GPLv3. Use **`GPL-3.0-or-later`** for our code (same as Giac). All other components (MIT, BSD, BSL-1.0, Apache-2.0, MPL-2.0, LGPL/MIT) are compatible.
- **Source for every channel:** the PWA also *distributes* our JS/wasm, so the app needs an "About → Source code" link to the exact tagged version, and the licence text has to be shipped.
- **Apple App Store conflict:** Apple's terms add usage restrictions that the FSF considers incompatible with the GPL (VLC was pulled from the App Store over this in 2011). We don't own Giac's copyright, so **we can't grant an App Store exception ourselves**. Options: (1) iOS via PWA only, (2) ask Parisse and De Graeve for a written exception or a licence (they already dual-license Giac commercially).
- **Contributions:** require a DCO sign-off ("Signed-off-by") in commits to keep provenance clear. That also supports the clean-room rules in 01-feasibility-report.md section 3.2.

### 11.5 Releasing on F-Droid
**F-Droid main repository rules:** everything is FOSS, **F-Droid builds the APK from our source on its own build server**, the source tree contains **no prebuilt binaries** (no committed `.wasm`, `.so` or `.jar` blobs), and there are no proprietary dependencies (no Google Play Services, Firebase, Crashlytics or closed analytics). Precedents in `../fdroiddata`: Capacitor apps (`com.graphhopper.maps`, `com.logseq.app`) and Emscripten builds (`net.alexbarry.alexgames` installs Debian's `emscripten` package in the build VM).

**Steps:**
1. Public repo on Codeberg or GitHub, with release tags (`v1.2.0`) and `versionCode`/`versionName` in `android/app/build.gradle`.
2. Store texts and screenshots in the repo as **fastlane metadata** (`fastlane/metadata/android/en-US/…`), which F-Droid reads automatically.
3. **One build script** (`build.sh`) that goes from clean source to `dist/`: install npm dependencies, compile Giac + GMP + MPFR + GSL with Emscripten (`engine/giac/build-wasm.sh`), run `vite build`, run `npx cap sync android`.
4. Write `metadata/<appId>.yml` in fdroiddata, modelled on the GraphHopper and alexgames recipes: `sudo:` installs npm and **Debian's emscripten** (decided 2026-10-11: every release, ours included, builds the engine with Debian's Emscripten in a pinned `debian:trixie` container, so all channels ship the same engine; emsdk is for development only), `prebuild:` runs `build.sh`, `scandelete:` removes `node_modules`, `gradle: [yes]`, plus `AutoUpdateMode: Version` and `UpdateCheckMode: Tags`.
5. Test locally with fdroidserver (`fdroid build -v -l <appId>`) against your fdroiddata checkout, then open a merge request at gitlab.com/fdroid/fdroiddata.
6. Optional: **reproducible builds** (pinned toolchain versions, deterministic Emscripten output). Then F-Droid can publish **our** signed APK, and users can switch between GitHub, Play and F-Droid without reinstalling.

**Our specific F-Droid challenge is Python.** Building Pyodide (CPython + numpy + scipy for wasm) from source on F-Droid's build server is very heavy and probably impractical. Downloading it at runtime from a CDN may be flagged by F-Droid reviewers, so ask them before relying on it. Recommended plan:
- **Use MicroPython (MIT) as the default Python in all builds.** It compiles to wasm in minutes with Emscripten, starts instantly, is what the real Prime uses, and Giac's web version already integrates it.
- Offer **Pyodide (CPython + numpy/scipy) as an optional "Python+" pack** in the PWA and Play builds. Add it to F-Droid only if a from-source build turns out feasible.

**Faster first step:** **IzzyOnDroid** (an F-Droid-compatible third-party repo) accepts the APK we build ourselves from GitHub Releases. Ship there first, while the main F-Droid recipe is being reviewed.

---

## 12. Next steps
1. ~~Pick a name~~ **Pascaline** (2026-10-10). Before going public: check Google Play, the App Store, GitHub/Codeberg, trademark databases (EUIPO, WIPO, Swiss IGE, class 9) and domains. ~~Create the repo~~ https://github.com/buerlino/pascaline (GPL-3.0). README.md and CONTRIBUTING.md (clean-room rules, DCO sign-off) written 2026-10-10.
2. Email **Bernard Parisse** with the device numbers: tell him about the project, ask about the help-file licence and KhiCAS reuse, and pass on the upstream reports collected in the spike (spike/RESULTS.md, "Open questions").
3. ~~Run the Phase 0 spike~~ Done 2026-10-11 on the low-end Lenovo Tab One: **GO**, no native fallback needed (spike/RESULTS.md). The Fairphone 6 (mid-range) and the old Android 8/9 tablet are measured whenever they're connected, alongside Phase 1.
4. **Phase 1, milestone 1: MathPrint Home + CAS** (decided 2026-10-11). The real app in `app/` (Svelte 5 shell, plain-TS keyboard, parser and engine client), with:
   - textbook entry: stacked fractions, raised exponents, root signs, driven only by our keyboard. On the reference calculator the ÷ key makes a stacked fraction (seen on a G2, 2026-10-11), so ours does too;
   - a **Home** view whose results are decimals (on a G2, `1÷3` gives `0.333333333333`) from exact-first evaluation, and a **CAS** view whose exact results are drawn in 2D (fractions, roots, powers, matrices);
   - history, Cancel, settings (digits, angle, number format, a one-line entry mode);
   - `spec/keyboard.yaml` as the single source of the key layout (positions not yet checked on a G2 are marked `assumed`); `tests/golden/` as the single golden-case format (spike/DECISIONS.md D8);
   - `build.sh` from clean source to APK, with the engine built by Debian's Emscripten.
   Bar: on the Tab One (release build), cold launch → keyboard usable < 1 s and → engine ready < 1.5 s; Enter → drawn result p95 < 150 ms on the 55 benchmark inputs.
   **Done 2026-10-11** (`phase-1`, shift report docs/shifts/2026-10-11-report.md): every item above, verified. On the Tab One (release): keyboard usable 653–667 ms, engine ready 1.0 s (1.29 s with a full 200-entry history), Enter → drawn p95 92 ms (114 ms with a full history). The release engine is built in the container (P2 met) and is bit-reproducible. Left over: the a/b mixed-number form, alpha lock, a literal-caret one-line mode.
5. **Phase 1, milestone 2: Function app + Solve app.** An app framework (app switcher, Symb/Plot/Num views, per-app state in IndexedDB, apps and JSXGraph loaded lazily); the **Function app** (F1…F0, Plot on JSXGraph with trace and an analysis menu for root, extremum, intersection, slope and signed area, Num table, every number shown from the engine); the **Solve app** (equations E1…E0, unknowns with guesses; 1-D bracket + Brent/Newton, systems through GSL `hybridsj`/`hybrids`, polynomials through `proot`; every root substituted back, ⚠ when the residual is large).
   Bar: milestone 1's start-up numbers hold; Plot ≥ 30 fps while zooming and panning three functions; Enter → solve result p95 < 300 ms (1-D and a 2×2 system).
   **Done 2026-10-11** (`phase-1`, shift reports docs/shifts/2026-10-11-m2-report.md and 2026-10-11-m2b-report.md): every item above, verified. On the Tab One (release, Android 15, WebView 131): keyboard usable 679 ms, engine ready 1.02 s; Plot 53.8 fps median (near the display's refresh rate); solve p95 82 ms (1-D) and 51 ms (2×2); first Plot open 0.70 s. `build.sh` from a fresh clone gives a 15.0 MB APK in about 10 minutes. The MicroPython build for milestone 3 is in `python/`. Left over: subscripted unknowns (`x_1`) in Solve; 23 of the 25 G2 checklist items are still unanswered (every Function and Solve default is `assumed`).
6. **Phase 1, milestone 3: Python** (MicroPython by default, D6), then the MVP release (PWA + Play testing track). The task list, the proposed milestone 3 bar and everything not yet finished are in [backlog.md](backlog.md).

---

## 12b. Features requested by the user (2026-10-11), not yet scheduled

Three additions the user asked for. Each reuses what Giac already has, in line with principle 1. Where keys and menus sit waits for the Virtual Calculator mapping. The reference calculator has its own units and constants menus; everything copied from it stays `assumed` until the mapping lands.

### Physical constants
- **Engine:** Giac has them built in (`_c_`, `_h_`, `_hbar_`, `_k_`, `_NA_`, `_G_`, `_me_`, `_epsilon0_`, `_mu0_`, `_R_`, `_g_` …) as unit-carrying values (`mksa(_c_)` → `299792458_(m*s^-1)`). Probed 2026-10-11 on our GSL build.
- **Data age:** the exact SI 2019 constants (c, h, e, k, N_A) are correct. The measured ones are CODATA 2018 (e.g. `_me_` 9.1093837015e-31 kg); CODATA 2022 differs in the last digits. Plan: send Parisse an upstream update to CODATA 2022 and carry it as a documented local patch until then. Golden cases get `source: oracle` from the NIST CODATA table.
- **UI:** a constants menu (categories: universal, electromagnetic, atomic, physico-chemical), each entry showing symbol, name, value and unit. Picking one inserts the symbol (e.g. `c`, typeset upright with a subscript where needed). A setting chooses "with units" (default when the units feature exists) or "value only".

### Decimal ⇄ scientific key
- **Engine:** none needed. Our Home formatter (D5) already does STD, SCI and ENG from the exact value, so switching formats only re-renders the display; nothing is recalculated.
- **UI:** one key cycles the display format STD → SCI → ENG for the history and new results (engineers want ENG: `12.35E3`). It changes the Home setting, so it persists. The key position needs a free primary or shift slot in `spec/keyboard.yaml`, chosen once the mapping is known.
- **Effort:** small (about a day with tests).

### Units (Qalculate-style)
- **Engine:** Giac has a complete units system (HP-48 heritage). `1_km+3_m` → `1.003_km`, `2_MPa=>_psi` → `290.07547546_psi`, `usimplify(1_N*1_m)` → `1_J`, `mksa(…)` gives base SI, and SI prefixes work (`3_nm`, `5_µm`, `kN*m`). Composite units come for free, because a unit is just a factor: `9.81_(m/s^2)*2_kg` → `19.62_(kg*m/s^2)`. We don't need Qalculate's library (GPL-2.0-or-later, so licence-compatible, but a second large C++ engine).
- **Entry (recommended):** a Units key opens a picker. A row of prefixes at the top (n µ m c k M G …), then categories (length, mass, time, force, pressure, energy, power, temperature, electrical …) with their units. Prefix first, then unit, as in Qalculate; the prefix is optional and stays selected for one pick. Typing letters while the picker is open filters it (`kN`, `psi`), which is the fastest path for engineers. Composites are built with the normal × ÷ ^ keys between unit picks (`kN·m`, `m/s²`).
- **Display:** MathPrint draws units upright after the number (`19.62 kg·m·s⁻²`). A "→" convert action (Giac `=>`) converts the last result to a picked unit, and "simplify units" (`usimplify`) turns `kg·m·s⁻²` into `N`.
- **Work needed:** a parser rule and round-trip cases for the unit template (P1); formatter support for value + unit (12 digits on the number only); Home's exact-first path must keep units; golden cases from `oracle`/`derived` conversions. Units stay out of the Function and Solve apps at first (the plot evaluator doesn't carry units).
- **Effort:** medium, about 1–2 weeks. Feasible, and not ambitious given Giac. The risks are Giac's unit-simplification quirks (golden cases will show them) and the picker design.
- **Clash to fix first:** Giac reads `x_1` as x with unit `1`. Subscripted variable names must parse differently from units in our parser (P1), e.g. units always come from the picker as `_unit` after a number and subscripts as `x_{1}` → a plain name.

## Sources
- Giac/Xcas in the browser (giac.js / giacwasm.js; wasm about 2× slower than native, up to 15× on Gröbner bases): <https://xcas.univ-grenoble-alpes.fr/backup/install_en>, <https://www-fourier.univ-grenoble-alpes.fr/~parisse/giacjs/simple.html>, <https://xcas.univ-grenoble-alpes.fr/nw/xcasen.html>
- Giac `fsolve` methods (GSL-based bisection, Brent, false position, Newton, secant, Steffensen): <https://www-fourier.univ-grenoble-alpes.fr/~parisse/giac/doc/en/cascmd_en/cascmd_en750.html>
- KhiCAS features (CAS, spreadsheet, 2D/3D geometry, finance, MicroPython): <https://www-fourier.univ-grenoble-alpes.fr/~parisse/numworks/khicasnwen.html>, <https://xcas.univ-grenoble-alpes.fr/backup/casio/geoen.html>
- NumWorks Epsilon licence (CC BY-NC-SA, not open source): <https://linuxfr.org/users/freejeff/journaux/retour-sur-la-licence-de-numworks>
- Chaquopy (MIT, numpy/scipy for Android): <https://www.i-programmer.info/news/98/15718.html>
- Pyodide and scipy size and performance considerations: <https://www.nexedi.com/blog/NXD-Blog.Scipy.and.Scikit.Learn.Compiled.To.WebAssembly.In.Pyodide>, <https://blog.pyodide.org/posts/0.23-release/>
- MathLive (MIT), Compute Engine (MIT), HyperFormula (GPLv3): <https://github.com/cortex-js/compute-engine>, <https://libraries.io/npm/mathlive>
- JSXGraph (LGPL/MIT): <https://jsxgraph.uni-bayreuth.de/home/>
- Other open-source Android maths apps (for UI inspiration): microMathematics Plus <https://github.com/mkulesh/microMathematics>, Qalculate! for Android <https://f-droid.org/packages/com.jherkenhoff.qalculate/>, ArityCalc <https://f-droid.org/en/packages/org.woheller69.arity/>
- Licences I know well but didn't fetch in this study (verify when adopted): MPSolve (GPLv3), mpmath/SymPy/SciPy/numpy (BSD), decimal.js/KaTeX/CodeMirror/Capacitor/jStat/Jspreadsheet CE (MIT).
