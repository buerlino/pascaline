// SPDX-License-Identifier: GPL-3.0-or-later
// Hand-written parser for the LaTeX subset MathLive produces from our keyboard (and Giac's latex() style).
// It yields the same MathJSON shapes as Compute Engine's raw parse, so emit.ts serves both parsers.
// Unknown or ambiguous input throws SerializeError instead of guessing.
import { parseError, parseText, type ParseKey, type ParseVars } from "../i18n/enParser.ts";
import { ANS_KEY, constKey, resKey, type ChipTable } from "./chips.ts";
import { chipName, chipToGiac } from "./chip-giac.ts";
import type { Json } from "./emit.ts";
import { bigOp, integral, limit, matrix, tryDerivative, tryPartial, type CalcParser } from "./parseCalculus.ts";
import { ABS_LIKE, BASE_PREFIX, CONSTS, FACTOR_CMDS, FUNCS, GREEK, INVERSE, LOGIC_FUNCS, NAMED_FUNCS, RELATION, letterName,
  type ParseInfo, type ParseOptions, type UnitsInfo } from "./parseTables.ts";
import { ARING, CARET, EMARK, LOGIC, promptId, tokenize, type Tok } from "./tokenize.ts";

export { GREEK, LETTER_NAMES, type ParseInfo, type ParseOptions, type UnitsInfo } from "./parseTables.ts";

class Parser implements CalcParser {
  pos = 0;
  noDiff = 0;
  user: ReadonlySet<string>;
  toks: Tok[];
  private readonly chips: ChipTable;
  /** R28: units mode and what it found (null outside units mode). */
  readonly units: UnitsInfo | null;
  /** Set when a chip with an inexact value is used. */
  inexact = false;
  /** R65: the chips put in by name (chipNames), keyed by the k of `pasr_<k>`; null when names are off. */
  readonly named: ChipTable | null;
  /** F25 (R29): the token index right after the last number literal, and right after the last result chip. */
  private numEnd = -1;
  private resEnd = -1;
  constructor(toks: Tok[], o: ParseOptions) {
    this.toks = toks;
    this.user = o.userFunctions ?? new Set(["f", "g", "h"]);
    this.chips = o.chips ?? {};
    this.named = o.chipNames ? {} : null;
    this.units = o.units ? { slots: [], consts: [] } : null;
  }

  subParse(toks: Tok[]): Json {
    return new Parser(toks, { userFunctions: this.user }).parseAll();
  }
  peek(k = 0): Tok | undefined {
    return this.toks[this.pos + k];
  }
  fail(key: ParseKey, vars?: ParseVars): never {
    const t = this.peek();
    throw parseError(t ? "parse.atToken" : "parse.atEnd", { msg: parseText(key, vars), tok: t ? t.v : "" });
  }
  isCh(v: string, k = 0): boolean {
    const t = this.peek(k);
    return t?.t === "ch" && t.v === v;
  }
  isCmd(v: string, k = 0): boolean {
    const t = this.peek(k);
    return t?.t === "cmd" && t.v === v;
  }
  expectCh(v: string): void {
    if (!this.isCh(v)) this.fail("parse.expected", { v });
    this.pos++;
  }
  private expectClose(kind: string): void {
    const t = this.peek();
    if (t?.t !== "close" || t.v !== kind) this.fail("parse.expectedClosing", { kind });
    this.pos++;
  }

