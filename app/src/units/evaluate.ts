// SPDX-License-Identifier: GPL-3.0-or-later
// The unit evaluator, Giac side (P15, docs/04 4.2): runs in the Giac worker beside Home (EngineHost.units), so Cancel
// works as for Home. A UnitJob's text is evaluated exactly with normal(); the result must be one number times one
// product of dimension symbols (each exponent d·∂f/∂d / f is then a number), else the dimensions of its terms are
// named; with an end slot the quotient must be a pure number. The number gets Home's facts (numeric.ts: exact, or the
// agreement check), so markOf() marks it as Home. Synchronous, UI-free. Only erasable TypeScript syntax.
import { FULL_EXACT_MAX, resultFromFacts, toExactLiterals, type HomeResult, type HomeSettings } from "../engine/homeEval.ts";
import { exactFacts, floatFacts, hasFloat, rationalValue, splitList, valuePrecision, type ElementFacts, type Giac } from "../engine/numeric.ts";
import { BASES, dimKeyOf, dimensionText, isExponent, parseDimKey, siUnit } from "./dims.ts";
import { isUnitError, type Quantity, type Uncertainty, type UnitError, type UnitJob } from "./types.ts";
import { shownWithUncertainty, uncertaintyText } from "./uncertainty.ts";

const S = `[${BASES.map((b) => b.symbol).join(",")}]`;
const ANY_DIM = BASES.map((b) => `has(y,${b.symbol})`).join(" or ");

/**
 * Our Giac definitions for the unit view, loaded once per engine on the first units request:
 * - every dimension symbol is positive, so √(4 m²) is 2 m and not 2·|m|;
 * - pasuq(f): [0, exponents, number] for one term; [1, the terms' exponents] for a sum of terms; [2] for anything
 *   else (a function of a quantity with units: also a term whose number part still holds a dimension symbol, as
 *   floor(3/2·m) or Giac's irem of two lengths); [3] when sin, cos or tan met a unit; [4] for an exact 0; [5] for Giac's infinity or undef (a division by 0);
 * - pasuh(y): whether y holds a dimension symbol;
 * - pasua(x): the argument of sin, cos and tan, in radians (Giac runs in radians in every mode, G46): an angle (the
 *   rad dimension once, its value in rad) as it is; a pure number in the angle mode, as Home does (G15 default), so
 *   times pasdeg (π/180 in DEG); anything else gives the free symbol pasubad, which pasuq finds;
 * - pasup(m): 10^m, as a whole number for an integer m, else exp(m·ln 10), which pasuq reads (it cannot read the
 *   algebraic number 10^(3/20)): the ratio of a level given in dB, bel or dBm;
 * - pasul(e): the exact value of a level (a logarithm), the shorter of normal() and simplify() ("-30", not
 *   "-10*ln(1000)/ln(10)"; "20*ln(2)/ln(10)", not simplify's longer form);
 * - pasun(f,g): the number of f in the unit g (the agreement check runs it again at higher precision).
 */
export const UNIT_DEFINITIONS: readonly string[] = [
  ...BASES.map((b) => `assume(${b.symbol}>0)`),
  `pasuh(y):=${ANY_DIM}`,
  `pasuq(f):={local a,b,c,j,t; if (has(f,pasubad)) return [3]; if (has(f,undef) or has(f,infinity)) return [5]; if (f==0) return [4]; ` +
    `a:=map(${S},k->normal(k*diff(f,k)/f)); ` +
    `if (lvar(a)==[]) { c:=normal(f/product(zip((x,y)->x^y,${S},a))); if (pasuh(c)) return [2]; return [0,a,c]; } ` +
    `t:=expand(f); if (sommet(t)!='+') return [2]; t:=[op(t)]; ` +
    `b:=map(t,u->map(${S},k->normal(k*diff(u,k)/u))); ` +
    `for (j:=0;j<size(t);j++) { if (lvar(b[j])==[] and pasuh(normal(t[j]/product(zip((x,y)->x^y,${S},b[j]))))) return [2]; } ` +
    `return [1,b]; }`,
  `pasua(x):={local w,y; if (x==0) return 0; w:=normal(pasdimA*diff(x,pasdimA)/x); y:=normal(subst(x,pasdimA,1)); ` +
    `if ((w!=0 and w!=1) or ${ANY_DIM}) return pasubad; if (w==1) return y; return y*pasdeg; }`,
  ...["sin", "cos", "tan"].map((f) => `pasu${f}(x):=${f}(pasua(x))`),
  `pasup(m):={if (denom(normal(m))==1) return 10^m; return exp(m*ln(10)); }`,
  `pasul(e):={local r,s; r:=normal(e); s:=simplify(r); if (length(string(s))<length(string(r))) return s; return r; }`,
  `pasun(f,g):={local a,b; a:=pasuq(normal(f)); b:=pasuq(normal(g)); return normal(a[2]/b[2]); }`,
];

