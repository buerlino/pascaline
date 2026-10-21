# Night report 2026-10-20 (fifth night)

Pipeline runs 89 to 118, Opus passes 32 to 42. The shift ran from 17:27 on 2026-10-19 to 05:57. Gates at pass 42 (phase-1 52ee875): typecheck 0 errors, vitest 1465/1465, e2e 1056 passed and 1 skipped. The last golden gate ran at pass 40 (2388fca) and passed (Giac calls per Enter: Home 11.83 against 11.92, bench 8.00 against 8.00). Nothing was pushed.

## Merged into phase-1
- Angle mode (route R): G46f1 73fb29d (DEG Copy and Copy exact give the text drawn; chips and Ans keep the radian text), R64f1 f1186c4 (the ° template is u*pi/180/pasdeg; polar_coordinates, one-list rectangular_coordinates and instfreq follow pasdeg), R64f2 0f688e6 (polar_point reads its angle in DEG).
- Precision and marks: G57 80387e7 (a decision Giac cannot make is an error row; a refused `name:=` stores nothing), G44 f25b2a7, G44f1 b5b4e7e (erf, erfc and a fisher_icdf infinity no longer silent), G44f2 77fc6be (undef from normald_icdf, chi-square upper tail), G44f2f1 f7b97e9 (Newton starts from Giac's value again), G44f2f1f1 2c9402c (polished-value tests set budgetMs 5000), G53 e4eabde (Giac calls per Enter 4049 to 3063), G41 615b747 (σ beyond first order), G54 9ee7ecc (our names in Giac text).
- Units: G37 d368dca (°C in a compound unit is an interval), G40 c0c5bbf (angles in the unit view; "rad = 1 dropped" and the rpm note exist in the results, not shown yet).
- Gate and tools: G43 b235842 and G43f2 47c76df (invariants stage, now 17.2 s of its 60 s), G55 fbad08c (behaviour diff between two trees).
- Home and entry: G45 cfa6127 (one tie rule, G2 records), R66 44d30b6 (the power form keeps Giac's principal root), R67 2388fca (a typed e or i is a name), R68 with R68f1 52ee875 (ᴇ's leading 1 after an operator), R56b 0773b64 (Solve knows the user's functions).
- Themes: R50c 4235f6d (generator and four more families), R50d 8b7a9a2 (Plain keys and High contrast).
- Research and docs: S13 4dbaf8e (R15, stored names from Giac's state), S11 30c751a (R17 and R60 to R63), S6 f2d3a54 (R11, files in and out), S8 51a20d8 (R18 outside-test protocol).

## Unmerged
Nothing is left open. G43f1 (branch p1/gorge-m4-invariantsfast, e581d5a) and R68 (p1/ron-m4-emark1, cd3704a) stopped at the two-fix-round limit and were finished on the same branches as G43f2 and R68f1. R68 failed only because decisions.md was at its 40 kB limit.

## Opus passes (NOTES)
- Pass 32: G46f1, R64f1, G57 ok. The G57 test fixtures store with `sto` for now; those rows change when the run-once forms are refused. R64f1 left polar_point, done in R64f2.
- Pass 33: R64f2, G37, G40 ok. G40's two readings and G37's SI display became defaults. R24c must show the "rad = 1 dropped" and rpm notes.
- Pass 34: G43, G44, G41 ok. The invariants stage took 51.6 s of 60 s (G43f1). Probes found erf(10^-12) shown as ≈ 1E-12 and fisher_icdf(3,4,1-10^-20) shown +infinity, both unmarked (G44f1). σ is not drawn yet, so R24c checks the why-line.
- Pass 35: G43f1 not merged; the decisions.md claim that our polish leaves state behind was wrong. G44f1 ok. Probe: Giac's raw normald_icdf changes on each call and gives undef by about the third (G44f2). G53 ok, 1.35× is under Needs the user. pipeline.sh runs no golden for app/scripts.
- Pass 36: G43f2, G54 ok. G44f2 made the chi-square polish 3 to 4 times slower, so chisquare_icdf(3,0.9) lost its ≈ (G44f2f1).
- Pass 37: G44f2f1, G55, S13 ok. A timing-dependent host.test.ts case was fixed in G44f2f1f1. G65 and G66 came out of S13 and wait on the owner.
- Pass 38: all three ok. The main checkout's app/node_modules was empty since 02:08 (a stray link); every night worktree failed typecheck in round 0 until pass 38 ran npm ci there under host-cpu. That install follows the main checkout's branch p1/sandra-padlayout, whose package.json differs by one line. session.chips.test.ts line 158 still runs on Home's 300 ms budget (fast normald case).
- Pass 39: S8, R50c, R50d ok. R50e gets two more Done-when items: the last theme choice wins, and the size of each lazy theme chunk.
- Pass 40: G45, R66, R67 ok. CAS complex results draw an upright i; old CAS history lines typed with e or i now read as names. home.yaml's README row has stale mark counts.
- Pass 41: R56b ok (one gap: the reload test defines E1 again). R68's code was right; decisions.md was full. In comma mode the decimal comma stays out of the ᴇ rule and ";" joins it.
- Pass 42: R68f1 ok. No e2e covers a relation or the · operator before the mark.

## What the owner must do (decisions.md "Needs the user")
1. Full documents: decisions.md (39.9 of 40 kB) and backlog.md (20.0 of 20 kB). The next package that writes to them will cut other entries and fail its audit. Needs another S15-style trim or larger budgets.
2. S13 (recommendation: accept): +1 Giac call per Enter; G65 and G66 wait for it, and G57's run-once condition now reads "after G65".
3. G57: sto, => and [a,b]:= still store Giac's guess with ⚠; recommendation: keep ⚠ until G65.
4. S8, before outside round 1: count every press and turn off Android's backup (recommendation: both).
5. S6: the backup (out by Android's "Save to", in by a file input); R38a also needs A11.
6. G53: accept the 1.35× cost of the second decision.
7. A16: Enter p95 on the Tab One is over 150 ms in DEG (150.4 ms at 12 digits).
8. M4-2 points 1, 5 and 6: unit task budgets, the ± key, the unit result mockup (R62 waits on the mockup).
9. Find what emptied the main checkout's app/node_modules (likely an npm ci in a worktree whose node_modules is the shared link) and make the pipeline copy or install instead of linking. Upstream reports for Giac's erf, erfc and normald_icdf faults are in the backlog.
10. Pipeline gap: pipeline.sh runs no golden for changes to app/scripts (golden.ts, invariants.ts, calls-budget.ts); annabell, by day.

## Queue left for the next night
- Steps 58 and 59 (R60, R61) were skipped because R24c is not merged; both stay. Step 60 (the last Opus pass) was replaced by passes 32 to 42 and step 61 (this report) is done.
- Follow-ups: R50e (with its two new items); G56 stays on hold until H3; the S15-style diet for decisions.md and backlog.md; the behaviour diff (G55) is available for the next audit.
