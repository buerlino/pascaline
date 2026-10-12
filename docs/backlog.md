<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Status and backlog

The one place for "where are we and what's left". The plan is [02-architecture-plan.md](02-architecture-plan.md) (section 12 has the milestone history); decisions are in [decisions.md](decisions.md); shift reports are in [shifts/](shifts/). Last reviewed 2026-10-11 by Henri, after milestone 2.

## Where we are

| Stage | State |
|---|---|
| Phase 0 spike | **Done**, GO (2026-10-11) |
| MVP milestone 1: MathPrint Home + CAS | **Done** 2026-10-11 |
| MVP milestone 2: Function app + Solve app | **Done** 2026-10-11 |
| Virtual Calculator mapping | **Done** 2026-10-11 (data merged, 632dab4). Second session 2026-10-12 answered the last G2 items (19–22, 24–31); see "Follow-ups from the G2 answers" below |
| MVP milestone 3: Python | **Done** 2026-10-11 (desktop gates, S8+ and Tab One device numbers; report docs/shifts/2026-10-11-m3-report.md) |
| MVP release (Play testing track + web app, docs/02 section 8) | Not started |
| v1, v2 | Not started |

`phase-1` and `master` are on GitHub; `master` was fast-forwarded to `phase-1` on 2026-10-11 (b4431ae, user). Work continues on `phase-1`.

### Is it on track?
**Yes on scope and speed, but with two growing debts.**

- **Speed.** The plan sized the MVP at about 6–9 person-months. Two of its three milestones are done after two days of agent shifts.
- **Performance.** Every performance bar is met on the low-end Tab One with room to spare:
  - keyboard usable: 679 ms (bar 1 s);
  - engine ready: 1.02 s (bar 1.5 s);
  - Home Enter → result p95: 92 ms (bar 150 ms);
  - Plot: 53.8 fps (bar 30);
  - Solve p95: 82 ms (bar 300 ms).

The two debts grow with every milestone:

1. **Everything is checked only against the Virtual Calculator (2.4.2 rev 15751), not a real G2 (rev 15515).** All 31 questions in `tests/golden/G2-CHECKLIST.md` now have a Virtual Calculator answer, so the `assumed` tags are mostly gone, but several defaults still differ from what the reference does (list under "Follow-ups from the G2 answers"). The firmware differs from the user's G2, so a short spot check on the real G2 is still worth it (items 2, 8, 29: see `spec/mapping/vc-2026-10-11/SPOT-CHECK.md`).
2. **Only the low-end tablet is measured.**
   - The Fairphone 6 (mid-range, 60 fps target, Q6) hasn't been measured.
   - A Samsung Galaxy S8+ (Android 9, old-device class) is now available and gets measured in the milestone 3 shift; the old Android 8/9 tablet is no longer needed for that.
   - Start-up is slowly creeping up: engine ready went from 956 ms to 1022 ms, and keyboard usable from 653–667 ms to 679 ms. Milestone 3 must load Python lazily, never at start.

## Needs the user
1. **G2 spot checks on the real G2** (optional, about 15 minutes): item 29 (the stock a b/c key; the Virtual Calculator contradicts the earlier "it was my script" finding), item 8 (tie rounding, typed with the keys) and the list in `spec/mapping/vc-2026-10-11/SPOT-CHECK.md`. The Virtual Calculator answers are already in `tests/golden/g2.yaml`.
2. **Tap "Allow USB debugging"** on a device when it shows `unauthorized`.
3. ~~**When to merge `phase-1` into `master`.**~~ Done 2026-10-11 (fast-forward to b4431ae, full gate passed).
4. **P7 (keypad gestures), point 4: merge Shift and Alpha into one key?** Decide after using the flicks for a few days (K2, K3); recommendation and the merged key's behaviour in `docs/decisions.md` P7.
5. **Check K0 on a device:** does the system keyboard still open when switching apps (Python editor and shell especially)? Fixed and tested in emulation only.
6. **Later, not now** (user, 2026-10-11: first a usable prototype): the email to Bernard Parisse (draft in `../outreach/`), the name and trademark checks, the real application id, CI (C3) and the F-Droid recipe (C4).

