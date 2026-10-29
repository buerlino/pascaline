# Night report 2026-10-29, daytime section (fifteenth night)

Pipeline runs 302 to 310, Opus passes 9 to 11 of this section. It starts at 09:31 on 2026-10-29 (`--until 18:30`, no device) and the log ends at 16:56 with this report; the last pass came at 16:43. Run 301 (R85, merged 1d35189 at 09:01) ran before the section and is covered by pass 9. Nothing was pushed.

**Core list:** desktop CORE 66/66 (known 0) at phase-1 ed3976a (pass 9), 9de2cc3 (pass 10) and 6a9cc92 (pass 11). On the device: DEVICE SKIPPED in all three passes (ANDROID_SERIAL not set); the last device run was 65/65 at 35b6dc6 (08:25). Gates at 6a9cc92: typecheck 0 errors, vitest 2005 passed with 1 expected fail, e2e 1269 passed with 1 skipped, GOLDEN GATE PASSED (calls-home 7.47 per input, calls-bench 7.75).

## Merged into phase-1
- R85 1d35189 (Shift and Fmt open Mode; run 301, before the section).
- G129 ed9b88a (atan branch for complex arguments; two fix rounds).
- G130 ed3976a (matrix-typed answers show as plain rows with one mark; Ans reads them back; two fix rounds).
- G123f1 7ea5d5a (finishes G123 on p1/gorge-overflowmark: overflowAt without a module-level constant, start chunk back under budget).
- G127 9de2cc3 (patch 0016, each part of a complex value floored; one fix round; engine key fbf9c56825d16bef).
- G123f2 2a41ff6 (complex overflow such as `i*1.000000000000001^(10^50)` is refused as Overflow; branch p1/gorge-overflowmark-cplx).
- G128 24dba94 (pins only, review-only merge as run 309; patch 0005 already fixes acosh).
- G120 6a9cc92 (nightly edge fuzz, seed 1793285778, triaged; one fix round).
- Doc commits on phase-1 (not pushed): 96003a9, 4101a33, 8856c7f.

## Unmerged
- None. G123 (run 303) and G128 (run 307) stopped after two fix rounds and merged through G123f1/G123f2 and the review-only run 309.

## What went wrong
- G123 (run 303) failed checks three times: stages, vitest, then size: a module-level Set in novalue.ts put 0.1 kB into the start chunk (61.02 against 61.00 kB gzip). G123f1 fixed it; G123f2 then closed the complex-overflow gap.
- G128 failed red-first in runs 307 (rounds 0 and 2) and golden in round 1: patch 0005 already fixed it, so no new test can fail on phase-1. The package file now asks for pins only.
- G130 (run 304) and G129 (run 302) each needed two fix rounds (stages/size, audit findings).
- The start chunk on phase-1 is at 60.99 of 61.00 kB gzip: any package that adds a byte will fail the size check.
- G130 raised the Giac calls for `zeros(2,3)` from 10 to 13 per Enter (bar was one more); listed under its Not done as F127 context.
- One golden interrupt stage ran 6 ms over its 400 ms limit on a loaded host (F128).
- No device runs: ANDROID_SERIAL was not set all section.

## Opus passes (NOTES)
- 9: R85, G129, G130 ok; G123 fix (G123f1). F126 (a stored atan still wrong) and F127 (a matrix inside a list keeps Giac's word) filed. Raw Giac throws "window is not defined" on `segment(i,1+i)` in Node; the Home path is unaffected.
- 10: G123f1, G127, G128 ok; G123f2 ordered. F123 rewritten for the complex overflow; F128 filed. Patches README has row 0016, next patch 0017. Not checked: `[1.000000000000001^(10^50),1]` shows the exact exp(...) text, not a false number.
- 11: G123f2, G128, G120 ok. G120's fuzz found five new wrong values, now F129 to F133 with pending golden cases (F129 a sign error and F130 a dropped factor show a wrong number under ≈; F132 shows ≈ with 21 of 30 digits right) and 20 hangs; F122 has a second crashing input. A44 (own known-rows file for the nightly sweep) is in the backlog with no package. backlog.md is at 19.9 of 20 kB.

## What the owner must do
1. Send B. Parisse the commit link for patch 0016 (and 0013 to 0015 if not yet sent), and add the new upstream lines to ../outreach/upstream-reports.md.
2. Decide on a package for the start-chunk split (brief section 0, item 1; none yet) and for A44.
3. Run the device core list (CORE DEVICE) by hand: three passes were DEVICE SKIPPED.
4. Push phase-1 when you are content (nothing was pushed).

## Queue left for the next night
- Step 205, this report, is done; the queue is empty.
- Typed `evalf(...)` overflows still show an unmarked +infinity (out of G123's scope).
- The release gate (A42) on a quiet host after patches 0009 to 0016.
- Follow-ups without a package: A44, F122, F124 to F133, F119 to F121, F63 to F67, F72 to F75, F77 to F89, F99, F101, F103 to F116.
