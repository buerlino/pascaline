<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Status and backlog

The one place for "where are we and what's left", one or two lines per open item. The architecture is [04-architecture.md](04-architecture.md) (it supersedes [02-architecture-plan.md](02-architecture-plan.md) where they differ; 02 section 12 keeps the milestone history); decisions are in [decisions.md](decisions.md); the order of the packages is [shifts/brief.md](shifts/brief.md) section 0, and each package's cause, steps and tests are in its file in [shifts/packages/](shifts/packages/). Done items leave this file (git history and [archive/backlog-2026-10.md](archive/backlog-2026-10.md) keep them). Keep it current by rewriting, not by adding amendments.

## Where we are

| Stage | State |
|---|---|
| Phase 0 spike; MVP milestones 1 (Home, CAS), 2 (Function, Solve), 3 (Python, removed by P11) | **Done** 2026-10-11 (reports in [archive/shifts/](archive/shifts/)) |
| **The core freeze (P23)** | **In progress since 2026-10-21.** No new feature until the core list holds ([tests/core/](../tests/core/README.md): 66 everyday tasks, 63 active, 3 waiting for R4a). Where the count stands and what ends it: brief section 0 ("What holds means"). The bridge moves G98–G105 are merged (G105 as G105f2, `694fb92`). |
| Milestone 4a: feel (P11) | **Paused by P23.** Merged: the entry work (⌫, cursor, focus, hardware keys), sheets, flicks, the Settings page, history-row actions, R15b, R15c1, R15c2, the mockups (R12a). Waiting: R15c3, R15c4, Settings rows, the palette, the visual pass, results mode, the trust features |
| Milestone 4: Find and trust | Engine side done (marks, 30 digits, chips, copy, defs, the Find index, the size test, A4a); Find's UI (R4a, R4b, A4b) is first after the freeze |
| Milestone 5: Units | The evaluator on Giac is done (P15: G15–G18, G25, G13, G7, G32, R28, R24a); the pad, the entry and the result view wait for the freeze |
| Milestone 6: Structure | Not started (EN5–EN7, Help) |
| MVP release | Not scheduled (owner, 2026-10-12); A7 and A8 on the owner's go |

`phase-1` and `master` are on GitHub; `master` was last fast-forwarded to `phase-1` on 2026-10-14 (`ef857a6`). Work continues on `phase-1`.

**On track:** on scope yes, on stability no: from 2026-10-14 to 2026-10-21 phase-1 got 188 `fix` commits against 84 `feat`, and 45 of 208 merges were follow-up fixes of merged work, which is why P23 stops new work until the core list holds. Speed holds on the low-end Tab One: at milestone 3 keyboard usable 662 ms, engine ready 995 ms, Plot 56 fps; Enter p95 141–153 ms after G53, at the 150 ms bar (A16, 2026-10-20). Two debts: everything is checked against the Virtual Calculator (rev 15751), not the owner's G2 (rev 15515); only the Tab One is measured regularly (Fairphone 6 once: keyboard usable 329 ms, engine ready 609 ms).

