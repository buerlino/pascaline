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
| Shift + 4, 5, 8 | matrix editor, `[ ]`, `{ }` (EN5, milestone 6) | docs/04 5.1 |
| Shift + 7 (List) | deferred with Statistics | docs/04 5.1 |
| Shift + − (Base) | Base menu (EN6, milestone 6) | docs/04 5.4 |
| Shift + 6 | relations and logic palette, 4 × 3 (R18) | owner, 2026-10-13 |
| Shift + 9 | symbol and Greek palette, 8 × 3, with `!` and ∞ (R18); replaces ∞ on the key | owner, 2026-10-13 |

## 2. Different on purpose, with a written reason
| Difference | Reason |
|---|---|
| Cancel key under Esc | Fmt took the On slot, which is where the G2 interrupts a job; every engine call must be cancellable (CLAUDE.md maths rules). P4 item 6 |
| Shift + CAS = Mode sheet, Shift + Home = Settings | the G2 keeps its settings on those cells; docs/05 3.4. **Replaced by P12** (section 3 point 2: the keys go, the status line takes over) |
| Shift + Symb, Plot, Num (Setup) omitted | the same settings sit in the Mode sheet and in the Plot and Num menus (Window, Start, Step); nothing is lost |
| Shift + Vars (Chars) omitted | Find covers named symbols (docs/04 5.1) |
| Shift + 1 (Program) omitted | no PPL and no Python (P11); programs are Giac definitions |
| Shift + `,` (Eval) and Shift + `( )` (tick marks) omitted | "evaluate at" comes with the Tmpl palette; quoting is not used for engineering work |
| Shift + Apps (Info) omitted | the G2's Info page is blank; no feature behind it (rule 4) |
| Shift + 0 (Notes) and Shift + Help (User) omitted | no notes feature; the User keyboard is a parked idea (feedback #17) |
| `(−)` where the G2 prints `+/−` | behaviour is identical: the G2 key inserts a minus sign and does not toggle (keys.yaml r6c2). The label is the honest one |
| Shift + x = y, where the G2 has Define | kept for now (owner, 2026-10-13). Revisit when typing `f(x):=…` shows up as a friction |
| Shift + a b/c (DMS) omitted | DMS is in Tmpl (owner, 2026-10-13) |
| Lower-case and `sin⁻¹`-style legends, ⌫ glyph, text labels for icons | our own look (clean-room rule); the logical position is the G2's |

## 3. Decided by the owner on 2026-10-13 (P12)
1. **a/b becomes a toggle for the form of the last result**: decimal ↔ fraction, polar ↔ rectangular (real + imaginary), and later forms of the same kind. The fraction template stays on ÷ and in Tmpl. The Fmt key keeps the number formats (Std, Sci, Eng, Fix, Pfx); its cycle has no fraction, mixed or polar entries. Built in R10 (`f296a92`).
2. **No Home or CAS key; the status line is the switch.** The App key (Home/CAS) and the CAS key go; no key shows the current mode. The place name on the status line says where you are, and a tap on it switches (Home ↔ CAS in one tap). This saves two keys. The Mode sheet is a tap on a status chip (as built), and Settings is the last item of the Mode sheet. Package R15. It rewrites rule 9's wording "switching lives on the keys, not in bars" (docs/03).
3. **Same for the other view keys, and a cleaner top section.** Symb, Plot and Num are folded into the status line the same way if R15a confirms it (every view stays one action away); the arrow pad moves one line down; the top cluster (menu keys, Esc, Cancel, View, Help) is tidied so it takes fewer rows. R15a draws the options, R15b builds the approved one. Rules 6 and 8 allow this only as the owner's one-off decision for the top cluster, before the layout is learned; the maths keys below do not move.
4. **The exponent key types an E mark instead of the `×10^` template.** The template needs space, hurts the formula's readability and caused the silent wrong exponent of M4-2 (`2.2E-9 × 4.7E3`). The key becomes `ᴇ` (the mark the G2 also draws), is no longer called EEX or ×10ⁿ, and its legend is `ᴇ`. Results keep the E notation of the Sci and Eng formats (`1.5E-9`). Package R14.
5. **Shift + x = y stays** (section 2).
6. **Menus are revamped in the step that adds the next menus** (the Tmpl palette and the form toggle of R10): see open point A.
7. **Alpha + 0 (the quote mark) is removed.** Python is gone, strings have no use in Home or CAS, and an unmatched `"` is an error waiting to happen. A key that does nothing in a layer is dimmed (R6). Removal test: it comes back (as a pair) when a feature needs text. Package R13.
8. **Shift + ◀ and Shift + ▶ (line start and end) are removed.** The arrow pad is a 2D cursor and a tap on the formula puts the cursor anywhere (G2 flow). Removal test: it comes back if long one-line entries scroll out of reach and the owner misses the jump. Package R13.
9. **Info, Notes and User stay omitted** (section 2).
10. **The G2's Shift palettes come back** (owner's answers to R10): Shift + 6 relations and logic, Shift + 9 symbols and Greek with `!`. Package R18.

## 4. Open points
- **A. Menu audit. Done** (S2, [research/r8-menus.md](research/r8-menus.md)); its seven rules were accepted by the owner on 2026-10-13 (decisions.md "S2: one menu system"). Key-level results: Mode moves to Shift + Apps when R15 removes Shift + CAS; R10's Tmpl palette stays as built.
- **B. The status-line switch.** A 28 px line is below a comfortable touch target and sits far from the thumb. R15a must give the place name a larger hit area than its drawn height, state the press count for Home ↔ CAS against the G2's one key, and keep the fallback: if the owner finds the bar slow after a week, a layer of an existing key (candidate: a flick on Apps) takes the switch, with no new key.
- **C. `!` (factorial). Settled** (owner, 2026-10-13): it goes in the Shift + 9 palette, as on the G2 (R18).

## 5. About the comparison file this was built from
An outside review produced a YAML list of differences (`gemini-code-1791904688276.yaml`, not kept in the repo). Read it with two caveats:
1. **It lists planned keys as removed or omitted.** Help, the Math and Tmpl keys and the shifted Memory, Units, Matrix, `[ ]`, `{ }` and Base layers are planned (section 1), not dropped. Two small errors: it says the clone's `(−)` replaced a `+/−` toggle (the G2 key does not toggle), and that Alpha + 0 inserts a single quote mark (it types one double-quote character; now removed).
2. **It misses differences that are already documented:** the Menu key's contents (Home/CAS actions: copy, paste, share, clear history, P8), Shift + Menu = Paste (a number from the clipboard, where the G2 lists past entries; docs/04 2.6), and the unit-slot overrides (µ on `(−)`, Ω on the comma, ° on a b/c, flick letters; `unit_slot:` in `spec/keyboard.yaml`).
