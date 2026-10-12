<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Shift brief: milestone 4 "Find and trust" (shift name `m4`, run by the owner)

**Manual mode (user, 2026-10-12):** there is no coordinator. The owner starts each work package as its own session and, when it is done, a short review session that checks and merges it (section 8a). The standing rules in [rules.md](rules.md) still apply (sections 1, 3, 5, 6, 9). Where they say "Henri" or "message", read this brief instead; where the two differ, this brief wins.

## 0. State at start
`phase-1` at `ad86660` (architecture docs, P8–P10 accepted, sandra's probes). Nothing pushed. Leftovers for the first review session to clean up: the merged branches `p1/annabell-eve-fp6`, `p1/annabell-night-fp6`, `p1/ron-night-k2` and their worktrees under `.claude/worktrees/` (`git worktree remove`, then `git branch -d`). `p1/ron-eve-gestures` is unmerged (the old flick classifier); leave it for the owner.

## 0a. Work packages
Goal: milestone 4 of P8, built to [04-architecture.md](../04-architecture.md). The task text in `docs/backlog.md` "Engineer core, milestone 4" (steps 1–12) is binding. Each package below names its backlog step; § numbers point into docs/04.

| # | Package | Backlog step | Agent, model | Branch | Start when merged | Size |
|---|---|---|---|---|---|---|
| G0 | Result types for the new fields (interface only) | 3 (first part) | gorge, Sonnet | `p1/gorge-m4-types` | — | ~1 h |
| R1 | Task benchmark harness (EN0) | 1 | ron, Sonnet | `p1/ron-m4-en0` | — | ~1 d |
| G1 | Regression cases first | 2 | gorge, Sonnet | `p1/gorge-m4-regress` | — | ~0.5 d |
| A1 | Size test | 11 | annabell, Sonnet | `p1/annabell-m4-size` | — | ~0.5 d |
| R2 | Chips and Ans, the `0x` error | 5 | ron, **Opus** | `p1/ron-m4-chips` | R1, G0 | ~2 d |
| G2 | Honest precision in the engine (EN3-engine, P9) | 3 | gorge, **Opus** | `p1/gorge-m4-precision` | G0, G1 | ~3 d |
| A2 | qalc build in `build.sh` | 6 | annabell, Sonnet | `p1/annabell-m4-qalc` | — | ~1 d |
| R3 | Marks, 30 digits, PFX in the UI (EN3-UI) | 4 | ron, Sonnet | `p1/ron-m4-marks` | G2 | ~1.5 d |
| G3 | Definitions survive a relaunch, plus G2's follow-ups (M4-6 to M4-8) | 10, 3 | gorge, **Opus** | `p1/gorge-m4-defs` | G2 | ~1.5 d |
| G4 | Find index generator and query test (EN1-index) | 7 | gorge, **Opus** | `p1/gorge-m4-index` | A2 | ~3 d |
| A3 | Copy, paste, share, export (EN4) | 9 | annabell, Sonnet | `p1/annabell-m4-copy` | R2 | ~2 d |
| R4 | Find UI (EN1) | 8 | ron, Sonnet | `p1/ron-m4-find` | R2 (G4 for the real index) | ~3 d |
| A4 | Device bars on the Tab One | 12 | annabell, Sonnet | `p1/annabell-m4-device` | R3, R4, A3; Tab One connected | ~0.5 d |

**Waves** (one package per agent at a time; the three agents run in parallel):
1. G0, R1, G1, A1 (A2 can start at once too). Merged.
2. R2, G2, A2. Merged (2026-10-12).
3. **Now:** R3 (ron, Sonnet), G4 (gorge, Opus), A3 (annabell, Sonnet).
4. Then: G3 (gorge, Opus, after G4), R4 (ron, Sonnet, after R3). Last: A4 (annabell, after R3, R4, A3).

G4 goes before G3 because A2 → G4 → R4 → A4 is the longest chain. G3 now carries G2's precision follow-ups (M4-6 to M4-8), hence Opus. The qalc build for G4's index generator is in the main checkout: `QALC_OUT=/home/nordmu/Documents/source99/pascaline/engine/qalc/_out/dev`.

**Why these models:** Opus where a subtle mistake becomes a wrong number or a broken entry line and rework would cost more than doing it right: G2 (the agreement check, the `⚠` rules, P9), R2 (MathLive macros, the parser, Ans on an empty line) and G4 (the qalc round-trip check, ranking quality). Sonnet elsewhere: those packages have mechanical checks (tests, the oracle, the size budgets) that catch mistakes, and every package gets an Opus review before it merges.

### How to start a package
From the main checkout (`/home/nordmu/Documents/source99/pascaline`), one terminal per package:

```bash
claude --agent <ron|gorge|annabell> --model <sonnet|opus> "Do package <ID> in docs/shifts/brief.md."
```

Check `/model` once at the start: the agent files pin `model: opus`, and the flag should override it. A package that runs out of usage can be resumed (`claude --continue` in the same terminal) or restarted with the same command: the agent finds its branch and continues from its last commit.

## 2. Read before you start (every package)
- **Your first step:** make your own worktree from `phase-1`, never switch branches in the main checkout (other packages run there at the same time):
  ```bash
  cd /home/nordmu/Documents/source99/pascaline
  git worktree add .claude/worktrees/m4-<id> -b p1/<name>-m4-<pkg> phase-1   # or, when resuming: git worktree add .claude/worktrees/m4-<id> p1/<name>-m4-<pkg>
  cd .claude/worktrees/m4-<id>
  ```
  Then the shared paths and locks of rules section 5 (`GIAC_OUT`, `PYTHON_OUT`, `PASCALINE_DL_DIR`, `tools/devlock.sh` for heavy work).
- [04-architecture.md](../04-architecture.md) sections 0 and 8, and the sections your package names. Where docs/04 and docs/02 differ, docs/04 wins.
- `docs/backlog.md` "Engineer core", milestone 4: your step's text (files, tests, gate).
- `docs/decisions.md`: P8, P9, P10 and the defaults entry "2026-10-12 Architecture for the engineer core". These are decided; don't reopen them. If a docs/04 decision turns out wrong in the code, don't change it silently: finish what you can, and put the evidence under "Needs a decision" in your report.
- Not in this milestone: the Units app and worker (milestone 5), matrices, bases and everyday functions (milestone 6), Help = context help (milestone 6), prefix entry chips (gated by task 3).
- **No coordinator to message.** Stay inside the files your package names. Shared files (`CLAUDE.md`, `docs/*`, `THIRD_PARTY.md`, `.claude/agents/*`) are not yours. Put the text for them in your report, and the review session applies it. Devices are only for A4.

### Your report (every package)
End with a commit whose message body is the report. The review session reads it with `git log -1`. It holds:
- **Done:** what was built, item by item against the backlog step.
- **Tests:** typecheck, vitest, e2e and golden counts as run.
- **Numbers:** for example the start chunk size before and after, or timings.
- **For shared files:** exact text for the backlog, decisions, THIRD_PARTY.md, docs/04.
- **Needs a decision:** anything left open.
- **Not done:** what's missing.

Then end your turn.

## 7. Packages

### gorge, G0: result types, branch `p1/gorge-m4-types`
Add the new result fields of §8.2 to `app/src/engine/types.ts` and `app/src/calc/port.ts`:
- `HomeResult`: `exactRational`, `reliableDigits`, `full`, `defined`, `items`, `shape`
- `CasResult`: `numeric`
- the matching `HomeOutcome` and `CasOutcome` fields

Fill them with safe values where results are built: `exactRational: false`, `reliableDigits: null`, `full` = the display text, no `defined`. No behaviour changes. Typecheck and every test must stay green. This package exists so R2, R3 and G2 build on the same types.

### ron, R1: task benchmark harness (EN0), branch `p1/ron-m4-en0`
Backlog step 1.
- Write `tests/tasks/tasks.yaml` with the ten tasks of docs/03 section 6. Each task has `keys:`/`tap:` data, a budget, the expected result, `source:` and `status: active|pending`.
- Write `app/test/tasks.spec.ts`. It replays the tasks and counts presses by §5.2: every press counts, Shift and Alpha included, and a hold-drag or a screen tap counts 1.
- Tasks that can't run yet are `pending`, with today's best sequence recorded as their baseline.

Gate: the harness runs in the e2e suite.

### gorge, G1: regression cases first, branch `p1/gorge-m4-regress`
Backlog step 2. Each case below is failing or `status: pending` until it's fixed.
- `tests/golden/precision.yaml`: the 20- and 30-digit `oracle` cases, plus §2.3 #2–#5.
- `home.yaml`: a `mark:` field on every numeric case, checked by `oracle.py`.
- `python.yaml`: `calc.eval("1-0.9-0.1")` → 0.
- `oracle.py --digits N`.

Expected values come from the oracle only (`tests/golden/.venv`), never from memory. The parser case (#1) belongs to ron, in R2. Gate: the golden gate lists the new cases and still ends in GOLDEN GATE PASSED, with pending cases counted separately.

### annabell, A1: size test, branch `p1/annabell-m4-size`
Backlog step 11. Write `app/scripts/size-check.ts`. It reads Vite's manifest (`build.manifest: true`) and fails when a chunk is over its §8.3 budget. `npm run build` and `build.sh` run it. Budgets for chunks that don't exist yet apply once those chunks appear.

### ron, R2: chips and Ans, branch `p1/ron-m4-chips`
Backlog step 5. Build on G0's types.
1. **Tests first:**
   - `parser.yaml`: `0xFF` typed with the keys must be an error (§2.3 #1).
   - `keys.spec.ts`: `1/3`, tap the result, `×3` = 1 (§2.3 #8).
2. **The MathLive macro check of §3.6:** a unit test and a screenshot. If MathLive 0.111.1 drops `expand: false` macros, use the `\mathrm{const:ID}` fallback and say so under "Needs a decision".
3. **The chips:** `\res{n}`, `\ans` and `\const{ID}`. Each chip carries its value in the history item's chip table, so the parser never reads the Find index (§3.6). Until G4 lands, `\const` takes its value from a small table of exact SI constants in your test fixture.
4. **Ans:** Shift + `+` = Ans. An operator on an empty line inserts Ans first, and `(−)` stays negation (§2.8).

Each token gets a round-trip case in the same commit. Report the start chunk size before and after.

### gorge, G2: honest precision in the engine, branch `p1/gorge-m4-precision`
Backlog step 3. Build on G0 and G1.
- **The mark:** the agreement check, and `⚠` for un-audited functions that return floats (§2.4).
- **Digits up to 30,** with `max(30, digits+10)` and `max(40, digits+10)` (§2.5).
- **Formatting:** re-evaluate `tieRisk` values; our formatter for lists, matrices and Home `solve`; fill `full` and `defined` with real values.
- **CAS:** numeric results get their value, and P9 makes typed decimals exact (§2.9). Re-check the `bench` stage, which runs in CAS mode.
- **Python:** `calc.eval` goes through `home()` (§2.10).
- **New formats:** `sigfig` (§2.5), and the PFX format in `format.ts` with unit tests at each prefix boundary (§2.7).

Gate:
- G1's cases #2–#7 and #9 pass (#8 is R2's).
- The golden gate passes.
- Vitest covers the mark for each format.

Report the desktop Enter p95 at digits 12 and 30 (`?bench=1`) before and after.

### annabell, A2: qalc build in `build.sh`, branch `p1/annabell-m4-qalc`
Backlog step 6 and §7.1.
- **The build script:** promote `spike/qalc` to `engine/qalc/build-wasm.sh [dev|release]`. The release build runs in the pinned trixie container (P2). libxml2 and libqalculate are pinned by SHA-256; GMP and MPFR are shared with Giac.
- **Wiring:** a `build.sh` step, `--no-units`, and notes in `fdroid/README.md`. The THIRD_PARTY.md text goes in your report.
- **Measure:** the release build time; the size against the spike (0.93 MB brotli, ±5 %); whether two release builds give the same `qalc.wasm`.

Take the host-cpu lock for every build. Never mount the main checkout into the container.

### ron, R3: marks, 30 digits, PFX in the UI, branch `p1/ron-m4-marks`
Backlog step 4, on top of G2.
- **First, the parser chunk (user, 2026-10-12, decisions M4-3):** move the parser (`parse.ts`, `emit.ts`, `chips.ts`) out of the start chunk into its own chunk, loaded together with MathLive. Report the start chunk before and after (after R2: 147.60 kB / 51.13 kB gzip).
- Show `=`/`≈`/`⚠ n` before Home and CAS results, from G2's `markOf()`. Num and Solve show only `⚠` (§2.4). The "approximate" note goes. A result with `warn: "unaudited"` shows `⚠` without a count (decisions M4-5). A result with `inexactInput` (R2) is never `=` (M4-4).
- **Draw with `formatConfirmed()`** (G2): re-formatting a history value with `formatComplex` alone shows unconfirmed digits of a `⚠` result. Known places: `displayMode.ts:122`, `apps/solve/app.svelte.ts:233`, `apps/function/app.svelte.ts:97`. The port's `NumberFormat` needs `"pfx"` → `"PFX"`.
- Allow digits up to 30, with the settings `schema: 2` migration (§6.2).
- Wire G2's PFX format into Settings and the Format key cycle (§2.7).
- **Fix the E-notation exponent bug (user, 2026-10-12; found in R1, decisions M4-2):** typing `2.2E-9 × 4.7E3` without → after the exponent puts × inside the exponent and gives `2.2E-42300`, silently. A Playwright regression test first (the key sequence gives 1.034E-5), then the fix: an operator key ends the exponent.

Tests: session migration unit tests, and `fmt.spec.ts` e2e for the marks and PFX.

### gorge, G3: definitions survive a relaunch, branch `p1/gorge-m4-defs`
Backlog step 10 and §6.2.
- Add the `defs` key: the last definition per name, at most 500 lines, replayed at engine init through `init.replay`.
- Keep `userNames` for Find.

- **G2 follow-ups (user, 2026-10-12, decisions M4-6 to M4-8):**
  - **Marks of stored variables (M4-7):** keep the mark per name with the defs log, so `B:=romberg(exp(-x^2),x,0,1)` (`⚠`) then `B` reads `⚠`, not `≈`. Golden case first.
  - **`evalf(x,n)` in CAS (M4-6):** show the n digits asked for, only the confirmed ones (the agreement check at the requested precision; `⚠ n` if fewer agree). Golden cases first: `evalf(pi,50)` (`oracle`), and a case where fewer agree.
  - **Root polish (M4-8):** Solve and analysis roots get a second-precision polish at W + 20 in `solve1`, so `full` carries confirmed digits and a 30-digit root is checked. Golden cases at 30 digits (`oracle`).

Test: `app/test/persist.spec.ts` (`5▶A`, reload, `A×2` = 10). Report `replayMs` with 200 definitions on the desktop.

### gorge, G4: Find index generator and query test, branch `p1/gorge-m4-index`
Backlog step 7, on top of A2.
- **The generator,** `tools/find-index/generate.mjs`. It builds the index from the pinned tarballs, takes values, uncertainties and SI factors from the qalc build run in Node, and checks that every id round-trips through qalc (§3.3). Sandra's prototype in `tools/probes/find/` and the notes in `docs/research/r6-pipelines.md` are a head start.
- **Our data files:** `find/aliases.yaml`, and `find/functions.yaml` for tier 0 (each function with its golden accuracy case).
- **The query test:** `tests/tasks/find-queries.yaml` from docs/04 Appendix B with real ids, plus `app/src/find/queries.test.ts`.
- **Wiring:** the `npm run index` hook, and the `build.sh` step after the qalc step. `build.sh` is annabell's file; keep your change to that one step and name it in the report.
- **THIRD_PARTY.md:** the "Find index data" text goes in your report.

Gate:
- every phrase in the top 3, at least 90 % first
- the index ≤ 100 kB gzip
- no currency ids

### annabell, A3: copy, paste, share, export, branch `p1/annabell-m4-copy`
Backlog step 9 and §2.6.
- **`ClipboardPort`** (§8.2): `navigator.clipboard` first. Capacitor plugins only if A4's device check needs them; the plugin's THIRD_PARTY.md text goes in your report.
- **Keys:** Shift + View = Copy (full value), Shift + Menu = Paste a number. You may edit those two entries in `spec/keyboard.yaml`.
- **Actions:** the Home/CAS Menu items, a long press on a history row, and Num as CSV.

Tests: one e2e per action and a copy → paste round trip.

### ron, R4: Find UI, branch `p1/ron-m4-find`
Backlog step 8.
- **Keys:** Math = Find, Vars = Find on variables, Shift + Math = Memory (§5.1).
- **Inside Find:** keys follow §3.7, ranking §3.5 (`app/src/find/rank.ts`), preview and insertion §3.6.
- **Content:** live items from `defined` (§3.4); usage stored in `find.usage`; `?bench=find`.
- **Loading:** Find is a lazy chunk, and the index is fetched only when the browser is idle after the engine is ready.
- **Data:** until G4 is merged, work against a hand-written fixture of the §3.3 `FindItem` schema (`app/src/find/fixture.ts`, about 30 items covering every kind). Then switch to the generated index. The schema is fixed by §3.3; a change goes under "Needs a decision".

Gate:
- task 5 active and within budget
- ranking unit tests
- the query test, once G4 is in
- the size test

### annabell, A4: device bars, branch `p1/annabell-m4-device`
Backlog step 12, when the Tab One is connected (rules section 6). On the device:
- install an APK built from `phase-1`, and leave it for the owner to try
- cold start (L7)
- Enter p95 at digits 12, 20 and 30 (`?bench=1&digits=N`, 5 cold runs)
- Find per key (`?bench=find`)
- whether `navigator.clipboard` and `navigator.share` work in WebView 131

Report against the §8.3 bars. A miss goes under "Needs a decision" with the number; docs/04 says what changes (digits capped at 20, incremental Find).

## 8. Definition of done
- **Each branch:** typecheck 0; vitest all pass; e2e all pass (the known-flaky `solve.spec.ts` persistence test may be re-run once); SPDX headers; `git commit -s` with the trailer (`Claude Opus 5.5` or `Claude Sonnet 5.5`, whichever model ran); the report commit; start chunk size reported for UI packages.
- **Milestone 4 is done when:**
  - task 5 is within budget
  - the query test passes
  - the golden gate passes with marks and `precision.yaml`
  - no §2.3 item #1–#9 is left (each fixed, with its regression case passing)
  - the size test passes
  - the Tab One bars of §8.3 hold, or a measured miss is written up as a proposal in `docs/decisions.md`

## 8a. Review and merge (one short Opus session per finished package)
```bash
claude --model opus "Review and merge package <ID>: follow section 8a of docs/shifts/brief.md."
```
The reviewer works in the main checkout on `phase-1`:
1. `git status` is clean, and the prerequisites in the table are merged. If not, stop and say so.
2. Read the report (`git log -1 p1/<name>-m4-<pkg>`) and the diff (`git diff phase-1...p1/<name>-m4-<pkg>`) against the backlog step and the docs/04 sections it names. Check the claims:
   - expected values come from the oracle or are `derived`
   - every new token has its round-trip case
   - no file outside the package's scope is changed
3. In the package's worktree, run:
   - typecheck, vitest and e2e
   - the golden gate (absolute `GIAC_OUT`) when engine-side or parser code changed
   - the size test, once A1 is in
4. **Problems:** don't merge. List them, at most five, each with `file:line` and the fix. The owner restarts the package with "Fix the review findings for package <ID>: …".
5. **Otherwise:**
   - `git merge --no-ff` into `phase-1`
   - apply the report's "For shared files" text
   - tick the backlog step with the commit
   - put "Needs a decision" items under "Needs the user" in `docs/decisions.md`
   - remove the worktree, then `git branch -d`
   - commit with `git commit -s`
   - never push
6. When a merge completes milestone 4: write `docs/shifts/<date>-m4-report.md` (rules section 11, step 5) and add milestone 4 to docs/02 section 12. The report says what the owner should try on the APK: marks, Find, copy and paste, and the empty-line Ans.
