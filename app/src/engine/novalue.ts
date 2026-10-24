// SPDX-License-Identifier: GPL-3.0-or-later
// G78 (backlog F50, F51; decisions.md "F50, F51", the owner 2026-10-20): Home never shows a number that went through a
// division by zero, nor Giac's text where a number was asked for and none came.
// - Giac computes in the extended reals: 1/0 is ∞ and x/∞ is 0, so 1/(1/0) and exp(ln 0) give an exact 0. A finite
//   result whose input holds a part that evaluates to an infinity is refused (throughInfinity). An infinity the user
//   typed (`inf`, a limit, an integral to ∞) is not looked for.
// - A result with no free name that is still Giac's text (asin(acos(π²)), sinh(6020³)), or a float path that gave
//   undef, is a number asked for and not found: refused "overflow" when its value is an infinity, else "no value found"
//   (lostNumber).
// - G84 (backlog F60): a value that reads as 0 while Giac's exact answer is not 0 (exp(-10^30), past MPFR's exponent
//   range) is refused "underflow", as an overflow is (underflow).
// Runs synchronously next to the engine; only erasable TypeScript syntax.
import { callsIn, type Refusal } from "./converge.ts";
import { MAX_EVAL_DIGITS, type ElementFacts, type Giac, type Shape } from "./numeric.ts";
import { functionsIn } from "./giacPrint.ts";
import { isZero } from "./format.ts";

/** The reasons of this module; the UI shows `error.<code>` from the i18n table (enEngine.ts). */
export type NoValue = Extract<Refusal, "divisionByZero" | "overflow" | "underflow" | "noValue">;

const isError = (t: string): boolean => t.startsWith("GIAC_ERROR");
const infinite = (t: string): boolean => /infinity/.test(t);
/** An infinity the user typed: then an infinite part is meant, not a division by zero. */
const TYPED_INF = /\b(inf|infinity)\b/;
import { treeOf, UNEVALUATED, type TreeNode } from "./tree.ts";

export { UNEVALUATED };

/** Divisions by a positive integer literal or a power of ten (a typed decimal read exactly, `(981/100)`), and by the
 *  degree factor, which is never 0. */
