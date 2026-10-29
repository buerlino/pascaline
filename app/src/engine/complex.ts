// SPDX-License-Identifier: GPL-3.0-or-later
// G50, G60: the complex workaround. Giac's complex atan takes the other side of its cuts on the imaginary axis beyond ±i
// (atan(2*i): Giac's ln((i+z)/(i-z)) of -3, mpmath's principal value is the other side), so an input's atan is read
// through our definition (pasatan); a stored name or user function that calls it is read through a copy
// (complexReads). Split from numeric.ts (cleanup 2026-10-20, item 13). Synchronous, UI-free; only erasable TypeScript.
import { AUDITED_FUNCTIONS, namePrint, type Giac } from "./numeric.ts";
import { functionsIn, leadingName, names, namesIn, programParams, renameCalls, renameNames, topLevelArgs, type Quoting } from "./giacPrint.ts";

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

/**
 * G129 (F124): Home's exact pass reads an input's atan through `pasatanx`, so every atan of one input is the principal
 * one, whichever function wraps it. Giac's own atan on its cut (z = i·t, |t| > 1) is the other side, and Giac's rules
 * rewrite trig(atan z) before pasatan's ln form is ever applied (cos(atan(2*i)) gave i*sqrt(3)/3, the right value is
 * -i*sqrt(3)/3). On the cut pasatanx is the principal value sign(t)·π/2 + i·atanh(1/t), exact and in a form Giac's
 * rules read right; anywhere else it is Giac's atan itself, so its closed forms stay (atan(1) = pi/4, atan(tan(4*i)) =
 * 4*i, cos(atan(1+i))). Loaded once per engine (homeEval.ts ENGINE_DEFINITIONS, through any input that names atan).
 */
export const EXACT_ATAN: Readonly<Record<string, string>> = {
  pasatanx:
    "pasatanx(z):={ if (type(z)==DOM_LIST) return map(z,pasatanx); " +
    "if (type(evalf(z))==DOM_COMPLEX and re(z)==0 and abs(im(z))>1) return sign(im(z))*pi/2+i*atanh(1/im(z)); return atan(z); }",
};

/** `text` with every atan and arctan call replaced by pasatanx (EXACT_ATAN), outside strings; one that is the argument
 *  of tan stays Giac's atan: tan(atan(z)) = z on any branch, and Giac's rule keeps it exact (tan(atan(2*i)) = 2*i). */
