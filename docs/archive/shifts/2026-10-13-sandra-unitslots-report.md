<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# S1 report: unit-slot paper test (sandra, Opus, 2026-10-13)

Branch `p1/sandra-m4a-unitslots` (worktree `.claude/worktrees/m4a-s1`, from `phase-1` at `f5566a5`). Brief section
0b, package S1. Full result: [docs/research/r7-unit-slots.md](../../research/r7-unit-slots.md).

## Result
**Gate passes: a unit takes 2 presses at the median** over 50 common engineering units (36 single units: 2; 14
compound units: 4; worst `kg·m²/s³`, 9). Gate: median ≤ 4 (P8 rule 2).

- It depends on **flicks** (R9). With G2 taps only the median is 5.5 (fails). If flicks are rejected after their
  trial, a lower-case letter lock inside slots gives a median of 3 (passes). No key moves in any variant.
- **Case slips:** of 50 wrong-case variants, 25 are not units (caught), 21 are silently another unit of another
  dimension (`pa` = picoare, `Kg` = kelvin·gram), and 4 are the same dimension at a wrong size of 10⁹ (`Mm`, `Ms`,
  `MA`, `mPa`). Only a live reading under the slot catches those 4, so it is required, not a nicety.
- **One rule changed from P11's wording**, with the same press count: the number is typed before the units key
  (`72`, units key, `km/h`). Digits inside a slot are only exponents, so the digit keys that carry letters never
  mean two things in one slot.
- Tasks with these rules: t02 12 presses (plan 15), 8 without the end slot; t04 13 (plan 14); the P11 unit check
  `kg·m²/s³ → W` 13. `72 ÷ 3.6` is still 7, so for a known factor units lose by one press but check the unit.

## What I verified, and how
- Press counts: `node tools/probes/unit-presses.mjs` (also `--taps`, `--lower-lock`, `--no-auto-leave`); it reads
  the new `unit_slot:` section and the keys' alpha letters from `spec/keyboard.yaml`.
- qalc readings with the built qalc (`engine/qalc/_out/dev`, libqalculate 5.13.1): all 50 units, and the 9 typable
  extras, read as meant. Wrong-case slips and qalc's own misreads (`BTU`, `lbm`, `var`, `Ra`, `G`, `Δ°C`):
  `--read …` and the probe's last block. Result-side pitfalls (`1 N*m` → `1 J`, `nV/√Hz` → `Wb/√s`, `5 µm` →
  `0.000005 m`) with `engine/qalc/smoke.mjs`. `°R` is Rankine (1 °R = 5/9 K), which docs/04 Appendix C asked.
- Source lines for the 50: SI Brochure 9th ed. (BIPM, V4.01, June 2026; downloaded to scratch space only, not in the
  repo) Tables 2, 4, 5, 6, 8 and section 5.2; tasks.yaml; feedback #8; P11; docs/04 4.1; G4's draft unit list.
- MathLive 0.111.1 has prompts (`\placeholder[id]{}` in a read-only field, `getPromptRange`/`getPromptValue`,
  `app/node_modules/mathlive/types/mathfield-element.d.ts:781-810`): a likely base for the unit view.
- `spec/keyboard.yaml` still loads: typecheck 0 errors; Vitest 435 passed, 22 skipped (Python cases without
  `PYTHON_OUT`). The section adds 448 bytes of JSON to the start chunk (the app bundles the file whole,
  `app/vite-plugin-yaml.ts:11`); the reasons are in YAML comments, which cost nothing. e2e not run: no runtime
  code reads the new section.

## Changed files
- `spec/keyboard.yaml`: new `unit_slot:` section (layout record only, before `templates:` so it does not touch R5's
  Python removal at the end of the file).
- `tools/probes/unit-presses.mjs`: new probe. `tools/probes/README.md`: its row.
- `docs/research/r7-unit-slots.md`: the result, the pitfalls, the recommendation, the docs/04 4.3–4.4 proposal.
- This report.

## Still (to verify)
| What | Who, how |
|---|---|
| Flicks reliable enough for letters (the pass depends on them) | owner on R9's APK; R9's misfire e2e |
| The owner's own top units give a median ≤ 4 | owner names them; add to `UNITS` in the probe, rerun |
| MathLive prompts hold a stacked fraction, and ÷'s `#@` takes the whole slot | ron, first step of the milestone 5 unit view |
| Empty end slot shows the typed units when they fit (torque stays N·m) | gorge, U2 golden cases |