Done: the Giac mirror is live (release `deps-giac-2.1.0-1d9536e0`, SHA-256 checked 2026-10-11); the leftover worktrees and branches were removed and Phase 0 is tagged `phase-0-done`; milestone 3 as proposed below is approved (user, 2026-10-11).

## Repo cleanup

### Branches and worktrees
Done by the user 2026-10-11 (first round). The paused milestone 3 round left three worktrees under `.claude/worktrees/`: `p1/annabell-m3` (merged) and `p1/ron-m3` (no commits) can go; keep `p1/gorge-m3` (75e79af, `types.ts`) until gorge has cherry-picked it onto `p1/gorge-m3b`.

Optional disk space (gitignored, rebuilt when needed): `engine/giac/_build` (561 MB, the engine build cache). **Never delete** `engine/giac/_downloads/` or `spike/prebuilt/`.

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

- ~~**G1. Num table (items 19, 24).**~~ **Done** 2026-10-12 (Num start 0 step 0.1, `NaN` at a pole, trace step 0.1 at the default window; the step at other widths stays our 1-2-5 rule, still unmeasured). At a pole the cell shows `NaN` (ours: what Home shows for 1/0). Num starts at X = 0 with step **0.1** (ours: step 1). One trace step is 0.1 at the default window (ours: a 1-2-5 step near width/100).
- ~~**G2. Intersection asks (item 25).**~~ **Done** 2026-10-12 (a follow-up list in the Plot menu: other functions that are on, then the x-axis). The reference opens a list "Intersection of F1(X) and …" with the other functions that are on, plus X-Axis; the first function is the traced one. Ours takes the next function that is on.
- **G3. Solve (item 20).** The failure message is a dialog "Cannot find solution" and the fields keep the guesses (ours: "no root found" with ⚠). P5(d) already keeps our wording; the two-equation case matches (X = -1.99537317006, Y = 0.135962907412).
- **G4. Polynomial roots (item 21).** Only `proot` is sorted (real part, then imaginary part), which matches our rule. `cZeros` and `cSolve` use other orders; the Solve app gives one root per run, no all-roots list. No change needed.
- **G5. Python modules (items 26–28).** Recommendation written 2026-10-12 as P6 in `docs/decisions.md` (match the reference in `hpprime.eval` only; keep `calc` and the canvas); waits for the user. Graphics signatures match our assumed ones (pixon, line, rect, fillrect, circle, textout; graphic first, 0 = screen). Differences: (a) colours are 0xRRGGBB and a run does not clear the screen, but the shell repaints when the script ends, so a drawing disappears unless the script waits; ours keeps a canvas. (b) The reference reaches the CAS and variables through `hpprime.eval(...)` and `hpprime.eval('CAS("...")')`; numbers come back as Python floats even when whole, lists as lists, symbolic results as text, errors as text (not raised). Our `calc.cas` always returns text. Decide whether to match the types.
- **G6. a b/c key (item 29).** With User mode off the reference cycles the last result's form on an empty line (2.5 → 5/2 → 2 1/2) and does nothing while typing a number. This contradicts the user's 2026-10-11 correction (the cycling was their own script). Needs a check on the real G2 before changing L2.
- **G7. Units (item 30), input for P3.** Shift + the Units key opens one menu with three tabs (Tools, Units, Const). A unit is attached as `5_km`; `CONVERT(5_km,1_m)` or `5_km▶_m` converts; mixed sums keep the first unit. Constants tab not opened. Details in `g2.yaml` item 30.
- **G8. Equal factors (item 31).** The CAS view merges them (`x*x` → `x^2`, `a*b*a` → `a^2*b`), matching our default. In Home, lowercase names give Syntax Error and uppercase `A*B` gives 0 (stored variables), so Home does not treat undefined names as symbols.
- **G9. Number formats (item 15).** The reference has six formats (Standard, Fixed, Scientific, Engineering, Floating, Rounded); the digits box defaults to 8 for every format but Standard and counts decimal places (Scientific(8) of `12345.6789` → `1.23456789ᴇ4`), and numbers get a thousands separator (`12,345.6789`). Ours: STD/SCI/ENG (FIX in the formatter only), `digits` = significant digits, no separator. Fits the R4 settings pass; decide then which to match.

