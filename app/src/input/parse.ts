// SPDX-License-Identifier: GPL-3.0-or-later
// Hand-written parser for the LaTeX subset MathLive produces from our keyboard (and Giac's latex() style).
// It yields the same MathJSON shapes as Compute Engine's raw parse, so emit.ts serves both parsers.
// Unknown or ambiguous input throws SerializeError instead of guessing.
import { ANS_KEY, constKey, resKey, type ChipTable } from "./chips.ts";
import { chipToGiac } from "./chip-giac.ts";
import { SerializeError, type Json } from "./emit.ts";

type Tok =
  | { t: "num"; v: string }
  | { t: "ch"; v: string }
  | { t: "cmd"; v: string }
  | { t: "open"; v: string }
  | { t: "close"; v: string };

const SPACING = new Set([",", ";", ":", "!", " ", "quad", "qquad", "displaystyle", "textstyle"]);
const OPEN_CMD: Record<string, string> = { lfloor: "floor", lceil: "ceil", lbrace: "{", "{": "{" };
const CLOSE_CMD: Record<string, string> = { rfloor: "floor", rceil: "ceil", rbrace: "}", "}": "}" };

/** Token for a literal caret (one-line mode): power of the next factor, not a TeX superscript. */
const CARET = "^caret";
/** The exponent mark (R14): the key's `\emark` macro, or the bare character U+1D07 the reference draws. */
const EMARK = "emark";

/** decimalComma (L6): "3,5" and MathLive's "3{,}5" are the number 3.5; use ";" between arguments then. */
function tokenize(src: string, decimalComma = false): Tok[] {
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
      if (name === "mathbin") {
        // P4: the polar sign is entered as \mathbin{\measuredangle} so that a following ÷ does not absorb it into the numerator
        const m = /^\{\s*\\measuredangle\s*\}/.exec(src.slice(i));
        if (m) {
          i += m[0].length;
          out.push({ t: "cmd", v: "measuredangle" });
          continue;
        }
      }
      if (name === "char") {
        // L4: the literal caret of the one-line entry mode, \char"5E (MathLive serialises it with a trailing space)
        const m = /^(?:"5E|"5e|94)\b ?/.exec(src.slice(i));
        if (!m) {
          out.push({ t: "cmd", v: "char" });
          continue;
        }
        i += m[0].length;
        out.push({ t: "cmd", v: CARET });
        continue;
      }
      if (name === "left" || name === "right") {
        while (src[i] === " ") i++;
        let d = src[i] ?? "";
        i++;
        if (d === "\\" && (src[i] === "{" || src[i] === "}")) {
          // \left\{ ... \right\}: braces (a list, L6)
          d = src[i++] as string;
        } else if (d === "\\") {
          let k = i;
          while (k < n && /[A-Za-z]/.test(src[k] as string)) k++;
          d = src.slice(i - 1, k);
          i = k;
        }
        // \left. … \right| is the evaluate-at bar (Tmpl, R10); a lone \left. or \right. still has to pair up
        out.push({ t: name === "left" ? "open" : "close", v: d });
      } else if (name in OPEN_CMD) out.push({ t: "open", v: OPEN_CMD[name] as string });
      else if (name in CLOSE_CMD) out.push({ t: "close", v: CLOSE_CMD[name] as string });
      else out.push({ t: "cmd", v: name });
    } else if (isDigit(c) || (c === "." && isDigit(src[i + 1]))) {
      let j = i;
      while (isDigit(src[j])) j++;
      while (isDigit(src[j])) j++;
      const comma = !decimalComma ? 0 : src[j] === "," ? 1 : src.startsWith("{,}", j) ? 3 : 0;
      if (src[j] === "." && isDigit(src[j + 1])) {
        j++;
        while (isDigit(src[j])) j++;
      } else if (comma && isDigit(src[j + comma])) {
        const intPart = src.slice(i, j);
        j += comma;
        const k = j;
        while (isDigit(src[j])) j++;
        out.push({ t: "num", v: `${intPart}.${src.slice(k, j)}` });
        i = j;
        continue;
      } else if (src[j] === "." && c !== ".") {
        // "5." alone: treat the dot as part of the number
        j++;
      }
      out.push({ t: "num", v: src.slice(i, j) });
      i = j;
    } else if (c === "\u1D07") {
      out.push({ t: "cmd", v: EMARK });
      i++;
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
  "operatorname", "mathrm", "mathit", "res", "ans", "const",
]);

