// SPDX-License-Identifier: GPL-3.0-or-later
// LaTeX -> Giac with our own parser (no Compute Engine). Same output stage as serialize.ts.
import { parseError } from "../i18n/enParser.ts";
import { mathJsonToGiac, type Json, type SerializeOptions } from "./emit.ts";
import type { ChipTable } from "./chips.ts";
import { parseLatexInfo, type UnitsInfo } from "./parse.ts";
import type { UserName } from "../engine/defs.ts";

export interface LatexToGiacOptions extends SerializeOptions {
  /** L6 setting: decimal comma input ("3,5" = 3.5; ";" separates arguments). */
  decimalComma?: boolean;
  /** The entry's chip table (\res, \ans, \const); without it a chip is an error. */
  chips?: ChipTable;
  /** R28: units mode (docs/04 4.3). The Giac text is then G16's `UnitRequest.formula`: `72*pasu1` per unit slot,
   *  `pask1` per constant, `pasupm(value,sigma)` per ± (G18); `units` names the slots, the constants and the end slot. */
  units?: boolean;
}

export type { UnitsInfo };

/** f, g and h are always functions; other single letters once the user defines them (L6). */
export const DEFAULT_USER_FUNCTIONS: ReadonlySet<string> = new Set(["f", "g", "h"]);

/** The single letters that are calls before "(" (R56): f, g, h and the user's functions, as the definitions log has
 *  them. The parser keeps no state of its own, so a relaunch, a redefinition as a value or a delete in Memory counts
 *  at once. Longer names are always calls and need no listing (parse.ts). */
export function userFunctionsOf(names: readonly Pick<UserName, "name" | "kind">[]): ReadonlySet<string> {
  const out = new Set(DEFAULT_USER_FUNCTIONS);
  for (const u of names) if (u.kind === "fn" && /^[A-Za-z]$/.test(u.name)) out.add(u.name);
  return out;
}

/** The single letter an input defines as a function (`p(x):=...`), if any. */
function definedFunction(e: Json): string | undefined {
  if (!Array.isArray(e) || e[0] !== "Assign") return undefined;
  const lhs = e[1];
  return Array.isArray(lhs) && lhs[0] === "Call" && typeof lhs[1] === "string" && /^[A-Za-z]$/.test(lhs[1]) ? lhs[1] : undefined;
}

export function latexToGiac(latex: string, o: LatexToGiacOptions = {}): string {
  return latexToGiacInfo(latex, o).giac;
}

/** The Giac text; whether an inexact chip went into it (then the result is never marked "=", docs/04 2.4); and the
 *  single letter it defines as a function, so the caller can count it before its names are read again. */
export function latexToGiacInfo(
  latex: string,
  o: LatexToGiacOptions = {},
): { giac: string; inexact: boolean; defines?: string; units?: UnitsInfo } {
  if (latex.trim() === "") throw parseError("parse.emptyInput");
  const user = o.userFunctions ?? DEFAULT_USER_FUNCTIONS;
  const { json, inexact, units } = parseLatexInfo(latex, {
    userFunctions: user,
    ...(o.decimalComma ? { decimalComma: true } : {}),
    ...(o.chips ? { chips: o.chips } : {}),
    ...(o.units ? { units: true } : {}),
  });
  const giac = mathJsonToGiac(json, { ...o, userFunctions: user });
  const defines = definedFunction(json);
  return { giac, inexact, ...(defines ? { defines } : {}), ...(units ? { units } : {}) };
}
