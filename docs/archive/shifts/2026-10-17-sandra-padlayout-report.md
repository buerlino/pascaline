<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# S5 report: the unit pad's arrangement and its user cells (sandra, Opus, 2026-10-17)

Branch `p1/sandra-padlayout` (from `master` at `239463e`), nothing committed. Brief section 0d, package S5. The
result is in [docs/research/r9-unit-pad.md](../../research/r9-unit-pad.md) sections 1, 3 and 6, and in
[spec/unit-pad.yaml](../../../spec/unit-pad.yaml) (schema 2). The mockup is [docs/mockups/unit-pad.html](../../mockups/unit-pad.html).

## Result
**All four gates pass.** The measured pad keeps the draft's frame: the prefixes, the operators, the fixed keys, and
16 of its quantities on their keys. It changes which units sit on the unit cells.

| Gate | Result |
|---|---|
| S1's 50 units, median ≤ 2 with flicks and with taps only | 2 and 2. Means 2.00 and 2.24, as with the draft; no unit's count changes |
| The weighted mean beats the draft's | flicks 1.973 → **1.859**, taps only 2.287 → **2.192**; with the user cells' defaults 1.795 and 2.130 |
| Each of the owner's units ≤ 3 presses, or the reason named | every single unit used twice or more in the owner's field: ≤ 2 with flicks, ≤ 3 with taps only (cSt is 3). Compounds over 3 have three factors and a ÷ (W/(m·K) 4, J/(kg·K) 5), so they cannot be shorter on any pad. The owner's list is assumed (below) |
| Every pad id is a Find id, or listed for G7 | all are Find ids except `TR` (listed below) |

The owner decided three things during the package (2026-10-17):
- **One pad for every field,** with no startup question.
- **The user cells are U1–U6** in the top cluster while a slot is open, so 18 slots that take no base cell.
- **The owner's units: "use a typical list"** for chemical/process/HVAC. I took the field's own counts as that list, marked assumed. The owner accepted the mockup's look ("perfect, its exactly like I wanted it to be").

The grid (↑ flick up or Shift, ↓ flick down or Alpha; prefixes in italics):

| row | col 0 | col 1 | col 2 | col 3 | col 4 | col 5 |
|---|---|---|---|---|---|---|
| 3 | mi ↑yd ↓mil | Find | knot ↑mph | Hz ↑rpm | ° ↑rad | ⌫ |
| 4 | ³ ↑⁴ | A | V | Ω ↑S | F | T |
| 5 | ² ↑√ | J ↑Wh ↓Btu | W ↑hp ↓TR | L ↑gal ↓bbl | Enter | |
| 6 | mol | *G ↑T* | *M* | m ↑ft ↓in | ÷ ↑⁻¹ | |
| 7 | Alpha | *k ↓h* | *c* | g ↑lb ↓t | × | |
| 8 | Shift | *m* | *µ* | s ↑h ↓min | N ↑lbf | |
| 9 | atm ↑ksi ↓Torr | *n* | *p ↓f* | K ↑°C ↓°F | Pa ↑bar ↓psi | |
| user | U1 dB | U2 H | U3 ton ↑l ton | U4 cal ↑eV | U5 d | U6 P ↑St |

## Proposal for decisions.md "Needs the user": P14 arrangement
Entered in [decisions.md](../../decisions.md) "Needs the user", with one line in the backlog's "Needs the user" item 4.
- **Recommendation: take the measured arrangement above.** Its 20 unit cells are the 20 quantities that save the most presses. The same 20 come out under every weighting tried.
- **The user cells: U1–U6 as decided, 18 slots, with defaults.** The curve (all fields, flicks, slots filled by value) goes 0 slots 1.859, 1 slot 1.841, 6 slots 1.801, 12 slots 1.779, and 15 or more 1.773. So 18 slots hold everything the corpus can gain. The six default keys fill 9 slots and leave 9 for the owner's own units. For comparison, the last base cell is worth 0.022 presses per unit (19 cells: 1.881).
- **K or °C on the tap: K, with °C one flick up.** °C is used 1.65 times as much as K, below the rule's "twice as much". K carries the compounds: 0.0147 of the weight against 0.0040 for °C. The choice costs nothing with flicks and 0.025 presses per unit with taps only.
- **Units that left the pad:** H and eV become user-cell defaults. C, Ah, Wb and kgf go through Find, at 4 to 5 presses (Ah 8 until G7 adds it).
- **Units new on the pad:** Btu, TR, bbl, knot, mph, mi, yd, mil, atm, ksi, Torr.

