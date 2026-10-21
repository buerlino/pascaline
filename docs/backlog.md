<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Status and backlog

The one place for "where are we and what's left", one or two lines per open item. The architecture is [04-architecture.md](04-architecture.md) (it supersedes [02-architecture-plan.md](02-architecture-plan.md) where they differ; 02 section 12 keeps the milestone history); decisions are in [decisions.md](decisions.md); the order of the packages is [shifts/brief.md](shifts/brief.md) section 0, and each package's cause, steps and tests are in its file in [shifts/packages/](shifts/packages/). Done items leave this file (git history and [archive/backlog-2026-10.md](archive/backlog-2026-10.md) keep them). Keep it current by rewriting, not by adding amendments.

## Where we are

| Stage | State |
|---|---|
| Phase 0 spike; MVP milestones 1 (Home, CAS), 2 (Function, Solve), 3 (Python, removed by P11) | **Done** 2026-10-11 (reports in [archive/shifts/](archive/shifts/)) |
| **The core freeze (P23)** | **In progress since 2026-10-21.** No new feature until the core list holds ([tests/core/](../tests/core/README.md): 56 everyday tasks, 53 active). On `73ea5b5` 48 pass on desktop; c41, c42 (F68), c52 (F65), c53 (F55), c56 (F72) fail as known; the Tab One run waits for A32. The bridge spike G85 is in the night queue. |
| Milestone 4a: feel (P11) | **Paused by P23.** Merged: the entry work (⌫, cursor, focus, hardware keys), sheets, flicks, the Settings page, history-row actions, R15b, R15c1, R15c2, the mockups (R12a). Waiting: R15c3, R15c4, Settings rows, the palette, the visual pass, results mode, the trust features |
| Milestone 4: Find and trust | Engine side done (marks, 30 digits, chips, copy, defs, the Find index, the size test, A4a); Find's UI (R4a, R4b, A4b) is first after the freeze |
| Milestone 5: Units | The evaluator on Giac is done (P15: G15–G18, G25, G13, G7, G32, R28, R24a); the pad, the entry and the result view wait for the freeze |
| Milestone 6: Structure | Not started (EN5–EN7, Help) |
| MVP release | Not scheduled (owner, 2026-10-12); A7 and A8 on the owner's go |

`phase-1` and `master` are on GitHub; `master` was last fast-forwarded to `phase-1` on 2026-10-11 (b4431ae). Work continues on `phase-1`.

**On track:** on scope yes, on stability no: from 2026-10-14 to 2026-10-21 phase-1 got 188 `fix` commits against 84 `feat`, and 45 of 208 merges were follow-up fixes of merged work, which is why P23 stops new work until the core list holds. Speed holds on the low-end Tab One: at milestone 3 keyboard usable 662 ms, engine ready 995 ms, Plot 56 fps; Enter p95 141–153 ms after G53, at the 150 ms bar (A16, 2026-10-20). Two debts: everything is checked against the Virtual Calculator (rev 15751), not the owner's G2 (rev 15515); only the Tab One is measured regularly (Fairphone 6 once: keyboard usable 329 ms, engine ready 609 ms).

