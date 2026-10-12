// SPDX-License-Identifier: GPL-3.0-or-later
// What the Function app needs from the engine: tables (Num, trace) and the analysis menu (Plot), both on
// the Calc port (gorge's MathEngine.table / analyze).
export type { AnalysisRequest, AnalysisResult as AnalysisOutcome } from "../../calc/port.ts";
import type { ComplexValue, PrecisionWarn } from "../../engine/format.ts";

/** One engine number as Home would show it (a HomeResult, or the part of it the views use). */
export interface Cell {
  ok: boolean;
  display: string;
  value?: ComplexValue;
  /** What the engine confirmed (a HomeResult has these); drawn digits are cut to it and a ⚠ marks fewer (docs/04 2.4). */
  exactRational?: boolean;
  reliableDigits?: number | null;
  warn?: PrecisionWarn;
}
