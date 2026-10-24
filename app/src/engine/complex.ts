// SPDX-License-Identifier: GPL-3.0-or-later
// G50, G60: the complex workaround. Giac's complex atan takes the other side of its cuts on the imaginary axis beyond ±i
// (atan(2*i): Giac's ln((i+z)/(i-z)) of -3, mpmath's principal value is the other side), so an input's atan is read
// through our definition (pasatan); a stored name or user function that calls it is read through a copy
// (complexReads). Split from numeric.ts (cleanup 2026-10-20, item 13). Synchronous, UI-free; only erasable TypeScript.
import { AUDITED_FUNCTIONS, functionsIn, namePrint, namesIn, topLevelArgs, type Giac } from "./numeric.ts";

function isError(out: string): boolean {
  return out.startsWith("GIAC_ERROR");
}

/**
 * G50 (deep check 2026-10-19 D10), G60: our definitions for the functions whose complex values Giac gets wrong. Left:
 * atan, whose cut Giac takes on the other side (atan(2*i) has 0 right digits at any Digits), which is a branch
 * convention and not a one-line patch (G75's measure); pasatan is the principal branch by its ln form (mpmath's, also
 * on the cuts). Complex tanh was coth until patch 0003 (G75); complex asin, acos and acosh were a double through
 * Giac's double pi in ln and acos until patch 0005 (G60), which also gives asin, acos and acosh of an MPFR real outside
 * their domain. Each is used for a non-real argument, and is the function itself otherwise (Giac runs in radians in
 * every mode, G46); the agreement check then confirms its digits like any other exact value. A list or matrix argument
 * is mapped element by element first (its type is DOM_LIST, which would fall back to Giac's own function).
 */
export const COMPLEX_DEFINITIONS: Readonly<Record<string, string>> = {
  pasatan: "pasatan(z):={ if (type(z)==DOM_LIST) return map(z,pasatan); if (type(evalf(z))==DOM_COMPLEX) return i/2*(ln(1-i*z)-ln(1+i*z)); return atan(z); }",
};

/** The Giac names (and aliases) that COMPLEX_DEFINITIONS replace. */
const COMPLEX_REPLACED: Readonly<Record<string, string>> = {
  atan: "pasatan", arctan: "pasatan",
};
const COMPLEX_CALL = new RegExp(`"[^"]*"|\\b(${Object.keys(COMPLEX_REPLACED).join("|")})(\\s*\\()`, "g");

/** `text` with every call of a function Giac gets wrong on complex arguments replaced by ours (outside strings); the
 *  same text when there is none. */
export function complexSafe(text: string): string {
  return text.replace(COMPLEX_CALL, (m, name?: string, paren?: string) => (name === undefined ? m : `${COMPLEX_REPLACED[name]}${paren}`));
}

/** Prepares `text` to be evaluated for its value: with complexSafe's replacements and their definitions loaded; the
 *  text itself when there is nothing to replace. */
export function forValue(giac: Giac, text: string): string {
  const safe = complexSafe(text);
  if (safe === text) return text;
  for (const [name, def] of Object.entries(COMPLEX_DEFINITIONS)) {
    if (!safe.includes(name)) continue;
    // A defined function prints as its program; an undefined name prints as itself.
    if (giac.eval(name).trim() === name) giac.eval(def);
  }
  return safe;
}

/** The functions of `input` that COMPLEX_DEFINITIONS replace in RAD (atan and arctan). */
export function complexReplacedIn(input: string): string[] {
  return functionsIn(input).filter((f) => Object.hasOwn(COMPLEX_REPLACED, f));
}

/** The value of `name` has a non-zero imaginary part (or its im() cannot be had). */
export function nonReal(giac: Giac, name: string): boolean {
  const im = giac.eval(`im(${name})`);
  return isError(im) || /[1-9]/.test(im.replace(/e[+-]?\d+/g, ""));
}

/** Most stored names and functions complexReads looks into for one input (each is one Giac call). */
const MAX_READS = 40;

