<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Status and backlog

The one place for "where are we and what's left". The plan is [02-architecture-plan.md](02-architecture-plan.md) (section 12 has the milestone history); decisions are in [decisions.md](decisions.md); shift reports are in [shifts/](shifts/). Last reviewed 2026-10-12 (cleanup audit; then the engineer-core roadmap, P8).

## Where we are

| Stage | State |
|---|---|
| Phase 0 spike | **Done**, GO (2026-10-11) |
| MVP milestone 1: MathPrint Home + CAS | **Done** 2026-10-11 |
| MVP milestone 2: Function app + Solve app | **Done** 2026-10-11 |
| Virtual Calculator mapping | **Done** 2026-10-11 (data merged, 632dab4). Second session 2026-10-12 answered the last G2 items (19–22, 24–31); see "Follow-ups from the G2 answers" below |
| MVP milestone 3: Python | **Done** 2026-10-11 (desktop gates, S8+ and Tab One device numbers; report docs/shifts/2026-10-11-m3-report.md) |
| Engineer core: milestones 4 (Find and trust), 5 (Units), 6 (Structure) | **Next** (P8, 2026-10-12). Plan: [03-feature-analysis.md](03-feature-analysis.md) section 8; tasks below |
| MVP release (Play testing track + web app, docs/02 section 8) | **Not scheduled** (user, 2026-10-12: not a priority). R1 (offline web app) done; R2–R4 open |
| v1, v2 | Not started; most of v1 is deferred behind the engineer core (P8) |

`phase-1` and `master` are on GitHub; `master` was fast-forwarded to `phase-1` on 2026-10-11 (b4431ae, user). Work continues on `phase-1`.

### Is it on track?
**Yes on scope and speed, but with two growing debts.**

- **Speed.** The plan sized the MVP at about 6–9 person-months. All three were done after two days of agent shifts.
- **Performance.** Every bar is met on the low-end Tab One with room to spare (milestone 3 numbers, docs/shifts/2026-10-11-m3-report.md): keyboard usable 662 ms (bar 1 s), engine ready 995 ms (bar 1.5 s), Plot 56 fps (bar 30), solve p95 80 ms (bar 300 ms); Home Enter → result p95 92 ms (bar 150 ms, milestone 1).

The two debts grow with every milestone:

1. **Everything is checked only against the Virtual Calculator (2.4.2 rev 15751), not a real G2 (rev 15515).** All 31 questions in `tests/golden/G2-CHECKLIST.md` now have a Virtual Calculator answer, so the `assumed` tags are mostly gone, but several defaults still differ from what the reference does (list under "Follow-ups from the G2 answers"). The firmware differs from the user's G2, so a short spot check on the real G2 is still worth it (items 2, 8, 29: see `spec/mapping/vc-2026-10-11/SPOT-CHECK.md`).
2. **Only the low-end tablet is measured.**
   - Fairphone 6 (Android 16, WebView 148, `--measure` build, dev engine, 2026-10-12): keyboard usable 329 ms, engine ready 609 ms (medians of 7); Plot 89.3 fps (60 fps target Q6 met; probably the 90 Hz mode); Home Enter → result p95 23.4 ms warm, 53.2 ms first run (`arith-frac` 93.6 ms, `solve-trig` 66.9 ms, `sum-sym` 53.2 ms). Raw: `.coord/fp6-night.md` (not in git).
   - The Samsung Galaxy S8+ (Android 9, old-device class) was measured in the milestone 3 shift; the old Android 8/9 tablet is no longer needed.
   - Start-up on the Tab One: engine ready 956 ms (milestone 1) → 1022 ms (2) → 995 ms (3); keyboard usable 653–667 → 679 → 662 ms. Python loads lazily (P1). The start chunk grew to 139 kB (L7).