function isError(out: string): boolean {
  return out.startsWith("GIAC_ERROR");
}

/** sin, cos and tan of the formula take an angle (P15): our versions. asin and the others are left alone. pasua reads
 *  the angle in the mode's unit itself, so the parser's degree factor (R64, `sin(pasdeg*u)`) is taken off here. */
export function withAngles(expr: string): string {
  return expr.replace(/(?<![A-Za-z0-9_])(sin|cos|tan)\s*\(\s*(?:pasdeg\s*\*)?/g, "pasu$1(");
}

type Checked = { kind: "term"; exps: string[]; num: string } | { kind: "sum"; terms: string[][] } | { kind: "function" } | { kind: "trig" } | { kind: "zero" } | { kind: "undefined" };

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
      return e && e.every(isExponent) && parts[2] !== undefined ? { kind: "term", exps: e, num: parts[2] } : null;
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
    case "5":
      return { kind: "undefined" };
    default:
      return null;
  }
}

/** Why a checked answer is not one term, or null when it is. */
function refusal(c: Checked, job: UnitJob): UnitError | null {
  if (c.kind === "function" || c.kind === "trig") return { error: "function" };
  // Giac's 1/0 is infinity, 0/0 undef: not a number, and not the user's free name.
  if (c.kind === "undefined") return { error: "divzero" };
  if (c.kind === "sum") {
    if (c.terms.some((t) => !t.every(isExponent))) return { error: "function" };
    const dims = [...new Set(c.terms.map(dimKeyOf))].sort(byDimension);
    if (dims.length === 2) {
      const cy = cycleRefusal(job, dims[0]!, dims[1]!);
      if (cy) return cy;
    }
    return dims.length > 1 ? { error: "dimension", dims } : { error: "function" };
  }
  return null;
}

/** G32: rpm or rev on one side and the angle on the other (the dimensions differ by rad alone). */
function cycleRefusal(job: UnitJob, a: string, b: string): UnitError | null {
  if (!job.cycle) return null;
  const strip = (k: string): string => [...parseDimKey(k)].filter(([n]) => n !== "rad").map(([n, e]) => n + e).sort().join("");
  const angle = (k: string): boolean => parseDimKey(k).has("rad");
  return angle(a) !== angle(b) && strip(a) === strip(b) ? { error: "cycle", unit: job.cycle } : null;
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

const gcd = (a: bigint, b: bigint): bigint => {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b) [a, b] = [b, a % b];
  return a;
};

/** num/den as exact rational text when both are printed rationals ("25/18"), else null: no Giac call needed. */
function rationalQuotient(num: string, den: string): string | null {
  const a = rationalValue(num);
  const b = rationalValue(den);
  if (!a || !b || b.p === 0n) return null;
  let p = a.p * b.q;
  let q = a.q * b.p;
  if (q < 0n) [p, q] = [-p, -q];
  const g = gcd(p, q) || 1n;
  return q / g === 1n ? `${p / g}` : `${p / g}/${q / g}`;
}

