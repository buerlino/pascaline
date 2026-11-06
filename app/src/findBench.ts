// SPDX-License-Identifier: GPL-3.0-or-later
// On-device Find timing for measurement builds only (VITE_MEASURE=1, started with ?bench=find; see main.ts; docs/04
// 3.2): the first 50 active phrases of tests/tasks/find-queries.yaml typed into Find one character at a time, timing
// each key until the list has been drawn. Two figures: workMs (key → DOM updated and laid out: the main-thread cost the
// gate is about; syncP95 is the part inside type(): the search) and frameMs (key → two animation frames later; it cannot go below two frame intervals, so it only shows
// dropped frames). Gate: workMs p95 ≤ 16 ms on the Tab One (annabell).
// Output for tools/device_run.py page --wait bench-done: one N62_BENCH find {json} line in logcat.
import { tick } from "svelte";
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
  const work: number[] = [];
  const sync: number[] = [];
  let open = 0;
  for (const q of queries) {
    const t0 = performance.now();
    entry.onKey("math", "primary", false);
    while (shell.sheet?.id !== "find") await new Promise((r) => setTimeout(r, 5));
    await frames();
    open = Math.max(open, performance.now() - t0);
    for (const ch of q.query) {
      const t = performance.now();
      shell.sheet?.level.type(ch);
      sync.push(performance.now() - t); // the search and the state change; the rest of workMs is Svelte's DOM update and layout
      await tick();
      void document.body.offsetHeight; // force style and layout into the key's cost
      work.push(performance.now() - t);
      await frames();
      ms.push(performance.now() - t);
    }
    shell.closeSheet();
    await frames();
  }
  const frame = pct(ms, 50) / 2; // one frame interval, as the page ran
  const late = ms.filter((x) => x > 2.5 * frame).length; // keys that cost a frame more than the floor
  console.log(`N62_BENCH find ${JSON.stringify({ queries: queries.length, keys: work.length, workP50: r1(pct(work, 50)), workP95: r1(pct(work, 95)), workMax: r1(Math.max(...work)), syncP50: r1(pct(sync, 50)), syncP95: r1(pct(sync, 95)), frameMsP50: r1(pct(ms, 50)), frameMsP95: r1(pct(ms, 95)), lateKeys: late, firstOpenMaxMs: r1(open) })}`);
  mark("bench-done");
}
