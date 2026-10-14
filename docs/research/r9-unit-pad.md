<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# R9: The unit pad, a units keyboard for the unit slots (P14, decided 2026-10-14)

Claude, for the owner, from the owner's idea of 2026-10-14 (feedback #42). **Status: DECIDED by the owner 2026-10-14** (decisions.md P14), with an amendment (feedback #43): the base arrangement is measured, not drawn by hand (package S5 rewrites sections 1, 3 and 6 with its result), and a few user cells, their number open, are set from Find. The grid below is the hand-drawn draft that S5 starts from. The layout is data in [spec/unit-pad.yaml](../../spec/unit-pad.yaml). The counts come from `node tools/probes/unit-presses.mjs --pad` (and `--pad --taps`), on the same 50 units as S1 ([r7-unit-slots.md](r7-unit-slots.md)), and qalc reads every pad unit back as meant. The question: should a unit slot be filled from a dedicated pad of prefix and unit cells instead of letters typed by flick? The owner's reason: "even if you calculate the number of actions, it's not easy to remember all the combinations of Alpha and Shift + Alpha presses to produce a unit like kN."

## 0. Answer

**Recommendation: yes, build the unit view's entry as the unit pad.** It replaces S1's letters inside a slot; the slots, the end slot, the grammar, the reading and the result rules of docs/04 4.3 stay. Reasons, in plain words:

- **You read it instead of remembering it.** Every unit you need most is a labelled cell. S1's letters ask you to know that k is on log, N on `( )`, and which way to flick for which case.
- **It is at least as fast.** Median 2 presses, the same as letters with flicks. 22 of the 50 units take one press (13 with letters), and the worst unit takes 7 (9 with letters). Compound units are cheaper, because units side by side multiply without a × key.
- **It works without flicks.** With the G2's taps only (Shift or Alpha, then a cell), the median stays 2. With letters it was 5.5 and failed the gate, so S1's first condition (it depends on flicks) goes away.
- **Whole classes of errors go away.** No case slips (`Mm` for mm, `pa` = picoare), no misread names (`BTU`, `lbm`, `var`), no `ms` against m·s, no hecto against hour. A slot holds unit ids from Find's list, never text, so the parser for slots shrinks to a token list.
- **Nothing on the keypad moves.** The pad lies cell for cell on the keys under it, as R21 draws Shift + 6 over its keys. Shift, Alpha, ⌫, Enter, ÷, ×, x², xʸ and Math keep their places and roles, and the top cluster stays as it is.

What it costs: a unit that has no cell (atm, Torr, mph, Btu, Å) goes through Find (Math, 1 to 4 letters, Enter), 3 to 6 presses where letters needed 2 to 4. And the layout is a judgement that the owner's own units must confirm (section 6).

## 1. The pad

In a unit slot the maths rows (3–9) show this. ↑ = flick up (or Shift, cell), ↓ = flick down (or Alpha, cell):

| row | col 0 | col 1 | col 2 | col 3 | col 4 | col 5 |
|---|---|---|---|---|---|---|
| 3 | C ↑Ah | **Find** | T ↑Wb | Hz ↑rpm | ° ↑rad | ⌫ |
| 4 | ³ ↑⁴ | A | V | Ω ↑S | F | H |
| 5 | ² ↑√ | J ↑Wh ↓eV | W ↑hp | L ↑gal | **Enter** (next slot; ↑ evaluate) | |
| 6 | mol | *G ↑T* | *M* | m ↑ft ↓in | ÷ per ↑⁻¹ | |
| 7 | Alpha | *k ↓h* | *c* | g ↑lb ↓t | × | |
| 8 | Shift | *m* | *µ* | s ↑h ↓min | N ↑lbf ↓kgf | |
| 9 | (yours) | *n* | *p ↓f* | K ↑°C ↓°F | Pa ↑bar ↓psi | |

*Italic* = prefix cells, drawn in their own colour so the prefix m and the metre m never look alike. Rows 6–9 have five wider keys, as on the keypad.

How to read it:
- **The prefixes sit where the digits are.** They are powers of ten, so they take the number keys, read like text from the biggest (G, top left) to the smallest (p). T, h and f are the flicks next to their neighbours.
- **The column beside them holds the base units:** m, g, s, K.
- **The operator column** keeps ÷ and ×, then force and pressure.
- **The function rows** hold electricity (A V Ω F H), then C T Hz °, then J W L.
- **One cell per quantity:** the SI unit on the tap, the common other units of the same quantity on the flicks. Pairs that belong together share a cell (Ω and S, T and Wb, Hz and rpm, C and Ah).
- **The (yours) cell** sits on the Fmt key, which means nothing in a slot. It stands for the user cells of P14's amendment: S5 decides how many there are and where, and gives each a default; you set them from Find, like the user keys U1–U3.

