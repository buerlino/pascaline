// SPDX-License-Identifier: GPL-3.0-or-later
// Loads a Giac build in Node (tests and the golden runner). Never bundled into the app.
// Finds giac.mjs from $GIAC_MJS, then $GIAC_OUT/giac.mjs, then <repo>/engine/giac/_out/gsl/giac.mjs.
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { bridgeOf } from "./bridge.ts";
import { gated } from "./ctxGate.ts";
import type { Giac } from "./numeric.ts";
import { EngineHost, messageBuffer, setGiacHostGlobals, type GiacApi, type LoadedGiac } from "./host.ts";

interface GiacModule {
  cwrap(name: string, ret: string | null, args: string[]): (...a: (string | number)[]) => string & number;
}

export function giacMjsPath(): string {
  if (process.env.GIAC_MJS) return process.env.GIAC_MJS;
  if (process.env.GIAC_OUT) return `${process.env.GIAC_OUT}/giac.mjs`;
  return fileURLToPath(new URL("../../../engine/giac/_out/gsl/giac.mjs", import.meta.url));
}

export function giacAvailable(): boolean {
  return existsSync(giacMjsPath());
}

export async function loadNodeGiac(mjs: string = giacMjsPath()): Promise<LoadedGiac> {
  setGiacHostGlobals();
  const t0 = performance.now();
  const { default: create } = (await import(pathToFileURL(mjs).href)) as { default: (o: object) => Promise<GiacModule> };
  const out = messageBuffer();
  const M = await create({ print: out.print, printErr: () => {} });
  M.cwrap("giac_init", "number", [])();
  const ev = M.cwrap("giac_eval", "string", ["string"]);
  const pow = M.cwrap("giac_set_pow_limit", "number", ["number"]);
  const giac: GiacApi = { eval: (s) => ev(s), setPowLimit: (n) => pow(n), messages: out.messages, clearMessages: out.clear };
  // G99: the host needs the bridge; bridgeOf throws NO_BRIDGE on an engine without its exports.
  return { giac, bridge: bridgeOf(M), instantiateMs: performance.now() - t0 };
}

/** An engine host on a freshly loaded Giac (tests, the golden runner, probes). */
export async function nodeHost(mjs: string = giacMjsPath()): Promise<EngineHost> {
  const L = await loadNodeGiac(mjs);
  return new EngineHost(L.giac, L.bridge);
}

/** G103: the engine functions' Giac (numeric.ts) on a loaded one: eval, and bridge-3's value and bridge-2's parse, as
 *  the host gives them (ctxGate.ts). */
export type EngineGiac = Giac & LoadedGiac["giac"];

export function engineGiac(L: LoadedGiac): EngineGiac {
  return gated(L.giac, L.bridge).giac;
}
