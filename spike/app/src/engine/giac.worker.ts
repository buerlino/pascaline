// SPDX-License-Identifier: GPL-3.0-or-later
// Web Worker hosting one Giac wasm instance. Synchronous inside; the main thread cancels by terminating us.
import type { Request, Response } from "./protocol";
import { homeEval, homeSetupCommands, type HomeResult, type HomeSettings } from "../home/homeEval";

interface GiacModule {
  cwrap(name: string, ret: "string", args: string[]): (...a: string[]) => string;
  cwrap(name: string, ret: "number", args: "number"[]): (...a: number[]) => number;
}
type ModuleFactory = (opts: object) => Promise<GiacModule>;

// Read by Giac's EMCC hooks (gen.cc, maple.cc): no "=decimal" suffix on fractions, no WebGL 3D.
(globalThis as Record<string, unknown>).UI = {
  add_evalf: 0,
  js_bigint: 0,
  disable3d: -1,
  Datestart: Date.now(),
};

let giacEval: ((s: string) => string) | null = null;
// Source engine only: Home's size guard for exact powers (wasm/api.cc giac_set_pow_limit).
let setPowLimit: ((limit: number) => number) | null = null;
// Home settings last applied to this worker instance (a new worker after Cancel starts empty).
let homeKey = "";

function home(input: string, s: HomeSettings): HomeResult {
  if (!giacEval) throw new Error("engine not ready");
  if (!setPowLimit) throw new Error("Home needs the source engine");
  const ev = giacEval;
  const key = JSON.stringify(s);
  if (key !== homeKey) {
    for (const c of homeSetupCommands(s)) ev(c);
    setPowLimit(s.powLimit);
    homeKey = key;
  }
  return homeEval({ eval: ev }, input, s);
}

function post(msg: Response): void {
  (self as unknown as Worker).postMessage(msg);
}

async function loadSource(baseUrl: string): Promise<(s: string) => string> {
  // Absolute URL: Vite's dev server rewrites root-relative dynamic imports (adds ?import), which breaks public/ files.
  const url = new URL(`${baseUrl}engine/source/giac.mjs`, self.location.href).href;
  const mod = (await import(/* @vite-ignore */ url)) as { default: ModuleFactory };
  const M = await mod.default({ print: () => {}, printErr: () => {} });
  const init = M.cwrap("giac_init", "string", []);
  init();
  setPowLimit = M.cwrap("giac_set_pow_limit", "number", ["number"]);
  return M.cwrap("giac_eval", "string", ["string"]);
}

// Parisse's giacwasm.js (spike shortcut only): a classic script that expects a global-ish Module.
async function loadPrebuilt(baseUrl: string): Promise<(s: string) => string> {
  const src = await (await fetch(`${baseUrl}engine/prebuilt/giacwasm.js`)).text();
  return new Promise((resolve, reject) => {
    const Module: Record<string, unknown> = {
      print: () => {},
      printErr: () => {},
      onAbort: (e: unknown) => reject(new Error(String(e))),
    };
    Module.onRuntimeInitialized = () => {
      const m = Module as unknown as GiacModule;
      resolve(m.cwrap("caseval", "string", ["string"]));
    };
    new Function("Module", src)(Module);
  });
}

function evaluate(input: string): { output: string; ok: boolean; engineMs: number } {
  if (!giacEval) throw new Error("engine not ready");
  const t0 = performance.now();
  const output = giacEval(input);
  return { output, ok: !output.startsWith("GIAC_ERROR"), engineMs: performance.now() - t0 };
}

self.onmessage = async (ev: MessageEvent<Request>) => {
  const req = ev.data;
  try {
    switch (req.type) {
      case "init": {
        const t0 = performance.now();
        giacEval = req.engine === "source" ? await loadSource(req.baseUrl) : await loadPrebuilt(req.baseUrl);
        const t1 = performance.now();
        giacEval("0");
        const t2 = performance.now();
        for (const line of req.replay) giacEval(line);
        const t3 = performance.now();
        post({ id: req.id, type: "ready", instantiateMs: t1 - t0, initMs: t2 - t1, replayMs: t3 - t2 });
        break;
      }
      case "eval":
        post({ id: req.id, type: "result", ...evaluate(req.input) });
        break;
      case "home":
        post({ id: req.id, type: "home", result: home(req.input, req.settings) });
        break;
      case "latex": {
        // latex() returns a Giac string; its printed form is wrapped in quotes.
        const r = evaluate(`latex(${req.input})`);
        if (r.ok && r.output.length >= 2 && r.output.startsWith('"') && r.output.endsWith('"')) {
          r.output = r.output.slice(1, -1);
        }
        post({ id: req.id, type: "result", ...r });
        break;
      }
    }
  } catch (e) {
    post({ id: req.id, type: "fatal", message: e instanceof Error ? e.message : String(e) });
  }
};
