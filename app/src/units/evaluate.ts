// SPDX-License-Identifier: GPL-3.0-or-later
// The unit evaluator, Giac side (P15, docs/04 4.2): runs in the Giac worker beside Home (EngineHost.units), so Cancel
// works as for Home. A UnitJob's text is evaluated exactly with normal(); the result must be one number times one
// product of dimension symbols (each exponent d·∂f/∂d / f is then a number), else the dimensions of its terms are
// named; with an end slot the quotient must be a pure number. The number gets Home's facts (numeric.ts: exact, or the
// agreement check), so markOf() marks it as Home. Synchronous, UI-free. Only erasable TypeScript syntax.
import { FULL_EXACT_MAX, resultFromFacts, toExactLiterals, type HomeResult, type HomeSettings } from "../engine/homeEval.ts";
import { exactFacts, floatFacts, hasFloat, splitList, type ElementFacts, type Giac } from "../engine/numeric.ts";
import { BASES, dimKeyOf, isExponent, parseDimKey } from "./dims.ts";
import type { Quantity, UnitError, UnitJob } from "./types.ts";

const S = `[${BASES.map((b) => b.symbol).join(",")}]`;
const ANY_DIM = BASES.map((b) => `has(y,${b.symbol})`).join(" or ");

/**
 * Our Giac definitions for the unit view, loaded once per engine on the first units request:
 * - every dimension symbol is positive, so √(4 m²) is 2 m and not 2·|m|;
 * - pasuq(f): [0, exponents, number] for one term; [1, the terms' exponents] for a sum of terms; [2] for anything
 *   else (a function of a quantity with units); [3] when sin, cos or tan met a unit; [4] for an exact 0;
 * - pasua(x): the argument of sin, cos and tan: an angle (the rad dimension once, its value in rad) is given in the
 *   angle mode; a pure number is taken as it is, in the angle mode, as Home does (G15 default); anything else gives
 *   the free symbol pasubad, which pasuq finds;
 * - pasun(f,g): the number of f in the unit g (the agreement check runs it again at higher precision).
 */
export const UNIT_DEFINITIONS: readonly string[] = [
  ...BASES.map((b) => `assume(${b.symbol}>0)`),
  `pasuq(f):={local a,c,t; if (has(f,pasubad)) return [3]; if (f==0) return [4]; ` +
    `a:=map(${S},k->normal(k*diff(f,k)/f)); ` +
    `if (lvar(a)==[]) { c:=normal(f/product(zip((x,y)->x^y,${S},a))); return [0,a,c]; } ` +
    `t:=expand(f); if (sommet(t)!='+') return [2]; ` +
    `return [1,map([op(t)],u->map(${S},k->normal(k*diff(u,k)/u)))]; }`,
  `pasua(x):={local w,y; if (x==0) return 0; w:=normal(pasdimA*diff(x,pasdimA)/x); y:=normal(subst(x,pasdimA,1)); ` +
    `if ((w!=0 and w!=1) or ${ANY_DIM}) return pasubad; if (w==1 and angle_radian==0) return normal(y*180/pi); return y; }`,
  ...["sin", "cos", "tan"].map((f) => `pasu${f}(x):=${f}(pasua(x))`),
  `pasun(f,g):={local a,b; a:=pasuq(normal(f)); b:=pasuq(normal(g)); return normal(a[2]/b[2]); }`,
];

function isError(out: string): boolean {
  return out.startsWith("GIAC_ERROR");
}