## Needs the user
0. **Veto anything in P8 you disagree with** (`docs/decisions.md`; Henri decided it on your rules of 2026-10-12): the Units app instead of units in Home (amends P3 decisions 2 and 6), Math key = Find, Vars = Find on variables, Shift+Tmpl = Units app, Menu = view actions, no formula library. Silence = go. Later, in milestone 5: time ten tasks by hand, E-notation against units (the rule 2 speed gate).
1. **G2 spot checks on the real G2** (optional, about 15 minutes): item 29 (the stock a b/c key; the Virtual Calculator contradicts the earlier "it was my script" finding), item 8 (tie rounding, typed with the keys) and the list in `spec/mapping/vc-2026-10-11/SPOT-CHECK.md`. The Virtual Calculator answers are already in `tests/golden/g2.yaml`.
2. **Tap "Allow USB debugging"** on a device when it shows `unauthorized`.
3. **Feel of the hold-and-drag cursor (P7 revised, K2)**, now built and merged but not yet in your hands (needs a new APK): keys fire on release (slow?), 350 ms hold (too long or too short?), 10 px slop, ⌫ repeat 400 ms then every 60 ms (too much buzzing?), the extra tick at cursor start, 30% dimming. Also the K1 trackpad feel.
4. **Try lowercase `print(1)` in the Python shell on a device:** on the Fairphone Alpha-lock gave only uppercase (`PRINT(1)` = NameError). Real gap or a missed lowercase layer?
5. **Later, not now** (user, 2026-10-11: first a usable prototype): the email to Bernard Parisse (draft in `../outreach/`), the name and trademark checks, the real application id, CI (C3) and the F-Droid recipe (C4).

Done: the Giac mirror is live (release `deps-giac-2.1.0-1d9536e0`, SHA-256 checked 2026-10-11); the leftover worktrees and branches were removed and Phase 0 is tagged `phase-0-done`; milestone 3 as proposed below is approved (user, 2026-10-11).

## Repo cleanup

### Branches and worktrees
None left: on 2026-10-12 the user removed all worktrees, the two sibling checkouts and every branch except `master` and `phase-1` (cleanup audit, area F). Every removed commit was already in `phase-1`, apart from the old icon (be84510, replaced by 8ff8576).

Optional disk space (gitignored, rebuilt when needed): `engine/giac/_build` (561 MB, the engine build cache).

### Code that used to live in `spike/` (task C1, done)
`spike/` was meant to be throwaway. Shipped code depended on it:
- `build.sh`, `engine/giac/build-wasm-release.sh` and `python/build-micropython.sh` use `tools/devlock.sh`;
- the golden gate (`app/scripts/golden.ts`) runs `tests/engine/interrupt-test.mjs`;
- `tests/golden/oracle.py` writes `tests/golden/G2-CHECKLIST.md`;
- the device tools (`tools/device_run.py` and the others) are part of the measurement workflow.

These moved out of `spike/` (C1, done) before `phase-1` went to `master`. The other Phase 0 spikes were archived on 2026-10-12 (list in `spike/RESULTS.md`, "Archived"); `spike/` now holds only `qalc/` (P3), `RESULTS.md` and `DECISIONS.md`.

## Tasks

### Engineer core (P8; plan and gates in [03-feature-analysis.md](03-feature-analysis.md) section 8)
Three parallel tracks per milestone. A milestone is done when its benchmark tasks (`tests/tasks/tasks.yaml`) pass within budget and its gates hold. Design rules: 03 section 0 (no discipline split; units must beat `E-10`; units separate from normal calculation; focus).

