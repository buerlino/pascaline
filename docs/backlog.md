<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Status and backlog

The one place for "where are we and what's left", one or two lines per open item. The architecture is [04-architecture.md](04-architecture.md) (it supersedes [02-architecture-plan.md](02-architecture-plan.md) where they differ; 02 section 12 keeps the milestone history); decisions are in [decisions.md](decisions.md); the order of the packages is [shifts/brief.md](shifts/brief.md) section 0, and each package's cause, steps and tests are in its file in [shifts/packages/](shifts/packages/). Done items leave this file (git history and [archive/backlog-2026-10.md](archive/backlog-2026-10.md) keep them). Keep it current by rewriting, not by adding amendments.

## Where we are

| Stage | State |
|---|---|
| Phase 0 spike; MVP milestones 1 (Home, CAS), 2 (Function, Solve), 3 (Python, removed by P11) | **Done** 2026-10-11 (reports in [archive/shifts/](archive/shifts/)) |
| **The core freeze (P23)** | **Ended 2026-10-27** (owner). Its net stays: [tests/core/](../tests/core/README.md) (66 everyday tasks, all active) runs on every merge and on the night's device; a red case is a bug to fix. Order of the work: brief section 0. |
| Milestone 4a: feel (P11) | **Next after Find.** Merged: the entry work (⌫, cursor, focus, hardware keys), sheets, flicks, Settings as levels of the Mode sheet (R49) with Help and about (R87), history-row actions, R15b, R15c1, R15c2, R15c3, the mockups (R12a). Waiting: R15c4, the palette, the visual pass, results mode, the trust features |
| Milestone 4: Find and trust | Engine side done (marks, 30 digits, chips, copy, defs, the Find index, the size test, A4a); Find's UI: R4a, R4b built; A4b next |
| Milestone 5: Units | The evaluator on Giac is done (P15: G15–G18, G25, G13, G7, G32, R28, R24a); the pad, the entry and the result view follow the Settings base |
| Milestone 6: Structure | Not started (EN5–EN7, Help) |
| MVP release | v0.1.0, the APK and the website from one tag: lane B (brief section 0) |

`phase-1` and `master` are on GitHub; `master` was last fast-forwarded to `phase-1` on 2026-10-14 (`ef857a6`). Work continues on `phase-1`.

