<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Shift brief: milestone 4 "Find and trust" (shift name `m4`)

The standing rules (sections 1, 3–6 and 9–11) are in [rules.md](rules.md); read them first. This brief may run over several sessions: Henri picks up from `.coord/log.md` and the package table below, marking each package done in the table and in the backlog as it merges.

## 0. State at start
`phase-1` at the commit that adds this brief (architecture docs, P8–P10 accepted). Nothing pushed. Leftovers: the merged branches `p1/annabell-eve-fp6`, `p1/annabell-night-fp6`, `p1/ron-night-k2` and their worktrees under `.claude/worktrees/` can go (`git worktree remove`, then `git branch -d`); `p1/ron-eve-gestures` is unmerged (old flick classifier), so leave it for the user. Devices: whatever `adb devices` shows; no device work until the Tab One is connected (packages A3 and A4 wait for it).

## 0a. Work packages
Goal: milestone 4 of P8, built to [04-architecture.md](../04-architecture.md). The task text in `docs/backlog.md` "Engineer core, milestone 4" (steps 1–12) is binding; the package below names its step. § numbers point into docs/04.

**Economy mode (user, 2026-10-12; overrides rules section 4 steps 2–3).** One agent per package, spawned fresh, since the docs carry the context; no roll call; workers don't message each other, Henri relays. An agent ends its turn when its package is done. Run at most one package per worker at a time; the three tracks run in parallel.

| # | Package | Backlog step | Worker, model | Branch | Needs | Size |
|---|---|---|---|---|---|---|
| R1 | Task benchmark harness (EN0) | 1 | ron, Opus | `p1/ron-m4-en0` | — | ~1 d |
| R2 | Chips and Ans, `0x` error | 5 | ron, Opus | `p1/ron-m4-chips` | R1 | ~2 d |
| R3 | Marks, 30 digits, PFX in the UI (EN3-UI) | 4 | ron, Opus | `p1/ron-m4-marks` | G2 merged | ~1.5 d |
| R4 | Find UI (EN1) | 8 | ron, Opus | `p1/ron-m4-find` | R2, G4 (or the fixture, see below) | ~3 d |
| G1 | Regression cases first | 2 | gorge, Opus | `p1/gorge-m4-regress` | — | ~0.5 d |
| G2 | Honest precision in the engine (EN3-engine, P9) | 3 | gorge, Opus | `p1/gorge-m4-precision` | G1 | ~3 d |
| G3 | Definitions survive a relaunch | 10 | gorge, Sonnet | `p1/gorge-m4-defs` | G2 merged | ~0.5 d |
| G4 | Find index generator and query test (EN1-index) | 7 | gorge, Opus | `p1/gorge-m4-index` | A2 | ~3 d |
| A1 | Size test | 11 | annabell, Sonnet | `p1/annabell-m4-size` | — | ~0.5 d |
| A2 | qalc build in `build.sh` | 6 | annabell, Opus | `p1/annabell-m4-qalc` | — | ~1 d |
| A3 | Copy, paste, share, export (EN4) | 9 | annabell, Opus | `p1/annabell-m4-copy` | R2 merged | ~2 d |
| A4 | Device bars on the Tab One | 12 | annabell, Sonnet | `p1/annabell-m4-device` | R3, R4, A3 merged; Tab One connected | ~0.5 d |

**Start order:** R1, G1 and A1 at once; then R2, G2, A2. Merge each package before the next one that needs it starts from `phase-1`.

