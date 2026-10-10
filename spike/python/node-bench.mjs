// SPDX-License-Identifier: GPL-3.0-or-later
// MicroPython-wasm start time + calc.cas() bridge to a Giac worker, in Node.
// usage: node node-bench.mjs [runs]   (GIAC_OUT defaults to engine/giac/_out/gsl)
import { Worker } from "node:worker_threads";
import { pathToFileURL, fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const runs = Number(process.argv[2] ?? 7);
const mpDir = path.join(here, "_out", process.env.VARIANT ?? "standard");
const { loadMicroPython } = await import(pathToFileURL(path.join(mpDir, "micropython.mjs")).href);
const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];

const startTimes = [];
for (let i = 0; i < runs + 1; i++) { // first run warms the file cache and is dropped
  const t0 = performance.now();
  const mp = await loadMicroPython({ stdout: () => {}, stderr: () => {} });
  mp.runPython("1+1");
  const dt = performance.now() - t0;
  if (i > 0) startTimes.push(dt);
}
console.log(`MicroPython start (load + first runPython), n=${runs}: median ${median(startTimes).toFixed(1)} ms, min ${Math.min(...startTimes).toFixed(1)}, max ${Math.max(...startTimes).toFixed(1)}`);

// calc bridge: Python -> JS promise -> message to Giac worker -> back
const giacOut = process.env.GIAC_OUT ?? path.join(here, "../../engine/giac/_out/gsl");
const worker = new Worker(path.join(here, "giac-worker-node.mjs"), {
  workerData: { giacMjs: pathToFileURL(path.join(giacOut, "giac.mjs")).href },
});
await new Promise((res) => worker.once("message", res));
let nextId = 1;
const pending = new Map();
worker.on("message", ({ id, result }) => { pending.get(id)?.(result); pending.delete(id); });
const cas = (expr) => new Promise((res) => { const id = nextId++; pending.set(id, res); worker.postMessage({ id, expr }); });

const mp = await loadMicroPython({ stdout: (s) => console.log("py>", s), stderr: (s) => console.log("py!", s) });
mp.registerJsModule("calc", { cas });
const lat = [];
for (let i = 0; i < 7; i++) {
  const t = performance.now();
  await mp.runPythonAsync(`
import calc
r = await calc.cas("factor(x^2-1)")
if ${i} == 0: print("factor(x^2-1) ->", r)
`);
  lat.push(performance.now() - t);
}
console.log(`python -> calc.cas('factor(x^2-1)') round trip, n=7: median ${median(lat).toFixed(2)} ms`);
await mp.runPythonAsync(`
import calc
for e in ["solve(x^2=2,x)", "int(sin(x)^2,x)", "2^100"]:
    print(e, "->", await calc.cas(e))
`);
await worker.terminate();
