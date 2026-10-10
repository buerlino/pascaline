// SPDX-License-Identifier: GPL-3.0-or-later
// Exact-first Home evaluation (spike step 5, Q3).
//
// 1. Decimal literals become exact rationals (`0.1` → `(1/10)`), so `1-0.9-0.1` is exactly 0.
// 2. Giac evaluates exactly, under Giac's own interrupt (`timeout <s>`, sub-second with patch 0002).
// 3. The value is rounded to `digits` significant digits at the end: exact rationals with BigInt
//    arithmetic, everything else from a 40-digit `evalf` string. Rounding is half away from zero.
// Guards: timeout → re-evaluate in floating point at `workDigits` and round (marked approximate).
// Result over `maxExactDigits` digits → shown from the exact value, but Ans keeps a float so the
// blow-up doesn't propagate (`guardMode: "reeval-float"` re-evaluates in float instead, as a comparison).
//
// Runs synchronously next to the engine (inside the Giac worker, or in Node for tests). Only
// erasable TypeScript syntax, so Node runs this file directly.

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
}

export const defaultHomeSettings: HomeSettings = {
  digits: 12,
  angle: "rad",
  budgetMs: 300,
  maxExactDigits: 20,
  workDigits: 30,
  guardMode: "round-exact",
};

export type HomePath = "exact" | "exact-big" | "float-big" | "float-timeout" | "float-error";