## Needs the user
0. **The core list (P23):** cut or extend [tests/core/core.yaml](../tests/core/core.yaml) (60: 51 drafted by sandra, c52–c56 added with you on 2026-10-21, c57–c60 on 2026-10-24; tell a session what to drop or add); do the [morning check](../tests/core/MORNING.md) on the night's device (about 10 minutes, 15 cases; tell the day session what failed); keep the night's device plugged in, unlocked and on the charger (A32, A33).
1. **Decisions in [decisions.md](decisions.md) "Needs the user":** A21's F-Droid answer.
2. **Your outreach steps** (decisions.md P18–P22): send Parisse patches 0003–0008 as commit links (`engine/giac/patches/README.md`; 0001, 0002 are in his code); the regression-file link (G108 merged `d26ee0e`: every line passes as labelled, and the golden gate runs the files); ask F-Droid whether checked-in derived data (`find/factors.yaml`, P22) is fine, before C4; mirror G77's pin (`gh` logged in; the command is in `engine/giac/README.md`). The release engine passed its gate (A42, `cbb636e`).
3. **G2 questions:** the unanswered items of `tests/golden/G2-CHECKLIST.md` (41, 42, 52, 56, 63–71; each package built a default, named in decisions.md; 63–65 can reverse S14's route R); the optional real-G2 spot checks (`spec/mapping/vc-2026-10-11/SPOT-CHECK.md`).
4. **From daily use:** the key sequence that left ⌫ stuck "at log" (F39); connect your phone for A9 (F41, no vibration); more points into [feedback.md](feedback.md).
5. **The new application id** (`io.github.buerlino.pascaline`): the next APK installs as a second app; copy what you need from the old one, then uninstall `org.pascaline.app`. Android's own backup is off (A23).
6. **Tap "Allow USB debugging"** on a device when it shows `unauthorized`.
7. **After the freeze:** the outside rounds (two 30-minute rounds after R4b and R24c, [r18](research/r18-outside-test.md); R70 first); at milestone 5, time ten tasks by hand (E-notation against units). **Later, not now:** the name and trademark checks, CI (C3), the F-Droid recipe (C4).

### One-time checks on the phone (the daily list is MORNING.md; each by the owner, or annabell when a package names it)
- Flick misfires (R9: 20 px arm, 12 px cancel); whether the first tap after a cold start vibrates (R35); R7's sheet defaults; the 36 px cluster rows and the 28 px status line (R15b).
- A11: Share session, Paste of `1.5e-3`; a chip tapped right after a flick (R15c2); the ~8 px strip right of an inner fraction (R42); "Working…" on the WebView and a taller CAS result growing its row (F8); the trackpad's `touch-action: none` (K1).
- The memory cap on the Tab One: `makemat(1,30000,30000)` in CAS gives "Out of memory" and the app stays up (G24).
- Removal tests to read: the "stored in Home" line under CAS results (R32), the angle check (R37), library imports (S4), Undo (P13).

### Upstream reports (owner; drafts in `../outreach/upstream-reports.md`)
- **libqalculate**, filed 2026-10-19: `hp` [#1043](https://github.com/Qalculate/libqalculate/issues/1043) and `mmHg`/`inHg` [#1044](https://github.com/Qalculate/libqalculate/issues/1044), fixed in master (`92ecde7`); [#1045](https://github.com/Qalculate/libqalculate/issues/1045) closed 2026-10-20 (follow-ups G80, merged, and G81). A fix fails the index build on its `override` in `find/units.yaml` once we pin a release that has it.
- **MathLive**, filed 2026-10-19: [#3122](https://github.com/arnog/mathlive/issues/3122) (⌫ at `\left…\right`), [#3123](https://github.com/arnog/mathlive/issues/3123) (touch caret), [#3124](https://github.com/arnog/mathlive/issues/3124) (focus restore); [#3125](https://github.com/arnog/mathlive/issues/3125) (Redo after ⌫, 2026-10-20); M5 (`isImplicitArg` takes no matrix, F68) drafted by R75.
- **Giac**, not filed yet. Regression files: `tools/giac-regress/` (G89; check, known and patched: `pascaline-patched.cas` holds the lines that fail on stock giac_2.1.0-1 and pass with patches 0003, 0005 and 0006; the golden gate runs them since G108, `d26ee0e`). Parisse takes email, forum or commit links: patches 0003–0008 as commit links (item 2 above); the rest as four forum threads; new since: `simplify`'s assume leak (G92: subst.cc:2419, 2802), `restart(1)` clearing nothing (G93: VARS(1) lists equations, usual.cc:251), a typed string ending in a backslash refused inside brackets (G105f1), the laplace VARS() garbage (F89).

## Tasks

### Open bugs in the freeze (everyday reach; order: brief section 0; family n: [bug-patterns.md](research/bug-patterns.md) section 3; each line names its package, which holds the evidence)
- **F110 → R82 (owner, 2026-10-27; fixed on desktop, the night's device step judges).** Morning check 2026-10-26 on the Fairphone 6: c46's Root answer under the status bar, unread; CORE DEVICE passed it (it read text only). R82: a short stage no longer squeezes the readout under the keypad; `text` expects check the match is on screen and uncovered.
- **F85, no package (G102's Not done; cost only).** A Home input with chips is parsed twice per Enter (G100); the parse is its own bridge-2 call, so G102 could not fold it. Can start (G104 merged).
- **F80, no package (G99's Not done; probed: `tools/probes/bridge-forms.ts`).** After Home `(BesselJ(1,2))=>y`, `int(y^2,y,0,1)` shows `⚠ 0.333333333333` (right `≈`): Home stores at Digits 40, where `=>` keeps y as `BesselJ(1,2)` unevaluated, and Giac's int with that y errors (Bad Argument Value). `y:=` keeps the float. Test: `boundNames.test.ts` (`it.fails`), seqsweep `12 bound: int…`. Family 8.
- **F83, no package (G99's report).** CAS `sum(x^2,x=1..3)` reaches Giac as `sum(x^2,x=(3/10^1))` (toExactLiterals reads `1..3` as decimals) and errors; Home shows `≈ 14` (F73). Family 8.
- **F73, waits for the end of the freeze (owner, 2026-10-24; G103 reads the doubles).** A double in a list shows Giac's text (`[BesselJ(1,2),1/3]`), not numbers with ⚠; no wrong value reaches the screen. Left: `hasFloat` (reads `1..3` and strings). Families 5, 6.

### Background stream (extreme inputs; P23: runs when no core step can start)
- **F86, no package (G60's report).** Home `exp(cosh(floor(asin(pi))))` is "No value found" (Giac's evalf leaves `exp(cosh(1-2*i))` as text); right 0.25326511802−0.461196406269·i. Family 5.
- **F87, no package (G93's report).** CAS `restart(0)`, `restart_vars(0)`, `restart(1)` and Home `restart(1)` show "pcasans: recursive definition" (pasans in Home): the answer lists our Ans slot's own name. The command took effect. Our name on screen (family 9); not reachable by keys until Find.
- **F88, no package (G105f1's report).** nonsquare.ts reads Giac's print of `string(part)` (a quoted string, quotes doubled), so changesState and functionsIn find nothing in it: a candidate that stores or calls a user function is evaluated again (G101 says not). Reading it with parsePrinted changes which F69 refusals happen: its own package and tests.
- **F89, no package (G92's report).** Giac's `laplace` and `ilaplace` on tanh(sqrt(x)) leave VARS() entries that are no names (bytes, empty, error texts), then garbage after every command: freed memory in Giac's variable list. The put-back skips them. Not reachable by keys (laplace needs Find); an upstream candidate. Also `ilaplace(1/(x^2+1)^2)` (G110's census).
- **F90–F97 (G110's census on `694fb92`; R4a's gate; rerun: `node tools/probes/find-census.ts <name>`; all in `tests/golden/findcensus-known.yaml`).** Find's tier-1 functions on Giac's own examples, in Home and CAS. G111 (`77fd0c1`) fixed F91, F95 and F98, and Find leaves out F90, F92 and F94 (decisions.md "Owner answers of 2026-10-25"); F93, F96, F97, F101 and F102 have no package (F101, F102 before R4a). Family 5.
- **F90.** 103 graphics and geometry functions (`plot`, `circle`, `triangle`, `histogram` …): 193 runs throw `window is not defined` out of the engine (Giac's JS for a graphic; the app's worker has no `window` either: to verify on the WebView), 45 show Giac's `pnt(…)` text.
- **F92.** 53 graph functions (`cycle_graph`, `random_graph` …) show Giac's sentence "an undirected unweighted graph with 15 vertices and 25 edges".
- **F93.** No answer shown as Giac's word: `undef` (`znorder(17,0.5)`, `poisson(0.5,-2)`, `circumcircle(0,1,1+i)`, 34 runs), Home `Airy_Ai({1,2})` = `[Airy_Ai(1),Airy_Ai(2)]`, CAS `binomial_icdf(4,0.5,3)` unevaluated with floats, `when` as C's `?:`.
- **F94.** Strings with their quotes (`str`, `latex`, `char`, `mathml`, `tabvar`), Giac's tables (`mlr`, `mc_mean_antithetic`): 28 runs.
- **F96.** Names left that the definitions log does not hold (not in Vars, gone after a relaunch): `gbasis` (lastgb), `syzygy` (lastv), `GF(2,8)` (K, g), `wz_certificate` (k, n), and the name arguments of `QR`, `LU`, `Fill`, `CopyVar`, `point3d`, `is_hamiltonian`; `debug(…)` turns on Giac's debugger, after which every program call, our helpers too, throws `prompt is not defined`; `interactive_plotode` throws the same (both left out of Find, G111). (`sto`, `assign`, `assume`, `purge` leave only what the log holds, as intended: the census's class `defined`, not here.)
- **F97.** CAS has no answer within 6 s (600 s hard timeout): `ellipse(-1,1,point(1+i))`, `hyperbola(…)`, `ecm_factor` of a 73-digit number; Home refuses them after 2 s.
- **F101 → G113 (G111's report; Opus pass 78: before R4a, at the cause in `moyal.cc`, patch 0009).** A probability at a non-integer k is a number: `poisson(2,1.5)` ≈ 0.288, `geometric(0.5,1.5)` ≈ 0.354, `negbinomial(3,0.5,1.5)` ≈ 0.193; right 0 (the pmf lives on the integers; `binomial` refuses). No census sample. Family 5.
- **F107, no package (after the freeze; owner, 2026-10-26).** Constructors Giac answers right with one list are refused too (Home `zeros({2,3})`, `matrix({{1,2},{3,4}})`, `ranm`, `simp2`, `iegcd`, `subst({x+1,x=2})`): the probe gets a class for names where the list form is the intended meaning. Family 5.
- **F104, no package (R80f1's report; with F101's patch).** Home `negbinomial_icdf(3,1/2,1/5)` = 0 with exact arguments (right 1: P(K≤0) = 1/8 < 1/5); floats give 1. Family 5.
- **F105, no package.** Home `normald_cdf(0,1,{1/2,3/2})` stays the symbolic `(erf({…})+1)/2`, no numbers (erf of a list in the exact form); honest, no value.
- **F116, flaky (FLAKES 1, 2026-10-26, load 20–40 from two editor searches; in `isTiming`; 5 of 5 clean on 10-25 at load 5).** `converge.test.ts` "refuse 3*int(1/x,x,-1,1)+1" (2/5; Giac's 1.5 s clock, see F115); `host.test.ts` "switching CAS -> Home restores Home's 300 ms budget" (4/5, > 2000 ms); `valueKind.test.ts` "10^1000000+7 is exact" (3/5, 5 s timeout); `fuzz.test.ts` "20000 random token strings …, quickly" (1/5, 5 s; seeded); e2e `working.spec.ts` "Working… and Cancel only after 150 ms" (1/5). The census leaves out a test that fails in every run (Esc before Working…, 5/5, 192 ms > 150).
- **F115, no package (Opus pass 83).** Home `3*int(1/x,x,-1,1)+1` at the default budget shows ⚠ 1 (unchecked), not the refusal the bare `int(1/x,x,-1,1)` gets: the divergence checks need about 20× the steps (`converge.test.ts` uses 20×; golden has only the bare case). Flagged, so honest; family 5.
- **F106, flaky (FLAKES 78, 1 of 5; in `isTiming`).** `src/engine/flags.test.ts` "G102: a Digits set right after an interrupted call is set…": with `timeout 0.001` the interrupt sometimes escapes `giac_eval` as a wasm Exception under load.
- **F70, no package (to verify: gorge).** Home Σ with a numeric bound fails after about 1 s with "The calculation failed", not a time-limit message: Σ_{x=1}^{100000} 1/x, Σ_{K=1}^{2000} cos(K)/K (desktop, `e0d03ed`); to 10^6 Giac closes it (⚠ 14.3927267229). Whether Home's deadline or an engine error.
- **F71, no package (to verify: ron).** CAS Σ_{k=1}^{2000} cos(k)/k (3 s) shows its result as raw LaTeX text (`\frac{15111779…`), not drawn (docs/04: never raw engine text); a size cut or MathLive's limit.
- **F61, no package.** Giac's exact `acosh` of a negative non-rational is ln(…) at Digits 40 and its conjugate at 80 (`acosh(-1/2)` ≈ -6.8E-15+2.094*i; on 2026-10-26 a real part 0 at 12 and 30 digits, likely patch 0005: gorge confirms); two-argument `round`/`trunc`: patch pending (decisions.md G71). Family 4.
- **F62, no package.** `sin(cosh(10!))` takes 11 s in Home; the 2 s deadline misses; G82 does not stop it (one call, 20 checks). S16: also `tan(cos(sinh(10!)))`, `cos(cosh(10!))`, `tan(sinh(1.5ᴇ8))`, `log(asin(√(2ᴇ22)))`.
- **F63, no package.** A stored ⚠ value (`BesselJ(1,2)`) read through a function, after a relaunch or by its name shows one confirmed digit fewer than the value itself (11, not 12: cautious, not wrong; `tests/golden/seqsweep-known.yaml` 6–7).
- **F66, no package.** The plot evaluator has NaN at x = 0 for x·x/x where Giac simplifies to x (`viewsweep-known.yaml`); Home and the plot disagree at one point. Also `√x·√x` for x < 0 (roots-11, G87's KNOWN list).
- **F108 → G114 (the after-night check, 2026-10-26).** Home `fMin(x^2-x,x)` shows `seq[1/2]`, `fMax` too; the census reads it as symbolic (`classify.ts` RAW_WORDS has no `seq[`), so R4a's gate cannot see Giac's sequence answers. Family 5.
- **F109, no package.** Home `DelAVars()` shows `DelAVars`, its own name: no answer and no refusal. Family 5.
- **F111, no package (S16, `cbb636e`).** Home `|acos(π)|^2` ≈ -3.28162743582 (right 3.28162743582; `^6` ≈ -35.34): Giac makes `abs(acos(pi))^2` `acos(pi)^2`, a rule for reals (`MODE=raw node tools/probes/engine.ts 'abs(acos(pi))^2'`). Family 3.
- **F112, no package (S16).** Home `asin(cos(asin(10)))` ≈ 0.148369807463·i, right 2.99322284613·i on either branch: Giac's exact form adds `i*pi` (`MODE=raw … 'asin(cos(asin(10)))'`).
- **F113 → G115 (after night 2; owner, 2026-10-27).** DEG Home `atan(cos(0.001))` = 45, marked exact (right 44.9999999956): Giac gives `atan(cos(pi/N))` = `pi/4` from about N = 10^5 (`MODE=raw … 'atan(cos(pi/100000))'`). Family 3.
- **F114, no package (S16).** Home `asin(tan(2)-10^5040)` at 30 digits ⚠ 2 -1.6-1E4·i, right -1.5708+11605.722·i: cancellation in Giac's log form. Family 6.
- **G94, no package.** Depth-3 generated trees in the view sweep crash the in-process engine (wasm memory out of bounds, Opus pass 53; S16: also the nightly view sweep at count 300, seed 20752); raw output in the 2026-10-21 drafts (`../drafts/2026-10-21-packages/g94-raw`).
- **The hardening without a bug line:** A31 (a gate stage for the three shell tests in `tools/` and `scripts/`, not drafted).

### After the freeze (P23 order; packages and order: brief section 0)
- **Find (milestone 4, EN1):** packages and order in brief section 0 ("What waits"). Gate: task 5, the query test, the size test, no index request before idle. Three core cases (c38, c39, c43: a command by name) wait for it.
- **Units (milestone 5; docs/04 section 4):** packages and order in brief section 0; the first unit result on the Tab One and the Fairphone 6 (< 1 s). Gate: tasks 1–4 and 10; a unit in ≤ 4 presses at the median; `units.yaml`; the owner's hand timing.
- **Settings and looks (milestone 4a), the trust features, the backup and libraries:** packages and order in brief section 0 ("What waits").
- **Milestone 6, Structure** (not packaged): EN5 matrices with Shift + 5 and the editor on Shift + 4 (§5.3; the Tmpl matrices work today), EN6 number bases, EN7 everyday functions, Help as context help; EN4, copying one element of a list or matrix.

### Without a package yet
- The Function app and plots of user functions wait for your word (R56b covers Solve); **R58b** Alpha letters are always names in CAS (G2 item 62 can reverse it).
- **G9. Number formats against the G2** (item 15): decide in the settings and help pass. **K1:** a pending one-shot Shift is used up by the first drag step. **K5:** the gestures in the help texts.
- **`tieRisk`** (`format.ts:130`, set in `homeEval.ts:416`) has no reader (docs/04 2.4 rule 2 already drops a digit at a tie): drop it when `homeEval.ts` is next touched outside the freeze.
- **The pipeline:** A15's tests check fixed dry-run echo lines, not `want_checks` and `resolve_audit_model` (Opus pass 20); the size test does not cover CSS (25.8 kB raw at 2026-10-12).
- **C3. CI** (needs your OK); **C4. F-Droid recipe:** untested end to end; `npm ci` after `prebuild` needs an offline rework; four drifts from build.sh in `fdroid/README.md`.

### MVP release (docs/02 section 8; not scheduled)
- **R1. GitHub releases** (**A7**, **A8**; decisions.md "The release path"). **R2. Play testing track:** never published without your OK. **R3. Screenshots and store graphics.** **R4. The settings and help pass,** with an About screen: the credits and the MIT, LGPL and Apache notices (THIRD_PARTY.md). **A43:** an update keeps the data (before A7).

### v1 and later
In docs/02 section 8; P8 defers most of v1 behind the engineer core. v1: Statistics, Inference, Parametric/Polar/Sequence, Spreadsheet, Finance, Linear/Triangle solvers, RPN. v2: Geometry, Advanced Graphing, 3D, Explorers.
