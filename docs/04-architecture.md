<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Pascaline architecture for the precision-engineering goal

*sandra, 2026-10-12; checked against the code on 2026-10-15 (2.3 #17–#19 and 5.5 came from that check: [archive/shifts/2026-10-15-sandra-archcheck-report.md](archive/shifts/2026-10-15-sandra-archcheck-report.md)) and made current by the docs diet (S7, 2026-10-18); the 2026-10-12 "today" tables are in git history. **This document supersedes [02-architecture-plan.md](02-architecture-plan.md) wherever the two differ.** docs/02 stays the record of the original plan and of the reasoning that still holds (solver choice in section 4, licence and F-Droid in sections 10–11). Binding inputs: CLAUDE.md (goal, three principles, hard rules), [03-feature-analysis.md](03-feature-analysis.md) (the owner's design rules), [decisions.md](decisions.md) P8. A claim about the code cites the file or a probe (`tools/probes/`, its README; Appendix A); **(to verify)** marks what was not checked, with who checks it and how (Appendix C).*

How to read each area: **state** (verified), **decision** (one, with the reason), **alternatives** (one line each), **budgets and gates**, **risks**, **what would change it**. Section 8 has the component diagram, the interfaces and the budget table.

## 0. The decisions on one page

1. **One mark on every Home and CAS number:** `=` the decimal shown is the exact value; `≈` rounded, and every digit shown is right; `⚠` fewer reliable digits than asked, or a failed check. The engine supplies the facts, our formatter decides the mark for the format shown; a non-number that holds a float gets `⚠` (2.4, 2.3 #17).
2. **No digit is shown that the engine has not confirmed:** non-rational values are evaluated at two precisions and only agreeing digits are shown; a float from an unaudited function is `⚠`; inverse functions are to be substituted back like Solve roots (EN7) (2.4, 2.5).
3. **Digits up to 30**, working precision `max(30, digits+10)`, value precision `max(40, digits+10)` (2.5).
4. **Results are reused as chips that carry the full value**; Ans on Shift + `+`; an operator typed on an empty line starts with Ans, as on the reference (2.8).
5. **Copy gives the full value** (all confirmed digits, up to 40); "as shown", "exact" and LaTeX are in the Menu. Shift + View = Copy and Shift + Menu = Paste, the reference's positions (2.6, 5.1).
6. **CAS floats are marked `≈` and formatted by us.** Typed decimals in CAS become exact, like Home (**P9, accepted by the user 2026-10-12**) (2.9).
7. *(Python: removed with the app, P11.)*
8. **Find is one static index generated at build time** (Giac's English help lines, libqalculate's units, constants and prefixes, our alias file), searched by our own ranking code on the main thread, fetched when idle after the engine is ready and parsed on first open (section 3).
9. **Constants, units, prefixes and results enter the entry line as atomic MathLive macros** (`\const{ID}`, `\unit{ID}`, `\pfx{p}`, `\res{n}`, `\ans`), never as free text (3.6, 4.3).
10. **The unit view computes on Giac (P15):** our P1 parser reads unit tokens (Find ids). Each becomes its exact SI factor from the Find index times base-dimension symbols, and Giac computes exactly in the worker that is already loaded. The evaluator refuses mismatched sums, absolute temperatures in arithmetic and functions of quantities with units (section 4).
11. **Keys** (every difference from the G2 and its reason: [06-keypad-vs-g2.md](06-keypad-vs-g2.md)): Math = Find, Vars = Find on variables, Shift + Math = Memory, Tmpl = templates, Shift + Tmpl = the unit view (units after the formula, P11), View = results mode (P16, R53), Shift + View = Copy, Shift + Menu = Paste, Shift + `+` = Ans, Shift + 5 = `[ ]`, Shift + 8 = `{ }`, Shift + 4 = matrix editor, Shift + `−` = Base, Help = context help (5.1).
12. **State:** one IndexedDB store with a schema version; user definitions are persisted and replayed at start, so variables survive a relaunch (6.2).
13. **The qalc build runs in `build.sh` at build time only** (A2): the Find index takes its constant values and unit factors from it (P15; 7.1).
14. **New gates:** an automated size test, the task benchmark, the Find query test, marks in the golden files, `units.yaml`, a per-key Find timing on the Tab One (7.3).

The top risks are in section 9.

---

## 1. The goal as a test

### 1.1 Definitions

**Efficient** means the fewest key presses and no waiting. It is measured by:

| Id | Measure | Budget | Enforced by |
|---|---|---|---|
| E1 | Key presses per task | each active task within its budget; a unit in ≤ 4 presses at the median (rule 2) | `tests/tasks/tasks.yaml` replayed by Playwright (EN0) |
| E2 | Enter → drawn result, Home and CAS | p95 < 150 ms on the Tab One (138–160 ms at 12 digits, A4a 2026-10-16) | `?bench=1` on the device (annabell), each release |
| E3 | Find: key → updated list | p95 ≤ 16 ms on the Tab One | `?bench=find` (A4b), milestone 4 gate |
| E4 | Start | keyboard usable < 1 s, engine ready < 1.5 s on the Tab One (688 / about 1060 ms, A4a) | device runs (`tools/device_run.py`), each release |
| E5 | First use of a lazy part | Units first result < 1 s; Find open → list ≤ 100 ms warm, ≤ 300 ms cold | device runs |
| E6 | Bytes | budgets in section 8.3 | size test (6.3) on every build |

**Precise** means no digit shown is wrong, and the user can tell an exact value from a rounded one. It is measured by:

| Id | Measure | Budget | Enforced by |
|---|---|---|---|
| P1 | Golden cases, with their mark | 100 % at 12 digits; the precision set also at 20 and 30 | golden gate (`npm run golden`) |
| P2 | Known paths that show a wrong or unmarked number | zero; each one in 2.3 is a regression case first | golden gate, parser and e2e tests |
| P3 | Numeric roots | every root substituted back (existing) | `solve.yaml`, `function.yaml` |
| P4 | Units | a dimension mismatch is never a number; SI-exact conversions are `=` | `units.yaml` (milestone 5) |
| P5 | Copy | copy → paste gives the same value to every confirmed digit | e2e test per copy action (EN4) |

### 1.2 Every module against the goal

| Module | Faster | More trustworthy | Open against the goal | Cost |
|---|---|---|---|---|
| Keyboard (`spec/keyboard.yaml`, `keyboard/`) | the reference's logical layout; the trackpad (K1) and flicks (R9) | — | Vars and Math do nothing until Find (R4a, R4b) | in the start chunk (8.3) |
| Entry, MathLive (`entry/`) | textbook entry; results as chips (R2); ⌫ keeps templates whole; the cursor stops only at boxes; one key path for every key (5.5) | errors name the fix (R29–R31, R51) | — | the MathLive chunk after the keypad; `entry/` modules lazy |
| Parser (`input/parse.ts`, `emit.ts`) | one rule per key | rejects what our keys cannot produce | — | its own lazy chunk (M4-3) |
| Engine client and Giac worker (`engine/workerEngine.ts`, `host.ts`) | engine in a worker, warm | Cancel and a crash restart the worker and replay the definitions; definitions survive a relaunch (G3); a safe start without them after two failed starts (G19); a 1 GB memory cap (G24) | the `defs` replay over its Tab One bar (G29 cut it, A12 re-measures) | Giac 9.75 MB wasm |
| Home evaluation (`engine/homeEval.ts`) | p95 well under the bar on the desktop | exact-first; marks and the agreement check (2.4) | `normald_icdf`'s value is not polished (2.3 #2, EN7) | — |
| Formatter (`engine/format.ts`) | re-formats without the engine | BigInt, one rounding | `tieRisk` has no reader (2.4 rule 4) | in the start chunk |
| History and settings (`state/`) | history and the half-typed line survive a relaunch and a kill (R34) | digits ≤ 30, every stored value stamped (`DATA_VERSION`) | — | — |
| Function and Solve apps | Plot 56 fps on the Tab One | every number from the engine; every root substituted back, ⚠ on failure | frozen for features (P11) | lazy chunks |
| CAS view (`host.ts` `cas()`) | — | exact results; typed decimals exact (P9); floats marked; the stored values a result used are listed (G20, R32) | — | — |
| Unit view (`units/`) | — | exact factors and dimension checks on Giac (P15) | the entry is not built (R24b–R24d) | a lazy chunk (8.3) |
| PWA and Capacitor shell | offline; wasm stored uncompressed | no trackers, no INTERNET permission (C5) | — | the build is precached (8.3) |
| Build (`build.sh`, P2 container) | — | reproducible engine; the size test runs in `npm run build`; `npm run gate` (A6) | no CI (C3) | — |


---

## 2. Precision chain, end to end

### 2.1 The paths

Every Home and CAS number is marked by 2.4's rules; the agreement check runs on every non-rational value.

| Path | Where | Working precision | Rounding | Mark |
|---|---|---|---|---|
| Home exact, rational (`1/4`, `1/3`) | `homeEval.ts` | exact rational, BigInt division (`format.ts`) | once, half up, to `digits` | `=` when the text shown is the exact value, else `≈` |
| Home exact, irrational (`sqrt(2)`, `sin(10^22)`) | `homeEval.ts` | `evalf` at P = `max(40, digits+10)` and P + 20 | once | `≈`, or `⚠ n` |
| Home "exact" path where Giac's numeric code returns a float (`normald_icdf`, `romberg`, `BesselJ`) | `homeEval.ts` | Giac's routine, re-evaluated on the other side of 14 digits | once | `⚠` unless every function is audited (tier 0) |
| Home exact-big (`2^200`) | `homeEval.ts` | exact; the chip keeps the exact text up to 2 kB | once | `≈` |
| Home float fallback (timeout, error) | `homeEval.ts` | Giac floats at `max(30, digits+10)` | once | by the agreement check |
| Home non-number (lists, matrices, symbols) | `homeEval.ts` `symbolic()`, `render/tidy.ts` | exact | elements by our formatter | the weakest element's; a symbol with a float `⚠` (2.3 #17) |
| Solve, Function analysis | `solve.ts`, `analysis.ts` | `max(30, digits+10)`; residual relative ≤ 1e-15 | once | `⚠` when the residual check fails |
| Function Num, Plot | `analysis.ts` (each cell is Home's), `input/emit-js.ts` | as Home; Plot draws in JS doubles | as Home | `⚠` only; trace values come from the engine |
| CAS exact; CAS numeric | `host.ts` `cas()` | exact; typed decimals exact (P9) | numbers by our formatter (2.9) | none for exact results; numbers as Home |
| Unit view | section 4 | Giac, exact factors from the Find index (P15) | our formatter | as Home; never `=` with a σ |

### 2.2 Where the facts live

Only the engine knows the path, whether a value is an exact rational, and how many digits are confirmed. Only the app knows the display format the user picked and whether an input was a measured constant. So the engine reports facts and the app's formatter (pure functions in `format.ts`, run on the main thread) turns them into the mark for whatever format is on screen. A settings or Format-key change re-marks the history without the engine, as it already re-formats it.

### 2.3 Paths that showed a wrong or unmarked value

Each became a regression case before its fix (CLAUDE.md); #7 was Python's `calc.eval`, removed with the app. Values marked `oracle` come from mpmath at 40 digits (`tests/golden/.venv`). All are fixed except #2's value polish (EN7, milestone 6), which keeps its `⚠`. #11–#16 came from the deep-dive review (2026-10-14), #17–#18 from the architecture check and #19 from the Opus pass (2026-10-15).

| # | Input and path | Shown before the fix | Correct value | Fix |
|---|---|---|---|---|
| 1 | Home, keys `0` `x` Alpha-F Alpha-F: `0*x*F*F` | `0`, exact | 255 (`derived`) | R2: `0x`/`0b`/`0o` with letters is an error; a literal in EN6 |
| 2 | Home `normald_icdf(10^-10)`, 12 digits | `-6.36134035799`, no mark | −6.36134090240… (`oracle`): wrong from the 8th digit; Giac's two evaluations agree on 9 digits | mark: `⚠`, unaudited (`715e1e8`). **Open:** the value polish by substituting back (a 40-digit `fsolve(normald_cdf(x)=10^-10, …)` agrees with the oracle to 32 digits), EN7; case `prec-2-normald_icdf-value` pending |
| 3 | Home `UTPN(10)` at 30 digits | wrong from the 17th digit | 7.619853024160526065973…E-24 (`oracle`) | agreement check at P, P+20, P+40 (`715e1e8`) |
| 4 | Home `romberg(exp(-x^2),x,0,1)` at 30 digits | wrong from the 17th digit | 0.746824132812427025399467436132 (`oracle`) | `⚠` until romberg is audited (2.4 rule 3, M4-1) |
| 5 | Home `BesselJ(1,2)` at 15–30 digits | the input as text (no MPFR path) | 0.576724807757 (`oracle`) | a ≤ 14-digit fallback with `⚠` |
| 6 | CAS `1-0.9-0.1`; `evalf(sin(10^22))`; `1e16+1-1e16` | `1.7763568394E-15`; `-0.54764225985`; `0.0` | 0; −0.852200849767… (`oracle`); 1 | marks in CAS and exact decimals (P9) |
| 8 | Home `1/3`, tap the result, `×3` | `0.999999999999` | 1 | result chips carry the full value (R2) |
| 9 | Home `1/3` and `1/4` | alike | — | the mark |
| 10 | Units `1 hp → W` (qalc data) | 745.699987158 W, flagged exact | 745.69987158227… W (`derived`) | our exact factor in the Find index (G13; golden u10) |
| 11 | Home `2.5.3` | `0.75` | an error | R29 |
| 12 | Home, tap 0.5, type `3` | `1.5`, no × shown | an error naming the fix | R29 |
| 13 | One-line `1/2x`; `6÷2(1+2)` | 1/(2x); 1 | (1/2)·x; 9 (G2 item 6) | R30 |
| 14 | Hardware keyboard `1e-3` | `≈ -0.281718171541` | 0.001 | R31 |
| 15 | CAS after Home `3 ▶ x`: `int(x^2,x)` | `9*x`, no sign of the stored x | the answer, saying x was used | G20, R32 |
| 16 | DEG `exp(i*90)` | `= i` | −0.448073616129+0.893996663601·i (`derived`) | G21 (F29); an exp Giac builds itself: decisions.md G21 |
| 17 | `evalf(x+sin(10^22))` | `x-0.54764225985`, no mark | x − 0.852200849767… (`oracle`) | `⚠` on a non-number with a float (G27) |
| 18 | Home `2^10000`, tap, `×1` | `= 1.99506311688E3010` | `≈` (the chip was cut) | R44 |
| 19 | `cos(π/7)−cos(2π/7)+cos(3π/7) == 1/2` | `= 0` | true (`derived`) | stays as typed (R18f3) |

### 2.4 Decision: the mark and the agreement check

**The mark.** Shown before every numeric result in Home and CAS, small and muted, in the result's colour:
- **`=`** when all of these hold: the engine says the value is an exact rational (exact path, Giac returned `p/q`); the text shown in the current format is exactly `p/q` (our formatter knows: the `sticky` flag and the digits cut off); no input was inexact (a constant with a CODATA uncertainty, or a result chip whose value is not exact, 2.8). Examples: `1/4` → `= 0.25`; `0.1+0.2` → `= 0.3`; `1e300*1e300` → `= 1E600`; `1/4` in FIX 1 → `≈ 0.3`.
- **`≈`** for every other number, provided every digit shown is confirmed: `1/3`, `sqrt(2)`, `2^200` in STD, the float fallbacks, constants with an uncertainty.
- **`⚠ n`** when fewer than `digits` digits are confirmed: the result is shown with the `n` confirmed digits and the mark says so. Solve and analysis keep their existing ⚠ for a failed residual check.
- No mark for non-numbers (symbolic results), **unless they hold a float**: then `⚠` without a count, since nobody checked its digits (2.3 #17; principle 3 decides it: "flagged"). A check per float that could earn `≈` is not worth building until the `⚠` proves noisy in daily use. A list or matrix of numbers gets one mark, the weakest of its elements, and every element is formatted by our formatter.

Num tables and the Solve and analysis results show only `⚠` (a mark on every cell would be clutter; their view header says "rounded to n digits"). The existing "approximate" note goes away: `≈` covers it.

**The agreement check** (engine, `homeEval.ts`, `solve.ts` `numericResult`, `analysis.ts`):
1. An exact rational needs no check: BigInt is exact.
2. Any other value is evaluated at precision P = `max(40, digits+10)` and again at P + 20. The confirmed digits are the largest n at which both values, widened by their difference (plus one ulp), round alike (G2; stricter than "common digits less one" at ties). If fewer than `digits` agree, the check runs once more at P + 20 against P + 40. If they cover the shown digits, the mark is `≈`; otherwise `⚠ n`. A float from a function that is not audited shows `⚠` without a count (M4-5): two of Giac's routines can agree on wrong digits.
3. A value that Giac's numeric code returned as a float on the "exact" path (the exact output is a float literal, as `normald_icdf` gives `-1.2815515655446`) is re-evaluated once with `Digits` on the other side of 14 (double ↔ MPFR) and compared the same way. If one side has no value (2.3 #5), the other side's digits are shown, at most 15 for a double. Such a value gets `⚠` unless every function in the input is on the audited list (tier 0, 3.3), because agreement between two of Giac's routines does not prove either right (2.3 #2).
4. *(Not built, and not needed: rule 2 already compares P with P + 20, so a value so near a tie that the two do not round alike loses that digit. `tieRisk` (`format.ts:140`, set in `homeEval.ts:325`) still has no reader; drop it when `homeEval.ts` is next touched. Checked 2026-10-15.)*

Cost: one more `evalf` for irrational results (each about 1 ms on the desktop, probe timings) and one more evaluation only for the rare float-returning inputs.

**Golden cases:** every numeric case in `home.yaml` carries its mark, checked by the gate (`oracle.py` checks that `=` appears exactly when the oracle value equals the expected text); `precision.yaml` holds the cases at 20 and 30 digits (`oracle`) and 2.3's regression list.

**Alternatives:** a mark computed in the app from `approximate` alone (cannot tell 1/3 from 1/4); a mark only on float paths (leaves rounded exact results unmarked, against principle 3); interval arithmetic in Giac (no general support; far more work).

**Risk:** both evaluations wrong in the same way is not caught (2.3 #2; section 9 risk 1): until a function has passed the tier-0 audit, a float Giac's numeric code returned for it is `⚠`, never a bare `≈`.
**Would change if:** Tab One timing shows the extra `evalf` costing more than 20 % of Enter p95; then the check runs only above 15 digits and for float-returning inputs.

**Built in G3:** stored floats keep their facts in the defs log; a result that uses them inherits the weakest, checked by perturbation (M4-7). `evalf(e,n)`/`approx(e,n)` are rewritten to the check's precision, and n becomes the display digits in Home and CAS (M4-6; Home by the owner, 2026-10-13). Solve and analysis roots are compared after a second polish at W+20 (M4-8). A value that is 0 in every evaluation but not an exact rational shows `⚠` without a count, never `≈ 0` (owner, 2026-10-13: `exp(10^-70)-1`).

### 2.5 Decision: digits up to 30

- The setting allows 1–30; stored values from before stay valid (6.2 migration).
- Home's working precision is `max(30, digits+10)` (as Solve's) and the value precision P = `max(40, digits+10)`; `DECIMAL_KEEP` (`format.ts`) follows it, so rounding at 30 digits keeps 10 guard digits.
- `sigfig` and our other Giac definitions load on first use, not at engine start (G2).
- The agreement check (2.4) is what makes 20 and 30 digits honest: without it, 2.3 #3–#5 would go out unmarked.
- **Latency:** on the desktop (123 `home.yaml` inputs) digits 12 p95 2.74 ms, digits 30 p95 3.63 ms, no case changed path. **Tab One gate:** p95 at 30 digits < 150 ms and ≤ 1.3 × the 12-digit p95, else the setting stops at 20. **Measured (A4a, 2026-10-16):** 147–149 ms at 30 digits, 149–152 at 20, 138–160 at 12: the gate holds and the setting keeps 30; the cost is not driven by digits (decisions.md "A4a" point 1).

**Alternatives:** keep 15 (engineers comparing with reference data need more); unlimited digits (the 40-digit value path and the screen width set a natural limit at 30).

**`sigfig(x,n)`** (EN3 d): an engine definition that rounds the exact value to `n` significant digits and returns an exact decimal rational, so `sigfig(1/3,3)` is `= 0.333`. The power of ten is found exactly (BigInt on the rational, not `floor(log10(…))`, which can land on the wrong side at 999.95). Golden cases at the boundaries: 999.95 at 4 digits, 0.0012345 at 3, negatives, ties.

### 2.6 Decision: copy and paste

| What | Copy (Shift + View; Menu 3) | Menu 6, Copy as › As shown | Copy as › Exact | Copy as › LaTeX |
|---|---|---|---|---|
| Home or CAS number | full value: every confirmed digit up to P (40), trailing zeros dropped, `.` (`,` with the decimal-comma setting), plain for 1E-4 ≤ \|x\| < 1E21, else `d.ddd…E±k` | display text, without the mark | Giac's exact text when it exists (`1/3`, `sqrt(2)`) | the result LaTeX |
| Complex | `a+b*i`, each part as above | yes | yes | yes |
| List, matrix | `[a,b]`, `[[a,b],[c,d]]`, elements as above | yes | yes | yes |
| Solve root, analysis value | full value | yes | — | — |
| Num table | CSV (Menu, Export): header row with the function names, full values, `.` and `,` as separator (`;` with decimal comma) | — | — | — |
| Units result (m5) | `20 m/s`, `39.5±1.2 m^2` (value full, uncertainty 2 significant digits) | yes | `(1397/3125) m/s` | yes |
| Session (Menu, Share) | text: one line per entry, `input = result` with the mark, full values | — | — | — |

**Paste** (Shift + Menu, or Menu → Paste): the clipboard is read as one number (`-1.5`, `1,5` with decimal comma, `1.5e-3`, `1.5E-3`, `i` parts); it enters as the keyboard's own LaTeX (`1.5\emark-3`, drawn `1.5ᴇ-3`), so the parser sees only what our keys produce. Anything else gives the message "Paste: not a number". Pasting a result copied from Pascaline gives the same value back (P5).
**Mechanics:** `navigator.clipboard` in a secure context (Capacitor serves `https://localhost`): `writeText` works on the Tab One's WebView 131, `readText` is denied there and `navigator.share` is undefined (A4a), so the APK gets `@capacitor/clipboard` and `@capacitor/share` (A11); the PWA keeps `navigator.clipboard` and `navigator.share` where it exists, else copy.

**Alternatives:** copy the displayed text by default (hides digits, against principle 3); copy the exact form by default (`1/3` pastes badly into spreadsheets and code).

### 2.7 Decision: SI prefix display, and prefix entry

- **Display:** a format `PFX` beside ENG: `n` significant digits as in ENG, the exponent replaced by f p n µ m (none) k M G T P (10⁻¹⁵ to 10¹⁵); `µ` is U+00B5. Outside that range, ENG E notation. Built (R3): mantissa, thin space, the prefix as `\class{pfx}{\mathrm{k}}` in the accent colour, so `1.5 m` (milli) does not read as metres; ENG and PFX keep trailing zeros to n digits (`2.500 k`); in Settings and the Format key cycle; copy gives the full value, never the prefix text; unit tests per prefix boundary and rounding into the next prefix (999.96 k at 4 digits → 1.000 M).
- **Entry (gated by benchmark task 3):** only through a prefix chip `\pfx{k}`. Letters typed with Alpha stay variables (`4.7k` parses as `4.7*k`: probe), so a variable `k` and the prefix k never collide. Parser rule: a numeric literal directly followed by `\pfx{X}` becomes the exact `(literal*10^e)`; `\pfx` anywhere else is a parse error. One round-trip case per chip.

### 2.8 Decision: reuse through chips and Ans

- **Result chip `\res{n}`:** tapping a history result, or Up then Enter, inserts a chip drawn as the number shown. Each history item stores `full`: Giac's exact text when the result is exact and ≤ 2 kB, else the P-digit decimal. The parser turns the chip into that text (an exact rational literal for decimals). Its exactness travels: a result computed from a chip whose value is not exact (an irrational result carried as digits, a constant with an uncertainty) cannot be `=`; a chip that carries an exact value keeps the result exact, so `1/3` (shown `≈ 0.333333333333`) tapped `×3` is `= 1` (2.3 #8; user, 2026-10-12, M4-4).
- **Ans:** `\ans` is the view's last result, inserted by Shift + `+` (the reference's position). Ans is resolved by the app at Enter from the view's last history result (its chip value), not from Giac's `pasans`/`pcasans`, so it survives a Cancel (worker restart) and a relaunch (R2).
- **Operator on an empty line:** `+ − × ÷ xʸ x² x⁻¹` on an empty entry line insert `\ans` first, as the reference does. `(−)` stays negation. This saves a press in every chained calculation; benchmark tasks measure it.

**Alternatives:** insert the full digits as text (40 digits clutter the line); keep inserting the rounded digits (2.3 #8).

### 2.9 Decision: CAS

- A CAS result that is a number with a float gets its mark from our formatter (`≈`, or `⚠` by 2.4), and a symbolic result with a float gets `⚠` (2.4; 2.3 #17); numbers are drawn by our formatter at the digits setting (`CasResult` gains the numeric value when the result is a number, 8.2); its text and LaTeX come from `numeric`, never Giac's float. Exact CAS results get no mark. An explicit precision (`evalf(x,50)`) is honoured: that many digits, only the confirmed ones (M4-6).
- **P9 (accepted by the user, 2026-10-12):** typed decimals in CAS become exact rationals before evaluation, as in Home (`toExactLiterals`); `approx()` (Shift + Enter) gives decimals. This removes 2.3 #6 at the source (the mark alone would show `≈ 1.7763568394E-15` for `1-0.9-0.1`: marked, but not right). The visible change: `1.5x` shows as `3/2·x`, where the reference CAS keeps `1.5·x`. The `bench` stage of the golden gate runs in CAS mode, so its decimal inputs are re-checked.

### 2.10 Python
Removed with the app (P11, 2026-10-13).

### 2.11 Risks and what would change it
- Marks add a little text to every line. If the owner finds them noisy on a device, `=` could become the absence of a mark, keeping `≈` and `⚠` (one setting, no architecture change).
- Correlated errors in Giac's numeric routines: section 9 risk 1.

---

## 3. Find (EN1)

### 3.1 State
- Vars and Math do nothing until R4a and R4b; Tmpl opens the template palette (R10). Lists open on the sheet (`app/src/views/Sheet.svelte`, model `sheet.svelte.ts`, keys `sheetKeys.ts`; docs/05 3.1): numbered rows, digit keys pick, lists longer than 10 items take a letter filter.
- Any `\operatorname{name}\left(…\right)` reaches Giac as `name(…)`, so inserting a function needs no new parser rule.
- **The index exists** (G4, `tools/find-index/generate.mjs`; G3 and G13 since): 1,850 items, 325.7 kB raw, 67.1 kB gzip (2026-10-15), from Giac's `doc/aide_cas` (1,780 entries, English lines only), libqalculate 5.13.1's units, constants and prefixes, and our files `find/aliases.yaml`, `find/functions.yaml` and `find/units.yaml`. `app/src/find/rank.ts` (`prepare()`, `search()`) passes the query test 100/100 first; the desktop prototype ranked at p95 1.04–1.23 ms per key.

### 3.2 Decision: where it runs
**Main thread.** 1.2 ms per key on the desktop leaves room for a 10× slower Tab One inside 16 ms; a worker would add a message round trip per key. **Gate:** `?bench=find` replays 50 queries one character at a time, timing key → list rendered; p95 ≤ 16 ms on the Tab One (annabell). If it misses, first filter incrementally (each key narrows the previous candidates), then move ranking to a worker.

### 3.3 Decision: the index

**Schema** (one JSON array; ids are stable and become the token IDs; the type is `FindItem` in `app/src/find/types.ts`): `id` (`fn:stddev`, `const:c`, `unit:km/h`, `pfx:k`, `tmpl:…`), `kind`, `names` (what a user may type, searched in lower case), `title` (English; other languages in overlay files keyed by id), `desc` (one line: ours for tier 0, else Giac's English help line or qalc's title), `syntax` and `example` (functions), `value` and `unc` (a constant's exact decimal text and its standard uncertainty, absent when exact), `unit` (a constant's), `dim` (the dimension key, 4.3), `si` (a unit's exact factor to SI base as p/q; an offset for °C and °F), `tier` (0: curated, audited, ranked first; 1: documented only) and `insert` (the LaTeX the entry line receives).

In the index file a tier-1 function has no `insert` (G4, the user's choice of 2026-10-13); `prepare()` fills in `\operatorname{name}\left(#0\right)` at load (saves about 70 kB raw), so `FindItem.insert` stays required after loading. A unit whose qalc factor is uncertain or approximate (solar_mass, cal_fifteen, cal_mean, u, Da, the Planck and atomic units) keeps `dim` and has no `si`; where qalc's data is wrong, `find/units.yaml` gives our exact factor as an `override` (G13: hp, mmHg, inHg and 13 CODATA 2022 constants), and the build fails once qalc agrees.

Live items (variables, user functions) have the same shape with `kind: "var" | "userfn"`, built at run time (3.4).

**Format and size:** `find-index.<hash>.json`, a Vite asset outside every chunk. Budget ≤ 400 kB raw, ≤ 100 kB gzip (8.3). **i18n:** English titles and descriptions in the index; another language is an overlay file `find-index.<lang>.json` keyed by id with its own titles and aliases, merged at load. The structure allows it now; only English ships.

**Generation, from source at build time** (gorge; `tools/find-index/generate.mjs`, Node, no network; run by `build.sh` after the engines, and by `npm run index` in development; output gitignored under `app/src/find/_gen/`):
1. Giac `doc/aide_cas` from the pinned tarball: names, the English line (`2 …`) only, never French (R5), syntax and examples; entries starting with `_` dropped.
2. libqalculate 5.13.1 `units.xml.in`, `variables.xml.in`, `prefixes.xml.in` from the pinned tarball; `currencies.xml.in`, `elements`, `planets`, `datasets` skipped.
3. **Values from the built qalc engine run in Node:** each constant's value, uncertainty and unit; each unit's SI factor; a round-trip check that every unit and constant ID parses back to itself. The check is needed: qalc reads `mu0` as 0 kg, `degC` as coulomb·degree, `BTU` as byte·tesla·…, `h` as hour (probes, 2026-10-12). Formula-defined constants (μ₀, ε₀, the Bohr magneton) need qalc to evaluate them, which is why `build.sh` builds qalc (7.1).
4. Our own files: `find/aliases.yaml` (what users type and the data lacks: `kph`, `c0`, `eps0`, `degC`, `stdev`; per item id) and `find/functions.yaml` (tier 0: the curated functions, each with our own one-line description and the id of its golden accuracy case), plus the common prefixed units as items (`km`, `mm`, `µm`, `kN`, `MPa`, `kW`, `mA`, `kΩ`, `µF`, `MHz`, `kWh`, …: our list).

**Tier 0** is the audited set: every tier-0 function has a golden case at 12 digits against the oracle, including the edges of its domain (where 2.3 #2 was found). Tier 1 is everything else Giac documents, ranked below tier 0 and labelled "not checked" in the preview.

**When it loads:** fetched when the browser is idle after the engine is ready (the same hook as the service worker registration in `main.ts`), parsed on the first Find open; if Find opens first, it fetches then. Never in the start chunk (size test).

**Licences:** THIRD_PARTY.md "Find index data" (Giac's English `aide_cas` lines under GPL-3.0-or-later, P10, with B. Parisse's confirmation before any public release; libqalculate's data files, GPL-2.0-or-later; our own files). The About screen credits both.

**Alternatives:** generating at run time from the engines (costs start-up and memory); committing the generated JSON (F-Droid: generated data in git is not our source); all 1,780 Giac commands at the same rank (buries what engineers use under graph theory and geometry).

### 3.4 Live entries
The engine host reports the name each stateful input defines (`defined: {name, kind}`, from `:=` and ▶). The session keeps `userNames` (name, kind, formatted value preview, view, time), read through `Calc.names()` from the persisted defs log (6.2), so Vars works after a relaunch. Find merges them at query time; a library function brings its one-line `desc` (G33).

### 3.5 Ranking
No usage boost (P11), so the same query always gives the same order (docs/03 rule 8); with an empty query Find shows the G2-style Math menu (fixed categories, fixed order). Our own code (`app/src/find/rank.ts`, built in G4). Order (numbered as in `rank.ts`; (1) was the usage boost): (2) exact match of a name, symbol or alias; (3) prefix of one, shorter first; (4) word prefix inside one (`_`, space); (5) word prefix in the title or description; (6) one edit away (insertion, deletion, substitution, transposition) for queries of 4+ characters. Ties: tier 0 first, then the context's kind (variables in Vars, units in a unit slot), then the shorter name, then id. Nothing is stored.
**Alternatives:** uFuzzy, fuzzysort or Fuse.js (they know none of our tiers or kinds, so the same code would wrap them; our own costs 1.2 ms per key).

### 3.6 Insertion and tokens
- MathLive macros on the entry field, all `captureSelection: true, expand: false`, so the cursor cannot enter a chip and `getValue()` keeps the macro (R2: `entry/macros.test.ts`, `app/test/chips.spec.ts`): `\const{ID}`, `\unit{ID}` (unit view only), `\pfx{p}`, `\res{n}`, `\ans`. The chip macros take a second argument that is only what they show: `\res{k}{shown LaTeX}`, `\const{ID}{symbol LaTeX}`; a macro definition cannot look up a value, so the display travels in the LaTeX and the value in the chip table. A Find item's `insert` for a constant is `\const{ID}{symbol}`, ID being the item id without `const:`.
- **Parser:** `\const{ID}` becomes, in Home, CAS and Solve, the constant's exact value as a rational literal (`299792458`, `(667430/10^16)`), and the parser reports `inexact` when the constant has an uncertainty, so the result is `≈` (2.4). In the unit view it is a `pask<j>` placeholder (R28, G16); R40 sends an inexact constant to `home()` as `pasc_<id>` with its σ (G26). **Chips carry their own values:** an inserted `\const` chip copies its value and uncertainty from the index into the entry's chip table, which each history item stores beside the entry LaTeX; the parser reads the table, never the index, so parsing stays synchronous and a recalled entry needs no index load, and it shows `G`, not 6.6743E-11.
- Functions insert `\operatorname{name}\left(#0\right)` (`#0`: a selection becomes the argument, R17); templates insert their LaTeX, each with a parser rule and round-trip case.

### 3.7 Keys inside Find
Every key types its Alpha letter in lower case (no Alpha press); Shift + key types the key's primary character (digits, `.`); the space key types a space; ⌫ deletes; ▲▼ and the trackpad move the selection; Enter inserts; Esc or Cancel closes. Vars opens Find filtered to variables; ⌫ on an empty query removes the filter. Digits do not pick, unlike the other sheets, because queries need them (`g0`, `log10`, `e24`).
**Keystroke budget:** an item used before: Math, first letter, Enter (3 presses); a new one: Math, the letters, Enter. Benchmark task 5 checks it.

### 3.8 The query test
`tests/tasks/find-queries.yaml` (`query`, `expect` id, `note`), run by Vitest against the generated index and the real ranking (`app/src/find/queries.test.ts`). **Gate:** every phrase in the top 3, at least 90 % first. The first 100 phrases are in Appendix B, plus 10 `pending` ones whose items arrive in milestone 6. The owner adds a phrase whenever Find misses one.

### 3.9 Budgets, risks, would change
Budgets: 8.3. Risks: alias quality (only the query test and real use show it); the chip look (screenshot test). Would change if the Tab One misses 16 ms (incremental filtering, then a worker), or the index outgrows 100 kB gzip (split functions and units into two files).

---

## 4. Units: the unit view (EN2, P3 as amended by P8, P11 and P15)

There is no separate Units app (P11): units are added *after* the formula, in unit slots, in the unit view opened by the units key (decisions.md P11 and S1; layout and press counts in `docs/research/r7-unit-slots.md` and `docs/research/r9-unit-pad.md`). **P15 (decided 2026-10-14; G15's check passed 2026-10-15):** Giac does the unit arithmetic in the worker that is already loaded, with the Find index's exact factors; libqalculate is used only at build time, as the index's source. Our parser decides what reaches Giac, and the evaluator checks the result.

### 4.1 Evidence: units on Giac (G15's probe, 2026-10-15)
`tools/probes/units-giac.mjs` turns each unit token into its exact SI factor from the Find index times one symbol per base dimension (`pasdimL` … `pasdimB`; the angle `pasdimA` is one of them), and Giac's `normal()` computes exactly. Against qalc 5.13.1 and mpmath (the rows G13, G17 and G25 changed since show what the evaluator gives now):

| Input | Giac | qalc |
|---|---|---|
| `72 km/h → m/s`; `1 in → mm`; `1/3 m → cm` | 20; 127/5; 100/3 | the same |
| `1 lbf → N`; `4.7 kΩ × 2.2 nF`; `√2 m` | 8896443230521/2000000000000; 517/50000000 s; √2 m | the same |
| `20 °C → K`; `100 °F → °C`; `20 °C → °F` | 5863/20; 340/9; 68 | the same |
| `90° → rad`; `60 rpm → rad/s`; `sin(30°)` | π/2; refused: T⁻¹ vs T⁻¹·angle (rpm counts revolutions, G25); 1/2 | π/2; 2π; 1/2 |
| `(12.34 ± 0.05) m × (3.2 ± 0.1) m` | 4936/125 ± √387089/500 m² (first order) | the same σ; prints ±1.3 |
| `1 m + 1 s`; `1 m → s` | "Units don't match: L vs T" | `1 m + 1 s`; `1 m` (no error) |
| `20 °C + 5 °C`; `20 °C × 2` | refused (absolute temperature) | 25 °C; 40 °C |
| `ln(2 m)`; `sin(2 m)` | refused | left unevaluated |
| `1 rpm → Hz`; `1 rad/s → Hz` | 1/60 (rev is a count of cycles, G25); refused: T⁻¹·angle vs T⁻¹ | 0.1047 Hz·rad; 1 Hz·rad |
| `1 hp → W`; `1 mmHg → Pa` | 745.69987158227… W (golden u10); 133.322387415 Pa: our exact factors (G13) | 745.699987158 W; 133.322368421 Pa (both wrong) |
| `1 Np → dB`; `1 W → dBm` | 20/ln 10 = 8.68588963807 dB; 30 dBm (G17, golden l01, l02) | 8.68588963807 dB; 30 dBm |

The 26 spike cases, tasks t02, t04, t10 and these rows agree with qalc, except where qalc is wrong (oracle). Every unit in S1's 50 and on the draft pad has the same SI factor in both; qalc's SI form drops rad. On the desktop an evaluation takes median 0.5 ms and p95 1.5–3.2 ms, in one Giac call. A half power (nV/√Hz) takes 8 ms.

G15 counted 36 index units without an exact factor. G13 gave hp and mmHg ours, and G17 handles the 4 logarithmic units by rule; the rest (nat, trit and Hart; the 15 °C and the mean calorie; 24 Planck, atomic and natural units and the solar mass, which are values with an uncertainty) are refused with a message naming the unit (`nofactor`).

### 4.2 Decision: the unit evaluator on the Giac worker (P15)
There is no third worker. The unit view's arithmetic is a `units` request in worker 1, beside `home`, so Cancel works as in Home: terminate, respawn and replay the definitions. The factor table (units' `si` and `dim`, prefixes' powers of ten) comes from the Find index. It loads with the unit view, never in the start chunk.

The evaluator (`app/src/units/`, G16):
- substitutes each slot's tokens by factor × dimension symbols and evaluates exactly with `normal()`;
- checks for one term: each exponent d·∂f/∂d / f must be a number;
- converts to the end slot, where the quotient must be a pure number;
- returns a `Quantity` whose mark comes from Home's facts and `markOf()`. An irrational value goes through the agreement check.
- The input is R24a's tokens per slot and the formula with `pasu<n>` per slot and `pask<n>` per constant; the request is built into Giac text on the main thread, so only text reaches the worker. The dimension symbols are positive (√(m²) = m), and an exact 0 has no dimension.

sin, cos and tan take an angle or a pure number; the angle dimension is dropped inside them. Any other function of a quantity with units is refused. On top of this come G17's rules for temperatures and logarithmic units, and G18's first-order uncertainty (σ² = Σ(∂f/∂xᵢ·σᵢ)², with Giac's `diff`): the formula writes an uncertain number as `pasupm(value,sigma)` (two plain numbers, σ a standard uncertainty in the unit of the slot after it, each one an independent input); the builder turns each into a symbol (`UnitJob.unc`), and a result with a σ is never `=`.

The cost: a long CAS job in the same worker delays a conversion until Cancel.

### 4.3 Decision: the unit view (entry, parsing, results)
- **Entry (P11, P14; layout in `spec/unit-pad.yaml`, press counts in docs/research/r9-unit-pad.md):** the units key (Shift + Tmpl, a flick up on Tmpl) on an entry line or a picked history row shows the same formula, read-only, with an empty unit slot after every number and an optional end slot "→ should be"; on an empty line one slot (quantity 1) and the end slot. ◀ ▶ jump between slots, never through the formula. In a slot the maths rows are the unit pad's prefix and unit cells drawn over the keys (R21's layer; S5's arrangement and 18 user slots), the number keys are prefixes, a slot holds unit ids, never text; Enter goes to the next slot and evaluates in the end slot; Math opens Find on units. Built on MathLive's prompts (a read-only field with `\placeholder[id]{}` per slot): a probe of 2026-10-15 showed `setPromptValue` and `getPromptValue` round-trip fractions, powers, products, `√` and prefixed units, and ◀ ▶ go prompt to prompt; but `insert()` with the caret outside a prompt still changes the formula (`72` became `972`), and MathLive merges neighbouring upright names (`\mathrm{k}\mathrm{\Omega}` reads back as `\mathrm{k\Omega}`). So a slot's tokens live in R24a's model, never read back from the field, and the unit view writes a slot only with `setPromptValue`, never through `EntryController.run` (5.5).
- **Grammar per slot:** a product of factors with `×`, one `÷` (the rest is the denominator), powers, `x⁻¹`, `√`. The formula comes from the parser's units mode (R28): a prompt after a number is pasu<n> in the order written, a constant is pask<j>, `±` after a number is pasupm(value,σ), and `\to` before the last prompt is the end slot. A factor is one symbol from Find's unit list: an exact symbol first, then prefix + symbol. The parser in `units` mode emits unit and prefix ids from these whitelisted names only (the generator's round-trip check, 3.3). **Alternative rejected:** qalc's own parser, which reads `BTU`, `lbm`, `var`, `Kg`, `pa`, `G` as other things (docs/research/r7-unit-slots.md section 5.2).
- **Live reading:** under the slot, in words; a prefixed unit outside Find's common list is marked; a factor that is no symbol is an error naming it with the near symbols. A prefix alone is an error.
- **The evaluator checks:** the formula with its units must give a single term (number × units), else "Units don't match: L vs T" naming the term (P11); an absolute temperature in arithmetic → "Use K or Δ°C for a temperature difference"; with an end slot, a dimension mismatch is an error naming both.
- **Result:** value (exact fraction or P-digit decimal) through our formatter at the digits setting, the mark by the 2.4 rules from the same engine facts as Home, the unit drawn upright, the dimension as `L·T⁻¹`. With an end slot: in that unit. Without: in the units typed when they fit the result's dimension (so a torque stays `N·m`, SI would say `J`), else SI with an SI prefix (2.7); one tap gives the SI base form and the last unit used for that dimension (IndexedDB `units.targets`, `{dimKey: unitId}`).
- **Temperature:** `°C` and `°F` are absolute and allowed only alone (`20 °C → °F` = 68, `derived`); differences are `K`, `°R`, or the Find aliases `Δ°C` (of K) and `Δ°F` (of °R). Golden cases for each, and the rejected `20 °C × 2`.
- **Logarithmic units, angles, currency:** as before (conversions only for dB, dBm, Np; `rad` stays in the dimension key; currencies off, with the index test). dB, bel and Np convert by the field-ratio rule (1 Np = 20/ln 10 dB, 1 bel = 10 dB); dBm and dBW by the power ratio to 1 mW / 1 W; the message is `dB converts only`.
- **The way back:** the result inserted into Home is a `\res` chip with the number in the unit shown; the chip's label says the unit was dropped. The line itself keeps its slots, so the units key shows them again.

### 4.4 Budgets and gates
No engine chunk: the unit view's UI chunk (≤ 30 kB raw) and its factor table from the Find index load on the first press of the units key, never at start; a Playwright test asserts that neither is requested in a session without it. First result < 1 s on the Tab One; desktop p95 ≤ 5 ms per evaluation (G15: 1.5–3.2 ms). Also: `units.yaml` in the golden gate; **a unit in ≤ 4 presses at the median** (`tools/probes/unit-presses.mjs`, then the same list as an e2e replay); benchmark tasks 1–4 and 10 within budget (plans from S1: t02 12, t04 13); the owner's hand timing (rule 2).

Open points for milestone 5 (each with a default): r7 section 7.

### 4.5 Risks, would change
Risks: a wrong factor that G13's audit against CODATA and the exact definitions missed; a long CAS job delays a conversion until Cancel. Would change if the owner, after using the unit view, wants `5 km + 300 m` in Home (P8: the same worker behind a setting; the token design already supports it).

---

## 5. Keyboard and entry

### 5.1 Decision: every cell P8 touches, and every free cell
Positions use our rows and columns (`spec/keyboard.yaml`); the reference's id is in brackets (`spec/mapping/vc-2026-10-11/keys.yaml`). "Built" names the package; the rest is planned. R15c (decisions.md) replaces the top cluster's rows 0–2 and their rows below: R15c2 rewrites this table.

| Key | Decided | Source and why |
|---|---|---|
| Math (row 3, col 1) [r4c2] | Find, everything (R4a) | P8 |
| Shift + Math | Memory: Find on variables and user functions, with delete and "clear all" (R4b) | reference: Mem |
| Vars (row 3, col 0) [r4c1] | Find, filtered to variables (R4b); Shift + Vars unassigned (Find covers named symbols) | P8 |
| Tmpl (row 3, col 2) [r4c3] | the 6 × 3 template palette, picked by arrows, Enter or a tap (built, R10; r8 rule M1) | P8, P11 |
| Shift + Tmpl | the unit view (unit slots) | P11; reference: Units |
| The letters A–Z, `#`, `:`, `;` (Alpha layer, flick down) | **stay**: Find's keyboard (3.7), names, CAS symbols, hex digits A–F (5.4); not the unit slots (P14) | decisions.md "The letters stay" |
| Alpha key [r8c1] | one-shot Alpha with lock flicks; a merge with Shift is decided on the tap counter (P7 point 4); if merged, its cell becomes a user key | P7 |
| a b/c (row 3, col 4) [r4c5] | toggles the last result's form: decimal ↔ fraction, polar ↔ rectangular (built, R10) | G2 item 29, P12 |
| Exponent key (row 6, col 0) [r7c1] | types the mark `ᴇ` (`\emark`, one token); Shift = Sto ▶ (built, R14) | P12 |
| Rows 0–2 (Home, CAS, Apps, Mode, Symb, Plot, Num, Menu, Help, the arrows) | layout D (built, R15b); **R15c replaces it** (decisions.md "R15c") | P12, S2, R15b, R15c |
| Alpha + 0 (quote); Shift + ◀ ▶ (line jumps) | removed (R13); R15c brings the jumps back as ⇤ ⇥ | P12, R15c |
| Shift + 6, Shift + 9 | the G2's palettes: relations and logic; symbols and Greek with `!` and ∞ (built, R18) | P12 |
| View (row 1, col 4) [r2c4] | results mode: the keypad collapses to a slice (P16, R53); Shift = Help | P7 point 5, P16 |
| Shift + View, Shift + Menu | Copy and Paste (built, A3); R15c gives Copy its own key | reference |
| Menu (row 2, col 4) [r3c4] | app menus; Home/CAS: one numbered list of nine on the picked row, else the last result (built, R11; decisions.md S2); R53 makes item 6 Plot | P8, S2, S9 |
| Help | context help: the Find preview of the function before the cursor; with none there, Find (milestone 6) | ours; P8 left Help free |
| User keys | U1–U3 with Shift layers (built, R15b); U1–U6 with tap, Shift and Alpha (R15c), set from Find (R4b) | R15b, R15c |
| Shift + `+` [r10c5] | Ans (`\ans`, built, R2) | reference |
| Shift + `−` [r9c5] | Base: the last result in HEX, BIN, OCT, DEC; word size (EN6) | reference: Base |
| Shift + 5 [r8c3]; Shift + 8 [r7c3] | `[ ]` vector or matrix template (EN5); `{ }` list (built, R54) | reference |
| Shift + 4 [r8c2]; Shift + 7 [r7c2] | the matrix editor (EN5); the list editor, deferred with Statistics | reference: Matrix, List |
| Unit slots | the unit pad (`spec/unit-pad.yaml`, docs/research/r9-unit-pad.md): prefix and unit cells over the maths rows, S5's arrangement, 18 user slots; Enter to the next slot, `→` the end slot. Until R24c, `spec/keyboard.yaml` `unit_slot:` holds S1's letters | P11, S1, P14 |
| Unassigned Shift cells (14 on 2026-10-14: Shift + ▲ ▼ ◀ ▶, Vars, a b/c, `( )`, `,`, 1, 0, Fmt, and Symb, Plot, Num until R15c) | they get the functions the task benchmark shows are pressed most, not a list made in advance | decisions.md "The letters stay" |
| Prefix chips | a strip above the keypad, only after a number, only if task 3 shows a gain | P8 |


### 5.2 Decision: how key presses are counted (EN0)
Every key press counts 1, Shift and Alpha included; letters typed in Find count 1 each; Enter counts; a held ⌫ that auto-repeats counts 1; a trackpad drag counts 1; a flick (up or down on a key, lock flicks included) counts 1; a tap on the screen (history row, Find result, chip, menu item, prefix chip) counts 1. Nothing is free. A task stores its sequence as data (`keys:` key ids, `up:`/`down:` flicks and `tap:` targets), and the harness replays it and counts.

### 5.3 Decision: matrices and lists (EN5)
- **Entry:** Shift + 5 inserts a 1×1 `pmatrix` with the cursor inside; ▶ at the end of a row adds a column, ▼ in the last row adds a row (MathLive's `addColumnAfter`, `addRowAfter`, `mathlive/types/commands.d.ts:137-157`), ⌫ in an empty last row or column removes it. A 3×3 needs only digits, ▶ and ▼. Shift + 8 inserts `\{□\}` (built in R54): its body is one box holding the elements, separated by commas, read as a Giac list; ⌫ at the start of the body removes the braces and keeps the elements; an empty list is refused with a message.
- **Parser:** `pmatrix`, `bmatrix`, `matrix` are read (`parse.ts:718`); new round-trip cases for grown matrices and for chips inside cells.
- **Stored matrices** are Giac variables (any name, ▶ to store); the matrix editor (Shift + 4) edits one in a grid (the Num view's table code) and writes it back with `name:=[[…]]`, which the definitions log persists (6.2).
- **Display in Home:** every element through our formatter, one mark for the whole (2.4).

### 5.4 Decision: number bases (EN6)
- **A base is a display mode of an integer result**, like the Format key's modes, not a property of the value. Shift + `−` opens the Base menu (HEX, BIN, OCT, DEC for the last result). Word size (8, 16, 32, 64) and signed (two's complement) or unsigned are settings. A non-integer gives a message.
- **Entry:** `0x…`, `0b…`, `0o…` become one literal token in the parser (Giac reads `0xFF` as 255: probe); hex digits A–F are the Alpha letters. The same keys are an error since R2 (2.3 #1); milestone 6 makes them a literal.
- **Bitwise:** `bitand`, `bitor`, `bitxor` work (probe); shifts and rotations as EN7 definitions that respect the word size.

### 5.5 Decision: the entry line, one key path and one box model (architecture check, 2026-10-15)

**State** (code read 2026-10-15, R43 and R45 merged since):
- **The key path:** keypad → `App.svelte` `press()` (Shift and Alpha, an open sheet, keys queued while an app loads) → `run()` (the layer's action, a picked history row, Ans first on an empty line, the a b/c form cycle) → `EntryController.run` (`entry/controller.ts`), whose branches handle ▶ to the next empty box, ⌫ and Del at a template (`delete.ts`), ᴇ, 10ˣ after a digit, an E number, a selection under a power or DMS, a chip and a compound term before a power or ÷; after an arrow, `settle()` (`stops.ts`). Hardware keys (`hwkeys.ts`) map to keypad keys and go through `press()`; a letter goes through `typeLetter`, which runs the same checks.
- **What a box is:** one model, `entry/boxes.ts` (`boxTemplate()`, `startsBox()`, `endsBox()`), read by `delete.ts`, `stops.ts` and `nextBox`; `isStop()` keeps its own regexes for names and marks. The term before the cursor is still scanned in five places (`selectENumber`, `selectCompound`, `selectChip`, `afterDigit`, `afterNumber`), and the parser has its own side of where a number ends (R29).
- **Tests:** the ⌫ grid (`app/test/bksp-grid.spec.ts`) and the cursor grid (`app/test/cursor-grid.spec.ts`) read every template from `spec/keyboard.yaml`, so a new key joins them by itself.
- **The unit view's field** (4.3): read-only with prompts; `insert()` outside a prompt changes it, and the hardware-key handler is attached to the entry field only.

**Decision:**
1. **One key path** (built, R45): every key, from the keypad or a hardware keyboard, goes through `press()`; `hwkeys.ts` only maps a character or key name to a keypad key id and layer, so an open sheet, a picked row, Find and the unit slots see hardware keys exactly as keypad keys.
2. **One owner per key press.** `press()` hands the key to whatever owns it now: an open sheet, Find, a unit slot, a picked history row, or the entry line. Two exist (`sheetPress`, `historyKey`); Find and the slots make four. The unit view never sends keys through `EntryController.run`: its slots change only through R24a's model and `setPromptValue`. The common seam is built with the second new owner (R24c), not before.
3. **One box model** (built, R43): `entry/boxes.ts`, read by `delete.ts`, `stops.ts` and `nextBox`. The cursor grid checks, for every template, that ◀ visits every stop and nothing else, ▶ reaches the end, every stop is at the edge of a box, and ▶ from the end of an inner box stops at the end of the outer one (▶ cannot stop at every box while an empty box is ahead: R10 jumps to it).
4. **A new template** brings, in its commit, a parser rule with its round trip (as before) and a recogniser in `boxes.ts` when its LaTeX shape is new; the grids read the yaml and need nothing.

**Alternatives:** a template registry that describes each key's boxes as data (cleaner, but every recogniser would be rewritten at once, and the grids already catch a missing one); leave the three models (each new template and the unit view then add more copies that drift apart, as F34 shows; R29 added the parser's).
**Risks:** the recognisers read MathLive's atom LaTeX (`\text{i}`, `\mathrm{d}`, `\,`), so a MathLive upgrade can break them without a type error; both grids are the guard and run before any upgrade merges.
**Would change if:** a MathLive upgrade breaks the recognisers more than once; then the template registry of the alternatives replaces them.

---

## 6. Engine, workers and state

### 6.1 Topology and contracts
- **State:** the main thread runs the UI, keyboard, parser and formatter; worker 1 is Giac (started at launch, D2), cancelled by terminate and respawn with the definitions replayed. The MicroPython worker went with the Python app (P11).
- **Decision:** no further worker: the unit view computes on worker 1 (P15) and Find needs none (3.2). Interface changes are in 8.2.

### 6.2 Decision: one storage plan
One IndexedDB database `pascaline`, store `kv` (`state/storage.ts`). Keys:

| Key | Holds |
|---|---|
| `settings` | `schema: 2`, digits ≤ 30, format (`std`, `sci`, `eng`, `fix`, `pfx`), fixDecimals, fmtCycle, entry, haptics; later the decimal comma (R57, schema 3) and the base word size; each field validated on restore (`migrateSettings`, `state/session.svelte.ts`) |
| `view`, `place`, `entry` | the open view and app; the half-typed line (R34) |
| `history` | ≤ 200 items per view, with `full` (≤ 2 kB) and the mark facts |
| `defs` | the definitions log (`:=`, ▶, `purge`), one entry per name with kind, replay commands, mark facts, preview, view and time (`engine/defs.ts`), ≤ 500 lines, replayed at start. **Variables are kept as their value**, not the command that made them (G3): `B:=romberg(…)` is stored as `B:=(evalf(<exact>,k))`, so a relaunch does not re-run the integral and `A:=rand()` keeps its value; functions and `assume` keep their command; symbolic values replay first; a library function carries its `desc` (G33, `DATA_VERSION` 2) |
| `defsStarts` | starts that began the replay and never got ready; at 2 the engine starts without the log (G19) |
| `userKeys`, `taps`, `app.function`, `app.solve` | the user keys' slots; R9's Shift/Alpha tap counter; per app (R53 adds `uses`, its counters) |
| `units.targets`, `units.history` | the last target per dimension; the unit view's history (milestone 5) |

**Every value is stamped** with `DATA_VERSION` (`storage.ts`): `{ "@pascaline": n, value }`; a value without the stamp is version 0. On read, the steps in `MIGRATIONS` for that key run from its version up, and the value is written back stamped. Raise the version with a step whenever a stored shape or the meaning of stored Giac text changes (a parser rename such as Φ → `Phi_` must rewrite the stored `defs`). **Replay budget:** ≤ 50 ms on the Tab One with 200 definitions, inside the engine-ready bar (`replayMs` in `EngineTimings`): 291 ms on 2026-10-16 (A4a); G29 batched 200 Giac calls into 8, and A12 re-measures. **Why persist definitions:** a calculator keeps its memory.

### 6.3 Decision: start-up and bytes
- The sizes and budgets are in 8.3. New code for Find, units, copy and the matrix editor lives in lazy chunks; the start chunk grows only by key handlers and marks (≤ 156 kB, ≤ 54 kB gzip; owner, 2026-10-14).
- **The size test** (A1): `app/scripts/size-check.ts` reads Vite's manifest and fails when a chunk passes its budget; `npm run build` and `build.sh` run it.


---

## 7. Build, licences, F-Droid, tests

### 7.1 Decision: build order
`build.sh`: fetch (SHA-256 checked) → Giac (container, P2) → **qalc** (`engine/qalc/build-wasm.sh [dev|release]`, promoted from `spike/qalc`, release in the same pinned trixie container; GMP and MPFR tarballs shared with Giac) → **Find index generator** (Node, from the unpacked tarballs and the qalc build) → app build (size test) → Capacitor → Gradle. `--no-units` skips qalc; the index then holds functions only and Find still works. `npm run index` in development does the same when no qalc build is present, with a warning. Everything generated stays out of git; F-Droid's recipe mirrors `build.sh` and gains the libxml2 and libqalculate tarballs with their SHA-256. Build time with qalc (A2, 2026-10-12): the release container build of qalc takes 7.5–8 min; the wasm is 949 kB brotli and byte-reproducible; nothing of it ships (P15). **Why qalc is built:** the index takes constant values, uncertainties and unit factors from it (3.3 step 3). **Alternative:** values from the oracle venv (not part of `build.sh`, a second source of truth).

### 7.2 Licences
| Piece | Licence | Compatible | THIRD_PARTY.md |
|---|---|---|---|
| libqalculate 5.13.1 (build time only, P15: its data ships in the Find index, its code not in the APK) | GPL-2.0-or-later | yes (combined work GPL-3.0) | listed as the index's data source |
| libxml2 2.15.1 | MIT | yes | same |
| Giac `aide_cas`, English lines | GPL-3.0-or-later (R5) | yes | new "Find index data" section |
| `@capacitor/share`, `@capacitor/clipboard` 8.x (A11: the WebView denies `readText` and has no `navigator.share`) | MIT | yes | add with the code |
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

The gates per milestone are the backlog's milestone lines.

---

## 8. Components, interfaces, budgets

### 8.1 Component diagram

```
Capacitor shell (Android) / PWA (service worker precaches everything after the engine is up)
└─ Main thread (TypeScript)
   ├─ Keypad + key layers (spec/keyboard.yaml)       ─┐
   ├─ Entry line: MathLive + macros (\const \unit      │ key → action
   │  \pfx \res \ans)                                  │
   ├─ Parser P1 (LaTeX → Giac text | unit tokens)     ─┤
   ├─ Formatter + marks (format.ts, pure)              │
   ├─ Views: Home, CAS, Function, Solve,               │
   │  Units (m5), Find palette (lazy), Matrix editor   │
   ├─ Find: index (lazy asset) + ranking (rank.ts)     │
   ├─ Clipboard / share port                           │
   └─ Session state ── Kv (IndexedDB: settings, history, defs, units.*)
        │ Calc port (views)
        ▼
   Worker 1: Giac + GSL + GMP + MPFR
   (launch; Home, CAS, Solve, analysis, table, units (m5); defs replay)
Build: build.sh → engines (container; libqalculate for the index only) → Find index generator (Node + qalc) → Vite (size test) → Capacitor → Gradle
```

### 8.2 Interfaces (every async interface)
The types live in the code; this is the map. Views see `Calc` (`app/src/calc/port.ts`), which wraps `MathEngine` (`app/src/engine/types.ts`), which talks to worker 1.
- **`MathEngine`:** `ready`, `home(input, s, consts?)` (G26: `consts` sends inexact constants as `pasc_<id>`), `cas`, `solve`, `unknowns`, `analyze`, `table`, `eval` (tools and benchmarks only), `definitions()` (the defs log, 6.2), `units(job, s)` (G16: a `UnitJob` built on the main thread by `units/build.ts`), `cancel`, `dispose`. The worker's home, cas and eval replies carry `defs: DefChange[]`; `{type: "define", defs}` → `{type: "defined", replayMs}` (G3).
- **`HomeResult`** (`engine/homeEval.ts`) carries, beside the display and timings, the facts for the mark: `exactRational`, `reliableDigits` (null = exact); `full` (the copy and chip value: exact text or P digits); `defined` (what a stateful input defined); `items` and `shape` for a numeric list or matrix; `digits` (what `evalf(e,n)` asked for); `warn` (`unaudited`, or `unchecked` for a non-number with a float); `why` (G22: `unaudited`, `inherited`, `once`; R36 words them); `uncDigits` (G26: the digits before the first digit of the CODATA σ; R40 mutes the rest).
- **`CasResult`:** `numeric` when the result is a number; `approximate`, `warn` and `why` for a non-number; `uses` (G20: the stored variables the input read, not the names it binds).
- **`Calc`:** the same calls with `CalcSettings`, plus `names()` (the user's names, 3.4) and `units(req, s)` (a lazy chunk; the factor table loads on the first call).
- **Units** (`app/src/units/types.ts`): `UnitRequest` (the formula from our parser with `pasu<n>` per slot, `pask<n>` per constant and `pasupm(value,sigma)` per ±; `slots`; `consts`; the `end` slot), `UnitSlot` and `UnitToken` (prefix, unit, power; the prefix is inside the power), `UnitJob` (Giac text with every unit as factor × dimension symbols; the end slot's offset or level; `unc` with a symbol per uncertain input; `shows`, the typed units a result may be shown in), `Quantity` (`value` as a `HomeResult`, `dimension` and `dimensionText`, null for an exact 0; `unit`; `si`; `unc` with σ to two significant digits), `UnitError` (`dimension`, `temperature`, `logarithmic`, `nofactor`, `level`, `belowzero`, `function`, `symbolic`, `engine`; the message is `unitErrorMessage()` in `units/messages.ts`).
- **Find** (main thread): `FindItem` (`app/src/find/types.ts`, the schema of 3.3); the planned `FindIndex` with `load(lang?)` and a synchronous `search(query, ctx)` within 16 ms (R4a).
- **`Kv`** (`state/storage.ts`): `get`, `set`. **`ClipboardPort`** (`app/src/clipboard/port.ts`): `writeText`, `readText`, `share` (false when the platform cannot share; then copy); A11 adds the Capacitor plugins behind it.

### 8.3 Budgets

| Item | Budget | State | Enforced by |
|---|---|---|---|
| Start chunk | ≤ 156 kB raw, ≤ 54 kB gzip | 53.16 kB gzip after G30f1 (`99beb2e`, 2026-10-18); `tools/probes/start-chunk.mjs` lists the bytes per source; every UI package reports its delta | size test |
| MathLive chunk (after the keypad) | ≤ 830 kB raw | 807.73 kB (2026-10-12) | size test |
| Find UI chunk | ≤ 30 kB raw | — | size test |
| Find index asset | ≤ 400 kB raw, ≤ 100 kB gzip | 325.7 / 67.1 kB (2026-10-15) | size test (once Find loads it) |
| Unit view chunk | ≤ 30 kB raw | 3.83 kB (G16, 2026-10-18) | size test (rule on `src/units/`) |
| Precache total | ≤ 18 MB | 12.3 MB (2026-10-15) | size test |
| Keyboard usable / engine ready (Tab One) | < 1 s / < 1.5 s, with the `defs` replay | 688 / about 1060 ms; 1489 ms engine ready with 200 definitions (A4a, 2026-10-16) | device runs |
| Enter → result p95 (Tab One) | < 150 ms at 12 digits; at 30 digits ≤ 1.3 × the 12-digit p95 | 138–160 ms at 12, 147–149 at 30 (A4a) | device runs |
| Find key → list (Tab One) | p95 ≤ 16 ms | desktop prototype p95 1.04–1.23 ms | `?bench=find` (A4b) |
| Find open | ≤ 100 ms warm, ≤ 300 ms cold | — | device runs |
| Units first result (Tab One) | < 1 s | — | device runs |
| Unit evaluation (desktop) | p95 ≤ 5 ms | median 0.91 ms, p95 ≈ 2 ms (G16) | the golden units section |
| `defs` replay | ≤ 50 ms at 200 definitions | 291 ms (A4a); G29 cut the Giac calls from 200 to 8; A12 re-measures | device runs |
| Key presses | each task within its budget; a unit ≤ 4 at the median | — | task benchmark |
| Find quality | 100 % top 3, ≥ 90 % first | 100/100 first (G4) | query test |

"Start chunk" is the entry's JavaScript plus every chunk it imports statically (Vite manifest `imports`, transitively), as `app/scripts/size-check.ts` measures it. The entry's CSS is not counted (25.8 kB raw, 9.0 kB gzip on 2026-10-12); it gets its own line if it passes 40 kB raw.


---

## 9. Top risks to the goal

1. **Correlated numeric errors in Giac** (2.3 #2): the agreement check catches most wrong digits, not all. Mitigation: tier-0 audit with domain-edge golden cases, upstream reports, `⚠` rather than silence.
2. **Find quality** depends on aliases and real queries, not code. Mitigation: the 100-phrase gate from day one and the owner adding misses.
3. **A wrong unit factor or a missed unit check** (misread names, mismatched sums, offset-unit arithmetic). Mitigation: chips only, the generator's round-trip check, the evaluator's single-term and temperature checks (P15), `units.yaml`.
4. **Tab One budgets for the new work** (Find per key, the unit view's first result) are desktop estimates until annabell measures them.
5. **Pace on parser- and keyboard-heavy work** (03 risk 5). Mitigation: each token lands with its round-trip case.
6. **The entry's rules drift apart** (5.5; F34 came from three models of a box). Mitigation: one model in `entry/boxes.ts`, the cursor and ⌫ grids, one key path (R43, R45).

---

## Appendix A: probes
The probes behind this document are in `tools/probes/` (its README says how to run each): `engine.ts` (Home and CAS paths through `EngineHost`, `FACTS=1` for the facts), `parse.ts` (the parser), `digits-cost.ts`, `units-giac.mjs` (G15), `find/` (the index prototype), `start-chunk.mjs`, `bound.ts`, `replay-cost.mjs`, `unit-presses.mjs`, `results-geometry.mjs`. Oracle values: `tests/golden/.venv/bin/python -I -c "import mpmath as m; m.mp.dps=40; …"` (`sqrt(2)*erfinv(2p-1)` for `normald_icdf`, `quad(exp(-x^2),[0,1])`, `erfc(10/sqrt(2))/2`, `besselj`, `airyai`). The 2026-10-12 qalc glue was a throwaway (git history).

## Appendix B: the Find queries
The phrases are `tests/tasks/find-queries.yaml` (3.8): 100 active ones (25 constants, 40 units, 5 prefixes, 30 functions) and the pending ones whose items arrive in milestone 6. Some are ambiguous on purpose (`newton`, `kb`, `db`): the top-3 rule tolerates that, and the first hit shows how good the ranking is. The owner adds a phrase whenever Find misses one.

## Appendix C: open items (to verify), who, how

| Item | Who | How | Decides |
|---|---|---|---|
| Find per-key time on the Tab One | annabell (A4b) | `?bench=find` | main thread or incremental/worker (3.2) |
| The stacked unit's height in a prompt | ron (R24c) | gallery at 360 × 740 | the row height of the unit view |
| Units first result on the Tab One | annabell (m5) | device run of the unit view | the lazy-load bar (4.4) |
| The `defs` replay after G29 on the Tab One | annabell (A12) | `?bench=defs`, seven cold starts | 6.2's budget; R59's gate (decisions.md G33) |
| A fresh-clone `build.sh` time with qalc | annabell | `./build.sh` from a clean clone | 7.1 |
