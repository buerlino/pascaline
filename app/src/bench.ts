// SPDX-License-Identifier: GPL-3.0-or-later
// On-device benchmark for measurement builds only (VITE_MEASURE=1, started with ?bench=1; see main.ts).
// Every case of tests/golden/bench.yaml goes through the real app path (Session.submit -> engine -> history item
// -> rendered result). The inputs are Giac text, not LaTeX typed on our keyboard (most of them, e.g. matrices
// and factor(), have no key yet), so the parser step is skipped; evaluation, tidy-up and drawing are the real ones.
// Output for tools/device_run.py: PASCALINE_BENCH case|summary lines in logcat, then the mark bench-done.
import raw from "../../tests/golden/bench.yaml";
import type { Session, HistoryItem } from "./state/session.svelte.ts";
import { mark } from "./marks.ts";

interface Case { id: string; input: string; expect?: string }
const r1 = (x: number): number => Math.round(x * 10) / 10;
const pct = (xs: number[], p: number): number => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)] ?? 0;
};
const frame = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** Enter -> result drawn, in ms; the item is the history entry it created. */
async function enter(session: Session, giac: string): Promise<{ ms: number; item: HistoryItem }> {
  const t0 = performance.now();
  const p = session.submit(giac, giac);
  if (!p) throw new Error("submit refused (engine busy?)");
  await p;
  await frame();
  const ms = performance.now() - t0;
  return { ms, item: session.cas[session.cas.length - 1] as HistoryItem };
}

/**
 * ?bench=defs: seed 200 definitions (150 values, 50 functions) into the persisted log, once. Then cold-start the app
 * (tools/device_run.py start): the engine-timings mark reports replayMs for them (docs/04 section 6.2, bar 50 ms).
 */
export async function runDefsBench(session: Session): Promise<void> {
  while (session.engineState === "starting") await sleep(20);
  session.setView("cas");
  for (let i = 1; i <= 150; i++) await enter(session, `dv${i}:=${i}/7+${i}`);
  for (let i = 1; i <= 50; i++) await enter(session, `df${i}(x):=x^2+${i}*x+sin(${i})`);
  await sleep(2000); // the log is saved to IndexedDB a moment after the last change
  mark("defs-seeded");
}

export async function runBench(session: Session): Promise<void> {
  const doc = raw as { cases: Case[] };
  while (session.engineState === "starting") await sleep(20);
  // History is persisted: start every run from an empty one so the runs are comparable.
  // ?bench=1&keep=1 keeps the persisted history (run twice to seed a full 200-entry history).
  if (!new URLSearchParams(location.search).has("keep")) {
    session.setView("home");
    session.clearHistory();
    session.setView("cas");
    session.clearHistory();
  }
  // ?bench=1&digits=N (1–30; docs/04 section 2.5): the digits setting for this run, set directly so a measurement
  // build can time 20 and 30 digits before Settings allows them. Not persisted.
  const digits = Number(new URLSearchParams(location.search).get("digits"));
  if (Number.isInteger(digits) && digits >= 1 && digits <= 30) session.settings.digits = digits;
  session.setView("cas");
  const first: number[] = [];
  const errors: string[] = [];
  const mismatches: string[] = [];
  for (const c of doc.cases) {
    const a = await enter(session, c.input);
    const b = await enter(session, c.input);
    first.push(a.ms);
    if (a.item.status !== "done") errors.push(c.id);
    console.log(`PASCALINE_BENCH case ${JSON.stringify({ id: c.id, ok: a.item.status === "done", firstMs: r1(a.ms), rtMs: r1(a.ms), warmMs: r1(b.ms) })}`);
  }
  // Cancel: a long CAS job, cancelled after 300 ms; history and the variable must survive.
  const cancels: number[] = [];
  let after = "";
  for (let i = 0; i < 5; i++) {
    await enter(session, "pasvar:=7");
    const long = session.submit("long", "ifactor(nextprime(10^45)*nextprime(10^46))");
    await sleep(300);
    const t0 = performance.now();
    await session.cancel();
    await long;
    await frame();
    cancels.push(performance.now() - t0);
    const r = await enter(session, "pasvar*6");
    after = r.item.text;
  }
  const histOk = session.cas.some((i) => i.status === "cancelled") && session.cas.some((i) => i.status === "done");
  const summary = {
    n: doc.cases.length,
    digits: session.settings.digits,
    firstP50: r1(pct(first, 50)), firstP95: r1(pct(first, 95)), firstMax: r1(Math.max(...first)),
    cancelToReadyMs: r1(pct(cancels, 50)), cancelAll: cancels.map(r1), varAfterReplay: after, historyIntact: histOk,
    errors, mismatches,
  };
  console.log(`PASCALINE_BENCH summary ${JSON.stringify(summary)}`);
  mark("bench-done");
}
