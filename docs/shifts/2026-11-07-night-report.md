<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Night report 2026-11-07, the night of 2026-11-06 (18:35 to 11:13)

Pipeline runs 688 to 719 (22 package runs), Opus passes 84 to 91 (8), device runs 84 to 91 (8). Both lanes ran on the Tab One, `night.sh --lane A` and `--lane B`, `--until 09:00` (started 18:35 on the 6th). **15 runs merged** (9 in lane A, 6 in lane B); 5 runs ended NOT MERGED (R140, G183, R143, R145 and R147 after two fix rounds; G188 on a step timeout) and four of them merged later as their follow-ups. Lane A called `report` at 09:43 and waited for lane B; lane B closed at 11:12 (`SHIFT DONE`, 13 steps) because pass 91 and its device run ran past 09:00. Nothing was pushed.

**Core list:** desktop CORE 66/66 (known 0, needs 0) at edc62383 (pass 91). The device: **CORE DEVICE 65/65 (known 0, new none) at b8ea3bd7 (device 91, 11:12)**. Devices 84 and 85 gave 64/65 with c45 new (Solve's second root under the entry line at 1192 x 672, backlog F186); devices 86 to 91 gave 65/65 with no change to that code in between, so the cause is not established and F186 stays in R148's criteria. Gates at pass 91 (edc62383, all exit 0): typecheck 0 errors; `FIND_INDEX=required npm test` 3782 passed with 1 expected fail (219 files); e2e 1687 passed, 20 skipped; GOLDEN GATE PASSED (precision 1070/1070, invariants 49.6 s, 0 new). Start chunk 60.91 of 61.00 kB gzip.

## Merged into phase-1
Lane A (ron):
- R146 483d6efb (the six keys: Shift + Undo/Copy moves, hwkeys' Redo, TalkBack names, core c49/c50). One fix round (vitest).
- R144 aba099ab (the screen flag runs from Keypad to sheetPress; a tap on an open sheet queues, a drag or held backspace stops after a press that closes a sheet). One fix round (size).
- R140f1 e334e801 (carries R140: palettes, the colour-vision test, Shift and Alpha fill and lock rules). R140 itself ended NOT MERGED after two fix rounds (e2e; docs; the audit on criterion 1a).
- R150 191bf544 (families N62, Teal, Solarized; a stored graphite, gruvbox or nord look shows as N62; Gruvbox and Nord credits dropped). One fix round (the audit on the Teal dark block).
- R141 e8d1608b (the round pad is a true circle from its own width; High contrast leaves the four zones without an outline).
- R142 e45eb0dd (italic letters come from the key's action; Plain keys only removes colour). One fix round (e2e). Start chunk 60.98 kB.
- R143f1 0b8710ec (carries R143: the ▾ mark from each key's action; six developer-only error texts in `keyboard.ts` shortened to stay under the pin). R143 itself ended NOT MERGED after two fix rounds (e2e; size; docs).
- R145f1 f7ea650b (carries R145: the ⚙ in a menu title opens Settings; GEAR and the sheet-only texts moved out of the start chunk, 60.91 kB). R145 ended NOT MERGED after two fix rounds (vitest; e2e; size).
- R147 0fb5bab0 (a first tap on a history row picks it; review-only merge of the branch kept at 2850bbed).

Lane B (gorge, annabell):
- A81 141e2e11 (three GitHub issue forms; the CONTRIBUTING and README links). One fix round (e2e).
- G176f1 ab983063 (patch 0035 leaves an undecided limit as `limit(e,x=a[,side])`, so the LaTeX shows the point and side). One fix round (golden). Engine key 82677f03026417f0.
- G183f1 4308f3dc (carries G183: a Safari, V8 and Firefox stack overflow all count as a crash; the dead worker is dropped). Two fix rounds. G183 itself ended NOT MERGED after two fix rounds (vitest; size; the audit on Safari's message).
- G184 9b4e4c73 (Giac's interrupt text becomes error timeout with the time-limit message; golden rows `harmonic(10^5)` and `harmonic(10^6)`).
- G185 624e5b8b (step 1 only: the probe `tools/probes/home-slowest.ts`).
- G185f1 bded076b (steps 2 and 3: Home and unit calls stop at 4 s and the worker restarts on Cancel's path). One fix round (size; the start chunk was at 60,999 of 61,000 B).

Doc commits on phase-1 (not pushed): 369663eb (pass 84), 7e2ddda2 (85), cf5f0cd5 (86), c8f9ea81 (87), 29a66946 (88), edc62383 (89), b8ea3bd7 (91). Pass 90 committed nothing.

## Unmerged
- **G181 `p1/gorge-atanhtiny`, kept at a0ae7feb.** Golden failed in rounds 1 and 2 on timing under load (`factorial(10^6)` 2226 of 2000 ms, invariants 78.7 of 60 s, plus the known chisquare_icdf mark). Pass 91: ok; on its own engine at load 1 the gate passed (precision 1087/1087, invariants 50.3 s). Next: a review-only merge.
- **G188 `p1/gorge-viewcrash`, kept at 79f4463d.** Audit FIX twice (patch 0036 missing from the patches README; stock Giac trapped by the new `g188-int-*` lines), both fixed. Then the pipeline run ended with no RESULT line (rc=124, the step's time limit, during round 2's golden). Typecheck, vitest, e2e and size were ok. Pass 91: ok; its patch is renamed 0037 because G181 holds 0036. Next: a review-only merge after G181.
- **R147f1 (FIX from pass 89, never ran).** After R147 merged, a click on a history input moves the focus to the `.in` button (no `onpointerdown` preventDefault, `History.svelte` 211), so a hardware 5, Escape and Enter misbehave. Pass 90 issued it again; the night closed first. Branch `p1/ron-tappickfocus`, agent ron.
- **G185f2 (FIX from pass 91, not started).** The Home watchdog counts from engine-ready, so a Home Enter that waits behind another job (a 9 s library import) is stopped wrongly and kills that job. Branch `p1/gorge-homewatchf2`, agent gorge, Opus.
- Not started in lane A: R53, R148 (now also F186), R149, then the engine rows from G178.

## What went wrong
- **Fix rounds:** a lot of them; five first attempts hit the limit. Causes were mostly size pin, docs budgets and e2e (R140, R143, R145, G183), not logic. R140 failed three different checks in three rounds.
- **Size pin:** the start chunk touched 60,999 of 61,000 B (G185f1) and went over in R145 (61.18 kB) before R145f1 moved GEAR and the lazy-only texts out (60.91 kB).
- **Docs budgets:** `decisions.md` is at 40.0 of 40 kB after pass 89; workers could not write their entries (R142's Plain-keys rule went to docs/05 instead), and pass 85 shortened the declutter and S4 entries to fit.
- **Flakes:** the unitresult Wh-tap test has been seen three times (pass 67, runs 577 and 713) and cost R147 its first merge. Pass 87's e2e had four reds caused by the dev server reloading while a doc was edited; the rerun on a stable tree was green.
- **Lane B was slow:** G188 alone took 08:42 to 10:30 (build, three audits, two golden runs); lane B did 13 steps. Merge-queue waits of 10 to 22 minutes were normal (longest 1124 s, R144).
- **Pass numbers collided:** lane A took pass 90 at 09:13; lane B's pass was renumbered to 91. Pass 91's reply is logged three times in a row. Lane A's pass 90 repeated pass 89's verdicts, because pass 89's FIX never ran.
- **Lane A's report waited** for lane B (09:43 to 11:13), then for the integ lock held by `claude-r152`.
- **Not looked at:** none of the three UI workers (R140, R150, R142) opened their gallery screenshots, so the looks at N62, Teal and Solarized in Dark, Light, High contrast and Plain keys are open (A82).

## Opus passes (NOTES)
- 84 (A81, G176f1, G183): A81 ok, G176f1 ok, G183 fix (G183f1: Safari's message). CORE 66/66 at aba099ab; device 64/65 (c45 new). Docs 369663eb; Giac draws the limit's subscript as `x=1^-` rather than `x\to 1^-` (cosmetic, for the owner's look).
- 85 (R140, R146, R144): R140 fix (R140f1), R146 ok, R144 ok. CORE 66/66. Docs 7e2ddda2; R140's High contrast floors went to the owner (below); keys beside a pick sheet stay dimmed and Shift + Help reads "Settings" (defaults).
- 86 (G183f1, G184, G185): G183f1 ok (start chunk 60.87 kB, so no pin raise), G184 ok, G185 fix (G185f1; limit 4000 ms). CORE 66/66 at 624e5b8b; device 65/65. Docs cf5f0cd5; F186 new (c45 on the Tab One).
- 87 (R140f1, R150, R141, R142): all ok. CORE 66/66 at e45eb0dd. Docs c8f9ea81; Teal's screen Shift #5c3a00 and Alpha #04282a decided.
- 88 (R143, R145, R147): R143 fix (R143f1), R145 fix (R145f1), R147 ok (review-only merge). CORE 66/66 at bded076b. Docs 29a66946; R143's up-to-1 px smaller Math and Help legends at 360 px go to the milestone review after R24d.
- 89 (R143f1, R145f1, R147): R143f1 ok, R145f1 ok, R147 fix (R147f1). CORE 66/66 at 0fb5bab0. Docs edc62383; stale probe ids in `tools/probes/results-keys.mjs` added to R53's docs list.
- 90 (same three): same verdicts, repeated; docs-check ok, typecheck 0. No commit.
- 91 (G185f1, G181, G188): G185f1 fix (G185f2), G181 ok, G188 ok. CORE 66/66 at edc62383; device 65/65 at b8ea3bd7. Docs b8ea3bd7; G185f1's 4 s limit stays (Home stops `sum(cos(K)/K,K,1,2000)` on the Tab One); G188's sweep runs as part slices plus join, 45 s per call; F187 and F188 new.

## What the owner must do
1. **Decide** (decisions.md "Needs the user"):
   - R140's High contrast floors: Shift and Alpha 0.10 apart and ⚠ 0.06 from Shift there (0.12 and 0.08 elsewhere); recommendation: keep them. At 7:1 N62 Light's Alpha is #265c5a and Shift reaches 0.12 from it only as the brown #5d2800.
   - **The minimum WebView.** R141 sizes the round pad with container units (Chrome 105+); decisions.md names Chrome 95 and `color-mix` already needs 111. On a WebView from 95 to 104 the pad is not drawn, though its zones work. Recommendation: restate the floor as Chrome 111 (the `color-mix` line already sets it in practice). This item is not yet in decisions.md.
   - G164's 16 sources by the freeze on 11-12 and R59's Math-key Find (both earlier, still open).
2. **Look at the gallery** (A82): N62, Teal and Solarized in Dark, Light, High contrast and Plain keys; also R141's round pad, R142's italic letters, R143's ▾ mark and R145's ⚙. R143's 1 px legend shrink at 360 px joins the milestone review after R24d.
3. **After the push:** look at A81's three issue forms on GitHub (backlog "Needs the user", item 6).
4. **Morning check** on the Tab One ([MORNING.md](../../tests/core/MORNING.md)): the device list was 65/65 on b8ea3bd7; check c45 (Solve's second root) by eye at 1192 x 672 and put the normal APK back if the lane left a measure build.
5. **Push phase-1** when content: this night's 15 merges and 7 doc commits sit on top of earlier unpushed work.
6. **Watch:** the unitresult Wh-tap flake; F186 (c45, red on devices 84 and 85 only); F187 and F188 (Area, G188's finds) have no package.

## Queue left for the next night
- **First, lane A: FIX R147f1** (ron, Sonnet, `p1/ron-tappickfocus`). **Lane B: FIX G185f2** (gorge, Opus, `p1/gorge-homewatchf2`). Prompts are in the log under passes 89 and 91.
- Lane A, then: 536 R53 and 537 R148 (carries F186; its After R147 is met), 538 R149, 539 R152 (a day session `claude-r152` was working on it at 11:13; check before queueing), then the engine rows 495 to 508 from G178.
- Lane B: G181 as a review-only merge (`scripts/pipeline.sh gorge "G181" --no-worker --audit-model auto`), then G188 the same way (patch 0037), then 510 G182, then 485 A64, 486 A67, 487 A65, 488 A66, 490 A73f1, 525 A75.
- No package yet: F187, F188, and the unexplained c45 red.