/** sin, cos and tan of the formula take an angle (P15): our versions. asin and the others are left alone. */
function withAngles(expr: string): string {
  return expr.replace(/(?<![A-Za-z0-9_])(sin|cos|tan)\s*\(/g, "pasu$1(");
}

type Checked = { kind: "term"; exps: string[] } | { kind: "sum"; terms: string[][] } | { kind: "function" } | { kind: "trig" } | { kind: "zero" };

/** pasuq's printed answer. */
function checked(text: string): Checked | null {
  const parts = splitList(text);
  if (!parts || !parts.length) return null;
  const exps = (t: string): string[] | null => {
    const e = splitList(t);
    return e && e.length === BASES.length ? e : null;
  };
  switch (parts[0]) {
    case "0": {
      const e = parts[1] !== undefined ? exps(parts[1]) : null;
      return e && e.every(isExponent) ? { kind: "term", exps: e } : null;
    }
    case "1": {
      const terms = splitList(parts[1] ?? "")?.map(exps);
      return terms && terms.every((t) => t !== null) ? { kind: "sum", terms: terms as string[][] } : null;
    }
    case "2":
      return { kind: "function" };
    case "3":
      return { kind: "trig" };
    case "4":
      return { kind: "zero" };
    default:
      return null;
  }
}

/** Why a checked answer is not one term, or null when it is. */
function refusal(c: Checked): UnitError | null {
  if (c.kind === "function" || c.kind === "trig") return { error: "function" };
  if (c.kind === "sum") {
    if (c.terms.some((t) => !t.every(isExponent))) return { error: "function" };
    const dims = [...new Set(c.terms.map(dimKeyOf))].sort(byDimension);
    return dims.length > 1 ? { error: "dimension", dims } : { error: "function" };
  }
  return null;
}

/** Dimension keys by the first base each is written with (M, L, T, …), then by text: a stable order for messages
 *  ("L vs T"; Giac's expand() does not keep the order the terms were typed in). */
function byDimension(a: string, b: string): number {
  const first = (k: string): number => {
    const e = parseDimKey(k);
    const i = BASES.findIndex((d) => e.has(d.key));
    return i < 0 ? BASES.length : i;
  };
  return first(a) - first(b) || a.localeCompare(b);
}

/** A number stored in Giac as `name`, with Home's facts; null when it is not a number. */
function numberOf(giac: Giac, name: string, rerun: string, s: HomeSettings, inexact: boolean, approximate: boolean): HomeResult | null {
  const text = giac.eval(name);
  if (isError(text)) return null;
  const digits = Math.trunc(s.digits);
  const scalar = { kind: "scalar" } as const;
  const float = hasFloat(text);
  let facts: ElementFacts[] | null = float ? floatFacts(giac, name, rerun, scalar, digits, digits) : exactFacts(giac, name, scalar, digits, s.maxExactDigits);
  if (!facts) return null;
  // A constant with an uncertainty went in: never "=" (decisions M4-4), as in Home.
  if (inexact) facts = facts.map((f) => ({ ...f, exactRational: false }));
  const r = resultFromFacts(facts, scalar, digits, "exact", float || approximate);
  const exact = float ? undefined : giac.eval(name);
  return { ...r, ...(exact !== undefined && exact.length <= FULL_EXACT_MAX ? { exact, full: exact } : {}) };
}

/** Evaluates a job in the engine's current (Home) mode. */
export function unitEval(giac: Giac, job: UnitJob, s: HomeSettings): Quantity | UnitError {
  const t0 = performance.now();
  const f = withAngles(toExactLiterals(job.expr));
  const g = job.end ? withAngles(toExactLiterals(job.end)) : "1";
  const out = giac.eval(`pasuR:=[pasuq(normal(${f})),pasuq(normal(${g}))]`);
  if (isError(out)) return { error: "engine", detail: out };
  const both = splitList(out);
  const src = both?.[0] !== undefined ? checked(both[0]) : null;
  const dst = both?.[1] !== undefined ? checked(both[1]) : null;
  if (!src || !dst) return { error: "engine", detail: out };
  const bad = refusal(src) ?? refusal(dst);
  if (bad) return bad;
  if (dst.kind === "zero") return { error: "engine", detail: "an end slot of 0" };
  const dstKey = dst.kind === "term" ? dimKeyOf(dst.exps) : "";
  if (src.kind === "term" && job.end && dimKeyOf(src.exps) !== dstKey) return { error: "dimension", dims: [dimKeyOf(src.exps), dstKey], end: true };
  if (src.kind === "zero") {
    giac.eval("pasusi:=0");
    giac.eval("pasuv:=0");
  } else {
    giac.eval("pasusi:=pasuR[0][2]");
    if (job.end) giac.eval("pasuv:=normal(pasuR[0][2]/pasuR[1][2])");
  }
  const si = numberOf(giac, "pasusi", `pasun(${f},1)`, s, job.inexact, false);
  const value = job.end ? numberOf(giac, "pasuv", `pasun(${f},${g})`, s, job.inexact, false) : si;
  if (!si || !value) return { error: "symbolic", detail: giac.eval("pasusi") };
  return { value, si, dimension: src.kind === "term" ? dimKeyOf(src.exps) : null, ms: performance.now() - t0 };
}
