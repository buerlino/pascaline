// SPDX-License-Identifier: GPL-3.0-or-later
// MathJSON (Compute Engine's shape, also produced by our own parser) -> Giac input string.
export type Json = number | string | { num: string } | { sym: string } | { str: string } | Json[];

export class SerializeError extends Error {}

export interface SerializeOptions {
  /** Single-letter names treated as functions when followed by (...), e.g. f(x). Others multiply. */
  userFunctions?: ReadonlySet<string>;
  /** L6 setting (default on; the reference gives -2 for (-8)^(1/3), G2 items 4/11, but our power form stays complex, P5(b)): an n-th root with odd whole n is the real root (∛(-8) = -2). */
  realOddRoots?: boolean;
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
  Determinant: "det", Transpose: "tran", Inverse: "inv", Gamma: "Gamma", Mod: "irem", Rem: "irem",
};
const INVERSE: Record<string, string> = {
  Sin: "asin", Cos: "acos", Tan: "atan", Sinh: "asinh", Cosh: "acosh", Tanh: "atanh",
};
const CONST: Record<string, string> = {
  Pi: "pi", ExponentialE: "exp(1)", ImaginaryUnit: "i", e: "exp(1)",
  PositiveInfinity: "inf", NegativeInfinity: "(-inf)", ComplexInfinity: "infinity",
};
const REL: Record<string, string> = {
  Equal: "=", NotEqual: "!=", Less: "<", LessEqual: "<=", Greater: ">", GreaterEqual: ">=",
};

type Prec = 0 | 1 | 2 | 3 | 4 | 5; // 0 relation, 1 add, 2 mul, 3 unary minus, 4 power, 5 atom
interface Out { s: string; p: Prec }
const wrap = (o: Out, min: Prec): string => (o.p < min ? `(${o.s})` : o.s);

function isHead(e: Json, h: string): e is Json[] {
  return Array.isArray(e) && e[0] === h;
}

function numberText(e: Json): string | undefined {
  if (typeof e === "number") {
    if (!Number.isFinite(e)) throw new SerializeError("non-finite number");
    return String(e).replace("e+", "e");
  }
  if (typeof e === "object" && !Array.isArray(e) && "num" in e) {
    const n = e.num.replace(/[\s_]/g, "");
    if (/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(n) || /^[+-]?(Infinity|NaN)$/.test(n)) return n;
    throw new SerializeError(`unsupported number literal ${e.num}`);
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

function call(name: string, args: Json[], o: SerializeOptions): Out {
  return { s: `${name}(${args.map((a) => ser(a, o).s).join(",")})`, p: 5 };
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
    if (sym === "Nothing") throw new SerializeError("empty input");
    if (sym in CONST) return { s: CONST[sym] as string, p: 5 };
    return { s: sym, p: 5 };
  }
  if (!Array.isArray(e)) throw new SerializeError(`unsupported node ${JSON.stringify(e)}`);
  const head = e[0] as string;
  const args = e.slice(1) as Json[];
  const a0 = args[0] as Json;
  const a1 = args[1] as Json;
  switch (head) {
    case "Chip": // our own parser: a chip's value, already Giac text in brackets (input/chips.ts)
      if (typeof a0 === "object" && a0 !== null && !Array.isArray(a0) && "str" in a0) return { s: a0.str, p: 5 };
      throw new SerializeError("bad chip");
    case "Call": // our own parser: ["Call", name, ...args]
      return call(a0 as string, args.slice(1), o);
    case "Error":
      throw new SerializeError(`parse error ${JSON.stringify(e)}`);
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
      const ex = ser(a1, o);
      return { s: `${wrap(base, 5)}^${wrap(ex, 5)}`, p: 4 };
    }
    case "Root": {
      // L6 default (root template only; our power form stays complex, P5(b)): an odd whole-number index gives the real root, so ∛(-8) = -2
      // (Giac surd). Otherwise, or with realOddRoots off, the principal root x^(1/n).
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
      if (!inner) throw new SerializeError("empty parentheses");
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
      return { s: `${wrap(ser(a0, o), 3)}*pi/180`, p: 2 };
    case "Apply": {
      const f = a0;
      if (isHead(f, "InverseFunction")) {
        const inv = INVERSE[f[1] as string];
        if (inv) return call(inv, args.slice(1), o);
      }
      throw new SerializeError(`unsupported Apply ${JSON.stringify(e)}`);
    }
    case "Sum":
    case "Product": {
      const lim = a1;
      if (!isHead(lim, "Tuple")) throw new SerializeError(`${head} needs limits`);
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
  if (head in REL) return { s: `${wrap(ser(a0, o), 1)}${REL[head]}${wrap(ser(a1, o), 1)}`, p: 0 };
  if (head in FN) return call(FN[head] as string, args, o);
  throw new SerializeError(`unsupported head ${head}`);
}

export function mathJsonToGiac(e: Json, o: SerializeOptions = {}): string {
  return ser(e, o).s;
}