  parseAll(): Json {
    if (this.toks.length === 0) throw parseError("parse.emptyInput");
    const e = this.relation();
    if (this.units && this.isCmd("to")) {
      // R28: → and the end slot close the line
      this.pos++;
      const end = promptId(this.peek());
      if (end === undefined) throw parseError("parse.toNeedsEndSlot");
      this.units.end = end;
      this.pos++;
    }
    if (this.pos < this.toks.length) this.fail("parse.unexpectedToken");
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
  /** The lowest level: definitions and stores, then the function arrow, then logic, then one comparison. */
  relation(): Json {
    const def = this.definitionName();
    if (def) this.user = new Set([...this.user, def]);
    const left = this.logicOr();
    // R18: x → body (Shift + 9) is a function of x, Giac's ->; (x, y) → body takes two
    if (this.isCmd("rightarrow") || (!this.units && this.isCmd("to"))) {
      this.pos++;
      const vars = Array.isArray(left) && left[0] === "Tuple" ? left.slice(1) : [left];
      if (!vars.every((v) => typeof v === "string")) throw parseError("parse.needsAVariable");
      return ["Lambda", ["Tuple", ...vars], this.relation()];
    }
    // P4: store, value ▶ name (shift of the exponent key); the same as name := value.
    if (this.isCmd("blacktriangleright")) {
      this.pos++;
      const name = this.additive();
      if (typeof name !== "string") this.fail("parse.expectedAName");
      return ["Assign", name, left];
    }
    if (this.isCh(":") && this.isCh("=", 1)) {
      this.pos += 2;
      return ["Assign", left, this.relation()];
    }
    return left;
  }

  /** R18: a OR b, a XOR b (the Shift + 6 palette), left to right; AND binds tighter, as in Giac. */
  private logicOr(): Json {
    let left = this.logicAnd();
    for (;;) {
      if (this.isCmd(`${LOGIC}or`)) {
        this.pos++;
        left = ["Or", left, this.logicAnd()];
      } else if (this.isCmd(`${LOGIC}xor`)) {
        this.pos++;
        left = ["Xor", left, this.logicAnd()];
      } else return left;
    }
  }

  private logicAnd(): Json {
    let left = this.compare();
    while (this.isCmd(`${LOGIC}and`)) {
      this.pos++;
      left = ["And", left, this.compare()];
    }
    return left;
  }

  /** One comparison: a < b, a ≤ b, a = b (an equation), a == b (a test, R18), a ≠ b. */
  private compare(): Json {
    let left = this.additive();
    // P4: polar entry r∡θ (shift ×), the angle in the current angle mode.
    if (this.isCmd("measuredangle")) {
      this.pos++;
      left = ["PolarComplex", left, this.additive()];
    }
    if (this.isCh("=") && this.isCh("=", 1)) {
      this.pos += 2;
      return ["EqualTest", left, this.additive()];
    }
    const t = this.peek();
    if (t && (t.t === "ch" || t.t === "cmd") && t.v in RELATION) {
      this.pos++;
      return [RELATION[t.v] as string, left, this.additive()];
    }
    return left;
  }

  additive(): Json {
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

  term(): Json {
    if (this.isCh("-")) {
      this.pos++;
      return this.negate(this.term());
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
        // F26 (R30): ÷ and / only appear in a flat line (in textbook entry ÷ makes a stacked fraction). There they take
        // one factor on their right (a number, a name, a power, a function call or a bracket), and the product then goes
        // on left to right, as with ×: 1/2x = (1/2)·x and 6÷2(1+2) = 9, the G2's one-line rule (G2 item 6).
        this.pos++;
        const parts: Json[] = [["Divide", left, this.signedFactor()]];
        while (this.startsFactor()) {
          this.besideResult();
          parts.push(this.postfix());
        }
        left = parts.length === 1 ? (parts[0] as Json) : ["Multiply", ...parts];
      } else if (this.isCmd("bmod")) {
        this.pos++;
        left = ["Mod", left, this.implicit()];
      } else return left;
    }
  }

  /** Unary minus. In units mode a sign before a ± value goes inside its pasupm call (-20±0.5 u is pasupm(-20,0.5)·u,
   *  decisions Opus pass 2), and a double minus cancels; elsewhere it is Negate. */
  private negate(x: Json): Json {
    if (this.units) {
      const f = (e: Json): Json | null => {
        if (!Array.isArray(e)) return null;
        if (e[0] === "Call" && e[1] === "pasupm") {
          const v = e[2] as Json;
          return ["Call", "pasupm", Array.isArray(v) && v[0] === "Negate" ? (v[1] as Json) : ["Negate", v], ...e.slice(3)] as Json;
        }
        if ((e[0] === "Multiply" || e[0] === "Divide") && e.length > 1) {
          const l = f(e[1] as Json);
          return l ? ([e[0], l, ...e.slice(2)] as Json) : null;
        }
        return null;
      };
      const r = f(x);
      if (r) return r;
    }
    return ["Negate", x];
  }

  private signedImplicit(): Json {
    if (this.isCh("-")) {
      this.pos++;
      return this.negate(this.signedImplicit());
    }
    return this.implicit();
  }

  /** One factor after ÷ or / (F26), with its signs: 1÷-2x = (1/(-2))·x. */
  private signedFactor(): Json {
    if (this.isCh("-")) {
      this.pos++;
      return this.negate(this.signedFactor());
    }
    return this.postfix();
  }

  /** Differential marker (d x or \mathrm{d}x) at the current position: tokens it spans, else 0. */
  diffLen(): number {
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
        // R28: in units mode a prompt or ± with no number before it reaches atom(), which says why it is refused
        if (this.units && (t.id !== undefined || t.v === "pm")) return true;
        // the exponent mark after something that is not a number: atom() refuses it with a message
        // Å and & (R18) too, so that 5Å reaches the message that says why it is refused
        return FACTOR_CMDS.has(t.v) || t.v in FUNCS || t.v in CONSTS || t.v in GREEK || t.v === EMARK || t.v === ARING || t.v === "&";
      default:
        return false;
    }
  }