/** Home's facts for one number, as a HomeResult (display at the digits setting, the mark's facts, the exact text). */
function result(facts: ElementFacts[], exact: string | undefined, s: HomeSettings, inexact: boolean, approximate: boolean): HomeResult {
  // A constant with an uncertainty went in: never "=" (decisions M4-4), as in Home.
  const fs = inexact ? facts.map((f) => ({ ...f, exactRational: false })) : facts;
  const r = resultFromFacts(fs, { kind: "scalar" }, Math.trunc(s.digits), "exact", approximate);
  return { ...r, ...(exact !== undefined && exact.length <= FULL_EXACT_MAX ? { exact, full: exact } : {}) };
}

/** The number stored in Giac as `name`, with Home's facts (exact, or the agreement check); null when it is not a
 *  number. `rerun` computes it again, for a float's check. */
function numberOf(giac: Giac, name: string, rerun: string, s: HomeSettings, inexact: boolean): HomeResult | null {
  const text = giac.eval(name);
  if (isError(text)) return null;
  const digits = Math.trunc(s.digits);
  const scalar = { kind: "scalar" } as const;
  const float = hasFloat(text);
  const facts = float ? floatFacts(giac, name, rerun, scalar, digits, digits) : exactFacts(giac, name, scalar, digits, s.maxExactDigits);
  return facts && result(facts, float ? undefined : text, s, inexact, float);
}

/**
 * G18: the first-order uncertainty of the stored result. σ = sqrt(Σ (∂f/∂xᵢ · σᵢ)²) over the uncertain inputs (taken as
 * independent), exactly, with Giac's diff, at the inputs' values; it is a quantity of the result's dimension, which is
 * then divided by the end slot's factor like the value (a level end slot: through the derivative of the level).
 * `valueExpr` is Giac text of the value as shown, `shownValue` its display (kept for a σ of 0). Never "=": the facts of σ carry the approximation.
 */
function uncertainty(giac: Giac, job: UnitJob, src: Checked, dst: { num: string }, valueExpr: string, shownValue: string, dimension: string | null, s: HomeSettings): Uncertainty | UnitError {
  const u = job.unc!;
  const lit = toExactLiterals;
  const F = withAngles(lit(u.expr));
  const at = `[${u.vars.map((v) => `${v.name}=(${lit(v.value)})`).join(",")}]`;
  const terms = u.vars.map((v) => `(subst(diff(${F},${v.name}),${at})*(${lit(v.sigma)}))^2`).join("+");
  const out = giac.eval(`pasuS:=pasuq(normal(sqrt(${terms})))`);
  if (isError(out)) return { error: "engine", detail: out };
  const q = checked(out);
  // σ through a power of a unit holds ln(m): a ± in the exponent of a quantity (m^(2 ± 0.1)).
  if (q?.kind === "function") return { error: "uncpower" };
  if (!q || (q.kind !== "term" && q.kind !== "zero")) return { error: "engine", detail: `no uncertainty: ${out}` };
  if (q.kind === "term" && dimension !== null && dimKeyOf(q.exps) !== dimension) return { error: "engine", detail: `uncertainty of ${dimKeyOf(q.exps)} on ${dimension}` };
  const c = q.kind === "term" ? q.num : "0";
  let sigma = `(${c})/(${dst.num})`;
  if (job.endLog !== undefined && src.kind === "term") {
    const level = job.endLog.replace(/pasux/g, "pasuxx");
    sigma = `abs(subst(diff(${level},pasuxx),pasuxx=(pasuR[0][2])/(pasuR[1][2])))*${sigma}`;
  }
  const set = giac.eval(`pasus:=normal(${sigma})`);
  if (isError(set)) return { error: "engine", detail: set };
  const value = numberOf(giac, "pasus", "pasus", s, true);
  const plain = giac.eval(`evalf(${valueExpr},30)`);
  const sig = giac.eval("evalf(pasus,30)");
  const text = isError(sig) ? null : uncertaintyText(sig);
  const shown = isError(plain) || isError(sig) ? null : shownWithUncertainty(plain, sig, shownValue);
  if (!value || text === null || shown === null) return { error: "engine", detail: `uncertainty not a number: ${sig}` };
  return { value, text, shown };
}

