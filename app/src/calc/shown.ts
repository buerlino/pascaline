// SPDX-License-Identifier: GPL-3.0-or-later
// Numbers the Solve and Function apps draw: only the digits the engine confirmed (docs/04 2.4), and a ⚠ when
// fewer digits are confirmed than shown. These two views show no `=` or `≈` (docs/04 2.4), only the warning.

import { confirmedOptions, formatComplex, markOf, type ComplexValue, type PrecisionFacts, type PrecisionWarn } from "../engine/format.ts";
import { engineFormat, type CalcSettings } from "./port.ts";

/** The part of an engine result these views read (a HomeResult has all of it). */
export interface ShownNumber {
  value?: ComplexValue;
  exactRational?: boolean;
  reliableDigits?: number | null;
  warn?: PrecisionWarn;
}

function factsOf(r: ShownNumber): PrecisionFacts {
  return {
    exactRational: r.exactRational ?? false,
    reliableDigits: r.reliableDigits ?? null,
    ...(r.warn ? { warn: r.warn } : {}),
    ...(r.value ? { value: r.value } : {}),
  };
}

/** The value in the current format and digits, cut to the confirmed digits; undefined when it has no value. */
export function confirmedText(r: ShownNumber, s: CalcSettings): string | undefined {
  if (!r.value) return undefined;
  const o = { format: engineFormat(s.format), digits: s.digits };
  return formatComplex(r.value, confirmedOptions(r.value, r.reliableDigits ?? null, o)).text;
}

/** ⚠: fewer digits are confirmed than the settings would show, or the result is un-audited/unchecked. */
export function isWarned(r: ShownNumber, s: CalcSettings): boolean {
  if (!r.value) return false;
  return markOf(factsOf(r), { format: engineFormat(s.format), digits: s.digits })?.mark === "⚠";
}
