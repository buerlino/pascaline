<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# R9: The unit pad, a units keyboard for the unit slots (P14, decided 2026-10-14)

**Status (2026-10-21): decided.** decisions.md P14 and the P14 arrangement (S5, 2026-10-18), `spec/unit-pad.yaml`; packages R24b, R24c, R24d.

Claude, for the owner, from the owner's idea of 2026-10-14 (feedback #42). Decided by the owner 2026-10-14 (decisions.md P14), with an amendment (feedback #43): the base arrangement is measured, not drawn by hand, and a few user cells are set from Find. **Package S5 measured it (sandra, 2026-10-17):** sections 1, 3 and 6 hold the result; the owner decides the proposal (decisions.md "P14 arrangement"). The layout is data in [spec/unit-pad.yaml](../../spec/unit-pad.yaml) (schema 2). The counts come from `node tools/probes/unit-presses.mjs --pad` (and `--taps`, `--weights`) on the same 50 units as S1 ([r7-unit-slots.md](r7-unit-slots.md)), and the arrangement from `node tools/probes/pad-arrange.mjs` on measured unit frequencies (`tools/probes/unit-freq/`). The question: should a unit slot be filled from a dedicated pad of prefix and unit cells instead of letters typed by flick? The owner's reason: "even if you calculate the number of actions, it's not easy to remember all the combinations of Alpha and Shift + Alpha presses to produce a unit like kN." The mockup: [docs/mockups/unit-pad.html](../mockups/unit-pad.html).

## 0. Answer

**Recommendation: yes, build the unit view's entry as the unit pad.** It replaces S1's letters inside a slot; the slots, the end slot, the grammar, the reading and the result rules of docs/04 4.3 stay. Reasons, in plain words:

- **You read it instead of remembering it.** Every unit you need most is a labelled cell. S1's letters ask you to know that k is on log, N on `( )`, and which way to flick for which case.
- **It is faster.** Median 2 presses on S1's 50 units, the same as letters with flicks; 22 of them take one press (13 with letters), and the worst takes 7 (9 with letters). Weighted by how often engineers actually use each unit, the measured pad takes 1.80 presses per unit with its user cells, letters 2.36. Compound units are cheaper, because units side by side multiply without a × key.
- **It works without flicks.** With the G2's taps only (Shift or Alpha, then a cell), the median stays 2. With letters it was 5.5 and failed the gate, so S1's first condition (it depends on flicks) goes away.
- **Whole classes of errors go away.** No case slips (`Mm` for mm, `pa` = picoare), no misread names (`BTU`, `lbm`, `var`), no `ms` against m·s, no hecto against hour. A slot holds unit ids from Find's list, never text, so the parser for slots shrinks to a token list.
- **Nothing on the keypad moves.** The pad lies cell for cell on the keys under it, as R21 draws Shift + 6 over its keys. Shift, Alpha, ⌫, Enter, ÷, ×, x², xʸ and Math keep their places and roles, and the top cluster stays as it is.

What it costs: a unit that has no cell and no user cell (Å, arcmin, mmHg, cfm) goes through Find (Math, 1 to 4 letters, Enter), 3 to 6 presses where letters needed 2 to 4. In the measured weighting that is 0.9 % of unit uses.

## 1. The pad

In a unit slot the maths rows (3–9) show this, and the six user keys of the top cluster show the user cells. ↑ = flick up (or Shift, cell), ↓ = flick down (or Alpha, cell):