## 2. Read before you start
- [04-architecture.md](../04-architecture.md) sections 0 and 8, plus the sections your package names (§). Where docs/04 and docs/02 differ, docs/04 wins.
- `docs/backlog.md`, "Engineer core", milestone 4: your step's text (files, tests, gate).
- `docs/decisions.md`: P8 (roadmap), P9 (typed decimals in CAS become exact), P10 (Giac's English help lines in Find), and the defaults entry "2026-10-12 Architecture for the engineer core". All are decided; don't reopen them. A docs/04 decision that turns out wrong in code becomes a `[NEED]` to Henri with the evidence, not a silent change.
- Not in this milestone: the Units app and worker (milestone 5), matrices, bases and the everyday functions (milestone 6), Help = context help (milestone 6), prefix entry chips (gated by task 3).

## 7. Assignments

### Interfaces first (G2 and R4 start with these, everyone builds on them)
- **G2's first commit** adds the new result fields of §8.2 to `app/src/engine/types.ts` and `app/src/calc/port.ts` (`exactRational`, `reliableDigits`, `full`, `defined`, `items`, `shape`; `CasResult.numeric`), filled with safe values (`exactRational: false`, `reliableDigits: null`, `full` = the display text). Henri merges that commit on its own, early, so R2 and R3 can build against the types.
- **R4** works against a small hand-written fixture of the §3.3 `FindItem` schema (`app/src/find/fixture.ts`, about 30 items covering every kind) until G4 merges; then it switches to the generated index. The schema is fixed by §3.3; a change goes through Henri.

### ron, R1: task benchmark harness (EN0), branch `p1/ron-m4-en0`
Backlog step 1. `tests/tasks/tasks.yaml` with the ten tasks of docs/03 section 6, each with `keys:`/`tap:` data, budget, expected result, `source:` and `status: active|pending`. `app/test/tasks.spec.ts` replays them and counts presses by §5.2 (every press counts, Shift and Alpha included; a hold-drag or a screen tap counts 1). Tasks that can't run yet are `pending`, with today's best sequence recorded as their baseline. Gate: the harness runs in the e2e suite.

### ron, R2: chips and Ans, branch `p1/ron-m4-chips`
Backlog step 5. **Tests first:** `parser.yaml` gets `0xFF` from the keys = an error (§2.3 #1), and `keys.spec.ts` gets `1/3`, tap, `×3` = 1 (§2.3 #8). Then do the MathLive macro check of §3.6: a unit test and a screenshot. If MathLive 0.111.1 drops `expand: false` macros, use the `\mathrm{const:ID}` fallback and tell Henri. Then add `\res{n}`, `\ans` and `\const{ID}`. Each chip carries its value in the history item's chip table, so the parser never reads the Find index (§3.6). Also: Shift + `+` = Ans, and an operator on an empty line inserts Ans (`(−)` stays negation, §2.8). Each token gets a round-trip case in the same commit. Report the start chunk size before and after.

### ron, R3: marks, 30 digits, PFX in the UI, branch `p1/ron-m4-marks`
Backlog step 4, after G2 has merged. Show `=`/`≈`/`⚠ n` before Home and CAS results; Num and Solve show only `⚠` (§2.4); the "approximate" note goes. Digits go up to 30, with the settings `schema: 2` migration (§6.2). The PFX format comes from gorge's `format.ts`; you wire it into Settings and the Format key cycle (§2.7). Tests: session migration unit tests, `fmt.spec.ts` e2e for marks and PFX.

### ron, R4: Find UI, branch `p1/ron-m4-find`
Backlog step 8. Math = Find, Vars = Find on variables, Shift + Math = Memory (§5.1). Keys inside Find follow §3.7, ranking §3.5 (`app/src/find/rank.ts`), preview and insertion §3.6, live items from `defined` (§3.4), `find.usage`, `?bench=find`. Find is a lazy chunk, and the index is fetched only when idle after the engine is ready. Gate: task 5 active and within budget; ranking unit tests; the query test once G4 is in; the size test.

### gorge, G1: regression cases first, branch `p1/gorge-m4-regress`
Backlog step 2. Add the following, each failing or `status: pending` until fixed:
- `tests/golden/precision.yaml` with the 20- and 30-digit `oracle` cases and §2.3 #2–#5
- a `mark:` field on every numeric `home.yaml` case, checked by `oracle.py`
- `python.yaml`: `calc.eval("1-0.9-0.1")` → 0
- `oracle.py --digits N`

The parser row (#1) is ron's, in R2. Gate: the golden gate lists the new cases and still ends in GOLDEN GATE PASSED, with pending cases counted separately.

### gorge, G2: honest precision in the engine, branch `p1/gorge-m4-precision`
Backlog step 3. Start with the interface commit above. Then:
- the agreement check, and `⚠` for un-audited float-returning functions (§2.4)
- digits up to 30 with `max(30, digits+10)` / `max(40, digits+10)` (§2.5)
- `tieRisk` re-evaluation
- our formatter for lists, matrices and Home `solve`
- `full` and `defined`
- CAS numeric results and P9 (§2.9; re-check the `bench` stage)
- `calc.eval` through `home()` (§2.10)
- `sigfig` (§2.5)
- the PFX format in `format.ts`, with boundary unit tests (§2.7)

Gate: G1's cases #2–#7 and #9 pass (#8 is R2's); golden gate; Vitest for the mark per format. Report desktop Enter p95 at digits 12 and 30 (`?bench=1` locally) before and after.

### gorge, G3: definitions survive a relaunch, branch `p1/gorge-m4-defs`
Backlog step 10 and §6.2. The `defs` key: last definition per name, at most 500 lines, replayed at engine init through `init.replay`; `userNames` for Find. Test: `app/test/persist.spec.ts` (`5▶A`, reload, `A×2` = 10). Report `replayMs` with 200 definitions on the desktop.

### gorge, G4: Find index generator and query test, branch `p1/gorge-m4-index`
Backlog step 7, after A2 has merged. `tools/find-index/generate.mjs` builds the index from the pinned tarballs, with values, uncertainties and SI factors from the qalc build run in Node, and checks that every id round-trips through qalc (§3.3). Also:
- `find/aliases.yaml`, and `find/functions.yaml` for tier 0 (each function with its golden accuracy case)
- `tests/tasks/find-queries.yaml` from docs/04 Appendix B with real ids, plus `app/src/find/queries.test.ts`
- `build.sh` and `npm run index` hooks, coordinated with annabell through Henri
- a "Find index data" section for THIRD_PARTY.md, sent to Henri as text (shared file)

Gate: every phrase in the top 3, ≥ 90 % first; index ≤ 100 kB gzip; no currency ids.

### annabell, A1: size test, branch `p1/annabell-m4-size`
Backlog step 11. `app/scripts/size-check.ts` reads Vite's manifest and fails over the §8.3 budgets. `npm run build` and `build.sh` run it. Budgets for chunks that don't exist yet apply once those chunks appear.

### annabell, A2: qalc build in `build.sh`, branch `p1/annabell-m4-qalc`
Backlog step 6 and §7.1. Promote `spike/qalc` to `engine/qalc/build-wasm.sh [dev|release]`; the release build runs in the pinned trixie container (P2). libxml2 and libqalculate are SHA-256 pinned; GMP and MPFR are shared with Giac. Also add the `build.sh` step, `--no-units` and `fdroid/README.md` notes, and send Henri the THIRD_PARTY.md text. Measure the release build time and its size against the spike (0.93 MB brotli, ±5 %), and check that two release builds give the same `qalc.wasm`. Take the host-cpu lock for every build. Never mount the main checkout into the container.

### annabell, A3: copy, paste, share, export, branch `p1/annabell-m4-copy`
Backlog step 9 and §2.6.
- `ClipboardPort` (§8.2): `navigator.clipboard` first. Capacitor plugins only if the device check needs them, and every plugin goes into THIRD_PARTY.md through Henri.
- Shift + View = Copy (full value) and Shift + Menu = Paste a number. For this package you may edit those two entries in `spec/keyboard.yaml`; tell Henri, who tells ron.
- The Home/CAS Menu actions, long press on a history row, and Num CSV.

Tests: one e2e per action and a copy → paste round trip.

### annabell, A4: device bars, branch `p1/annabell-m4-device`
Backlog step 12, when the Tab One is connected (rules section 6). Measure:
- an APK from `phase-1` for the owner
- L7 cold start
- Enter p95 at digits 12/20/30 (`?bench=1&digits=N`, 5 cold runs)
- Find per key (`?bench=find`)
- `navigator.clipboard` and `navigator.share` in WebView 131

Report against the §8.3 bars. A miss goes to Henri with the number; docs/04 says what changes (digits cap 20; incremental Find).

## 8. Definition of done
- **Each branch:** typecheck 0; vitest all pass; e2e all pass (the known-flaky `solve.spec.ts` persistence test may be re-run once); SPDX headers; `git commit -s` with the trailer; start chunk size reported for UI packages.
- **Henri, before each merge:** re-run typecheck, vitest and e2e on the branch; run the golden gate (absolute `GIAC_OUT`) after any engine-side or parser change; run the size test once A1 is in. Merge one branch at a time; `spec/keyboard.yaml` and `App.svelte` are touched by R2, R4 and A3, so re-run e2e after each of those merges.
- **Milestone 4 is done when:**
  - task 5 is within budget
  - the query test passes
  - the golden gate passes with marks and `precision.yaml`
  - no §2.3 item #1–#9 is left (each fixed with its regression case passing)
  - the size test passes
  - the Tab One bars of §8.3 hold, or a measured miss is written up as a proposal in `docs/decisions.md`
- **Wrap-up (rules section 11):** the backlog's milestone 4 steps are ticked with their commits; docs/02 section 12 gets milestone 4; the report goes in `docs/shifts/<date>-m4-report.md`. That report includes what the user should try on the APK: marks, Find, copy and paste, and the empty-line Ans.