### Keypad gestures (P7, decided 2026-10-12; docs/decisions.md P7)
- **K0. The system keyboard opened when switching apps (bug, user 2026-10-12).** Cause: CodeMirror 6.43 uses Chrome's EditContext on Android (`window.EditContext && browser.android`), and EditContext ignores our `inputmode="none"`; the Python app focuses its editor or shell every time it is shown. **Fixed** 2026-10-12, not committed yet: `app/src/apps/python/codeView.ts` uses a subclass with CodeMirror's undocumented static `EDIT_CONTEXT = false` (check it still exists when CodeMirror is updated) and adds `virtualkeyboardpolicy="manual"`. Regression test `app/test/softkeyboard.spec.ts`: after each app switch the focused element must have `inputmode=none` and no EditContext (it failed before the fix: "Python editor: DIV uses EditContext"). Python tests still pass. **Not checked on a device** (none connected), and not yet known whether it also happened when switching to Function or Solve (MathLive entry line, not touched by this fix).
- **K1. Trackpad** in place of the four arrow keys (P7 point 1). Drag = steps in 2D with a haptic tick; a tap on an edge = one step; the same `NavDir` handling as the arrow keys today, so Plot, Num and the Symb lists keep working. Keep the key ids `up`/`down`/`left`/`right` as the tap zones, so existing tests and `spec/keyboard.yaml` stay meaningful.
- **K2. Flicks up and down on every key** (P7 point 2). Up = shift layer, down = letter; legends at the top left (shift) and bottom left (letter); preview bubble and haptic tick; fire on release; `touch-action: none` on the pad.
- **K3. Lock flicks on Shift and Alpha** (P7 point 3): Alpha down = capitals lock, Alpha up = lowercase lock, Shift up = shift lock. Taps and the L3 double-tap locks unchanged.
- **K4. Compact keypad with the View key** (P7 point 5): the empty View cell toggles full / compact (upper cluster only); a Menu item to end a Signed area, since Enter is hidden in compact mode.
- **K5. Tests and docs:** Playwright drag and flick helpers (CDP touch events), one test per gesture; record the gestures in `spec/keyboard.yaml`'s header and in the help texts (R4).
- **Flaky test seen 2026-10-12:** `test/solve.spec.ts` "Solve: equations and values are stored" failed once in a full e2e run, then passed 6/6 three times on its own. Probably a timing issue in the persistence check under load; watch it.

### Milestone 3: Python (approved 2026-10-11; shift brief docs/shifts/brief.md)
This follows D6: MicroPython by default, with the Pyodide "Python+" pack only optional and later.

- ~~**P1. Python worker.**~~ (done 2026-10-11) MicroPython runs in its own Web Worker (worker 2) behind a `PythonEngine` interface (async and cancellable like `MathEngine`). It loads the first time Python is opened, never at start. Cancel terminates the worker and starts a fresh one.
- ~~**P2. `calc` module.**~~ (done 2026-10-11)
  - `calc.cas("…")` calls the Giac worker. It is async (D6), and a small preprocessor adds the `await`.
  - It can also read and write Home variables.
  - First decide whether a synchronous version is possible: it would need `SharedArrayBuffer` plus COOP/COEP headers in the Capacitor shell. Check this first (docs/research/python-notes.md).
- ~~**P3. `hpprime`-compatible graphics module.**~~ (done 2026-10-11) A 320×240 canvas with the drawing calls the reference documents publicly. Write the API from public documentation in our own words (clean room).
- ~~**P4. Editor and shell.**~~ (done 2026-10-11)
  - CodeMirror 6 for the editor (MIT; add it to THIRD_PARTY.md), with the Python keyboard layer.
  - A shell (REPL) view with history.
  - Scripts are stored in IndexedDB, with import and export.
