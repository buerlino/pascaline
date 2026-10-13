// SPDX-License-Identifier: GPL-3.0-or-later
// The Find index schema (docs/04 section 3.3). The index itself is generated at build time by
// tools/find-index/generate.mjs into app/src/find/_gen/find-index.json (gitignored).

export type FindKind = "fn" | "const" | "unit" | "pfx" | "tmpl" | "var" | "userfn";

export interface FindItem {
  /** "fn:stddev", "const:c", "unit:km/h", "pfx:k", "tmpl:cbrt"; stable, the token ids. */
  id: string;
  kind: FindKind;
  /** What a user may type: name, symbol, aliases (searched in lower case). */
  names: string[];
  /** English; other languages come from overlay files keyed by id. */
  title: string;
  /** One line: our own for tier 0, Giac's English help line or qalc's title otherwise. */
  desc?: string;
  /** fn: "stddev(list)". */
  syntax?: string;
  /** fn: from Giac's aide_cas. */
  example?: string;
  /** const: exact decimal text with every digit (or an exact Giac expression with pi). */
  value?: string;
  /** const: standard uncertainty (CODATA); absent when the value is exact. */
  unc?: string;
  /** const: canonical unit expression ("m*s^-1"). */
  unit?: string;
  /** const, unit: dimension key ("kg1m1s-2"); absent when qalc gives no conversion to SI base units. */
  dim?: string;
  /** unit, pfx: exact factor to SI base units as p/q (with pi where needed); "k+offset" for °C and °F. */
  si?: string;
  /** 0: curated, audited, ranked first; 1: documented only ("not checked" in the preview). */
  tier: 0 | 1;
  /** The LaTeX the entry line receives: a chip macro or an \operatorname template with #0 (the selection or a box). */
  insert: string;
}

/** An item as the generated index holds it: a tier-1 function has no `insert` (always the \operatorname template of
 *  its name, filled in by prepare() in rank.ts; decisions.md G4 item 1). */
export type IndexItem = Omit<FindItem, "insert"> & { insert?: string };

export interface FindHit {
  item: FindItem;
  /** Higher is better; only the order matters. */
  score: number;
  /** The name (or "title") that matched, for the list's highlight. */
  matched: string;
}

export interface FindContext {
  /** Only these kinds (Vars: ["var", "userfn"]). */
  filter?: FindKind[];
  /** Kinds this context prefers on a tie (units in the Units app). */
  prefer?: FindKind[];
  /** Live items (variables, user functions), merged at query time. */
  live?: FindItem[];
  /** At most this many hits (default 50). */
  limit?: number;
}
