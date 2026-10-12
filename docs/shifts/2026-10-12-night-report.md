<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Shift report: 2026-10-12 night (K2 and the Fairphone 6)

## Done
- **K2 hold-and-drag cursor** on the whole keypad (`54386b9`, merged). typecheck 0, vitest 328/328, e2e 74 passed + 1 skipped (re-run on the branch). Start chunk 141.1 → 142.6 kB (49.1 → 49.6 kB gzip). ⌫ auto-repeat added (400 ms, then 60 ms).
- **C5** (no INTERNET permission) checked on the Fairphone 6 and merged: Home, Function, Solve and the Python shell run; CAS not tapped separately.
- **K0** checked on the Fairphone 6: the system keyboard never opened (~76 taps, every Python/Function/Solve switch).
- **K1** mechanics checked (a swipe moves the cursor, the page does not scroll); feel is the user's.

## First Fairphone 6 numbers
Android 16, WebView 148.0.7778.178, `--measure` build, dev engine, 35–36 °C. Keyboard usable 329 ms and engine ready 609 ms (medians of 7; Tab One 662 / 995). Plot 89.3 fps (bar 60; Tab One 56). Home Enter → result p95 23.4 ms warm, 53.2 ms first run (Tab One 92). Raw files are in `.coord/` (not in git).

## Needs the user
1. Try K2 on the phone (list in backlog "Needs the user" 3), which needs a new APK built from `phase-1`.
2. Try lowercase `print(1)` in the Python shell (Alpha-lock gave only uppercase).

## Not done
Tab One L7 cold-start re-measure (Tab One not connected); K4 compact keypad; CAS tap-through on the Fairphone. The unmerged `p1/ron-eve-gestures` (old flick classifier) is still there for you to delete or keep.
