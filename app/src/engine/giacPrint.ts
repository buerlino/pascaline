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
export function stringEnd(s: string, open: number, q: Quoting): number {
  for (let k = open + 1; k < s.length; k++) {
    const c = s.charAt(k);
    if (c === '"') return k;
    if (c === "\\" && q === "typed") k++;
  }
  return -1;
}

/**
 * G105f2: a value as Giac printed it, as typed text (the log's commands are all typed). Only strings differ: a doubled
 * quote reads the same in both quotings (`d:=("x""y")` has size 3), and a string with a `\` becomes a join with
 * char(92), since Giac's lexer refuses a typed string ending in two backslashes before a bracket (`b:=("C:\\")` gives
 * undef; `b:=(["C:"+char(92),1])` holds C:\, probe 2026-10-25).
 */
export function typedFromPrinted(text: string): string {
  let out = "";
  let i = 0;
  for (let k = text.indexOf('"'); k >= 0; k = text.indexOf('"', i)) {
    let end = stringEnd(text, k, "printed");
    while (end >= 0 && text.charAt(end + 1) === '"') end = stringEnd(text, end + 1, "printed");
    if (end < 0) break;
    const str = text.slice(k, end + 1);
    const [first, ...rest] = str.slice(1, -1).split("\\");
    out += text.slice(i, k) + (rest.length ? `("${first}"${rest.map((p) => "+char(92)" + (p ? `+"${p}"` : "")).join("")})` : str);
    i = end + 1;
  }
  return out + text.slice(i);
}