export interface HomeResult {
  ok: boolean;
  /** Canonical display string (see formatDecimal), or the error text when !ok. */
  display: string;
  /** Exact Giac result when the exact path finished (may be long). */
  exact?: string;
  path: HomePath;
  /** True when the shown value comes from floating point, not from the exact result. */
  approximate: boolean;
  /** A 40-digit expansion ended in 4999…/5000… at the rounding position (double-rounding risk). */
  tieRisk: boolean;
  exactMs: number;
  totalMs: number;
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
    const c = input[i];
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
        const [lit, mant, exp] = m;
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

// --- 3. rounding and formatting -------------------------------------------------------------

/** A rounded value: `digits` (no leading zeros, ≤ n digits) × 10^(exp - digits.length + 1), i.e.
 *  `exp` is the decimal exponent of the first digit. digits "0" means zero. */
export interface Rounded {
  neg: boolean;
  digits: string;
  exp: number;
  tieRisk: boolean;
}

const ZERO: Rounded = { neg: false, digits: "0", exp: 0, tieRisk: false };

function pow10(k: number): bigint {
  return 10n ** BigInt(k);
}

/** Round p/q (exact integers, q > 0) to n significant digits, half away from zero. */
export function roundRational(p: bigint, q: bigint, n: number): Rounded {
  if (p === 0n) return ZERO;
  const neg = p < 0n;
  if (neg) p = -p;
  let e = p.toString().length - q.toString().length;
  // 10^e ≤ p/q < 10^(e+1)
  const below = (k: number) => (k >= 0 ? p < q * pow10(k) : p * pow10(-k) < q);
  if (below(e)) e -= 1;
  const shift = n - 1 - e;
  const N = shift >= 0 ? p * pow10(shift) : p;
  const D = shift >= 0 ? q : q * pow10(-shift);
  let m = N / D;
  const r = N % D;
  if (2n * r >= D) m += 1n;
  if (m === pow10(n)) {
    m = pow10(n - 1);
    e += 1;
  }
  return { neg, digits: m.toString(), exp: e, tieRisk: false };
}

/** Round a printed Giac float (`-0.3141e6`, `1.414…`, `2.5e-07`) to n significant digits. */
export function roundDecimalString(s: string, n: number): Rounded | null {
  const m = /^(-?)(\d*)\.?(\d*)(?:e([+-]?\d+))?$/.exec(s.trim());
  if (!m || (m[2] === "" && m[3] === "")) return null;
  const neg = m[1] === "-";
  const all = m[2] + m[3];
  const lead = all.search(/[1-9]/);
  if (lead < 0) return ZERO;
  // value = 0.all × 10^(len(int part)) × 10^E; first significant digit sits at exponent:
  const exp = m[2].length - 1 - lead + (m[4] ? parseInt(m[4], 10) : 0);
  const sig = all.slice(lead);
  const head = sig.slice(0, n).padEnd(n, "0");
  const rest = sig.slice(n);
  const tieRisk = rest.length >= 2 && /^(49+|50+)$/.test(rest.slice(0, Math.min(rest.length, 20)));
  let d = BigInt(head);
  let e = exp;
  if (rest.length > 0 && rest[0] >= "5") d += 1n;
  if (d === pow10(n)) {
    d = pow10(n - 1);
    e += 1;
  }
  return { neg, digits: d.toString(), exp: e, tieRisk };
}

/** Canonical test/display form: plain decimal for 1e-4 ≤ |x| < 1e12, else `d.ddd…E±k`.
 *  (Our own format for tests; how the G2 shows numbers is a G2-checklist question.) */
export function formatDecimal(r: Rounded): string {
  if (r.digits === "0") return "0";
  const d = r.digits.replace(/0+$/, "") || "0";
  const sign = r.neg ? "-" : "";
  if (r.exp >= -4 && r.exp < 12) {
    if (r.exp < 0) return `${sign}0.${"0".repeat(-r.exp - 1)}${d}`;
    if (d.length <= r.exp + 1) return sign + d + "0".repeat(r.exp + 1 - d.length);
    return `${sign}${d.slice(0, r.exp + 1)}.${d.slice(r.exp + 1)}`;
  }
  const frac = d.slice(1);
  return `${sign}${d[0]}${frac ? "." + frac : ""}E${r.exp}`;
}

function formatComplex(re: Rounded, im: Rounded): string {
  if (im.digits === "0") return formatDecimal(re);
  const ims = formatDecimal({ ...im, neg: false });
  if (re.digits === "0") return `${im.neg ? "-" : ""}${ims}*i`;
  return `${formatDecimal(re)}${im.neg ? "-" : "+"}${ims}*i`;
}

// --- 2. evaluation ---------------------------------------------------------------------------

const RATIONAL = /^(-?\d+)(?:\/(\d+))?$/;

function isError(out: string): boolean {
  return out.startsWith("GIAC_ERROR");
}

function isTimeout(out: string): boolean {
  return isError(out) && /interrupt/i.test(out);
}

/** Round one real part (a Giac expression such as `re(pas_ans)`) to n digits. `big`: an exact
 *  rational whose numerator or denominator has more than maxDigits digits. */
function roundPart(giac: Giac, part: string, n: number, maxDigits: number): { r: Rounded; big: boolean } | null {
  const v = giac.eval(part);
  const q = RATIONAL.exec(v);
  if (q) {
    const big = q[1].replace("-", "").length > maxDigits || (q[2] ?? "").length > maxDigits;
    return { r: roundRational(BigInt(q[1]), BigInt(q[2] ?? "1"), n), big };
  }
  const f = roundDecimalString(giac.eval(`evalf(${part},40)`), n);
  return f ? { r: f, big: false } : null;
}

function roundValue(
  giac: Giac,
  v: string,
  n: number,
  maxDigits: number,
): { text: string; big: boolean; tieRisk: boolean } | null {
  const re = roundPart(giac, `re(${v})`, n, maxDigits);
  const im = roundPart(giac, `im(${v})`, n, maxDigits);
  if (!re || !im) return null;
  return { text: formatComplex(re.r, im.r), big: re.big || im.big, tieRisk: re.r.tieRisk || im.r.tieRisk };
}

function floatEval(giac: Giac, input: string, s: HomeSettings): { out: string; ok: boolean } {
  giac.eval(`Digits:=${s.workDigits}`);
  try {
    const out = giac.eval(`pas_ans:=(${input})`);
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
  const exactOut = giac.eval(`pas_ans:=(${toExactLiterals(input)})`);
  const exactMs = now() - t0;
  const done = (r: Omit<HomeResult, "exactMs" | "totalMs">): HomeResult => ({ ...r, exactMs, totalMs: now() - t0 });

  const viaFloat = (path: HomePath, exact?: string): HomeResult => {
    const f = floatEval(giac, input, s);
    if (!f.ok) return done({ ok: false, display: f.out, exact, path, approximate: true, tieRisk: false });
    const v = roundValue(giac, "pas_ans", s.digits, s.maxExactDigits);
    if (!v) return done({ ok: false, display: f.out, exact, path, approximate: true, tieRisk: false });
    return done({ ok: true, display: v.text, exact, path, approximate: true, tieRisk: v.tieRisk });
  };

  if (isTimeout(exactOut)) return viaFloat("float-timeout");
  if (isError(exactOut)) return viaFloat("float-error");

  const v = roundValue(giac, "pas_ans", s.digits, s.maxExactDigits);
  if (!v) {
    // Not a number (symbolic, list, matrix…): out of scope for this spike; show Giac's text.
    return done({ ok: true, display: exactOut, exact: exactOut, path: "exact", approximate: false, tieRisk: false });
  }
  if (!v.big) {
    return done({ ok: true, display: v.text, exact: exactOut, path: "exact", approximate: false, tieRisk: v.tieRisk });
  }
  if (s.guardMode === "reeval-float") return viaFloat("float-big", exactOut);
  // Shown from the exact value (already computed); Ans continues as a float.
  giac.eval(`pas_ans:=evalf(pas_ans,${s.workDigits})`);
  return done({ ok: true, display: v.text, exact: exactOut, path: "exact-big", approximate: false, tieRisk: v.tieRisk });
}
