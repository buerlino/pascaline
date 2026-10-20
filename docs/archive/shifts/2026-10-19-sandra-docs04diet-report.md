<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# S10: the docs/04 diet (sandra, 2026-10-19)

Package S10 ([check-2026-10-19.md](check-2026-10-19.md) finding 15), branch `p1/sandra-docs04diet`. docs/04 went from 69,455 to 59.7 kB (budget 70 kB), so R15c2's rewrite of 5.1 and G34's sentence in 2.8 fit.

## What moved where
Everything that is evidence went to a new [research/r12-evidence.md](../../research/r12-evidence.md). docs/04 keeps the heading and a short stub with a link at each place, so the section numbers other files cite still work ("docs/04 2.3 #17" is row 17 of r12 section 1).

| From docs/04 | To |
|---|---|
| 2.3, the table of 19 wrong or unmarked paths | r12 section 1 (rows numbered as before), with the oracle expressions that were in Appendix A |
| 4.1, the units-on-Giac table, the timings and the count of units with no factor | r12 section 2 (now with the 34 of 2026-10-18) |
| 2.5, the desktop and Tab One digits-cost numbers | r12 section 3 (the gate stays in 2.5) |
| 5.5 "State", the box model, its tests and the unit field as read on 2026-10-15 | r12 section 4 (the key path is already in r6 section 1) |
| 1.2, the module table | r12 section 5 |
| 3.1, the index's first numbers | r12 section 6 (its sizes are also in 8.3) |
| 4.3, the MathLive prompt probe; 3.3 step 3, qalc's misread names | links to r6 sections 7 and 6, where the probes already were |
| 7.2, the licence table; 3.3 "Licences" | one paragraph that points to THIRD_PARTY.md (one place per fact) |

Also shortened: section 0 item 11 (the key list now lives only in 5.1 and docs/06), item 10, the measurements repeated from 8.3 in 1.1 and 6.2, Appendix A and B, the doubled "long CAS job" line in 4.2.

## Docs fixed because they disagreed with the code or with other docs
- docs/04 header: the binding inputs are `docs/rules-core.md`, not CLAUDE.md.
- 2.4 rule 4: `tieRisk` is now set at `homeEval.ts:417` (was 325) and still has no reader (`grep -rn '\.tieRisk' app/src` finds only where it is passed on).
- 8.3 State: start chunk 53.28 kB gzip, MathLive 807.74 kB, unit view 9.44 kB, precache 12.4 MB: the numbers check-2026-10-19 measured on `cb1c74c`. The budgets match `app/scripts/size-check.ts:93-101`.
- r7-unit-slots.md lines 65 and 142 pointed to docs/04 4.1 for things that are now in r12 section 2 and r6 section 6.

## Verified
`node tools/docs-check.mjs`: ok, docs/04 59.7/70 kB. `grep -rn '04-architecture.md#'` finds no anchor links (only the package text). Nothing under `app/` changed.

## For the owner or the next Opus pass (shared files)
- docs/README.md, the "Research notes" line: add `[research/r12-evidence.md](research/r12-evidence.md) (the evidence behind docs/04: the regression list, units on Giac, the module table)`.
- The comments in `tests/golden/units.yaml:64` and `tools/probes/units-giac.mjs:329` say "docs/04 4.1's table". The stub there links to r12 section 2, so they still work. gorge and annabell can say r12 section 2 the next time they touch those files.

## Still (to verify)
Nothing new. The numbers I moved keep their dates and sources.

## Risks
A reader who follows "docs/04 2.3 #n" now has to click once more. If the stubs drift away from r12's row numbers, that address breaks. r12 is the only place for those rows now: rewrite them there, in place.