/** `s` with every string (its quotes included; an unclosed one runs to the end) replaced by `by`, or by `by` of it. */
export function withoutStrings(s: string, by: string | ((str: string) => string), q: Quoting): string {
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
export function walk(s: string, from: number, visit: (k: number, depth: number, ch: string) => boolean | void, q: Quoting): number {
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
export function closing(s: string, open: number, q: Quoting): number {
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
export function topLevelArgs(s: string, q: Quoting): string[] {
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
export function balanced(s: string, q: Quoting): boolean {
  let last = 0;
  const end = walk(s, 0, (_k, d) => {
    last = d;
    return d < 0;
  }, q);
  return end === -1 && last === 0;
}

/** No bracket stays open (a closer too many is allowed): a block of lines read so far may end here. */
export function noneOpen(s: string, q: Quoting): boolean {
  let last = 0;
  walk(s, 0, (_k, d) => void (last = d), q);
  return last <= 0;
}

/** The elements of a bracketed Giac list as printed (`[a,b]`, or `list[a,b]`, Giac's list type), top level only; null
 *  otherwise. */
export function splitList(text: string): string[] | null {
  const t = text.trim();
  const body = t.startsWith(LIST_TYPE) ? t.slice(4) : t;
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

// --- Giac's list type (G109) -----------------------------------------------------------------------------------------

/** How Giac prints a value of its list type (`list[1,4]`, subtype 23; a `[ ]` vector is 0): the print says the
 *  subtype, so bridge-3's text and the state read's give it with no extra call. A solve result is one too. */
export const LIST_TYPE = "list[";

// --- Giac's matrix type (G130) ---------------------------------------------------------------------------------------

/** How Giac prints a value of its matrix subtype (11: matrix(2,3), zeros, idn, tran, a matrix times one). Bridge-3's
 *  kind says "matrix" for a `[[…]]` vector too and carries no subtype (api.cc kindOf; adding it needs an engine rebuild),
 *  so the print is the one place that says it, as `list[` does for the list type. */
export const MATRIX_TYPE = "matrix[";

/** `text` (Giac's print) is one value of the matrix type as a whole: `matrix[` opens it and its bracket closes at the
 *  end (not `matrix[[1]]*x`, nor a vector whose element is one). */
export function matrixTyped(text: string): boolean {
  return text.startsWith(MATRIX_TYPE) && closing(text, MATRIX_TYPE.length - 1, "printed") === text.length - 1;
}

/** Giac's print with every value of its list type written with braces, as the G2 shows a list (`list[[1,2],3]` →
 *  `{[1,2],3}`, `[list[1,2],3]` → `[{1,2},3]`), at any depth; strings and a name that ends in `list` are left alone.
 *  Bridge-3 gives the kind and the flat elements but no print in braces, and a list inside a vector needs the nesting. */
export function bracesOf(text: string): string {
  // where each list type opens (its `list[`) and where its `]` closes it
  const cuts = new Map<number, [number, string]>();
  walk(text, 0, (k) => {
    const b = text.charAt(k - 1);
    if (!text.startsWith(LIST_TYPE, k) || isNameChar(b) || b === ".") return;
    const close = closing(text, k + LIST_TYPE.length - 1, "printed");
    if (close < 0) return;
    cuts.set(k, [LIST_TYPE.length, "{"]);
    cuts.set(close, [1, "}"]);
  }, "printed");
  return withCuts(text, cuts);
}

/** R80f1: the inverse of bracesOf: every brace pair outside strings written as Giac's `list[…]` again
 *  (`{Ci(1),Ci(2)}` → `list[Ci(1),Ci(2)]`), so a value the CAS view shows in braces reads back as the list it came from,
 *  not as a set. `listTypeOf(bracesOf(x)) === x` for every print without a brace of its own. */
export function listTypeOf(shown: string): string {
  const cuts = new Map<number, [number, string]>();
  walk(shown, 0, (k, _d, ch) => {
    if (ch !== "{") return;
    const close = closing(shown, k, "printed");
    if (close < 0) return;
    cuts.set(k, [1, LIST_TYPE]);
    cuts.set(close, [1, "]"]);
  }, "printed");
  return withCuts(shown, cuts);
}

/** `text` with each cut (at its index: the length it replaces, the text it puts there) applied. */
function withCuts(text: string, cuts: ReadonlyMap<number, readonly [number, string]>): string {
  let out = "";
  let i = 0;
  for (const k of [...cuts.keys()].sort((x, y) => x - y)) {
    const [len, put] = cuts.get(k)!;
    out += text.slice(i, k) + put;
    i = k + len;
  }
  return out + text.slice(i);
}

// --- a printed value as a tree -------------------------------------------------------------------------------------

/** A node of Giac's printed list: its raw text, and its elements (a list) or its value (a string). */
export interface PrintedNode {
  raw: string;
  items?: PrintedNode[];
  str?: string;
}

/** Parses Giac's printed value: lists `[…]`, strings `"…"` (a quote inside is doubled) and atoms. Null when it does not
 *  parse. */
export function parsePrinted(text: string): PrintedNode | null {
  let i = 0;
  // the next quote from `from` (a string's end or a doubled quote; an atom skips a string inside it)
  const nextQuote = (from: number): number => text.indexOf('"', from);
  const node = (): PrintedNode | null => {
    while (text[i] === " " || text[i] === "\n") i++;
    const start = i;
    if (text[i] === "[") {
      i++;
      const items: PrintedNode[] = [];
      while (text[i] === " " || text[i] === "\n") i++;
      if (text[i] === "]") {
        i++;
        return { raw: text.slice(start, i), items };
      }
      for (;;) {
        const n = node();
        if (!n) return null;
        items.push(n);
        while (text[i] === " " || text[i] === "\n") i++;
        if (text[i] === ",") i++;
        else if (text[i] === "]") {
          i++;
          return { raw: text.slice(start, i), items };
        } else return null;
      }
    }
    if (text[i] === '"') {
      let s = "";
      i++;
      for (;;) {
        if (i >= text.length) return null;
        // G104: a slice up to the next quote (a 600 kB print char by char took longer than Giac printing it)
        const q = nextQuote(i);
        if (q < 0) return null;
        s += text.slice(i, q);
        i = q;
        if (text[i + 1] === '"') {
          s += '"';
          i += 2;
          continue;
        }
        i++;
        return { raw: text.slice(start, i), str: s };
      }
    }
    // An atom: up to the next , or ] outside brackets and quotes.
    const end = walk(text, i, (_k, d, c) => d < 0 || (c === "," && d === 0), "printed");
    if (end === UNCLOSED) return null;
    i = end < 0 ? text.length : end;
    const raw = text.slice(start, i).trim();
    return raw ? { raw } : null;
  };
  const out = node();
  return out && text.slice(i).trim() === "" ? out : null;
}

// --- names ----------------------------------------------------------------------------------------------------------

/** A name as Giac's language writes one. */
export const NAME = "[A-Za-z_][A-Za-z0-9_]*";
const WHOLE_NAME = new RegExp(`^${NAME}$`);

/** `c` (one character) can be part of a name. */
export function isNameChar(c: string): boolean {
  return (c >= "a" && c <= "z") || (c >= "A" && c <= "Z") || (c >= "0" && c <= "9") || c === "_";
}

/** `s` is one name (a user name starts with a letter: `letterFirst`). */
export function isName(s: string, letterFirst = false): boolean {
  return WHOLE_NAME.test(s) && (!letterFirst || s.charAt(0) !== "_");
}

/** The name `s` starts with (after spaces), a user's name (letter first) unless `letterFirst` is false; null when
 *  there is none. */
export function leadingName(s: string, letterFirst = true): string | null {
  const m = LEADING_NAME.exec(s);
  return m && isName(m[1]!, letterFirst) ? m[1]! : null;
}
const LEADING_NAME = new RegExp(`^\\s*(${NAME})`);

/** Every word of `text` that looks like a name, in strings and number literals too (`2e5` gives e5): reads over. */
export function wordsOf(text: string): string[] {
  return [...new Set(text.match(ANY_NAME) ?? [])];
}
const ANY_NAME = new RegExp(NAME, "g");

/** Every name in `s` in order (strings and the exponents of number literals are skipped), with whether it is called
 *  (`(` follows it) and where it starts. */
export function* names(s: string, q: Quoting): Generator<{ name: string; at: number; call: boolean; open: number }> {
  const t = withoutStrings(s, (x) => " ".repeat(x.length), q);
  // Number literals first, so the exponent of 2e5 is not read as a name.
  const re = new RegExp(`(?:\\d+\\.?\\d*|\\.\\d+)(?:[eE][+-]?\\d+)?|(${NAME})(\\s*\\()?`, "g");
  for (let m = re.exec(t); m; m = re.exec(t)) {
    if (m[1] === undefined) continue;
    yield { name: m[1], at: m.index, call: m[2] !== undefined, open: m[2] !== undefined ? m.index + m[0].length - 1 : -1 };
  }
}

/** The first name of `set` in `s` (called or not; strings skipped), or null. */
export function firstNameIn(s: string, set: ReadonlySet<string>, q: Quoting): string | null {
  for (const n of names(s, q)) if (set.has(n.name)) return n.name;
  return null;
}

/** The calls in `s` (of `only` when given), in order: name, where it starts, its `(` and its `)` (-1 when it does not
 *  close). */
export function callsOf(s: string, only: ReadonlySet<string> | readonly string[] | undefined, q: Quoting): { name: string; at: number; open: number; close: number }[] {
  const want = only === undefined ? null : new Set(only);
  const out: { name: string; at: number; open: number; close: number }[] = [];
  for (const n of names(s, q)) {
    if (!n.call || (want && !want.has(n.name))) continue;
    out.push({ name: n.name, at: n.at, open: n.open, close: closing(s, n.open, q) });
  }
  return out;
}

/** `text` with every name replaced by `f` of it where `f` gives a text (strings skipped). */
export function mapNames(text: string, f: (n: { name: string; at: number; call: boolean }) => string | null, q: Quoting): string {
  let out = "";
  let i = 0;
  for (const n of names(text, q)) {
    const to = f(n);
    if (to === null) continue;
    out += text.slice(i, n.at) + to;
    i = n.at + n.name.length;
  }
  return out + text.slice(i);
}

/** `text` with the name of every call of a key of `to` replaced by its value (`erf(` → `paserf(`). */
export function renameCalls(text: string, to: Readonly<Record<string, string>>, q: Quoting): string {
  return mapNames(text, (n) => (n.call && Object.hasOwn(to, n.name) ? to[n.name]! : null), q);
}

/** `text` with every name that is a key of `to` (called or not; not after a `.`) replaced by its value. */
export function renameNames(text: string, to: ReadonlyMap<string, string>, q: Quoting): string {
  return mapNames(text, (n) => (text.charAt(n.at - 1) !== "." ? (to.get(n.name) ?? null) : null), q);
}

/** `text` with every number literal (`12`, `2.5`, `.5`, `1e-3`, `1.2E5`; not inside a name, `x1`, `0x1F`, nor a
 *  string) replaced by `f` of its mantissa and exponent part (`e-3`, or undefined) where `f` gives a text. G117: `..`
 *  is Giac's range operator, so a number ends before it and one starts right after it (`1.5..3` is 1.5 and 3). */
export function mapNumbers(text: string, f: (mant: string, exp: string | undefined) => string | null, q: Quoting): string {
  const t = withoutStrings(text, (x) => " ".repeat(x.length), q);
  const re = new RegExp(`${NAME}|(\\d+\\.(?!\\.)\\d*|(?<!\\.)\\.\\d+|\\d+)([eE][+-]?\\d+)?`, "g");
  let out = "";
  let i = 0;
  for (let m = re.exec(t); m; m = re.exec(t)) {
    const to = m[1] === undefined ? null : f(m[1], m[2]);
    if (to === null) continue;
    out += text.slice(i, m.index) + to;
    i = m.index + m[0].length;
  }
  return out + text.slice(i);
}

/** Every place `lit` stands in `text` as a whole literal (no name character, `.` or `^` before it, no name character
 *  or `.` after it), replaced by `by`. */
export function replaceLiteral(text: string, lit: string, by: string): string {
  let out = "";
  let i = 0;
  for (let k = text.indexOf(lit); k >= 0; k = text.indexOf(lit, k + 1)) {
    const b = text.charAt(k - 1);
    const a = text.charAt(k + lit.length);
    if (k < i || isNameChar(b) || b === "." || b === "^" || isNameChar(a) || a === ".") continue;
    out += text.slice(i, k) + by;
    i = k + lit.length;
  }
  return out + text.slice(i);
}

/** Names called in a Giac text (`romberg(exp(-x^2),x,0,1)` → romberg, exp). Strings are skipped (as `q` writes them). */
export function functionsIn(input: string, q: Quoting): string[] {
  const out: string[] = [];
  for (const n of names(input, q)) if (n.call && !out.includes(n.name)) out.push(n.name);
  return out;
}

/** Names in a Giac text that are not called (`B*2+f(x)` → B, x). Strings are skipped (as `q` writes them). */
export function namesIn(input: string, q: Quoting): string[] {
  const out: string[] = [];
  for (const n of names(input, q)) if (!n.call && !out.includes(n.name)) out.push(n.name);
  return out;
}

/** The arguments of `text` when all of it is one call of `name` (`purge(a,b)` → ["a", "b"]); null otherwise. */
export function wholeCall(text: string, name: string, q: Quoting): string[] | null {
  const t = text.trim();
  const c = callsOf(t, [name], q)[0];
  if (!c || c.at !== 0 || c.close !== t.length - 1) return null;
  const open = c.open;
  return topLevelArgs(t.slice(open + 1, -1), q).map((a) => a.trim());
}

/** The text after `name:=` when `text` starts with it (spaces allowed around `name`), or null. */
export function afterStore(text: string, name: string): string | null {
  const t = text.trimStart();
  if (!t.startsWith(name)) return null;
  const rest = t.slice(name.length).trimStart();
  return rest.startsWith(":=") && rest.length > 2 ? rest.slice(2) : null;
}

/** The name `text` defines (`f(x):=…`, `a:=…`, the name first; `_` may lead), or null. */
export function definedName(text: string): string | null {
  const m = LEADING_NAME.exec(text);
  if (!m) return null;
  const rest = text.slice(m[0].length).trimStart();
  return rest.startsWith("(") || rest.startsWith(":=") ? m[1]! : null;
}

/** The parameters of a program as Giac prints it (`(x,y)->…` → x, y), when they hold no `(`; `bare`: `x->…` too;
 *  null for another text. */
export function programParams(text: string, bare = false): string[] | null {
  const t = text.trimStart();
  if (!t.startsWith("(")) {
    const n = bare ? leadingName(t, false) : null;
    return n !== null && t.slice(n.length).trimStart().startsWith("->") ? [n] : null;
  }
  const close = closing(t, 0, "printed");
  if (close < 0 || t.slice(1, close).includes("(") || !t.slice(close + 1).trimStart().startsWith("->")) return null;
  return t.slice(1, close).split(",").map((p) => p.trim());
}
