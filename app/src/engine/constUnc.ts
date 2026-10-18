// SPDX-License-Identifier: GPL-3.0-or-later
// G26 (deep-dive item 17): the digits a constant's uncertainty leaves. A Home input may hold constants as names
// (`pasc_<id>`, R40's parser switch) with a table of their values and CODATA standard uncertainties. The values are
// put in and the input evaluates as before; then the first-order σ of the result (G18's rule, units/evaluate.ts):
// σ = sqrt(Σ (∂f/∂cᵢ · σᵢ)²) over the inexact constants, taken as independent, exactly with Giac's diff at the
// constants' values. `uncDigits` is the number of significant digits of the shown value before the digit position of
// σ's first digit: the digits from there on are uncertain. Synchronous, UI-free. Only erasable TypeScript syntax.
import { decimalFromString, isZero, roundSignificant, type DecimalValue } from "./format.ts";
import { toExactLiterals, type HomeResult } from "./homeEval.ts";
import type { Giac } from "./numeric.ts";

/** A constant the input holds by name: its value as Giac text (`6.67430E-11`), and its standard uncertainty in the
 *  same unit (`0.00015E-11`), absent or zero when the constant is exact. Keyed by the id after `pasc_`. */
export interface ConstEntry {
  value: string;
  unc?: string;
}
export type ConstTable = Readonly<Record<string, ConstEntry>>;

/** The prefix of a constant sent by name. */
export const CONST_PREFIX = "pasc_";

const CONST_NAME = /(?<![A-Za-z0-9_])pasc_([A-Za-z0-9_]+)/g;

/** A decimal or integer text that is exactly zero ("0", "0.0", "0E-11"). */
function isZeroText(s: string): boolean {
  return /^\s*[+-]?0*\.?0*(?:[eE][+-]?\d+)?\s*$/.test(s) && /\d/.test(s);
}

function inexact(e: ConstEntry | undefined): e is ConstEntry & { unc: string } {
  return e !== undefined && e.unc !== undefined && !isZeroText(e.unc);
}

/** `input` with every constant of `table` replaced by its value in brackets; when `keep` is given, the constants it
 *  holds stay names. Names not in the table are left alone. */
export function withConstValues(input: string, table: ConstTable, keep?: ReadonlySet<string>): string {
  return input.replace(CONST_NAME, (m, id: string) => {
    const e = Object.hasOwn(table, id) ? table[id] : undefined;
    return e && !keep?.has(id) ? `(${e.value})` : m;
  });
}

/** The inexact constants of `table` that `input` holds, in order of first appearance. */
export function inexactConstsIn(input: string, table: ConstTable): string[] {
  const ids: string[] = [];
  for (const m of input.matchAll(CONST_NAME)) {
    const id = m[1]!;
    if (!ids.includes(id) && Object.hasOwn(table, id) && inexact(table[id])) ids.push(id);
  }
  return ids;
}

/** The Giac text of the first-order σ of `body` over the inexact constants `ids` (decimals as exact rationals). */
export function sigmaExpr(body: string, table: ConstTable, ids: readonly string[]): string {
  const keep = new Set(ids);
  const f = toExactLiterals(withConstValues(body, table, keep));
  const at = `[${ids.map((id) => `${CONST_PREFIX}${id}=(${toExactLiterals(table[id]!.value)})`).join(",")}]`;
  const terms = ids.map((id) => `(subst(diff(${f},${CONST_PREFIX}${id}),${at})*(${toExactLiterals(table[id]!.unc!)}))^2`);
  return `sqrt(${terms.join("+")})`;
}

/** Significant digits of `value` shown at `digits` that lie before the position of σ's first digit (≥ 0). Null for
 *  a σ of zero (no digit is uncertain). A value of zero has no digit to keep: 0. */
export function uncDigitsOf(value: DecimalValue, sigma: DecimalValue, digits: number): number | null {
  if (isZero(sigma)) return null;
  if (isZero(value)) return 0;
  return Math.max(0, roundSignificant(value, digits).exp - sigma.exp);
}

/**
 * The `uncDigits` of a Home result computed from `body` (the input with its constants as names): absent when no
 * inexact constant of `table` is in it, when the result is not one real number, or when σ cannot be computed (a
 * function Giac cannot differentiate, the budget ran out).
 */
export function constUncDigits(giac: Giac, body: string, table: ConstTable, r: HomeResult, digits: number): number | undefined {
  const ids = inexactConstsIn(body, table);
  if (!ids.length || !r.ok || !r.value || r.items || !isZero(r.value.im)) return undefined;
  const out = giac.eval(`evalf(${sigmaExpr(body, table, ids)},20)`);
  if (out.startsWith("GIAC_ERROR")) return undefined;
  const sigma = decimalFromString(out);
  if (!sigma) return undefined;
  return uncDigitsOf(r.value.re, sigma, digits) ?? undefined;
}
