// SPDX-License-Identifier: GPL-3.0-or-later
// G103: the tree of a quoted text in one Giac call. The walks of nonsquare.ts (G97) and novalue.ts (G78) asked Giac
// for one part at a time (`when(type(p)==DOM_SYMBOLIC,[1,string(sommet(p)),size([op(p)])],…)`, one call per part);
// `pastree` returns every part in preorder, as a flat list, with nothing evaluated: [1, head, n, source] for a call
// or operator (source: 0 for a power whose exponent is a positive integer literal, else 1), [2, "", n] for a list,
// [0, number] for anything else (number: 1 for an integer or float literal, 0 for a name). The parts below a head in UNEVALUATED are not listed, as the walks did
// not look at them. Runs synchronously next to the engine; only erasable TypeScript syntax.
import { splitList, type Giac } from "./numeric.ts";

/** Calls whose arguments are not all evaluated as written: a branch not taken (`piecewise(0>0,1/0,5)`), a body in a
 *  bound variable, a quoted text. Their parts are not looked at (novalue.ts, nonsquare.ts). */
export const UNEVALUATED: ReadonlySet<string> = new Set(["when", "piecewise", "ifte", "quote", "hold", "seq", "$", "makelist", "product", "diff", "solve", "fsolve", "romberg", "gaussquad"]);

/** Most parts a walk looks at (both walks' limit); a larger tree is not walked. */
export const MAX_NODES = 200;

export interface TreeNode {
  kind: 0 | 1 | 2;
  /** The operator or function (`/`, `sin`, `of`), "" for a list or a leaf. */
  head: string;
  /** The part as Giac addresses it from the root (`[op([op(pasq)][0])][1]`). */
  path: string;
  /** A power whose exponent is not a positive integer literal, or any other call (throughInfinity's sources). */
  source: boolean;
  /** A leaf that is an integer or float literal (never a matrix). */
  number: boolean;
  children: TreeNode[];
}

/** Entries past which the program stops (a part takes at most 4, so MAX_NODES parts fit): [-1] marks the cut. */
const MAX_ENTRIES = 4 * MAX_NODES;

const SKIP = `[${[...UNEVALUATED].map((h) => `"'${h}'"`).join(",")}]`;

/** Our walker's name in Giac (a library may not define it, library.ts). */
export const TREE_NAME = "pastree";

export const TREE_DEFINITION =
  "pastree(p):={ local k,n,r; " +
  "if (type(p)==DOM_SYMBOLIC) { n:=size([op(p)]); " +
  "r:=[1,string(sommet(p)),n,when(sommet(p)=='^',when(type([op(p)][1])==DOM_INT and [op(p)][1]>0,0,1),1)]; " +
  `if (member(string(sommet(p)),${SKIP})) return r; ` +
  `for (k:=0;k<n;k++) { r:=concat(r,pastree([op(p)][k])); if (size(r)>${MAX_ENTRIES}) return [-1]; } return r; } ` +
  "if (type(p)==DOM_LIST) { n:=size(p); r:=[2,\"\",n]; " +
  `for (k:=0;k<n;k++) { r:=concat(r,pastree(p[k])); if (size(r)>${MAX_ENTRIES}) return [-1]; } return r; } ` +
  "return [0,when(type(p)==DOM_INT or type(p)==DOM_FLOAT,1,0)]; }";

/** The tree below the stored or quoted part `root` (a slot holding `quote(…)`); null when it has more than MAX_NODES
 *  parts, or Giac could not list it (an error). `arg`: what pastree is called on, when not `root` itself
 *  (`pasq:=quote(…)` stores the slot in the same call). One call (two the first time on an engine, which defines
 *  pastree: Giac prints the call of an undefined name as typed). The entries are the list's elements as bridge-3
 *  gives them (Giac's own split), else splitList's (no bridge, or a print bridge-3 cut). */
export function treeOf(giac: Giac, root: string, arg: string = root): TreeNode | null {
  const list = (): { text: string; elements: string[] | null } => {
    const v = giac.value?.(`pastree(${arg})`, []);
    // a print over 2 kB is cut, with no elements: read again whole (the walk's limit is the same)
    if (v && !v.cut) return { text: v.text, elements: v.kind === "list" ? (v.elements ?? null) : null };
    const text = giac.eval(`pastree(${arg})`);
    return { text, elements: splitList(text) };
  };
  let out = list();
  if (out.text.trim().startsWith("pastree(")) {
    giac.eval(TREE_DEFINITION);
    out = list();
  }
  const e = out.elements;
  if (!e) return null;
  let i = 0;
  let nodes = 0;
  const node = (path: string): TreeNode | null => {
    if (++nodes > MAX_NODES || i >= e.length) return null;
    const kind = e[i++]!;
    if (kind === "0") return { kind: 0, head: "", path, source: false, number: e[i++] === "1", children: [] };
    if (kind !== "1" && kind !== "2") return null;
    const head = e[i++] ?? "";
    if (!head.startsWith('"')) return null;
    const n = Number(e[i++]);
    if (!Number.isInteger(n) || n < 0) return null;
    const source = kind === "1" ? e[i++] === "1" : false;
    // a head prints as a string of the quoted name: "'+'"
    const name = head.length >= 4 && head.endsWith(`'"`) && head.charAt(1) === "'" ? head.slice(2, -2) : head.slice(1, -1);
    const out: TreeNode = { kind: kind === "1" ? 1 : 2, head: name, path, source, number: false, children: [] };
    if (kind === "1" && UNEVALUATED.has(name)) return out;
    for (let k = 0; k < n; k++) {
      const c = node(`[op(${path})][${k}]`);
      if (!c) return null;
      out.children.push(c);
    }
    return out;
  };
  const t = node(root);
  return t && i === e.length ? t : null;
}
