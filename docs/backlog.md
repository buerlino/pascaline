<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Status and backlog

The one place for "where are we and what's left", one or two lines per open item. The architecture is [04-architecture.md](04-architecture.md) (it supersedes [02-architecture-plan.md](02-architecture-plan.md) where they differ; 02 section 12 keeps the milestone history); decisions are in [decisions.md](decisions.md); the order of the packages is [shifts/brief.md](shifts/brief.md) section 0, and each package's cause, steps and tests are in its file in [shifts/packages/](shifts/packages/). Done items leave this file (git history and [archive/backlog-2026-10.md](archive/backlog-2026-10.md) keep them). Keep it current by rewriting, not by adding amendments.

## Where we are

| Stage | State |
|---|---|
| Phase 0 spike; MVP milestones 1 (Home, CAS), 2 (Function, Solve), 3 (Python, removed by P11) | **Done** 2026-10-11 (reports in [archive/shifts/](archive/shifts/)) |
| Milestone 4a: feel (P11) | **In progress.** The entry work (⌫, cursor, focus, hardware keys), sheets, flicks, Settings page, history-row actions, the R15b cluster and the mockups (R12a) are merged. Left: the R3 cluster (R15c1–R15c4), Settings rows, the palette, the visual pass, results mode, the trust features (brief section 0) |
| Milestone 4: Find and trust | Engine side done (marks, 30 digits, chips, copy, defs, the Find index, the size test, A4a); left: Find's UI (R4a, R4b) and its device bar (A4b) |
| Milestone 5: Units | The evaluator on Giac is done (P15: G15–G18, G25, G13, G7, G32; the parser's units mode R28; the slot model R24a); left: the pad and the entry (R24b–R24d), the result view (not packaged), the device bar |
| Milestone 6: Structure | Not started (EN5–EN7, Help) |
| MVP release | Not scheduled (owner, 2026-10-12); A7 and A8 on the owner's go |

`phase-1` and `master` are on GitHub; `master` was last fast-forwarded to `phase-1` on 2026-10-11 (b4431ae). Work continues on `phase-1`.

**On track:** yes on scope and speed (the MVP, sized at 6–9 person-months, took two days of shifts). Every bar held on the low-end Tab One at milestone 3 (keyboard usable 662 ms, engine ready 995 ms, Plot 56 fps, solve p95 80 ms, Enter p95 92 ms); since then A4a (2026-10-16) measured Enter p95 138–160 ms at 12 digits after the agreement check, and the `defs` replay over its bar (decisions.md "A4a"); the night of 2026-10-19 nearly doubled the desktop cost per Enter (G38f1); on the Tab One Enter p95 stayed 135–138 ms in RAD and is 150–160 ms in DEG (A16, before G53). Two debts: everything is checked against the Virtual Calculator (rev 15751), not the owner's G2 (rev 15515); only the Tab One is measured regularly (Fairphone 6 once: keyboard usable 329 ms, engine ready 609 ms, Plot 89 fps).

## Needs the user
0. **At milestone 5:** time ten tasks by hand, E-notation against units (the rule 2 speed gate).
1. **Open proposals:** decisions.md "Needs the user" (G57's run-once forms `sto`, `=>`, `[a,b]:=`, after G65; G53's 1.35× instead of 1.3×, accept; S13's +1 call/Enter, G65; M4-2: budgets, ± key, mockup; S6: the backup). Decided on 2026-10-19: route R, S12, G57 and the pipeline's three changes (as recommended); G33, R56, R43, R34, R7, A4a points 3 and 4, P7 point 4 and the fixed Math menu (decisions.md "Owner answers of 2026-10-19"). The night of 2026-10-19 and what it left: [research/night-shift-check-2026-10-19.md](research/night-shift-check-2026-10-19.md).
2. **G2 questions:** the unanswered items of `tests/golden/G2-CHECKLIST.md` (41, 42, 52, 56 and 63–69 on 2026-10-19; 40, 43, 44, 46, 48–51, 53, 55, 57–59, 61 and 62 were answered on the G2 that day, some only in part, see the file; 63–65 before S14, 66 and 67 before G42, 68 changes no code (G40 built its default); each one minute on the Virtual Calculator or your G2; each package built a default, named in decisions.md); the optional real-G2 spot checks (item 8 and `spec/mapping/vc-2026-10-11/SPOT-CHECK.md`).
3. **From daily use:** the key sequence that left ⌫ stuck "at log" (F39: R47 fixed the case found); connect your phone with a motor for A9 (F41); more UI points into [feedback.md](feedback.md). The checks on the phone are listed below.
4. **The new application id** (`io.github.buerlino.pascaline`): the next APK installs as a second app; copy what you need from the old app, then uninstall `org.pascaline.app`. The backup (R38) protects later moves only.
5. **Outside testers:** you run two 30-minute rounds, after R4b and after R24c, from [r18](research/r18-outside-test.md) and its sheet; first decide S8 (decisions.md).
6. **Keep the K2 flick classifier** of the deleted `p1/ron-eve-gestures` (commit `96fcf50`): `git tag keep/eve-gestures 96fcf50` keeps it past git's pruning.
7. **Tap "Allow USB debugging"** on a device when it shows `unauthorized`.
8. **Later, not now:** the email to Bernard Parisse (draft in `../outreach/`, with P10's question: may the English entries of `aide_cas` ship in a GPL-3.0-or-later app? Needed before any public release), the name and trademark checks, CI (C3) and the F-Droid recipe (C4); the upstream reports below.

### Checks on the phone (one list; each by the owner, or annabell when a package names it)
- Flick misfires in a minute of typing (R9: 20 px arm, 12 px cancel); whether the first tap after a cold start vibrates (R35).
- R7's sheet defaults (decisions.md "Needs the user"); the 36 px cluster rows and the 28 px status line (R15b).
- The strip right of an inner fraction that ends a numerator, about 8 px (R42): widen only if a finger misses it.
- "Working…" on the WebView, and a taller CAS result growing its row (F8).
- The trackpad's `touch-action: none`: any side effect (K1).
- The memory cap on the Tab One: `makemat(1,30000,30000)` in CAS gives "Out of memory" and the app stays up (G24).
- Desktop only: `npm run dev` in Firefox, type, Alt+Tab away and back, type on the hardware keyboard (decisions.md "Focus on return").
- Removal tests to read: the "stored in Home" line under CAS results (R32, two weeks), digit groups (R55), the angle check (R37), results mode's counters (P16), library imports (S4), Undo (P13).

### Upstream reports (owner; each with a minimal case)
- **libqalculate** (GitHub issues): `hp` is 745.6999871 W, the definition gives 745.69987158227… W (`derived`); `mmHg` is defined as 1 Torr, it is 133.322387415 Pa; `inHg` follows it (conventional 3386.388640341 Pa); thirteen CODATA 2022 values or uncertainties differ in the last digit (the list: `find/units.yaml`, entries with `override`).
- **Giac** (with the Parisse email): the build fixes we patch (`engine/giac/patches/README.md`: the `add_evalf` log and `UI.addevalf`, the `caseval` timeout in whole seconds, `markup.cc` with `EMCC2`, re-published tarballs); wrong digits (docs/04 2.3 #2–#5: `normald_icdf(10^-10)`, `UTPN(10)` and `romberg` at 30 digits, no MPFR path for `BesselJ`, `Airy_Ai`); `median` of an even list gives the lower middle, `round(-2.5)` gives −2 (G42); signs and `floor` decided at `Digits` (G38: `sign(sin(10^50))` = 1 at 12 and 30, right at 60); principal values and Abel sums returned as values (G39: `int(1/x,x,-1,1)` = 0, `sum(cos(k),k,1,inf)` = −1/2); the US quart and the f0 constant (2.4179883e14 Hz, exact 2.4179892420849182e14), Xcas's menu entries `torr`, `Ci`, `cd`, `rem`, `grad` that Giac does not read as units (`tools/probes/g2-units.mjs`); complex `tanh` (`evalf(tanh(i))` = −0.642092615934·i, right 1.55740772465·i; G50); complex `asin`, `acos`, `atan`, `acosh` without an MPFR path (14 digits at any Digits; `atan(2*i)` gives −π/2+0.549i, mpmath +π/2; G50); MPFR `erf` of a float below about 1E-11 is the argument (`erf(10^-12)`, right 1.12837916710E-12), `erfc` of a negative float at 40 digits is erfc(|x|), `erfc` is 1 − erf (`erfc(4.5)` 31 of 40 digits), `normald_icdf` below about 1E-16 differs on each call (G44); the licence question (P10).
- **MathLive** (GitHub issues): F10, ⌫ at the start of a `\left…\right` body turns the opening bracket into `\left.` and every later ⌫ does nothing (value `\left(2\right)`, position 1, `deleteBackward` ×3); `restoreFocusWhenDocumentFocused` on by default refocuses a field the page blurred (F9); F33, a touch lift places the caret again from a stale `atomBoundsCache` (R42's report has the minimal case).

## Tasks

### Milestone 4a: feel (P11; packages and order: brief section 0)
- **R15c1–R15c4. The R3 top cluster** (decisions.md "R15c"): the status line takes Apps, Menu and the views; the round pad, six user keys and the editing wing; the user keys' Alpha layer; first-start tips.
- **R49. Settings as a list of rows** (feedback #50; decisions.md "Settings: a list of rows").
- **R50b–R50e. Themes** (R50b done: Pascaline in the app) (feedback #53, #55; decisions.md "R50"): Pascaline in the app, the generator and four more families, Plain keys and High contrast, Settings › Appearance; then **R12b, R12c. The visual pass** (F6 = U5 + U7; the mockups R12a merged, the owner's notes feedback #54, #55; A4a's sheet rise in R12c).
- **R55. Digit groups in drawn results** and **R57. The decimal comma as a setting** (feature analysis; R57 also makes `selectENumber` read the comma).
- **R53. Results mode on the View key** (P16, S9; K4).
- **The owner's answers of 2026-10-19:** **R43b** DMS takes a selected □ bare (done, p1/ron-m4a-dmsbox), **R56b** Solve knows the user's functions (night step 57).
- **The trust features** (the deep-dive review): **R36** why the mark, **R33** names with a value marked on the line, **R37** the angle check, **R40** muted digits past a constant's uncertainty, **R41** key labels for TalkBack and the largest font (A4a point 4).
- **F41. Key vibration does nothing on the phone:** **A9**. **Paste and Share on Android:** **A11** (A4a point 5). **The defs replay on the Tab One:** **A12** (G29 merged).
- **The backup:** **R38a, R38b** (S6 done, R11). **Outside tests:** S8 done (R18).
- [x] **A14. The pipeline reads the package files** (S7's follow-up; the docs budgets are checked by `node tools/docs-check.mjs` in `npm run gate`), and **A15. The pipeline enforces its rules** (check 2026-10-19: the audit model, the size and docs checks, no reused dev server).
- [x] **S10. docs/04 diet** before R15c2: 69.5 → 59.7 kB; the evidence is in [research/r12-evidence.md](research/r12-evidence.md).
- [x] **S12. Engine defaults, not G2 copies** ([research/g2-correspondence.md](research/g2-correspondence.md)): the audit (44 rows).
- [x] **S14. Spike: Giac always in radians** ([research/r14-angle-mode.md](research/r14-angle-mode.md)): route R recommended (the 52 angle cases: 52 right, against 18 today) and decided on 2026-10-19: **R64 → G46**.
- **S12's packages:** **G45** one tie rule and the G2's Home answers on record, **R66** the power form keeps Giac's principal root in Home (Function and Solve keep R39), **R67** e and i typed as letters are names (R58b), **R68** ᴇ's leading 1 after an operator; G42 rewritten without the G2 waits.
- **The check of 2026-10-19's silent wrong numbers** ([research/check-2026-10-19.md](research/check-2026-10-19.md)): **G34** (done) a carried value keeps what it showed when the angle mode changes, **G36** (done) FIX digits of a complex number; **G35** (the unit check sees zero terms) is under milestone 5.
- **The deep check of 2026-10-19** ([research/deep-check-2026-10-19-angle-marks.md](research/deep-check-2026-10-19-angle-marks.md)): **G49** (done: `home()` takes a chip table, Store keeps `inexact` facts), **G49f1** (done: a function built from an inexact chip, constant or stored name with facts keeps them, so its call is never `=`), **G49f3** (done: a call also takes the facts of the names the function's body holds now, recursively, and a CAS definition stores them; **G49f4** (done: an arrow definition f:=x->… keeps them too, Home and CAS); open: a CAS result with no float, from a name or function with facts, shows no mark; and three silent `=` through an assignment, night check 2.2) and **R65** (done: Home sends a chip that is not exact as `pasr_<k>` with its facts; `fullExact` never ignores an inexact input) a value's marks travel through Ans, chips and Store; **R64** (done: every typed angle carries `pasdeg`, 1 in every mode until G46; `rewriteAngles` and `dropAngleFactor` in `input/angles.ts`; `pasdeg` reserved) **→ G46** (done: Giac in radians in every mode, `pasdeg` π/180 in DEG; pasexp gone, the stored log migrated at DATA_VERSION 3; CAS and Home symbolic results drawn in degrees in DEG, Ans keeps radians; G21b dropped); **R64f1** (done: the ° template is `u*pi/180/pasdeg`; `polar_coordinates`, the one-list `rectangular_coordinates` and `instfreq` follow the mode); **R64a** (merged 86d9e2e) the plot follows the angle mode (both routes); **G50** (done: in RAD complex tanh, asin, acos, atan and acosh are read through our definitions at P digits, a double Giac prints with 14 or 15 digits confirms one digit fewer (G42f1: a shorter print is the value itself), and a stored name or function that holds one is read through them too (G50f1), else a non-real value is ⚠; `tools/probes/complex-audit.ts` 0 gaps in 720 rows) complex arguments of the audited functions.
- **The night check of 2026-10-19** ([research/night-shift-check-2026-10-19.md](research/night-shift-check-2026-10-19.md)): **S15** decisions.md gets room (done, 35.1 kB); **G48** (done) no `=` through a run-once assignment, **G51** (done) CAS marks from stored facts, **G56** complex functions in a stored body, **G47** cases for G50's lost digit, **G57** (done) an undecided decision is refused; **G52** (done) Giac calls in the gate, **G53** (done, 1.35×: decisions.md) the second decision's cost, **A16** the Tab One's Enter p95; **G54** (done) our names in Giac text, `engine/ourNames.ts` (before R59); **G55** (done), **A18** the behaviour diff; **S13** (done: G65, G66) names from Giac's state; **A17** (done) the pipeline merges the audited commit, night.sh ends on time.
- **The deep check of 2026-10-19, exact answers and units** ([research/deep-check-2026-10-19-exact-units.md](research/deep-check-2026-10-19-exact-units.md)): **G38** (done) the exact path decides at the value precision (`sign(sin(10^50))` = 1), **G39** (done) a divergent sum or integral is refused (`∫₋₁¹ 1/x` = 0), **G42** (done: the median of an even list and percentile are ours, a non-real element refused; Giac's round and quartiles stay) median, round, quartiles, **G43** (done) invariants across settings in the golden gate, **G44** (done: Newton from Giac's value on our MPFR forward functions, checked at P and P + 20; audited for the polished input only) the inverse distribution functions polished (§2.3 #2), **G44f1** (done: `erf` and `erfc` through `paserf`/`paserfc`, audited; an icdf ±infinity inside (0, 1) polished, else ⚠), **G44f2** (done) Giac's icdf `undef`, a tail start, **G44f2f1** (done) Newton first, **G43f2** (done: 18.1 s) the invariants stage under 30 s; the unit packages are under milestone 5.

### Engineer core (P8; architecture docs/04, plan and gates docs/03 section 8)
A milestone is done when its benchmark tasks (`tests/tasks/tasks.yaml`) pass within budget and its gates hold.

**Milestone 4: Find and trust.** Steps 1–7 and 9–11 are done (EN0, the regression cases, EN3, chips and Ans, the qalc build, the Find index and query test, copy and share, definitions that survive a relaunch, the size test).
- **8. EN1, Find's UI:** **R4a** (Find on Math) and **R4b** (Vars, Memory, the user keys from Find). Gate: task 5 within budget, the query test, the size test, no index request before idle.
- **12. Device:** **A4b**, Find per key on the Tab One (§8.3). A4a's misses: decisions.md "A4a point 1" and "Owner answers of 2026-10-19 (feel)" (4).
- **EN4, open:** copying one element of a list or matrix.
- **Gate:** task 5 within budget; the query test; the golden gate with marks and `precision.yaml`; no §2.3 item #1–#9 left; the size test; the Tab One bars of §8.3.

**Milestone 5: Units** (P15; docs/04 section 4). Items 1–3 are done: the evaluator (G16), temperatures and levels (G17), uncertainty (G18), the result's unit (G25), the data audit (G13), Find's pad data (G7), rpm's message (G32), the parser's units mode (R28).
- **4. The unit view:** before R24c, done: zero terms (**G35**), °C in a compound unit (**G37**), σ beyond first order (**G41**), angles (**G40**; the view shows `Quantity.note`); the pad (**R24b**), the entry (**R24c**), Find in a slot and the user cells (**R24d**); the result view: **S11** done ([R17](research/r17-unit-result.md)): **R60** alternatives, **R61** chip, **R62** view, **R63** way back. Open points with defaults: r7 section 7.
- **5. Build, size, devices** (annabell, after R24c): the first unit result on the Tab One and the Fairphone 6 (< 1 s).
- **Gate:** tasks 1–4 and 10; a unit in ≤ 4 presses at the median; `units.yaml`; the owner's hand timing.

**Milestone 6: Structure** (not packaged).
- **EN5. Matrices, vectors, lists:** Shift + 5 `[ ]` that grows with ▶ and ▼, the matrix editor on Shift + 4 (§5.3). Gate: task 8.
- **EN6. Number bases:** a display mode of an integer result, Shift + `−` = Base, word size, `0x`/`0b`/`0o` literals (§5.4). Gate: task 7.
- **EN7. Everyday functions:** dB functions, interpolation, RMS, coordinate conversions, DMS, shifts and rotations, each tier 0 with a golden case; the inverse functions polished against their forward function is **G44** (done). Gate: tasks 6 and 9.
- **Help = context help:** the Find preview of the function before the cursor (§5.1).

### Without a package yet
- The Function app and plots of user functions wait for your word (R56b covers Solve); **R58b** Alpha letters are always names in CAS (decided 2026-10-19; G2 item 62 can reverse it); lazy definition of library functions if A12 says so (G33).
- **G9. Number formats against the G2** (item 15: six formats, digits as decimal places, a thousands separator): decide in the settings and help pass.
- **K1:** a pending one-shot Shift is used up by the first drag step; a tap keeps it. **K5:** the gestures in the help texts (release R4).
- **A checks failure from the machine costs fix rounds** (Opus pass 28, annabell, with A18): S15 (run 79) lost both rounds to `svelte-check: command not found` (the shared `app/node_modules` was emptied); a command-not-found failure should stop the run, not hand it to the worker.
- **The golden gate does not gate itself** (Opus pass 35, annabell): `pipeline.sh` skips golden for `app/scripts/golden.ts`, `invariants.ts` and `calls-budget.ts` (G43f1 had no golden run); add them to its pattern.
- **A15's tests** (Opus pass 20, annabell): `scripts/pipeline.test.sh` checks the planned size and docs checks and the gorge raise against fixed dry-run echo lines, not `want_checks` and `resolve_audit_model`, so a regression there passes; the dry run prints no raise for `--model opus`.
- **C3. CI:** a GitHub Actions workflow calling `npm run gate` (needs your OK). **C4. F-Droid recipe:** untested end to end; `npm ci` after `prebuild` needs an offline rework; the version is A7.
- The size test does not cover CSS (25.8 kB raw at 2026-10-12): a line of its own if it passes 40 kB.

### MVP release (docs/02 section 8; not scheduled)
- **R1. GitHub releases:** a tag builds, gates, signs and publishes the APK (**A7**, **A8**; decisions.md "The release path").
- **R2. Play testing track:** the store texts in `fastlane/metadata/`; never published without your OK. **R3. Screenshots and store graphics** (the icon is done). **R4. The settings and help pass:** the i18n table complete, the first help texts.

### v1 and later
In docs/02 section 8; P8 defers most of v1 behind the engineer core. v1: Statistics, Inference, Parametric/Polar/Sequence, Spreadsheet, Finance, Linear/Triangle solvers, RPN. v2: Geometry, Advanced Graphing, 3D, Explorers.
