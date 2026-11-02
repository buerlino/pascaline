// SPDX-License-Identifier: GPL-3.0-or-later
// R36 (docs/04 2.4): the one line a picked row gives for its mark. The reasons are the engine's (ValueFacts.why, G22 with
// G38, G39, G50) and the chip table's (a constant's σ); the words are clipboard/strings.ts. It loads with the row
// actions, never in the start chunk.
import { decimalFromString } from "../engine/format.ts";
import type { MarkInfo } from "../engine/format.ts";
import type { HistoryItem } from "../state/session.svelte.ts";
import { copyExact } from "./exact.ts";
import { tc } from "./strings.ts";

const SUP = "⁰¹²³⁴⁵⁶⁷⁸⁹";
const sup = (n: number): string => `${n < 0 ? "⁻" : ""}${[...String(Math.abs(n))].map((d) => SUP[+d]).join("")}`;

/** A standard uncertainty as the line shows it: two significant digits at most, `1.5·10⁻¹⁵`; null if it is not a number. */
export function uncText(unc: string): string | null {
  const v = decimalFromString(unc.toLowerCase());
  if (!v || v.digits === "") return null;
  const d = v.digits.slice(0, 2);
  return `${d.length > 1 ? `${d[0]}.${d[1]}` : d}·10${sup(v.exp)}`;
}

/** The constants a row's chips hold with an uncertainty, as `G (± 1.5·10⁻¹⁵)`, in the order they stand in the entry. */
function constantsUsed(item: HistoryItem): string[] {
  const out: string[] = [];
  for (const m of item.latex.matchAll(/\\const\{([^{}]*)\}\{([^{}]*)\}/g)) {
    const unc = item.chips?.[`const:${m[1]}`]?.unc;
    const u = unc === undefined ? null : uncText(unc);
    const text = `${m[2]}${u ? ` (± ${u})` : ""}`;
    if (unc !== undefined && !out.includes(text)) out.push(text);
  }
  return out;
}

/** The stored names (`names`) that the input of `item` mentions as whole names. */
function namesRead(item: HistoryItem, names: readonly string[]): string[] {
  return names.filter((n) => new RegExp(`(?<![A-Za-z0-9_\\\\])${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![A-Za-z0-9])`).test(item.latex));
}

/** The user's stored names whose value is not exact: the engine's facts of the name, else the mark of the latest row of
 *  this view that stored it (`x\blacktriangleright N` or `N:=…`): a float stored by a row marked ≈ or ⚠ is rounded. */
export function roundedNames(
  stored: readonly { name: string; facts?: unknown }[],
  items: readonly HistoryItem[],
  markOfRow: (i: HistoryItem) => MarkInfo | null,
): string[] {
  return stored
    .filter((u) => {
      const row = [...items].reverse().find((i) => i.status === "done" && (i.latex.endsWith(`\\blacktriangleright ${u.name}`) || i.latex.startsWith(`${u.name}:=`)));
      const m = row ? markOfRow(row) : null;
      return m ? m.mark !== "=" : u.facts !== undefined;
    })
    .map((u) => u.name);
}

const list = (names: readonly string[]): string => names.join(", ");

/**
 * The line for `item` whose mark is `mark` (null: none). `digits` is the digits setting, `names` the user's stored names
 * that carry facts (a float, or a value that is not exact): one of them in the input is why an `≈` result is rounded.
 * Null when the row has no mark, so no line is drawn.
 */
export function whyLine(item: HistoryItem, mark: MarkInfo | null, digits: number, names: readonly string[]): string | null {
  if (!mark) return null;
  if (mark.mark === "=") return `= ${tc("why.exact")}`;
  const why = item.facts?.why;
  if (mark.mark === "≈") {
    const consts = constantsUsed(item);
    if (consts.length) return `≈ ${tc("why.uses")} ${list(consts)}`;
    const read = namesRead(item, names);
    if (read.length) return `≈ ${tc("why.uses")} ${list(read)}, ${tc("why.itselfRounded")}`;
    const exact = copyExact(item);
    return `≈ ${tc("why.rounded")}${exact === undefined ? "" : `: ${tc("why.exactIs")} ${exact}`}`;
  }
  const parts: string[] = [];
  // a ⚠ with a warning shows no count in its mark, but fewer confirmed digits than asked are said here
  const shown = item.facts?.digits ?? digits;
  const rd = item.facts?.reliableDigits ?? null;
  const n = mark.n ?? (rd !== null && rd < shown ? rd : undefined);
  if (n !== undefined) parts.push(n > 0 ? `${n} ${tc("why.of")} ${shown} ${tc("why.confirmed")}` : tc("why.noDigit"));
  if (why?.decided) parts.push(tc("why.decided"));
  if (why?.differ) parts.push(tc("why.differ"));
  if (why?.once) parts.push(tc("why.once"));
  if (why?.unaudited?.length) parts.push(`${list(why.unaudited)} ${tc(why.unaudited.length > 1 ? "why.areNotChecked" : "why.isNotChecked")}`);
  if (why?.inherited?.length) parts.push(`${tc("why.uses")} ${list(why.inherited)}, ${tc("why.itselfUncertain")}`);
  if (!parts.length) parts.push(tc(mark.warn ? "why.notChecked" : "why.notConfirmed"));
  return `⚠ ${parts.join(" · ")}`;
}
