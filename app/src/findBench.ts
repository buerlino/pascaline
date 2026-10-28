// SPDX-License-Identifier: GPL-3.0-or-later
// On-device Find timing for measurement builds only (VITE_MEASURE=1, started with ?bench=find; see main.ts; docs/04
// 3.2): the first 50 active phrases of tests/tasks/find-queries.yaml typed into Find one character at a time, timing
// each key until the list has been drawn (two animation frames). Gate: p95 ≤ 16 ms on the Tab One (annabell).
// Output for tools/device_run.py page --wait bench-done: one PASCALINE_BENCH find {json} line in logcat.
import doc from "../../tests/tasks/find-queries.yaml";
import type { AppShell } from "./apps/shell.svelte.ts";
import type { EntryController } from "./entry/controller.ts";
import { mark } from "./marks.ts";

const frames = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
const r1 = (x: number): number => Math.round(x * 10) / 10;
const pct = (xs: number[], p: number): number => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1))] ?? 0;
};

export async function runFindBench(shell: AppShell, entry: EntryController): Promise<void> {
  const queries = (doc as { queries: { query: string; status?: string }[] }).queries.filter((q) => q.status !== "pending").slice(0, 50);
  await entry.ready;
  const ms: number[] = [];
  let open = 0;
  for (const q of queries) {
    const t0 = performance.now();
    entry.onKey("math", "primary");
    while (shell.sheet?.id !== "find") await new Promise((r) => setTimeout(r, 5));
    await frames();
    open = Math.max(open, performance.now() - t0);
    for (const ch of q.query) {
      const t = performance.now();
      shell.sheet?.level.type(ch);
      await frames();
      ms.push(performance.now() - t);
    }
    shell.closeSheet();
    await frames();
  }
  console.log(`PASCALINE_BENCH find ${JSON.stringify({ queries: queries.length, keys: ms.length, p50: r1(pct(ms, 50)), p95: r1(pct(ms, 95)), max: r1(Math.max(...ms)), firstOpenMaxMs: r1(open) })}`);
  mark("bench-done");
}
