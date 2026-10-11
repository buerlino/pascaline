// SPDX-License-Identifier: GPL-3.0-or-later
// Messages between pythonEngine.ts (main thread) and python.worker.ts.
import type { GfxCmd, PyResult } from "./types.ts";

export type PyRequest =
  | { type: "init"; id: number; baseUrl: string }
  | { type: "run"; id: number; code: string; file: string }
  | { type: "shell"; id: number; line: string }
  /** Answer to a `host` message (a `calc` call from Python). */
  | { type: "hostReply"; rid: number; ok: boolean; value?: unknown; error?: string };

export type PyResponse =
  | { type: "ready"; id: number; loadMs: number }
  | { type: "done"; id: number; result: PyResult }
  | { type: "fatal"; id: number; message: string }
  | { type: "out"; stream: "stdout" | "stderr"; text: string }
  | { type: "gfx"; batch: GfxCmd[] }
  /** Python called the host (e.g. `calc.cas`); Python is suspended until the hostReply. */
  | { type: "host"; rid: number; fn: string; args: unknown[] };
