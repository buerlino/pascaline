// SPDX-License-Identifier: GPL-3.0-or-later
// G65 (S13, docs/research/r15-state-facts.md): which names an input stored and which stored names it read, from Giac's
// own state instead of our reading of the input's text. Both reads go into the one call the host makes after every
// input (flags.ts FLAGS_READ, G67), as further elements of its list:
// - the read part: Giac's parse of the input (`quote`, never evaluated). A store (`sommet` is sto) reads its stored side
//   only, a defined program's parameters left out; `L[k]:=` also reads the target's names (L's other elements stay);
// - the state part, only after an input that may store: every user name, its stored text and the names in it (`lname`).
//   The host keeps it as a table and walks the closure over it (facts.ts); the next state part is compared with it.
// Plain text and pure functions; only erasable TypeScript syntax, so Node runs this file directly.
import { ENGINE_DEFINITIONS, EQ_DIFF, EQ_INEXACT_FLAG, EQ_VERDICT, WORKER_DEFINITION_NAMES } from "./homeEval.ts";
import { COMPLEX_DEFINITIONS, DOUBLE_DIGITS, functionsIn, namesIn } from "./numeric.ts";
import { CHIP_PREFIX } from "./chipFacts.ts";
import { UNIT_DEFINITIONS } from "../units/evaluate.ts";

/** A stored user name as Giac holds it. `names`: the names in its value (`lname`), a program's parameters left out
 *  (its locals stay: an over-read gives a weaker mark, never a stronger one). `fn`: the value is a program. */
export interface StoredName {
  text: string;
  names: string[];
  fn: boolean;
}

/** What Giac's parse of an input says. `names`: the names it reads (for a store, of its stored side). `targets`: the
 *  names a top-level store sets. `fn`: a top-level store of a program (`f(x):=…`, `f:=x->…`). */
export interface InputReads {
  names: string[];
  targets: string[];
  fn: boolean;
}

const STO = `"'sto'"`;
/** Applied to quote(<input>): [sommet, lname, 0 | [stored side's lname, is a program, its parameters, targets, the
 *  target's own names for L[k]:=]]. Inline, so it costs no definition call. */
const READER =
  `(q->[string(sommet(q)),lname(q),when(string(sommet(q))==${STO},[lname(op(q)[0]),when(type(op(q)[0])==DOM_FUNC,1,0),` +
  `when(type(op(q)[0])==DOM_FUNC,lname(op(op(q)[0])[0]),[]),when(type(op(q)[1])==DOM_IDENT,[op(q)[1]],` +
  `when(string(sommet(op(q)[1]))=="'at'",[op(op(q)[1])[0]],lname(op(q)[1]))),` +
  `when(type(op(q)[1])==DOM_IDENT or type(op(q)[1])==DOM_LIST,[],lname(op(q)[1]))],0)])`;

/** The read part for `input`. */
export function readPart(input: string): string {
  return `${READER}(quote(${input}))`;
}

/** The state part: Digits pinned (a double prints with Digits, so an unchanged value must print alike in every mode),
 *  then put back to `digits` (the mode's, which the settings check expects). */
export function statePart(digits: number): string {
  return `[(Digits:=${DOUBLE_DIGITS}),map(VARS(),k->[k,string(eval(k)),lname(eval(k))]),(Digits:=${Math.trunc(digits)})]`;
}

/** The call after an input: [settings, read part or 0, state part or 0]. */
export function afterCall(flagsRead: string, input: string | null, state: number | null): string {
  return `[${flagsRead},${input === null ? "0" : readPart(input)},${state === null ? "0" : statePart(state)}]`;
}

/** A node of Giac's printed list: its raw text, and its elements (a list) or its value (a string). */
interface Node {
  raw: string;
  items?: Node[];
  str?: string;
}

/** Parses Giac's printed value: lists `[…]`, strings `"…"` (a quote inside is doubled) and atoms. Null when it does not
 *  parse. */
