// SPDX-License-Identifier: GPL-3.0-or-later
// The parser's tables (parse.ts): names, functions, relations, and its option and result types (R72 moved them out
// of parse.ts).
import type { ChipTable } from "./chips.ts";
import type { Json } from "./emit.ts";

/**
 * Greek letters are variable names (R18), never units (μ, Ω) or Giac's own names. Giac reads most of them as plain
 * names, but some are taken: `epsilon` is a setting (it evaluates to 1e-12), `Gamma` is the Gamma function and cannot
 * be stored, `beta`, `gamma` stay clear of the Beta and Euler names, and `Phi`, `Psi` are reserved (`Psi:=3` is
 * refused, R18f1). Those get a trailing `_`, which Giac's latex()
 * draws as the letter and a stray `_` (render/tidy.ts removes it). One letter is one name: \epsilon and \varepsilon,
 * \phi and \varphi, \theta and \vartheta are the same variable.
 */
export const GREEK: Readonly<Record<string, string>> = {
  alpha: "alpha", beta: "beta_", gamma: "gamma_", delta: "delta", epsilon: "epsilon_", varepsilon: "epsilon_",
  zeta: "zeta", eta: "eta", theta: "theta", vartheta: "theta", iota: "iota", kappa: "kappa", lambda: "lambda",
  mu: "mu", nu: "nu", xi: "xi", rho: "rho", sigma: "sigma", tau: "tau", phi: "phi", varphi: "phi", chi: "chi",
  psi: "psi", omega: "omega", Gamma: "Gamma_", Delta: "Delta", Theta: "Theta", Lambda: "Lambda", Sigma: "Sigma",
  Phi: "Phi_", Psi: "Psi_", Omega: "Omega",
};
/**
 * R67 (decisions R58b): a typed letter is always a name. Giac reads `e` as exp(1) and `i` as √−1 (`e:=3` is refused,
 * `sum(i^2,i,1,3)` an error), so the letters e and i go in as the stand-ins `e_` and `i_`, drawn as the letters again
 * (render/tidy.ts). The constants come from the eˣ key (\exponentialE) and Shift + 2 (\imaginaryI).
 */
export const LETTER_NAMES: Readonly<Record<string, string>> = { e: "e_", i: "i_" };
export const letterName = (v: string): string => LETTER_NAMES[v] ?? v;
export const CONSTS: Record<string, string> = {
  pi: "Pi", exponentialE: "ExponentialE", imaginaryI: "ImaginaryUnit", infty: "PositiveInfinity",
};
/** LaTeX function command -> MathJSON head. */
export const FUNCS: Record<string, string> = {
  sin: "Sin", cos: "Cos", tan: "Tan", cot: "Cot", sec: "Sec", csc: "Csc",
  arcsin: "Arcsin", arccos: "Arccos", arctan: "Arctan",
  sinh: "Sinh", cosh: "Cosh", tanh: "Tanh",
  ln: "Ln", log: "Log", lg: "Lg", exp: "Exp", det: "Determinant",
  gcd: "Gcd", lcm: "Lcm", max: "Max", min: "Min", arg: "Arg", Re: "Re", Im: "Im",
};
export const INVERSE: Record<string, string> = {
  Sin: "Arcsin", Cos: "Arccos", Tan: "Arctan", Sinh: "Arsinh", Cosh: "Arcosh", Tanh: "Artanh",
};
export const RELATION: Record<string, string> = {
  "=": "Equal", "<": "Less", ">": "Greater", lt: "Less", gt: "Greater",
  ne: "NotEqual", neq: "NotEqual", le: "LessEqual", leq: "LessEqual", ge: "GreaterEqual", geq: "GreaterEqual",
};
/** Names that become function calls when followed by parentheses (single letters need to be listed). */
export const NAMED_FUNCS = new Set(["abs", "sqrt", "floor", "ceil", "round", "sign", "gcd", "lcm", "max", "min", "det", "mod"]);
/** R18: the logic words of the Shift + 6 palette written as calls, by their name in \operatorname. EQ is the G2's
 *  list command (G2 item 32): equality of the two whole objects, Giac's == (Giac has no EQ). */
export const LOGIC_FUNCS: Readonly<Record<string, { head: string; args: number }>> = {
  NOT: { head: "Not", args: 1 },
  EQ: { head: "EqualTest", args: 2 },
};
export const ABS_LIKE: Record<string, string> = { abs: "Abs", sign: "Sign", floor: "Floor", ceil: "Ceil", round: "Round" };
export const FACTOR_CMDS = new Set([
  "frac", "dfrac", "tfrac", "sqrt", "binom", "overline", "int", "sum", "prod", "lim", "begin",
  "operatorname", "mathrm", "mathit", "res", "ans", "const",
]);

/** Letters that start a base prefix after a lone 0 (0x, 0b, 0o), and what may follow them. */
export const BASE_PREFIX: Record<string, RegExp> = { x: /^[0-9A-Fa-f]/, b: /^[0-9]/, o: /^[0-9]/ };

export interface ParseOptions {
  /** Single letters that name functions when followed by parentheses. Default f, g, h. */
  userFunctions?: ReadonlySet<string>;
  /** L6 setting: the decimal separator is a comma; arguments are then separated by ";". */
  decimalComma?: boolean;
  /** The entry's chip table: the values of its \res, \ans and \const chips (input/chips.ts). */
  chips?: ChipTable;
  /** R65 (Home): a result chip that is not exact goes in as its name `pasr_<k>` (chip-giac.ts chipName), listed in
   *  ParseInfo.named for the engine (G49), not as its value. */
  chipNames?: boolean;
  /** R28, the unit view (docs/04 4.3): a prompt after a number is its unit slot, `\pm` after a number its standard
   *  uncertainty, a constant chip stays a constant and `\to` before the last prompt marks the end slot. */
  units?: boolean;
}

/** R28: what units mode found besides the formula, for G16's UnitRequest. */
export interface UnitsInfo {
  /** The prompt ids of the unit slots in the order written: `pasu<i>` is slots[i-1]. */
  slots: string[];
  /** Find constant ids without "const:": `pask<j>` is consts[j-1]; a constant used twice is one entry. */
  consts: string[];
  /** The prompt id of the end slot after `\to`, if there is one. */
  end?: string;
}

/** What the parser found besides the expression. */
export interface ParseInfo {
  json: Json;
  /** A chip whose value is not exact was used, so the result cannot be marked "=" (docs/04 2.4). */
  inexact: boolean;
  /** With `chipNames`: the chips that went in by name, keyed by the k of `pasr_<k>`. */
  named?: ChipTable;
  /** Units mode only. */
  units?: UnitsInfo;
}
