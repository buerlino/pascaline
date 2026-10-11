// SPDX-License-Identifier: GPL-3.0-or-later
// Hand-written parser for the LaTeX subset MathLive produces from our keyboard (and Giac's latex() style).
// It yields the same MathJSON shapes as Compute Engine's raw parse, so emit.ts serves both parsers.
// Unknown or ambiguous input throws SerializeError instead of guessing.
import { SerializeError, type Json } from "./emit.ts";

type Tok =
  | { t: "num"; v: string }
  | { t: "ch"; v: string }
  | { t: "cmd"; v: string }
  | { t: "open"; v: string }
  | { t: "close"; v: string };

const SPACING = new Set([",", ";", ":", "!", " ", "quad", "qquad", "displaystyle", "textstyle"]);
const OPEN_CMD: Record<string, string> = { lfloor: "floor", lceil: "ceil" };
const CLOSE_CMD: Record<string, string> = { rfloor: "floor", rceil: "ceil" };

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  const n = src.length;
  const isDigit = (c: string | undefined) => c !== undefined && c >= "0" && c <= "9";
  while (i < n) {
    const c = src[i] as string;
    if (c === " " || c === "\n" || c === "\t") {
      i++;
    } else if (c === "\\") {
      let j = i + 1;
      while (j < n && /[A-Za-z]/.test(src[j] as string)) j++;
      const name = j > i + 1 ? src.slice(i + 1, j) : (src[j++] ?? "");
      i = j;
      if (SPACING.has(name)) continue;
      if (name === "left" || name === "right") {
        while (src[i] === " ") i++;
        let d = src[i] ?? "";
        i++;
        if (d === "\\") {
          let k = i;
          while (k < n && /[A-Za-z]/.test(src[k] as string)) k++;
          d = src.slice(i - 1, k);
          i = k;
        }
        if (d === ".") continue;
        out.push({ t: name === "left" ? "open" : "close", v: d });
      } else if (name in OPEN_CMD) out.push({ t: "open", v: OPEN_CMD[name] as string });
      else if (name in CLOSE_CMD) out.push({ t: "close", v: CLOSE_CMD[name] as string });
      else out.push({ t: "cmd", v: name });
    } else if (isDigit(c) || (c === "." && isDigit(src[i + 1]))) {
      let j = i;
      while (isDigit(src[j])) j++;
      while (isDigit(src[j])) j++;
      if (src[j] === "." && isDigit(src[j + 1])) {
        j++;
        while (isDigit(src[j])) j++;
      } else if (src[j] === "." && c !== ".") {
        // "5." alone: treat the dot as part of the number
        j++;
      }
      out.push({ t: "num", v: src.slice(i, j) });
      i = j;
    } else if (c === "(") {
      out.push({ t: "open", v: "(" });
      i++;
    } else if (c === ")") {
      out.push({ t: "close", v: ")" });
      i++;
    } else {
      out.push({ t: "ch", v: c });
      i++;
    }
  }
  return out;
}