| row | col 0 | col 1 | col 2 | col 3 | col 4 | col 5 |
|---|---|---|---|---|---|---|
| 3 | mi ↑yd ↓mil | **Find** | knot ↑mph | Hz ↑rpm | ° ↑rad | ⌫ |
| 4 | ³ ↑⁴ | A | V | Ω ↑S | F | T |
| 5 | ² ↑√ | J ↑Wh ↓Btu | W ↑hp ↓TR | L ↑gal ↓bbl | **Enter** (next slot; ↑ evaluate) | |
| 6 | mol | *G ↑T* | *M* | m ↑ft ↓in | ÷ per ↑⁻¹ | |
| 7 | Alpha | *k ↓h* | *c* | g ↑lb ↓t | × | |
| 8 | Shift | *m* | *µ* | s ↑h ↓min | N ↑lbf | |
| 9 | atm ↑ksi ↓Torr | *n* | *p ↓f* | K ↑°C ↓°F | Pa ↑bar ↓psi | |
| user | U1 dB | U2 H | U3 ton ↑l ton (short, long) | U4 cal ↑eV | U5 d | U6 P ↑St |

*Italic* = prefix cells, drawn in their own colour so the prefix m and the metre m never look alike. Rows 6–9 have five wider keys, as on the keypad. The user row is the defaults; every one of its 18 slots (six keys, tap, ↑, ↓) can be set from Find.

How to read it:
- **The prefixes sit where the digits are.** They are powers of ten, so they take the number keys, read like text from the biggest (G, top left) to the smallest (p). T, h and f are the flicks next to their neighbours.
- **The column beside them holds the base units:** m, g, s, K.
- **The operator column** keeps ÷ and ×, then force and pressure.
- **Row 4 is electricity** (A V Ω F T), **row 5** energy, power and volume, **row 3** the second length cell, speed, frequency and angle. The second pressure cell (atm ↑ksi ↓Torr) sits in row 9 beside Pa, on Fmt's key, which means nothing in a slot.
- **One cell per quantity:** its SI unit on the tap (section 1.2 says when another unit would take it), the commonest other units of the same quantity on the flicks. Pairs that belong together share a cell (Ω and S, Hz and rpm, ° and rad). Length and pressure have two cells each, because their second three units are worth more than most quantities' first.
- **The user cells** are the user keys U1–U6 while a slot is open (the owner, 2026-10-17). Their unit slots are stored apart from the keys' normal slots, since a function means nothing in a unit slot. The defaults are the most used units that got no base cell; the free slots are for the user's own units.

### 1.1 Where it comes from (package S5)

