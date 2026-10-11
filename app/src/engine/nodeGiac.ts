// SPDX-License-Identifier: GPL-3.0-or-later
// Loads a Giac build in Node (tests and the golden runner). Never bundled into the app.
// Finds giac.mjs from $GIAC_MJS, then $GIAC_OUT/giac.mjs, then <repo>/engine/giac/_out/gsl/giac.mjs.
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { messageBuffer, setGiacHostGlobals, type GiacApi, type LoadedGiac } from "./host.ts";

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
  return { giac, instantiateMs: performance.now() - t0 };
}
