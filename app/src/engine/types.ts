// SPDX-License-Identifier: GPL-3.0-or-later
// The only way UI code talks to maths (CLAUDE.md). Implementations run Giac off the main thread.
import type { HomeResult, HomeSettings } from "./homeEval.ts";

export type { HomeResult, HomeSettings };

export interface CasSettings {
  angle: "rad" | "deg";
  /** Significant digits for approximate results inside CAS (Giac `Digits`). */
  digits: number;
  /** Giac's own interrupt as a safety net (seconds, < 1440). The user-facing limit is the Cancel key. */
  hardTimeoutS: number;
  /** Exact integer powers b^n with |n·ln b| above this fail at once. D3: Giac's default 1e8 in CAS. */
  powLimit: number;
}

/** D3: no automatic fallback in CAS; after about this long the UI makes Cancel prominent. */
export const CAS_SOFT_BUDGET_MS = 10_000;

export const defaultCasSettings: CasSettings = {
  angle: "rad",
  digits: 12,
  hardTimeoutS: 600,
  powLimit: 1e8,
};

export interface CasResult {
  ok: boolean;
  /** Giac's printed result (for copy/paste and tests), or the error text when !ok. Never shown as the 2D result. */
  text: string;
  /** Giac `latex()` of the result (raw; the view tidies it up and renders it). Empty when !ok. */
  latex: string;
  /** Giac stopped itself at hardTimeoutS. */
  timedOut: boolean;
  /** Why !ok, for the UI's own (translated) message: Giac's text stays in `text`. */
  error?: "syntax" | "timeout" | "engine";
  engineMs: number;
}

export interface EvalResult {
  /** Giac's printed result, or the error text when `ok` is false. */
  output: string;
  ok: boolean;
  /** Time spent inside the engine call, measured in the worker. */
  engineMs: number;
}

export interface EngineTimings {
  /** Fetch + compile + instantiate the wasm module. */
  instantiateMs: number;
  /** giac_init(). */
  initMs: number;
  /** Variable-log replay after a restart (0 on first start). */
  replayMs: number;
  /** Worker construction to "ready" as seen from the caller (includes the above). */
  readyMs: number;
}

export class EngineCancelled extends Error {
  constructor() {
    super("cancelled");
    this.name = "EngineCancelled";
  }
}

export interface MathEngine {
  /** Resolves once the engine can take calls. */
  ready(): Promise<EngineTimings>;
  /** Exact-first Home evaluation: a decimal result rounded to `settings.digits`. */
  home(input: string, settings: HomeSettings): Promise<HomeResult>;
  /** Exact CAS evaluation plus `latex()` of the result. */
  cas(input: string, settings: CasSettings): Promise<CasResult>;
  /** Raw Giac call in whatever mode the engine is in (tools and benchmarks only, not the UI). */
  eval(input: string): Promise<EvalResult>;
  /**
   * Abort whatever is running: terminates the worker, starts a new one and replays the variable
   * definitions. Pending calls reject with EngineCancelled. Mode settings are re-applied on the next call.
   */
  cancel(): Promise<EngineTimings>;
  dispose(): void;
}
