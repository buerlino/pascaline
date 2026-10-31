// SPDX-License-Identifier: GPL-3.0-or-later
// R61 (r17 section 2, docs/04 4.3 "The way back"): the chip a unit result gives. It carries the number in the unit
// shown (not SI: the label and the value agree), with the facts Home's chip rule gives it (state/results.ts, R65: exact
// when an exact text exists and no σ or inexact constant went in, whatever the mark), σ in the same unit, and the unit
// as its label and slot. Home has no units (P8): the unit never reaches the arithmetic. Pure; only erasable TypeScript.
import { isZeroText } from "../engine/constBasis.ts";
import type { Chip } from "../input/chips.ts";
import { chipOf, FULL_LIMIT, homeItem } from "../state/results.ts";
import { isUnitError, type Quantity, type UnitError } from "./types.ts";

/** The chip of a unit result; undefined for a refusal, or a value or σ with no chip text (as Home's: insert as drawn). */
export function quantityChip(q: Quantity | UnitError): Chip | undefined {
  if (isUnitError(q)) return undefined;
  // a σ (an uncertain input or a constant with one, G18) or a value flagged inexact (G49) went in
  const inexact = q.unc !== undefined || q.value.facts.inexact === true;
  const item = homeItem(q.value, inexact);
  const chip = chipOf({ status: "done", ...item });
  if (!chip) return undefined;
  const sigma = q.unc?.value.full;
  if (q.unc && (!q.unc.value.ok || !sigma || sigma.length > FULL_LIMIT)) return undefined;
  if (sigma !== undefined && !isZeroText(sigma)) chip.unc = sigma;
  // the loader keeps a unit text of up to 40 characters (input/chips.ts validChips)
  if (q.unit !== "" && q.unit.length <= 40 && q.dimension && q.shownSlot) chip.unit = { text: q.unit, dim: q.dimension, slot: q.shownSlot };
  return chip;
}
