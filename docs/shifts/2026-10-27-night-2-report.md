# Night report 2026-10-27, second section (twelfth night)

Pipeline runs 268 to 270, Opus passes 84 to 86. The section starts at 01:52 on 2026-10-27 (`--until 07:30`) and the log ends at 04:45 with this report. Nothing was pushed. The after-evening script's day runs before it (A41 242d5f1, A38 26aad73, A18 36a01d5, A22 cfc3275, A27 818fdd7; A30 unmerged then) are audited by pass 84, all ok.

**Core list:** desktop CORE 63/63 (known 0, needs 3) at phase-1 d75a8bc (pass 84) and 13cc2da (pass 86). On the Fairphone no device run counted: steps 84, 85 and 86 were all DEVICE SKIPPED (screen locked), so R82 (c46) is not judged yet. Gates at 13cc2da: typecheck 0 errors, vitest 1945 passed with 1 expected fail, e2e 1222 passed with 4 skipped; golden not run (no engine or parser change); at d75a8bc golden passed at load 2.

## Merged into phase-1
- R82 d75a8bc (F110/c46: the readout keeps a minimum height, keys shrink only on screens up to 700 px high; run 268, one fix round).
- A30 13cc2da (QALC_OUT is gone from the gate, golden, index env and the units stage; review-only run 270 after run 269).
- Doc commits on phase-1 (not pushed): 1aa11e6 (R82 package out, device line out of henri's list, rules section 4 on A18, A38, A41), 93ff675 (A30 package out).

## Unmerged
- None. A30 first ended at "NOT MERGED" in run 269 (four fix rounds over two nights): the audit read a wrong "Checked on" note in its package file, not the code. be658e9 dropped that part of criterion 2; run 270 merged.

## What went wrong
- Three device steps skipped because the screen was locked, so the night has no device evidence for R82.
- A30's golden failures (runs 267) were timing under editor-search load; the gate passed once the host was quiet.
- Flake census 2: vitest 5 of 5 clean, e2e 5 of 5, no flaky test, no backlog lines.

## Opus passes (NOTES)
- 84: A41, A38, A18, A22, A27, R82, A30 ok. R82's real cause on the Fairphone (372×828) was not reproduced; the device step judges it. behaviour-diff.ts (A18) has not run since the G76 refactor; the first engine audit is its test.
- 85: A30 ok, merge review-only again.
- 86: A30 ok. Leftover outside scope: the error message at tools/probes/units-giac.mjs line 90 still tells the user to set QALC_OUT for npm run index.

## What the owner must do
1. Unlock the Fairphone and run the device step (or the morning check) to judge R82: c46 (Function, Plot, ☰ 1 Root).
2. The units-giac.mjs line 90 message is a small leftover; say if it gets a package.
3. Push phase-1 when you are content (nothing was pushed).

## Queue left for the next night
- G113 (F101, F104) after night 2, G114 (census reads seq[...], F108) before R4a, G115 (F113), A43 before A7.
- The release gate (A42) on a quiet host after any engine change.
- Follow-ups without a package: F63 to F67, F72 to F75, F77 to F89, F99, F101, F103 to F116.
