// SPDX-License-Identifier: GPL-3.0-or-later
// Chips on the entry line (docs/04 sections 2.8 and 3.6): a history result `\res{k}{shown}`, the last result
// `\ans` and a constant `\const{ID}{symbol}`. Each chip is one MathLive macro the cursor cannot enter; the
// second argument is only what the chip shows. The value lives in the entry's chip table, which each history
// item stores beside its entry LaTeX, so the parser never waits for an engine or the Find index.
import type { ValueFacts } from "../engine/types.ts";

/** The chip's facts are ValueFacts (G76): `exact` false when `value` is not the exact value (a rounded decimal, a
 *  constant with an uncertainty), so a result computed from it is never "="; a result chip that is not exact keeps the
 *  significant digits confirmed when it was shown and its ⚠ reason, which the next line keeps (R65, decisions M4-5).
 *  `reliableDigits` may be absent (stored chips and constants have none): the same as null. */
export interface Chip extends Omit<ValueFacts, "reliableDigits">, Partial<Pick<ValueFacts, "reliableDigits">> {
  /** Giac text the parser puts in place of the chip: an exact text (`1/3`, `sqrt(2)`) or a decimal with every confirmed digit. */
  value: string;
  /** A constant's standard uncertainty (CODATA), absent when it is exact. */
  unc?: string;
}

/** Keys: `res:<k>` for `\res{k}{…}`, `const:<ID>` for `\const{ID}{…}`, `ans` for `\ans` (filled at Enter). */
export type ChipTable = Record<string, Chip>;

export const resKey = (k: number | string): string => `res:${k}`;
export const constKey = (id: string): string => `const:${id}`;
export const ANS_KEY = "ans";

/** The chip table keyboard template samples are parsed with (spec/keyboard.yaml: Shift + `+` = Ans, sample Ans = 7). */
export const SAMPLE_CHIPS: ChipTable = { [ANS_KEY]: { value: "7", exact: true } };

/** The chips a LaTeX string refers to, as table keys (to keep only those in a history item). */
export function chipKeysIn(latex: string): Set<string> {
  const keys = new Set<string>();
  for (const m of latex.matchAll(/\\(res|const)\{([^{}]*)\}|\\ans(?![A-Za-z])/g)) {
    if (m[1] === "res") keys.add(resKey(m[2] as string));
    else if (m[1] === "const") keys.add(constKey(m[2] as string));
    else keys.add(ANS_KEY);
  }
  return keys;
}

/** Only the entries of `table` that `latex` refers to (Ans is resolved at Enter, never stored). */
export function pruneChips(table: ChipTable, latex: string): ChipTable {
  const used = chipKeysIn(latex);
  const out: ChipTable = {};
  for (const [k, c] of Object.entries(table)) if (k !== ANS_KEY && used.has(k)) out[k] = c;
  return out;
}

/** A stored chip table read back from IndexedDB: keep the well-formed entries only. */
export function validChips(x: unknown): ChipTable | undefined {
  if (!x || typeof x !== "object") return undefined;
  const out: ChipTable = {};
  for (const [k, c] of Object.entries(x as Record<string, unknown>)) {
    if (!/^(res:\d+|const:[A-Za-z0-9_]+)$/.test(k) || !c || typeof c !== "object") continue;
    const { value, exact, unc, reliableDigits: rd, warn } = c as Record<string, unknown>;
    if (typeof value !== "string" || typeof exact !== "boolean") continue;
    const chip: Chip = typeof unc === "string" ? { value, exact, unc } : { value, exact };
    if (rd === null || (typeof rd === "number" && Number.isInteger(rd) && rd >= 0 && rd <= 1000)) chip.reliableDigits = rd;
    if (warn === "unaudited" || warn === "unchecked") chip.warn = warn;
    out[k] = chip;
  }
  return Object.keys(out).length ? out : undefined;
}
