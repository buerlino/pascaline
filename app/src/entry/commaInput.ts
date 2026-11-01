// SPDX-License-Identifier: GPL-3.0-or-later
// R100 (owner, 2026-10-31): in comma mode a stored input is drawn with `;` for its bare argument commas, in its history
// row and on the line it is recalled to, as commaResult (state/displayMode.ts) draws a result. Display only: the parser
// reads `,` and `;` alike (decisions L6), so the recalled line gives the same value.

/** The input LaTeX as comma mode draws it: every bare `,` becomes `;`; MathLive's decimal comma `{,}` and the thin space
 *  `\,` stay. An input that holds a string (`"a,b"`) is drawn as it is. */
export function commaInput(latex: string): string {
  if (latex.includes('"')) return latex;
  return latex.replace(/\{,\}|\\,|,/g, (m) => (m === "," ? ";" : m));
}

/** The input LaTeX of a history row as it is drawn and recalled: commaInput in comma mode, else as stored. */
export const shownInput = (latex: string, decimalComma: boolean): string => (decimalComma ? commaInput(latex) : latex);
