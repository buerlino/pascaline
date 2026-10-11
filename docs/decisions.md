<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Decision log

Phase 0 decisions (D1–D9, P1, P2 and the user's answers of 2026-10-11) are in [spike/DECISIONS.md](../spike/DECISIONS.md). This file is the log from Phase 1 on.

## Needs the user

- ~~**2026-10-11 Merges into `phase-1` are blocked in the coordinator session.**~~ **Resolved:** in the milestone 2 part 2 shift Henri merged and committed on `phase-1` without problems. The permission classifier denied `git merge --no-ff` into `phase-1` (and last shift's commits). Verified worker commits are listed in the shift report with the exact merge commands. **Recommendation:** allow Henri to run `git merge --no-ff p1/*-m2` and `git commit -s` on `phase-1` (never push), so verified work lands during the shift.
- Open items for the user: see [backlog.md](backlog.md), "Needs the user".
- **2026-10-11 P3: ACCEPTED by the user (2026-10-11).** libqalculate as a further engine for units, constants and uncertainty (spike first).** The user asked why we didn't fork Qalculate!. Forking the app wouldn't help: it's a desktop GTK/Qt program with a weaker CAS than Giac, and it has no textbook entry or calculator keyboard. Its core library is a different matter. libqalculate (GPL-2.0-or-later, so GPL-3 compatible; C++ on GMP/MPFR, which we already build) has what Giac lacks for engineers: a large unit database with conversions, physical constants, and interval/uncertainty arithmetic. Units are our open parser gap 03. **Recommendation:** a 1-day spike that builds libqalculate to wasm, measures size and lazy start-up on the Tab One, and runs `12 m/s to km/h`-style cases. If it passes, it goes behind `MathEngine` as worker 3, loaded only when units are used. Giac stays the core.

- **2026-10-11 P4: ACCEPTED by the user (2026-10-11), incl. the Alpha case flip.** Follow the reference's logical key layout (from the Virtual Calculator mapping).** The mapping (`spec/mapping/vc-2026-10-11/keys.yaml`, 47 keys, merged on `phase-1` 632dab4) shows that our grid (9 rows × 5, our own prototype) puts many functions on different keys and layers from the reference. CLAUDE.md asks for the same *logical* layout (which function sits on which key and shift layer); the visual design stays ours. Function-to-key assignments learned by watching the simulator are allowed by the clean-room rules.
  **Recommendation: yes. ron rebuilds `spec/keyboard.yaml` on the reference's key grid in one pass, with our own look, `source: virtual-calc` per key and a Playwright test per moved function.** In detail:
  1. **Grid:** adopt the reference's rows and columns for rows 4–10 (the maths keys) and its app/navigation keys (Apps, Symb, Plot, Num, View, Menu, Esc, CAS, Help). Phone width: 6 columns where the reference has 6.
  2. **Keys we add:** `+/−` (negation; Shift = |x|), `EEX` (exponent mark ᴇ; Shift = store ▶), one `( )` key that inserts a matched pair, separate `x^y` (Shift = ⁿ√) and `x²` (Shift = √).
  3. **Moves:** π = Shift+3, i = Shift+2, eˣ = Shift+LN, 10ˣ = Shift+LOG, x⁻¹ = Shift+÷, `=` = Shift+".", `approx()` = Shift+Enter, ASIN/ACOS/ATAN on Shift of SIN/COS/TAN (already so).
  4. **Alpha case:** Alpha gives capitals, Shift+Alpha lowercase (the reverse of ours today), letters in the reference's key order. Alpha lock (L3) keeps working the same way.
  5. **Up on an empty entry line** selects the last history row (as on the reference; fits L5 "results are insertable").
  6. **Kept as ours** (no clean match): our app/settings key, our Menu behaviour, Cancel = On (not yet observed while busy, SPOT-CHECK), the Python key layer.
  7. **a b/c stays as built (L2).** The mapping's "cycles decimal/fraction/mixed" was the user's own User-mode script (user, 2026-10-11), not the stock key; G2 item 29 asks for the stock behaviour.
  *Would change if:* the phone-width grid gets too small to tap (measure on the S8+ and Tab One), in which case we keep the reference's assignments but fold rarely used keys into a second page.
- **2026-10-11 User requests (accepted by the user, 2026-10-11), design defaults by Henri:**
  1. **Format key on the On slot** (r10c1; we have no power key). On an empty line it cycles how the *last result* is shown, through the modes ticked in Settings (default: Standard → Scientific → Engineering; also offered: Fixed, fraction, mixed number, and for complex results polar `r∡θ` ↔ `a+b·i`). It changes that result's display only; the Settings format stays the default for new results. Formatting goes through the engine (12-digit rule), never JS. *Alternative:* cycle the global setting (rejected: one result is what you want to read differently).
  2. **Polar entry:** Shift+× = ∡ (as on the reference, r8c5), `r∡θ` in the current angle mode. Part of the P4 pass.
  3. **Key vibration:** a setting (default off), with strength and duration set separately (defaults 50 % and 15 ms when switched on). Android: a small Capacitor plugin of our own calling `VibrationEffect.createOneShot(ms, amplitude)` (no new dependency; `@capacitor/haptics` has no amplitude control); devices without amplitude control get duration only. PWA: `navigator.vibrate(ms)`, duration only. Fired on key-down, so it adds no latency.
  4. **Touch in the entry line:** tapping places the cursor (MathLive does this natively); a Playwright test proves it. The `( )` key inserts the pair with the cursor inside.
  5. **Format details (user, 2026-10-11 evening):** Scientific and Engineering use E notation as on the reference (`1.5E-9`, `15E-10` in Engineering, `15E10`); the number of decimals for Fixed is a Settings field (default 4, our choice). Built on `p1/ron-fmt`.
- **2026-10-11 P5: behaviour differences in Home and Solve (from the mapping, no change yet).** The reference: (a) gives an error for `sqrt(-4)` and `asin(2)` in default settings, where we give complex results; (b) gives the real root −2 for `(-8)^(1/3)`, where we give the principal complex root; (c) seems to round ties half-to-even at 12 digits (marked unsure); (d) in Solve returns the guess with "Extremum found" or a huge finite value with "Zero" where we say "no root found". **Recommendation:** follow (b) by default (the real odd root is what an engineer expects; the L6 parser already has the setting) and (a) only as a "real mode" setting, default complex (engineers work with phasors); keep ours for (c) until a real-G2 check, and keep our clearer Solve messages in (d).

## Defaults (Phase 1)

Each entry: the choice, why, the alternatives, and what would change it.

### 2026-10-11 Home and CAS share one Giac context, each with its own Ans
- **Choice:** one engine context, so user variables are shared between Home and CAS. Each view keeps its own `Ans` (Giac variables `pasans` for Home, `pcasans` for CAS).
- **Why:** one worker (D2 starts it at launch), no second copy of the 9.8 MB engine in memory. Variables defined in CAS are usable in Home without copying.
- **Alternatives:** two contexts (double the memory and start-up time), or one shared `Ans` (Home decimals would leak into exact CAS work).
- **Would change if:** the G2 shows that Home and CAS keep separate variables (add to the G2 checklist).

### 2026-10-11 CAS time budget
- **Choice:** CAS has a 10 s soft budget (`CAS_SOFT_BUDGET_MS`), after which the UI makes Cancel prominent. Giac's own `timeout 600` is only a safety net. No automatic fallback in CAS (D3).
- **Why:** exact results can take a while, and the user decides when to stop. Home keeps its 300 ms exact → floats guard.
- **Would change if:** Tab One timings show common CAS inputs near 10 s.

### 2026-10-11 Cancel replays definitions only
- **Choice:** after Cancel (worker restart, D3), only the user's definitions are replayed, in the form that ran. `Ans` is not replayed, and inputs that use random numbers get new values.
- **Why:** replay must be fast and must not re-run the cancelled job. Definitions are what the user would lose.
- **Would change if:** users miss `Ans` after Cancel. It could then be stored as a value.

### 2026-10-11 Home number formats (assumed, G2 item 15)
- **Choice:** `digits` means significant digits in every mode. STD drops trailing zeros and is plain for 1E-4 ≤ |x| < 10^digits, otherwise scientific. SCI: `1.235E4`. ENG: `12.35E3` (exponent a multiple of 3). Rounding is half-up from an exact BigInt value; half-even is implemented but switched off until G2 item 8.
- **Why:** it's our own formatter (D5), and it matches the observed `1÷3` → `0.333333333333`. The rest waits for the G2.
- **Would change if:** the G2 answers to items 8 and 15 differ.

### 2026-10-11 P2 condition met: releases use the container toolchain
- **Result:** the engine built with Debian's Emscripten 3.1.69 (`debian:trixie@sha256:913f6706…`, `emscripten=3.1.69+dfsg-3`, script `engine/giac/build-wasm-release.sh`) passes interrupt 16/16, Home 123/123 and Solve 23/23 with output identical to the emsdk build. On the Tab One (Android 15, WebView 131.0.6778.260, release builds of the spike app, 7 cold starts and 5 benchmark runs each), cold launch → engine ready p50 is 896 ms (emsdk) vs 917 ms (container), +2.3%. First result is 1001 vs 1016 ms (+1.5%). Benchmark first-call p95 over 55 cases is 76.7 vs 72.6 ms. Cancel → ready is 322 vs 306 ms.
- **Choice:** P2's bar (within +10%) is met, so every release builds the engine in the container. emsdk stays for development.

### 2026-10-11 Mixed numbers in textbook entry (assumed, G2 item 17)
- **Choice:** one press of a/b inserts the same plain stacked fraction as ÷. Pressing a/b twice after a whole number makes a mixed number `2\tfrac12`, which the parser reads as `(2+1/2)` (L2, 2026-10-11). A digit directly before a plain stacked fraction still parses as `2*1/2`.
- **Why:** P1 only accepts what our keyboard produces. A separate mixed-number template keeps the parser unambiguous once it exists.
- **Would change if:** the G2 shows how a/b mixed numbers are entered and read (item 17).

### 2026-10-11 Golden gate
- **Choice:** `(cd app && npm run golden)` is the gate for every engine build that ships (interrupt, Home, Solve, benchmark, parser). It replaces the separate spike runners. The G2 checklist is generated from `tests/golden/g2.yaml` (`oracle.py --g2`), so edit the YAML, not the .md.

### 2026-10-11 Entry and history behaviour (assumed until the G2 checks)
- **Cancel:** while a job runs, it stops the job and keeps the history (the entry is marked cancelled). When idle, it clears the entry line. Enter while a job runs is ignored.
- **Clear (shift + ⌫):** clears the entry line; on an empty line it clears the current view's history.
- **History:** Home and CAS keep separate histories over one shared variable context. Tapping an entry's input puts it back on the entry line. History isn't stored yet; settings and the current view are (IndexedDB).
- **Shift and alpha** are one-shot; shift + alpha types capitals. Alpha lock comes later.
- **One-line mode** shows fractions and roots linearly (`1\div3`); exponents stay raised for now.
- **Why:** each is the fastest path for keyboard use (principle 2), matches what a calculator user expects, and can be changed once the G2 is checked.
- **Sto▶** goes on a shift layer of an existing key (all 40 cells are taken), position `assumed`.

### 2026-10-11 How the Tab One "Enter → drawn result" number is measured
- **Choice:** the 55 benchmark inputs are Giac text (matrices, `factor`, …), and most have no key sequence. In measurement builds (`?bench=1`) they go through `Session.submit(latex, giacOverride)`: the real engine, LaTeX tidy-up and MathLive rendering, skipping only our parser. Parser speed is measured separately in desktop tests.
- **Would change if:** we want a keyboard-only benchmark. That needs a separate set of inputs that can be typed.

### 2026-10-11 Default angle mode: radians (assumed)
- **Choice:** new installs start in radians. The setting is stored and can be changed in the settings panel.
- **Why:** Giac's default, and the safe choice for the engineering and maths work this calculator is for. The reference calculator's factory default isn't observed yet.
- **Would change if:** the G2 shows another factory default (add to the G2 checklist).

### 2026-10-11 Bit-reproducible release engine
- **Finding:** clang 19 at `-Oz` gave different object files from run to run under address-space randomisation (ASLR), so two container builds produced different `giac.wasm` files. Their output was still identical: 0 differences in 476 golden outputs.
- **Choice:** `engine/giac/build-wasm-release.sh` runs the engine build under `setarch -R` (ASLR off) inside the container. That needs `--security-opt seccomp=unconfined` for rootless podman, so the container can call `personality()`. It still only mounts scratch copies. Two builds in one checkout and one from a fresh clone all give `giac.wasm` SHA-256 `ab5ca4eb…3003a`.
- **Why:** F-Droid's reproducible builds need the same bytes on every build (principle 1).
- **Would change if:** a clang or Emscripten update makes `-Oz` deterministic, or F-Droid's build server can't turn off ASLR (then we look for the compiler pass that depends on addresses).

### 2026-10-11 Residual check thresholds for Solve and Plot analysis
- **Choice:** a root is accepted silently when its relative residual, evaluated at 30 digits, is ≤ 1e-15. 1-D roots above that are shown with ⚠. For systems, a residual < 1e-6 is shown with ⚠, and anything worse is reported as no solution (Giac's `hybrids` returns the guess unchanged when it fails, so the check is the only guard).
- **Why:** docs/02 section 4 requires substituting every root back. 1e-15 is far above 30-digit noise and far below anything a 12-digit display would show as wrong.
- **Alternatives:** an absolute threshold (fails for large-scale equations), or showing every residual (clutter).
- **Would change if:** golden or user cases show false ⚠ on well-conditioned roots, or the G2 (items 12–14, 20) shows a different policy.

### 2026-10-11 Polynomial root order (assumed, G2 item 21)
- **Choice:** real roots in ascending order, then complex roots by real part, then imaginary part. `proot` results are polished with Newton at 30 digits.
- **Would change if:** G2 item 21 shows another order.

### 2026-10-11 Solve and analysis time limit
- **Choice:** a 30 s hard Giac timeout per solve or analysis call. Cancel is the user's own limit.
- **Why:** a runaway `fsolve` must never hang the worker. Normal solves take well under 300 ms (milestone 2 bar).

### 2026-10-11 Signed area in Plot analysis
- **Choice:** Romberg at 30 digits, then the exact `int` (0.5 s budget), then `gaussquad` with ⚠, always cross-checked against `gaussquad`. A pole inside the interval gives "no area" (G2 item 22).
- **Why:** Romberg is fast on smooth functions but doesn't converge at kinks; the exact integral covers those.

### 2026-10-11 Plot root search stays inside the visible window
- **Choice:** root, extremum and intersection from the Plot menu search only the visible x-range, starting at the trace position.
- **Why:** what the user sees is what they asked about; a root far off-screen would be confusing. Sign changes at poles are not roots (residual check).
- **Would change if:** the G2 shows the reference searching beyond the window.

### 2026-10-11 Function app defaults (assumed, G2 items 23–25)
- **Choice:** default Plot window x ∈ [-10, 10], y at the same scale as x, centred on 0; canvas renderer with "hybrid" sampling (D7, fastest on desktop: 59.3 fps at CPU ×4). Trace step = a 1-2-5 step near window width / 100, so trace x-values stay short decimals. Num starts at X = 0 with step 1, 12 rows per screen, one engine call per screen. Intersection uses the traced function and the next function that is on. The Symb slots are written with `X`; the parser maps `X` to Giac's `x`.
- **Why:** a square, centred window shows the shape of most engineering functions at once; short trace values are easier to read and type back; one engine call per screen keeps Num fast.
- **Alternatives:** the reference's own window and trace step (unknown until the G2 checks), a free-form trace step, a chooser for the second function of an intersection (an extra key press every time).
- **Would change if:** the G2 checks (items 23–25) show other defaults, or Tab One measurements show the canvas renderer is slower there.

### 2026-10-11 Solve app variables and results (assumed, G2 items 12–14, 20)
- **Choice:** the Solve app keeps names as typed (`x` and `X` are different unknowns; the Function app maps `X` to `x`). New unknowns start at 0. With one equation, Solve finds the selected unknown and holds the others fixed; with N equations it finds N unknowns, the selected one first. A failed solve or a failed residual check shows ⚠ with the engine's info line. A polynomial with exactly one real root also writes that root into the value.
- **Why:** engineers expect case-sensitive names, as in the CAS. Starting at 0 is predictable.
- **Alternatives:** fold case (would clash with CAS variables), or start from the last value used anywhere.
- **Would change if:** the G2 (items 12–14, 20) shows a different behaviour. Known gap: subscripted names (`x_1`) aren't solvable yet, because our own name check (`IDENT` in `solve.ts`, `analysis.ts`) rejects the underscore. Giac itself reads `x_1` as a plain variable (checked 2026-10-11: `type(x_1)` → identifier); only `<number>_<unit>` is a unit.


### 2026-10-11 Minimum WebView: modern Chrome WebView, with an "update" notice below it
- **Choice:** minSdk stays 24 (Android 7). Below that, we also require a minimum WebView version, the highest floor among our Vite build target, the Emscripten builds (Giac, MicroPython) and MathLive : **Chrome 95** (Giac is built with `-fwasm-exceptions`; Vite es2022 needs about 94, module workers 80). MathLive 0.111.1 uses `:has()` and `@container` (Chrome 105), which most likely only affects styling (not verified). An inline ES5 check in `app/index.html` feature-detects what we need. On an older WebView it shows one line asking the user to update Android System WebView / Chrome, instead of a blank page.
- **Why:** the Galaxy S8+ (Android 9) still has its factory WebView, Chrome 72 (2019). Our bundle stops at the first `?.`, and the wasm builds need newer features anyway. On Android 7–9 the WebView is Chrome and updates from the app store (Chrome 138 is the last for Android 8/9), so real users on these devices run a modern WebView. Transpiling down to Chrome 72 would cost bundle size and start-up time on every device (principle 2), and the wasm feature gap would remain.
- **Alternatives:** a legacy build (`@vitejs/plugin-legacy`, wasm built without exceptions or bulk memory): two builds to test, slower everywhere. Raising minSdk instead: wouldn't help, because the WebView version is what matters.
- **Would change if:** testers report Android 7–9 devices that can't update their WebView (e.g. no app store) in meaningful numbers.

### 2026-10-11 Alpha lock (assumed)
- **Choice:** alpha twice locks lowercase letters; shift, alpha, alpha locks capitals; alpha again unlocks (L3).
- **Why:** this is the usual calculator gesture, and it needs no extra key.
- **Alternatives:** a long press on alpha (slower; harder to discover on touch).
- **Would change if:** the Virtual Calculator mapping or the G2 shows another gesture.

### 2026-10-11 One-line entry mode: exponents are linear too
- **Choice:** in the one-line entry setting, xʸ, x² and a typed `^` insert a literal caret (`\char"5E`); the exponent is the next signed factor, as in plain text input (L4). Textbook mode is unchanged.
- **Why:** one-line mode is for people who want to type `2^3` literally; a raised box would break that.
- **Would change if:** testers find the "next signed factor" rule surprising (e.g. they expect `2^3+1` to raise `3+1`).

### 2026-10-11 Results are insertable
- **Choice:** tapping a result in the Home or CAS history inserts it at the cursor, bracketed if it is a sum (L5).
- **Why:** reusing a result is the most common engineer workflow; brackets keep precedence right.
- **Would change if:** the G2 inserts the entry instead of the result, or never brackets.

### 2026-10-11 `calc.cas` is synchronous (amends D6; no SharedArrayBuffer needed)
- **Choice:** Python calls `calc.cas("…")` like a normal function, with no `await` and no preprocessor. A 40-line MicroPython user C module of our own (`python/modules/host`, built with `USER_C_MODULES`; the upstream tree is unpatched) suspends the wasm stack with Asyncify, which the upstream webassembly port already uses, until the main thread answers. MicroPython is now linked at `-O2` (upstream links at `-O0`): wasm 1.12 → 0.63 MB, a 10⁶-step loop 1.3 → 0.61 s in Chromium.
- **Why:** D6 assumed that a synchronous bridge needs SharedArrayBuffer (so COOP/COEP headers) and chose async plus a preprocessor. Asyncify gives a synchronous call without either. The async route also turned out to be broken upstream: `runPython`/`runPythonAsync` abort at the first garbage collection in a loop that allocates. Synchronous calls are what engineers expect, and they also work inside functions and comprehensions.
- **Alternatives:** async plus a preprocessor (broken upstream, and it can't reach calls inside functions); SharedArrayBuffer with COOP/COEP (headers the Capacitor shell would have to serve, plus a second mechanism).
- **Limit:** recursion deeper than about 50–100 frames overflows the JS stack, as in the stock upstream build. It is reported as `RecursionError`, and the worker is replaced, so shell variables are lost.
- **Would change if:** the release build (Debian Emscripten 3.1.69) rejects `EM_ASYNC_JS`/`-O2`, or the Tab One misses the milestone 3 bars (`calc.cas` p95 < 50 ms, shell ready < 0.5 s).

### 2026-10-11 Python runtime defaults
- **Choice:** Python heap 4 MB, Python stack 8K words. The shell echoes the repr of a single expression, like a REPL, and runs blocks of several statements without echo. stdout/stderr are flushed at a newline (at most every 16 ms), at 8 KiB, and before each `calc` call. Tracebacks hide our own frames; scripts without a name are `<script>`. A failed `calc` call raises `ValueError` with Giac's message. The worker starts only when the Python app first needs it.
- **Why:** these are small, predictable defaults that fit the Tab One. Echo and tracebacks behave as in desktop Python, which engineers know.
- **Would change if:** real scripts hit the heap limit, or the G2 Python shell behaves differently (assumed).

### 2026-10-11 Python app views and storage (key positions assumed)
- **Choice:** Symb = Editor (CodeMirror 6), Plot = Graphics (the 320×240 canvas, scaled 4:3, pixel-exact lines and circles without anti-aliasing), Num = Shell. Scripts live in IndexedDB (`app.python`), at most 50 scripts of 64 kB each; the shell transcript is capped at 64 kB. The Python key layer is a separate `python:` block in `spec/keyboard.yaml` (xʸ → `**`, shift 7/8/9 → `:` `"` `'`, shift 0 → 4-space indent, shift , → `=`, shift Enter → `==`). Every position in it is assumed. Cancel keeps the canvas and the editor and shell text. A run that draws switches to Graphics. Text sizes are 10/14/18 px (assumed).
- **Why:** these map the three-view framework onto definition, picture and table-like output. The limits keep IndexedDB and memory small on the Tab One. Pixel-exact drawing matches a 320×240 calculator screen.
- **Would change if:** the Virtual Calculator mapping or the G2 puts the Python keys or views elsewhere, or users hit the limits.

### 2026-10-11 Parser: odd roots, lists, decimal comma, one-letter functions (L6)
- **Choice:** a root with an odd whole-number index is the real root (∛(-8) = -2 in Home and in plots; the CAS view leaves `-8^(1/3)` unsimplified, as Giac does with `8^(1/3)`). This is assumed (G2 item 4), and the option `realOddRoots: false` restores the principal complex root. `{…}` is a list. A `decimalComma` input option reads `3,5` as 3.5 and then separates arguments with `;`. After `p(x):=…`, `p` is a function for the rest of the session (f, g and h always are).
- **Why:** engineers expect ∛(-8) = -2. Lists and user functions are things our keyboard can produce, and the decimal comma is common in Europe.
- **Left open:** `x^y^z` (our keyboard can't produce it) and units (a separate feature); the reasons are in `parser.yaml`.
- **Would change if:** the G2 answers item 4 differently, or shows how the decimal-comma setting separates arguments.

### 2026-10-11 Graphics modules (compatibility names assumed, G2 items 26–28)
- **Choice:** `draw` is our own module. The compatibility module, under the name existing scripts import, covers pixon, line, rect, fillrect, circle, fillcircle, textout and eval on screen G0 only. Its names and argument orders are assumed from public descriptions. Our implementation files have our own names (`app/src/python/graphics.ts`). MicroPython reports a missing indented block as `SyntaxError` (CPython says `IndentationError`). We keep that.
- **Why:** existing calculator scripts should run where possible; our own module stays free of compatibility constraints.
- **Would change if:** the G2 answers items 26–28 differently.

### 2026-10-11 Our MicroPython variant
- **Choice:** `python/build-micropython.sh` builds `python/variant/pascaline`: upstream's standard variant plus `-O2`, a 128 KiB Asyncify buffer, and the Ctrl-C JS hook turned off (it breaks scripts in worker threads, and Cancel terminates the worker instead). The upstream source stays unmodified. One MicroPython per JS realm (one per worker).
- **Would change if:** an upstream release adds a supported way to pause for host calls.