const GREEK = new Set([
  "alpha", "beta", "gamma", "delta", "epsilon", "varepsilon", "zeta", "eta", "theta", "vartheta", "iota", "kappa",
  "lambda", "mu", "nu", "xi", "rho", "sigma", "tau", "phi", "varphi", "chi", "psi", "omega",
]);
const CONSTS: Record<string, string> = {
  pi: "Pi", exponentialE: "ExponentialE", imaginaryI: "ImaginaryUnit", infty: "PositiveInfinity",
};
/** LaTeX function command -> MathJSON head. */
const FUNCS: Record<string, string> = {
  sin: "Sin", cos: "Cos", tan: "Tan", cot: "Cot", sec: "Sec", csc: "Csc",
  arcsin: "Arcsin", arccos: "Arccos", arctan: "Arctan",
  sinh: "Sinh", cosh: "Cosh", tanh: "Tanh",
  ln: "Ln", log: "Log", lg: "Lg", exp: "Exp", det: "Determinant",
  gcd: "Gcd", lcm: "Lcm", max: "Max", min: "Min", arg: "Arg", Re: "Re", Im: "Im",
};
const INVERSE: Record<string, string> = {
  Sin: "Arcsin", Cos: "Arccos", Tan: "Arctan", Sinh: "Arsinh", Cosh: "Arcosh", Tanh: "Artanh",
};
const RELATION: Record<string, string> = {
  "=": "Equal", "<": "Less", ">": "Greater",
  ne: "NotEqual", neq: "NotEqual", le: "LessEqual", leq: "LessEqual", ge: "GreaterEqual", geq: "GreaterEqual",
};
/** Names that become function calls when followed by parentheses (single letters need to be listed). */
const NAMED_FUNCS = new Set(["abs", "sqrt", "floor", "ceil", "round", "sign", "gcd", "lcm", "max", "min", "det", "mod"]);
const ABS_LIKE: Record<string, string> = { abs: "Abs", sign: "Sign", floor: "Floor", ceil: "Ceil", round: "Round" };
const FACTOR_CMDS = new Set([
  "frac", "dfrac", "tfrac", "sqrt", "binom", "overline", "int", "sum", "prod", "lim", "begin",
  "operatorname", "mathrm", "mathit",
]);

export interface ParseOptions {
  /** Single letters that name functions when followed by parentheses. Default f, g, h. */
  userFunctions?: ReadonlySet<string>;
}

class Parser {
  private pos = 0;
  private noDiff = 0;
  private readonly user: ReadonlySet<string>;
  private toks: Tok[];
  constructor(toks: Tok[], o: ParseOptions) {
    this.toks = toks;
    this.user = o.userFunctions ?? new Set(["f", "g", "h"]);
  }

  private peek(k = 0): Tok | undefined {
    return this.toks[this.pos + k];
  }
  private fail(msg: string): never {
    const t = this.peek();
    throw new SerializeError(`${msg}${t ? ` at '${t.v}'` : " at end of input"}`);
  }
  private isCh(v: string, k = 0): boolean {
    const t = this.peek(k);
    return t?.t === "ch" && t.v === v;
  }
  private isCmd(v: string, k = 0): boolean {
    const t = this.peek(k);
    return t?.t === "cmd" && t.v === v;
  }
  private expectCh(v: string): void {
    if (!this.isCh(v)) this.fail(`expected '${v}'`);
    this.pos++;
  }
  private expectClose(kind: string): void {
    const t = this.peek();
    if (t?.t !== "close" || t.v !== kind) this.fail(`expected closing ${kind}`);
    this.pos++;
  }

  parseAll(): Json {
    if (this.toks.length === 0) throw new SerializeError("empty input");
    const e = this.relation();
    if (this.pos < this.toks.length) this.fail("unexpected token");
    return e;
  }

  // ---- levels ----
  private relation(): Json {
    const left = this.additive();
    const t = this.peek();
    if (t && (t.t === "ch" || t.t === "cmd") && t.v in RELATION) {
      this.pos++;
      return [RELATION[t.v] as string, left, this.additive()];
    }
    return left;
  }

  private additive(): Json {
    let acc = this.term();
    for (;;) {
      if (this.isCh("+")) {
        this.pos++;
        acc = ["Add", acc, this.term()];
      } else if (this.isCh("-")) {
        this.pos++;
        acc = ["Subtract", acc, this.term()];
      } else return acc;
    }
  }

  private term(): Json {
    if (this.isCh("-")) {
      this.pos++;
      return ["Negate", this.term()];
    }
    if (this.isCh("+")) {
      this.pos++;
      return this.term();
    }
    let left = this.implicit();
    for (;;) {
      if (this.isCmd("times") || this.isCmd("cdot") || this.isCh("*")) {
        this.pos++;
        left = ["Multiply", left, this.signedImplicit()];
      } else if (this.isCmd("div") || this.isCh("/")) {
        this.pos++;
        left = ["Divide", left, this.signedImplicit()];
      } else if (this.isCmd("bmod")) {
        this.pos++;
        left = ["Mod", left, this.implicit()];
      } else return left;
    }
  }

