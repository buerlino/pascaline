// SPDX-License-Identifier: GPL-3.0-or-later
// The tokenizer of the LaTeX parser (parse.ts): LaTeX text to tokens (R72 moved it out of parse.ts).
import { parseError } from "../i18n/enParser.ts";

export type Tok =
  /** gap (F43, R51): spacing (a space or a spacing command) separates this number from a number just before it. */
  | { t: "num"; v: string; gap?: true }
  | { t: "ch"; v: string }
  /** id: a MathLive prompt `\placeholder[id]{…}` (R28), whose v is "placeholder". */
  | { t: "cmd"; v: string; id?: string }
  | { t: "open"; v: string }
  | { t: "close"; v: string };

const SPACING = new Set([",", ";", ":", "!", " ", "quad", "qquad", "displaystyle", "textstyle"]);
const OPEN_CMD: Record<string, string> = { lfloor: "floor", lceil: "ceil", lbrace: "{", "{": "{" };
const CLOSE_CMD: Record<string, string> = { rfloor: "floor", rceil: "ceil", rbrace: "}", "}": "}" };

/** Token for a literal caret (one-line mode): power of the next factor, not a TeX superscript. */
export const CARET = "^caret";
/** The exponent mark (R14): the key's `\emark` macro, or the bare character U+1D07 the reference draws. */
export const EMARK = "emark";

/** Token prefix of the infix logic words (R18): `logic:and`, `logic:or`, `logic:xor`. */
export const LOGIC = "logic:";
/** The Å of the Shift + 9 palette (R18), refused with a message. */
export const ARING = "aring";
/** The id of a MathLive prompt token `\placeholder[id]{…}` (R28, the unit view's slots), else undefined. Its body is
 *  skipped: a slot's units live in R24a's model and are never read back from the LaTeX (docs/04 4.3). */
export const promptId = (t: Tok | undefined): string | undefined => (t?.t === "cmd" ? t.id : undefined);

/** The end of a `{…}` group starting at `j` (braces balanced, `\{` and `\}` skipped), or -1. */
function groupEnd(src: string, j: number): number {
  if (src[j] !== "{") return -1;
  let depth = 0;
  for (let k = j; k < src.length; k++) {
    const c = src[k];
    if (c === "\\") k++;
    else if (c === "{") depth++;
    else if (c === "}" && --depth === 0) return k + 1;
  }
  return -1;
}

/** The length of a decimal comma at `j` ("," or MathLive's "{,}"), 0 if there is none or the setting is off. MathLive's
 *  `{,}` is only ever typed as the decimal mark (R57), so it reads as one in the point mode too: an entry recalled
 *  after the setting changed still parses. */
function commaAt(src: string, j: number, decimalComma: boolean): number {
  if (src.startsWith("{,}", j)) return 3;
  return decimalComma && src[j] === "," ? 1 : 0;
}

