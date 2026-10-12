<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Shift brief: 2026-10-12 evening ("gestures") — ENDED, see [2026-10-12-eve-report.md](2026-10-12-eve-report.md)

The standing rules (sections 1, 3–6 and 9–11) are in [rules.md](rules.md); read them first. Shift name for branches: `eve`.

## 0. State at start
`phase-1` clean at `c0fbd14`, same as `origin/phase-1`. No devices connected. P7 (keypad gestures) is decided; K0 is fixed and committed (`f3b7d45`) but not yet checked on a device.

## 0a. Tasks, in order
Goal: the keypad gestures from P7 (K1–K3, K5) and the L9 entry fix, plus one small engine follow-up.

**Economy mode (user, 2026-10-12): this overrides rules section 4 steps 2–3.** One agent per task, spawned fresh when it doesn't need an earlier agent's context; no roll call; workers don't message each other. An agent ends its turn when its task is done. Devices: no agent is spawned for device work until a device is connected (Henri's watcher wakes him).

| # | Task | Worker | Branch |
|---|---|---|---|
| 1 | L9: ÷ and a/b right after a compound term | ron (Sonnet) | `p1/ron-eve-l9` |
| 2 | K1–K3 + their K5 tests: trackpad, flicks, lock flicks | ron (Opus) | `p1/ron-eve-gestures` |
| 3 | xx follow-up: does a Giac entry point autosimplify by itself? | gorge (Sonnet) | `p1/gorge-eve-xx` |
| 4 | Fairphone 6: K0 check, C5 (no INTERNET permission), first FP6 numbers | annabell (Sonnet) | `p1/annabell-eve-fp6` |
| later | L7 cold-start re-measure on the Tab One | annabell | when the Tab One is connected |
| later | K4 compact keypad | ron | after task 2 is merged |

## 2. Read before you start
- `docs/backlog.md`: L9, K0–K5 (the task text is binding).
- `docs/decisions.md` P7 (gestures). Decided; not to be reopened. Point 4 (merge Shift and Alpha) is **not** part of this shift.
- Shift and Alpha behaviour, L3 double-tap locks and the existing `NavDir` arrow handling must stay unchanged.

## 7. Assignments

### ron, task 1 (L9), branch `p1/ron-eve-l9`
As in backlog L9. Tests first: `app/test/keys.spec.ts` `1 a/b 2 ▶ ÷ 3` Enter = `0.166666666667` (`source: derived`), plus the same for a root and a power before ÷, and a parser round-trip case for the nested fraction (ask Henri to forward it to gorge only if the parser needs a change; otherwise add the round-trip case yourself in the parser test file and say so). Reuse `selectCompound` in `EntryController`. Run typecheck, vitest and the e2e suite before `done`.

### ron, task 2 (gestures), branch `p1/ron-eve-gestures`
Backlog K1, K2, K3 and the K5 tests for them (Playwright drag and flick helpers via CDP touch events, one test per gesture). Keep the key ids `up/down/left/right` as tap zones. Haptics through the existing `input/haptics.ts`. Record the gestures in `spec/keyboard.yaml`'s header. Start-up must not grow noticeably: report the start chunk size (`npm run build`) before and after. Commit after each of K1, K2, K3.

### gorge, task 3 (xx follow-up), branch `p1/gorge-eve-xx`
Backlog/log 2026-10-11 20:55: the xx fix (`d1e9c7e`) adds a regroup call when a stored answer merges factors. Find out whether another Giac entry point (or eval setting) applies autosimplify itself, so the extra call can go. If yes and all tests and the golden gate pass, replace it; if not, write the finding in two lines in your report and stop. Time box: about one hour.

### annabell, task 4 (Fairphone 6), branch `p1/annabell-eve-fp6`
The user's Fairphone 6 (`4d42e62f`, LineageOS) is connected and offered for this shift (user, 2026-10-12 19:10). Rules section 6: `stay-awake.sh` first, our app only, `--restore` right after, battery and temperature before each series.
1. C5: remove the INTERNET permission from `android/app/src/main/AndroidManifest.xml`; build from `phase-1` (`./build.sh --dev`, it takes the host-cpu lock itself; do not wrap it).
2. Install on the FP6 and check: the app starts and computes in all apps (Home `1+1`, CAS, Function plot, Solve, Python `print(1)`); K0: switching to and from Python (editor and shell) and to Function/Solve never opens the system keyboard.
3. First FP6 numbers (medians of ≥5, with Android/WebView version and build type): cold launch → keyboard usable, → engine ready; Plot fps (60 fps target, Q6); Home Enter → result p95. Same tools and method as the Tab One runs (`tools/README.md`).
4. Restore the FP6, commit, report.

## 8. Definition of done
- Each branch: typecheck 0, vitest all pass, e2e all pass (the known-flaky `solve.spec.ts` persistence test may be re-run once), SPDX headers, `git commit -s` with the trailer.
- Henri re-runs typecheck + vitest + e2e on each branch before merging, and the golden gate after any engine-side change (task 3).
- Gestures: every gesture has a Playwright test; start chunk size reported.
