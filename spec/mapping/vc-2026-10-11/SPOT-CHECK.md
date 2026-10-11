<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Spot check: 12 cases worth confirming on a real G2

Firmware **2.4 rev 15515** (the reference used for this mapping run was the Virtual Calculator,
software 2.4.2 rev 15751 — see `README.md`). These are the findings most worth re-checking on
the actual device: `unsure` readings, keyboard positions that drive `spec/keyboard.yaml`, and
behaviour that one or more golden cases depend on. Default settings (Radians, Standard, Textbook
entry, a+b*i) unless noted.

1. **Alpha case convention.** Press Alpha then a letter key (e.g. the SIN key). Is it shown as
   an uppercase letter? Then press Shift, then Alpha, then the same key — lowercase? This run
   found Alpha = uppercase, Shift+Alpha = lowercase, which is the *opposite* of what
   `spec/keyboard.yaml`'s header currently documents for our own layout.
2. **The "a b/c" key.** Compute `1.75` in Home (or recall a decimal result), then press the key
   labelled "a b/c" (just right of the Define key, upper-right of the Vars row). Does the
   *displayed result* cycle through decimal → fraction → mixed number, with nothing typed on an
   empty entry line? (This run found exactly that, and that the key does **not** insert a
   fraction template while typing — unlike our current `frac`/"a/b" key.)
3. **Cancel during a running computation.** Start something slow (e.g. a large symbolic
   `factor` in CAS, or a long numeric sum) and press the On key while it's running. Does it stop
   the computation? This run never tested a key during an active calculation.
4. **`sqrt(-4)` in Home, default (real, a+b*i) mode.** Error, or `2*i`? This run got an error
   ("Error: Invalid input").
5. **`asin(2)` in Home, default mode.** Error, or a complex result? This run got an error.
6. **`(-8)^(1/3)` in Home, default mode.** `-2`, or the complex principal root
   `1+1.73205080757i`? This run got `-2`.
7. **`Solve x^2+1=0`, guess `0`.** What does the Info soft key say after Solve? This run saw
   "Error: Extremum found" with the field left at `0`, not a "no root" message.
8. **`Solve 1/x=0`, guess `1`.** What does Solve return and what does Info say? This run got a
   huge finite value (`1.45989166621E499`) with message "Zero" — no mention of a pole.
9. **Rounding tie at 12 digits.** Type `123456789012.5` and press Enter. Does it show
   `...789012` (round to even) or `...789013` (round away from zero)? This run's reading is
   flagged `unsure` — the paste-based entry may already round the literal before display.
10. **Shift of the × key** (upper-right area of the digit block, r8c5). What does it insert? This
    run could not read it clearly in a zoomed capture ("∡", an angle sign, suspected but unsure).
11. **Up/Down on an empty Home entry line.** Does it browse the result history (select the last
    or top history row)? This run found Up does on the reference; our keyboard currently has no
    such behaviour (`spec/keyboard.yaml` id `up`).
12. **Home Settings → Digit Grouping list.** Scroll the full list. Does it go past the 9 entries
    this run saw, and is there really a raised-dot-style separator option? This run could not
    confirm whether the list was fully scrolled.
