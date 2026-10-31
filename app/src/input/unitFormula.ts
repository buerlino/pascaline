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

/** Where the number that starts at `i` ends: digits, the point, the decimal comma `{,}`, an ᴇ mark (`\emark` or the
 *  character) and its signed digits, and a mixed number's `\tfrac` (2½ is one quantity). A power is not part of it:
 *  the parser reads a slot only right after a number literal, so `5^{2}`'s slot goes before the power, (5 u)² (R28). */
function numberEnd(s: string, i: number): number {
  const m = /^(?:\d|\.|\{,\})+(?:(?:\\emark|ᴇ)\s*(?:\{[-−+]?\d+\}|[-−+]?\d+))?/.exec(s.slice(i));
  let j = i + (m?.[0].length ?? 0);
  const t = /^\\tfrac(?![A-Za-z])/.exec(s.slice(j));
  if (t) j = groupEnd(s, groupEnd(s, j + t[0].length));
  return j;
}

/** A number followed by `\degree`, `\prime` or `\doubleprime` is part of a DMS angle, which takes no slot. */
const DMS = /^\\(?:degree|prime|doubleprime)(?![A-Za-z])/;

/** The end of a `\left` or `\right` delimiter at `i` (`.`, `(`, `[`, `|`, `\{`, `\lfloor`…). */
function delimiterEnd(s: string, i: number): number {
  while (s[i] === " ") i++;
  const m = /^\\(?:[A-Za-z]+|.)/.exec(s.slice(i));
  return i + (m ? m[0].length : 1);
}

/** Macros whose arguments may be a bare character (`\frac12`, `\sqrt9`): how many. Such an argument is braced, so a
 *  digit there is a number of its own with its slot inside the group, as the parser reads it. */
const BARE_ARGS: Readonly<Record<string, number>> = { frac: 2, dfrac: 2, cfrac: 2, binom: 2, sqrt: 1 };

/** `src` with every bare argument of BARE_ARGS's macros put in braces (a digit: one digit, as LaTeX reads it). */
function braceArgs(src: string): string {
  let out = "";
  let i = 0;
  while (i < src.length) {
    const m = src[i] === "\\" ? /^\\([A-Za-z]+|.)/.exec(src.slice(i)) : null;
    if (!m) {
      out += src[i];
      i++;
      continue;
    }
    let j = i + m[0].length;
    out += m[0];
    const n = BARE_ARGS[m[1] as string] ?? 0;
    if (n > 0 && m[1] === "sqrt" && /^\s*\[/.test(src.slice(j))) {
      const k = groupEnd(src, j);
      out += src.slice(j, k);
      j = k;
    }
    for (let g = 0; g < n; g++) {
      while (src[j] === " ") {
        out += " ";
        j++;
      }
      if (j >= src.length || src[j] === "\\") break; // a macro argument (\frac\pi2) stops the bracing
      if (src[j] === "{") {
        const k = groupEnd(src, j);
        out += `{${braceArgs(src.slice(j + 1, k - 1))}}`;
        j = k;
      } else {
        out += `{${src[j]}}`;
        j++;
      }
    }
    i = j;
  }
  return out;
}

/** `\pm` and a number right after position `j` (spaces allowed): the σ belongs to the number before it (R28), so the
 *  slot goes after the σ. Returns the end of the σ, or `j`. */
function afterSigma(s: string, j: number): number {
  const m = /^\s*\\pm\s*/.exec(s.slice(j));
  if (!m) return j;
  const k = j + m[0].length;
  return /^(?:\d|\.)/.test(s.slice(k)) ? numberEnd(s, k) : j;
}

/** The end of a one-line exponent at `i`: a sign, then a number, a group or one character. */
function exponentEnd(s: string, i: number): number {
  const sign = /^[-−+]?\s*/.exec(s.slice(i));
  const k = i + (sign?.[0].length ?? 0);
  const num = /^(?:\d|\.)+/.exec(s.slice(k));
  return num ? k + num[0].length : groupEnd(s, k);
}

/** The formula for `latex` (the entry line, or a picked row's input). */
export function slotFormula(latex: string): SlotFormula {
  const src = braceArgs(latex.trim());
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
      if (macro === "left" || macro === "right") j = delimiterEnd(src, j); // (`\left.` is no number)
      if (macro === "char") {
        // MathLive's `\char"5E` is the one-line ^ (F26): its exponent, the next signed factor, holds no slot
        const hex = /^"([0-9A-Fa-f]+)\s*/.exec(src.slice(j));
        if (hex) {
          j += hex[0].length;
          if (hex[1]?.toUpperCase() === "5E") j = exponentEnd(src, j);
        }
      }
      out += src.slice(i, j);
      i = j;
    } else if (c === "^" || c === "_") {
      // an exponent or a subscript holds no slot (a unit's power is the slot's own)
      const j = groupEnd(src, i + 1);
      out += src.slice(i, j);
      i = j;
    } else if (/\d|\./.test(c) && !letter) {
      let j = numberEnd(src, i);
      if (DMS.test(src.slice(j))) {
        // a DMS angle (30°15′36″): no slot in it; its marks are copied by the macro branch
        out += src.slice(i, j);
        i = j;
        continue;
      }
      j = afterSigma(src, j);
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
