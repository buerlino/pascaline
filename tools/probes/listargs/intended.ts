// SPDX-License-Identifier: GPL-3.0-or-later
// G124 (backlog F107): the probe's second class. A name the sweep finds reading one list as its argument list (sweep.ts verdict)
// is not refused when that reading is the meaning Giac documents: a matrix from its rows, the dimensions of a zero or random
// matrix, a pair of integers or an expression and its equation where f of one element alone is an error (no per-element
// reading exists). Each entry is checked on the pinned engine and against Giac's help (aide_cas) or source; list-args.ts
// writes the evidence into app/src/engine/listargsEvidence.ts and the forms into listargsTable.ts. Only erasable TypeScript.

/** Which one-list argument is the documented form: "any" list (f of one element alone is an error), a non-empty list of
 *  integers only (dimensions), or a non-empty list of lists only (rows). Outside its form the call stays refused. */
export type ListForm = "any" | "integers" | "rows";

interface Intended {
  form: ListForm;
  /** Text of Giac's help entry for the name (aide_cas, English line), checked to be there. */
  help?: string;
  /** Where Giac's source reads the list form, when its help does not say (not checked here; the value is). */
  source?: string;
  /** The list's elements of the documented call. */
  list: string;
  /** Giac text, for the name `f`, whose value the one-list call must equal (printed alike, or Giac's `==`). */
  same: (f: string) => string;
}

/** Keyed by the first name of Giac's help entry; the entry's other names (randMat, igcdex, substituer …) follow it. */
export const INTENDED: Readonly<Record<string, Intended>> = {
  matrix: { form: "rows", help: "or make a matrix with a table", list: "[1,2],[3,4]", same: () => "[[1,2],[3,4]]" },
  zeros: {
    form: "integers",
    source: "ti89.cc _zeros: a vector of two integers a,b is _matrix(a,b,0.0)",
    list: "2,3",
    same: (f) => `${f}(2,3)`,
  },
  ranm: { form: "integers", help: "an n*m matrix that contains random integers", list: "2,3", same: (f) => `${f}(2,3)` },
  newMat: { form: "integers", help: "Returns the list with n rows and p columns, made with zeros", list: "2,3", same: (f) => `${f}(2,3)` },
  simp2: { form: "any", help: "Returns the list [A/gcd(A,B),B/gcd(A,B)]", list: "12,18", same: (f) => `${f}(12,18)` },
  iegcd: { form: "any", help: "Extended greatest common divisor of 2 integers", list: "45,75", same: (f) => `${f}(45,75)` },
  subst: { form: "any", help: "Substitutes a value for a variable in an expression", list: "x+1,x=2", same: (f) => `${f}(x+1,x=2)` },
};

/** Giac's help entries: each name → the first name of its entry and the entry's text (the lines after "# names"). */
export function helpEntries(aide: string): Map<string, { head: string; text: string }> {
  const out = new Map<string, { head: string; text: string }>();
  let cur: { head: string; text: string } | null = null;
  for (const line of aide.split("\n")) {
    if (line.startsWith("# ")) {
      const names = line.slice(2).trim().split(/\s+/);
      cur = { head: names[0] ?? "", text: "" };
      for (const n of names) if (!out.has(n)) out.set(n, cur);
    } else if (cur) cur.text += `${line}\n`;
  }
  return out;
}

const error = (t: string): boolean => t.startsWith("GIAC_ERROR") || t.includes("Error:");

/** The documented list form of `f` with its evidence, or null when `f` has none (it stays refused). Throws when an entry's
 *  evidence no longer holds (the help text is gone, or the engine answers otherwise): the table must not move silently. */
export function intendedForm(
  ev: (s: string) => string,
  entries: ReadonlyMap<string, { head: string; text: string }>,
  f: string,
): { form: ListForm; why: string } | null {
  const e = entries.get(f);
  const head = Object.hasOwn(INTENDED, f) ? f : e && Object.hasOwn(INTENDED, e.head) ? e.head : null;
  if (!head) return null;
  const it = INTENDED[head]!;
  if (it.help && !(e?.text ?? "").includes(it.help)) throw new Error(`G124: Giac's help for ${f} no longer says "${it.help}"`);
  const run = (s: string): string => {
    ev("srand(7)"); // ranm draws the same numbers for both calls
    return ev(s).trim();
  };
  const call = `${f}(list[${it.list}])`;
  const value = run(call);
  const same = it.same(f);
  // each side on its own draw (srand), then Giac's == (matrix[[1,2],[3,4]] == [[1,2],[3,4]])
  const other = run(same);
  if (error(value) || (value !== other && ev(`(${value})==(${other})`).trim() !== "true")) {
    throw new Error(`G124: ${call} = ${value} is not ${same} = ${other}`);
  }
  let alone = "";
  if (it.form === "any") {
    // a stored list is read alike (zeros, a "integers" name, is not: zeros(L) solves L = 0, so listargs.ts takes typed lists only)
    ev(`G124L:=list[${it.list}]`);
    const stored = run(`${f}(G124L)`);
    ev("purge(G124L)");
    if (stored !== value) throw new Error(`G124: ${f} of a stored list[${it.list}] = ${stored}, not ${value}`);
    const first = it.list.split(",")[0]!;
    const one = run(`${f}(${first})`);
    if (!error(one)) throw new Error(`G124: ${f}(${first}) = ${one}, a per-element reading exists`);
    alone = `; ${f}(${first}) is an error`;
  }
  const cite = it.help ? `help "${it.help}"` : `source ${it.source}`;
  return { form: it.form, why: `${cite}; ${call} = ${same} = ${value}${alone}${it.form === "any" ? ", a stored list alike" : ""}` };
}
