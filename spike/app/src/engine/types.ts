// SPDX-License-Identifier: GPL-3.0-or-later
// The only way UI code talks to maths. Implementations run the engine off the main thread.
import type { HomeResult, HomeSettings } from "../home/homeEval";

export type EngineKind = "source" | "prebuilt";

export interface EngineSettings {
  /** Significant digits for approximate results (Giac `Digits`). */
  digits: number;
  angle: "rad" | "deg";
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
  /** giac_init() and settings. */
  initMs: number;
  /** Worker construction to "ready" as seen from the caller (includes the above). */
  readyMs: number;
  /** Variable-log replay after a restart (0 on first start). */
  replayMs: number;
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
  eval(input: string): Promise<EvalResult>;
  /** LaTeX for `input` (evaluated first). */
  latex(input: string): Promise<EvalResult>;
  setSettings(settings: Partial<EngineSettings>): Promise<void>;
  /** Exact-first Home evaluation (spike/home/NOTES.md); source engine only. */
  home(input: string, settings: HomeSettings): Promise<HomeResult>;
  /**
   * Abort whatever is running: terminates the worker, starts a new one and replays the
   * settings and variable definitions. Pending calls reject with EngineCancelled.
   */
  cancel(): Promise<EngineTimings>;
  dispose(): void;
}
