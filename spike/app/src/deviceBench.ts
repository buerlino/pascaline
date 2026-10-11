// SPDX-License-Identifier: GPL-3.0-or-later
// On-device version of bench/engine.bench.ts: one session per app launch. Every case is run once
// "first" (what a user sees) and REPEATS more times "warm"; results go to the console as one JSON
// line per case plus a summary, which tools/device-run.sh collects from logcat.
import type { MathEngine } from "./engine/types";
import { EngineCancelled } from "./engine/types";
import { mark } from "./marks";

interface Case { id: string; cat: string; input: string; expect?: string }
const REPEATS = 3;
const r1 = (x: number) => Math.round(x * 10) / 10;
const pct = (xs: number[], p: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)]!;
};
const median = (xs: number[]) => pct(xs, 50);

export async function runDeviceBench(engine: MathEngine, say: (s: string) => void): Promise<void> {
  const cases = (await (await fetch("/cases.json")).json()) as Case[];
  await engine.setSettings({ digits: 12, angle: "rad" });
  const first: number[] = [], warm: number[] = [], rt: number[] = [];
  const errors: string[] = [], mismatches: string[] = [];
  for (const c of cases) {
    const t0 = performance.now();
    const r = await engine.eval(c.input);
    const firstRt = performance.now() - t0;
    const w: number[] = [];
    for (let i = 0; i < REPEATS; i++) w.push((await engine.eval(c.input)).engineMs);
    first.push(r.engineMs);
    rt.push(firstRt);
    warm.push(...w);
    if (!r.ok) errors.push(c.id);
    if (c.expect !== undefined && r.output !== c.expect) mismatches.push(`${c.id}: got ${r.output}`);
    console.log(`PASCALINE_BENCH case ${JSON.stringify({ id: c.id, ok: r.ok, firstMs: r1(r.engineMs), rtMs: r1(firstRt), warmMs: r1(median(w)), out: r.output.slice(0, 60) })}`);
  }
  // cancel: long job, cancel after 300 ms, restart, variable replayed
  const cancels: number[] = [];
  let after = "";
  for (let i = 0; i < 5; i++) {
    await engine.eval("pasvar:=7");
    const long = engine.eval("ifactor(nextprime(10^45)*nextprime(10^46))").then(() => "finished", (e: unknown) => (e instanceof EngineCancelled ? "cancelled" : String(e)));
    await new Promise((r) => setTimeout(r, 300));
    const t0 = performance.now();
    await engine.cancel();
    cancels.push(performance.now() - t0);
    after = (await engine.eval("pasvar*6")).output;
    void (await long);
  }
  const summary = {
    n: cases.length,
    firstP50: r1(pct(first, 50)), firstP95: r1(pct(first, 95)), firstMax: r1(Math.max(...first)),
    rtP50: r1(pct(rt, 50)), rtP95: r1(pct(rt, 95)),
    warmP50: r1(pct(warm, 50)), warmP95: r1(pct(warm, 95)),
    cancelToReadyMs: r1(median(cancels)), cancelAll: cancels.map(r1), varAfterReplay: after,
    errors, mismatches,
  };
  console.log(`PASCALINE_BENCH summary ${JSON.stringify(summary)}`);
  mark("bench-done");
  say(`bench done: first p50 ${summary.firstP50} ms, p95 ${summary.firstP95} ms, cancel→ready ${summary.cancelToReadyMs} ms`);
}
