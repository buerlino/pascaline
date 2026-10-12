// SPDX-License-Identifier: GPL-3.0-or-later
// Paste a number (docs/04 section 2.6): the clipboard is read as one number, and it enters as the LaTeX our own keys
// would have typed, so the parser sees nothing it does not already know. Anything else is refused.
import type { TextOptions } from "./text.ts";

export interface PastedNumber {
  /** What goes on the entry line (`1.5\times10^{-3}`, `1+2\imaginaryI`). */
  latex: string;
  /** The same number as plain text for a text view (Python): `1.5e-3`, `1+2*i`. */
  text: string;
}

const MAX_LENGTH = 400;

interface Real {
  neg: boolean;
  int: string;
  frac: string;
  exp: number;
}

/** A real: digits with an optional point, then `e±k` or `×10^k` (also `*10^k`, `x10^k`, `·10^k`). */
function realPattern(point: string): RegExp {
  const num = String.raw`(\d+)(?:${point}(\d*))?|${point}(\d+)`;
  const exp = String.raw`(?:[eE]([+-]?\d+)|\s*[×x*·]\s*10\s*\^\s*(?:\(\s*([+-]?\d+)\s*\)|([+-]?\d+)))`;
  return new RegExp(String.raw`^([+-]?)\s*(?:${num})(?:${exp})?$`);
}

function parseReal(s: string, re: RegExp): Real | null {
  const m = re.exec(s.trim());
  if (!m) return null;
  const [, sign = "", i1, f1, f2, e1, e2, e3] = m;
  const exp = e1 ?? e2 ?? e3;
  return {
    neg: sign === "-",
    int: i1 ?? "0",
    frac: f1 ?? f2 ?? "",
    exp: exp === undefined ? 0 : parseInt(exp, 10),
  };
}

const isZeroReal = (r: Real): boolean => !/[1-9]/.test(r.int + r.frac);

function latexOf(r: Real, comma: boolean): string {
  const body = `${r.int}${r.frac ? `${comma ? "," : "."}${r.frac}` : ""}`;
  const exp = r.exp !== 0 && !isZeroReal(r) ? `\\times10^{${r.exp}}` : "";
  return `${r.neg ? "-" : ""}${body}${exp}`;
}

function textOf(r: Real): string {
  const body = `${r.int}${r.frac ? `.${r.frac}` : ""}`;
  const exp = r.exp !== 0 && !isZeroReal(r) ? `e${r.exp}` : "";
  return `${r.neg ? "-" : ""}${body}${exp}`;
}

/** The index of the + or − that separates the real part from the imaginary part, or -1. */
function splitAt(s: string): number {
  for (let k = s.length - 1; k > 0; k--) {
    const c = s[k];
    if (c !== "+" && c !== "-") continue;
    const before = s.slice(0, k).trimEnd().slice(-1);
    if (before === "" || /[eE^(*×·]/.test(before)) continue; // the sign of an exponent or of a factor
    return k;
  }
  return -1;
}

/**
 * The clipboard text as one number, or null when it is something else. Accepts `-1.5`, `1.5e-3`, `1.5E-3`,
 * `1.5×10^-3`, `1,5` with the decimal comma (and then no `.`), and complex `a+b*i`, `a-bi`, `2i`, `-i`.
 */
export function parsePastedNumber(clip: string, o: TextOptions = {}): PastedNumber | null {
  const comma = o.decimalComma === true;
  const s = clip.replace(/[−‒–]/g, "-").replace(/[   ]/g, " ").trim();
  if (s === "" || s.length > MAX_LENGTH || /[\r\n]/.test(s)) return null;
  const re = realPattern(comma ? "," : String.raw`\.`);

  const real = parseReal(s, re);
  if (real) return { latex: latexOf(real, comma), text: textOf(real) };

  if (!/i$/.test(s)) return null;
  const body = s.slice(0, -1).replace(/\s*\*\s*$/, "").trimEnd(); // "2*i" → "2", "i" → ""
  const k = splitAt(body);
  const head = k < 0 ? "" : body.slice(0, k);
  const tail = k < 0 ? body : body.slice(k);
  const re1 = head === "" ? undefined : parseReal(head, re);
  if (head !== "" && !re1) return null;
  const sign = tail.trimStart()[0];
  const mag = tail.replace(/^\s*[+-]?\s*/, "");
  const im = mag === "" ? ({ neg: false, int: "1", frac: "", exp: 0 } satisfies Real) : parseReal(mag, re);
  if (!im || /^\s*[+-]\s*[+-]/.test(tail)) return null;
  im.neg = sign === "-";
  const sgn = im.neg ? "-" : "+";
  const imLatex = (mag === "" ? "" : latexOf({ ...im, neg: false }, comma)) + "\\imaginaryI";
  const imText = mag === "" ? "i" : `${textOf({ ...im, neg: false })}*i`;
  if (!re1) return { latex: `${im.neg ? "-" : ""}${imLatex}`, text: `${im.neg ? "-" : ""}${imText}` };
  return { latex: `${latexOf(re1, comma)}${sgn}${imLatex}`, text: `${textOf(re1)}${sgn}${imText}` };
}
