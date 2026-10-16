// SPDX-License-Identifier: GPL-3.0-or-later
// R34 (F30): a line kept from before a kill (entry/keep.ts), read back at start. Loaded lazily, beside MathLive.
import { validChips, type ChipTable } from "../input/chips.ts";
import { resultToEntry } from "../render/insertable.ts";
import type { KeptLine } from "./keep.ts";

/** The index after the {…} group that starts at `i`, or -1 if there is none. */
function groupEnd(s: string, i: number): number {
  if (s[i] !== "{") return -1;
  for (let depth = 0; i < s.length; i++) {
    if (s[i] === "\\") i++;
    else if (s[i] === "{") depth++;
    else if (s[i] === "}" && --depth === 0) return i + 1;
  }
  return -1;
}

/**
 * The line without the chips whose value is not in `table` (a damaged store): a result chip becomes the digits it
 * showed, so the line still parses and shows what it computes; a constant chip is dropped, since its symbol alone
 * would be read as a name.
 */
function withoutLostChips(latex: string, table: ChipTable): string {
  let out = "";
  let i = 0;
  for (const m of latex.matchAll(/\\(res|const)(?![A-Za-z])/g)) {
    const at = m.index;
    if (at < i) continue;
    const a = groupEnd(latex, at + m[0].length);
    const b = a < 0 ? -1 : groupEnd(latex, a);
    if (b < 0) continue;
    const key = `${m[1]}:${latex.slice(at + m[0].length + 1, a - 1)}`;
    if (key in table) continue;
    out += latex.slice(i, at) + (m[1] === "res" ? resultToEntry(latex.slice(a + 1, b - 1)) : "");
    i = b;
  }
  return out + latex.slice(i);
}

/**
 * A stored line read back: undefined unless it is a well-formed, non-empty line typed in `want` (a CAS line never
 * comes back into Home, which computes it the numeric way).
 */
export function keptLine(x: unknown, want: string): KeptLine | undefined {
  if (!x || typeof x !== "object") return undefined;
  const { view, latex, chips } = x as Record<string, unknown>;
  if ((view !== "home" && view !== "cas") || view !== want || typeof latex !== "string" || latex === "") return undefined;
  const table = validChips(chips) ?? {};
  return { view, latex: withoutLostChips(latex, table), chips: table };
}
