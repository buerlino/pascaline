<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# R19: results mode, the six top-right keys and the viewport room (S25)

**Status (2026-11-05): open.** The owner picks from R129's mockup: the keys (K1 recommended), what results mode shows (the worksheet, W), the room (R2 + R3, R1 below 760 px). Then R53 is rewritten (the report).

*sandra, S25, base `phase-1` 6ce82ab8. Counts follow docs/04 5.2. Probes: `node tools/probes/results-geometry.mjs --options`, `node tools/probes/results-keys.mjs --ends`. Detail tables: [the report](../shifts/2026-11-05-sandra-resultskeys-report.md).*

## 1. What results mode is for

**Today, keypad up** (`route.ts:164-204`, `History.svelte:62`, `actions.svelte.ts:250-293`): a tap on a result inserts it, on an input recalls it (1 press); a long press (500 ms) and an item does Copy, Delete, Store ▶ (2); ▲ walks rows by keys (k + 1 for the row k back); Undo or the note row brings back a delete (1, R98).

**S9's mode** (View, a tap picks, a button, the slice back) costs 4 per single action (3 when Insert, Recall or Store ▶ bring the keypad back): **never fewer presses than touch today on a visible row** (`results-keys.mjs`). It wins only on rows the keypad hides, one scroll drag each, and those are many: the history shows **2.50 rows of 1÷3 at 412 × 839 and 1.36 at 360 × 740**, **1.9 and 0.76 with a picked row** (`results-geometry.mjs`). Collapsed it shows 5.4 more.

**So the mode's job is the overview of the chain, not single actions.** Paper beats us on the chain of steps, named values and formula first (decisions.md, 2026-11-02 point 1). Per job:

