<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Status and backlog

The one place for "where are we and what's left", one or two lines per open item. The architecture is [04-architecture.md](04-architecture.md) (it supersedes [02-architecture-plan.md](02-architecture-plan.md) where they differ; 02 section 12 keeps the milestone history); decisions are in [decisions.md](decisions.md); the order of the packages is [shifts/brief.md](shifts/brief.md) section 0, and each package's cause, steps and tests are in its file in [shifts/packages/](shifts/packages/). Done items leave this file (git history and [archive/backlog-2026-10.md](archive/backlog-2026-10.md) keep them).

## Where we are

| Stage | State |
|---|---|
| Phase 0 spike; MVP milestones 1 (Home, CAS), 2 (Function, Solve), 3 (Python, removed by P11) | **Done** 2026-10-11 (reports in [archive/shifts/](archive/shifts/)) |
| **The core freeze (P23)** | **Ended 2026-10-27** (owner). Its net stays: [tests/core/](../tests/core/README.md) (66 everyday tasks, all active) runs on every merge and on the night's device; a red case is a bug to fix. |
| Milestone 4a: feel (P11) | Built: the entry work, sheets, flicks, Settings in the Mode sheet (R49, R87), history-row actions, R15b–R15c4, the mockups and the visual pass (R12a, R12b), press feedback only (R12c), TalkBack names and font scale 2.0 (R41), σ on tap (R40), the mark style (R124), the digit-group separator (R125). Waiting: the palette, results mode, the trust features |
| Milestone 4: Find and trust | Engine side done (marks, 30 digits, chips, copy, defs, the Find index, the size test, A4a); Find's UI: R4a, R4b built; A4b measured 2026-11-05: Find per key p95 31.9 ms against 16 ms, a miss (decisions.md); R132 built (6x-throttled desktop p95 24.9 → 11.2 ms: rows in view only, the search narrowed per key), then A4b again on the Tab One by day; the gate is not complete |
| Milestone 5: Units | Built: the evaluator on Giac (P15), the pad, the entry and Find in a slot (R24a–R24d), the result's alternatives and view (R60–R63), ± (R71), menu Constants and Tools (R92) |
| Milestone 6: Structure | Not started (EN5–EN7, Help) |
| MVP release | v0.1.0, the APK and the website from one tag, on Sun 11-15 if the bar is met: [release-0.1.0.md](release-0.1.0.md) |

Work continues on `phase-1`; `master` follows it from 2026-11-03 (decisions.md, the release path).

