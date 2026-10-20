<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# R16: how we know the maths is right, and when to harden

**Status (2026-10-20): open (proposals).** The verification model is in docs/04 7.3, marked proposed; F1–F9 were rechecked on `da7a59c` and are backlog F44–F47, F50 and F51 (F1's DEG half and F9 were fixed by route R); G58–G64, A19, A20 and S16 are proposed packages in [the consolidation report](../shifts/2026-10-20-sandra-consolidation-report.md) (b), not in the brief.

*Written 2026-10-19, afternoon, by Claude (Opus, the owner's session; read and probe only) in `.claude/worktrees/phase-1`, with the engine `engine/giac/_out/gsl` (the 1 GB build of 11:43).*
- *The sweeps ran on `phase-1` `bb7441c`–`83d2262`.*
- *The DEG rows were checked again on `ce41519` (R64 merged; G46 running since 16:42, so Giac still runs in degrees).*

*The owner asked when to run a testing pass that hardens the engine integration, and how to verify that the maths is correct with no major bugs left. The probes were scratch scripts; Appendix B gives the rules to rebuild them, and each finding names its input, so `tools/probes/engine.ts` reruns it (section 7).*

## The answer

**How.** No test can prove Giac right. Giac has 1861 entries in Find, and tier 0 audits 43 of them. What we can make true, and test at scale, is principle 3 as one property: **the mark never lies.**
- Every digit that `=` or `≈` shows must be right.
- `⚠ n` must have n right digits.
- A number appears only where a value exists.
- An answer or a refusal comes within the time budget.

This property needs no hand-written expected value. An independent oracle (mpmath) checks it on generated inputs, by the thousand, in every setting. Around it sit five more checks. Each gives every result a second, independent source:
- the same value across settings, views and sequences;
- CAS answers checked back (differentiate, substitute);
- Giac's own test suite on our build;
- the golden cases on the phone;
- people who were never in the room.

Section 3 describes each check, and section 5 lists them as packages.

**When.** As a dedicated night, as soon as the queue now running (steps 30–59, started 14:00 today) has merged route R (R64, G46), the marks family (G48, G51, G56, G57) and the two instruments it already holds (G43 invariants, G55 behaviour diff).
- **Not before:** that queue rewrites the angle mode in every path and changes `homeEval.ts`, `numeric.ts` and `host.ts` again. A pass before it would test code that is gone by morning.
- **Not later:** the glue grew from about 1930 to 3171 lines in one night (night check 3.4), and the bugs live there (section 1). From milestone 5 on, the unit view and the outside testers (S8) put more paths in front of people.
- **The hardening night:** the new instruments (section 5), then an Opus pass (S16) that triages what they find into fix packages, and a second night for those fixes.
- **Meanwhile:** by day the UI path goes on unchanged (R15c1, R50c, R49 touch no engine code), and the night holds no engine features until S16 says done.
- **Afterwards:** the generators stay in the gate, so every merge is checked. The full pass repeats at each milestone close, before each outside-test round and before any release.

**Why it is urgent.** Two first sweeps today, about an hour of work, found these. None of them is in a golden file (section 2).

*In RAD, the code that stays after route R:*
- three inputs whose number is wrong under `≈` (F2–F4);
- seven whose `⚠ n` claims more digits than are right (F5, F6);
- `= 0` for an input that divides by zero (F8);
- four ways to freeze Home (F1).

*In DEG, the code G46 is replacing now:* four more wrong numbers under `≈` (F9). These are the checks to rerun once G46 merges.

The fixes are three packages (G58–G60) that can run at the front of the next night.

## 1. What the tests check today, and what found the bugs

**The gates** (tests/golden/README.md, docs/04 7.3):
- **Golden cases: 1089.** home 206, precision 113, solve 42, function 25, bench 55, units 119, parser 529, plus 16 forced interrupts.
- **Unit and end-to-end tests:** Vitest 1154 tests, 46 e2e specs, and 10 replayed key-sequence tasks.
- **The parser fuzz** (`input/fuzz.test.ts`) checks only that 20,000 token strings neither crash nor hang. It checks no values.

**Where the golden cases come from.** home.yaml has 153 `derived`, 102 `oracle`, 3 `assumed` and 1 `device` case. The sources are sound.

**What the golden cases skip.** Three gaps:
1. **Almost every Home case enters as Giac text** (213 case lines with `input:`, 20 with `latex:`). So the gate checks the engine side, and the keyboard-to-number path (MathLive LaTeX → our parser → Home) carries values only in those 20 cases, 26 precision cases and the 10 tasks. parser.yaml checks the Giac text, which is written by hand.
2. **The plot's drawing evaluator** (`input/emit-js.ts`, used by `apps/function/compile.ts`) is a second implementation of the maths in JS doubles. Its 30 test cases compare it with hand-written JS, never with Giac.
3. **Nothing has ever run Giac's own regression suite on our wasm build.** Giac 2.1.0 ships one in `check/`: 31 registered tests, 84 input files. Neither the emsdk build nor the release build (Debian's Emscripten, P2) has run it.

**What found the bugs so far.** Mostly reviews and targeted probes: the 21 paths of docs/04 2.3, D1–D12 and E1–E12 of the two deep checks, and the night check's 2.1–2.8. Mechanical checks found what reviews missed:
- G50's lost digit passed five audits, and a 30-input before/after battery found it in seconds (night check 2.4);
- the first invariant run found two DEG bugs in 169 inputs (deep check D12);
- a 1152-evaluation complex sweep found D6, D9 and D10;
- today's sweeps found F1–F9 in about an hour.

**Where the bugs are.** Not in Giac's symbolic core (section 2.3). They are:
- in our glue: global angle state, marks that do not travel, decisions at the display digits, text-matching helpers, the re/im split, BigInt work on huge exponents;
- in Giac's numeric edges: complex values, branch cuts, large arguments, divergent integrals, routines with no MPFR path, and Giac's extended reals (1/0 = ∞, 1/∞ = 0).

The tests should aim there.

## 2. Two first sweeps, 2026-10-19

### 2.1 Method
A generator built random expressions as keyboard LaTeX; Appendix B lists its pieces and the judge's rules. The same tree also printed as an mpmath expression. Each input went through `latexToGiac`, then `EngineHost.home` as the app calls it (one host for the whole run, as the app keeps one worker), and then `markOf`. A judge evaluated the tree with mpmath at 60 and 100 digits and checked the property above, part by part (real and imaginary).

**Run 1 (RAD and DEG).**
- 652 evaluations: 492 in RAD and 160 in DEG, at 12 and 30 digits. Inputs with an angle function also ran in DEG.
- 576 numeric results were judged.
- It stopped at its 247th input, on a DEG hang (F1).

**Run 2 (RAD only),** because route R replaces the DEG path today.
- 1,350 expressions (938 distinct) at 12 and 30 digits: 2,691 evaluations, 2,559 numeric results judged.
- It ran in 8 chunks of 250 under a 150 s timeout each, and 3 chunks stopped on hangs (F1).
- Marks shown: 751 `=`, 1,766 `≈`, 24 `⚠ n`, 18 `⚠`.
- Skipped as unjudgeable: 30 where the oracle was unstable (a pole, a cancellation), 22 conventions (a negative base to a non-integer power), 8 where the oracle was too slow.
- The parser refused 9 inputs, rightly: the generator wrote double superscripts that no key produces.

Before reporting, each flagged row was rerun on its own with `tools/probes/engine.ts`. Where it mattered, the row was also checked against raw Giac (`MODE=raw`) to tell our glue from Giac.

### 2.2 Findings
Oracle values are from mpmath at 30–40 digits. Every row is verified.

| # | Input (Home) | Shown | Right | Cause |
|---|---|---|---|---|
| F1 | RAD: `exp(1.5ᴇ8)`; `√(e^(2ᴇ8))`; `3+e^(1.5ᴇ8)/asin(3)`; `acos(5!^(2.5+5!))`. DEG: `acos(x)`, `asin(x)` for x ≥ about 10^200 (`acos(4096^120)` in run 1, `acos(10^400)`) | no answer after 20 s; `exp(10^7)` takes about 2 s and `factorial(10^6)` about 4 s on the desktop, against a 300 ms budget | an answer, or a refusal, within the budget | (a) `confirmedDigits` (`format.ts:486`, via `confirmedComplex`, `numeric.ts:546`) calls `fromScaled` (`format.ts:475`). That builds m·10^e as a BigInt at the full exponent (65 million digits for e^(1.5ᴇ8)) and long-divides it; there since G2 part 1 (`715e1e8`). A V8 profile puts nearly all of the time in `decimalFromRational` and `pow10`. (b) DEG: `floatsShown` runs `regroup(pasfl)` (`numeric.ts:147`; G38f1, `2e1a762`, last night), and Giac's `timeout 0.300` does not stop it. The `acos(5!^…)` case is not traced. Both causes are in our code; raw Giac answers in 0.4 s. In the app this should hang on "Working…" until Cancel (not run in the app) |
| F2 | RAD `√(√(asin(12)))` | `≈ −1.31937971748−0.37637063348i` (12 and 30 digits) | 1.31937971748−0.37637063348i (`oracle`; Giac's own `evalf` agrees) | Giac's symbolic `re()` of the nested root takes the other branch (raw `evalf(re(sqrt(sqrt(asin(12)))))` is −1.319…), and Home reads every complex value through `re()` and `im()` (`numeric.ts:515`). D5's mechanism, in RAD |
| F3 | RAD `(sin(3.7)−e)^(0.001·asin(6.02ᴇ8))` | `≈ 1.06987032752−0.000907172853153i`; at 30 digits `⚠ 13` with the same digits | 1.06966316881−0.0210723980676i (`oracle`; Giac's `evalf` of the decimal input agrees) | Giac's exact path for a negative base to a complex power (raw `evalf` of the exact input gives Home's value) differs from its own float path from the 4th digit. Both of Home's evaluations take the exact path, so they agree |
| F4 | RAD `log10(asinh(asin(e)))` at 30 digits | `≈ 0.230738949730667108894976990996−0.202384165793979775571642676368i` | 0.230738949730672683250514649292−0.202384165793980959013716890808i (`oracle`) | wrong from the 14th digit under `≈`: Giac's complex `asinh` of this argument is a double (`asinh(asin(e))` at 30 digits is already wrong from digit 14: 1.51974298540556418…, right 1.51974298540557562…). G50 audited asinh on 12 complex arguments, and this one is not among them |
| F5 | RAD at 30 digits: `cosh(acos(π))·tan(tan(10))`, `asin(sinh(π))·e^(12·3.7)`, `asin(12^acos(π))`, `acos(sin 1)·6020^asin(π)`, `sinh(asin(π))/asinh(1)` | `⚠ 14` | 12 or 13 right digits (Appendix A.1) | asin or acos of a real argument outside [−1, 1] comes back as a double. `shortDigits` (G42f1) trusts a double to one digit less than it prints, but the functions around it amplify its error. Both evaluations reuse the same double, so the agreement check cannot see it (docs/04 section 9 risk 1). G50 replaced complex *arguments*, not real arguments with complex *results* |
| F6 | RAD at 30 digits: `√(asinh(cos 10))`, `√(asinh(log₁₀ 0.001))` | `⚠ 13 4.708077403366E-15+0.873434670974i`; `⚠ 13 7.268811830619E-15+1.348497852884i` | pure imaginary: 0.873434670974…·i, 1.348497852884…·i | raw `evalf(sqrt(asinh(cos(10))),30)` has the same spurious real part, though `asinh(cos(10))` itself is right at 30 digits. Every digit shown of the real part is noise |
| F7 | RAD: `asin(acos(π²))`, `exp(cosh(asin(π)))`, `2.5·asin(π)^(e^10)`, `−2.7·acos(π)^(10!·π)`; `√(asinh(asin(3.7)))` | the input as Giac text; `undef` | 1.81211256762·i; −0.338882521038−0.432930352189·i; about −7.65ᴇ8365−6.04ᴇ8365·i; about −4.34ᴇ2941763+5.57ᴇ2941763·i; a value exists | lost answers, not wrong numbers; the last two lie within MPFR's range. A further group shows Giac's symbolic text because the value is past MPFR's range (`sinh(6020³)`, about 10^94748814570): neither a number nor a refusal. What the G2 shows for an overflow is a new G2 question |
| F8 | RAD and DEG: `√5/asinh(10)/(sin(5!)·(3/0))`, `exp(ln(0·2))`; also `1/(1/0)`, `5/(2·(3/0))`, `exp(ln 0)` | `= 0` | no value: a division by zero, ln 0 | Giac's extended reals: 1/0 is `infinity`, x/∞ = 0, exp(−∞) = 0, and Home marks the 0 exact. Home already shows `1/0` as "infinity" and `ln(0)` as "−infinity". docs/04 2.4 (G39) refuses "a number for something that does not exist"; by that rule these are refused. **For the owner:** refuse, or keep Giac's extended reals (G2 question: what the G2's Home shows for 1/(1/0)) |
| F9 | DEG (until G46): `log10(atan(2ᴇ−8))+3.7`; `log10((9.81−7)^tan(1.05))`; `ln(tan 3)+sinh 3·tanh 1`; `√(sin(e−π))` | `≈ −3.99897000434`; `≈ 0.782236597177` (30 digits `⚠ 13`); `≈ 4.68085476074+180i`; `≈ 0.085921759993+0.00235618417768i` (12 and 30 digits) | −2.24084737193; 0.00822389344970; 4.68085476074 (real); 0.0859540600796·i (`oracle`) | the angle read in radians inside a log or a power (the first two take atan and tan in radians), a spurious 180·i (π turned into degrees), and D5's complex read in DEG. Route R (G46) is meant to remove all four. When it merges, rerun these four lines; any still wrong joins G59 |

Two judged rows were the oracle's error, not Home's: `acos(cosh 1)^(120+(1.5ᴇ−15)^12)`. Home's `1+2.04E−178·i` is right, and mpmath at 100 digits lost the 10^−178 term. The real gate needs an oracle that raises its own precision until two runs agree, as oracle.py's N+20/N+50 rule does.

### 2.3 What came back clean
- **Giac's own suite on our wasm:** `integrate` 66/66, `limit` 51/51 and `factor` 31/31 give the same text as Giac 2.1.0's reference outputs (`check/*.out`). `normalize` needs a better runner (inputs with `\` continuations; assignments print `Done`). So far our build is Giac.
- **The plot evaluator against Giac:** a trial of 30 generated functions at 8 points each, in RAD and DEG. Of 420 comparisons only `x/x` at 0 differed: Giac simplifies the removable point, and the plot leaves a hole.
- **Engine state:** `restart(0)` from Find keeps our definitions (`tanh(i)` is still right after it). `median` reaches Giac as `pasmedian` through the parser (raw `median` is still Giac's, night check 2.5).
- **Run 2:** 2,513 of the 2,517 numbers shown with `=` or `≈` are right; the 4 wrong rows are F2 (two), F3 and F4. Of the 42 under `⚠`, 10 claim too many digits (F3 at 30 digits, F5, F6). The audited real functions held at both precisions.
- **Run 1's RAD part:** all numbers shown with `≈` are right. The only wrong `=` rows are F8's.
- **Branch on the real axis:** `asin(2)` = π/2 − 1.317i, as mpmath (Python's `cmath` takes the other side; the choice is a convention, section 6).

## 3. How we verify: one property, six checks

1. **The oracle sweep (the mark never lies).** The generator of 2.1, built from `spec/keyboard.yaml`'s templates so that it writes what the keys write.
   - It runs in RAD and DEG, at 12, 20 and 30 digits, in STD, FIX, SCI and ENG, and judges every claimed digit against mpmath.
   - It also judges `=` only for exact rationals, a number only where a value exists (F8), and an answer or a refusal within the budget (F1).
   - **In the gate:** a fixed seed of about 2,000 inputs, under 60 s, with a known-failures list as in G43.
   - **Each night:** a rotating seed at 50,000 inputs, report only; every new failure becomes a golden case.
   - It counts the `⚠`-without-digits rate as a noise budget, because a mark that is always ⚠ also says nothing.
   - The host runs in a worker thread with a deadline, so a hang is a finding and not a stuck gate.
2. **Sequences and state.** Random action sequences:
   - store ▶, Ans and tapped chips;
   - an angle, digits or format switch;
   - a function defined, then used in CAS and in Home;
   - Cancel in the middle, a worker restart with the defs replay (`host.restore`), a relaunch.

   The invariant: a line's value and mark depend only on the values of the names it uses, never on what ran before. D1–D3, sofia's findings 1–4 and the night check's 2.2 all needed a sequence. The deep check's scratch probe already builds chips the way `session.svelte.ts` does. G43 (d) is the first piece.
3. **One value in every view.** The same expression must give the same value in:
   - Home;
   - CAS `evalf`;
   - a Function Num cell, and Plot's drawing evaluator to 1e−9 in doubles;
   - Solve's back-substitution.

   This is the only check on `emit-js.ts`.
4. **CAS answers checked back.** CAS exact results carry no mark (docs/04 2.1), so each is checked another way:
   - an antiderivative is differentiated back;
   - a solve is substituted;
   - factor, expand, simplify and partfrac are compared numerically at random points;
   - a definite integral, a sum and a limit are compared with mpmath's `quad`, `nsum` and `limit`.

   Corpus: Giac's `check/` inputs, G55's corpus and generated inputs.
5. **The engine build.** Giac's `check/` suite, with a proper runner, becomes a stage of the engine gate for every build that ships, the emsdk build and the release build both. `compare-engines.ts` runs between the two. Today the only evidence that our wasm equals upstream is section 2.3.
6. **On the phone.** The golden gate's Home and precision stages run in the APK's WebView on the Tab One (like `?bench=1`, but checking values and marks), at each release. The Node run on the desktop is not the phone.

**Inside the app, one cheap guard** (G59): Home's exact path is compared with Giac's plain `evalf` of the input, which is a different code path in Giac. If the two disagree beyond the float's own digits, the result is `⚠` with no count. F2 and F3 would both have shown ⚠. This is the agreement check's missing half: two runs of the same path cannot catch an error that path always makes. It costs one `evalf` (about 1 ms on the desktop). The engine cost per Enter is already G53's subject, so G59 measures its share.

**Measuring the tests themselves (later).** Mutation testing (Stryker, Apache-2.0, dev only) on `format.ts`, `markOf` and the parser would show which wrong rounding rule no test would notice. F1(a) is the kind of fault it finds: a pure function nobody fed a huge exponent. Worth one package after S16, if the owner wants the measure.

## 4. When, in order

1. **The queue now running (it started at 14:00):** unchanged. It already holds G43, G52 and G55. When G46 merges, rerun F9's four lines (one command each); any still wrong goes into G59.
2. **The next night, first:** G58 (F1) and G59, G60 (F2–F6, F8). These are silent wrong numbers and freezes, so by the queue's rule they go before everything else. They change `numeric.ts`, `homeEval.ts` and `format.ts`, so they go after G46, which changes the same files. F8 needs the owner's word first (refuse, or keep Giac's extended reals).
3. **The hardening night**, as soon as the steps above are merged: G61 (the sweep), G62 (sequences), G63 (views), G64 (CAS checks) and A19 (Giac's suite). These are tests and tools only, Sonnet, night-safe. Then S16, the pass, as the night's Opus pass. Its FIX lines run in the same night (rules 0c point 5). The pass also decides whether the precision glue's text-matching helpers (`namesIn`, `functionsIn`, `complexReads`; night check 3.4) give way to Giac's own state (S13's question).
4. **The next night:** S16's remaining fix packages. Then the pass is done when a 50,000-input rotating sweep and 5,000 sequences find no new false mark.
5. **By day, whenever the tablet is connected:** A20 (golden on the phone), before S8's first outside round.
6. **From then on:**
   - every merge runs the gate stages;
   - every night runs the rotating sweep and the behaviour diff (A18);
   - the full pass repeats at each milestone close, before each outside round and before any release;
   - every bug anyone finds gets its golden case first (CLAUDE.md), plus one question: which generator should have found it? The answer extends that generator.

## 5. The packages (proposed; ids free on 2026-10-19 in docs/, to be checked with the other sessions)

| Id | What | Agent, model | Lane | After | Est. |
|---|---|---|---|---|---|
| G58 | Home never hangs: `confirmedDigits` and `fromScaled` work on (m, e) without expanding the exponent; `floatsShown`'s `regroup` only for texts under a size limit; a deadline for Home's JS steps that falls back to the float path or refuses; golden cases `exp(1.5ᴇ8)`, `√(e^(2ᴇ8))`, `factorial(10^6)` within budget, DEG `acos(10^400)` if it survives G46 | gorge, Opus | night | G46 | 1.5 h |
| G59 | The exact path checked against Giac's plain `evalf`: disagreement beyond the float's digits is `⚠`; a complex value read as `evalf` first and split after, not through symbolic `re()`/`im()` (F2); after the owner's word, a division by zero refused (F8); golden cases F2, F3, F8 and any F9 row G46 leaves; its cost in G52's count | gorge, Opus | night | G58 | 1.5 h |
| G60 | A double inside an MPFR result: asin and acos of real arguments outside [−1, 1], and complex asinh, join `COMPLEX_DEFINITIONS` or leave the audited list; the count of a double comes from a perturbation, not `shortDigits`; F4–F6 as golden cases at 30 digits; F7's lost answers as cases | gorge, Opus | night | G59 | 1.5 h |
| G61 | The oracle sweep as a gate stage (fixed seed) and a nightly run (rotating seed), host in a worker thread with a deadline, oracle with adaptive precision, known-failures list | gorge, Sonnet | night | G43 | 1.5 h |
| G62 | Sequences and state: random action sequences with the session's chip rule; the invariant of section 3.2 | gorge, Sonnet | night | G61 | 1.5 h |
| G63 | One value in every view: Home, CAS `evalf`, Num, the plot evaluator, Solve | gorge, Sonnet | night | G61 | 1 h |
| G64 | CAS answers checked back on Giac's `check/` inputs, G55's corpus and generated ones | gorge, Sonnet | night | G55 | 1.5 h |
| A19 | Giac's `check/` suite as an engine-gate stage, on the emsdk and the release build | annabell, Sonnet | night | — | 1 h |
| S16 | The hardening pass: all of the above at volume, triage into fix packages (ours, Giac's with an upstream report, a G2 question), the glue's structure | sofia, Opus | night (the pass) | G61–G64, A19 | 1 h + fixes |
| A20 | The golden Home and precision stages in the WebView on the Tab One | annabell, Sonnet | day (tablet) | — | 1 h |

Ten packages, about 13 hours of worker time (two nights), plus S16's fixes. G58–G60 matter most: they fix wrong answers users can see today.

**For Giac upstream** (backlog "Upstream reports"; drafted 2026-10-19 in `../outreach/upstream-reports.md`: F2 is draft G4, F3 is G3, F4–F6 are in G9):
- symbolic `re()` of a nested root takes the wrong branch (F2);
- the exact and numeric paths disagree for a negative base to a complex power (F3);
- complex `asinh` and real-argument `asin`/`acos` outside [−1, 1] have no MPFR path (F4, F5);
- `sqrt` of that asinh value gets a spurious real part (F6).

## 6. What this cannot prove

- **Errors mpmath shares with Giac:** unlikely, because mpmath is a separate implementation. For functions mpmath lacks, the result stays `⚠`, as today.
- **Conventions:** branch cuts on the real axis, `6÷2(1+2)`, complex values in DEG, what an overflow and a division by zero show. An oracle cannot decide these; the G2 can (g2.yaml), and the owner decides.
- **Inputs no generator writes:** the owner's daily use, S8's outside testers, and the owner's history as a corpus (exported on the phone, no names) cover these.
- **Answers that are right but unhelpful** (an unsimplified CAS result): not a correctness matter. Feedback.md is where those go.

## 7. How to rerun
Each finding is one line: `node tools/probes/engine.ts '<input>'` (the Giac text of Appendix A), with `DIGITS=30`, `ANGLE=deg` or `MODE=raw` as its row says. Wrap a hang in `timeout 20`. The sweep, the judge, the plot comparison and the `check/` runner were scratch scripts; G61, G63, G64 and A19 rebuild them in the repo from Appendix B. Giac's `check/` files are in `engine/giac/_downloads/giac-2.1.0.tar.gz`.

## Appendix A: every flagged row

Format: setting, the Giac text our parser sent, what Home showed with its mark, the oracle (mpmath).

### A.1 Run 2 (RAD), 16 rows
| Setting | Giac text | Shown | Oracle | Class |
|---|---|---|---|---|
| 12 | `sqrt(sqrt(asin(12)))` | `≈ -1.31937971748-0.37637063348*i` | 1.31937971748359…−0.376370633480…i | F2 |
| 30 | `sqrt(sqrt(asin(12)))` | `≈ -1.31937971748359272894104031897-0.376370633480293067317236344476*i` | 1.319379717483592728941040318971−0.376370633480293067317236344476i | F2 |
| 12 | `(sin(3.7)-exp(1))^(0.001*asin(6.02e8))` | `≈ 1.06987032752-0.000907172853153*i` | 1.06966316880832−0.0210723980675766i | F3 |
| 30 | the same | `⚠ 13 1.069870327518-0.0009071728531531*i` | as above | F3 |
| 30 | `log10(asinh(asin(exp(1))))` | `≈ 0.230738949730667108894976990996-0.202384165793979775571642676368*i` | 0.230738949730672683250514649292−0.202384165793980959013716890808i | F4 |
| 30 | `cosh(acos(pi))*tan(tan(10))` (twice) | `⚠ 14 -0.18062566019941` | −0.1806256601994271 | F5 |
| 30 | `asin(sinh(pi))*exp(12*3.7)` (twice) | `⚠ 14 3.0115832537695E19-6.0159789567343E19*i` | 3.0115832537699712ᴇ19−6.0159789567351941ᴇ19i | F5 |
| 30 | `asin(12^acos(pi))` | `⚠ 14 -0.14941871975496-0.87347285783806*i` | −0.14941871975491591−… | F5 |
| 30 | `acos(sin(1))*((6.02e3)^asin(pi))` | `⚠ 14 -492878.64256482+28354.30868788*i` | −492878.64256489325+28354.308687995597i | F5 |
| 30 | `sinh(asin(pi))/asinh(1)` | `⚠ 14 -0.62250143582795-2.7648029859926*i` | −0.62250143582799178−… | F5 |
| 30 | `sqrt(asinh(cos(10)))` | `⚠ 13 4.708077403366E-15+0.873434670974*i` | 0.873434670974013727…i | F6 |
| 30 | `sqrt(asinh(log10(0.001)))` | `⚠ 13 7.268811830619E-15+1.348497852884*i` | 1.348497852884…i | F6 |
| 12, 30 | `acos(cosh(1))^(factorial(5)+(1.5e-15)^12)` | `≈ 1+2.03805070974E-178*i` | the oracle's error (lost the 10^−178 term); Home is right | — |

Refused although a value exists: `sqrt(asinh(asin(3.7)))` → `undef` at 12 and 30 (F7). Lost answers shown as Giac text, values within range: `asin(acos(pi*pi))` → `asin(acos(pi^2))`, value 1.81211256762i; `(asin(pi)^exp(10))*2.5` → `asin(pi)^(exp(10))*5/2`, value about −7.65ᴇ8365−6.04ᴇ8365i (F7). Past MPFR's range, shown as Giac text: `(asinh(12)/(3/factorial(7)))*sinh((6.02e3)^3)`, `sqrt(tanh(factorial(3)))*cosh((1.5e8)^2)`, `asinh(9.81+factorial(5))^((1.5e3)^5/5)`, `(1+12)^sinh(factorial(7)*3.7)`, `abs(factorial(7)-(6.02e22))^1.5e22` and others (F7).

### A.2 Run 1 (RAD and DEG), 14 rows
| Setting | Giac text | Shown | Oracle | Class |
|---|---|---|---|---|
| RAD and DEG, 12 and 30 | `sqrt(5)/asinh(10)/(sin(factorial(5))*(3/0))` | `= 0` | no value (3/0) | F8 |
| RAD 12, 30 | `exp(ln(0*2))` | `= 0` | no value (ln 0) | F8 |
| DEG 12 | `log10(atan(2e-8))+3.7` | `≈ -3.99897000434` | −2.24084737192685 | F9 |
| DEG 30 | the same | `≈ -3.998970004336` | −2.240847371926846647239665612765 | F9 |
| DEG 12 | `log10((9.81-7)^tan(1.05))` | `≈ 0.782236597177` | 0.00822389344969854 | F9 |
| DEG 30 | the same | `⚠ 13 0.7822365971767` | as above | F9 |
| DEG 12, 30 | `ln(tan(3))+sinh(3)*tanh(1)` | `≈ 4.68085476074+180*i` | 4.68085476073701024411174514342 (real) | F9 |
| DEG 12, 30 | `sqrt(sin(exp(1)-pi))` | `≈ 0.085921759993+0.00235618417768*i` | 0.0859540600795995346998653472299i | F9 |

Lost answers: `exp(cosh(asin(pi)))` shown as itself, value −0.338882521038−0.432930352189i; `(ln(exp(1))-3.7)*(acos(pi)^(factorial(10)*pi))` shown as `-27/10*acos(pi)^(3628800*pi)`, value about −4.34ᴇ2941763+5.57ᴇ2941763i (F7). Shown as `infinity`, `+infinity`, `-infinity` or `undef` where no value exists (`ln(sqrt(1/0))`, `exp(abs(1.05/0))`, `asinh(sin(2e22/0))`): not counted as wrong, part of F8's decision.

### A.3 The hangs
| Run | Setting | Input (LaTeX as generated) | Reduced to |
|---|---|---|---|
| 1 | DEG 12 | `\arccos\left(\left(2^{12}\right)^{5!}\right)` | DEG `acos(x)`, `asin(x)`, x ≥ about 10^200 (10^100 takes 0.5 s) |
| 2, seed 101 | RAD 30 | `\sqrt{e^{2\emark8}}` | `exp(1.5e8)` at 12 or 30 digits |
| 2, seed 102 | RAD 12 | `\arccos\left(5!^{2.5+5!}\right)` | not reduced |
| 2, seed 107 | RAD 30 | `3+\frac{e^{1.5\emark8}}{\arcsin\left(3\right)}` | `exp(1.5e8)` |

The Giac calls Home makes for `exp(1.5e8)` all return within milliseconds (the last is `evalf(im(pasans),60)`); the time is then spent in JS. For DEG `acos(10^400)` the last call is `regroup(pasfl)`, which does not return.

## Appendix B: the scripts, enough to rebuild them

**Generator.** A seeded LCG (seed × 1103515245 + 12345, 31 bits) builds a tree of depth up to 3. A node stops at a leaf with probability 0.25.

*Leaves:*
- 45 %: integers 0, 1, 2, 3, 5, 7, 10, 12;
- 25 %: decimals 0.1, 0.2, 0.3, 2.5, 0.001, 1.05, 9.81, 3.7;
- 10 %: π; 5 %: e;
- 7 %: ᴇ-numbers 1.5, 2 or 6.02 ᴇ ±3, ±8, 22, −15 (bracketed before a power, as the parser asks);
- 8 %: 3!, 5!, 7! or 10!.

*Nodes:*
- 35 %: one of sin, cos, tan, arcsin, arccos, arctan, sinh, cosh, tanh, asinh, ln, log, as `\fn\left(…\right)`;
- 7 %: `\sqrt{}`; 5 %: `e^{}`; 3 %: `\left|…\right|`;
- 12 %: +; 10 %: −; 10 %: `\times `; 10 %: `\frac{}{}`; 8 %: `^{}`.

An operand that is not an atom gets `\left(…\right)`. Each node also prints its mpmath form (`mpf('2.5')`, `POW(a,b)`, `factorial(n)`). Inputs with an angle function ran in RAD and DEG, the rest in RAD; each at 12 and 30 digits with `workDigits = max(30, digits+10)`. One `EngineHost` served the whole run, as the app keeps one worker.

**Judge.** mpmath evaluates each tree at 60 and at 100 digits.
- If the two differ by more than 10^−45 relative, the row is "unstable" and skipped.
- A negative real base with a non-integer exponent is a convention and skipped; so is a complex argument or result in DEG.
- ZeroDivisionError, or a non-finite result, means "no value".
- DEG wraps the trig functions as x·π/180 in and ·180/π out.

Each part (real, imaginary) of the shown number is then checked:
- under `=`, it must equal the oracle to 10^−50;
- under `≈`, it must be within half a unit of the 12th or 30th digit (the setting);
- under `⚠ n`, within one unit of the nth digit;
- `⚠` without a count claims nothing;
- a part not shown must be below two digits past the claim, relative to the value;
- a shown part where the oracle has 0 is wrong.

Each case has a 3 s limit (SIGALRM), and results are cached per input and angle.

**Plot comparison.** Expressions in x build the same way. `compileDefinition(latex, angle)` gives the JS function. Giac computes `evalf(subst(<giac>,x=v),20)` with `angle_radian` set to match. The two must agree to 10^−9 relative at x ∈ {−2.7, −1, −0.5, 0, 0.3, 1, 2, 4.5}, where Giac's value is real.

**Giac's suite.** Split `check/test<name>` on `;` + newline, run each input with `giac.eval`, and compare it with the matching line of `check/<name>.out`. Where the text differs, a difference that `simplify` takes to 0 counts as equivalent; for integrals that is the derivative of the difference. Failing that, a numeric check at x = 0.37, 1.73 and 2.9. Line continuations (`\` + newline) and assignments (`Done`) need handling before `normalize` and the `chk_fhan*` sets can run.
