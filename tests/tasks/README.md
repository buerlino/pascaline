<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Task benchmark (EN0)

How "efficient" is tested: **key presses per task**, not latency. `tasks.yaml` holds the ten tasks the owner accepted on 2026-10-12 (docs/03 section 6). `app/test/tasks.spec.ts` replays them in Playwright on the real engine (`npm run test:tasks`, also part of `npm run test:e2e`) and prints one table: baseline, target and budget presses per task.

## Counting rule (docs/04 section 5.2)
Every press counts 1: Shift and Alpha, Enter, a letter typed in Find. A held ⌫ that auto-repeats counts 1, a hold-and-drag cursor gesture counts 1, a tap on the screen (history row, Find result, chip, menu item, prefix chip) counts 1. Nothing is free. A sequence is a list of steps: a key id of `spec/keyboard.yaml`, `{tap: <target>}`, `{hold: <key>}` or `{drag: <gesture>}`.

## What the harness checks
- **Active** task: replays `keys`, expects `expect.text` as the Home result, fails when the count is over `budget`.
- **Pending** task: replays `baseline` (today's best sequence found by a short search, not a proof), expects its `text`, which must also equal `expect.value` to 12 digits. So the baselines stay true, and the table shows what today costs.
- The file itself: ten tasks, every key id exists, `source` is one of the golden sources, planned sequences fit their budget.
- Pending budgets are plans from the sequence beside them; they are fixed when the task goes active, and the owner agrees them then. `null` = interface not designed yet.
- Expected values are `derived` or `oracle` (mpmath in `tests/golden/.venv`), never from memory of another calculator.

## Going active
Set `status: active`, make sure every step in `keys` can be replayed (`replay()` in the spec knows keys and `{tap: "result:last"}`; teach it a new tap target when the feature that has it lands), and check the budget. Milestone 4 turns on t05 (Find); milestone 5 on t01–t04 and t10; milestone 6 on t06–t09.

## The comparison column (`compare`)
Hand-measured presses for the same task on the reference calculator (Virtual Calculator) and on a typical phone calculator, same counting rule. **Empty until the owner measures them**: nothing here may be guessed. A measurement goes in `compare.g2_virtual_calc` / `compare.phone_calculator` with the date in a comment.
