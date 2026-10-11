// SPDX-License-Identifier: GPL-3.0-or-later
// Exact-first Home evaluation (spike step 5, Q3).
//
// 1. Decimal literals become exact rationals (`0.1` → `(1/10)`), so `1-0.9-0.1` is exactly 0.
// 2. Giac evaluates exactly, under Giac's own interrupt (`timeout <s>`, sub-second with patch 0002).
// 3. The value becomes a DecimalValue (format.ts) and is shown in STD at `digits`: exact rationals with BigInt
//    arithmetic, everything else from a 40-digit `evalf` string. Rounding is half away from zero.
// Guards: timeout → re-evaluate in floating point at `workDigits` and round (marked approximate).
// Result over `maxExactDigits` digits → shown from the exact value, but Ans keeps a float so the
// blow-up doesn't propagate (`guardMode: "reeval-float"` re-evaluates in float instead, as a comparison).
//
// Runs synchronously next to the engine (inside the Giac worker, or in Node for tests). Only
// erasable TypeScript syntax, so Node runs this file directly.
import {
  decimalFromRational,
  decimalFromString,
  formatComplex,
  tieRisk,
  type ComplexValue,
  type DecimalValue,
} from "./format.ts";

export interface Giac {
  eval(input: string): string;
}

export interface HomeSettings {
  /** Significant digits shown (CLAUDE.md: 12). */
  digits: number;
  angle: "rad" | "deg";
  /** Exact evaluation budget; Giac interrupts itself after this. */
  budgetMs: number;
  /** Numerator/denominator size above which the result stops being carried exactly. */
  maxExactDigits: number;
  /** Working precision of the float fallback. */
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

export type HomePath = "exact" | "exact-big" | "float-big" | "float-timeout" | "float-error";

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
}

/** Engine-side setup for Home; the host runs these once (and again after a settings change). */
export function homeSetupCommands(s: HomeSettings): string[] {
  return [
    `angle_radian:=${s.angle === "rad" ? 1 : 0}`,
    `timeout ${(s.budgetMs / 1000).toFixed(3)}`,
    // How often control_c() looks at the clock: every 10th check. See spike/home/NOTES.md for the cost.
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

const RATIONAL = /^(-?\d+)(?:\/(\d+))?$/;

function isError(out: string): boolean {
  return out.startsWith("GIAC_ERROR");
}

function isTimeout(out: string): boolean {
  return isError(out) && /interrupt/i.test(out);
}

/** One real part (a Giac expression such as `re(pasans)`) as a DecimalValue: exact rationals by
 *  BigInt division, everything else from a 40-digit `evalf` string. `big`: an exact rational whose
 *  numerator or denominator has more than maxDigits digits. `tieRisk` only for float strings. */
function valuePart(
  giac: Giac,
  part: string,
  n: number,
  maxDigits: number,
): { v: DecimalValue; big: boolean; tieRisk: boolean } | null {
  const out = giac.eval(part);
  const q = RATIONAL.exec(out);
  if (q) {
    const [, num = "0", den = "1"] = q;
    const big = num.replace("-", "").length > maxDigits || den.length > maxDigits;
    return { v: decimalFromRational(BigInt(num), BigInt(den)), big, tieRisk: false };
  }
  const f = decimalFromString(giac.eval(`evalf(${part},40)`));
  return f ? { v: f, big: false, tieRisk: tieRisk(f, n) } : null;
}

function numericValue(
  giac: Giac,
  v: string,
  n: number,
  maxDigits: number,
): { value: ComplexValue; text: string; big: boolean; tieRisk: boolean } | null {
  const re = valuePart(giac, `re(${v})`, n, maxDigits);
  const im = valuePart(giac, `im(${v})`, n, maxDigits);
  if (!re || !im) return null;
  const value = { re: re.v, im: im.v };
  return {
    value,
    text: formatComplex(value, { format: "STD", digits: n }).text,
    big: re.big || im.big,
    tieRisk: re.tieRisk || im.tieRisk,
  };
}

function floatEval(giac: Giac, input: string, s: HomeSettings): { out: string; ok: boolean } {
  giac.eval(`Digits:=${s.workDigits}`);
  try {
    const out = giac.eval(`pasans:=(${input})`);
    return { out, ok: !isError(out) };
  } finally {
    giac.eval(`Digits:=${s.digits}`);
  }
}

export function homeEval(
  giac: Giac,
  input: string,
  s: HomeSettings = defaultHomeSettings,
  now: () => number = () => performance.now(),
): HomeResult {
  const t0 = now();
  const exactOut = giac.eval(`pasans:=(${toExactLiterals(input)})`);
  const exactMs = now() - t0;
  const done = (r: Omit<HomeResult, "exactMs" | "totalMs">): HomeResult => ({ ...r, exactMs, totalMs: now() - t0 });

  const viaFloat = (path: HomePath, exact?: string): HomeResult => {
    const f = floatEval(giac, input, s);
    if (!f.ok) return done({ ok: false, display: f.out, exact, path, approximate: true, tieRisk: false });
    const v = numericValue(giac, "pasans", s.digits, s.maxExactDigits);
    if (!v) return done({ ok: false, display: f.out, exact, path, approximate: true, tieRisk: false });
    return done({ ok: true, display: v.text, value: v.value, exact, path, approximate: true, tieRisk: v.tieRisk });
  };

  if (isTimeout(exactOut)) return viaFloat("float-timeout");
  if (isError(exactOut)) return viaFloat("float-error");

  const v = numericValue(giac, "pasans", s.digits, s.maxExactDigits);
  if (!v) {
    // Not a number (symbolic, list, matrix…): out of scope for this spike; show Giac's text.
    return done({ ok: true, display: exactOut, exact: exactOut, path: "exact", approximate: false, tieRisk: false });
  }
  if (!v.big) {
    return done({ ok: true, display: v.text, value: v.value, exact: exactOut, path: "exact", approximate: false, tieRisk: v.tieRisk });
  }
  if (s.guardMode === "reeval-float") return viaFloat("float-big", exactOut);
  // Shown from the exact value (already computed); Ans continues as a float.
  giac.eval(`pasans:=evalf(pasans,${s.workDigits})`);
  return done({ ok: true, display: v.text, value: v.value, exact: exactOut, path: "exact-big", approximate: false, tieRisk: v.tieRisk });
}
