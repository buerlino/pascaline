// SPDX-License-Identifier: GPL-3.0-or-later
// Messages between WorkerEngine (main thread) and giac.worker.ts.
import type { EngineKind } from "./types";

export type Request =
  | { id: number; type: "init"; engine: EngineKind; baseUrl: string; replay: string[] }
  | { id: number; type: "eval"; input: string }
  | { id: number; type: "latex"; input: string };

export type Response =
  | { id: number; type: "ready"; instantiateMs: number; initMs: number; replayMs: number }
  | { id: number; type: "result"; output: string; ok: boolean; engineMs: number }
  | { id: number; type: "fatal"; message: string };
