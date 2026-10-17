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
   *  slot multiplies the number before it (`72*pasu1`). */
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
  /** A constant with an uncertainty went in: never "=" (decisions M4-4), as in Home. */
  inexact: boolean;
}

export interface Quantity {
  /** The number in the end slot's unit, or in SI base units without one. Home's facts (display at the digits
   *  setting, value, exactRational, reliableDigits, full, warn, exact), so markOf() marks it as Home. */
  value: HomeResult;
  /** The dimension key, as the index writes it ("kg1m1s-2"; "" for a pure number). null for an exact 0, whose
   *  dimension is lost. */
  dimension: string | null;
  ms: number;
}

/** A refusal. The message is built by messages.ts from the i18n table. */
export type UnitError =
  /** Terms or the end slot do not fit: the dimension keys (two or more; the end slot's last). */
  | { error: "dimension"; dims: string[]; end?: true }
  /** An absolute temperature (°C, °F) in arithmetic (G17 adds the conversions alone), a logarithmic unit (G17), a
   *  unit with no exact factor (G13); `unit` is its symbol. */
  | { error: "temperature" | "logarithmic" | "nofactor"; unit: string }
  /** A function of a quantity with units (sin, cos and tan take an angle or a pure number). */
  | { error: "function" }
  /** The number part is not a number (a free name): Giac's text of it. */
  | { error: "symbolic"; detail: string }
  /** Anything else (a syntax error, a timeout, a bad request): the detail is for the log, not for the user. */
  | { error: "engine"; detail: string };

export function isUnitError<T extends object>(r: T | UnitError): r is UnitError {
  return "error" in r;
}