## How it was measured
1. **Counts** (`tools/probes/unit-freq/`):
   - **Corpus:** 120 English Wikipedia articles, 40 per field (`articles.yaml`). `fetch.mjs` downloaded the wikitext once on 2026-10-17 (6.5 MB) into the gitignored `tools/probes/_out/unit-freq/cache/`. `sources.lock.yaml` records each file's revision id and SHA-256.
   - **Counting:** `count.mjs` checks every SHA-256 and counts offline. A use is a number followed by a unit, in symbols or words, or the input unit of `{{convert}}`, `{{cvt}}` and `{{val}}`. It counts prefix and unit separately and keeps the compounds.
   - **Weighting:** each unit counts at most 3 times per article. Each field weighs 0.30, the tasks 0.05 and S1's 50 units 0.05.
   - **Uses counted:** mechanical/civil 457, electrical 823, process/HVAC 419.
   - **Licence:** the article text is CC BY-SA and stays in the cache; the repo keeps only titles, hashes and counts.
2. **Cost** (`pad-arrange.mjs`, docs/04 5.2):
   - A tap, a flick, Shift or Alpha each count 1.
   - A unit with no cell costs its Find trip: Math, the fewest letters that make it the first hit, then Enter. `find-cost.mjs` counts this from `app/src/find/rank.ts` on today's index.
   - **No reach model.** No measured data exists on which key is harder to reach, so every cell costs the same.
3. **Search:** greedy, and exact under these rules. With equal cells only the choice of units matters. A quantity's second cell is never worth more than its first, so taking the 20 most valuable cells in turn is optimal (an exchange argument).
   - **Savings are measured against the finished pad,** repeated until the pad stops changing. The first version measured them against an empty pad, which overvalued the Ah and VA product cells. A one-swap local search then finds nothing better.
   - **The tie rule** (a new quantity beats a second cell of a placed one within 15 %) changes nothing at this weighting.
   - **Taps:** the tap rule (SI unit unless another is used 2×) sets every tap. Up and down cost the same, so units that stay keep the draft's layer.
4. **Robustness:**
   - **Same 20 quantities** with a cap of 1, 3 or 10 uses per article, with no cap, and with the three fields alone (`--corpus-only`).
   - **No cap or cap 10:** °C takes the tap (2.07× and 2.51× K), and PS takes TR's flick.
   - **No cap:** mil also drops off.
   - **Each field alone,** draft → measured → with user cells (flicks):

     | Field | Draft | Measured | With user cells |
     |---|---|---|---|
     | mechanical/civil | 1.95 | 1.80 | 1.72 |
     | electrical | 1.83 | 1.84 | 1.76 |
     | process/HVAC | 2.10 | 1.86 | 1.81 |

     Electrical loses 0.004 on the base cells, since H, C and Wb left, and gains it back with H on U2.

## What I verified, and how
All from the repo root, on Node 22 with `app/node_modules`:
- `node tools/probes/unit-freq/count.mjs`, and `--cap 1|10|Infinity --out tools/probes/_out/unit-freq/w-capN.yaml` for the variants.
- `node tools/probes/pad-arrange.mjs`, with `--draft tools/probes/_out/draft.yaml`, where the draft comes from `git show 239463e:spec/unit-pad.yaml`.
  - Also run with `--weights` on each variant, `--corpus-only` and `--no-tie`.
  - `spec/unit-pad.yaml` scores exactly the best found (1.859 / 2.192).
- `node tools/probes/unit-presses.mjs --pad [--taps] [--no-user] --weights tools/probes/unit-weights.yaml`:
  - It agrees with `pad-arrange.mjs` within 0.003.
  - S1's 50 units: a per-unit diff against the draft spec shows no unit changes its count.
