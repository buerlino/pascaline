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
import { commaResult, markFor, modeOf, type DisplayContext, type FmtMode, type FormStep, type Rational } from "../state/displayMode.ts";

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
  /** The item's display settings (Format key): the mode and the a b/c form the screen draws it in. */
  fmt?: FmtMode;
  form?: FormStep;
  chips?: ChipTable;
  /** R63f2: a unit-view row (units/row.ts UnitRow, read back unchecked): `input` the request as drawn (unit after each
   *  number, → the end unit), `text` the ` ± σ unit` after the value. Both strings, else the row is exported as Home's. */
  units?: { input?: unknown; text?: unknown };
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
 * The default copy (the Copy key, docs/04 section 2.6): a number as every confirmed digit up to 40 with trailing
 * zeros dropped (an exact `1/3` as its 40 digits, an exact integer in full); anything else as the engine wrote it.
 * undefined: nothing finished to copy.
 */
export function copyFull(i: CopySource, o: TextOptions = {}): string | undefined {
  if (i.status !== "done") return undefined;
  if (i.drawn !== undefined) return o.decimalComma ? commaResult(i.drawn, false) : i.drawn; // R100: a list's elements by `;`
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
  const rest = f ?? i.text;
  return o.decimalComma ? commaResult(rest, false) : rest; // (R57) a list or an expression the engine wrote
}

export { copyExact } from "./exact.ts";

/** A mark glyph (and a count) that R3's display may put before the shown text; Copy as shown leaves it out. */
const LEADING_MARK = /^(?:[=≈]|⚠(?:\s*\d+(?=\s))?)\s*/;
export function withoutMark(shown: string): string {
  return shown.replace(LEADING_MARK, "");
}

/**
 * The mark of a copied result: the one the screen shows (R69), `markFor` of the item's facts. `ctx` is the display
 * settings (the session's), required: the item's own mode is read against its global format. undefined: not a number.
 */
export function copyMark(i: CopySource, ctx: DisplayContext): { mark: Mark; n?: number; warn?: PrecisionWarn } | undefined {
  if (i.status !== "done" || !i.value) return undefined;
  // copyFull writes a decimal, so a fraction form is marked as the decimal it writes (R69f1)
  const mode = modeOf(i, ctx);
  const m = markFor(i, mode === "frac" || mode === "mixed" ? (i.fmt && i.fmt !== "frac" && i.fmt !== "mixed" ? i.fmt : ctx.format) : mode, ctx);
  return m ?? undefined;
}

const markText = (m: ReturnType<typeof copyMark>): string => (m === undefined ? "=" : m.mark === "⚠" && m.n !== undefined && !m.warn ? `⚠ ${m.n}` : m.mark);

/** A fraction part or exponent: bare when it is one token, else in brackets. */
const group = (s: string): string => (/^-?[\w.]+$/.test(s) ? s : `(${s})`);

/** The LaTeX commands an entry may hold that are one character or word in plain text: the Greek letters (the Symbols
 *  palette's and the constants' and units' symbols) and its other cells (spec/keyboard.yaml `symbols:`, text.test.ts
 *  checks that every insert is here), π, the arrows. A command not in the table is left as it is. */
const COMMANDS: Readonly<Record<string, string>> = {
  alpha: "α", beta: "β", gamma: "γ", delta: "δ", epsilon: "ε", varepsilon: "ε", zeta: "ζ", eta: "η", theta: "θ", vartheta: "ϑ",
  iota: "ι", kappa: "κ", lambda: "λ", mu: "μ", nu: "ν", xi: "ξ", pi: "π", rho: "ρ", sigma: "σ", tau: "τ", upsilon: "υ",
  phi: "φ", varphi: "φ", chi: "χ", psi: "ψ", omega: "ω", Gamma: "Γ", Delta: "Δ", Theta: "Θ", Lambda: "Λ", Xi: "Ξ", Pi: "Π",
  Sigma: "Σ", Upsilon: "Υ", Phi: "Φ", Psi: "Ψ", Omega: "Ω", hbar: "ħ",
  infty: "∞", degree: "°", prime: "′", doubleprime: "″", AA: "Å", to: " → ", rightarrow: " → ",
};

/** The command names the table holds (for the test that the Symbols palette is covered). */
export const PLAIN_COMMANDS: readonly string[] = Object.keys(COMMANDS);

/** The `{…}` group that starts at `s[i]` (a `{`): its content and the index after its `}`; undefined if it never closes. */
function group1(s: string, i: number): { body: string; end: number } | undefined {
  let depth = 0;
  for (let j = i; j < s.length; j++) {
    const c = s[j];
    if (c === "\\") j++; // an escaped brace (`\{`) is no group
    else if (c === "{") depth++;
    else if (c === "}" && --depth === 0) return { body: s.slice(i + 1, j), end: j + 1 };
  }
  return undefined;
}

