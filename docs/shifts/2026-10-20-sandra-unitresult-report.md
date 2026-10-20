<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# 2026-10-20 sandra: S11, the unit result view as packages (pipeline run 108)

**Verified** on the real evaluator (`tools/probes/unit-result.ts`: `buildJob` and `EngineHost.units`, engine `_out/gsl`, `phase-1`'s Find index), with the press counts from `tools/probes/unit-presses.mjs --pad [--taps]`. The evidence and the decisions are in [R17](../research/r17-unit-result.md).

**Changed:**
- New: `docs/research/r17-unit-result.md`, the package files `docs/shifts/packages/R60.md` to `R63.md`, `docs/mockups/unit-result.html` and `tools/probes/unit-result.ts`.
- `tools/probes/unit-presses.mjs`: the stale label "no end slot (result 20 m/s)" is fixed (G25 shows 72 km/h). Added the alternative-tap lines for t02 and t04, and t03 and t10 with units.
- `tools/probes/README.md`: one row.
- `docs/decisions.md`: M4-2 points 1, 5 and 6.
- `docs/backlog.md`: m5 item 4 and Needs the user item 1.

**Docs that disagreed:**
- The bundle names the note `r14`, but R14 (angle mode) exists and R16 is taken, so the note is R17.
- tasks.yaml t10 and r7 7.3 assume ± is Shift + (−). That is |x| (`spec/keyboard.yaml:211`), which is why M4-2 point 5 asks where ± goes.
- The probe's t02 label is fixed, as above.

**Still to verify:** r17 section 6. Does the units-mode parser put a slot after a `\res` chip (ron, R63's first step)? How many chips fit at 360 px (R62's gallery)? Does a tap stay within the 5 ms p95 (R60)?

**Top risks:**
- A chip in mm read as m in Home, if the label's unit is too faint.
- Without a ± key, t10 cannot go active.
- Raw Find weights cannot order the row. The pad's cells stand in for them, so a change to the pad changes the row.
