// SPDX-License-Identifier: GPL-3.0-or-later
// G112 (backlog F103): the test that finds a Giac function reading one list argument as its argument list, f(list[a,b]) =
// f(a,b), on plain giac.eval (no host, no parser). tools/probes/list-args.ts runs it over Find's names and writes the table
// app/src/engine/listargsTable.ts; app/src/engine/listargsTable.test.ts runs it again on the pinned engine.
// Runs synchronously next to the engine; only erasable TypeScript syntax.

/** The lists a function gets as its one argument: two and three elements, integers and decimals (an order of tries, the first
 *  that shows the defect decides). Psi, Zeta, Beta and igamma need [2,3]-like values, comb and irem [5,2], a distribution
 *  [0.3,0.6] or [2,0.3,0.6]. */
export const SAMPLES: readonly (readonly string[])[] = [
  ["1", "2"], ["2", "3"], ["5", "2"], ["0.3", "0.6"], ["2", "0.3", "0.6"], ["1", "2", "3"], ["5", "2", "1"],
];
/** A function that reads a list as its data (sum, gcd, mean, size) answers this list and its reverse alike. */
const REDUCE = ["3", "1", "4", "2", "5"];

export type Verdict =
  | { hit: true; why: string }
  | { hit: false; why: "maps" | "data" | "reduces" | "varies" | "elements" | "none" };

const error = (t: string): boolean => t.startsWith("GIAC_ERROR") || t.includes("Error:");
const NUMBER_TYPES = new Set(["integer", "rational", "real", "complex"]);

/** What f does with one list argument. `ev` is Giac's eval; `takesList` says Giac's help gives f a list (or vector, matrix) as
 *  its first argument (signatureTakesList), so a list is its data and f is never a hit. */
export function verdict(ev: (s: string) => string, f: string, takesList: boolean): Verdict {
  if (takesList) return { hit: false, why: "data" };
  const run = (s: string): string => {
    ev("srand(7)"); // random functions draw the same numbers for both calls
    return ev(s).trim();
  };
  const r1 = run(`${f}(list[${REDUCE.join(",")}])`);
  const r2 = run(`${f}(list[${[...REDUCE].reverse().join(",")}])`);
  if (!error(r1) && r1 === r2 && !r1.includes("[")) return { hit: false, why: "reduces" };
  let maps = false;
  for (const s of SAMPLES) {
    const args = s.join(",");
    const asList = run(`${f}(list[${args}])`);
    if (error(asList)) continue;
    // a clock (monotonic, time) answers each call anew, with srand or not: nothing to compare
    if (run(`${f}(list[${args}])`) !== asList) return { hit: false, why: "varies" };
    // per element: the answer is the elements' values, as Giac's list type or as a plain vector (arg(list[1,2]) = [0,0])
    const elems = s.map((x) => `${f}(${x})`).join(",");
    if (asList === run(`list[${elems}]`) || asList === run(`[${elems}]`)) {
      maps = true;
      continue;
    }
    // the list's elements themselves (op, feuille): what the list holds, whichever way f reads it
    if (asList === run(args)) return { hit: false, why: "elements" };
    const asArgs = run(`${f}(${args})`);
    if (!error(asArgs) && asArgs === asList) return { hit: true, why: `${f}(list[${args}]) = ${f}(${args}) = ${asList}` };
    // an exact call Giac leaves unevaluated prints its argument as typed (LambertW(list[1,2]), LambertW(1,2)): its value decides
    const numList = run(`evalf(${f}(list[${args}]))`);
    const numArgs = run(`evalf(${f}(${args}))`);
    if (!error(numArgs) && numArgs === numList && numList !== asList) {
      return { hit: true, why: `evalf(${f}(list[${args}])) = evalf(${f}(${args})) = ${numList}` };
    }
    // one number, not a sequence: evalf(1,2) would be evalf of 1 to 2 digits (op(list[1,2]) = 1,2 is the list's elements)
    if (!asList.includes("[") && ev(`size([${asList}])`).trim() === "1" && NUMBER_TYPES.has(ev(`type(evalf(${asList}))`).trim())) {
      return { hit: true, why: `${f}(list[${args}]) = ${asList}, one number` };
    }
  }
  return { hit: false, why: maps ? "maps" : "none" };
}

/** Giac's help signature line (aide_cas "0 …") gives a list, vector, matrix, cycle or permutation as the first argument. */
export function signatureTakesList(signature: string): boolean {
  let depth = 0;
  let end = signature.length;
  for (let i = 0; i < signature.length; i++) {
    const c = signature[i];
    if (c === "(" || c === "[") depth++;
    else if (c === ")" || c === "]") depth--;
    else if (c === "," && depth === 0) {
      end = i;
      break;
    }
  }
  return /Lst|Vect|Mtrx|List|list|Seq|Matrix|Cycle|Permut/.test(signature.slice(0, end));
}

/** Giac's help signatures by name (every name of an entry; the "0 " lines). */
export function helpSignatures(aide: string): Map<string, string> {
  const out = new Map<string, string>();
  let names: string[] = [];
  for (const line of aide.split("\n")) {
    if (line.startsWith("# ")) names = line.slice(2).trim().split(/\s+/);
    else if (line.startsWith("0 ")) for (const n of names) if (!out.has(n)) out.set(n, line.slice(2).trim());
  }
  return out;
}
