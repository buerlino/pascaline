<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Keypad against the G2: every difference and why

Written 2026-10-13 from a key-by-key comparison of the G2 keypad with `spec/keyboard.yaml`, checked against the decision docs, and then reviewed point by point with the owner (decision P12 in [decisions.md](decisions.md)). **One place for this question:** when a key differs from the G2, the reason is here; the layout itself is `spec/keyboard.yaml`, the G2 behaviour is `spec/mapping/vc-2026-10-11/keys.yaml`. The Fmt key (our replacement of the On/Off key) is left out. Rules that decide a difference: [03-feature-analysis.md](03-feature-analysis.md) section 0 (rules 5–9, 11) and CLAUDE.md.

## 1. Planned, not built yet (not a departure)
The legend is missing on the keytop only because the feature is not built; the key is dimmed in that layer.

| Key and layer | Planned as | Where decided |
|---|---|---|
| Help | context help from the Find index (milestone 6); the owner may veto | docs/04 5.1 |
| Math | Find, everything (a G2-style Math menu) | P8, P11 |
| Vars | Find filtered to variables | P8 |
| Tmpl | the template palette (R10) | feedback #3, P11 |
| Shift + Math | Memory (Find on variables and functions, with delete) | docs/04 5.1 |
| Shift + Tmpl | the unit view (milestone 5) | P11, S1 |
| Shift + 4, 5 | matrix editor, `[ ]` (EN5, milestone 6) | docs/04 5.1 |
| Shift + 7 (List) | deferred with Statistics | docs/04 5.1 |
| Shift + − (Base) | Base menu (EN6, milestone 6) | docs/04 5.4 |

