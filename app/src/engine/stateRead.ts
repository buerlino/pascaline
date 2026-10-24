// SPDX-License-Identifier: GPL-3.0-or-later
// G65 (S13, docs/archive/r15-state-facts.md): which names an input stored and which stored names it read, from Giac's
// own state instead of our reading of the input's text.
// - the names it reads (G99): Giac's tree of the input (bridge-2, `giac_parse`, never evaluated; `readsFrom`). A store
//   reads its stored side only, a defined program's parameters and every quoting command's variable left out (api.cc's
//   QUOTING); `L[k]:=` also reads L and k (L's other elements stay);
// - the state part, only after an input that may store: every user name, its stored text and the names in it (`lname`),
//   in one call after the input's settings check (host.ts after, G67, G102). The host keeps it as a table and walks
//   the closure over it (facts.ts); the next state part is compared with it.
// Plain text and pure functions; only erasable TypeScript syntax, so Node runs this file directly.
import type { GiacParse } from "./bridge.ts";
import { ENGINE_DEFINITIONS, EQ_DIFF, EQ_INEXACT_FLAG, EQ_VERDICT, WORKER_DEFINITION_NAMES } from "./homeEval.ts";
import { DOUBLE_DIGITS } from "./numeric.ts";
import { COMPLEX_DEFINITIONS } from "./complex.ts";
import { CHIP_PREFIX } from "./chipFacts.ts";
import { UNIT_DEFINITIONS } from "../units/evaluate.ts";

/** A stored user name as Giac holds it. `names`: the names in its value (`lname`), a program's parameters left out
 *  (its locals stay: an over-read gives a weaker mark, never a stronger one). `fn`: the value is a program. */
export interface StoredName {
  text: string;
  names: string[];
  fn: boolean;
}

/** What Giac's tree of an input says (G99). `names`: the names it reads (for a store, of its stored side). `targets`:
 *  the names a top-level store sets. `fn`: a top-level store of a program (`f(x):=…`, `f:=x->…`). */
export interface InputReads {
  names: string[];
  targets: string[];
  fn: boolean;
}

/** The reads of an input from bridge-2's answer. A text Giac's parser refused (`ok` false) keeps what it built: the host
 *  never reads names after a syntax error (Home stops before, CAS passes read=false). */
export function readsFrom(p: GiacParse): InputReads {
  return { names: p.reads, targets: p.top, fn: p.program };
}

/** The state part: Digits pinned (a double prints with Digits, so an unchanged value must print alike in every mode),
 *  then put back to `digits` (the mode's, which the settings check expects). Giac's printed list: parsePrinted. */
export function statePart(digits: number): string {
  return pinned(entries("VARS()"), digits);
}

/** The entry of each name in `names` (quoted, so the list holds the names), as in statePart: Digits pinned, then put
 *  back. Its print reads as statePart's for tableOf. */
const entries = (list: string): string => `map(${list},k->[k,string(eval(k)),lname(eval(k))])`;
const quoted = (names: readonly string[]): string => `[${names.map((n) => `'${n}'`).join(",")}]`;
const pinned = (part: string, digits: number): string => `[(Digits:=${DOUBLE_DIGITS}),${part},(Digits:=${Math.trunc(digits)})]`;

/** G104: the entries of `names` only (loadPending's loaded names). */
export function namesPart(digits: number, names: readonly string[]): string {
  return pinned(entries(quoted(names)), digits);
}

/** G104: the state part after an input whose candidates are known: every name of `VARS()`, a name of `known` bare (its
 *  entry did not change), any other with its entry (a candidate, or a name new since the last read). One call. */
export function changedPart(digits: number, known: readonly string[]): string {
  return pinned(`map(VARS(),k->when(member(k,${quoted(known)}),k,[k,string(eval(k)),lname(eval(k))]))`, digits);
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
        // G104: a slice up to the next quote (a 600 kB print char by char took longer than Giac printing it)
        const q = text.indexOf('"', i);
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

/** A name in the state part's print (a user name, an element of `lname`): read by tableOf until G104/G105. */
const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;
const idents = (n: Node | undefined): string[] => (n?.items ?? []).map((x) => x.raw).filter((x) => IDENT.test(x));

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
export function tableOf(n: Node, user: (name: string) => boolean, kept?: ReadonlyMap<string, StoredName>): Map<string, StoredName> | null {
  const list = n.items?.[1]?.items;
  if (!n.items || n.items.length !== 3 || !list) return null;
  const out = new Map<string, StoredName>();
  for (const e of list) {
    // G104 (changedPart): a bare name keeps its entry from `kept`, in VARS()'s order
    if (!e.items) {
      const k = kept?.get(e.raw);
      if (k) out.set(e.raw, k);
      continue;
    }
    const [k, v, ns] = e.items;
    if (!k || v?.str === undefined || !IDENT.test(k.raw) || isOurs(k.raw, user) || v.str === k.raw) continue;
    const head = HEAD.exec(v.str);
    const params = new Set(head ? head[1]!.split(",").map((p) => p.trim()) : []);
    out.set(k.raw, { text: v.str, names: idents(ns).filter((x) => !params.has(x) && x !== k.raw), fn: head !== null });
  }
  return out;
}

/** G104: every name a state part's print lists (bare or with its entry). */
export function namesOf(n: Node): string[] {
  return (n.items?.[1]?.items ?? []).flatMap((e) => {
    const k = e.items ? e.items[0]?.raw : e.raw;
    return k !== undefined && IDENT.test(k) ? [k] : [];
  });
}

/** The names `after` holds with another text than `before` (or new), and the names it no longer holds. */
export function changesOf(before: ReadonlyMap<string, StoredName>, after: ReadonlyMap<string, StoredName>): { changed: string[]; removed: string[] } {
  const changed = [...after].filter(([k, v]) => before.get(k)?.text !== v.text).map(([k]) => k);
  const removed = [...before.keys()].filter((k) => !after.has(k));
  return { changed, removed };
}
