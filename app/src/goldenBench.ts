// SPDX-License-Identifier: GPL-3.0-or-later
// On-device golden run for measurement builds only (VITE_MEASURE=1, started with ?bench=golden; see main.ts, A20):
// the Home and precision stages' cases on the engine build the app ships, inside the WebView, one round. Each
// case is a PASCALINE_BENCH golden line (compared with the desktop run by scripts/golden-compare.ts); then the
// environment line and the mark golden-done.
import homeRaw from "../../tests/golden/home.yaml";
import precisionRaw from "../../tests/golden/precision.yaml";
import { pasdegCommand } from "./engine/homeEval.ts";
import { messageBuffer, setGiacHostGlobals, type GiacApi } from "./engine/host.ts";
import { goldenRecords, typed, type Case } from "./goldenRun.ts";
import { mark } from "./marks.ts";

interface GiacModule {
  cwrap(name: string, ret: "string" | "number", args: string[]): (...a: (string | number)[]) => string & number;
}

async function freshGiac(): Promise<GiacApi> {
  setGiacHostGlobals();
  // The same file the engine worker loads; absolute URL as there.
  const url = new URL(`${import.meta.env.BASE_URL}engine/giac.mjs`, location.href).href;
  const mod = (await import(/* @vite-ignore */ url)) as { default: (o: object) => Promise<GiacModule> };
  const out = messageBuffer();
  const M = await mod.default({ print: out.print, printErr: () => {} });
  M.cwrap("giac_init", "number", [])();
  const ev = M.cwrap("giac_eval", "string", ["string"]);
  const pow = M.cwrap("giac_set_pow_limit", "number", ["number"]);
  const giac: GiacApi = { eval: (s) => ev(s), setPowLimit: (n) => pow(n), messages: out.messages, clearMessages: out.clear };
  giac.eval(pasdegCommand("rad"));
  return giac;
}

export async function runGoldenBench(): Promise<void> {
  const cases = (raw: unknown): Case[] => (raw as { cases: Case[] }).cases.map(typed);
  const t0 = performance.now();
  const recs = await goldenRecords(cases(homeRaw), cases(precisionRaw), freshGiac, () => new Promise((r) => setTimeout(r, 0)));
  for (const r of recs) console.log(`PASCALINE_BENCH golden ${JSON.stringify(r)}`);
  console.log(`PASCALINE_BENCH golden-env ${JSON.stringify({ n: recs.length, ms: Math.round(performance.now() - t0), ua: navigator.userAgent })}`);
  mark("golden-done");
}
