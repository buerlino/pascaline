// SPDX-License-Identifier: GPL-3.0-or-later
// The calculus templates of the parser (parse.ts): derivatives, integrals, sums, limits, matrices, as functions
// that take the parser (R72 moved them out of parse.ts).
import { parseError, type ParseKey, type ParseVars } from "../i18n/enParser.ts";
import type { Json } from "./emit.ts";
import { letterName } from "./parseTables.ts";
import type { Tok } from "./tokenize.ts";

/** What the calculus templates use of the parser (parse.ts Parser). */
export interface CalcParser {
  pos: number;
  noDiff: number;
  toks: Tok[];
  peek(k?: number): Tok | undefined;
  fail(key: ParseKey, vars?: ParseVars): never;
  isCh(v: string, k?: number): boolean;
  isCmd(v: string, k?: number): boolean;
  expectCh(v: string): void;
  relation(): Json;
  additive(): Json;
  term(): Json;
  implicit(): Json;
  script(): Json;
  groupText(): string;
  diffLen(): number;
  symbol(letter: string): Json;
  /** A parser with the same user functions for a token slice (the limit's target), run to the end. */
  subParse(toks: Tok[]): Json;
}

/**
 * The derivative template (Tmpl, R10): `\frac{\partial e}{\partial x}` = de/dx. Undefined (nothing consumed) when
 * the numerator does not start with \partial; a \partial fraction of any other shape is an error, never a guess.
 */
export function tryPartial(pr: CalcParser): Json | undefined {
  if (!pr.isCh("{", 1) || !pr.isCmd("partial", 2)) return undefined;
  pr.pos += 3;
  if (pr.isCh("}")) throw parseError("parse.derivativeTheExpression");
  const body = pr.relation();
  pr.expectCh("}");
  pr.expectCh("{");
  if (!pr.isCmd("partial")) pr.fail("parse.derivativeExpectedBefore");
  pr.pos++;
  const v = pr.peek();
  if (v?.t !== "ch" || !/^[A-Za-z]$/.test(v.v)) pr.fail("parse.derivativeExpectedA");
  const name = pr.symbol((v as Tok).v);
  if (typeof name !== "string") pr.fail("parse.derivativeExpectedA");
  pr.expectCh("}");
  return ["D", body, name];
}

/** \frac{d}{dx} f, \frac{d^2}{dx^2} f, with d or \mathrm{d}. Returns undefined (position restored) if not a derivative. */
export function tryDerivative(pr: CalcParser): Json | undefined {
  const save = pr.pos;
  const saveToks = pr.toks.slice();
  const restore = (): undefined => {
    pr.pos = save;
    pr.toks = saveToks;
    return undefined;
  };
  pr.pos++; // \frac
  const dsym = (): boolean => {
    if (pr.isCh("d")) {
      pr.pos++;
      return true;
    }
    if (pr.isCmd("mathrm") && pr.isCh("{", 1) && pr.isCh("d", 2) && pr.isCh("}", 3)) {
      pr.pos += 4;
      return true;
    }
    return false;
  };
  const order = (): number => {
    if (!pr.isCh("^")) return 1;
    pr.pos++;
    const t = pr.peek();
    if (pr.isCh("{") && pr.peek(1)?.t === "num" && pr.isCh("}", 2)) {
      const v = Number((pr.peek(1) as Tok).v);
      pr.pos += 3;
      return v;
    }
    if (t?.t === "num" && t.v.length === 1) {
      pr.pos++;
      return Number(t.v);
    }
    return NaN;
  };
  if (!pr.isCh("{")) return restore();
  pr.pos++;
  if (!dsym()) return restore();
  const n1 = order();
  if (!pr.isCh("}")) return restore();
  pr.pos++;
  if (!pr.isCh("{")) return restore();
  pr.pos++;
  if (!dsym()) return restore();
  const v = pr.peek();
  if (v?.t !== "ch" || !/^[A-Za-z]$/.test(v.v)) return restore();
  pr.pos++;
  const n2 = order();
  if (!pr.isCh("}") || !(n1 >= 1) || n1 !== n2) return restore();
  pr.pos++;
  let body = pr.implicit();
  for (let i = 0; i < n1; i++) body = ["D", body, letterName(v.v)];
  return body;
}

