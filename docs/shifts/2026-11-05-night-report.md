<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Night report 2026-11-05, the weekly night of 2026-11-04 (22:51 to 07:06)

Pipeline runs 588 to 608 (13 package runs), Opus passes 66 to 69, device runs 66 to 69. Both lanes ran on the Tab One, `night.sh --lane A` and `--lane B`, `--until 08:00` (the weekly extreme night). Lane A's table was empty after R127 (01:41); it closed with pass 67 and device 67, called `report` at 02:06 and waited for lane B. Lane B was still running G152 after 18003 s, so lane A's closing wrote this report at 07:06; lane B has no `SHIFT DONE` line. 9 runs merged (4 in lane A, 5 in lane B). Three runs ended NOT MERGED after two fix rounds (G141, G141f1, G142); G141 and G142 merged later. **G152 (run 608, started 06:54) had no result when this report was written**: look at the log. Nothing was pushed.

**Core list:** desktop CORE 66/66 (known 0, needs 0) at d1278849 (pass 69). The device: **CORE DEVICE 65/65 (new none) at c3191631 (device 69, 05:13)**; devices 66, 67 and 68 were also 65/65. Device 69 ran before G141f2 (ff5875e6) and G156 (b8e52578) merged, so those two have no device run and no Opus pass yet. Gates at pass 69: typecheck 0 errors; `FIND_INDEX=required npm test` 3627 passed with 1 expected fail; e2e 1605 passed with 1 skipped; GOLDEN GATE PASSED. Pass 67 saw one e2e failure, `unitresult.spec.ts` (the Wh chip tap missed its 5 s wait), an older flaky test (it also failed in run 577); its backlog line is updated. `npm run size` and the golden gate were not run in every pass (golden only when engine or parser code changed).

