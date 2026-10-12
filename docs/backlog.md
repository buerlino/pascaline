<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Status and backlog

The one place for "where are we and what's left". The plan is [02-architecture-plan.md](02-architecture-plan.md) (section 12 has the milestone history); decisions are in [decisions.md](decisions.md); shift reports are in [shifts/](shifts/). Last reviewed 2026-10-12 (cleanup audit).

## Where we are

| Stage | State |
|---|---|
| Phase 0 spike | **Done**, GO (2026-10-11) |
| MVP milestone 1: MathPrint Home + CAS | **Done** 2026-10-11 |
| MVP milestone 2: Function app + Solve app | **Done** 2026-10-11 |
| Virtual Calculator mapping | **Done** 2026-10-11 (data merged, 632dab4). Second session 2026-10-12 answered the last G2 items (19–22, 24–31); see "Follow-ups from the G2 answers" below |
| MVP milestone 3: Python | **Done** 2026-10-11 (desktop gates, S8+ and Tab One device numbers; report docs/shifts/2026-10-11-m3-report.md) |
| MVP release (Play testing track + web app, docs/02 section 8) | **In progress**: R1 (offline web app) done; R2–R4 open |
| v1, v2 | Not started |

`phase-1` and `master` are on GitHub; `master` was fast-forwarded to `phase-1` on 2026-10-11 (b4431ae, user). Work continues on `phase-1`.

### Is it on track?
**Yes on scope and speed, but with two growing debts.**

- **Speed.** The plan sized the MVP at about 6–9 person-months. All three were done after two days of agent shifts.
- **Performance.** Every bar is met on the low-end Tab One with room to spare (milestone 3 numbers, docs/shifts/2026-10-11-m3-report.md): keyboard usable 662 ms (bar 1 s), engine ready 995 ms (bar 1.5 s), Plot 56 fps (bar 30), solve p95 80 ms (bar 300 ms); Home Enter → result p95 92 ms (bar 150 ms, milestone 1).

The two debts grow with every milestone:

1. **Everything is checked only against the Virtual Calculator (2.4.2 rev 15751), not a real G2 (rev 15515).** All 31 questions in `tests/golden/G2-CHECKLIST.md` now have a Virtual Calculator answer, so the `assumed` tags are mostly gone, but several defaults still differ from what the reference does (list under "Follow-ups from the G2 answers"). The firmware differs from the user's G2, so a short spot check on the real G2 is still worth it (items 2, 8, 29: see `spec/mapping/vc-2026-10-11/SPOT-CHECK.md`).
2. **Only the low-end tablet is measured.**
   - The Fairphone 6 (mid-range, 60 fps target, Q6) hasn't been measured.
   - The Samsung Galaxy S8+ (Android 9, old-device class) was measured in the milestone 3 shift; the old Android 8/9 tablet is no longer needed.
   - Start-up on the Tab One: engine ready 956 ms (milestone 1) → 1022 ms (2) → 995 ms (3); keyboard usable 653–667 → 679 → 662 ms. Python loads lazily (P1). The start chunk grew to 139 kB (L7).

## Needs the user
1. **G2 spot checks on the real G2** (optional, about 15 minutes): item 29 (the stock a b/c key; the Virtual Calculator contradicts the earlier "it was my script" finding), item 8 (tie rounding, typed with the keys) and the list in `spec/mapping/vc-2026-10-11/SPOT-CHECK.md`. The Virtual Calculator answers are already in `tests/golden/g2.yaml`.
2. **Tap "Allow USB debugging"** on a device when it shows `unauthorized`.
3. **P7 (keypad gestures), point 4: merge Shift and Alpha into one key?** Decide after using the flicks for a few days (K2, K3); recommendation and the merged key's behaviour in `docs/decisions.md` P7.
4. **Check K0 on a device:** does the system keyboard still open when switching apps (Python editor and shell especially)? Fixed and tested in emulation only.
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

### Follow-ups from the G2 answers (Virtual Calculator, 2026-10-12)
Each row is a difference between our default and what the reference does (answers in `tests/golden/g2.yaml`, summary in `docs/decisions.md` "G2 answers 2026-10-12"). Nothing here is built yet; the user picks which to follow.

