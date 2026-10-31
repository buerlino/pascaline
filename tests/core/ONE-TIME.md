<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# One-time checks on the phone

Each is done once, by the owner, or by annabell when a package names it; the daily list is [MORNING.md](MORNING.md). Tell the day session what you saw: a check done leaves this list, a failure becomes a backlog bug line. Moved here from backlog.md on 2026-10-31 (owner; the docs budget).

- Flick misfires (R9: 20 px arm, 12 px cancel); whether the first tap after a cold start vibrates (R35); R7's sheet defaults; the 36 px cluster rows and the 28 px status line (R15b).
- A11: Share session, Paste of `1.5e-3`; a chip tapped right after a flick (R15c2); the ~8 px strip right of an inner fraction (R42); "Working…" on the WebView and a taller CAS result growing its row (F8); the trackpad's `touch-action: none` (K1).
- The memory cap on the Tab One: `makemat(1,30000,30000)` in CAS gives "Out of memory" and the app stays up (G24).
- R85 (merged `1d35189`): on the Fairphone, Shift, Fmt opens Mode on Angle; ▶, Enter gives DEG (the owner).
- R86 (merged `cf087b9`): on the Fairphone, the pill then SCI sets it and closes; the digits chip then 20; ◀ goes up to Mode (the owner).
- R50e (merged `e4d6085`): each theme family on the phone for a while; a cold start with a non-default theme shows no flash; a first start after "clear data" is Dark from the first frame (the owner).
- R81 (F99, merged `a956ede`): the system keyboard stays closed after a return to the app, on the Fairphone (`tools/probes/ime-return.py`, annabell).
- Removal tests to read: the "stored in Home" line under CAS results (R32), the angle check (R37), library imports (S4), Undo (P13).
- A46 (`ee7e509`): the system keyboard stays closed after a return to the app, on the Fairphone and the Tab One (`tools/probes/ime-return.py`, annabell; night review lo-9).
- R91 (`e80eda0`): the Fairphone's start time before and after the split (annabell; lo-8).
- R49 (`d60fbfb`): on the Fairphone, the pill, 5, 1 shows Numbers and the pad moves its highlight (the owner; vr-9).
- R87 (`56d017f`): on the Fairphone, Settings › Help and about › Parts we use (the owner); its two `./build.sh --unsigned` runs give the same APK hash (annabell; vr-9).
