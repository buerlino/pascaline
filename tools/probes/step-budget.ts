// SPDX-License-Identifier: GPL-3.0-or-later
// Probe (G82, A20): how many of Giac's interrupt checks (patch 0004, `ckcount`) each Giac call of a Home Enter uses, on
// today's clock budget (`timeout 0.3`, no step budget). Runs A20's inputs and every single-input Home case of
// tests/golden/home.yaml and precision.yaml (RAD) twice, each time on a fresh engine, and prints per input: the calls, the largest count of a call
// that finished, and the count and time of a call the 300 ms clock interrupted. Then: the slowest finished call (the
// count Home's step budget must allow, with a margin), the counts the clock stopped at (what 300 ms is on this machine),
// and whether both runs gave the same counts.
//   GIAC_OUT=<dir> node tools/probes/step-budget.ts          # MARGIN=1.5 (default)
//   GIAC_OUT=<dir> node tools/probes/step-budget.ts 'sum(1/k,k,1,30000)'   # other inputs
//   BUDGET=home GIAC_OUT=<dir> node tools/probes/step-budget.ts '<input>'  # under Home's own limits (budgetSteps and
//   HOME_CLOCK_S): which of the two stopped each interrupted call ("steps" at budgetSteps checks, else "clock"), and the
//   slowest finished call by time (HOME_CLOCK_S must let it finish on a device 8× slower)
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { EngineHost } from "../../app/src/engine/host.ts";
import { loadNodeGiac } from "../../app/src/engine/nodeGiac.ts";
import { defaultHomeSettings, HOME_CLOCK_S, pasdegCommand, type HomeSettings } from "../../app/src/engine/homeEval.ts";
import { rewriteAngles } from "../../app/src/input/angles.ts";

interface Input {
  input: string;
  digits: number;
}
const A20: Input[] = [
  ["sum(1.1^k,k,1,500)", 12], ["int(sin(x)/x,x,0,1)", 12], ["int(tan(x)+x,x,2,5)", 12], ["normald_icdf(10^-30)", 12],
  ["asin(0.5)", 12], ["normald_icdf(10^-10)", 12], ["normald_icdf(10^-10)", 30], ["normald_icdf(1-10^-12)", 12],
  ["normald_icdf(1-10^-12)", 30], ["chisquare_icdf(3,0.95)", 12], ["chisquare_icdf(3,0.95)", 30], ["fisher_icdf(3,4,1-10^-20)", 12],
  ["fisher_icdf(3,4,1-10^-20)", 30], ["chisquare_icdf(3,1-10^-30)", 12], ["chisquare_icdf(3,1-10^-30)", 30],
  ["chisquare_icdf(3,0.9)", 12], ["chisquare_icdf(1,0.95)", 12], ["student_icdf(5,0.975)", 30],
].map(([input, digits]) => ({ input: input as string, digits: digits as number }));

const root = new URL("../../", import.meta.url);
const { parse } = createRequire(new URL("app/package.json", root))("yaml") as { parse: (s: string) => unknown };
type Case = { input?: string; kind?: string; before?: string[]; settings?: { digits?: number; angle?: string } };
const singles = (file: string): Input[] =>
  (parse(readFileSync(new URL(`tests/golden/${file}`, root), "utf8")) as { cases: Case[] }).cases
    .filter((c) => c.input !== undefined && c.kind === undefined && c.before === undefined && (c.settings?.angle ?? "rad") === "rad")
    .map((c) => ({ input: c.input!, digits: c.settings?.digits ?? 12 }));
const inputs: Input[] = process.argv.length > 2 ? process.argv.slice(2).map((input) => ({ input, digits: 12 })) : [...A20, ...singles("home.yaml"), ...singles("precision.yaml")];
const margin = Number(process.env.MARGIN ?? 1.5);
const homeLimits = process.env.BUDGET === "home";

interface Call {
  count: number;
  ms: number;
  interrupted: boolean;
}
interface Row {
  input: string;
  digits: number;
  calls: Call[];
}

