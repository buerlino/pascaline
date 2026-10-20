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
import { functionsIn, splitList, type Giac } from "./numeric.ts";

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
/** The operators (Giac's `sommet` of a quoted part) that can make an infinity from finite operands; a power only when
 *  its exponent is not a positive integer literal. Only these parts are evaluated again. */
const SOURCE_OPS = new Set(["/", "^", "inv", "ln", "log", "log10", "logb", "tan", "cot", "sec", "csc", "atanh", "acoth", "Gamma", "gamma", "factorial", "Psi", "psi", "Beta", "beta", "lnGamma"]);
/** A part that changes engine state when it runs (an assignment, a store, a purge, an increment) or draws a random
 *  number: evaluating it again would change state the user did not ask to change (rules-core, principle 3). */
const CHANGES_STATE = /:=|=<|=>|\+=|-=|\*=|\/=|\+\+|--|\b(?:sto|purge|assume|additionally|srand|randseed|RandSeed|alea|hasard|shuffle|sample)\s*\(|\b\w*ran[dmv]\w*\s*\(/i;
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
  if (isError(giac.eval(`pasq:=quote(${input})`))) return false;
  try {
    // First the shape, with no evaluation: one call per part, [1, its operator, its number of parts, 1 when it is a
    // source] for a call or operator, [2, "", n] for a list, [0] for anything else (a number, a name).
    const sources: string[] = [];
    let nodes = 0;
    const shape = (p: string, root: boolean): boolean => {
      if (++nodes > MAX_NODES || late()) return false;
      const m = /^\[([12]),"'?(.*?)'?",(\d+)(?:,([01]))?\]$/.exec(
        giac
          .eval(
            `when(type(${p})==DOM_SYMBOLIC,[1,string(sommet(${p})),size([op(${p})]),when(sommet(${p})=='^',when(type([op(${p})][1])==DOM_INT and [op(${p})][1]>0,0,1),1)],when(type(${p})==DOM_LIST,[2,"",size(${p})],[0]))`,
          )
          .replace(/\s/g, ""),
      );
      if (!m) return true;
      if (UNEVALUATED.has(m[2]!)) return true;
      for (let k = 0; k < Number(m[3]); k++) if (!shape(`[op(${p})][${k}]`, false)) return false;
      // Innermost first, so the infinity is found at the part that makes it; the whole input is not evaluated again.
      if (!root && m[1] === "1" && m[4] === "1" && SOURCE_OPS.has(m[2]!)) sources.push(p);
      return true;
    };
    if (!shape("pasq", true)) return false;
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
