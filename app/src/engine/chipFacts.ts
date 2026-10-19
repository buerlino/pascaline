// SPDX-License-Identifier: GPL-3.0-or-later
// G49 (deep check 2026-10-19 D1, D3): a result reused through Ans or a tapped chip keeps its facts. A Home input may
// hold chips by name (`pasr_<k>`, R65's parser switch, as G26's `pasc_<id>` constants) with a table of their values
// and facts. The host gives each named chip that is not exact its value as a Giac variable for the run, so the input
// evaluates as with a stored variable, and the chip's facts work as a stored float's do (decisions M4-7): its
// confirmed digits cap the result, its warn passes on, and the perturbation check moves it in its last confirmed
// digit. An exact chip (decisions M4-4) is put in as a literal, as before. Synchronous, UI-free. Only erasable
// TypeScript syntax.
import type { NameFacts } from "./defs.ts";
import type { PrecisionWarn } from "./format.ts";
import { floatsAsEvalf } from "./homeEval.ts";
import { hasFloat } from "./numeric.ts";

/** A result the input holds as a chip: its value as Giac text (`0.746824132812427…`, `1/3`), the significant digits
 *  confirmed when it was shown (null: not limited), its warn, and whether it is exact (M4-4: `=`, or an exact
 *  symbolic value). Keyed by the k after `pasr_`. */
export interface ChipEntry {
  value: string;
  reliableDigits: number | null;
  warn?: PrecisionWarn;
  exact: boolean;
}
export type ChipFactsTable = Readonly<Record<string, ChipEntry>>;

/** The prefix of a chip sent by name. */
export const CHIP_PREFIX = "pasr_";

const CHIP_NAME = /(?<![A-Za-z0-9_])pasr_([A-Za-z0-9_]+)/g;

function entry(table: ChipFactsTable, k: string): ChipEntry | undefined {
  return Object.hasOwn(table, k) ? table[k] : undefined;
}

/** The chips of `table` that `input` holds, in order of first appearance. */
export function chipsIn(input: string, table: ChipFactsTable): string[] {
  const ks: string[] = [];
  for (const m of input.matchAll(CHIP_NAME)) {
    const k = m[1]!;
    if (!ks.includes(k) && entry(table, k)) ks.push(k);
  }
  return ks;
}

/** `input` with every chip of `table` replaced by its value in brackets, except the ones in `keep`, which stay names.
 *  Names not in the table are left alone. */
export function withChipValues(input: string, table: ChipFactsTable, keep: ReadonlySet<string>): string {
  return input.replace(CHIP_NAME, (m, k: string) => {
    const e = entry(table, k);
    return e && !keep.has(k) ? `(${e.value})` : m;
  });
}

/** The Giac command that gives the chip `k` its value for a run: a float as `evalf(<exact>,n)` with the digits it
 *  carries, as a stored variable is set again (host.ts `snapshot`); any other text as it is. */
export function chipCommand(k: string, e: ChipEntry): string {
  return `${CHIP_PREFIX}${k}:=(${hasFloat(e.value) ? floatsAsEvalf(e.value) : e.value})`;
}

/** The facts a named chip lends the result, as a stored variable's (M4-7); never exact. */
export function chipNameFacts(e: ChipEntry): NameFacts {
  return { reliableDigits: e.reliableDigits, ...(e.warn ? { warn: e.warn } : {}), inexact: true };
}
