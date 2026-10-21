<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# R7: Unit slots, the paper test (package S1, 2026-10-13)

**Status (2026-10-21): decided.** decisions.md S1 (2026-10-13), the unit slots, and P14 (the pad replaces the letters, r9); docs/04 4.3–4.4; the slots are built, the pad's packages R24b, R24c, R24d.

sandra, for the owner. **Accepted by the owner 2026-10-13** (decisions.md S1); section 7 is now docs/04 4.3–4.4. **P14 (decided 2026-10-14)** replaces the letters in a slot with the unit pad: [r9-unit-pad.md](r9-unit-pad.md); the slots, the reading and the guards of section 5.4 stay as r9 section 4 says. The question (P11, brief S1): can units added *after* the formula, typed letter by letter into
unit slots, reach a unit in 4 presses or fewer at the median (P8 rule 2: a unit must beat typing `E-10`)? And which
case pitfalls has the entry to guard against? Layout: `spec/keyboard.yaml` `unit_slot:` (line 310). Count:
`tools/probes/unit-presses.mjs`. Everything below can be rerun with that probe; qalc facts use the built qalc
(`engine/qalc/_out/dev`, libqalculate 5.13.1, the glue in `engine/qalc/glue.cc`).

## 0. Answer

**Build the unit slots as recorded. The gate passes: 2 presses at the median over 50 common units** (36 single units:
median 2; 14 compound units: median 4; worst `kg·m²/s³` with 9). Reasons, in plain words:

- With flicks, every letter is one press in its own case, and the three non-Latin symbols engineers need (µ, Ω, °)
  sit on keys whose tap means nothing in a unit, so they are one tap too. `kΩ`, `µF`, `°C`, `mm` are all 2 presses.
- The keys don't move (docs/03 rule 8): only what some layers do changes inside a slot, as the rule allows.
- The G2's own sequences still work (rule 6): Alpha + key types the capital, Shift + Alpha + key the lower case.

Two conditions come with the pass:

1. **It depends on flicks (R9).** With taps only (the G2 way) the median is **5.5: the gate fails**. If the owner
   rejects flicks after trying them, the fix is a lower-case letter lock that a slot starts in (a tap on a letter
   key types its lower case, Alpha + key the capital): **median 3, passes** (`--lower-lock`). No key moves either way.
2. **Case carries meaning, and the entry has to show it.** 21 of the 50 case slips the probe tried give another,
   valid unit of a different dimension, and **4 give the same dimension at a wrong size** (`Mm` for mm, `Ms` for
   ms, `MA` for mA, `mPa` for MPa: a factor of 10⁶ to 10⁹). No dimension check can see those four; only a live
   reading under the slot can (section 5).

One rule changed from P11's wording, at no cost in presses: **a number is typed before the units key, never inside
a slot** (`72`, units key, `km/h`). P11 let the empty-line slot start with a number; then the digit keys, which also
carry letters (s on 9, u on 4, …), would mean two things in one slot. Digits in a slot are now only exponents. On an
empty line the units key still opens a single slot, with the quantity 1, for a pure unit check (`kg·m²/s³ → W`).

## 1. The layout (what `unit_slot:` records)

