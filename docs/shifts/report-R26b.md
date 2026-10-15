<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Report R26b: the hardware Backspace and Delete (bug F16)

Branch `p1/ron-m4a-hwdelete` (commits e1ecbd8 tests, bd69733 fix).

- **Fix:** the capturing `keydown` listener in `app/src/entry/controller.ts` sends Backspace to `run({kind:"cmd", name:"deleteBackward"})` and Delete to `deleteForward`, with `preventDefault` and `stopPropagation`. A held key repeats the same path.
- **Ctrl, Alt and Meta + key:** left to MathLive (not routed), so Ctrl + Backspace (delete a word) is still MathLive's.
- **Tests** (`bksp.spec.ts`, two new): log log reaches the empty line with the hardware Backspace; Delete is the mirror (`sin 2 3` gives `23`, `log log` empties). Both failed before the fix and pass after.
- **Gate:** bksp, entry and undo e2e: 38 passed. `npm run typecheck`: 0 errors.