**Milestone 4: Find and trust** (~2 weeks)
- **EN0. Task benchmark** (ron, first, ~1 d): `tests/tasks/tasks.yaml` with the ten tasks of 03 section 6 (id, key sequence, budget, expected result, `source:`, `status: active|pending`); a Playwright replay that counts every key press (Shift and Alpha included) and fails over budget or on a wrong result; today's best sequence recorded as the baseline for pending tasks.
- **EN1. Find UI** (ron): Math key opens Find, Vars opens it filtered to variables; keys type letters directly; mixed results with a kind badge; ranking (recents/frequency, exact, prefix, alias, typo); live preview; constants and units inserted as tokens (a constant as its number outside the Units app). Results update within 16 ms per key on the Tab One; the index loads with Find, start chunk unchanged (L7 size test).
- **EN1-index. Find index and query test** (gorge): a build-time generator (no prebuilt data in git beyond our sources) from Giac's command list and help lines (R5), libqalculate 5.13.1 `units.xml.in`, `variables.xml.in`, `prefixes.xml.in` (names, aliases, titles, values, uncertainty; checked usable 2026-10-12), plus our own alias file; `tests/tasks/find-queries.yaml` with 100 phrases (gate: all in the top 3, ≥ 90 first). THIRD_PARTY.md: libqalculate data.
- **EN3. Honest precision** (gorge): digits up to 30 (golden cases at 20 and 30 digits, `oracle`; Tab One timing); an `=`/`≈` mark on every Home result (`=` only when the decimal shown is the exact value); full-value copy in the result data; `sigfig(x,n)`; a prefix display format beside ENG (`4.7µ`).
- **EN4. Copy, share, export** (annabell): `@capacitor/clipboard` and `@capacitor/share` (MIT; THIRD_PARTY.md), `navigator.clipboard`/`navigator.share` in the PWA; copy a result (full value, or LaTeX), paste a number into the entry, share the session as text, Num table as CSV; in the Home/CAS Menu and on a long press of a history row. One e2e test per action.
- **Device** (annabell): an APK for the owner (K1/K2 feel), L7 cold start on the Tab One.

**Milestone 5: Units** (~2 weeks; P3 plan as amended, 03 section 4)
- **U1–U2** (gorge): `engine/qalc` from `spike/qalc`, `UnitEngine` worker and client, lazy load, cancel; check that qalc's "try exact" mode gives `72 km/h → m/s` = 20 exactly; parser tokens; `tests/golden/units.yaml`; `hp` patch and the data audit.
- **Units app** (ron): Shift+Tmpl and Apps; entry with unit suggestions from the Find index; `→` with the last target per dimension; result with dimension and one-tap alternatives; `±`; result back to Home as a number. Prefix entry chips only if benchmark task 3 shows a gain.
- **Build and devices** (annabell): qalc release build in the trixie container (P2), size gate (+0.93 MB, lazy), a test that plain maths never loads the chunk, first-unit timing on the Tab One and Fairphone 6.
- **Gate:** tasks 1–4 and 10; a unit in ≤ 4 keys at the median; the owner's hand timing.

**Milestone 6: Structure** (~2 weeks)
- **EN5. Matrices, vectors, lists** (ron): matrix template, grid editor, Tmpl list; dot/cross/norm through Find.
- **EN6. Number bases** (gorge): BIN/OCT/DEC/HEX formatter, word size, two's complement, shifts; `0x…` through our parser.
- **EN7. Everyday functions** (gorge): `par`, `eseries`, dB/dBm/Np, interpolation, RMS, coordinate conversions, degrees-minutes-seconds; Giac definitions, each with a golden case, found through Find.
- **Gate:** tasks 6–9.


### Follow-ups from the G2 answers (Virtual Calculator, 2026-10-12)
Each row is a difference between our default and what the reference does (answers in `tests/golden/g2.yaml`, summary in `docs/decisions.md` "G2 answers 2026-10-12"). Nothing here is built yet; the user picks which to follow.

- **G5. Python modules (items 26–28).** Recommendation written 2026-10-12 as P6 in `docs/decisions.md` (match the reference in `hpprime.eval` only; keep `calc` and the canvas); waits for the user. Graphics signatures match our assumed ones (pixon, line, rect, fillrect, circle, textout; graphic first, 0 = screen). Differences: (a) colours are 0xRRGGBB and a run does not clear the screen, but the shell repaints when the script ends, so a drawing disappears unless the script waits; ours keeps a canvas. (b) The reference reaches the CAS and variables through `hpprime.eval(...)` and `hpprime.eval('CAS("...")')`; numbers come back as Python floats even when whole, lists as lists, symbolic results as text, errors as text (not raised). Our `calc.cas` always returns text. Decide whether to match the types.
- **G6. a b/c key (item 29).** With User mode off the reference cycles the last result's form on an empty line (2.5 → 5/2 → 2 1/2) and does nothing while typing a number. This contradicts the user's 2026-10-11 correction (the cycling was their own script). Needs a check on the real G2 before changing L2.
- **G7. Units (item 30):** the reference's behaviour is input for P3 and now lives in `docs/p3-units-plan.md` section 2. Its key position (Shift + r4c3) is our Shift+Tmpl, which opens the Units app (P8).
- **G9. Number formats (item 15).** The reference has six formats (Standard, Fixed, Scientific, Engineering, Floating, Rounded); the digits box defaults to 8 for every format but Standard and counts decimal places (Scientific(8) of `12345.6789` → `1.23456789ᴇ4`), and numbers get a thousands separator (`12,345.6789`). Ours: STD/SCI/ENG (FIX in the formatter only), `digits` = significant digits, no separator. Fits the R4 settings pass; decide then which to match.