  private signedImplicit(): Json {
    if (this.isCh("-")) {
      this.pos++;
      return ["Negate", this.signedImplicit()];
    }
    return this.implicit();
  }

  /** Differential marker (d x or \mathrm{d}x) at the current position: tokens it spans, else 0. */
  private diffLen(): number {
    if (this.isCh("d") && this.peek(1)?.t === "ch" && /[A-Za-z]/.test((this.peek(1) as Tok).v)) return 1;
    if (this.isCmd("mathrm") && this.isCh("{", 1) && this.isCh("d", 2) && this.isCh("}", 3)) {
      return this.peek(4)?.t === "ch" ? 4 : 0;
    }
    return 0;
  }

  private startsFactor(): boolean {
    const t = this.peek();
    if (!t) return false;
    switch (t.t) {
      case "num":
      case "open":
        return true;
      case "ch":
        if (t.v === "{") return true;
        if (!/^[A-Za-z]$/.test(t.v)) return false;
        return !(this.noDiff > 0 && this.diffLen() > 0);
      case "cmd":
        if (t.v === "mathrm" && this.noDiff > 0 && this.diffLen() > 0) return false;
        return FACTOR_CMDS.has(t.v) || t.v in FUNCS || t.v in CONSTS || GREEK.has(t.v);
      default:
        return false;
    }
  }

  private implicit(): Json {
    const parts: Json[] = [this.postfix()];
    while (this.startsFactor()) parts.push(this.postfix());
    return parts.length === 1 ? (parts[0] as Json) : ["Multiply", ...parts];
  }

  private postfix(): Json {
    let base = this.atom();
    for (;;) {
      if (this.isCh("^")) {
        this.pos++;
        if (this.isCmd("circ") || (this.isCh("{") && this.isCmd("circ", 1) && this.isCh("}", 2))) {
          this.pos += this.isCmd("circ") ? 1 : 3;
          base = ["Degrees", base];
        } else {
          base = ["Power", base, this.script()];
          if (this.isCh("^")) this.fail("ambiguous double superscript, use braces");
        }
      } else if (this.isCh("!")) {
        this.pos++;
        base = ["Factorial", base];
      } else if (this.isCmd("%")) {
        this.pos++;
        base = ["Divide", base, { num: "100" }];
      } else return base;
    }
  }

  // ---- arguments ----
  /** `{...}` group, or one short token (one digit / letter / command) as in \frac12, x^2, \sqrt9. */
  private arg(): Json {
    if (this.isCh("{")) {
      this.pos++;
      const e = this.relation();
      this.expectCh("}");
      return e;
    }
    const t = this.peek();
    if (t?.t === "num") {
      const d = t.v.slice(0, 1);
      if (t.v.length > 1) this.toks[this.pos] = { t: "num", v: t.v.slice(1) };
      else this.pos++;
      return { num: d };
    }
    return this.atom();
  }
  private script(): Json {
    return this.arg();
  }

  private groupText(): string {
    this.expectCh("{");
    let s = "";
    while (!this.isCh("}")) {
      const t = this.peek();
      if (!t) this.fail("unterminated group");
      s += (t as Tok).v;
      this.pos++;
    }
    this.pos++;
    return s;
  }

  private list(close: string): Json[] {
    const items: Json[] = [this.relation()];
    while (this.isCh(",")) {
      this.pos++;
      items.push(this.relation());
    }
    this.expectClose(close);
    return items;
  }

