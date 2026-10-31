# Night report 2026-10-31, the second two-lane run (18:22 to 10:32)

Pipeline runs 346 to 379 (22 package runs), Opus passes 19 to 26. The section starts at 18:22 (`night.sh --lane A` and `--lane B`, both `--until 09:00`, the Tab One) and the log ends at 10:32 with this report. Lane B closed at 10:12 (its last pass was 25, no report), lane A at 10:32 (pass 26, then this report). Fifteen runs merged, four branches are left unmerged. Nothing was pushed.

**Core list:** desktop CORE 66/66 (known 0, needs 0) at 0817682 (pass 25 and 26; e2e 1358 passed, 1 skipped, 0 failed). The night's device: **CORE DEVICE 65/65 (known 0, new none) at 3718a40 (10:32)**. Every device run of the night (19 to 26, at 12d5562, 25faa6f, 97b4801, 1fb3400, d0e5e0e, 6b7cf60, 0817682, 3718a40) was 65/65. Gates at 0817682: typecheck 0 errors, vitest 2765 passed with 1 expected fail, `npm run size` passed (start chunk 58.97 of 61 kB gzip, at its pin). GOLDEN GATE PASSED at a1158a4 (pass 25); pass 26 ran none (R70f1 changed no engine or parser code).

## Merged into phase-1
Lane A (ron):
- R4bf1 c682e3e (start pin 59.5 kB, App.svelte at 800 lines). One fix round (size).
- R57f2 bb90a5e (the decimal mark: a bare comma is always the argument comma, MathLive's `{,}` is the mark; Settings schema 4). R57f1 was NOT MERGED after two fix rounds (size: the Paste and rows holds took the start chunk to its own pin).
- R50e e4d6085 (Appearance in Settings, schema 3, first frame set by the inline script). One fix round.
- R24b bca10d5 (the unit pad drawn through the keypad's seams, +0.02 kB at start). Two fix rounds (size-check wording, then the `--key-pfx` contrast).
- R24cf1 bfc6e4e (the unit view; a slot change drops a stale result; `slotFormula` checked against the parser over 551 rows; one 34 kB rule). R24c was NOT MERGED after two fix rounds (size).
- R70 c7ef0f1 (the press counter), then R70f1 b0c6c3e (the entry line's field code moved to `entry/field.ts`: start chunk 60.96 to 58.95 kB gzip; a held hardware key counts once).

Lane B (annabell, gorge):
- A49f1 c6447ff (App.svelte at 800 lines; the worker, kill switch and chunk reload were checked in pass 17).
- A51 2f76221 (the quiet rerun, bounded at 600 s).
- A45 01a0e93 (the Pages workflow; pinned actions, `build.sh --web`). Run 350 was NOT MERGED after two fix rounds (the audit asked for a THIRD_PARTY.md edit, which workers may not make); pass 19 applied the text and ran it as a review-only merge (run 354).
- G133 9234c41 (patch 0020, Giac's small-x asin/asinh; engine key 0c02b0a92bd8914a), G134 4571d22 (patches 0021 and 0022, `arg_CPLX` and the complex sqrt; key 64a520dad7e6542e), G133f1 0fc50d2 (patch 0023, an exact zero real part for asin(i*y) and asinh(i*y), |y| ≤ 1; key 70b9de32fab9e820). Pass 21 found the noise G133 had left; Giac calls per Enter went from 3374 to 3372.
- G137 ff1e4d1 (the nightly fuzz of 2026-10-30; seed 1793416884, 39 failures, all rerun alone; the steps stage lists pending cases instead of a `SPEED_KNOWN` exemption).
- G81f1 a1158a4, with G81 (constants that share a leaf enter through their basis in Home and the unit view; the unit view rule is now 38 kB raw, 34.04 measured). G81 (run 372) was NOT MERGED after two fix rounds (the 34 kB rule).

Doc commits on phase-1 (not pushed): 12d5562, 25faa6f, 97b4801, 1fb3400, d0e5e0e, 6b7cf60, 0817682, 3718a40.

## Unmerged
- **R24d** (run 368, then R24df1 run 375, `p1/ron-m5-usercells` at 2400ccc): the cells store, the Settings level, Put on the unit pad and the pair split are sound. Run 368 failed its audit on `units/menu.ts:41` (`cm^2` went in as one token); R24df1 fixed that, then failed on the pin (59.06 kB merged against 59.04, because G81 merged after the measurement) and on a test race (`decimalcomma.spec.ts` line 93, 80 of 80 runs green alone). Pass 26: FIX R24df2 (also makes the Find UI chunk rule measure `finder.ts`, now a shared chunk, and fail when it matches nothing).
- **R38a** (run 378, `p1/ron-m4-backup` at 5deba52): the audit's two findings were fixed in round 2; merged with phase-1 the start chunk is 59.06 kB against its pin of 59.00 (phase-1: 58.97), because `saveBackup` in `App.svelte` adds a second dynamic import of `state/backup.ts`. Pass 26: FIX R38af1 (go through `withClip`).
- None of the two FIX packages ran: both lanes were closing.

## What went wrong
- **The start-chunk pin caused almost every size failure** (R57f1, R24c, G81, R24df1, R38a): each worker set its pin from a measurement taken before phase-1 moved. Pass 26 made it a rule: the pin is the size measured after merging phase-1, plus 0.05 kB (decisions.md, docs/04 8.3). R70 had used up the room (60.97 of 61 kB) until R70f1's split.
- Flaky checks under load: pass 19's full e2e had 8 failures at load about 12 (all green alone, CORE 66/66); `patch-canary.ts` timed out at 120 s in pass 23's golden run and passed alone in 97 s; the red-first check failed G133f1 in round 0; the decimalcomma race above.
- Merge-queue waits of 450 to 1500 s per run with two lanes; lane A's pass 26 waited 1499 s for integ.
- Four passes took a number that was already taken (18 to 19, 19 to 20, 21 to 22, 25 to 26): logged, no harm.
- Lane B stopped with R60 and R61 not run: the window ended while it waited on G81.

## Opus passes (NOTES)
- 19 (A49f1, A51, A45): all ok; A45 ran as a review-only merge. CORE 66/66 at bbeb31d; CORE DEVICE 19 65/65. Owner act below.
- 20 (R4bf1, R50e, R57f1): R4bf1 and R50e ok; R57f1 fix (FIX R57f2). CORE 66/66 at 01a0e93. R57 adds about 0.58 kB at start.
- 21 (A45, G133, G134): G133 fix (noise in the real part: FIX G133f1). CORE 66/66 at 4571d22. The oracle check of `precision.yaml` reports 12 problems, all in the older g93 restart cases.
- 22 (R57f2, R24b, R24c): R24c fix (FIX R24cf1: budgets plus a stale-result race). CORE 66/66 at 97b4801.
- 23 (R24cf1, R24d, R70): R70 fix (FIX R70f1), R24d fix (FIX R24df1). CORE 66/66 at ff1e4d1.
- 24 (G133f1, G137, G81): G133f1 and G137 ok; G81 fix (FIX G81f1: 38 kB unit view rule, decided by pass 24). Filed F139 (G133f1's wrong "Underflow" reason), F140 to F144 (G137's findings), F145 (hangs and oracle misses). CORE 66/66 at b0c6c3e.
- 25 (G81f1): ok. A σ of 0 where everything cancels keeps ≈ (docs/04 2.4). R40's text now passes `basis` and `basisLeaves`. CORE 66/66 at a1158a4.
- 26 (R70f1, R24df1, R38a): R70f1 ok; R24df1 and R38a fix (FIX R24df2, R38af1). CORE 66/66 at 0817682.

## What the owner must do
1. **Before A45's first deploy:** add the tag rule `v*` to the `github-pages` environment, then run "pages" by hand. Podman on the ubuntu-24.04 runner is unverified until that first run.
2. **Milestone reviews (due):** after R50e (also its phone checks in decisions.md "Needs the user": the first start after "clear data", Android's system bar colours). R4b and R24c are both merged, so backlog "Needs the user" item 8's two outside rounds are due.
3. **The start chunk's room:** 58.97 of 61 kB; R24d and R38a each add 0.09, then R71, R15c4 and R88. The recommendation stands: keep the budget; say so if you would rather raise it.
4. **The kill switch (A49):** the steps are in backlog "Needs the user" item 7.
5. **By day:** the new backlog lines (F139 to F145, red-first's two blind spots, patch-canary unpacking the Giac tarball 40 times, hardware less-than, greater-than and factorial keys and dead keys not counted as presses). Push phase-1 when content: the eight doc commits above and the merges of this night are local.

## Queue left for the next night
- Lane A: R24df2 (`p1/ron-m5-usercells`), then R38af1 (`p1/ron-m4-backup`), whether or not R24df2 merged. Then 314 R38b (only once R38a counts as merged) and 316 R71. 315 R88 waits for R24d. Rows 311 R24d and 313 R38a do not run again: they count as merged once R24df2 and R38af1 merge.
- Lane B: 410 R60, then 411 R61. Row 408 (G138, the weekly fuzz) runs only on the next weekly extreme night.
- By day: A43, A7, A8 and A9.