### Why this arrangement and not "prefixes in the far left column"
The owner asked for prefixes on the left and units on the right. The far left column holds Shift and Alpha, and those keep their places: Shift then a cell is how the G2's taps reach the flick units (rule 6 and rule 7, one model). So the prefixes take the left two columns of the number block, which is still the left of where units are, and has its own logic: prefixes are numbers.

## 2. How it works

1. **The units key** (Shift + Tmpl, or a flick up on Tmpl) on a line or a picked history row shows the formula with a slot after every number and the end slot "→ should be". On an empty line it shows one slot with the quantity 1 and the end slot. The cursor is in the first slot and the pad is up.
2. **A prefix arms.** It is highlighted, and the next unit takes it (k, N = kN). Another prefix replaces it, and the same prefix again disarms it. Compound prefixes are not allowed (SI).
3. **Units in a row multiply.** N, m = N·m. No × is needed, because the prefix m and the metre m are different cells. × still types the dot, so a G2 hand that presses it loses nothing.
4. **÷ makes the rest of the slot the denominator.** J ÷ k g K = J/(kg·K). One ÷ per slot, the SI's one-solidus rule. On an empty slot it means 1/….
5. **Powers act on the unit before:** ² ³ ⁴ and ⁻¹ (flick up on ÷, like the keypad's Shift ÷ = x⁻¹). √ acts on the unit after (flick up on x², like Shift x² = √): n V ÷ √ Hz = nV/√Hz.
6. **⌫ removes the last token:** a power, a unit, a prefix or the ÷.
7. **The slot is the entry.** It fills as you press, in the formula on the screen, and the reading in words shows under the formula ("kilonewton metre · L²MT⁻²"). There is no separate staging box: a box would cost vertical space (rule 9) and give two places to look. The reading is still required. A slip to a neighbouring prefix cell (G and M, m and µ, n and p: 10³; k and c: 10⁵) gives the same dimension at the wrong size, and nothing else can catch it (S1 guard 2).
8. **Enter goes to the next slot** (the owner's flow); an empty slot means no unit. After the last unit slot comes the end slot, where Enter evaluates. A flick up on Enter (Shift + Enter) evaluates from any slot. This differs from S1, where Enter evaluated at once and ▶ moved on. ◀ ▶ in the top cluster still move between slots, and Esc leaves the unit view and keeps the slots with the line.
9. **Math opens Find on units** for everything not on the pad. Inside Find the keys type letters again (docs/04 3.7), and an empty query shows the units menu by category ([spec/units-menu.yaml](../../spec/units-menu.yaml)). So the G2's way (Units, category, unit) is still there, one press away.

The slot holds a list of tokens (prefix id, unit id, power, the ÷ position), never typed text. Its qalc text is built from these whitelisted ids only (docs/04 4.3), which the probe does: `typePad` in `tools/probes/unit-presses.mjs`.

## 3. Press count

Counting as docs/04 5.2 (a flick 1, Shift and Alpha 1). The 50 units, their sources and the tasks are the probe's, unchanged from S1.

| Entry (`tools/probes/unit-presses.mjs …`) | Median, 50 | Mean | Single (36) | Compound (14) | Max | One press | Gate (≤ 4) |
|---|---|---|---|---|---|---|---|
| letters, flicks (S1, accepted) | 2 | 2.56 | 2 | 4 | 9 | 13 | pass |
| letters, taps only (`--taps`) | 5.5 | 5.86 | 4.5 | 9 | 17 | 2 | **fail** |
| **pad, flicks (`--pad`)** | **2** | **2.00** | **1** | **3.5** | **7** | **22** | pass |
| **pad, taps only (`--pad --taps`)** | **2** | 2.24 | 2 | 4 | 7 | 14 | pass |

Worst on the pad (flicks): kg·m²/s³ 7 (k g m ² ÷ s ³), kg/m³ 5, J/(kg·K) 5, then km/h, m/s², W/(m·K), W/m² with 4.

Whole tasks with flicks (letters in brackets, r7 section 4): t02 `72`, units key, `km/h → m/s` 12 (12); t02 without the end slot 8 (8); t04 13 (13); t04 without the end slot 11 (11); P11's unit check `kg·m²/s³ → W` on an empty line 11 (13). With taps only on the pad: t02 14, t04 15.

**Not on the pad** (Math, letters until it is Find's first unit hit, Enter; measured with `rank.ts` on today's index): d 3; cal, kcal, Btu, cfm, ksi, dB, yd, mi, oz, cd, lux 4; atm, mmHg, mph, knot, Å, arcmin 5; Torr 6. With letters and flicks the same units take 2–4. `mmH₂O` is not in today's index at all (r7 section 3 assumed it was; package G7 checks), and `%` and `ppm` are qalc constants, not units, so they cannot go in a slot.

## 4. What it changes

- **`spec/keyboard.yaml` `unit_slot:`**: its `letters` and `symbols` (µ on (−), Ω on the comma, ° on a b/c) go; `spec/unit-pad.yaml` takes their place. `ops` and `exponent_leave` go too: the pad's own cells do that work and no digit is typed in a slot.
- **docs/04 4.3:** the Entry bullet's layout reference changes, and Enter moves to the next slot (section 2.8). The grammar is the same, read from tokens instead of text. The live reading and every adapter and result rule stay.
- **S1's guards (r7 5.4):** 1 (read from Find's list) holds by construction; 2 (the reading) stays and is the only guard against a neighbouring-cell slip; 3 (mark a prefixed pair outside Find's list) stays for pairs such as `kpsi`; 4 (near symbols for a wrong name) and the case analysis of r7 section 5.1 fall away, since nothing is typed by name in a slot. 5–7 stay.
- **Building it:** the pad is a mapping from a key and its layer (tap, up, down) to a cell, drawn over the keys' boxes as R21 draws Shift + 6. So a press goes through the keypad's own gesture code (tap, flick, bubble, haptic) unchanged. The file loads lazily with the unit view; the start chunk does not grow.
- **Rules:** rule 8 (keys never move) holds through R21's rule for anything drawn over the keypad, with every unit always on the same cell. Rule 7: the same tap, flick up, flick down, Shift and Alpha as everywhere. Rule 6: the G2's units menu is Math with an empty query. Rule 1: one pad for every discipline, sorted by quantity. Principle 3: no misread names.

## 5. Alternatives

- **S1's letters, as accepted.** Median 2 with flicks, but recall instead of reading, a fail with taps only, and case pitfalls that need the reading as their only guard. Stays the fallback if the pad is rejected.
- **The G2's units menu as the main path** (category, then unit). At least 3 presses for every unit, and a unit's place depends on the open tab. Kept one press away (Math, empty query).
- **A staging box on the pad** that collects prefix and units and drops them into the slot on Enter (the owner's first wording). Two places to look and a strip of vertical space, while the slot itself can show the same thing live (section 2.7).
- **Pad and letters both inside a slot.** Two ways to do one thing (rule 7); letters stay where names are typed, in Find.
- **Category tabs on the pad** (mechanics, electricity, …): more cells, but a unit's place would depend on the tab, and a tab is a press. The flick legends already put 40 units on 19 cells without that.

## 6. Risks, open points, would change

Open points, as the owner decided P14 (2026-10-14):
1. **The arrangement:** measured by package S5 (how often engineers use each unit, the owner's own units among the sources), shown as a phone mockup, then accepted by the owner.
2. **K or °C on the tap** of the temperature cell: S5 answers it from the data (draft: K, the SI unit, with °C one flick).
3. **The user cells:** a few, their number open; S5 scores 1 to 6 and proposes a number, with defaults.
4. **Menu in the unit view** opens the units menu with its Tools and Const tabs (default kept; Math with an empty query shows the same categories).

Risks: three legends on a phone key (the fit code's 8 px floor; the gallery decides); the reading line must be legible and live; a G2 hand may expect Enter to evaluate in a middle slot (the flick up does that). **Would change if:** the owner's top units give a median above 2 or many Find trips (rearrange); the legends do not fit at 360 px width (fewer flick units, more Find); after use, the owner misses typing letters in a slot (S1's letters come back as the Alpha layer of the pad).

## 7. To verify

| What | Who, how |
|---|---|
| The owner's own top units and the arrangement | package S5 (asks the owner first; weights, search, mockup) |
| Three legends fit at 360 and 412 px wide | R24b's gallery step |
| `Ah`, `mmH₂O` and the other ids of both spec files in the index | package G7 (a test over `spec/unit-pad.yaml` and `spec/units-menu.yaml`) |
| MathLive prompts carry a slot and our key routing | R24a's first step (as r7 section 8) |
