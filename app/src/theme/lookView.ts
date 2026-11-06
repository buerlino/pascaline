// SPDX-License-Identifier: GPL-3.0-or-later
// What Settings › Appearance shows of the looks (R50e): the families' names and swatch dots, and the step round a list.
// Lazy with the Settings sheet (views/modeSheet.ts).
import type { Family } from "./apply.ts";

/** The families, in the list's order: the name and five swatch dots (the dark block's screen, number key, Enter and the keys' Shift and
 *  Alpha colours; look.test.ts compares them with the generated CSS). */
export const FAMILIES: readonly { readonly id: Family; readonly name: string; readonly dots: readonly string[] }[] = [
  { id: "n62", name: "N62", dots: ["#000000", "#1b2122", "#529997", "#ff9a33", "#529997"] },
  { id: "teal", name: "Teal", dots: ["#529997", "#1b2122", "#eef2f2", "#ff9a33", "#529997"] },
  { id: "solarized", name: "Solarized", dots: ["#2d4056", "#3d556f", "#1f6fae", "#f0c040", "#95cdf7"] },
];
export const familyOf = (id: Family): (typeof FAMILIES)[number] => FAMILIES.find((f) => f.id === id) ?? (FAMILIES[0] as (typeof FAMILIES)[number]);


/** The value `by` steps from `now` in `all`, round the ends (◀ ▶ in Appearance). */
export function stepped<T>(all: readonly T[], now: T, by: 1 | -1): T {
  return all[(all.indexOf(now) + by + all.length) % all.length] as T;
}
