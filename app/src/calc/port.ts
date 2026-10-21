// SPDX-License-Identifier: GPL-3.0-or-later
// What the views need from the maths engine. The real implementation (calc/engine.ts) wraps MathEngine;
// the UI never talks to Giac directly (CLAUDE.md).

import type { ComplexValue, NumberFormat as EngineFormat, PrecisionWarn } from "../engine/format.ts";
import type { AnalysisRequest, AnalysisResult, HomeResult, SolveOutcome, SolveRequest, TableRequest } from "../engine/types.ts";
import type { ChipFactsTable } from "../engine/chipFacts.ts";
export type { ChipEntry, ChipFactsTable } from "../engine/chipFacts.ts";

export type { AnalysisRequest, AnalysisResult, HomeResult, KnownValue, SolveOutcome, SolveRequest, SolveRoot, TableRequest } from "../engine/types.ts";
export type { UserName } from "../engine/defs.ts";
import type { UserName } from "../engine/defs.ts";
import type { Refusal } from "../engine/converge.ts";
import type { Quantity, UnitError, UnitRequest } from "../units/types.ts";
export type { Quantity, UnitError, UnitRequest, UnitSlot, UnitToken } from "../units/types.ts";
export { CAS_SOFT_BUDGET_MS, IDENT } from "../engine/types.ts";

export type AngleUnit = "rad" | "deg";
export type NumberFormat = "std" | "sci" | "eng" | "pfx";

const ENGINE_FORMAT = { std: "STD", sci: "SCI", eng: "ENG", pfx: "PFX" } as const satisfies Record<NumberFormat, EngineFormat>;

/** The engine formatter's name for a Number format setting ("std" → "STD"). */
export function engineFormat(f: NumberFormat): (typeof ENGINE_FORMAT)[NumberFormat] {
  return ENGINE_FORMAT[f];
}

export interface CalcSettings {
  /** Significant digits shown in Home: 1–30 (docs/04 section 2.5; the engine works at max(30, digits+10)). */
  digits: number;
  angle: AngleUnit;
  format: NumberFormat;
}

export type CalcError = "syntax" | "timeout" | "engine" | Refusal;

export interface HomeOutcome {
  ok: boolean;
  /** The formatted result (decimal), or the error text when !ok. */
  display: string;
  /** The shown value came from floating point, not from an exact computation. */
  approximate: boolean;
  /** The numeric value, so the view can re-format it (STD/SCI/ENG) without calling the engine. */
  value?: ComplexValue;
  /** The exact result when it is a plain integer or fraction (`3`, `-7/3`): the Format key's fraction modes. */
  exact?: string;
  /** Why it failed, for the app's own translated message. */
  error?: CalcError;
  /** The value is exactly p/q or an integer; with the format this decides "=". */
  exactRational: boolean;
  /** Digits confirmed by the agreement check; null = exact. */
  reliableDigits: number | null;
  /** The text to copy and the `\res` chip value: the exact text or P digits. */
  full: string;
  /** What a stateful input defined (Find live items). */
  defined?: { name: string; kind: "var" | "fn" };
  /** Elements of a numeric list or matrix (rows flattened, with `shape` for a matrix). */
  items?: HomeResult[];
  shape?: [number, number];
  /** ⚠ although the digits agree: an un-audited function's float, or a value evaluated only once (markOf, format.ts). */
  warn?: PrecisionWarn;
  /** The digits the input asked for (`evalf(e,n)`, decisions M4-6): drawn with these, not the digits setting. */
  digits?: number;
  /** Giac latex() of a result that is not a number (raw; the view tidies it and draws it, as in CAS). */
  latex?: string;
  /** G67: the input changed one of the engine's settings, which was put back: the result line says it was not kept. */
  settingReset?: true;
}

export interface CasOutcome {
  ok: boolean;
  /** Giac's printed result, or the error text when !ok. */
  text: string;
  /** Giac `latex()` of the result (raw); empty when !ok. */
  latex: string;
  /** G46: the radian text Ans and chips carry when `text` shows it in degrees (DEG); absent when they are the same. */
  full?: string;
  error?: CalcError;
  /** The result as a number, when it is one. */
  numeric?: HomeResult;
  /** A true or false that rests on a float (an == or ≠ test, R18f1), or a non-number with a float in it (G27). */
  approximate?: boolean;
  /** The mark is ⚠: that float comes from an unaudited function (R18f2), or sits in a non-number nobody checked (G27). */
  warn?: PrecisionWarn;
  /** The stored variables the input read, with the view that stored each (F28); absent when there is none. */
  uses?: { name: string; preview: string; view: "home" | "cas" }[];
  /** G67: the input changed one of the engine's settings, which was put back: the result line says it was not kept. */
  settingReset?: true;
}

/** Thrown by home()/cas() when Cancel stopped the job. */
export class CalcCancelled extends Error {
  constructor() {
    super("cancelled");
    this.name = "CalcCancelled";
  }
}

export interface Calc {
  /** Resolves when the engine can take calls; `safeStart` when it started without the stored definitions (G19). */
  ready(): Promise<{ safeStart?: { skipped: number } } | void>;
  /** `chips`: the result chips the input holds by name (`pasr_<k>`), with their values and facts (G49, R65). */
  home(giac: string, settings: CalcSettings, chips?: ChipFactsTable): Promise<HomeOutcome>;
  cas(giac: string, settings: CalcSettings): Promise<CasOutcome>;
  /** Solve app: equations from guesses (1-D or a system), or all roots of a polynomial. */
  solve(req: SolveRequest, settings: CalcSettings): Promise<SolveOutcome>;
  /** The variables in the equations, constants excluded, in order of appearance. */
  unknowns(equations: string[]): Promise<string[]>;
  /** Function app Plot menu: root, extremum, intersection, slope, signed area. */
  analyze(req: AnalysisRequest, settings: CalcSettings): Promise<AnalysisResult>;
  /** Function app Num table and trace: rows by x, cells as Home shows them. One engine call. */
  table(req: TableRequest, settings: CalcSettings): Promise<HomeResult[][]>;
  /** The user's variables and functions (Vars, Find's live items; docs/04 3.4), stored ones included once read. */
  names(): Promise<UserName[]>;
  /** The unit view (G16, docs/04 4.2): the formula with its unit slots, evaluated exactly with the Find index's
   *  factors (loaded on the first call, never at start) in the Giac worker; Cancel stops it as it stops Home. */
  units(req: UnitRequest, settings: CalcSettings): Promise<Quantity | UnitError>;
  /** Stop the running job. Variables survive. Resolves when the engine can take calls again. */
  cancel(): Promise<void>;
}
