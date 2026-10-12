// SPDX-License-Identifier: GPL-3.0-or-later
// LaTeX -> Giac with our own parser (no Compute Engine). Same output stage as serialize.ts.
import { SerializeError, mathJsonToGiac, type Json, type SerializeOptions } from "./emit.ts";
import type { ChipTable } from "./chips.ts";
import { parseLatexInfo } from "./parse.ts";

export { SerializeError };

export interface LatexToGiacOptions extends SerializeOptions {
  /** L6 setting: decimal comma input ("3,5" = 3.5; ";" separates arguments). */
  decimalComma?: boolean;
  /** The entry's chip table (\res, \ans, \const); without it a chip is an error. */
  chips?: ChipTable;
}

/** f, g and h are always functions; other single letters once the user defines them (L6). */
export const DEFAULT_USER_FUNCTIONS: ReadonlySet<string> = new Set(["f", "g", "h"]);
const defined = new Set<string>();

/** Single letters defined as functions in this session (`p(x):=...`), plus f, g, h. */
export function userFunctions(): ReadonlySet<string> {
  return new Set([...DEFAULT_USER_FUNCTIONS, ...defined]);
}

/** Forget the session's function definitions (tests; a future "clear all"). */
export function resetUserFunctions(): void {
  defined.clear();
}

function noteDefinition(e: Json): void {
  if (!Array.isArray(e) || e[0] !== "Assign") return;
  const lhs = e[1];
  if (Array.isArray(lhs) && lhs[0] === "Call" && typeof lhs[1] === "string" && /^[A-Za-z]$/.test(lhs[1])) defined.add(lhs[1]);
}

export function latexToGiac(latex: string, o: LatexToGiacOptions = {}): string {
  return latexToGiacInfo(latex, o).giac;
}

/** The Giac text, and whether an inexact chip went into it (then the result is never marked "=", docs/04 2.4). */
export function latexToGiacInfo(latex: string, o: LatexToGiacOptions = {}): { giac: string; inexact: boolean } {
  if (latex.trim() === "") throw new SerializeError("empty input");
  const user = o.userFunctions ?? userFunctions();
  const { json, inexact } = parseLatexInfo(latex, {
    userFunctions: user,
    ...(o.decimalComma ? { decimalComma: true } : {}),
    ...(o.chips ? { chips: o.chips } : {}),
  });
  const giac = mathJsonToGiac(json, { ...o, userFunctions: user });
  noteDefinition(json);
  return { giac, inexact };
}
