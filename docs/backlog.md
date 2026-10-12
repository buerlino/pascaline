<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Status and backlog

The one place for "where are we and what's left". The architecture is [04-architecture.md](04-architecture.md) (it supersedes [02-architecture-plan.md](02-architecture-plan.md) where they differ; 02 section 12 keeps the milestone history); decisions are in [decisions.md](decisions.md); shift reports are in [shifts/](shifts/). Last reviewed 2026-10-12 (cleanup audit; the engineer-core roadmap, P8; the architecture pass, docs/04).

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
   - Start-up on the Tab One: engine ready 956 ms (milestone 1) → 1022 ms (2) → 995 ms (3); keyboard usable 653–667 → 679 → 662 ms. Python loads lazily (P1). The start chunk grew to 142.6 kB after K2 (L7).

## Needs the user
0. **Later, in milestone 5:** time ten tasks by hand, E-notation against units (the rule 2 speed gate). (P8 itself was confirmed by the user on 2026-10-12, no veto.)
1. **G2 spot checks on the real G2** (optional, about 15 minutes): item 29 (the stock a b/c key; the Virtual Calculator contradicts the earlier "it was my script" finding), item 8 (tie rounding, typed with the keys) and the list in `spec/mapping/vc-2026-10-11/SPOT-CHECK.md`. The Virtual Calculator answers are already in `tests/golden/g2.yaml`.
2. **Tap "Allow USB debugging"** on a device when it shows `unauthorized`.
3. **Feel of the hold-and-drag cursor (P7 revised, K2)**, now built and merged but not yet in your hands (needs a new APK): keys fire on release (slow?), 350 ms hold (too long or too short?), 10 px slop, ⌫ repeat 400 ms then every 60 ms (too much buzzing?), the extra tick at cursor start, 30% dimming. Also the K1 trackpad feel.
4. **Try lowercase `print(1)` in the Python shell on a device:** on the Fairphone Alpha-lock gave only uppercase (`PRINT(1)` = NameError). Real gap or a missed lowercase layer?
5. **Later, not now** (user, 2026-10-11: first a usable prototype): the email to Bernard Parisse (draft in `../outreach/`; add the question from P10: may the English entries of `aide_cas` be shipped in a GPL-3.0-or-later app? Needed before any public release), the name and trademark checks, the real application id, CI (C3) and the F-Droid recipe (C4).