## Needs the user
0. **The core list (P23):** cut or extend [tests/core/core.yaml](../tests/core/core.yaml) (66: 51 drafted by sandra, c52–c56 added with you on 2026-10-21, c57–c60 on 2026-10-24, c61–c66 on 2026-10-26; tell a session what to drop or add); do the [morning check](../tests/core/MORNING.md) on the night's device (about 10 minutes, 15 cases; tell the day session what failed); keep the night's device plugged in, unlocked and on the charger (A32, A33).
1. **Decisions in [decisions.md](decisions.md) "Needs the user":** A21's F-Droid answer.
2. **Your outreach steps** (decisions.md P18–P22): send Parisse email 5 (patches 0013–0016 and the regression files at `7438251`, `../outreach/email-parisse-5.md`; 0003–0012 went with email 4, 2026-10-28) after the push; ask F-Droid whether checked-in derived data (`find/factors.yaml`, P22) is fine, before C4; mirror G77's pin (`gh` logged in; the command is in `engine/giac/README.md`).
3. **G2 questions:** the unanswered items of `tests/golden/G2-CHECKLIST.md` (41, 42, 52, 56, 63–71; each package built a default, named in decisions.md; 63–65 can reverse S14's route R); the optional real-G2 spot checks (`spec/mapping/vc-2026-10-11/SPOT-CHECK.md`).
4. **From daily use:** the key sequence that left ⌫ stuck "at log" (F39); connect your phone for A9 (F41, no vibration); more points into [feedback.md](feedback.md).
5. **The new application id** (`io.github.buerlino.pascaline`): the next APK installs as a second app; copy what you need from the old one, then uninstall `org.pascaline.app`. Android's own backup is off (A23).
6. **Tap "Allow USB debugging"** on a device when it shows `unauthorized`.
7. **v0.1.0** (decisions.md "The release path"): make the release key off this laptop, fill A7's table (A7.md); allow tags `v*` in Settings → Environments → `github-pages` before A45's deploy; read the usage meter each morning and at each lane start (tripwire 85 %); fast-forward `master` and push before the tag. **A49, switching a broken web worker off:** copy `app/pwa/kill/sw.js` over `sw.js` on the server (same URL, same path). Each browser's next update check installs it; it deletes our caches and unregisters, and the next load comes from the network. Put the real `dist/sw.js` back after the fix.
8. **Later:** the outside rounds (two 30-minute rounds after R4b and R24c, [r18](research/r18-outside-test.md); R70 first); at milestone 5, time ten tasks by hand (E-notation against units). **Later, not now:** CI (C3), the F-Droid recipe (C4).

### One-time checks on the phone (the daily list is MORNING.md; each by the owner, or annabell when a package names it)
- Flick misfires (R9: 20 px arm, 12 px cancel); whether the first tap after a cold start vibrates (R35); R7's sheet defaults; the 36 px cluster rows and the 28 px status line (R15b).
- A11: Share session, Paste of `1.5e-3`; a chip tapped right after a flick (R15c2); the ~8 px strip right of an inner fraction (R42); "Working…" on the WebView and a taller CAS result growing its row (F8); the trackpad's `touch-action: none` (K1).
- The memory cap on the Tab One: `makemat(1,30000,30000)` in CAS gives "Out of memory" and the app stays up (G24).
- R85 (merged `1d35189`): on the Fairphone, Shift, Fmt opens Mode on Angle; ▶, Enter gives DEG (the owner).
- R86 (merged `cf087b9`): on the Fairphone, the pill then SCI sets it and closes; the digits chip then 20; ◀ goes up to Mode (the owner).
- R81 (F99, merged `a956ede`): the system keyboard stays closed after a return to the app, on the Fairphone (`tools/probes/ime-return.py`, annabell).
- Removal tests to read: the "stored in Home" line under CAS results (R32), the angle check (R37), library imports (S4), Undo (P13).

### Upstream reports (owner; drafts in `../outreach/upstream-reports.md`)
- **MathLive**, filed 2026-10-19: [#3122](https://github.com/arnog/mathlive/issues/3122) (⌫ at `\left…\right`), [#3123](https://github.com/arnog/mathlive/issues/3123) (touch caret), [#3124](https://github.com/arnog/mathlive/issues/3124) (focus restore); [#3125](https://github.com/arnog/mathlive/issues/3125) (Redo after ⌫, 2026-10-20); M5 (`isImplicitArg` takes no matrix, F68) drafted by R75.
- **Giac**, not filed yet. Regression files: `tools/giac-regress/` (G89; check, known and patched: `pascaline-patched.cas` holds the lines that fail on stock giac_2.1.0-1 and pass with our patches; the golden gate runs them since G108). Parisse takes email, forum or commit links: 0003–0012 sent (email 4), 0013–0016 in email 5 (item 2 above); the rest as four forum threads; new since: `simplify`'s assume leak (G92: subst.cc:2419, 2802), `restart(1)` clearing nothing (G93: VARS(1) lists equations, usual.cc:251), a typed string ending in a backslash refused inside brackets (G105f1), the laplace VARS() garbage (F89).

## Tasks

### Open bugs (everyday reach; order: brief section 0; family n: [bug-patterns.md](research/bug-patterns.md) section 3; each line names its package, which holds the evidence)
- **F85, no package (G102's Not done; cost only).** A Home input with chips is parsed twice per Enter (G100); the parse is its own bridge-2 call, so G102 could not fold it. Can start (G104 merged).
- **F80, no package (G99's Not done; probed: `tools/probes/bridge-forms.ts`).** After Home `(BesselJ(1,2))=>y`, `int(y^2,y,0,1)` shows `⚠ 0.333333333333` (right `≈`): Home stores at Digits 40, where `=>` keeps y as `BesselJ(1,2)` unevaluated, and Giac's int with that y errors (Bad Argument Value). `y:=` keeps the float. Test: `boundNames.test.ts` (`it.fails`), seqsweep `12 bound: int…`. Family 8.
- **F73, no package (it waited for the end of the freeze; owner, 2026-10-24; G103 reads the doubles).** A double in a list shows Giac's text (`[BesselJ(1,2),1/3]`), not numbers with ⚠; no wrong value reaches the screen. Left: `hasFloat` (reads `1..3` and strings). Families 5, 6.

### Background stream (extreme inputs; at night, by reach)
- **F87, no package (G93's report).** CAS `restart(0)`, `restart_vars(0)`, `restart(1)` and Home `restart(1)` show "pcasans: recursive definition" (pasans in Home): the answer lists our Ans slot's own name. The command took effect. Our name on screen (family 9); not reachable by keys until Find.
- **F88, no package (G105f1's report).** nonsquare.ts reads Giac's print of `string(part)` (a quoted string, quotes doubled), so changesState and functionsIn find nothing in it: a candidate that stores or calls a user function is evaluated again (G101 says not). Reading it with parsePrinted changes which F69 refusals happen: its own package and tests.
- **F89, no package (G92's report).** Giac's `laplace` and `ilaplace` on tanh(sqrt(x)) leave VARS() entries that are no names (bytes, empty, error texts), then garbage after every command: freed memory in Giac's variable list. The put-back skips them. Not reachable by keys (laplace needs Find); an upstream candidate. Also `ilaplace(1/(x^2+1)^2)` (G110's census).
- **F90–F97 (G110's census on `694fb92`; rerun: `node tools/probes/find-census.ts <name>`; all in `tests/golden/findcensus-known.yaml`).** Find's tier-1 functions on Giac's own examples, in Home and CAS. F93, F96 and F97 have no package (the rest: G111, G113, G113f1, R80f1); an exact input past Home's budget (`negbinomial_icdf(1,1/10^6,1-1/10^6)`) shows Giac's `User interrupt or Out of memory`, not a plain refusal. Family 5.
- **F93.** No answer shown as Giac's word: `undef` (`znorder(17,0.5)`, `circumcircle(0,1,1+i)`, 34 runs), Home `Airy_Ai({1,2})` = `[Airy_Ai(1),Airy_Ai(2)]`, CAS `binomial_icdf(4,0.5,3)` unevaluated with floats, `when` as C's `?:`.
- **F96.** Names left that the definitions log does not hold (not in Vars, gone after a relaunch): `gbasis` (lastgb), `syzygy` (lastv), `GF(2,8)` (K, g), `wz_certificate` (k, n), and the name arguments of `QR`, `LU`, `Fill`, `CopyVar`, `point3d`, `is_hamiltonian`; `debug(…)` turns on Giac's debugger, after which every program call, our helpers too, throws `prompt is not defined`; `interactive_plotode` throws the same (both left out of Find, G111). (`sto`, `assign`, `assume`, `purge` leave only what the log holds, as intended: the census's class `defined`, not here.)
- **F97.** CAS has no answer within 6 s (600 s hard timeout): `ellipse(-1,1,point(1+i))`, `hyperbola(…)`, `ecm_factor` of a 73-digit number; Home refuses them after 2 s.
- **F105, no package.** Home `normald_cdf(0,1,{1/2,3/2})` stays the symbolic `(erf({…})+1)/2`, no numbers (erf of a list in the exact form); honest, no value.
- **F115, no package (Opus pass 83).** Home `3*int(1/x,x,-1,1)+1` at the default budget shows ⚠ 1 (unchecked), not the refusal the bare `int(1/x,x,-1,1)` gets: the divergence checks need about 20× the steps (`converge.test.ts` uses 20×; golden has only the bare case). Flagged, so honest; family 5.
- **F128, flaky (G128 run 307, once).** The golden `interrupt` stage: `expand((x+y+z+1)^40)` under timeout 0.2 s took 406 ms against its 400 ms limit (`tests/engine/interrupt-test.mjs`) on a loaded host; passed 3 of 3 under the host-cpu lock. Opus pass 10: SLACK_MS stays; a second sighting puts the stage into `isTiming`.
- **F70, no package (to verify: gorge).** Home Σ with a numeric bound fails after about 1 s with "The calculation failed", not a time-limit message: Σ_{x=1}^{100000} 1/x, Σ_{K=1}^{2000} cos(K)/K (desktop, `e0d03ed`); to 10^6 Giac closes it (⚠ 14.3927267229). Whether Home's deadline or an engine error.
- **F71, no package (to verify: ron).** CAS Σ_{k=1}^{2000} cos(k)/k (3 s) shows its result as raw LaTeX text (`\frac{15111779…`), not drawn (docs/04: never raw engine text); a size cut or MathLive's limit.
- **F61.** Two-argument `round`/`trunc` work in a double: patch pending (decisions.md G71). Family 4.
- **F62, no package.** `sin(cosh(10!))` takes 11 s in Home; the 2 s deadline misses; G82 does not stop it (one call, 20 checks). S16: also `tan(cos(sinh(10!)))`, `cos(cosh(10!))`, `tan(sinh(1.5ᴇ8))`, `log(asin(√(2ᴇ22)))`.
- **F63, no package.** A stored ⚠ value (`BesselJ(1,2)`) read through a function, after a relaunch or by its name shows one confirmed digit fewer than the value itself (11, not 12: cautious, not wrong; `tests/golden/seqsweep-known.yaml` 6–7).
- **F66, no package.** The plot evaluator has NaN at x = 0 for x·x/x where Giac simplifies to x (`viewsweep-known.yaml`); Home and the plot disagree at one point. Also `√x·√x` for x < 0 (roots-11, G87's KNOWN list).
- **F108, no package (Home fixed by G119).** CAS `fMin(x^2-2*x+1,x)` still shows Giac's `seq[1]` (census `cas fMin/0`, `cas fMax/0`); Home `op([])` shows `seq[]`. Family 5.
- **F109, no package.** Home `DelAVars()` shows `DelAVars`, its own name: no answer and no refusal. Family 5.
- **F122, no package (G116).** Home `(atan(ln(-π)+9007199254740993))^(sin(10^-300)-10^300)` kills the engine (stack overflow inside Giac's wasm); also `(asinh(∛0.5))^((π/2+10^-3)^((90+10^-3)/(π/2+10^-6)))` (G120). G94's kind.
- **F127, no package (G130's Not done).** A matrix inside a list keeps Giac's word: Home and CAS `[idn(2),1]` show `[matrix[[1,0],[0,1]],1]`, `list[idn(2)]` `{matrix[[1,0],[0,1]]}`; and Home `zeros(2,3)` costs 13 Giac calls per Enter (was 10; G130's bar was one more). Family 1.
- **F137, no package (G135).** Home `cos(atan(1+i)/2)` ≈ -0.891156571011+0.0986295774757·i, right the negation; also sin, tan of it, `cos(acos(2*i)/2)`: Giac's half-angle rules (`usual.cc` is_half_atrig) take the sign from a complex evalf. Family 8.
- **F138, no package (G135).** CAS in DEG, `evalf(cos(atan(2*i)))` shows -1.37121078136E-60-0.57735026919·i, right -0.57735026919·i: pasdeg's round trip leaves noise. Family 8.
- **F134, no package (G132).** CAS `simplify(sqrt(acosh(-1/2)^3))` and `normal(…)` give the other root (right 2.14325044527-2.14325044527·i), before and after patch 0018: their own rewrite. Family 3.
- **F135, no package (Opus pass 12).** Giac's `sqrt(exp(z))` = `exp(z/2)`, no branch check: `sqrt(exp(3*acosh(-2)))` evalf -7.20976852011·i, right +7.2097…·i. Home's mark not checked. Family 3.
- **F131, G134 (G120).** Home `asinh(acosh(10^-6))` (30 digits) ⚠ -0.45158…+1.5708·i, on neither side of asinh's cut (right 1.0232266530…+1.5708·i). Pending `g120-asinh-*`. Family 3.
- **F133, G134 (G120).** Home `∛(10^-299/cos(acosh(-0.5)))` (30 digits) ⚠ 14 with an imaginary part 2.9E-115·i; the value is real 1.3437024079401…E-100. Pending `g120-cbrt-*`. Family 3.
- **G94, no package.** Depth-3 generated trees in the view sweep crash the in-process engine (wasm memory out of bounds; also the nightly view sweep at count 300, seed 20752); raw output: `../drafts/2026-10-21-packages/g94-raw`.
- **The hardening without a bug line:** A31 (a gate stage for the shell tests in `tools/` and `scripts/`, not drafted); r16's end mark, a 50,000-input sweep with no new false mark, is not met (Opus pass 82; G94 stops the view sweep at volume); G116: `node scripts/sweep.ts --nightly --edges`; its first two seeds gave F119–F123 (triage: `.tasks/sweep-2026-10-28-g116-triage.md`); G120 (seed 1793285778): F129–F133 and 20 hangs of acos/acosh at huge or tiny reals (`.tasks/sweep-2026-10-29-g120-triage.md`); A44: `tests/golden/sweep-nightly-known.yaml` holds the nightly sweep's open rows (F122, F129–F133); the gate never reads it.

### Next (packages and order: brief section 0)
- **Find (milestone 4, EN1):** R4a built (Math = Find; task 5 active at 4 presses; c38, c39, c43 keyed through it); R4b built; A4b next, brief section 0.
- **Units (milestone 5; docs/04 section 4):** packages and order in brief section 0; the first unit result on the Tab One and the Fairphone 6 (< 1 s). Gate: tasks 1–4 and 10; a unit in ≤ 4 presses at the median; `units.yaml`; the owner's hand timing.
- **Settings and looks (milestone 4a), the trust features, the backup and libraries:** packages and order in brief section 0 ("What waits").
- **Milestone 6, Structure** (not packaged): EN5 matrices with Shift + 5 and the editor on Shift + 4 (§5.3; the Tmpl matrices work today), EN6 number bases, EN7 everyday functions, Help as context help; EN4, copying one element of a list or matrix.

### Without a package yet
- The Function app and plots of user functions wait for your word (R56b covers Solve); **R58b** Alpha letters are always names in CAS (G2 item 62 can reverse it).
- **G9. Number formats against the G2** (item 15): decide in the settings and help pass. **K1:** a pending one-shot Shift is used up by the first drag step. **K5:** the gestures in the help texts.
- **`tieRisk`** (`format.ts:130`, set in `homeEval.ts:422`) has no reader (docs/04 2.4 rule 2 already drops a digit at a tie): drop it when `homeEval.ts` is next touched outside the freeze.
- **The pipeline:** `resolve_audit_model` is tested only through dry-run echo lines (Opus pass 20; `want_checks` has its own test since A36); the size test does not cover CSS (25.8 kB raw at 2026-10-12). `tests/engine/patch-canary.ts` unpacks the Giac tarball once per canary (40 times, `member()` of `tools/find-index/state.mjs`), 100 s of CPU alone, so the golden `flags` stage times out under load (A51 counts it as timing): unpack it once.
- **C3. CI** (needs your OK); **C4. F-Droid recipe:** untested end to end; `npm ci` after `prebuild` needs an offline rework; two drifts from build.sh in `fdroid/README.md`.

### MVP release (docs/02 section 8; not scheduled)
- **R1. v0.1.0, the APK and the website from one tag** (A43, A7, A45, A8; decisions.md "The release path"; A48, A50 and A49 merged). **R2. Play testing track:** never published without your OK. **R3. Screenshots and store graphics.** **R4. The help pass** (About: R87; one APK hash from two `./build.sh --unsigned` runs: annabell, A7).

### v1 and later
In docs/02 section 8; P8 defers most of v1 behind the engineer core. v1: Statistics, Inference, Parametric/Polar/Sequence, Spreadsheet, Finance, Linear/Triangle solvers, RPN. v2: Geometry, Advanced Graphing, 3D, Explorers.
