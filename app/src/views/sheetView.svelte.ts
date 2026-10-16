// SPDX-License-Identifier: GPL-3.0-or-later
// The sheet's view (Sheet.svelte with sheetFit.ts) is its own chunk (R46): it only draws an open sheet. main.ts fetches
// it when idle after the keypad is drawn; a key that opens a sheet before it is in waits for it (App.svelte).

type SheetComponent = (typeof import("./Sheet.svelte"))["default"];

/** `C` is null until the chunk is in. */
export const sheetChunk: { C: SheetComponent | null } = $state({ C: null });

let loading: Promise<void> | null = null;
export function loadSheetView(): Promise<void> {
  loading ??= import("./Sheet.svelte").then(
    (m) => {
      sheetChunk.C = m.default;
    },
    (e: unknown) => {
      loading = null; // a later open tries again
      throw e;
    },
  );
  return loading;
}
