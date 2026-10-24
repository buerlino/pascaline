// SPDX-License-Identifier: GPL-3.0-or-later
// G103: the tree of a quoted input or a stored body for the walks of nonsquare.ts (G97) and novalue.ts (G78), as Giac
// holds it: bridge-3 gives it with the call that stores it (`giac_value(…, "tree")`, api.cc treeOf; a stored body may
// print otherwise, inv(M) as 1/M), with nothing evaluated: each part with the path Giac addresses it by from that slot
// (`[op([op(pasq)][0])][1]`). No program of ours runs in Giac, so no user's name can replace it. The parts below a head
// in UNEVALUATED are not listed, as the walks did not look at them. Runs synchronously next to the engine; only erasable
// TypeScript syntax.
import type { ParseNode } from "./bridge.ts";

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

/** bridge-3's tree `tree` with the paths from `root` (the slot that holds the quoted text or the stored body); null when
 *  it has more than MAX_NODES parts to look at, or there is none (an error, a tree past bridge-3's limit). */
export function treeOf(tree: ParseNode | null | undefined, root: string): TreeNode | null {
  if (!tree) return null;
  let nodes = 0;
  const node = (t: ParseNode, path: string): TreeNode | null => {
    if (++nodes > MAX_NODES) return null;
    if (t[0] === 0) return { kind: 0, head: "", path, source: false, number: t[1] === 1, children: [] };
    const [kind, head, source, below] = t[0] === 1 ? [1 as const, t[1], t[2] === 1, t[3]] : [2 as const, "", false, t[1]];
    const out: TreeNode = { kind, head, path, source, number: false, children: [] };
    if (kind === 1 && UNEVALUATED.has(head)) return out;
    for (let k = 0; k < below.length; k++) {
      const c = node(below[k]!, `[op(${path})][${k}]`);
      if (!c) return null;
      out.children.push(c);
    }
    return out;
  };
  return node(tree, root);
}
