<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# R17: The unit result view, decided from the evaluator (package S11, 2026-10-20)

**Status (2026-10-21): decided.** decisions.md M4-2 (the owner, 2026-10-20): the unit result view as its mockup; packages R60, R61, R62, R63.

sandra, for the owner and for packages R60–R63. The bundle named this note `r14-unit-result.md`; R14 is the angle-mode note ([r14-angle-mode.md](r14-angle-mode.md)) and R16 is taken in `phase-1`, so it is R17. What the unit view shows after Enter: value, mark, unit, dimension, one-tap alternatives, `units.targets`, σ with its ⚠, the notes, refusals, and the `\res` chip back to Home. docs/04 4.3 ("Result", "The way back") sets the frame. This note fills in what it leaves open and checks it against the real evaluator. The probe: `node tools/probes/unit-result.ts` (`buildJob` and `EngineHost.units` with the Find index's factors, as the golden gate's units stage does). Presses: `node tools/probes/unit-presses.mjs --pad [--taps]`. Engine `engine/giac/_out/gsl`; index from `phase-1`'s `app/src/find/_gen/find-index.json` (1861 items, 441 units).

## 0. Answer

1. **The chip carries the number in the unit shown**, as docs/04 4.3 already says. It also carries that number's mark facts (`chipFor`'s R65 rule: `exact` when an exact text exists and no σ or inexact constant went in, whatever the mark, so `≈ 157.079632679 mm` gives the exact chip `50*pi`; else `reliableDigits` and `warn`) and **σ in the same unit**. Home then treats that σ as it treats a constant's CODATA σ (G26: the result gets `uncDigits` and is never `=`). **The unit does not reach Home's arithmetic** (P8: Home has no units). It goes along on the chip as its label ("157.08 mm", with the unit set apart and the note "unit dropped"), and as the slot the units key fills in again.
2. **The alternatives** are one row, in this order: the coherent SI unit with no prefix ("SI"); the SI unit with its best prefix, when that is not the unit shown; the last unit used for this dimension (`units.targets`); the units of the pad's cell for this quantity in the pad's order (tap, ↑, ↓, then the second cell, then user cells of the same dimension); the typed units of that dimension; then "More…", which opens Find on units for this dimension. Repeats are dropped, and so is the unit shown. A tap writes the unit into the end slot of the line and runs the job again, so the value, mark, σ and note all come from the evaluator. Nothing is converted by hand on the main thread.
3. **A refusal** takes the value's place and is drawn as Home's error rows are, with no mark, no alternatives and no chip. The slots stay so the user can fix them. **A note** (G40) is one line under the value, in the note style, and never hides the value. **σ** is part of the value line, `≈ 39.5 ± 1.2 m²`. When σ has a `why`, its ⚠ sits right before σ, not before the value, and the why-line goes under it.
4. **Presses with the view** (pad, flicks; taps only in brackets): t02 **9** (12) as 72 km/h then the m/s alternative, 12 (14) with the end slot; t04 **12** (15) with the m alternative, 13 (15) with the end slot; t10 **25** (27), if ± is two presses; t03 with units 14 (16), so prefix chips (budget 10) stay its route; t01 is a `par()` task through Find (R4a), not a unit-view task.

## 1. Evidence: what the evaluator returns (verified, `tools/probes/unit-result.ts`)

| Input (unit-case syntax) | Shown | SI text (`Quantity.si`) | Note |
|---|---|---|---|
| `72*{k:m / h}` → `m / s` | `= 20 m/s` | 20 | t02 |
| `72*{k:m / h}` | `= 72 km/h` | 20 | G25 keeps the typed unit; the old probe label "result 20 m/s" was wrong (fixed) |
| `2*pi*25*{m:m}` | `≈ 157.079632679 mm`, exact `50*pi` | `1/20*pi` | t04: the SI prefix rule also gives mm, so only the unprefixed "SI" gives m |
| `pasupm(12.34,0.05)*{m}*pasupm(3.2,0.1)*{m}` | `≈ 39.488 m²`, σ 1.2, shown `39.5 ± 1.2` | 4936/125 | t10 (tasks.yaml: 39.488, σ 1.24432953835, `derived`) |
| the same → `c:m^2` | `≈ 394880 cm²`, shown `395000 ± 12000` | | σ is scaled with the end slot |
| `4.7 kΩ·10 kΩ/(4.7 kΩ+10 kΩ)` | `≈ 3.19727891156 kΩ` | 470000/147 | t01's value (tasks.yaml `derived`) |
| `2.2*{n:F}*4.7*{k:ohm}` | `= 10.34 µs` | 517/50000000 | SI with a prefix |
| `1*{psi}` | `= 1 psi` | 8896443230521/1290320000 | in SI the chip would carry a 13-digit fraction nobody saw |
| `1*{psi}` → `k:Pa` | `≈ 6.89475729317 kPa` | | the alternative's value comes from the evaluator |
| `20*{oC}` | `= 293.15 K` | 5863/20 | an absolute temperature shows K: °C and °F have to be alternatives |
| `3000*{rpm}*0.1*{m}` → `m / s` | `= 5 m/s`, note "rpm counts turns: the speed at radius r is 2π·r·n" | | G40 |
| `cos(pasupm(0,0.1))` | `≈ 1`, shown `1.0000 ± 0.0071`, ⚠ "first order does not hold here" | | G41 |
| `{=G}*1*{kg}` | `≈ 6.6743E-11 m³/s²`, σ 1.5E-15 | | a constant's σ |
| `1*{m}+1*{s}` | refused: "Units don't match: L vs T" | | |

