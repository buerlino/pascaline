# Night report 2026-10-26 (eleventh night)

Pipeline runs 246 to 254, Opus passes 76 to 81. The section starts at 20:37 on 2026-10-25 (`--until 07:00`) and the log ends at 07:14 with this report. Nothing was pushed. Day runs before the night (A37 e591a83, A36 4e9df93, A25 a929e13) are not counted here; pass 76 audited them (all ok).

**Core list:** desktop CORE 57/57 (known 0, needs 3) at phase-1 446ed9f (pass 80; phase-1 did not move in pass 81). On the Fairphone CORE DEVICE 56/56 (known 0, new none) on 446ed9f (device run 81). No Tab One run tonight. Gates at 4353e15 and 77fd0c1 (passes 77, 78): typecheck 0 errors, vitest 1897 passed with 1 expected fail, e2e 1213 passed with 4 skipped, GOLDEN GATE PASSED (7.67 Giac calls per input).

## Merged into phase-1
- R81 a956ede (the system keyboard no longer opens on return from another app: main.ts drops the focus when a touch window regains it; review-only run 247 after run 246 failed on c50).
- R74f1 bd1cfaa (clipboard lock between Playwright workers; test hygiene only).
- G109 4353e15 (a list of Giac's type, a solve result included, is shown and copied in braces; the owner decided braces on 2026-10-25).
- R74f2 fa71393 (F100: ClipActions runs copy, paste and share one after another; fixes the c50 race).
- G111 77fd0c1 (patch 0007: a list-type x is mapped per element in distributions; new engine key 652fb14ff9b5c210).
- R80f1 bf57251 (R80: lists go to Giac as list[...], CAS list results keep items and marks).
- Doc commits on phase-1 (not pushed): 137f18f, 29acb91, 8b2dede, 446ed9f.

## Unmerged
- G112 (p1/gorge-g112, 642318e): two fix rounds. The probe and the refusals are right, but 53 of its 265 table names rest on an empty, undef or 0 answer, so CAS `lvar` of a vector is refused with a false message. G112f1 (one branch, merges G112 too) was written in pass 81 and did not run: the 07:00 limit had passed. It runs by day.
- Step 130 (S16) still waits for A19.

## What went wrong
- R81 and R80 ended at "NOT MERGED after two fix rounds"; R81 failed only on core case c50 (e2e) and was merged review-only; R80 had been based before G111 and was redone as R80f1, which merged.
- Pass 76 blamed F100 on parallel workers; pass 77 corrected it: the race is between Copy and Paste inside the app (fixed by R74f2).
- Flake census 78: one vitest run in five failed, flags.test.ts G102 (Giac's interrupt escaped as a wasm Exception under load); filed as F106 and put in isTiming.

## Opus passes (NOTES)
- 76: A37, A25, A36 ok; R81 ok to merge review-only; R74f1 asked for (wrong cause, see above). F100 filed.
- 77: R81, R74f1, G109 ok; R74f2 fix. F99 and F100 rows in bug-patterns rewritten.
- 78: R74f2, G111 ok; R80 fix: R80f1. New F101 (probabilities at a non-integer k are a number), F102 (normald_cdf of a list gave P(0 ≤ X ≤ 1)).
- 79: R80f1 ok; F102 fixed. New F103 (more functions read one list as their arguments), F104 (Home negbinomial_icdf(3,1/2,1/5) = 0, right 1), F105 (Home normald_cdf(0,1,{1/2,3/2}) stays a symbolic erf form), F106. G112 asked for.
- 80: G112 fix: G112f1; decision: keep the probe's rule for the freeze (constructors with a list argument are refused too; F107 to be filed through the branch).
- 81: agrees with pass 80; G112f1 also fixes the probe's evidence rule (shared empty, undef or 0 answers are not evidence).

## What the owner must do
1. Morning check 2026-10-25 failed on F99 (all 15 cases pass on the Fairphone 6; the feel part: the system keyboard opens on some returns from another app). R81 is merged; check it on the device (tools/probes/ime-return.py is left for annabell).
2. Send Parisse patch 0006 (commit 8c6cb63) and the regression-file link (G108 merged), if not yet sent.
3. Decide which F lines R4a waits for (G110's proposal, under Needs the user). F101, F104 and F105 are to be fixed before R4a.
4. Upload the mirror for the new Giac pin (patch 0007); then annabell runs the release build and the golden gate.
5. Push phase-1 when you are content (nothing was pushed).

## Queue left for the next night
- G112f1 first (by day if not yet run), then S16 after A19, the flake census, the last pass and the report. Steps 119a and 119b are done.
- Follow-ups without a package: F63 to F67, F72 to F75, F77 to F89, F99, F101, F103 to F107.
