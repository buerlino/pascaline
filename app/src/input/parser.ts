// SPDX-License-Identifier: GPL-3.0-or-later
// The parser (parse.ts, emit.ts, chip-giac.ts, latex-to-giac.ts) is its own chunk, loaded together with MathLive
// (decisions M4-3): it is needed only at Enter, and nothing typed reaches Enter before MathLive is there. This is the
// only door into it from the start chunk. The Function and Solve apps, which are lazy chunks themselves, import the
// parser files directly.
type ParserModule = typeof import("./latex-to-giac.ts");

let loading: Promise<ParserModule> | undefined;

/** The LaTeX → Giac converter, loaded on the first call; the same promise afterwards. */
export function loadParser(): Promise<ParserModule> {
  loading ??= import("./latex-to-giac.ts");
  return loading;
}
