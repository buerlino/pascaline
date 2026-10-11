<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Phase 0 night shift: defaults and proposals (2026-10-11)

Decided by Henri after one brainstorm round with the four workers (each gave 3–5 ideas, then reacted once to the collected list; nobody objected to D1–D9). Every default below stays inside CLAUDE.md and docs/02. The two **proposals** at the end would change the plan and wait for the user's yes or no. Numbers come from `spike/RESULTS.md` (Lenovo Tab One, release build, WebView 131, unless noted).

Judged by the two principles in `spike/NIGHT-SHIFT.md` §1: reuse open source, and speed for engineers.

## Defaults

### D1. UI framework: Svelte 5 for the app shell, plain TypeScript on the hot paths
- **Choice:** Svelte 5 for the shell (history, tabs, settings, the Symb/Plot/Num views). The keyboard, the MathLive wrapper, the expression parser and the engine client are plain TypeScript modules with no framework.
- **Why:** the prototype keyboard is about 150 lines of plain TS rendered from a data layout and needed no framework; MathLive is a web component and fits into Svelte without glue. Keeping the hot paths framework-free means the framework never sits between a key press and the engine.
- **Alternatives:** plain TS + web components everywhere (leaner, more hand-written state handling).
- **Change my mind:** this is a judgement, not a measurement (no Svelte variant was built). If the Svelte runtime shows up in Tab One start-up next to the 309 ms field-ready time, go plain TS.

### D2. Engine lifecycle
- **Choice:** start the Giac worker at app launch, right after the first paint, behind a static first screen that already shows the keyboard and entry line. Keep it warm. Home, CAS and Solve logic run inside the worker (one result needs several Giac calls; doing them there saves a round trip each). Two cancel levels: the time budget uses Giac's own interrupt (patch 0002; stops within milliseconds, keeps variables, no restart); the Cancel key terminates the worker and restarts it with replay. A worker crash or low-memory kill takes the same restart + replay path, so there is one recovery path to test.
- **Why:** cold launch to engine ready is 975 ms (≈900 ms with D9); Android/WebView start takes ≈560 ms of that, which we can't cut, so the remaining ≈340 ms is hidden behind a usable-looking screen. Cancel → ready measured 381 ms with variables intact.
- **Alternatives:** lazy start on first Enter (slower first answer); SharedArrayBuffer-based interrupts (need COOP/COEP in the shell; not checked).
- **Change my mind:** a device where engine start blocks the first paint, or memory pressure on 2–3 GB phones.

### D3. Time and size budgets
- **Choice:** Home: exact evaluation with a 300 ms budget, then floats; Giac power limit 1e5. CAS: no automatic fallback; a soft budget of about 10 s with a visible Cancel; Giac's default power limit 1e8. Both are set before each call (one cheap call each).
- **Why:** Q3 passed with this setup (123/123, max 406 ms on the Tab One); exact symbolic answers may take time, and the user decides when to give up.
- **Change my mind:** a slower device where common Home inputs hit the 300 ms budget often (`sum(1.1^k,k,1,500)` already takes 268 ms on the Tab One; the float fallback gives the same 12 digits).

### D4. Result rendering
- **Choice:** Giac `latex()` → a small tidy-up pass (e.g. `\mathrm{atan}` → `\arctan`) → MathLive's static renderer. Raw `caseval` text is never shown.
- **Why:** MathLive is loaded for entry anyway, so rendering costs 0 extra bytes (1.05 ms per result); output looks like the entry line.
- **Alternatives:** KaTeX (0.45 ms per result, +77 kB gzip).
- **Change my mind:** rendering showing up in Tab One profiles.

### D5. Home number display
- **Choice:** format from our own rounded value (digit string + exponent, BigInt, never JS `Number`). STD (12 significant digits), SCI and ENG (exponent a multiple of 3) are pure functions of that value, each with unit tests. FIX n can follow. Which modes the reference calculator offers, and how it shows them, is a G2-checklist question.
- **Why:** engineers want ENG; formatting needs no engine round trip; CLAUDE.md forbids JS number formatting for anything shown.

### D6. Python
- **Choice:** MicroPython v1.29.0 is the default runtime in every build (335 ms to first result on the Tab One, 328 KB brotli, built from source). "Python+" is Pyodide core + numpy only, an optional download, never in F-Droid builds, never loaded at launch, and loaded with a visible progress bar and Cancel. sympy is offered only on request (Giac is our CAS). `calc.cas` is async (`await calc.cas(...)`), with a small preprocessor so users can write it without `await`.
- **Why:** Pyodide misses the 4 s bar on the Tab One even for its core (7.9 s; + numpy 11.7 s; + numpy + sympy 26.1 s). A synchronous `calc.cas` would need SharedArrayBuffer plus COOP/COEP headers in the shell (not checked).
- **Change my mind:** Pyodide memory snapshots cutting the start to a few seconds.