/** Every `\name{…}…{…}` with `argc` brace groups (the groups may hold braces), in order: where it starts and ends in `s`
 *  and the groups' text. A macro whose groups do not close is not listed. */
export function macroCalls(s: string, name: string, argc: number): { start: number; end: number; args: string[] }[] {
  const out: { start: number; end: number; args: string[] }[] = [];
  const head = new RegExp(`\\\\${name}(?![A-Za-z])`, "g");
  for (let m = head.exec(s); m; m = head.exec(s)) {
    const args: string[] = [];
    let at = m.index + m[0].length;
    while (args.length < argc && s[at] === "{") {
      const g = group1(s, at);
      if (!g) break;
      args.push(g.body);
      at = g.end;
    }
    if (args.length === argc) {
      out.push({ start: m.index, end: at, args });
      head.lastIndex = at;
    }
  }
  return out;
}

/** `\name{a}{b}` (and the like) written as its argument number `keep`; repeated, so a wrapper inside a wrapper goes too. */
function unwrap(s: string, name: string, argc: number, keep: number): string {
  let out = s;
  for (let n = 0; n < 8; n++) {
    const calls = macroCalls(out, name, argc);
    if (!calls.length) break;
    for (const c of calls.reverse()) out = out.slice(0, c.start) + (c.args[keep] ?? "") + out.slice(c.end);
  }
  return out;
}

/** An entry as plain text for a shared session: the LaTeX as typed (the parser's output is for the engine, not for people).
 *  Wrappers and chips first (a chip's symbol is LaTeX too), then the commands, then `\mathrm`, so `\to\mathrm{m}` is
 *  read as `\to` and `m`, never `\tom`. */
export function entryText(latex: string): string {
  let s = latex.replace(/\\left|\\right/g, "");
  s = unwrap(unwrap(s, "class", 2, 1), "htmlStyle", 2, 1);
  s = unwrap(unwrap(unwrap(unwrap(s, "const", 2, 1), "res", 2, 1), "unit", 2, 1), "pfx", 2, 1);
  s = s.replace(/\\([_&%])/g, "$1").replace(/\\([A-Za-z]+)/g, (m, name: string) => COMMANDS[name] ?? m);
  // \mathrm after the commands (so `\to\mathrm{m}` is not `\tom`); a symbol like `deg^{2}` holds braces
  s = unwrap(unwrap(s, "mathrm", 1, 0), "operatorname", 1, 0);
  s = s.replace(/\\(?:t|d)?frac(?!\{)(\w)(\w)/g, "\\frac{$1}{$2}"); // MathLive writes \frac13 for 1/3
  // the groups with no brace inside, innermost first: repeated, so `\frac{\mathrm{M}m^{2}}{s}` gets its exponent first
  for (let n = 0; n < 6; n++) {
    const was = s;
    s = s
      .replace(/\\(?:t|d)?frac\{([^{}]*)\}\{([^{}]*)\}/g, (_m, a: string, b: string) => `${group(a)}/${group(b)}`)
      .replace(/\\sqrt\{([^{}]*)\}/g, "sqrt($1)")
      .replace(/\^\{([^{}]*)\}/g, (_m, a: string) => `^${group(a)}`)
      .replace(/_\{([^{}]*)\}/g, "_$1");
    if (s === was) break;
  }
  return s
    .replace(/\\times/g, "×")
    .replace(/\\cdot/g, "·")
    .replace(/\\div/g, "÷")
    .replace(/\\imaginaryI/g, "i")
    .replace(/\\exponentialE/g, "e")
    .replace(/\\blacktriangleright/g, "▶")
    .replace(/\\pm(?![A-Za-z])/g, "±")
    .replace(/\\[,;:! ]/g, " ")
    .replace(/\\ans(?![A-Za-z])/g, "Ans")
    .replace(/[{}]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** The session as text: one line per finished entry, `input mark result` with the full value; an error line shows the message. */
export function sessionText(items: readonly CopySource[], o: TextOptions, ctx: DisplayContext): string {
  const lines: string[] = [];
  for (const i of items) {
    if (i.status === "done") {
      let result = copyFull(i, o) ?? i.text;
      let input = i.latex;
      // R63f2: a unit row's latex is the plain line and its value is in the result's unit: the request as drawn, the unit after the value
      const u = i.units;
      if (u && typeof u.input === "string" && typeof u.text === "string") {
        input = u.input;
        result += o.decimalComma ? commaResult(u.text, false) : u.text;
      }
      lines.push(`${entryText(input)} ${markText(copyMark(i, ctx))} ${result}`);
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
