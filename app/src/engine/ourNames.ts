// SPDX-License-Identifier: GPL-3.0-or-later
// G54: our replacements for Giac functions, by the name the user writes. One map for the parser (input/emit.ts) and for
// every path that sends Giac text without the parser (the library import and its `// test:` lines, the export back).
// No UI imports; only erasable TypeScript syntax.

/** Giac's own `mod` is the modular-number constructor (an error as a call); Find's `mod` is irem (Euclidean,
 *  never negative: irem(-7,3) = 2), so the written word is renamed to our pasmod (homeEval.ts ENGINE_DEFINITIONS:
 *  irem for integers, and the same remainder for a rational, where irem is an error). G42: median and percentile are ours
 *  too (the median of an even list, percentile unevaluated in Giac; `median` is a reserved word there). */
export const CALL_NAME: Readonly<Record<string, string>> = { mod: "pasmod", irem: "pasmod", median: "pasmedian", percentile: "paspercentile" };

/** The word the export writes back for our name (`irem` and `mod` are the same function; `mod` is the written one). */
const WRITTEN_NAME: Readonly<Record<string, string>> = { pasmod: "mod", pasmedian: "median", paspercentile: "percentile" };

/** Renames the calls `name(` in Giac text by `map`: whole names, calls only (a name not followed by an opening bracket,
 *  or part of a longer name or a `.name`, stays), outside strings. */
function renameCalls(text: string, map: Readonly<Record<string, string>>): string {
  let out = "";
  let i = 0;
  while (i < text.length) {
    const c = text[i]!;
    if (c === '"') {
      const q = text.indexOf('"', i + 1);
      const j = q < 0 ? text.length : q + 1;
      out += text.slice(i, j);
      i = j;
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      const w = /[A-Za-z_0-9]+/y;
      w.lastIndex = i;
      const word = w.exec(text)![0];
      const to = Object.hasOwn(map, word) && !out.endsWith(".") ? map[word] : undefined;
      out += to !== undefined && /^\s*\(/.test(text.slice(i + word.length)) ? to : word;
      i += word.length;
      continue;
    }
    if (/[0-9]/.test(c)) {
      // a number such as 1e3 or 2x: keep its letters out of the name scan
      const n = /[0-9][A-Za-z_0-9]*/y;
      n.lastIndex = i;
      const lit = n.exec(text)![0];
      out += lit;
      i += lit.length;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

/** Giac text with the user's `mod`, `irem`, `median` and `percentile` calls read as our definitions, as the parser does. */
export function renameOurCalls(text: string): string {
  return renameCalls(text, CALL_NAME);
}

/** The inverse, for the export: `pasmedian(` is written `median(`, so a file reads the same on the way back in. */
export function writeUserNames(text: string): string {
  return renameCalls(text, WRITTEN_NAME);
}
