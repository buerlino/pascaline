// SPDX-License-Identifier: GPL-3.0-or-later
// Web Worker hosting one Giac wasm instance. Synchronous inside; the main thread cancels by
// terminating us (WorkerEngine.cancel), Giac's own interrupt handles the time budgets.
import type { Request, Response } from "./protocol.ts";
import { createRequestHandler, messageBuffer, setGiacHostGlobals, type GiacLoader } from "./host.ts";

interface GiacModule {
  cwrap(name: string, ret: "string", args: string[]): (...a: string[]) => string;
  cwrap(name: string, ret: "number", args: "number"[]): (...a: number[]) => number;
}
type ModuleFactory = (opts: object) => Promise<GiacModule>;

const load: GiacLoader = async (baseUrl) => {
  setGiacHostGlobals();
  const t0 = performance.now();
  // Absolute URL: Vite's dev server rewrites root-relative dynamic imports (adds ?import), which breaks public/ files.
  const url = new URL(`${baseUrl}engine/giac.mjs`, self.location.href).href;
  const mod = (await import(/* @vite-ignore */ url)) as { default: ModuleFactory };
  const out = messageBuffer();
  const M = await mod.default({ print: out.print, printErr: () => {} });
  M.cwrap("giac_init", "number", [])();
  const giacEval = M.cwrap("giac_eval", "string", ["string"]);
  const setPowLimit = M.cwrap("giac_set_pow_limit", "number", ["number"]);
  return {
    giac: { eval: (s) => giacEval(s), setPowLimit: (n) => setPowLimit(n), messages: out.messages, clearMessages: out.clear },
    instantiateMs: performance.now() - t0,
  };
};

const handle = createRequestHandler(load, (msg: Response) => (self as unknown as Worker).postMessage(msg));
self.onmessage = (ev: MessageEvent<Request>) => void handle(ev.data);
