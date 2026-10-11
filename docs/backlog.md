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
| MVP milestone 3: Python | **Started:** interface agreed (`p1/gorge-m3@75e79af`, not merged); MicroPython dev build ready |
| MVP release (Play testing track + web app, docs/02 section 8) | Not started |
| v1, v2 | Not started |

`phase-1` is on GitHub (local `phase-1` is ahead of `origin/phase-1`; not pushed). `master` still has only the first docs commit.

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
3. **When to merge `phase-1` into `master`.** C1 is done. Recommendation: after the mapping branch is merged into `phase-1` and milestone 3 passes.
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

These should move out of `spike/` before `phase-1` goes to `master`.

## Tasks

### Milestone 3: Python (approved 2026-10-11; shift brief docs/shifts/brief.md)
This follows D6: MicroPython by default, with the Pyodide "Python+" pack only optional and later.

- **P1. Python worker.** MicroPython runs in its own Web Worker (worker 2) behind a `PythonEngine` interface (async and cancellable like `MathEngine`). It loads the first time Python is opened, never at start. Cancel terminates the worker and starts a fresh one.
- **P2. `calc` module.**
  - `calc.cas("…")` calls the Giac worker. It is async (D6), and a small preprocessor adds the `await`.
  - It can also read and write Home variables.
  - First decide whether a synchronous version is possible: it would need `SharedArrayBuffer` plus COOP/COEP headers in the Capacitor shell. Check this first (spike/python/NOTES.md).
- **P3. `hpprime`-compatible graphics module.** A 320×240 canvas with the drawing calls the reference documents publicly. Write the API from public documentation in our own words (clean room).
- **P4. Editor and shell.**
  - CodeMirror 6 for the editor (MIT; add it to THIRD_PARTY.md), with the Python keyboard layer.
  - A shell (REPL) view with history.
  - Scripts are stored in IndexedDB, with import and export.
- **P5. Golden and e2e cases** for `calc`, `print`, errors with line numbers, Cancel on `while True: pass`, and graphics output.
- **Proposed bar** (Tab One, release):
  - milestone 1's start-up numbers still hold;
  - first open of Python → shell ready < 0.5 s (the spike measured 335 ms);
  - Cancel on an endless loop → ready again < 0.5 s;
  - a `calc.cas` round trip p95 < 50 ms.

### Clean-up and infrastructure
- ~~**C1. Move shipped tooling out of `spike/`.**~~ **Done** 2026-10-11 (10c2f92): `tools/`, `tests/engine/interrupt-test.mjs`, `tests/golden/G2-CHECKLIST.md`. Left: `tools/device-build.sh` now wraps `build.sh`; `npm run golden` now needs an absolute `GIAC_OUT`.
- **C2. Results file for page benches.** Make `device_run.py page` append the `?bench=solve` and `?bench=plot` results to `.coord/device-runs.jsonl`, so they're recorded and not only in logcat (m2b report).
- **C3. CI.** There is none. Add a GitHub Actions workflow for typecheck, unit and parser tests (no engine, so it stays fast). Add the engine gate later, once the Giac mirror exists. Needs your OK, since it runs on GitHub.
- **C4. F-Droid recipe.** It is untested end to end. `npm ci` downloads packages after `prebuild`, so it needs an offline/srclibs rework. Still open: a release tag and `versionCode`, an icon and screenshots (`fdroid/README.md`).

### Left over from milestones 1 and 2
- **L1. Subscripted unknowns (`x_1`) in Solve.** Engine part **done** (a3ddd52: our name check accepts `x_1`; Giac already treats it as a variable). Left: show `x_{1}` in results, Playwright tests.
- **L2. a/b mixed-number key** (G2 item 17 for the form).
- **L3. Alpha lock.**
- **L4. A literal-caret one-line entry mode.**
- **L5. Results as insertable text** (copy a history entry into the entry line).
- **L6. Parser gaps** (4 known, `parser/gaps-*`):
  - the real cube root of a negative number (G2 items 4 and 11);
  - sets;
  - decimal comma;
  - one-letter user functions other than f, g and h.
- **L7. Bundle size.** It is 94 kB at start, plus 808 kB of MathLive loaded after the keypad. Watch start-up as features grow.

### MVP release (after milestone 3; docs/02 section 8)
- **R1. PWA.** Service worker and manifest so it works 100% offline. Host it after your OK.
- **R2. Play testing track.** Real application id, signing key (yours), store texts in `fastlane/metadata/`. Never published without your OK.
- **R3. App icon and screenshots.** Our own design; nothing from the reference calculator.
- **R4. Settings and help pass.** i18n table complete, first help texts. The Giac help-text licence is still to clarify with Parisse.

### Unscheduled feature requests (docs/02 section 12b)
- Physical constants menu (Giac built-ins; CODATA 2022 update upstream).
- A decimal ⇄ scientific (STD → SCI → ENG) key, about a day.
- Units, Qalculate-style picker on Giac units, about 1–2 weeks (needs L1 first).

### v1 and later
These are in docs/02 section 8:
- **v1:** Statistics, Inference, Parametric/Polar/Sequence, Spreadsheet, Finance, Linear/Triangle solvers, RPN.
- **v2:** Geometry, Advanced Graphing, 3D, Explorers.