## 2. Different on purpose, with a written reason
| Difference | Reason |
|---|---|
| Cancel key under Esc | Fmt took the On slot, which is where the G2 interrupts a job; every engine call must be cancellable (CLAUDE.md maths rules). P4 item 6. Shift + Cancel is Undo for the entry line (P13, R16) |
| Shift + Apps = Mode sheet, in place of the G2's Info; Settings is Mode's last row | the G2's Info page is blank, no feature behind it (rule 4); S2 point 4 gives Mode a keys-only path there (R15b). The G2's Home and CAS cells hold the free keys U2 and U3 (section 3 point 2), whose Shift layers ship empty |
| Shift + Symb, Plot, Num (Setup) omitted | the same settings sit in the Mode sheet and in the Plot and Num menus (Window, Start, Step); nothing is lost |
| Shift + Vars (Chars) omitted | Find covers named symbols (docs/04 5.1) |
| Shift + 1 (Program) omitted | no PPL and no Python (P11); programs are Giac definitions |
| Shift + `,` (Eval) and Shift + `( )` (tick marks) omitted | "evaluate at" comes with the Tmpl palette; quoting is not used for engineering work |
| Shift + 0 (Notes) and Shift + Help (User) omitted | no notes feature; the User keyboard is a parked idea (feedback #17) |
| `(−)` where the G2 prints `+/−` | behaviour is identical: the G2 key inserts a minus sign and does not toggle (keys.yaml r6c2). The label is the honest one |
| Shift + x = y, where the G2 has Define | kept for now (owner, 2026-10-13). Revisit when typing `f(x):=…` shows up as a friction |
| Shift + a b/c (DMS) omitted | DMS is in Tmpl (owner, 2026-10-13) |
| Tmpl's DMS cell takes the number before the cursor as its degrees | as the mixed number takes its whole part: `5`, then the cell, is 5°□′□″, where the typed 5 would otherwise join the degrees with no edge between them (owner, 2026-10-15, R27a) |
| Shift + LOG (10ˣ) after a digit inserts ×10ˣ | `5`, 10ˣ, `2` is 5×10² = 500; the plain template would read 510² (F22; owner, 2026-10-15, R27a). Ours until G2 item 48 says otherwise |
| Tmpl's mixed-number cell takes the number before the cursor as its whole part | on the G2 the typed number stays outside the cell's brackets, so `2`, then the cell, reads as 2 × (□/□) (G2 item 36); ours gives 2 □/□ = 2 + □/□ |
| Lower-case and `sin⁻¹`-style legends, ⌫ glyph, text labels for icons | our own look (clean-room rule); the logical position is the G2's |
| Shift + 9: & and Å are refused with a message | what & does on the G2 is not known (G2 item 41); Å is the ångström, a unit, and Home is unit-free (P8); the unit view reads Å from Find (milestone 5) |
| Shift + 9: → makes a function (Giac's ->) | assumed; the G2's use of → is to check (G2 item 42) |
| Shift + 6: XOR is (a or b) and not(a and b) | Giac's xor gives 0 when a side is symbolic, a silent wrong answer |
| In the CAS view Alpha types lower case and Shift + Alpha the capital (Home: the reverse) | the G2's CAS types lower case on Alpha (G2 item 45, owner, 2026-10-18); a lower-case CAS name costs 1 press, not 3. Shift + Alpha not checked on the G2 (R58) |
| Greek letters β, γ, Γ, ε are stored under stand-in names (beta_, gamma_, Gamma_, epsilon_) | Giac keeps the plain names (epsilon is a setting, Gamma the function); results show the letter |

## 3. Decided by the owner on 2026-10-13 (P12)
1. **a/b becomes a toggle for the form of the last result**: decimal ↔ fraction, polar ↔ rectangular (real + imaginary), and later forms of the same kind. The fraction template stays on ÷ and in Tmpl. The Fmt key keeps the number formats (Std, Sci, Eng, Fix, Pfx); its cycle has no fraction, mixed or polar entries. Built in R10 (`f296a92`).
2. **No Home or CAS key; the status line is the switch.** The App key (Home/CAS) and the CAS key go; no key shows the current mode. The place name on the status line says where you are, and a tap on it switches (Home ↔ CAS in one tap). (R15 layout D, 2026-10-14: the two cells stay, as the free keys U2 and U3 with Home and CAS as their defaults, since D gets its space from shorter rows and dropping them saved nothing.) The Mode sheet is a tap on a status chip (as built), and Settings is the last item of the Mode sheet. Built in R15b (layout D): no key moved, U2 and U3 hold Home and CAS. It rewrites rule 9's wording "switching lives on the keys, not in bars" (docs/03).
3. **Same for the other view keys, and a cleaner top section.** Symb, Plot and Num are folded into the status line the same way if R15a confirms it (every view stays one action away); the arrow pad moves one line down; the top cluster (menu keys, Esc, Cancel, View, Help) is tidied so it takes fewer rows. R15a drew the options; the owner chose layout D, built in R15b: no key moved, no row folded, the pad stays. Rules 6 and 8 allow this only as the owner's one-off decision for the top cluster, before the layout is learned; the maths keys below do not move.
4. **The exponent key types an E mark instead of the `×10^` template.** The template needs space, hurts the formula's readability and caused the silent wrong exponent of M4-2 (`2.2E-9 × 4.7E3`). The key becomes `ᴇ` (the mark the G2 also draws), is no longer called EEX or ×10ⁿ, and its legend is `ᴇ`. Results keep the E notation of the Sci and Eng formats (`1.5E-9`). Built in R14: the key (id `emark`) inserts `\emark`, drawn ᴇ as one token; on an empty line it types 1ᴇ as the G2 does; ÷ and the power keys take the whole number.
5. **Shift + x = y stays** (section 2).
6. **Menus are revamped in the step that adds the next menus** (the Tmpl palette and the form toggle of R10): see open point A.
7. **Alpha + 0 (the quote mark) is removed.** Python is gone, strings have no use in Home or CAS, and an unmatched `"` is an error waiting to happen. A key that does nothing in a layer is dimmed (R6). Removal test: it comes back (as a pair) when a feature needs text. Built in R13.
8. **Shift + ◀ and Shift + ▶ (line start and end) are removed.** The arrow pad is a 2D cursor and a tap on the formula puts the cursor anywhere (G2 flow). Removal test: it comes back if long one-line entries scroll out of reach and the owner misses the jump. Built in R13.
9. **Info, Notes and User stay omitted** (section 2).
10. **The G2's Shift palettes come back** (owner's answers to R10): Shift + 6 relations and logic, Shift + 9 symbols and Greek with `!`. Package R18.

## 3a. Decided by the owner on 2026-10-17 (R15c; being built in R15c1–R15c4)
The top cluster becomes R3 (decisions.md "R15c"), and this file is rewritten row by row as the packages land (R15c2 does the key rows). In short:
- **The arrows keep the G2's round pad.** Its centre is the drag hub, with no OK key.
- **Apps, Mode, Symb, Plot, Num, Menu, Cancel and the Help key leave the keypad.**
  - Apps is the place name on the status line; Menu is ☰ there; Symb, Plot and Num are tabs in an app; Mode is on the chips.
  - Esc takes Cancel's job.
  - Copy, Paste and Undo get keys of their own.
  - Help moves to Shift + View; View (the keypad toggle) keeps a key, in R3's wing.
- **New keys:** Redo, and ⇤ ⇥ with the box ends on Shift. This reverses section 3 point 8 by its removal test.
- **The user keys:** U1–U6, each with tap, Shift and Alpha.

## 4. Open points
- **A. Menu audit. Done** (S2, [research/r8-menus.md](research/r8-menus.md)); its seven rules were accepted by the owner on 2026-10-13 (decisions.md "S2: one menu system"). Key-level results: Mode is on Shift + Apps (R15b); R10's Tmpl palette stays as built.
- **B. The status-line switch. Built** (R15b): a 96 × 28 px target from the left edge (the strip below the line belongs to the history and to F1's slot); Home ↔ CAS is 1 tap, or 1 key (U2, U3), or 2 keys (Apps, 1 or 2), against the G2's one key. Judge on the APK; if the owner finds the bar slow, a layer of an existing key (a flick on Apps) takes the switch, with no new key.
- **C. `!` (factorial). Settled** (owner, 2026-10-13): it goes in the Shift + 9 palette, as on the G2 (R18).

## 5. About the comparison file this was built from
An outside review produced a YAML list of differences (`gemini-code-1791904688276.yaml`, not kept in the repo). Read it with two caveats:
1. **It lists planned keys as removed or omitted.** Help, the Math and Tmpl keys and the shifted Memory, Units, Matrix, `[ ]` and Base layers are planned (section 1, `{ }` is built: R54), not dropped. Two small errors: it says the clone's `(−)` replaced a `+/−` toggle (the G2 key does not toggle), and that Alpha + 0 inserts a single quote mark (it types one double-quote character; now removed).
2. **It misses differences that are already documented:** the Menu key's contents (Home/CAS actions: copy, paste, share, clear history, P8), Shift + Menu = Paste (a number from the clipboard, where the G2 lists past entries; docs/04 2.6), and the unit-slot overrides (µ on `(−)`, Ω on the comma, ° on a b/c, flick letters; `unit_slot:` in `spec/keyboard.yaml`).
