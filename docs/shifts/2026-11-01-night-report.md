# Night report 2026-11-01, the two-lane run of 2026-10-31 (18:09 to 10:29)

Pipeline runs 403 to 446 (28 package runs), Opus passes 30 to 39. The section starts at 18:09 (`night.sh --lane A` and `--lane B`, both `--until 09:00`, the Tab One) and the log ends at 10:29 with this report. Lane B closed at 10:28 after 16 steps (its last pass was 39, no report); lane A closed after 24 steps (pass 38, then this report). 22 runs merged; six ended NOT MERGED, four of them merged later in the night by a FIX run or a review-only merge, two are still open. Nothing was pushed.

**Core list:** desktop CORE 66/66 (known 0, needs 0) at be30335 (passes 38 and 39). The night's device: **CORE DEVICE 65/65 (known 0, new none) at 11ac169 (device 39, 10:28)**. Device runs 30 to 39 were 65/65 except device 38 (be30335, 09:48): **64/65, c39 failed once** (a key tap timed out after 3 s with the line empty, `helpers.ts:58`; green on devices 31 to 37 and 39 and on desktop; backlog F158, a second red goes to annabell). Gates at be30335: typecheck 0 errors, `FIND_INDEX=required npm test` 167 files, 2992 passed with 1 expected fail, e2e 1398 passed with 1 skipped, GOLDEN GATE PASSED (pass 38: parser 638/638 with 2 known gaps, units 180/180). Start chunk pin 60.25 kB (R97, kept in pass 37). A56's first real device run (device 31) passed, so the device runner's own tree works.