/** decimalComma (L6): "3,5" and MathLive's "3{,}5" are the number 3.5; use ";" between arguments then. */
export function tokenize(src: string, decimalComma = false): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  const n = src.length;
  const isDigit = (c: string | undefined) => c !== undefined && c >= "0" && c <= "9";
  // F43 (R51): spacing was skipped right after the token out[gapAt - 1]
  let gapAt = -1;
  while (i < n) {
    const c = src[i] as string;
    if (c === " " || c === "\n" || c === "\t") {
      gapAt = out.length;
      i++;
    } else if (c === "\\") {
      let j = i + 1;
      while (j < n && /[A-Za-z]/.test(src[j] as string)) j++;
      const name = j > i + 1 ? src.slice(i + 1, j) : (src[j++] ?? "");
      i = j;
      if (SPACING.has(name)) {
        gapAt = out.length;
        continue;
      }
      if (name === "mathbin") {
        // P4: the polar sign is entered as \mathbin{\measuredangle} so that a following ÷ does not absorb it into the numerator
        const m = /^\{\s*\\measuredangle\s*\}/.exec(src.slice(i));
        if (m) {
          i += m[0].length;
          out.push({ t: "cmd", v: "measuredangle" });
          continue;
        }
      }
      if (name === "placeholder") {
        // R28: a named prompt, one token; the id is letters and digits (u1, end)
        const m = /^\[([A-Za-z0-9]+)\]\s*/.exec(src.slice(i));
        const end = m ? groupEnd(src, i + m[0].length) : -1;
        if (m && end > 0) {
          i = end;
          out.push({ t: "cmd", v: "placeholder", id: m[1] as string });
          continue;
        }
      }
      if (name === "AA") {
        // the Å of the Shift + 9 palette (\AA keeps MathLive in math mode; a pasted Å is read below)
        out.push({ t: "cmd", v: ARING });
        continue;
      }
      if (name === "operatorname" || name === "mathrm") {
        // R18: the logic words of the Shift + 6 palette are infix operators, written \operatorname{AND} (MathLive may
        // write \operatorname{\mathrm{AND}})
        const m = /^\{\s*(?:\\mathrm\{\s*(AND|OR|XOR)\s*\}|(AND|OR|XOR))\s*\}/.exec(src.slice(i));
        if (m) {
          i += m[0].length;
          out.push({ t: "cmd", v: `${LOGIC}${(m[1] ?? m[2] ?? "").toLowerCase()}` });
          continue;
        }
      }
      if (name === "char") {
        // L4: the literal caret of the one-line entry mode, \char"5E (MathLive serialises it with a trailing space)
        const m = /^(?:"5E|"5e|94)\b ?/.exec(src.slice(i));
        if (!m) {
          out.push({ t: "cmd", v: "char" });
          continue;
        }
        i += m[0].length;
        out.push({ t: "cmd", v: CARET });
        continue;
      }
      if (name === "left" || name === "right") {
        while (src[i] === " ") i++;
        let d = src[i] ?? "";
        i++;
        if (d === "\\" && (src[i] === "{" || src[i] === "}")) {
          // \left\{ ... \right\}: braces (a list, L6)
          d = src[i++] as string;
        } else if (d === "\\") {
          let k = i;
          while (k < n && /[A-Za-z]/.test(src[k] as string)) k++;
          d = src.slice(i - 1, k);
          i = k;
        }
        // \left. … \right| is the evaluate-at bar (Tmpl, R10); a lone \left. or \right. still has to pair up
        out.push({ t: name === "left" ? "open" : "close", v: d });
      } else if (name in OPEN_CMD) out.push({ t: "open", v: OPEN_CMD[name] as string });
      else if (name in CLOSE_CMD) out.push({ t: "close", v: CLOSE_CMD[name] as string });
      else out.push({ t: "cmd", v: name });
    } else if (isDigit(c) || (c === "." && isDigit(src[i + 1]))) {
      let j = i;
      while (isDigit(src[j])) j++;
      const comma = commaAt(src, j, decimalComma);
      let v: string;
      if (src[j] === "." && isDigit(src[j + 1])) {
        j++;
        while (isDigit(src[j])) j++;
        v = src.slice(i, j);
      } else if (comma && isDigit(src[j + comma])) {
        const intPart = src.slice(i, j);
        j += comma;
        const k = j;
        while (isDigit(src[j])) j++;
        v = `${intPart}.${src.slice(k, j)}`;
      } else if (src[j] === "." && c !== ".") {
        // "5." alone: treat the dot as part of the number
        j++;
        v = src.slice(i, j);
      } else if (comma && c !== ".") {
        // R57: "5," alone (the decimal comma and no digit after it, as 3,ᴇ3 types it): the same as "5."
        const intPart = src.slice(i, j);
        j += comma;
        v = `${intPart}.`;
      } else v = src.slice(i, j);
      // F24 (R29): a second decimal separator right after a number with one (2.5.3, 1..5, 2,5,3) is not a product
      if (v.includes(".")) {
        if (src[j] === ".") throw parseError("parse.onePoint");
        const c2 = commaAt(src, j, decimalComma);
        if (c2 && isDigit(src[j + c2])) throw parseError("parse.oneComma");
      }
      // F43 (R51): the parser refuses a number after a number and spacing (2 3, 1\,000), never a silent product
      out.push(gapAt === out.length && out[out.length - 1]?.t === "num" ? { t: "num", v, gap: true } : { t: "num", v });
      i = j;
    } else if (c === "\u1D07") {
      out.push({ t: "cmd", v: EMARK });
      i++;
    } else if (c === "\u00C5") {
      out.push({ t: "cmd", v: ARING });
      i++;
    } else if (c === "(") {
      out.push({ t: "open", v: "(" });
      i++;
    } else if (c === ")") {
      out.push({ t: "close", v: ")" });
      i++;
    } else {
      out.push({ t: "ch", v: c });
      i++;
    }
  }
  return out;
}
