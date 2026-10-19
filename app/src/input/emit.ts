// SPDX-License-Identifier: GPL-3.0-or-later
// MathJSON (Compute Engine's shape, also produced by our own parser) -> Giac input string.
import { parseError } from "../i18n/enParser.ts";
import { SerializeError } from "./errors.ts";

export { SerializeError };

export type Json = number | string | { num: string } | { sym: string } | { str: string } | Json[];

export interface SerializeOptions {
  /** Single-letter names treated as functions when followed by (...), e.g. f(x). Others multiply. */
  userFunctions?: ReadonlySet<string>;
  /**
   * L6 and P5 (b), R39. The root template: an n-th root with odd whole n is the real root (∛(-8) = -2) unless this is
   * false. The power form only when this is true (Home, Solve and Function set it; CAS does not): a power whose
   * exponent is a literal fraction p/q (reduced) with q odd is the real root, (-8)^(1/3) = -2 as on the G2 (items 4
   * and 11). An even q, or any other exponent, keeps the principal root.
   */
  realOddRoots?: boolean;
}

function wholeText(e: Json | undefined): string | undefined {
  const v = typeof e === "object" && e !== null && !Array.isArray(e) && "num" in e ? e.num : undefined;
  return v !== undefined && /^\d+$/.test(v) ? v : undefined;
}

function gcd(a: bigint, b: bigint): bigint {
  while (b !== 0n) [a, b] = [b, a % b];
  return a;
}

/**
 * The exponent is a literal fraction of whole numbers (`1/3`, `-2/3`, `\frac{-1}{5}`, in brackets or not) whose
 * reduced denominator is odd and above 1: its reduced p and q, as text. Otherwise undefined.
 */
export function oddRootExponent(e: Json | undefined): { p: string; q: string } | undefined {
  let neg = false;
  let x = e;
  for (;;) {
    if (Array.isArray(x) && x[0] === "Delimiter" && x.length === 2) x = x[1] as Json;
    else if (Array.isArray(x) && x[0] === "Negate" && x.length === 2) [neg, x] = [!neg, x[1] as Json];
    else break;
  }
  if (!Array.isArray(x) || (x[0] !== "Divide" && x[0] !== "Rational") || x.length !== 3) return undefined;
  let num = x[1] as Json;
  if (Array.isArray(num) && num[0] === "Negate" && num.length === 2) [neg, num] = [!neg, num[1] as Json];
  const [a, b] = [wholeText(num), wholeText(x[2] as Json)];
  if (a === undefined || b === undefined) return undefined;
  let [p, q] = [BigInt(a), BigInt(b)];
  if (q === 0n || p === 0n) return undefined;
  const g = gcd(p, q);
  [p, q] = [p / g, q / g];
  if (q === 1n || q % 2n === 0n) return undefined;
  return { p: (neg ? "-" : "") + String(p), q: String(q) };
}

/** The root index is an odd whole number literal (3, 5, ...). */
export function oddIndex(n: Json | undefined): boolean {
  const v = typeof n === "number" ? String(n) : typeof n === "object" && n !== null && !Array.isArray(n) && "num" in n ? n.num : "";
  return /^\d+$/.test(v) && Number(v) % 2 === 1;
}

/** Fixed names: MathJSON head -> Giac function name (plain 1:1 calls). */
const FN: Record<string, string> = {
  Sin: "sin", Cos: "cos", Tan: "tan", Cot: "cot", Sec: "sec", Csc: "csc",
  Arcsin: "asin", Arccos: "acos", Arctan: "atan",
  Sinh: "sinh", Cosh: "cosh", Tanh: "tanh", Arsinh: "asinh", Arcosh: "acosh", Artanh: "atanh",
  Arcsinh: "asinh", Arccosh: "acosh", Arctanh: "atanh",
  Exp: "exp", Ln: "ln", Lg: "log10", Abs: "abs", Floor: "floor", Ceil: "ceil", Round: "round",
  Sqrt: "sqrt", Sign: "sign", Max: "max", Min: "min", Gcd: "gcd", Lcm: "lcm", GCD: "gcd", LCM: "lcm",
  Binomial: "comb", Factorial: "factorial", Re: "re", Im: "im", Conjugate: "conj", Arg: "arg",
  Determinant: "det", Transpose: "tran", Inverse: "inv", Gamma: "Gamma", Mod: "pasmod", Rem: "pasmod",
};
const INVERSE: Record<string, string> = {
  Sin: "asin", Cos: "acos", Tan: "atan", Sinh: "asinh", Cosh: "acosh", Tanh: "atanh",
};
const CONST: Record<string, string> = {
  Pi: "pi", ExponentialE: "exp(1)", ImaginaryUnit: "i", e: "exp(1)",
  PositiveInfinity: "inf", NegativeInfinity: "(-inf)", ComplexInfinity: "infinity",
};
const REL: Record<string, string> = {
  Equal: "=", Less: "<", LessEqual: "<=", Greater: ">", GreaterEqual: ">=",
};

