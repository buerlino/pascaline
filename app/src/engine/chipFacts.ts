// SPDX-License-Identifier: GPL-3.0-or-later
// G49 (deep check 2026-10-19 D1, D3): a result reused through Ans or a tapped chip keeps its facts. A Home input may
// hold chips by name (`pasr_<k>`, R65's parser switch, as G26's `pasc_<id>` constants) with a table of their values
// and facts. The host gives each named chip that is not exact its value as a Giac variable for the run, so the input
// evaluates as with a stored variable, and the chip's facts work as a stored float's do (decisions M4-7): its
// confirmed digits cap the result, its warn passes on, and the perturbation check moves it in its last confirmed
// digit. An exact chip (decisions M4-4) is put in as a literal, as before. Synchronous, UI-free. Only erasable
// TypeScript syntax.
import type { ValueFacts } from "./types.ts";
import type { NameFacts } from "./defs.ts";
import { floatsAsEvalf } from "./homeEval.ts";
import { hasFloat } from "./numeric.ts";
import { mapNames, names } from "./giacPrint.ts";
import { isZeroText } from "./constBasis.ts";
import type { SigmaInput } from "./constUnc.ts";

/** A result the input holds as a chip: its value as Giac text (`0.746824132812427…`, `1/3`), the significant digits
 *  confirmed when it was shown (null: not limited), its warn, and whether it is exact (M4-4: `=`, or an exact
 *  symbolic value). Keyed by the k after `pasr_`. */
export interface ChipEntry extends ValueFacts {
  value: string;
  /** R61: a unit result's σ in the unit shown (Giac text); a nonzero one makes the chip an input of σ (sigmaChip). */
  unc?: string;
}
export type ChipFactsTable = Readonly<Record<string, ChipEntry>>;

/** The prefix of a chip sent by name. */
export const CHIP_PREFIX = "pasr_";
/** R61: the free symbol a chip with σ is in the σ expression (its `pasr_` name holds its value during the run). */
const SIGMA_PREFIX = "pasru_";

/** R61: the chip carries a nonzero σ (a unit result's), so it is an independent input of σ, as a constant (G26). */
export function sigmaChip(e: ChipEntry): boolean {
  return e.unc !== undefined && !isZeroText(e.unc);
}

/** Whether the chip goes in as a literal (M4-4): exact, and no σ (R61: a value with an uncertainty is never exact). */
export function literalChip(e: ChipEntry): boolean {
  return e.exact && !sigmaChip(e);
}


function entry(table: ChipFactsTable, k: string): ChipEntry | undefined {
  return Object.hasOwn(table, k) ? table[k] : undefined;
}

/** The chips of `table` that `input` holds, in order of first appearance. */
export function chipsIn(input: string, table: ChipFactsTable): string[] {
  const ks: string[] = [];
  for (const { name } of names(input, "typed")) {
    const k = name.slice(CHIP_PREFIX.length);
    if (name.startsWith(CHIP_PREFIX) && k !== "" && !ks.includes(k) && entry(table, k)) ks.push(k);
  }
  return ks;
}

/** `input` with every chip of `table` replaced by its value in brackets, except the ones in `keep`, which stay names.
 *  Names not in the table are left alone. */
export function withChipValues(input: string, table: ChipFactsTable, keep: ReadonlySet<string>): string {
  return mapNames(input, ({ name }) => {
    const k = name.slice(CHIP_PREFIX.length);
    const e = name.startsWith(CHIP_PREFIX) && k !== "" ? entry(table, k) : undefined;
    return e && !keep.has(k) ? `(${e.value})` : null;
  }, "typed");
}

/** The Giac command that gives the chip `k` its value for a run: a float as `evalf(<exact>,n)` with the digits it
 *  carries, as a stored variable is set again (host.ts `snapshot`); any other text as it is. */
export function chipCommand(k: string, e: ChipEntry): string {
  return `${CHIP_PREFIX}${k}:=(${hasFloat(e.value) ? floatsAsEvalf(e.value) : e.value})`;
}

/** The facts a named chip lends the result, as a stored variable's (M4-7); never exact. */
export function chipNameFacts(e: ChipEntry): NameFacts {
  return { exact: false, reliableDigits: e.reliableDigits, ...(e.warn ? { warn: e.warn } : {}), inexact: true };
}

/** R61: `body` for σ (constUnc.ts sigmaExpr): every chip of `table` with σ as a free symbol, each an independent input
 *  with its value and σ; every other chip as its value. A body with no chip with σ is returned as it is (G26's). */
export function chipSigma(body: string, table: ChipFactsTable): { body: string; inputs: SigmaInput[] } {
  const inputs: SigmaInput[] = [];
  if (!chipsIn(body, table).some((k) => sigmaChip(table[k]!))) return { body, inputs };
  const out = mapNames(body, ({ name }) => {
    const k = name.slice(CHIP_PREFIX.length);
    const e = name.startsWith(CHIP_PREFIX) && k !== "" ? entry(table, k) : undefined;
    if (!e) return null;
    if (!sigmaChip(e)) return `(${e.value})`;
    const sym = `${SIGMA_PREFIX}${k}`;
    if (!inputs.some((v) => v.name === sym)) inputs.push({ name: sym, value: e.value, unc: e.unc! });
    return sym;
  }, "typed");
  return { body: out, inputs };
}
