// SPDX-License-Identifier: GPL-3.0-or-later
// R24b: the unit pad's switch, loaded with the unit view (never in the start chunk). The pad is up while
// `sheetChunk.pad` holds its cells (views/sheetView.svelte.ts: the state the keypad already reads for the sheet's keys):
// Keypad.svelte draws the keys through it, keyboard/route.ts hands it a press and `on` the result. Until R24c opens the
// pad from the units key, `?pad=1` (dev only, main.ts) shows it.
import { tick } from "svelte";
import { fitLegends } from "../keyboard/fit.ts";
import { sheetChunk } from "../views/sheetView.svelte.ts";
import type { PadEmit, UnitPad } from "./pad.ts";

export const unitPad: { model: UnitPad | null; on: (e: PadEmit) => void; log?: PadEmit[] } = {
  get model() {
    return sheetChunk.pad;
  },
  set model(m: UnitPad | null) {
    sheetChunk.pad = m;
    // the faces and legends change with it: fit them again once drawn (Keypad.svelte re-fits on its own for Shift and Alpha)
    void tick().then(() => {
      const pad = document.querySelector<HTMLElement>(".pad");
      if (pad) fitLegends(pad);
    });
  },
  on: () => {},
};

/** Load the pad and show it on the keys. */
export async function showUnitPad(): Promise<void> {
  const m = await import("./pad.ts");
  unitPad.model = new m.UnitPad();
}

/** The dev switch (`?pad=1`): the pad is up and every press is logged (window.pascaline.unitPad.log). */
export function devPad(): void {
  unitPad.log = [];
  unitPad.on = (e) => void unitPad.log?.push(e);
  void showUnitPad();
}
