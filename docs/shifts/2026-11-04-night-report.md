<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Night report 2026-11-04, the night of 2026-11-03 (18:37 to 07:24, then the day run to 22:36)

Pipeline runs 549 to 584 (22 package runs), Opus passes 58 to 65. Both lanes ran on the Tab One, `night.sh --lane A` and `--lane B`, `--until 05:30`. Lane B closed at 06:08 after 16 steps (`SHIFT DONE`). Lane A was stopped by the owner at 07:15 (logged 07:23) after 11 steps, with its pass 64 done and device 64 killed, so lane A's closing did not write this report. The three fix packages pass 64 and pass 62 left (R40f1, G148f2) and the owner's R125 question (R125f1) were run by day on 2026-11-04 (20:39 to 22:19), then pass 65 and this report. 19 runs merged (16 at night: 7 in lane A, 9 in lane B; 3 by day). Three runs ended NOT MERGED after two fix rounds (R12b, G161, G163); each merged later through an f1 run. Nothing is open and nothing was pushed.

**Core list:** desktop CORE 66/66 (known 0, needs 0) at e57ee87e (pass 65). The device: **CORE DEVICE 65/65 (new none) at de0a97a4 (device 63, 06:08)**; devices 58 to 62 were also 65/65. Device 64 was killed by the owner's stop (`rc=143`, no RESULT line) and device 65 was `DEVICE SKIPPED` (device lock busy), so R125, R40f1, G148f2 and R125f1 have no device run yet. Gates at pass 65: typecheck 0 errors; `FIND_INDEX=required npm test` 3603 passed with 1 expected fail; e2e 1604 passed with 1 skipped; GOLDEN GATE PASSED (home 578/578, precision 938/938 with 7 pending, units 208/208 with p95 4.52 ms, calls-home 7.70 per input); `npm run size` was not run in passes 62 to 65 (it refused the stale dist).