## Merged into phase-1
Lane A (annabell, ron):
- A60 bc2318ca (the F-Droid recipe's prebuild runs `refresh-factors.mjs` between `npm ci` and `npm run index`; a test pins the order; libqalculate 5.13.1 shows no difference).
- A59 0da228a0 (splash, both system bars and the window background use the Dark colour #0b1020; a test ties it to style.css; Tab One trace: no white splash).
- A62 6e9b22f0 (a measurement only, no code: with 200 library programs the defs replay is 96 ms p50 (119 p95), down from 403). Two fix rounds (docs check; the audit found an empty diff).
- R127 0ea68661 (presses counted per key and layer and exported; hardware keys named hw:letter, hw:symbol, hw:dead, hw:other; a held Shift ⌫ counts as Del, repeats as plain ⌫). Two fix rounds (the audit: the layer of a held ⌫ was read after the press; size).

Lane B (gorge):
- G160 79dcd8cf (patch 0025: a non-finite base is decided by Giac's evalf of ln(b); what it cannot decide stays as typed). The engine key changed to 1a2d11e687d0cb0c.
- G142 f5c0507d (review-only merge, run 602; patch 0020 of G133 already fixed it; two oracle rows fail on stock and pass on phase-1). Its first run (595) was NOT MERGED, see below.
- G138 d1278849 (the weekly fuzz; 722 known rows added under open ids; five findings filed as F173 to F177).
- G141f2 ff5875e6 (carries G141 and G141f1: a literal past MAX_EVAL_DIGITS makes the value ⚠ unchecked, a power of ten too; one helper in literalPrec.ts adds the warning only to an element that is not exact and has digits left; `evalf(sin(10^2000))` shows no digit confirmed again; package F151 closed, what still fails is F155). Merged in round 0 on its own run.
- G156 b8e52578 (a negative even power and the sign of an absolute value; golden regression export). One fix round (the audit: the past-cap literal check looked for a free name anywhere instead of the decisions' arguments).

Doc commits on phase-1 (not pushed): 5683c402 (pass 66), 837e448f and d9921c15 (pass 67), 226e8a16 (pass 68), c3191631 (pass 69).

## Unmerged
- **G152 (run 608, `p1/gorge-acoshsign`)**: running at 06:54, no result in the log when this report was written. The morning check reads the log; the row stays in the queue if it did not merge.
- G141 (run 588, `p1/gorge-literalprec`, kept at f7261115) and G141f1 (run 601, same branch, kept at c8d2086c) each ended NOT MERGED after two fix rounds. The audit's last FIX on G141 was the `sig` fallback letting a power of ten past the cap be checked (pass 68 decided: the block's own words, no fallback); on G141f1 it was the past-cap rule written twice in numeric.ts (pass 69 confirmed it with a probe). G141f2 merged both.
- G142 (run 595, `p1/gorge-acoshsmall`, kept at 9e980d87): the red-first check refused it because its package file said "fail on phase-1" while the fix is in the stock build's patch. The file now names the stock build; merged review-only as run 602.
- Pass 68 notes a lead for the pipeline owner: the red-first check cannot test a stock build.

## What went wrong
- **Fix rounds:** G141 two, G141f1 two, G142 two (then review-only), A62 two, R127 two, G156 one. G141 took three runs to merge, because the past-cap rule needed pass 68's decision first and then a second place that held the same rule.
- **Size check:** failed R127's round 1. R127 left the start chunk at 60,992 B against its pin of 61,000 B, which is the 61 kB budget: the next package that grows the start chunk must split something out first.
- **Merge-queue waits** were long, up to 1247 s (G156), 1209 s (G156 round 1) and 1174 s (G141 round 2). Pass 68's own gate script failed to release host-cpu (a relative path run from app/); it was released by hand.
- **G141's engine path:** the worker's first G141f1 run had `GIAC_OUT` on the pre-G160 engine key (d98c…) while the branch needed 1a2d… (the report says so; the pipeline built the branch engine).
- **No Opus pass after 05:01:** G141f2, G156 and G152 came after pass 69; lane B continued past lane A's closing, so the report was written without a last pass.

## Opus passes (NOTES)
- 66 (A60, A59, A62): all ok. CORE 66/66 at 6e9b22f0; golden not run. Docs 5683c402: R59's gate under "Needs the user" (recommendation: count the 50 ms above an empty log's 57 ms, so R59 goes ahead); backlog F172 (engine ready reaches 1835 ms with 200 CAS history items) and A59f1 (1 to 2 light frames at the splash exit); three decisions shortened to the archive.
- 67 (R127): ok. CORE 66/66 at 0ea68661. Cold start 239 ms, but no phase-1 build was measured beside it, so "unchanged" is not shown. Docs 837e448f and d9921c15 (docs/04 5.2).
- 68 (G141, G142, G160): G141 fix (G141f1: drop the `sig` fallback; eight G126/G137/G153 rows turn ⚠ until S20's intervals; the 10^1200 case shows ⚠ and S20 lists it); G142 ok (review-only merge); G160 ok. CORE 66/66 at 79dcd8cf. Docs 226e8a16; F167 notes 0018's double test for a base past 1E308.
- 69 (G141f1, G142, G138): G141f1 fix (G141f2); G142 ok; G138 ok. CORE 66/66 at d1278849. Docs c3191631: F173 to F177 (F173, `acos(cos(10^-50))` = -1E-50 with the exact mark, is the worst), new hangs added to F145, F155 now covers past-the-cap cases. Decided: a nightly known row names one tree, not a shape, because a shape would also hide a new cause that shrinks to it (F175).

## What the owner must do
1. **Decide** (decisions.md "Needs the user"): R59's gate from A62's measurement (pass 66; no later pass says it was settled). A small gorge package before Wed 11-11 so the weekly fuzz runs in 10-minute slices (pass 69).
2. **Morning check** on the Tab One ([MORNING.md](../../tests/core/MORNING.md), about 10 minutes): the device core list was 65/65 at c3191631, before G141f2 and G156. Look at ⚠ on the past-cap inputs (G141), A59's dark splash, R127's key counts if exported.
3. **By day, on a device:** A59f1 (the splash-exit flash) and F172 (slow start with a full CAS history).
4. **Read the log for G152** (run 608) and check that no worker or engine build is still running before the next night.
5. **Push phase-1** when content: this night's 9 merges and the five doc commits are local on top of earlier unpushed work.
6. **Watch (from earlier passes, still open):** the next device run tries TalkBack and the status line at font scale 2.0; F171 (a Greek constant chip shown by its LaTeX name in the why-line) has no package.

## Queue left for the next night
- G152 (437) if run 608 did not merge.
- 472 G164 (lane B, not started).
- Follow-ups from the passes: a Giac call-count and Opus pass for G141f2 and G156 (they merged after pass 69); the packages for F173 to F177 and F155 are not written.
- The weekly fuzz package for 10-minute slices (item 1) before Wed 11-11.
- Lane A's table is empty (A60, A59, A62, R127 are done).
