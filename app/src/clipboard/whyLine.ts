// SPDX-License-Identifier: GPL-3.0-or-later
// R36 (docs/04 2.4): the one line a picked row gives for its mark. The reasons are the engine's (ValueFacts.why, G22 with
// G38, G39, G50) and the chip table's (a constant's σ); the words are clipboard/strings.ts. It loads with the row
// actions, never in the start chunk.
import type { MarkInfo } from "../engine/format.ts";
import type { HistoryItem } from "../state/session.svelte.ts";
import { copyExact } from "./exact.ts";
import { entryText, macroCalls } from "./plaintext.ts";
import { tc } from "./strings.ts";

const SUP = "⁰¹²³⁴⁵⁶⁷⁸⁹";
const sup = (n: number): string => `${n < 0 ? "⁻" : ""}${[...String(Math.abs(n))].map((d) => SUP[+d]).join("")}`;

/** A standard uncertainty as the line shows it: every significant digit the chip table holds, neither rounded nor cut,
 *  a trailing zero kept (CODATA's `1.0E-36` is `1.0·10⁻³⁶`, `0.00015E-11` is `1.5·10⁻¹⁵`); null if it is not a number. */
export function uncText(unc: string): string | null {
  const m = /^(\d*)\.?(\d*)(?:e([+-]?\d+))?$/.exec(unc.trim().toLowerCase());
  if (!m || (m[1] === "" && m[2] === "")) return null;
  const all = (m[1] ?? "") + (m[2] ?? "");
  const lead = all.search(/[1-9]/);
  if (lead < 0) return null;
  const d = all.slice(lead);
  const exp = (m[1] ?? "").length - 1 - lead + (m[3] ? parseInt(m[3], 10) : 0);
  return `${d.length > 1 ? `${d[0]}.${d.slice(1)}` : d}·10${sup(exp)}`;
}

/** The constants a row's chips hold with an uncertainty, as `G (± 1.5·10⁻¹⁵)`, in the order they stand in the entry. */
function constantsUsed(item: HistoryItem): string[] {
  const out: string[] = [];
  // brace-aware: a symbol holds braces (`\mu_{0}`, `\mu_{\mathrm{B}}`), and is named as plain text (`μ_0`), never as LaTeX (F171)
  for (const m of macroCalls(item.latex, "const", 2)) {
    const [id = "", symbol = ""] = m.args;
    const unc = item.chips?.[`const:${id}`]?.unc;
    const u = unc === undefined ? null : uncText(unc);
    const text = `${entryText(symbol)}${u ? ` (± ${u})` : ""}`;
    if (unc !== undefined && !out.includes(text)) out.push(text);
  }
  return out;
}

const list = (names: readonly string[]): string => names.join(", ");

/**
 * The line for `item` whose mark is `mark` (null: none). `digits` is the digits setting. The user's stored names behind an
 * `≈` are the engine's (why.rounded, R36f1: the names that lent inexact facts when the row ran), never read from the
 * entry text. Null when the row has no mark, so no line is drawn.
 */
export function whyLine(item: HistoryItem, mark: MarkInfo | null, digits: number): string | null {
  if (!mark) return null;
  if (mark.mark === "=") return `= ${tc("why.exact")}`;
  const why = item.facts?.why;
  if (mark.mark === "≈") {
    const consts = constantsUsed(item);
    if (consts.length) return `≈ ${tc("why.uses")} ${list(consts)}`;
    if (why?.rounded?.length) return `≈ ${tc("why.uses")} ${list(why.rounded)}, ${tc("why.itselfRounded")}`;
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