- ~~**P5. Golden and e2e cases**~~ (done 2026-10-11) for `calc`, `print`, errors with line numbers, Cancel on `while True: pass`, and graphics output.
- ~~**D1. Device numbers.**~~ **Done** 2026-10-11 evening (m3 report). Tab One: keyboard usable 662 ms, engine ready 995 ms, Python open 165 ms, Cancel 109 ms, `calc.cas` p95 25 ms; all bars pass. S8+: Python open 782 ms, Cancel 398 ms, `calc.cas` p95 17 ms, start-up 576 ms / 1.73 s. Tab One bars:
  - milestone 1's start-up numbers still hold;
  - first open of Python → shell ready < 0.5 s (the spike measured 335 ms);
  - Cancel on an endless loop → ready again < 0.5 s;
  - a `calc.cas` round trip p95 < 50 ms.

### Clean-up and infrastructure
- ~~**C1. Move shipped tooling out of `spike/`.**~~ **Done** 2026-10-11 (10c2f92): `tools/`, `tests/engine/interrupt-test.mjs`, `tests/golden/G2-CHECKLIST.md`. Left: `tools/device-build.sh` now wraps `build.sh`; `npm run golden` now needs an absolute `GIAC_OUT`.
- ~~**C2. Results file for page benches.**~~ **Done** 2026-10-11 (a201499); not yet used on a device. Make `device_run.py page` append the `?bench=solve` and `?bench=plot` results to `.coord/device-runs.jsonl`, so they're recorded and not only in logcat (m2b report).
- **C3. CI.** There is none. Add a GitHub Actions workflow for typecheck, unit and parser tests (no engine, so it stays fast). Add the engine gate later, once the Giac mirror exists. Needs your OK, since it runs on GitHub.
- **C4. F-Droid recipe.** It is untested end to end. `npm ci` downloads packages after `prebuild`, so it needs an offline/srclibs rework. Still open: a release tag and `versionCode`, an icon and screenshots (`fdroid/README.md`).