/**
 * What `expr` reads through stored names (G50f1). A name or user function whose stored text calls a function
 * COMPLEX_DEFINITIONS replaces (CAS `w:=atan(2*i)` keeps Giac's exact atan(2*i); `f(x):=atan(x)`) is evaluated by Giac
 * with its own complex atan (the other side of the cut) unless it is read through a copy: each such name is replaced in `text` by a slot
 * (`pasxn<k>`) that holds its complexSafe text, as exactFacts reads Ans through pasxv. `hidden`: the replaced functions
 * that could not be read that way (a copy Giac refused; a call
 * found only inside another function's body; every one when `copy` is false, for an input that runs once and may
 * assign); a non-real value then is not audited. Purge `copies` when done.
 */
export function complexReads(giac: Giac, expr: string, copy = true): { text: string; copies: string[]; hidden: string[] } {
  const copies: string[] = [];
  const hidden: string[] = [];
  const known = new Map<string, string | null>();
  // The stored text of a user's name or function; null for a free name or a builtin (each name is asked once).
  const stored = (n: string): string | null => {
    if (known.has(n)) return known.get(n)!;
    if (known.size >= MAX_READS || Object.hasOwn(COMPLEX_REPLACED, n) || AUDITED_FUNCTIONS.has(n)) return null;
    const v = namePrint(giac, n);
    const out = isError(v) || v === n || v === "" ? null : v;
    known.set(n, out);
    return out;
  };
  // Replaced calls further down: in what the names and functions in `v` hold (their copies would still call Giac's).
  const visited = new Set<string>();
  const deeper = (v: string): string[] => {
    const out: string[] = [];
    const bound = boundIn(v);
    for (const n of [...functionsIn(v), ...namesIn(v)]) {
      if (visited.has(n) || bound.has(n)) continue;
      visited.add(n);
      const w = stored(n);
      if (w !== null) out.push(...complexReplacedIn(w), ...deeper(w));
    }
    return out;
  };
  let text = expr;
  const reads: [string, boolean][] = [...namesIn(expr).map((n): [string, boolean] => [n, false]), ...functionsIn(expr).map((n): [string, boolean] => [n, true])];
  for (const [n, called] of reads) {
    const v = stored(n);
    if (v === null) continue;
    hidden.push(...deeper(v));
    const fns = complexReplacedIn(v);
    if (!fns.length) continue;
    const slot = `pasxn${copies.length}`;
    if (!copy || isError(giac.eval(`${slot}:=(${forValue(giac, v)})`))) {
      hidden.push(...fns);
      continue;
    }
    copies.push(slot);
    const at = new RegExp(`"[^"]*"|(?<![A-Za-z0-9_.])${n}(?![A-Za-z0-9_])(${called ? "(?=\\s*\\()" : "(?!\\s*\\()"})`, "g");
    text = text.replace(at, (m, hit?: string) => (hit === undefined ? m : slot));
  }
  return { text, copies, hidden: [...new Set(hidden)] };
}

/** The names a stored program binds (`(x,y)->{local a,b:=1; …}` → x, y, a, b): its parameters and `local` names, which
 *  its body reads in place of a stored name of the same name. Empty for a text that is not a program. */
function boundIn(v: string): Set<string> {
  const head = /^\s*(?:\(([^()]*)\)|([A-Za-z_][A-Za-z0-9_]*))\s*->/.exec(v);
  if (!head) return new Set();
  const out = new Set((head[1] ?? head[2]!).split(",").map((p) => p.trim()).filter((p) => p !== ""));
  for (const m of v.matchAll(/\blocal\s+([^;]*);/g))
    for (const part of topLevelArgs(m[1]!)) {
      const n = /^\s*([A-Za-z_][A-Za-z0-9_]*)/.exec(part);
      if (n) out.add(n[1]!);
    }
  return out;
}

/** Purges the slots complexReads made. */
export function purgeReads(giac: Giac, copies: readonly string[]): void {
  if (copies.length) giac.eval(`purge(${copies.join(",")})`);
}

/** complexReads' text has a replaced function (typed or read through a copy), so Giac's own printed float of `expr` is
 *  not its value (Home keeps no exact text then). */
export function readsReplaced(giac: Giac, expr: string): boolean {
  if (complexSafe(expr) !== expr) return true;
  const r = complexReads(giac, expr);
  purgeReads(giac, r.copies);
  return r.copies.length > 0;
}

