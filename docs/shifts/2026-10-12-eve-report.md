<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Shift report: 2026-10-12 evening

Short shift in economy mode (one agent per task), stopped early for the usage limit at the user's request.

## What got done
- **L9:** ÷ and a/b right after a fraction, root, power or mixed number now divide the whole term (`1 a/b 2 ▶ ÷ 3` = 0.166666666667). Merged (`d4a44ad`).
- **K1 trackpad:** dragging on the arrow keys moves the cursor in 2D, one haptic tick per step; a tap is one step. Merged (`e900263`).
- **xx follow-up:** no change. Giac already autosimplifies with `regroup`, but that doesn't merge `x*x`; only an explicit `regroup()` does, so the extra call stays.
- **P7 revised (user):** the whole keypad becomes the 2D cursor after a short hold; flicks and lock flicks are dropped; Shift and Alpha stay; arrow keys stay for now and should be removed later.

## Definition of done
- L9 and K1: typecheck 0, vitest pass, e2e pass. Henri re-ran all three on each branch, and again on `phase-1` after both merges (e340123: typecheck 0, vitest 321/321, e2e 73 passed, 1 skipped). L9's golden gate passed (ron).
- Gestures: K1 has its Playwright test, and the start chunk size was reported. K2/K3 as planned were dropped by the P7 revision.
- Task 4 (Fairphone): **not done.** annabell was cut off by the usage limit after removing the INTERNET permission. The FP6 was restored by Henri (`mStayOn=false`, `stay_on_while_plugged_in=0`).

## Numbers
- Start chunk: 139.1 → 141.0 kB (48.3 → 49.1 kB gzip) with K1. No device numbers this shift.

## Unmerged branches
- `p1/annabell-eve-fp6@8a0958a`: C5 (no INTERNET permission). Needs the device check before merging.
- `p1/ron-eve-gestures@96fcf50`: the K2 flick classifier, which isn't used now that P7 has changed. Keep it for reference or delete it with `git branch -D` (that's the user's call; Henri uses only `-d`).

## Next steps
1. K2 (new): hold-and-drag cursor on the whole keypad (about 40 lines plus a test).
2. Device session (FP6 or Tab One): C5 check, K0 check, K1 feel and `touch-action` side effects, first FP6 numbers, Tab One L7 cold-start re-measure.
3. K4 compact keypad.