## Merged into phase-1
Lane A (ron):
- R123 ac81cda5 (while a preset name is typed, hide or kill keeps the half-typed line, not the name; an unreadable presets record shows as Not saved in Settings › Data).
- R12bf1 f4b38029 (carries R12b, run 551: 259 CSS values replaced by tokens, all checked equal, no height changed; decisions.md reads None open; the 8 px between history entries is S25 part 3's).
- R12c d7a745d1 (the press is a layer of the key's own text colour; the sheet rise, the tips fade and the motion tokens are gone). Two fix rounds (e2e; the audit found the press layer also hit the trackpad zone keys).
- R41 d8ea1dfd (key and layer names, loaded lazily; start chunk +310 B; fit.ts unchanged at font scale 1 on 5 sizes). Font scale 1.5 and 2.0 are emulated by multiplying `--fs-*`.
- R40 722a9b45 (muted digits from σ's place, the mark stays ≈, Copy keeps every digit, a user's own `pasl_` or `pasc_` name is renamed through the host's lists). One fix round (the audit: `free()` read Giac's text back).
- R124 405b7271 (Settings › Numbers › Marks: three mark styles, saved in presets and backups, followed by the unit view).
- R125 9731ffc9 (digit-group separator setting for Home, CAS, the unit view and Solve's and Function's readouts; the comma button is off under the decimal comma). Two fix rounds (e2e; the audit found the Solve and Function readouts).

Lane B (gorge, annabell):
- G162 e9eedbac (the fuzz oracle adds 2k digits for inputs holding 10^±k and skips above 2,250 digits with a reason).
- G159 534183c1 (each condition of `piecewise` and `when` counts as a jump at lhs − rhs; golden j09 to j19). Two fix rounds (the size check; an audit FIX: the worker had edited a shared doc).
- A8f2 9624810e (release-verify reads every "certificate SHA-256 digest:" line and wants one distinct value; fakes cover the apksigner 37 form).
- A63 214d861b (the kill run's first step refuses any ref that is not a tag).
- A68 73deda8b (predev rebuilds the Find index only when an input is newer).
- G161f1 b94c8613 (carries G161, run 561: the electrical power kinds W, VA and var; J counts as W; P/S + Q/S and the square root of P squared plus Q squared are refused with their reason, golden p10 and p11). One fix round (docs).
- G148 ebc0d204 (an approx or evalf past MPFR's range is refused; ran a night before its weekly night).
- G163f1 03e302d6 (carries G163, run 569: the unit view's code moved into exactLiterals.ts and precisionFacts.ts; import rule 3 follows value imports through every step; the unit view + shared pin is 66.5 kB).
- G148f1 53456fee (`1/approx(exp(-10^20))` is refused as Overflow, `2*approx(exp(-10^20))` as Underflow; Giac calls per Enter unchanged).

By day on 2026-11-04 (after the owner's stop):
- R40f1 cdf33f3f (the picked row's why-line ends with the row's σ line on keys alone; none with Muted digits). Two fix rounds (e2e; the audit found `.rowwhy` is `nowrap`, so the line must wrap).
- G148f2 057665c0 (`ln(approx(exp(-10^20)))` gives Underflow, `approx(exp(10^20))/exp(10^20)` gives Overflow; the guards `approx(0)/0` and `ln(approx(0))` keep their answers; 87 Giac calls on the 15 default inputs, before and after).
- R125f1 e57ee87e (with ’ or , only the digits before the point are grouped, the thin space groups both sides; start pin +57 B). One fix round (size).

Doc commits on phase-1 (not pushed): c3c14023 (pass 58), d0063b38 (59), 7cc4664c (60), be4464f9 (61), 9551eb0b (62), de0a97a4 (63), b40ffafe (64), cf21b353 (65). The owner session added ab2bf66d (this night's plan).

## Unmerged
None now. Three runs ended NOT MERGED after two fix rounds; Opus passes 58, 60 and 62 judged the code right and wrote the f1 runs that merged:
- R12b (run 551, `p1/ron-m4a-tokens`, kept at ae5c5e13): the last audit FIX was a decisions.md "Needs the user" entry that asked the owner again about 8 px; the owner had settled it on 2026-11-02. Merged as R12bf1.
- G161 (run 561, `p1/gorge-elecunits`, kept at b5eb7e12): the last audit FIX was that `sumMixesPowers` refuses a sum of two power-factor ratios. Pass 60 decided that refusal is honest; merged as G161f1.
- G163 (run 569, `p1/gorge-unitchunk`, kept at 8781d485): the last audit FIX was that the 66.5 kB unit view pin recorded no budget. Pass 62 decided the pin; merged as G163f1.
Device 64 (lane A) was killed by the owner's stop and has no result.

## What went wrong
- **Fix rounds:** R12b, G161, G163 used two and then an f1 run; R12c, R125, G159 two; R40, R40f1, R125f1, G161f1, G163f1 and the others one. Three audit findings re-asked a settled question (R12b, G161, G163) and one flagged a shared doc edited by a worker (G159).
- **Size check:** it failed rounds for R12b, G159 and R125f1 (the start pin).
- **Golden units p95 timing:** G163's round 0 failed on a 5.29 ms p95 against the limit of 5 under load (pass 62). G163f1's round 0 golden failure was fixed by a merge only and its log was already cleaned up (pass 63: not confirmed; if it repeats, it gets a census line and becomes a timing rerun). Pass 60 saw the known F115 timing flake in `converge.test.ts` at load 26.
- **Merge-queue waits** were long, up to 1626 s (G161), 1477 s (G163) and 1329 s (G148f1).
- **Owner stop:** at 07:15 the owner stopped the night; device 64 and lane A's closing report were lost, and the pipeline logged `NOT MERGED (device 64: no RESULT line, rc=143)`.
- **Device 65** was skipped because the device lock was busy.

## Opus passes (NOTES)
- 58 (R123, R12b): R123 ok; R12b fix (R12bf1). CORE 66/66 at 9624810e; golden not run. Docs c3c14023 (S25 part 3 holds the 8 px question).
- 59 (G162, G159, A8f2): all ok. CORE 66/66 at c3c14023. **Watch:** after G159 an unread condition or a kink written as cases (|x|) gets "reaches a jump", which is safe but sometimes the wrong reason; the palette's `==`, `≠` and `ifte` are still refused in the unit view. Docs d0063b38. A day task: move `v0.1.0-test` to 9624810e or later and run A8's after-merge steps again, then A70.
- 60 (A63, G161, A68): A63 and A68 ok; G161 fix (G161f1). CORE 66/66 at 73deda8b; one converge.test.ts timing failure at load 26. Docs 7cc4664c.
- 61 (R12bf1, R12c, R41): all ok. CORE 66/66 at d8ea1dfd. R41's status line at font scale 2.0 is a default that waits for the device; a backlog line asks annabell's next device run to try TalkBack and the status line at 2.0. R12b's optional default is not in (decisions.md is full). Docs be4464f9.
- 62 (G161f1, G163, G148): G161f1 ok; G163 fix (G163f1); G148 fix (G148f1). CORE 66/66 at 9551eb0b. Docs 9551eb0b (nine built entries shortened, full texts in the archive).
- 63 (G163f1, G148f1): G163f1 ok; G148f1 ok, with two silent values already wrong before it (G148f2). CORE 66/66 at 53456fee. Docs de0a97a4.
- 64 (R40, R124, R125): R40 fix (R40f1: σ only by touch breaks docs/05 section 3 rule 1); R124 ok; R125 ok, with the grouping question for the owner (R125f1). CORE 66/66 at 9731ffc9. Docs b40ffafe (the seven-row rule binds a level of settings; a list level such as Your keys scrolls).
- 65 (R40f1, G148f2, R125f1): all ok. CORE 66/66 at e57ee87e. Docs cf21b353: R125 moved out of Needs the user; R124's four defaults, G161 (J counts as W) and G163's 66.55 kB pin are confirmed by the owner on 2026-11-04. **New bug F171** in the backlog (not verified in the pass): the why-line shows a Greek constant chip by its LaTeX name, so G times α reads "≈ uses G (± …), \alpha (± …)". No package yet.

## What the owner must do
1. **Decide:** decisions.md "Needs the user" is empty; the defaults the passes recorded are in decisions.md. F171 needs a package or a look.
2. **Morning check** on the Tab One ([MORNING.md](../../tests/core/MORNING.md), about 10 minutes): the device core list was 65/65 at de0a97a4, before R125, R40f1, G148f2 and R125f1. Look at R124's mark styles, R125's digit groups with ’ and , (the digits after the point stay plain), R12c's key press, R41's names, R40's σ line.
3. **Push phase-1** when content: this night's 19 merges and the eight doc commits are local on top of earlier unpushed work.
4. **Milestone reviews:** the R124 and R125 gallery groups join the review after R24d; R12b's and R12c's changes join the review after R50e.
5. **By day:** `v0.1.0-test` to 9624810e or later with A8's after-merge steps, then A70 (pass 59); the next device run tries TalkBack and the status line at font scale 2.0 (pass 61); the lock was busy for device 65.

## Queue left for the next night
The weekly extreme night, Wed 11-04 to Thu 11-05, `--until 08:00`, both lanes on the Tab One (brief 0c):
- Lane A: 439 A60, 440 A59, 470 A62, 471 R127.
- Lane B: 449 G141, 450 G142, 452 G160, 408 G138 (the weekly fuzz; G162 is merged), 451 G156 (after G141), 437 G152 (after G142), 472 G164. G138's triage should include integrals near zero (the 11-03 watch on patch 0029 part 4).
