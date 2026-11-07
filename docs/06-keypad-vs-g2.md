<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Keypad against the G2: every difference and why

Written 2026-10-13 from a key-by-key comparison of the G2 keypad with `spec/keyboard.yaml`, checked against the decision docs, and then reviewed point by point with the owner (decision P12 in [decisions.md](decisions.md)). **One place for this question:** when a key differs from the G2, the reason is here; the layout itself is `spec/keyboard.yaml`, the G2 behaviour is `spec/mapping/vc-2026-10-11/keys.yaml`. The Fmt key (our replacement of the On/Off key) is left out. Rules that decide a difference: [03-feature-analysis.md](03-feature-analysis.md) section 0 (rules 5–9, 11) and CLAUDE.md.

## 1. Planned, not built yet (not a departure)
The legend is missing on the keytop only because the feature is not built; the key is dimmed in that layer.

| Key and layer | Planned as | Where decided |
|---|---|---|
| Help (row 0, col 4, the G2's r1c4) | context help from the Find index (milestone 6); the owner may veto | docs/04 5.1, R15c, R146 |
| results mode: the handle on the keypad's top edge and a swipe down on the entry line (R53) | the keypad collapses to a slice | P16, S9, R146 |
| Shift + 4, 5 | matrix editor, `[ ]` (EN5, milestone 6) | docs/04 5.1 |
| Shift + 7 (List) | deferred with Statistics | docs/04 5.1 |
| Shift + − (Base) | Base menu (EN6, milestone 6) | docs/04 5.4 |

## 2. Different on purpose, with a written reason
| Difference | Reason |
|---|---|
| Esc stops a running job, then closes Settings, goes back one sheet level, drops a picked row, else clears the line; no Cancel key | Fmt took the On slot, which is where the G2 interrupts a job; every engine call must be cancellable (CLAUDE.md maths rules), and one key for "stop or back" saves a cell (R15c point 3). A hardware Escape is this key |
| No Apps, Symb, Plot, Num or Menu key: the place name, the view tabs and ☰ on the status line | the G2's view keys sit where R3 puts six user keys; every view stays one tap away (R15c points 6 and 7, R15c1) |
| No Mode key (Shift + Apps on the G2's Info); Mode is a tap on a status chip (Shift + Fmt since R85), Settings Mode's last row and the last row of every ☰ menu, as a level of the same sheet | the G2's Info page is blank (rule 4); the chips show what Mode sets (R15c point 7); Fmt's Shift cell was free, so Mode gets a keys-only path (owner, 2026-10-27; decisions.md "Settings in the Mode sheet, and presets") |
| Math opens Find (R4a): one search over functions, constants and units; with an empty query it is a G2-style Math menu, fixed categories in a fixed order | one search where the G2 keeps the Math menu, Catalog and Units apart (P8); the empty query keeps the G2's menu, so the same keys reach the same function, with no usage ranking (P11, docs/03 rule 8) |
| Vars opens Find on the user's variables and functions (R4b); Shift + Math (Memory) is the same sheet with delete and "clear all" | the user's names are searched like everything else (P8); Memory keeps the G2's cell and needs no list of its own (docs/04 3.7, 5.1) |
| Shift + Tmpl opens the unit view: the line read-only with a unit slot after every number, and the unit pad (R24a–R24d) | the G2 keeps Units there (G2 item 30); a conversion table is not a unit check, so the units go into the calculation itself (P11, P14, S1; docs/04 section 4) |
| The round pad is a circle with no OK key and no drawn hub; a drag from anywhere on it, the centre too, steps the cursor, a tap at the centre does nothing | Enter is the OK; the centre is where a drag starts (R15c point 1; owner, 2026-11-06: round, no dashed ring) |
| Undo \| Redo on one layer of two keys (the G2: no Undo or Redo); their Shift layers are ⇤ \| ⇥, the start and end of the line | the entry line's history (P13, R16) deserves a key and Redo is new (R15c point 2); every pair reads on one layer, so Redo is one press (S25's K1, owner 2026-11-06, R146); long one-line entries need the jumps (section 3 point 8's removal test), a flick up away |
| Copy \| Paste on one layer of two keys (the G2 too: Shift + View and Shift + Menu); their Shift layers are ⇤□ \| □⇥, the start and end of the box the cursor is in | Menu left the keypad, so Paste needed a new place; Paste is one press, beside Copy (S25's K1, owner 2026-11-06, R146); the box ends reach a numerator's or exponent's edge (R15c point 2) |
| Shift + Help opens Settings (the G2: User, omitted) | Settings one press from the keys, beside Help and outside the maths rows (owner, 2026-11-06, R146); Mode's last row and every ☰ menu still reach it |
| Six user keys U1–U6, all empty, where the G2 has Apps, Symb, Plot, Num, Home and CAS | each key a slot of the user's (tap, Shift, Alpha); Home and CAS are the place name's first two rows (R15c point 5) |
| Shift + Symb, Plot, Num (Setup) omitted | the same settings sit in the Mode sheet and in the Plot and Num menus (Window, Start, Step); nothing is lost |
| Shift + Vars (Chars) omitted | Find covers named symbols (docs/04 5.1) |
| Shift + 1 (Program) omitted | no PPL and no Python (P11); programs are Giac definitions |
| Shift + `,` (Eval) and Shift + `( )` (tick marks) omitted; Shift + `,` is ± on the Home and CAS line, for the units key to read, dimmed in an app (R71) | the owner put ± there (decisions.md "M4-2"): no free key is nearer the digits, and Shift + − is EN6's Base; "evaluate at" comes with the Tmpl palette; quoting is not used for engineering work |
| Shift + 0 (Notes) and the G2's User (Shift + Help, Settings here) omitted | no notes feature; the User keyboard is a parked idea (feedback #17) |
| `(−)` where the G2 prints `+/−` | behaviour is identical: the G2 key inserts a minus sign and does not toggle (keys.yaml r6c2). The label is the honest one |
| Shift + x = y, where the G2 has Define | kept for now (owner, 2026-10-13). Revisit when typing `f(x):=…` shows up as a friction |
| Shift + a b/c (DMS) omitted | DMS is in Tmpl (owner, 2026-10-13) |
| Tmpl's DMS cell takes the number before the cursor as its degrees | as the mixed number takes its whole part: `5`, then the cell, is 5°□′□″, where the typed 5 would otherwise join the degrees with no edge between them (owner, 2026-10-15, R27a) |
| Shift + LOG (10ˣ) after a digit inserts ×10ˣ | `5`, 10ˣ, `2` is 5×10² = 500; the plain template would read 510² (F22; owner, 2026-10-15, R27a). The G2 types `ALOG(2)` and gives 500 too (item 48, 2026-10-19) |
| A space between two numbers is an error, where the G2 multiplies (`2 3` = 6, item 59) | `1 000` read as a product was a silent wrong number (R29, R51); the owner kept the error on 2026-10-19 |
| Tmpl's mixed-number cell takes the number before the cursor as its whole part | on the G2 the typed number stays outside the cell's brackets, so `2`, then the cell, reads as 2 × (□/□) (G2 item 36); ours gives 2 □/□ = 2 + □/□; the G2 reads 2·(□/□) where a mixed number is meant (principle 3, S12) |
| Lower-case and `sin⁻¹`-style legends, ⌫ glyph, text labels for icons | our own look (clean-room rule); the logical position is the G2's |
| Shift + 9: & and Å are refused with a message | Giac reads & as a sum (`1&2` = 3, `3&5` = 8), a silent wrong number for anyone who reads it as AND, so the refusal stays whatever the G2 does (S12; G2 item 41 changes no code); Å is the ångström, a unit, and Home is unit-free (P8); the unit view reads Å from Find (milestone 5) |
| Shift + 9: a fourth row of ours, not the G2's (the G2's grid is 8 × 3, R18): `%` first, the rest empty | R110 (owner, 2026-11-01): it inserts the percent sign; a bare 5 % is 1/20, and after ± it is R104's relative σ. The arrows follow the grid's usual rule: ▼ down the first column from μ reaches %, ▲ from ! wraps to it, ◀ ▶ go in reading order |
| Shift + 9: → makes a function (Giac's ->) | the engine's own reading; Store has its own key, Shift + ᴇ (S12; G2 item 42 changes no code) |
| Shift + 6: XOR is (a or b) and not(a and b) | Giac's xor gives 0 when a side is symbolic, a silent wrong answer |
| In the CAS view Alpha types lower case and Shift + Alpha the capital (Home: the reverse) | the G2's CAS types lower case on Alpha (G2 item 45, owner, 2026-10-18); a lower-case CAS name costs 1 press, not 3. Shift + Alpha not checked on the G2 (R58) |
| Greek letters β, γ, Γ, ε are stored under stand-in names (beta_, gamma_, Gamma_, epsilon_), the letters e and i too (e_, i_) | Giac keeps the plain names (epsilon is a setting, Gamma the function); Giac reads e and i as its constants; the eˣ key and Shift + 2 type those; results show the letter |

## 3. Decided by the owner on 2026-10-13 (P12)
1. **a/b becomes a toggle for the form of the last result**: decimal ↔ fraction, polar ↔ rectangular (real + imaginary), and later forms of the same kind. The fraction template stays on ÷ and in Tmpl. The Fmt key keeps the number formats (Std, Sci, Eng, Fix, Pfx); its cycle has no fraction, mixed or polar entries. Built in R10 (`f296a92`).
2. **No Home or CAS key; the status line is the switch.** The App key (Home/CAS) and the CAS key go; no key shows the current mode. The place name on the status line says where you are, and a tap on it switches (Home ↔ CAS in one tap). Built in R15c1 and R15c2: the name opens Apps and its first two rows are Home and CAS (2 taps); the G2's Home and CAS cells hold user keys, empty by default; Mode is a tap on a chip, Settings the last row of every ☰ menu. It rewrites rule 9's wording "switching lives on the keys, not in bars" (docs/03).
3. **Same for the other view keys, and a cleaner top section.** Symb, Plot and Num are folded into the status line the same way if R15a confirms it (every view stays one action away); the arrow pad moves one line down; the top cluster (menu keys, Esc, Cancel, View, Help) is tidied so it takes fewer rows. Built as R3 (R15c, R15c2) and R146: Symb, Plot and Num are tabs, Menu is ☰, Esc took Cancel's job; the rows 0–2 hold U1–U6, the round pad, and Help | Esc, Undo | Redo, Copy | Paste, with Settings | Clear, ⇤ | ⇥, ⇤□ | □⇥ on Shift (owner, 2026-11-06); results mode is R53's handle and swipe, not a key. Rules 6 and 8 allow this only as the owner's one-off decision for the top cluster, before the layout is learned; the maths keys below do not move, and after R15c the cluster is fixed too.
4. **The exponent key types an E mark instead of the `×10^` template.** The template needs space, hurts the formula's readability and caused the silent wrong exponent of M4-2 (`2.2E-9 × 4.7E3`). The key becomes `ᴇ` (the mark the G2 also draws), is no longer called EEX or ×10ⁿ, and its legend is `ᴇ`. Results keep the E notation of the Sci and Eng formats (`1.5E-9`). Built in R14: the key (id `emark`) inserts `\emark`, drawn ᴇ as one token; on an empty line or after an operator it types 1ᴇ as the G2 does; ÷ and the power keys take the whole number.
5. **Shift + x = y stays** (section 2).
6. **Menus are revamped in the step that adds the next menus** (the Tmpl palette and the form toggle of R10): done as S2's seven rules ([archive/r8-menus.md](archive/r8-menus.md), decisions.md "S2: one menu system"); Mode is on the status chips, R10's Tmpl palette stays as built.
7. **Alpha + 0 (the quote mark) is removed.** Python is gone, strings have no use in Home or CAS, and an unmatched `"` is an error waiting to happen. A key that does nothing in a layer is dimmed (R6). Removal test: it comes back (as a pair) when a feature needs text. Built in R13.
8. **Shift + ◀ and Shift + ▶ (line start and end) were removed** in R13 and came back by their removal test as ⇤ ⇥ (R15c, built in R15c2; since R146 Shift + Undo and Shift + Redo), with the box's start and end on Shift + Copy and Shift + Paste; ◀ ▶ keep no Shift layer.
9. **Info, Notes and User stay omitted** (section 2).
10. **The G2's Shift palettes come back** (owner's answers to R10): Shift + 6 relations and logic, Shift + 9 symbols and Greek with `!`. Package R18.

## 3a. Decided by the owner on 2026-10-17 (R15c)
Built (R15c1–R15c4): the top cluster became R3 (decisions.md "R15c"); its differences are rows of section 2. Text in git at `6550cc93`.

## 4. Open points
- **B. The status-line switch.** Built (R15b, R15c1): the place (the glyph tile and ▾) is a target of at least 48 × 28 px at the left edge (R82f2); since R15c1 it opens Apps, so Home ↔ CAS is 2 taps (name, row), or 1 user key that holds one. Judge on the APK; if 2 taps prove slow, a flick on the name takes the switch (decisions.md R15c).

## 5. About the comparison file this was built from
An outside review produced a YAML list of differences (`gemini-code-1791904688276.yaml`, not kept in the repo). Read it with two caveats:
1. **It lists planned keys as removed or omitted.** Help, Matrix, `[ ]` and Base are planned (section 1); the Math and Tmpl keys, Memory, Units and `{ }` (R54) are built; none was dropped. Two small errors: it says the clone's `(−)` replaced a `+/−` toggle (the G2 key does not toggle), and that Alpha + 0 inserts a single quote mark (it types one double-quote character; now removed).
2. **It misses differences that are already documented:** ☰'s contents (Home/CAS actions: copy, paste, share, clear history, P8), the Paste key (a number from the clipboard, where the G2 lists past entries; docs/04 2.6), and the unit-slot overrides (µ on `(−)`, Ω on the comma, ° on a b/c, flick letters; `unit_slot:` in `spec/keyboard.yaml`).