export function parsePrinted(text: string): Node | null {
  let i = 0;
  const node = (): Node | null => {
    while (text[i] === " " || text[i] === "\n") i++;
    const start = i;
    if (text[i] === "[") {
      i++;
      const items: Node[] = [];
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
        if (text[i] === '"') {
          if (text[i + 1] === '"') {
            s += '"';
            i += 2;
            continue;
          }
          i++;
          return { raw: text.slice(start, i), str: s };
        }
        s += text[i++];
      }
    }
    // An atom: up to the next , or ] outside brackets and quotes.
    let depth = 0;
    while (i < text.length) {
      const c = text[i]!;
      if (c === '"') {
        const q = text.indexOf('"', i + 1);
        if (q < 0) return null;
        i = q + 1;
        continue;
      }
      if (c === "(" || c === "[") depth++;
      else if (c === ")" || c === "]") {
        if (depth === 0) break;
        depth--;
      } else if (c === "," && depth === 0) break;
      i++;
    }
    const raw = text.slice(start, i).trim();
    return raw ? { raw } : null;
  };
  const out = node();
  return out && text.slice(i).trim() === "" ? out : null;
}

/** The three parts of the call's printed result; null when it is not the list afterCall builds. */
export function splitAfter(out: string): { flags: string; read: Node; state: Node } | null {
  const n = parsePrinted(out);
  if (!n?.items || n.items.length !== 3) return null;
  return { flags: n.items[0]!.raw, read: n.items[1]!, state: n.items[2]! };
}

const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;
const idents = (n: Node | undefined): string[] => (n?.items ?? []).map((x) => x.raw).filter((x) => IDENT.test(x));

/** The reads of `input` from its read part; the names in its text when Giac could not parse it alone (`a;b` gives
 *  undef: a conservative over-read). */
export function readsOf(n: Node, input: string): InputReads {
  const it = n.items;
  const all = idents(it?.[1]);
  if (!it || it.length !== 3 || (all.includes("undef") && !namesIn(input).includes("undef"))) {
    return { names: [...namesIn(input), ...functionsIn(input)], targets: [], fn: false };
  }
  const sto = it[2]!.items;
  if (!sto || sto.length !== 5) return { names: all, targets: [], fn: false };
  const params = new Set(idents(sto[2]));
  const names = [...idents(sto[0]).filter((x) => !params.has(x)), ...idents(sto[4])];
  return { names: [...new Set(names)], targets: idents(sto[3]), fn: sto[1]!.raw === "1" };
}

/** A program's printed head, `(x,y)->`: its parameters. */
const HEAD = /^\s*\(([^()]*)\)\s*->/;

/** Our own engine names (definitions, slots, chips, constants, the degree factor): not user state. A name that starts
 *  with `pas` is ours unless `user` holds it (the log, or the input's text names it). */
const OURS = new Set<string>([
  ...Object.keys(ENGINE_DEFINITIONS),
  ...WORKER_DEFINITION_NAMES,
  ...Object.keys(COMPLEX_DEFINITIONS),
  ...UNIT_DEFINITIONS.flatMap((d) => {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*(?:\(|:=)/.exec(d);
    return m ? [m[1]!] : [];
  }),
  "pcasans",
  "pasdeg",
  EQ_INEXACT_FLAG,
  EQ_DIFF,
  EQ_VERDICT,
]);

export function isOurs(name: string, user: (name: string) => boolean): boolean {
  if (OURS.has(name) || name.startsWith(CHIP_PREFIX) || name.startsWith("pasc_")) return true;
  return name.startsWith("pas") && !user(name);
}

/** The table from a state part: user names with a stored value (an assumed name alone holds itself: left out). Null
 *  when it is not the list statePart builds. */
export function tableOf(n: Node, user: (name: string) => boolean): Map<string, StoredName> | null {
  const list = n.items?.[1]?.items;
  if (!n.items || n.items.length !== 3 || !list) return null;
  const out = new Map<string, StoredName>();
  for (const e of list) {
    const [k, v, ns] = e.items ?? [];
    if (!k || v?.str === undefined || !IDENT.test(k.raw) || isOurs(k.raw, user) || v.str === k.raw) continue;
    const head = HEAD.exec(v.str);
    const params = new Set(head ? head[1]!.split(",").map((p) => p.trim()) : []);
    out.set(k.raw, { text: v.str, names: idents(ns).filter((x) => !params.has(x) && x !== k.raw), fn: head !== null });
  }
  return out;
}

/** The names `after` holds with another text than `before` (or new), and the names it no longer holds. */
export function changesOf(before: ReadonlyMap<string, StoredName>, after: ReadonlyMap<string, StoredName>): { changed: string[]; removed: string[] } {
  const changed = [...after].filter(([k, v]) => before.get(k)?.text !== v.text).map(([k]) => k);
  const removed = [...before.keys()].filter((k) => !after.has(k));
  return { changed, removed };
}