### D7. Plotting
- **Choice:** JSXGraph stays (plan). Point evaluation uses our own parser if proposal P1 is accepted, otherwise Compute Engine loaded lazily. Before the mid-range test, try adaptive sampling (fewer points while panning) and JSXGraph's canvas renderer. Numbers shown to the user (trace, Num view) always come from the engine, never from the plot evaluator.
- **Why:** low-end bar met on the Tab One (36–39 fps); each redraw takes 17–20 ms, mostly the SVG update, which won't fit a 60 Hz frame on this SoC.
- **Change my mind:** the mid-range phone under 60 fps after those two changes → measure a canvas-only plot library (that would be a proposal).

### D8. Golden cases, oracles and the G2 checklist: one format, one folder
- **Choice:** `tests/golden/<area>.yaml` (folder planned in CLAUDE.md), one flow mapping per case with `id`, `input`, `settings`, `expect`, `source`, `oracle` (an inline expression), `note`, and a `g2:` question when `source: assumed`. One `oracle.py` checks every file at 30 and 60 digits and **generates** the G2 checklist from the `g2:` fields, so each fact lives in one place. `spike/home/cases.yaml` and `spike/solve/cases.yaml` already have this shape; the benchmark and serializer cases move over in Phase 1.
- **Why:** reuse and no duplicate lists.

### D9. Android shell
- **Choice:** store `.wasm` uncompressed in the APK (`noCompress "wasm"`, now the default in `spike/android/overlay/init.gradle`). minSdk stays 24 (Capacitor 8's minimum, covers Android 8/9). Testers get release builds only. Keep the timing marks (off in production builds) and the device scripts as the standing Q1 regression check: cold launch to engine ready must stay under 1.5 s on the Tab One.
- **Why:** uncompressed wasm cuts every cold start by ≈75 ms (975 → ≈900 ms) at the cost of a bigger APK (6.6 → 14.3 MB); start speed matters more than install size for this app, and F-Droid has no rule against it. Debug builds are about 2× slower and would give testers the wrong impression.
- **Change my mind:** a store size limit or user complaints about the 14 MB APK; the toggle is `PASCALINE_COMPRESS_WASM=1`.

## Proposals (need the user's yes or no)

### P1. Replace Compute Engine with our own LaTeX-subset parser
- **What:** CLAUDE.md lists "MathLive + Compute Engine (MIT)". Compute Engine is used only to parse LaTeX from our keyboard. Proposal: drop it and use the hand-written parser from `night/ron-parser` (a58e65a) for both Giac input and plot points. The plot variant is on `night/plot-own` (52a1d93). **Neither branch is merged into `spike/phase-0`.**
- **Evidence:** same 296 round-trip cases: 292 pass, 0 wrong (same as Compute Engine). Size 16.2 kB min / 5.7 kB gzip vs 4.1 MB / 1.18 MB. Tab One: parser ready **370 ms vs 1223 ms**; plot page ready **456 ms vs 1364 ms**, 38.8 vs 36.2 fps. 20,000 fuzz inputs: no crash; unknown input is rejected, never guessed. It also keeps typed decimals exact (`1.5\times10^{3}` → `1.5*10^3`, where Compute Engine gives `1500.0`), which the exact-first Home needs.
- **Cost:** we maintain the grammar; each new keyboard template needs a parser rule and a round-trip case in the same commit. Gates: ron's round-trip test for every change; the plot evaluator never produces numbers shown to the user.
- **Henri's recommendation:** yes.

### P2. F-Droid builds the engine with Debian's Emscripten; we keep emsdk for development
- **What:** every Emscripten app in fdroiddata uses Debian's `emscripten` package (trixie 3.1.69); none uses emsdk. We develop with emsdk 6.0.12.
- **Evidence:** in a `debian:trixie` container with Debian's Emscripten 3.1.69, the whole engine (GMP, MPFR, GSL, Giac with both patches) builds and links; `giac.wasm` 9,777,360 B vs 9,752,981 B with emsdk 6.0.12.
- **Gate (passed tonight):** interrupt test 16 / 16, Home 123 / 123, Solve 23 / 23 on the 3.1.69 build. A wasm built that way must keep passing `spike/node/interrupt-test.mjs` and the Home and Solve golden runs, because patch 0002 and `-fwasm-exceptions` depend on the toolchain.
- **Fallback:** a hash-pinned emsdk download in the recipe, after asking the F-Droid maintainers.
- **Henri's recommendation:** yes. Next steps: the 55-case benchmark and a Tab One run on the 3.1.69 build, then a draft recipe modelled on `net.alexbarry.alexgames.yml`.