| In a slot | Presses | Why |
|---|---|---|
| a letter, lower case | 1 (flick down) | the key's own alpha letter, at its fixed place (A on Vars … Z on 2) |
| a letter, capital | 1 (flick up) | outside a slot, flick up is the shift function; inside, the shift side of the letter |
| a letter, the G2 way | 2 (Alpha, key) or 3 (Shift, Alpha, key) | rule 6: G2 sequences keep working, Alpha lock too |
| µ | 1 (tap (−)) | µ is the Greek m, and the key carries M; inside an exponent (−) stays minus |
| Ω | 1 (tap ,) | Ω is the Greek O, and the key carries O; a comma means nothing in a unit |
| ° | 1 (tap a b/c) | the reference's shift a b/c enters degrees, minutes, seconds (`spec/keyboard.yaml:94`); ° alone is the angle degree, °C and °F take the letter after it |
| product | 1 (×) | needed between units: `ms` is the millisecond, m·s needs ×; the SI Brochure (9th ed., 5.2) asks for the same, "since otherwise some prefixes could be misinterpreted" |
| per | 1 (÷) | the rest of the slot is the denominator: J/(kg·K) = J ÷ k g × K (the SI's one-solidus rule, 5.2); on an empty slot 1/… |
| square, power | 1 (x²); 2 (xʸ, digit) | of the unit before; an exponent holds digits, (−) and . only, and any other key leaves it, so no ▶ is needed |
| inverse, root | 2 (Shift ÷; Shift x²) | K⁻¹; nV/√Hz |
| next, previous slot | 1 (▶, ◀) | never through the formula (owner, feedback #20); after the last slot, the end slot |
| Find on units | Math | for the symbols letters cannot type (section 3); rule 7: what is looked up by name goes through Find |

Keys not listed do nothing in a slot (sin, ln, Vars, the variable key). How a slot is read (the units-mode parser,
milestone 5): a factor is one symbol from Find's unit list, an exact symbol first (`min`, `Pa`, `ft`, `cd`, `kWh`),
then prefix + symbol (`km`, `µF`); anything else is an error that names the factor and offers the near symbols.

**Bundle cost:** the app bundles `keyboard.yaml` whole into the start chunk (`app/vite-plugin-yaml.ts:11`), so the
section keeps its reasons in YAML comments; its data is 448 bytes of JSON. (The `templates:` section, also unread,
costs 2,165 bytes; when R10 makes `keyboard.ts` read it, that is spent anyway.)

## 2. The press count

Counting as docs/04 5.2: every press 1, a flick 1, Shift and Alpha 1. The cursor starts in the empty slot. The 50
units and the source line for each are in the probe (`UNITS`): SI Brochure 9th edition (BIPM, V4.01, June 2026,
downloaded 2026-10-13) Tables 2, 4, 5, 6 and 8; the benchmark tasks (t01, t02, t04, t10); the owner's feedback #8
(nanometres); P11's examples; the units-on-Giac probe cases ([r12](r12-evidence.md) section 2); the common prefixed units of Find's draft data (G4).
"Most common" is a judgement from these sources, not a measured frequency **(to verify: the owner names his own top
units; rerun the probe with them)**.

| Mode (`node tools/probes/unit-presses.mjs …`) | Median, 50 | Single (36) | Compound (14) | Max | Gate |
|---|---|---|---|---|---|
| flicks (default) | **2** | 2 | 4 | 9 | pass |
| `--no-auto-leave` (▶ after each exponent) | 2 | 2 | 4 | 10 | pass |
| `--lower-lock` (no flicks; slot starts in lower case) | 3 | 2 | 5 | 9 | pass |
| `--taps` (G2 sequences only) | 5.5 | 4.5 | 9 | 17 | **fail** |

Spread with flicks: 13 units take 1 press, 18 take 2, 9 take 3, 4 take 4, 3 take 5, 2 take 6, 1 takes 9.

Worst ten with flicks (↓ flick down, ↑ flick up; key ids from `spec/keyboard.yaml`):

| Presses | Unit | Sequence |
|---|---|---|
| 9 | kg·m²/s³ | ↓log ↓sin mul ↓neg sq div ↓d9 pow d3 |
| 6 | kg/m³ | ↓log ↓sin div ↓neg pow d3 |
| 6 | J/(kg·K) | ↑ln div ↓log ↓sin mul ↑log |
| 5 | W/(m·K) | ↑d6 div ↓neg mul ↑log |
| 5 | rad/s | ↓d8 ↓vars ↓x div ↓d9 |
| 5 | L/min | ↑sq div ↓neg ↓tan ↓paren |
| 4 | km/h | ↓log ↓neg div ↓cos |
| 4 | m/s² | ↓neg div ↓d9 sq |
| 4 | Pa·s | ↑eex ↓vars mul ↓d9 |
| 4 | W/m² | ↑d6 div ↓neg sq |

The cost is the exponents and the per-signs, not the letters: the worst unit is a dimension written out in base
units, which is exactly the unit check P11 wants to make cheap; 9 presses for a full dimension check is still short.
Every one of the 50 (and the 9 typable extras) reads as meant by qalc's parser, checked by the probe.

## 3. What the layout cannot type

`Å`, `′`, `″`, `%`, `Δ` (for Δ°C) and subscript digits (`mmH₂O`). **Fix: Math in a slot opens Find on units**, and the
pick goes in as one symbol (`angstrom`, `arcmin`, `percent`, `mmH2O` are qalc names Find already carries). For
temperature differences, docs/04 4.3 planned `Δ°C` and `Δ°F`: they become Find items too; `K` and `°R` (Rankine, an
absolute scale like K: section 8) can be typed directly. Nothing else in the 65 units tried was untypable.

## 4. Whole tasks

From the same rules (the probe's last block). The units key is one flick up on Tmpl (Shift + Tmpl = 2).

| Task | Presses | tasks.yaml plan | Note |
|---|---|---|---|
| t02 `72`, units key, `km/h` → `m/s`, Enter | 12 | 15 | |
| t02 without the end slot | 8 | — | shows 20 m/s (qalc's default unit; section 5.3) |
| t04 `2×π×25`, units key, ▶, `mm` → `m`, Enter | 13 | 14 | π has no slot (not a number) |
| t04 without the end slot | 11 | — | shows 0.157079632679 m |
| P11 unit check `kg·m²/s³ → W` on an empty line | 13 | — | 1 W, so the check passes |
| baseline `72 ÷ 3.6` | 7 | 7 | needs the factor in the head and checks nothing |

Units still lose the raw count against `72 ÷ 3.6` by one press, and win wherever the user does not know the factor
(psi → kPa, ft·lbf → J). The owner's hand timing in milestone 5 (backlog item 0, rule 2) stays the real gate.
t10 (uncertainty) is not counted: where `±` is typed is a milestone 5 question (section 7, open point 3).

## 5. Case pitfalls (evidence)

### 5.1 Case is meaning
The SI writes symbols lower case unless named after a person (SI Brochure 5.2), and prefixes differ only by case (m
milli, M mega). The probe typed each single unit of the list with its letters in other cases (all lower, all upper,
first letter flipped) and asked qalc's parser what that is: **25 caught** (not a unit: `kw`, `hz`, `Min`, `KG`),
**21 silently another unit of another dimension** (`pa` = picoare, an area; `Kg` = kelvin·gram; `S` = siemens; `H` =
henry; `a` = are), **4 silently the same dimension at the wrong size**:

| Meant | Typed | qalc reads | Off by |
|---|---|---|---|
| mm | Mm | megametre | 10⁹ |
| ms | Ms | megasecond | 10⁹ |
| mA | MA | megaampere | 10⁹ |
| MPa | mPa | millipascal | 10⁹ |

The end slot and the dimension check catch the 21; nothing but the reading catches the 4.

### 5.2 qalc's own parser misreads (reconfirms docs/04 4.3: never qalc's free parse)
`node tools/probes/unit-presses.mjs --read …`: `BTU` = tera-rack-unit·byte (`Btu` is right), `lbm` = pound·metre,
`var` (the SI's reactive-power unit, Table 8) = a function call, `Ra` = ronna-are, `G` = the gravitational constant,
`Δ°C` = a symbol Δ times °C, `In` = I·n. With qalc's misreadings of `mu0`, `degC`, `BTU`, `NA` ([r6](r6-pipelines.md) section 6) this is why the slot reads
from Find's unit list and sends qalc only whitelisted names.

### 5.3 Result-side pitfalls (for the empty end slot)
`node engine/qalc/smoke.mjs engine/qalc/_out/dev '1 N*m' '1 nV/sqrt(Hz)' '5 µm' '1 hp'` (qalc's optimal-SI
conversion, `glue.cc:94`): a torque `N·m` comes back as `1 J`; a noise density `nV/√Hz` as `Wb/√s`; `5 µm` as
`0.000005 m` (the glue turns prefixes off, `glue.cc:96`); `1 hp` as 745.699987158 W, wrong from the 7th digit
(docs/04 2.3 #10). G4 found `mmHg` defined as 1 Torr (find/units.yaml checks). So an empty end slot must not mean
"whatever qalc picks".

### 5.4 The guards that follow
1. A slot is read from Find's unit list, exact symbol first, then prefix + symbol; nothing else reaches qalc.
2. **The reading shows live under the slot**, in words (`MPa` → "megapascal"), as P11 asks. This is the only guard
   against the 4 same-dimension slips, so it is not optional.
3. A prefixed unit outside Find's common list (`Mm`, `Ms`, `MA`, `mPa`) is read, but its reading is marked (the
   warning colour), so the rare reading stands out.
4. A factor that is no symbol is an error naming it, with the near symbols from Find's case-blind match
   (`kw: kW?`, `mpa: MPa or mPa?`). Find ignores case (`find/aliases.yaml` in G4); the slot never does.
5. A prefix alone (`k`, `M`, `G`) is an error, never a constant.
6. With an end slot, the dimensions must match or the result is an error naming both (docs/04 4.3).
7. With an empty end slot, the result is shown in the units typed when they fit the result's dimension (torque stays
   `N·m`), else in SI with an SI prefix; the alternatives are one tap (section 7).

## 6. Recommendation and alternatives

**Recommendation:** the layout in `unit_slot:` with flicks, plus the guards of 5.4. Cost: none now (a record and a
probe); in milestone 5 it is the unit-view package.

- Lower-case lock in a slot instead of flicks: median 3, passes; the fallback if flicks are rejected.
- Case-blind entry with a pick list (as Find does): needs a pick whenever the letters have two readings (`mm`/`Mm`,
  `ms`/`Ms`, `mpa`), so the four same-dimension pairs cost a choice every time, and SI case is meaning.
- Units only as Find chips (Math, letters, Enter): at least 3 presses for any unit, about twice that for a
  compound Find does not carry whole (estimate, not counted), and every unit opens a list.
- A prefix chip strip above the keypad: costs vertical space (rule 9), and P11 already replaced it with the slots.

**Would change it:** the owner rejects flicks after R9 (then the lower-case lock); the owner's own top-unit list
gives a median above 4 (rerun the probe); the hand timing in milestone 5 shows slots losing to `E-10` for prefixes
alone (then `2.2n`-style prefix entry in the formula is the next candidate, docs/04 2.7).

## 7. Proposal: docs/04 4.3 and 4.4 rewritten for milestone 5

To replace sections 4.3 and 4.4 once the owner accepts this note (the review session applies it). 4.1, 4.2 and 4.5
still hold, except that "the Units app" reads "the unit view".

> ### 4.3 Decision: the unit view (entry, parsing, results)
> - **Entry (P11, layout in `spec/keyboard.yaml` `unit_slot:`, press count in docs/research/r7-unit-slots.md):** the
>   units key (Shift + Tmpl, a flick up on Tmpl) on an entry line or a picked history row shows the same formula,
>   read-only, with an empty unit slot after every number and an optional end slot "→ should be". On an empty line
>   it opens one slot (quantity 1) and the end slot. ◀ ▶ jump between slots, never through the formula; a tap on
>   the formula still puts the cursor there. Numbers belong in the formula: digits in a slot are only exponents.
>   Built on MathLive's prompts: a read-only mathfield with `\placeholder[id]{}` per slot (`getPromptRange`,
>   `getPromptValue`, MathLive 0.111.1 `types/mathfield-element.d.ts:781-810`) **(to verify, ron, first step: a
>   stacked fraction inside a prompt, and our key handling routed to the prompt)**.
> - **Grammar per slot:** a product of factors with `×`, one `÷` (the rest is the denominator), powers, `x⁻¹`, `√`.
>   A factor is one symbol from Find's unit list: an exact symbol first, then prefix + symbol. The parser in
>   `units` mode emits qalc text from these whitelisted names only (the generator's round-trip check, 3.3).
>   **Alternative rejected:** qalc's own parser, which reads `BTU`, `lbm`, `var`, `Kg`, `pa`, `G` as other things
>   (r7 section 5.2).
> - **Live reading:** under the slot, in words; a prefixed unit outside Find's common list is marked; a factor that
>   is no symbol is an error naming it with the near symbols. A prefix alone is an error.
> - **Our adapter checks what qalc lets through:** the formula with its units must give a single term (number ×
>   units), else "Units don't match: L vs T" naming the term (P11); an absolute temperature in arithmetic → "Use K
>   or Δ°C for a temperature difference"; with an end slot, a dimension mismatch is an error naming both.
> - **Result:** value (exact fraction or P-digit decimal) through our formatter at the digits setting, the mark by
>   the 2.4 rules with qalc's approximate flag as the engine fact, the unit drawn upright, the dimension as `L·T⁻¹`.
>   With an end slot: in that unit. Without: in the units typed when they fit the result's dimension (so a torque
>   stays `N·m`, qalc would say `J`), else SI with an SI prefix (2.7); one tap gives the SI base form and the last
>   unit used for that dimension (IndexedDB `units.targets`, `{dimKey: unitId}`).
> - **Temperature:** `°C` and `°F` are absolute and allowed only alone (`20 °C → °F` = 68, `derived`); differences
>   are `K`, `°R`, or the Find items `Δ°C`, `Δ°F`. Golden cases for each, and the rejected `20 °C × 2`.
> - **Logarithmic units, angles, currency:** as before (conversions only for dB, dBm, Np; `rad` stays in the
>   dimension key; currencies off, with the index test).
> - **The way back:** the result inserted into Home is a `\res` chip with the number in the unit shown; the chip's
>   label says the unit was dropped. The line itself keeps its slots, so the units key shows them again.
>
> ### 4.4 Budgets and gates
> qalc chunk +0.93 MB brotli, lazy: loaded on the first press of the units key, never at start (a Playwright test
> asserts no `qalc.*` request in a session without it); first result < 1 s on the Tab One; `units.yaml` in the
> golden gate; **a unit in ≤ 4 presses at the median** (`tools/probes/unit-presses.mjs`, then the same list as an
> e2e replay); benchmark tasks 1–4 and 10 within budget (plans after this note: t02 12, t04 13); the owner's hand
> timing (rule 2).

**Open points for milestone 5** (not for the owner now; each has a default):
1. ÷ makes the whole slot so far the numerator. Whether MathLive's `#@` (the ÷ key's template) takes the whole
   slot or only the last unit is **(to verify, ron)**; if only the last, the unit view gets its own ÷ in slots
   (default: our command, tested by an e2e per row of section 1).
2. The empty end slot's display rule (5.4 point 7) needs golden cases for torque, energy, power, noise density.
3. Uncertainty: `±` belongs to the number, so it is typed in the formula (Shift + (−), docs/04 5.1), and a
   `number ± number` gets one slot after it. t10 would take 25 presses against the plan's 31 (count by hand from
   these rules; the probe does not model it).

## 8. To verify

| What | Who, how |
|---|---|
| Flicks are reliable enough for letters (the gate depends on them) | the owner, after R9's APK; R9's misfire e2e |
| The owner's own top units give a median ≤ 4 | the owner names them; add to `UNITS`, rerun |
| MathLive prompts carry a stacked fraction and our key routing | ron, first step of the milestone 5 unit view |
| The empty-end-slot rule in qalc (typed units first) | gorge, U2, golden cases |
| `°R` is Rankine in qalc (docs/04 Appendix C asked) | done here: `--read °R` gives `oR`; `engine/qalc/smoke.mjs … '1 °R to K'` gives 0.555555555556 K (5/9 K, absolute, like K); a golden case in U2 |
