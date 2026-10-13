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
| 25 | Home and CAS still have a bar at the top; it must go, for maximum vertical space. Isn't it all on the keys? | yes, every tab is on a key (Home key r3c1, CAS r3c5, Symb/Plot/Num). Fixed in R8 (`99b34e6`): a 28 px status line replaces the tab row (place, angle, format and digits, Shift/Alpha, busy) |

## 2026-10-13 (fifth round: the R6 APK)

The R6 APK (hold-and-drag gone, legends on their own line, dead keys dimmed per layer, the Plot hint above the axes) is on the phone.

| # | Owner's point | Triage |
|---|---|---|
| 26 | Flicks must work instantly: press and slide up in one motion. Having to press, wait, then flick feels terrible. | built in R9 (`cd4719f`): distance only, no hold time; a press-slide-lift under 100 ms is a flick (e2e gate). The press-wait-slide feel was probably the old hold-and-drag (K2) of the R5 APK, which R6 removed (to confirm with the owner) |

## 2026-10-13 (sixth round: keypad review against the G2)

The owner went through the key-by-key comparison ([06-keypad-vs-g2.md](06-keypad-vs-g2.md)). Decided as P12.

| # | Owner's point | Triage |
|---|---|---|
| 27 | a/b will become a toggle for special views like polar / real-imaginary, fractions, etc. | decided: P12 point 1; R10 |
| 28 | Home and CAS: first "shift and alpha of one key, the main key shows the mode"; then: "we don't need to show the current mode on the main button, I want to switch only via the top bar where it says which mode you are in, so we save 2 buttons." | decided: P12 point 2; R15 |
| 29 | The other app keys use up vertical space too: move the arrows one line down and clean up the top section (the menu keys etc.). | decided: P12 point 3; R15a mockups first |
| 30 | I don't like 10^ as the scientific notation: it needs so much space and only hurts the formula's readability. Use an E, and give the button a better name than EEX or ×10^. | decided: P12 point 4; **built in R14** (`d614260`). Waiting for the owner's notes on the APK |
| 31 | Leave x/y for now. | decided: P12 point 5 |
| 32 | The menus have to be revamped in the step where we add the other menus (fractions etc.); add it as an open point and analyse all menus. | open point A; S2 |
| 33 | I don't think we need quotes now that Python is gone. Decide. | decided: P12 point 7; built in R13 |
| 34 | We don't need the line jump, because the whole arrow pad is a 2D cursor. | decided: P12 point 8; built in R13 |
| 35 | Info, Notes and User omitted: good. | decided: P12 point 9 |

## 2026-10-13 (seventh round: undo)

| # | Owner's point | Triage |
|---|---|---|
| 36 | An undo action: select some math, press delete, and be able to undo it. How easy is it, does it make sense, how would we trigger it? | accepted by the owner 2026-10-13, without rule 12's week: MathLive's undo already works on the line; P13, package R16 (Shift + Cancel, flick up) |

## 2026-10-13: waiting for the owner's notes on R7

The R7 APK: every list (Apps, the view menus, the Home Menu, a history row's long press) opens on one sheet. Try Menu + Enter to repeat the last pick, ◀/Esc out of a submenu (the path is in the title), and the Function Plot menu with no function defined (reason lines; does row 1 hide under the top fade?). Open defaults: decisions.md "Needs the user", R7.

## 2026-10-13: waiting for the owner's notes on R9

The R9 APK: flick up on a key = its shift function, flick down = its letter, in one motion (no wait); a bubble shows what the lift fires, sliding back cancels. Lock flicks: up on Shift, down/up on Alpha. Settings > Shift / Alpha taps counts the taps for the P7 point 4 decision. To judge: the 20 px arm and 12 px cancel distances, and the tick (key vibration on in Settings).

## 2026-10-13 (seventh round: a bug found while using the phone)

| # | Owner's point | Triage |
|---|---|---|
| 37 | With some entry selected, ÷ divides the whole selection, but the abs key replaces it with an empty `\|□\|`. Does this happen for other functions too, and how do we fix it for the future of the implementation? | **Fixed in R17** (`c1efccf`): a selection is the argument of every key with an argument slot, and the power keys bracket it (decisions.md "A selection is the argument of the key"). Waiting for the owner's notes on the APK |

## 2026-10-13: waiting for the owner's notes on R10

The R10 APK: Tmpl opens the 6 × 3 template palette (arrows move, Enter or a tap inserts, ▶ walks the empty boxes). On an empty line a b/c toggles the last result 2.5 ↔ 5/2 and 3+4i ↔ polar; the Format key keeps Std/Sci/Eng/Pfx/Fix only. To check on the G2: the three unsure cells (evaluate-at r1c3, row vector r2c5, mixed number r3c2; G2 items 34–36), and whether the □ cells and the ′ ″ of DMS draw well in the WebView.

## 2026-10-13: waiting for the owner's notes on R14

The R14 APK: the exponent key's legend is now `ᴇ`. Type 1.5 ᴇ (−) 3: the line shows `1.5ᴇ-3` tight, one ⌫ removes the ᴇ, Enter gives 0.0015. On an empty line ᴇ starts with `1ᴇ`. Check that the WebView draws ᴇ on the key and on the line (if not: one line in `entry/macros.ts`).
