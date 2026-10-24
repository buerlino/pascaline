// SPDX-License-Identifier: GPL-3.0-or-later
// G109: Giac's list type (`list[1,4]`, subtype 23; a `[ ]` vector is 0) keeps its type through `:=`, `=>` and Ans, and
// its arithmetic is elementwise. Its values are shown and copied with braces, as the G2 shows a list; Giac's own text
// (`list[…]`) stays for what Giac reads back (Ans, chips, stored names). Small and pure: the history (state/results.ts)
// imports it from the start chunk. Only erasable TypeScript syntax.

/** How Giac prints a value of its list type: the print says the subtype, so bridge-3's text and the state read's give it
 *  with no extra call. */
export const LIST_TYPE = "list[";

/** Giac's text with every value of its list type written with braces (`list[[1,2],3]` → `{[1,2],3}`), at any depth;
 *  strings and a name that ends in `list` are left alone. A bracket loop over Giac's print (G88's text baseline +6): the
 *  shown text is Giac's print for display, P20's one kind of text read left (G105 class (a)); bridge-3 gives the kind
 *  and the flat elements but no print in braces, and a list inside a vector (`[list[1,2],3]`) needs the print's nesting.
 *  Moves into G105's `giacPrint.ts` with its bracket matcher and string skip. */
export function bracesOf(text: string): string {
  let out = "";
  const closers: string[] = [];
  for (let k = 0; k < text.length; k++) {
    const ch = text.charAt(k);
    if (ch === '"') {
      const end = text.indexOf('"', k + 1);
      const j = end < 0 ? text.length : end + 1;
      out += text.slice(k, j);
      k = j - 1;
    } else if (text.startsWith(LIST_TYPE, k) && !/[A-Za-z0-9_.]/.test(text.charAt(k - 1))) {
      out += "{";
      closers.push("}");
      k += LIST_TYPE.length - 1;
    } else if (ch === "[" || ch === "(") {
      out += ch;
      closers.push(ch === "[" ? "]" : ")");
    } else if (ch === "]" || ch === ")") {
      out += closers.pop() === "}" && ch === "]" ? "}" : ch;
    } else out += ch;
  }
  return out;
}
