// SPDX-License-Identifier: GPL-3.0-or-later
// On-device Python timing for measurement builds only (VITE_MEASURE=1, started with ?bench=python; see main.ts).
// Measures: first open -> shell ready (python() + ready() + first shell line answered), Cancel on
// `while True: pass` -> ready again, and the calc.cas round trip (shell line -> Giac -> answer; the plain
// shell line `1+1` is measured too so the overhead can be subtracted).
// Output for tools/device_run.py page --wait bench-done: PASCALINE_BENCH python {json} lines in logcat.
import type { Calc } from "./calc/port.ts";
import { mark } from "./marks.ts";

const pct = (xs: number[], p: number): number => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)] ?? 0;
};
const r1 = (x: number): number => Math.round(x * 10) / 10;
const out = (o: object): void => console.log(`PASCALINE_BENCH python ${JSON.stringify(o)}`);
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export async function runPythonBench(calc: Calc, runs = 25): Promise<void> {
  await calc.ready();
  // 1. first open -> shell ready
  const t0 = performance.now();
  const py = await calc.python();
  const timings = await py.ready();
  const r0 = await py.shell("1+1");
  out({ id: "first-open-shell-ready", ms: r1(performance.now() - t0), loadMs: r1(timings.loadMs), readyMs: r1(timings.readyMs), ok: r0.ok });

  // 2. Cancel on an endless loop -> shell answers again
  const cancelMs: number[] = [];
  for (let i = 0; i < 5; i++) {
    const run = py.run("while True: pass").catch(() => undefined);
    await sleep(300);
    const t = performance.now();
    await py.cancel();
    await py.shell("1+1");
    cancelMs.push(performance.now() - t);
    await run;
  }
  out({ id: "cancel-to-ready", runs: cancelMs.length, p50: r1(pct(cancelMs, 50)), max: r1(Math.max(...cancelMs)), all: cancelMs.map(r1) });

  // 3. calc.cas round trip
  await py.shell("import calc");
  for (const c of [
    { id: "shell-baseline", line: "1+1" },
    { id: "calc-cas", line: 'calc.cas("factor(x^4-1)")' },
  ]) {
    const ms: number[] = [];
    let ok = true;
    for (let i = 0; i < runs; i++) {
      const t = performance.now();
      const r = await py.shell(c.line);
      ms.push(performance.now() - t);
      ok = ok && r.ok;
    }
    const rest = ms.slice(1);
    out({ id: c.id, runs, ok, firstMs: r1(ms[0] ?? 0), p50: r1(pct(rest, 50)), p95: r1(pct(rest, 95)), max: r1(Math.max(...rest)) });
  }
  mark("bench-done");
}