export interface ParseOptions {
  /** Single letters that name functions when followed by parentheses. Default f, g, h. */
  userFunctions?: ReadonlySet<string>;
  /** L6 setting: the decimal separator is a comma; arguments are then separated by ";". */
  decimalComma?: boolean;
  /** The entry's chip table: the values of its \res, \ans and \const chips (input/chips.ts). */
  chips?: ChipTable;
}

/** What the parser found besides the expression. */
export interface ParseInfo {
  json: Json;
  /** A chip whose value is not exact was used, so the result cannot be marked "=" (docs/04 2.4). */
  inexact: boolean;
}

/** Letters that start a base prefix after a lone 0 (0x, 0b, 0o), and what may follow them. */
const BASE_PREFIX: Record<string, RegExp> = { x: /^[0-9A-Fa-f]/, b: /^[0-9]/, o: /^[0-9]/ };

class Parser {
  private pos = 0;
  private noDiff = 0;
  private user: ReadonlySet<string>;
  private toks: Tok[];
  private readonly chips: ChipTable;
  /** Set when a chip with an inexact value is used. */
  inexact = false;
  constructor(toks: Tok[], o: ParseOptions) {
    this.toks = toks;
    this.user = o.userFunctions ?? new Set(["f", "g", "h"]);
    this.chips = o.chips ?? {};
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

  /** L6: `p(x):=...` (one letter, parentheses, then :=) defines a function p, whatever the letter. */
  private definitionName(): string | undefined {
    const a = this.peek();
    const b = this.peek(1);
    if (!a || a.t !== "ch" || !/^[A-Za-z]$/.test(a.v) || !b || b.t !== "open" || b.v !== "(") return undefined;
    let depth = 0;
    for (let k = this.pos + 1; k < this.toks.length; k++) {
      const t = this.toks[k] as Tok;
      if (t.t === "open") depth++;
      else if (t.t === "close" && --depth === 0) {
        const c1 = this.toks[k + 1];
        const c2 = this.toks[k + 2];
        return c1?.t === "ch" && c1.v === ":" && c2?.t === "ch" && c2.v === "=" ? a.v : undefined;
      }
    }
    return undefined;
  }

  // ---- levels ----
  private relation(): Json {
    const def = this.definitionName();
    if (def) this.user = new Set([...this.user, def]);
    let left = this.additive();
    // P4: polar entry r∡θ (shift ×), the angle in the current angle mode.
    if (this.isCmd("measuredangle")) {
      this.pos++;
      left = ["PolarComplex", left, this.additive()];
    }
    // P4: store, value ▶ name (shift of the exponent key); the same as name := value.
    if (this.isCmd("blacktriangleright")) {
      this.pos++;
      const name = this.additive();
      if (typeof name !== "string") this.fail("expected a name after ▶");
      return ["Assign", name, left];
    }
    if (this.isCh(":") && this.isCh("=", 1)) {
      this.pos += 2;
      return ["Assign", left, this.relation()];
    }
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
        // the exponent mark after something that is not a number: atom() refuses it with a message
        return FACTOR_CMDS.has(t.v) || t.v in FUNCS || t.v in CONSTS || GREEK.has(t.v) || t.v === EMARK;
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
          base = this.dms(base);
        } else {
          base = ["Power", base, this.script()];
          if (this.isCh("^")) this.fail("ambiguous double superscript, use braces");
        }
      } else if (this.isCmd(CARET)) {
        // a^b typed literally: the exponent is the next signed factor (2^34 = 2^(34); 2^-1; right-associative)
        this.pos++;
        if (this.isCh("-")) {
          this.pos++;
          base = ["Power", base, ["Negate", this.postfix()]];
        } else base = ["Power", base, this.postfix()];
      } else if (this.isCmd("degree")) {
        this.pos++;
        base = this.dms(base);
      } else if (this.isCh("!")) {
        this.pos++;
        base = ["Factorial", base];
      } else if (this.isCmd("%")) {
        this.pos++;
        base = ["Divide", base, { num: "100" }];
      } else return base;
    }
  }

  /**
   * After a degree sign: the minutes and seconds of the DMS template (Tmpl, R10), `30\degree15\prime36\doubleprime`
   * = 30 + 15/60 + 36/3600 degrees. A prime anywhere else is not ours and stays an error.
   */
  private dms(deg: Json): Json {
    const parts: Json[] = [deg];
    for (const [mark, per] of [["prime", "60"], ["doubleprime", "3600"]] as const) {
      const t = this.peek();
      if (t?.t === "num" && this.isCmd(mark, 1)) {
        this.pos += 2;
        parts.push(["Divide", { num: t.v }, { num: per }]);
      }
    }
    return ["Degrees", parts.length === 1 ? deg : ["Add", ...parts]];
  }

  /** `\left. e \right|_{x=a}`: e evaluated at x = a (the evaluate-at template, R10). The `\left.` is consumed. */
  private evaluateAt(): Json {
    const e = this.relation();
    const t = this.peek();
    if (t?.t === "close" && t.v === ".") {
      this.pos++;
      return ["Delimiter", e];
    }
    if (t?.t !== "close" || t.v !== "|" || !this.isCh("_", 1)) this.fail("expected the evaluate-at bar |");
    this.pos += 2;
    const at = this.arg();
    if (!Array.isArray(at) || at[0] !== "Equal" || typeof at[1] !== "string")
      throw new SerializeError("evaluate at: write variable = value under the bar");
    return ["Subst", e, at[1], at[2] as Json];
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
    while (this.isCh(",") || this.isCh(";")) {
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
      case "num": {
        this.basePrefix(tok);
        this.pos++;
        if (this.isCmd(EMARK)) return this.eNumber(tok.v);
        const num = { num: tok.v.replace(/^0+(?=\d)/, "") };
        // a whole number directly before \tfrac is a mixed number (the Tmpl mixed-number template, R10): 2\tfrac12 = 2+1/2
        if (/^\d+$/.test(tok.v) && this.isCmd("tfrac")) {
          this.pos++;
          const a = this.arg();
          const b = this.arg();
          return ["Delimiter", ["Add", num, ["Divide", a, b]]];
        }
        return num;
      }
      case "open": {
        this.pos++;
        if (tok.v === "(") {
          const items = this.list(")");
          return items.length === 1 ? ["Delimiter", items[0] as Json] : ["Tuple", ...items];
        }
        if (tok.v === ".") return this.evaluateAt();
        if (tok.v === "|") {
          const e = this.relation();
          this.expectClose("|");
          return ["Abs", e];
        }
        if (tok.v === "{") {
          // L6: braces make a list, as the reference keyboard's { } key does (Giac input has no other use for them here)
          if (this.peek()?.t === "close" && (this.peek() as Tok).v === "}") {
            this.pos++;
            return ["List"];
          }
          return ["List", ...this.list("}")];
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

  /**
   * R14: `1.5ᴇ-3` is one number, 1.5·10⁻³, read exactly as the old `×10^` template was (a literal with an exponent,
   * which the exact-first evaluation turns into 3/2000). The exponent is a whole number with an optional sign; anything
   * else is an error that says so, never a guess. The mark has just been seen after the mantissa `mant`.
   */
  private eNumber(mant: string): Json {
    this.pos++; // the mark
    let sign = "";
    if (this.isCh("-") || this.isCh("+")) {
      sign = (this.peek() as Tok).v === "-" ? "-" : "";
      this.pos++;
    }
    const t = this.peek();
    if (t?.t !== "num") throw new SerializeError("ᴇ needs a whole-number exponent after it (1.5ᴇ-3)");
    if (!/^\d+$/.test(t.v)) throw new SerializeError(`the exponent after ᴇ must be a whole number, not ${t.v}`);
    this.pos++;
    if (this.isCmd(EMARK)) throw new SerializeError("a number has one ᴇ exponent");
    // x², xʸ after the number put it in brackets; a bare power here would read as 1.5ᴇ3² = 1.5·10⁹ to some, (1.5ᴇ3)² to others
    if (this.isCh("^") || this.isCmd(CARET)) throw new SerializeError("put the ᴇ number in brackets before raising it to a power");
    const m = mant.replace(/^0+(?=\d)/, "").replace(/\.$/, "").replace(/^\./, "0.");
    const e = t.v.replace(/^0+(?=\d)/, "");
    return { num: `${m}e${sign}${e}` };
  }

  /**
   * docs/04 2.3 #1: a lone 0 followed by x, b or o and a digit (0xFF, 0b101, 0o17) is a number in another base,
   * which the keys type as 0·x·F·F = 0 today. Refuse it with a message until EN6 (milestone 6) reads it.
   */
  private basePrefix(tok: Tok): void {
    if (tok.v !== "0") return;
    const p = this.peek(1);
    const q = this.peek(2);
    const after = p?.t === "ch" ? BASE_PREFIX[p.v] : undefined;
    if (!after || !q || (q.t !== "num" && q.t !== "ch") || !after.test(q.v)) return;
    throw new SerializeError(`0${(p as Tok).v}… numbers in other bases are not supported yet: type the value in decimal`);
  }

  /** The value of a chip from the table, as one factor; a missing chip is an error, never a guess. */
  private chip(key: string, what: string): Json {
    const c = this.chips[key];
    if (!c) throw new SerializeError(key === ANS_KEY ? "Ans: no result to use in this view yet" : `${what}: its value is missing`);
    if (!c.exact) this.inexact = true;
    return ["Chip", { str: chipToGiac(c.value) }];
  }

  /** Skip one {…} group (a chip's display argument), braces balanced. */
  private skipGroup(): void {
    this.expectCh("{");
    for (let depth = 1; depth > 0; this.pos++) {
      const t = this.peek();
      if (!t) this.fail("unterminated group");
      if (t?.t === "ch" && t.v === "{") depth++;
      else if (t?.t === "ch" && t.v === "}") depth--;
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
    if (name === EMARK) throw new SerializeError("type the number before ᴇ (1.5ᴇ-3)");
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
      case "res": {
        // \res{k}{shown}: a history result (docs/04 2.8)
        this.pos++;
        const k = this.groupText();
        if (!/^\d+$/.test(k)) throw new SerializeError(`unsupported result chip ${k}`);
        this.skipGroup();
        return this.chip(resKey(k), "result chip");
      }
      case "ans":
        this.pos++;
        return this.chip(ANS_KEY, "Ans");
      case "const": {
        // \const{ID}{symbol}: a constant inserted from Find (docs/04 3.6)
        this.pos++;
        const id = this.groupText();
        this.skipGroup();
        return this.chip(constKey(id), `constant ${id}`);
      }
      case "tfrac":
        // the mixed-number template (Tmpl, R10) makes \tfrac only after a whole number (read in atom); anything else
        // before it would silently multiply (x\tfrac12 = x/2), so it is refused
        throw new SerializeError("a mixed number needs a whole number before its fraction");
      case "frac":
      case "dfrac": {
        const d = this.tryPartial() ?? this.tryDerivative();
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
        let text: string;
        if (name === "operatorname" && this.isCh("{") && this.isCmd("mathrm", 1) && this.isCh("{", 2)) {
          // MathLive writes an inserted \operatorname{approx} as \operatorname{\mathrm{approx}}
          this.pos += 2;
          text = this.groupText();
          this.expectCh("}");
        } else text = this.groupText();
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

  /**
   * The derivative template (Tmpl, R10): `\frac{\partial e}{\partial x}` = de/dx. Undefined (nothing consumed) when
   * the numerator does not start with \partial; a \partial fraction of any other shape is an error, never a guess.
   */
  private tryPartial(): Json | undefined {
    if (!this.isCh("{", 1) || !this.isCmd("partial", 2)) return undefined;
    this.pos += 3;
    if (this.isCh("}")) throw new SerializeError("derivative: the expression goes after ∂ in the numerator");
    const body = this.relation();
    this.expectCh("}");
    this.expectCh("{");
    if (!this.isCmd("partial")) this.fail("derivative: expected ∂ before the variable");
    this.pos++;
    const v = this.peek();
    if (v?.t !== "ch" || !/^[A-Za-z]$/.test(v.v)) this.fail("derivative: expected a variable after ∂");
    const name = this.symbol((v as Tok).v);
    if (typeof name !== "string") this.fail("derivative: expected a variable after ∂");
    this.expectCh("}");
    return ["D", body, name];
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
    if (!["pmatrix", "bmatrix", "matrix", "cases"].includes(env)) throw new SerializeError(`unsupported environment ${env}`);
    const rows: Json[] = [];
    let row: Json[] = [];
    for (;;) {
      // the piecewise template (Tmpl, R10) writes "if" before each condition
      if (env === "cases" && row.length === 1 && this.isCmd("text")) {
        this.pos++;
        if (this.groupText().trim() !== "if") this.fail("piecewise: expected 'if'");
      }
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
    if (env === "cases") {
      // value & if condition, one row each: piecewise(condition, value, …)
      const pairs = rows.map((r) => (r as Json[]).slice(1));
      if (pairs.some((p) => p.length !== 2)) throw new SerializeError("piecewise: each line needs a value and a condition");
      return ["Piecewise", ...pairs.map((p) => ["Pair", p[0] as Json, p[1] as Json] as Json)];
    }
    return ["Matrix", ["List", ...rows]];
  }
}

export function parseLatex(latex: string, o: ParseOptions = {}): Json {
  return parseLatexInfo(latex, o).json;
}

export function parseLatexInfo(latex: string, o: ParseOptions = {}): ParseInfo {
  const p = new Parser(tokenize(latex, o.decimalComma), o);
  const json = p.parseAll();
  return { json, inexact: p.inexact };
}
