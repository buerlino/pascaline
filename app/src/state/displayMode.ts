// SPDX-License-Identifier: GPL-3.0-or-later
// The Format key (fmt): cycles the display of the last result through the modes ticked in Settings.
// Plain logic, no Svelte: which modes apply to a result, what comes next, and how a result is drawn in a mode.
// All number formatting is engine/format.ts (our own formatter), never JS Number.toString.
import {
  confirmedOptions,
  formatComplex,
  formatConfirmed,
  formatFraction,
  formatPolar,
  isZero,
  markOf,
  type ComplexValue,
  type DecimalValue,
  type FormatOptions,
  type MarkInfo,
  type PrecisionFacts,
  type PrecisionWarn,
} from "../engine/format.ts";
import type { NumberFormat } from "../calc/port.ts";
import { complexToLatex, fractionToLatex, homeResultToLatex, polarToLatex } from "../render/home.ts";

export type FmtMode = "std" | "sci" | "eng" | "pfx" | "fix" | "frac" | "mixed" | "polar";

/** Canonical order of the cycle (the order of the Settings checkboxes). */
export const FMT_MODES: readonly FmtMode[] = ["std", "sci", "eng", "pfx", "fix", "frac", "mixed", "polar"];
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

/** What the engine said about how far a result can be trusted (docs/04 2.4); `value` of a scalar is the item's own. */
export interface ResultFacts {
  exactRational: boolean;
  /** Significant digits confirmed by the agreement check; null = exact. */
  reliableDigits: number | null;
  warn?: PrecisionWarn;
  /** A numeric list or matrix: its elements, each with its own value and facts. */
  items?: PrecisionFacts[];
  shape?: [number, number];
  /** The digits the input asked for (CAS `evalf(e,n)`, decisions M4-6): drawn with these, not the digits setting. */
  digits?: number;
}

/** What a history item knows about its number. */
export interface NumericResult {
  value?: ComplexValue;
  /** The facts behind the mark; absent for an item stored before marks existed (it then shows none). */
  facts?: ResultFacts;
  /** An inexact chip went into the input: the result is never marked "=" (decisions M4-4). */
  inexactInput?: boolean;
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
  format: NumberFormat;
  digits: number;
  fixDecimals: number;
  angle: "rad" | "deg";
}

const BASE: Record<"std" | "sci" | "eng" | "pfx" | "fix", FormatOptions["format"]> = {
  std: "STD",
  sci: "SCI",
  eng: "ENG",
  pfx: "PFX",
  fix: "FIX",
};

/** The precision facts of a result with its value filled in, as markOf and formatConfirmed read them. */
function precisionOf(r: NumericResult): (PrecisionFacts & { shape?: [number, number] }) | undefined {
  const f = r.facts;
  if (!f) return undefined;
  return {
    exactRational: f.exactRational,
    reliableDigits: f.reliableDigits,
    ...(f.warn ? { warn: f.warn } : {}),
    ...(f.items ? { items: f.items } : {}),
    ...(f.shape ? { shape: f.shape } : {}),
    ...(r.value ? { value: r.value } : {}),
  };
}

/** The mode a result is drawn in, once the global setting stands in for none. */
function baseMode(mode: FmtMode | undefined, ctx: DisplayContext): "std" | "sci" | "eng" | "pfx" | "fix" {
  return mode === "fix" || mode === "sci" || mode === "eng" || mode === "std" || mode === "pfx" ? mode : ctx.format;
}

/**
 * A result drawn in `mode` (undefined: the global setting). Undefined when the item has no number.
 * Only the digits the engine confirmed are drawn (docs/04 2.4): re-formatting a ⚠ value with the plain digits setting
 * would show digits nobody checked.
 */
export function renderNumeric(
  r: NumericResult,
  mode: FmtMode | undefined,
  ctx: DisplayContext,
): { text: string; latex: string } | undefined {
  const m = mode ?? ctx.format;
  const digits = r.facts?.digits ?? ctx.digits;
  const opts = (f: keyof typeof BASE): FormatOptions => ({ format: BASE[f], digits, fixed: ctx.fixDecimals });
  const base = baseMode(mode, ctx);
  if (!r.value) {
    // a numeric list or matrix: our formatter draws every element
    const p = precisionOf(r);
    const text = p?.items ? formatConfirmed(p, opts(base)) : null;
    return text === null || text === undefined ? undefined : { text, latex: homeResultToLatex(text) };
  }
  if ((m === "frac" || m === "mixed") && r.rational) {
    const f = formatFraction(BigInt(r.rational.n), BigInt(r.rational.d), m === "mixed");
    return { text: f.text, latex: fractionToLatex(f) };
  }
  if (m === "polar" && r.polar && r.polar.angle === ctx.angle) {
    const p = formatPolar(r.polar.r, r.polar.theta, opts(ctx.format));
    return { text: p.text, latex: polarToLatex(p) };
  }
  const c = formatComplex(r.value, confirmedOptions(r.value, r.facts?.reliableDigits ?? null, opts(base)));
  return { text: c.text, latex: complexToLatex(c) };
}

/**
 * The mark before a result (docs/04 2.4): `=`, `≈` or `⚠`, for the form the result is drawn in; null for a
 * non-number and for an item stored before marks existed. A fraction is the exact value, so `=` (a result from
 * an inexact chip never gets `=`, decisions M4-4); polar form rounds, so it never gets `=`.
 */
export function markFor(r: NumericResult, mode: FmtMode | undefined, ctx: DisplayContext): MarkInfo | null {
  const p = precisionOf(r);
  if (!p) return null;
  const m = mode ?? ctx.format;
  const base = baseMode(mode, ctx);
  const o: FormatOptions = { format: BASE[base], digits: r.facts?.digits ?? ctx.digits, fixed: ctx.fixDecimals };
  let info: MarkInfo | null;
  if ((m === "frac" || m === "mixed") && r.rational && r.value) info = p.exactRational ? { mark: "=" } : markOf(p, o);
  else {
    info = markOf(p, o);
    if (info?.mark === "=" && m === "polar" && r.polar?.angle === ctx.angle) info = { mark: "≈" };
  }
  return info?.mark === "=" && r.inexactInput ? { mark: "≈" } : info;
}

/** The mark as drawn: `=`, `≈`, `⚠ 7`, or a bare `⚠` for an un-audited or unchecked float (decisions M4-5). */
export function markText(m: MarkInfo): string {
  return m.mark === "⚠" && m.n !== undefined && !m.warn ? `⚠ ${m.n}` : m.mark;
}