async function run(): Promise<Row[]> {
  const { giac, bridge } = await loadNodeGiac();
  const evalOnce = giac.eval.bind(giac);
  let calls: Call[] = [];
  let probing = false;
  const after = (t0: number, interrupted: boolean): void => {
    if (probing) return;
    calls.push({ count: Number(evalOnce("ckcount")), ms: performance.now() - t0, interrupted });
  };
  giac.eval = (text: string) => {
    const t0 = performance.now();
    const out = evalOnce(text);
    after(t0, /interrupt/i.test(out));
    return out;
  };
  const value = bridge.value.bind(bridge);
  bridge.value = ((...a: Parameters<typeof value>) => {
    const t0 = performance.now();
    const v = value(...a);
    after(t0, /interrupt/i.test(v.text));
    return v;
  }) as typeof value;
  giac.eval(pasdegCommand("rad"));
  const host = new EngineHost(giac, bridge);
  const rows: Row[] = [];
  for (const { input, digits } of inputs) {
    // Today's budget: the step budget off (a count no input reaches), the clock at 300 ms, set after the mode setup.
    // BUDGET=home: Home's own limits as they are.
    const s: HomeSettings = { ...defaultHomeSettings, digits, workDigits: Math.max(30, digits + 10), ...(homeLimits ? {} : { budgetSteps: 1e14 }) };
    probing = true;
    host.home("0", s);
    if (!homeLimits) evalOnce("timeout 0.3");
    probing = false;
    calls = [];
    host.home(rewriteAngles(input), s);
    rows.push({ input, digits, calls });
  }
  return rows;
}

const first = await run();
const second = await run();
let same = true;
let slowest: { row: Row; call: Call } | null = null;
const finished: { row: Row; call: Call }[] = [];
const stopped: { row: Row; call: Call }[] = [];
for (let i = 0; i < first.length; i++) {
  const a = first[i]!;
  const b = second[i]!;
  const sameCounts = a.calls.length === b.calls.length && a.calls.every((c, k) => c.count === b.calls[k]!.count || c.interrupted || b.calls[k]!.interrupted);
  if (!sameCounts) same = false;
  const done = a.calls.filter((c) => !c.interrupted);
  const top = done.reduce<Call | null>((m, c) => (m && m.count >= c.count ? m : c), null);
  if (top && (!slowest || top.count > slowest.call.count)) slowest = { row: a, call: top };
  // By time: the slower of the two runs' times of a finished call.
  for (let k = 0; k < a.calls.length; k++) {
    const c = a.calls[k]!;
    const d = b.calls[k];
    if (c.interrupted || !d || d.interrupted) continue;
    finished.push({ row: a, call: { ...c, ms: Math.max(c.ms, d.ms) } });
  }
  const cut = a.calls.filter((c) => c.interrupted);
  for (const c of cut) stopped.push({ row: a, call: c });
  console.log(
    `${`${a.input} @${a.digits}`.slice(0, 44).padEnd(44)} calls ${String(a.calls.length).padStart(3)}  largest done ${String(top?.count ?? 0).padStart(9)} (${(top?.ms ?? 0).toFixed(1)} ms)` +
      `${cut.length ? `  ${homeLimits ? "stopped" : "clock stopped"} ${cut.map((c) => `${c.count} @ ${c.ms.toFixed(0)} ms${homeLimits ? ` (${c.count >= defaultHomeSettings.budgetSteps ? "steps" : `clock ${HOME_CLOCK_S} s`})` : ""}`).join(", ")}` : ""}${sameCounts ? "" : "  COUNTS DIFFER between runs"}`,
  );
}
console.log(`\n${first.length} inputs, two runs: ${same ? "the same counts in both (calls the clock stopped excepted)" : "COUNTS DIFFER"}`);
if (slowest) console.log(`slowest finished call: ${slowest.call.count} checks in ${slowest.call.ms.toFixed(1)} ms (${slowest.row.input} @${slowest.row.digits})`);
finished.sort((x, y) => y.call.ms - x.call.ms);
for (const [k, f] of finished.slice(0, 5).entries()) {
  const at8 = (f.call.ms * 8) / 1000;
  console.log(
    `${k ? "  next" : "slowest finished call by time"}: ${f.call.ms.toFixed(1)} ms, ${f.call.count} checks (${f.row.input} @${f.row.digits}); × 8 = ${at8.toFixed(2)} s` +
      (homeLimits ? ` against HOME_CLOCK_S ${HOME_CLOCK_S} s: ${at8 <= HOME_CLOCK_S ? "covered" : "NOT COVERED"}` : ""),
  );
}
const rates = stopped.map((s) => s.call.count).sort((x, y) => x - y);
if (rates.length) console.log(`${homeLimits ? "Home's limits" : "the 300 ms clock"} stopped ${rates.length} calls at ${rates[0]} … ${rates.at(-1)} checks (median ${rates[Math.floor(rates.length / 2)]})`);
if (slowest) console.log(`step budget (slowest finished call × ${margin}): ${Math.ceil((slowest.call.count * margin) / 1000) * 1000}`);