- Every unit id in `spec/unit-pad.yaml`, user cells included, was checked against `app/src/find/_gen/find-index.json`. Only `TR` is missing.
- TR = 12 000 Btu_IT/h = 3516.852842066666… W (`derived` from Btu_IT = 1055.05585262 J, checked with mpmath 1.3.0 in `tests/golden/.venv`).
- The mockup rendered in headless Chromium (light and dark, 86 cells) with no script errors. It is republished at the same artifact link.
- Nothing in `app/` reads `spec/unit-pad.yaml` yet (grep), so the schema change breaks no test.

## Changed files
- **`spec/unit-pad.yaml`:** schema 2.
  - The 20 measured cells, each with its measured worth.
  - A `user:` list for u1–u6 with defaults.
  - `label:` where a cell shows another name than the Find id: `thou` shows as mil, `s_ton` as ton, `l_ton` as l ton.
  - `source: derived`.
- **`docs/research/r9-unit-pad.md`:**
  - The intro and section 0 (speed, cost).
  - Section 1 rewritten: the grid; 1.1 the method; 1.2 K or °C; 1.3 what changed.
  - Section 3 rewritten: weighted means, each field, the owner's units, Find costs.
  - Section 5: two alternatives added.
  - Section 6 rewritten: the user-cell curve, open points, risks.
  - Section 7: the to-verify list.
- **`docs/mockups/unit-pad.html`:** the measured grid, the user defaults and the new side text.
- **`docs/decisions.md`:** "Needs the user": the "P14 arrangement" entry.
- **`docs/backlog.md`:** the "Needs the user" item 4 line, and S5's status in milestone 4's parallel line.
- **New probes:** `tools/probes/unit-freq/{articles.yaml,fetch.mjs,count.mjs,sources.lock.yaml}`, `tools/probes/pad-arrange.mjs` and `tools/probes/find-cost.mjs` (the Find trip count, shared).
- **New data:** `tools/probes/unit-weights.yaml`.
- **`tools/probes/unit-presses.mjs`:** `--weights`, plus `--pad` now counting the user cells (`--no-user` leaves them out).
  - The product merge is now order-free: `h k:W` types as kWh, as it already did for `k:W h`.
  - A missing prefixed unit may take Find's prefixed item (kcal).
- **`tools/probes/README.md`:** rows for the new probes.

## For G7: ids Find lacks
G7's test should list these. Sizes are exact from their definitions.
- `TR` (on the pad, power ↓): 12 000 Btu_IT/h = 3516.852842066666… W (`derived`).
- `Ah` (already in `add_to_find`; through Find once added): 3600 C.
- `VA` and `var` (counted 0.7 ‰; typed today as V A, so not urgent): 1 W each, as apparent and reactive power. G7 should check how Find marks them, since the unit view's dimension check treats them as W.
- `kip` (already in `add_to_find`).

## Still to verify
| What | Who, how |
|---|---|
| The owner's own units (the "typical list" is assumed) | the owner, with the mockup; a list becomes a fourth source in `count.mjs` (a few lines), then `pad-arrange.mjs` reruns |
| `count.mjs`'s `TASKS` matches `tests/tasks/tasks.yaml` (typed by hand from the tasks: k:Ω ×2, km/h, m/s, mm, m ×2, m²) | sandra, when tasks.yaml changes; a reader script would remove the copy |
| Three legends fit at 360 and 412 px (U3's "l ton" next to its tag is tight in the mockup) | R24b's gallery |
| The user cells' storage, set from Find apart from the user keys' normal slots | R4b and R24d (r9 section 1) |

## Top risks
1. **The corpus is encyclopaedic text, not worksheets.** Plant units (cfm, gpm, kcal, inH₂O) are rare in it. The robust core does not depend on it, and the user cells take what it misses.
2. **K on the tap depends on the per-article cap.** With no cap, °C is used 2.5 times as much as K and would take the tap by the rule. The recommendation rests on the cap and on K's role in compounds. It is the owner's call.
3. **No reach model.** Where a cell sits is unscored. If R24b measures that some keys are slower to reach, the search reruns with that cost.
4. **The weakest cells:** TR's flick (PS wins with no cap) and mil (0.4 ‰). Both cost nothing where they are, but they are the first to move.