const PREFIXES: Readonly<Record<number, string>> = { [-15]: "f", [-12]: "p", [-9]: "n", [-6]: "µ", [-3]: "m", 0: "", 3: "k", 6: "M", 9: "G", 12: "T", 15: "P" };

/** The unit a result without an end slot is shown in (G25): the first typed unit of the job that has the result's
 *  dimension, else the SI unit with the SI prefix that puts the number from 1 to 999. `factor` is its factor to SI. */
function chosenUnit(giac: Giac, job: UnitJob, dimension: string, num: string): { text: string; factor: string } {
  const typed = job.shows?.find((u) => u.dim === dimension);
  if (typed) return { text: typed.text, factor: typed.factor };
  const si = siUnit(dimension);
  const base = { text: si.text, factor: "1" };
  if (!si.prefixable) return base;
  const v = Math.abs(Number(giac.eval(`evalf(${num})`))) * 10 ** -si.prefixable.exp10;
  if (!(v > 0) || !Number.isFinite(v)) return base;
  const e = Number(v.toExponential(11).split("e")[1]);
  // Mass stops at kg (a tonne is 1000 kg, not 1 Mg).
  const k = Math.min(Math.floor(e / 3) * 3, si.prefixable.symbol === "g" ? 3 : 15);
  const pfx = PREFIXES[k];
  if (pfx === undefined) return base;
  const exp10 = k + si.prefixable.exp10;
  return { text: pfx + si.prefixable.symbol, factor: exp10 >= 0 ? `${10n ** BigInt(exp10)}` : `1/${10n ** BigInt(-exp10)}` };
}

/** Evaluates a job in the engine's current (Home) mode. One Giac call when the value is rational; the agreement
 *  check's calls otherwise. */