  // ---- atoms ----
  private atom(): Json {
    const t = this.peek();
    if (!t) this.fail("unexpected end of input");
    const tok = t as Tok;
    switch (tok.t) {
      case "num":
        this.pos++;
        return { num: tok.v.replace(/^0+(?=\d)/, "") };
      case "open": {
        this.pos++;
        if (tok.v === "(") {
          const items = this.list(")");
          return items.length === 1 ? ["Delimiter", items[0] as Json] : ["Tuple", ...items];
        }
        if (tok.v === "|") {
          const e = this.relation();
          this.expectClose("|");
          return ["Abs", e];
        }
        if (tok.v === "floor" || tok.v === "ceil") {
          const e = this.relation();
          this.expectClose(tok.v);
          return [tok.v === "floor" ? "Floor" : "Ceil", e];
        }
        throw new SerializeError(`unsupported delimiter ${tok.v}`);
      }
      case "close":
        return this.fail("unexpected closing delimiter");
      case "ch": {
        if (tok.v === "{") return this.arg();
        if (/^[A-Za-z]$/.test(tok.v)) return this.symbol(tok.v);
        return this.fail("unexpected token");
      }
      case "cmd":
        return this.command(tok.v);
    }
  }

  private symbol(letter: string): Json {
    this.pos++;
    let name = letter;
    if (this.isCh("_")) {
      this.pos++;
      const sub = this.isCh("{") ? this.groupText() : this.shortText();
      if (!/^[A-Za-z0-9]+$/.test(sub)) throw new SerializeError(`unsupported subscript ${sub}`);
      name = `${letter}_${sub}`;
    }
    if (this.peek()?.t === "open" && (this.peek() as Tok).v === "(" && this.user.has(letter) && name === letter) {
      this.pos++;
      return ["Call", name, ...this.list(")")];
    }
    return name;
  }
  private shortText(): string {
    const t = this.peek();
    if (!t || (t.t !== "num" && t.t !== "ch")) this.fail("expected subscript");
    const tok = t as Tok;
    const s = tok.v.slice(0, 1);
    if (tok.t === "num" && tok.v.length > 1) this.toks[this.pos] = { t: "num", v: tok.v.slice(1) };
    else this.pos++;
    return s;
  }

  private command(name: string): Json {
    if (name in CONSTS) {
      this.pos++;
      return CONSTS[name] as string;
    }
    if (GREEK.has(name)) {
      this.pos++;
      return name;
    }
    if (name in FUNCS) return this.func(name);
    switch (name) {
      case "frac":
      case "dfrac":
      case "tfrac": {
        const d = this.tryDerivative();
        if (d) return d;
        this.pos++;
        const a = this.arg();
        const b = this.arg();
        return ["Divide", a, b];
      }
      case "sqrt": {
        this.pos++;
        if (this.isCh("[")) {
          this.pos++;
          const n = this.relation();
          this.expectCh("]");
          return ["Root", this.arg(), n];
        }
        return ["Sqrt", this.arg()];
      }
      case "binom": {
        this.pos++;
        const a = this.arg();
        return ["Binomial", a, this.arg()];
      }
      case "overline":
        this.pos++;
        return ["Conjugate", this.arg()];
      case "int":
        return this.integral();
      case "sum":
      case "prod":
        return this.bigOp(name === "sum" ? "Sum" : "Product");
      case "lim":
        return this.limit();
      case "begin":
        return this.matrix();
      case "operatorname":
      case "mathrm":
      case "mathit": {
        this.pos++;
        const text = this.groupText();
        if (name === "mathrm" && text === "e") return "ExponentialE";
        if (name === "mathrm" && text === "i") return "ImaginaryUnit";
        if (text in ABS_LIKE || NAMED_FUNCS.has(text) || text.length > 1) {
          if (this.peek()?.t === "open" && (this.peek() as Tok).v === "(") {
            this.pos++;
            const args = this.list(")");
            const head = ABS_LIKE[text];
            return head ? [head, ...args] : ["Call", text, ...args];
          }
        }
        throw new SerializeError(`unsupported name \\${name}{${text}} (units are not supported yet)`);
      }
      default:
        throw new SerializeError(`unsupported command \\${name}`);
    }
  }

