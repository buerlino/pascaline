# Night report 2026-11-02, the night of 2026-11-01 (20:09 to 05:50)

Pipeline runs 475 to 500 (17 package runs), Opus passes 44 to 49. Both lanes ran on the Tab One, `night.sh --lane A` and `--lane B`, `--until 05:30`. Lane B ended at 05:17 (henri answered `SHIFT DONE`, no queue left to run); lane A closed at 05:40 with pass 49, then this report. 14 runs merged (7 per lane); 2 runs ended NOT MERGED (G153 and R110), both merged later by a FIX run in the same night; 1 (R36) is still open. Nothing was pushed.

**Core list:** desktop CORE 66/66 (known 0, needs 0) at 8cefbcf (pass 49). The device: **CORE DEVICE 65/65 (new none) at 5fd9440 (device 44, 23:21)**, so R15c4f1's fix for the first-start tips holds. **Devices 45 to 49 were DEVICE SKIPPED (screen locked)**, so nothing was run on a device after 23:21. Gates at the last pass (code as at 50e2d91): typecheck 0 errors, probe imports 0 failing; `FIND_INDEX=required npm test` 178 files, 3153 passed with 1 expected fail; e2e 1453 passed with 1 skipped; GOLDEN GATE PASSED (parser 643/643; precision 869/869 at pass 46). Start chunk 58.56 kB pinned by R33 (R103 made the room: 60.99 to 58.44 kB).