/** The Giac name Home and CAS read after a test to learn that a side held a float (engine/homeEval.ts, same name). */
export const EQ_INEXACT_FLAG = "pasinexact";
/** R18f2: the difference of a float-side test, and the verdict the engine host sets for it (0 equal, 1 not, 2 open). */
export const EQ_DIFF = "pasdiff";
export const EQ_VERDICT = "pasverdict";

/**
 * R18f1: `a == b` and `a ≠ b` as value tests (decisions "2026-10-14 R18 defaults" point 6). Giac's own `==` compares
 * the expressions, so `x==2` (x free) and `sin(1)^2+cos(1)^2==1` both gave an exact-looking false. Here the test is
 * true when the difference simplifies to exact 0; false when the difference has no free names and is an exact rational,
 * or its 30-digit value is clearly not 0 against the sides (an evaluation at 30 digits is off by about 10^-30 of the
 * sides, so 10^-20 leaves a wide margin); otherwise it stays as typed, like `x>0`. ≠ is the exact negation. A side
 * with a float in it (`evalf(pi)`, a romberg value) sets EQ_INEXACT_FLAG, stores the difference in EQ_DIFF and takes
 * its answer from EQ_VERDICT (R18f2): a float can only be compared to its own digits, so the engine host runs the test
 * at two precisions and sets the verdict (engine/numeric.ts decideFloatTest). Without a verdict (a test inside a
 * stored function) a float side stays as typed.
 */
export function equalityTest(a: Out, b: Out, negate: boolean): Out {
  const [yes, no, rel] = negate ? ["false", "true", "!="] : ["true", "false", "=="];
  const kept = `'${wrap(a, 1)}${rel}${wrap(b, 1)}'`;
  const big = (v: string): string => `max(abs(evalf(${v},30)))`;
  const float = "string(exact(d_))!=string(d_)";
  const test =
    `{if(${float}){sto(1,${EQ_INEXACT_FLAG});sto(d_,${EQ_DIFF})};` +
    `when(${float},when(${EQ_VERDICT}==0,${yes},when(${EQ_VERDICT}==1,${no},${kept})),` +
    `when(simplify(d_)==0*d_,${yes},when(lname(d_)==[] and (type(d_)==integer or type(d_)==rational or ` +
    `${big("d_")}>10^-20*max(${big("a_")},${big("b_")})),${no},${kept})))}`;
  return { s: `((a_,b_)->((d_)->${test})(a_-b_))(${a.s},${b.s})`, p: 5 };
}

const LOGIC: Record<string, string> = { And: "and", Or: "or" };

type Prec = 0 | 1 | 2 | 3 | 4 | 5; // 0 relation, 1 add, 2 mul, 3 unary minus, 4 power, 5 atom
interface Out { s: string; p: Prec }
const wrap = (o: Out, min: Prec): string => (o.p < min ? `(${o.s})` : o.s);

function isHead(e: Json, h: string): e is Json[] {
  return Array.isArray(e) && e[0] === h;
}

function numberText(e: Json): string | undefined {
  if (typeof e === "number") {
    if (!Number.isFinite(e)) throw parseError("parse.nonFiniteNumber");
    return String(e).replace("e+", "e");
  }
  if (typeof e === "object" && !Array.isArray(e) && "num" in e) {
    const n = e.num.replace(/[\s_]/g, "");
    if (/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(n) || /^[+-]?(Infinity|NaN)$/.test(n)) return n;
    throw parseError("parse.unsupportedNumberLiteral", { num: e.num });
  }
  if (typeof e === "string" && /^[+-]?\d+(\.\d+)?$/.test(e)) return e;
  return undefined;
}

