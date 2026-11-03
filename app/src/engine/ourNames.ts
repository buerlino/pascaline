// SPDX-License-Identifier: GPL-3.0-or-later
// G54: our replacements for Giac functions, by the name the user writes. One map for the parser (input/emit.ts) and for
// every path that sends Giac text without the parser (the library import and its `// test:` lines, the export back).
// No UI imports; only erasable TypeScript syntax.
import { mapNames, type Quoting } from "./giacPrint.ts";

/** Giac's own `mod` is the modular-number constructor (an error as a call); Find's `mod` is irem (Euclidean,
 *  never negative: irem(-7,3) = 2), so the written word is renamed to our pasmod (homeEval.ts ENGINE_DEFINITIONS:
 *  irem for integers, and the same remainder for a rational, where irem is an error). G42: median and percentile are ours
 *  too (the median of an even list, percentile unevaluated in Giac; `median` is a reserved word there); G155: so is sem. */
export const CALL_NAME: Readonly<Record<string, string>> = { mod: "pasmod", irem: "pasmod", median: "pasmedian", percentile: "paspercentile", sem: "passem" };

/** The word the export writes back for our name (`irem` and `mod` are the same function; `mod` is the written one). */
const WRITTEN_NAME: Readonly<Record<string, string>> = { pasmod: "mod", pasmedian: "median", paspercentile: "percentile", passem: "sem" };

/** Renames the calls `name(` in Giac text by `map`: whole names, calls only (a name not followed by an opening bracket,
 *  or part of a longer name or a `.name`, stays), outside strings. */
function renameCalls(text: string, map: Readonly<Record<string, string>>, q: Quoting): string {
  const digit = (c: string): boolean => c >= "0" && c <= "9";
  return mapNames(text, ({ name, at, call }) => {
    if (!call || !Object.hasOwn(map, name)) return null;
    const before = text.charAt(at - 1);
    // After a number the product sign goes in (2median(L) → 2*pasmedian(L)): the verifier's smoke runs read `2pasatan(1)` as
    // 2*pi/4 either way, so this is for clarity, not a Giac need (G145)
    const afterNumber = digit(before) || (before === "." && digit(text.charAt(at - 2)));
    if (before === "." && !afterNumber) return null;
    return (afterNumber ? "*" : "") + map[name]!;
  }, q);
}

/** Giac text with the user's `mod`, `irem`, `median`, `percentile` and `sem` calls read as our definitions, as the parser does. */
export function renameOurCalls(text: string): string {
  return renameCalls(text, CALL_NAME, "typed");
}

/** The inverse, for the export: `pasmedian(` is written `median(`, so a file reads the same on the way back in. It reads
 *  the log's commands, typed (G105f2: a variable's value too, giacPrint.ts typedFromPrinted). */
export function writeUserNames(text: string): string {
  return renameCalls(text, WRITTEN_NAME, "typed");
}

/** Set to 1 by an == or ≠ test that met a float (input/emit.ts equalityTest). Purged, not set to 0, before an input
 *  runs: `sto` inside the test's function would read a value as the place to store to. EQ_DIFF is purged with it for
 *  the same reason. G145: the one home of these names and CHIP_PREFIX (the parser, the engine host and the state read import them). */
export const EQ_INEXACT_FLAG = "pasinexact";
/** R18f2: where a float-side test leaves its difference (0 equal, 1 not, 2 open is the verdict it reads). */
export const EQ_DIFF = "pasdiff";
export const EQ_VERDICT = "pasverdict";
/** The prefix of a result chip sent by name (G49's `pasr_<k>`, input/chip-giac.ts; engine/chipFacts.ts). */
export const CHIP_PREFIX = "pasr_";
/** The part after CHIP_PREFIX that names Ans's chip (`pasr_ans`); a result chip's is its row number k. */
export const CHIP_ANS = "ans";

/** R115: whether `name` is a chip name the parser writes (input/chip-giac.ts chipName): CHIP_PREFIX then digits, or
 *  CHIP_ANS. The unit view's `pasupm(value,sigma,key)` takes no other key. */
export function isChipName(name: string): boolean {
  if (!name.startsWith(CHIP_PREFIX)) return false;
  const k = name.slice(CHIP_PREFIX.length);
  return k === CHIP_ANS || /^\d+$/.test(k);
}

/** G100: the names our own test helper stores into (input/emit.ts equalityTest: the float flag, the difference and
 *  the verdict): a store into one is not the user's. */
export const OUR_STORES: readonly string[] = [EQ_INEXACT_FLAG, EQ_DIFF, EQ_VERDICT];

/** A store target that is one of our helpers' names, not the user's state. */
export function isOurStore(name: string): boolean {
  return OUR_STORES.includes(name);
}
