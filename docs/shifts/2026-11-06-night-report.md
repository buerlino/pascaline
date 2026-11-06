<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Night report 2026-11-06, the night of 2026-11-05 (10:30 to 07:37)

Pipeline runs 616 to 673 (34 package runs), Opus passes 71 to 83 (13), device runs 71 to 83 (13). Both lanes ran on the Tab One, `night.sh --lane A` and `--lane B`, `--until 05:30` (started 10:30 on the 5th, a day-time start). **30 runs merged** (18 in lane A, 12 in lane B); 4 runs ended NOT MERGED after two fix rounds (R59, R135, A69, A71) and each merged later as its follow-up in the same lane. Lane B closed at 07:37 (`SHIFT DONE`, 20 steps); lane A called `report` at 07:22 and waited for it. Nothing was pushed.

**Core list:** desktop CORE 66/66 (known 0, needs 0) at de93f690 (pass 82 and 83). The device: **CORE DEVICE 65/65 (known 0, new none) at 76cf4fdb (device 83, 07:37)**; all 13 device runs of the night were 65/65. Gates at pass 83 (de93f690, all exit 0): typecheck 0 errors; `FIND_INDEX=required npm test` 3757 passed with 1 expected fail (209 files); e2e 1614 passed with 1 skipped; GOLDEN GATE PASSED (precision 1070/1070 active, 6 pending; invariants 867 inputs, 0 new). Golden ran only where engine or parser code changed (passes 71, 73, 76, 79, 83).

