// SPDX-License-Identifier: GPL-3.0-or-later
// The unit evaluator's input and output (P15, docs/04 4.2 and 8.2). R24a's slot model and R28's units mode produce
// a UnitRequest; Calc.units() builds it into a UnitJob with the Find index's factors (main thread) and the Giac
// worker evaluates the job. Types only.
import type { HomeResult } from "../engine/homeEval.ts";

/** One factor of a slot: a Find unit id with an optional Find prefix id and a power. */
export interface UnitToken {
  /** A prefix id without "pfx:" ("k", "u", "Mi"). */
  prefix?: string;
  /** A unit id without "unit:" ("m", "h", "ohm", "km/h"). */
  unit: string;
  /** An integer or p/q ("2", "-1", "1/2" for √); default "1". The prefix is inside the power: km² = (km)². */
  power?: string;
}

/** A unit slot: its factors in order; from index `per` on they are below the ÷ (absent: no ÷). */
export interface UnitSlot {
  tokens: UnitToken[];
  per?: number;
}

export interface UnitRequest {
  /** Giac text from our parser in units mode: `pasu1`, `pasu2`, … for the slots, `pask1`, … for the constants. A
   *  slot multiplies the number before it (`72*pasu1`). An uncertain value is `pasupm(value,sigma)` (G18): sigma is
   *  the standard uncertainty in the same unit, and each one is an independent input. */
  formula: string;
  /** slots[i] is `pasu<i+1>`. */
  slots: UnitSlot[];
  /** Find constant ids without "const:"; consts[i] is `pask<i+1>`. A constant carries its dimension. */
  consts?: string[];
  /** The end slot "→ should be". */
  end?: UnitSlot;
}

/** What the worker evaluates: Giac text with every unit and constant replaced by factor × dimension symbols. */
export interface UnitJob {
  expr: string;
  /** The end slot's factor × dimension symbols. */
  end?: string;
  /** The end slot is an absolute temperature (°C, °F): the offset b in K = a·x + b, as exact text (end holds a). */
  endOffset?: string;
  /** The end slot is a logarithmic unit: the level as Giac text of `pasux`, the ratio to the end slot's reference
   *  (end holds the reference, 1 mW for dBm): `20*log10(pasux)` for dB. */
  endLog?: string;
  /** The source is an absolute temperature (°C, °F), already in K: a value below 0 K is refused. */
  absTemp?: true;
  /** The end slot as text ("m/s", "cm²"), the unit of the result then. */
  endUnit?: string;
  /** Without an end slot: the typed units the result may be shown in, best first (G25). The first whose `dim` is the
   *  result's dimension is used; none: SI with an SI prefix. */
  shows?: ShownUnit[];
  /** A constant with an uncertainty went in: never "=" (decisions M4-4), as in Home. */
  inexact: boolean;
  /** Uncertain inputs (G18): `expr` is the formula with a free symbol per uncertain value, which the worker
   *  differentiates; `expr` above has them replaced by their values. */
  unc?: { expr: string; vars: UncVar[] };
}

/** A unit typed in the formula's slots, as a unit to show the result in. */
export interface ShownUnit {
  /** "N·m", "km/h". */
  text: string;
  /** Its dimension key, as the index writes it. */
  dim: string;
  /** Its exact factor to SI base units as Giac text ("1", "1000", "pi/180"). */
  factor: string;
}

/** An uncertain input: the symbol `pasv<n>` stands for a value with a standard uncertainty (Giac text of both). */
export interface UncVar {
  name: string;
  value: string;
  sigma: string;
}

export interface Quantity {
  /** The number in `unit`. Home's facts (display at the digits
   *  setting, value, exactRational, reliableDigits, full, warn, exact), so markOf() marks it as Home. */
  value: HomeResult;
  /** The dimension key, as the index writes it ("kg1m1s-2"; "" for a pure number). null for an exact 0, whose
   *  dimension is lost. */
  dimension: string | null;
  /** The unit `value` is in (G25): the end slot as typed; without one the units typed in the slots when they fit the
   *  result's dimension (`5 N × 2 m`: "N·m"), else the SI unit with an SI prefix ("µs", "kJ", "m/s"). "" for a pure
   *  number and an exact 0. */
  unit: string;
  /** The dimension as text ("L·T⁻¹", "M·L²·T⁻²", "1" for a pure number); null for an exact 0. */
  dimensionText: string | null;
  /** Giac's exact text of the number in SI base units. Absent for an exact 0, or when the text is too long to keep. */
  si?: string;
  /** G18: the first-order uncertainty of a result with uncertain inputs (the value is then never "="). */
  unc?: Uncertainty;
  ms: number;
}

/** σ = sqrt(Σ (∂f/∂xᵢ · σᵢ)²) over independent inputs, in the same unit as the value. */
export interface Uncertainty {
  /** σ with Home's facts (display at the digits setting). */
  value: HomeResult;
  /** σ to 2 significant digits (docs/04 2.6), trailing zero kept: "1.2", "0.10". */
  text: string;
  /** The value rounded to σ's last digit, then " ± " and σ: "39.5 ± 1.2". */
  shown: string;
}

/** A refusal. The message is built by messages.ts from the i18n table. */
export type UnitError =
  /** Terms or the end slot do not fit: the dimension keys (two or more; the end slot's last). */
  | { error: "dimension"; dims: string[]; end?: true }
  /** An absolute temperature (°C, °F) or a logarithmic unit anywhere but alone (G17: alone it converts), a unit with
   *  no exact factor (G13); `unit` is its symbol. */
  | { error: "temperature" | "logarithmic" | "nofactor"; unit: string }
  /** The level of a value at or below 0, or an absolute temperature below 0 K. */
  | { error: "level" | "belowzero" }
  /** A function of a quantity with units (sin, cos and tan take an angle or a pure number). */
  | { error: "function" }
  /** The number part is not a number (a free name): Giac's text of it. */
  | { error: "symbolic"; detail: string }
  /** Anything else (a syntax error, a timeout, a bad request): the detail is for the log, not for the user. */
  | { error: "engine"; detail: string };

export function isUnitError<T extends object>(r: T | UnitError): r is UnitError {
  return "error" in r;
}