### Left over from milestones 1 and 2
- ~~**L1. Subscripted unknowns (`x_1`) in Solve.** Engine part **done** (a3ddd52: our name check accepts `x_1`; Giac already treats it as a variable). Left: show `x_{1}` in results, Playwright tests.~~ **Done** 2026-10-11 (ec4a94d).
- ~~**L2. a/b mixed-number key** (G2 item 17 for the form).~~ **Done** 2026-10-11 (ec4a94d).
- ~~**L3. Alpha lock.**~~ **Done** 2026-10-11 (ec4a94d).
- ~~**L4. A literal-caret one-line entry mode.**~~ **Done** 2026-10-11 (ec4a94d).
- ~~**L5. Results as insertable text** (copy a history entry into the entry line).~~ **Done** 2026-10-11 (ec4a94d).
- ~~**L6. Parser gaps** (4 known)~~ **Done** 2026-10-11 (6eda358): real odd roots (assumed, G2 item 4; option `realOddRoots`), `{…}` lists, decimal-comma input option, one-letter user functions `p(x):=`. Still open with reasons in `parser.yaml`: `x^y^z` (not keyboard input) and units (separate feature).
- ~~**L8. The x² key after a fraction (or another compound term).**~~ **Done** 2026-10-12 (docs/decisions.md "Powers after a compound term"; inside a fraction's part x² raises that part's last term, user 2026-10-12). Found 2026-10-12 with a key-sequence probe in Chromium (phone size, real MathLive; the probe file was removed). The x² key is `#@^{2}` ([spec/keyboard.yaml](../spec/keyboard.yaml) key `sq`), which squares "what is before the cursor". That works for a number (`3` → `3^2`) and a bracket (`(1+2)` → `(1+2)^2`), but not for a fraction:
  - `1 a/b 2`, cursor moved out of the denominator, x² gives `\frac12\placeholder{}^2`: an empty base with a placeholder, so the square is not applied to the fraction;
  - `1 a/b 2`, cursor still in the denominator, x² gives `\frac{1}{2^2}`: only the denominator is squared.
  **Wanted (user, 2026-10-12):** directly after a fraction the key wraps the whole fraction in brackets and squares it: `\left(\frac12\right)^2`, the cursor after the exponent. Do the same for the other compound terms where a bare `^2` would read ambiguously (to check: a root, a function call, a `x^y` power, a mixed number; a sum typed without brackets should keep squaring only the last term, as now). If the cursor is still inside the denominator or numerator, x² should treat the whole fraction as the term, not just its inside (decide whether this applies at the top level only).
  **How:** in `EntryController.run` (app/src/entry/controller.ts) handle `keyId === "sq"` (and check `pow`, `div` shift `x⁻¹`, which use the same `#@` template) before `apply`: look at the atom before the cursor, and if it is a fraction (or in a fraction's part when the cursor is inside), select it and insert `\left(#@\right)^{2}`. The parser (`app/src/input/parse.ts`) already reads `\left(\frac12\right)^2`; add the round-trip case with the key (rule in CLAUDE.md: keyboard template change ⇒ parser rule + round-trip case in the same commit).
  **Tests first:** Playwright key sequences in `app/test/keys.spec.ts`: `1 a/b 2 right x²` → entry `\left(\frac12\right)^2`, Enter → `0.25` (derived); the same with the cursor still in the denominator; `1 + 3 x²` stays `1+3^2`; and one case per other compound term. Not a G2 question: the reference's own behaviour here can be added to the next Virtual Calculator session if wanted (Textbook entry, `1 ÷ 2` then x²).
- **L9. ÷ (and a/b) right after a fraction.** Found 2026-10-12 while doing L8. `1 a/b 2 ▶ ÷ 3` gives `\frac12\frac{3}{\placeholder{}}`: a new fraction with 3 as its numerator, multiplied onto ½, not (½)÷3. The ÷ template `\frac{#@}{#?}` takes "what is before the cursor", and MathLive takes nothing from a fraction (the same cause as L8). **Proposed:** like L8, select the whole term before the cursor (fraction, root, power, mixed number) and make it the numerator: `\frac{\frac12}{3}`, so ÷ divides what you see. Reuse `selectCompound` in `EntryController`. Tests first in `app/test/keys.spec.ts` (`1 a/b 2 ▶ ÷ 3` Enter = `0.166666666667`, derived), plus a parser round-trip case for the nested fraction. The reference's behaviour can go into the next Virtual Calculator session (Textbook `1 ÷ 2 ▶ ÷ 3`).
- **L7. Bundle size.** It is 94 kB at start, plus 808 kB of MathLive loaded after the keypad. Watch start-up as features grow.

### MVP release (after milestone 3; docs/02 section 8)
- ~~**R1. PWA.**~~ **Done** 2026-10-11 (`p1/ron-pwa`): own 40-line service worker, manifest, placeholder icons, offline Playwright test. Hosting still needs your OK.
- **R2. Play testing track.** Real application id, signing key (yours), store texts in `fastlane/metadata/`. Never published without your OK.
- **R3. App icon and screenshots.** Our own design; nothing from the reference calculator.
- **R4. Settings and help pass.** i18n table complete, first help texts. Giac help-text licence: R5 (`docs/research/giac-help-licence.md`) reads the English help lines as GPL-3.0-or-later, usable with attribution; that is a reading of Giac's README, so confirming with Parisse is still worth it.

### Unscheduled feature requests (docs/02 section 12b)
- ~~Physical constants menu~~ replaced by P3 (qalc CODATA constants; decided 2026-10-11).
- A decimal ⇄ scientific (STD → SCI → ENG) key, about a day.
- Units, constants and uncertainty: P3 with libqalculate, plan `docs/p3-units-plan.md` (decided 2026-10-11, about 11–12 days; after the MVP basics, before Statistics).

### v1 and later
These are in docs/02 section 8:
- **v1:** Statistics, Inference, Parametric/Polar/Sequence, Spreadsheet, Finance, Linear/Triangle solvers, RPN.
- **v2:** Geometry, Advanced Graphing, 3D, Explorers.