function symbolText(e: Json): string | undefined {
  let s: string | undefined;
  if (typeof e === "string") s = e;
  else if (typeof e === "object" && !Array.isArray(e) && "sym" in e) s = e.sym;
  if (s === undefined) return undefined;
  if (s.startsWith("'") && s.endsWith("'")) return undefined; // MathJSON string literal
  return s;
}

/** Giac's own `mod` is the modular-number constructor (an error as a call); Find's `mod` is irem (Euclidean,
 *  never negative: irem(-7,3) = 2), so the written word is renamed to our pasmod (homeEval.ts ENGINE_DEFINITIONS:
 *  irem for integers, and the same remainder for a rational, where irem is an error). G42: median and percentile are ours
 *  too (the median of an even list, percentile unevaluated in Giac; `median` is a reserved word there). */
const CALL_NAME: Readonly<Record<string, string>> = { mod: "pasmod", irem: "pasmod", median: "pasmedian", percentile: "paspercentile" };

function call(name: string, args: Json[], o: SerializeOptions): Out {
  return { s: `${CALL_NAME[name] ?? name}(${args.map((a) => ser(a, o).s).join(",")})`, p: 5 };
}

function lambdaBody(f: Json, o: SerializeOptions): { body: Json; v?: string } {
  if (isHead(f, "Function")) {
    const body = f[1] as Json;
    return { body: isHead(body, "Block") ? (body[1] as Json) : body, v: symbolText(f[2] as Json) };
  }
  return { body: f };
}

/** Fold an implicit-multiplication sequence: f(x) is a call only for known/multi-letter names. */
function invisible(raw: Json[], o: SerializeOptions): Out {
  const args = raw.filter((a) => !isHead(a, "HorizontalSpacing")); // \, \; \quad are layout only
  const user = o.userFunctions ?? new Set(["f", "g", "h"]);
  const parts: Out[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i] as Json;
    const next = args[i + 1];
    const name = symbolText(a);
    if (name !== undefined && next !== undefined && isHead(next, "Delimiter") && (name.length > 1 || user.has(name))) {
      const inner = (next[1] ?? []) as Json;
      const list = isHead(inner, "Sequence") ? (inner.slice(1) as Json[]) : [inner];
      parts.push(call(name, list, o));
      i++;
    } else if (
      name !== undefined && next !== undefined && isHead(next, "Power") && isHead(next[1] as Json, "Delimiter") &&
      (name.length > 1 || user.has(name))
    ) {
      // f(x)^2 parses as f * (x)^2; a call to f raised to the power is what the user meant
      const inner = ((next[1] as Json[])[1] ?? []) as Json;
      const list = isHead(inner, "Sequence") ? (inner.slice(1) as Json[]) : [inner];
      parts.push({ s: `${call(name, list, o).s}^${wrap(ser(next[2] as Json, o), 5)}`, p: 4 });
      i++;
    } else {
      parts.push(ser(a, o));
    }
  }
  return mulOuts(parts);
}

function mulOuts(parts: Out[]): Out {
  if (parts.length === 1) return parts[0] as Out;
  return { s: parts.map((p) => wrap(p, 3)).join("*"), p: 2 };
}

