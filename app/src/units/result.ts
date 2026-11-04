// SPDX-License-Identifier: GPL-3.0-or-later
// R62: what the unit view shows under the reading, as data (docs/04 4.3 "Result", docs/archive/r17-unit-result.md 0.3,
// docs/mockups/unit-result.html): a refusal, Working…, or a result with its value line (the mark as Home draws it, the
// value at the digits setting, the unit, the dimension), σ with its ⚠ and why-line, a note and the alternatives row.
// Plain TS; units/panel.ts draws it. Loaded with the unit view.
import { confirmedOptions, formatComplex, markOf, type FormatOptions, type Mark } from "../engine/format.ts";
import { precisionFacts } from "../engine/precisionFacts.ts";
import { unitText } from "../i18n/enUnits.ts";
import { groupText } from "../render/groupText.ts";
import { commaResult, markText } from "../state/displayMode.ts";
import type { Alternative } from "./alternatives.ts";
import { unitErrorMessage, unitNamesText, unitNoteText, unitWhyText } from "./messages.ts";
import { isUnitError, type Quantity, type UnitError } from "./types.ts";

/** What the view shows under the reading: nothing, a refusal (a slot's or the evaluator's), Working…, or a result. */
export type Shown =
  | { kind: "none" }
  | { kind: "message"; text: string }
  | { kind: "working" }
  | UnitShown;

export interface UnitShown {
  kind: "result";
  /** The value line's number: with σ `39.5 ± 1.2` (Uncertainty.shown), else the value at the digits setting. */
  text: string;
  /** The value alone as the evaluator displays it, with the decimal comma when it is on and no groups (the result's
   *  data-text, Copy's rule, R120; the e2e reads it). */
  display: string;
  unit: string;
  /** The mark as Home draws it (`⚠ 3` for fewer confirmed digits); a value with σ is never "=". */
  mark: Mark;
  markText: string;
  /** The value line's σ as `{ head: "1.0000 ± ", sigma: "0.0071" }`, so the ⚠ can sit just before σ. */
  sigma?: { head: string; tail: string };
  /** σ has ⚠ (Uncertainty.why). */
  warn: boolean;
  why?: string;
  note?: string;
  /** R121: the note on the names the formula read as pure numbers (Quantity.names). */
  names?: string;
  /** "L·T⁻¹"; absent for a pure number. */
  dim?: string;
  /** With σ, muted under the value line: the value and σ at the digits setting. */
  sub?: string;
  /** The dimension key; "" for a pure number (no row). */
  dimension: string;
  /** The row's chips, fixed for as long as this result is on screen (not reordered); "More…" follows them. */
  alts: readonly Alternative[];
}

/** How the host wants numbers drawn: Home's format and digits, R57's decimal comma, and R55's digit groups (the screen
 *  asks for them; `display`, the result's data-text and Copy's text, never has them). */
export interface UnitFormat extends FormatOptions {
  decimalComma?: boolean;
  grouped?: boolean;
}

/** A result as the view shows it. `alts` is the row (alternatives.ts), none for a refusal or a pure number. */
export function shownOf(q: Quantity | UnitError, u: UnitFormat, alts: readonly Alternative[] = []): Shown {
  if (isUnitError(q)) return { kind: "message", text: unitErrorMessage(q) };
  const { decimalComma, grouped, ...o } = u;
  /** R120: a number as the screen draws it (Home's unit row: commaResult, groupDigits) and as Copy writes it. */
  const comma = (s: string): string => (decimalComma ? commaResult(s, false) : s);
  const drawn = (s: string): string => comma(grouped ? groupText(s) : s);
  const facts = precisionFacts(q.value);
  const m = markOf(facts, o);
  const mark: Mark = m?.mark === "⚠" ? "⚠" : q.unc ? "≈" : (m?.mark ?? "≈");
  const number = (v: Quantity["value"]): string => (v.value ? formatComplex(v.value, confirmedOptions(v.value, v.facts.reliableDigits, o)).text : v.display);
  const value = number(q.value);
  const why = q.unc?.why;
  const dimension = q.dimension ?? "";
  const text = drawn(q.unc ? q.unc.shown : value);
  const dim = q.dimensionText !== null && q.dimensionText !== "1" && dimension !== "" ? q.dimensionText : undefined;
  return {
    kind: "result",
    text,
    display: comma(q.value.display),
    unit: q.unit,
    mark,
    markText: m ? markText({ ...m, mark }) : mark,
    ...(q.unc && q.unc.shown.endsWith(q.unc.text) ? { sigma: { head: drawn(q.unc.shown.slice(0, q.unc.shown.length - q.unc.text.length)), tail: drawn(q.unc.text) } } : {}),
    warn: why !== undefined,
    ...(why ? { why: unitWhyText(why) } : {}),
    ...(q.note ? { note: unitNoteText(q.note) } : {}),
    ...(q.names?.length ? { names: unitNamesText(q.names) } : {}),
    ...(dim ? { dim } : {}),
    ...(q.unc ? { sub: unitText("units.result.sub", { value: drawn(value), sigma: drawn(number(q.unc.value)) }) } : {}),
    dimension,
    alts: dimension === "" ? [] : alts,
  };
}
