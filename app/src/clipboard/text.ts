// SPDX-License-Identifier: GPL-3.0-or-later
// What Copy puts on the clipboard (docs/04 section 2.6): the full value of a result, the shown text, the exact text,
// the LaTeX, a whole session and a Num table. Plain functions, no Svelte and no clipboard: the actions
// (actions.svelte.ts) pick the text and the port (port.ts) delivers it.
import {
  DECIMAL_KEEP,
  decimalFromRational,
  decimalFromString,
  isZero,
  roundSignificant,
  type ComplexValue,
  type DecimalValue,
  type Mark,
  type PrecisionWarn,
} from "../engine/format.ts";
import type { ValueFacts } from "../engine/types.ts";
import type { ChipTable } from "../input/chips.ts";
import { markFor, type DisplayContext, type Rational } from "../state/displayMode.ts";

/** The part of a history item that Copy reads (HistoryItem in state/session.svelte.ts has all of it). */
export interface CopySource {
  latex: string;
  status: string;
  /** Plain text of the result (CAS: Giac's text or our formatter's) or of the error. */
  text: string;
  value?: ComplexValue;
  rational?: Rational;
  /** The exact text, or every confirmed digit (the `\res` chip value). */
  full?: string;
  fullExact?: boolean;
  /** G46f1: the text drawn when it differs from `full` (DEG: `full` is the radian text); Copy gives it. */
  drawn?: string;
  /** The value's facts, whole (G86; a history item's own): `reliableDigits` the digits confirmed by the agreement check
   *  (null = nothing in doubt), `warn`, `exact`. Absent: nothing in doubt, not claimed exact. */
  facts?: ValueFacts;
  /** An inexact chip went into the input: never `=` (decisions M4-4). */
  inexactInput?: boolean;
  chips?: ChipTable;
}

/** Text options: `decimalComma` writes `,` for the decimal point (the Settings option, docs/04 section 6.2). */
export interface TextOptions {
  decimalComma?: boolean;
}

/** Plain notation from 1E-4 up to (not including) 1E21, else `d.ddd…E±k` (docs/04 section 2.6). */
const PLAIN_LOW = -4;
const PLAIN_HIGH = 21;

/** v rounded to n significant digits, trailing zeros dropped, `.` as the point; `0` for zero. */
export function realText(v: DecimalValue, n: number, o: TextOptions = {}): string {
  if (isZero(v)) return "0";
  const r = roundSignificant(v, Math.max(1, Math.min(n, DECIMAL_KEEP)));
  const d = r.digits.replace(/0+$/, "");
  const e = r.exp;
  let body: string;
  if (e >= PLAIN_LOW && e < PLAIN_HIGH) {
    if (e < 0) body = `0.${"0".repeat(-e - 1)}${d}`;
    else if (d.length <= e + 1) body = d + "0".repeat(e + 1 - d.length);
    else body = `${d.slice(0, e + 1)}.${d.slice(e + 1)}`;
  } else {
    body = `${d.length > 1 ? `${d[0]}.${d.slice(1)}` : d}E${e}`;
  }
  if (o.decimalComma) body = body.replace(".", ",");
  return r.neg ? `-${body}` : body;
}

/** `a+b*i` (a plain `i` for 1, `-i` for -1), each part as realText. */
export function complexText(v: ComplexValue, n: number, o: TextOptions = {}): string {
  const re = realText(v.re, n, o);
  if (isZero(v.im)) return re;
  const im = realText({ ...v.im, neg: false }, n, o);
  const ims = im === "1" ? "i" : `${im}*i`;
  const sign = v.im.neg ? "-" : "+";
  return isZero(v.re) ? `${v.im.neg ? "-" : ""}${ims}` : `${re}${sign}${ims}`;
}

/** How many significant digits of a result may be copied: all that were kept (40), or the confirmed ones. */
function copyDigits(i: CopySource): number {
  const r = i.facts?.reliableDigits;
  return r === null || r === undefined ? DECIMAL_KEEP : Math.max(1, Math.min(r, DECIMAL_KEEP));
}

/**
 * The default copy (Shift + View, docs/04 section 2.6): a number as every confirmed digit up to 40 with trailing
 * zeros dropped (an exact `1/3` as its 40 digits, an exact integer in full); anything else as the engine wrote it.
 * undefined: nothing finished to copy.
 */
export function copyFull(i: CopySource, o: TextOptions = {}): string | undefined {
  if (i.status !== "done") return undefined;
  if (i.drawn !== undefined) return i.drawn;
  const f = i.full;
  if (f !== undefined && /^-?\d+$/.test(f)) return f; // an exact integer, however long
  // A real the engine wrote as digits (CAS floats too): its confirmed digits, in the notation of docs/04 2.6.
  const dec = f !== undefined && !i.fullExact ? decimalFromString(f.replace("E", "e")) : null;
  if (dec) return realText(dec, copyDigits(i), o);
  // An exact fraction: its 40 digits rounded from the 41st (the value kept only 40, cut).
  if (i.rational && i.value && isZero(i.value.im)) {
    const q = decimalFromRational(BigInt(i.rational.n), BigInt(i.rational.d), DECIMAL_KEEP + 1);
    return realText(q, DECIMAL_KEEP, o);
  }
  if (i.value) return complexText(i.value, copyDigits(i), o);
  return f ?? i.text;
}

