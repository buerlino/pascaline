// SPDX-License-Identifier: GPL-3.0-or-later
// What the Function app needs from the engine: tables (Num, trace) and the analysis menu (Plot).
// Shapes agreed with gorge (MathEngine.table / analyze). Until the Calc port has them, a slow stand-in
// evaluates table cells one Home call at a time and analysis reports that it is not available.
import { CalcCancelled, type Calc, type CalcSettings } from "../../calc/port.ts";
import type { ComplexValue } from "../../engine/format.ts";

/** One engine number as Home would show it. */
export interface Cell {
  ok: boolean;
  display: string;
  value?: ComplexValue;
}

export type AnalysisRequest =
  | { kind: "root" | "extremum"; f: string; x0: string; lo?: string; hi?: string; variable?: string }
  | { kind: "intersection"; f: string; g: string; x0: string; lo?: string; hi?: string; variable?: string }
  | { kind: "slope"; f: string; x0: string; variable?: string }
  | { kind: "area"; f: string; g?: string; a: string; b: string; variable?: string };

export interface AnalysisOutcome {
  ok: boolean;
  x?: Cell;
  y?: Cell;
  value?: Cell;
  extremum?: "min" | "max" | "flat";
  /** The residual or consistency check failed: show ⚠. */
  warn: boolean;
  /** Which method found it, and the check (one line). */
  info: string;
  method: string;
  error?: "syntax" | "engine" | "no-root" | "bad-input";
}

export interface FunctionCalc {
  table(req: { fns: string[]; xs: string[]; variable?: string }, s: CalcSettings): Promise<Cell[][]>;
  analyze(req: AnalysisRequest, s: CalcSettings): Promise<AnalysisOutcome>;
}

function hasFunctionApi(c: Calc): c is Calc & FunctionCalc {
  const o = c as unknown as Record<string, unknown>;
  return typeof o["table"] === "function" && typeof o["analyze"] === "function";
}

/** The engine calls for the Function app (the real ones once calc/ has them). */
export function functionCalc(calc: Calc): FunctionCalc {
  if (hasFunctionApi(calc)) return calc;
  return {
    async table(req, s) {
      const rows: Cell[][] = [];
      for (const x of req.xs) {
        const row: Cell[] = [];
        for (const f of req.fns) {
          const r = await calc.home(`subst(${f},${req.variable ?? "x"}=${x})`, s);
          row.push({ ok: r.ok, display: r.display, ...(r.value ? { value: r.value } : {}) });
        }
        rows.push(row);
      }
      return rows;
    },
    analyze() {
      return Promise.resolve({ ok: false, warn: false, info: "", method: "", error: "engine" });
    },
  };
}

export { CalcCancelled };
