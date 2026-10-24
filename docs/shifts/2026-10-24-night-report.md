# Night report 2026-10-24 (ninth night)

Pipeline runs 198 to 226, Opus passes 61 to 71. The section starts at 23:55 on 2026-10-23 and ended at 18:22 (`--until 18:00`, last pass 71, then this report). Nothing was pushed.

**Core list:** desktop CORE 53/53 (known 0, needs 3) at phase-1 c44304a (pass 71). On the Fairphone CORE DEVICE 52/52 (known 0, new none) on 2312594 (device run 71); the Tab One did not run the list. Gates at c44304a: typecheck 0 errors, index ok, vitest 1787 passed and 1 expected fail, e2e 1142 passed with 4 skipped, GOLDEN GATE PASSED on engine d9682092 (parser 621/621). Pass 65 saw one full e2e with 52/53 under load (average about 12; c52 "The calculation failed", float fallback out of budget); G82 removes that cause.

## Merged into phase-1
- Before and early in the night: A35 c8b4723 (Gradle without terminal or daemon, dead-pid locks broken), G106 (poly1 guard, in with its follow-up).
- R78 c381b15 (a list plus or minus a number goes elementwise), R78f1 b367fd1 (list times list is `.*`), R79 acde365 (one `listValued` test replaces three copies), R76f1 6d93eab (Enter in Num empties the line).
- G106f1 6ea4d02 (poly1 check at any depth).
- G99 d3ac398 and G100 f395433 and G100f1 195ee67 (names and stores come from the bridge; a program held in a list counts), G101 3f37195 and G101f1 9e07920 (non-square body walk, also `/` and typed operators), G102 5b6d454 (settings through bridge-1; calls per Enter down).
- G75 7f6a08e (patch 0003, complex tanh), G60 c5e8fe3 (patch 0005, MPFR pi and real domains), G103f1 0260e51 (G103: values out of reach are refused, not computed), G82f1 97a4bb1 (G82: Home step budget plus 1.5 s clock), G56 c4e68e9 and G56f1 0594541 (complex bodies), G96f1 c44304a (G96: patch 0006, commit 8c6cb63).
- S17 f79f609, G77 9b50333 (Giac pinned to giac_2.1.0-1, canaries and fetch test in the golden flags stage), G89f1 a1be50f and G89f2 cb85c66 (regression files for Parisse: check, known, patched), G91 c13d5e9, G87 190a0d5.
- Shared engine keys moved six times; the last is d9682092bad3356e (giac.wasm sha256 34dc77d2…ef24).

## Unmerged
- G64 (p1/gorge-m4-casback, 155eddf): the code passed two audits; the last check failed only on the docs budget (backlog.md over 20 kB). G64f1 (rewrite the backlog entry, no code) did not run before 18:00.
- G108 (p1/gorge-giacregress-gate): not run. Two lines of the regression files fail on our own build (`g91-home-exp-approx-sin1e30-2*10`, `g96-im-int-tanh-sqrt`); run.mjs reads check 290/291, known 0/47, patched 26/27 on d9682092; nothing runs the files in the golden gate yet.
- Step 130 (S16) waits for A19, which runs by day.

## What went wrong
- G103 and G82 each ended at "NOT MERGED after two fix rounds"; the Opus passes turned the last findings into G103f1 and G82f1, which merged.
- G96 failed the e2e twice (two different flakes: lazysheet F42, then a race in hwkeys) and was not merged until G96f1.
- Gate load: with the load average near 12, vitest's `homeDeadline` (a 2 s wall-clock test) failed in two of four runs of pass 65 (passes alone).

## Opus passes (NOTES)
- 61: A35, R78 ok; G106 fix (poly1 one level deep): G106f1; R78f1 for list times list. F79 added: `sum(L+1)` gives 6 and `mean(L+1)` gives 3 for L={1,4}; the list-operator choice is under Needs the user.
- 62: G106f1, R76f1 ok; R78f1 fix: R79 (five list-valued parts still got the dot product).
- 63: R79, G99 ok; G100 fix: G100f1 (F81, a program held in a list ran twice). F80 (int after the store arrow) waits for the bridge moves; F82, F83 added; decisions.md shortened.
- 64: G100f1, G102 ok; G101 fix: G101f1 (F84, `/` and typed operators). F85: the input's parse stays its own bridge-2 call, cost only. The interrupt fix goes with G75.
- 65: G101f1, G75 ok; G103 fix: G103f1. G103's double in a list keeps today's display (the owner's choice after the freeze); G75's commit 5fea5df is sent by the owner.
- 66: G103f1, G60 ok; G82 fix: G82f1. F86 added (exp(cosh(floor(asin(pi)))) shows "No value found"). Huge or tiny cuts and the count of a double by perturbation are under Needs the user.
- 67: G82f1 ok, G56 fix: G56f1, S17 ok. Home keeps the 1.5 s clock; only factorial(10^6) changes at 8 times the speed (2 known cases). canaries.mjs joins the flags stage with G77; the two-argument round and trunc patch waits for after the freeze.
- 68: G56f1, G77 ok; G89 fix: G89f1. pthreads stay on in src/config.h on both pins, a gorge package fixes it after the freeze.
- 69: G89f1, G91, G87 ok; G89 fix: G89f2 (lines that pass only with patches 0003 and 0005 go to a third file). roots-11 joins F66.
- 70: G89f2 ok; G96 fix: G96f1; G64 fix: G64f1; G108 added.
- 71: G96f1 ok (G96 in); G64f1 and G108 as above. Docs committed 2312594; backlog 19,986 of 20,000 bytes.

## What the owner must do
1. Send Parisse patches 0003 and 0006 (0006 is commit 8c6cb63) as commit links. Send the regression-file link only after G108 is merged.
2. Upload the mirror for the new Giac pin (the release command is in engine/giac/README.md; until then the fallback address returns 404, Parisse's folder is tried first). Then annabell runs the release build on the new pin and the golden gate.
3. Check G75's 5fea5df before it is sent.
4. Decide, under Needs the user: the list operators (F79, after G103); the huge or tiny cuts (G103f1); counting a double by perturbation (G60; recommendation: keep shortDigits).
5. The Fairphone's night setup may still be in place (see the report of 2026-10-23, item 2). The older items under "Needs the user" in decisions.md and backlog.md stay open.
6. Morning check: the Tab One run of the core list (A33); A19 by day.

## Queue left for the next night
- G64f1 (backlog entry only), then G108 (both touch export.mjs only through G108), then the queue unchanged; step 130 (S16) after A19.
- Follow-ups without a package: F63 to F67, F72 to F75, F77 to F86.
