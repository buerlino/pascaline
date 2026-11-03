<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Night report 2026-11-03, the night of 2026-11-02 (19:45 to 06:30)

Pipeline runs 516 to 543 (17 package runs), Opus passes 51 to 57. Both lanes ran on the Tab One, `night.sh --lane A` and `--lane B`, `--until 05:30`. Lane B closed at 06:15 after 11 steps (`SHIFT DONE`); lane A closed at 06:30 after pass 57, then this report. 15 runs merged (9 in lane A, 6 in lane B); 2 runs ended NOT MERGED after two fix rounds (R115 and R121), both merged later in the same night by an f1 run. Nothing is open and nothing was pushed.

**Core list:** desktop CORE 66/66 (known 0, needs 0) at 31d042c3 (pass 57). The device: **CORE DEVICE 65/65 (new none) at 721c1c1d (device 57, 06:30)**; devices 51 to 56 were also 65/65, and none was skipped. Gates at pass 57: typecheck 0 errors; `FIND_INDEX=required npm test` 186 files, 3347 passed with 1 expected fail; e2e 1549 passed with 1 skipped; GOLDEN GATE PASSED (units 186/186, parser 646/646 with 2 known gaps, precision 919/919 with 7 pending); size check passed, start chunk 59.33 kB gzip against the pin of 59,380 B.

