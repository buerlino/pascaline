// SPDX-License-Identifier: GPL-3.0-or-later
// Exact-first Home evaluation (spike step 5, Q3).
//
// 1. Decimal literals become exact rationals (`0.1` → `(1/10)`), so `1-0.9-0.1` is exactly 0.
// 2. Giac evaluates exactly, under Giac's own interrupt (`timeout <s>`, sub-second with patch 0002).
// 3. The value becomes a DecimalValue (format.ts) and is shown in STD at `digits`: exact rationals with BigInt
//    arithmetic, everything else from `evalf` at P = max(40, digits+10) digits, confirmed by a second evaluation
//    (numeric.ts, docs/04 section 2.4). Only confirmed digits are shown; the facts for the mark go with the result.
//    Rounding is half away from zero.
// Guards: timeout → re-evaluate in floating point at W = max(workDigits, digits+10) and at W+20, and round.
// Result over `maxExactDigits` digits → shown from the exact value, but Ans keeps a float so the
// blow-up doesn't propagate (`guardMode: "reeval-float"` re-evaluates in float instead, as a comparison).
//
// Runs synchronously next to the engine (inside the Giac worker, or in Node for tests). Only
// erasable TypeScript syntax, so Node runs this file directly.
import { formatConfirmed, isZero, tieRisk, type ComplexValue, type PrecisionWarn } from "./format.ts";
import {
  doubleFallback,
  exactFacts,
  floatFacts,
  floatPathFacts,
  hasFloat,
  rationalValue,
  shapeOf,
  valuePrecision,
  type ElementFacts,
  type Giac,
  type Shape,
} from "./numeric.ts";

export type { Giac };

export interface HomeSettings {
  /** Significant digits shown (CLAUDE.md: 12). */
  digits: number;
  angle: "rad" | "deg";
  /** Exact evaluation budget; Giac interrupts itself after this. */
  budgetMs: number;
  /** Numerator/denominator size above which the result stops being carried exactly. */
  maxExactDigits: number;
  /** Working precision of the float fallback (at least digits+10 is used, docs/04 section 2.5). */
  workDigits: number;
  guardMode: "round-exact" | "reeval-float";
  /** Exact integer powers b^n with |n·ln b| above this fail at once ("Exponent overflow") and go to
   *  the float path. The host applies it with the engine's giac_set_pow_limit(); Giac's default is 1e8.
   *  1e5 ≈ results up to ~43,000 digits. */
  powLimit: number;
}

export const defaultHomeSettings: HomeSettings = {
  digits: 12,
  angle: "rad",
  budgetMs: 300,
  maxExactDigits: 20,
  workDigits: 30,
  guardMode: "round-exact",
  powLimit: 1e5,
};

/** `numeric`: a value from a numeric method (Solve, Function analysis) at work precision, rounded for display. */
export type HomePath = "exact" | "exact-big" | "float-big" | "float-timeout" | "float-error" | "numeric";

export interface HomeResult {
  ok: boolean;
  /** Canonical text: STD at `digits` (format.ts), Giac's text for non-numbers, the error text when !ok. */
  display: string;
  /** The numeric value, for re-formatting in STD/SCI/ENG without the engine (format.ts). Absent for non-numbers. */
  value?: ComplexValue;
  /** Exact Giac result when the exact path finished (may be long). */
  exact?: string;
  path: HomePath;
  /** True when the shown value comes from floating point, not from the exact result. */
  approximate: boolean;
  /** A 40-digit expansion ended in 4999…/5000… at the rounding position (double-rounding risk). */
  tieRisk: boolean;
  exactMs: number;
  totalMs: number;
  /** Set by the engine host when !ok: "syntax" (Giac could not parse the input) or "engine". */
  error?: "syntax" | "engine";
  /** The value is exactly p/q or an integer; with the format this decides "=" (docs/04 section 2.4, 8.2). */
  exactRational: boolean;
  /** Digits confirmed by the agreement check; null = exact (no digit is in doubt). */
  reliableDigits: number | null;
  /** The text to copy and the `\res` chip value: the exact text or P digits (docs/04 section 2.6, 3.6). */
  full: string;
  /** What a stateful input defined, for the live Find items (docs/04 section 3.4). */
  defined?: { name: string; kind: "var" | "fn" };
  /** Elements of a numeric list or matrix (rows flattened, with `shape`). */
  items?: HomeResult[];
  /** [rows, columns] of `items` for a matrix; absent for a list. */
  shape?: [number, number];
  /** ⚠ although the digits agree: an un-audited function's float, or a value that could be evaluated only once. */
  warn?: PrecisionWarn;
}

