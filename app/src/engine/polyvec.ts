// SPDX-License-Identifier: GPL-3.0-or-later
// G106 (backlog F78, principle 3): Giac reads a list plus or minus a number as polynomial coefficients: `[1,4]+1` is
// `poly1[1,5]` (the number added to the constant term), `[1,4]*2+1` is `poly1[2,9]`, and `L+1` for a stored list too.
// Nobody who typed that asked for a polynomial: the answer for a list is elementwise (`[1,4] .+ 1` = `[2,5]`, R78 emits
// it for typed braces). Giac marks such a value with subtype 10 (`[1,4]` is 0, a matrix 11) and prints it `poly1[`.
// A result Giac prints with `poly1[` is refused, unless the input asked for a polynomial: it calls a function that
// returns one (POLYNOMIAL_FUNCTIONS), or a name it reads holds one (`P:=symb2poly(x^2+1)` then `P*2`), or a function of
// the user's it calls has one in its body. One engine call reads the result's subtype at any depth and the names'
// values together, and only when the text holds `poly1[`. If G103 reads a value's type from bridge-3, this check moves there.
// Runs synchronously next to the engine; only erasable TypeScript syntax.
import { type Giac } from "./numeric.ts";
import { functionsIn, namesIn, type Quoting } from "./giacPrint.ts";
import { callsDistribution } from "./ourNames.ts";

/** Giac functions that create a coefficient vector of subtype 10, probed on the shared engine (2026-10-23). The ones
 *  that only pass a polynomial argument through (gcd, lcm, diff, factors) are not listed: that argument is a call of
 *  one of these, `poly1[…]`, or a name the input reads (`held` in unaskedPoly), so the check already lets it pass, and
 *  listing them would let `[1,4]+1+diff(x,x)*0` through. */
export const POLYNOMIAL_FUNCTIONS: readonly string[] = [
  "poly1", "symb2poly", "e2r", "pcoeff", "pcoef", "quo", "rem", "quorem", "egcd", "pcar", "charpoly", "pmin",
];

/** Our result slots: they hold the result itself, not what the input read. */
const SLOTS = new Set(["pasans", "pcasans"]);

const POLY = new Set(POLYNOMIAL_FUNCTIONS);

/** Our Giac helper: 1 when its argument is a coefficient vector (subtype 10) or a list holding one at any depth, else 0
 *  (xcas indexing from 0). Recursive, so a list two or more levels deep is read too (G106f1). One of ENGINE_DEFINITIONS
 *  (homeEval.ts), so a library cannot define the name and the state read takes it for ours; unaskedPoly still defines
 *  it again inside its one call, so a user's `paspoly1:=5` cannot turn the check off. */
export const POLY_AT = "paspoly1";
export const POLY_AT_ANY_DEPTH =
  `${POLY_AT}(v):={ local k; if (subtype(v)==10) return 1; if (type(v)!=DOM_LIST) return 0; ` +
  `for (k:=0;k<size(v);k:=k+1) { if (${POLY_AT}(v[k])==1) return 1; } return 0; }`;

/** Cheap text test: Giac printed a coefficient vector in `text` (one inside a string too; the engine call tells). */
export function printsPoly(text: string): boolean {
  return text.includes("poly1[");
}

/** The input names a function that returns a polynomial, or `poly1` itself (strings left out, as `q` writes them). */
export function asksPoly(input: string, q: Quoting): boolean {
  return [...functionsIn(input, q), ...namesIn(input, q)].some((n) => POLY.has(n));
}

/**
 * The result in `slot` (printed `output`) of `input` is a coefficient vector, or a list of them, the input did not ask
 * for. One engine call, made only when `output` prints `poly1[` and `input` names no polynomial function: whether the
 * result holds subtype 10 at any depth (POLY_AT_ANY_DEPTH; G106f1: `[[[1,4]+1]]` too) and the printed values of the
 * names the input reads and of the user's functions it calls (`userFn`). The same call defines the helper first (the
 * list's element 0), so it holds our text whatever the user stored under the name.
 */
export function unaskedPoly(giac: Giac, slot: string, input: string, output: string, userFn: (name: string) => boolean): boolean {
  if (!printsPoly(output) || asksPoly(input, "typed")) return false;
  const names = [...namesIn(input, "typed"), ...functionsIn(input, "typed").filter(userFn)].filter((n) => !SLOTS.has(n));
  const out = giac.eval(`[${POLY_AT_ANY_DEPTH},string(${POLY_AT}(${slot}))+string([${names.join(",")}])][1]`);
  if (!out.startsWith('"1[')) return false;
  // what the names hold: a polynomial there was asked for when it was stored, or a function's body asks for one
  const held = out.slice(3);
  return !printsPoly(held) && !asksPoly(held, "printed");
}

/** Cheap text test for a CAS assignment, which must not store a value this check refuses: its right-hand side adds or
 *  subtracts and holds a list, or a name `isList` says holds one. */
export function mayAddToList(rhs: string, isList: (name: string) => boolean): boolean {
  return (rhs.includes("+") || rhs.includes("-")) && !asksPoly(rhs, "typed") && (rhs.includes("[") || namesIn(rhs, "typed").some(isList));
}

/** The printed result of `input`, which calls a distribution, holds a value of Giac's list type (a stored list or Ans
 *  as its argument) or a coefficient vector the input did not ask for (a typed list, a `[ ]` vector there; R80 fix 1). */
export function listInDistribution(input: string, output: string): boolean {
  return (output.includes("list[") || (output.includes("poly1[") && !asksPoly(input, "typed"))) && callsDistribution(input);
}
