# Night report 2026-10-18 (second night)

Pipeline runs 26 to 35, five Opus passes (9 to 13). Final gates (pass 13, phase-1 c613cea): typecheck 0 errors, vitest 991/991 (FIND_INDEX=required), e2e 1040 passed and 1 skipped, golden gate passed (units 116/116, parser 559/559 with 2 known gaps, function 28/28, bench 14/14). Nothing was pushed.

## Merged into phase-1
- A13 829b7ae (pipeline: timing-only reruns, STOPPED lines, port), R56 ac9263c (user function names from the stored names), G29 656a610 (replay in batches: 200 engine calls become 8).
- R54 9a0baa3 (list braces on Shift + 8, empty list is an error), G30 681b2ba (`par` and `eseries`).
- G33 d4ff602 (library import, merged review-only together with G33f1 after the branch conflicted with phase-1), G33f2 e0e8cc4, G33f3 c613cea (library bodies and test lines that change globals are refused: increments, op=, indexed stores, loop variables in any case, inner definitions).

## Unmerged
Nothing. G33 first stopped after two fix rounds (a gap in `globalAssigned`); pass 10 gave G33f1, which was approved but conflicted, so G33 was merged review-only.

## Opus passes (NOTES)
- Pass 9: the e2e timing rerun in A13 does not compare the failures it found with Playwright's "N failed" count (vitest does); a follow-up for annabell. `tests/engine/memcap-test.mjs` fails on the dev gsl build ("the module does not expose its memory"); A12 still has to measure the replay on the Tab One. R56: the Solve app reads `p(x)=4` as `solve(p*(x)=4,x)` and Giac refuses it (an error, never a wrong number).
- Pass 10: t09 keeps (sum) ÷ 10 until R4a. G30's E48 to E192 tables were typed from memory but are checked by formula plus the published exception 9.20; an owner spot-check against IEC 60063 is optional. G33 merges with the replay budget recorded as not met (about 570 ms for 200 programs on the Tab One, estimated, against 50 ms).
- Pass 11: a `for k from` loop variable and a function defined inside a body leaked into globals (G33f2).
- Pass 12: G33f2 was audited by Sonnet although rule 1 asks for Opus on gorge packages; a FIX line for gorge must lead to an Opus audit. Upper-case loop keywords still leaked (G33f3).
- Pass 13: `LOCAL k` (upper case) is refused with a message to write `local k`; that is a refusal, not a leak, so no fix. R59 or a later library package can take it.

## What the owner must do (decisions.md "Needs the user")
1. R56: the Function app's plots of user functions wait for the owner's word. Recommendation: a small ron package for the Solve app now (user names beyond f, g, h).
2. G33: the library replay is about ten times over budget on the Tab One. Recommendation: R59 waits for A12's device number; if A12 confirms the miss, a gorge package for lazy definition of functions (r10 3.2) comes first.
3. Carried over from the first night: S4 scope, S9 yes, G15 `rpm → rad/s` message, R50a palette pick, the stale dev server (pid 4016472). S5 is merged (4ab5634).

## Queue left for the next night
- Unchanged: the brief's queue as it stands (steps 22, 23, 25, 26, 28, 29 were skipped on the first night while waiting for S5; S5 is merged now).
- New small packages: the e2e timing rerun should compare its failures with Playwright's "N failed" summary (annabell); a load-proof Find key-timing test (annabell).
