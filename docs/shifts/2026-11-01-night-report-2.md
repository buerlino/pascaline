# Night report 2026-11-01 (second), the day-shift run of 2026-11-01 (11:47 to 20:05)

Pipeline runs 454 to 469 (12 package runs), Opus passes 40 to 43. The section starts at 11:47 (`night.sh --lane A` and `--lane B`, both `--until 19:00`, the Tab One) and the log ends at 20:05 with this report. Lane B closed at 19:26 after 10 steps (`NO PASS`, no report); lane A closed after 9 steps (pass 43, then this report). Nine runs merged (one of them a review-only merge); three runs ended NOT MERGED, two of them merged later by a FIX run or a review-only merge, and one (G154) is still open. Nothing was pushed.

**Core list:** desktop CORE 66/66 (known 0, needs 0) at d1a9ca5 (pass 43). The device: **CORE DEVICE 3/65 (known 0, new: 62 cases, c01 onward, only c15, c48, c53, c62 not listed) at 8acd1fe (device 43, 20:05)**. Device 42 (2814eba, 19:26) gave the same 3/65. Devices 40 (744d807) and 41 (42319a8) were 65/65. The cause is R15c4's first-start tips overlay, not the maths: the device runner clears the app and cold-starts it, so the tips cover every case and take its first key. FIX R15c4f1 is written and has not run, so the next device line is expected red until it merges. Gates at d1a9ca5: typecheck 0 errors, `FIND_INDEX=required npm test` 171 files, 3036 passed with 1 expected fail, e2e 1431 passed with 1 skipped, GOLDEN GATE PASSED (invariants 44.3 s; run because R63 changed the parser). Start chunk pin 60.99 kB of 61 kB.

## Merged into phase-1
Just before the section (the day session, 11:00 and 11:47, covered by pass 40): A54f1 260b3ce (`lock_wait` waits for its devlock child in the background, so a trapped TERM/HUP/INT ends a lock wait at once) and G149f1 dfc604d (patch 0025 keeps the root rule for s = 1; F140 and F141 done). The pipeline selftest passed at 11:06 and 11:56.

Lane A (ron):
- R102 ce10926 (Mode's Angle and Format buttons have spoken names; a hidden status line says "busy"; the Ans error text and About's credit come from the i18n table; an unused-key check). Two fix rounds (size, vitest). Pin 60.25 to 60.36 kB.
- R62 355153b (the unit result view's mark comes from Home's `markOf`; a value with σ is never "="; ⚠ shows its digit count; ton and cal keep their chip text). One fix round.
- R63f1 6747238 (carries R63, the way back from the unit view: a unit row's text keeps ± σ and its unit, so Copy as shown on t10's row gives `39.488 ± 1.2 m²`; a unit row with no chip inserts the number alone). Run 459 R63 was NOT MERGED after two fix rounds (the second audit found `display()` adding σ and the unit only to the LaTeX).
- R15c4 3d1ea8d (first-start tips; one fix round for the gallery shots). It broke the device run, see below.
- R55 d1a9ca5 (digit groups only in drawn rows; text, chips, Copy and the comma mode stay plain). One fix round (docs size). Pin 60.99 kB.