## Merged into phase-1
Lane A (ron, sandra):
- R132 4853c695 (Find builds only the hits in view; a longer query searches the last query's candidates; 6x-throttled p95 24.9 → 11.2 ms). One fix round (the halving bar).
- R133 c9be0a7c (History draws 5 rows while the engine starts, then 20). One fix round (size; the start chunk is at the 61.00 kB pin).
- R59f1 c692e25e (carries R59: a user library of definitions, loaded late; a file over 256 kB is refused in the worker's words; notice texts go through `dataText`; the header rule lives in `libraryHeader.ts`). Start chunk 60,991 B of 61,000 B. One fix round (vitest).
- R134 d3b4d339 (`entryText` moved to `clipboard/plaintext.ts`; copy as plain text covers the Symbols palette, constant chips and unit slots; `\sin`, relations and templates still come out as LaTeX, F180). One fix round (size).
- R135f1 db9efa9b (carries R135: a result over 6000 characters, or one MathLive refuses, shows "Too long to draw: Copy holds it"; Format and a b/c keys take the row at the press, before any await).
- R126 6657de93 (part 2 of `views/aiFormat.md`: the backup envelope, userKeys, unitPadCells and presets). Two fix rounds (e2e; the audit on the userKeys text).
- R135f2 6ce82ab8 (a too-long result with no chip inserts nothing and shows "Too long to insert: Copy holds it").
- S25 e19bd529 (study r19 only; tasks t01 and t03 are active, replayed green 14/14 and 13/13). One fix round (t01's budget).
- R129 f365df82 (results-mode mockup page from r19 and S25's numbers). One fix round (the missing report).
- S26 6cfbf401, S27 8304d442, S34 28250586, S28 8fc4a1db, S29 99374a89, S30 82b261f9, S31 6550cc93, S32 0caca8aa: the declutter. Archive 1.33 MB → 620 kB, research notes 86.1 of 150 kB, docs/04 69,995 → 64,128 B, docs/01–03 29,818 B, 33 tool files deleted, `spike/` gone; every cut file has a path-and-commit pointer (52 pointers checked). S34 one fix round, S28 two, S29 one, S31 one.
- R136 728798ec (dead hooks deleted: plotBench, solveBench, the renderer and sampling query reads, `parse-exports.test`). Start chunk 60.98 kB. One fix round.

Lane B (gorge, annabell):
- G165 b1c9d738 (patch 0031: `asin(sin(a))` decides n at raised Digits; a tie no precision decides stays unevaluated). One fix round. Engine key 6282932602783ad8.
- G166 e94e181f (patch 0032: `atan(tan(a))` the same way; the past-the-cap check stops at P and P+20). Two fix rounds. Engine key a1f121f8ed6e2b45.
- G164 84efc815 (`app/public/samples/materials.txt`: 16 material values, each "to verify: owner"; density is the weight density, 24 kN/m³). Two fix rounds (a value that did not follow its source; a test that passed for the wrong reason).
- G167 031226ba (the sweep runs in parts, `--part i/n`, and the shrink reads the saved parts: the weekly fuzz in 10-minute slices). One fix round.
- A69f1 95a8abcb (carries A69: the night stops when free disk is under `NIGHT_MIN_FREE_GB`, default 5; a merge removes the run's Claude scratch folder; gc removes the scratch folders of gone worktrees).
- A71f1 0c6f4ea4 (carries A71: a stock engine build with no patches for the golden stage; its key covers `engine/giac/wasm`). One fix round. Engine key 04ddcb0486d3ee27.
- A74 b73b5f7d (measurement only: Find per key on the Tab One p95 14.1 ms against E3's 16 ms; first opening of Find 244 ms against E5's 300 ms).
- A71f2 575a0807 (red-first in stock mode also runs a new vitest file that imports `nodeGiac`).
- G175 8035b436 (patch 0033: the power of a complex number picks k from im(a) at raised Digits). Engine key 065a8bc7d16c1e16.
- G177 1c864ca5 (patch 0034: the sign of the half-angle root is checked at Digits+20; `sin(asin(i/10^10)/2)` no longer shows the wrong sign with an exact mark). Engine key e138e03de4ea49f4.
- G171 cf0030c7 (the non-square check runs for an input that runs once; a refused CAS store keeps the name's earlier value; default engine calls stay at 87). One fix round.
- G176 f63f5b25 (patch 0035: `limit(trunc(cos(x)),x,0)` = 0, was 1; the two-sided case says the sides differ). Two fix rounds (docs check; the patch README). Engine key 9695a2956648cdb9. **Pass 83 found a defect and its fix has not run, see below.**

Doc commits on phase-1 (not pushed): a0e9cdf4 (pass 71), 7fd23646 (72), b24a7d21 (73), cd8e5ab1 (74), cfa0aca6 (75), 4d80167f (76), d99189e5 (77), 1c9ebc57 (78), fcbf8a06 (79), d392c0dd (80), c5643c22 (81), de93f690 (82), 76cf4fdb (83).

## Unmerged
- **G176f1 (FIX from pass 83, not started).** Patch 0035 builds the unevaluated limit as `limit(e0,x,lim_point,direction)`; Giac's LaTeX printer reads only `limit(e,x=a[,dir])`, so CAS `limit(trunc(a*x),x,1,-1)` and `limit(trunc(x),x,y,1)` are drawn as a bare `lim`, and `limit(trunc(sin(1/x)/2),x,0)` as `lim` with no point. The values are right; the drawing is not. The night ended before it ran. Agent gorge, Opus, branch `p1/gorge-limtrunc-tex`; its prompt is in the log under pass 83.
- The four first attempts, kept as history: R59 (run 620, `p1/ron-m4-library`, kept at 394ca7d9: the 256 kB limit was checked after `upToDate` migrated a cut file) → R59f1. R135 (run 630, `p1/ron-longresult`, kept at 7714df8b: size twice, then e2e; `decisions.md` over its budget; the lazy Format keys acted late) → R135f1. A69 (run 628, `p1/annabell-diskguard`, kept at 2386531a: `pipeline.sh` one line over its baseline) → A69f1. A71 (run 631, `p1/annabell-redstock`, kept at f051f1e6: the stock key left out `wasm/`) → A71f1.

## What went wrong
- **Fix rounds:** 32 across the night; four runs hit the limit (above). Most were docs and size checks (R133, R134, S34, G176), not logic. The audit sent back wrong or unsourced expected values in G164 twice.
- **Size pin:** the start chunk is at 60.93 to 61.00 kB against the 61.00 kB pin from R133 on; R59 measured 0.01 kB over and was cut by R59f1. The next UI package that grows it must split something out first.
- **Docs budgets:** `decisions.md` 39,993 of 40,000 B and `backlog.md` 19,964 of 20,000 B at the end. Workers could not write their entries (R126, R129, G171, S26 said so); passes moved built entries to the archive each time. The next pass that adds to either must cut first.
- **Merge-queue waits** of 10 to 24 minutes were normal (longest 1451 s, pass 77); a run waited for host-cpu behind an engine build or a gate several times.
- **Golden flake:** pass 76's first golden run ended `GOLDEN GATE FAILED: interrupt` right after e2e; the rerun was green (interrupt 32 of 32). Unexplained; watch it.
- **Pass numbers collided** four times (henri asked for 74, 75, 77 and 81 after the other lane had taken them); the pipeline renumbered to 75, 76/77, 79 and 83. Pass 81's reply is logged four times in a row.
- **A pipeline blind spot found by A71:** red-first in stock mode kept only vitest files naming `GIAC_OUT`; A71f2 fixed it. `pipeline.test.sh` was red on phase-1 from the A72/A73 package headings until A69f1 merged, so any annabell package failed its shell check in between (A69 and A71 both did).
- **Not measured:** the desktop gain of R133 (the runs are bimodal); the Tab One reading decides. A74 left the measure build, not the normal APK, on the Tab One.

## Opus passes (NOTES)
- 71 (G165, G166, G164): all ok. CORE 66/66 at 84efc815, device 65/65. Docs a0e9cdf4. Owner: check G164's 16 sources by the freeze on 11-12.
- 72 (R132, R59, R133): R132 ok, R133 ok, R59 fix (R59f1). CORE 66/66 at c9be0a7c. Docs 7fd23646; E3's 32 → x ms for v0.1.0 waits for A74's Tab One reading.
- 73 (R59f1, R134, R135): R59f1 ok, R134 ok, R135 fix (R135f1). CORE 66/66 at d3b4d339. Docs b24a7d21; R59's question to the owner is filed.
- 74 (G167, A69, A71): G167 ok (its real-run test goes red once the engine fixes both of seed 1793847163's failures), A69 fix (A69f1), A71 fix (A71f1). CORE 66/66 at b24a7d21. Docs cd8e5ab1.
- 75 (R135f1, R126): both ok; FIX R135f2. CORE 66/66 at 6657de93. Docs cfa0aca6; S25 moved to lane A.
- 76 (A69f1, A71f1, A74): A69f1 ok, A74 ok, A71f1 fix (A71f2). CORE 66/66 at e19bd529; the interrupt-stage flake above. Docs 4d80167f.
- 77 (R135f2, S25): both ok. CORE 66/66 at 4d80167f. Docs d99189e5; R129 moved from the day table into lane A. Owner: after a result too long for a chip, Ans refuses with "Ans: no result to use in this view yet" (`parse.ts` 572), the wrong reason, no wrong number; the backlog had no room for a line.
- 78 (R129, S26, S27): all ok. CORE 66/66 at 8304d442. Docs 1c9ebc57; S27's rule (a path in a code span is written relative to docs/) is in rules section 10. Two comment headers in `tests/golden/units.yaml` (lines 202 and 225) still name a deleted note; no fix needed.
- 79 (A71f2, G175, G177): all ok. CORE 66/66 at 8fc4a1db. Docs fcbf8a06; F181 new (Home `simplify(sqrt(acosh(-1/2)^2))` has the wrong root sign, no package); F138 open again (a state leak between golden cases, it reproduces only on the golden stage's shared engine). The golden regress stage's own text lists patches only up to 0031 (stale, no effect).
- 80 (S34, S28, S29): all ok. CORE 66/66 at 99374a89. Docs d392c0dd; docs/04 stays at about 64 kB under its 70 kB cap; new backlog line: `tools/test-release-guard.sh` runs in no selftest or gate.
- 81 (S30, S31, S32): all ok. CORE 66/66 at 0caca8aa. Docs c5643c22; docs/04 item 14 added; one backlog line for docs/05's five UI tasks.
- 82 (R136): ok. CORE 66/66 at f63f5b25. Docs de93f690; R137 is ready to run; parse.ts still re-exports `GREEK` and `LETTER_NAMES`: decided as a default, the next package that edits parse.ts drops them.
- 83 (G171, G176): G171 ok, G176 fix (G176f1). CORE 66/66 at de93f690. Docs 76cf4fdb; F183 new (`p(A)^2` for a program with a local shows a warning instead of being refused; fix: a `pure(name)` in Bodies); the precision count in `tests/golden/README.md` corrected to 1076 cases, 6 pending. G176's report gave no Giac calls per Enter; its TypeScript change adds none.

## What the owner must do
1. **Decide** (decisions.md and backlog.md "Needs the user"):
   - the Math key's Find: should it list the user's own functions (R59; recommendation: yes, as a later small package);
   - the results pick of S25/R129 (keys, results mode, room), and agree t01's budget of 14 and t03's of 13;
   - R135's 6000-character cut stays unless you want long results like the 16 kB `sum(1.0001^k,k,1,2000)` drawn (it shows the note while Copy holds the text);
2. **Check by the freeze on 11-12:** the 16 sources in `app/public/samples/materials.txt` (G164; recommendation: keep copper on its data sheet). It ships in the next APK.
3. **Morning check** on the Tab One ([MORNING.md](../../tests/core/MORNING.md), about 10 minutes): the device core list was 65/65 on 76cf4fdb. Put the normal APK back (A74 left the measure build), and look at R133's History start, R135's two notes and R134's plain-text copy. The looks of R135's notes join the R24d milestone review, with R59's Tab One checks.
4. **Not measured:** E5's 100 ms bar for a warm open of Find; R133's desktop gain (the Tab One rerun decides).
5. **Push phase-1** when content: this night's 30 merges and 13 doc commits are local on top of earlier unpushed work.
6. **Watch:** the golden `interrupt` stage (one unexplained red in pass 76); F138 (a golden state leak) and F181 and F183 have no package; Ans after a too-long result (pass 77) has no backlog line.

## Queue left for the next night
- **First: FIX G176f1** (gorge, Opus, `p1/gorge-limtrunc-tex`), then an Opus pass for it.
- Lane A: 523 R137 (ron, Sonnet), ready to run.
- Lane B: 511 G188, 485 A64, 486 A67, 487 A65, 488 A66, 490 A73f1 (after R133, which has merged), 524 G189, 525 A75.
- The gorge engine rows 495 to 510 (G178, G168, G183, G184, G185, G169, G172, G173, G179, G180, G186, G187, G170, G174, G181, G182) did not start; G185 waits for G183, G181 for G166 (merged), G182 for G181.
- No package yet: F138, F181, F183, and the Ans refusal after a too-long result.
