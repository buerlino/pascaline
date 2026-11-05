<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# R129 report: the mockup of results mode, the six keys and the room (ron, 2026-11-05)

Pipeline run 650, branch `p1/ron-resultsmockup`. The page: [mockups/results-mode.html](../mockups/results-mode.html), built from [r19](../research/r19-results-and-keys.md) and [S25's report](2026-11-05-sandra-resultskeys-report.md). Nothing in `app/src` changed.

## Needs the user

Pick one per section; S25's recommendation first.

- **Keys:** K1 (recommended: Undo | Redo and Copy | Paste each one tap, ⇤ | ⇥ on Shift) · K0 (today) · K2 (⇤ ⇥ off the keys, four free Shift cells, no jumps on a long line). The pick is final (keys move once). K0 beats K1 only if ⇤ ⇥ taps outnumber Redo + Paste; R127's per-key counts on the owner's phone (Settings › Counters) are not read yet.
- **Results mode:** W (recommended: today's rows plus the stored name, which keeps its unit and σ) · W2 (one line per step; loses the 2D result).
- **Room:** R2 + R3 at every size with R1 below 760 px tall (recommended) · R2 alone · R1 + R2 · today.

## Done

- The page renders offline (inline CSS and JS, system fonts, no request); Dark / Light / Both bar and a Scale button; every phone 1:1 at 412 × 839 and 360 × 740.
- Keys K0, K1, K2 with r19's press table (`results-keys.mjs`); results mode W and W2 on five RC-filter steps, viewport 767 px and 668 px (`results-geometry.mjs`); room today, R1, R2, R1 + R2, R3, R2 + R3 with the keypad at its measured rows and gaps and the 0.35 floor as a line.
- Linked from docs/README.md's mockup line.
- Honest numbers: heights nobody measured (name tag, reason line, W2's row) are drawn dashed and labelled; the page states no row-count ratio (r19: "about twice, to verify" in R53b). Every result carries ≈, since a stored name's facts are never exact (`chipFacts.ts:72`).

## Numbers

Start chunk size: not changed (no `app/src` file).

## Not done

W's and W2's row heights and the row counts they fit are not measured (R53b). Tests: none apply (a static docs page); `node tools/docs-check.mjs` run.
