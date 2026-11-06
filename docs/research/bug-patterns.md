<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Bug patterns: the bug families, and how to hunt each

**Status (2026-10-20, rows dropped 2026-11-06 by S27): reference.** The sixteen bug families, each with its pattern and its hunt lead; the live open bugs are backlog.md's F lines, each naming its family; each family's question is in `.claude/agents/sofia.md`.

The per-bug rows of section 3 (every bug to 2026-10-19, and F99–F122 since, with their packages and merges) are in git at `742169a8`: `git show 742169a8:docs/research/bug-patterns.md`. Each of those bugs also has its backlog line or its archived decision.

*Written 2026-10-19 by Claude (Opus, the owner's session; read and probe only) on `phase-1` `0bd9631`, from every `fix` commit, the backlog and its archive, feedback.md, docs/04 2.3 with [r12-evidence.md](r12-evidence.md), [r14-angle-mode.md](../archive/r14-angle-mode.md), the check notes and shift reports of 2026-10-18 and 2026-10-19; the rows open on `da7a59c` became F44–F59 (the consolidation report (`archive/shifts/2026-10-20-sandra-consolidation-report.md` at `98e96656`) (a)).*

**Id notation** (section 1 uses it). F-ids are feedback and backlog bugs. "§2.3 #n" is row n of docs/04 2.3. "chk n" is finding n of [check-2026-10-19.md](../archive/shifts/check-2026-10-19.md). D1–D12 and E1–E12 come from the two deep checks; "n18" and "n19 2.x" are the night checks of 2026-10-18 and 2026-10-19; "r16-F1"–"r16-F7" are the sweep of [r16-verification.md](../archive/r16-verification.md), renamed because F1–F7 are feedback ids.

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

On 2026-10-19 the rows were 224 outside family 16: 155 fixed and 69 open or proposed, 2 of them new today. A row can hold several commits (a bug and its review fixes). A bug that fits two families is counted once, where its cause is; the other family has a row that says "see family n".

**Five causes sit under most families:**
1. **Hidden global state.** Giac's `angle_radian`, `Digits` and now `approx_mode` (families 2, 3); our chip tables and counters (1, 11); the shared `app/node_modules` and dev server port (14, 15).
2. **Glue that works on text.** The text helpers (`namesIn`, `functionsIn`, `simpleAssignment`, `complexReads`) and our rewrites (pasexp, pasmod, complexSafe, restoreLiterals, pasdeg) each miss the forms they do not match (1, 2, 8, 9). `numeric.ts` doubled in one night, and the night's bugs sat in these helpers (n19 3.4).
3. **One rule written twice.** The parser and the plot evaluator, the parser and raw Giac text, the Find index and the unit evaluator, the session's chip rule and the golden runner's, the key face and the key action (8).
4. **Edges between asynchronous parts.** Lazy chunks, the engine start, IndexedDB writes, MathLive's 60 ms timer, the app going away (11).
5. **MathLive's own editing model.** Each atom kind deletes and moves in its own way, and a half-deleted line is often valid LaTeX with another value (10).

**The testing lesson.** Every golden and e2e case was one input in one setting until G34. The state and carrier bugs (families 1 and 2) all need a sequence, and none was found by a per-package audit. Mechanical checks found what reviews missed: a 30-input before/after battery found G50's lost digit, which had passed five audits (n19 2.4); the first RAD/DEG invariant run found two bugs in 169 inputs (E10); a 1152-evaluation complex sweep found D6, D9 and D10; an hour's oracle sweep found r16-F1–F7.

## 2. How to use this note

- **To hunt:** pick a family and run its hunt lead (section 3). Section 4 says where new leads come from.
- **When a bug is found:** its backlog line names its family, or a new family starts here. Then answer r16 section 4's question: which generator should have found it? Extend that generator.
- **Before a package touches a family's code:** read the family's old rows (`git show 742169a8:docs/research/bug-patterns.md`). Most fix chains (G49 needed four follow-ups, G38 two, G50 one) were the same pattern met again in a form the first fix did not match.

## 3. The families

### 1. A carried value loses its facts
**Pattern.** A value leaves the line it was computed on (a stored name, Ans, a tapped `\res` chip, a constant chip, a function body, the defs log). It keeps its text but loses some of its facts: exact or not, the confirmed digits, the ⚠, the reason, the σ. A ⚠ value then comes back as `≈` or `=`. Each fix closed one carrier, and the next carrier had the same hole.
**Hunt.** Test every pair of carrier (`:=` and ▶, Ans, `\res` and `\const` chips, functions incl. the arrow and `unapply`, multiple assignment, `=>`, `sto`, Home ↔ CAS, Solve roots, history recall, undo, the defs replay, library export and import, the backup, the unit view's chip) and fact (exact, confirmed digits, warn, why, inexact input, σ, the angle at store time) as a sequence (G62); the mechanism lead is S13 (read the stored names from Giac's `VARS()`, not from the line's text).

### 2. Settings read at evaluation time (hidden global state)
**Pattern.** Giac reads a global flag when it evaluates, not when the user typed. A text that is right in one setting is wrong in the other, and Giac's own rewrites (exp, cosh, `re`/`im`) carry the flag into paths that never mention an angle. The same applies to every Giac flag a user can reach (N1, fixed by G67f1).
**Hunt.** For every Giac flag (the twelve `cas_setup()` fields, `assume`) and every flag of ours (`pasdeg`, `pasinexact`, `realOddRoots`, the chip table): can a line set it (CAS, Home, a Find insert, a library), does the host reset it per call, does the defs log store it; then G43's invariants (an angle-free input gives one value in RAD and DEG, the same shown digits at 12 and 30, the same value after an unrelated store).

### 3. Numeric decisions made at too few digits
**Pattern.** Inside an "exact" evaluation, Giac decides a sign, a comparison, a floor or a branch with floats at the current `Digits`. The text it returns then looks exact or plausible. The agreement check re-evaluates that text, so it confirms the wrong decision. The trigger is a value whose double is badly wrong: trig of a huge argument, a near-integer, a cancellation past 15 digits, or a value exactly on a cut.
**Hunt.** Every decision Giac makes (sign, abs, floor, ceil, round, frac, max, min, comparisons, piecewise, sort, the sign tests inside int, sum, limit and solve) on arguments that fool a double (trig of 10^k for k ≥ 17, near-integers such as e^(π√163), cancellations past 15 digits, sums exactly on a cut), through every path the host runs once (`STATEFUL`) against G38's two decisions.

### 4. Two evaluations that share one error
**Pattern.** The agreement check runs one Giac path at two precisions. When that path holds a double, a wrong branch or a wrong formula, both runs agree on the same wrong digits. This is docs/04 section 9's risk 1. It shows up at functions without an MPFR path, at complex arguments, at branch cuts, and at real arguments with complex results.
**Hunt.** Functions with a hidden double (`evalf(f(x),30)` and `evalf(f(x),60)` print the same digits: Bessel, Airy, complex inverse trig and asinh, complex Gamma, zeta, LambertW, incomplete gamma, polylog, and the float paths of normald_icdf, romberg, nInt, fsolve) and branch cuts (asin and acos at |x| > 1, acosh at x < 1, logs and roots of negatives, negative bases to non-integer powers, `re()`/`im()` of composed functions), with generated arguments near the cuts (G61).

### 5. Giac answers that are not a plain value
**Pattern.** The marks assume a result is an exact number or a float with digits. Giac also returns a convention where mathematics has none (a principal value, an Abel sum), a pair `[exact, numeric]`, unevaluated text, special words, odd float prints, and functions that differ from the textbook (median, round).
**Hunt.** A census of output shapes for Find's tier-1 functions (`undef`, `infinity`, `bounded_function`, unevaluated calls, `[exact, numeric]`, `0.-000`, `rootof`, `piecewise`: each needs a refusal or a mark; `tools/probes/find-census.ts`), and every function whose result is a convention (median, quartiles, stddev, mod, iquo, frac, arg on the cut, round ties) with Giac's, the G2's and ours (family 16).

### 6. Our own numeric and display code
**Pattern.** `format.ts`, `numeric.ts` and the plot evaluator are pure code that nobody fed extreme input: a huge exponent, a short double, every decimal zero, a complex number whose parts differ by many orders.
**Hunt.** Property and mutation tests on `format.ts` and `markOf` (every format × digits 1–30 × confirmed digits 0–30, at ties, at 10^±300, with complex parts far apart: never more digits than confirmed, a nonzero value never 0), a size bound on every JS step over a Giac result (BigInt, `regroup`, loops as long as the exponent or the text), and the plot evaluator against Giac on every keyboard function (G63).

### 7. The line computes something other than it shows
**Pattern.** The 2D line looks like one expression and the parser reads another: a hidden product, an operator that went into an exponent, a key that took only part of what stood before it. These are the most dangerous entry bugs, because the line looks plausible.
**Hunt.** The neighbour grid (every key × every left and right neighbour: digit, point, ᴇ, letter, Ans, chips, bracket, template end, space, selection; the parsed Giac text must equal what the drawing shows), every way text enters the field (keypad, hardware keys, paste, Find inserts, history, undo, the unit slots), the decimal comma, and one-line entry against textbook entry.

### 8. One rule in two places
**Pattern.** The same rule is written twice: in the parser and in raw Giac text, in the parser and the plot evaluator, in the Find index and the unit evaluator, in the session and the golden runner, in the key face and the key action. The two drift, and each side's tests pass.
**Hunt.** Run one corpus through every way into Giac (Home, CAS, Solve, Function, the plot compiler, the unit view, library import and its test lines, the defs replay, the backup, Find inserts, paste) and list which of our rules applies on each (`CALL_NAME`, pasmod, complexSafe, pasexp and pasdeg, realOddRoots, P9's exact decimals, restoreLiterals); every rule with a second copy calls the other or gets a test that compares them.

### 9. Our helper names and rewrites leak or collide
**Pattern.** We put our own names into Giac's text (pasexp, pasmod, pasdeg, pasupm, pasdim*, pasr_k, pcasans) and rewrite user text. A name can reach the screen, a copy, an export or a message; the user can define, purge or overwrite it; and some paths skip the rewrite.
**Hunt.** Grep everything a user sees or takes away (the line, results, copy, share, the export file, Vars, why-lines, errors) for `pas[a-z]`, `pcasans` and Giac's internal words; define and `purge` each helper name from Home, CAS and a library; check each rewrite against the paths of family 8 that skip it.

### 10. ⌫, Del, cursor and taps inside templates
**Pattern.** MathLive deletes and moves differently in each kind of atom (brackets, roots, fractions, powers, scripts, arrays, marks). A half-deleted template is either stuck (F10, F39) or valid LaTeX with another value (F17, F18). Touch and mouse take different code paths (F33).
**Hunt.** Every new template or key gets rows in `bksp-grid.spec.ts`, `cursor-grid.spec.ts`, the digit-at-every-offset probe and the 2 px tap scan in the same commit; touch against mouse at every test point; every intermediate line is an error, never another number; rerun all the grids after a MathLive upgrade.

### 11. Async edges, lifecycle, and keys reaching the wrong target
**Pattern.** Something arrives before its consumer exists (a key before the chunk, the field or the engine is in) or after it has gone (a gesture, a timer or a write while the app is away or killed). A related shape: a key goes to a consumer the user cannot see (a hidden sheet, the last result instead of the picked row).
**Hunt.** Every lazy chunk × every key kind (keypad, hardware letter, Enter, long press, flick, Android back); every lifecycle event (hide, blur, freeze, return from recents, kill, a worker crash) × everything in flight (a held key, the repeat and long-press timers, MathLive's 60 ms focus timer, an IndexedDB write, an engine job, the defs replay); ES2023+ APIs on the S8+'s Chrome 101; a kill right after every `kv.set`.

### 12. Units and uncertainty
**Pattern.** The unit rules are right on the side someone tested and missing on the other: the input of sin but not the output of asin; a conversion but not a formula; a nonzero term but not a zero one; first order away from a stationary point. Upstream data is wrong in places, and qalc's "exact" flag cannot be trusted.
**Hunt.** Every rule's twin (the output side of an input guard; the formulas engineers type beside each conversion: ω·r, τ·θ, P = τ·ω); every unit at 0, negative, offset (°C) and level (dB), alone and in a compound, at absolute zero and in a term that cancels exactly; σ at stationary points, singularities and correlated inputs; Find's units against the evaluator; every factor against its definition and CODATA.

### 13. Cost and budgets
**Pattern.** Each package measures its cost against its parent, so the cost compounds. The gate measured no Giac calls until G52. The device sees 10–30× the desktop time.

**Hunt.** Measure against a fixed baseline commit, not the parent. Feed inputs that scale: 40 or more stored names (every per-name call), long lists, huge exponents (r16-F1), 200 stored definitions, a long history. Run A16's device bench after every engine package, not once a week.

### 14. Tests and gates that let bugs through
**Pattern.** The test did not test what its name says: a source tag was wrong, the test path differed from the app path, a row checked the mark but not the value, a timing test failed under load, or a run used another checkout's server.

**Hunt (meta).** For each family, the generator that would have found its bugs: the oracle sweep (G61) for 3, 4, 6; sequences (G62) for 1, 2; one value in every view (G63) for 8; CAS checked back (G64) for 5; Giac's suite (A19) for the build; invariants (G43) for 2; the behaviour diff (G55, A18) for regressions; the entry grids for 7 and 10.

### 15. Pipeline, tools and build
**Pattern.** Shell quoting and `eval`, paths relative to the working directory or worktree, state shared between worktrees (node_modules, the dev server port, `.coord`), caps and counters, and claims nobody checked (which commit was audited, whether a test failed first).
**Hunt.** Ask of every script change the section 1 question: is it quoting or `eval`, a path relative to the working directory, state shared between worktrees, a cap or counter, or a claim nobody checked?

### 16. Conventions that look like bugs
Not bugs: decided or asked. Users will report them, so each needs our choice, the G2's (device), Giac's, and a golden case that pins ours with the G2's in its note.
**Hunt.** Its nine rows (`(−8)^(1/3)` in Home, `7 mod −3`, round ties, the median and stddev names, `6÷2(1+2)`, e and i typed in CAS, complex trig in DEG, ᴇ after an operator, and the open one: what an overflow shows) are in the old rows; a new report of this kind gets the three answers and its golden case before it is called a bug.

## 4. Leads for the next hunt

The leads of 2026-10-19 are built (G54–G62, G67f1, S11), except lead 8 (Find's lazy chunk against each key kind), kept in family 11's Hunt; new leads come from each night review's hunts ([the newest note](night-review-2026-11-02.md)).

## 5. How to rerun

- One line: `node tools/probes/engine.ts '<input>'` with `MODE=cas`, `ANGLE=deg`, `DIGITS=30` or `FACTS=1` as the row needs.
- A sequence (N1): a scratch script that builds one `EngineHost` from `app/src/engine/host.ts` and calls `host.cas()` and `host.home()` in turn, printing `result` and `defs`.
- Each family's older rows name their package; the regression cases are in `tests/golden/` and `app/test/` under the ids above.
