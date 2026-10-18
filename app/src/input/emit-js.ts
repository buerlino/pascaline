// SPDX-License-Identifier: GPL-3.0-or-later
// MathJSON -> JavaScript expression source for plotting: real numbers only, one or more named variables,
// fully parenthesised, so the result can be compiled once with new Function and called allocation-free.
// 1/0 gives Infinity and invalid points (sqrt(-1), ln(-1)) give NaN, which curve renderers treat as a break.
import { SerializeError, oddIndex, oddRootExponent, type Json } from "./emit.ts";
import { parseLatex } from "./parse.ts";

const FN1: Record<string, string> = {
  Sin: "Math.sin", Cos: "Math.cos", Tan: "Math.tan", Arcsin: "Math.asin", Arccos: "Math.acos", Arctan: "Math.atan",
  Sinh: "Math.sinh", Cosh: "Math.cosh", Tanh: "Math.tanh", Arsinh: "Math.asinh", Arcosh: "Math.acosh", Artanh: "Math.atanh",
  Exp: "Math.exp", Ln: "Math.log", Lg: "Math.log10", Abs: "Math.abs", Sqrt: "Math.sqrt", Floor: "Math.floor",
  Ceil: "Math.ceil", Round: "Math.round", Sign: "Math.sign",
};
const CONST: Record<string, string> = { Pi: "Math.PI", ExponentialE: "Math.E", e: "Math.E", PositiveInfinity: "Infinity" };

function num(e: Json): string | undefined {
  if (typeof e === "object" && !Array.isArray(e) && "num" in e) return e.num;
  return undefined;
}

function js(e: Json, vars: ReadonlySet<string>): string {
  const n = num(e);
  if (n !== undefined) return /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(n) ? n : fail(`bad number ${n}`);
  if (typeof e === "string") {
    if (vars.has(e)) return e;
    if (e in CONST) return CONST[e] as string;
    return fail(`unknown name ${e}`);
  }
  if (!Array.isArray(e)) return fail("unsupported node");
  const h = e[0] as string;
  const a = e.slice(1) as Json[];
  const r = (i: number): string => js(a[i] as Json, vars);
  switch (h) {
    case "Add": return `(${r(0)}+${r(1)})`;
    case "Subtract": return `(${r(0)}-${r(1)})`;
    case "Negate": return `(-${r(0)})`;
    case "Multiply": return `(${a.map((_, i) => r(i)).join("*")})`;
    case "Divide": return `(${r(0)}/${r(1)})`;
    case "Power": {
      // Same as emit.ts with realOddRoots (P5 (b), R39): an exponent p/q with q odd takes the real q-th root
      const odd = oddRootExponent(a[1]);
      if (odd === undefined) return `Math.pow(${r(0)},${r(1)})`;
      const b = r(0);
      const root = odd.q === "3" ? `Math.cbrt(${b})` : `(Math.sign(${b})*Math.pow(Math.abs(${b}),1/${odd.q}))`;
      return odd.p === "1" ? root : `Math.pow(${root},${odd.p})`;
    }
    case "Delimiter": return r(0);
    case "Degrees": return `(${r(0)}*Math.PI/180)`;
    case "Root":
      // Same default as emit.ts (L6): an odd whole index gives the real root.
      if (oddIndex(a[1])) return r(1) === "3" ? `Math.cbrt(${r(0)})` : `(Math.sign(${r(0)})*Math.pow(Math.abs(${r(0)}),1/${r(1)}))`;
      return `Math.pow(${r(0)},1/${r(1)})`;
    case "Log": return a.length === 1 ? "Math.log10(" + r(0) + ")" : `(Math.log(${r(0)})/Math.log(${r(1)}))`;
    case "Max": return `Math.max(${a.map((_, i) => r(i)).join(",")})`;
    case "Min": return `Math.min(${a.map((_, i) => r(i)).join(",")})`;
    default:
      if (h in FN1 && a.length === 1) return `${FN1[h]}(${r(0)})`;
      return fail(`unsupported ${h}`);
  }
}
function fail(msg: string): never {
  throw new SerializeError(`cannot plot: ${msg}`);
}

/** JS source of the expression, e.g. `(Math.sin(x)*Math.pow(x,3))`. */
export function latexToJs(latex: string, vars: readonly string[] = ["x"]): string {
  return js(parseLatex(latex), new Set(vars));
}

/** JS source of an already parsed expression (MathJSON from parseLatex). */
export function jsonToJs(e: Json, vars: readonly string[] = ["x"]): string {
  return js(e, new Set(vars));
}

/** Compile `latex` into a function of x. Throws SerializeError for anything not plottable. */
export function toFn(latex: string): (x: number) => number {
  const src = latexToJs(latex, ["x"]);
  return new Function("x", `return ${src};`) as (x: number) => number;
}
