<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# R6: the pipelines as they work today, and how to check them (sandra)

*Written 2026-10-12 after the architecture pass (docs/04), base `phase-1` at f87874a. This is the advisor's map: how a key press, a number, a build and a check flow through the code, the engine behaviour learned by probing, and the traps where the docs and the code disagreed. Code moves: before relying on a line here, rerun the probe or the grep it names ([tools/probes/](../../tools/probes/README.md)). Decisions are not made here; they are in [docs/04](../04-architecture.md) and [decisions.md](../decisions.md).*

## 1. A key press to a Home result

1. **Keypad** (`app/src/keyboard/Keypad.svelte`, `gestures.ts`): keys fire on release (K2); a 350 ms hold turns the pad into the trackpad; ⌫ fires on touch and repeats.
2. **App.svelte `press()`**: Shift and Alpha toggle modifiers in the session; an open list (app switcher, menu) takes the digit keys; the Python editor and shell take a text layer (`pressText`); `actionFor()` (`keyboard/keyboard.ts`) picks the layer's action from `spec/keyboard.yaml`; Up on an empty line walks the history (`historyKey`); specials go to `special()`; everything else to `entry.run(action, key.id)`.
3. **EntryController** (`app/src/entry/controller.ts`): drives MathLive (`insert`, `type`, commands); `selectCompound()` wraps a fraction, root or power before x², xʸ, ÷ (L8, L9); keys pressed before MathLive has loaded are queued.
4. **Enter → `Session.submit(latex)`** (`app/src/state/session.svelte.ts`): pushes a pending history item, then `latexToGiac()`.
5. **Parser** (`app/src/input/latex-to-giac.ts` → `parse.ts` → `emit.ts`): LaTeX → a JSON tree → Giac text. Accepts only what our keys produce; unknown input is an error, never guessed. Single letters multiply (`AB` → `A*B`, `Ans` → `A*n*s`), `f g h` and defined one-letter functions are calls, `\operatorname{name}(…)` passes any name through, `\mathrm{…}` is refused. Owner: ron.
6. **Calc port → MathEngine** (`app/src/calc/engine.ts` → `engine/workerEngine.ts`): builds `HomeSettings` from the defaults plus digits and angle; posts to the Giac worker; logs stateful inputs (`:=`, `purge`, …) for replay after Cancel.
7. **Worker** (`engine/giac.worker.ts` → `createRequestHandler` → `EngineHost.home`, `host.ts`): sets Home mode once per settings change (angle, `timeout` 0.3 s, `ckevery 10`, `Digits`, pow limit 1e5; cached by a mode key); `strict.eval` turns Giac's quiet `undef` plus a printed "syntax error" into a syntax error.
8. **homeEval** (`engine/homeEval.ts`): decimal literals → exact rationals (`toExactLiterals`) → `pasans:=(…)`. Paths: exact; exact-big (over 20 digits: shown from the exact value, Ans becomes a 30-digit float); float-timeout and float-error (re-run with the original binary decimals at `Digits:=30`). The value: `re`/`im` each as an exact rational (BigInt) or `evalf(…,40)`; a non-number shows Giac's text.
9. **Back in the session**: the item stores `text`, `approximate`, `value` (a `DecimalValue`: digits, exponent, sticky), `rational`; the history is saved 400 ms later.
10. **Display** (`state/displayMode.ts` `renderNumeric` → `engine/format.ts` → `render/home.ts`): every history row is re-formatted from `value` for the current digits and format (STD, SCI, ENG, FIX, or the Format key's per-item mode: fraction, mixed, polar). Drawn by MathLive's static renderer (`render/Math.svelte`).
11. **Reuse:** tapping a result inserts `session.display(item).latex`, the rounded digits (`App.svelte:132`, `:270`); `pasans` is never reachable from input.

## 2. The other paths

- **CAS** (`host.ts` `cas()`): `pcasans:=(input)` with decimals as binary floats at `Digits` = the Home digits setting; `regroup` when the text has `*` (this build does not autosimplify `x*x`); `latex(pcasans)` → `render/tidy.ts` → MathLive. Floats are printed by Giac, not our formatter.
- **Solve and Function analysis** (`engine/solve.ts`, `solve1.ts`, `analysis.ts`): work precision `max(30, digits+10)`; 1-D: bracket from the guess, Brent, else damped Newton, 30-digit polish; systems: GSL `hybridsj`, `hybrids`, Giac Newton; polynomials: `proot` then Newton; every root substituted back (relative residual ≤ 1e-15, else ⚠). `keepingAns` and `withUnassigned` protect Home's Ans and the user's variables. Hard timeout 30 s.
- **Num table** (`analysis.ts` `table()`): each cell is a full `homeEval` of `subst(f, x=…)`: same paths as Home.
- **Plot** (`apps/function/compile.ts`): the same parse tree → `emit-js.ts` → `new Function` for drawing in doubles; every number shown (trace, Num, analysis) comes from the engine.
- **Python** (`calc.python()` → `python/pythonEngine.ts`, worker 2): MicroPython with Asyncify; `calc.*` calls go to the main thread (`python/calcHost.ts`), which calls MathEngine. `calc.eval` is a raw `math.eval()` in whatever mode Giac is in (binary decimals), then `evalf(…,17)`; `calc.cas` is a CAS call with default CAS settings and returns text.
- **Cancel** (`WorkerEngine.cancel`): terminate the worker, start a new one with `init.replay` = the in-memory definitions log. Budgets use Giac's own interrupt instead (patch 0002), which keeps the worker.

## 3. Start-up and state

- **Order** (`app/src/main.ts`): polyfills → mark `js-start` → `createCalc()` starts the Giac worker at once (D2) → Session → `shell.restorePlace()` → `restoreSettings()` → mount App → after two animation frames: mark `keyboard-ready`, load MathLive (808 kB), restore the history, reopen the last app. After the engine is ready and the browser idle: register the service worker, which precaches the whole build.
- **IndexedDB** (`state/storage.ts`, database `pascaline`, store `kv`): `settings` (no schema field; each field validated on restore, digits clamped to 15), `view`, `place`, `history` (≤ 200 per view), `app.function`, `app.solve`, `app.python`. User definitions are **not** stored: after a relaunch the history shows `5▶A` but `A` is undefined.
- **Bytes** (`npx vite build --outDir <scratch>` in `app/`, 2026-10-12): start chunk 142.62 kB (49.64 gzip), MathLive 807.73 kB, JSXGraph chunk 1,035 kB, Python 377 kB, Giac wasm 9.75 MB, whole build 13 MB. No test checks these.

## 4. Build and gates

- **`build.sh`**: fetch (SHA-256 pinned, mirror for Giac) → Giac in the pinned `debian:trixie` container (Emscripten 3.1.69, `setarch -R` for bit-reproducible output) → MicroPython (same container) → app (`npm run build`; `scripts/copy-engine.mjs` copies the engine into `app/public/engine`) → `cap sync` → Gradle 8.14.3 (downloaded and pinned; no wrapper jar in git). Development uses emsdk 6.0.12 (`engine/giac/build-wasm.sh`, output `engine/giac/_out/gsl`).
- **libqalculate** is built by `engine/qalc/build-wasm.sh [dev|release]` (A2, milestone 4; build.sh step 1c, output in `engine/qalc/_out/`).
- **Gates today**: `npm run typecheck`, `npm test` (Vitest), `npm run test:e2e` (Playwright, `app/test/*.spec.ts`), the golden gate `npm run golden` (`app/scripts/golden.ts`: interrupt, home, solve, function, bench in CAS mode, parser, python), `tests/golden/oracle.py` (mpmath), `scripts/compare-engines.ts`. Device bars through `tools/device_run.py` (annabell).

## 5. Giac behaviour learned by probing (dev build, Giac 2.1.0 + GSL)

- **Precision switch:** at `Digits` ≤ 14 floats are doubles, above that MPFR. `evalf(x,40)` therefore depends on the global `Digits` for functions without an MPFR path: `BesselJ`, `Airy_Ai` give a double at `Digits:=12` and "Bad Argument Value" at `Digits:=30`.
- **Floats on the "exact" path:** `normald_icdf`, `romberg`, `nInt`, `fsolve`, `BesselJ` return floats even in exact evaluation, so Home's `exact` text is a float string and the 40-digit `evalf` returns the same double.
- **Accuracy traps:** `normald_icdf(10^-10)` is wrong from the 8th digit on both paths (−6.36134035799 at 12 digits, −6.3613403515334 at 30; true −6.36134090240…); `normald_cdf` is right in the tail, and `fsolve(normald_cdf(x)=10^-10, x=<guess>)` at `Digits:=40` gives 32 correct digits. `UTPN(10)` loses about 23 digits to cancellation in `1-erf` at 40 digits. `evalf(sin(10^22))` at 12 digits gives −0.54764225985 (wrong), MPFR gives the right −0.8522008497671888.
- **Binary decimals:** `1-0.9-0.1` is `1.7763568394e-15` at `Digits:=12` and `2.96e-31` at 30; only exact literals give 0 (that is why Home converts them).
- **Text forms:** parse errors return `undef` and print "syntax error"; `solve` returns `list[…]`; lists and matrices print with exact fractions; `infinity` for `1/0`; `x*x` stays unless `regroup`; floats print at `Digits`.
- **Names:** an identifier with an underscore can read as a unit (`pas_d`), so our internal names have none; `x_1` is a plain identifier; `0xFF` and `0b1011` are read as numbers, `hexa()` stays unevaluated, `bitand`/`bitor`/`bitxor` work.
- **Help data:** `doc/aide_cas`: 1,780 entries (`# name`), lines `1` French (not GPL, never ship), `2` English, `0` argument types, `-1` related commands, then examples; 211 entries are Giac's own units and constants (`_kph`, `_c_`), which we do not use.

## 6. libqalculate behaviour learned by probing (5.13.1, spike libraries)

- **API:** `Calculator::calculate(str, eo)` (untimed) works on the calling thread; the timed `calculate(MathStructure*, str, msecs, …)` answers "aborted" with `msecs = 0`. `separateToExpression` splits `… to unit`; `convert(m, to, eo)` converts; `MathStructure::isApproximate()` and `PrintOptions::is_approximate` report approximation; `setPrecision(n)` sets the working digits.
- **Exactness:** the default `APPROXIMATION_TRY_EXACT` gives exact rationals for SI-defined factors (`72 km/h to m/s` = 20, `1 in to mm` = 127/5, `1 lbf to N` = 8896443230521/2000000000000) and flags π, logarithms and uncertainties as approximate.
- **Silent non-answers:** `1 m + 1 s` returns `1 m + 1 s`; `20 °C * 2` returns 40 °C; `hp` is 745.699987158 W, flagged exact (true 745.69987158227 W).
- **Names:** `degC` → coulomb·degree, `BTU` → byte·tesla·…, `mu0` → 0 kg, `epsilon0` → 0 J·bit, `NA` → N·A, `R` → röntgen, `h` → hour, `g` → gram, `e` → Euler's number. The real names: `°C`/`oC`, `Btu`, `magnetic_constant`/`μ_0`/`mu_0`, `electric_constant`/`ε_0`/`epsilon_0`, `elementary_charge`, `k_B`, `planck`, `c`.
- **Data files:** `units.xml.in` has 426 unit definitions (a count of `<unit` gives 982 because of nested references), `variables.xml.in` 166 constants plus 18 built-in, `prefixes.xml.in` 34; names carry flags before `:` (`ar:c,speed_of_light`, `au:Ω,r:ohm,p:ohms`); constants have a `uncertainty` attribute; some are formulas (μ₀ = 2hα/(c e²)), which need qalc to evaluate.

## 7. Where docs and code disagreed (2026-10-12), and the lesson

- The "L7 size test" named in plans did not exist.
- docs/03 listed `Ans` in Home; no key or parser rule reaches it.
- docs/03 said 982 units; there are 426 definitions.
- `rules.md` gave the parser to gorge; ron's agent file, 03 section 8 and the git history give it to ron.
- `rules.md` said "two principles" after CLAUDE.md had three.

**Lesson:** check claims in the code, the engine and the data, never in the docs alone; cite `file:line` or a probe; mark the rest (to verify) with who checks it and how.

## 8. How to check a claim quickly

| Question | How |
|---|---|
| What does Home, CAS or raw Giac give? | `node tools/probes/engine.ts …` (`MODE`, `DIGITS`) |
| What does the parser send? | `node tools/probes/parse.ts '<latex>'` |
| What is the right value? | the mpmath oracle in `tests/golden/.venv` (`python -I`), never memory |
| Does a digits change cost time or break a case? | `node tools/probes/digits-cost.ts` |
| What does qalc do with a unit expression? | `tools/probes/qalc/link.sh` once, then `node tools/probes/qalc/run.mjs …` |
| How big is a chunk? | `cd app && npx vite build --outDir <scratch dir>` |
| Who calls what? | `grep -rn` in `app/src` (skip `*.test.ts`); the test files show the intended behaviour |
| What did the reference do? | `tests/golden/g2.yaml`, `spec/mapping/vc-2026-10-11/keys.yaml` (clean room: nothing else) |