Each evaluation took 1.4–62 ms on the desktop. The first call in a process is the slow one (30 ms for t02's first job). A tap on an alternative is therefore one more `units` request, as fast as a conversion. A 5 ms p95 check is not part of this probe (to verify: R60's gate, with the golden units stage's timing).

## 2. What the chip carries, and why

- **The number in the unit shown, not SI.** What the user saw is what goes in, so the chip's label and its value agree. SI would put `1/20*pi` behind a chip that reads 157.08 mm, and a 13-digit fraction behind "1 psi". If you want SI, tap the SI alternative first (one press), and the chip follows the unit shown. A mix-up of units in Home cannot be checked either way, because Home has no units. The label is the guard, so it shows the unit, set apart.
- **The facts.** `Quantity.value` is a `HomeResult`, so `session.chipFor`'s R65 rule applies unchanged (`app/src/state/session.svelte.ts:467`). That rule sets `exact` when an exact text exists and nothing inexact went in (`fullExact`, `session.svelte.ts:541`), whatever the mark: `≈ 157.079632679 mm` has the exact text `50*pi` and gives an exact chip, as Home's `≈ 157.079632679` does. Otherwise the chip holds all the confirmed digits with `reliableDigits` and `warn`. A σ makes `exact` false. `evaluate.ts` sets `exactRational` false when `job.inexact` is set (a constant with a σ, M4-4).
- **σ.** Home has the mechanism already. `engine/constUnc.ts` sends constants by name with their σ, and `constUncDigits` gives the result `uncDigits` (`app/src/engine/constUnc.ts:71-82`, `homeEval.ts:120-123`). `Chip.unc` exists for constants (`app/src/input/chips.ts:13-14`). A `\res` chip with `unc` goes by name in the same table, so `2 × chip` keeps its σ to first order. No view draws `uncDigits` yet (grep: only `engine/` uses it). R36's why-line will, for constants and these chips alike. Dropping σ would turn `39.5 ± 1.2` into a chip that looks good to 12 digits, which goes against principle 3.
- **The unit as a label and a slot.** The chip stores `{text, dim}` and its slot tokens. Pressing the units key on a line that holds the chip fills the slot after the chip with them, so `chip × 2 s` gets its unit back without retyping. That needs the units-mode parser to put a slot after a chip **(to verify, ron in R63: `app/src/input/units-mode.test.ts`; if it does not, the prefill is R63's follow-up and the label alone ships)**.

## 3. Which alternatives, in which order (verified)

Find's raw weights cannot order them. From the probe's per-dimension listing:
- **Compound units weigh 0.** S5 counts `km/h` through km and h (r9 1.1), so on L·T⁻¹ `m/s` and `km/h` weigh 0, below `knot` (0.0044) and `mph` (0.0040).
- **Many dimensions have no measured unit.** L² has 18 units and none of them is weighted; sorted by tier and id, the first ones are `a`, `acre` and `b`, the barn.
- **Coherent SI is not unique.** Units with factor 1 share a dimension: Hz and Bq, J/kg, Gy and Sv, N·m and J, Pa and J/m³, mol and einstein. "SI" must therefore be picked: the typed unit, then the pad's tap unit, then the base form built from the dimension key (`kg·m²·s⁻²`).

The pad *is* S5's weights, already curated: one cell per quantity, with the tap being SI unless another unit is used twice as much, and the flicks being the next most used units (r9 1). So the row uses the pad's cells. Find stays one press away for the long tail, sorted by its own ranking. For the common quantities this gives length m, ft, in, mi, yd; speed m/s, knot, mph and the typed km/h; pressure Pa, bar, psi, atm, ksi, Torr; energy J, Wh, Btu (+ cal, eV from U4); power W, hp, TR; temperature K, °C, °F; time s, h, min (+ d). SI prefixes go only on coherent SI units, by `chosenUnit`'s rule (`app/src/units/evaluate.ts`, the `PREFIXES` branch), so Btu never becomes kBtu. Absolute temperatures offer K, °C and °F, and intervals offer K, Δ°C and Δ°F (the Find aliases of K and °R). A power of a pad quantity that has no cell of its own (L², but not L³, which has the litre cell) gets the same power of that cell's units (ft², in², mi², yd²). A pure number has no row.

`units.targets` (`{dimKey: unitId}`, IndexedDB) only puts the last unit used *first in the row*. It does not change the unit shown: the same line always shows the same result (G25's rule stays the only rule). One tap more for a repeat is the price of a predictable view.

**How many fit:** at 360 px, five chips plus "More…" (estimated from the mockup at 14 px; to verify in R62's gallery at 360 and 412 px).

## 4. Presses (verified, `unit-presses.mjs --pad`, with `--taps` in brackets)

| Task | With the view | Plan (tasks.yaml) | Baseline |
|---|---|---|---|
| t02 72 km/h → m/s | **9** (12): `7 2`, ↑Tmpl, `k m ÷ h`, ↑Enter, tap m/s | 15 | 7 (`72 ÷ 3.6`, no check) |
| t02 with the end slot | 12 (14) | | |
| t04 2π·25 mm in m | **12** (15): …, ↑Enter, tap m | 14 | 11 |
| t04 with the end slot | 13 (15) | | |
| t10 (12.34 ± 0.05) m × (3.2 ± 0.1) m | **25** (27), ± = Shift + a key | 31 | none |
| t03 2.2 nF × 4.7 kΩ with units | 14 (16), shows 10.34 µs | 10 (prefix chips) | 13 |

A tap on an alternative is one touch press. By keys the row is reached with ▼ and then ◀ ▶ Enter (R62), so 3 or more presses. **± has no key today:** Shift + (−) is |x| (`spec/keyboard.yaml:211`), although tasks.yaml t10 and r7 7.3 assumed it. The free Shift layers near it are `−` (the G2's Base, not built) and `,` (the G2's Eval, not ours). This is decisions.md M4-2 point 5. t10's 25 holds for either. The units still lose to `72 ÷ 3.6` by two presses on t02 and by one on t04. They win where the factor is not in your head, and they check the dimension. The owner's hand timing (backlog "Needs the user" 0) stays the gate.

## 5. Packages (files in `docs/shifts/packages/`)

| ID | One concern | Agent | Lane | After |
|---|---|---|---|---|
| R60 | The alternatives as data: the row, its order, `units.targets`, a tap as an end slot (UI-free) | gorge, Opus | night | R24c |
| R61 | The chip from a unit result: value in the shown unit, facts, σ into Home's G26 path (UI-free) | gorge, Opus | night | R24c |
| R62 | The result view drawn: value line, σ and ⚠, note, refusal, the alternatives row | ron, Sonnet | day (gallery) | R60, owner on the mockup |
| R63 | The way back: the unit row in Home's history, the chip, the units key again, t02, t04 and t10 active | ron, Opus | day | R61, R62 |

The mockup: [docs/mockups/unit-result.html](../mockups/unit-result.html).

## 6. To verify

| What | Who, how |
|---|---|
| A slot after a `\res` chip in units mode | ron, R63's first step (`units-mode.test.ts`) |
| Five chips and "More…" fit at 360 px | ron, R62's gallery |
| A re-evaluation for a tap stays under the 5 ms p95 | gorge, R60 (golden units stage timing) |
| Home's `uncDigits` from a σ chip is what `uncDigitsOf` gives | gorge, R61's test (σ derived by hand: linear cases) |
| The owner's ± key | the owner, decisions.md M4-2 point 5 |

**Risks:** a chip read as metres when it is in millimetres, if the label's unit is too faint (R62 makes the gallery show it); a pad changed by the owner (P14 arrangement) changes the row, which is intended; `units.targets` written on every tap could reorder the row under the user's thumb (it reorders only on the next result, never the row on screen).
