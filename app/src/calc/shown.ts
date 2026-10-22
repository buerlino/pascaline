// SPDX-License-Identifier: GPL-3.0-or-later
// Numbers the Solve and Function apps draw: only the digits the engine confirmed (docs/04 2.4), and a ⚠ when
// fewer digits are confirmed than shown. These two views show no `=` or `≈` (docs/04 2.4), only the warning.

import { confirmedOptions, formatComplex, markOf, type ComplexValue } from "../engine/format.ts";
import { engineFormat, type CalcSettings, type ValueFacts } from "./port.ts";

/** The part of an engine result these views read (a HomeResult has all of it): the value with its facts, whole (G86). */
export interface ShownNumber {
  value?: ComplexValue;
  facts: ValueFacts;
}

/** The value in the current format and digits, cut to the confirmed digits; undefined when it has no value. */
export function confirmedText(r: ShownNumber, s: CalcSettings): string | undefined {
  if (!r.value) return undefined;
  const o = { format: engineFormat(s.format), digits: s.digits };
  return formatComplex(r.value, confirmedOptions(r.value, r.facts.reliableDigits, o)).text;
}

/** ⚠: fewer digits are confirmed than the settings would show, or the result is un-audited/unchecked. */
export function isWarned(r: ShownNumber, s: CalcSettings): boolean {
  if (!r.value) return false;
  return markOf({ ...r.facts, value: r.value }, { format: engineFormat(s.format), digits: s.digits })?.mark === "⚠";
}
