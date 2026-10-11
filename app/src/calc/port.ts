// SPDX-License-Identifier: GPL-3.0-or-later
// What the views need from the maths engine. The real implementation (calc/engine.ts) wraps MathEngine;
// the UI never talks to Giac directly (CLAUDE.md).

import type { ComplexValue } from "../engine/format.ts";
import type { AnalysisRequest, AnalysisResult, HomeResult, SolveOutcome, SolveRequest, TableRequest } from "../engine/types.ts";
import type { PythonEngine } from "../python/types.ts";

export type { AnalysisRequest, AnalysisResult, HomeResult, KnownValue, SolveOutcome, SolveRequest, SolveRoot, TableRequest } from "../engine/types.ts";

export type AngleUnit = "rad" | "deg";
export type NumberFormat = "std" | "sci" | "eng";

export interface CalcSettings {
  /** Significant digits shown in Home. */
  digits: number;
  angle: AngleUnit;
  format: NumberFormat;
}

export type CalcError = "syntax" | "timeout" | "engine";

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
}

export interface CasOutcome {
  ok: boolean;
  /** Giac's printed result, or the error text when !ok. */
  text: string;
  /** Giac `latex()` of the result (raw); empty when !ok. */
  latex: string;
  error?: CalcError;
}

/** Thrown by home()/cas() when Cancel stopped the job. */
export class CalcCancelled extends Error {
  constructor() {
    super("cancelled");
    this.name = "CalcCancelled";
  }
}

export interface Calc {
  ready(): Promise<void>;
  home(giac: string, settings: CalcSettings): Promise<HomeOutcome>;
  cas(giac: string, settings: CalcSettings): Promise<CasOutcome>;
  /** Solve app: equations from guesses (1-D or a system), or all roots of a polynomial. */
  solve(req: SolveRequest, settings: CalcSettings): Promise<SolveOutcome>;
  /** The variables in the equations, constants excluded, in order of appearance. */
  unknowns(equations: string[]): Promise<string[]>;
  /** Function app Plot menu: root, extremum, intersection, slope, signed area. */
  analyze(req: AnalysisRequest, settings: CalcSettings): Promise<AnalysisResult>;
  /** Function app Num table and trace: rows by x, cells as Home shows them. One engine call. */
  table(req: TableRequest, settings: CalcSettings): Promise<HomeResult[][]>;
  /** Stop the running job. Variables survive. Resolves when the engine can take calls again. */
  cancel(): Promise<void>;
  /** The Python engine (its own worker, loaded on the first call; the same instance afterwards). */
  python(): Promise<PythonEngine>;
}
