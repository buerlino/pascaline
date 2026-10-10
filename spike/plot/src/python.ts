// SPDX-License-Identifier: GPL-3.0-or-later
// MicroPython-wasm start time on the device. Files are copied to public/mpy/ by scripts/copy-python.mjs.
import { mark } from "./marks";

const out = document.getElementById("out") as HTMLElement;
mark("py-js-start");
const t0 = performance.now();
const mod = (await import(/* @vite-ignore */ new URL("./mpy/micropython.mjs", location.href).href)) as {
  loadMicroPython: (o: { stdout: (s: string) => void; stderr: (s: string) => void }) => Promise<{ runPython: (c: string) => unknown }>;
};
const t1 = performance.now();
const mp = await mod.loadMicroPython({ stdout: (s) => (out.textContent += s + "\n"), stderr: (s) => (out.textContent += s + "\n") });
const t2 = performance.now();
mp.runPython("print(sum(i*i for i in range(1000)))");
const t3 = performance.now();
mark("py-ready", { importMs: t1 - t0, loadMs: t2 - t1, firstRunMs: t3 - t2, totalMs: t3 - t0 });
out.textContent += `micropython import ${(t1 - t0).toFixed(0)} ms, load ${(t2 - t1).toFixed(0)} ms, first run ${(t3 - t2).toFixed(0)} ms\n`;
