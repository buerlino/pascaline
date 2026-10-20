// SPDX-License-Identifier: GPL-3.0-or-later
// Web Worker for ?bench=golden (A20; goldenBench.ts starts it): the Home and precision cases on the engine build the
// app ships, one round. Its own worker bundle keeps these modules out of the start chunk.
import homeRaw from "../../tests/golden/home.yaml";
import precisionRaw from "../../tests/golden/precision.yaml";
import { pasdegCommand } from "./engine/homeEval.ts";
import { messageBuffer, setGiacHostGlobals, type GiacApi } from "./engine/host.ts";
import { goldenRecords, typed, type Case } from "./goldenRun.ts";

interface GiacModule {
  cwrap(name: string, ret: "string" | "number", args: string[]): (...a: (string | number)[]) => string & number;
}

let pageBase = "";

async function freshGiac(): Promise<GiacApi> {
  setGiacHostGlobals();
  // The same file the engine worker loads; absolute URL as there.
  const url = new URL(`${import.meta.env.BASE_URL}engine/giac.mjs`, pageBase).href;
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

self.onmessage = (ev: MessageEvent<string>) => {
  pageBase = ev.data; // the page's URL: BASE_URL is relative to it, not to this worker file
  void (async () => {
    const cases = (raw: unknown): Case[] => (raw as { cases: Case[] }).cases.map(typed);
    let n = 0;
    const post = (m: unknown): void => (self as unknown as Worker).postMessage(m);
    post({ progress: "start" });
    const recs = await goldenRecords(cases(homeRaw), cases(precisionRaw), freshGiac, (stage, id) => {
      if (n++ % 25 === 0) post({ progress: `${stage} ${id} #${n}` });
    });
    post(recs);
  })().catch((e: unknown) => (self as unknown as Worker).postMessage({ progress: `error ${String(e)}` }));
};
