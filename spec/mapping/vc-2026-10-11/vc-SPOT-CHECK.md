<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Spot check: emulator vs the real G2

Twelve cases to try on the real G2 (firmware 2.4 rev 15515). All expected displays were read on the emulator, software 2.4.2 rev 15751, in default settings (radians, Standard number format, Textbook entry, digit grouping 123,456.789). If a case differs on the G2, tell us which: it shows the emulator is not a safe reference for that area.

How to read the key presses: **Home** and **CAS** are the keys with those names (upper cluster); **Enter** is the wide key; type letters and digits with the keypad (functions such as exp( or sqrt( can be typed with the Alpha letters or taken from the Toolbox Math menu, or pasted if you have a text path). `ᴇ` is the calculator's own small-capital E exponent mark; a leading `−` is the raised minus. Clear the history first (Shift, then Esc) so the result row is easy to find.

## Ten cases picked at random

| # | Section | Key presses | Expected display |
|---|---------|-------------|------------------|
| 1 | A (G2 item 8) | Home, then type `0.1234567890125`, Enter | `0.123456789012` (the tie is not rounded up) |
| 2 | A (G2 item 9) | Home, then type `sqrt(-4)`, Enter | an error message in the result position (invalid input), no `2i` |
| 3 | A (G2 item 17) | CAS, then 1 ÷ 3 → + 1 ÷ 6 → Enter (→ is the right arrow, to leave the fraction) | stacked fraction 1/2 |
| 4 | C home.yaml `fn-exp-10` | Home, then type `exp(-10)`, Enter | `4.53999297625ᴇ−5` |
| 5 | C home.yaml `fn-exp100` | Home, then type `exp(100)`, Enter | `2.68811714182ᴇ43` |
| 6 | C home.yaml `big-1e99*1e99` | Home, then type `1e99*1e99` (the ᴇ key gives the exponent), Enter | `1ᴇ198` |
| 7 | C home.yaml `big-1e-300/1e300` | Home, then type `1e-300/1e300`, Enter | `0` (underflows to exactly 0) |
| 8 | D cas.yaml `arith-fact` | CAS, then type `50!`, Enter | `30414093201713378043612608166064768844377641568960512000000000000` (65 digits, one line) |
| 9 | D cas.yaml `arith-pow` | CAS, then type `2^100`, Enter | `1267650600228229401496703205376` |
| 10 | D cas.yaml `solve-cubic` | CAS, then type `solve(x^3-6*x^2+11*x-6=0,x)`, Enter | list `{1,2,3}` |

## Two of the most surprising results

| # | Key presses | Expected display | Why surprising |
|---|-------------|------------------|----------------|
| 11 | Home, type `1-0.9-0.1`, Enter. Then CAS, type the same, Enter. | Home: `0`. CAS: `1.7763568394ᴇ−15` (shown with the calculator's exponent mark; the clipboard copy of it had a plain lowercase e). | The two views disagree on the same input (Home rounds away the float noise, CAS shows it). Same expression in Home also: `log10(2)` stays unevaluated as the stacked fraction `LN(2)/LN(10)` instead of a decimal. |
| 12 | Apps, open the Solve app, Symb view: put `exp(x)=0` in E1 (Enter). Num view: type `0` in the X field, Enter, then Solve (soft key). | X becomes `−1,149.15867377`; the message line (Info soft key) says `Zero`. | A solution is reported for an equation that has none. (Likewise `1/x=0` from guess 1 gives `1.45989166621ᴇ499` with message Zero, and `x^2+1=0` from guess 0 gives `0` with the message `Error: Extremum found`.) |

Put the G2 back to its default view when done (Home view, Function app, settings unchanged).
