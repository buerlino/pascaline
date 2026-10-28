// SPDX-License-Identifier: GPL-3.0-or-later
// Find's empty query (R4a, docs/04 3.5): a Math menu of fixed categories in a fixed order, numbered 1…9, 0 like any
// list (decisions.md S2 rule M1). Our own grouping of the audited (tier-0) items; constants and units by kind. A
// tier-1 function is in no category: it is found by typing. Plain data.
import type { FindMessageKey } from "../i18n/enFind.ts";
import type { FindItem, FindKind } from "./types.ts";

export interface Category {
  readonly id: string;
  readonly title: FindMessageKey;
  /** The items by id, in this order. */
  readonly ids?: readonly string[];
  /** Every item of these kinds, in the index's order. */
  readonly kinds?: readonly FindKind[];
}

const fn = (...names: string[]): string[] => names.map((n) => `fn:${n}`);

export const CATEGORIES: readonly Category[] = [
  { id: "arith", title: "cat.arith", ids: fn("abs", "floor", "ceil", "frac", "irem", "gcd", "lcm", "factorial", "comb") },
  { id: "powers", title: "cat.powers", ids: [...fn("sqrt", "surd"), "tmpl:cbrt", ...fn("exp", "ln", "log10")] },
  { id: "trig", title: "cat.trig", ids: fn("sin", "cos", "tan", "asin", "acos", "atan", "sinh", "cosh", "tanh") },
  { id: "calculus", title: "cat.calculus", ids: fn("int", "diff", "limit") },
  { id: "algebra", title: "cat.algebra", ids: fn("solve") },
  { id: "matrix", title: "cat.matrix", ids: fn("det", "inv", "tran", "cross") },
  { id: "stats", title: "cat.stats", ids: fn("mean", "median", "percentile", "variance", "stddev", "stddevp", "normald_cdf", "erf", "Gamma") },
  { id: "eng", title: "cat.eng", ids: fn("par", "eseries") },
  { id: "const", title: "cat.const", kinds: ["const"] },
  { id: "units", title: "cat.units", kinds: ["unit", "pfx"] },
];

/** The items of a category, in its order; an id the index lacks is left out. */
export function categoryItems(cat: Category, items: readonly FindItem[], byId: ReadonlyMap<string, FindItem>): FindItem[] {
  if (cat.kinds) return items.filter((it) => cat.kinds?.includes(it.kind));
  return (cat.ids ?? []).flatMap((id) => {
    const it = byId.get(id);
    return it ? [it] : [];
  });
}
