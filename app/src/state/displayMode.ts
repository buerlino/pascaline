// SPDX-License-Identifier: GPL-3.0-or-later
// The Format key (fmt): cycles the display of the last result through the modes ticked in Settings.
// Plain logic, no Svelte: which modes apply to a result, what comes next, and how a result is drawn in a mode.
// All number formatting is engine/format.ts (our own formatter), never JS Number.toString.
import {
  formatComplex,
  formatFraction,
  formatPolar,
  isZero,
  type ComplexValue,
  type DecimalValue,
  type FormatOptions,
} from "../engine/format.ts";
import { complexToLatex, fractionToLatex, polarToLatex } from "../render/home.ts";

export type FmtMode = "std" | "sci" | "eng" | "fix" | "frac" | "mixed" | "polar";

/** Canonical order of the cycle (the order of the Settings checkboxes). */
export const FMT_MODES: readonly FmtMode[] = ["std", "sci", "eng", "fix", "frac", "mixed", "polar"];
export const DEFAULT_FMT_CYCLE: readonly FmtMode[] = ["std", "sci", "eng"];

export const isFmtMode = (x: unknown): x is FmtMode => typeof x === "string" && (FMT_MODES as readonly string[]).includes(x);

/** A rational result as the engine printed it: numerator and denominator (denominator > 0), as decimal strings. */
export interface Rational {
  n: string;
  d: string;
}

/** r∡θ, computed by the engine (abs and arg) in the angle unit that was set at the time. */
export interface Polar {
  r: DecimalValue;
  theta: DecimalValue;
  angle: "rad" | "deg";
}

/** What a history item knows about its number. */
export interface NumericResult {
  value?: ComplexValue;
  rational?: Rational;
  polar?: Polar;
  /** The mode chosen with the Format key for this result; undefined: the global setting (Home) or exact (CAS). */
  fmt?: FmtMode;
}

export interface Facts {
  numeric: boolean;
  complex: boolean;
  rational: boolean;
}

export function factsOf(r: NumericResult): Facts {
  const numeric = r.value !== undefined;
  return {
    numeric,
    complex: numeric && !isZero((r.value as ComplexValue).im),
    rational: r.rational !== undefined && !(numeric && !isZero((r.value as ComplexValue).im)),
  };
}

/** Fraction modes need an exact rational; polar needs a complex result (and the engine). */
export function isApplicable(mode: FmtMode, f: Facts): boolean {
  if (!f.numeric) return false;
  if (mode === "frac" || mode === "mixed") return f.rational;
  if (mode === "polar") return f.complex;
  return true;
}

/** The ticked modes, in canonical order, keeping only valid ones; never empty. */
export function normalizeCycle(modes: readonly unknown[] | undefined): FmtMode[] {
  const picked = FMT_MODES.filter((m) => modes?.includes(m));
  return picked.length > 0 ? picked : [...DEFAULT_FMT_CYCLE];
}

/**
 * The mode after `current`. Home (`exactBase` false): the global mode counts as the current one and the cycle wraps.
 * CAS (`exactBase` true): the exact result is the first step and the cycle returns to it. null: nothing to cycle
 * (no ticked mode applies to this result).
 */
export function nextMode(
  current: FmtMode | undefined,
  ticked: readonly FmtMode[],
  facts: Facts,
  exactBase: boolean,
): { mode: FmtMode | undefined } | null {
  const list = FMT_MODES.filter((m) => ticked.includes(m) && isApplicable(m, facts));
  if (list.length === 0) return null;
  const seq: (FmtMode | undefined)[] = exactBase ? [undefined, ...list] : list;
  const i = seq.indexOf(current);
  return { mode: seq[(i + 1) % seq.length] };
}

export interface DisplayContext {
  /** The global Number format setting. */
  format: "std" | "sci" | "eng";
  digits: number;
  fixDecimals: number;
  angle: "rad" | "deg";
}

const BASE: Record<"std" | "sci" | "eng" | "fix", FormatOptions["format"]> = { std: "STD", sci: "SCI", eng: "ENG", fix: "FIX" };

/** A result drawn in `mode` (undefined: the global setting). Undefined when the item has no number. */
export function renderNumeric(
  r: NumericResult,
  mode: FmtMode | undefined,
  ctx: DisplayContext,
): { text: string; latex: string } | undefined {
  if (!r.value) return undefined;
  const m = mode ?? ctx.format;
  const opts = (f: keyof typeof BASE): FormatOptions => ({ format: BASE[f], digits: ctx.digits, fixed: ctx.fixDecimals });
  const base = m === "fix" || m === "sci" || m === "eng" || m === "std" ? m : ctx.format;
  if ((m === "frac" || m === "mixed") && r.rational) {
    const f = formatFraction(BigInt(r.rational.n), BigInt(r.rational.d), m === "mixed");
    return { text: f.text, latex: fractionToLatex(f) };
  }
  if (m === "polar" && r.polar && r.polar.angle === ctx.angle) {
    const p = formatPolar(r.polar.r, r.polar.theta, opts(ctx.format));
    return { text: p.text, latex: polarToLatex(p) };
  }
  const c = formatComplex(r.value, opts(base));
  return { text: c.text, latex: complexToLatex(c) };
}
