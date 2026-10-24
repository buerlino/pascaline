// SPDX-License-Identifier: GPL-3.0-or-later
// G105 (P20): the one reader of Giac text. The bridge (bridge.ts) answers names, stores, settings and a value's kind;
// what is left to read as text is here: Giac's print for display and copy, and the input text of a few checks that
// run before Giac sees it. One string skip, one bracket walk, one name pattern; nothing else in src/engine reads
// brackets or names out of Giac text. Synchronous, UI-free, no engine; only erasable TypeScript syntax.

/**
 * How a string is written. "typed": Giac's language (our parser's output, a library file): `\` escapes the next
 * character, so `"a\"b"` is one string (text-9). "printed": Giac's print: a quote inside a string is doubled (`"a""b"`,
 * read as two strings side by side, which skips the same text) and `\` is itself (`g(x):="q,(\\"` prints `"q,(\"`).
 */
export type Quoting = "typed" | "printed";

/** The index of the quote that closes the string whose opening quote is at `open`; -1 when none does. */
export function stringEnd(s: string, open: number, q: Quoting = "typed"): number {
  for (let k = open + 1; k < s.length; k++) {
    const c = s.charAt(k);
    if (c === '"') return k;
    if (c === "\\" && q === "typed") k++;
  }
  return -1;
}

/** `s` with every string (its quotes included; an unclosed one runs to the end) replaced by `by`, or by `by` of it. */
export function withoutStrings(s: string, by: string | ((str: string) => string) = '""', q: Quoting = "typed"): string {
  let out = "";
  let i = 0;
  for (let k = s.indexOf('"'); k >= 0; k = s.indexOf('"', i)) {
    const end = stringEnd(s, k, q);
    const stop = end < 0 ? s.length : end + 1;
    out += s.slice(i, k) + (typeof by === "string" ? by : by(s.slice(k, stop)));
    i = stop;
  }
  return out + s.slice(i);
}

const OPENERS = "([{";
const CLOSERS = ")]}";

/** walk's answer when a string does not close. */
export const UNCLOSED = -2;

/**
 * The one bracket walk: each character of `s` from `from` that is outside strings, in order, with the depth of the
 * brackets `(`, `[`, `{` open around it (an opener counts itself, a closer does not: `f(x)` walks f 0, ( 1, x 1, ) 0).
 * Stops where `visit` returns true and gives that index; -1 at the end; UNCLOSED at a string that does not close.
 */
export function walk(s: string, from: number, visit: (k: number, depth: number, ch: string) => boolean | void, q: Quoting = "typed"): number {
  let depth = 0;
  for (let k = from; k < s.length; k++) {
    const ch = s.charAt(k);
    if (ch === '"') {
      const end = stringEnd(s, k, q);
      if (end < 0) return UNCLOSED;
      k = end;
      continue;
    }
    if (OPENERS.includes(ch)) depth++;
    else if (CLOSERS.includes(ch)) depth--;
    if (visit(k, depth, ch)) return k;
  }
  return -1;
}

/** Index of the bracket that closes the one at `open` (`(`, `[` or `{`), skipping strings; -1 when there is none. */
export function closing(s: string, open: number, q: Quoting = "typed"): number {
  return Math.max(-1, walk(s, open, (_k, d, ch) => d === 0 && CLOSERS.includes(ch), q));
}

/** Index of the bracket that opens the one closing at `close`, walking back over a text without strings; -1. */
export function opening(s: string, close: number): number {
  let depth = 0;
  for (let k = close; k >= 0; k--) {
    const ch = s.charAt(k);
    if (CLOSERS.includes(ch)) depth++;
    else if (OPENERS.includes(ch) && --depth === 0) return k;
  }
  return -1;
}

/** The top-level comma-separated parts of an argument list (an unclosed string runs to the end). */
export function topLevelArgs(s: string, q: Quoting = "typed"): string[] {
  const out: string[] = [];
  let start = 0;
  walk(s, 0, (k, d, ch) => {
    if (ch === "," && d === 0) {
      out.push(s.slice(start, k));
      start = k + 1;
    }
  }, q);
  out.push(s.slice(start));
  return out;
}

/** Every bracket closes, none below depth 0, and every string closes. */
export function balanced(s: string, q: Quoting = "typed"): boolean {
  let last = 0;
  const end = walk(s, 0, (_k, d) => {
    last = d;
    return d < 0;
  }, q);
  return end === -1 && last === 0;
}

