// SPDX-License-Identifier: GPL-3.0-or-later
// On-device golden run for measurement builds only (VITE_MEASURE=1, started with ?bench=golden; see main.ts, A20):
// the Home and precision stages' cases on the engine build the app ships, inside the WebView, one round, in a worker
// (golden.worker.ts). Each case is a PASCALINE_BENCH golden line (compared with the desktop run by
// scripts/golden-compare.ts); then the environment line and the mark golden-done.
import { mark } from "./marks.ts";
import type { GoldenRecord } from "./goldenRun.ts";

export function runGoldenBench(): void {
  const t0 = performance.now();
  const w = new Worker(new URL("./golden.worker.ts", import.meta.url), { type: "module" });
  w.onerror = (e) => {
    console.log(`PASCALINE_BENCH golden-env ${JSON.stringify({ error: e.message })}`);
    mark("golden-done");
  };
  w.onmessage = (ev: MessageEvent<GoldenRecord[]>) => {
    for (const r of ev.data) console.log(`PASCALINE_BENCH golden ${JSON.stringify(r)}`);
    console.log(`PASCALINE_BENCH golden-env ${JSON.stringify({ n: ev.data.length, ms: Math.round(performance.now() - t0), ua: navigator.userAgent })}`);
    mark("golden-done");
  };
  w.postMessage(0);
}
