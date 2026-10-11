// SPDX-License-Identifier: GPL-3.0-or-later
// Messages between WorkerEngine (main thread) and the engine host (inside the worker).
import type { AnalysisRequest, AnalysisResult, CasResult, CasSettings, HomeResult, HomeSettings, SolveOutcome, SolveRequest, TableRequest } from "./types.ts";

export type Request =
  | { id: number; type: "init"; baseUrl: string; replay: string[] }
  | { id: number; type: "eval"; input: string }
  | { id: number; type: "home"; input: string; settings: HomeSettings }
  | { id: number; type: "cas"; input: string; settings: CasSettings }
  | { id: number; type: "solve"; req: SolveRequest; settings: HomeSettings }
  | { id: number; type: "unknowns"; equations: string[] }
  | { id: number; type: "analyze"; req: AnalysisRequest; settings: HomeSettings }
  | { id: number; type: "table"; req: TableRequest; settings: HomeSettings };

/** `replay`: Giac commands that changed engine state (variable or function definitions); the
 *  client logs them and replays them into a fresh worker after a Cancel or crash. */
export type Response =
  | { id: number; type: "ready"; instantiateMs: number; initMs: number; replayMs: number }
  | { id: number; type: "result"; output: string; ok: boolean; engineMs: number; replay: string[] }
  | { id: number; type: "home"; result: HomeResult; replay: string[] }
  | { id: number; type: "cas"; result: CasResult; replay: string[] }
  | { id: number; type: "solve"; result: SolveOutcome }
  | { id: number; type: "unknowns"; result: string[] }
  | { id: number; type: "analyze"; result: AnalysisResult }
  | { id: number; type: "table"; result: HomeResult[][] }
  | { id: number; type: "fatal"; message: string };
