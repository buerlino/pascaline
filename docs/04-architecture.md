<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Pascaline architecture for the precision-engineering goal

*sandra, 2026-10-12; checked against the code on 2026-10-15 ([archive/shifts/2026-10-15-sandra-archcheck-report.md](archive/shifts/2026-10-15-sandra-archcheck-report.md)), made current by the docs diets (S7, 2026-10-18; S10, 2026-10-19, which moved the probe results and the regression list to [research/r12-evidence.md](research/r12-evidence.md)). **This document supersedes [02-architecture-plan.md](02-architecture-plan.md) wherever the two differ.** docs/02 stays the record of the original plan and of the reasoning that still holds (solver choice in section 4, licence and F-Droid in sections 10–11). Binding inputs: [rules-core.md](rules-core.md) (goal, three principles, hard rules), [03-feature-analysis.md](03-feature-analysis.md) (the owner's design rules), [decisions.md](decisions.md) P8. A claim about the code cites the file or a probe (`tools/probes/`, its README; Appendix A); **(to verify)** marks what was not checked, with who checks it and how (Appendix C).*

How to read each area: **state** (verified), **decision** (one, with the reason), **alternatives** (one line each), **budgets and gates**, **risks**, **what would change it**. Section 8 has the component diagram, the interfaces and the budget table.

## 0. The decisions on one page

1. **One mark on every Home and CAS number:** `=` the decimal shown is the exact value; `≈` rounded, and every digit shown is right; `⚠` fewer reliable digits than asked, or a failed check. The engine supplies the facts, our formatter decides the mark for the format shown; a non-number that holds a float gets `⚠` (2.4, 2.3 #17).
2. **No digit is shown that the engine has not confirmed:** non-rational values are evaluated at two precisions and only agreeing digits are shown; a float from an unaudited function is `⚠`; inverse functions are substituted back like Solve roots (G44 for the inverse distribution functions) (2.4, 2.5).
3. **Digits up to 30**, working precision `max(30, digits+10)`, value precision `max(40, digits+10)` (2.5).
4. **Results are reused as chips that carry the full value**; Ans on Shift + `+`; an operator typed on an empty line starts with Ans, as on the reference (2.8).
5. **Copy gives the full value** (all confirmed digits, up to 40); "as shown", "exact" and LaTeX are in the Menu. Copy and Shift + Copy = Paste on one key (R15c; 2.6, 5.1).
6. **CAS floats are marked `≈` and formatted by us.** Typed decimals in CAS become exact, like Home (**P9, accepted by the user 2026-10-12**) (2.9).
8. **Find is one static index generated at build time** (Giac's English help lines, libqalculate's units, constants and prefixes, our alias file), searched by our own ranking code on the main thread, fetched when idle after the engine is ready and parsed on first open (section 3).
9. **Constants, units, prefixes and results enter the entry line as atomic MathLive macros** (`\const{ID}`, `\unit{ID}`, `\pfx{p}`, `\res{n}`, `\ans`), never as free text (3.6, 4.3).
10. **The unit view computes on Giac (P15)**, exactly, in the worker already loaded: each unit token (a Find id) becomes its exact SI factor from the Find index times base-dimension symbols. The evaluator refuses mismatched sums, absolute temperatures in arithmetic and functions of quantities with units (section 4).
11. **Keys:** Math = Find, Shift + Tmpl = the unit view (P11), View = results mode (P16), Copy | Paste on one key, Shift + View = Help, Shift + `+` = Ans; every cell in 5.1, every difference from the G2 and its reason in [06-keypad-vs-g2.md](06-keypad-vs-g2.md).
12. **State:** one IndexedDB store with a schema version; user definitions are persisted, so variables survive a relaunch (6.2).
13. **The Find index's constant values and unit factors** come from libqalculate at build time (7.1); P22 replaces the build with checked-in numbers (`find/factors.yaml`, A21).
14. **New gates:** an automated size test, the task benchmark, the Find query test, marks in the golden files, `units.yaml`, a per-key Find timing on the Tab One (7.3).

The top risks are in section 9.

---

## 1. The goal as a test

### 1.1 Definitions

**Efficient** means the fewest key presses and no waiting. It is measured by:

| Id | Measure | Budget | Enforced by |
|---|---|---|---|
| E1 | Key presses per task | each active task within its budget; a unit in ≤ 4 presses at the median (rule 2) | `tests/tasks/tasks.yaml` replayed by Playwright (EN0) |
| E2 | Enter → drawn result, Home and CAS | p95 < 150 ms on the Tab One | `?bench=1` on the device (annabell), each release |
| E3 | Find: key → updated list | p95 ≤ 16 ms on the Tab One | `?bench=find` (A4b), milestone 4 gate |
| E4 | Start | keyboard usable < 1 s, engine ready < 1.5 s on the Tab One | device runs (`tools/device_run.py`), each release |
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
What each module does for speed and trust, what is still open against the goal and what it costs, as of 2026-10-18: [research/r12-evidence.md](research/r12-evidence.md) section 5. The open points are backlog packages; the costs are 8.3's budgets.

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
Twenty-one paths (#1–#21) showed a wrong or unmarked number. Each became a regression case before its fix; all are fixed (#2's value polish by G44: the inverse distribution functions are solved against our MPFR forward functions, 2.4 rule 3 counts them audited for that input). Their lesson is 2.4. The list (input, what was shown, the right value with its `source:`, the fix) is [research/r12-evidence.md](research/r12-evidence.md) section 1, rows numbered as before: "2.3 #n" in the code and the golden files is row n there.

### 2.4 Decision: the mark and the agreement check

**The mark.** Shown before every numeric result in Home and CAS, small and muted, in the result's colour:
- **`=`** when all of these hold: the engine says the value is an exact rational (exact path, Giac returned `p/q`); the text shown in the current format is exactly `p/q` (our formatter knows: the `sticky` flag and the digits cut off); no input was inexact (a constant with a CODATA uncertainty, or a result chip whose value is not exact, 2.8). Examples: `1/4` → `= 0.25`; `0.1+0.2` → `= 0.3`; `1e300*1e300` → `= 1E600`; `1/4` in FIX 1 → `≈ 0.3`.
- **`≈`** for every other number, provided every digit shown is confirmed: `1/3`, `sqrt(2)`, `2^200` in STD, the float fallbacks, constants with an uncertainty.
- **`⚠ n`** when fewer than `digits` digits are confirmed: the result is shown with the `n` confirmed digits and the mark says so. Solve and analysis keep their existing ⚠ for a failed residual check.
- No mark for non-numbers (symbolic results), **unless they hold a float**: then `⚠` without a count, since nobody checked its digits (2.3 #17; principle 3 decides it: "flagged"). A check per float that could earn `≈` is not worth building until the `⚠` proves noisy in daily use. A list or matrix of numbers gets one mark, the weakest of its elements, and every element is formatted by our formatter.

Num tables and the Solve and analysis results show only `⚠` (a mark on every cell would be clutter; their view header says "rounded to n digits"). The existing "approximate" note goes away: `≈` covers it.

**The agreement check** (engine, `homeEval.ts`, `solve.ts` `numericResult`, `analysis.ts`):
1. An exact rational needs no check: BigInt is exact.
2. Any other value is evaluated at precision P = `max(40, digits+10)` and again at P + 20. The confirmed digits are the largest n at which both values, widened by their difference (plus one ulp), round alike (G2; stricter than "common digits less one" at ties). If fewer than `digits` agree, the check runs once more at P + 20 against P + 40. If they cover the shown digits, the mark is `≈`; otherwise `⚠ n`. A float from a function that is not audited shows `⚠` without a count (M4-5): two of Giac's routines can agree on wrong digits. The exact path runs at P too; a result that rests on a numeric decision (sign, comparison, floor, abs, max, piecewise; int, sum, limit, solve; a stored function) is decided again at P + 20, and if the texts differ, at P + 20 against P + 40; a decision P + 20 and P + 40 disagree on, or a tie at a cut Giac cannot prove, is refused (`error.undecided`), never shown (G57); one that cannot run again (`sto`, `=>`, `[a,b]:=`), or a proven tie with no value to put in its place, is `⚠` without a count (G38, G48).
3. A value that Giac's numeric code returned as a float on the "exact" path (the exact output is a float literal, as `normald_icdf` gives `-1.2815515655446`) is re-evaluated once with `Digits` on the other side of 14 (double ↔ MPFR) and compared the same way. If one side has no value (2.3 #5), the other side's digits are shown, at most 15 for a double. Such a value gets `⚠` unless every function in the input is on the audited list (tier 0, 3.3), because agreement between two of Giac's routines does not prove either right (2.3 #2). normald_icdf, student_icdf, chisquare_icdf and fisher_icdf are polished (G44, icdf.ts) and audited for an input whose every call converged at P and P + 20; otherwise they stay unaudited. Two-argument `round` and `trunc` compute in a double: unaudited (G71).

A number for something that does not exist (a principal value, an Abel sum) is refused by the cheapest necessary check (the term's limit, ∫|f| near a singular point); a check Giac's timeout stops leaves `⚠` (G39).

Cost: one more `evalf` for irrational results (each about 1 ms on the desktop, probe timings) and one more evaluation only for the rare float-returning inputs.

**Golden cases:** every numeric case in `home.yaml` carries its mark, checked by the gate (`oracle.py` checks that `=` appears exactly when the oracle value equals the expected text); `precision.yaml` holds the cases at 20 and 30 digits (`oracle`) and 2.3's regression list.

**Alternatives:** a mark from `approximate` alone (cannot tell 1/3 from 1/4); MPFI intervals (S20).

**Risk:** both evaluations wrong in the same way is not caught (2.3 #2; section 9 risk 1): until a function has passed the tier-0 audit, a float Giac's numeric code returned for it is `⚠`, never a bare `≈`.
**Would change if:** Tab One timing shows the extra `evalf` costing more than 20 % of Enter p95; then the check runs only above 15 digits and for float-returning inputs.

**Built in G3:** stored floats keep their facts in the defs log; a result that uses them inherits the weakest, checked by perturbation (M4-7). `evalf(e,n)`/`approx(e,n)` are rewritten to the check's precision, and n becomes the display digits in Home and CAS (M4-6; Home by the owner, 2026-10-13). Solve and analysis roots are compared after a second polish at W+20 (M4-8). A value that is 0 in every evaluation but not an exact rational shows `⚠` without a count, never `≈ 0` (owner, 2026-10-13: `exp(10^-70)-1`).

### 2.5 Decision: digits up to 30

- The setting allows 1–30; stored values from before stay valid (6.2 migration).
- Home's working precision is `max(30, digits+10)` (as Solve's) and the value precision P = `max(40, digits+10)`; `DECIMAL_KEEP` (`format.ts`) follows it, so rounding at 30 digits keeps 10 guard digits.
- `sigfig` and our other Giac definitions load on first use, not at engine start (G2).
- The agreement check (2.4) is what makes 20 and 30 digits honest: without it, 2.3 #3–#5 would go out unmarked.
- **Latency gate (Tab One):** p95 at 30 digits < 150 ms and ≤ 1.3 × the 12-digit p95, else the setting stops at 20. It holds (A4a, 2026-10-16), so the setting keeps 30; the desktop and device numbers are in [research/r12-evidence.md](research/r12-evidence.md) section 3.

**Alternatives:** keep 15 (engineers comparing with reference data need more); unlimited digits (the 40-digit value path and the screen width set a natural limit at 30).

**`sigfig(x,n)`** (EN3 d): an engine definition that rounds the exact value to `n` significant digits and returns an exact decimal rational, so `sigfig(1/3,3)` is `= 0.333`. The power of ten is found exactly (BigInt on the rational, not `floor(log10(…))`, which can land on the wrong side at 999.95). Golden cases at the boundaries: 999.95 at 4 digits, 0.0012345 at 3, negatives, ties.

### 2.6 Decision: copy and paste

| What | Copy (the Copy key; Menu 3) | Menu 6, Copy as › As shown | Copy as › Exact | Copy as › LaTeX |
|---|---|---|---|---|
| Home or CAS number | full value: every confirmed digit up to P (40), trailing zeros dropped, `.` (`,` with the decimal-comma setting), plain for 1E-4 ≤ \|x\| < 1E21, else `d.ddd…E±k` | display text, without the mark | Giac's exact text when it exists (`1/3`, `sqrt(2)`) | the result LaTeX |
| Complex | `a+b*i`, each part as above | yes | yes | yes |
| List, matrix | `[a,b]`, `[[a,b],[c,d]]`, elements as above | yes | yes | yes |
| Solve root, analysis value | full value | yes | — | — |
| Num table | CSV (Menu, Export): header row with the function names, full values, `.` and `,` as separator (`;` with decimal comma) | — | — | — |
| Units result (m5) | `20 m/s`, `39.5±1.2 m^2` (value full, uncertainty 2 significant digits) | yes | `(1397/3125) m/s` | yes |
| Session (Menu, Share) | text: one line per entry, `input = result` with the mark, full values | — | — | — |

**Paste** (Shift + Menu, or Menu → Paste): the clipboard is read as one number (`-1.5`, `1,5` with decimal comma, `1.5e-3`, `1.5E-3`, `i` parts); it enters as the keyboard's own LaTeX (`1.5\emark-3`, drawn `1.5ᴇ-3`), so the parser sees only what our keys produce. Anything else gives the message "Paste: not a number". Pasting a result copied from Pascaline gives the same value back (P5).
**Mechanics:** `navigator.clipboard` in a secure context (Capacitor serves `https://localhost`): the Tab One's WebView 131 denies `readText` and has no `navigator.share` (A4a), so the APK gets `@capacitor/clipboard` and `@capacitor/share` (A11); the PWA keeps `navigator.clipboard` and `navigator.share` where it exists, else copy. Files go out through the native `save` (`ACTION_CREATE_DOCUMENT`) in the APK and `<a download>` in the PWA, and come in through `<input type="file">` (R11).

**Alternatives:** copy the displayed text by default (hides digits, against principle 3); copy the exact form by default (`1/3` pastes badly into spreadsheets and code).

### 2.7 Decision: SI prefix display, and prefix entry

- **Display:** a format `PFX` beside ENG: `n` significant digits as in ENG, the exponent replaced by f p n µ m (none) k M G T P (10⁻¹⁵ to 10¹⁵); `µ` is U+00B5. Outside that range, ENG E notation. Built (R3): mantissa, thin space, the prefix as `\class{pfx}{\mathrm{k}}` in the accent colour, so `1.5 m` (milli) does not read as metres; ENG and PFX keep trailing zeros to n digits (`2.500 k`); in Settings and the Format key cycle; copy gives the full value, never the prefix text; unit tests per prefix boundary and rounding into the next prefix (999.96 k at 4 digits → 1.000 M).
- **Entry (gated by benchmark task 3):** only through a prefix chip `\pfx{k}`. Letters typed with Alpha stay variables (`4.7k` parses as `4.7*k`: probe), so a variable `k` and the prefix k never collide. Parser rule: a numeric literal directly followed by `\pfx{X}` becomes the exact `(literal*10^e)`; `\pfx` anywhere else is a parse error. One round-trip case per chip.

### 2.8 Decision: reuse through chips and Ans

- **Result chip `\res{n}`:** tapping a history result, or Up then Enter, inserts a chip drawn as the number shown. Each history item stores `full`: Giac's exact text when the result is exact and ≤ 2 kB, else its confirmed decimal. The parser turns the chip into that text (exact rationals for decimals). In Home a result chip that is not exact goes to the engine by name (`pasr_<k>`, Ans as `pasr_ans`) with its confirmed decimal and facts (`chipFacts.ts`), kept with the history entry, and counts as a stored float (M4-7); a value stored from an inexact input keeps `inexact` facts though it prints exactly, and a result from an inexact chip or constant is never an exact chip. Its facts (exact, confirmed digits, warn) travel through Ans, a chip and Store: a result computed from a chip whose value is not exact (an irrational result carried as digits, a constant with an uncertainty) cannot be `=`; a chip that carries an exact value keeps the result exact, so `1/3` (shown `≈ 0.333333333333`) tapped `×3` is `= 1` (2.3 #8; user, 2026-10-12, M4-4).
- **Ans:** `\ans` is the view's last result, inserted by Shift + `+` (the reference's position). Ans is resolved at Enter from the view's last history result (its chip value), not from Giac's `pasans`/`pcasans`, so it survives a Cancel (worker restart) and a relaunch (R2).
- **Operator on an empty line:** `+ − × ÷ xʸ x² x⁻¹` on an empty entry line insert `\ans` first, as the reference does. `(−)` stays negation. This saves a press in every chained calculation; benchmark tasks measure it.
- A value that leaves its evaluation (stored, Ans, a chip, an export) is the value shown, independent of the angle mode (G34). Since G46 its exact text is radian text, which means the same in every mode, so it stays exact.
- A stored name takes the facts of what its input read, and a run-once result that rests on a decision is ⚠ (G48). Names stored and read come from Giac's state; the text decides only if an input runs once (G65).
- A CAS result without a float that read a stored name, or called a function, with facts takes their mark (`warn`, `why.inherited`); one built from exact names stays unmarked (G51).

**Alternatives:** insert the full digits as text (40 digits clutter the line); keep inserting the rounded digits (2.3 #8).

### 2.9 Decision: CAS

- A CAS result that is a number with a float gets its mark from our formatter (`≈`, or `⚠` by 2.4), and a symbolic result with a float gets `⚠` (2.4; 2.3 #17); numbers are drawn by our formatter at the digits setting (`CasResult` gains the numeric value when the result is a number, 8.2); its text and LaTeX come from `numeric`, never Giac's float. Exact CAS results get no mark, unless they read stored facts (2.8). An explicit precision (`evalf(x,50)`) is honoured: that many digits, only the confirmed ones (M4-6).
- **P9 (accepted by the user, 2026-10-12):** typed decimals in CAS become exact rationals before evaluation, as in Home (`toExactLiterals`); `approx()` (Shift + Enter) gives decimals. This removes 2.3 #6 at the source (the mark alone would show `≈ 1.7763568394E-15` for `1-0.9-0.1`: marked, but not right). The visible change: `1.5x` shows as `3/2·x`, where the reference CAS keeps `1.5·x`. The `bench` stage of the golden gate runs in CAS mode, so its decimal inputs are re-checked.

### 2.10 Python
Removed with the app (P11, 2026-10-13).

### 2.11 Risks and what would change it
- Marks add a little text to every line. If the owner finds them noisy on a device, `=` could become the absence of a mark, keeping `≈` and `⚠` (one setting, no architecture change).
- Correlated errors in Giac's numeric routines: section 9 risk 1.

### 2.12 Decision: the angle mode (S14, route R)
Giac runs with `angle_radian:=1` in every view and mode, and the degree mode lives in the text our parser emits:
- each angle function the user types takes its argument times `pasdeg` (`sin(pasdeg*(u))`);
- each inverse, and `arg`, returns its result over it (`asin(u)/pasdeg`);
- the polar entry's angle carries it, and the ° template is `u*pi/180/pasdeg`; `polar_coordinates` and `instfreq` answer over it and the one-list `rectangular_coordinates([r,t])` takes its angle times it (decisions "2026-10-19 R64", R64f1);
- the host sets `pasdeg` to π/180 in DEG and 1 in RAD when the mode changes, and `pasdeg` is a reserved name. The rule is one table, `app/src/input/angles.ts`, shared by the emitter and `rewriteAngles`.

Every Giac path (exp, the hyperbolics, complex trig, inverse trig, integration, desolve, laplace, limit, series, complex powers) therefore sees radians. A stored value is angle-free text. A typed or library function keeps `pasdeg` in its body, so it follows the mode at call time. A chip carries Giac's radian text, which means the same thing in both modes. The plot multiplies by the same factor (R64a). In DEG the CAS view, and a Home result that is not a number, show the result as the mode reads it: Giac evaluates the text with each `trig(u)` taken as trig of u·180/π and each inverse as π/180 times the inverse, so `diff(sin(x),x)` shows `pi/180*cos(x)` (`engine/degrees.ts`). Ans and chips keep the radian text. Previews, Vars and the library export drop the factor, and a library import puts it in. Stored logs older than DATA_VERSION 3 are migrated (`engine/angleMigration.ts`). Evidence: [archive/r14-angle-mode.md](archive/r14-angle-mode.md).

---

## 3. Find (EN1)

### 3.1 State
- Vars and Math do nothing until R4a and R4b; Tmpl opens the template palette (R10). Lists open on the sheet (`app/src/views/Sheet.svelte`; docs/05 3.1).
- Any `\operatorname{name}\left(…\right)` reaches Giac as `name(…)`, so inserting a function needs no new parser rule.
- **The index exists** (G4; generator `tools/find-index/generate.mjs`, sources and schema in 3.3; ranking `app/src/find/rank.ts`, `prepare()` and `search()`): its size and the query score are in 8.3, the item counts and the prototype's timing in [research/r12-evidence.md](research/r12-evidence.md) section 6.

### 3.2 Decision: where it runs
**Main thread.** 1.2 ms per key on the desktop leaves room for a 10× slower Tab One inside 16 ms; a worker would add a message round trip per key. **Gate:** `?bench=find` replays 50 queries one character at a time, timing key → list rendered; p95 ≤ 16 ms on the Tab One (annabell). If it misses, first filter incrementally (each key narrows the previous candidates), then move ranking to a worker.

### 3.3 Decision: the index

**Schema** (one JSON array; ids are stable and become the token IDs; the type is `FindItem` in `app/src/find/types.ts`): `id` (`fn:stddev`, `const:c`, `unit:km/h`, `pfx:k`, `tmpl:…`), `kind`, `names` (what a user may type, searched in lower case), `title` (English; other languages in overlay files keyed by id), `desc` (one line: ours for tier 0, else Giac's English help line or qalc's title), `syntax` and `example` (functions), `value` and `unc` (a constant's exact decimal text and its standard uncertainty, absent when exact), `unit` (a constant's), `dim` (the dimension key, 4.3), `si` (a unit's exact factor to SI base as p/q; an offset for °C and °F), `tier` (0: curated, audited, ranked first; 1: documented only) and `insert` (the LaTeX the entry line receives).

In the index file a tier-1 function has no `insert` (G4, the user's choice of 2026-10-13); `prepare()` fills in `\operatorname{name}\left(#0\right)` at load (saves about 70 kB raw), so `FindItem.insert` stays required after loading. A unit whose qalc factor is uncertain or approximate (the list: [r12](research/r12-evidence.md) section 2) keeps `dim` and has no `si`; where qalc's data is wrong, `find/units.yaml` gives our exact factor as an `override` (G13: hp, mmHg, inHg and 13 CODATA 2022 constants), and the build fails once qalc agrees.

Live items (variables, user functions) have the same shape with `kind: "var" | "userfn"`, built at run time (3.4).

**Format and size:** `find-index.<hash>.json`, a Vite asset outside every chunk. Budget ≤ 400 kB raw, ≤ 100 kB gzip (8.3). **i18n:** English titles and descriptions in the index; another language is an overlay file `find-index.<lang>.json` keyed by id with its own titles and aliases, merged at load. The structure allows it now; only English ships.

**Generation, from source at build time** (gorge; `tools/find-index/generate.mjs`, Node, no network; run by `build.sh` after the engines, and by `npm run index` in development; output gitignored under `app/src/find/_gen/`):
1. Giac `doc/aide_cas` from the pinned tarball: names, the English line (`2 …`) only, never French (R5), syntax and examples; entries starting with `_` dropped.
2. libqalculate 5.13.1 `units.xml.in`, `variables.xml.in`, `prefixes.xml.in` from the pinned tarball; `currencies.xml.in`, `elements`, `planets`, `datasets` skipped.
3. **Values from the built qalc engine run in Node:** each constant's value, uncertainty and unit; each unit's SI factor; a round-trip check that every unit and constant ID parses back to itself. The check is needed: qalc misreads common names (`mu0`, `degC`, `BTU`, `h`: [r6](research/r6-pipelines.md) section 6).
4. Our own files: `find/aliases.yaml` (what users type and the data lacks, such as `kph`, `eps0`, `degC`; per item id), `find/functions.yaml` (tier 0: each function with our own one-line description and the id of its golden accuracy case) and `find/units.yaml` (our overrides and the common prefixed units as items: `km`, `MPa`, `kΩ`, …).

**Tier 0** is the audited set: every tier-0 function has a golden case at 12 digits against the oracle, including the edges of its domain (where 2.3 #2 was found), and, for a function defined on complex numbers, complex arguments in RAD (G50: `tools/probes/complex-audit.ts`, 12 arguments at 12, 30 and 50 digits; Giac's complex tanh, asin, acos, atan and acosh are replaced by our definitions). Complex arguments in DEG are not audited (S14). Tier 1 is everything else Giac documents, ranked below tier 0 and labelled "not checked" in the preview.

**When it loads:** fetched when the browser is idle after the engine is ready (the same hook as the service worker registration in `main.ts`), parsed on the first Find open; if Find opens first, it fetches then. Never in the start chunk (size test).

**Licences:** 7.2 (Giac's English lines under P10, confirmed by B. Parisse on 2026-10-19); the About screen credits Giac and libqalculate.

**Alternatives:** generating at run time (start-up, memory); committing the generated JSON (not our source for F-Droid; P22's `find/factors.yaml` is the audited source, not output).

### 3.4 Live entries
The engine host reports the name each stateful input defines (`defined: {name, kind}`, from `:=` and ▶). The session keeps `userNames` (name, kind, formatted value preview, view, time), read through `Calc.names()` from the persisted defs log (6.2), so Vars works after a relaunch. Find merges them at query time; a library function brings its one-line `desc` (G33).

### 3.5 Ranking
No usage boost (P11), so the same query always gives the same order (docs/03 rule 8); with an empty query Find shows the G2-style Math menu (fixed categories, fixed order). Our own code (`app/src/find/rank.ts`, built in G4). Order (numbered as in `rank.ts`; (1) was the usage boost): (2) exact match of a name, symbol or alias; (3) prefix of one, shorter first; (4) word prefix inside one (`_`, space); (5) word prefix in the title or description; (6) one edit away (insertion, deletion, substitution, transposition) for queries of 4+ characters. Ties: tier 0 first, then the context's kind (variables in Vars, units in a unit slot), then the shorter name, then id. Nothing is stored.
**Alternatives:** uFuzzy, fuzzysort, Fuse.js (they know none of our tiers or kinds).

### 3.6 Insertion and tokens
- MathLive macros on the entry field, all `captureSelection: true, expand: false`, so the cursor cannot enter a chip and `getValue()` keeps the macro (R2: `entry/macros.test.ts`, `app/test/chips.spec.ts`): `\const{ID}`, `\unit{ID}` (unit view only), `\pfx{p}`, `\res{n}`, `\ans`. The chip macros take a second argument that is only what they show: `\res{k}{shown LaTeX}`, `\const{ID}{symbol LaTeX}`; a macro definition cannot look up a value, so the display travels in the LaTeX and the value in the chip table. A Find item's `insert` for a constant is `\const{ID}{symbol}`, ID being the item id without `const:`.
- **Parser:** `\const{ID}` becomes, in Home, CAS and Solve, the constant's exact value as a rational literal (`299792458`, `(667430/10^16)`), and the parser reports `inexact` when the constant has an uncertainty, so the result is `≈` (2.4). In the unit view it is a `pask<j>` placeholder (R28, G16); R40 sends an inexact constant to `home()` as `pasc_<id>` with its σ (G26). **Chips carry their own values:** an inserted `\const` chip copies its value and uncertainty from the index into the entry's chip table, which each history item stores beside the entry LaTeX; the parser reads the table, never the index, so parsing stays synchronous and a recalled entry needs no index load, and it shows `G`, not 6.6743E-11.
- Functions insert `\operatorname{name}\left(#0\right)` (`#0`: a selection becomes the argument, R17); templates insert their LaTeX, each with a parser rule and round-trip case.

### 3.7 Keys inside Find
Every key types its Alpha letter in lower case (no Alpha press); Shift + key types the key's primary character (digits, `.`); the space key types a space; ⌫ deletes; ▲▼ and the trackpad move the selection; Enter inserts; Esc closes. Vars opens Find filtered to variables; ⌫ on an empty query removes the filter. Digits do not pick, unlike the other sheets, because queries need them (`g0`, `log10`, `e24`).
**Keystroke budget:** an item used before: Math, first letter, Enter (3 presses); a new one: Math, the letters, Enter. Benchmark task 5 checks it.

### 3.8 The query test
`tests/tasks/find-queries.yaml` (`query`, `expect` id, `note`), run by Vitest against the generated index and the real ranking (`app/src/find/queries.test.ts`). **Gate:** every phrase in the top 3, at least 90 % first. It holds 100 active phrases (25 constants, 40 units, 5 prefixes, 30 functions; `newton`, `kb`, `db` are ambiguous on purpose) and 10 `pending` ones for milestone 6. The owner adds a phrase whenever Find misses one.

### 3.9 Budgets, risks, would change
Budgets: 8.3. Risks: alias quality (only the query test and real use show it); the chip look (screenshot test). Would change if the Tab One misses 16 ms (incremental filtering, then a worker), or the index outgrows 100 kB gzip (split functions and units into two files).

---

## 4. Units: the unit view (EN2, P3 as amended by P8, P11 and P15)

There is no separate Units app (P11): units are added *after* the formula, in unit slots, in the unit view opened by the units key (decisions.md P11 and S1; layout and press counts in `docs/archive/r7-unit-slots.md` and `docs/archive/r9-unit-pad.md`). **P15 (decided 2026-10-14; G15's check passed 2026-10-15):** Giac does the unit arithmetic in the worker that is already loaded, with the Find index's exact factors; libqalculate is used only at build time, as the index's source. Our parser decides what reaches Giac, and the evaluator checks the result.

### 4.1 Evidence: units on Giac (G15's probe, 2026-10-15)
G15's probe (`tools/probes/units-giac.mjs`) computed the spike's cases, the tasks and S1's 50 units exactly in Giac with the Find index's factors, in one call of median 0.5 ms on the desktop. It agreed with qalc 5.13.1 except where qalc is wrong (`hp`, `mmHg`: oracle) or gives no error (`1 m + 1 s`). The table and the units refused for want of an exact factor (`nofactor`): [research/r12-evidence.md](research/r12-evidence.md) section 2.

### 4.2 Decision: the unit evaluator on the Giac worker (P15)
There is no third worker. The unit view's arithmetic is a `units` request in worker 1, beside `home`, so Cancel works as in Home: terminate, respawn and replay the definitions. The factor table (units' `si` and `dim`, prefixes' powers of ten) comes from the Find index. It loads with the unit view, never in the start chunk.

The evaluator (`app/src/units/`, G16):
- substitutes each slot's tokens by factor × dimension symbols and evaluates exactly with `normal()`;
- checks for one term: each exponent d·∂f/∂d / f must be a number;
- converts to the end slot, where the quotient must be a pure number;
- returns a `Quantity` whose mark comes from Home's facts and `markOf()`. An irrational value goes through the agreement check.
- The input is R24a's tokens per slot and the formula with `pasu<n>` per slot and `pask<n>` per constant; the request is built into Giac text on the main thread, so only text reaches the worker. The dimension symbols are positive (√(m²) = m), and the dimension is checked per term before the numbers go in; a result 0 keeps the unit of its terms.

sin, cos and tan take an angle or a pure number; the angle dimension is dropped inside them. Any other function of a quantity with units is refused. On top of this come G17's rules for temperatures and logarithmic units, and G18's and G41's uncertainty (σ² = Σᵢ (∂f/∂xᵢ)² σᵢ² + Σᵢ Σⱼ [½ (∂²f/∂xᵢ∂xⱼ)² + ∂f/∂xᵢ · ∂³f/∂xᵢ∂xⱼ²] σᵢ² σⱼ², GUM 5.1.2 with its note, with Giac's `diff` at the inputs' values; σ carries ⚠ "first order does not hold here" when the second-order part is more than 10 % of σ², and ⚠ "the interval reaches a singular point" when an input's x ± 2σ reaches a point where ∂f/∂x is not defined; a Monte Carlo check (GUM Supplement 1) is not built: cos X with X ~ N(0, 0.1²) has the exact spread 0.0070358300299 against the formula's 0.00707106781187): the formula writes an uncertain number as `pasupm(value,sigma)` (two plain numbers, σ a standard uncertainty in the unit of the slot after it, each one an independent input); the builder turns each into a symbol (`UnitJob.unc`), and a result with a σ is never `=`.

### 4.3 Decision: the unit view (entry, parsing, results)
- **Entry (P11, P14; layout in `spec/unit-pad.yaml`, press counts in docs/archive/r9-unit-pad.md):** the units key (Shift + Tmpl, a flick up on Tmpl) on an entry line or a picked history row shows the same formula, read-only, with an empty unit slot after every number and an optional end slot "→ should be"; on an empty line one slot (quantity 1) and the end slot. ◀ ▶ jump between slots, never through the formula. In a slot the maths rows are the unit pad's prefix and unit cells drawn over the keys (R21's layer; S5's arrangement and 18 user slots), the number keys are prefixes, a slot holds unit ids, never text; Enter goes to the next slot and evaluates in the end slot; Math opens Find on units. Built on MathLive's prompts (a read-only field with `\placeholder[id]{}` per slot): prompts round-trip every slot shape, but `insert()` outside a prompt still edits the formula and MathLive merges neighbouring upright names (probe: [r6](research/r6-pipelines.md) section 7, "Prompts in a read-only field"). So a slot's tokens live in R24a's model, never read back from the field, and the unit view writes a slot only with `setPromptValue`, never through `EntryController.run` (5.5).
- **Grammar per slot:** a product of factors with `×`, one `÷` (the rest is the denominator), powers, `x⁻¹`, `√`. The formula comes from the parser's units mode (R28): a prompt after a number is pasu<n> in the order written, a constant is pask<j>, `±` after a number is pasupm(value,σ), and `\to` before the last prompt is the end slot. A factor is one symbol from Find's unit list: an exact symbol first, then prefix + symbol. The parser in `units` mode emits unit and prefix ids from these whitelisted names only (the generator's round-trip check, 3.3). **Alternative rejected:** qalc's own parser, which reads `BTU`, `lbm`, `var`, `Kg`, `pa`, `G` as other things (docs/archive/r7-unit-slots.md section 5.2).
- **Live reading:** under the slot, in words; a prefixed unit outside Find's common list is marked; a factor that is no symbol is an error naming it with the near symbols. A prefix alone is an error.
- **The evaluator checks:** the formula with its units must give a single term (number × units), else "Units don't match: L vs T" naming the term (P11); an absolute temperature in arithmetic → "Use K or Δ°C for a temperature difference"; with an end slot, a dimension mismatch is an error naming both.
- **Result:** value (exact fraction or P-digit decimal) through our formatter at the digits setting, the mark by the 2.4 rules from the same engine facts as Home, the unit drawn upright, the dimension as `L·T⁻¹`. With an end slot: in that unit. Without: in the units typed when they fit the result's dimension (so a torque stays `N·m`, SI would say `J`), else SI with an SI prefix (2.7); one tap gives the SI base form and the last unit used for that dimension (IndexedDB `units.targets`, `{dimKey: unitId}`).
- **Temperature:** `°C` and `°F` alone carry their offset; inside a compound unit they are an interval (G37: `J/(kg·°C)`, `°C⁻¹`; 1 °C = 1 K, 1 °F = 5/9 K). Alone they are absolute (`20 °C → °F` = 68, `derived`); other differences are `K`, `°R`, or the Find aliases `Δ°C` (of K) and `Δ°F` (of °R). Golden cases for each, and the rejected `20 °C × 2`.
- **Logarithmic units, angles, currency:** as before (conversions only for dB, dBm, Np; `rad` stays in the dimension key, and an angle is a quantity both ways: sin, cos and tan take an angle (a bare number in the mode's unit), asin, acos, atan and atan2 give one (in rad, shown without an end slot in the mode's unit, ° in DEG and rad in RAD); an end slot one rad apart from the result converts with the note "rad = 1 dropped" unless rpm, rev or Hz is on either side (G32's refusal stays), and rpm or rev times a dimension other than time keeps its value with the note "rpm counts turns: the speed at radius r is 2π·r·n" (G40); currencies off, with the index test). dB, bel and Np convert by the field-ratio rule (1 Np = 20/ln 10 dB, 1 bel = 10 dB); dBm and dBW by the power ratio to 1 mW / 1 W; the message is `dB converts only`.
- **The way back:** the result inserted into Home is a `\res` chip with the number in the unit shown; the chip's label says the unit was dropped. The line itself keeps its slots, so the units key shows them again.

### 4.4 Budgets and gates
No engine chunk: the unit view's UI chunk (≤ 30 kB raw) and its factor table from the Find index load on the first press of the units key, never at start; a Playwright test asserts that neither is requested in a session without it. First result < 1 s on the Tab One; desktop p95 ≤ 5 ms per evaluation (G15: 1.5–3.2 ms). Also: `units.yaml` in the golden gate; **a unit in ≤ 4 presses at the median** (`tools/probes/unit-presses.mjs`, then the same list as an e2e replay); benchmark tasks 1–4 and 10 within budget (plans from S1: t02 12, t04 13); the owner's hand timing (rule 2).

Open points for milestone 5 (each with a default): r7 section 7.

### 4.5 Risks, would change
Risks: a wrong factor that G13's audit against CODATA and the exact definitions missed; a long CAS job delays a conversion until Cancel. Would change if the owner, after using the unit view, wants `5 km + 300 m` in Home (P8: the same worker behind a setting; the token design already supports it).

---

## 5. Keyboard and entry

### 5.1 Decision: every cell P8 touches, and every free cell
Positions use our rows and columns (`spec/keyboard.yaml`); the reference's id is in brackets (`spec/mapping/vc-2026-10-11/keys.yaml`). "Built" names the package; the rest is planned. Rows 0–2 are R3 (decisions.md "R15c", built in R15c2).

| Key | Decided | Source and why |
|---|---|---|
| Math (row 3, col 1) [r4c2] | Find, everything (R4a) | P8 |
| Shift + Math | Memory: Find on variables and user functions, with delete and "clear all" (R4b) | reference: Mem |
| Vars (row 3, col 0) [r4c1] | Find, filtered to variables (R4b); Shift + Vars unassigned (Find covers named symbols) | P8 |
| Tmpl (row 3, col 2) [r4c3] | the 6 × 3 template palette, picked by arrows, Enter or a tap (built, R10; r8 rule M1) | P8, P11 |
| Shift + Tmpl | the unit view (unit slots) | P11; reference: Units |
| The letters A–Z, `#`, `:`, `;` (Alpha layer, flick down) | **stay**: Find's keyboard (3.7), names, CAS symbols, hex digits A–F (5.4); not the unit slots (P14) | decisions.md "The letters stay" |
| Alpha key [r8c1] | one-shot Alpha with lock flicks; stays its own key (P7 point 4, owner 2026-10-19; reopens if Alpha taps fall near zero) | P7 |
| a b/c (row 3, col 4) [r4c5] | toggles the last result's form: decimal ↔ fraction, polar ↔ rectangular (built, R10) | G2 item 29, P12 |
| Exponent key (row 6, col 0) [r7c1] | types the mark `ᴇ` (`\emark`, one token); Shift = Sto ▶ (built, R14) | P12 |
| Rows 0–2 | R3 (built, R15c2): U1–U6 in columns 0–1; the round pad (one drag surface, a dashed hub, no OK) in columns 2–3; View \| Esc, Undo \| Copy, ⇤ \| ⇥ in columns 4–5. Apps, Mode, the views, Menu: the status line (R15c1) | P12, S2, R15c |
| Alpha + 0 (quote); Shift + ◀ ▶ (line jumps) | removed (R13); the jumps came back as ⇤ ⇥ (R15c2) | P12, R15c |
| Shift + 6, Shift + 9 | the G2's palettes: relations and logic; symbols and Greek with `!` and ∞ (built, R18) | P12 |
| View (row 0, col 4) [r2c4] | results mode: the keypad collapses to a slice (P16, R53); Shift = Help (milestone 6); both dead and dimmed until built | P7 point 5, P16, R15c |
| Esc (row 0, col 5) [r1c5] | stops a running job, closes Settings, goes back one sheet level, drops a picked row, else clears the line; also the hardware Escape; Shift = Clear (R15c2) | reference; R15c point 3 |
| Undo (row 1, col 4) | undo; Shift = Redo; dead without an entry line (R15c2) | P13, R16, R15c |
| ⇤ ⇥ (row 2, cols 4–5) | the start and end of the line; Shift: the start and end of the box the cursor is in; dead without an entry line (R15c2) | R15c |
| Copy (row 1, col 5) | Copy, Shift = Paste (built, A3; on its own key since R15c2): the picked row's or the last result's full value | reference; R15c |
| ☰ on the status line (the G2's Menu key [r3c4]) | app menus; Home/CAS: one numbered list of nine on the picked row, else the last result (built, R11; decisions.md S2); R53 makes item 6 Plot | P8, S2, S9 |
| Shift + View (Help) | context help: the Find preview of the function before the cursor; with none there, Find (milestone 6) | ours; P8 left Help free |
| User keys | U1–U6, all empty, with tap and Shift (built, R15c2; stored slots of U1–U3 stay valid); Alpha with R15c3; set from Find (R4b) | R15b, R15c |
| Shift + `+` [r10c5] | Ans (`\ans`, built, R2) | reference |
| Shift + `−` [r9c5] | Base: the last result in HEX, BIN, OCT, DEC; word size (EN6) | reference: Base |
| Shift + 5 [r8c3]; Shift + 8 [r7c3] | `[ ]` vector or matrix template (EN5); `{ }` list (built, R54) | reference |
| Shift + 4 [r8c2]; Shift + 7 [r7c2] | the matrix editor (EN5); the list editor, deferred with Statistics | reference: Matrix, List |
| Unit slots | the unit pad (`spec/unit-pad.yaml`, docs/archive/r9-unit-pad.md): prefix and unit cells over the maths rows, S5's arrangement, 18 user slots; Enter to the next slot, `→` the end slot. Until R24c, `spec/keyboard.yaml` `unit_slot:` holds S1's letters | P11, S1, P14 |
| Unassigned Shift cells (11 since R15c2: Shift + ▲ ▼ ◀ ▶, Vars, a b/c, `( )`, `,`, 1, 0, Fmt) | they get the functions the task benchmark shows are pressed most, not a list made in advance | decisions.md "The letters stay" |
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

**State:** the key path step by step is [r6](research/r6-pipelines.md) section 1; the box model, its tests and the unit view's field as read on 2026-10-15 are [research/r12-evidence.md](research/r12-evidence.md) section 4.

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
- **Decision (P18, 2026-10-20): Giac evaluates, our own layer decides** what is shown: the agreement check, decisions at a higher precision, refusals, marks and the facts of stored values (2.4, 2.8). No other engine answers at run time: libqalculate feeds the Find index's data, mpmath and Giac's own parse check at test time. Typed input reaches Giac only through our parser; every other way in (a library, the definitions log, a chip's full value, a backup) is Giac text. Its core (`numeric.ts`, `host.ts`, `homeEval.ts`) is 3,074 lines on `da7a59c`, 4,555 with `converge.ts`, `solve*.ts` and `format.ts`; 56 of the 100 non-merge commits on `master..da7a59c` that touch `app/src/engine` are fixes. Its rules: Giac's flags restored after every input (G67); a fix at the cause, a Giac patch where the cause is local there (P19); a register of our workarounds with canaries (S17). Evidence: [archive/multi-engine-answer.md](archive/multi-engine-answer.md) section 0.
- **Decision (P20): one reader of Giac text.** Code that reads Giac text (names, calls, brackets, top-level arguments, bound variables) uses `app/src/engine/giacText.ts`, property-tested against Giac's own parse (a `sommet`/`feuille` walk of `quote(…)`) on every golden input and every text Giac prints for it; new code adds no bracket loop or name regex (G73, G74; before R59).

### 6.2 Decision: one storage plan
One IndexedDB database `pascaline`, store `kv` (`state/storage.ts`). Keys:

| Key | Holds |
|---|---|
| `settings` | `schema: 2`, digits ≤ 30, format (`std`, `sci`, `eng`, `fix`, `pfx`), fixDecimals, fmtCycle, entry, haptics; later the decimal comma (R57, schema 3) and the base word size; each field validated on restore (`migrateSettings`, `state/session.svelte.ts`) |
| `view`, `place`, `entry` | the open view and app; the half-typed line (R34) |
| `history` | ≤ 200 items per view, with `full` (≤ 2 kB) and the mark facts |
| `defs` | the definitions log (`engine/defs.ts`; `:=`, ▶, `purge`): per name its kind, commands, mark facts, preview, view, time; ≤ 500 lines. `restore()` replays values, assumptions and typed inputs; a function (one balanced command) stays pending until `need()` loads it (G83): pending names that are words in the input, then, transitively, those in each loaded body or stored value it reads, in one batch (G29's fall-back); `VARS`, `expr`, `rm_all_vars`, `restart` load all; redefining or purging a pending name drops it. **Variables are kept as their value**, not their command (G3): `B:=romberg(…)` is stored as `B:=(evalf(<exact>,k))`; functions and `assume` keep their command; symbolic values replay first; a library function keeps its `desc` (G33, `DATA_VERSION` 2) |
| `defsStarts` | starts that began the replay and never got ready; at 2 the engine starts without the log (G19) |
| `userKeys`, `taps`, `app.function`, `app.solve` | the user keys' slots; R9's Shift/Alpha tap counter; per app (R53 adds `uses`, its counters) |
| `units.targets`, `units.history` | the last target per dimension; the unit view's history (milestone 5) |

**Every value is stamped** with `DATA_VERSION` (`storage.ts`): `{ "@pascaline": n, value }`; a value without the stamp is version 0. On read, the steps in `MIGRATIONS` for that key run from its version up, and the value is written back stamped. Raise the version with a step whenever a stored shape or the meaning of stored Giac text changes (a parser rename such as Φ → `Phi_` rewrites the stored `defs`). **Replay budget:** 8.3 (`replayMs`, inside the engine-ready bar).

**The backup** (R11, `archive/r11-files.md`): one JSON file, each key's record as stored with its stamp (`defsStarts` left out); a restore checks the whole file, refuses it on the first fault (newer format or part, broken stamp, unknown part, a validator fault), then replaces the ticked keys in one transaction, keeps the replaced records in `backup.undo`, and reloads.

### 6.3 Decision: start-up and bytes
- The sizes and budgets are in 8.3. New code for Find, units, copy and the matrix editor lives in lazy chunks, and so do every Settings page, sheet and the first-start tips (owner, 2026-10-20): the start chunk takes only what draws the first screen, key handlers and marks (≤ 175 kB, ≤ 60 kB gzip; owner, 2026-10-19).
- **The size test** (A1): `app/scripts/size-check.ts` reads Vite's manifest and fails when a chunk passes its budget; `npm run build` and `build.sh` run it.


---

## 7. Build, licences, F-Droid, tests

### 7.1 Decision: build order
`build.sh`: fetch (SHA-256 checked) → Giac (container, P2) → **qalc** (`engine/qalc/build-wasm.sh [dev|release]`, release in the same pinned trixie container; GMP and MPFR tarballs shared with Giac) → **Find index generator** (Node, from the unpacked tarballs and the qalc build) → app build (size test) → Capacitor → Gradle. `--no-units` skips qalc; the index then holds functions only and Find still works. `npm run index` in development does the same when no qalc build is present, with a warning. Everything generated stays out of git; F-Droid's recipe mirrors `build.sh` and gains the libxml2 and libqalculate tarballs with their SHA-256. Build time with qalc (A2, 2026-10-12): the release container build of qalc takes 7.5–8 min; the wasm is 949 kB brotli and byte-reproducible; nothing of it ships (P15). **Why qalc is built:** the index takes constant values, uncertainties and unit factors from it (3.3 step 3). **Alternative:** values from the oracle venv (not part of `build.sh`, a second source of truth). **P22 (2026-10-20):** the numbers move into `find/factors.yaml`, one checked-in source; `tools/find-index/refresh-factors.mjs` rebuilds qalc only when a developer runs it, and `build.sh` loses the qalc step (A21; the F-Droid recipe follows after F-Droid's answer). **The Giac pin (P21):** Parisse's numbered Debian archive `giac_<version>-<n>.tar.gz`, its SHA-256 from the `.dsc`, our mirror as fallback (G77); the snapshot pinned today was re-published upstream on 2026-10-15, so only our mirror still serves it.

### 7.2 Licences
Every piece and its licence is in [THIRD_PARTY.md](../THIRD_PARTY.md): libqalculate 5.13.1 (GPL-2.0-or-later, build time only, P15: its data ships in the Find index, its code not), libxml2 (MIT), Giac's English `aide_cas` lines (GPL-3.0-or-later, R5) in "Find index data". All are compatible with GPL-3.0. `@capacitor/share` and `@capacitor/clipboard` 8.x (MIT) join it with A11's code; Find's search is our own code.

### 7.3 Decision: tests and gates

| Gate | What | Blocks |
|---|---|---|
| typecheck, Vitest, e2e | as today | every merge |
| Parser round trips | every new template, chip and token, in the same commit | every merge |
| Golden gate | interrupt, home (with marks), **precision** (new), solve, function, bench, parser, **units** (new, m5) | every merge that touches engine-side code; every engine build that ships |
| Core list (P23) | `tests/core/core.yaml`: everyday key sequences, value and mark, in e2e (R74) and on the Tab One (A32, A33) | every merge; nightly on the Tab One |
| Task benchmark | `tests/tasks/tasks.yaml`, active tasks within budget | every merge from milestone 4 on |
| Find query test | `tests/tasks/find-queries.yaml`: all in the top 3, ≥ 90 % first | every merge that touches the index, aliases or ranking |
| Size test | budgets in 8.3 | every build |
| No-lazy-load test | Home, CAS, Function and Solve never request `qalc.*`; the Find index is not requested before the engine is ready and the browser idle | every merge (from the milestone that adds each) |
| Device bars (Tab One) | start, Enter p95 at 12 and 30 digits, Find per key, Units first result, memory | each milestone and release (annabell) |
| Reproducibility | two release builds give the same `giac.wasm` and `qalc.wasm` | each release |

The gates per milestone are the backlog's milestone lines.

**What the gates serve: the mark never lies** ([R16](archive/r16-verification.md)). No test proves Giac right, so principle 3 is tested as one property that needs no hand-written expected value: every digit under `=` or `≈` is right, `⚠ n` has n right digits, a number appears only where a value exists, an answer or a refusal comes within the budget. Six checks give each result a second source: (1) an oracle sweep of generated keyboard LaTeX, judged by mpmath (G61); (2) sequences: a line's value and mark depend only on the names it uses (G43, G62); (3) one value in Home, CAS `evalf`, Num, Plot and Solve (G63); (4) CAS answers checked back (G64, open); (5) Giac's `check/` suite on our builds (A19, open); (6) the golden stages on the phone (A20). The generators stay in the gate (fixed seed); the full pass (S16) repeats at each milestone close, before each outside round and before a release. **What users do, end to end (P23):** the core list replays everyday key sequences, value and mark, on desktop and on the Tab One: the freeze's gate; the sweeps' extreme-input finds are a background stream.

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
- **Units** (`app/src/units/types.ts`, the fields there): `UnitRequest` (our parser's formula with `pasu<n>` per slot, `pask<n>` per constant, `pasupm(value,sigma)` per ±; the slots, constants and end slot) → `UnitJob` (Giac text, every unit as factor × dimension symbols, built by `units/build.ts`) → `Quantity` (value as a `HomeResult`, dimension, unit, σ) or `UnitError` (its kinds and `unitErrorMessage()` in `units/messages.ts`).
- **Find** (main thread): `FindItem` (`app/src/find/types.ts`, the schema of 3.3); the planned `FindIndex` with `load(lang?)` and a synchronous `search(query, ctx)` within 16 ms (R4a).
- **`Kv`** (`state/storage.ts`): `get`, `set`. **`ClipboardPort`** (`app/src/clipboard/port.ts`): `writeText`, `readText`, `share` (false when the platform cannot share; then copy); A11 adds the Capacitor plugins behind it.

### 8.3 Budgets

| Item | Budget | State | Enforced by |
|---|---|---|---|
| Start chunk | ≤ 175 kB raw, ≤ 60 kB gzip | 56.00 kB gzip on `05b250c` (2026-10-20; R15c1 +0.27, about +0.3 per UI package, so the cap is ~13 packages away); `tools/probes/start-chunk.mjs` lists the bytes per source; every UI package reports its delta | size test |
| MathLive chunk (after the keypad) | ≤ 830 kB raw | 807.74 kB (2026-10-18) | size test |
| Find UI chunk | ≤ 30 kB raw | — | size test |
| Find index asset | ≤ 400 kB raw, ≤ 100 kB gzip | 325.7 / 67.1 kB (2026-10-15) | size test (once Find loads it) |
| Unit view chunk | ≤ 30 kB raw | 9.44 kB (2026-10-18) | size test (rule on `src/units/`) |
| Precache total | ≤ 18 MB | 12.4 MB (2026-10-18) | size test |
| Keyboard usable / engine ready (Tab One) | < 1 s / < 1.5 s, with the `defs` replay | 722 / 1103 ms cold (2026-10-19, `874ab01`, 1 GB engine); 1489 ms engine ready with 200 definitions (A4a, 2026-10-16) | device runs |
| Enter → result p95 (Tab One) | < 150 ms at 12 digits; at 30 digits ≤ 1.3 × the 12-digit p95 | RAD 138.4 ms at 12, 135.2 at 30; DEG 150.4 and 160.4 (A16, 2026-10-19, before G53; A4a: 138–160 and 147–149) | device runs |
| Find key → list (Tab One) | p95 ≤ 16 ms | desktop prototype p95 1.04–1.23 ms | `?bench=find` (A4b) |
| Find open | ≤ 100 ms warm, ≤ 300 ms cold | — | device runs |
| Units first result (Tab One) | < 1 s | — | device runs |
| Unit evaluation (desktop) | p95 ≤ 5 ms | median 0.91 ms, p95 ≈ 2 ms (G16) | the golden units section |
| `defs` replay | ≤ 50 ms at 200 definitions | 158 ms (A12, Tab One); a 200-program library 403 ms; G83: functions on first use | device runs |
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
The probes behind this document are in `tools/probes/` (its README says how to run each): `engine.ts` (Home and CAS paths through `EngineHost`, `FACTS=1` for the facts), `parse.ts` (the parser), `digits-cost.ts`, `units-giac.mjs` (G15), `find/` (the index prototype), `start-chunk.mjs`, `bound.ts`, `replay-cost.mjs`, `unit-presses.mjs`, `results-geometry.mjs`. What they found is in [research/r12-evidence.md](research/r12-evidence.md); oracle values come from mpmath in `tests/golden/.venv` (the expressions: r12 section 1).

## Appendix C: open items (to verify), who, how

| Item | Who | How | Decides |
|---|---|---|---|
| Find per-key time on the Tab One | annabell (A4b) | `?bench=find` | main thread or incremental/worker (3.2) |
| The stacked unit's height in a prompt | ron (R24c) | gallery at 360 × 740 | the row height of the unit view |
| Units first result on the Tab One | annabell (m5) | device run of the unit view | the lazy-load bar (4.4) |
| The library replay after G83 on the Tab One | annabell | `?bench=library`, seven cold starts | 6.2's budget; R59's gate (decisions.md G33) |
| A fresh-clone `build.sh` time with qalc | annabell | `./build.sh` from a clean clone | 7.1 |