export function unitEval(giac: Giac, job: UnitJob, s: HomeSettings): Quantity | UnitError {
  const t0 = performance.now();
  const f = withAngles(toExactLiterals(job.expr));
  let g = job.end ? withAngles(toExactLiterals(job.end)) : "1";
  // G35: the dimension check (job.check, every number beside a slot a symbol of its own) goes in the same call.
  const checkText = job.check !== undefined ? `pasuq(normal(${withAngles(toExactLiterals(job.check))}))` : null;
  const chk = checkText !== null && job.checkSum ? `,${checkText}` : "";
  const out = giac.eval(`pasuR:=[pasuq(normal(${f})),pasuq(normal(${g}))${chk}]`);
  if (isError(out)) return { error: "engine", detail: out };
  const both = splitList(out);
  const src = both?.[0] !== undefined ? checked(both[0]) : null;
  let dst = both?.[1] !== undefined ? checked(both[1]) : null;
  if (!src || !dst) return { error: "engine", detail: out };
  // The check refuses terms of different dimensions, whatever their numbers; a function it cannot read (max, with
  // symbols) leaves the decision to the value's own check.
  // Without a sum only a value 0 needs the check, for its dimension: a call of its own then.
  const later = checkText !== null && !job.checkSum && src.kind === "zero" ? giac.eval(checkText) : null;
  const third = later !== null ? (isError(later) ? undefined : later) : both?.[2];
  const per = third !== undefined ? checked(third) : null;
  const mixed = per?.kind === "sum" ? refusal(per, job) : null;
  if (mixed && mixed.error !== "function") return mixed;
  const bad = refusal(src, job) ?? refusal(dst, job);
  if (bad) return bad;
  if (dst.kind !== "term") return { error: "engine", detail: "an end slot of 0" };
  // A result 0 keeps the dimension of its terms (the check's), so `0 m → s` is refused and `0 m` shows m.
  const dimension = src.kind === "term" ? dimKeyOf(src.exps) : per?.kind === "term" ? dimKeyOf(per.exps) : null;
  if (dimension !== null && job.end && dimension !== dimKeyOf(dst.exps)) return cycleRefusal(job, dimension, dimKeyOf(dst.exps)) ?? { error: "dimension", dims: [dimension, dimKeyOf(dst.exps)], end: true };
  const num = src.kind === "term" ? src.num : "0";
  const si = src.kind === "term" && num.length <= FULL_EXACT_MAX ? { si: num } : {};
  let unit = job.endUnit ?? "";
  // No end slot: the typed unit that fits, else the SI unit with a prefix (an absolute temperature stays in K).
  if (!job.end && dimension !== null && !job.absTemp) {
    const c = chosenUnit(giac, job, dimension, num);
    unit = c.text;
    if (c.factor !== "1") {
      g = c.factor;
      const out2 = giac.eval(`pasuR:=[pasuR[0],pasuq(normal(${g}))]`);
      const re = isError(out2) ? null : splitList(out2);
      const d2 = re?.[1] !== undefined ? checked(re[1]) : null;
      if (!d2 || d2.kind !== "term") return { error: "engine", detail: out2 };
      dst = d2;
    }
  } else if (!job.end && dimension !== null) unit = siUnit(dimension).text;
  // The end slot as shown: the one given, or the unit chosen for the result (σ is scaled by this one, like the value).
  const shownDst = dst;
  const done = (value: HomeResult, valueExpr: string): Quantity | UnitError => {
    const unc = job.unc ? uncertainty(giac, job, src, shownDst, valueExpr, value.display, dimension, s) : null;
    if (unc && isUnitError(unc)) return unc;
    return { value, dimension, dimensionText: dimension === null ? null : dimensionText(dimension), unit, ...si, ...(unc ? { unc } : {}), ms: performance.now() - t0 };
  };
  if ((job.absTemp || job.endOffset !== undefined) && src.kind === "term" && giac.eval(`sign(${num})`).trim() === "-1") return { error: "belowzero" };
  // An end slot in °C or °F: the SI number less the offset (K = a·x + b, the end slot holds a); in dB, dBm or Np: the
  // level of the ratio to its reference. Both give the number of Giac's text, not a rational quotient.
  const shifted = job.endOffset !== undefined ? giac.eval(`normal((${num})-(${job.endOffset}))`) : num;
  if (isError(shifted)) return { error: "engine", detail: shifted };
  const exact = job.endLog === undefined ? rationalQuotient(shifted, dst.num) : null;
  if (exact !== null) {
    const r = rationalValue(exact, valuePrecision(Math.trunc(s.digits)))!;
    const big = [r.p, r.q].some((x) => (x < 0n ? -x : x).toString().length > s.maxExactDigits);
    return done(result([{ value: { re: r.v, im: rationalValue("0")!.v }, exactRational: true, reliableDigits: null, big }], exact, s, job.inexact, false), exact);
  }
  if (job.endLog !== undefined) {
    // The level of a ratio at or below 0 is not a real number: refuse it before taking the log.
    if (src.kind === "zero") return { error: "level" };
    if (src.kind === "term" && ["-1", "0"].includes(giac.eval(`sign(normal(pasuR[0][2]/pasuR[1][2]))`).trim())) return { error: "level" };
  }
  const ratio = job.endOffset !== undefined ? `(${shifted})/pasuR[1][2]` : `${src.kind === "term" ? "pasuR[0][2]" : "0"}/pasuR[1][2]`;
  const rerun = job.endOffset !== undefined ? `((pasuq(normal(${f}))[2]-(${job.endOffset}))/pasuq(normal(${g}))[2])` : `pasun(${f},${g})`;
  const level = (r: string): string => job.endLog!.replace(/pasux/g, `(${r})`);
  giac.eval(job.endLog !== undefined ? `pasuv:=pasul(${level(ratio)})` : `pasuv:=normal(${ratio})`);
  const value = numberOf(giac, "pasuv", job.endLog !== undefined ? `pasul(${level(rerun)})` : rerun, s, job.inexact);
  if (value) return done(value, "pasuv");
  // Not a number: a free name in it is the user's to fix; anything else (a timeout in the check) is the engine's.
  const names = giac.eval("lname(pasuv)");
  return /^\[\s*\]$/.test(names) || isError(names) ? { error: "engine", detail: `no number: ${num}` } : { error: "symbolic", detail: num };
}
