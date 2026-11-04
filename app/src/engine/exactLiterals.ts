// SPDX-License-Identifier: GPL-3.0-or-later
// G163: decimal literals as exact rationals (`0.1` → `(1/10)`), Home's first step (homeEval.ts) and the first step of the
// engine's other callers (solve, analysis, the unit evaluator, constUnc). Pure text, no engine: it imports only giacPrint.ts,
// so the unit view's main-thread chunks read it without the worker's evaluator (docs/04 8.1; import-rules.ts rule 3).
// Only erasable TypeScript syntax.
import { mapNumbers, type Quoting } from "./giacPrint.ts";

/** Rewrites the decimal literals of `input` that have a point or an exponent (`2.5`, `.5`, `1e-3`, `1.2E5`) with `f`.
 *  Leaves integers, identifiers (`x1`, `0x1F`) and strings alone. */
export function rewriteDecimals(input: string, f: (mant: string, exp10: number) => string, q: Quoting): string {
  return mapNumbers(input, (mant, exp) => (!mant.includes(".") && !exp ? null : f(mant, exp ? parseInt(exp.slice(1), 10) : 0)), q);
}

/** Rewrites decimal literals (`2.5`, `.5`, `1e-3`, `1.2E5`) as exact rationals. Leaves integers,
 *  identifiers (`x1`, `0x1F`) and strings alone. */
export function toExactLiterals(input: string): string {
  return rewriteDecimals(input, exactRational, "typed");
}

export function exactRational(mant: string, exp10: number): string {
  const [ip, fp = ""] = mant.split(".");
  const digits = (ip + fp).replace(/^0+(?=\d)/, "");
  const e = exp10 - fp.length;
  if (e === 0) return digits;
  return e > 0 ? `(${digits}*10^${e})` : `(${digits}/10^${-e})`;
}
