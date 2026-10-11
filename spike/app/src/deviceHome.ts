// SPDX-License-Identifier: GPL-3.0-or-later
// On-device run of spike/home/cases.yaml (Q3): every case once per app launch through MathEngine.home,
// in the Giac worker. One JSON line per case plus a summary on the console (logcat, prefix
// PASCALINE_HOME); spike/home/device_summary.py turns several launches into medians.
import type { MathEngine } from "./engine/types";
import { defaultHomeSettings } from "./home/homeEval";
import { mark } from "./marks";

interface Case { id: string; input: string; expect?: string; angle?: "rad" | "deg" }
const r1 = (x: number) => Math.round(x * 10) / 10;

export async function runDeviceHome(engine: MathEngine, say: (s: string) => void): Promise<void> {
  const cases = (await (await fetch("/home-cases.json")).json()) as Case[];
  let pass = 0;
  let maxMs = 0;
  const fails: string[] = [];
  for (const c of cases) {
    const settings = { ...defaultHomeSettings, angle: c.angle ?? "rad" };
    const t0 = performance.now();
    const r = await engine.home(c.input, settings);
    const rtMs = performance.now() - t0;
    const ok = r.ok && r.display === c.expect;
    if (ok) pass++;
    else fails.push(`${c.id}: ${r.display.slice(0, 40)} (expect ${c.expect})`);
    maxMs = Math.max(maxMs, r.totalMs);
    console.log(`PASCALINE_HOME case ${JSON.stringify({ id: c.id, ok, path: r.path, totalMs: r1(r.totalMs), exactMs: r1(r.exactMs), rtMs: r1(rtMs), display: r.display.slice(0, 60) })}`);
  }
  console.log(`PASCALINE_HOME summary ${JSON.stringify({ n: cases.length, pass, maxMs: r1(maxMs), fails })}`);
  mark("home-done");
  say(`home done: ${pass}/${cases.length}, max ${r1(maxMs)} ms`);
}
