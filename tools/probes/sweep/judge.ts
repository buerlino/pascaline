// SPDX-License-Identifier: GPL-3.0-or-later
// G61: the judge of the oracle sweep (r16 Appendix B). Pure: it takes what Home showed and what mpmath says, and says whether the
// mark told the truth. No engine here. `=` must equal the oracle to 1e-50, `≈` must be within half a unit of the shown digits, `⚠ n`
// within one unit of the nth digit, a bare `⚠` claims nothing, a part not shown must be small against the claim, and a shown part where
// the oracle has 0 is wrong. A number where the oracle has no value is wrong; a hang is a finding.
import { roundSignificant, type ComplexValue, type DecimalValue } from "../../../app/src/engine/format.ts";

/** What mpmath says about an input (oracle.py): a value (re and im as decimal text at 100 digits), none, or a reason to skip it. */
export type Oracle = { kind: "value"; re: string; im: string } | { kind: "novalue" } | { kind: "skip"; reason: string };

/** What Home showed for the input, in the shape the worker thread sends back. `hang` is a missed deadline (the worker was killed). */
export interface Shown {
  hang?: true;
  ok?: boolean;
  error?: string;
  display?: string;
  value?: ComplexValue;
  /** markOf's mark and count for the setting digits. */
  mark?: "=" | "≈" | "⚠";
  n?: number;
}

export type VerdictKind = "ok" | "wrong" | "novalue" | "hang" | "skip" | "refused" | "nonnumber";
export interface Verdict {
  kind: VerdictKind;
  /** The failed check, for the known-failures list: `=`, `≈`, `⚠n`, `part` (a part not shown or shown against a 0), `novalue`, `hang`. */
  check?: string;
  detail?: string;
}

/** A decimal number m·10^e. */
interface Dec {
  m: bigint;
  e: number;
}

export function parseDec(text: string): Dec | null {
  const t = /^([+-]?)(\d*)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/.exec(text.trim());
  if (!t || (t[2] === "" && (t[3] ?? "") === "")) return null;
  const frac = t[3] ?? "";
  const m = BigInt(`${t[2] || "0"}${frac}`) * (t[1] === "-" ? -1n : 1n);
  return { m, e: Number(t[4] ?? 0) - frac.length };
}

const abs = (a: Dec): Dec => ({ m: a.m < 0n ? -a.m : a.m, e: a.e });
const isZeroDec = (a: Dec): boolean => a.m === 0n;
/** floor(log10|a|) + 1, the magnitude; -Infinity for zero. */
const mag = (a: Dec): number => (a.m === 0n ? -Infinity : a.e + (a.m < 0n ? -a.m : a.m).toString().length);

function sub(a: Dec, b: Dec): Dec {
  if (isZeroDec(a)) return { m: -b.m, e: b.e };
  if (isZeroDec(b)) return a;
  // far apart: the larger one is the difference to any digit that matters here
  if (Math.abs(mag(a) - mag(b)) > 700) return mag(a) > mag(b) ? a : { m: -b.m, e: b.e };
  const e = Math.min(a.e, b.e);
  return { m: a.m * 10n ** BigInt(a.e - e) - b.m * 10n ** BigInt(b.e - e), e };
}

/** |a| <= c·10^p, with c a small integer or a half (given as c2 = 2c). */
function atMost(a: Dec, c2: bigint, p: number): boolean {
  const x = abs(a);
  if (x.m === 0n) return true;
  // x.m·10^x.e <= c2/2 · 10^p  <=>  2·x.m·10^(x.e-p) <= c2
  const k = x.e - p;
  if (k > 800) return false;
  if (k < -800) return true;
  return k >= 0 ? 2n * x.m * 10n ** BigInt(k) <= c2 : 2n * x.m <= c2 * 10n ** BigInt(-k);
}

const bigger = (a: Dec, b: Dec): Dec => (mag(a) >= mag(b) ? a : b);

/** A shown part (a DecimalValue rounded to `digits` significant digits) as Dec. */
function shownDec(v: DecimalValue, digits: number | null): Dec {
  if (v.digits === "") return { m: 0n, e: 0 };
  const r = digits === null ? { neg: v.neg, digits: v.digits, exp: v.exp } : roundSignificant(v, digits);
  return { m: BigInt(r.digits) * (r.neg ? -1n : 1n), e: r.exp - (r.digits.length - 1) };
}

