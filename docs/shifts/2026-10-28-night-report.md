# Night report 2026-10-28 (thirteenth night, day-long window)

Pipeline runs 279 to 288, Opus passes 1 to 4 of this section. The section starts at 07:36 on 2026-10-28 (`--until 19:36`, on the Fairphone) and the log ends at 14:12 with this report; the shift stopped early because the queue was empty. G113 was started at 22:30 on 2026-10-27 (run 278, red-first stage error), rerun as run 279 and merged at 07:35, so pass 1 audits it. Nothing was pushed.

**Core list:** desktop CORE 63/63 (known 0, needs 3) at phase-1 85b0115 (pass 1), c92838e (pass 2), 810c62d (pass 3) and 2767294 (pass 4). On the Fairphone no device run counted: steps 1 to 4 were all DEVICE SKIPPED (device 4d42e62f not found), so there is no device evidence since 2026-10-27. Gates at 2767294: typecheck 0 errors, vitest 1979 passed with 1 expected fail, e2e 1246 passed with 4 skipped; golden last passed at 810c62d (precision 578/578, 7 pending, calls-home 7.51 per input); not run at 2767294 (no engine or parser change).

## Merged into phase-1
- G113 0aee90e (pmf and cdf at integers; run 279 after run 278 stopped at the red-first stage).
- G114 464817f (census reads seq[…]; F108).
- R72 85b0115 (M4 parse split).
- G113f1 026c2bd (patch 0010: negbinomial_icdf sums the cdf in exact integers; two fix rounds, engine key 824e1f0638d6b70a).
- G115 e6155f8 (patch 0011: atan check for pi/12, F113; engine key 25a3aa0cb5fb2dbe).
- A26 c92838e (docs-check rule 6, links).
- G116 b812262 (fuzzer with edge generator and clock seed).
- G117 e1a5dde (range literal 1..3 survives the round trip).
- G118 810c62d (patch 0012: abs(b)^n keeps the rewrite only for real bases; engine key 6f89b6e4cdebf53e).
- G79 2767294 (G2 checklist cannot drift: `oracle.py --g2 --check`, own gate step g2check).
- Doc commits on phase-1 (not pushed): 26e76d0, d9dd4c7, d1671f3, 3c8321e.

## Unmerged
- None.

## What went wrong
- Pass 1 found G113 incomplete (negbinomial_icdf wrong at exact ties, shown marked exact); G113f1 fixed it.
- G113f1 needed two fix rounds and G115, G118 one each, all for a missing patches README row; G116 and G79 one each for a failing e2e check and a missed case.
- All four device steps skipped: the Fairphone was not connected.

## Opus passes (NOTES)
- 1: G114 and R72 ok, G113 fix (G113f1). CORE 63/63; patch 0009 README row, F93, F108 lines; G114's seq display question put under Needs the user.
- 2: G113f1, G115, A26 ok. An exact negbinomial_icdf past 100000 steps or Home's budget is refused (better than a wrong "="); the refusal shows Giac's "User interrupt or Out of memory" text.
- 3: G116, G117, G118 ok. F119 to F123 filed from the fuzzer; the judge ignores a hidden part under 10^-50 of the value. G117 left hasFloat and names() on F73 (no wrong mark today).
- 4: G79 ok. The check is its own gate step, not inside the docs step; `npm test` now fails on a checkout without tests/golden/.venv.

## What the owner must do
1. Connect and unlock the Fairphone and run the device step (or the morning check); there is no device run since 2026-10-27.
2. Answer G114's question under "Needs the user": show `seq[…]` as one value, or a list if several (recommendation in decisions.md).
3. Send B. Parisse the commit links for patches 0010, 0011 and 0012, and add G113's upstream line to ../outreach/upstream-reports.md.
4. Know that `npm test` needs tests/golden/.venv now (setup line in tests/golden/README.md).
5. Push phase-1 when you are content (nothing was pushed).

## Queue left for the next night
- Steps 190 (last pass) and 191 (report) only; rows 136 to 144 are removed. R4a starts now.
- The release gate (A42) on a quiet host after the engine patches 0009 to 0012.
- Follow-ups without a package: F119 to F123, F63 to F67, F72 to F75, F77 to F89, F99, F101, F103 to F116.