  private func(name: string): Json {
    this.pos++;
    const head = FUNCS[name] as string;
    let power: Json | undefined;
    let inverse = false;
    let base: Json | undefined;
    for (;;) {
      if (this.isCh("^") && power === undefined && !inverse) {
        this.pos++;
        const e = this.script();
        if (Array.isArray(e) && e[0] === "Negate" && typeof e[1] === "object" && !Array.isArray(e[1]) && "num" in e[1] && e[1].num === "1" && head in INVERSE) inverse = true;
        else power = e;
      } else if (this.isCh("_") && head === "Log" && base === undefined) {
        this.pos++;
        base = this.arg();
      } else break;
    }
    const callHead = inverse ? (INVERSE[head] as string) : head;
    let args: Json[];
    if (this.peek()?.t === "open" && (this.peek() as Tok).v === "(") {
      this.pos++;
      args = this.list(")");
    } else {
      // no parentheses: \sin x, \sin 2x, \ln x; stops before the next function
      const parts: Json[] = [];
      if (!this.startsFactor()) this.fail(`\\${name} needs an argument`);
      parts.push(this.postfix());
      while (this.startsFactor() && !(this.peek() as Tok).v.startsWith("\\") && !((this.peek() as Tok).t === "cmd" && (this.peek() as Tok).v in FUNCS)) {
        parts.push(this.postfix());
      }
      args = [parts.length === 1 ? (parts[0] as Json) : ["Multiply", ...parts]];
    }
    if (base !== undefined) args.push(base);
    const call: Json = [callHead, ...args];
    return power === undefined ? call : ["Power", call, power];
  }

  /** \frac{d}{dx} f, \frac{d^2}{dx^2} f, with d or \mathrm{d}. Returns undefined (position restored) if not a derivative. */
  private tryDerivative(): Json | undefined {
    const save = this.pos;
    const saveToks = this.toks.slice();
    const restore = (): undefined => {
      this.pos = save;
      this.toks = saveToks;
      return undefined;
    };
    this.pos++; // \frac
    const dsym = (): boolean => {
      if (this.isCh("d")) {
        this.pos++;
        return true;
      }
      if (this.isCmd("mathrm") && this.isCh("{", 1) && this.isCh("d", 2) && this.isCh("}", 3)) {
        this.pos += 4;
        return true;
      }
      return false;
    };
    const order = (): number => {
      if (!this.isCh("^")) return 1;
      this.pos++;
      const t = this.peek();
      if (this.isCh("{") && this.peek(1)?.t === "num" && this.isCh("}", 2)) {
        const v = Number((this.peek(1) as Tok).v);
        this.pos += 3;
        return v;
      }
      if (t?.t === "num" && t.v.length === 1) {
        this.pos++;
        return Number(t.v);
      }
      return NaN;
    };
    if (!this.isCh("{")) return restore();
    this.pos++;
    if (!dsym()) return restore();
    const n1 = order();
    if (!this.isCh("}")) return restore();
    this.pos++;
    if (!this.isCh("{")) return restore();
    this.pos++;
    if (!dsym()) return restore();
    const v = this.peek();
    if (v?.t !== "ch" || !/^[A-Za-z]$/.test(v.v)) return restore();
    this.pos++;
    const n2 = order();
    if (!this.isCh("}") || !(n1 >= 1) || n1 !== n2) return restore();
    this.pos++;
    let body = this.implicit();
    for (let i = 0; i < n1; i++) body = ["D", body, v.v];
    return body;
  }

