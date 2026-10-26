// SPDX-License-Identifier: GPL-3.0-or-later
// The golden gate: every tests/golden/*.yaml file against one engine build. Run it on every engine
// build that ships (CLAUDE.md). Exit 0 only if every stage passes.
//   npm run golden                                  # engine: $GIAC_MJS, else $GIAC_OUT/giac.mjs, else engine/giac/_out/gsl
//   GIAC_MJS=/path/giac.mjs ROUNDS=5 npm run golden
//   ONLY=home,parser npm run golden                 # stages: interrupt, steps, flags, home, precision, solve, function, bench, calls, invariants, units, parser
// Typed Giac text in a case (`input`, `before`, step inputs, `eq`, `f`, `g`) gets the parser's angle rule first (G46).
// Stages:
//   interrupt  tests/engine/interrupt-test.mjs (Giac patch 0002): 16 forced interrupts, no escapes
//   steps      G82 (patch 0004): tests/engine/step-budget-test.mjs (a step budget interrupts at the same count on a fast
//              clock), and scripts/golden-speed.ts: every home and precision case gives the same display, mark and copy text on a clock
//              8× fast (the Tab One is 5-8× slower); the cases that still differ are listed as known (SPEED_KNOWN), a new one fails
//   flags      (and regress, G108: tools/giac-regress/run.mjs on the three committed files: check lines pass, known lines fail,
//              patched lines pass; tests/engine/regress-fresh.mjs: export.mjs gives the committed files)
//              tests/engine/flags-canary.ts (G67): every field of Giac's context in the pinned source is read and restored
//              by the host's settings check or listed with the reason (app/src/engine/flags.ts CONTEXT_FIELDS);
//              tests/engine/ctx-canary.ts (G102): each of bridge-1's fields set and printed back by Giac's getter;
//              tests/engine/tanh-test.ts and patch-canary.ts (G75): patch 0003's complex tanh against mpmath, and its
//              cause still in the pinned tarball; tests/engine/mpfr-pi-test.ts (G60): patch 0005's ln, asin, acos, acosh;
//              tests/engine/reim-test.ts (G96): patch 0006's re and im of a root of unknown sign;
//              tests/engine/support-test.ts (G111): patch 0007's densities and cdfs outside their support, 0008's fracmod;
//              tests/engine/canaries.mjs (S17, G77): every workaround row still holds on the engine, so a re-pin that
//              flips one fails here; tests/engine/fetch-test.mjs (G77): the pin's fetch checks the tarball against its .dsc
//   home       exact-first Home through EngineHost: every case matches with its mark, same in every round,
//              median ≤ 500 ms (a case's `budgetMs` instead, G82); a mark-only case (no `expect`) checks the mark and that an answer came back. A case with
//              `steps` (G34) is a sequence on its own engine: each step's input (or latex, with \ans as the session
//              builds it from the step before) runs in its own angle mode, and the last step is checked. An `input` step
//              may name the result of step k as the chip `pasr_<k>` (G49: sent with a chip table of values and facts);
//              the case's `settings.digits` and `consts` (G26's constant table, `pasc_<id>`) hold for every step. A
//              step with `view: cas` runs in CAS (G49f3), never as the last step. A
//              result shown with ⚠ n (n below the digits) must equal `expect` rounded to those n digits
//   precision  tests/golden/precision.yaml (docs/04 2.3 regression list, 20/30-digit cases): Home and CAS at the case's
//              digits, value and mark; `before:` inputs run first on the same engine. `budgetMs` (G58): the case's
//              wall time at most; with no expect and no mark it checks only that, and that it answered or was refused.
//              A case with `status: pending` is
//              known to fail until its fix: it never fails the gate, and is listed as still pending or now passing. A
//              result shown with ⚠ n (fewer confirmed digits than asked) must equal `expect` rounded to those n digits.
//   solve      Solve strategy: 1-D (solve1.ts), one equation through the engine (kind one), systems and polynomials
//              (solve.ts), at the case's digits; every case matches in every round, and no ⚠ (a failed residual check
//              or fewer confirmed digits than asked) unless the case has status "warn"; a root shown with ⚠ n must
//              equal `expect` rounded to those n digits
//   function   Function analysis and Num table (analysis.ts), same rules
//   bench      the 55 benchmark inputs in CAS mode: `expect` (derived) cases match; errors are listed. Then in DEG (G46):
//              every input that answers in RAD answers, `deg` pins a DEG text, an angle-free one shows the RAD text
//   calls      G52: Giac calls per input, bridge calls included (G99) (bench in CAS, home.yaml's single inputs in Home, 12 digits); prints the totals and
//              the five largest; fails when calls per input are over 10 % above tests/golden/calls-baseline.yaml
//   invariants G43: every home.yaml and precision.yaml input without settings, across settings (no expected values):
//              (a) no angle function: the same text in RAD and DEG; (b) 12 and 30 digits round to the same 12-digit text;
//              (c) the copy text read back by the paste reader gives the same text and mark; (d) `X:=input` in one mode, then
//              `X` in the other, shows what the store line showed. Passes when the failures are exactly those in
//              tests/golden/invariants-known.yaml (a new failure, or a known one that now passes, fails)
//   units      tests/golden/units.yaml: the unit view (G16) on the Find index's factors (app/src/find/_gen, `npm run index`):
//              value, mark, exact text and dimension, or the refusal's message, the same in every round; desktop p95 of
//              an evaluation ≤ 5 ms (docs/04 8.3), warm, each case at its fastest of five passes
//   parser     LaTeX → Giac (our parser) equals the intended expression, decided by Giac; gaps never fail.
//              A case with `error: true` passes when the parser rejects the input (a message, never a guess);
//              `chips:` is the entry's chip table (\res, \ans, \const; docs/04 section 3.6). R28: a case with
//              `options: { units: true }` is the unit view's formula: `formula` is the exact text the parser must give,
//              `slots` (and `to`) the slots in unit-case.ts syntax, and `expect` the Giac text G16's builder makes from
//              them (needs the Find index, as the units stage does)
// The stages are one module each under scripts/golden/ (lib.ts: the shared helpers and the report).
import { mjs, want, summary } from "./golden/lib.ts";
import { stageFlags, stageInterrupt, stageSteps } from "./golden/engine.ts";
import { stageHome } from "./golden/home.ts";
import { stagePrecision } from "./golden/precision.ts";
import { functionCase, solveCase, stageCases } from "./golden/cases.ts";
import { stageBench } from "./golden/bench.ts";
import { stageCalls } from "./golden/calls.ts";
import { stageInvariants } from "./golden/invariants.ts";
import { stageUnits } from "./golden/units.ts";
import { stageParser } from "./golden/parser.ts";

console.log(`golden: engine ${mjs}`);
if (want("interrupt")) stageInterrupt();
if (want("steps")) await stageSteps();
if (want("flags")) stageFlags();
if (want("home")) await stageHome();
if (want("precision")) await stagePrecision();
if (want("solve")) await stageCases("solve", "solve.yaml", solveCase);
if (want("function")) await stageCases("function", "function.yaml", (host, _g, c) => functionCase(host, c));
if (want("bench")) await stageBench();
if (want("calls")) await stageCalls();
if (want("invariants")) await stageInvariants();
if (want("units")) await stageUnits();
if (want("parser")) await stageParser();
const failed = summary.filter((s) => !s.ok);
console.log(failed.length ? `\nGOLDEN GATE FAILED: ${failed.map((s) => s.stage).join(", ")}` : "\nGOLDEN GATE PASSED");
process.exit(failed.length ? 1 : 0);
