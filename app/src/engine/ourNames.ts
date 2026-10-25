// SPDX-License-Identifier: GPL-3.0-or-later
// G54: our replacements for Giac functions, by the name the user writes. One map for the parser (input/emit.ts) and for
// every path that sends Giac text without the parser (the library import and its `// test:` lines, the export back).
// No UI imports; only erasable TypeScript syntax.
import { mapNames, type Quoting } from "./giacPrint.ts";

/** Giac's own `mod` is the modular-number constructor (an error as a call); Find's `mod` is irem (Euclidean,
 *  never negative: irem(-7,3) = 2), so the written word is renamed to our pasmod (homeEval.ts ENGINE_DEFINITIONS:
 *  irem for integers, and the same remainder for a rational, where irem is an error). G42: median and percentile are ours
 *  too (the median of an even list, percentile unevaluated in Giac; `median` is a reserved word there). */
export const CALL_NAME: Readonly<Record<string, string>> = { mod: "pasmod", irem: "pasmod", median: "pasmedian", percentile: "paspercentile" };

/** The word the export writes back for our name (`irem` and `mod` are the same function; `mod` is the written one). */
const WRITTEN_NAME: Readonly<Record<string, string>> = { pasmod: "mod", pasmedian: "median", paspercentile: "percentile" };

/** Renames the calls `name(` in Giac text by `map`: whole names, calls only (a name not followed by an opening bracket,
 *  or part of a longer name or a `.name`, stays), outside strings. */
function renameCalls(text: string, map: Readonly<Record<string, string>>, q: Quoting): string {
  const digit = (c: string): boolean => c >= "0" && c <= "9";
  return mapNames(text, ({ name, at, call }) => {
    if (!call || !Object.hasOwn(map, name)) return null;
    const before = text.charAt(at - 1);
    // Giac reads `2pasmedian(L)` as the call (2*pasmedian)(L), so the product sign goes in after a number (2median(L))
    const afterNumber = digit(before) || (before === "." && digit(text.charAt(at - 2)));
    if (before === "." && !afterNumber) return null;
    return (afterNumber ? "*" : "") + map[name]!;
  }, q);
}

/** Giac text with the user's `mod`, `irem`, `median` and `percentile` calls read as our definitions, as the parser does. */
export function renameOurCalls(text: string): string {
  return renameCalls(text, CALL_NAME, "typed");
}

/** The inverse, for the export: `pasmedian(` is written `median(`, so a file reads the same on the way back in. It reads
 *  the log's commands, typed (G105f2: a variable's value too, giacPrint.ts typedFromPrinted). */
export function writeUserNames(text: string): string {
  return renameCalls(text, WRITTEN_NAME, "typed");
}

/** G100: the names our own test helper stores into (input/emit.ts equalityTest: the float flag and the difference,
 *  homeEval.ts EQ_INEXACT_FLAG and EQ_DIFF spell the same): a store into one is not the user's. */
export const OUR_STORES: readonly string[] = ["pasinexact", "pasdiff"];

/** A store target that is one of our helpers' names, not the user's state. */
export function isOurStore(name: string): boolean {
  return OUR_STORES.includes(name);
}
