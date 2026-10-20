<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Cleanup and declutter (Prompt D), 2026-10-20

Claude (Opus, the owner's session), by day, in `.claude/worktrees/phase-1` on `phase-1` at **`39befc8`**. No pipeline ran: A16 (run #119) was stopped by the owner at 09:45 before this started; the `scripts/pipeline.sh M3` that `pgrep` also finds is APODroid's (its settings path is under `source99/APODroid/`). Nothing is committed or pushed. The form follows [the audit of 2026-10-12](../archive/cleanup-audit-2026-10-12.md): baseline, one section per area, what waits for the owner.

**Scope, as the owner answered at the start:** the research-note status lines and the move of decided notes are package **S18**, and the notes' status-line and size check is **A22**; both stay open and untouched here. S12 is untouched. Another session edited this worktree during the cleanup (10:02: `docs/backlog.md` owner item 7, `tools/probes/README.md` one row, new `tools/probes/codata-check.py`); those changes are not part of this report and were left alone.

## (a) Baseline and after

**Gates.**

| | Before (`39befc8`) | After (this worktree) |
|---|---|---|
| `npm run gate` | PASSED: typecheck 0 errors; vitest 1465/1465 in 75 files; e2e 1056 of 1057, 1 skipped; golden skipped (no engine, parser, unit or Find change); size inside the budgets | **FAILED on e2e only, under load (to verify when the machine is idle):** typecheck 0 errors; vitest 1465/1465; size and docs pass; e2e 1055 of 1057. The two failures are timing tests: `copy.spec.ts:89` (the clipboard poll rules section 4 names; passes when rerun alone) and `working.spec.ts:61` (Cancel acted at 165.7 ms against a bar of 150 ms; fails again alone). Load average was 27–31 on 16 cores: pipeline #120 (R15c1) and APODroid's M4 ran their checks at the same time, and typecheck took 30 s against 9 s at the baseline. My only change under `app/` is one comment (`app/src/find/types.ts:52`). An earlier run's 6 e2e failures were page reloads from Vite when I put `en.ts` back during the run (b3) |
| `node tools/docs-check.mjs` | ok: 602 links and paths | ok: 567 links and paths (the archive's bare paths are not counted) |
| `npm run golden` | not needed: nothing under `app/src/engine/` changed (one comment in `app/src/find/types.ts`) | not needed |

The baseline gate's own docs step ran after the first moves (it printed 567 links); the 602 above is the separate docs-check run before any change.

**Tracked, by folder** (`git ls-files` bytes; the moves shift bytes from docs/shifts and docs/mockups into docs/archive):

| Folder | Before | After |
|---|---|---|
| all tracked | 6,216,096 | 6,216,705 (+609: the other session's README row; mine net −0.1 kB) |
| app | 2,281,879 | 2,281,798 |
| docs (all) | 1,796,557 | 1,796,444 + this report |
| docs/*.md (top level) | 296,830 | 286,926 (p3-units-plan.md to the archive) |
| docs/archive | 762,549 | 846,418 |
| docs/research (19 notes) | 308,434 | 308,434 (S18's) |
| docs/shifts (without packages) | 245,245 | 194,801 + this report |
| docs/mockups | 183,499 | 159,865 |
| logo / tools / spike / tests | 418,444 / 407,837 / 109,272 / 448,114 | unchanged / +610 (other session) / unchanged / +32 |

**Budgeted and edited docs** (bytes): brief 27,835 → 27,479 (budget 28 kB); backlog 19,105 (not edited by me; the other session's edit made it 18,947); decisions 37,980 (not edited); docs/04 69,107 (not edited); 71 package files ≤ 4.6 kB (not edited); docs/README.md 8,356 → 8,597 (12 missing entries added, the diagram dropped); docs/02 42,169 → 42,288; docs/03 24,750 → 24,795; docs/05 21,719 → 21,664; README.md 5,174 → 5,335; `app/src/i18n/en.ts` unchanged (see b3).

**Ignored and untracked** (main checkout, `du -sb`):

| Path | Before | After |
|---|---|---|
| `.coord/` | 17,234,621 | 622,632 |
| `tools/probes/_out/` | 33,205,250 | 11,568,671 |
| `.tasks/` | 78,700,307 | 80,075,755 (moves only on my side; it grew by other runs' files) |
| `dist/` (`pascaline.apk`, 2026-10-16) | 13,854,998 | unchanged (d) |
| `app/test/gallery/` | 8,329,382 | unchanged (d) |
| `python/` (MicroPython tarball) | 156 MB | unchanged, waits for the owner (c1) |

**Freed:** 38.2 MB (16.6 in `.coord/`, 21.6 in `tools/probes/_out/`). Another ~155 MB (`python/`) and an estimated ~40 MB (gzip of archived run logs, (to verify)) wait for the owner.

## (b) What I applied

### 1. Local clutter (ignored and untracked)
- **`scripts/gc.sh`** (dry run, then `--apply` with `PASCALINE_COORD` pointed at a scratch folder, so `.coord/log.md` stayed untouched; `.coord/` held nothing gc.sh archives): `.tasks/116-r68/` and `.tasks/118-r68f1/` → `.tasks/archive/2026-10-20/` (branch `p1/ron-m4-emark1` gone). Path audit: no stale path in CLAUDE.md or docs/README.md; no report older than 14 days. My first apply was cut short by a `| head` and overwrote the day's 05:33 report; I rebuilt `.tasks/gc-2026-10-20.md` with both runs.
- **`.tasks/` beyond gc.sh** (moved to `.tasks/archive/2026-10-20/tasks-old/`, because `archive/shifts/night-shift-check-2026-10-18.md` cites `.tasks/pass-*/reply.md` and `.tasks/night-2026-10-18.log`): `pass-1` … `pass-31`, `report-2026-10-18`, `report-2026-10-19`, `night-2026-10-18.log`, `log.md.bak-failed-night`, `gc-2026-10-18.md`, `gc-2026-10-19.md`. Deleted the empty `pass-99`. Kept the last night's `pass-32` … `pass-42`, `report-2026-10-20`, `night-2026-10-19.log`. `scripts/pipeline.sh` only writes these (`:98`, `:114`), never reads them.
- **`.coord/`**, each name checked with `git grep` over every tracked file:
  - moved to `.tasks/archive/2026-10-20/coord/` (cited): the 15 `tab1-*.png` (`archive/shifts/2026-10-11-m3-report.md:22`, "screenshots `.coord/tab1-*.png`"), `s8plus-home-mathprint.png` (same report, `:36`), `brainstorm/` (the round behind D1–D9, `spike/DECISIONS.md:4`);
  - deleted (no link anywhere): `pascaline-fp6-night.apk` (14.6 MB, 2026-10-12), `fp6-icon-app.png`, `s8plus-chrome101.png`, `s8plus-old-webview.png`, `s8plus-sum.png`, the Phase 0 run folders `home-runs/`, `plot-A-ce/`, `plot-B-own/`, `py-mpy/`, `pyo-core/`, `pyo-numpy/`, `pyo-numpy-sympy/` (raw logcat; the numbers are in `spike/RESULTS.md`);
  - kept: `log.md`, `locks/`, `devices/`, `device-runs.jsonl` (never touched), `tmpbuild/` (gc.sh uses it), and `r15c-prototype.patch`, which another session put back at 09:49 while I worked.
- **`tools/probes/_out/`** (main checkout): deleted `start-chunk/` (21.6 MB, 2026-10-16), an older run of the probe whose newest output (2026-10-18) is in the phase-1 worktree; it rebuilds with `node tools/probes/start-chunk.mjs`. Every other output is the only one of its probe and stays (`unit-freq/cache/` is the corpus `count.mjs` reads; `w-capinf.yaml` and `w-capInfinity.yaml` differ, so both stay). There is no `2026-10-19/` folder (the consolidation report says so too; G61 rebuilds those scripts).
- **Worktrees and branches:** two worktrees (main on `p1/sandra-padlayout`, `phase-1`); local branches `master`, `phase-1`, `p1/sandra-padlayout`. The only merged branch, `p1/sandra-padlayout`, is checked out in the main checkout, so `git branch -d` cannot delete it (c3). No NOT MERGED branch exists. Remote (listed, not touched): `origin/master` `ef857a6`, `origin/phase-1` `1ac97d4`, `origin/p1/sandra-padlayout` `b1de57e`.

### 2. Docs (tracked)
- **Shift reports to `docs/archive/shifts/`** (`git mv`; links to and from them fixed; none is linked from a live doc): `2026-10-18-night3-report`, `2026-10-19-night-report` (both followed by the 2026-10-20 night report), `2026-10-18-sandra-docsdiet-report` (S7 merged; its shared-file text is in `sandra.md:12` and `CLAUDE.md:40`), `2026-10-19-sandra-docs04diet-report` (S10; the r12 line is in docs/README), `2026-10-19-sandra-radspike-report` (S14; docs/04 2.12 exists, `:171`), `2026-10-20-sandra-files-report`, `-outside-report` (S6 and S8, decided on 2026-10-20: backlog owner item 2) and `-unitresult-report` (S11, now packages R60–R63). The three check reports were already in the archive.
- **Kept in `docs/shifts/`:** the 2026-10-20 night report (the brief links it as the latest state) and the themes report (its section 6 is open and R50e links it).
- **Mockups:** `palettes-r50.html` → `docs/archive/mockups/` (R50a picked; only archive files name it). The other seven stay: each is linked by an open package, a research note or a test (`top-cluster.html` by `app/test/topcluster.spec.ts:2`, until R15c2 replaces layout D).
- **`p3-units-plan.md` from `docs/` → [archive/p3-units-plan.md](../archive/p3-units-plan.md):** its own status line says P15 superseded it; links fixed in docs/README, docs/03 and the archive, the path in `tests/golden/g2.yaml:37` and `G2-CHECKLIST.md:37` (only that line; see c9 for the checklist's drift).
- **One place per fact.** On `phase-1`, CLAUDE.md already moved its architecture block to docs/README.md (the prompt's example was the main checkout's older CLAUDE.md). What repeated:
  - docs/README.md's component diagram was an older copy of docs/04 8.1 (it still drew a spreadsheet): replaced by a pointer; the key decisions stay (they are listed nowhere else).
  - brief section 2's shared-files rule repeated rules section 5 word for word: replaced by a pointer (that line is outside the bundle, which starts at "### Your report", `pipeline.sh:181`; every worker's agent file makes rules sections 3 and 5 binding).
  - CLAUDE.md, CONTRIBUTING.md and rules.md: proposed text in (c).
  - docs/04 and decisions.md share short fragments where a decision names its rule; that is their job, kept.
- **docs/README.md** lists every live doc exactly once (checked by a script against `git ls-files docs`): added r11, r17, bug-patterns, g2-correspondence, six mockups, the two live shift reports and this report; removed the two archived check reports from the research list; three double links made single; its budget line now points at the script instead of repeating numbers that had gone stale (it said brief ≤ 25 kB; the check says 28). Its CONTRIBUTING line said "keep it consistent with this file", copied from CLAUDE.md: now rules-core.md.
- **Stale facts** (each checked with `git grep` and the code; sentences that say "no Python" stay):
  - `README.md`: "about 600" golden cases → about 1,400 with the units file, pointing at `tests/golden/README.md` for the counts; the start chunk cap "150 kB (52 kB gzip)" → 175 kB (60 kB gzip, `app/scripts/size-check.ts:93`); "Milestone 5, Units (libqalculate)" → computed by Giac, data from libqalculate at build time (P15).
  - docs/02: its existing "Superseded where they differ" line now also names P11's removal of Python; the units row, the Python row, the libqalculate line ("Worker 3, loaded when the Units app first opens"), "the Units app" in the P8 note and the section 3 head now say what P11 and P15 decided. The rest of the original plan stays as the record it is.
  - docs/03 section 2 (a dated snapshot): the Python row gets "(removed by P11)", like the K2 row.
  - docs/05: the Python editor row and "Python" in U3 removed; "Units app" → the unit view.
  - "the Units app" → "the unit view" in `app/src/find/types.ts:52` (comment), `tests/tasks/tasks.yaml` (four `needs`/comment strings; `tasks-lib.ts:68` checks only that `needs` is present) and `tests/tasks/find-queries.yaml:131` (a note).
  - Not changed: `build.sh:11` and `engine/qalc/build-wasm.sh:6` still describe a Units app or a browser qalc worker; A21 takes libqalculate out of the build and rewrites both.
  - Checked and correct: every `npm run` script named in a live doc exists; every repo path a live doc names exists or is a file an open package or decision creates (`giacText.ts` G73, `find/factors.yaml` and `tools/find-index/refresh-factors.mjs` A21, `tools/line-baseline.yaml` A22, `tools/check-version.sh` A7); `.gitignore`'s `python/` lines still match files on disk (c1).

### 3. Code (tracked)
- **Found dead, removal held back:** the i18n keys `app.name` (never read outside the table: `git log -G'app\.name' -- app/src ':!app/src/i18n'` is empty) and `settings.taps.value` (last read before `d543b65`, R21b). Both have no literal use and match no dynamic prefix (`view.`, `tmpl.`, `${id}.title`, `error.${…}` …) anywhere in `app/`, `spec/`, `tests/`, `tools/`. The other 84 keys without a literal use are all read through such a prefix. I removed both and put them back: pipeline #120 (R15c1, started 09:49 while this ran) changes `app/src/i18n/en.ts` too, and its merge into this worktree would refuse a local change to that file. R15c1's branch keeps both keys unused, so the removal is (c) item 15.
- **No dead files:** every file in `app/src`, `app/test` and `app/scripts` is imported, an entry point (tests, scripts, `main.ts`) or named by config. **No dead exports:** 73 exports are used only inside their own file (for example `numeric.ts` `flatten`, `readParts`), so only the `export` keyword is surplus; I left them (no behaviour, and churn in files A22 counts). **No dead CSS:** the global stylesheets' classes and variables are all used; component styles are scoped and svelte-check (0 warnings) covers them. **Fixtures:** all 45 data files under `app/test`, `tests`, `app/scripts`, `tools` are named somewhere. The scans were one-off Node scripts in the session's scratchpad (no npx tool, no dependency).
- **npm dependencies:** all used. `@types/node` has no import by name but types the scripts' `node:` imports.
- **Workarounds whose cause is gone:** none removable today. libqalculate #1043/#1044 (`hp`, `mmHg`, `inHg` overrides in `find/units.yaml:114-130`) are fixed upstream in `92ecde7` but not in the pinned 5.13.1; the index build fails on its own once a pinned release has the fix. #1045 is open. MathLive #3122–3124 are open. Giac patches 0001 and 0002 are not yet reported upstream. S17 builds the full register with canaries.

## (c) What waits for the owner (one recommendation each)
1. **Delete `python/` in the main checkout** (156 MB: `python/_downloads/micropython-1.29.0.tar.xz`, an empty `_out/`), then the two `.gitignore` lines (`:68-70`) and the `Read(./python/**)` deny in `.claude/settings.json:33`. **Recommend: yes.** The Python app is gone (P11), the tarball can be downloaded again, and nothing reads it.
2. **The untracked copy of `multi-engine-risk.md` in the main checkout's `docs/research/`:** the tracked `docs/archive/multi-engine-risk.md` is the same text plus its status line (`diff`: one added line). **Recommend: delete it** (the consolidation report, item 16, said the same).
3. **`p1/sandra-padlayout`** is merged into phase-1 (`b1de57e`) and checked out in the main checkout. **Recommend:** switch the main checkout to `master` when convenient, then `git branch -d p1/sandra-padlayout` (and the remote branch only if you want it gone).
4. **CLAUDE.md, the Pipeline section** repeats rules section 4 and is stale ("until A10 is merged": A10 merged as `a178fd7` on 2026-10-18; `pipeline.sh:46` defaults `PASCALINE_QALC_DL_DIR`). **Recommend replacing its four bullets with:**
   > ## Pipeline
   > Every package runs through `scripts/pipeline.sh` (docs/shifts/rules.md section 4; the night queue is brief.md section 0c); never merge or start a worker another way. `.tasks/` (gitignored) holds bundles, logs and the counter; `.coord/log.md` gets one line per step.
   > Context hygiene: `.claude/settings.json` denies reads of build output, caches, lock files, screenshots and run logs. Read sections (`grep -n '^#'`), not whole files; the owner's untracked files are not yours.
5. **CLAUDE.md, Conventions:** its first three bullets repeat rules-core (the `MathEngine` rule, SPDX, regression tests first, golden sources, dependencies). **Recommend replacing them with:**
   > - Small, focused modules; engine code knows nothing about the UI. TypeScript strict, no `any`; user-facing strings go through the i18n table. Every other code rule is in docs/rules-core.md.
6. **CONTRIBUTING.md section 4** says "the units engine gets its own" interface, which P15 removed. **Recommend:**
   ```markdown
   - The UI never calls a maths engine directly. Everything goes through the async `MathEngine` interface, the unit view included. See [docs/04-architecture.md](docs/04-architecture.md), section 8.2.
   ```
7. **rules.md section 4, first paragraph:** drop "(`--no-worker` and `--audit-model auto` come with A10, P17; until A10 is merged, export `PASCALINE_QALC_DL_DIR=<main checkout>/engine/qalc/_downloads` in the shell that runs it)". **Recommend: yes** (A10 is merged; the script exports the default itself). **Rules section 5, Shared files:** add `docs/shifts/brief.md` to the list; then brief section 2's pointer can drop "this brief among them".
8. **`.claude/settings.json:20`** denies `Read(./.coord/home-runs/**)`, a folder that no longer exists. **Recommend: remove the line** (harmless as it is; listed because the file is a permission file).
9. **`tests/golden/G2-CHECKLIST.md` is out of step with `g2.yaml`:** `oracle.py --g2` rewrites items 8, 11 and 43 (both files last changed in `3e2326e`, so the checklist was edited by hand). I did not regenerate it (items 43 and 11 are S12's ground). **Recommend: run `oracle.py --g2` in the next docs commit** and take check 3 below. Also seen: `oracle.py` without flags prints 198 "duplicate id" problems, all in `corpus.yaml`, whose entries have no `id` field the check reads (to verify whether that is expected; the gate does not run it).
10. **Python questions in the G2 checklist:** items 26–28 (`g2.yaml:33-35`) ask about the Python app's graphics module and `calc`. **Recommend: mark them dropped by P11** in `g2.yaml` with the reason, keeping any recorded answer ("never lose an answer").
11. **logo/:** nothing names the `.afdesign` files, the monochrome SVG or the social card, and `logo/fdroid/pascaline_fdroid.png` and `pascaline_fdroid_banner.png` are byte-identical to `fastlane/metadata/android/en-US/images/icon.png` and `featureGraphic.png` (65 kB). **Recommend:** keep the `.afdesign` files (they are the editable source of the icons, which F-Droid's "source for everything" favours), delete the two PNG copies (fastlane is where F-Droid reads them), and add a five-line `logo/README.md` saying what each file is for and that `app/scripts/gen-icons.mjs` builds the app icons from `android_logo/*.svg`.
12. **spike/ (tracked):** everything is cited (`spike/bench-results/*.json` by `spike/RESULTS.md:47`). **tools/probes/:** every file has a README row or is named by a doc. **Recommend: nothing to remove.**
13. **Split proposals for the files over 800 lines** (no split applied; line counts today):
    - `app/src/engine/numeric.ts`, 1,312: (a) the text readers `closing`, `topLevelArgs`, `functionsIn`, `namesIn`, `splitList`, `hasTopLevelComma`, `comparisonAt` (`:155-257`, `:380-414`, `:1008-1024`) → `app/src/engine/giacText.ts`, **with G73** (P20's one reader); (b) the G38 decision code (`:996-1312`: `DECISION_FUNCTIONS` … `decideTwice`, ~315 lines) → `engine/decisions.ts`, **with G71**, which changes the decision functions anyway; (c) the complex workaround (`COMPLEX_DEFINITIONS` … `readsReplaced`, `:72-105`, `:273-375`) → `engine/complex.ts`, **with G60 after G75**, whose patch shrinks it. What stays (precision, shapes, facts) is ~650 lines.
    - `app/src/engine/host.ts`, 991: the readers `arrowBodyEnd`, `maskBound`, `matching`, `splitTop`, `indexedTarget`, `balanced` → `giacText.ts` **with G73**; the facts methods of `EngineHost` (`inherited`, `fnFacts`, `storeFacts`, `bodyFacts`, `readFacts`, `callFacts`, `:452-593`, plus `mergedFacts`, `storedFacts`) → `engine/facts.ts` as functions taking the host, **with G65/G66** (names from Giac's state), which rewrite that code. Leaves ~700.
    - `app/src/input/parse.ts`, 1,219: the tokenizer (`:10-196`) → `input/tokenize.ts`, the tables (`:197-280`) → `input/parseTables.ts`, and the calculus templates of `Parser` (`tryPartial` … `matrix`, `:1028-1210`) → `input/parseCalculus.ts`. As **one mechanical ron package (Opus audit: `app/src/input/`)** before R4a, with `parser.yaml`'s 588 round trips as the guard; no behaviour change.
    - `app/src/App.svelte`, 893: the key routing (`special`, `historyKey`, `sheetPress`, `settingsPress`, `press`, `run`, `:240-565`) → `app/src/keyboard/route.ts` (functions over a context object), **with R15c2**, which rewrites `special` for the R3 keys anyway. The style block (`:704-893`) stays scoped.
    - `app/scripts/golden.ts`, 860 (not in A22's list): one module per stage under `app/scripts/golden/` (interrupt, home, precision, cases, bench, calls, invariants, units, parser) with a shared `lib.ts`, **with A25**, which edits the gate's stages. A22 should count it in `tools/line-baseline.yaml` too.
14. **Step 4's checks** (at most three; none duplicates A22's ids, note status lines, notes sum or line baseline; each rides on a check that already runs):
    1. **docs-check: docs/README.md covers every live doc exactly once.** Every tracked file under `docs/` outside `archive/`, `shifts/packages/` and the dated `shifts/*-report.md` must appear in exactly one link in docs/README.md. About 15 lines in `tools/docs-check.mjs`. It would have caught today's 12 missing entries and 3 double links. **Recommend: yes.**
    2. **gc.sh: the clutter it misses, and two bugs.** Archive `.tasks/pass-*`, `.tasks/report-*` and `.tasks/night-*.log` older than 2 days, and `.coord/*.png` and `.coord/*.apk` older than 2 days, into `.tasks/archive/<date>/`; gzip `*.log` in archive folders older than 2 days (47 MB of the archive is e2e and check logs, text; (to verify) the saving); list the research notes whose status line says decided (rules section 10 says gc.sh lists them; it does not yet). Fix: the dry run still runs `rm -f "$d"/*.err` and `mkdir` outside `act` (`gc.sh:33`), and a second `--apply` on one day overwrites the first's report (append instead). **Recommend: yes, as one small annabell package.**
    3. **gate: generated docs in step.** `oracle.py --g2 --check` (a flag that compares instead of writing) runs in the gate's docs step when `tests/golden/g2.yaml` or `G2-CHECKLIST.md` changed, and fails on a difference (c9). **Recommend: yes, with c9's regeneration.**

15. **The two dead i18n keys** (b3): delete `"app.name"` and `"settings.taps.value"` from `app/src/i18n/en.ts` once R15c1 is merged. **Recommend: yes,** in the next ron package that touches `en.ts` or by hand; `npm run typecheck && npm test` cover it.
16. **R15c1's merge and this worktree:** pipeline #120's branch changes `docs/backlog.md`, which another session has edited (uncommitted) in this worktree, so `git merge` there would refuse. **Recommend:** commit or set aside the uncommitted docs before #120 reaches its merge step.

## (d) Kept on purpose
- **Research notes** (19, 308 kB): S18 gives each its status line and moves the decided ones; A22 sums and checks them. Not touched here, as the owner decided at the start.
- **`dist/pascaline.apk`** (13.9 MB, main checkout) and **`app/test/gallery/`** (8.3 MB): the last built APK and the last gallery; both regenerate, but they may be what is on the phone and what the owner last looked at. `build.sh` and `npm run gallery` overwrite them.
- **`.tasks/archive/`** (76 MB): the pipeline's history, which archived reports cite; check 2 shrinks it without deleting anything.
- **docs/01 and docs/02:** history with a status line each; only the lines that state today's architecture wrongly were corrected.
- **docs/03 section 2, docs/05:** dated plans; only the Python and Units-app slips were fixed.
- **The 73 export-only names:** no behaviour, and touching `numeric.ts`, `parse.ts` and `host.ts` now would collide with the splits in c13.
- **`build.sh:11`, `engine/qalc/build-wasm.sh:6`, `app/scripts/size-check.ts:100`** (the "qalc wasm + glue" budget, not built): A21 removes libqalculate from the build and these with it.
- **`.gitignore`'s `coverage/` and `.nyc_output/`:** no coverage tool is installed, but the lines cost nothing and match what `vitest --coverage` would write.

## Files
- **Changed:** `README.md`, `docs/README.md`, `docs/02-architecture-plan.md`, `docs/03-feature-analysis.md`, `docs/05-ui-plan.md`, `docs/shifts/brief.md`, `app/src/find/types.ts`, `tests/golden/g2.yaml`, `tests/golden/G2-CHECKLIST.md`, `tests/tasks/tasks.yaml`, `tests/tasks/find-queries.yaml`; link fixes in `docs/archive/backlog-2026-10.md`, `cleanup-audit-2026-10-12.md`, `decisions-2026-10.md`, `multi-engine-risk.md`, `shifts/2026-10-12-sandra-architecture-brief.md`, `shifts/2026-10-12-sandra-architecture-report.md`, `shifts/night-shift-check-2026-10-18.md`.
- **Moved (`git mv`):** 8 shift reports `docs/shifts/` → `docs/archive/shifts/` (listed in b2), `docs/mockups/palettes-r50.html` → `docs/archive/mockups/`, `p3-units-plan.md` from `docs/` → `docs/archive/`.
- **New:** this report.
- **Deleted (tracked):** none.
