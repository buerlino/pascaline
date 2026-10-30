// SPDX-License-Identifier: GPL-3.0-or-later
// R24b: the unit pad's state, small enough for the start chunk. The pad itself (units/pad.ts with spec/unit-pad.yaml)
// is a lazy chunk that comes with the unit view; until R24c opens it from the units key, `?pad=1` (dev only) shows it.
// Keypad.svelte draws the keys from `model`; keyboard/route.ts hands a press to it and the result to `on`.
import type { PadEmit, UnitPad } from "./pad.ts";

export const unitPad: { model: UnitPad | null; on: (e: PadEmit) => void; log?: PadEmit[] } = $state({ model: null, on: () => {} });

/** Load the pad and show it on the keys (the module objects stay whole: a $state holds the class instance as is). */
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