const SAFE_DIVISION = /\/\s*(?:\(\s*)?(?:[1-9]\d*(?:\^\d+)?|pasdeg)(?:\s*\))?(?![\w.^(])/g;
/** What can give an infinity from finite parts: a division left after SAFE_DIVISION, a negative power (0^-1), or one of
 *  these. */
const SOURCE = /\/|\^\s*\(?\s*-|\b(ln|log|log10|logb|tan|cot|sec|csc|atanh|acoth|Gamma|gamma|factorial|Psi|psi|Beta|beta|inv|lnGamma)\s*\(/;
/** The operators (Giac's `sommet` of a quoted part) that can make an infinity from finite operands; a power only when
 *  its exponent is not a positive integer literal. Only these parts are evaluated again. */
const SOURCE_OPS = new Set(["/", "^", "inv", "ln", "log", "log10", "logb", "tan", "cot", "sec", "csc", "atanh", "acoth", "Gamma", "gamma", "factorial", "Psi", "psi", "Beta", "beta", "lnGamma"]);
/** A part that changes engine state when it runs (an assignment, a store, a purge, an increment) or draws a random
 *  number: evaluating it again would change state the user did not ask to change (rules-core, principle 3). */
export const CHANGES_STATE = /:=|=<|=>|\+=|-=|\*=|\/=|\+\+|--|\b(?:sto|purge|assume|additionally|srand|randseed|RandSeed|alea|hasard|shuffle|sample)\s*\(|\b\w*ran[dmv]\w*\s*\(/i;
/** Time the walk may take. A part costs at most about what the whole input cost (Home's own exact time), and some Giac
 *  calls ignore the interrupt (GMP's factorial, decisions.md "G58"), so a part is evaluated only while the time spent
 *  plus that cost stays within this. */
const WALK_BUDGET_MS = 500;

/**
 * F51: a finite (or undef) `output` of `input` (decimals exact) that rests on an infinity inside: some part of the
 * input, below the whole, whose operator can make an infinity (SOURCE_OPS) evaluates to ±∞ or Giac's unsigned ∞. Only
 * those parts are evaluated again, one engine call each; the walk is not run (nothing found) for an input that changes
 * state when run (CHANGES_STATE) or calls a function `userFn` names (a stored program may change globals), and it stops
 * (nothing found) before a part that could take the walk past WALK_BUDGET_MS, at `exactMs` (Home's own exact
 * evaluation time) per part, or once `late()`.
 */
export function throughInfinity(giac: Giac, input: string, output: string, late: () => boolean, exactMs: number, userFn: (name: string) => boolean): boolean {
  if (infinite(output) || TYPED_INF.test(input) || !SOURCE.test(input.replace(SAFE_DIVISION, "")) || callsIn(input).length) return false;
  if (CHANGES_STATE.test(input.replace(/"[^"]*"/g, "")) || functionsIn(input).some(userFn)) return false;
  try {
    // First the shape, with no evaluation (G103: the tree of the quoted input as Giac stores it in pasq, from bridge-3 in
    // the same call, tree.ts); the sources in it, innermost first, so the infinity is found at the part that makes it;
    // the whole input is not evaluated again.
    const tree = late() ? null : treeOf(giac.value(`pasq:=quote(${input})`, [], true).tree, "pasq");
    if (!tree) return false;
    const sources: string[] = [];
    const visit = (t: TreeNode, root: boolean): void => {
      if (t.kind === 1 && UNEVALUATED.has(t.head)) return;
      for (const c of t.children) visit(c, false);
      if (!root && t.kind === 1 && t.source && SOURCE_OPS.has(t.head)) sources.push(t.path);
    };
    visit(tree, true);
    const t0 = performance.now();
    for (const p of sources) {
      if (late() || performance.now() - t0 + exactMs > WALK_BUDGET_MS) return false;
      if (giac.eval(`when(has(eval(${p}),infinity),1,0)`).trim() === "1") return true;
    }
    return false;
  } finally {
    giac.eval("purge(pasq)");
  }
}

/** A name in Giac's text that is not a call nor a constant: the result has a free name (or a stored function's name),
 *  so it is not a lost number; read from the text, so such a result costs no engine call. */
const FREE_NAME = /\b(?!(?:pi|e|i|euler_gamma)\b)[A-Za-z_]\w*\b(?!\s*\()/;

/**
 * F50: the reason for a result held in `slot` that is Giac's text with no free name (a number was asked for, and Giac
 * found none): "overflow" when its value is an infinity, else "noValue"; for Giac's undef of an `input` through an
 * infinity, "divisionByZero" (F51, the walk's limits as there); null for anything else (a name in it, a list, a string, a function, an infinity
 * Giac gave as the answer, a test, the undef of 0/0).
 */
export function lostNumber(
  giac: Giac,
  slot: string,
  input: string,
  output: string,
  late: () => boolean,
  exactMs: number,
  userFn: (name: string) => boolean,
): NoValue | null {
  const out = output.trim();
  if (out === "undef") return throughInfinity(giac, input, out, late, exactMs, userFn) ? "divisionByZero" : null;
  if (infinite(out) || /==|<>|->|"/.test(out) || FREE_NAME.test(out)) return null;
  if (giac.eval(`type(${slot})`).trim() !== "expression") return null;
  if (namesOf(giac, slot)?.length !== 0) return null;
  return infinite(giac.eval(`evalf(${slot})`)) ? "overflow" : "noValue";
}

/** F50: a float path's `error` text for an input with no free name: Giac's undef or an infinity (no number found);
 *  null for Giac's own error message, which stays. */
export function lostFloat(giac: Giac, input: string, error: string): NoValue | null {
  const e = error.trim();
  if (isError(e) || (e !== "undef" && !/^[+-]?infinity$/.test(e))) return null;
  const names = namesOf(giac, `quote(${input})`);
  // A name that holds a value (pasdeg, a stored variable) is not free; a free name's type is "identifier".
  if (!names || names.some((n) => !CONSTANTS.has(n) && giac.eval(`type(${n})`).trim() === "identifier")) return null;
  return infinite(e) ? "overflow" : "noValue";
}

/** Giac's lname of `expr` (the names in it), from bridge-3's elements; null when it is no list (an error). */
function namesOf(giac: Giac, expr: string): string[] | null {
  const v = giac.value(`lname(${expr})`, []);
  return v.kind === "list" || v.kind === "matrix" ? (v.elements ?? null) : null;
}

const CONSTANTS = new Set(["pi", "e", "i", "infinity", "euler_gamma"]);

/** G84: the Giac texts of the elements of the result in `slot` that read as 0 and are no exact rational. */
export function zeroElements(slot: string, facts: readonly ElementFacts[], shape: Shape): string[] {
  const at = (k: number): string =>
    shape.kind === "scalar" ? slot : shape.kind === "list" ? `${slot}[${k}]` : `${slot}[${Math.floor(k / shape.cols)}][${k % shape.cols}]`;
  return facts.flatMap((f, k) => (!f.exact && isZero(f.value.re) && isZero(f.value.im) ? [at(k)] : []));
}

/**
 * F60: whether one of `elements` (Giac texts of values that read as 0) is an underflow: a number too small for MPFR's
 * exponent range (exp(-10^30)), not a 0. Decided on Giac's exact answer, not on a float (bug-patterns family 3): its
 * normal form is not 0 (simplify, which proves more, takes 0.13 s on the DEG text of exp(cosh(asin(π))) and Giac's
 * interrupt then left the answer to chance). With `P`, the element's evalf must be MPFR's 0 at P, not noise below the
 * digits read (an exact 0 that Giac cannot prove, cos(pi/7)-cos(2*pi/7)+cos(3*pi/7)-1/2, is about 1E-41 at 40 digits
 * and stays ⚠ 0), and again at MAX_EVAL_DIGITS: a cancellation (exp(10^-70)-1, 1E-70, 0 at P, P+20 and P+40) has
 * digits there, an underflow has none at any precision; it stays ⚠ 0 (precision.yaml prec-zero-cancel). Without `P`
 * (null) the 0 is a double's, where MPFR found no value. One engine call per element, only for those that read as 0; a
 * call Giac interrupts (an error) decides nothing.
 */
export function underflow(giac: Giac, elements: readonly string[], P: number | null): boolean {
  return elements.some((e) => {
    const nonzero = `when(normal(${e})==0,0,1)`;
    const q = P === null ? nonzero : `when(evalf(${e},${P})==0,when(evalf(${e},${MAX_EVAL_DIGITS})==0,${nonzero},0),0)`;
    return giac.eval(q).trim() === "1";
  });
}
