<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Owner feedback inbox

The one place for the owner's points from using the app (docs/03 section 0, rule 12). Newest first. Each point is kept in the owner's words (shortened) and gets one triage:

- **bug**: fixed now, regression test first;
- **feel**: goes into the next feel package (milestone 4a tasks F1–F23, F33 and F34 in [backlog.md](backlog.md));
- **idea**: waits a week, then must pass rule 5 (G2 flow, a G2 friction removed, or more trust) before it gets a task;
- **decided**: became a decision (the id says where).

## 2026-10-13 (first days of daily use on the phone)

| # | Owner's point | Triage |
|---|---|---|
| 1 | The goal has to go back to staying close to the G2; the flow being similar to the G2 feels really good. | decided: P11, new goal in CLAUDE.md |
| 2 | Keep the arrow keys and their swipe mode. The 2D cursor after a long press anywhere is terrible; get rid of it entirely. Tapping into the formula on the screen already jumps there, as on the G2. | decided: P11; feel F2 |
| 3 | Add the Tmpl menu (a/b is not a G2 key; the fraction is the menu's first entry). Recorded in `spec/keyboard.yaml` `templates:`. | feel F5 |
| 4 | Switching apps (swipe gesture or the phone's app list) and coming back opens the system keyboard; it happens only when the entry field has focus. | bug F1, fixed; confirmed on the phone (#24) |
| 5 | Python scripting is terrible with the calculator keypad. Nobody would use Python on a calculator; you would use a Jupyter notebook on a laptop. Drop it. | decided: P11, F7 removes it |
| 5b | Instead: a hook into an AI tool, or a connection point (via Python, or to VS Code). | idea (see the discussion of 2026-10-13: an MCP server around the same engine) |
| 6 | On the G2, `=` is in the Shift layer while the variables are in Alpha: in Alpha you must leave it, press Shift, `=`, and go back. | feel F4 (flicks) |
| 7 | Flicks as the default: flick a key up or down for shift and alpha. Merge Shift and Alpha into the Format key (up and down) to free two keys? | flicks: F4. Merge: no, two keys (owner, 2026-10-19, P7 point 4) |
| 8 | Units in other calculators are conversion tables, which is useless. Wanted: a normal entry line whose keys make unit entry easy (nanometres, fractions too), Enter gives the result, and "this should equal … unit" with an error when it does not match. | idea, input for milestone 5 |
| 8b | New: enter the calculation as usual, then (on demand) see the skeleton of the same formula and add the units afterwards; the result shows value and unit, so it is also a unit check. | idea, input for milestone 5 (discussion 2026-10-13) |
| 9 | The UI is messy. Vertical space is really precious; the calculation viewport must be big, so Home, CAS etc. have to live somewhere else. | decided: docs/03 rule 9; feel F3 |
| 10 | Generally make the UI better; the owner will gather more points and run UI feedback sessions. | feel F6 |
| 11 | Worry: cramming three open-source engines into one app makes a soup where nothing is useful. Qalculate!: single-line entry, cumbersome units, and its keyboard moves up and down so no muscle memory forms. The G2 is loved because the keys stay where they are. | decided: docs/03 rules 5–13 (rule 8: keys never move) |
| 12 | Anyone who really wants to graph uses Desmos or GeoGebra. | decided: P11, graphing stays at its level (rule 13) |
| 13 | How is Find reached, and doesn't it need a keyboard? Wanted: a way that does not rely on typing. | answered: P11 (#15); an empty query shows the Math menu (docs/05 section 7 point 1) |

## 2026-10-13 (second round)

| # | Owner's point | Triage |
|---|---|---|
| 14 | Units after the formula replaces the Units app. But if the formula is already entered you never need + or −; and someone who only wants a quick unit check should not have to type a formula with numbers first. | decided: P11 (a single unit slot on an empty line) |
| 15 | Find as a fixed G2-style Math menu, typing filters it, no usage ranking. | decided: P11 |
| 16 | Uses Home daily, CAS sometimes, the other apps hardly (an engineering student). | decided: P11, Function and Solve frozen |
| 17 | The MCP server could be good. But more important: anyone who wants to change parts of the calculator or add their own scripts needs a real connection point, not a Python terminal nobody uses. | idea (discussion: a plain-text function library, edited on a laptop, imported on the phone, found in Find, assignable to a user key). Shape and why written 2026-10-14: [archive/backlog-2026-10.md](archive/backlog-2026-10.md) "Parked ideas"; done as S4 ([archive/r10-connector.md](archive/r10-connector.md)) |

## 2026-10-13 (third round: sign-off of the merged plan)

| # | Owner's point | Triage |
|---|---|---|
| 18 | Find's Math menu: maybe let the user rearrange the slots. A feature for later. | idea (fits rule 8: a personal order stays put) |
| 19 | Instead of the compact keypad (K4): a button makes the keypad collapse to the bottom with a small slice showing; tapping the slice brings it back. In this mode the viewport gains buttons to really work with the results, like a Jupyter notebook: delete, copy, move, merge, unit check, draw in Plot, and more later. | idea ("results mode", replaces K4; decided: P16, package R53). R11's row actions are built so it can reuse them |
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
| 30 | I don't like 10^ as the scientific notation: it needs so much space and only hurts the formula's readability. Use an E, and give the button a better name than EEX or ×10^. | decided: P12 point 4; **built in R14** (`d614260`). |
| 31 | Leave x/y for now. | decided: P12 point 5 |
| 32 | The menus have to be revamped in the step where we add the other menus (fractions etc.); add it as an open point and analyse all menus. | decided: S2 (the menu rules) |
| 33 | I don't think we need quotes now that Python is gone. Decide. | decided: P12 point 7; built in R13 |
| 34 | We don't need the line jump, because the whole arrow pad is a 2D cursor. | decided: P12 point 8; built in R13 |
| 35 | Info, Notes and User omitted: good. | decided: P12 point 9 |

## 2026-10-13 (seventh round: undo)

| # | Owner's point | Triage |
|---|---|---|
| 36 | An undo action: select some math, press delete, and be able to undo it. How easy is it, does it make sense, how would we trigger it? | accepted by the owner 2026-10-13, without rule 12's week: MathLive's undo already works on the line; P13, package R16 (Shift + Cancel, flick up) |

## 2026-10-13 (seventh round: a bug found while using the phone)

| # | Owner's point | Triage |
|---|---|---|
| 37 | With some entry selected, ÷ divides the whole selection, but the abs key replaces it with an empty `\|□\|`. Does this happen for other functions too, and how do we fix it for the future of the implementation? | **Fixed in R17** (`c1efccf`): a selection is the argument of every key with an argument slot, and the power keys bracket it (decisions.md "A selection is the argument of the key"). |

## 2026-10-14 (eighth round: two entry bugs found while using the phone)

| # | Owner's point | Triage |
|---|---|---|
| 38 | The system keyboard comes back after switching apps again: move the cursor with a drag on the arrow keys, then switch away and back quickly, back and forth. | **feel, bug F9, package R22.** MathLive's own "restore focus" brings it back. When our hide handler blurs the field, MathLive arms "on the next window blur, then focus, focus the field again". So the second return focuses it (the first, too, when the page hides before the window blurs). In Playwright this happens after plain taps as well, not only after a drag (backlog F9) |
| 39 | log, log (`log(log(□))`), then ⌫ again and again: it stops at `log(` and deletes nothing more. | **feel, bug F10, package R23.** Not only log: any bracket pair whose content is gone (`log(2` ⌫ ⌫), and ⌫ right after any opening bracket with content (`sin(‸23)`, ‸ the cursor). MathLive turns `(` into an invisible bracket, then does the same again on every press. The half-deleted pair is a syntax error, never a wrong number (backlog F10) |

## 2026-10-14 (ninth round: the Alpha keys, Find, a units keyboard, smaller packages)

| # | Owner's point | Triage |
|---|---|---|
| 40 | The calculator no longer comes with Python; a connector will let the user program it from a laptop instead of typing through the Alpha keyboard. So many keys are free: (1) remove Alpha entirely (one key gained), or (2) remove the letters and put many new functions there (new to a G2 user, but a big gain)? Or other ideas? Then, after the analysis: "I see the need for the alpha keys, so then we keep them." | decided: decisions.md "The letters stay" (2026-10-14). Dropping the Alpha key stays P7 point 4, read on the tap counter around 2026-10-20 (freed cell: U4). Raised in the analysis: a lower-case CAS letter costs 3 presses (flick down types the capital); G2 item 45 asks what the G2's CAS does |
| 41 | What do we look up in Find? Will it go past what the G2 offered? | answered (docs/04 section 3): one search over every documented Giac function (38 curated and checked, about 1,270 more marked "not checked"), 435 units, 34 prefixes and the CODATA constants with their uncertainty, plus the user's own variables and functions (later also a library from the laptop). Past the G2: one search where the G2 has the Math menu, Catalog, Units and Vars apart; aliases and typo tolerance ("kph", "speed of light"); a preview with value, uncertainty, SI factor or syntax and example; more units (Length 52 against the G2's 21). With an empty query it shows the G2-style Math menu |
| 42 | A dedicated units keyboard: even if the presses add up, it is not easy to remember the Alpha and Shift + Alpha combinations for a unit like kN. Prefixes on the left, units on the right: pick a prefix (it is now selected for the slot), then one or more units, then a big Enter like the G2's (maybe the same spot) puts the combined unit in the slot and moves to the next slot. | decided: P14 (decisions.md, 2026-10-14) with #43's amendment: [archive/r9-unit-pad.md](archive/r9-unit-pad.md), `spec/unit-pad.yaml`; packages S5, G7, R24a–R24d in the brief |
| 43 | "I like your P14." Should the pad be user configurable? Rather not: one would spend a lot of time optimizing something that has a clear optimum (maybe not the same for everybody). Let the user change a few buttons, like the user keys, for the special units of their own workflow; the base units need the best arrangement, found by research, since some units are used much more often, like e, n, s among letters. Then: "let the number of user cells be undefined for now." | decided: P14 with user cells, their number open (decisions.md). Package S5 counts how often engineers use each unit, finds the cheapest arrangement under P14's fixed rules, scores 1 to 6 user cells and proposes a number; the owner accepts the arrangement before R24b draws it |
| 44 | Make the implementation into smaller work packages, so a session does not run out of tokens. | done: R24 is now R24a–R24d (brief section 0d), one concern each, about a day or less, each with its own short reading list |

## 2026-10-14 (tenth round: a deep analysis around F9 and F10)

| # | Owner's point | Triage |
|---|---|---|
| 45 | Are there more bugs like F9 and F10 in the same areas, patterns and edge cases? A deep analysis. | **feel, bugs F11–F23** (packages R25–R27). Found by Playwright probes: every keyboard template under ⌫ and Del, a digit typed at every cursor position, and focus and touch cases around leaving the app. **Focus:** a held ⌫ keeps deleting while the app is away and focuses the field again (F11); a touch the app never saw end fires on the next key (F12); a key pressed less than 60 ms before leaving focuses the field after `dropFocus` (F13); on desktop, a mouse ⌫ released off the keypad never stops (F14). The notification shade or share sheet, twice, has the same cause as F9 (R22's test gains it). **⌫ and Del:** after `)` (F15); the hardware keys bypass our path (F16); powers (F17: `2 + x² ⌫ ⌫` gives 2²), fractions and roots (F18), lim Σ Π ∫ (F19), matrices and piecewise (F20), log base, EQ, DMS and evaluate-at (F21). **Neighbours:** 10ˣ after a digit gives 510² (F22); the cursor stops between sin and `(`, where a 7 gives sin 7(2) = sin 14 (F23). Rules: decisions.md "⌫ and Del keep a template whole" and "Nothing takes focus while the app is away". G2 items 46–51 |
| 46 | Many small work packages with everything on the behaviour, how to reproduce it and how to fix it (or left open), written into the docs. | done: packages R25a–R25c (focus and touches), R26a–R26h (the ⌫ grid test, then one template family each), R27a–R27b (10ˣ after a digit, cursor stops) in brief sections 0b and 7, each a quarter to one day. R27a waits for G2 item 48 and the owner's pick |

## 2026-10-14 (eleventh round: a deep dive into the whole app)

| # | Owner's point | Triage |
|---|---|---|
| 47 | "Do you see any pitfall or something that should be done differently? Or ideas that were never mentioned in the docs? Do a deep dive and report anything you find." Then, on the report of 24 findings: "I fully agree with all items." | **decided:** decisions.md "The deep-dive review", P15 (the unit view computes on Giac, if G15's check passes) and P5 (b) revised. Bugs F24–F32 (backlog "Trust and robustness"), the rest as packages in brief sections 0e and 0f |
| 48 | Add extensive work packages, in small packages, placed in the order Opus set: by importance, then by the dependencies. | **done:** brief sections 0 ("The path"), 0c (the night queue), 0e and 0f; about 30 packages of at most a day, most of half a day |

## 2026-10-15 (twelfth round: a fraction in a fraction)

| # | Owner's point | Triage |
|---|---|---|
| 49 | "When you have a fraction in a fraction and press ▶, it does not go to the end of the inner fraction (inside the main fraction) but somewhere else, so you cannot add to the fraction; and pressing with the finger at the end does not put the cursor there either." | **feel, bugs F33 and F34** (packages R42, R43). Two causes, both reproduced: ▶ jumps to any empty box ahead, so the end of the numerator is skipped while the denominator is empty (F34, also after a power or a root: x²/(+1)); a finger tap at the right edge of a fraction, root, power or bracket lands at the start of the line, since MathLive places the caret a second time on a touch lift from stale bounds (F33; 11 of 40 test points). Packages R42 and R43, rule in decisions.md "The cursor goes where the user aims", G2 item 57 |

## 2026-10-17 (thirteenth round: vibration, ⌫ on log, lower-case faces, colours)

| # | Owner's point | Triage |
|---|---|---|
| 50 | "Vibration does not work. The settings must be cleaned up so vibration is a submenu or so." | **bug F41** (package A9 on the owner's phone: it was never tried on a phone with a motor, since the Tab One has none). **feel:** Settings as a short list of rows, each with a page of its own (decisions.md "Settings in the Mode sheet, and presets": R49, R85–R89) |
| 51 | "Pressing ⌫ on a log() used to be stuck at log(, now it is stuck at log, I think." | **bug F39** (package R47). Reproduced in Playwright: a finger tap can put the cursor between `log` and `(`, where ◀ ▶ never stop; ⌫ there deletes only the name, leaving `(100)` with the cursor at the line's start, and every further ⌫ does nothing. Fixed in R47 (the tap case); *the owner's exact key sequence is still to confirm (backlog "Needs the user" item 4)* |
| 52 | "If you press Shift + Alpha, the letters on the keypad are still upper case; they should switch to show they are now lower case." | **bug F40** (backlog item 37, package R48): the keys type lower case, but the faces still show capitals |
| 53 | "The colour scheme of the app is not good; I want something nicer, light and dark." | **feel:** decided 2026-10-18 on `docs/mockups/themes-r50.html` (decisions.md "R50"): five families, light and dark, High contrast and Plain keys; packages R50b–R50e, before R12's visual pass |

## 2026-10-18 (fourteenth round: the R12a mockups)

| # | Owner's point | Triage |
|---|---|---|
| 54 | On `docs/mockups/visual-pass.html` (R12a): "the mockup looks good", but "the entry field is very narrow". | **feel:** R12a merges as is; R12b (tokens and history rows) gives the entry line more height |
| 55 | On the same mockups: "the colors should be nicer". | **feel:** answered with #53 (decisions.md "R50"); R12b builds on the theme tokens |
