// SPDX-License-Identifier: GPL-3.0-or-later
// G29: what the defs replay costs, and how much of it is per-call overhead. Replays the `?bench=defs` log (150 values,
// 50 functions; app/src/bench.ts) on the dev engine in Node, one eval per command as EngineHost.restore did, then
// the same commands in batches. Read-only. Needs the dev engine (GIAC_OUT or engine/giac/_out/gsl) and Node 22.
//   node tools/probes/replay-cost.mjs [runs=5]
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
const root = resolve(import.meta.dirname, "../..");
const { loadNodeGiac } = await import(pathToFileURL(`${root}/app/src/engine/nodeGiac.ts`).href);
const { replayOrder } = await import(pathToFileURL(`${root}/app/src/engine/defs.ts`).href);
const runs = Number(process.argv[2] ?? 5);

// What the app stores for those inputs: a value as `name:=(value)` (kind var), a function as typed (kind fn).
const mk = (name, kind, cmd) => ({ name, kind, cmds: [cmd], preview: "", view: "cas", time: 0 });
const log = [];
for (let i = 1; i <= 150; i++) log.push(mk(`dv${i}`, "var", `dv${i}:=(${i}/7+${i})`));
for (let i = 1; i <= 50; i++) log.push(mk(`df${i}`, "fn", `df${i}(x):=x^2+${i}*x+sin(${i})`));
const cmds = replayOrder(log).flatMap((e) => e.cmds);
const med = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const fresh = async () => { const L = await loadNodeGiac(); L.giac.eval("0"); return L; };

const per = { var: [], fn: [] };
const total = [], host = [], batchTotal = {}, noop = [];
for (let r = 0; r < runs; r++) {
  let g = (await fresh()).giac;
  let t0 = performance.now();
  const kinds = replayOrder(log);
  for (const e of kinds) { const t = performance.now(); g.clearMessages(); for (const c of e.cmds) g.eval(c); per[e.kind].push(performance.now() - t); }
  total.push(performance.now() - t0);
  g = (await fresh()).giac;
  t0 = performance.now(); for (let i = 0; i < 200; i++) g.eval("0"); noop.push(performance.now() - t0);
  for (const size of [10, 50, 200]) {
    g = (await fresh()).giac;
    t0 = performance.now();
    for (let i = 0; i < cmds.length; i += size) g.eval(cmds.slice(i, i + size).join(";") + ";");
    (batchTotal[size] ??= []).push(performance.now() - t0);
  }
}
let calls = 0;
{
  const { EngineHost } = await import(pathToFileURL(`${root}/app/src/engine/host.ts`).href);
  for (let r = 0; r < runs; r++) {
    const { giac: g, bridge } = await fresh();
    const h = new EngineHost({ ...g, eval: (s) => (calls++, g.eval(s)) }, bridge);
    calls = 0;
    host.push(h.restore(log));
  }
}
const f = (x) => x.toFixed(2);
console.log(`entries: ${log.length} (150 var, 50 fn); commands: ${cmds.length}; runs: ${runs}`);
console.log(`engine calls per replay, one eval per command: ${cmds.length}`);
console.log(`total p50: ${f(med(total))} ms`);
console.log(`per entry p50: var ${f(med(per.var))} ms, fn ${f(med(per.fn))} ms`);
console.log(`empty eval("0") x200 p50: ${f(med(noop))} ms  (${f(med(noop) / 200)} ms per call = overhead floor in Node; a worker round trip is extra)`);
console.log(`overhead share of the total (Node, per-eval floor): ${(100 * med(noop) / med(total)).toFixed(0)} %`);
for (const [s, v] of Object.entries(batchTotal)) console.log(`batches of ${s} (${Math.ceil(cmds.length / Number(s))} evals): p50 ${f(med(v))} ms`);
console.log(`EngineHost.restore (the app's replay): ${calls} engine calls per ${log.length} entries, p50 ${f(med(host))} ms`);
