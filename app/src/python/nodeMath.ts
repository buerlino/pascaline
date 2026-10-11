// SPDX-License-Identifier: GPL-3.0-or-later
// An in-process MathEngine over EngineHost for Node tests and the golden runner (no worker, no Cancel).
// Only the calls the Python bridge uses are real; the others throw.
import { EngineHost } from "../engine/host.ts";
import { loadNodeGiac } from "../engine/nodeGiac.ts";
import type { MathEngine } from "../engine/types.ts";

export async function loadNodeMath(): Promise<{ math: MathEngine; host: EngineHost }> {
  const host = new EngineHost((await loadNodeGiac()).giac);
  const no = (): never => {
    throw new Error("nodeMath: not available");
  };
  const math: MathEngine = {
    ready: async () => ({ instantiateMs: 0, initMs: 0, replayMs: 0, readyMs: 0 }),
    home: async (input, s) => host.home(input, s).result,
    cas: async (input, s) => host.cas(input, s).result,
    eval: async (input) => {
      const r = host.eval(input);
      return { output: r.output, ok: r.ok, engineMs: r.engineMs };
    },
    solve: no,
    unknowns: no,
    analyze: no,
    table: no,
    cancel: no,
    dispose: () => {},
  };
  return { math, host };
}