## Merged into phase-1
Lane A (ron):
- R106 d42c945 (no history save before the restore has read it; `historyRead` flag).
- R71f1 3499958 (carries R71: ± types on the Home and CAS line, dimmed in an app; Enter on `2.5 ± 0.1` outside units mode says "± is read in the unit view" instead of the parser's "unexpected token at pm"). Run 404 R71 was NOT MERGED after two fix rounds (the audit asked for a docs/06 edit, a shared file); pass 30 applied it (0a13749).
- R93 2fcb7bc (a failed IndexedDB read is its own result; later writes to that key are dropped).
- R94 bff9bbe (a newer settings schema is never written back; DATA_VERSION 3 to 4). One fix round (size).
- R109 1032dfb (the Esc wall-clock test goes through the app's own key path).
- R95 341d9e8 (every store write goes through `guardWrite`; hand-over between two tabs). One fix round (docs/04 6.2).
- R107f1 70ef63d (carries R107: a hardware `<`, `>`, `!`, a dead key and a bracket-leaving `)` or `|` count as presses; start chunk +0.04 kB). Run 421 R107 was NOT MERGED after two fix rounds (its tests never checked the count).
- R108 5e3d7f8 (Solve, Function Num and the readouts drawn with the decimal comma; Copy and CSV use it).
- R99 e754723, R99f1 8f294fc (decimal-comma entry: `{,}5` is `.5`; an empty Num line in Function does nothing; Solve's Num line shows the comma form). R99 had one fix round (size).
- R100 1deea7f (Copy and Paste in comma mode: lists as `{1,5;2}`). One fix round (Copy exact).
- R97 5338ed9 (App.svelte down to 530 lines; gallery matched 38 of 38; start pin 60.25 kB).
- R105 8ceb8c0 (a core case that expects a list needs every row seen), R104 0635cbc (`± n %` gives σ = |value|·n/100 exactly; before, `2 ± 10 %` gave `0.02 ± 0.1`), R101 17f3879 (the Alpha slot shows what Alpha types, in CAS too).

Lane B (annabell, gorge):
- A53 acef842 (the behaviour-diff stage builds each tree's own host and engine; one fix round).
- A56 cc1bbfe (the device runner gets its own tree at the built sha), A56f1 c382ae2 (gc collects kept device trees after 2 days).
- G139 66ba9b9 (eseries and sigfig decide on the exact x; `pasesb` protected). Run 415 was NOT MERGED after two fix rounds (golden timing only, every value right); run 430 merged it as a review-only merge.
- G140f1 d578f5b (carries G140: complex Psi, Beta, erf, erfc and the double inputs, patch 0024; `negbinomial_cdf-2.5-30` is a known regress line). Run 420 G140 was NOT MERGED after two fix rounds (golden regress). The shared engine is now key 5b62c81b36cd6643.
- G143 98ca7ed (the unit view shows ⚠ "the interval reaches a jump" for floor, round, sign, ceil, trunc, frac, Heaviside).
- A52f1 2d34033 (a kill run of the pages workflow skips the golden gate; the version check still runs).

Doc commits on phase-1 (not pushed): 50d88c5, 0a13749, 24212e8, 8a66043, 3689872 (the day session's, 23:32: the owner's evening answers), fe1ef2b, ffbbc8b, 7644109, c4139ea, 4f5a00c, be30335, 11ac169.

## Unmerged
- **A54** (run 437, `p1/annabell-ownedchildren` at 9961b47): the owned sessions, the host-cpu cleanup and the census check are right. One finding stands, confirmed by pass 39: `lock_wait` (`pipeline-lib.sh:153-163`) waits in the foreground, so the new TERM/HUP/INT traps are held back; under `timeout -k 60` a run waiting for a lock is KILLed with no EXIT trap and leaves integ and nodemods held (a regression against phase-1). FIX A54f1 (annabell, Sonnet) is written. A55 and A58 wait for A54.
- **G149** (run 440, `p1/gorge-powimag` at fab5654): patch 0025 is right for F140 and F3 (values match mpmath at 40 digits), but `pow_root_extract_holds` refuses the rule for s = 1 when b is not a proven real, so `sqrt` prints as a power in three cases. FIX G149f1 (gorge, Opus) is written. G150 waits for G149. The branch's engine (key d17f2c59c9332f3d) was not shared.
- Neither FIX ran: both lanes were closing.

## What went wrong
- Golden timing limits and wall-clock tests fail while the other lane works: G139 round 2 (invariants 65.5 s against 60, units p95 7.93 ms against 5), G140 round 2 (`g58-factorial-1e6-30` over its time budget), pass 32 (units p95 5.82 ms, green on rerun at load 3.0), the Esc tests at load 23.7 (pass 31). All values were right. R109 fixed the Esc test; the golden limits are a new backlog line (the pipeline does not rerun them).
- Merge-queue and host-cpu waits: R106 waited 2472 s for host-cpu and spent 3059 s in the queue; R71 1134 s for host-cpu; integ waits up to 1289 s.
- Pass 30's gate script released the host-cpu lock from a wrong path; the pass released it by hand.
- Six passes took a number that was already taken (29 to 31, 31 to 32, 33 to 34, 35 to 36, 36 to 37, 37 to 39): logged, no harm.
- Lane A stopped with R102 (row 329) not run; lane B with A55, A58, G150, G151, G154, G155, G153, G152 not run: the window ended.

## Opus passes (NOTES)
- 30 (R88f1, R71, R106): R88f1 and R106 ok; R71 fix (R71f1, docs/06 applied). CORE 66/66 at 50d88c5. Device run 29 had been DEVICE SKIPPED (A56's problem). Decided: ± is live on the Home and CAS line.
- 31 (R61f1, A53, A56): R61f1 and A53 ok; A56 fix (A56f1). CORE 66/66 at cc1bbfe. Two Esc timing tests failed under load.
- 32 (R71f1, R93, R94): all ok. CORE 66/66 at bff9bbe. Start pin 59.47 kB. R94's note is an owner item.
- 33 (R109, R95, R107): R109 and R95 ok; R107 fix (R107f1). CORE 66/66 at 341d9e8. R95's "Use here" question is an owner item.
- 34 (A56f1, G139, G140): A56f1 and G139 ok; G140 fix (G140f1). CORE 66/66 at 70ef63d. Decided: ⚠ 12 to 13 digits for complex Psi, Beta, erf, erfc; `negbinomial_cdf` rows go from ≈ to ⚠ (Giac's incomplete Beta is a C double).
- 35 (R107f1, R108, R99): R107 and R108 ok; R99 fix (R99f1). CORE 66/66 at 98ca7ed; GOLDEN GATE PASSED (parser 631/631).
- 36 (G140f1, G139, G143): all ok. F156 minted: Giac rewrites `trunc` of a name as `floor`, so `subst(trunc(x),x=-13/10)` gives -2 (right -1); needs a package with a Giac patch (P19).
- 37 (R99f1, R100, R97): all ok. CORE 66/66 at 5338ed9. A one-element decimal list `{1,5}` stays refused on Paste in comma mode (docs/04 2.6). F157: Ctrl+V on the entry line is MathLive's own paste.
- 38 (R105, R104, R101): all ok. CORE 66/66 at be30335. R101's two CAS strips in the gallery were not rendered.
- 39 (A52f1, A54, G149): A52f1 ok; A54 and G149 fix (A54f1, G149f1). CORE 66/66 at be30335; CORE DEVICE 64/65 on device 38 (F158).

## What the owner must do
1. **Decide** (decisions.md "Needs the user", backlog item 1): A21's F-Droid answer; R50e's Android system bar colours; **R94's note** (recommendation: keep it as a history line, the status line has no text slot); **R95's "Use here"** (the tab reloads, so rows typed while read-only are lost: show the note as visible text, or keep the rows in sessionStorage across the reload); **R104's `%` key** (no key types it; the Shift + 9 palette is full at 24 cells; recommendation: a fourth row with `%` first; until then `± n %` needs a hardware keyboard).
2. **Morning check** on the Tab One ([MORNING.md](../../tests/core/MORNING.md), about 10 minutes); tell the day session what failed.
3. **Push phase-1** when content: the twelve doc commits above and this night's 22 merges are local. Parisse email 5 waits for the push.
4. **Milestone reviews:** after R50e (due); after R24d with R108's gallery group "Decimal comma in apps" (and R101's CAS strips, unrendered).
5. **By day:** F156 needs a package (Giac patch at the cause); F157, F158 and the golden-timing line are new in the backlog; A57 after A58; A7, A8, A9. A53's trigger was answered (ten minutes, 23:32).

## Queue left for the next night
- Lane A: 329 R102 (spoken names and strings; R97 is merged), the only row left.
- Lane B: A54f1 (`p1/annabell-ownedchildren`), then G149f1 (`p1/gorge-powimag`); then 425 A55 and 427 A58 (after A54), 417 G150 (after G149), 418 G151, 419 G154, 428 G155, 420 G153 (after G140 and G141), 421 G152 (after G142). Row 408 (G138, the weekly fuzz) runs only on the extreme night the owner names.