### Keypad gestures (P7, decided 2026-10-12, revised the same evening; docs/decisions.md P7)
- **K0. The system keyboard opened when switching apps (bug, user 2026-10-12).** Cause: CodeMirror 6.43 uses Chrome's EditContext on Android (`window.EditContext && browser.android`), and EditContext ignores our `inputmode="none"`; the Python app focuses its editor or shell every time it is shown. **Fixed** 2026-10-12 (`f3b7d45`): `app/src/apps/python/codeView.ts` uses a subclass with CodeMirror's undocumented static `EDIT_CONTEXT = false` (check it still exists when CodeMirror is updated) and adds `virtualkeyboardpolicy="manual"`. Regression test `app/test/softkeyboard.spec.ts`: after each app switch the focused element must have `inputmode=none` and no EditContext (it failed before the fix: "Python editor: DIV uses EditContext"). Python tests still pass. **Checked on the Fairphone 6 (2026-10-12): the system keyboard stayed closed after all ~76 taps, including every switch to and from Python (editor and shell), Function and Solve.
- **K1. Trackpad** on the arrow keys: **done** (`e900263`, merged e340123). Start chunk 139.1 → 141.0 kB (48.3 → 49.1 kB gzip). The pad now has `touch-action: none` (was `manipulation`): check for side effects on a device. A pending one-shot Shift is used up by the first drag step; a tap keeps it.
- **K2. Hold-and-drag cursor on the whole keypad: done** (`54386b9`, merged 9c3fd52; start chunk 141.1 → 142.6 kB, 49.1 → 49.6 kB gzip; logic in `app/src/keyboard/gestures.ts` as `KeyHold` and `Repeat`, wired in `Keypad.svelte`; feel not yet judged). Added ⌫ auto-repeat, which did not exist (400 ms, then every 60 ms, in the layer of the first press). Spec (P7 revised 2026-10-12): hold ~350 ms anywhere, then drag = K1 stepping; keys fire on release; ⌫ keeps auto-repeat; dimmed keys while active. About 40 lines in `Keypad.svelte` (ron's estimate), reusing `Stepper`. One Playwright test (the `touch()` helper supports hold-then-move).
- **K3. Remove the arrow keys** (user's goal, later): once K2 is in use, free the arrow cells for other functions. Not scheduled.
- **K4. Compact keypad with the View key** (P7 point 5): the empty View cell toggles full / compact (upper cluster only); a Menu item to end a Signed area, since Enter is hidden in compact mode.
- **K5. Docs:** gestures in `spec/keyboard.yaml`'s header (trackpad part done) and in the help texts (R4). Flicks dropped (P7 revised).
- **Flaky test seen 2026-10-12:** `test/solve.spec.ts` "Solve: equations and values are stored" failed once in a full e2e run, then passed 6/6 three times on its own. Probably a timing issue in the persistence check under load; watch it.

### Clean-up and infrastructure
- **C3. CI.** There is none. Add a GitHub Actions workflow for typecheck, unit and parser tests (no engine, so it stays fast). The engine gate can go in too, now that the Giac mirror is live. Needs your OK, since it runs on GitHub.
- **C4. F-Droid recipe.** It is untested end to end. `npm ci` downloads packages after `prebuild`, so it needs an offline/srclibs rework. Still open: a release tag and `versionCode`, and screenshots; the icon is done (`8ff8576`) (`fdroid/README.md`).
- **C6. Device tooling fixes** (found on the Fairphone, 2026-10-12): `tools/device_run.py status|start` report `build: release` for a `--measure` build; `tools/stay-awake.sh` stores the original settings under the current worktree's `.coord` unless `PASCALINE_COORD` is set (restore only works from the same worktree); the throwaway debug signing key is per worktree (`android/_keys/`), so installing a build from another worktree fails with `INSTALL_FAILED_UPDATE_INCOMPATIBLE` until the app is uninstalled.
- **C5. Drop the INTERNET permission** (`android/app/src/main/AndroidManifest.xml:40`, Capacitor template default). **Done** (merged 8681313): `dumpsys package` shows no INTERNET; on the Fairphone 6 Home, Function, Solve and the Python shell all run (CAS was not separately tapped). Optionally repeat on the Tab One with the L7 re-measure (cleanup audit E2). A later Pyodide download flavour would add it back there only.

### Left over from milestones 1 and 2
- **L7. Bundle size.** It is 139 kB at start (48 kB gzip; measured 2026-10-12), plus 808 kB of MathLive loaded after the keypad. Trend: 94 kB (milestone 1), 108 (2), 115 (3, the last Tab One measurement), 139. Since milestone 3 the largest single addition is `@capacitor/core` (7.8 kB, imported by `input/haptics.ts` for key vibration); the Format key's state code is most of the rest. Re-measure cold start on the Tab One in the next device session; if it got slower, load Capacitor only in the native build.

### MVP release (docs/02 section 8; not scheduled, user 2026-10-12)
- **R2. Play testing track.** Real application id, signing key (yours), store texts in `fastlane/metadata/`. Never published without your OK.
- **R3. Screenshots and store graphics.** The app icon is done (`8ff8576`, from `logo/`). Our own design; nothing from the reference calculator.
- **R4. Settings and help pass.** i18n table complete, first help texts. Giac help-text licence: R5 (`docs/research/giac-help-licence.md`) reads the English help lines as GPL-3.0-or-later, usable with attribution; that is a reading of Giac's README, so confirming with Parisse is still worth it.

### Unscheduled feature requests (docs/02 section 12b)
- Units, constants and uncertainty: now milestone 5 of the engineer core (P8; P3 plan amended by 03 section 4).

### Done
The record is in the commits, the shift reports and `docs/decisions.md`; the ids stay valid there.
- Cleanup audit (2026-10-12): `docs/cleanup-audit-2026-10-12.md`, areas A–G; branches and worktrees removed, spikes archived, docs and counts brought in line with the code.
- Milestone 3, Python (2026-10-11): P1 worker, P2 `calc`, P3 graphics module, P4 editor and shell, P5 golden and e2e cases, D1 device numbers (m3 report).
- C1 tooling out of `spike/` (`10c2f92`); C2 page-bench results in `.coord/device-runs.jsonl` (`a201499`).
- L1 subscripted unknowns (`a3ddd52`, display in `ec4a94d`), L2 a b/c mixed numbers, L3 alpha lock, L4 one-line caret mode, L5 insertable results (all `ec4a94d`), L6 parser gaps (`6eda358`), L8 x² after a compound term (`4d9c3a1`), L9 ÷ and a/b after a compound term (`d4a44ad`; Virtual Calculator question for the next session: Textbook `1 ÷ 2 ▶ ÷ 3`).
- G1 Num table and G2 Intersection list (`4d9c3a1`). G3 Solve messages, G4 root order, G8 equal factors: no change needed (P5(d) keeps our Solve wording; the rest matches).
- R1 PWA (`p1/ron-pwa`).
- Physical constants menu: replaced by P3 (qalc CODATA constants). Decimal ⇄ scientific key: done as the Format key (`e9e9c89`); more formats are G9.

### v1 and later
These are in docs/02 section 8. P8 defers most of v1 behind the engineer core (Statistics with data entry, Spreadsheet, extra plot types, Inference, Finance); RPN stays in v1.
- **v1:** Statistics, Inference, Parametric/Polar/Sequence, Spreadsheet, Finance, Linear/Triangle solvers, RPN.
- **v2:** Geometry, Advanced Graphing, 3D, Explorers.
