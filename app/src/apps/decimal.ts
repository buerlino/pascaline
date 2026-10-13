// SPDX-License-Identifier: GPL-3.0-or-later
// Exact decimal steps for tables and trace positions: x = start + k·step without binary rounding, so the
// engine gets "0.3", not 0.30000000000000004. Values are BigInt mantissa × 10^-scale.
import { decimalFromString, formatReal, toText, type NumberFormat } from "../engine/format.ts";

export interface Dec {
  m: bigint;
  scale: number;
}

/** Parse a plain decimal ("-1.25", "3", ".5", "2e-3"); undefined if it is not one. */
export function parseDec(s: string): Dec | undefined {
  const t = s.trim();
  const r = /^([+-]?)(\d*)(?:\.(\d*))?(?:e([+-]?\d+))?$/i.exec(t);
  if (!r || (r[2] === "" && (r[3] ?? "") === "")) return undefined;
  const frac = r[3] ?? "";
  let m = BigInt(`${r[2] || "0"}${frac}`);
  let scale = frac.length - Number(r[4] ?? 0);
  if (scale < 0) {
    m *= 10n ** BigInt(-scale);
    scale = 0;
  }
  return { m: r[1] === "-" ? -m : m, scale };
}

/** The entry line as a plain decimal: "-0.5", "1.5\\emark3" (1.5ᴇ3), "1.5\\times10^{3}" → "1.5e3"; undefined if it is not one. */
export function plainNumber(latex: string): string | undefined {
  const s = latex
    .replace(/\\emark|\u1D07/, "e")
    .replace(/\\times\s*10\^\{([^}]*)\}/, "e$1")
    .replace(/\\times\s*10\^(\d)/, "e$1")
    .replace(/[{}\s]/g, "");
  return parseDec(s) ? s : undefined;
}

function align(a: Dec, b: Dec): [bigint, bigint, number] {
  const s = Math.max(a.scale, b.scale);
  return [a.m * 10n ** BigInt(s - a.scale), b.m * 10n ** BigInt(s - b.scale), s];
}

/** a + k·b */
export function addMul(a: Dec, k: number, b: Dec): Dec {
  const [am, bm, s] = align(a, b);
  return { m: am + BigInt(k) * bm, scale: s };
}

/** Plain text for the engine ("-0.25", "3"). */
export function decText(d: Dec): string {
  const neg = d.m < 0n;
  let digits = (neg ? -d.m : d.m).toString();
  if (d.scale > 0) {
    digits = digits.padStart(d.scale + 1, "0");
    const i = digits.length - d.scale;
    digits = `${digits.slice(0, i)}.${digits.slice(i)}`.replace(/\.?0+$/, "");
  }
  return `${neg && digits !== "0" ? "-" : ""}${digits}`;
}

export const decToNumber = (d: Dec): number => Number(decText(d));

/** A step of 1, 2 or 5 × 10^k close to `approx` (> 0). */
export function niceStep(approx: number): Dec {
  const e = Math.floor(Math.log10(approx));
  const f = approx / 10 ** e;
  const m = f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10;
  const k = m === 10 ? e + 1 : e;
  const mm = BigInt(m === 10 ? 1 : m);
  return k >= 0 ? { m: mm * 10n ** BigInt(k), scale: 0 } : { m: mm, scale: -k };
}

/** The multiple of `step` nearest to x (as k). */
export function nearestK(x: number, step: Dec): number {
  return Math.round(x / decToNumber(step));
}

/** A decimal string shown to the user through the Home formatter (never Number.toString). */
export function showDecimal(s: string, digits: number, format: NumberFormat = "STD"): string {
  const v = decimalFromString(s);
  return v ? toText(formatReal(v, { format, digits })) : s;
}
