// SPDX-License-Identifier: GPL-3.0-or-later
// G106 (backlog F78, principle 3): Giac reads a list plus or minus a number as polynomial coefficients: `[1,4]+1` is
// `poly1[1,5]` (the number added to the constant term), `[1,4]*2+1` is `poly1[2,9]`, and `L+1` for a stored list too.
// Nobody who typed that asked for a polynomial: the answer for a list is elementwise (`[1,4] .+ 1` = `[2,5]`, R78 emits
// it for typed braces). Giac marks such a value with subtype 10 (`[1,4]` is 0, a matrix 11) and prints it `poly1[`.
// A result Giac prints with `poly1[` is refused, unless the input asked for a polynomial: it calls a function that
// returns one (POLYNOMIAL_FUNCTIONS), or a name it reads holds one (`P:=symb2poly(x^2+1)` then `P*2`), or a function of
// the user's it calls has one in its body. One engine call reads the result's subtype and the names' values together,
// and only when the text holds `poly1[`. If G103 reads a value's type from bridge-3, this check moves there.
// Runs synchronously next to the engine; only erasable TypeScript syntax.
import { functionsIn, namesIn, type Giac } from "./numeric.ts";

/** Giac functions whose result is (or holds) a coefficient vector of subtype 10, probed on the shared engine
 *  (2026-10-23). The ones that only pass a polynomial argument through (gcd, lcm, diff, sqrfree, factors, divis) are
 *  listed too: their argument came from one of the others. */
export const POLYNOMIAL_FUNCTIONS: readonly string[] = [
  "poly1", "symb2poly", "e2r", "pcoeff", "pcoef", "quo", "rem", "quorem", "egcd", "pcar", "charpoly", "pmin",
  "gcd", "lcm", "diff", "sqrfree", "factors", "divis",
];

/** Our result slots: they hold the result itself, not what the input read. */
const SLOTS = new Set(["pasans", "pcasans"]);

const WORD = new RegExp(`\\b(?:${POLYNOMIAL_FUNCTIONS.join("|")})\\b`);

/** Cheap text test: Giac printed a coefficient vector in `text` (strings left out). */
export function printsPoly(text: string): boolean {
  return text.replace(/"[^"]*"/g, "").includes("poly1[");
}

/** The input names a function that returns a polynomial (strings left out). */
export function asksPoly(input: string): boolean {
  return WORD.test(input.replace(/"[^"]*"/g, ""));
}

/**
 * The result in `slot` (printed `output`) of `input` is a coefficient vector, or a list of them, the input did not ask
 * for. One engine call, made only when `output` prints `poly1[` and `input` names no polynomial function: the
 * subtype of the result (or the largest of its elements') and the printed values of the names the input reads and of
 * the user's functions it calls (`userFn`).
 */
export function unaskedPoly(giac: Giac, slot: string, input: string, output: string, userFn: (name: string) => boolean): boolean {
  if (!printsPoly(output) || asksPoly(input)) return false;
  const names = [...namesIn(input), ...functionsIn(input).filter(userFn)].filter((n) => !SLOTS.has(n));
  const kind = `when(subtype(${slot})==10,10,when(type(${slot})==DOM_LIST,max(map(${slot},subtype)),0))`;
  const out = giac.eval(`string([${[kind, ...names].join(",")}])`);
  const m = /^"\[(\d+)/.exec(out);
  if (!m || m[1] !== "10") return false;
  // what the names hold, after the subtype: a polynomial there was asked for when it was stored
  const held = out.slice(m[0].length);
  return !held.includes("poly1[") && !WORD.test(held);
}

/** Cheap text test for a CAS assignment, which must not store a value this check refuses: its right-hand side adds or
 *  subtracts and holds a list, or a name `isList` says holds one. */
export function mayAddToList(rhs: string, isList: (name: string) => boolean): boolean {
  const t = rhs.replace(/"[^"]*"/g, "");
  return /[+-]/.test(t) && !asksPoly(t) && (t.includes("[") || namesIn(t).some(isList));
}