1. **What engineers use.** 120 English Wikipedia articles, 40 each from mechanical/civil, electrical, and chemical/process/HVAC engineering (the list: `tools/probes/unit-freq/articles.yaml`), downloaded once into a gitignored cache, each file's revision and SHA-256 in `sources.lock.yaml`. `count.mjs` counts offline every number followed by a unit (symbols, words, and the input unit of the `{{convert}}`, `{{cvt}}` and `{{val}}` templates), skips a conversion in brackets after another unit, and keeps a unit's prefix and its compound form (`W m^-1 K^-1` counts as itself and through W, m and K). A unit counts at most 3 times per article, so one data table does not decide a cell. Each field weighs 0.30 (its share of its own uses), the ten benchmark tasks 0.05 and S1's 50 units 0.05. The weights: `tools/probes/unit-weights.yaml` (1 699 counted uses; Find's ids).
2. **What a unit costs** (docs/04 5.2): a tap, a flick, Shift or Alpha each count 1, so a flick unit costs 1 with flicks and 2 with taps only. A unit with no cell costs its Find trip: Math, the fewest letters that make it Find's first hit (`app/src/find/rank.ts` on today's index), Enter. A product with a cell (Wh) replaces its two factors. The score of an arrangement is the weighted mean presses per unit expression, with flicks and with taps only. **There is no reach model:** no measured data says which key is harder to reach, so every cell costs the same.
3. **Fixed** (S5's rules): Shift, Alpha, ⌫, Enter and Math (Find); ÷, ×, x² and xʸ as operators; the prefixes on the number keys; one quantity per cell. That leaves 20 unit cells: the draft's 19 and Fmt's, freed when the user cells moved to U1–U6.
4. **The search** (`pad-arrange.mjs`). With no reach model, only which units get a cell (and which one is on the tap) changes the score. A cell holds three units of one quantity, and a quantity's second cell is worth no more than its first, so picking the 20 most valuable cells one at a time is optimal (an exchange argument). A unit's value is the presses it saves, measured against the finished pad and repeated until the pad stops changing, so a product cell counts its real gain (Ah saves one press when A and h have cells, not a Find trip). A one-swap search over every unit off the pad then finds nothing better. A tie goes to a new quantity over a second cell of one already placed (within 15 %, the noise of the counts); it changes nothing at this weighting.
5. **Robust:** the same 20 quantities come out with a cap of 1, 3, 10 or no cap per article, and with the three fields alone. Only three details move: with no cap or a cap of 10, °C takes the tap from K (section 1.2), PS takes TR's flick, and mil drops off the second length cell.

### 1.2 The tap: K or °C

**Recommendation: K on the tap, °C one flick up.** °C is used 1.65 times as much as K (cap 3; 1.59 at cap 1, 2.07 at cap 10, 2.51 with no cap), below the rule's "twice as much" at the chosen weighting. K is also the unit inside compounds: 0.0147 of the weight against 0.0040 for °C (W/(m·K), J/(kg·K)). With flicks the choice costs nothing; with taps only it costs 0.025 presses per unit (2.192 against 2.166). Principle 3 leans the same way: K is absolute, so a K slot never raises the question whether a temperature or a difference is meant. The owner decides it (decisions.md "P14 arrangement"). Time is the only other case: h is used 1.18 times as much as s, so s keeps the tap.

### 1.3 What changed from the draft

- **Left the pad:** H, C, Ah, Wb, eV, kgf. H and eV are user-cell defaults (U2, U4); C, Ah, Wb and kgf go through Find (4 to 8 presses; Ah is not in Find yet, G7).
- **New on the pad:** Btu, TR, bbl, knot, mph, mi, yd, mil, atm, ksi, Torr.
- **Keys:** a quantity the draft had keeps its key. T moves from Tmpl to Log (into the electricity row, where H was); speed takes Tmpl, the second length cell Vars (where C was), the second pressure cell Fmt.
- **The prefixes, operators and fixed keys** are unchanged.

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

The slot holds a list of tokens (prefix id, unit id, power, the ÷ position), never typed text. The engine text is built from these whitelisted ids only (docs/04 4.3): under P15 the unit evaluator turns them into exact factors in Giac (package G16), and on the fallback into qalc text, as the probe's `typePad` in `tools/probes/unit-presses.mjs` does.

## 3. Press count

Counting as docs/04 5.2 (a flick 1, Shift and Alpha 1). Two measures: S1's 50 units (the gate set, unchanged from S1) and the weighted mean over the 236 measured unit expressions of section 1.1.

| Entry | Median, S1's 50 | Mean, 50 | Max | One press | Weighted mean | Gate (median ≤ 4) |
|---|---|---|---|---|---|---|
| letters, flicks (S1) | 2 | 2.56 | 9 | 13 | 2.36 | pass |
| letters, taps only | 5.5 | 5.86 | 17 | 2 | 5.54 | **fail** |
| draft pad, flicks | 2 | 2.00 | 7 | 22 | 1.97 | pass |
| draft pad, taps only | 2 | 2.24 | 7 | 14 | 2.29 | pass |
| **measured pad, flicks** | **2** | **2.00** | **7** | **22** | **1.86** (1.80 with the user cells) | pass |
| **measured pad, taps only** | **2** | **2.24** | **7** | **14** | **2.19** (2.13 with the user cells) | pass |

Commands: `unit-presses.mjs` with `--taps`, `--pad`, `--weights tools/probes/unit-weights.yaml` (letters leave out the 0.3 % they cannot type); the draft's rows from `pad-arrange.mjs --draft` on the draft (`git show 239463e:spec/unit-pad.yaml`). The two probes agree within 0.003. None of S1's 50 changes its count (checked unit by unit against the draft): the units that moved are not among them.

**Each field alone** (`pad-arrange.mjs`; flicks, taps only):

| Field | Draft | Measured | Measured with user cells |
|---|---|---|---|
| mechanical/civil | 1.95, 2.33 | 1.80, 2.20 | 1.72, 2.12 |
| electrical | 1.83, 2.03 | 1.84, 2.04 | 1.76, 1.96 |
| chemical/process/HVAC | 2.10, 2.51 | 1.86, 2.32 | 1.81, 2.27 |

Electrical loses 0.004 on the base cells alone (H, C and Wb left) and gains with the user cells (H is U2's default).

**The owner's units** (chemical/process/HVAC; the owner chose "a typical list", so the field's own counts stand in for it, assumed until the owner corrects them): every single unit used at least twice in the field takes at most 2 presses with flicks and at most 3 with taps only (cSt). The compounds over 3 are three factors with a ÷ (W/(m·K) 4, J/(kg·K) 5): each factor is one press, so they cannot be shorter on any pad.

Worst on the pad (flicks): kg·m²/s³ 7 (k g m ² ÷ s ³), kg/m³ 5, J/(kg·K) 5, then km/h, m/s², W/(m·K), W/m² with 4.

Whole tasks with flicks (letters in brackets, r7 section 4): t02 `72`, units key, `km/h → m/s` 12 (12); t02 without the end slot 8 (8); t04 13 (13); t04 without the end slot 11 (11); P11's unit check `kg·m²/s³ → W` on an empty line 11 (13). With taps only on the pad: t02 14, t04 15.

**Not on the pad** (Math, letters until it is Find's first unit hit, Enter; `find-cost.mjs` on today's index): d 3; C, Wb, cfm, oz, cd 4; Å, arcmin, mmHg, inHg, gpm, kgf 5; arcsec 6. Ah, VA, var and kip are not in Find (8 in the score, G7 adds them). `mmH₂O` is not in today's index at all, and `%` and `ppm` are qalc constants, not units, so they cannot go in a slot.

## 4. What it changes

- **`spec/keyboard.yaml` `unit_slot:`**: its `letters` and `symbols` (µ on (−), Ω on the comma, ° on a b/c) go; `spec/unit-pad.yaml` takes their place. `ops` and `exponent_leave` go too: the pad's own cells do that work and no digit is typed in a slot.
- **docs/04 4.3:** the Entry bullet's layout reference changes, and Enter moves to the next slot (section 2.8). The grammar is the same, read from tokens instead of text. The live reading and every adapter and result rule stay.
- **S1's guards (r7 5.4):** 1 (read from Find's list) holds by construction; 2 (the reading) stays and is the only guard against a neighbouring-cell slip; 3 (mark a prefixed pair outside Find's list) stays for pairs such as `kpsi`; 4 (near symbols for a wrong name) and the case analysis of r7 section 5.1 fall away, since nothing is typed by name in a slot. 5–7 stay.
- **Building it:** the pad is a mapping from a key and its layer (tap, up, down) to a cell, drawn over the keys' boxes as R21 draws Shift + 6. So a press goes through the keypad's own gesture code (tap, flick, bubble, haptic) unchanged. The file loads lazily with the unit view; the start chunk does not grow.
- **Rules:** rule 8 (keys never move) holds through R21's rule for anything drawn over the keypad, with every unit always on the same cell. Rule 7: the same tap, flick up, flick down, Shift and Alpha as everywhere. Rule 6: the G2's units menu is Math with an empty query. Rule 1: one pad for every discipline, sorted by quantity (the owner confirmed it, 2026-10-17). Principle 3: no misread names.

## 5. Alternatives

- **S1's letters, as accepted.** Median 2 with flicks, but recall instead of reading, a fail with taps only, and case pitfalls that need the reading as their only guard. Stays the fallback if the pad is rejected.
- **The G2's units menu as the main path** (category, then unit). At least 3 presses for every unit, and a unit's place depends on the open tab. Kept one press away (Math, empty query).
- **A staging box on the pad** that collects prefix and units and drops them into the slot on Enter (the owner's first wording). Two places to look and a strip of vertical space, while the slot itself can show the same thing live (section 2.7).
- **Pad and letters both inside a slot.** Two ways to do one thing (rule 7); letters stay where names are typed, in Find.
- **Category tabs on the pad** (mechanics, electricity, …): more cells, but a unit's place would depend on the tab, and a tab is a press. The flick legends already put 43 units on 20 cells and 9 more on the user keys without that.
- **A startup question for the field** (a pad per field): the owner chose one pad for every field (2026-10-17). On the measured base cells the three fields' means differ by at most 0.07 presses (section 3), and the user cells take a field's own units.

## 6. Risks, open points, would change

**The user cells** (the owner, 2026-10-17): U1–U6 in the top cluster, tap, ↑ and ↓ each, so 18 slots that take no base cell. The curve (`pad-arrange.mjs`, all fields, flicks; slots filled in order of value): 0 slots 1.859, 1: 1.841, 2: 1.830, 4: 1.814, 6: 1.801, 8: 1.791, 12: 1.779, 15 and more: 1.773. Every unit of the corpus that saves anything fits in 15 slots, so 18 is enough, and the defaults (9 slots on 6 keys, grouped by quantity) leave 9 free for the user's own units. The base cells' curve, for comparison: 20 cells 1.859, 19: 1.881, 18: 1.902, 16: 1.972, 14: 2.043, so the last base cell is worth 0.022 presses per unit and the first user slot 0.018.

Open for the owner (decisions.md "P14 arrangement"):
1. **The arrangement** as section 1, with the mockup.
2. **K or °C on the tap** (section 1.2).
3. **The user cells' defaults** (dB, H, ton, cal, d, P; the owner's own units replace them).
4. **Menu in the unit view** opens the units menu with its Tools and Const tabs (default kept; Math with an empty query shows the same categories).

Risks:
- **The corpus is encyclopaedic text,** not worksheets: it shows which units engineers write about, which is close to but not the same as what they type. Plant units (cfm, gpm, kcal, inH₂O) are rare in it. The user cells take those, and the robust core (section 1.1, point 5) does not depend on the details of the weighting.
- **TR and mil are weak:** TR (2.1 ‰ of uses, mostly HVAC) loses its flick to PS with no cap per article; mil (0.4 ‰) is on the second length cell only because the cell has a free layer. Both cost nothing where they are.
- **No reach model:** the score treats every cell alike. If a measured reach cost appears (R24b's use on the phone), the search reruns with it.
- Three legends on a phone key (the fit code's 8 px floor; the gallery decides); the reading line must be legible and live; a G2 hand may expect Enter to evaluate in a middle slot (the flick up does that).

**Would change if:** the owner's own units give many Find trips or more than 3 presses (rerun with the owner's list as a fourth source in `count.mjs`); the legends do not fit at 360 px width (fewer flick units, more Find); after use, the owner misses typing letters in a slot (S1's letters come back as the Alpha layer of the pad).

## 7. To verify

| What | Who, how |
|---|---|
| The owner's own units (the "typical list" is assumed) | the owner, with the mockup; a list goes into `count.mjs` as a fourth source and `pad-arrange.mjs` reruns |
| Three legends fit at 360 and 412 px wide | R24b's gallery step |
| `TR`, `Ah`, `VA`, `var`, `kip` and `mmH₂O` in Find; every id of both spec files in the index | package G7 (a test over `spec/unit-pad.yaml` and `spec/units-menu.yaml`); TR = 12 000 Btu_IT/h = 3 516.852 842 066 7 W (derived) |
| The task benchmark's units in `count.mjs` (`TASKS`) match `tests/tasks/tasks.yaml` | sandra, when tasks.yaml changes |
| MathLive prompts carry a slot and our key routing | R24a's first step (as r7 section 8) |