function ser(e: Json, o: SerializeOptions): Out {
  const n = numberText(e);
  if (n !== undefined) return { s: n, p: n.startsWith("-") ? 3 : 5 };
  const sym = symbolText(e);
  if (sym !== undefined) {
    if (sym === "Nothing") throw parseError("parse.emptyInput");
    if (sym in CONST) return { s: CONST[sym] as string, p: 5 };
    return { s: sym, p: 5 };
  }
  if (!Array.isArray(e)) throw parseError("parse.unsupportedNode", { json: JSON.stringify(e) });
  const head = e[0] as string;
  const args = e.slice(1) as Json[];
  const a0 = args[0] as Json;
  const a1 = args[1] as Json;
  switch (head) {
    case "Chip": // our own parser: a chip's value, already Giac text in brackets (input/chips.ts)
      if (typeof a0 === "object" && a0 !== null && !Array.isArray(a0) && "str" in a0) return { s: a0.str, p: 5 };
      throw parseError("parse.badChip");
    case "Call": // our own parser: ["Call", name, ...args]
      return call(a0 as string, args.slice(1), o);
    case "Error":
      throw parseError("parse.parseError", { json: JSON.stringify(e) });
    case "Add": {
      let s = "";
      args.forEach((a, i) => {
        const o1 = ser(a, o);
        if (i === 0) s = wrap(o1, 1);
        else if (isHead(a, "Negate")) s += `-${wrap(ser(a[1] as Json, o), 2)}`;
        else s += `+${wrap(o1, 1)}`;
      });
      return { s, p: 1 };
    }
    case "Subtract":
      return { s: `${wrap(ser(a0, o), 1)}-${wrap(ser(a1, o), 2)}`, p: 1 };
    case "Negate":
      return { s: `-${wrap(ser(a0, o), 2)}`, p: 1 };
    case "Multiply":
      return mulOuts(args.map((a) => ser(a, o)));
    case "InvisibleOperator":
      return invisible(args, o);
    case "Divide":
      return { s: `${wrap(ser(a0, o), 2)}/${wrap(ser(a1, o), 4)}`, p: 2 };
    case "Rational":
      return { s: `(${ser(a0, o).s})/(${ser(a1, o).s})`, p: 2 };
    case "Square":
      return { s: `${wrap(ser(a0, o), 5)}^2`, p: 4 };
    case "Power": {
      if (a0 === "ExponentialE" || a0 === "e") return call("exp", [a1], o); // e^x -> exp(x), not exp(1)^x
      const base = ser(a0, o);
      // P5 (b), R39: (-8)^(1/3) = -2 in Home, Solve and Function; surd(b,q)^p is the real q-th root to the power p
      const odd = o.realOddRoots === true ? oddRootExponent(a1) : undefined;
      if (odd) {
        const root = `surd(${base.s},${odd.q})`;
        return odd.p === "1" ? { s: root, p: 5 } : { s: `${root}^${odd.p.startsWith("-") ? `(${odd.p})` : odd.p}`, p: 4 };
      }
      const ex = ser(a1, o);
      return { s: `${wrap(base, 5)}^${wrap(ex, 5)}`, p: 4 };
    }
    case "Root": {
      // L6 default: an odd whole-number index gives the real root, so ∛(-8) = -2 (Giac surd); the power form follows
      // only with realOddRoots on (P5 (b), above). Otherwise, or with realOddRoots false, the principal root x^(1/n).
      if (o.realOddRoots !== false && oddIndex(a1)) return call("surd", [a0, a1], o);
      return { s: `${wrap(ser(a0, o), 5)}^(1/${wrap(ser(a1, o), 5)})`, p: 4 };
    }
    case "Log": {
      if (args.length === 1) return call("log10", args, o);
      return { s: `ln(${ser(a0, o).s})/ln(${ser(a1, o).s})`, p: 2 };
    }
    case "Lb":
      return { s: `ln(${ser(a0, o).s})/ln(2)`, p: 2 };
    case "Delimiter": {
      const inner = args.length ? ser(a0, o) : undefined;
      if (!inner) throw parseError("parse.emptyParentheses");
      return { s: `(${inner.s})`, p: 5 };
    }
    case "Sequence":
      return { s: args.map((a) => ser(a, o).s).join(","), p: 0 };
    case "Tuple":
      return { s: `(${args.map((a) => ser(a, o).s).join(",")})`, p: 5 };
    case "List":
      return { s: `[${args.map((a) => ser(a, o).s).join(",")}]`, p: 5 };
    case "Matrix":
      return ser(a0, o);
    case "Complex": {
      const re = ser(a0, o);
      const im = ser(a1, o);
      return { s: `(${re.s}+${wrap(im, 3)}*i)`, p: 5 };
    }
    case "Degrees":
      // degrees in every angle mode (R10): (pi/180)^angle_radian() is pi/180 in radians and 1 in degrees, read when
      // evaluated, so a stored definition stays right after the mode changes
      return { s: `${wrap(ser(a0, o), 3)}*(pi/180)^angle_radian()`, p: 2 };
    case "Subst": // the evaluate-at template (R10): e at x = a
      return { s: `subst(${ser(a0, o).s},${ser(a1, o).s}=${wrap(ser(args[2] as Json, o), 1)})`, p: 5 };
    case "Piecewise": {
      // the piecewise template (R10): piecewise(condition, value, …); an equation as a condition is a test (==)
      const cond = (c: Json): string =>
        isHead(c, "Equal") ? `${wrap(ser(c[1] as Json, o), 1)}==${wrap(ser(c[2] as Json, o), 1)}` : ser(c, o).s;
      const parts = args.flatMap((p) => (isHead(p, "Pair") ? [cond(p[2] as Json), ser(p[1] as Json, o).s] : []));
      return { s: `piecewise(${parts.join(",")})`, p: 5 };
    }
    case "Apply": {
      const f = a0;
      if (isHead(f, "InverseFunction")) {
        const inv = INVERSE[f[1] as string];
        if (inv) return call(inv, args.slice(1), o);
      }
      throw parseError("parse.unsupportedApply", { json: JSON.stringify(e) });
    }
    case "Sum":
    case "Product": {
      const lim = a1;
      if (!isHead(lim, "Tuple")) throw parseError("parse.needsLimits", { head });
      const v = symbolText(lim[1] as Json);
      return {
        s: `${head === "Sum" ? "sum" : "product"}(${ser(lambdaBody(a0, o).body, o).s},${v},${ser(lim[2] as Json, o).s},${ser(lim[3] as Json, o).s})`,
        p: 5,
      };
    }
    case "Integrate": {
      const { body } = lambdaBody(a0, o);
      if (isHead(a1, "Tuple")) {
        const v = symbolText(a1[1] as Json);
        return { s: `integrate(${ser(body, o).s},${v},${ser(a1[2] as Json, o).s},${ser(a1[3] as Json, o).s})`, p: 5 };
      }
      return { s: `integrate(${ser(body, o).s},${ser(a1, o).s})`, p: 5 };
    }
    case "D":
      return { s: `diff(${ser(a0, o).s},${ser(a1, o).s})`, p: 5 };
    case "Limit": {
      const { body, v } = lambdaBody(a0, o);
      const dir = args[2] === undefined ? "" : `,${ser(args[2] as Json, o).s}`;
      return { s: `limit(${ser(body, o).s},${v ?? "x"},${ser(a1, o).s}${dir})`, p: 5 };
    }
    default:
  }
  // P4: polar entry r∡θ. Giac's cos/sin follow the angle mode (angle_radian), so degrees work too.
  if (head === "PolarComplex") {
    const t = ser(a1, o).s;
    return { s: `${wrap(ser(a0, o), 2)}*(cos(${t})+i*sin(${t}))`, p: 2 };
  }
  if (head === "Assign") return { s: `${wrap(ser(a0, o), 1)}:=${wrap(ser(a1, o), 0)}`, p: 0 };
  // R18, the Shift + 6 palette: == tests equality (true/false), unlike = which makes an equation; ≠ is its negation
  // (R18f1: by value, never Giac's structural ==). The logic words bracket every operand that is not an atom, so
  // Giac's precedence never decides
  if (head === "EqualTest" || head === "NotEqual") return equalityTest(ser(a0, o), ser(a1, o), head === "NotEqual");
  if (head in LOGIC) return { s: args.map((a) => wrap(ser(a, o), 5)).join(` ${LOGIC[head] as string} `), p: 0 };
  if (head === "Xor") {
    // not Giac's xor: it gives 0 when an operand is symbolic, so (x>0) xor (x<1) would be a silent wrong answer
    // (true at x = 2); (a or b) and not(a and b) stays an expression until both sides are known (probe 2026-10-14)
    const [a, b] = [wrap(ser(a0, o), 5), wrap(ser(a1, o), 5)];
    return { s: `(${a} or ${b}) and not(${a} and ${b})`, p: 0 };
  }
  if (head === "Not") return call("not", args, o);
  // R18, Shift + 9: x → body, Giac's function arrow
  if (head === "Lambda" && isHead(a0, "Tuple")) {
    const vars = a0.slice(1).map((v) => symbolText(v as Json) ?? "");
    if (vars.some((v) => v === "")) throw parseError("parse.needsVariableNames");
    return { s: `(${vars.join(",")})->${ser(a1, o).s}`, p: 0 };
  }
  if (head in REL) return { s: `${wrap(ser(a0, o), 1)}${REL[head]}${wrap(ser(a1, o), 1)}`, p: 0 };
  if (head in FN) return call(FN[head] as string, args, o);
  throw parseError("parse.unsupportedHead", { head });
}

export function mathJsonToGiac(e: Json, o: SerializeOptions = {}): string {
  return ser(e, o).s;
}

