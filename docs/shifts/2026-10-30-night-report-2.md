# Night report 2026-10-30, the first two-lane run (08:58 to 18:03)

Pipeline runs 323 to 340, Opus passes 14 to 18. The section starts at 08:58 (`night.sh --lane A` and `--lane B`, both `--until 16:00`) and the log ends at 18:03 with this report. Lane B closed at 16:40 (its last pass was 17, no report), lane A at 17:44 (pass 18, then this report). Eight packages merged, three branches are unmerged. Nothing was pushed.

**Core list:** desktop CORE 66/66 (known 0) at cf087b9 (pass 18). The night's device: **CORE DEVICE 65/65 (known 0, new none) at e3cc2d8 (18:03)**. Earlier device runs: 14, 15 and 16 were 61/65 (c25, c26, c27, c63 failing, backlog F136) at c2008ff, db28c5d and cf49abe; device 17 at cf087b9 (17:13) was the first green one, right after R86 rewrote the Mode rows. Gates at cf087b9: typecheck 0 errors, vitest 2046 passed with 1 expected fail, e2e 1300 passed with 1 skipped and 0 failed. Golden last passed at pass 16 (GOLDEN GATE PASSED at f06774c, on a rerun alone); no later package changed engine or parser code.

## Merged into phase-1
Lane A (ron):
- R15c3 6e43091 (three user Alpha slots; the user's Alpha text stays exempt from the case swap). No fix round.
- R91 split of the start (run 324) was NOT MERGED after two fix rounds; **R91f1 e80eda0** (run 329) finished it on the same branch (the Home test now reaches the tidy fallback; the Settings fast path also needs the sheet keys). Start chunk 57.8 kB gzip. R91 counts as merged.
- R49 d60fbfb (Settings is a level of the pick sheet; Android back goes back one level; a row's hint is its second line; the Settings page and its chunk are gone). Start chunk 57.83 to 57.41 kB gzip.
- R87 56d017f (About › Parts we use, checked against THIRD_PARTY.md by a test; no ISC or UIUC texts, decided).
- R86 cf087b9 (Angle, Format and Entry show one button per value; Digits keeps its list).

Lane B (annabell, gorge):
- A48 3ecd38b (version 0.1.0 / 1 as literals in package.json, build.gradle and the F-Droid recipe, checked by `tools/check-version.sh`; six licence texts in `LICENSES/`). One fix round (shell check). Engine key 8d9ab803aa43df50 (the engine files are unchanged, same wasm hash).
- G135 043afaf (patch 0019: Giac's exact atan on its cut returns the principal value; the cos and tan rules fixed). Two fix rounds (patches README, then a test for the DEG/GRAD branch). Engine key bd090682e1bb6e18.
- A50 f06774c (storage downgrade guard: `kvSet` never puts over a newer DATA_VERSION; the 2 to 3 angle step leaves a degree reading alone). No fix round.

Doc commits on phase-1 (not pushed): c2008ff (pass 14), db28c5d (pass 15), cf49abe (pass 16), e3cc2d8 (pass 18). Pass 17 made none (A49 unmerged).

## Unmerged
- **R4b** (run 335, `p1/ron-m4-vars` at fcc79d3): the code is right; two fix rounds went on the size check and the docs check, and the audit's last finding is that docs/04 section 8.3 and decisions.md line 59 still state the old start-chunk pin (58.5 kB; R4b raises it to 59.25). The branch also conflicts with R86 in `App.svelte`. Pass 18: FIX R4bf1.
- **R57** (run 340, `p1/ron-m4a-decimalcomma` at 3463a8e): two fix rounds on `tokenize.ts`; in comma mode a bare comma followed by a digit still reads as a decimal comma, so `max(1,5)` stored in point mode gives 1.5 after the switch (principle 3, family 2). Pass 18 decided: the mark never changes how text is parsed; a bare comma is always the argument comma. Pass 18: FIX R57f1.
- **A49** (run 338, `p1/annabell-pwaharden` at b0ae918): round 2 fixed all three audit findings; the only failure left is the docs gate's line rule (`App.svelte` is 805 lines, limit 800). Pass 17: FIX A49f1.
- None of the three FIX packages ran: both lanes were closing (only the last pass and the report run then).

## What went wrong
- Three packages needed more than two fix rounds' worth of work (R91, R4b, R57, A49 each hit "NOT MERGED after two fix rounds"); the causes were a test that did not reach the code it names (R91), docs that were at their size budget (R4b, A49) and a real parsing finding (R57).
- Lane B's closing waited 461 s for lane A's pass and lane A's runs waited on integ for up to 822 s: with two lanes every run spent 450 to 1200 s in the queue.
- Flaky first runs under the other lane's load: the golden gate failed its steps and flags stages at load about 10 in pass 16 and passed alone at load 1.7 (A50's worker saw the same two stages fail; pass 16 calls it a third sighting for the census); pass 15's e2e had two failures (softkeyboard F99 Home pagehide, the tap.spec caret test) that passed alone; pass 17's e2e failed the Esc timing test "Esc stops a job before Working… shows" (F116, in isTiming).
- Pass 15 numbered itself 16 for lane B because the number was taken (logged, no harm).

## Opus passes (NOTES)
- 14 (R91, R15c3): R91 fix (two findings hold), R15c3 ok. Decision: R91's 58.5 kB pin holds and is raised only with a reason, never past 61 kB. CORE 66/66 at 6e43091.
- 15 (R91f1, R49, R87): all ok. CORE 66/66 at 56d017f. CORE DEVICE 14 at c2008ff was 61/65 (c25, c26, c27, c63); filed as F136 for annabell by day. Milestone review due.
- 16 (A48, G135, A50): all ok. CORE 66/66 at f06774c. New backlog lines F137 (Giac's half-angle sign for a complex atan, wrong sign under ≈) and F138 (noise real part in CAS DEG `evalf(cos(atan(2*i)))`). Backlog, decisions and docs/04 are at their budgets.
- 17 (A49): fix. CORE 66/66 at cf087b9. FIX A49f1.
- 18 (R86, R4b, R57): R86 ok; R4b and R57 fix. CORE 66/66 at cf087b9. Start chunk: phase-1 is about 58.2 kB gzip, R4b adds 0.87 and R57 0.47, so the pin ends near 59.75 of the 61 kB budget, leaving about 1.3 kB for R50e and R24b to R24d. `App.svelte` will be at about 799 of 800 lines after R4bf1 and R57f1.

## What the owner must do
1. **Milestone review on the Fairphone** (due since pass 15): R91's first screen, R49's Mode › Settings and keypad, R87's Parts we use. R86's Mode buttons belong in the same look.
2. **A49f1 will fail the line rule as written:** its prompt trims only 5 of 27 lines of `App.svelte` and the file must be at most 800. Give it leave to move the update button and its style into a component of its own (pass 18's advice), or A49 stays unmerged.
3. **Before R24:** the start chunk pin ends near 59.75 of 61 kB. Decide whether R50e and R24b to R24d fit in about 1.3 kB, or lazy-load part of them.
4. **F136 (c25, c26, c27, c63 on the device)** passed for the first time on devices 17 and 18; the backlog line goes if the next device run is green too.
5. Backlog, decisions.md and docs/04 are at their budgets; the next Opus pass must cut before it adds. A49's shared-file texts (the kill-switch line in "Needs the user", the docs/04 section 8 line on the worker, the replacement for A45.md line 12) and R4b's and R57's texts (docs/04 sections 3.1, 3.7, 5.1, docs/05 section 3.4, the R4b defaults and the L6 line of decisions.md) are applied by the pass after each merges.
6. By day: add the flake lines to the census (golden under load, softkeyboard F99, the tap caret test); R91's Fairphone before/after measurement waits for annabell; push phase-1 when content (c2008ff, db28c5d, cf49abe, e3cc2d8 and the merges of this night are local).

## Queue left for the next night
- Lane A: R4bf1, then R57f1 (R57f1 merges R4b's pin and its `App.svelte` lines), then 308 R50e, 309 R24b, 310 R24c, 311 R24d. Row 306 (R86) is done and removed.
- Lane B: A49f1 first, then 405 A45 (after R87 and A49). Rows 406–408 (G133, G134, the fuzz and its triage as G136) run only on the weekly extreme night.
- Follow-ups without a package: F134 and F135 (pass 12), F137 and F138 (pass 16); A43 and A7 to A9 run by day.