## Merged into phase-1
Lane A (ron):
- R113 204c7355 (the tips' rings are centred on what the control draws, with no fixed offset).
- R92 77746d89 (Constants and Tools are the menu's last two rows; a picked constant goes on Home's line through Find's pick path). Backlog has a line for the disabled UPART row.
- R116 20f2fb4c (MathLive's caret, the bracket's box and the selection take our theme tokens; `--pick` regenerated in the theme files; theme audit 40 of 40). Two audit FIX rounds (a criterion in App.svelte and the gruvbox/solarized files; an e2e that could pass on an inherited colour).
- R117 c53b81eb (Del before AND deletes the word; a one-letter function call name parses and is drawn upright).
- R118 bf812ca6 (unit slot keys; the text is in docs/05 only, docs/04 being at its budget).
- R119 0c3889a5 (undo and redo per view; Cmd counts as Ctrl on a Mac).
- R120 321fb5f1 (the unit view draws its value, σ and sub line with the decimal comma and R55's thin-space groups). One fix round (size check).
- R122 c28862a6 (a restore accepts an older backup that lacks a look or haptics field; nested fields checked against own rules, `__proto__` refused; a web save counts as saved only when the picker wrote it). One fix round (an audit FIX: the rule lookup reached inherited properties).
- R121f1 d831dbdb (carries R121, run 535: a unit result names the stored name it read, a user function too; names come from Giac's tree through the bridge, P20; each units Enter makes 3 Giac calls instead of 2; start pin 59,380 B).

Lane B (gorge, and ron for the unit view):
- G157 0060f4d3 (patch 0028: `trunc` is toward zero and a name stays unevaluated). One fix round (vitest). Shared engine key fca38bfa7b8afe5a.
- R114 39195704 (hardware paste into the entry line; docs/04 2.6 names every system paste).
- G158 3b6bc58d (`sem` of a one-element list). One fix round (the docs check).
- G157f1 29f79641 (patch 0029: a definite integral splits `trunc` at its jumps; the golden values 2, 0, 0, 5/8 and -2 were checked by hand). One audit FIX round. Shared engine key d98cb03da28d43ac.
- G158f1 afa633b0 (`percentile` with the wrong number of arguments is refused in our words; the g42 cases are unchanged).
- R115f1 424f3fae (carries R115, run 534: a sigma chip is written as `pasupm` with the chip's name as third argument, one input per key; start pin 59,305 B, then 59,380 B by R121f1).

Doc commits on phase-1 (not pushed): 8bf62789 (pass 51), 5a689575 (52), de6bca4b (53), 7382a740 (54), a0380b9f (55), 31d042c3 (56), 721c1c1d (57). The owner session added 0c18e67f, 7b80b5f4 and b544874b at 20:04 to 20:07 (brief rows 457 to 463; github-pages allows only `v*`).

## Unmerged
None. R115 (run 534, `p1/ron-chiponce`) failed the size check by 20 B (59.25 kB against the pin 59,235 B) after its two rounds, and R121 (run 535, `p1/ron-unitnamenote`) was refused after two rounds (e2e in round 1; the audit in round 2 found that a user function is never named). Opus passes 54 and 55 judged the code right and wrote R115f1 and R121f1, which merged.

## What went wrong
- **Fix rounds:** R116 used two fix rounds, G157, G158, R120, R122 and G157f1 one each; R115 and R121 used two and then an f1 run. R115 and R121 both ended on the start-chunk pin; docs/04 8.3's rule (measured size plus 0.05 kB) settled both, so no decision was needed.
- **Merge-queue waits** were long, up to 1377 s (pass 54), 1375 s (R121) and 1291 s (G158); at 01:54 the log shows `integ held by ? for 6862 s` for a moment, a holder name that was not read.
- **Load at pass 52:** the full golden gate failed at its steps stage (2 new findings, load average about 10); that stage alone passed with 0 new findings.
- Pass numbers: henri asked for 52 and 56 twice; the pipeline renumbered them to 53 and 57.

## Opus passes (NOTES)
- 51 (R113, R92, R116): all ok. CORE 66/66 at 20f2fb4c. A comment in tips.spec.ts says "2 px" where the code uses 1 px. Docs 8bf62789 (eight older decisions lines moved to the archive for room).
- 52 (G157, R114, G158): R114 ok; G157 fix (G157f1: `int(trunc(x),x,-1/2,5/2)` showed `= 3*trunc(x)`); G158 ok, its open question settled as G158f1. F168 and F169 added. CORE 66/66 at c53b81eb. Docs 5a689575.
- 53 (R117, R118, R119): all ok. CORE 66/66 at 0c3889a5. Docs de6bca4b.
- 54 (G157f1, G158f1, R115): G157f1 and G158f1 ok; R115 fix (R115f1). CORE 66/66 at 321fb5f1. **Watch:** patch 0029 part 4 accepts an exact integral below 1E-8 when the numeric check is within 1E-5 of the integral of |f|; where the exact value is wrong by less than that, Home shows `=` instead of the earlier pair. No case found; the weekly fuzz (G162, G138) should include integrals near zero. F168 removed, F170 added (`limit(trunc(x),x,-1,1)` shows -1, right 0). Docs 7382a740.
- 55 (R120, R121, R122): R120 and R122 ok; R121 fix (R121f1). CORE 66/66 at c28862a6. R122's docs/04 sentence and done line were not applied (docs/04 at its budget; no backlog line). Docs a0380b9f.
- 56 (R115f1): ok. CORE 66/66 at d831dbdb. docs/04 8.3's start-chunk row now points to `START_PIN_GZIP` in size-check.ts instead of a number. Docs 31d042c3.
- 57 (R121): ok. CORE 66/66 at 31d042c3. The Home row stores its names note as finished English text while the other unit note is a key: matters only with a second language. A units-mismatch error from a stored name gets no note. Docs 721c1c1d.

## What the owner must do
1. **Decide:** decisions.md "Needs the user" is empty; the defaults the passes recorded (R92, R116, R117, R119, G158) are in decisions.md.
2. **Morning check** on the Tab One ([MORNING.md](../../tests/core/MORNING.md), about 10 minutes): the device core list was 65/65 at 721c1c1d. Look at the lifted `--pick` (the History picked row is cyan in Gruvbox Light), R113's rings, R92's Constants and Tools rows, and R120's decimal comma.
3. **Push phase-1** when content: this night's 15 merges, the seven doc commits and the owner session's three are local on top of earlier unpushed work. Parisse email 5 waits for the push (backlog item 2).
4. **Milestone reviews:** after R50e (with R116's gallery groups and R113's rings) and after R24d (with R92, R120's gallery shot unitresult-t10-comma, R89, R111 and R33's colour); both are listed in brief 0c.
5. **By day:** the test tag on 11-03 (v0.1.0); A8 and A57; F162, F166, F167, F169 and F170 need packages or a look.

## Queue left for the next night
- Lane A: 461 R123 (presets: a typed name is never the kept line), ron, Opus; R124 to R131 and A63 to A68 have package files and wait for the owner's rows.
- Lane B: 446 G162 (the fuzz's cancellation families), 447 G159 after R115 (now merged), 462 G161 after G159, 463 G163 after G159 and G161; A60 and A59 (annabell) by their rows. Steps 448 to 452 and 408 (G138, the weekly fuzz) run only on the weekly extreme night, Wed 11-04; G138 waits for G162, and its triage should include integrals near zero (pass 54's watch).