## Needs the user
0. **The core list (P23):** cut or extend [tests/core/core.yaml](../tests/core/core.yaml) (56: 51 drafted by sandra, c52–c56 added with you on 2026-10-21; tell a session what to drop or add); do the [morning check](../tests/core/MORNING.md) on the Tab One (about 10 minutes, 15 cases; tell the day session what failed); keep the Tab One plugged in, unlocked and on the charger at night (A32, later A33).
1. **Decisions in [decisions.md](decisions.md) "Needs the user":** G93 (a typed `restart`); the structure audit's two rule lines (hind-4, hind-5); A21's F-Droid answer.
2. **Your outreach steps** (decisions.md P18–P22): Parisse's reply (email 3, `../outreach/email-parisse-3.md`; he integrated patches 0001 and 0002, welcomes regression tests (G89), suggested MPFI (S20)); push G75's patch commit once merged and send its link; ask F-Droid whether checked-in derived data (`find/factors.yaml`, P22) is fine, before C4; after G77, annabell builds the release engine on the new pin and runs the golden gate.
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
- **MathLive**, filed 2026-10-19: [#3122](https://github.com/arnog/mathlive/issues/3122) (⌫ at `\left…\right`), [#3123](https://github.com/arnog/mathlive/issues/3123) (touch caret), [#3124](https://github.com/arnog/mathlive/issues/3124) (focus restore); M4 (Redo after ⌫) drafted, not filed; M5 (`isImplicitArg` takes no matrix, F68) drafted by R75.
- **Giac**, not filed yet. Parisse takes reports by email, on the forum or as links to fix commits here: patch 0003 (complex `tanh`, G75) as a commit link; the rest as four forum threads (the drafts' "Status"); new since: `simplify`'s assume leak (G92), `im()` of a root of unknown sign (G96), the inverse of a non-square matrix (F69, G97), once their packages say where the cause is.

## Tasks

### Open bugs in the freeze (everyday reach; order: brief section 0; family n: [bug-patterns.md](research/bug-patterns.md) section 3; each line names its package, which holds the evidence)
- **F68 → [R75](shifts/packages/R75.md), fixed (R75: a `#@` key selects the matrix before it; c41, c42 pass).** x⁻¹, xʸ (and x², ÷) after a matrix from Tmpl open an empty base: Enter says "unexpected token at 'placeholder'", or the next keys land in the base (core c41, c42). `73ea5b5`; `npm run test:core` once R74 is merged. Matrices by keys. Partly MathLive's (`isImplicitArg` takes no matrix, `mathlive.mjs:35093`).
- **F69 → [G97](shifts/packages/G97.md).** Every power but 1 of a non-square matrix is shown under `=`: `[[5],[1]]^-1` = `[[0.2],[1]]` (elementwise), `[[5],[1]]^-2` = `1/26`, `[[1,2,3],[4,5,6]]^2` = `91`, `[[5],[1]]^2` = `26`; none exists. `node engine/giac/smoke.mjs '[[5],[1]]^2'`. Keys reach it through F68 (c42), and directly once R75 is merged (column vector, x⁻¹).
- **F65, F67 → [G90](shifts/packages/G90.md), fixed (G90: the value is Giac's numeric integration of the typed integrand, ⚠ without a count; c52 passes).** A definite `int` whose closed form keeps an unevaluated `integrate` shows ≈ with 12 (or 30) digits, right to 7: `int(asin(x)*12^x,x,0,1)`; F67 drops an imaginary part. `viewsweep-known.yaml`.
- **F55 → [R69](shifts/packages/R69.md).** Copy session writes `⚠ 39` beside √2, π, ln 2, whose screen mark is `≈` (`clipboard/text.ts:122`). Families 6, 8. After G76, G86.
- **F54 (held for G85; else [G69](shifts/packages/G69.md)).** With a stored x, `product(x,x,1,4)` = `⚠ 24` "inherited: x" (right `= 24`; `seq` too). Families 8, 1.
- **F72, no package (ron checks first whether R34 meant it).** A value typed in Solve's Num view stays in the shared entry line after Enter and follows you to Home: Solve x²=2, x set to 1, Home, 2 + 2 Enter gives `12+2 = 14` (after a solve, the line holds `1.41421356237`). Core c56. Probe: sandra, 2026-10-21, on `e0d03ed`.
- **F57 (held for G85; else [G72](shifts/packages/G72.md)).** A function body with `increment(cnt)` changes cnt by 2 per Enter and logs nothing (`definitionStores`, `isStateful` miss `++`, `DelVar`). Families 9, 3.

### Background stream (extreme inputs; P23: runs when no core step can start)
- **F64 → [G92](shifts/packages/G92.md), held for G85's report.** After Home `int(tanh(sqrt(x)),x,0,1)`, Giac's `simplify` leaves `assume(x>0)`: for the rest of the session `solve(x^2=4,x)` = `[2]`, `sqrt(x^2)` = `x`. `tests/golden/viewsweep-known.yaml` (leak). Not reachable by keys until Find (`tanh`); then it joins the core lane (P23).
- **F47 → [G60](shifts/packages/G60.md)** after G75. A double inside an MPFR result, at 30 digits: `log10(asinh(asin e))` wrong from the 14th digit under `≈`; `asin`/`acos` of a real \|x\| > 1 inside other functions show `⚠ 14` with 12–13 right. Family 4.
- **F70, no package (to verify: gorge).** Home Σ with a numeric bound fails after about 1 s with "The calculation failed", not a time-limit message: Σ_{x=1}^{100000} 1/x, Σ_{K=1}^{2000} cos(K)/K (desktop, `e0d03ed`); to 10^6 Giac closes it (⚠ 14.3927267229). Whether Home's deadline or an engine error.
- **F71, no package (to verify: ron).** CAS Σ_{k=1}^{2000} cos(k)/k (3 s) shows its result as raw LaTeX text (`\frac{15111779…`), not drawn (docs/04: never raw engine text); a size cut or MathLive's limit.
- **F61, no package.** Giac's exact `acosh` of a negative non-rational is ln(…) at Digits 40 and its conjugate at 80 (`acosh(-1/2)` ≈ -6.8E-15+2.094*i); two-argument `round`/`trunc` need their Giac patch (decisions.md G71). Family 4.
- **F62, no package.** `sin(cosh(10!))` takes 11 s in Home; the 2 s deadline misses (G82, Home's budget in steps, after S23).
- **F63, no package.** A stored ⚠ value (`BesselJ(1,2)`) read through a function, after a relaunch or by its name shows one digit too many confirmed (`tests/golden/seqsweep-known.yaml`).
- **F66, no package.** The plot evaluator has NaN at x = 0 for x·x/x where Giac simplifies to x (`viewsweep-known.yaml`); Home and the plot disagree at one point.
- **audit-approx → [G91](shifts/packages/G91.md).** `approx(sin(10^30), 2×10)` = `≈ −0.685710242506` (right −0.0901169019121; `numeric.ts:198`).
- **audit-dms-plot → [G87](shifts/packages/G87.md).** The plot of `x+30°15′36″` drops the 36″ (`emit-js.ts:40`); values right.
- **G94, no package.** Depth-3 generated trees in the view sweep crash the in-process engine (wasm memory out of bounds, Opus pass 53); raw output in the 2026-10-21 drafts (`../drafts/2026-10-21-packages/g94-raw`).
- **The hardening without a bug line:** G75 → G56; S17 → G77 → G89; G96; G64 after A19, then S16; A31 (a gate stage for the three shell tests in `tools/` and `scripts/`, not drafted).

### After the freeze (P23 order; packages and order: brief section 0)
- **Find (milestone 4, EN1):** R72, then **R4a** (Find on Math; G93 settled first), **R4b** (Vars, Memory, the user keys) with **R15c3** (their Alpha layer), **A4b** (Find per key on the Tab One). Gate: task 5, the query test, the size test, no index request before idle. Three core cases (c38, c39, c43: a command by name) wait for it.
- **Units (milestone 5; docs/04 section 4):** **R24b** → **R24c** → **R24d**; the result view **R60**, **R61**, **R62**, **R63**; **R71** (±); G81 (σ through the basis); the first unit result on the Tab One and the Fairphone 6 (< 1 s). Gate: tasks 1–4 and 10; a unit in ≤ 4 presses at the median; `units.yaml`; the owner's hand timing.
- **Settings and looks (milestone 4a):** **R49** → **R55**, **R57**, **R70**; **R50e**; **R53** (results mode); **R12b** → **R12c** → **R41**; **R15c4** (first-start tips).
- **Trust features:** **R36** (why the mark, after G76), **R33**, **R37**, **R40** (after G81). **The backup:** **R38a** → **R38b**. **Libraries:** **R59** (after the bridge moves). **G79**, **S20** when a slot is free.
- **Milestone 6, Structure** (not packaged): EN5 matrices with Shift + 5 and the editor on Shift + 4 (§5.3; the Tmpl matrices work today), EN6 number bases, EN7 everyday functions, Help as context help; EN4, copying one element of a list or matrix.

### Without a package yet
- The Function app and plots of user functions wait for your word (R56b covers Solve); **R58b** Alpha letters are always names in CAS (G2 item 62 can reverse it).
- **G9. Number formats against the G2** (item 15): decide in the settings and help pass. **K1:** a pending one-shot Shift is used up by the first drag step. **K5:** the gestures in the help texts.
- **`tieRisk`** (`format.ts:129`, set in `homeEval.ts:508`) has no reader (docs/04 2.4 rule 2 already drops a digit at a tie): drop it when `homeEval.ts` is next touched outside the freeze.
- **[A34](shifts/packages/A34.md), by day after A28:** worktrees copy `node_modules` from the main checkout, which sits on an old branch without `@capacitor/clipboard` and `@capacitor/share`, so run 169 (A28) failed its typecheck three times; sandra's stopgap of 2026-10-21 copied phase-1's `node_modules` into the main checkout.
- **The golden gate's tightest timing:** `g58-factorial-1e6-12` (`tests/golden/precision.yaml:341`, `budgetMs: 2000`) took 2111 ms in run 170 and cost A28 a fix round; a plain rerun passed. By day: raise its budget with a reason in decisions.md, or measure the gate's spread first.
- **The pipeline:** A15's tests check fixed dry-run echo lines, not `want_checks` and `resolve_audit_model` (Opus pass 20); the size test does not cover CSS (25.8 kB raw at 2026-10-12).
- **C3. CI** (needs your OK); **C4. F-Droid recipe:** untested end to end; `npm ci` after `prebuild` needs an offline rework.

### MVP release (docs/02 section 8; not scheduled)
- **R1. GitHub releases** (**A7**, **A8**; decisions.md "The release path"). **R2. Play testing track:** never published without your OK. **R3. Screenshots and store graphics.** **R4. The settings and help pass.**

### v1 and later
In docs/02 section 8; P8 defers most of v1 behind the engineer core. v1: Statistics, Inference, Parametric/Polar/Sequence, Spreadsheet, Finance, Linear/Triangle solvers, RPN. v2: Geometry, Advanced Graphing, 3D, Explorers.