/** Placeholder precision facts until the engine fills them (docs/04 section 8.2): no claim of exactness, `full` = the display. */
export function safePrecision(display: string): Pick<HomeResult, "exactRational" | "reliableDigits" | "full"> {
  return { exactRational: false, reliableDigits: null, full: display };
}

/**
 * Our definitions, by name, loaded into Giac on the first input that mentions the name (EngineHost.need): defining
 * them costs ~10 ms on the desktop, which must not land on the engine-ready path.
 * `sigfig(x,n)` (docs/04 section 2.5): x rounded to n significant digits, half away from zero, as an exact rational,
 * so `sigfig(1/3,3)` is exactly 333/1000. The power of ten is found by exact comparisons (a float log10 can land on
 * the wrong side at 999.95); an irrational x is first evaluated with n+30 digits.
 */
export const ENGINE_DEFINITIONS: Readonly<Record<string, string>> = {
  sigfig:
    "sigfig(x,n):={ local a,p,k,m; " +
    'if (type(n)!=integer or n<1) throw("sigfig: n must be a positive integer"); ' +
    "if (x==0) return 0; " +
    'if (type(x)!=integer and type(x)!=rational) { x:=evalf(x,n+30); if (type(x)!=real) throw("sigfig: x must be a real number"); } ' +
    "a:=abs(x); p:=floor(evalf(log10(a),30)); while (10^p>a) p:=p-1; while (10^(p+1)<=a) p:=p+1; " +
    "k:=n-1-p; m:=floor(a*10^k+1/2); return sign(x)*m/10^k; }",
};

/** The names of our definitions that `input` mentions. */
export function definitionsUsedBy(input: string): string[] {
  return Object.keys(ENGINE_DEFINITIONS).filter((name) => new RegExp(`\\b${name}\\b`).test(input));
}

/** Engine-side setup for Home; the host runs these once (and again after a settings change). */
export function homeSetupCommands(s: HomeSettings): string[] {
  return [
    `angle_radian:=${s.angle === "rad" ? 1 : 0}`,
    `timeout ${(s.budgetMs / 1000).toFixed(3)}`,
    // How often control_c() looks at the clock: every 10th check (engine/giac/patches/README.md, patch 0002).
    "ckevery 10",
  ];
}

// --- 1. decimal literals → exact rationals -------------------------------------------------

const DECIMAL = /(\d+\.\d*|\.\d+|\d+)([eE][+-]?\d+)?/y;

/** Rewrites decimal literals (`2.5`, `.5`, `1e-3`, `1.2E5`) as exact rationals. Leaves integers,
 *  identifiers (`x1`, `0x1F`) and strings alone. */