/** What the mark claims, as significant digits: `=` all of them, `≈` the setting's, `⚠ n` n, a bare `⚠` nothing. */
function claimOf(mark: "=" | "≈" | "⚠", n: number | undefined, digits: number): number | null {
  if (mark === "⚠") return n === undefined || n < 1 ? null : n; // a bare ⚠ and ⚠ 0 claim no digit
  return digits;
}

const tinyRel = (a: Dec, b: Dec, p: number): boolean => atMost(sub(a, b), 2n, mag(bigger(a, b)) - p); // |a-b| <= 10^-p · 10^mag

/**
 * The verdict for one input. `digits` is the setting the input ran at. Parts are judged one by one; the first failure is returned.
 */
export function judge(shown: Shown, oracle: Oracle, digits: number): Verdict {
  if (shown.hang) return { kind: "hang", check: "hang", detail: "no answer before the deadline" };
  if (oracle.kind === "skip") return { kind: "skip", detail: oracle.reason };
  if (!shown.ok) {
    return { kind: "refused", detail: `${shown.error ?? "error"}: ${shown.display ?? ""}`.slice(0, 80) };
  }
  if (!shown.value) {
    return oracle.kind === "novalue" ? { kind: "ok", detail: "no number shown where there is no value" } : { kind: "nonnumber", detail: (shown.display ?? "").slice(0, 80) };
  }
  if (oracle.kind === "novalue") return { kind: "novalue", check: "novalue", detail: `shows ${shown.display ?? "a number"} where the oracle has no value` };
  const mark = shown.mark ?? "≈";
  const claim = claimOf(mark, shown.n, digits);
  const o = { re: parseDec(oracle.re), im: parseDec(oracle.im) };
  if (!o.re || !o.im) return { kind: "skip", detail: "unreadable oracle" };
  const label = mark === "=" ? "=" : mark === "≈" ? "≈" : "⚠n";
  const scale = bigger(abs(o.re), abs(o.im));
  const parts = [
    ["re", shown.value.re, o.re],
    ["im", shown.value.im, o.im],
  ] as const;
  for (const [name, v, ov] of parts) {
    const zeroShown = v.digits === "";
    if (zeroShown) {
      // a part not shown must be below two digits past the claim, relative to the value (the larger part)
      if (isZeroDec(ov)) continue;
      const nn = claim ?? 0;
      if (claim === null && mark === "⚠") continue;
      if (mark === "=" ? !isZeroDec(ov) && !tinyRel(ov, scale, 50) : !atMost(ov, 2n, mag(scale) - (nn + 2))) {
        return { kind: "wrong", check: "part", detail: `${name} not shown, oracle ${oracle[name]}` };
      }
      continue;
    }
    if (isZeroDec(ov)) {
      if (mark === "⚠" && claim === null) continue;
      return { kind: "wrong", check: "part", detail: `${name} shown ${shown.display ?? ""} where the oracle has 0` };
    }
    if (claim === null) continue;
    if (mark === "=") {
      const s = shownDec(v, null);
      if (!tinyRel(s, ov, 50)) return { kind: "wrong", check: "=", detail: `${name}: = ${shown.display ?? ""}, oracle ${oracle[name]}` };
      continue;
    }
    const s = shownDec(v, digits);
    const unitExp = s.e + (s.m < 0n ? -s.m : s.m).toString().length - 1 - (claim - 1); // 10^unitExp: one unit of the claimed digit
    const ok = mark === "≈" ? atMost(sub(s, ov), 1n, unitExp) : atMost(sub(s, ov), 2n, unitExp);
    if (!ok) {
      const gap = sub(s, ov);
      const from = Math.max(1, Math.min(claim, mag(s) - mag(gap)));
      return { kind: "wrong", check: label, detail: `${name}: ${mark}${mark === "⚠" ? ` ${claim}` : ""} ${shown.display ?? ""}, oracle ${oracle[name]} (right to ${from} digits)` };
    }
  }
  return { kind: "ok", ...(mark === "⚠" && claim === null ? { detail: "⚠ without a count" } : {}) };
}
