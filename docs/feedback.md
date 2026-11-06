<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Owner feedback inbox

The one place for the owner's points from using the app (docs/03 section 0, rule 12). Oldest first, one dated section per round, numbered on from the last row (the next is 56). Each point is kept in the owner's words (shortened) and gets one triage:

- **bug**: fixed now, regression test first;
- **feel**: goes into the next package for the look or the entry (brief section 0);
- **idea**: waits a week, then must pass rule 5 (G2 flow, a G2 friction removed, or more trust) before it gets a task;
- **decided**: became a decision (the id says where).

Rows 1–55 (2026-10-13 to 2026-10-18) are triaged; their text is in git at `6550cc93`. The rows below stay because live files cite them by number (`tools/probes/unit-presses.mjs`, docs/06 section 2, `tests/golden/G2-CHECKLIST.md`).

| # | Date | Owner's point | Triage |
|---|---|---|---|
| 8 | 2026-10-13 | Units in other calculators are conversion tables, which is useless. Wanted: a normal entry line whose keys make unit entry easy (nanometres, fractions too), Enter gives the result, and "this should equal … unit" with an error when it does not match. | idea, input for milestone 5; built as the unit view (P11, P14, R24a–R24d) |
| 17 | 2026-10-13 | The MCP server could be good. But more important: anyone who wants to change parts of the calculator or add their own scripts needs a real connection point, not a Python terminal nobody uses. | idea (discussion: a plain-text function library, edited on a laptop, imported on the phone, found in Find, assignable to a user key). Shape and why written 2026-10-14: `archive/backlog-2026-10.md` at `87a8c468` "Parked ideas"; done as S4 ([archive/r10-connector.md](archive/r10-connector.md)) |
| 40 | 2026-10-14 | The calculator no longer comes with Python; a connector will let the user program it from a laptop instead of typing through the Alpha keyboard. So many keys are free: (1) remove Alpha entirely (one key gained), or (2) remove the letters and put many new functions there (new to a G2 user, but a big gain)? Or other ideas? Then, after the analysis: "I see the need for the alpha keys, so then we keep them." | decided: decisions.md "The letters stay" (2026-10-14). Dropping the Alpha key stays P7 point 4, read on the tap counter around 2026-10-20 (freed cell: U4). Raised in the analysis: a lower-case CAS letter costs 3 presses (flick down types the capital); G2 item 45 asks what the G2's CAS does |