Decided 2026-10-12 (user): P8 confirmed with no veto; P9 yes (exact decimals in CAS, in milestone 4 task 3); P10 yes (Giac's English help lines in Find; the Parisse question is in item 5).

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

### Engineer core (P8; architecture in [04-architecture.md](04-architecture.md), plan and gates in [03-feature-analysis.md](03-feature-analysis.md) section 8)
Three parallel tracks per milestone. A milestone is done when its benchmark tasks (`tests/tasks/tasks.yaml`) pass within budget and its gates hold. Design rules: 03 section 0 (no discipline split; units must beat `E-10`; units separate from normal calculation; focus). Each task names its worker, files, tests and gate; section numbers (§) point into docs/04. The order is the order the architecture needs: the harness and the regression cases first, then the engine facts, then the UI that shows them, then Find on top of the chips. Every merge runs the merge gates of §7.3.

**Milestone 4: Find and trust** (~2 weeks)
1. **EN0. Task benchmark** (ron, first, ~1 d). Files: `tests/tasks/tasks.yaml` (id, `keys:`/`tap:` sequence, budget, expected result, `source:`, `status: active|pending`), `app/test/tasks.spec.ts`. Counting rules §5.2 (every press counts, Shift and Alpha included; a hold-drag or a screen tap is 1). The ten tasks of 03 section 6; today's best sequence recorded as the baseline for pending tasks; a hand-measured comparison column. Gate: the harness runs in the e2e suite; task 5 becomes active when Find lands.
2. **Regression cases first** (gorge, ~0.5 d; ron adds the parser row). One case per item of §2.3 #1–#9, failing or `status: pending` until fixed: `tests/golden/precision.yaml` (new: digits 20/30 `oracle` cases, `normald_icdf(10^-10)`, `UTPN(10)`, `romberg`, `BesselJ` at 30 digits), `home.yaml` (`mark:` field on every numeric case; `oracle.py` checks it), `parser.yaml` (`0xFF` from the keys must be an error), `python.yaml` (`calc.eval("1-0.9-0.1")` → 0). `oracle.py --digits N` for the 20/30-digit expectations. Gate: golden gate lists them.
3. **EN3-engine. Honest precision in the engine** (gorge, ~3 d). Files: `app/src/engine/homeEval.ts`, `format.ts`, `solve.ts`, `analysis.ts`, `host.ts`, `types.ts`; `app/src/calc/port.ts`, `engine.ts`; `app/src/python/calcHost.ts`. The facts for the mark (`exactRational`, `reliableDigits`) and the agreement check (§2.4); digits up to 30 on the engine side, `workDigits = max(30, digits+10)`, value precision `max(40, digits+10)` (§2.5); `tieRisk` re-evaluation; lists and matrices of numbers formatted by our formatter, `solve` in Home included (§2.4); `full` value and `defined` name in results (§8.2); CAS numeric results with their value, and typed decimals exact in CAS (P9, accepted; re-check the `bench` stage, which runs in CAS mode) (§2.9); `calc.eval` through `home()` (§2.10); `sigfig(x,n)` as an exact engine definition with golden cases at boundaries (999.95 at 4 digits, 0.0012345 at 3, negatives, ties). Tests: step 2's cases pass; Vitest for `markOf()` per format. Gate: golden gate.
4. **EN3-UI. Marks, 30 digits, prefix format** (ron, ~1.5 d, after 3). Files: `app/src/views/History.svelte`, `Settings.svelte`, `app/src/state/session.svelte.ts` (digits ≤ 30, settings `schema: 2` migration §6.2), `displayMode.ts`, `render/home.ts`; `format.ts` gets the `PFX` format (gorge, with unit tests at each prefix boundary). `=`/`≈`/`⚠` before Home and CAS results, `⚠` only in Num and Solve (§2.4); the "approximate" note goes. Tests: session and format unit tests, `app/test/fmt.spec.ts` e2e for marks and PFX. Gate: e2e, size test.
5. **Chips and Ans** (ron, ~2 d; parser rules in the same commits). Chips carry their own values in the history item's chip table, so the parser never waits for the Find index (§3.6). First: a unit test that MathLive 0.111.1 keeps `expand: false` macros in the value, and a screenshot test that a chip looks unlike a variable (§3.6; fallback `\mathrm{const:ID}`). Then `\res{n}`, `\ans`, `\const{ID}` (Units-only `\unit`, gated `\pfx` later); history insertion inserts a `\res` chip carrying `full` (§2.8); Shift + `+` = Ans; an operator on an empty line inserts Ans first; the parser rejects `0x`/`0b` followed by letters (§2.3 #1). Files: `app/src/entry/controller.ts`, `App.svelte`, `spec/keyboard.yaml`, `app/src/input/parse.ts`, `emit.ts`, `state/session.svelte.ts`. Tests: a round-trip case per token in `parser.yaml`, `app/test/keys.spec.ts` (Ans, empty-line operators, chip insertion, `1/3` tap `×3` = 1). Gate: e2e, parser, task benchmark.
6. **qalc build in `build.sh`** (annabell, ~1 d). `engine/qalc/build-wasm.sh [dev|release]` promoted from `spike/qalc` (release in the pinned trixie container, P2; SHA-256-pinned libxml2 and libqalculate; GMP/MPFR shared), `build.sh` step and `--no-units`, the F-Droid notes in `fdroid/README.md`; THIRD_PARTY.md moves libqalculate and libxml2 from "spike only" to shipped. Measure: release build time and size against the spike (0.93 MB brotli, ±5 %); two builds give the same `qalc.wasm`. Gate: reproducibility, size test. (Needed now because the Find index takes its values from qalc, §7.1; the worker stays milestone 5.)
7. **EN1-index. Find index generator and query test** (gorge, ~3 d, after 6). Files: `tools/find-index/generate.mjs` (Node, no network; output gitignored under `app/src/find/_gen/`), `find/aliases.yaml`, `find/functions.yaml` (tier 0: our description, syntax, the id of its golden accuracy case), the prefixed-unit list; `build.sh` and `npm run index` run it. Sources and rules §3.3: `aide_cas` English lines only, no `_` entries; qalc data without currencies, elements, planets, datasets; values, uncertainties and SI factors from qalc in Node; every id round-trips through qalc. `tests/tasks/find-queries.yaml` from docs/04 Appendix B with real ids; `app/src/find/queries.test.ts`. THIRD_PARTY.md "Find index data" (§7.2). Gate: query test (100 % top 3, ≥ 90 % first), index ≤ 100 kB gzip.
8. **EN1. Find UI** (ron, ~3 d, after 5 and 7). Files: `app/src/find/rank.ts` (§3.5), `FindPalette.svelte` (lazy chunk), `App.svelte`, `spec/keyboard.yaml` (Math, Vars, Shift + Math = Memory with delete and clear all). Keys inside Find §3.7; preview (constant value and uncertainty, unit dimension and SI factor, function syntax and example, "not checked" for tier 1); insertion as chips (§3.6); live variables and functions from `defined` (§3.4); usage in `find.usage`; `?bench=find`. Tests: Vitest for ranking, e2e per key path, the query test. Gate: task 5 active and within budget; query test; start chunk within budget (the size test); no index request before idle.
9. **EN4. Copy, paste, share, export** (annabell, ~2 d; Menu UI with ron). `ClipboardPort` (§8.2): `navigator.clipboard` first, `@capacitor/clipboard` only if the Tab One check fails; `@capacitor/share` in the APK if `navigator.share` is missing in the WebView. Shift + View = Copy (full value), Shift + Menu = Paste a number, Home/CAS Menu (Copy, as shown, exact, LaTeX, Paste, Share session, Clear), long press on a history row, Num table CSV (§2.6). Tests: one e2e per action, a copy → paste round trip (P5). THIRD_PARTY.md for any plugin. Gate: e2e.
10. **Definitions survive a relaunch** (gorge, ~0.5 d). `defs` key (§6.2): the replay log persisted (last definition per name, ≤ 500 lines) and replayed at engine init; `userNames` for Find. Files: `app/src/engine/workerEngine.ts`, `app/src/state/session.svelte.ts`. Tests: `app/test/persist.spec.ts` (store `5▶A`, reload, `A×2` = 10). Gate: e2e; Tab One engine ready < 1.5 s with 200 definitions.
11. **Size test** (annabell, ~0.5 d, early). `app/scripts/size-check.ts` reads Vite's manifest (`build.manifest: true`) and fails over the §8.3 budgets; run by `npm run build` and `build.sh`. Gate: itself.
12. **Device** (annabell). APK for the owner (K1/K2 feel); L7 cold start on the Tab One; Enter p95 at digits 12/20/30 (`?bench=1&digits=N`, §2.5); Find per key (`?bench=find`, §3.2); clipboard and share checks (§2.6). Gate: the Tab One bars of §8.3.

**Milestone 4 gate:** task 5 within budget; the query test; the golden gate with marks and `precision.yaml`; no §2.3 item #1–#9 left; the size test; the Tab One bars.

**Milestone 5: Units** (~2 weeks; P3 plan as amended, 03 section 4, docs/04 section 4)
1. **U1. qalc worker and client** (gorge, ~2 d). `engine/qalc/glue.cc` returning JSON (exact fraction or P-digit decimal, unit parts, dimension, uncertainty, qalc's approximate flag; §4.2), `UnitEngine` worker and client (`app/src/units/`), `Calc.units()`, lazy load, cancel. Check the open items: currency data in the compiled definitions, the Rankine name (Appendix C). Tests: worker tests (cancel, lazy), smoke cases. Gate: Vitest, golden smoke.
2. **U2. Parser units mode and the adapter** (ron for the parser, gorge for the adapter, ~2 d). `\unit`, `\pfx`, `\pm`, `\to` in units mode only; qalc text from whitelisted names only; the single-term check (dimension mismatch message) and the temperature rule (§4.3). Tests: round trips per token; `tests/golden/units.yaml` (gorge; from the 26 spike cases: temperature, prefixes, dimension errors, uncertainty, exactness marks, `72 km/h → m/s` = 20 `=`, `1 in → mm` = 25.4 `=`). Gate: golden gate (units section).
3. **`hp` patch and data audit** (gorge, ~1 d). `engine/qalc/patches/` with a README (P3 decision 3; the golden case fails without it), the one-off audit of units and constants against exact definitions and CODATA.
4. **Units app** (ron, ~3 d). Shift + Tmpl and Apps; one entry line; unit suggestions from the Find index; the Units key layer (Shift + EEX = `→`, Shift + `(−)` = `±`, §5.1); result view (value, mark, uncertainty, unit, dimension, one-tap alternatives); `units.targets` and `units.history`; the way back to Home as a `\res` chip (§4.3). Prefix chips only if task 3 shows a gain. Tests: e2e for tasks 1–4 and 10. Gate: task benchmark, a unit in ≤ 4 presses at the median.
5. **Build, size, devices** (annabell, ~1.5 d). Release qalc in the container; the no-lazy-load test (no `qalc.*` request outside the Units app); size budgets; first result on the Tab One and the Fairphone 6; memory with three workers (§4.2, Appendix C). Gate: < 1 s first result on the Tab One, no low-memory kill.

**Milestone 5 gate:** tasks 1–4 and 10; a unit in ≤ 4 presses at the median; `units.yaml`; the owner's hand timing (rule 2).

**Milestone 6: Structure** (~2 weeks)
1. **EN5. Matrices, vectors, lists** (ron, ~4 d). Shift + 5 `[ ]` (1×1 `pmatrix` that grows with ▶ and ▼, §5.3), Shift + 8 `{ }`, Shift + 4 matrix editor (grid over a stored variable, written back with `:=`), Tmpl template list; dot, cross, norm through Find (tier 0). Tests: round trips for grown matrices and chips in cells; e2e for task 8. Gate: task 8.
2. **EN6. Number bases** (gorge for the formatter and literals, ron for the menu, ~2.5 d). Base as a display mode of an integer result; Shift + `−` = Base menu; word size and signedness settings; `0x`, `0b`, `0o` literal tokens replacing milestone 4's error (§5.4). Tests: formatter unit tests, parser round trips, task 7. Gate: task 7.
3. **EN7. Everyday functions** (gorge, ~4 d). `par`, `eseries`, dB/dBm/Np functions, interpolation, RMS, coordinate conversions, degrees-minutes-seconds, shifts and rotations with word size; Giac definitions loaded with the engine; each one tier 0 with a golden case (`oracle` or `derived`); `normald_icdf` and the other inverse functions polished against their forward function (§2.3 #2). Gate: golden gate; tasks 6 and 9.
4. **Help = context help** (ron, ~0.5 d): the Find preview of the function before the cursor (§5.1).

**Milestone 6 gate:** tasks 6–9.


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
- **L7. Bundle size.** It is 142.6 kB at start (49.6 kB gzip; `vite build` 2026-10-12, after K2), plus 808 kB of MathLive loaded after the keypad. Trend: 94 kB (milestone 1), 108 (2), 115 (3, the last Tab One measurement), 139, 142.6. There was no automated size test (the "L7 size test" named in earlier plans did not exist); milestone 4 task 11 adds one with the budgets of docs/04 section 8.3. Since milestone 3 the largest single addition is `@capacitor/core` (7.8 kB, imported by `input/haptics.ts` for key vibration); the Format key's state code is most of the rest. Re-measure cold start on the Tab One in the next device session; if it got slower, load Capacitor only in the native build.

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
