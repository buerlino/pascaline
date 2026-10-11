// SPDX-License-Identifier: GPL-3.0-or-later
// On-device Solve timing for measurement builds only (VITE_MEASURE=1, started with ?bench=solve; see main.ts).
// Times Calc.solve (Enter -> result delivered, then the next two animation frames) for the 1-D case and the 2x2 system.
// Output for spike/tools/device_run.py page --wait bench-done: PASCALINE_BENCH solve {json} lines in logcat.
import type { Calc } from "./calc/port.ts";
import { mark } from "./marks.ts";

const frame = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
const pct = (xs: number[], p: number): number => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)] ?? 0;
};
const r1 = (x: number): number => Math.round(x * 10) / 10;

export async function runSolveBench(calc: Calc, runs = 25): Promise<void> {
  await calc.ready();
  const s = { digits: 12, angle: "rad", format: "std" } as const;
  const cases = [
    { id: "solve-1d", req: { kind: "equations", equations: ["X*exp(X)=5"], unknowns: ["X"], guesses: ["1"] } },
    { id: "solve-2x2", req: { kind: "equations", equations: ["X^2+Y^2=4", "Y=exp(X)"], unknowns: ["X", "Y"], guesses: ["-1", "1"] } },
  ];
  for (const c of cases) {
    const ms: number[] = [];
    let shown = "";
    for (let i = 0; i < runs; i++) {
      const t0 = performance.now();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const out = await calc.solve(c.req as any, s as any);
      await frame();
      ms.push(performance.now() - t0);
      shown = JSON.stringify(out).slice(0, 200);
    }
    const first = ms[0] ?? 0;
    const rest = ms.slice(1);
    console.log(
      `PASCALINE_BENCH solve ${JSON.stringify({ id: c.id, runs, firstMs: r1(first), p50: r1(pct(rest, 50)), p95: r1(pct(rest, 95)), max: r1(Math.max(...rest)), all: ms.map(r1), sample: shown })}`,
    );
  }
  mark("bench-done");
}
