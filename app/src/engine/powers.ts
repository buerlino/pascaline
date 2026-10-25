// SPDX-License-Identifier: GPL-3.0-or-later
// G59f1 (r16 F3): powers that Giac's exact evaluation may move to another branch. Giac rewrites a power with a
// non-positive or complex base as (z^a)^(1/n), which is another branch, and evalf of its exact text takes the same path;
// exp(b*ln(a)) is the principal value. Text only, no engine; only erasable TypeScript syntax, so Node runs this file.
import { closing, isNameChar, opening } from "./giacPrint.ts";

/** `t` without the brackets that enclose all of it. */
function unwrap(t: string): string {
  let s = t.trim();
  while (s.startsWith("(") && closing(s, 0, "typed") === s.length - 1) s = s.slice(1, -1).trim();
  return s;
}

/** The base is a number literal (positive or zero) or a positive real constant by name: its power has one value. */
function plainBase(base: string): boolean {
  return /^(?:\d+(?:\.\d*)?|\.\d+|pi|e)$/.test(unwrap(base));
}

/** The exponent is an integer literal (with a sign): the power has one value on every branch. */
function integerExponent(exp: string): boolean {
  return /^[+-]?\s*\d+$/.test(unwrap(exp));
}

/** [start, end) of the operand that ends just before `at` (a name, a number, a call or a bracketed group); null. */
function leftOperand(s: string, at: number): [number, number] | null {
  let k = at - 1;
  while (k >= 0 && s.charAt(k) === " ") k--;
  if (k < 0) return null;
  const end = k + 1;
  if (s.charAt(k) === ")") {
    k = opening(s, k) - 1;
    if (k < -1) return null;
  } else if (s.charAt(k) === "]" || s.charAt(k) === "}") return null; // a list or matrix base is left alone
  while (k >= 0 && isNameChar(s.charAt(k))) k--;
  const start = k + 1;
  if (start === end) return null;
  // `.^` (element-wise) and a decimal point are not ours.
  return s.charAt(k) === "." ? null : [start, end];
}

/** [start, end) of the operand that starts just after `at`: an optional sign, then a name, number, call or group. */
function rightOperand(s: string, at: number): [number, number] | null {
  let k = at + 1;
  while (s.charAt(k) === " ") k++;
  const start = k;
  if (s.charAt(k) === "+" || s.charAt(k) === "-") k++;
  while (s.charAt(k) === " ") k++;
  while (isNameChar(s.charAt(k)) || s.charAt(k) === ".") k++;
  if (s.charAt(k) === "(") {
    const c = closing(s, k, "typed");
    if (c < 0) return null;
    k = c + 1;
  }
  return k === start ? null : [start, k];
}

/**
 * `text` with each power a^b whose exponent is not an integer literal and whose base is not a number literal, pi or e
 * written as exp((b)*ln(a)), the principal value; null when `text` holds no such power (or a string, or a power it
 * cannot read). The rightmost power is rewritten first, so a^b^c is a^(b^c), as Giac reads it.
 */
export function principalPowers(text: string): string | null {
  if (text.includes('"')) return null;
  let s = text;
  let changed = false;
  for (let guard = 0; guard < 64; guard++) {
    let found = false;
    for (let at = s.lastIndexOf("^"); at >= 0; at = at > 0 ? s.lastIndexOf("^", at - 1) : -1) {
      if (s.charAt(at - 1) === "." || s.charAt(at - 1) === "*") continue;
      const l = leftOperand(s, at);
      const r = rightOperand(s, at);
      if (!l || !r) return null;
      const base = s.slice(l[0], l[1]);
      const exp = s.slice(r[0], r[1]);
      if (plainBase(base) || integerExponent(exp)) continue;
      s = `${s.slice(0, l[0])}exp((${exp})*ln(${base}))${s.slice(r[1])}`;
      changed = found = true;
      break;
    }
    if (!found) break;
  }
  return changed ? s : null;
}