## Top risks
1. **Flicks fail their trial** → unit slots fail the gate with G2 taps alone. Fallback ready (lower-case lock, median 3).
2. **Same-dimension case slips** (`mPa` for `MPa`) are invisible to every check except the live reading; if the
   reading is small or hidden, a 10⁹ error goes through silently.
3. **qalc's default result unit** turns a torque into joules and noise densities into webers; the empty end slot
   needs its own rule (r7 5.4 point 7).

## For shared files
**Applied on this branch after the owner accepted (2026-10-13)**, as DECIDED rather than PROPOSED: docs/decisions.md (S1 entry, P11 note), docs/backlog.md (S1 done, milestone 5 step 4 rewritten, step 5 and G7 wording; no "Needs the user" line, since it is decided), docs/04 (4.3–4.4 replaced, 4.2 load trigger, 5.1 rows, Appendix C Rankine). Not applied: tests/tasks/tasks.yaml (the flick notation comes with R9; do it when milestone 5 starts). The original text, kept for the record:
- **docs/decisions.md, "Needs the user"** (new entry, top):
  > **2026-10-13 S1: unit-slot layout (P11). PROPOSED by sandra, needs the user.** The paper test passes: a unit
  > takes 2 presses at the median over 50 common units (gate ≤ 4), with flicks; G2 taps alone give 5.5 (fail), a
  > lower-case lock in slots gives 3 (the fallback if flicks go). Layout in `spec/keyboard.yaml` `unit_slot:`,
  > evidence in docs/research/r7-unit-slots.md. **Recommendation: accept** (a) µ on the (−) key, Ω on the comma
  > and ° on a b/c as one-tap cells inside a slot (Greek m and O on the keys carrying M and O; the G2's shift a b/c
  > is degrees-minutes-seconds), (b) the number is typed before the units key, digits in a slot are only exponents
  > (P11 let the empty-line slot start with a number; same press count, no key with two meanings), (c) the live
  > reading under the slot is required (4 case slips, `Mm`/`Ms`/`MA`/`mPa`, are the same dimension at 10⁹ off).
  > Why: P8 rule 2, principle 3. Cost: none now. Alternatives: case-blind entry with a pick (a choice on every
  > m/M); Find chips only (≥ 3 presses per unit). Would change if: flicks are rejected (then the lower-case lock);
  > the owner's own top units give a median above 4.
- **docs/backlog.md, "Needs the user":** one line: "S1 unit-slot layout: accept µ/Ω/° cells, number-first rule,
  live reading (decisions.md 2026-10-13 S1)."
- **docs/backlog.md, milestone 4a, S1 line (around line 79):** "S1 done: median 2 presses (gate ≤ 4), depends on
  flicks; r7-unit-slots.md." **Milestone 5 step 4:** replace "first the `unit_slot:` paper test" with "layout and
  press count: r7-unit-slots.md (S1, passed)"; replace the old Units app text with "docs/04 4.3 as rewritten from
  r7 section 7"; gate "a unit in ≤ 4 presses at the median" stays.
- **docs/04-architecture.md:** after the owner accepts, replace 4.3 and 4.4 with r7 section 7 (the quoted text). In
  5.1, the row "Units app layer" becomes "Unit slots: `spec/keyboard.yaml` `unit_slot:` (r7)"; `→` is the end slot
  reached with ▶, so Shift + EEX = `→` is no longer needed; `±` per r7 section 7, open point 3. Appendix C: the
  Rankine item is answered (`°R` = Rankine in qalc 5.13.1).
- **tests/tasks/tasks.yaml** (pending plans, when milestone 5 starts): t02 keys `d7 d2 ↑tmpl ↓log ↓neg div ↓cos
  right ↓neg div ↓d9 enter`, budget 12; t04 `d2 mul ↑d3 mul d2 d5 ↑tmpl right ↓neg ↓neg right ↓neg enter`, budget
  13 (the flick notation comes with R9's task-benchmark change).
- **docs/feedback.md:** nothing new from the owner; no change.