- **G5. Python modules (items 26–28).** Recommendation written 2026-10-12 as P6 in `docs/decisions.md` (match the reference in `hpprime.eval` only; keep `calc` and the canvas); waits for the user. Graphics signatures match our assumed ones (pixon, line, rect, fillrect, circle, textout; graphic first, 0 = screen). Differences: (a) colours are 0xRRGGBB and a run does not clear the screen, but the shell repaints when the script ends, so a drawing disappears unless the script waits; ours keeps a canvas. (b) The reference reaches the CAS and variables through `hpprime.eval(...)` and `hpprime.eval('CAS("...")')`; numbers come back as Python floats even when whole, lists as lists, symbolic results as text, errors as text (not raised). Our `calc.cas` always returns text. Decide whether to match the types.
- **G6. a b/c key (item 29).** With User mode off the reference cycles the last result's form on an empty line (2.5 → 5/2 → 2 1/2) and does nothing while typing a number. This contradicts the user's 2026-10-11 correction (the cycling was their own script). Needs a check on the real G2 before changing L2.
- **G7. Units (item 30):** the reference's behaviour is input for P3 and now lives in `docs/p3-units-plan.md` section 2.
- **G9. Number formats (item 15).** The reference has six formats (Standard, Fixed, Scientific, Engineering, Floating, Rounded); the digits box defaults to 8 for every format but Standard and counts decimal places (Scientific(8) of `12345.6789` → `1.23456789ᴇ4`), and numbers get a thousands separator (`12,345.6789`). Ours: STD/SCI/ENG (FIX in the formatter only), `digits` = significant digits, no separator. Fits the R4 settings pass; decide then which to match.

### Keypad gestures (P7, decided 2026-10-12; docs/decisions.md P7)
- **K0. The system keyboard opened when switching apps (bug, user 2026-10-12).** Cause: CodeMirror 6.43 uses Chrome's EditContext on Android (`window.EditContext && browser.android`), and EditContext ignores our `inputmode="none"`; the Python app focuses its editor or shell every time it is shown. **Fixed** 2026-10-12, not committed yet: `app/src/apps/python/codeView.ts` uses a subclass with CodeMirror's undocumented static `EDIT_CONTEXT = false` (check it still exists when CodeMirror is updated) and adds `virtualkeyboardpolicy="manual"`. Regression test `app/test/softkeyboard.spec.ts`: after each app switch the focused element must have `inputmode=none` and no EditContext (it failed before the fix: "Python editor: DIV uses EditContext"). Python tests still pass. **Not checked on a device** (none connected), and not yet known whether it also happened when switching to Function or Solve (MathLive entry line, not touched by this fix).
- **K1. Trackpad** in place of the four arrow keys (P7 point 1). Drag = steps in 2D with a haptic tick; a tap on an edge = one step; the same `NavDir` handling as the arrow keys today, so Plot, Num and the Symb lists keep working. Keep the key ids `up`/`down`/`left`/`right` as the tap zones, so existing tests and `spec/keyboard.yaml` stay meaningful.
- **K2. Flicks up and down on every key** (P7 point 2). Up = shift layer, down = letter; legends at the top left (shift) and bottom left (letter); preview bubble and haptic tick; fire on release; `touch-action: none` on the pad.
- **K3. Lock flicks on Shift and Alpha** (P7 point 3): Alpha down = capitals lock, Alpha up = lowercase lock, Shift up = shift lock. Taps and the L3 double-tap locks unchanged.
- **K4. Compact keypad with the View key** (P7 point 5): the empty View cell toggles full / compact (upper cluster only); a Menu item to end a Signed area, since Enter is hidden in compact mode.
- **K5. Tests and docs:** Playwright drag and flick helpers (CDP touch events), one test per gesture; record the gestures in `spec/keyboard.yaml`'s header and in the help texts (R4).
- **Flaky test seen 2026-10-12:** `test/solve.spec.ts` "Solve: equations and values are stored" failed once in a full e2e run, then passed 6/6 three times on its own. Probably a timing issue in the persistence check under load; watch it.

