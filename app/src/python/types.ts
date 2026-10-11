// SPDX-License-Identifier: GPL-3.0-or-later
// The Python app's only way to run Python (agreed gorge <-> ron, 2026-10-11). MicroPython runs in its
// own Web Worker, loaded the first time it is used; Cancel terminates the worker and starts a fresh one.

export interface PyTimings {
  /** Fetch + instantiate MicroPython inside the worker. */
  loadMs: number;
  /** Worker construction to "ready" as seen from the caller. */
  readyMs: number;
}

export interface PyError {
  /** Python exception type, e.g. "NameError". */
  type: string;
  message: string;
  /** Line of the innermost frame in the user's code, when known. */
  line?: number;
  file?: string;
  /** The full traceback text (also written to stderr). */
  traceback: string;
}

export interface PyResult {
  ok: boolean;
  ms: number;
  error?: PyError;
}

export interface PyOutput {
  stream: "stdout" | "stderr";
  /** Chunks may be partial lines. */
  text: string;
}

/** Graphics draw commands: 320x240, integer pixels, origin top-left, y down, colours 0xRRGGBB.
 *  Sent in batches (every 256 commands, about every 16 ms during a run, and at run end).
 *  The canvas starts white; a run does not clear it; Cancel keeps what was drawn. */
export type GfxCmd =
  | ["clear", number]
  | ["pixel", number, number, number]
  | ["line", number, number, number, number, number]
  | ["rect", number, number, number, number, number]
  | ["fillrect", number, number, number, number, number]
  | ["circle", number, number, number, number]
  | ["fillcircle", number, number, number, number]
  | ["text", number, number, string, number, "small" | "medium" | "large"]
  | ["show"];

export const GFX_WIDTH = 320;
export const GFX_HEIGHT = 240;

export class PythonCancelled extends Error {
  constructor() {
    super("cancelled");
    this.name = "PythonCancelled";
  }
}

export interface PythonEngine {
  /** The first call loads MicroPython in its worker. */
  ready(): Promise<PyTimings>;
  /** Editor Run: fresh __main__ globals; afterwards the shell sees the script's names. */
  run(code: string, opts?: { file?: string }): Promise<PyResult>;
  /** One shell entry (a whole block for def/for): persistent globals, echoes expression values. */
  shell(line: string): Promise<PyResult>;
  /** Terminate the worker and start a fresh one; pending calls reject with PythonCancelled; shell globals are lost. */
  cancel(): Promise<PyTimings>;
  /** Subscriptions survive cancel(). Returns an unsubscribe function. */
  onOutput(cb: (o: PyOutput) => void): () => void;
  onGraphics(cb: (batch: GfxCmd[]) => void): () => void;
  dispose(): void;
}