  implicit(): Json {
    const parts: Json[] = [this.postfix()];
    while (this.startsFactor()) {
      this.besideResult();
      parts.push(this.postfix());
    }
    return parts.length === 1 ? (parts[0] as Json) : ["Multiply", ...parts];
  }

  /**
   * F25 (R29): a result chip draws its digits, so [0.5]3, 3[0.5] and [0.5][0.25] read as one number (on the G2 an
   * inserted result is text, and a digit typed after it extends it). A number directly beside a result chip, or two
   * result chips side by side, is refused rather than multiplied. Ans and a constant draw a name and multiply as 2x.
   */
  private besideResult(): void {
    const t = this.peek();
    const res = t?.t === "cmd" && t.v === "res";
    if (this.pos === this.resEnd && res) throw parseError("parse.timesBetweenResults");
    if ((this.pos === this.resEnd && t?.t === "num") || (this.pos === this.numEnd && res))
      throw parseError("parse.timesResultNumber");
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
          if (this.isCh("^")) this.fail("parse.ambiguousDoubleSuperscript");
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
    // a \left. closed by a real bracket is half a pair (MathLive's ⌫ at a bracket, F10), not a missing bar
    const unmatched = (u: Tok | undefined): boolean => u?.t === "close" && u.v !== "|" && u.v !== ".";
    if (unmatched(this.peek())) throw parseError("parse.unmatchedBracket");
    const e = this.relation();
    const t = this.peek();
    if (t?.t === "close" && t.v === ".") {
      this.pos++;
      return ["Delimiter", e];
    }
    if (unmatched(t)) throw parseError("parse.unmatchedBracket");
    if (t?.t !== "close" || t.v !== "|" || !this.isCh("_", 1)) this.fail("parse.expectedTheEvaluate");
    this.pos += 2;
    const at = this.arg();
    if (!Array.isArray(at) || at[0] !== "Equal" || typeof at[1] !== "string")
      throw parseError("parse.evaluateAtWrite");
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
  script(): Json {
    return this.arg();
  }

  groupText(): string {
    this.expectCh("{");
    let s = "";
    while (!this.isCh("}")) {
      const t = this.peek();
      if (!t) this.fail("parse.unterminatedGroup");
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
    if (!t) this.fail("parse.unexpectedEndOf");
    const tok = t as Tok;
    switch (tok.t) {
      case "num": {
        // F43 (R51): the line shows two numbers with a gap and no ×; checked here, so a chip's drawn digits are skipped
        if (tok.gap) throw parseError("parse.timesBetweenNumbers");
        this.basePrefix(tok);
        this.pos++;
        if (this.isCmd(EMARK)) {
          const e = this.unitsAfter(this.eNumber(tok.v));
          this.numEnd = this.pos;
          return e;
        }
        const num = { num: tok.v.replace(/^0+(?=\d)/, "") };
        // a whole number directly before \tfrac is a mixed number (the Tmpl mixed-number template, R10): 2\tfrac12 = 2+1/2
        if (/^\d+$/.test(tok.v) && this.isCmd("tfrac")) {
          this.pos++;
          const a = this.arg();
          const b = this.arg();
          return this.unitsAfter(["Delimiter", ["Add", num, ["Divide", a, b]]]);
        }
        const e = this.unitsAfter(num);
        this.numEnd = this.pos;
        return e;
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
          // L6: braces make a list, as the list key (Shift + 8, R54) does (Giac input has no other use for them here); an
          // empty one is refused, as empty parentheses are: Giac's [] is no answer to a list the user did not fill
          if (this.peek()?.t === "close" && (this.peek() as Tok).v === "}") throw parseError("parse.emptyList");
          return ["List", ...this.list("}")];
        }
        if (tok.v === "floor" || tok.v === "ceil") {
          const e = this.relation();
          this.expectClose(tok.v);
          return [tok.v === "floor" ? "Floor" : "Ceil", e];
        }
        throw parseError("parse.unsupportedDelimiter", { v: tok.v });
      }
      case "close":
        return this.fail("parse.unexpectedClosingDelimiter");
      case "ch": {
        if (tok.v === "{") return this.arg();
        if (/^[A-Za-z]$/.test(tok.v)) return this.symbol(tok.v);
        return this.fail("parse.unexpectedToken");
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
    if (t?.t !== "num") throw parseError("parse.needsAWhole");
    if (!/^\d+$/.test(t.v)) throw parseError("parse.theExponentAfter", { v: t.v });
    this.pos++;
    if (this.isCmd(EMARK)) throw parseError("parse.oneExponent");
    // x², xʸ after the number put it in brackets; a bare power here would read as 1.5ᴇ3² = 1.5·10⁹ to some, (1.5ᴇ3)² to others
    if (this.isCh("^") || this.isCmd(CARET)) throw parseError("parse.putTheNumber");
    const m = mant.replace(/^0+(?=\d)/, "").replace(/\.$/, "").replace(/^\./, "0.");
    const e = t.v.replace(/^0+(?=\d)/, "");
    return { num: `${m}e${sign}${e}` };
  }

  /**
   * R28, units mode: after a number, `\pm σ` makes it an uncertain value, `pasupm(value,σ)` (G18; σ a plain number,
   * the standard uncertainty in the slot's unit), and a prompt is its unit slot, `pasu<i>` multiplying it.
   */
  private unitsAfter(n: Json): Json {
    if (!this.units) return n;
    let v = n;
    if (this.isCmd("pm")) {
      this.pos++;
      const t = this.peek();
      if (t?.t !== "num" || t.gap) throw parseError("parse.pmNeedsSigma");
      this.pos++;
      v = ["Call", "pasupm", n, this.isCmd(EMARK) ? this.eNumber(t.v) : { num: t.v.replace(/^0+(?=\d)/, "") }];
    }
    const id = promptId(this.peek());
    if (id !== undefined) {
      this.pos++;
      if (this.units.slots.includes(id)) throw parseError("parse.slotTwice", { id });
      this.units.slots.push(id);
      v = ["Multiply", v, `pasu${this.units.slots.length}`];
    }
    return v;
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
    throw parseError("parse.numbersInOther", { v: (p as Tok).v });
  }

  /** The value of a chip from the table, as one factor; a missing chip is an error, never a guess. */
  private chip(key: string, what: string): Json {
    const c = this.chips[key];
    if (!c) throw key === ANS_KEY ? parseError("parse.ansNone") : parseError("parse.valueMissing", { what });
    if (!c.exact) this.inexact = true;
    // a value with an == or ≠ test in it stays a value: only chip-giac.ts rewrites the test (R18f3)
    const name = !c.exact && this.named && !/==|<>|!=/.test(c.value) ? chipName(key) : undefined;
    if (name && this.named) {
      chipToGiac(c.value); // the same refusals as a value put in
      this.named[name.slice(name.indexOf("_") + 1)] = c;
      return ["Chip", { str: name }];
    }
    return ["Chip", { str: chipToGiac(c.value) }];
  }

  /** Skip one {…} group (a chip's display argument), braces balanced. */
  private skipGroup(): void {
    this.expectCh("{");
    for (let depth = 1; depth > 0; this.pos++) {
      const t = this.peek();
      if (!t) this.fail("parse.unterminatedGroup");
      if (t?.t === "ch" && t.v === "{") depth++;
      else if (t?.t === "ch" && t.v === "}") depth--;
    }
  }

  symbol(letter: string): Json {
    this.pos++;
    let name = letter;
    if (this.isCh("_")) {
      this.pos++;
      const sub = this.isCh("{") ? this.groupText() : this.shortText();
      if (!/^[A-Za-z0-9]+$/.test(sub)) throw parseError("parse.unsupportedSubscript", { sub });
      name = `${letter}_${sub}`;
    }
    if (this.peek()?.t === "open" && (this.peek() as Tok).v === "(" && this.user.has(letter) && name === letter) {
      this.pos++;
      return ["Call", name, ...this.list(")")];
    }
    return name === letter ? letterName(letter) : name;
  }
  private shortText(): string {
    const t = this.peek();
    if (!t || (t.t !== "num" && t.t !== "ch")) this.fail("parse.expectedSubscript");
    const tok = t as Tok;
    const s = tok.v.slice(0, 1);
    if (tok.t === "num" && tok.v.length > 1) this.toks[this.pos] = { t: "num", v: tok.v.slice(1) };
    else this.pos++;
    return s;
  }

  private command(name: string): Json {
    if (name === EMARK) throw parseError("parse.typeTheNumber");
    if (this.units && promptId(this.peek()) !== undefined) throw parseError("parse.slotNeedsNumber");
    if (this.units && name === "pm") throw parseError("parse.pmNeedsNumber");
    if (name in CONSTS) {
      this.pos++;
      return CONSTS[name] as string;
    }
    if (name in GREEK) {
      this.pos++;
      return GREEK[name] as string;
    }
    if (name in FUNCS) return this.func(name);
    switch (name) {
      case "res": {
        // \res{k}{shown}: a history result (docs/04 2.8)
        this.pos++;
        const k = this.groupText();
        if (!/^\d+$/.test(k)) throw parseError("parse.unsupportedResultChip", { k });
        this.skipGroup();
        this.resEnd = this.pos;
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
        if (this.units) {
          // R28: the unit view takes the constant with its dimension from the Find index (G16), as `pask<j>`
          if (!/^[A-Za-z0-9_]+$/.test(id)) throw parseError("parse.valueMissing", { what: `constant ${id}` });
          if (!this.units.consts.includes(id)) this.units.consts.push(id);
          return `pask${this.units.consts.indexOf(id) + 1}`;
        }
        return this.chip(constKey(id), `constant ${id}`);
      }
      case "tfrac":
        // the mixed-number template (Tmpl, R10) makes \tfrac only after a whole number (read in atom); anything else
        // before it would silently multiply (x\tfrac12 = x/2), so it is refused
        throw parseError("parse.aMixedNumber");
      case "frac":
      case "dfrac": {
        const d = tryPartial(this) ?? tryDerivative(this);
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
        return integral(this);
      case "sum":
      case "prod":
        return bigOp(this, name === "sum" ? "Sum" : "Product");
      case "lim":
        return limit(this);
      case "begin":
        return matrix(this);
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
        const logic = LOGIC_FUNCS[text];
        if (logic) {
          // R18: NOT(a) and EQ(a, b) from the Shift + 6 palette
          if (!(this.peek()?.t === "open" && (this.peek() as Tok).v === "(")) throw parseError("parse.needsBrackets", { text });
          this.pos++;
          const args = this.list(")");
          if (args.length !== logic.args) throw parseError("parse.logicTakes", { text, count: logic.args === 1 ? "one argument" : `${logic.args} arguments` });
          return [logic.head, ...args];
        }
        if (text in ABS_LIKE || NAMED_FUNCS.has(text) || text.length > 1) {
          if (this.peek()?.t === "open" && (this.peek() as Tok).v === "(") {
            this.pos++;
            const args = this.list(")");
            const head = ABS_LIKE[text];
            return head ? [head, ...args] : ["Call", text, ...args];
          }
        }
        throw parseError("parse.unsupportedNameUnits", { name, text });
      }
      case "&":
        // R18: the Shift + 9 palette has & as the G2's does; what it means there is not known yet (G2 checklist)
        throw parseError("parse.hasNoMeaning");
      case "unit":
      case "pfx":
        // R4a: a unit or prefix from Find goes on the line as a chip; Home is unit-free (P8), the unit view takes it
        this.pos++;
        throw parseError("parse.unitChip", { name: this.groupText() });
      case ARING:
        // R18: Å is the ångström, a unit; Home is unit-free (P8), so it is refused, never read as a name
        throw parseError("parse.isAUnit");
      default:
        throw parseError("parse.unsupportedCommand", { name });
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
      if (!this.startsFactor()) this.fail("parse.needsAnArgument", { name });
      parts.push(this.postfix());
      while (this.startsFactor() && !(this.peek() as Tok).v.startsWith("\\") && !((this.peek() as Tok).t === "cmd" && (this.peek() as Tok).v in FUNCS)) {
        // R27b (F23, G2 item 50): sin 7(2) reads as sin 14 or sin(7)·2, so a bracket after the term is refused
        if ((this.peek() as Tok).t === "open") this.fail("parse.putItsWhole", { name });
        // F25 (R29): the bare argument is an implicit product too, so \sin2[0.5] is refused as 2[0.5] is
        this.besideResult();
        parts.push(this.postfix());
      }
      args = [parts.length === 1 ? (parts[0] as Json) : ["Multiply", ...parts]];
    }
    if (base !== undefined) args.push(base);
    const call: Json = [callHead, ...args];
    return power === undefined ? call : ["Power", call, power];
  }
}

export function parseLatex(latex: string, o: ParseOptions = {}): Json {
  return parseLatexInfo(latex, o).json;
}

export function parseLatexInfo(latex: string, o: ParseOptions = {}): ParseInfo {
  const p = new Parser(tokenize(latex), o);
  const json = p.parseAll();
  return { json, inexact: p.inexact, ...(p.named && Object.keys(p.named).length ? { named: p.named } : {}), ...(p.units ? { units: p.units } : {}) };
}
