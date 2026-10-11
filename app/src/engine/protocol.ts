// SPDX-License-Identifier: GPL-3.0-or-later
// Messages between WorkerEngine (main thread) and the engine host (inside the worker).
import type { CasResult, CasSettings, HomeResult, HomeSettings } from "./types.ts";

export type Request =
  | { id: number; type: "init"; baseUrl: string; replay: string[] }
  | { id: number; type: "eval"; input: string }
  | { id: number; type: "home"; input: string; settings: HomeSettings }
  | { id: number; type: "cas"; input: string; settings: CasSettings };

/** `replay`: Giac commands that changed engine state (variable or function definitions); the
 *  client logs them and replays them into a fresh worker after a Cancel or crash. */
export type Response =
  | { id: number; type: "ready"; instantiateMs: number; initMs: number; replayMs: number }
  | { id: number; type: "result"; output: string; ok: boolean; engineMs: number; replay: string[] }
  | { id: number; type: "home"; result: HomeResult; replay: string[] }
  | { id: number; type: "cas"; result: CasResult; replay: string[] }
  | { id: number; type: "fatal"; message: string };
