// SPDX-License-Identifier: GPL-3.0-or-later
// The only door from the start chunk into the Shift palettes' chunk (R18, keyboard/shiftPalettes.ts). It starts loading
// with MathLive (render/mathlive.svelte.ts), like the parser, so it is there before anything can be entered.
type ShiftPalettes = typeof import("./shiftPalettes.ts");

let loading: Promise<ShiftPalettes> | undefined;
/** Set once the chunk is there: Shift + 6 and Shift + 9 then open at once. */
export let shiftPalettes: ShiftPalettes | undefined;

export function loadShiftPalettes(): Promise<ShiftPalettes> {
  loading ??= import("./shiftPalettes.ts").then((m) => (shiftPalettes = m));
  return loading;
}
