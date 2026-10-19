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
  /** G35: `expr` with each number beside a slot or constant replaced by its own symbol pasz<n>, for the dimension check:
   *  a term worth 0 (`0 m + 1 s`) or terms that cancel (`5 m − 5 m + 1 s`) keep their dimension there. */
  check?: string;
  /** G35: `check` has a sum, where a term can vanish: it is evaluated with the value. Without one it is needed only
   *  when the value is 0 (its dimension). */
  checkSum?: true;
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
  /** G32: the symbol of an rpm or rev typed in a slot (a count of cycles, not an angle), for the refusal that names it. */
  cycle?: string;
  /** G40: a cycle unit (rpm, rev, Hz or a unit made of them) in a slot or the end slot: no rad is dropped at the end
   *  slot (G32's refusal, or the mismatch, stays). */
  cycles?: true;
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
  /** The dimension key, as the index writes it ("kg1m1s-2"; "" for a pure number). A result 0 keeps the
   *  dimension of its terms (G35); null only for a 0 with no slot or constant in it. */
  dimension: string | null;
  /** The unit `value` is in (G25): the end slot as typed; without one the units typed in the slots when they fit the
   *  result's dimension (`5 N × 2 m`: "N·m"), else the SI unit with an SI prefix ("µs", "kJ", "m/s"). "" for a pure
   *  number and a 0 with no unit in it. */
  unit: string;
  /** The dimension as text ("L·T⁻¹", "M·L²·T⁻²", "1" for a pure number); null when `dimension` is. */
  dimensionText: string | null;
  /** Giac's exact text of the number in SI base units. Absent for an exact 0, or when the text is too long to keep. */
  si?: string;
  /** G18, G41: the uncertainty (first and second order) of a result with uncertain inputs (the value is then never "="). */
  unc?: Uncertainty;
  /** G40: a note on how the result was read (i18n, messages.ts unitNoteText): one rad dropped at the end slot, or a
   *  cycle unit (rpm, rev) in a product, whose value counts turns and has no 2π. */
  note?: UnitNote;
  ms: number;
}

/** G40 (decisions.md "Angles in the unit view"). */
export type UnitNote =
  /** The end slot's dimension differs from the result's by one rad (ω·r → m/s, τ·θ → J): rad = 1 was dropped. */
  | { note: "radDropped" }
  /** rpm or rev times another dimension: the value counts turns (a feed per turn is right, a speed at a radius needs
   *  2π·r·n); `unit` is its symbol. */
  | { note: "cycle"; unit: string };

/** G41: why a σ is shown with ⚠ (i18n, messages.ts unitWhyText). */
export type UncWhy =
  /** The second-order part is more than 10 % of σ²: first order does not hold here. */
  | "order2"
  /** An input's x ± 2σ reaches a point where f or its derivative is not defined. */
  | "singular";

/** σ² = Σᵢ (∂f/∂xᵢ)² uᵢ² + Σᵢ Σⱼ [½ (∂²f/∂xᵢ∂xⱼ)² + ∂f/∂xᵢ · ∂³f/∂xᵢ∂xⱼ²] uᵢ² uⱼ² over independent inputs (G18, G41;
 *  GUM 5.1.2, note), in the same unit as the value. */
export interface Uncertainty {
  /** σ with Home's facts (display at the digits setting). */
  value: HomeResult;
  /** σ to 2 significant digits (docs/04 2.6), trailing zero kept: "1.2", "0.10". */
  text: string;
  /** The value rounded to σ's last digit, then " ± " and σ: "39.5 ± 1.2". */
  shown: string;
  /** G41: present when σ carries ⚠, with the reason. */
  why?: UncWhy;
}

/** A refusal. The message is built by messages.ts from the i18n table. */
export type UnitError =
  /** Terms or the end slot do not fit: the dimension keys (two or more; the end slot's last). */
  | { error: "dimension"; dims: string[]; end?: true }
  /** An absolute temperature (°C, °F) or a logarithmic unit anywhere but alone (G17: alone it converts), a unit with
   *  no exact factor (G13); `unit` is its symbol. */
  | { error: "temperature" | "logarithmic" | "nofactor"; unit: string }
  /** G32: rpm or rev against an angle (rad); `unit` is its symbol. */
  | { error: "cycle"; unit: string }
  /** The level of a value at or below 0, or an absolute temperature below 0 K. */
  | { error: "level" | "belowzero" }
  /** A function of a quantity with units (sin, cos and tan take an angle or a pure number). */
  | { error: "function" }
  /** G35: a division by 0 (Giac's infinity or undef). */
  | { error: "divzero" }
  /** G35: a ± in the power of a unit (m^(2 ± 0.1)): σ would need ln of a unit. */
  | { error: "uncpower" }
  /** G35: a minus before a bracketed °C, °F or level quantity, −(5 °C): the minus belongs on the number. */
  | { error: "minus"; unit: string }
  /** The number part is not a number (a free name): Giac's text of it. */
  | { error: "symbolic"; detail: string }
  /** Anything else (a syntax error, a timeout, a bad request): the detail is for the log, not for the user. */
  | { error: "engine"; detail: string };

export function isUnitError<T extends object>(r: T | UnitError): r is UnitError {
  return "error" in r;
}