## Needs the user
0. **The core list (P23):** cut or extend [tests/core/core.yaml](../tests/core/core.yaml) (66 cases; tell a session what to drop or add); do the [morning check](../tests/core/MORNING.md) on the night's device (about 10 minutes, 15 cases; tell the day session what failed); keep the night's device plugged in, unlocked and on the charger (A32, A33). The one-time checks: [ONE-TIME.md](../tests/core/ONE-TIME.md).
1. **Your outreach steps** (decisions.md P18–P22): send Parisse email 5 (patches 0013–0026 and the regression files at `a330698`, pushed; `../outreach/email-parisse-5.md`); mirror G77's pin (`gh` logged in; the command is in `engine/giac/README.md`).
2. **G2 questions:** the unanswered items of `tests/golden/G2-CHECKLIST.md` (41, 42, 52, 56, 63–71; each package built a default, named in decisions.md; 63–65 can reverse S14's route R); the optional real-G2 spot checks (`spec/mapping/vc-2026-10-11/SPOT-CHECK.md`).
3. **From daily use:** the key sequence that left ⌫ stuck "at log" (F39); feel R112 (one pulse per touch, merged) on the next build; more points into [feedback.md](feedback.md).
4. **The new application id** (`io.github.buerlino.pascaline`): the next APK installs as a second app; copy what you need from the old one, then uninstall `org.pascaline.app`. Android's own backup is off (A23).
5. **Tap "Allow USB debugging"** on a device when it shows `unauthorized`.
6. **v0.1.0** (the days: [release-0.1.0.md](release-0.1.0.md)): the test tag on 11-03; go or slip on 11-14; read the usage meter each morning and at each lane start (tripwire 85 %). **A49/A52, switching a broken web worker off:** `app/pwa/README.md` (the kill run on the deployed tag, up to 90 min; the fixed tag's normal run brings the worker back).
7. **Later:** the outside rounds (two 30-minute rounds after R4b and R24c, [r18](research/r18-outside-test.md)); at milestone 5, time ten tasks by hand (E-notation against units).

### Upstream reports (owner; drafts in `../outreach/upstream-reports.md`)
- **MathLive**, filed 2026-10-19: [#3122](https://github.com/arnog/mathlive/issues/3122) (⌫ at `\left…\right`), [#3123](https://github.com/arnog/mathlive/issues/3123) (touch caret), [#3124](https://github.com/arnog/mathlive/issues/3124) (focus restore); [#3125](https://github.com/arnog/mathlive/issues/3125) (Redo after ⌫, 2026-10-20); M5 (`isImplicitArg` takes no matrix, F68) drafted by R75.
- **Giac**, not filed yet. Regression files: `tools/giac-regress/` (G89; `pascaline-patched.cas`: fails on stock giac_2.1.0-1, passes with our patches; in the golden gate since G108). 0003–0012 sent (email 4), 0013–0026 go with email 5 (item 1); the rest as four forum threads; new since: `simplify`'s assume leak (G92: subst.cc:2419, 2802), `restart(1)` clearing nothing (G93: VARS(1) lists equations, usual.cc:251), a typed string ending in a backslash refused inside brackets (G105f1), the laplace VARS() garbage (F89), stock `int(ceil(x),x,1/2,3/2)` = [1,1.5] (right 3/2; intg.cc's falling floor split, patch 0029 part 2).

## Tasks

### Open bugs (everyday reach; order: brief section 0; family n: [bug-patterns.md](research/bug-patterns.md) section 3; each line names its package, which holds the evidence)
- **F179, package G171 (sandra, 2026-11-05).** With `A:=[[1,2,3]]` and a program that stores (`g(M):={cnt:=cnt+1;return M;}`), Home and CAS `A^2+g(1)` show = 15, `g(A)^2` = 14, `inv(g(A))` a row: the non-square check gives up when the input calls a storing function. Silent, with your own programs.
- **F180, no package (sandra, 2026-11-05).** Share session writes template LaTeX half-read: `\sum_{k=1}^{10}k` → `\sum_k=1^10k`, `\sqrt[3]{8}` → `\sqrt[3]8`, `\lim_{x\to0}x` → `\lim_x → 0x`; their plain form is a design question (R134 takes the Greek letters).
- **F85, no package (G102's Not done; cost only).** A Home input with chips is parsed twice per Enter (G100); the parse is its own bridge-2 call, so G102 could not fold it.
- **F80, package G179 (G99; `tools/probes/bridge-forms.ts`).** After Home `(BesselJ(1,2))=>y`, `int(y^2,y,0,1)` shows `⚠ 0.333333333333` (right `≈`): Home stores at Digits 40, where `=>` keeps y as `BesselJ(1,2)` unevaluated, and Giac's int with that y errors (Bad Argument Value). `y:=` keeps the float. Test: `boundNames.test.ts` (`it.fails`), seqsweep `12 bound: int…`. Family 8.
- **F73, package G172 (it waited for the end of the freeze; owner, 2026-10-24; G103 reads the doubles).** A double in a list shows Giac's text (`[BesselJ(1,2),1/3]`), not numbers with ⚠; no wrong value reaches the screen. Left: `hasFloat` (reads `1..3` and strings). Families 5, 6.
- **F171, package R134 (R40f1's Not done).** A picked row's why-line names a Greek constant chip by its LaTeX: G times α reads `≈ uses G (± …), \alpha (± …)` (whyLine.ts constantsUsed takes the chip's LaTeX name). Family 9.
- **F170, package G176 (G157f1's Not done).** `limit(trunc(x),x,-1,1)` shows = -1 (right 0): Giac's limit substitutes -1, since trunc has no series rule and is not in series.cc's sign/floor/ceil/round list (floor has taylor_floor). Golden `g157f1-limit-trunc-neg1-right` pending. Families 3, 8.
- **F172, A73 measured (report).** Stored history costs nothing (200 stored, Home last: 1274 ms against 1299 empty); the rows drawn at start do, by content: 20 program-definition rows 1821 ms, 20 plain rows 1469, 5 program rows 1345 (bar 1.5 s). A CAS-view start with nothing stored is also 1499 (worker's wasm instantiate slower), cause open. Packages R133 (lane A) and A73f1 (lane B).
- **Night review 2026-11-02:** the rest in [research/night-review-2026-11-02.md](research/night-review-2026-11-02.md).

### Background stream (extreme inputs; at night, by reach)
- **F167's rest, no package (G160).** Not checked: patch 0018's double test for a base past 1E308. Family 3.
- **F87, package G174 (G93's report).** CAS `restart(0)`, `restart_vars(0)`, `restart(1)` and Home `restart(1)` show "pcasans: recursive definition" (pasans in Home): the answer lists our Ans slot's own name. The command took effect. Our name on screen (family 9); not reachable by keys until Find.
- **F88, package G171 (G105f1's report).** nonsquare.ts reads Giac's print of `string(part)` (a quoted string, quotes doubled), so changesState and functionsIn find nothing in it: a candidate that stores or calls a user function is evaluated again (G101 says not). Reading it with parsePrinted changes which F69 refusals happen: its own package and tests.
- **F89, package G170 (G92's report).** Giac's `laplace` and `ilaplace` on tanh(sqrt(x)) leave VARS() entries that are no names (bytes, empty, error texts), then garbage after every command: freed memory in Giac's variable list. The put-back skips them. Not reachable by keys (laplace needs Find); an upstream candidate. Also `ilaplace(1/(x^2+1)^2)` (G110's census).
- **F90–F97 (G110's census; rerun `node tools/probes/find-census.ts <name>`; `findcensus-known.yaml`).** Find's tier-1 functions on Giac's own examples, in Home and CAS. F93, F96 and F97 have no package (the rest: G111, G113, G113f1, R80f1); an exact input past Home's budget (`negbinomial_icdf(1,1/10^6,1-1/10^6)`) shows Giac's `User interrupt or Out of memory`, not a plain refusal. Family 5.
- **F93.** No answer shown as Giac's word: `undef` (`znorder(17,0.5)`, `circumcircle(0,1,1+i)`, 34 runs), Home `Airy_Ai({1,2})` = `[Airy_Ai(1),Airy_Ai(2)]`, CAS `binomial_icdf(4,0.5,3)` unevaluated with floats, `when` as C's `?:`.
- **F96.** Names left that the definitions log does not hold (not in Vars, gone after a relaunch): `gbasis` (lastgb), `syzygy` (lastv), `GF(2,8)` (K, g), `wz_certificate` (k, n), and the name arguments of `QR`, `LU`, `Fill`, `CopyVar`, `point3d`, `is_hamiltonian`; `debug(…)` turns on Giac's debugger, after which every program call, our helpers too, throws `prompt is not defined`; `interactive_plotode` throws the same (both left out of Find, G111).
- **F97.** CAS has no answer within 6 s (600 s hard timeout): `ellipse(-1,1,point(1+i))`, `hyperbola(…)`, `ecm_factor` of a 73-digit number; Home refuses them after 2 s.
- **F105, package G169.** Home `normald_cdf(0,1,{1/2,3/2})` stays the symbolic `(erf({…})+1)/2`, no numbers (erf of a list in the exact form); honest, no value.
- **F115, package G178 (Opus pass 83).** Home `3*int(1/x,x,-1,1)+1` at the default budget shows ⚠ 1 (unchecked), not the refusal the bare `int(1/x,x,-1,1)` gets: the divergence checks need about 20× the steps. Flagged, so honest; family 5.
- **Flaky under load.** Golden `interrupt` (F128, run 307: `expand((x+y+z+1)^40)` at timeout 0.2 s took 406 ms of 400; pass 10: a second sighting puts it into `isTiming`); golden `units` (p95 5.82, 7.93 ms, limit 5; reruns once, A51) and `invariants` (65.5 s, limit 60; no rerun) beside the other lane (passes 32, 34, run 415); e2e `app/test/unitresult.spec.ts` (pass 67): a More…/Find test or the Wh tap misses a 5 s wait under load, a different one each time (run 577 too).
- **F70, package G184 (to verify: gorge).** Home Σ with a numeric bound fails after about 1 s with "The calculation failed", not a time-limit message: Σ_{x=1}^{100000} 1/x, Σ_{K=1}^{2000} cos(K)/K (desktop, `e0d03ed`); to 10^6 Giac closes it (⚠ 14.3927267229). Whether Home's deadline or an engine error.
- **F71, package R135 (to verify: ron).** CAS Σ_{k=1}^{2000} cos(k)/k (3 s) shows its result as raw LaTeX text (`\frac{15111779…`), not drawn (docs/04: never raw engine text); a size cut or MathLive's limit.
- **F61.** Two-argument `round`/`trunc` work in a double: patch pending (decisions.md G71). Family 4.
- **F62, package G185.** `sin(cosh(10!))` takes 11 s in Home; the 2 s deadline misses; G82 does not stop it (one call, 20 checks). S16: also `tan(cos(sinh(10!)))`, `cos(cosh(10!))`, `tan(sinh(1.5ᴇ8))`, `log(asin(√(2ᴇ22)))`.
- **F63, package G179.** A stored ⚠ value (`BesselJ(1,2)`) read through a function, after a relaunch or by its name shows one confirmed digit fewer than the value itself (11, not 12: cautious, not wrong; `tests/golden/seqsweep-known.yaml` 6–7).
- **F108, package G173 (Home and CAS, owner 2026-11-05) (Home fixed by G119).** CAS `fMin(x^2-2*x+1,x)` still shows Giac's `seq[1]` (census `cas fMin/0`, `cas fMax/0`); Home `op([])` shows `seq[]`. Family 5.
- **F109, package G168.** Home `DelAVars()` shows `DelAVars`, its own name: no answer and no refusal. Family 5.
- **F122, package G187, G183 (G116).** Home `(atan(ln(-π)+9007199254740993))^(sin(10^-300)-10^300)` kills the engine (stack overflow inside Giac's wasm); also `(asinh(∛0.5))^((π/2+10^-3)^((90+10^-3)/(π/2+10^-6)))` (G120). G94's kind.
- **F127, package G173 (G130's Not done).** A matrix inside a list keeps Giac's word: Home and CAS `[idn(2),1]` show `[matrix[[1,0],[0,1]],1]`, `list[idn(2)]` `{matrix[[1,0],[0,1]]}`; and Home `zeros(2,3)` costs 13 Giac calls per Enter (was 10; G130's bar was one more). Family 1.
- **F137, package G177 (G135).** Home `cos(atan(1+i)/2)` ≈ -0.891156571011+0.0986295774757·i, right the negation; also sin, tan of it, `cos(acos(2*i)/2)`: Giac's half-angle rules (`usual.cc` is_half_atrig) take the sign from a complex evalf. Family 8.
- **F134, package G175 (G132).** CAS `simplify(sqrt(acosh(-1/2)^3))` and `normal(…)` give the other root (right 2.14325044527-2.14325044527·i), before and after patch 0018: their own rewrite. Family 3.
- **F135, package G175 (Opus pass 12).** Giac's `sqrt(exp(z))` = `exp(z/2)`, no branch check: `sqrt(exp(3*acosh(-2)))` evalf -7.20976852011·i, right +7.2097…·i. Home's mark not checked. Family 3.
- **F161, fixed by G154 (left, no package).** An underflow whose size Giac cannot state (`exp(-10^30)+exp(-10^31)`: no finite re(lnexpand(ln(e))), e^(10^-1000) is 0) shows ⚠ 0 again, as before G84; was "Underflow". Family 3.
- **F155, G141 (G137, G138).** Past `MAX_EVAL_DIGITS` (S20 the cure): `tan(1ᴇ1000)` ⚠ 1 with a wrong digit, right -0.863036686363. Its 699 nightly rows: the 685 from F151 are below the cap, and those probed pass since G141 (Opus pass 70); the next nightly lists them as now passing and its triage drops them.
- **F145, package G186, G183 (G120, G137).** Nightly sweep hangs: acos/asin/acosh of a huge real and acosh(1ᴇ-1000) (G120, 20), DEG `sin(asinh(1ᴇ-300))`, `∛1ᴇ1000+e^acosh(-2)`, `atanh(asin(1ᴇ-300))^atan(…)` (G137, 6); G138: 9 more, mostly over (√(a+10^-k)-√a)·10^k+b, and 4 wasm "unreachable" traps in arctan, arccos of it; triage files their rows under F145. The sweep oracle (`tools/probes/sweep/oracle.py`) drops a part of mpmath's acosh and acos of a tiny complex (G137's 2 oracle rows).
- **F178, package G182 (G141f2).** Past `MAX_EVAL_DIGITS` the why line says "evaluated once, nothing to compare" (whyOf, symbolicWhy: unchecked is once), though P and P+20 were compared. Family 1.
- **F173–F177 (G138; golden `g138-*`, oracle values): F173 fixed by G165 (patch 0031), F175 and F176 fixed (right since G141; rows active since G165), F174 fixed by G166 (patch 0032), F177 [G181](shifts/packages/G181.md).** Home: F173 `acos(cos(10^-50))` showed = -1E-50 (a tie of a/π at Digits 40 in Giac's asin(sin) rule); F174 `atan(tan(10^15))` ≈ 2.10969811707, outside atan's range; F177 `atanh(pi*1ᴇ-1000*sqrt(-1))` ≈ -z²/2, right z.
- **F159, package G180 (G149f1).** DEG `sqrt(asinh(asin(3.7)))` ⚠ on the desktop, ≈ on the 8× clock; golden `g149-deg-sqrt-asinh-asin-3.7-*` pending.
- **F162, package R134 (R63f2).** Share session on a unit row with a rare prefixed pair (Mm, kpsi: slot.ts draws it in a pas-rare class) writes the request as 5 \classpas-rareMm → m: entryText (clipboard/text.ts) does not drop the class wrapper. Value and unit right; fix: drop the class wrapper in entryText, with a test. Family 1.
- **G94, package G188.** Depth-3 generated trees in the view sweep crash the in-process engine (wasm memory out of bounds; also the nightly view sweep at count 300, seed 20752); raw output: `../drafts/2026-10-21-packages/g94-raw`.
- **The hardening without a bug line:** r16's end mark, a 50,000-input sweep with no new false mark, is not met (Opus pass 82; G94 stops the view sweep at volume); the nightly `--edges` sweeps found F119–F123 (G116), F129–F133 (G120), F140–F145 (G137), F173–F177 (G138; triage files `.tasks/sweep-*-triage.md`); A44: `tests/golden/sweep-nightly-known.yaml` holds the nightly sweep's open rows (F122, F144, F145, F155); the gate never reads it.

### Next (packages and order: brief section 0)
- **Units (milestone 5; docs/04 section 4):** the first unit result on the Tab One and the Fairphone 6 (< 1 s). Gate: tasks 1–4 and 10; a unit in ≤ 4 presses at the median; `units.yaml`; the owner's hand timing.
- **Milestone 6, Structure** (not packaged): EN5 matrices with Shift + 5 and the editor on Shift + 4 (§5.3; the Tmpl matrices work today), EN6 number bases, EN7 everyday functions, Help as context help; EN4, copying one element of a list or matrix.

### Without a package yet
- **R41's device check** (annabell, the next device run): TalkBack for a minute on the keypad and a sheet, and the status line at font scale 2.0 (decisions.md "R41").
- Plots of user functions after v0.1.0 (owner, 2026-11-02; R56b covers Solve); **R58b** Alpha letters are always names in CAS (G2 item 62 can reverse it).
- **G9. Number formats against the G2** (item 15): decide in the settings and help pass. **K1:** a pending one-shot Shift is used up by the first drag step. **K5:** the gestures in the help texts.
- **A9's leftover:** the strength slider does nothing on a motor without amplitude control (Fairphone 6); a composition of ticks would give it (owner, 2026-11-02: a package later).
- **R92's leftover:** UPART (the result's unit alone) is not built; its Tools row is off.
- **R107's leftover (pass 35):** a dead hardware key on the unit view's field (`units/open.ts`, `c.dead()`) counts no press (docs/04 5.2); its keys go through the counted `onKey`.
- **The pipeline:** `resolve_audit_model` is tested only by dry-run echo lines; the size test skips CSS. `tests/engine/patch-canary.ts` unpacks the Giac tarball per canary (40 times, 100 s of CPU), so golden `flags` times out under load (A51: timing): unpack it once. Red-first (`pipeline-lib.sh`) runs vitest on the branch's engine (G133f1's engine test passes there) and reads ids as `[A-Za-z0-9_.-]` (ids with `/` or `^` are invisible).
- **C3. CI** (needs your OK); **C4. F-Droid recipe:** untested end to end; `npm ci` after `prebuild` needs an offline rework; two drifts from build.sh in `fdroid/README.md`.

### MVP release (docs/02 section 8; not scheduled)
- **R1. v0.1.0, the APK and the website from one tag** (A8 done: `.github/workflows/release.yml`, the checklist [release.md](release.md); left: the test tag `v0.1.0-test`, then `v0.1.0`; the bar: [release-0.1.0.md](release-0.1.0.md)). **R2. Play testing track:** never published without your OK. **R3. Screenshots and store graphics.** **R4. The help pass** (About: R87; one APK hash from two `./build.sh --unsigned` runs: annabell, A7).

### v1 and later
In docs/02 section 8; P8 defers most of v1 behind the engineer core. v1: Statistics, Inference, Parametric/Polar/Sequence, Spreadsheet, Finance, Linear/Triangle solvers, RPN. v2: Geometry, Advanced Graphing, 3D, Explorers.