## Merged into phase-1
Lane A (ron):
- R15c4f1 d8b88e4 (the device core spec waits for the first-start tips and taps "Got it" after a cold start; no app change). Device 44 confirmed it.
- R63f2 d075b9c (Share session writes a unit-view row as its request with units and the arrow, then the value with ± σ and its unit; plain Copy unchanged). Backlog F162 (a rare prefixed pair such as Mm exports as `\classpas-rareMm`; cosmetic).
- R103 0a23447 (`kvGet` loads `state/migrations.ts` only when a migration step is due; Home's defaults moved to `engine/homeDefaults.ts`). Two fix rounds (docs size; an audit FIX because the first fix touched `tools/docs-check.mjs` outside its scope). Start chunk 58.39 kB.
- R89 e617573 (presets in Mode: row 5 shows the active preset, Mode › Presets lists them, Settings moves to row 6). Two fix rounds (a tap elsewhere ends name typing; the size check). Pin 58.49 kB.
- R111 b7f95bb (the second tab's note is visible text, no title attribute; fits at 360 px).
- R110f1 6a1717a (carries R110, the Shift + 9 `%` row: a test asserting `data-unit` is exactly kPa and the σ with an anchored match; corrected docs/06 entry). R110 run 490 was NOT MERGED after two fix rounds (audit FIX each round: the short-row rule applied to every grid sheet; a wrong keyboard.yaml comment; a σ assertion that could pass on a wrong result).
- R33 50e2d91 (a stored one-letter name is coloured in the entry line; only the rendered letter, so `getValue`, the cursor and backspace are unchanged). Pin 58.56 kB.

Lane B (gorge):
- G154f1 567b869 (carries G154: a golden invariants miss with 0 new and 0 now passing counts as timing, so the pipeline reruns golden once; a value MPFR reads as 0 at every precision is refused Underflow only when Giac can state its size; F139 became F161).
- G155 117c106 (`sem(list)` is our `passem`; a list of fewer than two values is refused; exports write `sem(` back). One audit FIX and one vitest round.
- G153f1 bce2c1b (carries G153: patch 0027, the cbrt/atanh double-fallback guards, `panel.ts` keeps its elements when it redraws the same result; the pipeline's `stepsItems` reads the golden steps line with its "N pending" count, and a precision miss counts as timing only for a g58-factorial case over its time budget). Shared engine key 19d3690a62c8427b. Run 480 G153 was NOT MERGED after two fix rounds (e2e round 0, golden rounds 1 and 2; all host load, see below).
- G144 b6ca396 (the gate's sweep fails on a crash through one function `sweepFailures`; `scripts/probe-imports.ts` runs inside `npm run typecheck`; the broken `bridge.ts` probe is gone).
- G146 f822e15 (`decideTwice` and `decidedAtDouble` table tests from oracle values; `tieRisk` removed; `ENGINE=required` makes a run without an engine fail).
- G145 342691e (one home for `isError`, `isTimeout`, `RATIONAL`, `groupEnd` and the reserved names; docs-check also checks docs paths named in source comments). Shared engine key b1692285d6b7b882.
- G147 a4ca681 (a rules check for imports in both directions; the engine README names all 48 modules; start chunk 8 B smaller).

Doc commits on phase-1 (not pushed): 5fd9440 (pass 44), 15b3bd0 (45), 14d1916 (46), 61e12e3 (47), 8cefbcf (48), 6f54957 (49).

## Unmerged
- **R36** (run 500, `p1/ron-m4a-why` at 5f7ead8): a picked row says why it has its mark. Round 0 failed vitest; the audit sent it back twice: round 1, the reason for a stored name is guessed from the entry text and the storing row's ≈ mark, so it can name an exact value as rounded (Home 1/3 stored to B, then B+1 should say "rounded: the exact value is 4/3"); round 2, `uncText` cuts the uncertainty to two digits. Pass 49 confirmed both. FIX R36f1 (gorge, Opus, same branch) is written and did not run: take the names from the engine's facts (a new `PrecisionWhy` field), delete the name regex and store detection, show the chip table's digits, and set the start pin to the measured size plus 0.05 kB. The worker raised the pin from 58.56 to 58.62 kB; that follows docs/04 8.3, so no decision is needed.

## What went wrong
- **Load between the lanes** cost G153 its merge and G155, R89 and R103 a round: golden timing (invariants 68.4 s against 60, `g58-factorial-1e6-30` at 2119 ms against 2000) and a lost chip tap. The cause was in `app/scripts/pipeline-logs.ts`: `stepsItems` wanted the stage line to end in "N known", but since G137f1 it ends in "N pending", so A51's load rule had not matched since 10-31. G153f1 fixed both gaps and G154f1 the invariants one.
- **R110 and R36 each used all their fix rounds** on audit FIXes, not on test failures; R110 was then merged as R110f1, R36 waits for R36f1.
- **G153 started although G141 (the step it waits for) is not merged**; its worker left row 1 pending and G141's step 1 now names it.
- **The Tab One screen was locked from 01:07**: devices 45 to 49 were skipped. Device 44 (23:21) was the last run.
- Pass numbers: henri asked for 43 and 48 twice; the pipeline renumbered them to 45 and 49. Merge-queue waits: R15c4f1 1174 s, R103 753 s, R89 647 s and 667 s, G155 583 s.

## Opus passes (NOTES)
- 44 (R15c4f1, R63f2, R103): all ok. CORE 66/66 at 0a23447. docs/04 and decisions.md are at their size limit (69,991 of 70,000 bytes and 40.0 of 40 kB): the next passes archive before adding. Docs 5fd9440.
- 45 (G154f1, G155, G153): G154f1 and G155 ok; G153 fix (FIX G153f1, the code is right, the pipeline missed that the failures were load). CORE 66/66 at 5fd9440; golden on G153's branch on a quiet host passed. Docs 15b3bd0.
- 46 (G153f1, G144, G146): all ok. F160 removed (fixed by patch 0027); G146's finding is real and became F163 and package G156: `abs(sin(10^100))` and `sqrt(sin(10^100)^2)` show ≈ -0.372376123661 at 12 digits, so an absolute value shows negative (principle 3); it needs G141's higher precision and runs on the weekly extreme night after G141. CORE 66/66 at f822e15. Docs 14d1916.
- 47 (R89, R111, R110): R89 and R111 ok; R110 fix (R110f1). R89's five open points settled as one default in decisions.md (no built-in Default preset, Delete acts at once, the sheet's tick marks the active preset, a preset's line leaves out vibration and the Pascaline theme, names typed as maths). CORE 66/66 at 342691e. Docs 61e12e3.
- 48 (G145, G147): both ok. CORE 66/66 at 50e2d91; golden passed. Small leftovers, no package: `spec/keyboard.yaml` line 29 still says `SAMPLE_CHIPS` is in `input/chips.ts` (it moved to `input/testChips.ts`); `tools/library.ts` and `tools/probes/text-misses.ts` call `parseLibrary` with one argument (stale since G100, outside typecheck). Docs 8cefbcf.
- 49 (R110f1, R33, R36): R110f1 and R33 ok; R36 fix (R36f1). CORE 66/66 at 8cefbcf. Docs 6f54957.

## What the owner must do
1. **Decide** (decisions.md "Needs the user", backlog item 1): A21's F-Droid answer; R50e's Android system bar colours; **new: R33's stored-name colour**, where I recommend a token of its own per theme, picked by eye after R24d, because the ≈ colour gives a stored name the ≈ mark's meaning.
2. **Morning check** on the Tab One ([MORNING.md](../../tests/core/MORNING.md), about 10 minutes). The screen was locked for most of the night, so unlock it and run the device core list: the last device result is 65/65 at 5fd9440. Also look at R89's presets, R110's Shift + 9 `%` row and R111's note at 360 px.
3. **Push phase-1** when content: this night's 14 merges and the six doc commits are local, on top of the earlier unpushed work. Parisse email 5 waits for the push.
4. **Milestone reviews:** after R50e (due); after R24d with R108's gallery group "Decimal comma in apps", R101's CAS strips, R62's and R63's states, R89 on the Fairphone (save two presets with different free keys and switch), R111's note at 360 px and R33's colour.
5. **By day:** A7, A8, A9 and A57; F156, F159 and F161 to F163 need packages or a look.

## Queue left for the next night
- First **FIX R36f1** (gorge, Opus, `p1/ron-m4a-why`).
- Lane A: 343 R96 (Settings › Data tells whether the data is kept), 344 R98 (Clear history keeps a running job and can be undone), both ron, Opus.
- Lane B: 437 G152 after G142 (G142 is not merged, so it still waits); G141, then G156 on the weekly extreme night. Row 408 (G138, the weekly fuzz) runs only on the extreme night the owner names.
