// SPDX-License-Identifier: GPL-3.0-or-later
// R24c: the unit view's formula (docs/04 4.3, docs/archive/r9-unit-pad.md 2.1): the entry line's LaTeX with an empty
// unit slot (a MathLive prompt, `\placeholder[u<n>]{}`) after every number and the end slot "→ should be" at the end.
// On an empty line: the quantity 1, its slot and the end slot. The slots' contents never come from here (R24a's model
// holds them); the parser's units mode (R28) reads the prompts as pasu<n> and the end slot. The entry's LaTeX, so it lives
// beside the parser (input/), not under units/ (P20: no text reading there). Plain TS, loaded with the unit view.

/** The end slot's prompt id. */
export const END = "end";

export interface SlotFormula {
  /** The formula with an empty prompt per slot (the parser's input and the field's first value). */
  latex: string;
  /** The slots' prompt ids in the order written (the end slot is not among them). */
  slots: string[];
}

/** Macros whose arguments are a chip's, never numbers of the formula: \res{k}{shown}, \const{id}{symbol}, \unit and
 *  \pfx (two groups each); \placeholder[id]{…}; \mathrm, \operatorname, \text (one group: a name). */
const SKIP_GROUPS: Readonly<Record<string, number>> = { res: 2, const: 2, unit: 2, pfx: 2, placeholder: 1, mathrm: 1, operatorname: 1, text: 1, mathit: 1 };

/** The end of the {…} group that starts at `i` (or of the one character there), as an index after it. */
function groupEnd(s: string, i: number): number {
  while (s[i] === " ") i++;
  if (s[i] === "\\") {
    const m = /^\\(?:[A-Za-z]+|.)/.exec(s.slice(i));
    return i + (m?.[0].length ?? 1);
  }
  if (s[i] !== "{" && s[i] !== "[") return i + 1;
  const [open, close] = s[i] === "{" ? ["{", "}"] : ["[", "]"];
  let depth = 0;
  for (let j = i; j < s.length; j++) {
    if (s[j] === "\\") j++;
    else if (s[j] === open) depth++;
    else if (s[j] === close && --depth === 0) return j + 1;
  }
  return s.length;
}

/** Where the number that starts at `i` ends: digits, the point, the decimal comma `{,}`, an ᴇ mark and its signed
 *  digits, then a superscript right after it (`5^{2}` is one quantity: its slot comes after the power). */
function numberEnd(s: string, i: number): number {
  const m = /^(?:\d|\.|\{,\})+(?:\\emark\s*(?:\{[-−]?\d+\}|[-−]?\d+))?/.exec(s.slice(i));
  let j = i + (m?.[0].length ?? 0);
  if (s[j] === "^") j = groupEnd(s, j + 1);
  return j;
}

/** `\pm` and a number right after position `j` (spaces allowed): the σ belongs to the number before it (R28), so the
 *  slot goes after the σ. Returns the end of the σ, or `j`. */
function afterSigma(s: string, j: number): number {
  const m = /^\s*\\pm\s*/.exec(s.slice(j));
  if (!m) return j;
  const k = j + m[0].length;
  return /^(?:\d|\.)/.test(s.slice(k)) ? numberEnd(s, k) : j;
}

/** The formula for `latex` (the entry line, or a picked row's input). */
export function slotFormula(latex: string): SlotFormula {
  const src = latex.trim();
  if (src === "") return { latex: `1\\placeholder[u1]{}\\to\\placeholder[${END}]{}`, slots: ["u1"] };
  const slots: string[] = [];
  let out = "";
  let i = 0;
  /** The last thing written was a name's letter (x2 is a name, not a number with a slot). */
  let name = false;
  while (i < src.length) {
    const c = src[i] as string;
    const letter: boolean = name;
    name = /[A-Za-z]/.test(c) || (letter && /\d/.test(c)); // (x23: the digits stay the name's)
    if (c === "\\") {
      name = false;
      const m = /^\\([A-Za-z]+|.)/.exec(src.slice(i));
      const macro = m?.[1] ?? "";
      let j = i + (m?.[0].length ?? 1);
      for (let g = SKIP_GROUPS[macro] ?? 0; g > 0; g--) {
        while (src[j] === " ") j++;
        if (macro === "placeholder" && src[j] === "[") j = groupEnd(src, j);
        j = groupEnd(src, j);
      }
      if (macro === "sqrt" && src[j] === "[") j = groupEnd(src, j); // a root's index is no quantity
      out += src.slice(i, j);
      i = j;
    } else if (c === "^" || c === "_") {
      // an exponent or a subscript holds no slot (a unit's power is the slot's own)
      const j = groupEnd(src, i + 1);
      out += src.slice(i, j);
      i = j;
    } else if (/\d|\./.test(c) && !letter) {
      const j = afterSigma(src, numberEnd(src, i));
      const id = `u${slots.length + 1}`;
      slots.push(id);
      out += `${src.slice(i, j)}\\placeholder[${id}]{}`;
      i = j;
    } else {
      out += c;
      i++;
    }
  }
  return { latex: `${out}\\to\\placeholder[${END}]{}`, slots };
}
