<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Checks on the reference calculator (HP Prime G2)

For the user to do by hand. The G2 is used as a black box only: type the input, write down exactly what the screen shows, in your own words or as plain text. It is never connected to the laptop, and no screenshots or manual text go into the repo (clean-room rules in CLAUDE.md).

Firmware: write it down once (Help → About, or the boot screen) — expected 2.4 rev 15515.

| # | View / settings | Input | What the G2 shows (fill in) | Why we ask | Asked by |
|---|---|---|---|---|---|
| 1 | CAS, default settings | `eigenvals([[2.,1.,0.],[1.,3.,1.],[0.,1.,4.]])` (decimal entries) | | Order of numeric eigenvalues (GSL sorts ascending, Giac without GSL does not) | spike Q5 |
| 2 | CAS, default settings | `factor(x^20-1)` | | Does it factor over √5 like our build does? | spike Q1 |
