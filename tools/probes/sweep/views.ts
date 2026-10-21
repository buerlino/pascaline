// SPDX-License-Identifier: GPL-3.0-or-later
// G63: the pure half of the view sweep (r16 Appendix B "Plot comparison"). One value is asked of several views (Home, CAS evalf,
// Num, the plot evaluator, Solve, Slope, Area); each answer becomes a `View`, and two views of the same value must agree within
// the digits they both claim. No engine here, so a test can feed it fixed values.
import type { ComplexValue, DecimalValue } from "../../../app/src/engine/format.ts";

/** What a view answered: a real number with the significant digits its mark claims (null = a bare ⚠, no claim), a refusal, or something else (a complex number, a symbol, a timeout) that is not compared. */
export type View = { kind: "num"; v: number; claim: number | null } | { kind: "refused" } | { kind: "other" };

/** A decimal value as a double (digits are the leading significant digits, value = 0.d1d2… × 10^(exp+1)). */
export function decimalToNumber(d: DecimalValue): number {
  return d.digits === "" ? 0 : Number(`${d.neg ? "-" : ""}0.${d.digits}e${d.exp + 1}`);
}

/** The view of a numeric Home-style result: real finite values only; a complex or overflowing value is `other`. */
export function numView(v: ComplexValue, claim: number | null): View {
  const x = decimalToNumber(v.re);
  return v.im.digits !== "" || !Number.isFinite(x) ? { kind: "other" } : { kind: "num", v: x, claim };
}

/** A relative tolerance for a claim of n digits: one unit of the last digit, which covers two roundings of half a unit. */
export const relTol = (claim: number): number => 10 ** (1 - claim);

/**
 * Null when the two views agree; else what differs. A number against a refusal is a difference (F56: Area refused ∫₀¹ ln x
 * where Home shows −1); two refusals agree; a view that is not a real number or claims no digit is not compared with a number.
 */
export function compareViews(a: View, b: View): string | null {
  if (a.kind === "other" || b.kind === "other") return null;
  if (a.kind === "refused" && b.kind === "refused") return null;
  if (a.kind === "refused" || b.kind === "refused") {
    const n = a.kind === "num" ? a : (b as Extract<View, { kind: "num" }>);
    return `${a.kind === "num" ? fmt(a.v) : "refused"} against ${b.kind === "num" ? fmt(b.v) : "refused"} (${a.kind === "refused" ? "first" : "second"} refuses, the other shows ${fmt(n.v)})`;
  }
  if (a.claim === null || b.claim === null) return null;
  const tol = relTol(Math.min(a.claim, b.claim));
  const scale = Math.max(Math.abs(a.v), Math.abs(b.v));
  return Math.abs(a.v - b.v) <= tol * scale ? null : `${fmt(a.v)} against ${fmt(b.v)} (claims ${Math.min(a.claim, b.claim)} digits)`;
}

/** The plot evaluator against Giac's evalf(…, 20): 10⁻⁹ relative (with an absolute floor of 10⁻¹⁵ for values near 0). Where Giac's value is real; NaN or ±Infinity from the evaluator against a real value is a difference. */
export function comparePlot(plot: number, giac: number): string | null {
  if (!Number.isFinite(giac)) return null;
  if (!Number.isFinite(plot)) return `plot evaluator ${plot} against Giac ${fmt(giac)}`;
  return Math.abs(plot - giac) <= 1e-9 * Math.abs(giac) + 1e-15 ? null : `plot evaluator ${fmt(plot)} against Giac ${fmt(giac)}`;
}

const fmt = (v: number): string => v.toPrecision(14).replace(/\.?0+(e|$)/, "$1");
