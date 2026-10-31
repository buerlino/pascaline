// SPDX-License-Identifier: GPL-3.0-or-later
// The sheet's view (Sheet.svelte with sheetFit.ts) is its own chunk (R46): it only draws an open sheet. main.ts fetches
// it when idle after the keypad is drawn; a key that opens a sheet before it is in waits for it (App.svelte).
// R91: the code that only runs with a sheet or a palette open (the keys' reading, sheetKeys.ts, and the palette cells,
// tmplSheet.ts) comes in the same load, so the start chunk does not carry it.

import type { UnitPad } from "../units/pad.ts";

type SheetComponent = (typeof import("./Sheet.svelte"))["default"];

/** `C` is null until the chunk is in. `keys` and `palette` (R91: the sheet's keys, sheetKeys.ts, and the palette cells,
 *  tmplSheet.ts) come with it and are set before it; a sheet is open only after that, but a long press
 *  can open a sheet before. `pad` (R24b): the unit pad's cells while it is up on the keys, set by units/padView; the keypad
 *  draws and routes through it. (Module objects and class instances are not proxied by $state, so they stay whole.) */
export const sheetChunk: { C: SheetComponent | null; keys: typeof import("./sheetKeys.ts") | null; palette: typeof import("./tmplSheet.ts") | null; pad: UnitPad | null } = $state({
  C: null,
  keys: null,
  palette: null,
  pad: null,
});

let loading: Promise<void> | null = null;
export function loadSheetView(): Promise<void> {
  loading ??= Promise.all([import("./Sheet.svelte"), import("./sheetKeys.ts"), import("./tmplSheet.ts")]).then(
    ([m, keys, palette]) => {
      sheetChunk.keys = keys;
      sheetChunk.palette = palette;
      sheetChunk.C = m.default;
    },
    (e: unknown) => {
      loading = null; // a later open tries again
      throw e;
    },
  );
  return loading;
}
