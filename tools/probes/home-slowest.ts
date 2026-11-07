// SPDX-License-Identifier: GPL-3.0-or-later
// Probe (G185): the wall time of every Home Enter of tests/golden/home.yaml, precision.yaml (its Home cases; CAS has no limit)
// and the core list's Home inputs (CORE below, written by hand from tests/core/core.yaml's keys), through the engine host as the
// app calls it. Only the last Enter of a case is timed (its `before` lines and the steps before it are not). The slowest Enter
// that finishes sets the client's watchdog: HOME_WATCHDOG_MS = max(4 s, 8 × it) (the Tab One is 5-8× slower, homeEval.ts).
// A round at a time, each under the host-cpu lock in a slice of at most 10 minutes (tools/devlock.sh slice), then the summary:
//   tools/devlock.sh slice probe node tools/probes/home-slowest.ts --round 1 <dir>    # one round → <dir>/round-1.json (5 rounds)
//   node tools/probes/home-slowest.ts --summary <dir>                                   # medians per case, the slowest, the limit
//   FAST=8 …                                       # the round on a clock 8× fast (golden-speed.ts): Giac's clock (HOME_CLOCK_S) and Home's
//                                                   # deadlines fire as on a device 8× slower, so 8 × the desktop time is that device's time
// Engine: $GIAC_MJS, else $GIAC_OUT/giac.mjs, else engine/giac/_out/gsl (app/src/engine/nodeGiac.ts).
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { EngineHost } from "../../app/src/engine/host.ts";
import { loadNodeGiac } from "../../app/src/engine/nodeGiac.ts";
import { defaultHomeSettings, pasdegCommand, type HomeResult } from "../../app/src/engine/homeEval.ts";
import { rewriteAngles } from "../../app/src/engine/angles.ts";
import { runHomeCase, runPrecisionCase, typed, type Case } from "../../app/src/goldenRun.ts";
import { withFastClock } from "../../app/scripts/golden-speed.ts";

/** The core list's Home inputs (tests/core/core.yaml, areas entry, home, trig, state, list), as the keys spell them in Giac text. */
const CORE: { id: string; input: string; angle?: "deg" }[] = [
  ["c01", "2+3"], ["c02", "5*2"], ["c03", "1/2+1/3"], ["c04", "1+2/3"], ["c05", "1/(1/4700+1/10000)"], ["c06", "1/2"],
  ["c07", "21*3"], ["c08", "(2+3)*4"], ["c11", "6.02e23*2"], ["c12", "2+3*4"], ["c13", "1/3"], ["c14", "0.1+0.2"],
  ["c15", "1-0.9-0.1"], ["c16", "2^64"], ["c17", "sqrt(2)"], ["c18", "-5*3"], ["c19a", "ln(10)"], ["c19b", "log10(1000)"],
  ["c20", "exp(2)"], ["c21", "(2+3*i)*(1-i)"], ["c22", "sin(pi/6)"], ["c23", "sin(1)"], ["c24", "sin(30)", "deg"],
  ["c25a", "tan(45)", "deg"], ["c25b", "asin(0.5)", "deg"], ["c26", "sin(pi)"], ["c27", "A+1"], ["c29", "p(3)"],
  ["int-asin-12^x", "int(asin(x)*12^x,x,0,1)"], ["one-over-zero", "1/0"], ["list-plus", "[1,4]+1"], ["list-sq", "L^2"],
  ["list-div", "2/L"], ["sigma", "sum(K^2,K,1,10)"], ["format", "99999.999999999"],
].map(([id, input, angle]) => ({ id: id!, input: input!, ...(angle ? { angle: angle as "deg" } : {}) }));
const CORE_BEFORE = ["A:=7", "p(x):=x^2", "L:=[1,4]"];

const root = new URL("../../", import.meta.url);
const { parse } = createRequire(new URL("app/package.json", root))("yaml") as { parse: (s: string) => unknown };
const casesOf = (file: string): Case[] => (parse(readFileSync(new URL(`tests/golden/${file}`, root), "utf8")) as { cases: Case[] }).cases.map(typed);

interface Timed {
  ms: number;
  ok: boolean;
  error?: string;
  display: string;
}