  private integral(): Json {
    this.pos++;
    let lo: Json | undefined;
    let hi: Json | undefined;
    while (this.isCh("_") || this.isCh("^")) {
      const which = (this.peek() as Tok).v;
      this.pos++;
      const e = this.script();
      if (which === "_") lo = e;
      else hi = e;
    }
    this.noDiff++;
    const body = this.additive();
    this.noDiff--;
    const len = this.diffLen();
    if (len === 0) this.fail("integral needs dx");
    this.pos += len; // the d marker; the variable follows
    const v = (this.peek() as Tok).v;
    this.pos++;
    if (lo === undefined && hi === undefined) return ["Integrate", body, v];
    if (lo === undefined || hi === undefined) throw new SerializeError("integral needs both limits");
    return ["Integrate", body, ["Tuple", v, lo, hi]];
  }

  private bigOp(head: "Sum" | "Product"): Json {
    this.pos++;
    this.expectCh("_");
    this.expectCh("{");
    const v = this.peek();
    if (v?.t !== "ch" || !/^[A-Za-z]$/.test(v.v)) this.fail("expected index variable");
    this.pos++;
    this.expectCh("=");
    const lo = this.additive();
    this.expectCh("}");
    this.expectCh("^");
    const hi = this.script();
    const body = this.term();
    return [head, body, ["Tuple", (v as Tok).v, lo, hi]];
  }

  private limit(): Json {
    this.pos++;
    this.expectCh("_");
    this.expectCh("{");
    const v = this.peek();
    if (v?.t !== "ch" || !/^[A-Za-z]$/.test(v.v)) this.fail("expected limit variable");
    this.pos++;
    if (!this.isCmd("to")) this.fail("expected \\to");
    this.pos++;
    const start = this.pos;
    let depth = 0;
    while (this.peek() && !(depth === 0 && this.isCh("}"))) {
      if (this.isCh("{")) depth++;
      if (this.isCh("}")) depth--;
      this.pos++;
    }
    let target = this.toks.slice(start, this.pos);
    this.pos++; // }
    let dir: Json | undefined;
    const sign = (tk: Tok | undefined): string | undefined => (tk?.t === "ch" && (tk.v === "+" || tk.v === "-") ? tk.v : undefined);
    const n = target.length;
    if (n >= 3 && target[n - 2]?.t === "ch" && (target[n - 2] as Tok).v === "^" && sign(target[n - 1])) {
      dir = { num: sign(target[n - 1]) === "+" ? "1" : "-1" };
      target = target.slice(0, n - 2);
    } else if (n >= 5 && (target[n - 4] as Tok).v === "^" && (target[n - 3] as Tok).v === "{" && sign(target[n - 2]) && (target[n - 1] as Tok).v === "}") {
      dir = { num: sign(target[n - 2]) === "+" ? "1" : "-1" };
      target = target.slice(0, n - 4);
    }
    const a = new Parser(target, { userFunctions: this.user }).parseAll();
    const body = this.term();
    const out: Json[] = ["Limit", ["Function", body, v.v], a];
    if (dir !== undefined) out.push(dir);
    return out;
  }

  private matrix(): Json {
    this.pos++;
    const env = this.groupText();
    if (!["pmatrix", "bmatrix", "matrix"].includes(env)) throw new SerializeError(`unsupported environment ${env}`);
    const rows: Json[] = [];
    let row: Json[] = [];
    for (;;) {
      row.push(this.relation());
      if (this.isCh("&")) {
        this.pos++;
      } else if (this.isCmd("\\")) {
        this.pos++;
        rows.push(["List", ...row]);
        row = [];
      } else break;
    }
    rows.push(["List", ...row]);
    if (!this.isCmd("end")) this.fail("expected \\end");
    this.pos++;
    if (this.groupText() !== env) throw new SerializeError("mismatched \\end");
    return ["Matrix", ["List", ...rows]];
  }
}

export function parseLatex(latex: string, o: ParseOptions = {}): Json {
  return new Parser(tokenize(latex), o).parseAll();
}
