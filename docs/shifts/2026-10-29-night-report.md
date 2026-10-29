# Night report 2026-10-29 (fourteenth night)

Pipeline runs 291 to 300, Opus passes 5 to 8 of this section. The section starts at 22:01 on 2026-10-28 (`--until 08:00`, on the Fairphone) and the log ends at 08:25 with this report; `night.sh` closed at 08:03 with the last pass. Nothing was pushed.

**Core list:** desktop CORE 66/66 (known 0, needs 0) at phase-1 54e81d9 (pass 5), 8b0afb6 (pass 6), dfeff56 (pass 7) and 2c63d49 (pass 8). On the Fairphone: CORE DEVICE 65/65 (known 0, new none) at caae5d1 (00:41), 962a9e1 (04:47), b262fc8 (07:42) and 35b6dc6 (08:25); the device is 65 against desktop 66. Gates at 2c63d49: typecheck 0 errors, vitest 2000 passed with 1 expected fail, e2e 1263 passed with 1 skipped, GOLDEN GATE PASSED (precision 677/677 with 1 pending, calls-home 7.52 per input, units 166/166, parser 623/625 with 2 known gaps).

## Merged into phase-1
- G121 f6d07f4 (patch 0013, real-argument rules; one fix round; engine key d343f41465962e56).
- G122 54e81d9 (patch 0014, big-number reduction; engine key 1c4f25b75d8f85f7).
- G119 8b0afb6 (Home shows a Giac sequence answer as a value or a list).
- G126f1 fe93d39 (finishes G126 on p1/gorge-hugeinverse: patch 0015 asin/asinh/ln cancellation, README row; engine key 4343bfd06a4de8ea).
- G125 dfeff56 (tests only; patch 0013 already fixes F112; merged review-only as run 298 after runs 293 and 294 stopped at red-first).
- G124f1 2c63d49 (finishes G124 on p1/gorge-listctor: the integers form is exactly two integers of at least 1; twelve names leave the refused table).
- Doc commits on phase-1 (not pushed): caae5d1, 962a9e1, b262fc8, 35b6dc6.

## Unmerged
- None. G126 and G124 stopped after two fix rounds (runs 295 and 299) and merged through G126f1 and G124f1.

## What went wrong
- G125 failed red-first in runs 293 and 294 because its package file said "failing on phase-1"; its tests pass on phase-1 since patch 0013 is already in. The package file was reworded (962a9e1) and run 298 merged it.
- G126 (run 295) took three rounds: the first rose the Giac calls per Enter, then the patch picked the wrong side, then the patch README row was missing. Pass 6 accepted the rise of at most two levels.
- G124 (run 299) missed a silent wrong value: the list form accepted lists of any length and sign (`zeros(list[2,3,4])` showed `[]`). G124f1 fixed it.
- G121 needed one fix round for a missing patches README row.
- Run 298 had a merge conflict with G126 that gorge resolved; the merge brought the F112 line back into the backlog and pass 7 removed it.
- The G126 and G124 round-2 audit logs were closed to the Opus pass by the settings, so passes 6 and 7 judged from the truncated log lines and their own probes. The per-Enter engine-call probes were not rerun in passes 7 and 8.

## Opus passes (NOTES)
- 5: G121, G122, G125 ok. Past about 10^70 Home shows ⚠ 0 for `asin(sin(10^70))` (right -0.148645930748), probe input for G126. F124 filed: Home `asin(cos(atan(2*i)))` is 0.549·i, right -0.549·i. P23's full text moved to the archive.
- 6: G119 ok, G125 ok (merge review-only), G126 fix (G126f1). Decisions: the sequence-answer rule; atanh's cut is settled by the G116 default (Giac's side, also C99's).
- 7: G126f1, G125 ok, G124 fix (G124f1). F125 filed: Home shows Giac's matrix type with no mark (`matrix(2,3)` = `matrix[[0,0,0],[0,0,0]]`).
- 8: G124 and G124f1 ok. F107 is gone from the backlog; F125 covers the matrix display.

## What the owner must do
1. Send B. Parisse the commit links for patches 0013 to 0015 (and 0010 to 0012 if not yet sent), and add the new upstream lines to ../outreach/upstream-reports.md.
2. The morning check on the Fairphone (device 65/65 against desktop 66, one core case runs on desktop only).
3. Push phase-1 when you are content (nothing was pushed).

## Queue left for the next night
- G123, G127, G128 and G120 moved to the next night (steps 198 to 201), then the last Opus pass and the report; step 197 is removed.
- The release gate (A42) on a quiet host after the engine patches 0009 to 0015.
- Follow-ups without a package: F124, F125, F119 to F123, F63 to F67, F72 to F75, F77 to F89, F99, F101, F103 to F116.