export { copyExact } from "./exact.ts";

/** A mark glyph (and a count) that R3's display may put before the shown text; Copy as shown leaves it out. */
const LEADING_MARK = /^(?:[=≈]|⚠(?:\s*\d+(?=\s))?)\s*/;
export function withoutMark(shown: string): string {
  return shown.replace(LEADING_MARK, "");
}

/**
 * The mark of a copied result: the one the screen shows (R69), `markFor` of the item's facts. `ctx` is the display
 * settings (the session's); the default is the factory ones. undefined: not a number.
 */
export function copyMark(i: CopySource, ctx: DisplayContext = DEFAULT_CTX): { mark: Mark; n?: number; warn?: PrecisionWarn } | undefined {
  if (i.status !== "done" || !i.value) return undefined;
  const m = markFor(i, undefined, ctx);
  return m ?? undefined;
}

const DEFAULT_CTX: DisplayContext = { format: "std", digits: 12, fixDecimals: 4, angle: "rad" };

const markText = (m: ReturnType<typeof copyMark>): string => (m === undefined ? "=" : m.mark === "⚠" && m.n !== undefined && !m.warn ? `⚠ ${m.n}` : m.mark);

/** A fraction part or exponent: bare when it is one token, else in brackets. */
const group = (s: string): string => (/^-?[\w.]+$/.test(s) ? s : `(${s})`);

/** An entry as plain text for a shared session: the LaTeX as typed (the parser's output is for the engine, not for people). */
export function entryText(latex: string): string {
  return latex
    .replace(/\\left|\\right/g, "")
    .replace(/\\operatorname\{\\mathrm\{([^{}]*)\}\}|\\operatorname\{([^{}]*)\}|\\mathrm\{([^{}]*)\}/g, (_m, a: string, b: string, c: string) => a ?? b ?? c)
    .replace(/\\(?:t|d)?frac(?!\{)(\w)(\w)/g, "\\frac{$1}{$2}") // MathLive writes \frac13 for 1/3
    .replace(/\\(?:t|d)?frac\{([^{}]*)\}\{([^{}]*)\}/g, (_m, a: string, b: string) => `${group(a)}/${group(b)}`)
    .replace(/\\sqrt\{([^{}]*)\}/g, "sqrt($1)")
    .replace(/\\times/g, "×")
    .replace(/\\cdot/g, "·")
    .replace(/\\div/g, "÷")
    .replace(/\\pi(?![A-Za-z])/g, "π")
    .replace(/\\imaginaryI/g, "i")
    .replace(/\\exponentialE/g, "e")
    .replace(/\\blacktriangleright/g, "▶")
    .replace(/\\[,;:! ]/g, " ")
    .replace(/\^\{([^{}]*)\}/g, (_m, a: string) => `^${group(a)}`)
    .replace(/_\{([^{}]*)\}/g, "_$1")
    .replace(/\\res\{\d+\}\{([^{}]*)\}/g, "$1")
    .replace(/\\ans(?![A-Za-z])/g, "Ans")
    .replace(/\\const\{[^{}]*\}\{([^{}]*)\}/g, "$1")
    .replace(/[{}]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** The session as text: one line per finished entry, `input mark result` with the full value; an error line shows the message. */
export function sessionText(items: readonly CopySource[], o: TextOptions = {}, ctx?: DisplayContext): string {
  const lines: string[] = [];
  for (const i of items) {
    if (i.status === "done") {
      const result = copyFull(i, o) ?? i.text;
      lines.push(`${entryText(i.latex)} ${markText(copyMark(i, ctx))} ${result}`);
    } else if (i.status === "error") lines.push(`${entryText(i.latex)} → ${i.text}`);
  }
  return lines.join("\n");
}

/** One CSV field: quoted when it holds the separator, a quote or a line break. */
function csvField(s: string, sep: string): string {
  return /["\r\n]/.test(s) || s.includes(sep) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * A table as CSV (docs/04 section 2.6): a header row, then the rows; the separator is `,`, or `;` with the decimal
 * comma. Lines end with CRLF (RFC 4180), which spreadsheets and scripts both read.
 */
export function tableCsv(header: readonly string[], rows: readonly (readonly string[])[], o: TextOptions = {}): string {
  const sep = o.decimalComma ? ";" : ",";
  return [header, ...rows].map((r) => r.map((c) => csvField(c, sep)).join(sep)).join("\r\n") + "\r\n";
}
