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

## Appendix A: probes
The probes behind this document are in `tools/probes/` (its README says how to run each): `engine.ts` (Home and CAS paths through `EngineHost`, `FACTS=1` for the facts), `parse.ts` (the parser), `digits-cost.ts`, `units-giac.mjs` (G15), `find/` (the index prototype), `start-chunk.mjs`, `bound.ts`, `replay-cost.mjs`, `unit-presses.mjs`, `results-geometry.mjs`. What they found is in [research/r12-evidence.md](../research/r12-evidence.md); oracle values come from mpmath in `tests/golden/.venv` (the expressions: r12 section 1).