// Every host.home call is timed; a case's Enter is the last one it made.
// The real clock, kept before FAST speeds performance.now up.
const realNow = performance.now.bind(performance);
const fast = Number(process.env["FAST"] ?? 1);
let last: { ms: number; r: HomeResult } | null = null;
const home = EngineHost.prototype.home;
EngineHost.prototype.home = function (this: EngineHost, ...a: Parameters<typeof home>) {
  const t0 = realNow();
  const out = home.apply(this, a);
  last = { ms: realNow() - t0, r: out.result };
  return out;
};
const fresh = async (): Promise<EngineHost> => {
  const L = await loadNodeGiac();
  L.giac.eval(pasdegCommand("rad"));
  return new EngineHost(L.giac, L.bridge);
};
const timed = (): Timed => ({ ms: last!.ms, ok: last!.r.ok, ...(last!.r.error ? { error: last!.r.error } : {}), display: last!.r.display.slice(0, 60) });

async function round(): Promise<Record<string, Timed>> {
  const out: Record<string, Timed> = {};
  const hh = await fresh();
  for (const c of casesOf("home.yaml")) {
    last = null;
    await runHomeCase(c, hh, fresh);
    out[`home ${c.id}`] = timed();
  }
  const ph = await fresh();
  for (const c of casesOf("precision.yaml")) {
    if (c.kind === "cas") continue;
    last = null;
    await runPrecisionCase(c, ph, fresh);
    out[`precision ${c.id}`] = timed();
  }
  const ch = await fresh();
  for (const b of CORE_BEFORE) ch.home(b, defaultHomeSettings);
  for (const c of CORE) {
    ch.home(rewriteAngles(c.input), { ...defaultHomeSettings, angle: c.angle ?? "rad" });
    out[`core ${c.id}`] = timed();
  }
  return out;
}

const args = process.argv.slice(2);
if (args[0] === "--round") {
  const dir = resolve(args[2] ?? ".");
  mkdirSync(dir, { recursive: true });
  const t0 = performance.now();
  const r = fast > 1 ? await withFastClock(fast, round) : await round();
  writeFileSync(resolve(dir, `round-${args[1]}.json`), JSON.stringify(r));
  console.log(`round ${args[1]}${fast > 1 ? ` (clock ${fast}× fast)` : ""}: ${Object.keys(r).length} Enters in ${((performance.now() - t0) / 1000).toFixed(1)} s`);
} else if (args[0] === "--summary") {
  const dir = resolve(args[1] ?? ".");
  const rounds = readdirSync(dir).filter((f) => /^round-\d+\.json$/.test(f)).map((f) => JSON.parse(readFileSync(resolve(dir, f), "utf8")) as Record<string, Timed>);
  const med = (xs: number[]): number => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;
  const rows = Object.keys(rounds[0]!).map((id) => {
    const rs = rounds.map((r) => r[id]!).filter(Boolean);
    return { id, ms: med(rs.map((r) => r.ms)), max: Math.max(...rs.map((r) => r.ms)), ok: rs[0]!.ok, error: rs[0]!.error, display: rs[0]!.display };
  });
  rows.sort((a, b) => b.ms - a.ms);
  console.log(`${rounds.length} rounds, ${rows.length} Enters; median wall time per Enter, slowest first (max of the rounds in brackets)`);
  for (const r of rows.slice(0, 25)) console.log(`${r.ms.toFixed(0).padStart(6)} ms (${r.max.toFixed(0).padStart(5)})  ${r.ok ? "answer " : `refused ${r.error}`.padEnd(7)}  ${r.id}: ${r.display}`);
  const done = rows.filter((r) => r.error !== "timeout");
  const slowest = done[0]!;
  const limit = Math.max(4000, 8 * slowest.ms);
  console.log(`slowest Enter that finishes (not stopped by the time limit): ${slowest.ms.toFixed(0)} ms (${slowest.id}); × 8 = ${(8 * slowest.ms).toFixed(0)} ms; HOME_WATCHDOG_MS = max(4000, that) = ${limit.toFixed(0)} ms${limit > 10_000 ? " (ABOVE 10 s)" : ""}`);
} else {
  console.error("usage: home-slowest.ts --round <n> <dir> | --summary <dir>");
  process.exit(2);
}
