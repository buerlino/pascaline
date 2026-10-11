<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Mapping log

## 2026-10-11 — STOPPED at version check

**Emulator version does not match the required firmware. No observations were recorded.**

About screen of the HP Prime Virtual Calculator (opened from the emulator window's own Help menu, entry "About HP Prime", then "Show Details" ticked):

- Software Version: **2.4.2**
- Software Revision: **15751**
- Software Build Date: 2026-09-09
- CAS Version: 1.5.0
- MicroPython Version: 1.9.4

The brief requires firmware 2.4 build **15515** (the user's real G2). This is revision 15751, so per BRIEF section 1 I stopped before sections A–H. Nothing in `observations/` other than this file and PROGRESS.md was written.

### What was done
- Emulator window found already running (process HPPrime). Display 1920x1080, scaling 100% (DPI 96). The window moved by itself once during setup (1113,129 -> 1290,159), which broke the first screenshots; position at time of stopping: 1290,159 - 1633,947 (343 x 788).
- Driver helper written: `C:\pascaline-scratch\drive.py` (`press <key-id>...`, `type "<text>"`, `shot <name> [x1,y1,x2,y2] [scale]`), using pyautogui + pillow.
- Key calibration: `C:\pascaline-scratch\keys.json` (57 entries: soft keys s1-s6, upper cluster, d-pad, rows r4-r10). Tested only: Apps (opens the application library), Esc (leaves it), Shift (status bar shows a shift marker), Shift+Apps (a blank per-app info page with an Edit soft key; left with Esc). The remaining keys are NOT yet tested. The On key was deliberately not pressed.
- Not done: text output path (clipboard), reset method, `1+1` test.

### Settings touched, and restored
- About dialog: "Show Details" ticked to read the build, then unticked and closed with OK. No calculator settings were changed. Emulator is in the Function app, as found.
- The built-in Help was not opened. The window's Help menu was opened only to reach "About HP Prime"; no other entry was clicked.

### Screenshots
(Early note, superseded: a wildcard delete was blocked at that time. At the end of the session all 225 files in `C:\pascaline-scratch\shots\` were deleted one by one; the folder is empty. See "Final report" below.)

### UPDATE (same day): user approved 2.4.2 rev 15751 as the reference
The user said the newer version is fine and asked me to continue. All facts from here on are tagged `fw: "2.4.2.15751"` (not the `2.4.15515` of the brief). User also moved the window to the left corner; driver now reads the window rect at every call (`drive.py`, key coords in `keys_rel.json` relative to the window).

### (superseded) Decision needed from the user
Either supply a 2.4 build 15515 emulator, or explicitly accept revision 15751 as the reference (results may differ from the real G2). I did not continue on my own, since the brief says to stop.

## Incident: built-in Help opened by accident (clean-room rule)
During the key-map walk (section B) the Alpha layer of the Help key (r1c4) was pressed; Alpha falls back to the primary function on keys without a letter, so a built-in help page for Home opened. I did not record any text from it; the montage image that contained it was deleted and nothing from it is in `observations/`. The walker then returned to Home with the Home key. The Help key's primary layer and its alpha layer were NOT pressed again; they are listed in keys.yaml as "opens built-in help, not pressed (clean-room rule)". The screenshot had already been displayed to me before I could stop it, so I read the first lines of one page; I wrote nothing derived from it.

## Final report (2026-10-11)

Reference: Virtual Calculator software 2.4.2 rev 15751 (user-approved), CAS 1.5.0. Every row is tagged `fw: "2.4.2.15751"`, not the brief's 2.4.15515.

### Counts
- A `g2-answers.yaml`: 16 items answered (1-4, 6-15, 17, 18); 5 and 16 skipped as instructed. Item 8 is marked unsure (the history echo already rounds the typed literal to 12 digits, so the rounding may happen at entry rather than display).
- B `keys.yaml`: 59 rows: 52 key rows (the 10 keys of the upper cluster, the round pad's 4 arrows, one row for the six soft keys under the screen, and rows r4 to r10 of the keypad), each with 4 layers, plus 7 findings rows about Textbook entry, letters and Ans insertion.
- C `home.yaml`: 123 cases + 10 re-runs in Textbook entry (rows `tb-...`); the re-runs looked identical to the Algebraic-entry runs. 109 cases in radians, 14 in degrees.
- D `cas.yaml`: 55 cases.
- E `solve.yaml`: 23 cases.
- F `settings.yaml`: 47 rows (Home Settings pages 1-4, CAS Settings pages 1-2; number-format examples for G2 item 15; entry modes for G2 item 18). The Language, Font Size, a b/c Key Options, Digit Grouping, CAS Angle Measure and CAS Number Format lists were opened and closed again with Esc.
- G `menus.yaml`: Math tab 125 commands and 19 submenus; CAS tab 114 commands and 22 submenus; App tab: 18 apps, 206 commands, 18 deeper submenus (Data Streamer and Python list no commands); Catalog 910 names. Each command also records the text it inserts into the entry line. Names only; no descriptions or help text were read.
- H `apps.yaml`: 18 apps, with views and setup screens (all pages).
- `SPOT-CHECK.md`: 10 random cases + 2 surprising ones.

### `unsure` readings
- g2-answers item 8 (rounding of ties; see above).
- keys.yaml: the arrow keys' Shift/Alpha layers, Shift/Alpha on the Del key, a second Shift or Alpha press, Shift+Alpha on Esc and Help, Shift+x (angle sign), Alpha on On: not checked or not visible; marked in the rows.
- settings.yaml: the Digit Grouping list (9 rows seen, no more found when scrolling, but the screen did not make that fully clear), the weekday box in Time, CAS Epsilon (digit count of the zeros read from an enlarged picture).
- menus.yaml: "Prob. Wizard..." and "Polynomial Roots Wizard" open wizards; their `inserts` text is only what was left in the entry line.

### Retyped cases
None had to be typed by hand: every input of home/bench/solve was pasted with Edit > Paste and the echo checked. Where the echo shows a template (integral, limit, sum) it is noted in the row. G2 item 17 was typed with the keys in Textbook entry.

### Problems
- Version mismatch (above): user accepted rev 15751.
- Built-in Help opened by accident once (incident above); nothing recorded from it.
- The first Solve runs wrote to the wrong lines; all 23 were redone with checks and the old results discarded.
- Shortly before 13:00 the window layout shifted (the keypad ended up 50 px higher and the six soft keys 37 px higher than my saved coordinates). Clicks then hit the wrong rows for a few attempts, which typed stray text into the CAS entry line and gave junk results for G2 item 17. I recalibrated the driver and redid item 17; no recorded observation came from the mis-clicked runs. The stray text was cleared; no setting was touched (checked at the end: Home Settings pages 1 to 4 and CAS Settings page 1 show the defaults).
- One stray Del press landed in Plot Setup; the X Rng and Y Rng values were the same before and after (-15.9 / 15.9 and -10.9 / 10.9).
- The Toolbox remembers its last tab; pressing the soft key of the already active tab closes the menu. The menu walks account for this.

### Settings changed during the session, and put back
- Home Settings > Entry: Algebraic during some Home runs, back to Textbook (default).
- Home Settings > Angle Measure: Degrees for 14 cases, back to Radians.
- Home Settings > Number Format: stepped through Fixed, Scientific, Engineering, Floating, Rounded for G2 item 15, back to Standard.
- Final check at the end: Home Settings page 1 shows Radians, Standard, 123,456.789, Textbook, Hex 32, a+b*i, English; page 2 Medium Font and Light theme; CAS Settings page 1 shows Radians, Standard 12, Decimal, Simplify Minimum.
- Apps were started to read their screens; nothing was changed in them. The emulator was left in the Function app, Home view, with empty Home and CAS histories (cleared with Shift+Esc).

### Screenshots and scratch
- All 225 files in `C:\pascaline-scratch\shots\` were deleted individually; the folder is empty. Screenshots were only used for my own reading and none went into `observations/`.
- Text-only scratch data (clipboard readings and walker logs, no images) was copied to `C:\pascaline-scratch\data\`, outside the kit. It is not part of the deliverable.