| Job | Today | In the mode | Removal test (S9's counters, `uses`) |
|---|---|---|---|
| pick, copy, reuse, delete | 1–2 by touch | the same + 2 per visit | `pick`, each action while collapsed |
| undo a delete | 1 | 1 (the note row) | none: R98's |
| Plot a CAS row | none | 2 + 2 (R53) | `plot`, `plotUp` |
| unit check | ▲… + units key | brings the keypad back: no gain | not in the mode |
| **name a step** | Store ▶: unit and σ lost | the row shows its name | `name` (new) |
| **export** | ☰ 8 Share: one line per row | the same | `share` (new) |
| move, merge | none | no gain (r13 1.3) | not built |

**Named values (fh-1 b).** Outside units mode a result chip is its number (`parse.ts:548-552`), and Home has no units (`units/chip.ts:5`), so `chip ▶ A` stores 20, not 20 m/s, and drops σ; the name's facts are "never exact" (`chipFacts.ts:72`), so the mark stays honest. In the unit view a slot after a name is refused (R28 default 3; archive decisions "R28 defaults"), while a `\res` chip gets a slot filled with its unit (`unitFormula.ts:162-169`, R63). **Recommendation:** a name stored from a unit result keeps its unit and σ, and in the unit view it is read as a `\res` chip is (R28 default 3 changes for such names only). It is the paper chain with units, and σ stays (principle 3). Cost: the stored name's record and the backup and library formats (S4) grow, a gorge and a ron package. The end-to-end loss is **(to verify)**: an e2e (t10's keys, ☰ 4, A, Enter, then A × 1) in that package's red-first test.

**Live recalculation, parked.** What would block it later: Store ▶ copies a value, not the step (`actions.svelte.ts:231-235`); a chip is a value (docs/04 2.8). Only a row that uses a name could be recalculated, so a stored name should record its source row. That is cheap now and is the one thing to keep.

**Export.** Share writes `input mark result unit` per row (`clipboard/text.ts:139-155`), so the marks and units are there. Missing for a readable report: σ, the names, and template LaTeX (backlog F180).

**What the mode shows (W, recommended):** each row as today (formula, result with mark, unit and σ) plus its name when stored, the picked row's line of six (S9), in a viewport of 767 px at 412 × 839. **Alternative W2:** one line per step (name = result unit, formula muted). A flat row is 64.8 px today (two lines, pitch 74.8); one line would hold about twice the rows, **(to verify)** in R129's mockup, but it loses the 2D result.

## 2. The six keys

Today (`spec/keyboard.yaml:88-111`): View | Esc, Undo | Copy, ⇤ | ⇥ on tap; Help, Clear, Redo, Paste, ⇤□, □⇥ on Shift. The task list uses none of them (`tests/tasks/tasks.yaml`), so no layout changes a task's count. **The G2** (`spec/mapping/vc-2026-10-11/keys.yaml:14-29`) puts Copy and Paste on one layer (Shift) of two keys, View r2c4 and Menu r3c4. Esc | Clear is its r1c5. It has no Undo, Redo, ⇤ or ⇥ key in the cluster, and Shift + ▲ picks the top history row.

**Checked in the app** (`results-keys.mjs --ends`, line 12+3/4+56): ⇤ → 0, ⇥ → 11, Shift + ⇥ and Shift + ⇤ keep to the numerator (4 → 5 → 4). A tap 2 px inside the formula's box reaches either end, and in the field's 15 px margins a tap does nothing (`.ML__content` 27..385 of 12..400 px). So **a tap replaces ⇤ ⇥ only while the line fits the field**. On a line that scrolls sideways the jumps are the only way to the ends (P12 point 8's removal test brought them back). What "did not really work well" is **(to verify)**: the owner names the case. The plain cases work.

| Layout | Tap | Shift | Redo, Paste | ⇤ ⇥ |
|---|---|---|---|---|
| K0 today | View·Esc, Undo·Copy, ⇤·⇥ | Help·Clear, Redo·Paste, ⇤□·□⇥ | 2 (flick 1) | 1 |
| **K1** | View·Esc, Undo·Redo, Copy·Paste | Help·Clear, ⇤·⇥, ⇤□·□⇥ | **1** | 2 (flick 1) |
| K2 | as K1 | Help·Clear, 4 free | 1 | a tap; none on a long line |

**Recommendation: K1.** It is the owner's idea, and every row reads as one pair on each layer. The G2 pairs Copy and Paste the same way. Redo and Paste go from 2 presses to 1. The jumps stay (2, or a flick up). View keeps results mode and Shift + View keeps Help, so nothing moves for them. **K2:** frees four cells, but loses the jumps on long lines. **K0:** the line ends at 1, the partners behind Shift. Learning: K1 is three tap pairs and three Shift pairs, and K2 has fewer. Reach: the top row is the farthest. Use frequencies are **(to verify)**: R127's per-key counts are on the owner's phone (Settings › Counters, export). K0 wins if ⇤ ⇥ taps exceed Redo + Paste.

## 3. The room

Measured (`results-geometry.mjs`): status line 28; keypad 514 = padding 8 + 3 cluster rows of 36 + 7 rows of 48 + 9 gaps of 6 + 8; entry line 79.6; action line 52. **The viewport is 297 px at 412 × 839 (share 0.354, 3.4 px over the floor) and 198 px at 360 × 740 (0.268, 61 px under it)**. The floor test runs only at 412 × 839 (`app/test/status.spec.ts:15`).

| Option | 412 × 839: viewport, share, history (picked) | 360 × 740 |
|---|---|---|
| today | 297, 0.354, 217 (165) | 198, 0.268, 118 (66) |
| R1: R82's short rows (42 / 32 px), now under 700 px tall | 351, 0.418, 271 (219) | 252, 0.341, 172 (120) |
| R2: keypad gaps 6 → 4, padding 8 → 4 | 323, 0.385, 243 (191) | 224, 0.303, 144 (92) |
| R1 + R2 | 377, 0.449, 297 (245) | 278, 0.376, 198 (146) |
| R3: the picked row's buttons in the empty line's slot | picked = unpicked, +52, no jump | the same |

R3 works because ▲ picks only on an empty line (`route.ts:172`). Three 1÷3 rows hide 50 px today at 412 × 839, and 66 with docs/05 3.5's 8 px more between entries. With R2 they hide 40 even with the 8 px. **Recommendation: R2 + R3 at every size, and R1 below 760 px tall** (R82's `max-height: 700px` → 760). 360 × 740 then reaches 0.376 and every size passes the floor, which the test should check at 360 × 740 too. Cost: the keys sit 2 px closer, and short screens get 42 px keys (as under 700 px today).
