// SPDX-License-Identifier: GPL-3.0-or-later
// What Settings › Appearance shows of the looks (R50e): the families' names and swatch dots, and the step round a list.
// Lazy with the Settings sheet (views/modeSheet.ts).
import type { Family } from "./apply.ts";

/** The families, in the list's order: the name and five swatch dots (the dark block's screen, number key, Enter, Shift
 *  and Alpha colours; look.test.ts compares them with the generated CSS). */
export const FAMILIES: readonly { readonly id: Family; readonly name: string; readonly dots: readonly string[] }[] = [
  { id: "n62", name: "N62", dots: ["#000000", "#1b2122", "#529997", "#ff9a33", "#529997"] },
  { id: "graphite", name: "Graphite", dots: ["#17181b", "#323438", "#a8620f", "#f2b45a", "#8fbdf0"] },
  { id: "solarized", name: "Solarized", dots: ["#2d4056", "#3d556f", "#1f6fae", "#f0c040", "#95cdf7"] },
  { id: "gruvbox", name: "Gruvbox", dots: ["#1d2021", "#3c3836", "#417957", "#fabd2f", "#89a99d"] },
  { id: "nord", name: "Nord", dots: ["#2e3440", "#434c5e", "#5579a5", "#f2ddb2", "#8fc4d3"] },
];
export const familyOf = (id: Family): (typeof FAMILIES)[number] => FAMILIES.find((f) => f.id === id) ?? (FAMILIES[0] as (typeof FAMILIES)[number]);


/** The value `by` steps from `now` in `all`, round the ends (◀ ▶ in Appearance). */
export function stepped<T>(all: readonly T[], now: T, by: 1 | -1): T {
  return all[(all.indexOf(now) + by + all.length) % all.length] as T;
}
