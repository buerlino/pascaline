<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Status and backlog

The one place for "where are we and what's left". The plan is [02-architecture-plan.md](02-architecture-plan.md) (section 12 has the milestone history); decisions are in [decisions.md](decisions.md); shift reports are in [shifts/](shifts/). Last reviewed 2026-10-11 by Henri, after milestone 2.

## Where we are

| Stage | State |
|---|---|
| Phase 0 spike | **Done**, GO (2026-10-11) |
| MVP milestone 1: MathPrint Home + CAS | **Done** 2026-10-11 |
| MVP milestone 2: Function app + Solve app | **Done** 2026-10-11 |
| Virtual Calculator mapping | **In progress** (user's Windows session). Integrated by a separate session on its own branch `map/vc-*`, reviewed and pushed by the user after the shift (brief section 0b) |
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

1. **Almost nothing is checked against a real G2.** Only 2 of the 25 questions in `tests/golden/G2-CHECKLIST.md` are answered (5 and 16). That includes item 2, the logical key layout, which is the core of "feels like a G2". Every default since milestone 1 is `assumed`. The longer this waits, the more behaviour may have to change later. **Recommendation:** spend an hour with the G2 on items 2, 3, 6, 15, 17 and 18 (keyboard and entry) before milestone 3 adds more UI.
2. **Only the low-end tablet is measured.**
   - The Fairphone 6 (mid-range, 60 fps target, Q6) hasn't been measured.
   - A Samsung Galaxy S8+ (Android 9, old-device class) is now available and gets measured in the milestone 3 shift; the old Android 8/9 tablet is no longer needed for that.
   - Start-up is slowly creeping up: engine ready went from 956 ms to 1022 ms, and keyboard usable from 653–667 ms to 679 ms. Milestone 3 must load Python lazily, never at start.

## Needs the user
1. **G2 checks:** 23 open items in `tests/golden/G2-CHECKLIST.md` (questions only a real G2 or the official Virtual Calculator can answer; the Virtual Calculator mapping session can fill most of them). Answers go into `tests/golden/g2.yaml`.
2. **Tap "Allow USB debugging"** on a device when it shows `unauthorized`.
3. ~~**When to merge `phase-1` into `master`.**~~ Done 2026-10-11 (fast-forward to b4431ae, full gate passed).
4. **Later, not now** (user, 2026-10-11: first a usable prototype): the email to Bernard Parisse (draft in `../outreach/`), the name and trademark checks, the real application id, CI (C3) and the F-Droid recipe (C4).

Done: the Giac mirror is live (release `deps-giac-2.1.0-1d9536e0`, SHA-256 checked 2026-10-11); the leftover worktrees and branches were removed and Phase 0 is tagged `phase-0-done`; milestone 3 as proposed below is approved (user, 2026-10-11).

## Repo cleanup

### Branches and worktrees
Done by the user 2026-10-11 (first round). The paused milestone 3 round left three worktrees under `.claude/worktrees/`: `p1/annabell-m3` (merged) and `p1/ron-m3` (no commits) can go; keep `p1/gorge-m3` (75e79af, `types.ts`) until gorge has cherry-picked it onto `p1/gorge-m3b`.

Optional disk space (gitignored, rebuilt when needed): `spike/{app,input,plot}/node_modules` (565 MB) and `engine/giac/_build` (561 MB, the engine build cache). **Never delete** `engine/giac/_downloads/` or `spike/prebuilt/`.

### Code that still lives in `spike/` (task C1)
`spike/` was meant to be throwaway. Shipped code still depends on it:
- `build.sh`, `engine/giac/build-wasm-release.sh` and `python/build-micropython.sh` use `tools/devlock.sh`;
- the golden gate (`app/scripts/golden.ts`) runs `tests/engine/interrupt-test.mjs`;
- `tests/golden/oracle.py` writes `tests/golden/G2-CHECKLIST.md`;
- the device tools (`tools/device_run.py` and the others) are part of the measurement workflow.

These moved out of `spike/` (C1, done) before `phase-1` went to `master`.

## Tasks

### Milestone 3: Python (approved 2026-10-11; shift brief docs/shifts/brief.md)
This follows D6: MicroPython by default, with the Pyodide "Python+" pack only optional and later.

- ~~**P1. Python worker.**~~ (done 2026-10-11) MicroPython runs in its own Web Worker (worker 2) behind a `PythonEngine` interface (async and cancellable like `MathEngine`). It loads the first time Python is opened, never at start. Cancel terminates the worker and starts a fresh one.
- ~~**P2. `calc` module.**~~ (done 2026-10-11)
  - `calc.cas("…")` calls the Giac worker. It is async (D6), and a small preprocessor adds the `await`.
  - It can also read and write Home variables.
  - First decide whether a synchronous version is possible: it would need `SharedArrayBuffer` plus COOP/COEP headers in the Capacitor shell. Check this first (spike/python/NOTES.md).
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
- **L7. Bundle size.** It is 94 kB at start, plus 808 kB of MathLive loaded after the keypad. Watch start-up as features grow.

### MVP release (after milestone 3; docs/02 section 8)
- ~~**R1. PWA.**~~ **Done** 2026-10-11 (`p1/ron-pwa`): own 40-line service worker, manifest, placeholder icons, offline Playwright test. Hosting still needs your OK.
- **R2. Play testing track.** Real application id, signing key (yours), store texts in `fastlane/metadata/`. Never published without your OK.
- **R3. App icon and screenshots.** Our own design; nothing from the reference calculator.
- **R4. Settings and help pass.** i18n table complete, first help texts. The Giac help-text licence is still to clarify with Parisse.

### Unscheduled feature requests (docs/02 section 12b)
- ~~Physical constants menu~~ replaced by P3 (qalc CODATA constants; decided 2026-10-11).
- A decimal ⇄ scientific (STD → SCI → ENG) key, about a day.
- Units, constants and uncertainty: P3 with libqalculate, plan `docs/p3-units-plan.md` (decided 2026-10-11, about 11–12 days; after the MVP basics, before Statistics).

### v1 and later
These are in docs/02 section 8:
- **v1:** Statistics, Inference, Parametric/Polar/Sequence, Spreadsheet, Finance, Linear/Triangle solvers, RPN.
- **v2:** Geometry, Advanced Graphing, 3D, Explorers.