/** No bracket stays open (a closer too many is allowed): a block of lines read so far may end here. */
export function noneOpen(s: string, q: Quoting = "typed"): boolean {
  let last = 0;
  walk(s, 0, (_k, d) => void (last = d), q);
  return last <= 0;
}

/** The elements of a bracketed Giac list as printed (`[a,b]`, `list[a,b]`, the `solve` form), top level only; null
 *  otherwise. */
export function splitList(text: string): string[] | null {
  const t = text.trim();
  const body = t.startsWith("list[") ? t.slice(4) : t;
  if (!body.startsWith("[") || !body.endsWith("]")) return null;
  const inner = body.slice(1, -1);
  if (inner.trim() === "") return [];
  const parts: string[] = [];
  let start = 0;
  let last = 0;
  const end = walk(inner, 0, (k, d, ch) => {
    last = d;
    if (d < 0) return true;
    if (ch === "," && d === 0) {
      parts.push(inner.slice(start, k).trim());
      start = k + 1;
    }
  }, "printed");
  if (end !== -1 || last !== 0) return null;
  parts.push(inner.slice(start).trim());
  return parts;
}

// --- names ----------------------------------------------------------------------------------------------------------

/** A name as Giac's language writes one. */
export const NAME = "[A-Za-z_][A-Za-z0-9_]*";
const WHOLE_NAME = new RegExp(`^${NAME}$`);

/** `s` is one name (a user name starts with a letter: `letterFirst`). */
export function isName(s: string, letterFirst = false): boolean {
  return WHOLE_NAME.test(s) && (!letterFirst || s.charAt(0) !== "_");
}

/** Every name in `s` in order (strings and the exponents of number literals are skipped), with whether it is called
 *  (`(` follows it) and where it starts. */
export function* names(s: string, q: Quoting = "typed"): Generator<{ name: string; at: number; call: boolean; open: number }> {
  const t = withoutStrings(s, (x) => " ".repeat(x.length), q);
  // Number literals first, so the exponent of 2e5 is not read as a name.
  const re = new RegExp(`(?:\\d+\\.?\\d*|\\.\\d+)(?:[eE][+-]?\\d+)?|(${NAME})(\\s*\\()?`, "g");
  for (let m = re.exec(t); m; m = re.exec(t)) {
    if (m[1] === undefined) continue;
    yield { name: m[1], at: m.index, call: m[2] !== undefined, open: m[2] !== undefined ? m.index + m[0].length - 1 : -1 };
  }
}

/** The calls in `s` (of `only` when given), in order: name, where it starts, its `(` and its `)` (-1 when it does not
 *  close). */
export function callsOf(s: string, only?: ReadonlySet<string> | readonly string[], q: Quoting = "typed"): { name: string; at: number; open: number; close: number }[] {
  const want = only === undefined ? null : new Set(only);
  const out: { name: string; at: number; open: number; close: number }[] = [];
  for (const n of names(s, q)) {
    if (!n.call || (want && !want.has(n.name))) continue;
    out.push({ name: n.name, at: n.at, open: n.open, close: closing(s, n.open, q) });
  }
  return out;
}

/** Names called in a Giac text (`romberg(exp(-x^2),x,0,1)` → romberg, exp). Strings are skipped. */
export function functionsIn(input: string): string[] {
  const out: string[] = [];
  for (const n of names(input)) if (n.call && !out.includes(n.name)) out.push(n.name);
  return out;
}

/** Names in a Giac text that are not called (`B*2+f(x)` → B, x). Strings are skipped. */
export function namesIn(input: string): string[] {
  const out: string[] = [];
  for (const n of names(input)) if (!n.call && !out.includes(n.name)) out.push(n.name);
  return out;
}

/** The arguments of `text` when all of it is one call of `name` (`purge(a,b)` → ["a", "b"]); null otherwise. */
export function wholeCall(text: string, name: string): string[] | null {
  const t = text.trim();
  const c = callsOf(t, [name])[0];
  if (!c || c.at !== 0 || c.close !== t.length - 1) return null;
  const open = c.open;
  return topLevelArgs(t.slice(open + 1, -1)).map((a) => a.trim());
}
