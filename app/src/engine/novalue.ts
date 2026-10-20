// SPDX-License-Identifier: GPL-3.0-or-later
// G78 (backlog F50, F51; decisions.md "F50, F51", the owner 2026-10-20): Home never shows a number that went through a
// division by zero, nor Giac's text where a number was asked for and none came.
// - Giac computes in the extended reals: 1/0 is ∞ and x/∞ is 0, so 1/(1/0) and exp(ln 0) give an exact 0. A finite
//   result whose input holds a part that evaluates to an infinity is refused (throughInfinity). An infinity the user
//   typed (`inf`, a limit, an integral to ∞) is not looked for.
// - A result with no free name that is still Giac's text (asin(acos(π²)), sinh(6020³)), or a float path that gave
//   undef, is a number asked for and not found: refused "overflow" when its value is an infinity, else "no value found"
//   (lostNumber).
// Runs synchronously next to the engine; only erasable TypeScript syntax.
import { callsIn, type Refusal } from "./converge.ts";
import { splitList, type Giac } from "./numeric.ts";

/** The reasons of this module; the UI shows `error.<code>` from the i18n table (enEngine.ts). */
export type NoValue = Extract<Refusal, "divisionByZero" | "overflow" | "noValue">;

const isError = (t: string): boolean => t.startsWith("GIAC_ERROR");
const infinite = (t: string): boolean => /infinity/.test(t);
/** An infinity the user typed: then an infinite part is meant, not a division by zero. */
const TYPED_INF = /\b(inf|infinity)\b/;
/** Calls whose arguments are not all evaluated as written: a branch not taken (`piecewise(0>0,1/0,5)`), a body in a
 *  bound variable, a quoted text. Their parts are not looked at. */
const UNEVALUATED = new Set(["when", "piecewise", "ifte", "quote", "hold", "seq", "$", "makelist", "product", "diff", "solve", "fsolve", "romberg", "gaussquad"]);
/** Most parts looked at; a larger input is not checked (its result stands). */
const MAX_NODES = 200;

/** Divisions by a positive integer literal or a power of ten (a typed decimal read exactly, `(981/100)`), and by the
 *  degree factor, which is never 0. */
const SAFE_DIVISION = /\/\s*(?:\(\s*)?(?:[1-9]\d*(?:\^\d+)?|pasdeg)(?:\s*\))?(?![\w.^(])/g;
/** What can give an infinity from finite parts: a division left after SAFE_DIVISION, a negative power (0^-1), or one of
 *  these. */
const SOURCE = /\/|\^\s*\(?\s*-|\b(ln|log|log10|logb|tan|cot|sec|csc|atanh|acoth|Gamma|gamma|factorial|Psi|psi|Beta|beta|inv|lnGamma)\s*\(/;

/**
 * F51: a finite (or undef) `output` of `input` (decimals exact) that rests on an infinity inside: some part of the
 * input, below the whole, evaluates to ±∞ or Giac's unsigned ∞. Only an input that can give one (SOURCE) is looked at,
 * one engine call per part; `late()` stops the walk (nothing found then).
 */
export function throughInfinity(giac: Giac, input: string, output: string, late: () => boolean): boolean {
  if (infinite(output) || TYPED_INF.test(input) || !SOURCE.test(input.replace(SAFE_DIVISION, "")) || callsIn(input).length) return false;
  if (isError(giac.eval(`pasq:=quote(${input})`))) return false;
  let nodes = 0;
  // One call per part: [1, its operator, its number of parts, 1 when its value holds an infinity], [2, "", n] for a
  // list, [0] for anything else (a number, a name).
  // The whole input is not evaluated again (its value is `output`).
  const info = (p: string, root: boolean): string =>
    giac.eval(`when(type(${p})==DOM_SYMBOLIC,[1,string(sommet(${p})),size([op(${p})]),${root ? 0 : `has(eval(${p}),infinity)`}],when(type(${p})==DOM_LIST,[2,"",size(${p})],[0]))`);
  const walk = (p: string, root: boolean): boolean => {
    if (++nodes > MAX_NODES || late()) return false;
    const m = /^\[([12]),"'?(.*?)'?",(\d+)(?:,([01]))?\]$/.exec(info(p, root).replace(/\s/g, ""));
    if (!m || UNEVALUATED.has(m[2]!)) return false;
    if (m[4] === "1") return true;
    for (let k = 0; k < Number(m[3]); k++) if (walk(`[op(${p})][${k}]`, false)) return true;
    return false;
  };
  try {
    return walk("pasq", true);
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
 * infinity, "divisionByZero" (F51); null for anything else (a name in it, a list, a string, a function, an infinity
 * Giac gave as the answer, a test, the undef of 0/0).
 */
export function lostNumber(giac: Giac, slot: string, input: string, output: string, late: () => boolean): NoValue | null {
  const out = output.trim();
  if (out === "undef") return throughInfinity(giac, input, out, late) ? "divisionByZero" : null;
  if (infinite(out) || /==|<>|->|"/.test(out) || FREE_NAME.test(out)) return null;
  if (giac.eval(`type(${slot})`).trim() !== "expression") return null;
  if (giac.eval(`lname(${slot})`).replace(/\s/g, "") !== "[]") return null;
  return infinite(giac.eval(`evalf(${slot})`)) ? "overflow" : "noValue";
}

/** F50: a float path's `error` text for an input with no free name: Giac's undef or an infinity (no number found);
 *  null for Giac's own error message, which stays. */
export function lostFloat(giac: Giac, input: string, error: string): NoValue | null {
  const e = error.trim();
  if (isError(e) || (e !== "undef" && !/^[+-]?infinity$/.test(e))) return null;
  const names = splitList(giac.eval(`lname(quote(${input}))`));
  // A name that holds a value (pasdeg, a stored variable) is not free; a free name's type is "identifier".
  if (!names || names.some((n) => !CONSTANTS.has(n) && giac.eval(`type(${n})`).trim() === "identifier")) return null;
  return infinite(e) ? "overflow" : "noValue";
}

const CONSTANTS = new Set(["pi", "e", "i", "infinity", "euler_gamma"]);
