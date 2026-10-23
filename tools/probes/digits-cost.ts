// SPDX-License-Identifier: GPL-3.0-or-later
// Probe: the tests/golden/home.yaml inputs at several digits settings through the engine host (desktop timing),
// and which cases change path or lose their number. Desktop numbers only; device numbers come from ?bench=1.
//   node tools/probes/digits-cost.ts            # digits 12, 20, 30
//   DIGITS_LIST=12,15 ROUNDS=5 node tools/probes/digits-cost.ts
//   CASES=/abs/path/home.yaml node tools/probes/digits-cost.ts   # another case file (the same inputs before and after a change)
// Cases typed as `latex` or as `steps` (no `input`) are skipped.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { EngineHost } from "../../app/src/engine/host.ts";
import { loadNodeGiac } from "../../app/src/engine/nodeGiac.ts";
import { defaultHomeSettings } from "../../app/src/engine/homeEval.ts";

const require = createRequire(new URL("../../app/package.json", import.meta.url));
const { parse } = require("yaml") as { parse: (s: string) => unknown };
const file = process.env.CASES ?? new URL("../../tests/golden/home.yaml", import.meta.url);
const all = (parse(readFileSync(file, "utf8")) as { cases: { id: string; input?: string; settings?: { angle?: "rad" | "deg" } }[] }).cases;
const cases = all.filter((c): c is { id: string; input: string; settings?: { angle?: "rad" | "deg" } } => c.input !== undefined);
const list = (process.env.DIGITS_LIST ?? "12,20,30").split(",").map(Number);
const rounds = Number(process.env.ROUNDS ?? 3);

const { giac, bridge } = await loadNodeGiac();
const host = new EngineHost(giac, bridge);
const base = new Map<string, string>();
for (const d of list) {
  const times: number[] = [];
  const changed: string[] = [];
  for (let round = 0; round < rounds; round++) {
    for (const c of cases) {
      const s = { ...defaultHomeSettings, digits: d, workDigits: Math.max(30, d + 10), angle: c.settings?.angle ?? "rad" };
      const t0 = performance.now();
      const r = host.home(c.input, s).result;
      const ms = performance.now() - t0;
      if (round !== rounds - 1) continue;
      times.push(ms);
      const key = r.path + (r.value ? "" : ":no-number");
      if (d === list[0]) base.set(c.id, key);
      else if (base.get(c.id) !== key) changed.push(`${c.id}: ${base.get(c.id)} -> ${key} (${r.display.slice(0, 40)})`);
    }
  }
  times.sort((a, b) => a - b);
  const q = (p: number): string => (times[Math.min(times.length - 1, Math.floor(times.length * p))] ?? 0).toFixed(2);
  console.log(`digits ${d}: n=${times.length} p50 ${q(0.5)} ms, p95 ${q(0.95)} ms, max ${(times.at(-1) ?? 0).toFixed(1)} ms`);
  for (const line of changed) console.log("   changed:", line);
}