Lane B (annabell, gorge):
- A55 717c03f (the no-package-file stop, the questioned-task stop, both tools tests in SELFTESTS, `stay-awake --restore-real`). Two fix rounds (the day command broke the night setting; docs).
- A58 4ee7ec4 (`devlock slice` hands host-cpu to a waiter and keeps stdin; a lock wait past 600 s logs the holder once). One fix round.
- G150 eb1b71a (review-only merge by run 462, `--no-worker`): only tests, because G149's patch 0025 had already fixed F141. Run 458 was NOT MERGED after two fix rounds: the red-first check could not pass on phase-1. The g150 rows fail on the stock engine and match mpmath.
- G151 7992b6c (patch 0026: Giac's `asinh` leaves an exact real below 1/4 unevaluated, so `surd` no longer decides its sign on noise). Shared engine is now key 45a0f9bfc7880149.

Other: `/night-review` skill merged as 19c1c8e (17:36, not pushed). Doc commits on phase-1 (not pushed): 744d807, 42319a8, 2814eba, 8acd1fe.

## Unmerged
- **G154** (run 467, `p1/gorge-zeronotunderflow` at 8a28624): the code is right. Round 1's golden passed; rounds 0 and 2 failed on golden and stages. Pass 42 found round 2 failed only on time limits under two-lane load (canaries 120 s, invariants 71.9 s against 60, 0 new failures) and both pass on rerun at low load (invariants 42.8 s). FIX G154f1 (gorge, Opus) is written: count an invariants item with 0 new as timing so the pipeline reruns it once; drop the decided Needs-the-user entry; the F139 line becomes F161. It did not run.
- No other branch is open. R15c4f1 and R63f2 (below) are new FIX packages for merged work.

## What went wrong
- **R15c4 broke the device core run.** Its report said the device run uses the e2e open helper; it does not. Device 42 and 43 gave 3/65. R15c4f1 fixes it in the device spec only.
- **R63's export has a gap** that pass 43 found after the merge: Share session writes a unit-view row as a wrong equation (`2×π×25 ≈ 0.157079632679`, and t10 loses its ± 1.2 and m²). FIX R63f2 is written.
- Golden time limits under two-lane load cost G150 one round and G154 its merge; the two `g58-factorial-1e6` rows failed at 3.5 s against 2 s at load 8 in pass 40 and passed on rerun.
- G150 (run 458) failed red-first twice because the bug was already fixed; pass 40 settled it with decisions.md G125 (rewrite the package, merge review-only).
- Merge-queue waits: R55 waited 1335 s for integ, G150 1230 s, R15c4 940 s; R63 spent 1498 s in the queue in round 1.
- Lane B's closing found no pass to run (`NO PASS`, pass 42 had already finished at 19:06). Both lanes stopped with FIX packages unrun: the window ended.

## Opus passes (NOTES)
- 40 (A54f1, G149f1, A55, A58, G150): all ok; G150 settled as above. CORE 66/66 at 355153b. The shared-file texts for A54, A55, A58 and G149f1 were applied (744d807); F159 minted (the mark for `DEG sqrt(asinh(asin(3.7)))` depends on the clock).
- 41 (R102, R62, R63): R102 and R62 ok; R63 fix (R63f1). CORE 66/66 at eb1b71a. Start pin set to 60.36 kB. The R62 and R63 gallery states join the next milestone review.
- 42 (G150, G151, G154): G150 and G151 ok; G154 fix (G154f1). CORE 66/66 at 3d1ea8d, golden passed. F160 minted (`surd(atanh(1E-100),3)` gives a complex root, the same cancellation in `atanh`). New default: an underflow Giac cannot size shows ⚠ 0, flagged rather than refused. F158 dropped (devices 39 to 41 green).
- 43 (R63f1, R15c4, R55): R63f1 and R55 ok; R15c4 fix (R15c4f1); R63 gap sent back as R63f2. CORE 66/66 at d1a9ca5; CORE DEVICE 3/65 at 2814eba. docs/04 and backlog.md are at their size limits (69,998 of 70,000 and 19,986 of 20,000 at the last note): the pass that applies R63's report moved settled lines to the archives. Docs commit 8acd1fe.

## What the owner must do
1. **Decide** (decisions.md "Needs the user", backlog item 1): A21's F-Droid answer; R50e's Android system bar colours; R94's note (recommendation: keep it as a history line); R95's "Use here" (show the note as visible text, or keep the rows in sessionStorage across the reload); **R104's `%` key** (no key types it; the Shift + 9 palette is full at 24 cells; recommendation: a fourth row with `%` first). Nothing new this section; passes 40 to 43 added no owner item.
2. **Morning check** on the Tab One ([MORNING.md](../../tests/core/MORNING.md), about 10 minutes). Also look at R15c4's tips on the phone, at 360 px and in the light theme, and at a 12-digit result and `1.034E-5` for R55.
3. **Push phase-1** when content: this section's doc commits and the 9 merges are local, on top of the earlier unpushed work. Parisse email 5 waits for the push.
4. **Milestone reviews:** after R50e (due); after R24d with R108's gallery group "Decimal comma in apps", R101's CAS strips, and now R62's and R63's gallery states.
5. **By day:** the device line stays red until R15c4f1 merges, so run it first; F156, F159, F160 and F161 need packages or a look; A57 after A58 (A58 is merged); A7, A8, A9.

## Queue left for the next night
- First the FIX packages: **R15c4f1** (ron, Sonnet, `p1/ron-tipsdevice`: the device core spec taps "got it" on the tips after a fresh start), **R63f2** (ron, Sonnet, `p1/ron-unitshare`: Share session writes unit rows with their units, tests first), **G154f1** (gorge, Opus, `p1/gorge-zeronotunderflow`).
- Lane A: 338 R103 first (the start chunk is almost full, so R89, R33 and R36 would each fail the size check), then 335 R89, 336 R33, 337 R36.
- Lane B: 435 G155, 436 G153, 437 G152 after G154f1. Row 408 (G138, the weekly fuzz) runs only on the extreme night the owner names.