export function exactAtan(text: string, q: Quoting): string {
  return renameCalls(text, { atan: "pasatanx", arctan: "pasatanx" }, q).replace(/(^|[^\w.])tan\(pasatanx\(/g, "$1tan(atan(");
}

/** The Giac names (and aliases) that COMPLEX_DEFINITIONS replace. */
const COMPLEX_REPLACED: Readonly<Record<string, string>> = {
  atan: "pasatan", arctan: "pasatan",
};

/** `text` with every call of a function Giac gets wrong on complex arguments replaced by ours (outside strings); the
 *  same text when there is none. `q`: "printed" for a text Giac printed (a stored value, namePrint). */
export function complexSafe(text: string, q: Quoting): string {
  return renameCalls(text, COMPLEX_REPLACED, q);
}

/** Prepares `text` to be evaluated for its value: with complexSafe's replacements and their definitions loaded; the
 *  text itself when there is nothing to replace. */
export function forValue(giac: Giac, text: string, q: Quoting): string {
  const safe = complexSafe(text, q);
  if (safe === text) return text;
  for (const [name, def] of Object.entries(COMPLEX_DEFINITIONS)) {
    if (!safe.includes(name)) continue;
    // A defined function prints as its program; an undefined name prints as itself.
    if (giac.eval(name).trim() === name) giac.eval(def);
  }
  return safe;
}

/** The functions of `input` that COMPLEX_DEFINITIONS replace in RAD (atan and arctan). */
export function complexReplacedIn(input: string, q: Quoting): string[] {
  return functionsIn(input, q).filter((f) => Object.hasOwn(COMPLEX_REPLACED, f));
}

/** The value of `name` has a non-zero imaginary part (or its im() cannot be had). */
export function nonReal(giac: Giac, name: string): boolean {
  const im = giac.eval(`im(${name})`);
  return isError(im) || /[1-9]/.test(im.replace(/e[+-]?\d+/g, ""));
}

/** Most stored names and functions complexReads looks into for one input (each is one Giac call). */
const MAX_READS = 40;

/**
 * What `expr` reads through stored names (G50f1, G56). A name or user function whose stored text calls a function
 * COMPLEX_DEFINITIONS replaces (CAS `w:=atan(2*i)` keeps Giac's exact atan(2*i); `f(x):=atan(x)`), or reads such a
 * name further down (`g(x):=f(x)+w`, a body that reads w), is evaluated by Giac with its own complex atan (the other
 * side of the cut) unless it is read through a copy: each such name is replaced by a slot (`pasxn<k>`) that holds its
 * complexSafe text, with the names it reads that need a copy replaced by theirs (G56: so a function inside a stored
 * body, or a value read by one, is ours too; a recursive body calls its own slot), as exactFacts reads Ans through
 * pasxv. A name a program binds (its parameters, its `local` names) is not the stored one (boundIn). `hidden`: the
 * replaced functions that could not be read that way (a copy Giac refused; every one when `copy` is false, for an
 * input that runs once and may assign; every replaced one when more than MAX_READS names were to be looked into); a
 * non-real value then is not audited. Purge `copies` when done.
 */
export function complexReads(giac: Giac, expr: string, copy = true): { text: string; copies: string[]; hidden: string[] } {
  const known = new Map<string, string | null>();
  // Past MAX_READS a name is not looked into: what it reads is not known (hidden, below).
  let capped = false;
  // The stored text of a user's name or function; null for a free name or a builtin (each name is asked once).
  const stored = (n: string): string | null => {
    if (known.has(n)) return known.get(n)!;
    if (Object.hasOwn(COMPLEX_REPLACED, n) || Object.hasOwn(COMPLEX_DEFINITIONS, n) || AUDITED_FUNCTIONS.has(n)) return null;
    if (known.size >= MAX_READS) {
      capped = true;
      return null;
    }
    const v = namePrint(giac, n);
    const out = isError(v) || v === n || v === "" || v === `'${n}'` ? null : v;
    known.set(n, out);
    return out;
  };
  // The stored names each stored text reads (not the ones it binds), from the input's names down.
  const refs = new Map<string, string[]>();
  const queue = [...new Set([...namesIn(expr, "typed"), ...functionsIn(expr, "typed")])];
  const top = queue.filter((n) => stored(n) !== null);
  for (let n = queue.shift(); n !== undefined; n = queue.shift()) {
    const v = stored(n);
    if (v === null || refs.has(n)) continue;
    const bound = boundIn(v);
    const out = [...new Set([...functionsIn(v, "printed"), ...namesIn(v, "printed")])].filter((m) => !bound.has(m) && stored(m) !== null);
    refs.set(n, out);
    queue.push(...out);
  }
  // A name needs a copy when its text calls a replaced function, or reads a name that needs one (to a fixed point, so a
  // cycle of functions is read too).
  const needs = new Set([...refs.keys()].filter((n) => complexReplacedIn(stored(n)!, "printed").length > 0));
  for (let grew = true; grew; ) {
    grew = false;
    for (const [n, out] of refs)
      if (!needs.has(n) && out.some((m) => needs.has(m))) {
        needs.add(n);
        grew = true;
      }
  }
  const fns = [...new Set([...needs].flatMap((n) => complexReplacedIn(stored(n)!, "printed")))];
  if (capped) fns.push(...Object.keys(COMPLEX_REPLACED).filter((f) => !fns.includes(f)));
  if (!needs.size) return { text: expr, copies: [], hidden: fns };
  if (!copy) return { text: expr, copies: [], hidden: fns };
  const slots = new Map([...needs].map((n, k): [string, string] => [n, `pasxn${k}`]));
  const throughSlots = (text: string, names: readonly string[], q: Quoting): string =>
    renameNames(text, new Map(names.filter((m) => slots.has(m)).map((m) => [m, slots.get(m)!])), q);
  // The names a text reads come first, so a value's copy is evaluated with the copies it reads defined.
  const order: string[] = [];
  const visit = (n: string): void => {
    if (order.includes(n) || !needs.has(n)) return;
    order.push(n);
    for (const m of refs.get(n) ?? []) visit(m);
  };
  for (const n of needs) visit(n);
  let refused = false;
  for (const n of order.reverse()) {
    // G105f2: Giac prints `\` as itself; read back as typed it escapes the next character (`"C:\"` runs on, and Giac
    // gives a string, not an error), so a copy of such a text is not the stored one: refused.
    const text = throughSlots(forValue(giac, stored(n)!, "printed"), refs.get(n) ?? [], "printed");
    if (text.includes("\\") || isError(giac.eval(`${slots.get(n)}:=(${text})`))) refused = true;
  }
  // A refused copy leaves its slot empty: the input keeps the stored names (Giac's own value, unaudited).
  return { text: refused ? expr : throughSlots(expr, top, "typed"), copies: [...slots.values()], hidden: refused || capped ? fns : [] };
}

/** The names a stored program binds (`(x,y)->{local a,b:=1; …}` → x, y, a, b): its parameters and `local` names, which
 *  its body reads in place of a stored name of the same name. Empty for a text that is not a program. */
function boundIn(v: string): Set<string> {
  const head = programParams(v, true);
  if (!head) return new Set();
  const out = new Set(head.filter((p) => p !== ""));
  for (const w of names(v, "printed")) {
    const from = w.at + w.name.length;
    const end = v.indexOf(";", from);
    if (w.name !== "local" || end < 0 || v.charAt(from).trim() !== "") continue;
    for (const part of topLevelArgs(v.slice(from, end), "printed")) {
      const n = leadingName(part, false);
      if (n !== null) out.add(n);
    }
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
  if (complexSafe(expr, "typed") !== expr) return true;
  const r = complexReads(giac, expr);
  purgeReads(giac, r.copies);
  return r.copies.length > 0;
}

