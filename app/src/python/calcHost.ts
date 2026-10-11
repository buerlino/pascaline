// SPDX-License-Identifier: GPL-3.0-or-later
// Main-thread side of the `calc` module: answers Python's host calls through the MathEngine.
import { defaultCasSettings, type MathEngine } from "../engine/types.ts";

/** Resolves with a JSON-serialisable value; a rejection becomes a ValueError in Python. */
export type HostHandler = (fn: string, args: unknown[]) => Promise<unknown>;

export function createCalcHost(math: MathEngine): HostHandler {
  return async (fn, args) => {
    switch (fn) {
      case "cas": {
        const r = await math.cas(String(args[0]), defaultCasSettings);
        if (!r.ok) throw new Error(r.text);
        return r.text;
      }
      default:
        throw new Error(`calc: unknown function ${fn}`);
    }
  };
}