### Clean-up and infrastructure
- **C3. CI.** There is none. Add a GitHub Actions workflow for typecheck, unit and parser tests (no engine, so it stays fast). The engine gate can go in too, now that the Giac mirror is live. Needs your OK, since it runs on GitHub.
- **C4. F-Droid recipe.** It is untested end to end. `npm ci` downloads packages after `prebuild`, so it needs an offline/srclibs rework. Still open: a release tag and `versionCode`, and screenshots; the icon is done (`8ff8576`) (`fdroid/README.md`).

### Left over from milestones 1 and 2
- **L9. ÷ (and a/b) right after a fraction.** Found 2026-10-12 while doing L8. `1 a/b 2 ▶ ÷ 3` gives `\frac12\frac{3}{\placeholder{}}`: a new fraction with 3 as its numerator, multiplied onto ½, not (½)÷3. The ÷ template `\frac{#@}{#?}` takes "what is before the cursor", and MathLive takes nothing from a fraction (the same cause as L8). **Proposed:** like L8, select the whole term before the cursor (fraction, root, power, mixed number) and make it the numerator: `\frac{\frac12}{3}`, so ÷ divides what you see. Reuse `selectCompound` in `EntryController`. Tests first in `app/test/keys.spec.ts` (`1 a/b 2 ▶ ÷ 3` Enter = `0.166666666667`, derived), plus a parser round-trip case for the nested fraction. The reference's behaviour can go into the next Virtual Calculator session (Textbook `1 ÷ 2 ▶ ÷ 3`).
- **L7. Bundle size.** It is 139 kB at start (48 kB gzip; measured 2026-10-12), plus 808 kB of MathLive loaded after the keypad. Trend: 94 kB (milestone 1), 108 (2), 115 (3, the last Tab One measurement), 139. Since milestone 3 the largest single addition is `@capacitor/core` (7.8 kB, imported by `input/haptics.ts` for key vibration); the Format key's state code is most of the rest. Re-measure cold start on the Tab One in the next device session; if it got slower, load Capacitor only in the native build.

### MVP release (after milestone 3; docs/02 section 8)
- **R2. Play testing track.** Real application id, signing key (yours), store texts in `fastlane/metadata/`. Never published without your OK.
- **R3. Screenshots and store graphics.** The app icon is done (`8ff8576`, from `logo/`). Our own design; nothing from the reference calculator.
- **R4. Settings and help pass.** i18n table complete, first help texts. Giac help-text licence: R5 (`docs/research/giac-help-licence.md`) reads the English help lines as GPL-3.0-or-later, usable with attribution; that is a reading of Giac's README, so confirming with Parisse is still worth it.

### Unscheduled feature requests (docs/02 section 12b)
- Units, constants and uncertainty: P3 with libqalculate, plan `docs/p3-units-plan.md` (decided 2026-10-11, about 11–12 days; after the MVP basics, before Statistics).

### Done
The record is in the commits, the shift reports and `docs/decisions.md`; the ids stay valid there.
- Milestone 3, Python (2026-10-11): P1 worker, P2 `calc`, P3 graphics module, P4 editor and shell, P5 golden and e2e cases, D1 device numbers (m3 report).
- C1 tooling out of `spike/` (`10c2f92`); C2 page-bench results in `.coord/device-runs.jsonl` (`a201499`).
- L1 subscripted unknowns (`a3ddd52`, display in `ec4a94d`), L2 a b/c mixed numbers, L3 alpha lock, L4 one-line caret mode, L5 insertable results (all `ec4a94d`), L6 parser gaps (`6eda358`), L8 x² after a compound term (`4d9c3a1`).
- G1 Num table and G2 Intersection list (`4d9c3a1`). G3 Solve messages, G4 root order, G8 equal factors: no change needed (P5(d) keeps our Solve wording; the rest matches).
- R1 PWA (`p1/ron-pwa`).
- Physical constants menu: replaced by P3 (qalc CODATA constants). Decimal ⇄ scientific key: done as the Format key (`e9e9c89`); more formats are G9.

### v1 and later
These are in docs/02 section 8:
- **v1:** Statistics, Inference, Parametric/Polar/Sequence, Spreadsheet, Finance, Linear/Triangle solvers, RPN.
- **v2:** Geometry, Advanced Graphing, 3D, Explorers.
