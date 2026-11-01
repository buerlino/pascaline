<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Architecture, passages moved out (archive)

History only: passages of [../04-architecture.md](../04-architecture.md) moved here word for word when they were settled. What binds is in docs/04.

## Moved 2026-10-30 (16:00 review) to make room for the night of 2026-10-30, as they stood

### 4.1 Evidence: units on Giac (G15's probe, 2026-10-15)
G15's probe (`tools/probes/units-giac.mjs`) computed the spike's cases, the tasks and S1's 50 units exactly in Giac with the Find index's factors, in one call of median 0.5 ms on the desktop. It agreed with qalc 5.13.1 except where qalc is wrong (`hp`, `mmHg`: oracle) or gives no error (`1 m + 1 s`). The table and the units refused for want of an exact factor (`nofactor`): [research/r12-evidence.md](../research/r12-evidence.md) section 2.

### 5.5 Decision: the entry line, one key path and one box model (architecture check, 2026-10-15)

**State:** the key path step by step is [r6](../research/r6-pipelines.md) section 1; the box model, its tests and the unit view's field as read on 2026-10-15 are [research/r12-evidence.md](../research/r12-evidence.md) section 4.

**Decision:**
1. **One key path** (built, R45): every key, from the keypad or a hardware keyboard, goes through `press()`; `hwkeys.ts` only maps a character or key name to a keypad key id and layer, so an open sheet, a picked row, Find and the unit slots see hardware keys exactly as keypad keys.
2. **One owner per key press.** `press()` hands the key to whatever owns it now: an open sheet, Find, a unit slot, a picked history row, or the entry line. Three exist (`settingsPress` until R49, `sheetPress`, `historyKey`; `keyboard/route.ts`); Find and the slots add two. The unit view never sends keys through `EntryController.run`: its slots change only through R24a's model and `setPromptValue`. The common seam is built with the second new owner (R24c), not before.
3. **One box model** (built, R43): `entry/boxes.ts`, read by `delete.ts`, `stops.ts` and `nextBox`. The cursor grid checks, for every template, that ◀ visits every stop and nothing else, ▶ reaches the end, every stop is at the edge of a box, and ▶ from the end of an inner box stops at the end of the outer one (▶ cannot stop at every box while an empty box is ahead: R10 jumps to it).
4. **A new template** brings, in its commit, a parser rule with its round trip (as before) and a recogniser in `boxes.ts` when its LaTeX shape is new; the grids read the yaml and need nothing.

**Alternatives:** a template registry that describes each key's boxes as data (cleaner, but every recogniser would be rewritten at once, and the grids already catch a missing one); leave the three models (each new template and the unit view then add more copies that drift apart, as F34 shows; R29 added the parser's).
**Risks:** the recognisers read MathLive's atom LaTeX (`\text{i}`, `\mathrm{d}`, `\,`), so a MathLive upgrade can break them without a type error; both grids are the guard and run before any upgrade merges.
**Would change if:** a MathLive upgrade breaks the recognisers more than once; then the template registry of the alternatives replaces them.

## Moved 2026-10-31 (Opus pass 32) to make room for R93 and R94, as they stood

### Units: the grammar per slot, the rejected alternative
**Alternative rejected:** qalc's own parser, which reads `BTU`, `lbm`, `var`, `Kg`, `pa`, `G` as other things (docs/archive/r7-unit-slots.md section 5.2).

### Units: the uncertainty, why no Monte Carlo check
no Monte Carlo check (GUM Supplement 1): cos X, X ~ N(0, 0.1²), spreads 0.0070358300299, the formula 0.00707106781187)

## Moved 2026-11-01 (Opus pass 43) to make room for R63's way back, as they stood

### 2.4 The mark and the agreement check: alternatives
**Alternatives:** a mark from `approximate` alone (cannot tell 1/3 from 1/4); MPFI intervals (S20).

### 2.5 Digits up to 30: alternatives
**Alternatives:** keep 15 (reference data needs more); unlimited digits (the 40-digit value path and the screen width cap it at 30).

### 2.6 Copy and paste: alternatives
**Alternatives:** copy the displayed text by default (hides digits, against principle 3); copy the exact form by default (`1/3` pastes badly into spreadsheets and code).

### 2.8 Reuse through chips and Ans: alternatives
**Alternatives:** insert the full digits as text (40 digits clutter the line); keep inserting the rounded digits (2.3 #8).

### 3.3 The index: alternatives
**Alternatives:** generating at run time (start-up, memory); committing the generated JSON (not our source for F-Droid; P22's `find/factors.yaml` is the audited source, not output).

### 3.5 Ranking: alternatives
**Alternatives:** uFuzzy, fuzzysort, Fuse.js (they know none of our tiers or kinds).

## Appendix A: probes
The probes behind this document are in `tools/probes/` (its README says how to run each): `engine.ts` (Home and CAS paths through `EngineHost`, `FACTS=1` for the facts), `parse.ts` (the parser), `digits-cost.ts`, `units-giac.mjs` (G15), `find/` (the index prototype), `start-chunk.mjs`, `bound.ts`, `replay-cost.mjs`, `unit-presses.mjs`, `results-geometry.mjs`. What they found is in [research/r12-evidence.md](../research/r12-evidence.md); oracle values come from mpmath in `tests/golden/.venv` (the expressions: r12 section 1).
