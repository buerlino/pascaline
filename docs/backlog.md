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

**On track:** yes on scope and speed (the MVP, sized at 6–9 person-months, took two days of shifts). Every bar held on the low-end Tab One at milestone 3 (keyboard usable 662 ms, engine ready 995 ms, Plot 56 fps, solve p95 80 ms, Enter p95 92 ms); since then A4a (2026-10-16) measured Enter p95 138–160 ms at 12 digits after the agreement check, and the `defs` replay over its bar (decisions.md "A4a"). Two debts: everything is checked against the Virtual Calculator (rev 15751), not the owner's G2 (rev 15515); only the Tab One is measured regularly (Fairphone 6 once: keyboard usable 329 ms, engine ready 609 ms, Plot 89 fps).

## Needs the user
0. **At milestone 5:** time ten tasks by hand, E-notation against units (the rule 2 speed gate).
1. **Open proposals:** decisions.md "Needs the user" (G21, G33, R56, Settings rows, R15c Store, A4a points 1, 3 and 4, R34, R43, M4-2, R7, P7 point 4).
2. **G2 questions:** the unanswered items of `tests/golden/G2-CHECKLIST.md` (40–44, 46, 48–53, 55–59, 61 on 2026-10-18; each one minute on the Virtual Calculator or your G2; each package built a default, named in decisions.md); the optional real-G2 spot checks (item 8 and `spec/mapping/vc-2026-10-11/SPOT-CHECK.md`).
3. **From daily use:** pick a palette from `docs/mockups/palettes-r50.html` (R50b waits); the key sequence that left ⌫ stuck "at log" (F39: R47 fixed the case found); connect your phone with a motor for A9 (F41); more UI points into [feedback.md](feedback.md); whether the Math menu's slots should be yours to arrange (feedback, decide around 2026-10-20). The checks on the phone are listed below.
4. **The new application id** (`io.github.buerlino.pascaline`): the next APK installs as a second app; copy what you need from the old app, then uninstall `org.pascaline.app`.
5. **Outside testers** (deep-dive review): two 30-minute rounds with three engineers, after R4b and after R24c; S8 writes the protocol and the task sheet, you run the rounds.
6. **Delete the stale branch** (C7, decided 2026-10-18): `git branch -D p1/ron-eve-gestures` (agents never use `-D`).
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
- **Giac** (with the Parisse email): the build fixes we patch (`engine/giac/patches/README.md`: the `add_evalf` log and `UI.addevalf`, the `caseval` timeout in whole seconds, `markup.cc` with `EMCC2`, re-published tarballs); wrong digits (docs/04 2.3 #2–#5: `normald_icdf(10^-10)`, `UTPN(10)` and `romberg` at 30 digits, no MPFR path for `BesselJ`, `Airy_Ai`); `median` of an even list gives the lower middle, `round(-2.5)` gives −2; the US quart and the f0 constant (2.4179883e14 Hz, exact 2.4179892420849182e14), Xcas's menu entries `torr`, `Ci`, `cd`, `rem`, `grad` that Giac does not read as units (`tools/probes/g2-units.mjs`); the exp-in-DEG patch if G21b is built; the licence question (P10).
- **MathLive** (GitHub issues): F10, ⌫ at the start of a `\left…\right` body turns the opening bracket into `\left.` and every later ⌫ does nothing (value `\left(2\right)`, position 1, `deleteBackward` ×3); `restoreFocusWhenDocumentFocused` on by default refocuses a field the page blurred (F9); F33, a touch lift places the caret again from a stale `atomBoundsCache` (R42's report has the minimal case).

## Tasks

### Milestone 4a: feel (P11; packages and order: brief section 0)
- **R15c1–R15c4. The R3 top cluster** (decisions.md "R15c"): the status line takes Apps, Menu and the views; the round pad, six user keys and the editing wing; the user keys' Alpha layer; first-start tips.
- **R49. Settings as a list of rows** (feedback #50; decisions.md "Settings: a list of rows").
- **R50b. The picked palette** (feedback #53; the mockup of R50a), then **R12b, R12c. The visual pass** (F6 = U5 + U7; the mockups R12a merged, the owner's notes feedback #54, #55; A4a's sheet rise in R12c).
- **R55. Digit groups in drawn results** and **R57. The decimal comma as a setting** (feature analysis; R57 also makes `selectENumber` read the comma).
- **R53. Results mode on the View key** (P16, S9; K4).
- **The trust features** (the deep-dive review): **R36** why the mark, **R33** names with a value marked on the line, **R37** the angle check, **R40** muted digits past a constant's uncertainty, **R41** key labels for TalkBack and the largest font (A4a point 4).
- **F41. Key vibration does nothing on the phone:** **A9**. **Paste and Share on Android:** **A11** (A4a point 5). **The defs replay on the Tab One:** **A12** (G29 merged).
- **The backup:** **S6** (files in and out without INTERNET), then **R38a, R38b**. **The outside-test protocol:** **S8**.
- **A14. The pipeline reads the package files** (S7's follow-up; the docs budgets are checked by `node tools/docs-check.mjs` in `npm run gate`).

### Engineer core (P8; architecture docs/04, plan and gates docs/03 section 8)
A milestone is done when its benchmark tasks (`tests/tasks/tasks.yaml`) pass within budget and its gates hold.

**Milestone 4: Find and trust.** Steps 1–7 and 9–11 are done (EN0, the regression cases, EN3, chips and Ans, the qalc build, the Find index and query test, copy and share, definitions that survive a relaunch, the size test).
- **8. EN1, Find's UI:** **R4a** (Find on Math) and **R4b** (Vars, Memory, the user keys from Find). Gate: task 5 within budget, the query test, the size test, no index request before idle.
- **12. Device:** **A4b**, Find per key on the Tab One (§8.3). A4a's misses are in decisions.md "A4a".
- **EN4, open:** copying one element of a list or matrix.
- **Gate:** task 5 within budget; the query test; the golden gate with marks and `precision.yaml`; no §2.3 item #1–#9 left (all fixed except #2's value polish, EN7); the size test; the Tab One bars of §8.3.

**Milestone 5: Units** (P15; docs/04 section 4). Items 1–3 are done: the evaluator (G16), temperatures and levels (G17), uncertainty (G18), the result's unit (G25), the data audit (G13), Find's pad data (G7), rpm's message (G32), the parser's units mode (R28).
- **4. The unit view:** the pad (**R24b**), the entry (**R24c**), Find in a slot and the user cells (**R24d**); the result view (value, mark, unit, dimension, one-tap alternatives, `units.targets`, the `\res` chip back to Home) gets its packages next. Open points with defaults: r7 section 7.
- **5. Build, size, devices** (annabell, after R24c): the first unit result on the Tab One and the Fairphone 6 (< 1 s).
- **Gate:** tasks 1–4 and 10; a unit in ≤ 4 presses at the median; `units.yaml`; the owner's hand timing.

**Milestone 6: Structure** (not packaged).
- **EN5. Matrices, vectors, lists:** Shift + 5 `[ ]` that grows with ▶ and ▼, the matrix editor on Shift + 4 (§5.3). Gate: task 8.
- **EN6. Number bases:** a display mode of an integer result, Shift + `−` = Base, word size, `0x`/`0b`/`0o` literals (§5.4). Gate: task 7.
- **EN7. Everyday functions:** dB functions, interpolation, RMS, coordinate conversions, DMS, shifts and rotations, each tier 0 with a golden case; `normald_icdf` and the other inverse functions polished against their forward function (§2.3 #2). Gate: tasks 6 and 9.
- **Help = context help:** the Find preview of the function before the cursor (§5.1).

### Without a package yet
- **R56 for Solve and the Function app** (decisions.md "Needs the user"); **G21b** (the same); lazy definition of library functions if A12 says so (G33).
- **G9. Number formats against the G2** (item 15: six formats, digits as decimal places, a thousands separator): decide in the settings and help pass.
- **K1:** a pending one-shot Shift is used up by the first drag step; a tap keeps it. **K5:** the gestures in the help texts (release R4).
- **C3. CI:** a GitHub Actions workflow calling `npm run gate` (needs your OK). **C4. F-Droid recipe:** untested end to end; `npm ci` after `prebuild` needs an offline rework; the version is A7.
- The size test does not cover CSS (25.8 kB raw at 2026-10-12): a line of its own if it passes 40 kB.

### MVP release (docs/02 section 8; not scheduled)
- **R1. GitHub releases:** a tag builds, gates, signs and publishes the APK (**A7**, **A8**; decisions.md "The release path").
- **R2. Play testing track:** the store texts in `fastlane/metadata/`; never published without your OK. **R3. Screenshots and store graphics** (the icon is done). **R4. The settings and help pass:** the i18n table complete, the first help texts.

### v1 and later
In docs/02 section 8; P8 defers most of v1 behind the engineer core. v1: Statistics, Inference, Parametric/Polar/Sequence, Spreadsheet, Finance, Linear/Triangle solvers, RPN. v2: Geometry, Advanced Graphing, 3D, Explorers.
