<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Owner feedback inbox

The one place for the owner's points from using the app (docs/03 section 0, rule 12). Newest first. Each point is kept in the owner's words (shortened) and gets one triage:

- **bug**: fixed now, regression test first;
- **feel**: goes into the next feel package (milestone 4a tasks F1–F7 in [backlog.md](backlog.md));
- **idea**: waits a week, then must pass rule 5 (G2 flow, a G2 friction removed, or more trust) before it gets a task;
- **decided**: became a decision (the id says where).

## 2026-10-13 (first days of daily use on the phone)

| # | Owner's point | Triage |
|---|---|---|
| 1 | The goal has to go back to staying close to the G2; the flow being similar to the G2 feels really good. | decided: P11, new goal in CLAUDE.md |
| 2 | Keep the arrow keys and their swipe mode. The 2D cursor after a long press anywhere is terrible; get rid of it entirely. Tapping into the formula on the screen already jumps there, as on the G2. | decided: P11; feel F2 |
| 3 | Add the Tmpl menu (a/b is not a G2 key; the fraction is the menu's first entry). Recorded in `spec/keyboard.yaml` `templates:`. | feel F5 |
| 4 | Switching apps (swipe gesture or the phone's app list) and coming back opens the system keyboard; it happens only when the entry field has focus. | bug F1 (fixed in the working tree, device check open) |
| 5 | Python scripting is terrible with the calculator keypad. Nobody would use Python on a calculator; you would use a Jupyter notebook on a laptop. Drop it. | decided: P11, F7 removes it |
| 5b | Instead: a hook into an AI tool, or a connection point (via Python, or to VS Code). | idea (see the discussion of 2026-10-13: an MCP server around the same engine) |
| 6 | On the G2, `=` is in the Shift layer while the variables are in Alpha: in Alpha you must leave it, press Shift, `=`, and go back. | feel F4 (flicks) |
| 7 | Flicks as the default: flick a key up or down for shift and alpha. Merge Shift and Alpha into the Format key (up and down) to free two keys? | flicks: F4. Merge: waits for a week of flick use and the tap counter (P7 point 4) |
| 8 | Units in other calculators are conversion tables, which is useless. Wanted: a normal entry line whose keys make unit entry easy (nanometres, fractions too), Enter gives the result, and "this should equal … unit" with an error when it does not match. | idea, input for milestone 5 |
| 8b | New: enter the calculation as usual, then (on demand) see the skeleton of the same formula and add the units afterwards; the result shows value and unit, so it is also a unit check. | idea, input for milestone 5 (discussion 2026-10-13) |
| 9 | The UI is messy. Vertical space is really precious; the calculation viewport must be big, so Home, CAS etc. have to live somewhere else. | decided: docs/03 rule 9; feel F3 |
| 10 | Generally make the UI better; the owner will gather more points and run UI feedback sessions. | feel F6 |
| 11 | Worry: cramming three open-source engines into one app makes a soup where nothing is useful. Qalculate!: single-line entry, cumbersome units, and its keyboard moves up and down so no muscle memory forms. The G2 is loved because the keys stay where they are. | decided: docs/03 rules 5–13 (rule 8: keys never move) |
| 12 | Anyone who really wants to graph uses Desmos or GeoGebra. | decided: P11, graphing stays at its level (rule 13) |
| 13 | How is Find reached, and doesn't it need a keyboard? Wanted: a way that does not rely on typing. | open question, discussion 2026-10-13 |

## 2026-10-13 (second round)

| # | Owner's point | Triage |
|---|---|---|
| 14 | Units after the formula replaces the Units app. But if the formula is already entered you never need + or −; and someone who only wants a quick unit check should not have to type a formula with numbers first. | decided: P11 (a single unit slot on an empty line) |
| 15 | Find as a fixed G2-style Math menu, typing filters it, no usage ranking. | decided: P11 |
| 16 | Uses Home daily, CAS sometimes, the other apps hardly (an engineering student). | decided: P11, Function and Solve frozen |
| 17 | The MCP server could be good. But more important: anyone who wants to change parts of the calculator or add their own scripts needs a real connection point, not a Python terminal nobody uses. | idea (discussion: a plain-text function library, edited on a laptop, imported on the phone, found in Find, assignable to a user key) |

## 2026-10-13 (third round: sign-off of the merged plan)

| # | Owner's point | Triage |
|---|---|---|
| 18 | Find's Math menu: maybe let the user rearrange the slots. A feature for later. | idea (fits rule 8: a personal order stays put) |
| 19 | Instead of the compact keypad (K4): a button makes the keypad collapse to the bottom with a small slice showing; tapping the slice brings it back. In this mode the viewport gains buttons to really work with the results, like a Jupyter notebook: delete, copy, move, merge, unit check, draw in Plot, and more later. | idea ("results mode", replaces K4; decide around 2026-10-20). R11's row actions are built so it can reuse them |
| 20 | Unit view: why Shift + Tmpl? The arrows must move from one unit slot to the next, not through the whole formula. The end slot is optional (empty = no check). | decided: P11 (Shift + Tmpl is where the G2 keeps Units, G2 item 30; ◀ ▶ jump slot to slot; empty end slot = no check) |
| 21 | The history-row buttons: needed, if only Home and CAS are the focus? | answered: yes, they are exactly Home/CAS (docs/05 section 7 point 2) |
| 22 | Theme: a setting Light / Dark / Follow system. | decided: System / Light / Dark, Dark by default on Android (docs/05 section 7) |
| 23 | Plan A–F signed off; order of milestone 4a agreed. | decided |

## 2026-10-13 (fourth round: the R5 APK)

| # | Owner's point | Triage |
|---|---|---|
| 24 | The system keyboard no longer pops up. | confirmed: F1 done |
| 25 | Home and CAS still have a bar at the top; it must go, for maximum vertical space. Isn't it all on the keys? | yes, every tab is on a key (Home key r3c1, CAS r3c5, Symb/Plot/Num). The tab row goes in R8; a status line of at most 28 px replaces it (angle, Shift/Alpha, busy) |

## 2026-10-13: waiting for the owner's notes on R6

The R6 APK (hold-and-drag gone, legends on their own line, dead keys dimmed per layer, the Plot hint above the axes) is on the phone.

| # | Owner's point | Triage |
|---|---|---|
| 26 | Flicks must work instantly: press and slide up in one motion. Having to press, wait, then flick feels terrible. | decided: added to R9 in the brief (distance only, no hold time; a press-slide-lift under 100 ms is a flick; e2e gate). No flicks are built yet (R9 not started); the press-wait-slide feel was probably the old hold-and-drag (K2) of the R5 APK, which R6 removed (to confirm with the owner) |
