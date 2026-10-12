// SPDX-License-Identifier: GPL-3.0-or-later
// Chips on the entry line (docs/04 sections 2.8 and 3.6): a history result `\res{k}{shown}`, the last result
// `\ans` and a constant `\const{ID}{symbol}`. Each chip is one MathLive macro the cursor cannot enter; the
// second argument is only what the chip shows. The value lives in the entry's chip table, which each history
// item stores beside its entry LaTeX, so the parser never waits for an engine or the Find index.
import { SerializeError } from "./emit.ts";

export interface Chip {
  /** Giac text the parser puts in place of the chip: an exact text (`1/3`, `sqrt(2)`) or a decimal with every confirmed digit. */
  value: string;
  /** False when `value` is not the exact value (a rounded decimal, a constant with an uncertainty): a result computed from it is never "=". */
  exact: boolean;
  /** A constant's standard uncertainty (CODATA), absent when it is exact. */
  unc?: string;
}

/** Keys: `res:<k>` for `\res{k}{…}`, `const:<ID>` for `\const{ID}{…}`, `ans` for `\ans` (filled at Enter). */
export type ChipTable = Record<string, Chip>;

export const resKey = (k: number | string): string => `res:${k}`;
export const constKey = (id: string): string => `const:${id}`;
export const ANS_KEY = "ans";

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
    const { value, exact, unc } = c as Record<string, unknown>;
    if (typeof value !== "string" || typeof exact !== "boolean") continue;
    out[k] = typeof unc === "string" ? { value, exact, unc } : { value, exact };
  }
  return Object.keys(out).length ? out : undefined;
}

const DECIMAL = /^([+-]?)(\d*)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/;

/**
 * The Giac text for a chip value, in brackets so it stays one factor. A decimal becomes an exact rational
 * literal (docs/04 2.8: the digits the chip carries, not a float), so `1/3` carried as 40 digits stays 40 digits
 * in CAS too. Anything else is the engine's own exact text. Values never hold a statement (`;`, `:=`).
 */
export function chipToGiac(value: string): string {
  const v = value.trim();
  if (v === "" || /;|:=/.test(v)) throw new SerializeError("chip value is not a number or expression");
  const m = DECIMAL.exec(v);
  if (m && ((m[2] ?? "") !== "" || (m[3] ?? "") !== "")) {
    const sign = m[1] === "-" ? "-" : "";
    const frac = m[3] ?? "";
    const digits = `${m[2] ?? ""}${frac}`.replace(/^0+(?=\d)/, "");
    const exp = Number(m[4] ?? "0") - frac.length;
    if (digits === "0") return "0";
    if (exp === 0) return `(${sign}${digits})`;
    return exp > 0 ? `(${sign}${digits}*10^${exp})` : `(${sign}${digits}/10^${-exp})`;
  }
  return `(${v})`;
}