export function integral(pr: CalcParser): Json {
  pr.pos++;
  let lo: Json | undefined;
  let hi: Json | undefined;
  while (pr.isCh("_") || pr.isCh("^")) {
    const which = (pr.peek() as Tok).v;
    pr.pos++;
    const e = pr.script();
    if (which === "_") lo = e;
    else hi = e;
  }
  pr.noDiff++;
  const body = pr.additive();
  pr.noDiff--;
  const len = pr.diffLen();
  if (len === 0) pr.fail("parse.integralNeedsDx");
  pr.pos += len; // the d marker; the variable follows
  const v = letterName((pr.peek() as Tok).v);
  pr.pos++;
  if (lo === undefined && hi === undefined) return ["Integrate", body, v];
  if (lo === undefined || hi === undefined) throw parseError("parse.integralNeedsBoth");
  return ["Integrate", body, ["Tuple", v, lo, hi]];
}

export function bigOp(pr: CalcParser, head: "Sum" | "Product"): Json {
  pr.pos++;
  pr.expectCh("_");
  pr.expectCh("{");
  const v = pr.peek();
  if (v?.t !== "ch" || !/^[A-Za-z]$/.test(v.v)) pr.fail("parse.expectedIndexVariable");
  pr.pos++;
  pr.expectCh("=");
  const lo = pr.additive();
  pr.expectCh("}");
  pr.expectCh("^");
  const hi = pr.script();
  const body = pr.term();
  return [head, body, ["Tuple", letterName((v as Tok).v), lo, hi]];
}

export function limit(pr: CalcParser): Json {
  pr.pos++;
  pr.expectCh("_");
  pr.expectCh("{");
  const v = pr.peek();
  if (v?.t !== "ch" || !/^[A-Za-z]$/.test(v.v)) pr.fail("parse.expectedLimitVariable");
  pr.pos++;
  if (!pr.isCmd("to")) pr.fail("parse.expectedTo");
  pr.pos++;
  const start = pr.pos;
  let depth = 0;
  while (pr.peek() && !(depth === 0 && pr.isCh("}"))) {
    if (pr.isCh("{")) depth++;
    if (pr.isCh("}")) depth--;
    pr.pos++;
  }
  let target = pr.toks.slice(start, pr.pos);
  pr.pos++; // }
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
  const a = pr.subParse(target);
  const body = pr.term();
  const out: Json[] = ["Limit", ["Function", body, letterName(v.v)], a];
  if (dir !== undefined) out.push(dir);
  return out;
}

export function matrix(pr: CalcParser): Json {
  pr.pos++;
  const env = pr.groupText();
  if (!["pmatrix", "bmatrix", "matrix", "cases"].includes(env)) throw parseError("parse.unsupportedEnvironment", { env });
  const rows: Json[] = [];
  let row: Json[] = [];
  for (;;) {
    // the piecewise template (Tmpl, R10) writes "if" before each condition
    if (env === "cases" && row.length === 1 && pr.isCmd("text")) {
      pr.pos++;
      if (pr.groupText().trim() !== "if") pr.fail("parse.piecewiseExpectedIf");
    }
    row.push(pr.relation());
    if (pr.isCh("&")) {
      pr.pos++;
    } else if (pr.isCmd("\\")) {
      pr.pos++;
      rows.push(["List", ...row]);
      row = [];
    } else break;
  }
  rows.push(["List", ...row]);
  if (!pr.isCmd("end")) pr.fail("parse.expectedEnd");
  pr.pos++;
  if (pr.groupText() !== env) throw parseError("parse.mismatchedEnd");
  if (env === "cases") {
    // value & if condition, one row each: piecewise(condition, value, …)
    const pairs = rows.map((r) => (r as Json[]).slice(1));
    if (pairs.some((p) => p.length !== 2)) throw parseError("parse.piecewiseEachLine");
    return ["Piecewise", ...pairs.map((p) => ["Pair", p[0] as Json, p[1] as Json] as Json)];
  }
  return ["Matrix", ["List", ...rows]];
}
