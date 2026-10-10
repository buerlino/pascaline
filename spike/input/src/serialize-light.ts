// SPDX-License-Identifier: GPL-3.0-or-later
// LaTeX -> Giac with our own parser (no Compute Engine). Same output stage as serialize.ts.
import { SerializeError, mathJsonToGiac, type SerializeOptions } from "./emit.ts";
import { parseLatex } from "./parse.ts";

export { SerializeError };

export function latexToGiac(latex: string, o: SerializeOptions = {}): string {
  if (latex.trim() === "") throw new SerializeError("empty input");
  return mathJsonToGiac(parseLatex(latex, o.userFunctions ? { userFunctions: o.userFunctions } : {}), o);
}
