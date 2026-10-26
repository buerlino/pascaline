# Night report 2026-10-27 (twelfth night)

Pipeline runs 257 to 261, Opus passes 82 and 83. The section starts at 18:53 on 2026-10-26 (`--until 07:30`) and the log ends at 23:54 with this report. night.sh died between 19:48 and 19:55 (its terminal closed) and was resumed at 20:24 by the after-evening script; run 259 carried on alone. Nothing was pushed. Day run 256 (G112f1, bb23ad6) is not counted here.

**Core list:** desktop CORE 63/63 (known 0, needs 3) at phase-1 cd112ee (pass 83). On the Fairphone 6 CORE DEVICE 62/62 (known 0, new none) on cd112ee (device run 82) and on a794d13 (device run 83). No Tab One run tonight. Gates at cd112ee: typecheck clean, vitest 1927 passed with 1 expected fail and 2 failed (G39 `3*int(1/x)`, `10^1000000+7`; both timing tests), e2e 1219 passed with 4 skipped. Golden failed on time only (steps, home, precision, invariants, units), with no answer different from pass 82; the host ran at load 25–45 from two runaway editor searches, so golden was not rerun on a quiet host.

## Merged into phase-1
- S24 16dfd96 (core cases c61–c66 added to tests/core).
- A39 258650b (gate timing).
- A19 bf4e635 (Giac's own check suite as a probe; merged after two fix rounds, checks failed on golden and docs first).
- A42 cbb636e (tools/release-gate.sh: the release engine through the gates; meets P23's release-engine bar).
- A19f1 cd112ee (the quiet-end colon in the check runner, normalize#9 and #15 gone from the known file, golden path lists completed).
- Doc commits on phase-1 (not pushed): 25ba65c, a794d13.

## Unmerged
- Nothing from tonight. Step 130 (S16) ran as Opus pass 82's volume sweeps (G61–G64, A19) and is done.

## What went wrong
- night.sh died with its terminal at about 19:50; resumed by .tasks/after-evening-2026-10-27.sh. A19 round 0 failed golden, round 1 failed docs, round 2 merged.
- Flake census FLAKES 1 (23:19): vitest 1 of 5 runs clean, e2e 0 of 5. Pass 83 found it measured the host's load, not the code (10-25: 5 of 5 clean at load 5). Five wall-clock tests joined isTiming (F116); the census also hides a test that fails in every run (Esc before Working…, 5 of 5).

## Opus passes (NOTES)
- 82: G61, G62, G63, G64 ok; A19 fix: A19f1. S16 at volume (seeds 20752–20754): new wrong answers from Giac F111 (`abs(acos(pi))^2` shows -3.28), F112 (`asin(cos(asin(10)))`), F113 (DEG `atan(cos(0.001))` shows 45 marked exact), F114 (`asin` at 10^5040); four new hangs under F62. The view sweep cannot run at volume (G94: count 300 crashed the engine after 224 s). r16's end mark (a 50,000-input sweep with no new false mark) is not met. F113 deserves a Giac patch package (P19) after the freeze's core steps.
- 83: A42 ok (stages in order, release engine only, host-cpu held; Giac's check suite: gsl 73 differences, release 75, all on the known list). A19f1 ok (Giac's check suite on phase-1: 0 new, 0 gone). New F115 (Home `3*int(1/x,x,-1,1)+1` at the default budget shows ⚠ 1, unchecked, not the refusal), F116.

## What the owner must do
1. Close the editor's runaway ripgrep searches before a census or a release run; rerun the release gate (A42) on a quiet host after any engine change.
2. Morning check 2026-10-26 failed c46 (Fairphone 6: Function, Plot, ☰ 1 Root: the root panel sits under the RAD area and is hidden; CORE DEVICE does not see it covered). Backlog line F110 is still to be written on phase-1; check c46 again after the fix.
3. Decide whether F113 gets a Giac patch package now or after the freeze's core steps.
4. Push phase-1 when you are content (nothing was pushed).

## Queue left for the next night
- Day packages A41, A38, A18, A22, A27, A30 (after-evening script), then G113 (F101, F104) after night 2, G114 (census reads seq[...], F108) before R4a, A43 before A7.
- A golden run and a flake census on a quiet host (tonight's measured load).
- Follow-ups without a package: F63 to F67, F72 to F75, F77 to F89, F99, F101, F103 to F116.
