<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Pascaline architecture for the precision-engineering goal

*sandra, 2026-10-12. Base: `phase-1` at b7734af. **This document supersedes [02-architecture-plan.md](02-architecture-plan.md) wherever the two differ.** docs/02 stays the record of the original plan and of the reasoning that still holds (solver choice in section 4, licence and F-Droid in sections 10–11). Binding inputs: CLAUDE.md (goal, three principles, hard rules), [03-feature-analysis.md](03-feature-analysis.md) (the owner's design rules), [decisions.md](decisions.md) P8. Every "today" statement cites `file:line` or a probe; Appendix A lists the probes and how to rerun them. **(to verify)** marks what was not checked, with who checks it and how (Appendix C).*

How to read each area: **today** (verified), **decision** (one, with the reason), **alternatives** (one line each), **budgets and gates**, **risks**, **what would change it**. Sections 1–7 follow the brief's areas 3.1–3.7. Section 8 has the component diagram, the interface list and the budget table.

## 0. The decisions on one page

1. **One mark on every Home and CAS number:** `=` the decimal shown is the exact value; `≈` rounded, and every digit shown is right; `⚠` fewer reliable digits than asked, or a failed check. The engine supplies the facts, our formatter decides the mark for the format shown (2.4).
2. **No digit is shown that the engine has not confirmed:** non-rational values are evaluated at two precisions and only agreeing digits are shown; floats that Giac's numeric code returns on the "exact" path are `⚠` until the function has passed an accuracy audit, and inverse functions are substituted back like Solve roots (2.4, 2.5).
3. **Digits up to 30**, working precision `max(30, digits+10)`, value precision `max(40, digits+10)` (2.5).
4. **Results are reused as chips that carry the full value**; Ans on Shift + `+`; an operator typed on an empty line starts with Ans, as on the reference (2.8).
5. **Copy gives the full value** (all confirmed digits, up to 40); "as shown", "exact" and LaTeX are in the Menu. Shift + View = Copy and Shift + Menu = Paste, the reference's positions (2.6, 5.1).
6. **CAS floats are marked `≈` and formatted by us.** Typed decimals in CAS become exact, like Home (**P9, accepted by the user 2026-10-12**) (2.9).
7. ~~Python `calc.eval` uses Home's exact-first evaluation~~: moot, the Python app is removed (P11, R5) (2.10).
8. **Find is one static index generated at build time** (Giac's English help lines, libqalculate's units, constants and prefixes, our alias file), searched by our own ranking code on the main thread, fetched when idle after the engine is ready and parsed on first open (section 3).
9. **Constants, units, prefixes and results enter the entry line as atomic MathLive macros** (`\const{ID}`, `\unit{ID}`, `\pfx{p}`, `\res{n}`, `\ans`); qalc never sees text the user typed (3.6, 4.3).
10. **The Units app parses with our P1 parser** and sends qalc only whitelisted names; qalc's default "try exact" mode is verified exact for SI-defined factors; our adapter turns qalc's silent non-answers (mismatched sums, misused temperatures) into messages (section 4).
11. **Keys:** Math = Find, Vars = Find on variables, Shift + Math = Memory, Tmpl = templates, Shift + Tmpl = Units app, View = compact keypad (K4), Shift + View = Copy, Shift + Menu = Paste, Shift + `+` = Ans, Shift + 5 = `[ ]`, Shift + 8 = `{ }`, Shift + 4 = matrix editor, Shift + `−` = Base, Help = context help (5.1).
12. **State:** one IndexedDB store with a schema version; user definitions are persisted and replayed at start, so variables survive a relaunch (6.2).
13. **The qalc engine build joins `build.sh` in milestone 4**, because the Find index takes its constant values and unit factors from it; the Units worker and app stay milestone 5 (7.1).
14. **New gates:** an automated size test, the task benchmark, the Find query test, marks in the golden files, `units.yaml`, a per-key Find timing on the Tab One (7.3).

The top risks are in section 9.

---

## 1. The goal as a test

### 1.1 Definitions

**Efficient** means the fewest key presses and no waiting. It is measured by:

| Id | Measure | Budget | Enforced by |
|---|---|---|---|
| E1 | Key presses per task | each active task within its budget; a unit in ≤ 4 presses at the median (rule 2) | `tests/tasks/tasks.yaml` replayed by Playwright (EN0) |
| E2 | Enter → drawn result, Home and CAS | p95 < 150 ms on the Tab One (today 92 ms) | `?bench=1` on the device (annabell), each release |
| E3 | Find: key → updated list | p95 ≤ 16 ms on the Tab One | `?bench=find` (new), milestone 4 gate |
| E4 | Start | keyboard usable < 1 s, engine ready < 1.5 s on the Tab One (today 662 / 995 ms) | device runs (`tools/device_run.py`), each release |
| E5 | First use of a lazy part | Units first result < 1 s; Find open → list ≤ 100 ms warm, ≤ 300 ms cold | device runs |
| E6 | Bytes | budgets in section 8.3 | size test (new, 6.3) on every build |

**Precise** means no digit shown is wrong, and the user can tell an exact value from a rounded one. It is measured by:

| Id | Measure | Budget | Enforced by |
|---|---|---|---|
| P1 | Golden cases, with their mark | 100 % at 12 digits; the precision set also at 20 and 30 | golden gate (`npm run golden`) |
| P2 | Known paths that show a wrong or unmarked number | zero; each one in 2.3 is a regression case first | golden gate, parser and e2e tests |
| P3 | Numeric roots | every root substituted back (existing) | `solve.yaml`, `function.yaml` |
| P4 | Units | a dimension mismatch is never a number; SI-exact conversions are `=` | `units.yaml` (milestone 5) |
| P5 | Copy | copy → paste gives the same value to every confirmed digit | e2e test per copy action (EN4) |

### 1.2 Every module against the goal

| Module | Faster | More trustworthy | Works against the goal today | Cost |
|---|---|---|---|---|
| Keyboard (`spec/keyboard.yaml`, `keyboard/`) | the reference's logical layout; hold-and-drag cursor (K2; removed by P11, 2026-10-13) | — | Vars, Math, Tmpl do nothing (`special: none`, `spec/keyboard.yaml:68-70`); no Ans key; no copy or paste | in the start chunk (142.6 kB total) |
| Entry, MathLive (`entry/controller.ts`) | textbook entry; result insertion (L5) | — | inserting a result inserts the **rounded** digits shown (`App.svelte:132`, `:270`) | 808 kB chunk after the keypad |
| Parser (`input/parse.ts`, `emit.ts`) | one rule per key | rejects unknown input | `0xFF` typed with the keys becomes `0*x*F*F` = 0 (probe, 2.3 #1); `\mathrm{…}` tokens are rejected (`parse.ts:540`) | 16 kB min |
| Engine client and Giac worker (`engine/workerEngine.ts`, `host.ts`) | engine in a worker, warm | Cancel restores definitions | the definitions log is stored in IndexedDB and replayed at start (G3, 6.2) | Giac 9.75 MB wasm |
| Home evaluation (`engine/homeEval.ts`) | 92 ms p95 | exact-first, 123/123 golden | a rounded result is `approximate: false` (`homeEval.ts:242`); lists, matrices and `solve` show Giac's raw text (`homeEval.ts:235-239`); floats returned by Giac's numeric functions count as exact (2.3 #2–#4) | — |
| Formatter (`engine/format.ts`) | re-formats without the engine | BigInt, one rounding | `tieRisk` is computed but nothing reads it (grep: only engine files) | in the start chunk |
| History and settings (`state/session.svelte.ts`, `storage.ts`) | history survives a relaunch | — | digits capped at 15 (`session.svelte.ts:86`, `Settings.svelte:22`); no schema version | — |
| Function app | Plot 56 fps on the Tab One | every number shown comes from the engine (`apps/function/compile.ts` header) | — | 19.6 kB + JSXGraph 1,035 kB lazy |
| Solve app | — | every root substituted back, ⚠ on failure | — | 8.2 kB lazy |
| CAS view (`host.ts:151-177`) | — | exact results | float results unmarked and sometimes wrong (2.3 #6) | — |
| PWA and Capacitor shell | offline; wasm stored uncompressed (R2) | no trackers, no INTERNET permission (C5) | — | the whole build is precached: 13 MB today |
| Build (`build.sh`, P2 container) | — | reproducible engine | no automated size gate (the "L7 size test" in the backlog does not exist: no test reads chunk sizes) | — |

---

## 2. Precision chain, end to end

### 2.1 Today, per path

All "probe" rows ran on the dev engine `engine/giac/_out/gsl` through `EngineHost` (Appendix A).

| Path | Where | Working precision | Rounding | What the user sees | Marked today |
|---|---|---|---|---|---|
| Home exact, rational (`1/4`, `1/3`) | `homeEval.ts:219`, `:242` | exact rational, BigInt division (`format.ts:68`) | once, half away from zero, to `digits` | `0.25`, `0.333333333333` | no (`approximate: false` for both) |
| Home exact, irrational (`sqrt(2)`, `sin(10^22)`) | `homeEval.ts:168` | `evalf(…,40)` (MPFR) | once | `1.41421356237`, `-0.852200849767` (both right) | no |
| Home "exact" path, but Giac's numeric code returns a float (`normald_icdf`, `romberg`, `fsolve`, `BesselJ`) | `homeEval.ts:219` then `:168` | whatever Giac's routine gives: a double at `Digits` ≤ 14, its own MPFR code above | once, from a value with unknown accuracy | can be wrong (2.3 #2, #4) | no |
| Home exact-big (`2^200`) | `homeEval.ts:243-247` | exact; Ans becomes a 30-digit float (`:246`) | once | `1.60693804426E60` | no |
| Home float-timeout, float-error | `homeEval.ts:190-196` | Giac floats at `workDigits` = 30, decimals read as binary | once | the number | "approximate" note (`History.svelte:106`) |
| Home non-number (lists, matrices, symbols, `solve`) | `homeEval.ts:235-239`, `render/home.ts` | exact | none | Giac's text: `[1/3,2]`, `[[-2,1],[3/2,-1/2]]`, `list[-sqrt(2),sqrt(2)]` (probe) | no |
| Solve, Function analysis | `solve.ts:17`, `:66` | `max(30, digits+10)`; residual at work precision, relative ≤ 1e-15 | once | the number | `approximate: true`; ⚠ when the residual check fails |
| Function Num | `analysis.ts:31-43` (each cell is `homeEval`) | as Home | as Home | the number | no |
| Function Plot | `input/emit-js.ts` | JS doubles | — | drawing only; trace values come from the engine | — |
| CAS exact | `host.ts:163-174` | exact | none | 2D LaTeX | — |
| CAS approximate | `host.ts:79` (`Digits` = Home digits) | Giac floats, decimals read as binary | Giac's printing, not our formatter | `1-0.9-0.1` → `1.7763568394e-15`; `evalf(sin(10^22))` → `-0.54764225985`; `1e16+1-1e16` → `0.0` (probes) | no |
| Units app (milestone 5) | section 4 | qalc, "try exact" | — | — | — |

**Reuse and copy today.** No clipboard, share or CSV code exists (03 section 2, grep). Tapping a result, or Up then Enter, inserts the LaTeX of the displayed text (`App.svelte:132`, `:270`), so the rounded digits. The engine keeps `pasans` and `pcasans`, but nothing reaches them: `Ans` typed with Alpha parses as `A*n*s` (probe), and the reference's Ans key (Shift + `+`) is "not ours yet" (`spec/keyboard.yaml`, key `add`).

### 2.2 Where the facts live

Only the engine knows the path, whether a value is an exact rational, and how many digits are confirmed. Only the app knows the display format the user picked and whether an input was a measured constant. So the engine reports facts and the app's formatter (pure functions in `format.ts`, run on the main thread) turns them into the mark for whatever format is on screen. A settings or Format-key change re-marks the history without the engine, as it already re-formats it.

### 2.3 Paths that show a wrong or unmarked value today

Each item becomes a regression case before its fix (CLAUDE.md). Values marked `oracle` come from mpmath at 40 digits (`tests/golden/.venv`).

| # | Input and path | Shown today | Correct value | Fix (milestone) |
|---|---|---|---|---|
| 1 | Home, keys `0` `x` Alpha-F Alpha-F Enter: parser gives `0*x*F*F` (probe) | `0`, as an exact result | 255 (`derived`) | parser rejects `0x`/`0b` followed by letters with a message (m4); a real literal with EN6 (m6) |
| 2 | Home `normald_icdf(10^-10)`, 12 digits | `-6.36134035799`, no mark | −6.36134090240… (`oracle`): wrong from the 8th significant digit. At 30 digits Giac gives `-6.3613403515334`, also wrong and different | the agreement check alone is **not enough** here: Giac's two evaluations agree on 9 digits, and the 8th is already wrong. So inverse functions are substituted back, like Solve roots: a 40-digit `fsolve(normald_cdf(x)=10^-10, x=<Giac's value>)` gives −6.36134090240405620469537582826518… (32 digits agree with the oracle; `normald_cdf` is right in the tail: probe). Until that polish exists, Home marks these results `⚠` and Find does not list them as tier 0; report upstream (m4 for the mark, m6 for the polish with EN7) |
| 3 | Home `UTPN(10)` at 30 digits | `7.61985302416052604747040248572E-24` | 7.619853024160526065973…E-24 (`oracle`): wrong from the 17th digit (cancellation in `1-erf` at 40 digits) | agreement check at P and P+20 (m4) |
| 4 | Home `romberg(exp(-x^2),x,0,1)` at 30 digits | `0.746824132812427041600115591871` | 0.746824132812427025399467436132 (`oracle`): wrong from the 17th digit | float from a function not on the audited list → `⚠` until romberg is audited (2.4 rule 3; M4-1) |
| 5 | Home `BesselJ(1,2)`, `Airy_Ai(1)`, `BesselJ(0,100)` at 15–30 digits | the input as text (`BesselJ(1,2)`): Giac has no MPFR path (`evalf(BesselJ(1,2),40)` at `Digits:=30` → "Bad Argument Value") | J₁(2) = 0.576724807757 at 12 digits (`oracle` agrees) | not wrong, but the answer is lost: fall back to a ≤ 14-digit evaluation and show `⚠` with the digits available (m4) |
| 6 | CAS `1-0.9-0.1`; `evalf(sin(10^22))`; `1e16+1-1e16` | `1.7763568394E-15`; `-0.54764225985`; `0.0` | 0 (`derived`); −0.852200849767… (`oracle`; Home gets it right); 1 (`derived`) | marks in CAS and P9, exact decimals in CAS (accepted) (m4) |
| 7 | ~~Python `calc.eval("1-0.9-0.1")`~~ | 1.7763568394e-15 | 0 (`derived`; Home shows 0) | moot: the Python app is removed (P11, R5) |
| 8 | Home `1/3`, tap the result, `×3` | `0.999999999999` | 1 is what the user meant; 0.999999999999 is right for what was inserted | result chips that carry the full value (m4) |
| 9 | Home `1/3` and `1/4` | `0.333333333333` and `0.25` look alike | — | the mark (m4) |
| 10 | Units (qalc data, m5) `1 hp to W` | 745.699987158 W, **flagged exact** by qalc (probe) | 745.69987158227… W (`derived`: 550 ft·lbf/s = 550 × 0.3048 × 0.45359237 × 9.80665): wrong from the 7th digit | the accepted P3 one-number patch, a golden case, the data audit (m5) |

At the default 12 digits in Home, #1 and #2 show wrong digits today; #3–#5 appear only above 15 digits, which the setting does not allow yet, so they gate EN3(a).

### 2.4 Decision: the mark and the agreement check

**The mark.** Shown before every numeric result in Home and CAS, small and muted, in the result's colour:
- **`=`** when all of these hold: the engine says the value is an exact rational (exact path, Giac returned `p/q`); the text shown in the current format is exactly `p/q` (our formatter knows: the `sticky` flag and the digits cut off); no input was inexact (a constant with a CODATA uncertainty, or a result chip whose value is not exact, 2.8). Examples: `1/4` → `= 0.25`; `0.1+0.2` → `= 0.3`; `1e300*1e300` → `= 1E600`; `1/4` in FIX 1 → `≈ 0.3`.
- **`≈`** for every other number, provided every digit shown is confirmed: `1/3`, `sqrt(2)`, `2^200` in STD, the float fallbacks, constants with an uncertainty.
- **`⚠ n`** when fewer than `digits` digits are confirmed: the result is shown with the `n` confirmed digits and the mark says so. Solve and analysis keep their existing ⚠ for a failed residual check.
- No mark for non-numbers (symbolic results). A list or matrix of numbers gets one mark, the weakest of its elements, and every element is formatted by our formatter (today Giac's text: 2.1).

Num tables and the Solve and analysis results show only `⚠` (a mark on every cell would be clutter; their view header says "rounded to n digits"). The existing "approximate" note goes away: `≈` covers it.

**The agreement check** (engine, `homeEval.ts`, `solve.ts` `numericResult`, `analysis.ts`):
1. An exact rational needs no check: BigInt is exact.
2. Any other value is evaluated at precision P = `max(40, digits+10)` and again at P + 20. The confirmed digits are the largest n at which both values, widened by their difference (plus one ulp), round alike (G2; stricter than "common digits less one" at ties). If fewer than `digits` agree, the check runs once more at P + 20 against P + 40. If they cover the shown digits, the mark is `≈`; otherwise `⚠ n`. A float from a function that is not audited shows `⚠` without a count (M4-5): two of Giac's routines can agree on wrong digits.
3. A value that Giac's numeric code returned as a float on the "exact" path (the exact output is a float literal, as `normald_icdf` gives `-1.2815515655446`) is re-evaluated once with `Digits` on the other side of 14 (double ↔ MPFR) and compared the same way. If one side has no value (2.3 #5), the other side's digits are shown, at most 15 for a double. Such a value gets `⚠` unless every function in the input is on the audited list (tier 0, 3.3), because agreement between two of Giac's routines does not prove either right (2.3 #2).
4. A `tieRisk` value (`format.ts:134`) is re-evaluated at P + 20 before rounding, so the flag finally has a reader.

Cost: one more `evalf` for irrational results (each about 1 ms on the desktop, probe timings) and one more evaluation only for the rare float-returning inputs.

**Golden cases:** every numeric case in `home.yaml` gets `mark: "="|"≈"|"⚠"`, checked by the gate; `oracle.py` checks that `=` appears exactly when the oracle value equals the expected text. A new `tests/golden/precision.yaml` holds the cases at 20 and 30 digits (`oracle`) and the regression list of 2.3.

**Alternatives:** a mark computed in the app from `approximate` alone (cannot tell 1/3 from 1/4); a mark only on float paths (leaves rounded exact results unmarked, against principle 3); interval arithmetic in Giac (no general support; far more work).

**Risk:** both evaluations wrong in the same way is not caught: in 2.3 #2 both of Giac's algorithms are wrong in the 8th digit and agree up to the 9th. The answers are the substitute-back polish for inverse functions (as for Solve roots), the function audit for Find (3.3, tier 0: golden cases at the edges of each domain) and upstream reports. Until a function has passed the audit, a float that Giac's numeric code returned for it is shown with `⚠`, never a bare `≈`.
**Would change if:** Tab One timing shows the extra `evalf` costing more than 20 % of Enter p95; then the check runs only above 15 digits and for float-returning inputs.

**Built in G3:** stored floats keep their facts in the defs log; a result that uses them inherits the weakest, checked by perturbation (M4-7). `evalf(e,n)`/`approx(e,n)` are rewritten to the check's precision, and n becomes the display digits in Home and CAS (M4-6; Home by the owner, 2026-10-13). Solve and analysis roots are compared after a second polish at W+20 (M4-8). A value that is 0 in every evaluation but not an exact rational shows `⚠` without a count, never `≈ 0` (owner, 2026-10-13: `exp(10^-70)-1`).

### 2.5 Decision: digits up to 30

- The setting allows 1–30 (`session.svelte.ts:86`, `Settings.svelte:22`); stored values 1–15 stay valid (6.2 migration).
- Home `workDigits = max(30, digits+10)` (today fixed at 30, `homeEval.ts:49`; Solve already does this, `solve.ts:17`). The value precision P = `max(40, digits+10)` replaces the fixed 40 (`homeEval.ts:168`) and `DECIMAL_KEEP` (`format.ts:19`) follows it, so rounding at 30 digits keeps 10 guard digits.
- `sigfig` and our other Giac definitions load on first use, not at engine start (G2).
- The agreement check (2.4) is what makes 20 and 30 digits honest: without it, 2.3 #3–#5 would go out unmarked.
- **Latency, measured on the desktop** (123 `home.yaml` inputs through `EngineHost`, 3 rounds, last round timed): digits 12 p50 0.15 ms / p95 2.74 ms; digits 30 p50 0.14 ms / p95 3.63 ms; the same max (the 300 ms budget case) and no case changed path. This is cheap because the exact path already uses a 40-digit `evalf` and the float fallback already runs at 30 digits; Giac's switch to MPFR above 14 digits only affects floats that Giac itself computes.
- **Tab One measurement (annabell, milestone 4):** the 55 `bench.yaml` and 123 `home.yaml` inputs at digits 12, 20 and 30 (a `digits` parameter for `?bench=1`), medians of 5 cold runs. **Gate:** p95 at 30 digits < 150 ms and ≤ 1.3 × the 12-digit p95. If it fails, the setting stops at 20 and Settings says why.

**Alternatives:** keep 15 (no reason was ever given; engineers comparing with reference data need more); unlimited digits (the 40-digit value path and the screen width set a natural limit at 30).

**`sigfig(x,n)`** (EN3 d): an engine definition loaded with Giac that rounds the exact value to `n` significant digits and returns an exact decimal rational, so `sigfig(1/3,3)` is `= 0.333`. The power of ten is found exactly (BigInt on the rational, not `floor(log10(…))` on a float, which can land on the wrong side at 999.95). Golden cases at the boundaries: 999.95 at 4 digits, 0.0012345 at 3, negatives, ties.

### 2.6 Decision: copy and paste

| What | Default copy (Shift + View, long press) | Menu: as shown | Menu: exact | Menu: LaTeX |
|---|---|---|---|---|
| Home or CAS number | full value: every confirmed digit up to P (40), trailing zeros dropped, `.` (`,` with the decimal-comma setting), plain for 1E-4 ≤ \|x\| < 1E21, else `d.ddd…E±k` | display text, without the mark | Giac's exact text when it exists (`1/3`, `sqrt(2)`) | the result LaTeX |
| Complex | `a+b*i`, each part as above | yes | yes | yes |
| List, matrix | `[a,b]`, `[[a,b],[c,d]]`, elements as above | yes | yes | yes |
| Solve root, analysis value | full value | yes | — | — |
| Num table | CSV (Menu, Export): header row with the function names, full values, `.` and `,` as separator (`;` with decimal comma) | — | — | — |
| Units result (m5) | `20 m/s`, `39.5±1.3 m^2` (value full, uncertainty 2 significant digits) | yes | `(1397/3125) m/s` | yes |
| Session (Menu, Share) | text: one line per entry, `input = result` with the mark, full values | — | — | — |

**Paste** (Shift + Menu, or Menu → Paste): the clipboard is read as one number (`-1.5`, `1,5` with decimal comma, `1.5e-3`, `1.5E-3`, `i` parts); it enters as the keyboard's own LaTeX (`1.5\times10^{-3}`), so the parser sees only what our keys produce. Anything else gives the message "Paste: not a number". Pasting a result copied from Pascaline gives the same value back (P5).
**Mechanics:** `navigator.clipboard` (works in a secure context; Capacitor serves `https://localhost`); `@capacitor/clipboard` only if the Tab One WebView 131 check fails **(to verify, annabell)**. Share needs `@capacitor/share` in the APK (Android WebView has no `navigator.share` **(to verify)**), `navigator.share` in the PWA where it exists, else copy.

**Alternatives:** copy the displayed text by default (hides digits, against principle 3); copy the exact form by default (`1/3` pastes badly into spreadsheets and code).

### 2.7 Decision: SI prefix display, and prefix entry

- **Display:** a format `PFX` beside ENG: `n` significant digits as in ENG, the exponent replaced by f p n µ m (none) k M G T P (10⁻¹⁵ to 10¹⁵); `µ` is U+00B5. Outside that range, ENG E notation. Drawn as mantissa, thin space, prefix in the accent colour, so `1.5 m` (milli) reads as a prefix and not as metres. In Settings and the Format key cycle. Copy always gives the full value, never the prefix text. Built (R3): the prefix is drawn as `\class{pfx}{\mathrm{k}}`, coloured `--shift` in `Math.svelte`; ENG and PFX keep trailing zeros to n digits (`2.500 k` at 4 digits). Formatter work in `format.ts` (gorge), unit tests per prefix boundary and rounding into the next prefix (999.96 k at 4 digits → 1.000 M).
- **Entry (gated by benchmark task 3):** only through a prefix chip `\pfx{k}`. Letters typed with Alpha stay variables (`4.7k` parses as `4.7*k`: probe), so a variable `k` and the prefix k never collide. Parser rule: a numeric literal directly followed by `\pfx{X}` becomes the exact `(literal*10^e)`; `\pfx` anywhere else is a parse error. One round-trip case per chip.

### 2.8 Decision: reuse through chips and Ans

- **Result chip `\res{n}`:** tapping a history result, or Up then Enter, inserts a chip drawn as the number shown. Each history item stores `full`: Giac's exact text when the result is exact and ≤ 2 kB, else the P-digit decimal. The parser turns the chip into that text (an exact rational literal for decimals). Its exactness travels: a result computed from a chip whose value is not exact (an irrational result carried as digits, a constant with an uncertainty) cannot be `=`; a chip that carries an exact value keeps the result exact, so `1/3` (shown `≈ 0.333333333333`) tapped `×3` is `= 1` (2.3 #8; user, 2026-10-12, M4-4).
- **Ans:** `\ans` is the view's last result, inserted by Shift + `+` (the reference's position, `spec/mapping/vc-2026-10-11/keys.yaml` r10c5). Ans is resolved by the app at Enter from the view's last history result (its chip value), not from Giac's `pasans`/`pcasans`, so it survives a Cancel (worker restart) and a relaunch (R2).
- **Operator on an empty line:** `+ − × ÷ xʸ x² x⁻¹` on an empty entry line insert `\ans` first, as the reference does (keys.yaml r9c5, r10c5, r5c1: "Ans+ on an empty line"). `(−)` stays negation. This saves a press in every chained calculation; benchmark tasks measure it.

**Alternatives:** insert the full digits as text (40 digits clutter the line); keep inserting the rounded digits (2.3 #8).

### 2.9 Decision: CAS

- A CAS result that contains a float gets `≈`, and its numbers are drawn by our formatter at the digits setting (`CasResult` gains the numeric value when the result is a number, 8.2); its text and LaTeX come from `numeric`, never Giac's float. Exact CAS results get no mark. An explicit precision (`evalf(x,50)`) is honoured: that many digits, only the confirmed ones (M4-6).
- **P9 (accepted by the user, 2026-10-12):** typed decimals in CAS become exact rationals before evaluation, as in Home (`toExactLiterals`); `approx()` (Shift + Enter) gives decimals. This removes 2.3 #6 at the source (the mark alone would show `≈ 1.7763568394E-15` for `1-0.9-0.1`: marked, but not right). The visible change: `1.5x` shows as `3/2·x`, where the reference CAS keeps `1.5·x`. The `bench` stage of the golden gate runs in CAS mode, so its decimal inputs are re-checked.

### 2.10 Decision: Python

Removed (P11, 2026-10-13; R5 the app side, A5 the build side). The Python app, its worker and the `calc` bridge are gone, so 2.3 #7 has no subject and `python.yaml` left the golden gate. The earlier decision (`calc.eval` through `MathEngine.home()`) is in git history.

### 2.11 Risks and what would change it
- Marks add a little text to every line. If the owner finds them noisy on a device, `=` could become the absence of a mark, keeping `≈` and `⚠` (one setting, no architecture change).
- Correlated errors in Giac's numeric routines (2.4). The audit of tier-0 functions (3.3) and upstream reports are the answer.

---

## 3. Find (EN1)

### 3.1 Today
- Vars, Math and Tmpl do nothing (`spec/keyboard.yaml:68-70`). `PickList.svelte` is a numbered list over the view; while it is open, digit keys pick (`App.svelte`, `press`).
- Any `\operatorname{name}\left(…\right)` reaches Giac as `name(…)` (probe: `\operatorname{par}\left(4.7,10\right)` → `par(4.7,10)`), so inserting a function needs no new parser rule.
- **Data, checked 2026-10-12:** Giac's `doc/aide_cas` has 1,780 entries, each with an English line (average 80 characters) next to syntax and example lines. libqalculate 5.13.1 `units.xml.in` 426 unit definitions (prefixed forms are not separate entries; a plain count of `<unit` tags gives 982 because 556 of them are references inside definitions), `variables.xml.in` 184 constants (166 plus 18 built-in) with name kinds (`ar:c,speed_of_light`) and an `uncertainty` attribute, `prefixes.xml.in` 34 prefixes. `aide_cas` also lists Giac's own units and constants (`_kph`, `_c_`), which must not enter the index (P3 decision 1).
- **Prototype measurements** (`tools/probes/find/`, reading the pinned tarballs): an index of names, English lines, titles and values, without Giac's `_` entries: 2,179 items (1,569 functions, 426 units, 184 constants), 282 kB JSON, 68 kB gzip, 59 kB brotli. A tiered ranking in plain JS over it: p50 0.82 ms, p95 1.04 ms per key on the desktop (20 queries × 20 rounds; a first scratch run with Giac's `_` entries, 2,390 items, gave p95 1.23 ms). It already ranks `speed` → c, `kph` → km/h, `ohm` → Ω, `normlad` → normald.

### 3.2 Decision: where it runs
**Main thread.** 1.2 ms per key on the desktop leaves room for a 10× slower Tab One inside 16 ms; a worker would add a message round trip per key. **Gate:** `?bench=find` replays 50 queries one character at a time, timing key → list rendered; p95 ≤ 16 ms on the Tab One (annabell). If it misses, first filter incrementally (each key narrows the previous candidates), then move ranking to a worker.

### 3.3 Decision: the index

**Schema** (one JSON array; ids are stable and become the token IDs):

```ts
interface FindItem {
  id: string;              // "fn:stddev", "const:c", "unit:km/h", "pfx:k", "tmpl:matrix"
  kind: "fn" | "const" | "unit" | "pfx" | "tmpl";
  names: string[];         // what a user may type: name, symbol, aliases (searched lower case)
  title: string;           // English; other languages in overlay files keyed by id
  desc?: string;           // one line: Giac's English help line or qalc's title
  syntax?: string;         // fn: "stddev(list)"
  example?: string;        // fn: from aide_cas
  value?: string;          // const: exact decimal text, all digits
  unc?: string;            // const: standard uncertainty (CODATA), absent when exact
  unit?: string;           // const: canonical unit expression
  dim?: string;            // const, unit: dimension key (4.3)
  si?: string;             // unit: exact factor to SI base as p/q; offset for °C, °F; absent when qalc's factor is approximate (dim stays)
  tier: 0 | 1;             // 0: curated, audited, ranked first; 1: documented only
  insert: string;          // LaTeX the entry line receives (macro or \operatorname template)
}
```

**Amended 2026-10-13 (G4, user):** in the index file a tier-1 function has no `insert`; `prepare()` fills in `\operatorname{name}\left(#?\right)` at load (saves about 70 kB raw), so `FindItem.insert` stays required after loading. A unit whose qalc factor is uncertain or approximate (solar_mass, cal_fifteen, cal_mean, u, Da, the Planck and atomic units) keeps `dim` and has no `si`.

Live items (variables, user functions) have the same shape with `kind: "var" | "userfn"`, built at run time (3.4).

**Format and size:** `find-index.<hash>.json`, a Vite asset outside every chunk. Budget ≤ 400 kB raw, ≤ 100 kB gzip (prototype: 282 / 68; G4: 395 / 74.5, so the raw budget is nearly used up, see decisions.md G4). **i18n:** English titles and descriptions in the index; another language is an overlay file `find-index.<lang>.json` keyed by id with its own titles and aliases, merged at load. The structure allows it now; only English ships.

**Generation, from source at build time** (gorge; `tools/find-index/generate.mjs`, Node, no network; run by `build.sh` after the engines, and by `npm run index` in development; output gitignored under `app/src/find/_gen/`):
1. Giac `doc/aide_cas` from the pinned tarball: names, the English line (`2 …`) only, never French (R5), syntax and examples; entries starting with `_` dropped.
2. libqalculate 5.13.1 `units.xml.in`, `variables.xml.in`, `prefixes.xml.in` from the pinned tarball; `currencies.xml.in`, `elements`, `planets`, `datasets` skipped.
3. **Values from the built qalc engine run in Node:** each constant's value, uncertainty and unit; each unit's SI factor; a round-trip check that every unit and constant ID parses back to itself. This check is needed: qalc reads `mu0` as 0 kg, `epsilon0` as 0 J·bit, `degC` as coulomb·degree, `BTU` as byte·tesla·…, `NA` as N·A, `R` as röntgen, `h` as hour, `g` as gram (probes, 4.1). Formula-defined constants (μ₀, ε₀, the Bohr magneton) need qalc to evaluate them, which is why the qalc build moves into milestone 4 (7.1).
4. Our own files: `find/aliases.yaml` (what users type and the data lacks: `kph`, `c0`, `eps0`, `degC`, `stdev`; per item id) and `find/functions.yaml` (tier 0: the curated functions, each with our own one-line description and the id of its golden accuracy case), plus the common prefixed units as items (`km`, `mm`, `µm`, `kN`, `MPa`, `kW`, `mA`, `kΩ`, `µF`, `MHz`, `kWh`, …: our list).

**Tier 0** is the audited set: every tier-0 function has a golden case at 12 digits against the oracle, including the edges of its domain (where 2.3 #2 was found). Tier 1 is everything else Giac documents, ranked below tier 0 and labelled "not checked" in the preview.

**When it loads:** fetched when the browser is idle after the engine is ready (the same hook as the service worker registration, `main.ts:53-57`), parsed on the first Find open; if Find opens first, it fetches then. Never in the start chunk (size test).

**Licences, and what THIRD_PARTY.md must say** (with the code, not before): "Find index data": Giac `aide_cas`, English entries only, GPL-3.0-or-later per Giac's README (R5; P10, accepted 2026-10-12: shipped now, confirmation from B. Parisse before any public release), authors as R5 lists; libqalculate 5.13.1 data files, GPL-2.0-or-later (same licence as the library; combined work GPL-3.0); our alias and function files (ours). The About screen credits both.

**Alternatives:** generating at run time from the engines (costs start-up and memory); committing the generated JSON (F-Droid: generated data in git is not our source); all 1,780 Giac commands at the same rank (buries what engineers use under graph theory and geometry).

### 3.4 Live entries
The engine host reports the name each stateful input defines (`defined: {name, kind}`, from `:=` and ▶; `host.ts` already detects stateful inputs at `:56`). The session keeps `userNames` (name, kind, formatted value preview, view, time), read through `Calc.names()` from the persisted defs log (6.2), so Vars works after a relaunch. Find merges them at query time and ranks them like recents. Python names stay in the Python app (its own completion, later).

### 3.5 Ranking
**Amended 2026-10-13 (P11): no usage boost**, so the same query always gives the same order (docs/03 rule 8); with an empty query Find shows the G2-style Math menu (fixed categories, fixed order). Our own code (`app/src/find/rank.ts`, about 150 lines). Order: ~~(1) usage boost: count and recency from `find.usage`~~; (2) exact match of a name, symbol or alias; (3) prefix of one, shorter first; (4) word prefix inside one (`_`, space); (5) word prefix in the title or description; (6) one edit away (insertion, deletion, substitution, transposition) for queries of 4+ characters. Ties: tier 0 first, then the context's kind (variables in Vars, units in the Units app), then the shorter name, then id. Nothing is stored (no `find.usage`). Built as written (G4), with the usage boost removed before the merge.
**Alternatives:** uFuzzy or fuzzysort (MIT, 4–7 kB): fast, but neither knows our tiers, usage or kinds, so we would wrap them in the same code; Fuse.js (Apache-2.0, about 24 kB, slower). Principle 1 yields here because the measured cost of our own code is 1.2 ms and the rules are ours.

### 3.6 Insertion and tokens
- MathLive macros on the entry field, all `captureSelection: true, expand: false` (`MacroDefinition` in `mathlive/types/core-types.d.ts:146-155`), so the cursor cannot enter a chip and `getValue()` keeps the macro: `\const{ID}`, `\unit{ID}` (Units app only), `\pfx{p}`, `\res{n}`, `\ans`. Verified (R2, 2026-10-12): MathLive 0.111.1 keeps expand:false macros in the value (`entry/macros.test.ts`, `app/test/chips.spec.ts`). The chip macros take a second argument that is only what they show: `\res{k}{shown LaTeX}`, `\const{ID}{symbol LaTeX}`; a macro definition cannot look up a value, so the display travels in the LaTeX and the value in the chip table. A Find item's `insert` for a constant is `\const{ID}{symbol}`, ID being the item id without `const:`.
- **Parser:** `\const{ID}` becomes, in Home, CAS and Solve, the constant's exact value as a rational literal (`299792458`, `(667430/10^16)`), and the parser reports `inexact` when the constant has an uncertainty, so the result is `≈` (2.4). In the Units app it becomes the qalc name. **Chips carry their own values** (Henri, 2026-10-12, at review): when a `\const` chip is inserted, its value and uncertainty are copied from the index into the entry's chip table, which each history item stores beside the entry LaTeX (as it stores `full` for `\res`). The parser reads the table, never the index, so parsing stays synchronous and a recalled entry after a relaunch needs no index load. History keeps the chip in the entry LaTeX, so a recalled entry shows `G`, not 6.6743E-11.
- Functions insert `\operatorname{name}\left(#?\right)`; templates insert their LaTeX, each with a parser rule and round-trip case.

### 3.7 Keys inside Find
Every key types its Alpha letter in lower case (no Alpha press); Shift + key types the key's primary character (digits, `.`); the space key types a space; ⌫ deletes; ▲▼ and the trackpad move the selection; Enter inserts; Esc or Cancel closes. Vars opens Find filtered to variables; ⌫ on an empty query removes the filter. Digits do not pick, unlike `PickList`, because queries need them (`g0`, `log10`, `e24`).
**Keystroke budget:** an item used before: Math, first letter, Enter (3 presses); a new one: Math, the letters, Enter. Benchmark task 5 checks it.

### 3.8 The query test
`tests/tasks/find-queries.yaml` (`query`, `expect` id, `note`), run by Vitest against the generated index and the real ranking (`app/src/find/queries.test.ts`). **Gate:** every phrase in the top 3, at least 90 % first. The first 100 phrases are in Appendix B, plus 10 `pending` ones whose items arrive in milestone 6. The owner adds a phrase whenever Find misses one.

### 3.9 Budgets, risks, would change
Budgets: index ≤ 100 kB gzip; key → list ≤ 16 ms p95 on the Tab One; Find open ≤ 100 ms warm. Risks: alias quality (only the query test and real use show it); the chip look (screenshot test). Would change if the Tab One misses 16 ms (incremental filtering, then a worker), or the index outgrows 100 kB gzip (split functions and units into two files).

---

## 4. Units: the unit view (EN2, P3 as amended by P8 and P11)

**Superseded in part by P11 (2026-10-13):** there is no separate Units app. Units are added *after* the formula, in unit slots (decisions.md P11; layout and press count: package S1, `docs/research/r7-unit-slots.md`). The qalc worker, the adapter checks and the data audit below still hold; sections 4.3 and 4.4 (entry and gates) were rewritten after package S1 (accepted by the owner 2026-10-13).

### 4.1 Today (the qalc spike build, probed 2026-10-12)
I relinked the spike's libraries (`../pascaline-deps/qalc-spike/build/prefix`, libqalculate 5.13.1) with a throwaway probe glue that reports qalc's own approximation flags (Appendix A). Default evaluation options, so `APPROXIMATION_TRY_EXACT`, precision 12.

| Input | Result (fraction form / decimal) | qalc approximate? |
|---|---|---|
| `72 km/h to m/s` | 20 m/s | no |
| `1 in to mm`; `1 ft to m`; `1 mph to m/s` | 127/5 mm; 381/1250 m; 1397/3125 m/s | no |
| `1 lbf to N` | 8896443230521/2000000000000 N = 4.44822161526 N | no (the 12-digit print is rounded: print flag set) |
| `1/3 m to cm` | 100/3 cm = 33.3333333333 cm | no (print rounded) |
| `20 °C to K`; `100 °F to °C`; `300 K to °C` | 5863/20 K; 340/9 °C; 537/20 °C | no |
| `c`; `planck`; `k_B`; `1 eV to J` | exact (SI-defined since 2019) | no |
| `G`; `electron_mass` | 6.67430E-11 ± 0.00015E-11 m³/(kg·s²); value ± uncertainty | yes |
| `90 deg to rad`; `1 Np to dB`; `sqrt(2) m` | 1.57079632679 rad; 8.68588963807 dB; 1.41421356237 m | yes |
| `1 W to dBm`; `4.7 kΩ`; `1 µF * 4.7 kΩ` | 30 dBm; 4700 Ω; 47/10000 s | no |
| `(12.34 ± 0.05) m * (3.2 ± 0.1) m` | 39.5 ± 1.3 m² | yes |
| `1 m + 1 s` | `1 m + 1 s` (**no error**) | no |
| `20 °C + 5 °C`; `20 °C * 2` | 25 °C; 40 °C (**accepted**) | no |
| `1 hp to W` | 745.699987158 W, exact rational (**wrong**, 2.3 #10) | no |
| `degC`, `BTU`, `mu0`, `epsilon0`, `NA`, `R`, `h`, `g`, `e` | coulomb·degree; byte·tesla·…; 0 kg; 0 J·bit; N·A; röntgen; hour; gram; Euler's number | — |
| precision 30: `1 lbf to N`; `90 deg to rad` | 4.4482216152605 N exact; 1.57079632679489661923132169164 rad | no; yes |

Calls took 0.2–28 ms in Node (the first conversion 28 ms). So: **"try exact" gives exact SI conversions** (the P8 question is answered: `72 km/h → m/s` = 20 exactly, `1 in → mm` = 25.4 exactly); qalc reports approximation reliably for π, logarithms and uncertainties; and qalc silently accepts mismatched sums, offset-unit arithmetic and misread names.

### 4.2 Decision: the `UnitEngine` and its worker
Worker 3, loaded on the first press of the units key; never at start. Same pattern as Giac: an async interface, a module worker, Cancel = terminate and respawn (qalc runs on the calling thread, no pthreads; nothing to replay, since each call is self-contained and the Units app keeps its own Ans app-side). Interface in 8.2. The glue (`engine/qalc/glue.cc`, from the spike) returns one JSON result per call: the number as an exact fraction when qalc's structure is not approximate, else a decimal at precision P = `max(40, digits+10)`; the unit part as canonical qalc names with exponents; the dimension (from `convertToBaseUnits`); the uncertainty; qalc's approximate flag.
**Memory with three workers alive (to verify, annabell, U5):** `dumpsys meminfo` PSS on the Tab One with Giac and qalc loaded, then a 10-minute mixed session. Gate: no low-memory kill.

### 4.3 Decision: the unit view (entry, parsing, results)
- **Entry (P11, layout in `spec/keyboard.yaml` `unit_slot:`, press count in docs/research/r7-unit-slots.md):** the
  units key (Shift + Tmpl, a flick up on Tmpl) on an entry line or a picked history row shows the same formula,
  read-only, with an empty unit slot after every number and an optional end slot "→ should be". On an empty line
  it opens one slot (quantity 1) and the end slot. ◀ ▶ jump between slots, never through the formula; a tap on
  the formula still puts the cursor there. Numbers belong in the formula: digits in a slot are only exponents.
  Built on MathLive's prompts: a read-only mathfield with `\placeholder[id]{}` per slot (`getPromptRange`,
  `getPromptValue`, MathLive 0.111.1 `types/mathfield-element.d.ts:781-810`) **(to verify, ron, first step: a
  stacked fraction inside a prompt, and our key handling routed to the prompt)**.
- **Grammar per slot:** a product of factors with `×`, one `÷` (the rest is the denominator), powers, `x⁻¹`, `√`.
  A factor is one symbol from Find's unit list: an exact symbol first, then prefix + symbol. The parser in
  `units` mode emits qalc text from these whitelisted names only (the generator's round-trip check, 3.3).
  **Alternative rejected:** qalc's own parser, which reads `BTU`, `lbm`, `var`, `Kg`, `pa`, `G` as other things
  (docs/research/r7-unit-slots.md section 5.2).
- **Live reading:** under the slot, in words; a prefixed unit outside Find's common list is marked; a factor that
  is no symbol is an error naming it with the near symbols. A prefix alone is an error.
- **Our adapter checks what qalc lets through:** the formula with its units must give a single term (number ×
  units), else "Units don't match: L vs T" naming the term (P11); an absolute temperature in arithmetic → "Use K
  or Δ°C for a temperature difference"; with an end slot, a dimension mismatch is an error naming both.
- **Result:** value (exact fraction or P-digit decimal) through our formatter at the digits setting, the mark by
  the 2.4 rules with qalc's approximate flag as the engine fact, the unit drawn upright, the dimension as `L·T⁻¹`.
  With an end slot: in that unit. Without: in the units typed when they fit the result's dimension (so a torque
  stays `N·m`, qalc would say `J`), else SI with an SI prefix (2.7); one tap gives the SI base form and the last
  unit used for that dimension (IndexedDB `units.targets`, `{dimKey: unitId}`).
- **Temperature:** `°C` and `°F` are absolute and allowed only alone (`20 °C → °F` = 68, `derived`); differences
  are `K`, `°R`, or the Find items `Δ°C`, `Δ°F`. Golden cases for each, and the rejected `20 °C × 2`.
- **Logarithmic units, angles, currency:** as before (conversions only for dB, dBm, Np; `rad` stays in the
  dimension key; currencies off, with the index test).
- **The way back:** the result inserted into Home is a `\res` chip with the number in the unit shown; the chip's
  label says the unit was dropped. The line itself keeps its slots, so the units key shows them again.

### 4.4 Budgets and gates
qalc chunk +0.93 MB brotli, lazy: loaded on the first press of the units key, never at start (a Playwright test
asserts no `qalc.*` request in a session without it); first result < 1 s on the Tab One; `units.yaml` in the
golden gate; **a unit in ≤ 4 presses at the median** (`tools/probes/unit-presses.mjs`, then the same list as an
e2e replay); benchmark tasks 1–4 and 10 within budget (plans from S1: t02 12, t04 13); the owner's hand
timing (rule 2).

Open points for milestone 5 (each with a default): r7 section 7.

### 4.5 Risks, would change
Risks: qalc data errors beyond `hp` (the one-off audit against CODATA and exact definitions); memory with three workers. Would change if the owner, after using the Units app, wants `5 km + 300 m` in Home (P8: the same worker behind a setting; the token design already supports it).

---

## 5. Keyboard and entry

### 5.1 Decision: every cell P8 touches, and every free cell
Positions use our rows and columns (`spec/keyboard.yaml`); the reference's id is in brackets (`spec/mapping/vc-2026-10-11/keys.yaml`).

| Key | Today | Decided | Source and why |
|---|---|---|---|
| Math (row 3, col 1) [r4c2] | nothing | Find, everything | P8 |
| Shift + Math | nothing | Memory: Find on variables and user functions, with delete and "clear all" | reference: Mem (memory manager) |
| Vars (row 3, col 0) [r4c1] | nothing | Find, filtered to variables | P8 |
| Shift + Vars | nothing | unassigned | reference: Chars palette; Find covers named symbols |
| Tmpl (row 3, col 2) [r4c3] | nothing | template list (EN5, milestone 6); nothing before | P8 |
| Shift + Tmpl | nothing | the unit view (unit slots) | P11; reference: Units |
| Alpha on Vars, Math, Tmpl | A, B, C | unchanged | P4 |
| View (row 1, col 4) [r2c4] | gap | compact keypad toggle (K4) | P7 point 5 |
| Shift + View | gap | Copy (full value of the selected or last result) | reference: Copy |
| Menu (row 2, col 4) [r3c4] | app menus only | Home/CAS: Copy, Copy as shown, Copy exact, Copy LaTeX, Paste, Share session, Clear history | P8 |
| Shift + Menu | nothing | Paste a number | reference: Paste |
| Help (row 0, col 4) [r1c4] | gap | context help: the Find preview of the function before the cursor; with none there, Find (milestone 6) | ours; uses the index; P8 left Help free, so the owner may veto |
| row 1, col 0 | gap | stays empty | no reference key there |
| Shift + `+` [r10c5] | nothing | Ans (`\ans`) | reference |
| Shift + `−` [r9c5] | nothing | Base: show the last result in HEX, BIN, OCT, DEC; word size (EN6) | reference: Base |
| Shift + 5 [r8c3] | nothing | `[ ]` vector or matrix template (EN5) | reference |
| Shift + 8 [r7c3] | nothing | `{ }` list template (EN5) | reference |
| Shift + 4 [r8c2] | nothing | matrix editor (EN5) | reference: Matrix |
| Shift + 7 [r7c2] | nothing | list editor, deferred with Statistics | reference: List |
| Unit slots | — | `spec/keyboard.yaml` `unit_slot:` (r7): flick down lower case, flick up capital, tap µ on (−), Ω on the comma, ° on a b/c; `→` is the end slot reached with ▶; `±` per r7 section 7, open point 3 | P11, S1 (owner, 2026-10-13) |
| Arrow cells after K3 (6 cells) | trackpad | not assigned in advance: they get the shifted functions pressed most often in the task benchmark | measured, not guessed |
| Prefix chips | — | a strip above the keypad, only after a number, only if task 3 shows a gain | P8 |


### 5.2 Decision: how key presses are counted (EN0)
Every key press counts 1, Shift and Alpha included; letters typed in Find count 1 each; Enter counts; a held ⌫ that auto-repeats counts 1; a trackpad drag counts 1; a tap on the screen (history row, Find result, chip, menu item, prefix chip) counts 1. Nothing is free. A task stores its sequence as data (`keys:` key ids and `tap:` targets), and the harness replays it and counts.

### 5.3 Decision: matrices and lists (EN5)
- **Entry:** Shift + 5 inserts a 1×1 `pmatrix` with the cursor inside; ▶ at the end of a row adds a column, ▼ in the last row adds a row (MathLive's `addColumnAfter`, `addRowAfter`, `mathlive/types/commands.d.ts:137-157`), ⌫ in an empty last row or column removes it. A 3×3 needs only digits, ▶ and ▼. Shift + 8 inserts `\{ \}` (the parser already reads `\{1,2,3\}` as a list: probe).
- **Parser:** `pmatrix`, `bmatrix`, `matrix` are read (`parse.ts:718`); new round-trip cases for grown matrices and for chips inside cells.
- **Stored matrices** are Giac variables (any name, ▶ to store); the matrix editor (Shift + 4) edits one in a grid (the Num view's table code) and writes it back with `name:=[[…]]`, which the definitions log persists (6.2).
- **Display in Home:** every element through our formatter, one mark for the whole (2.4).

### 5.4 Decision: number bases (EN6)
- **A base is a display mode of an integer result**, like the Format key's modes, not a property of the value. Shift + `−` opens the Base menu (HEX, BIN, OCT, DEC for the last result). Word size (8, 16, 32, 64) and signed (two's complement) or unsigned are settings. A non-integer gives a message.
- **Entry:** `0x…`, `0b…`, `0o…` become one literal token in the parser (Giac reads `0xFF` as 255: probe); hex digits A–F are the Alpha letters. Today the same keys give `0*x*F*F` (2.3 #1), so milestone 4 makes it an error and milestone 6 a literal.
- **Bitwise:** `bitand`, `bitor`, `bitxor` work (probe); shifts and rotations as EN7 definitions that respect the word size.

---

## 6. Engine, workers and state

### 6.1 Topology and contracts
- **Today:** the main thread runs the UI, keyboard, parser and formatter; worker 1 is Giac (started at launch, D2); the MicroPython worker went with the Python app (P11). Each cancels by terminate and respawn; Giac replays the definitions (`workerEngine.ts:148-156`).
- **Decision:** worker 3 is qalc (Units app, milestone 5). Find needs no worker (3.2). Nothing new needs an engine on the main thread. Interface changes are listed in 8.2: `HomeResult` gains the facts for the mark (`exactRational`, `reliableDigits`), `full` (the copy and chip value) and `defined`; `CasResult` gains the numeric value when the result is a number.

### 6.2 Decision: one storage plan
One IndexedDB database `pascaline`, store `kv` (as today, `storage.ts`). Keys:

| Key | Holds | Today |
|---|---|---|
| `settings` | `schema: 2`, digits ≤ 30, format (`std`, `sci`, `eng`, `fix`, `pfx`), fixDecimals, fmtCycle, entry, haptics, decimal comma, base word size and signedness | exists, no schema field; each field validated on restore (`session.svelte.ts:339-353`) |
| `view`, `place` | open view, open app | exist |
| `history` | ≤ 200 items per view; new fields `full` (≤ 2 kB), the mark facts | exists |
| `defs` | the definitions log (`:=`, ▶, `purge`), last definition per name kept, ≤ 500 lines, replayed into the engine at start. **Variables are kept as their value, not the command that made them** (owner, 2026-10-13, G3): `B:=romberg(…)` is stored as `B:=(evalf(<exact>,k))`, so a relaunch does not re-run the integral and `A:=rand()` keeps its value; functions, `assume` and other stateful inputs keep their command | built (G3): one entry per name with kind, replay commands, mark facts, preview, view, time (`engine/defs.ts`); variables kept as values; symbolic values replayed first; a fresh worker gets it in `init.replay`, and on first launch a `define` message, gated before any call, brings the stored log (3 s load timeout) |
| `app.function`, `app.solve` | per app | exist |
| `units.targets`, `units.history` | last target per dimension; the Units app's history | new (milestone 5) |

**Migration:** `schema` absent means 1; a restore keeps validating field by field and writes back `schema: 2`. Built as written (R3): `session.migrateSettings` validates every field. **Replay budget:** `defs` replay ≤ 50 ms on the Tab One with 200 definitions, inside the engine-ready bar (`replayMs` is already in `EngineTimings`). Desktop: 10.8 ms for 200 definitions (G3). **Why persist definitions:** a calculator keeps its memory; today the history shows `5▶A` after a relaunch while `A` is undefined.

### 6.3 Decision: start-up and bytes
- Today (`vite build`, 2026-10-12): start chunk `index` 142.62 kB (49.64 kB gzip); MathLive 807.73 kB (222.09 kB gzip) after the keypad; lazy: Function 19.6 kB, JSXGraph chunk 1,035.31 kB (258.52 kB gzip), Solve 8.2 kB, Python 377.18 kB (127.99 kB gzip), the Giac worker 25.68 kB; Giac wasm 9.75 MB; the whole build 13 MB, all precached by the service worker after the engine is up. After R5 (2026-10-13, the Python chunk and MicroPython wasm gone): start chunk 131.57 kB (45.82 kB gzip), precache total 12.2 MB.
- Budgets in 8.3. New code for Find, Units, copy and the matrix editor lives in lazy chunks; the start chunk may grow by the key handlers and the mark (≤ 150 kB, ≤ 52 kB gzip).
- **The size test** (annabell, milestone 4): `app/scripts/size-check.ts` reads Vite's manifest (`build.manifest: true`) and fails when a chunk passes its budget; `npm run build` and `build.sh` run it.

---

## 7. Build, licences, F-Droid, tests

### 7.1 Decision: build order
`build.sh`: fetch (SHA-256 checked) → Giac (container, P2) → MicroPython (container) → **qalc** (`engine/qalc/build-wasm.sh [dev|release]`, promoted from `spike/qalc`, release in the same pinned trixie container; GMP and MPFR tarballs shared with Giac) → **Find index generator** (Node, from the unpacked tarballs and the qalc build) → app build (size test) → Capacitor → Gradle. `--no-units` skips qalc; the index then holds functions only and Find still works. `npm run index` in development does the same when no qalc build is present, with a warning. Everything generated stays out of git; F-Droid's recipe mirrors `build.sh` and gains the libxml2 and libqalculate tarballs with their SHA-256. Build time with qalc (A2, 2026-10-12): the release container build of qalc takes 7.5–8 min; the wasm is 949 kB brotli and byte-reproducible. A fresh-clone `build.sh` run is not measured yet.
**Why qalc moves to milestone 4:** the index takes constant values, uncertainties and unit factors from qalc (3.3 step 3). Only the build moves; the worker, client and Units app stay milestone 5. **Alternative:** values from the oracle venv (Python, not part of `build.sh`, and a second source of truth that could disagree with what the Units app computes).

### 7.2 Licences
| Piece | Licence | Compatible | THIRD_PARTY.md |
|---|---|---|---|
| libqalculate 5.13.1 (shipped from milestone 5; its data in the index from milestone 4) | GPL-2.0-or-later | yes (combined work GPL-3.0) | move from "spike only" to shipped |
| libxml2 2.15.1 | MIT | yes | same |
| Giac `aide_cas`, English lines | GPL-3.0-or-later (R5) | yes | new "Find index data" section |
| `@capacitor/share` 8.x (if the WebView check confirms it is needed) | MIT | yes | add with the code |
| `@capacitor/clipboard` 8.x (only if `navigator.clipboard` fails on the Tab One) | MIT | yes | add with the code |
| Search library | none (own code) | — | — |

### 7.3 Decision: tests and gates

| Gate | What | Blocks |
|---|---|---|
| typecheck, Vitest, e2e | as today | every merge |
| Parser round trips | every new template, chip and token, in the same commit | every merge |
| Golden gate | interrupt, home (with marks), **precision** (new), solve, function, bench, parser, **units** (new, m5) | every merge that touches engine-side code; every engine build that ships |
| Task benchmark | `tests/tasks/tasks.yaml`, active tasks within budget | every merge from milestone 4 on |
| Find query test | `tests/tasks/find-queries.yaml`: all in the top 3, ≥ 90 % first | every merge that touches the index, aliases or ranking |
| Size test | budgets in 8.3 | every build |
| No-lazy-load test | Home, CAS, Function and Solve never request `qalc.*`; the Find index is not requested before the engine is ready and the browser idle | every merge (from the milestone that adds each) |
| Device bars (Tab One) | start, Enter p95 at 12 and 30 digits, Find per key, Units first result, memory | each milestone and release (annabell) |
| Reproducibility | two release builds give the same `giac.wasm` and `qalc.wasm` | each release |

Per milestone: **m4** home.yaml marks, precision.yaml, the 2.3 regression cases, parser cases for chips and the `0x` error, find-queries.yaml, tasks.yaml (task 5 active), copy and paste e2e, size test. **m5** units.yaml (from the 26 spike cases: temperature, prefixes, dimension errors, uncertainty, exactness marks, the `hp` case and the data audit), Units e2e, no-lazy-load test, tasks 1–4 and 10. **m6** matrix and base round trips, EN7 golden cases (one per function, tier 0), tasks 6–9.

---

## 8. Components, interfaces, budgets

### 8.1 Component diagram

```
Capacitor shell (Android) / PWA (service worker precaches everything after the engine is up)
└─ Main thread (TypeScript)
   ├─ Keypad + key layers (spec/keyboard.yaml)       ─┐
   ├─ Entry line: MathLive + macros (\const \unit      │ key → action
   │  \pfx \res \ans)                                  │
   ├─ Parser P1 (LaTeX → Giac text | qalc text)       ─┤
   ├─ Formatter + marks (format.ts, pure)              │
   ├─ Views: Home, CAS, Function, Solve,               │
   │  Units (m5), Find palette (lazy), Matrix editor   │
   ├─ Find: index (lazy asset) + ranking (rank.ts)     │
   ├─ Clipboard / share port                           │
   └─ Session state ── Kv (IndexedDB: settings, history, defs, units.*)
        │ Calc port (views)                                      │ UnitEngine (m5)
        ▼                                                        ▼
   Worker 1: Giac + GSL + GMP + MPFR                         Worker 3: libqalculate
   (launch; Home, CAS, Solve,                                + libxml2 + GMP + MPFR
    analysis, table; defs replay)                            (Units app; stateless)
Build: build.sh → engines (container) → Find index generator (Node + qalc) → Vite (size test) → Capacitor → Gradle
```

### 8.2 Interfaces (every async interface)

```ts
// Views see Calc (calc/port.ts); Calc wraps MathEngine (engine/types.ts), which talks to worker 1.
interface MathEngine {
  ready(): Promise<EngineTimings>;
  home(input: string, s: HomeSettings): Promise<HomeResult>;
  cas(input: string, s: CasSettings): Promise<CasResult>;
  solve(req: SolveRequest, s: HomeSettings): Promise<SolveOutcome>;
  unknowns(equations: string[]): Promise<string[]>;
  analyze(req: AnalysisRequest, s: HomeSettings): Promise<AnalysisResult>;
  table(req: TableRequest, s: HomeSettings): Promise<HomeResult[][]>;
  eval(input: string): Promise<EvalResult>;            // tools and benchmarks only
  definitions(): Promise<readonly DefEntry[]>;          // the defs log (6.2), the stored one included once read (G3)
  cancel(): Promise<EngineTimings>;
  dispose(): void;
}
interface HomeResult {                                   // existing fields kept: ok, display, value, exact, path,
  /* … */                                                // approximate, tieRisk, exactMs, totalMs, error
  exactRational: boolean;                                // new: value is exactly p/q (decides "=" with the format)
  reliableDigits: number | null;                         // new: confirmed digits (agreement check); null = exact
  full: string;                                          // new: copy and \res chip value (exact text or P digits)
  defined?: { name: string; kind: "var" | "fn" };        // new: what a stateful input defined (Find live items)
  items?: HomeResult[];                                  // new: elements of a numeric list or matrix (rows flattened, with shape)
  shape?: [number, number];
  digits?: number;                                       // the digits evalf(e,n)/approx(e,n) asked for: shown with these (G3)
}
interface CasResult { /* ok, text, latex, timedOut, error, engineMs */ numeric?: HomeResult; }  // new: when the result is a number

interface Calc {                                         // views; mirrors MathEngine with CalcSettings
  ready(): Promise<void>;
  home(giac: string, s: CalcSettings): Promise<HomeOutcome>;   // HomeOutcome gains exactRational, reliableDigits, full, defined
  cas(giac: string, s: CalcSettings): Promise<CasOutcome>;     // CasOutcome gains numeric
  solve(req: SolveRequest, s: CalcSettings): Promise<SolveOutcome>;
  unknowns(equations: string[]): Promise<string[]>;
  analyze(req: AnalysisRequest, s: CalcSettings): Promise<AnalysisResult>;
  table(req: TableRequest, s: CalcSettings): Promise<HomeResult[][]>;
  names(): Promise<UserName[]>;                         // the user's names from the defs log (3.4, G3)
  cancel(): Promise<void>;
  units(): Promise<UnitEngine>;                          // new (m5): loaded on first call
}


// Worker protocol (G3): home/cas/eval responses carry `defs: DefChange[]`; request {type:"define", defs} → {type:"defined", replayMs}.

interface UnitEngine {                                   // new (m5), worker 3
  ready(): Promise<UnitTimings>;                         // instantiate, init (definitions), ready
  evaluate(qalcText: string, s: { digits: number }): Promise<Quantity | UnitError>;  // text from our emitter only
  cancel(): Promise<UnitTimings>;                        // terminate + respawn; nothing to replay
  dispose(): void;
}
interface Quantity {
  value: { p: string; q: string } | { decimal: string };  // exact fraction, or P digits
  approximate: boolean;                                    // qalc's own flag
  uncertainty?: string;
  unit: { id: string; exp: number }[];                     // canonical qalc names
  dimension: string;                                       // "kg1m1s-2"
  si?: { p: string; q: string } | { decimal: string };     // the value in SI base units
  ms: number;
}
type UnitError = { error: "dimension"; dims: [string, string] } | { error: "temperature" | "unknown" | "engine"; detail: string };

interface FindIndex {                                    // new (m4), main thread
  load(lang?: string): Promise<void>;                    // fetch + parse the asset (and a language overlay)
  search(query: string, ctx: { filter?: FindItem["kind"][]; live: FindItem[] }): FindHit[];  // synchronous, ≤ 16 ms
}
interface Kv { get<T>(key: string): Promise<T | undefined>; set(key: string, value: unknown): Promise<void>; }  // unchanged
interface ClipboardPort {                                // new (m4): navigator.clipboard / Capacitor plugins
  writeText(text: string): Promise<boolean>;
  readText(): Promise<string | null>;
  share(title: string, text: string): Promise<boolean>; // false when the platform cannot share (then copy)
}
```

### 8.3 Budgets

| Item | Budget | Today | Enforced by |
|---|---|---|---|
| Start chunk | ≤ 150 kB raw, ≤ 52 kB gzip | 132.62 / 45.98 kB (after R3) | size test |
| MathLive chunk (after the keypad) | ≤ 830 kB raw | 807.73 kB | size test |
| Find UI chunk | ≤ 30 kB raw | — | size test |
| Find index asset | ≤ 400 kB raw, ≤ 100 kB gzip | prototype 282 / 68 kB | size test |
| Units app chunk | ≤ 30 kB raw | — | size test |
| qalc wasm + glue | ≤ 1.0 MB brotli | spike 0.93 MB + 21 kB | size test |
| Precache total | ≤ 18 MB | 13 MB | size test |

"Start chunk" is the entry's JavaScript plus every chunk it imports statically (Vite manifest `imports`, transitively), as `app/scripts/size-check.ts` measures it. The entry's CSS is not counted (25.8 kB raw, 9.0 kB gzip on 2026-10-12): the budget was set on the JavaScript figure. CSS gets its own line if it grows past 40 kB raw.
| Keyboard usable / engine ready (Tab One) | < 1 s / < 1.5 s, with `defs` replay | 662 / 995 ms | device runs |
| Enter → result p95 (Tab One) | < 150 ms at 12 digits; at 30 digits ≤ 1.3 × the 12-digit p95 | 92 ms at 12 | device runs |
| Find key → list (Tab One) | p95 ≤ 16 ms | desktop prototype p95 1.04–1.23 ms | `?bench=find` |
| Find open | ≤ 100 ms warm, ≤ 300 ms cold | — | device runs |
| Units first result (Tab One) | < 1 s | S8+ 626 ms (spike page) | device runs |
| `defs` replay | ≤ 50 ms at 200 definitions | — | device runs |
| Key presses | each task within its budget; a unit ≤ 4 at the median | — | task benchmark |
| Find quality | 100 % top 3, ≥ 90 % first | — | query test |

---

## 9. Top risks to the goal

1. **Correlated numeric errors in Giac** (2.3 #2): the agreement check catches most wrong digits, not all. Mitigation: tier-0 audit with domain-edge golden cases, upstream reports, `⚠` rather than silence.
2. **Find quality** depends on aliases and real queries, not code. Mitigation: the 100-phrase gate from day one and the owner adding misses.
3. **qalc's silent acceptance** of misread names, mismatched sums and offset-unit arithmetic. Mitigation: chips only, the generator's round-trip check, the adapter's single-term and temperature checks, `units.yaml`.
4. **Tab One budgets for the new work** (Find per key, digits 30, three workers' memory) are desktop estimates until annabell measures them.
5. **Pace on parser- and keyboard-heavy work** (03 risk 5): milestone 4 adds five token kinds and several key behaviours. Mitigation: each token lands with its round-trip case; ron's tasks are ordered so the harness (EN0) and the chips land before Find's UI.

---

## Appendix A: probes (2026-10-12; rerun them with `tools/probes/`, see its README)

- **Home and CAS paths:** a Node script that loads `engine/giac/_out/gsl/giac.mjs` with `app/src/engine/nodeGiac.ts` and calls `new EngineHost(giac).home(input, {...defaultHomeSettings, digits})` or `.cas(...)`; raw calls through `giac.eval`. Run from `app/` with `node <script>.ts`. Inputs: those named in 2.1 and 2.3.
- **Oracle values:** `tests/golden/.venv/bin/python -I -c "import mpmath as m; m.mp.dps=40; …"`: `sqrt(2)*erfinv(2p-1)` for `normald_icdf`, `quad(exp(-x^2),[0,1])`, `erfc(10/sqrt(2))/2`, `besselj`, `airyai`.
- **Digits cost:** the 123 `home.yaml` inputs through `EngineHost.home` at digits 12, 20, 30 (`workDigits = max(30, digits+10)`), 3 rounds, the last timed.
- **Parser:** `latexToGiac()` from `app/src/input/latex-to-giac.ts` on `0xFF`, `0b1011`, `4.7k`, `\mathrm{k}`, `Ans`, `\operatorname{par}\left(4.7,10\right)`, `\{1,2,3\}`, `\pm`, `\to`.
- **qalc:** a throwaway glue (`calc->calculate(str, eo)`, `convert(m, to, eo)`, `MathStructure::isApproximate()`, `PrintOptions::is_approximate`, fraction and decimal prints) compiled with `em++` (emsdk 6.0.12) and linked against `../pascaline-deps/qalc-spike/build/prefix/lib/{libqalculate,libxml2,libmpfr,libgmp}.a` under the host-cpu lock (two links, about a minute each); run in Node at precision 12 and 30.
- **Find prototype:** a Python extractor over `engine/giac/_build/giac-2.1.0/doc/aide_cas` and the qalc `data/*.xml.in` files, and a Node ranking script with 20 queries × 20 rounds.
- **Bundle:** `npx vite build --outDir <scratch>` in `app/`.

## Appendix B: the first 100 Find queries (for `tests/tasks/find-queries.yaml`)

100 active phrases (25 constants, 40 units, 5 prefixes, 30 functions) and 10 pending ones. Expected items are named by what they are; gorge writes them with the generated ids. Some phrases are ambiguous on purpose (`newton`, `kb`, `db`): the top-3 rule tolerates that, and the first hit shows how good the ranking is.

- **Constants (25):** speed of light → c · c0 → c · light speed → c · planck → h · hbar → ħ · reduced planck → ħ · boltzmann → k_B · kb → k_B · avogadro → N_A · elementary charge → e · electron charge → e · eps0 → ε₀ · permittivity → ε₀ · mu0 → μ₀ · permeability → μ₀ · gravitational constant → G · newton constant → G · standard gravity → g₀ · g0 → g₀ · gas constant → R · electron mass → mₑ · proton mass → mₚ · faraday → F · stefan boltzmann → σ · fine structure → α
- **Units (40):** kph → km/h · km/h → km/h · mph → mph · knot → knot · inch → in · in → in · feet → ft · ft → ft · mil → mil · mm → mm · micron → µm · angstrom → Å · nautical mile → nmi · ohm → Ω · kohm → kΩ · psi → psi · bar → bar · atm → atm · pascal → Pa · mpa → MPa · newton → N · lbf → lbf · pound → lb · kg → kg · tonne → t · celsius → °C · degc → °C · fahrenheit → °F · kelvin → K · kwh → kWh · btu → Btu · calorie → cal · horsepower → hp · watt → W · dbm → dBm · rpm → rpm · hz → Hz · litre → L · gallon → gal · electronvolt → eV
- **Prefixes (5):** kilo → k · micro → µ · nano → n · mega → M · pico → p
- **Functions (30):** sqrt → √ · square root → √ · cube root → ∛ · ln → ln · log → log₁₀ · exp → exp · arcsin → asin · sinh → sinh · abs → abs · absolute → abs · round → round · floor → floor · mod → mod · gcd → gcd · factorial → factorial · ncr → combinations · mean → mean · average → mean · median → median · stdev → standard deviation (sample, our alias decides which Giac command) · variance → variance · normal cdf → normald_cdf · integral → int · derivative → diff · limit → limit · solve → solve · determinant → det · inverse matrix → inv · transpose → tran · cross product → cross
- **Milestone 6 (pending):** parallel → par (m6) · e24 → eseries (m6) · hex → Base (m6) · dot product → dot (m6, curated) · rms → rms (m6) · interpolate → interp (m6) · polar to rectangular → rectangular form (m6) · dms → degrees-minutes-seconds (m6) · db → dB function in Home and the dB unit in the Units app (context decides) (m6) · bitand → bitand (m6)

## Appendix C: open items (to verify), who, how

| Item | Who | How | Decides |
|---|---|---|---|
| Digits 30 latency on the Tab One | annabell (m4) | `?bench=1&digits=12/20/30`, 5 cold runs | cap at 30 or 20 (2.5) |
| Find per-key time on the Tab One | annabell (m4) | `?bench=find` | main thread or incremental/worker (3.2) |
| MathLive keeps `expand: false` macros and draws chips distinctly | ron (m4, first EN1 task) | unit test + Playwright screenshot | token design (3.6); fallback: `\mathrm{const:ID}` with a parser rule |
| `navigator.clipboard` in WebView 131; `navigator.share` absent | annabell (m4) | on the Tab One APK | whether the Capacitor plugins are needed (2.6) |
| Two workers' memory | annabell (m5) | `dumpsys meminfo`, 10-minute session | qalc worker idle shutdown (4.2) |
| qalc release build (container) size and time | annabell (m4) | `engine/qalc/build-wasm.sh release` | size budget, build time |
| qalc compiled-in currency data | gorge (m4/U1) | grep the generated definitions; size with and without | strip or not (4.3) |
| qalc name for Rankine (Δ°F) | answered (S1) | `°R` reads as Rankine, 1 °R = 5/9 K (r7 section 8) | temperature tokens (4.3) |
| Units first result on the Tab One | annabell (m5) | device run of the Units app | lazy-load bar (4.4) |