export function toExactLiterals(input: string): string {
  let out = "";
  let i = 0;
  while (i < input.length) {
    const c = input.charAt(i);
    if (c === '"') {
      const end = input.indexOf('"', i + 1);
      const j = end < 0 ? input.length : end + 1;
      out += input.slice(i, j);
      i = j;
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      const m = /[A-Za-z_0-9]+/y;
      m.lastIndex = i;
      const w = m.exec(input)![0];
      out += w;
      i += w.length;
      continue;
    }
    if (/[0-9.]/.test(c)) {
      DECIMAL.lastIndex = i;
      const m = DECIMAL.exec(input);
      if (m && m[0] !== ".") {
        const lit = m[0];
        const mant = m[1] ?? "";
        const exp = m[2];
        if (!mant.includes(".") && !exp) out += lit;
        else out += exactRational(mant, exp ? parseInt(exp.slice(1), 10) : 0);
        i += lit.length;
        continue;
      }
    }
    out += c;
    i++;
  }
  return out;
}

function exactRational(mant: string, exp10: number): string {
  const [ip, fp = ""] = mant.split(".");
  const digits = (ip + fp).replace(/^0+(?=\d)/, "");
  const e = exp10 - fp.length;
  if (e === 0) return digits;
  return e > 0 ? `(${digits}*10^${e})` : `(${digits}/10^${-e})`;
}


// --- 2. evaluation ---------------------------------------------------------------------------

function isError(out: string): boolean {
  return out.startsWith("GIAC_ERROR");
}

function isTimeout(out: string): boolean {
  return isError(out) && /interrupt/i.test(out);
}

