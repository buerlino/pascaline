<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Bug patterns: every bug found so far, grouped by how it happens

**Status (2026-10-20): evidence record; open rows rechecked on `da7a59c` in [the consolidation report](../shifts/2026-10-20-sandra-consolidation-report.md) (a).** N1 and N2 are backlog F52; each family's question is a proposed reviewer checklist for brief §8a (the consolidation report (c)); the leads feed the proposed G61–G64.

*Written 2026-10-19, evening, by Claude (Opus, the owner's session; read and probe only) on `phase-1` `0bd9631`. The owner asked for every bug found and fixed, or still open, grouped so that the groups tell us where to look for the next ones. Sources: the 1063 commits on `phase-1` and the other branches (every `fix` commit, and the fix rounds inside feature merges), docs/backlog.md and its archive, feedback.md, docs/04 2.3 with [r12-evidence.md](r12-evidence.md), the check notes of 2026-10-18 and 2026-10-19, [r14-angle-mode.md](r14-angle-mode.md), [r16-verification.md](r16-verification.md) (untracked), the open package files and the shift reports. Rows come from those sources, where each was verified when it was found. The two rows marked **new** come from probes I ran today (section 4).*

**Id notation.** F1–F43 are feedback and backlog bugs. "§2.3 #n" is row n of docs/04 2.3 (r12-evidence section 1). "chk n" is finding n of [check-2026-10-19.md](check-2026-10-19.md). D1–D12 and E1–E12 come from the two deep checks. "n18" and "n19 2.x" are the night checks of 2026-10-18 and 2026-10-19. "r16-F1"–"r16-F7" are the sweep of r16-verification.md, renamed here because F1–F7 are already feedback ids. SB1–SB4 are the solver bugs, L8 and L9 the parser gaps of milestone 2. A package id with f1, f2 is a fix package that an Opus pass asked for after the merge.

## 1. The families on one page

| # | Family | Fixed | Open | What found most of them | The question to ask of new code |
|---|---|---|---|---|---|
| 1 | A carried value loses its facts | 15 | 5 | deep checks, Opus passes | Does every way a value leaves a line keep its mark, digits, σ and angle? |
| 2 | Settings read at evaluation time | 5 | 7 + 1 new | cross-night check, deep check, angle matrix | Does this text mean the same thing under every setting, now and after a relaunch? |
| 3 | Numeric decisions made at too few digits | 9 | 1 | architecture checks, deep check | Does a sign, floor, comparison or branch rest on a float? |
| 4 | Two evaluations that share one error | 6 | 6 | architecture check, complex sweep, oracle sweep | Can both precisions take the same wrong path, or hide the same double? |
| 5 | Giac answers that are not a plain value | 12 | 3 | deep check, early milestones | What does Giac return when there is no number, or two? |
| 6 | Our own numeric and display code | 4 | 5 | Opus passes, oracle sweep | What happens at a huge exponent, a tie, zero digits confirmed? |
| 7 | The line computes something other than it shows | 16 | 4 | owner, deep-dive review, probe grids | Is there a product, a grouping or a sign that the drawing does not show? |
| 8 | One rule in two places | 7 | 3 | night checks, Opus passes | Where else is this rule written, and do the two agree? |
| 9 | Our helper names and rewrites leak or collide | 6 | 4 + 1 new | Opus passes, library probes | Can a user see, type, export or overwrite one of our names? |
| 10 | ⌫, Del, cursor and taps inside templates | 12 | 1 | owner, probe grids | Has the new template been through the ⌫, Del, ▶ and tap grids? |
| 11 | Async edges, lifecycle, keys at the wrong target | 21 | 4 | owner, probe grids, reviews | What happens if a key, a hide or a kill arrives before or after its consumer? |
| 12 | Units and uncertainty | 11 | 6 | Opus passes, deep check | Does the rule hold on the output side, at zero, at an offset, at a stationary point? |
| 13 | Cost and budgets | 3 | 7 | device runs, night check | Measured against a fixed baseline, or only against the parent commit? |
| 14 | Tests and gates that let bugs through | 9 | 9 | Opus passes, night checks | Which generator would have caught the last bug? |
| 15 | Pipeline, tools and build | 19 | 2 | night checks | Is it quoting, a path, shared state between worktrees, a cap, or an unchecked claim? |
| 16 | Conventions that look like bugs | — | 9 decided or asked | S12, G2 checklist | Is our choice written down, with the G2's and Giac's beside it? |

In all, 224 rows outside family 16: 155 fixed and 69 open or proposed, 2 of them new today. A row can hold several commits (a bug and its review fixes). A bug that fits two families is counted once, where its cause is; the other family has a row that says "see family n".

**Five causes sit under most families:**
1. **Hidden global state.** Giac's `angle_radian`, `Digits` and now `approx_mode` (families 2, 3); our chip tables and counters (1, 11); the shared `app/node_modules` and dev server port (14, 15).
2. **Glue that works on text.** The text helpers (`namesIn`, `functionsIn`, `simpleAssignment`, `complexReads`) and our rewrites (pasexp, pasmod, complexSafe, restoreLiterals, pasdeg) each miss the forms they do not match (1, 2, 8, 9). `numeric.ts` doubled in one night, and the night's bugs sat in these helpers (n19 3.4).
3. **One rule written twice.** The parser and the plot evaluator, the parser and raw Giac text, the Find index and the unit evaluator, the session's chip rule and the golden runner's, the key face and the key action (8).
4. **Edges between asynchronous parts.** Lazy chunks, the engine start, IndexedDB writes, MathLive's 60 ms timer, the app going away (11).
5. **MathLive's own editing model.** Each atom kind deletes and moves in its own way, and a half-deleted line is often valid LaTeX with another value (10).

**The testing lesson.** Every golden and e2e case was one input in one setting until G34. The state and carrier bugs (families 1 and 2) all need a sequence, and none was found by a per-package audit. Mechanical checks found what reviews missed: a 30-input before/after battery found G50's lost digit, which had passed five audits (n19 2.4); the first RAD/DEG invariant run found two bugs in 169 inputs (E10); a 1152-evaluation complex sweep found D6, D9 and D10; an hour's oracle sweep found r16-F1–F7.

## 2. How to use this note

- **To hunt:** pick a family and run its hunt list (the last part of each family below). Section 4 ranks the leads I would run first.
- **When a bug is found:** add its row to its family, or start a new family. Then answer r16 section 4's question: which generator should have found it? Extend that generator.
- **Before a package touches a family's code:** read the family's rows. Most fix chains (G49 needed four follow-ups, G38 two, G50 one) were the same pattern met again in a form the first fix did not match.

## 3. The families

### 1. A carried value loses its facts
**Pattern.** A value leaves the line it was computed on (a stored name, Ans, a tapped `\res` chip, a constant chip, a function body, the defs log). It keeps its text but loses some of its facts: exact or not, the confirmed digits, the ⚠, the reason, the σ. A ⚠ value then comes back as `≈` or `=`. Each fix closed one carrier, and the next carrier had the same hole.

| Id | What the user saw | Cause | Status |
|---|---|---|---|
| §2.3 #8 (R2) | `1/3`, tap, `×3` = 0.999999999999 | the chip carried the rounded digits | fixed R2 `ab71d62` |
| M4-7 | a cancellation through a stored float lost digits unmarked | stored floats kept no facts | fixed G3 |
| SB4 | `[romberg(…),1/3]` showed 1/3 with ⚠13 | every list element took the weakest mark | fixed G5 `c4998f4` |
| R16 hazard | undo brought back a chip with no value; a new `res:1` got another value | `clear()` wiped the chip table and restarted its counter | fixed R16 `a352c11`, `690a5bf` |
| F28, §2.3 #15 | after Home `3 ▶ x`, CAS `int(x^2,x)` = 9x, no sign of the stored x | Home and CAS share one Giac context | fixed G20, R32; G28 `79e8b0f` and `a58c2e6` (names the input binds) |
| F37, §2.3 #18 | `2^10000` tapped `×1` = `= 1.99…E3010`; `+3` after it gave 3 | a result over 2 kB lost its chip, and Ans was dropped | fixed R44 `f170d20` |
| M4-10 | a Solve root's ⚠ was gone after a reload | the warn flag was not stored | fixed R19 `e51e922` |
| G22, G22f1 | the why-line missing or present without a ⚠ | the reason was not carried through the perturbation check | fixed `01bfafc`, `fdd5d42` |
| D1 | romberg `⚠ 0.74682413281`, then `Ans−0.7468241328124` = `≈ −4E-13` (right: 2.7E-14) | a chip carried Giac's printed float and only `exact` | fixed G49, R65 `7215682` |
| D2 | `normald_icdf(0.025)` ⚠, `Ans·1000`, `Ans÷1000` = `= −1.95996398454` | `fullExact` ignored `inexactInput` | fixed R65 |
| D3 | `A:=G·2`, then `A÷2` = `= 6.6743E-11` | Store kept facts only when the text printed a float | fixed G49 |
| G49f1 | a function built from an inexact chip or constant: its call shows `=` | the function entry kept no facts | fixed `109d485` |
| G49f3 | a function whose body names a stored inexact value | the call did not read the facts of the names the body holds now | fixed `d4004c9` |
| G49f4 | the same through an arrow `f:=x->…` | the arrow form was not matched | fixed `3db5a51` |
| G50f1 | a stored name holding `tanh(i)` gave Giac's wrong tanh | stored names were not read through our definitions | fixed `f0d8eed`, `37eb796` |
| G49f2 | the golden runner built chips another way than the session | see family 8 | fixed `1065c70` |
| n19 2.2 | `[q1,q2]:=[F,1]` = `=`; `q5,q6:=F,1` unmarked; `F=>pE` = `=` (F = `floor(sin(10^100)*10^12)`, wrong) | run-once inputs skip G38's second decision | **open G48** (running, branch `p1/gorge-m4-runonce`) |
| n19 2.2 | `pA:=F`, `pu:=unapply(x+pA,x)`, `pu(0)` = `=` | `unapply` writes the value into the body, so no name is left to read | **open G48** |
| n19 2.2 | `sto(…)` runs twice and is not in the defs log (inferred) | `sto(` is not in `STATEFUL` | **open G48** |
| G49f3 open item, n19 2.7 | CAS `pA`, `pA+1`, `pf(0)` show 899450126402 unmarked | a CAS result with no float takes no stored facts | **open G51** |
| n19 2.7 | CAS `w:=tanh(i)`, `g(x):=tanh(x)+w`, `evalf(g(i))` = ⚠ 0.9·i | CAS does not read a called function through our complex definitions | **open G56** |

**Hunt.** Test every pair of carrier and fact as a sequence (G62 in r16).
- **Carriers:** `:=` and ▶, Ans, a `\res` chip, a `\const` chip, a function (Home, CAS, arrow, `unapply`), multiple assignment, `=>`, `sto`, Home ↔ CAS, the Solve app's stored unknowns, a Function Num cell, copy and paste, history recall (▲), undo, the defs replay after a relaunch, library export and import (R59), the backup (R38b), the unit view's `\res` chip back to Home (S11).
- **Facts:** exact, confirmed digits, warn, why, inexact input, σ (`uncDigits`), the angle mode at store time.
- **Cells nobody has probed** (suspects, not findings): a Solve root with ⚠ read from Home; "copy as shown" of a ⚠ value, pasted, becomes an exact typed decimal and later lines show `=` (a decision is needed); library export writes no facts, so an imported inexact value comes back exact (inferred from `library.ts` export); undo of a line whose chip's row was deleted; a function redefined after another function captured it.
- **The mechanism lead:** S13 (read the stored names from Giac's `VARS()` before and after a line, instead of from the line's text).

### 2. Settings read at evaluation time (hidden global state)
**Pattern.** Giac reads a global flag when it evaluates, not when the user typed. A text that is right in one setting is wrong in the other, and Giac's own rewrites (exp, cosh, `re`/`im`) carry the flag into paths that never mention an angle. The same applies to every Giac flag a user can reach (row **new N1**).

| Id | What the user saw | Cause | Status |
|---|---|---|---|
| R10 | DEG `sin(30°)` was the sine of 0.52° | the ° template always multiplied by π/180 | fixed R10 (`x*(pi/180)^angle_radian()`) |
| F29, §2.3 #16 | DEG `exp(i*90)` = `= i` | Giac reads exp's argument in degrees | fixed G21 `cfa8b74`; G21f1 `724e9c0` hides the helper name |
| chk 1 | `TH:=atan(3/4)` in DEG, then RAD: TH = 0.6435 | the stored exact text is read again in the new mode | fixed G34 `c92cd5a` |
| chk 2 | `A:=e^(i·90)` in DEG reads wrong in RAD and in an export | pasexp's text is right only in DEG | fixed G34 (the value); pasexp goes in G46 |
| D8 | Function app in DEG: the curve in radians, Root and Extremum in degrees | the JS plot had no angle input | fixed R64a `86d9e2e` |
| chk 3 | Home DEG `∫₀⁹⁰ e^(i·x) dx` = `= 1+i` | Giac builds exp(90i) itself and reads it in degrees | **open route R** (R64 → G46) |
| chk 4 | `gr(x):=e^(i·x)` typed in RAD or imported, then DEG `gr(90)` = `= i` | the rewrite reaches typed text only; import runs in RAD | **open route R** |
| D4 | DEG `cosh(90i)` = `= 0`; Solve `cosh(i·x)=1/2` gives x = 60, "checked by CAS" | Giac turns cosh(i·b) into cos(b) and reads it in degrees; the check uses the same flag | **open route R** |
| D5 | DEG `cos(30+i)`: Home and CAS `evalf` give different values | Home reads `re()`/`im()`, which convert half the argument | **open route R**, G2 item 63 |
| D6 | DEG `acos(2)` = `≈ 9.09E-13+75.456…i`, "39 digits confirmed" | inverse trig converts in double (the same 2⁻⁴⁰ at every Digits) | **open route R** |
| D7 | DEG `int(1/(1+x^2),x)` = 180/π·atan(x); `desolve`, `laplace` wrong; `limit`, `series` refused | Giac's tables and solvers were written for radians | **open route R** |
| D12 | DEG `(−8)^0.2` and CAS `(−32)^(1/5)` wrong | Giac builds the trig of a complex power itself | **open route R** |
| chk 7 | `pasexp(` in the exported library file | see family 9 | **open G46** (migration) |
| r14 §3, §5 | (with route R) the kept `==` text shows `cos(1*pi/7)`; a user's `pasdeg:=5` makes `sin(x)` into `sin(5x)` | see family 9 | **open R64** |
| **new N1** | CAS `approx_mode:=1` (or `cas_setup(1,…)`): CAS `1/3` and `int(x^2,x,0,1)` give 0.333333333333; Home `1/4` loses its `=`; the line is stored and replayed at every start; `approx_mode:=0` afterwards returns 1 and stores `approx_mode:=(1)` | the host resets `Digits` and the angle per call, but not the other `cas_setup()` fields, and the defs log stores a Giac flag as a user variable | **new**, no package (section 4) |

Checked and right today: `Digits:=5` typed in CAS does not leak into Home (the host sets it per call); `complex_mode:=1` and `epsilon:=0.001` changed no Home result I tried (**verified**, section 4).

**Hunt.**
- **Every Giac flag:** the twelve fields of `cas_setup()` (approx_mode, complex_variables, complex_mode, angle_radian, the float format, epsilon and proba_epsilon, Digits, the series limits, increasing_power, and the rest), and `assume`. For each: can a line set it (CAS, Home, a Find insert, a library), does the host reset it per call, does the defs log store it?
- **Our own flags:** `pasdeg` (route R), `pasinexact` (R18f1), `realOddRoots`, the session's chip table.
- **Invariants (G43):** an angle-free input gives the same value in RAD and DEG; every input gives the same shown digits at 12 and 30 digits; a line gives the same value before and after an unrelated store or a settings line.
- **Coverage:** 26 of 1124 golden cases run in DEG, none of them CAS (r14 §3).

### 3. Numeric decisions made at too few digits
**Pattern.** Inside an "exact" evaluation, Giac decides a sign, a comparison, a floor or a branch with floats at the current `Digits`. The text it returns then looks exact or plausible. The agreement check re-evaluates that text, so it confirms the wrong decision. The trigger is a value whose double is badly wrong: trig of a huge argument, a near-integer, a cancellation past 15 digits, or a value exactly on a cut.

| Id | What the user saw | Cause | Status |
|---|---|---|---|
| §2.3 #6 | CAS `1-0.9-0.1` = 1.7763568394E-15; `1e16+1-1e16` = 0.0; `evalf(sin(10^22))` = −0.5476 | binary floats; a double at 12 digits | fixed (P9: exact decimals in CAS; marks in CAS) |
| G3 rule | `exp(10^-70)-1` could show `≈ 0` | 0 at every precision but not exact | fixed G3 (⚠, never `≈ 0`) |
| G23 | `sin(10^100)` = `⚠ -0.4` (the digit was wrong) | the check stopped at P + 40 | fixed G23, G23f1 |
| F35, §2.3 #19 | `cos(π/7)−cos(2π/7)+cos(3π/7) == 1/2` = `= 0` | Giac's structural `==` | fixed R18f1, R18f2 (float sides decided twice), R18f3 |
| E1 | `sign(sin(10^50))` = `= 1`; `abs(sin(10^50))` negative; floor, max, piecewise wrong | decisions at `Digits` = display digits | fixed G38 `4e55a0d` and its two fix rounds |
| G38f1 | the same through a stored function, a CAS assignment, a run-once call | the second decision skipped these paths | fixed `2e1a762`, `034476a`, `65b51e5` |
| SB1 | Solve: "no root found" for a good root of a degree-25 polynomial | the residual check too strict at 12 digits | fixed G5 `efc52a1` |
| SB2 | Solve: no root for `(x-1/3)^4=0` | Newton on a multiple root | fixed G5 |
| SB3 | Solve: guess 15.33 returns 3.333…, not 46/3 | sign tests at too few digits | fixed G5f1 `86ac6d0` |
| m2 | linear systems broke | see family 5 (`0.-000`) | fixed `7a7a4e7` |
| n19 2.8 | `floor(cos(pi/7)-cos(2*pi/7)+cos(3*pi/7)+1/2)` = ⚠ 0 (exact 1) | on a cut no precision decides; G38's second round shows Giac's guess | **open G57** (refuse) |
| n19 2.2 | run-once assignments keep an undecided `=` | see family 1 | **open G48** |
| D4 (Solve) | the substitution check confirmed a wrong root | it substitutes in the same engine with the same flag (see family 2) | route R; lesson for every check-back |

**Hunt.**
- **Every decision Giac makes:** sign, abs, floor, ceil, round, trunc, frac, max, min, comparisons, piecewise, when, ifte, sort, iquo, irem of floats, and the sign tests inside int, sum, limit and solve.
- **Arguments that fool a double:** trig of 10^k for k ≥ 17, near-integers such as e^(π√163), cancellations past 15 digits, sums that are exactly a cut (1/2, 0).
- **Every path that runs once:** list `STATEFUL` and every input form the host classifies as run-once, and check each one against G38's two decisions.

### 4. Two evaluations that share one error
**Pattern.** The agreement check runs one Giac path at two precisions. When that path holds a double, a wrong branch or a wrong formula, both runs agree on the same wrong digits. This is docs/04 section 9's risk 1. It shows up at functions without an MPFR path, at complex arguments, at branch cuts, and at real arguments with complex results.

| Id | What the user saw | Cause | Status |
|---|---|---|---|
| §2.3 #2 | `normald_icdf(10^-10)` wrong from the 8th digit, unmarked | Giac's two evaluations agree on 9 digits | mark fixed `715e1e8` (⚠ unaudited); **value open G44** |
| §2.3 #3 | `UTPN(10)` at 30 digits wrong from the 17th | cancellation in `1-erf` | fixed (agreement at P, P+20, P+40) |
| §2.3 #4 | `romberg(exp(-x^2),x,0,1)` at 30 digits wrong from the 17th | Giac's routine | ⚠ until audited (M4-1) |
| §2.3 #5 | `BesselJ(1,2)` above 14 digits shows the input as text | no MPFR path | fixed (a 14-digit fallback with ⚠) |
| D9 | `tanh(i)` = −0.642·i (that is coth) | Giac's complex tanh | fixed G50 in RAD (our definition); DEG via route R |
| D10 | `acos(1+i)` at 30 digits: 14 right digits under `≈` | complex inverse trig has no MPFR path | fixed G50 |
| D11 | `≈` on wrong digits for audited functions | the audit list is by name, not by domain and mode | fixed in part G50 (`complex-audit.ts`: 0 gaps in 720 rows) |
| r16-F2 | `√(√(asin(12)))` = `≈ −1.3194−0.3764i` (right: +1.3194) | Giac's symbolic `re()` takes the other branch | **proposed G59** |
| r16-F3 | `(sin(3.7)−e)^(0.001·asin(6.02ᴇ8))` wrong from the 4th digit under `≈` | Giac's exact path for a negative base to a complex power | **proposed G59** |
| r16-F4 | `log10(asinh(asin(e)))` at 30 digits wrong from the 14th under `≈` | complex asinh of that argument is a double; G50 audited 12 arguments | **proposed G60** |
| r16-F5 | `⚠ 14` where 12 or 13 digits are right (`asin(sinh(π))·e^(44.4)` and four more) | asin and acos of a real \|x\|>1 return a double; outer functions amplify it | **proposed G60** |
| r16-F6 | `√(asinh(cos 10))` shows a real part 4.7E-15 under ⚠ 13 | Giac's sqrt of that value; every digit of the real part is noise | **proposed G60** |
| n19 2.7 | CAS stored tanh, see family 1 | | **open G56** |

**Hunt.**
- **Functions with a hidden double:** if `evalf(f(x),30)` and `evalf(f(x),60)` print the same double digits, there is no MPFR path. Candidates: Bessel and Airy, complex inverse trig and asinh, complex Gamma, zeta, erf of complex, LambertW, the incomplete gamma, hypergeometric, polylog. Also the functions that return floats on the exact path (normald_icdf, romberg, nInt, fsolve).
- **Branch cuts:** asin and acos at \|x\| > 1, acosh at x < 1, atanh at \|x\| > 1, log and sqrt of negatives, negative bases to non-integer powers, nested roots, and `re()`/`im()` of composed functions. Compare each with `evalf` first and split after (G59's guard).
- **Wider audits:** generated complex arguments near the cuts, not 12 fixed ones (G61's sweep).

### 5. Giac answers that are not a plain value
**Pattern.** The marks assume a result is an exact number or a float with digits. Giac also returns a convention where mathematics has none (a principal value, an Abel sum), a pair `[exact, numeric]`, unevaluated text, special words, odd float prints, and functions that differ from the textbook (median, round).

| Id | What the user saw | Cause | Status |
|---|---|---|---|
| E2, §2.3 #20 | `int(1/x,x,-1,1)` = `= 0`; `sum(cos(k),k,1,inf)` = `= −0.5`; `int(tan(x),x,0,pi)` = `= 0` | principal values and Abel sums returned as values | fixed G39 `cadfb33`, `ee654cd`, `bedb558`, G39f1 |
| E6, §2.3 #21 | a two-element list `[…, 1.35506364264]` | Giac's [exact, numeric] pair when its own check fails | fixed G39 (one value, ⚠) |
| E9 | `limit(sin(x),x,inf)` = `bounded_function(2)` | an unevaluated Giac word | fixed G39 ("No limit") |
| F36, §2.3 #17 | `evalf(x+sin(10^22))` = `x-0.54764225985`, unmarked, every digit wrong | a non-number holding a float had no mark | fixed G27 `ac749f1` (⚠) |
| m2 | linear systems broke | Giac prints negative zero as `0.-000` | fixed `7a7a4e7` |
| D10 | `asin(i)`: a real part `0.-000…` the formatter could not read | the same print | fixed G50 |
| m2 | the Solve info line held binary noise | | fixed `7a7a4e7` |
| m3 | CAS showed `x×x` as "xx" | `x*x` stays unless `regroup()` | fixed `d1e9c7e` |
| m3 | complex results printed `1*i` | | fixed (ron-fmt) |
| C9, G14 | `mod(7.5,2)` = 1.5 marked `≈`; then `x\bmod 3` = `x` marked `=` | Giac's irem on a non-integer; the first fix missed `\bmod` | fixed G14 `f9f7a49`, G14f1 `63d6d29` |
| R19 | `mod(7,3)` was an error | Giac has no `mod(a,b)` | fixed `adb5eca` (irem) |
| E7 | `median([1,2,3,4])` = ⚠ 2 (right: 2.5); `percentile` unevaluated | Giac's convention | fixed G42 (ours), G42 fix 1 `9cc5a3f` and G42f1 `8d82436` (refuse a matrix and non-real elements) |
| r16-F7 | `asin(acos(π²))` shows the input; `√(asinh(asin(3.7)))` = `undef`; 34 overflows show symbolic text | lost answers: neither a number nor a refusal | **open** (a new G2 question: what an overflow shows) |
| n19 2.5 | raw `median([1,2,3,4])` = 2 in a library body | see family 8 | **open G54** |
| E7 | `round(-2.5)` = −2 while the display rounds −2.25 to −2.3 | two tie rules on one screen | **open G45** |
| E7 | Giac's `stddevp` is the sample deviation and `stddev` the population one | names | **open** (R4a's Find titles) |

**Hunt.**
- **A census of output shapes:** run every Find tier-1 function (about 1,270, "not checked") on standard arguments and sort the outputs: number, symbolic, list, `undef`, `infinity`, `bounded_function`, unevaluated call, `[exact, numeric]`, `0.-000`, "Bad Argument Value", `rootof`, `piecewise`, assumptions. Every shape that is not a number or a plain symbolic result needs a refusal or a mark. Do it before R4a makes these functions one tap away.
- **Conventions:** list every function whose result depends on a convention (median, quartiles, stddev, mod, irem, iquo, frac, floor of negatives, arg on the cut, round ties) with Giac's, the G2's and ours (S12 has 44 rows).

### 6. Our own numeric and display code
**Pattern.** `format.ts`, `numeric.ts` and the plot evaluator are pure code that nobody fed extreme input: a huge exponent, a short double, every decimal zero, a complex number whose parts differ by many orders.

| Id | What the user saw | Cause | Status |
|---|---|---|---|
| G31 | FIX 4 showed 4.7E-6 as 0.0000 | FIX had no fallback | fixed `ed665c6` (to SCI); G31f1 `88d9cd9` (the fallback showed unconfirmed digits) |
| G36, chk 8 | FIX: `0.01+1.23E-4*i` with one digit confirmed | lowering `fixed` for one part pushed the other into the fallback | fixed `9a8d720`; fix 2 `de990b1` (cap sciDigits) |
| G23f1 | a row with no confirmed digit inserted a digit as its chip | | fixed `b0ec2eb` |
| n19 2.1 | `round(12.345,2)` = ≈ 12.4, `trunc(2.567,2)` = ⚠ 2.6 (20 minutes on phase-1) | G50's `shortDigits` trusted a short double print one digit less | fixed G42f1 `efefbf6`; **guard cases open G47** |
| r16-F1a | Home never answers `exp(1.5ᴇ8)` or `√(e^(2ᴇ8))` | `confirmedDigits` builds m·10^e as a BigInt at the full exponent (`format.ts:486`, since `715e1e8`) | **proposed G58** |
| r16-F1b | DEG `acos(x)` for x ≥ about 10^200 never answers | `floatsShown` runs `regroup` (`numeric.ts:147`, G38f1), which Giac's timeout does not stop | **proposed G58** |
| r16-F1 | `exp(10^7)` takes 2 s, `factorial(10^6)` 4 s, against 300 ms | | **proposed G58** |
| docs/04 2.4 | `tieRisk` is computed and never read | dead code | open (drop when `homeEval.ts` is next touched) |
| R66 note | plot of `x^(1/3)` would lose its left half (NaN) without `realOddRoots` | the plot evaluator is a second implementation in doubles | kept by R66's scope; `x/x` at 0 leaves a hole (r16 2.3) |

**Hunt.**
- **Property tests on the formatter:** every format (STD, FIX, SCI, ENG, PFX) × digits 1–30 × confirmed n 0–30 × values at ties, at 10^±300, with complex parts far apart. The shown significant digits are never more than n, and a nonzero value never shows as 0.
- **Mutation testing** on `format.ts` and `markOf` (r16 section 3).
- **A size bound on every JS step over a Giac result:** grep for BigInt, `regroup`, string building and loops whose length is the exponent or the text length.
- **The plot evaluator against Giac** on every keyboard function (G63).

### 7. The line computes something other than it shows
**Pattern.** The 2D line looks like one expression and the parser reads another: a hidden product, an operator that went into an exponent, a key that took only part of what stood before it. These are the most dangerous entry bugs, because the line looks plausible.

| Id | What the user saw | Cause | Status |
|---|---|---|---|
| §2.3 #1 | keys `0 x F F` gave 0 (0·x·F·F) | `0x` with letters read as a product | fixed R2 (an error) |
| L9 | ÷ right after a fraction, root, power or mixed number divided only its last part | | fixed `d4a44ad` |
| L8 | x² after a compound term squared only its last part | | fixed `4d9c3a1` |
| M4-2 | `2.2E-9 × 4.7E3` typed with the keys gave 2.2E-42300 | the × went into the exponent of ×10^ | fixed R3 `220890d`; then the ᴇ key (R14) |
| feedback #37 | `1+2` selected, then x², gave 1+2² = 5; abs replaced the selection | a selection was not the argument of every key | fixed R17 `b9d9e9c` |
| m1 | `\pi \cdot x` became `\pix` | a command glued to a letter | fixed `015980a`; the same when joining a fraction, `2cba743` |
| m3 | the polar sign was swallowed by ÷; Shift + Enter's ≈ never reached the engine | | fixed (p1/ron-p4b) |
| F22 | `5 10ˣ 2` = 510² = 260100; `5 DMS 2` = 52° | 10ˣ and DMS joined the number before them | fixed R27a `59a5ae8` |
| F23 | the cursor between sin and `(`: a 7 there gives sin 7(2) = sin 14 | MathLive stops there | fixed R27b; the parser refuses it (`9ce7566`); R27c `9abac9d` (a key took its neighbour's style) |
| F24, §2.3 #11 | `2.5.3` = 0.75 | a second decimal point was a product | fixed R29 `9c4d7ce` |
| F25, §2.3 #12 | tap 0.5, type 3: 1.5, no × on the line | a number beside a chip multiplied | fixed R29, `028f2da` (also in a bare argument) |
| F26, §2.3 #13 | one-line `1/2x` = 1/(2x); `6÷2(1+2)` = 1 | ÷ took the whole implicit product | fixed R30 `202175a` |
| F27, §2.3 #14 | a hardware keyboard's `1e-3` = e − 3 | hardware keys bypassed the keypad | fixed R31 |
| F43 | `2 3` = 6, `1\,000` = 0 | a space between numbers multiplied | fixed R51 `661c1a1` |
| F17 | `2 + x² ⌫ ⌫` gave 2² | see family 10 | fixed R26d |
| F18 | `\sqrt[3]{8}` with the index emptied computed √8 | see family 10 | fixed R26e |
| R56 | `p(x):=x²`, relaunch, `p(2)` = p·2 | the parser forgot the user's functions | fixed `25c6a73` |
| `688ca31` | a Find insert threw the selection away | | fixed |
| chk 6, R67 | CAS after R58: Alpha + E types Euler's e (`2e` = 5.43656365692), Alpha + I the imaginary unit | the parser reads the letters e and i as constants | **open R67** (decided) |
| R57 | after a pasted `1,5ᴇ-3`, ÷ takes only `5ᴇ-3` (a silent wrong numerator) | `selectENumber` reads digits and `.` only | **open R57** |
| R56b | Solve and Function know only f, g, h | they parse without the user's names | **open R56b** |
| R68 | `2 × ᴇ 3` is refused ("type the number") | ᴇ adds its 1 only on an empty line | **open R68** (a friction, not a wrong number) |

**Hunt.**
- **The neighbour grid:** every key K × every left neighbour (digit, decimal point, ᴇ exponent, letter, Ans, `\res` chip, `\const` chip, closing bracket, template end, space, selection) × every right neighbour. The parsed Giac text must equal what the drawing shows. A juxtaposition is allowed only where the drawing shows a product. Today's grids check that a digit lands in the right box, not the value.
- **Every way text enters the field:** keypad, hardware keys, paste, Find inserts (R4a), history recall, undo, and the unit slots (R24c). For the slots, r6 section 7 already notes that `insert()` with the caret outside every prompt still edits the read-only formula: test it before R24c merges.
- **The decimal comma (R57)** doubles every number rule: `selectENumber`, the parser, copy and paste, the hardware `,` key.
- **One-line entry against textbook:** the same keys must give the same value (F26 was one-line only).

### 8. One rule in two places
**Pattern.** The same rule is written twice: in the parser and in raw Giac text, in the parser and the plot evaluator, in the Find index and the unit evaluator, in the session and the golden runner, in the key face and the key action. The two drift, and each side's tests pass.

| Id | What the user saw | The two places | Status |
|---|---|---|---|
| F40 | Shift + Alpha: the keys type lower case, the faces show capitals | `labelFor` and `layerAction` (`keyboard.ts`) | fixed R48 `47e6f4a` (one rule) |
| G15, n18 1 | Find shows rpm as π/30 rad/s and "rev" inserts an angle; the evaluator makes rpm 1/60 Hz | the Find index and `factors.ts` | fixed G7, G32 |
| `a3ddd52` | Solve and Plot analysis refused `x_1` | their own unknown detection | fixed |
| R39 audit | CAS lost Giac's `surd` form | the root rule applied to every view | fixed `516db2d` |
| G14 → G14f1 | `\bmod` and Find's `irem` skipped `pasmod` | three parser entries for one function | fixed `63d6d29` |
| `bc78534` | the parser gate failed on `pasmod` | the gate's Giac lacked our definitions | fixed |
| G49f2 | golden sequence cases expected another chip than the app builds | the session's chip rule and the golden runner's | fixed `1065c70` |
| D5 | Home and CAS `evalf` give two values for one complex input in DEG | `re()`/`im()` against `evalf` | **open route R** |
| n19 2.5, G54 | raw `median([1,2,3,4])` = 2 in a library body; `irem` there is Giac's | the parser's renames (`CALL_NAME`) and the engine's (`complexSafe`) apply to parsed text only | **open G54** (before R59) |
| chk 16 | a library `// test:` line passes on Giac's rules while Home shows another value | `library.ts:300` runs raw `eval` | **open** (R59's text; r14 section 5's rule) |
| R56b | see family 7 | Function and Solve call `parseLatex` directly | **open R56b** |

**Hunt.**
- **Every way into Giac:** Home, CAS, Solve, Function analysis and table, the plot compiler, the unit view's builder, library import and its test lines, the defs replay, the backup restore (R38b), Find inserts, paste. For each, list which of our rules apply: the `CALL_NAME` renames, pasmod, complexSafe, pasexp and pasdeg, realOddRoots, exact decimals (P9), restoreLiterals, chip names. Run one corpus through every path; every difference is a bug or a decision to write down (G55's corpus fits).
- **Every rule with a second copy:** grep for functions that compute the same thing for display and for action, for the app and for a test runner, for the index and for the evaluator. Make one call the other, or add a test that compares them.

### 9. Our helper names and rewrites leak or collide
**Pattern.** We put our own names into Giac's text (pasexp, pasmod, pasdeg, pasupm, pasdim*, pasr_k, pcasans) and rewrite user text. A name can reach the screen, a copy, an export or a message; the user can define, purge or overwrite it; and some paths skip the rewrite.

| Id | What the user saw | Status |
|---|---|---|
| G21f1 | the helper name `pasexp` on screen | fixed `724e9c0` |
| E8 | refusals with internal text: `floor(3*pasdimL/2)`, "no uncertainty: [2]", `1 m/(0 s)` → "infinity" | taken into G35 (merged); `30° × 2 m` drawn as `60 1°·m` **open G40** |
| G20, G28 | f's own parameter x listed as "stored in Home" | fixed `79e8b0f`, `a58c2e6` |
| G33f2, G33f3 | a library body could store into a global, use a loop variable or an inner function; `FOR k FROM` slipped through | fixed `005c2f3`, `6da0743`, `c2907fa` |
| `33f7f54`, `f170d97` | a library test line could change state; a store through nested index brackets slipped through | fixed |
| G50 fix 2 | a library could define our complex helpers' names | fixed `af40dab` |
| r6 §5 | an internal name with `_` reads as a unit (`pas_d`) | avoided by rule: our names have no `_` |
| chk 7 | `pasexp(` in the exported library file | **open G46** |
| r14 §5 | a user's `pasdeg:=5` (route R) | **open R64/G46**: reserve it |
| r14 §3 | the angle factor in a kept `==` text | **open R64** |
| **new N2** | the library's state-word guard does not list `approx_mode`, `epsilon` or `complex_variables` (`library.ts:21`), so a library line that sets them would pass (inferred, not run) | **new**, with N1 |

**Hunt.**
- **Leaks:** grep everything a user can see or take away (the line, results, copy text, share, the export file, Vars previews, why-lines, error messages) for `pas[a-z]`, `pcasans` and Giac's internal words, on a corpus that hits every helper.
- **Collisions:** for each helper name, try defining it in Home, in CAS and in a library, and `purge` it from CAS (Find lists `purge`, `restart` and `assume` as tier-1 entries today, so R4a makes them one tap away).
- **Bypasses:** for each rewrite, the paths of family 8 that skip it.

### 10. ⌫, Del, cursor and taps inside templates
**Pattern.** MathLive deletes and moves differently in each kind of atom (brackets, roots, fractions, powers, scripts, arrays, marks). A half-deleted template is either stuck (F10, F39) or valid LaTeX with another value (F17, F18). Touch and mouse take different code paths (F33).

| Id | What the user saw | Status |
|---|---|---|
| F10 | `log(log(□))` ⌫ ⌫ ⌫ stuck at `log )`; every bracket did it | fixed R23 `783893b`, `fa737f0`; MathLive #3122 |
| F15 | ⌫ right after `)` removed it alone | fixed R26c `36e60cc` |
| F16 | hardware Backspace and Delete bypassed our path | fixed R26b `bd69733` |
| F17 | powers lost or moved their exponent (`2 + x² ⌫ ⌫` → 2²) | fixed R26d `b934657`; `b915ff0` (an empty exponent on a typed base) |
| F18 | fractions and roots: index vanished, parts joined | fixed R26e `8bc40a7`; G2 item 47 `3a40643` |
| F19 | lim, Σ, Π, ∫ lost boxes or left orphan scripts | fixed R26f `0f470a4`; `f773caa` (Del after ∫'s variable) |
| F20 | matrices, vectors, piecewise | fixed R26g `ef4ecae` |
| F21 | log base, EQ, DMS, evaluate-at | fixed R26h `622b074` |
| F23 | the cursor stopped where no box is | fixed R27b `30416b6` |
| F33 | a finger tap at a template's right edge landed at the line's start | fixed R42 `11b6c99`; MathLive #3123 |
| F34 | ▶ skipped the end of a box that holds a template | fixed R43 `de30899` |
| F39 | ⌫ between `log` and `(` deleted the name and then stuck | fixed R47 `a01aa51` for the tap case; **the owner's own key sequence is still to confirm** |
| R43b | DMS with a selected □ | fixed (p1/ron-m4a-dmsbox) |

**Hunt.**
- **The grids exist:** `bksp-grid.spec.ts`, `cursor-grid.spec.ts`, the digit-at-every-offset probe, and the 2 px tap scan of R47. **Rule:** every new template or key gets rows in all of them in the same commit. Coming soon: R15c's round pad and user keys, R54's `{ }`, R24c's unit slots and prompts, R4a's Find inserts, EN5's growing matrix, EN6's `0x` literals.
- **Touch against mouse at every test point** (F33: a mouse never takes MathLive's second placement).
- **The value of every intermediate line:** a stuck or half-deleted line must be an error, never another number.
- **After a MathLive upgrade:** rerun all the grids; r6 section 7 was learned on 0.111.1.

### 11. Async edges, lifecycle, and keys reaching the wrong target
**Pattern.** Something arrives before its consumer exists (a key before the chunk, the field or the engine is in) or after it has gone (a gesture, a timer or a write while the app is away or killed). A related shape: a key goes to a consumer the user cannot see (a hidden sheet, the last result instead of the picked row).

| Id | What the user saw | Status |
|---|---|---|
| F1, K0 | the system keyboard opened after switching apps | fixed `9679a43`, `f3b7d45` |
| F9 | the same, again: MathLive's own focus restore | fixed R22 `d2389e9` |
| F11 | ⌫ held while the app went away kept deleting | fixed R25a `0906653` |
| F12 | a touch the app never saw end fired on the next key | fixed R25a |
| F13 | a key pressed less than 60 ms before leaving focused the field while away | fixed R25c `d84b504` |
| F14 | desktop: ⌫ held with the mouse and released off the keypad never stopped | fixed R25b `fc35b07` |
| F30 | a half-typed line was lost on a kill | fixed R34; review `71796e9` (a hide before the kept line was on the field) |
| F31 | a stored definition that crashed the worker looped the start forever | fixed G19; reviews `15f9db5` (a safe start never cleared the count), `86fbd32`, `4d75f4c`, `8cd4835`, `aca4408` |
| F32 | no memory cap (up to 2 GB on a 3.9 GB tablet) | fixed G24; the Tab One check is still open |
| F42 | a long press before the sheet's chunk opened an invisible sheet; the next digit deleted a row | fixed R46f1 `90f27cb` |
| `5ddd626` | Menu acted on the last result, not the picked row | fixed |
| `aca4408`, `f6f9893` | ▲ ▼ could pick the safe-start note; a layer that gave way kept a back entry | fixed |
| m1 | typing before MathLive loaded lost keys (2 of 5 runs) | fixed `d6c052f`; `cfe08b0` (keys while an app loads) |
| R35, R45 reviews | keys while the Mode sheet's code loads; a hardware letter while an app loads | fixed `9dc238d`, `eda7040` |
| m2 | calls sent while the engine started failed with "engine not ready" | fixed `7a7a4e7` |
| m1 | a saved history of 110 entries made the engine ready in 2.1–2.7 s | fixed (history after the keypad, 20 rows drawn) |
| m3 | settings were never saved | fixed (p1/ron-fmt) |
| m3 | Plot crashed on the Chrome 101 WebView (`toSorted`) | fixed `3a49a61` (polyfills) |
| C8, R21b review | Android back left the app; after a return from recents it was not handled | fixed R21b, `af97da4` |
| F8 | "Working…" flashed after every Enter | fixed `0f5613f`; the WebView is not checked |
| B13 | a test reloaded before its IndexedDB write landed | fixed in the test `d338719`; the same race in the app is F30's kind |
| F41 | key vibration does nothing on the phone | **open A9** |
| K1 | a pending one-shot Shift is used up by the first drag step | **open** |
| K1 | `touch-action: none` on the trackpad: side effects not checked | **open** (phone check) |
| R16 | undo during a running job | not run (read from the code only) |

**Hunt.**
- **Every lazy chunk × every key kind:** keypad, hardware letter, Enter, long press, flick, Android back. The chunks: Sheet, Settings, Mode, parser, MathLive, Function, the unit view, and coming soon Find (R4a) and R15c's pieces. The rule is R8's queue.
- **Every lifecycle event × everything in flight:** hide, pagehide, blur, freeze, return from recents, kill, a low-memory kill, a worker crash and restart; against a held key, the repeat, long-press and flick timers, MathLive's 60 ms focus timer, an IndexedDB write, an engine job, the defs replay, Cancel.
- **Old WebViews:** any ES2023+ API or new CSS in our code and our dependencies, run on the S8+'s Chrome 101.
- **Every fire-and-forget write (`kv.set`):** kill the app right after it.

### 12. Units and uncertainty
**Pattern.** The unit rules are right on the side someone tested and missing on the other: the input of sin but not the output of asin; a conversion but not a formula; a nonzero term but not a zero one; first order away from a stationary point. Upstream data is wrong in places, and qalc's "exact" flag cannot be trusted.

| Id | What the user saw | Status |
|---|---|---|
| §2.3 #10 | `1 hp → W` = 745.699987158, flagged exact (right: 745.69987158227) | fixed G13 (our factor); libqalculate #1043 |
| G13 | mmHg defined as 1 Torr; inHg follows it; 13 CODATA values off in the last digit | fixed G13; libqalculate #1044, #1045 |
| r6 §6 | qalc accepts `1 m + 1 s` and `20 °C × 2`; misreads degC, BTU, mu0, NA, R, h, g | avoided (P15: the evaluator runs on Giac) |
| G17 (Opus pass 1) | `20 dB` = 10 Np; `−300 °C` = −26.85 K; a lone dB converted | fixed G17f1 `3a36481` |
| G18 (pass 1, 2) | `−1 K → °C` computed; σ = 0 shown at 30 digits; a wrong refusal reason | fixed G18f1 `815c5db` |
| G25 (pass 2) | `2 kN × 3 m` shown as 6 kJ | fixed G25f1 `c2ea7de`; `c35195a` |
| R24af1 | milli + inch read as "minute" | fixed `c0eb9ea` |
| R28f1 | the sign of a ± number was outside `pasupm` | fixed `39f5be7` |
| G15, G32 | `60 rpm → rad/s` had only the generic mismatch text | fixed `35ebf1f` |
| chk 5 | `0 m + 1 s` = `= 1 s`; `5 m − 5 m + 1 s` = 1 s; `0 ± 0.1 m` lost its m | fixed G35 `842aee3`, fix round `2852e49` |
| chk 13 | `−(5 °C)`: "Use K or Δ°C" (the wrong reason) | fixed in G35's message pass |
| chk 12 | `1 J/(kg·°C) → J/(kg·K)` refused | **open G37** (decided) |
| E3 | DEG `asin(1/2)·1 rad` = `= 30 rad`; `asin(1/2) → °` refused | **open G40** |
| E4 | `3000 rpm × 0.1 m → m/s` = 5 (no 2π); `10 rad/s × 0.5 m` and `90° × 1 N·m → J` refused | **open G40** (decided) |
| E5 | `cos(0 ± 0.1)` = 1 ± 0; `(0 ± 0.1 m)²` = 0 ± 0; `sqrt(0.01 ± 0.1 m²)` σ = 0.5 m | **open G41** |
| chk 17 | Find lists 34 units the unit view refuses | **open** (R4a and R24d mark them) |
| Giac data | the US quart, the f0 constant, Xcas menu units Giac does not read | drafted (`../outreach/upstream-reports.md` G11); Parisse takes it by email, forum or commit link (2026-10-19) |

**Hunt.**
- **Every rule's twin:** for each guard on the input side, its output-side twin (asin gives an angle); for each conversion guard, the formulas engineers type (ω·r, τ·θ, P = τ·ω).
- **Every unit at the edges:** 0, a negative value, an offset unit (°C, °F) alone and inside a compound, a level (dB) alone and inside a product, absolute zero, a term that cancels exactly.
- **σ at its limits:** stationary points, a singular point within ±2σ, and correlation. Today two typed `pasupm` literals are independent. When the same measured value is used twice (later through a `\res` chip from the unit view), first-order propagation with independence gives the wrong σ (σ of x·x is not σ of x² with independent factors). Not probed; S11's result view must decide it.
- **The Find index against the evaluator:** every unit in Find gives a value or a named refusal in the unit view.
- **Data against definitions:** every factor `derived` from its definition, and every CODATA value against NIST (G13's method).

### 13. Cost and budgets
**Pattern.** Each package measures its cost against its parent, so the cost compounds. The gate measured no Giac calls until G52. The device sees 10–30× the desktop time.

| Id | What was measured | Status |
|---|---|---|
| m1 | the history slowed the start (2.1–2.7 s to engine ready) | fixed |
| A4a point 2 | the defs replay took 291 ms against 50 ms on the Tab One | G29 (200 calls → 8; reruns `d8b07fa`, `ea5d875`); **A12 open** (device) |
| G33 | the library replay is about ten times over its budget | **open** (R59 waits for A12; lazy definition) |
| G30, pass 15 | the start chunk passed its budget | fixed G30f1 `f9e8846` (E-series tables out); R35, R46 moved code out; 53.28 of 54 kB |
| n19 2.3 | G38f1 doubled the desktop cost per Enter; Giac calls per Enter 82 → 187 | G52 merged `0bd9631` (calls in the gate); **G53 open**; A16 merged (Tab One RAD 135–138 ms, DEG 150–160 ms against 150) |
| G50 | `complexReads` reads up to 40 stored names per input | part of G53 |
| A4a point 3 | a Tmpl sheet is in the DOM 73 ms after the tap (target: one frame) | open (R12c) |
| A4a point 4 | at font scale 1.5 the faces clip | **open R41** |
| r14 §8 | route R in DEG: desktop p95 2.4 → 3.7 ms | **open** (G46 measures on the Tab One) |
| backlog | the size test does not cover CSS | open (a line of its own past 40 kB) |

**Hunt.** Measure against a fixed baseline commit, not the parent. Feed inputs that scale: 40 or more stored names (every per-name call), long lists, huge exponents (r16-F1), 200 stored definitions, a long history. Run A16's device bench after every engine package, not once a week.

### 14. Tests and gates that let bugs through
**Pattern.** The test did not test what its name says: a source tag was wrong, the test path differed from the app path, a row checked the mark but not the value, a timing test failed under load, or a run used another checkout's server.

| Id | What went wrong | Status |
|---|---|---|
| `09665a6`, G32 | golden cases tagged `virtual-calc` or `derived` that were not | fixed (l6-root `derived`; CODATA `reference`) |
| R51 audit | two parser cases with one id | fixed `ecd6242` (a uniqueness test) |
| `bc78534` | the parser gate's Giac lacked our definitions | fixed |
| G49f2, G38f2 | the golden runner's chip rule; g38 cases without an oracle value | fixed `1065c70`, `0962ebf` |
| A6f1 | the golden trigger skipped `app/src/units/` | fixed (A13) |
| n18, B13 | timing tests (Find 16 ms per key, units p95, G23's 50 ms, a 5 s clipboard poll) failed under load; fix rounds then raised timeouts | fixed: one rerun of timing-only failures, a busy-host skip, `be50727` reverted a timeout |
| chk 11 | a hand-run e2e reused another checkout's dev server on port 5181 | fixed A15 |
| chk 10 | `npm run size` measured a stale `dist/`; the pipeline ran neither size nor docs-check | fixed A15 |
| chk 14 | docs-check read untracked files | fixed A15 (a warning) |
| n19 2.8 | golden rows checked only the mark, so `⚠ 0` for an exact 1 passed | **open G57** (and promote mark-only rows) |
| n19 2.1 | no golden case calls `round(x,n)` or `trunc(x,n)` | **open G47** |
| r16 §1 | 213 of 233 Home cases enter as Giac text, so the keyboard-to-number path is thin | **open** (G61's keyboard LaTeX generator) |
| r16 §1 | the plot evaluator is tested against hand-written JS only | **proposed G63** |
| r16 §1 | Giac's own `check/` suite never ran on our wasm | **proposed A19** (first run clean) |
| E10, chk Part 2 | no test changes a setting between two lines | G34's sequence form; **G43 open** |
| backlog | A15's tests check dry-run echo lines, not `want_checks` | **open** |
| backlog | a "command not found" (an emptied shared `node_modules`) counted as a code failure | **open** (A18) |
| n18 | "the regression test failed before the fix" is the worker's claim; audits do not rerun it on the old code | open (process) |

**Hunt (meta).** For each family, the generator that would have found its bugs: the oracle sweep (G61) for 3, 4, 6; sequences (G62) for 1, 2; one value in every view (G63) for 8; CAS checked back (G64) for 5; Giac's suite (A19) for the build; invariants (G43) for 2; the behaviour diff (G55, A18) for regressions; the entry grids for 7 and 10.

### 15. Pipeline, tools and build
**Pattern.** Shell quoting and `eval`, paths relative to the working directory or worktree, state shared between worktrees (node_modules, the dev server port, `.coord`), caps and counters, and claims nobody checked (which commit was audited, whether a test failed first).

| Id | What went wrong | Status |
|---|---|---|
| `1c0cdf0`, `e400fe6` | night.sh re-exec by a relative `$0`; henri's command ran where `scripts/` was missing (rc 127); `branch -d` from the main checkout | fixed |
| `1ac97d4` | a quoted `;` refused; gc's path | fixed |
| n18 | two refused replies ended the night silently (6 h 49 min lost) | fixed A13 (a STOPPED line) |
| n18 | vitest's colour codes defeated the rerun grep | fixed A13 |
| n18 | the pass command set no `PW_PORT` | fixed A13 |
| `53f7cc5`, `335aee0` | suite errors not counted as failed files; a dry run created files; the conflict list | fixed |
| n18 | Sonnet audits approved seven defects an Opus pass then caught (G17 ×4, G18 ×3, G25, G22, G23 ×2, G14) | fixed A15 (Opus audits for gorge) |
| n19 1 | G39's merge took a commit its audit had not approved | fixed A17 `462bb89` |
| n19 3.1 | the step cap (40) would have ended the night before its last pass | fixed A17 (`--until`) |
| n19 3.7 | a worker's `pgrep -f` watcher matched its own command line (39 minutes idle) | fixed (rules section 3) |
| n18, n19 3.8 | pass replies with text before `OPUS PASS` | fixed A17 |
| n18 | pass 8 edited a DECIDED entry on an OPEN proposal | fixed (pass instructions) |
| n19 3.5 | decisions.md full (39,994 of 40,000 bytes) | fixed S15; S15f1 restored named entries whole |
| `ae1f58f` | henri's handover did not wait for its workers | fixed |
| m1 | a committed `gradle-wrapper.jar` (the no-binaries rule) | fixed in review (pinned download) |
| `a78441c` | the `_out` symlink was tracked | fixed |
| `3de1568` | the pwa-lite plugin refused an absolute outDir | fixed |
| `450c3fd`, C6 | the device serial; warm launches; a measure build reported "release"; stay-awake restored only from its own worktree | fixed `a0d2a7d` |
| m3 | `device_run.py --mode first` installed a fixed path; `--mode cold` waited for a mark never logged | fixed (tooling tidy) |
| C4 | the F-Droid recipe: `npm ci` after `prebuild` downloads | **open** |
| A18 | see family 14 (command not found) | **open** |
| n19 3.3 | fix chains: 9 of 22 runs in one night were fix packages | open (process; S13, G55) |

### 16. Conventions that look like bugs
Not bugs: decided or asked. Users will report them, so each needs our choice, the G2's (device), Giac's, and a golden case that pins ours with the G2's in its note.

| Topic | G2 | Giac | Ours |
|---|---|---|---|
| `(−8)^(1/3)` in Home | −2 | principal root 1+1.732i | R39 gave −2; S12 → **R66**: principal root in Home, the ∛ template gives −2, Function and Solve keep −2 |
| `7 mod −3` | −2 (device, item 43) | `irem`: 1 | 1; **G45** records it |
| round ties | (item 66) | half up: `round(−2.5)` = −2 | display half away; **G45**: one tie rule |
| median, quartiles, stddev names | (item 67) | lower middle; one convention | G42: ours for median and percentile |
| `6÷2(1+2)` | (item 53) | — | 9 (R30) |
| e and i typed as letters in CAS | (item 62) | constants | **R67**: names |
| sin of a complex number in DEG; cosh of an imaginary in DEG; a CAS angle setting | items 63–65 | | route R's reading z° = zπ/180 |
| what an overflow shows | new question (r16-F7) | symbolic text | open |
| ᴇ after an operator | `2×1ᴇ` (device, item 40) | — | **R68** |

## 4. Leads for the next hunt, ranked

1. **N1: Giac's mode switches typed by the user (new, verified today; no package).** Probe on `0bd9631` with a scratch sequence probe (one `EngineHost`, Home and CAS sharing Giac as in the app):
   - CAS `approx_mode:=1`: stored as `{name: "approx_mode", kind: "var", cmds: ["approx_mode:=(1)"]}`, so the defs log replays it at every start.
   - After it, CAS `1/3` and `int(x^2,x,0,1)` give `0.333333333333`, and Home `1/4`, `0.1+0.2` and `2^70` come back with `exactRational: false`: `≈ 0.25` where `= 0.25` is right. The digits stay right; the CAS view loses its exact answers.
   - CAS `approx_mode:=0` afterwards returns 1 and stores `approx_mode:=(1)`, so typing cannot undo it. Home `approx_mode:=0` stores `approx_mode:=(1)` with the preview 0.
   - CAS `cas_setup(1,0,0,1,0,[1e-12,1e-15],12,[1,100,0,25],0,1,0,1)` has the same effect, with no log entry.
   - **Reach:** typing `approx_mode` needs `_`, which no key types (not checked by hand). But the Find index already lists `cas_setup`, `assume`, `purge` and `restart` as tier-1 entries, so R4a makes them one tap away. A library line would reach it too, because the state-word guard (`library.ts:21`) does not list `approx_mode` (N2, inferred).
   - **Recommendation:** one small gorge package before R4a. The host sets every `cas_setup()` field before each call (as it already does `Digits` and the angle), the defs log never stores a Giac flag name, the library guard lists every flag, and Find marks or hides the state commands. Tests first: the sequences above as golden sequence cases. It needs an id from the owner's list.
2. **The carrier × fact matrix** (family 1), with the unprobed cells listed there. It is r16's G62.
3. **Every way into Giac × our rewrites** (families 8 and 9): one corpus through every path. G54 and G55 hold most of it; add the library test lines and the backup restore.
4. **Branch cuts and hidden doubles** (family 4): a generator near the cuts and a 30/60-digit "same double" test per function. G59, G60, G61.
5. **Huge inputs to our JS steps** (family 6): a size bound on every BigInt and `regroup` step. G58.
6. **A census of Giac's output shapes** for the tier-1 functions (family 5), before R4a exposes them.
7. **The entry grids for every new template** (families 7 and 10), and the read-only prompt edit before R24c.
8. **Lazy chunks × key kinds** for R4a's Find chunk and R15c's pieces (family 11).
9. **The unit view's output side and σ correlation** (family 12), before R24c and S11.

## 5. How to rerun

- One line: `node tools/probes/engine.ts '<input>'` with `MODE=cas`, `ANGLE=deg`, `DIGITS=30` or `FACTS=1` as the row needs.
- A sequence (N1): a scratch script that builds one `EngineHost` from `app/src/engine/host.ts` and calls `host.cas()` and `host.home()` in turn, printing `result` and `defs`. Mine was throwaway; G62 rebuilds it in the repo.
- Each family's older rows name their package; the regression cases are in `tests/golden/` and `app/test/` under the ids above.
