// SPDX-License-Identifier: GPL-3.0-or-later
// What the views need from the maths engine. The real implementation (calc/engine.ts) wraps MathEngine;
// the UI never talks to Giac directly (CLAUDE.md).

import type { ComplexValue } from "../engine/format.ts";

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
  /** Stop the running job. Variables survive. Resolves when the engine can take calls again. */
  cancel(): Promise<void>;
}