// Inputs that change engine state and must be replayed after a restart.
const STATEFUL = /:=|=>|\b(purge|assume|additionally)\s*\(/;

export function isStateful(input: string): boolean {
  return STATEFUL.test(input);
}

/** `name:=value` with a plain variable name: evaluated as the value, then stored (so a check may run it twice). */
export function simpleAssignment(input: string): { name: string; rhs: string } | null {
  const m = /^\s*([A-Za-z][A-Za-z0-9_]*)\s*:=([\s\S]+)$/.exec(input);
  return m ? { name: m[1]!, rhs: m[2]! } : null;
}

/** What an input defines, for the live Find items (docs/04 section 3.4). */
export function definedBy(input: string): { name: string; kind: "var" | "fn" } | undefined {
  const a = simpleAssignment(input);
  if (a) return { name: a.name, kind: "var" };
  const f = /^\s*([A-Za-z][A-Za-z0-9_]*)\s*\([^()]*\)\s*:=/.exec(input);
  if (f) return { name: f[1]!, kind: "fn" };
  const sto = /=>\s*([A-Za-z][A-Za-z0-9_]*)\s*$/.exec(input);
  return sto ? { name: sto[1]!, kind: "var" } : undefined;
}

/** Longest exact text kept as `full` (docs/04 section 2.8: ≤ 2 kB). */
export const FULL_EXACT_MAX = 2048;

/**
 * `regroup` on the stored answer `name` (x*x -> x^2), kept only when it merges equal factors, i.e. has
 * fewer "*" than `text`. Otherwise regroup would just reorder (factor's (x-1)*(x+1) -> (x+1)*(x-1))
 * and `text` and the stored answer stay as they were.
 */
export function regrouped(giac: Giac, name: string, text: string): string {
  const out = giac.eval(`regroup(${name})`);
  if (isError(out) || out === "undef" || out.split("*").length >= text.split("*").length) return text;
  giac.eval(`${name}:=regroup(${name})`);
  return out;
}

/** The precision fields of a result built from its element facts (docs/04 section 8.2). */
interface Built {
  display: string;
  value?: ComplexValue;
  items?: HomeResult[];
  shape?: [number, number];
  exactRational: boolean;
  reliableDigits: number | null;
  warn?: PrecisionWarn;
  tieRisk: boolean;
  /** The value as a decimal with every confirmed digit up to P (copy, chips). */
  decimal: string;
}

function element(f: ElementFacts, digits: number, P: number, path: HomePath, approximate: boolean): HomeResult {
  const facts = { value: f.value, exactRational: f.exactRational, reliableDigits: f.reliableDigits, ...(f.warn ? { warn: f.warn } : {}) };
  const display = formatConfirmed(facts, { format: "STD", digits })!;
  return {
    ok: true,
    display,
    ...facts,
    full: formatConfirmed(facts, { format: "STD", digits: P })!,
    path,
    approximate,
    tieRisk: !f.exactRational && (tieRisk(f.value.re, digits) || (!isZero(f.value.im) && tieRisk(f.value.im, digits))),
    exactMs: 0,
    totalMs: 0,
  };
}

/** A numeric HomeResult from element facts (CAS numeric results use it too). */
export function resultFromFacts(facts: ElementFacts[], shape: Shape, digits: number, path: HomePath, approximate: boolean, ms = 0): HomeResult {
  const { decimal, ...b } = build(facts, shape, digits, path, approximate);
  return { ok: true, ...b, full: decimal, path, approximate, exactMs: 0, totalMs: ms };
}

function build(facts: ElementFacts[], shape: Shape, digits: number, path: HomePath, approximate: boolean): Built {
  const P = valuePrecision(digits);
  const els = facts.map((f) => element(f, digits, P, path, approximate));
  if (shape.kind === "scalar") {
    const e = els[0]!;
    return {
      display: e.display,
      value: e.value!,
      exactRational: e.exactRational,
      reliableDigits: e.reliableDigits,
      ...(e.warn ? { warn: e.warn } : {}),
      tieRisk: e.tieRisk,
      decimal: e.full,
    };
  }
  const shp: [number, number] | undefined = shape.kind === "matrix" ? [shape.rows, shape.cols] : undefined;
  const reliable = els.reduce<number | null>((n, e) => (e.reliableDigits === null ? n : n === null ? e.reliableDigits : Math.min(n, e.reliableDigits)), null);
  const warn = els.find((e) => e.warn)?.warn;
  const fmt = (key: "display" | "full") =>
    shp ? `[${Array.from({ length: shp[0] }, (_, r) => `[${els.slice(r * shp[1], (r + 1) * shp[1]).map((e) => e[key]).join(",")}]`).join(",")}]` : `[${els.map((e) => e[key]).join(",")}]`;
  return {
    display: fmt("display"),
    items: els,
    ...(shp ? { shape: shp } : {}),
    exactRational: els.every((e) => e.exactRational),
    reliableDigits: reliable,
    ...(warn ? { warn } : {}),
    tieRisk: els.some((e) => e.tieRisk),
    decimal: fmt("full"),
  };
}

/**
 * An exact non-rational scalar whose value printed as a short decimal (`8^(1/3)` → 2.000…): Giac may prove it rational
 * with `simplify`. Then it is exact (and Ans becomes the rational). Only tried when the digits look like it, so it
 * costs nothing for ordinary irrational results.
 */
function provedRational(giac: Giac, name: string, f: ElementFacts, digits: number): ElementFacts | null {
  if (f.exactRational || f.value.re.sticky || f.value.im.sticky) return null;
  if (f.value.re.digits.length > digits || f.value.im.digits.length > digits) return null;
  const out = giac.eval(`simplify(${name})`);
  if (isError(out)) return null;
  const re = giac.eval(`re(simplify(${name}))`);
  const im = giac.eval(`im(simplify(${name}))`);
  const a = rationalValue(re);
  const b = rationalValue(im);
  if (!a || !b) return null;
  giac.eval(`${name}:=simplify(${name})`);
  return { value: { re: a.v, im: b.v }, exactRational: true, reliableDigits: null, big: false };
}

export function homeEval(
  giac: Giac,
  input: string,
  s: HomeSettings = defaultHomeSettings,
  now: () => number = () => performance.now(),
): HomeResult {
  const t0 = now();
  const ans = "pasans";
  const asg = simpleAssignment(input);
  const body = asg ? asg.rhs : input;
  // Other stateful inputs (f(x):=…, purge, assume, =>) must not run twice.
  const once = !asg && isStateful(input);
  const exactBody = toExactLiterals(body);
  const exactOut = giac.eval(`${ans}:=(${exactBody})`);
  const exactMs = now() - t0;
  const W = Math.max(s.workDigits, s.digits + 10);
  const defined = definedBy(input);
  const store = () => {
    if (asg) giac.eval(`${asg.name}:=${ans}`);
  };

  const done = (r: Omit<HomeResult, "exactMs" | "totalMs" | "full"> & { full?: string }): HomeResult => ({
    ...r,
    full: r.full ?? r.display,
    ...(r.ok && defined ? { defined } : {}),
    exactMs,
    totalMs: now() - t0,
  });
  const fromBuilt = (b: Built, path: HomePath, approximate: boolean, exact: string | undefined, full: string): HomeResult => {
    const { decimal: _d, ...rest } = b;
    return done({ ok: true, ...rest, ...(exact !== undefined ? { exact } : {}), path, approximate, full });
  };
  const failed = (display: string, path: HomePath, exact?: string): HomeResult =>
    done({ ok: false, display, ...(exact !== undefined ? { exact } : {}), path, approximate: true, tieRisk: false, exactRational: false, reliableDigits: null });

  const viaFloat = (path: HomePath, exact?: string): HomeResult => {
    const f = floatPathFacts(giac, ans, asg ? asg.rhs : input, once, W, s.digits);
    if ("error" in f) return failed(f.error, path, exact);
    store();
    const b = build(f.facts, f.shape, s.digits, path, true);
    return fromBuilt(b, path, true, exact, b.decimal);
  };

  if (isTimeout(exactOut)) return viaFloat("float-timeout");
  if (isError(exactOut)) return viaFloat("float-error");

  const shape = shapeOf(exactOut);
  const symbolic = (): HomeResult => {
    // Not a number (symbolic, a set, a nested list…): show Giac's text. This build does not apply the
    // "regroup" autosimplify at the top level (x*x stays x*x), so collect equal factors here.
    const text = exactOut.includes("*") ? regrouped(giac, ans, exactOut) : exactOut;
    store();
    return done({ ok: true, display: text, exact: text, path: "exact", approximate: false, tieRisk: false, exactRational: false, reliableDigits: null });
  };
  if (!shape) return symbolic();

  if (hasFloat(exactOut)) {
    // Giac's numeric code returned a float on the exact path (rule 3).
    const facts = floatFacts(giac, ans, once ? null : exactBody, shape, s.digits, s.digits);
    if (!facts) return symbolic();
    store();
    const b = build(facts, shape, s.digits, "exact", true);
    return fromBuilt(b, "exact", true, exactOut, b.decimal);
  }

  let facts = exactFacts(giac, ans, shape, s.digits, s.maxExactDigits);
  if (!facts) {
    const d = shape.kind === "scalar" ? doubleFallback(giac, ans, body, s.digits, s.digits) : null;
    if (!d) return symbolic();
    store();
    const b = build([d], shape, s.digits, "exact", true);
    return fromBuilt(b, "exact", true, exactOut, b.decimal);
  }
  let exactText = exactOut;
  if (shape.kind === "scalar" && !facts[0]!.exactRational) {
    const proved = provedRational(giac, ans, facts[0]!, valuePrecision(s.digits));
    if (proved) {
      facts = [proved];
      exactText = giac.eval(ans);
    }
  }
  store();
  const b = build(facts, shape, s.digits, "exact", false);
  const full = exactText.length <= FULL_EXACT_MAX ? exactText : b.decimal;
  const big = shape.kind === "scalar" && facts[0]!.big;
  if (!big) return fromBuilt(b, "exact", false, exactText, full);
  if (s.guardMode === "reeval-float") return viaFloat("float-big", exactText);
  // Shown from the exact value (already computed); Ans continues as a float.
  giac.eval(`${ans}:=evalf(${ans},${W})`);
  return fromBuilt(b, "exact-big", false, exactText, full);
}
