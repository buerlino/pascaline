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

**On track:** yes on scope and speed (the MVP, sized at 6–9 person-months, took two days of shifts). Every bar held on the low-end Tab One at milestone 3 (keyboard usable 662 ms, engine ready 995 ms, Plot 56 fps, solve p95 80 ms, Enter p95 92 ms); since then A4a (2026-10-16) measured Enter p95 138–160 ms at 12 digits after the agreement check, and the `defs` replay over its bar (decisions.md "A4a"); the night of 2026-10-19 nearly doubled the desktop cost per Enter (G38f1); on the Tab One Enter p95 is 141–153 ms after G53, at the bar (A16, 2026-10-20; DEG was 150–160 before). Two debts: everything is checked against the Virtual Calculator (rev 15751), not the owner's G2 (rev 15515); only the Tab One is measured regularly (Fairphone 6 once: keyboard usable 329 ms, engine ready 609 ms, Plot 89 fps).

## Needs the user
0. **At milestone 5:** time ten tasks by hand, E-notation against units (the rule 2 speed gate).
1. **Your steps from the research of 2026-10-19** (decided 2026-10-20: decisions.md P18–P22): push G75's patch commit once merged, then send Parisse the reply with its link (`../outreach/email-parisse-2.md`, in English); ask F-Droid whether checked-in derived data (`find/factors.yaml`, P22) is fine, before C4 (A21 is merged; only the recipe waits); after G77, annabell builds the release engine on the new pin and runs the golden gate on it.
2. **Open proposals:** none. Decided on 2026-10-20: A16 after G53 (at the bar; its third row after G65 decides), S13, G53, G57, S6, S8, M4-2 (± on Shift + `,`, R71), the docs budgets stay, the pipeline gaps as A24 and A25. Decided on 2026-10-19: route R, S12, G57 and the pipeline's three changes (as recommended); G33, R56, R43, R34, R7, A4a points 3 and 4, P7 point 4 and the fixed Math menu (decisions.md "Owner answers of 2026-10-19").
3. **G2 questions:** the unanswered items of `tests/golden/G2-CHECKLIST.md` (41, 42, 52, 56 and 63–69 on 2026-10-19, 70 and 71 on 2026-10-20; 40, 43, 44, 46, 48–51, 53, 55, 57–59, 61 and 62 were answered on the G2 that day, some only in part, see the file; 63–65 can reverse S14's route R (built by R64 and G46), 66 and 67 before G42, 68 changes no code (G40 built its default); each one minute on the Virtual Calculator or your G2; each package built a default, named in decisions.md); the optional real-G2 spot checks (item 8 and `spec/mapping/vc-2026-10-11/SPOT-CHECK.md`).
4. **From daily use:** the key sequence that left ⌫ stuck "at log" (F39: R47 fixed the case found); connect your phone with a motor for A9 (F41); more UI points into [feedback.md](feedback.md). The checks on the phone are listed below.
5. **The new application id** (`io.github.buerlino.pascaline`): the next APK installs as a second app; copy what you need from the old app, then uninstall `org.pascaline.app`. The backup (R38) protects later moves only. Android's own backup is off (A23): its phone-to-phone transfer no longer carries Pascaline's data, only our backup file does.
6. **Outside testers:** you run two 30-minute rounds, after R4b and after R24c, from [r18](research/r18-outside-test.md) and its sheet; R70 (every press counted) comes first.
7. **Tap "Allow USB debugging"** on a device when it shows `unauthorized`.
8. **Later, not now:** the name and trademark checks, CI (C3) and the F-Droid recipe (C4).

### Checks on the phone (one list; each by the owner, or annabell when a package names it)
- Flick misfires in a minute of typing (R9: 20 px arm, 12 px cancel); whether the first tap after a cold start vibrates (R35).
- R7's sheet defaults (decisions.md "Needs the user"); the 36 px cluster rows and the 28 px status line (R15b).
- A11: Share session, Paste (Shift + Copy) of `1.5e-3`, r11 section 5 points 1–4; a chip tapped right after a flick (R15c2).
- The strip right of an inner fraction that ends a numerator, about 8 px (R42): widen only if a finger misses it.
- "Working…" on the WebView, and a taller CAS result growing its row (F8).
- The trackpad's `touch-action: none`: any side effect (K1).
- The memory cap on the Tab One: `makemat(1,30000,30000)` in CAS gives "Out of memory" and the app stays up (G24).
- Desktop only: `npm run dev` in Firefox, type, Alt+Tab away and back, type on the hardware keyboard (decisions.md "Focus on return").
- Removal tests to read: the "stored in Home" line under CAS results (R32, two weeks), digit groups (R55), the angle check (R37), results mode's counters (P16), library imports (S4), Undo (P13).

### Upstream reports (owner; drafts in `../outreach/upstream-reports.md`)
- **libqalculate**, filed 2026-10-19: `hp` [#1043](https://github.com/Qalculate/libqalculate/issues/1043) and `mmHg` = 1 Torr, with `inHg` [#1044](https://github.com/Qalculate/libqalculate/issues/1044), both fixed in master (`92ecde7`, after 5.13.1); derived constants off CODATA 2022 in the last digit [#1045](https://github.com/Qalculate/libqalculate/issues/1045), closed 2026-10-20: master's inputs fix most; qalc's ± display widens the uncertainty (our index rounds the propagated one, as CODATA does); formulas keep correlations, which our σ ignores (G80, G81). A fix fails the index build on its `override` in `find/units.yaml` once we pin a release that has it.
- **MathLive**, filed 2026-10-19: F10 ⌫ stuck at a `\left…\right` [#3122](https://github.com/arnog/mathlive/issues/3122), F33 the touch caret [#3123](https://github.com/arnog/mathlive/issues/3123), F9 the focus restore [#3124](https://github.com/arnog/mathlive/issues/3124).
- **Giac**, not filed yet. Parisse (2026-10-19) takes reports by email, on the forum or as links to fix commits here; the planned route (reply draft `../outreach/email-parisse-2.md`, not sent): the two build patches and patch 0003 (complex `tanh`, G75; P19) as commit links, the rest as four forum threads (the drafts' "Status"). Fill in the date once sent: the build fixes we patch (`engine/giac/patches/README.md`) and the re-published tarballs; complex `tanh` gives coth (G50); `erfc` as 1−erf (`evalf(erfc(5))` wrong from the 3rd digit, `UTPN(10)` = 0.0); the exact path of `(-3)^(1/1000-i/50)` (F46); `re()` of nested roots (F45); `normald_icdf(10^-10)` (docs/04 2.3 #2); `acos(pi)` = undef; `int(1/x,x,-1,1)` = 0 and `sum(cos(k),k,1,inf)` = −1/2 (G39); `round(x,n)` and `trunc(x,n)` in a double (F48); no MPFR path for complex `acos` (real part), complex `asinh` and `sqrt` (F47), `romberg`, `BesselJ`, `Airy_Ai`; degree mode (deep check D4–D7, D12); unit data (US quart, tsp, cup, UK gallon, inHg = 25.4 Torr, au, light-year, `u`, f0) and Xcas menu names Giac does not read (`tools/probes/g2-units.mjs`). Asked in the email instead: `median`, `round(-2.5)` (G42), `atan(2*i)`, `sign` decided at `Digits` (G38).

## Tasks

### Open bugs (rechecked 2026-10-20 on `da7a59c`; family n: [bug-patterns.md](research/bug-patterns.md) section 3; each line names its package, which holds the evidence)
- [x] **F44 → G58 (3062c2a).** Home answers `exp(1.5ᴇ8)`, `√(e^(2ᴇ8))`, `3+e^(1.5ᴇ8)/asin 3`, `acos(5!^(2.5+5!))` and `exp(10^7)` in under 0.1 s, `factorial(10^6)` in 1 s (Giac's own GMP call); a deadline refuses past 2 s. `acos(5!^(2.5+5!))` at 30 digits stays wrong from the 14th digit under `≈` (a double, F47 → G60). r16 F1.
- [x] **F45 → G59 (96c69a0).** `√(√(asin(12)))` = `≈ 1.319…−0.376…i` (was −1.319…): the value is read by `evalf`, split after. r16 F2.
- [x] **F46 → G59 (96c69a0), G59f1.** `(sin 3.7 − e)^(0.001·asin(6.02ᴇ8))` is `⚠` (was `≈`, wrong from the 4th digit); without a decimal, `(sin(37/10)−e)^(asin(602000000)/1000)` is `⚠` too: a power with several values is checked against exp(b·ln a). r16 F3.
- **F47 → [G60](shifts/packages/G60.md).** A double inside an MPFR result, at 30 digits: `log10(asinh(asin e))` wrong from the 14th digit under `≈`; `asin`/`acos` of a real \|x\| > 1 inside other functions show `⚠ 14` with 12–13 right; `√(asinh(cos 10))` shows a real part 4.7E-15 that is noise. Family 4. r16 F4–F6.
- [x] **F48 → G71 (f11b20e).** Two-argument `round`/`trunc` are ⚠ (they compute in a double); their Giac patch: F61. hunt N7.
- [x] **F49 → G71 (f11b20e).** `trunc`, `Heaviside` and 11 functions of the census decide twice. hunt N8.
- [x] **F50 → G78 (cb445bf).** Home refuses Giac's text for a number: `asin(acos(π²))`, `exp(cosh(asin π))`, `√(asinh(asin 3.7))` "No value found", `sinh(6020³)` "Overflow", `∫₋₁¹ 1/x²` (+∞) as divergent. r16 F7.
- [x] **F51 → G78 (cb445bf).** `1/(1/0)`, `exp(ln 0)`, `exp(ln(0·2))`, `√5/asinh 10/(sin(5!)·(3/0))` are refused "Division by zero" (was `= 0`). r16 F8.
- [x] **F52 → G67.** A Giac setting typed in Home or CAS (`approx_mode:=1`, `angle_radian:=0`, `integer_format(16)`, `cas_setup(…)`, `xcas_mode(1)`) is put back after the input (one read per input, the result says it was not kept) and never logged; a library may not set one; Find hides the setting commands. It also puts back Giac's own leaks (`eval_level` after a `throw`, `epsilon` after `(-32)^(1/5)`). hunt N1, N2.
- [x] **F53 → G68 (078642f).** Solve sends an answer's full value with its confirmed digits; a second solve with each known moved confirms the result. Family 1.
- **F54 → [G69](shifts/packages/G69.md).** With a stored x, `sum(x^2,x,1,10)` = `⚠ 385` "inherited: x" (`≈ 385` for an `≈` x; right `= 385`): `inherited()` reads bound names (`host.ts:452`). Families 8, 1; today. hunt N4.
- **F55 → [R69](shifts/packages/R69.md).** Copy session writes `⚠ 39` beside √2, π, ln 2, whose screen mark is `≈` (`clipboard/text.ts:122`). Families 6, 8; today. hunt N5.
- [x] **F56 → G70.** Function app Area gives ∫₀¹ ln x = −1, ∫₀² x ln x = 0.38629436112, ∫₋₁¹ (1−cos x)/x² = 0.972770752471 (Romberg's undef no longer refuses; only Home's refusals do). hunt N6.
- **F57 → [G72](shifts/packages/G72.md).** A library body with `increment(cnt)` changes cnt by 2 per Enter and logs nothing (`definitionStores`, `isStateful` miss `++`, `DelVar`). Families 9, 3; after R59. hunt N9.
- **F58 → [G65](shifts/packages/G65.md).** `x:=y:=3`, `purge(x)`, `purge(y)`: after a relaunch x and y are 3 again (`defs.ts:73` keeps "other" entries). Family 1; low (no key types `:=`). hunt N10.
- [x] **F59 → G71 (f11b20e).** A decision over a value with no MPFR path (`BesselJ(1,2) > 0.5`) is decided at the double with ⚠.
- [x] **F60 → G84 (043af31).** `exp(-10^30)`, DEG `exp(cosh(asin π))` are refused "Underflow" (were `⚠ 0`). Family 5.
- **F61, no package yet.** Giac's exact `acosh` of a negative non-rational is ln(…) at Digits 40 and its conjugate at 80 (`acosh(-1/2)` ≈ -6.8E-15+2.094*i); two-argument `round`/`trunc` need their Giac patch (decisions.md G71). Family 4.

- **The hardening without a bug line** (P18–P22; brief section 0, night steps 2–6): [G75](shifts/packages/G75.md) and G56; G73, G74, G76; S17, G77, S18; the instruments G61–G64, A19 and S16; A22 by day; [x] A20, [x] A21 (`find/factors.yaml`; only the recipe's qalc build waits for F-Droid's answer).

### Milestone 4a: feel (P11; packages and order: brief section 0)
- **R15c1–R15c4. The R3 top cluster** (R15c1 done: the status line takes Apps, Menu and the views; R15c2 done: the round pad, U1–U6 and the editing wing; R15c3–R15c4 left) (decisions.md "R15c"): the status line takes Apps, Menu and the views; the round pad, six user keys and the editing wing; the user keys' Alpha layer; first-start tips.
- **R49. Settings as a list of rows** (feedback #50; decisions.md "Settings: a list of rows").
- **R50b–R50e. Themes** (R50b–R50d done; R50e left) (feedback #53, #55; decisions.md "R50"): Pascaline in the app, the generator and four more families, Plain keys and High contrast, Settings › Appearance; then **R12b, R12c. The visual pass** (F6 = U5 + U7; the mockups R12a merged, the owner's notes feedback #54, #55; A4a's sheet rise in R12c).
- **R55. Digit groups in drawn results** and **R57. The decimal comma as a setting** (feature analysis; R57 also makes `selectENumber` read the comma).
- **R53. Results mode on the View key** (P16, S9; it replaces the compact keypad).
- **The trust features** (the deep-dive review): **R36** why the mark, **R33** names with a value marked on the line, **R37** the angle check, **R40** muted digits past a constant's uncertainty, **R41** key labels for TalkBack and the largest font (A4a point 4).
- **F41. Key vibration does nothing on the phone:** **A9**. **Paste and Share on Android:** [x] **A11**. **The defs replay:** [x] **A12** (p50 158 ms, library 403 ms), then [x] [G83](shifts/packages/G83.md) (functions defined on first use; 200-program restore 23 → 3 ms in Node) and a Tab One run, before R59.
- **The backup:** **R38a**, **R38b** (S6 decided 2026-10-20, R11).
- **Still open from the checks of 2026-10-19:** **G56** the CAS check through a user function (narrowed, after G60); **A16** the Tab One's Enter p95 (at the bar after G53, decided 2026-10-20; the third row waits for G65); **A18** the behaviour diff in the audit; **G65**, **G66** names from Giac's state (S13 accepted; G65 takes F58); G42's rewrite waits for G2 items 66 and 67 (S12).

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
- **The pipeline:** the golden gate gates its own scripts (**A25**); the timing tests that kept G70f1 and G67 unmerged (`novalue` timing case, `homeDeadline` acos, golden `g58-factorial-1e6-30`) go into `pipeline-logs.ts` isTiming; the checks run on a prebuilt engine, so a Giac patch (G75) cannot pass them (**A28**).
- **A15's tests** (Opus pass 20, annabell): `scripts/pipeline.test.sh` checks the planned size and docs checks and the gorge raise against fixed dry-run echo lines, not `want_checks` and `resolve_audit_model`, so a regression there passes; the dry run prints no raise for `--model opus`.
- **C3. CI:** a GitHub Actions workflow calling `npm run gate` (needs your OK). **C4. F-Droid recipe:** untested end to end; `npm ci` after `prebuild` needs an offline rework; the version is A7.
- The size test does not cover CSS (25.8 kB raw at 2026-10-12): a line of its own if it passes 40 kB.

### MVP release (docs/02 section 8; not scheduled)
- **R1. GitHub releases:** a tag builds, gates, signs and publishes the APK (**A7**, **A8**; decisions.md "The release path").
- **R2. Play testing track:** the store texts in `fastlane/metadata/`; never published without your OK. **R3. Screenshots and store graphics** (the icon is done). **R4. The settings and help pass:** the i18n table complete, the first help texts.

### v1 and later
In docs/02 section 8; P8 defers most of v1 behind the engineer core. v1: Statistics, Inference, Parametric/Polar/Sequence, Spreadsheet, Finance, Linear/Triangle solvers, RPN. v2: Geometry, Advanced Graphing, 3D, Explorers.
