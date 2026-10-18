// SPDX-License-Identifier: GPL-3.0-or-later
// Messages between WorkerEngine (main thread) and the engine host (inside the worker).
import type { DefChange, DefEntry } from "./defs.ts";
import type { AnalysisRequest, AnalysisResult, CasResult, CasSettings, HomeResult, HomeSettings, SolveOutcome, SolveRequest, TableRequest } from "./types.ts";
import type { Quantity, UnitError, UnitJob } from "../units/types.ts";
import type { ConstTable } from "./constUnc.ts";

export type Request =
  | { id: number; type: "init"; baseUrl: string; replay: DefEntry[] }
  /** The stored definitions, read after the worker was started (first launch): replayed before any other request. */
  | { id: number; type: "define"; defs: DefEntry[] }
  | { id: number; type: "eval"; input: string }
  | { id: number; type: "home"; input: string; settings: HomeSettings; consts?: ConstTable }
  | { id: number; type: "cas"; input: string; settings: CasSettings }
  | { id: number; type: "solve"; req: SolveRequest; settings: HomeSettings }
  | { id: number; type: "unknowns"; equations: string[] }
  | { id: number; type: "analyze"; req: AnalysisRequest; settings: HomeSettings }
  | { id: number; type: "table"; req: TableRequest; settings: HomeSettings }
  /** The unit view (G16): a job built from the Find index's factors (units/build.ts), evaluated in Home's mode. */
  | { id: number; type: "units"; job: UnitJob; settings: HomeSettings };

/** `defs`: what an input defined or purged (defs.ts); the client keeps the log, stores it and gives it to a fresh
 *  worker after a Cancel, a crash or a relaunch. */
export type Response =
  | { id: number; type: "ready"; instantiateMs: number; initMs: number; replayMs: number }
  | { id: number; type: "defined"; replayMs: number }
  | { id: number; type: "result"; output: string; ok: boolean; engineMs: number; defs: DefChange[] }
  | { id: number; type: "home"; result: HomeResult; defs: DefChange[] }
  | { id: number; type: "cas"; result: CasResult; defs: DefChange[] }
  | { id: number; type: "solve"; result: SolveOutcome }
  | { id: number; type: "unknowns"; result: string[] }
  | { id: number; type: "analyze"; result: AnalysisResult }
  | { id: number; type: "table"; result: HomeResult[][] }
  | { id: number; type: "units"; result: Quantity | UnitError }
  | { id: number; type: "fatal"; message: string; memory?: true };
