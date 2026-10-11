// SPDX-License-Identifier: GPL-3.0-or-later
// The golden gate: every tests/golden/*.yaml file against one engine build. Run it on every engine
// build that ships (CLAUDE.md). Exit 0 only if every stage passes.
//   npm run golden                                  # engine: $GIAC_MJS, else $GIAC_OUT/giac.mjs, else engine/giac/_out/gsl
//   GIAC_MJS=/path/giac.mjs ROUNDS=5 npm run golden
//   ONLY=home,parser npm run golden                 # stages: interrupt, home, solve, bench, parser
// Stages:
//   interrupt  spike/node/interrupt-test.mjs (Giac patch 0002): 16 forced interrupts, no escapes
//   home       exact-first Home through EngineHost: every case matches, same in every round, median ≤ 500 ms
//   solve      Solve strategy (solve1.ts): every case matches in every round
//   bench      the 55 benchmark inputs in CAS mode: `expect` (derived) cases match; errors are listed
//   parser     LaTeX → Giac (our parser) equals the intended expression, decided by Giac; gaps never fail
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { EngineHost, type GiacApi } from "../src/engine/host.ts";
import { defaultHomeSettings, type HomeResult, type HomeSettings } from "../src/engine/homeEval.ts";
import { giacMjsPath, loadNodeGiac } from "../src/engine/nodeGiac.ts";
import { defaultSolveSettings, solve1, type SolveResult } from "../src/engine/solve1.ts";
import { defaultCasSettings } from "../src/engine/types.ts";
import { latexToGiac } from "../src/input/latex-to-giac.ts";

interface Case {
  id: string;
  input?: string;
  latex?: string;
  eq?: string;
  var?: string;
  guess?: string;
  settings?: { angle?: "rad" | "deg" };
  expect?: string;
  source?: string;
  g2?: number;
  status?: string;
}

const root = fileURLToPath(new URL("../../", import.meta.url));
const mjs = giacMjsPath();
const ROUNDS = Number(process.env.ROUNDS ?? 5);
const HOME_LIMIT_MS = 500;
const only = process.env.ONLY?.split(",").map((s) => s.trim());
const want = (stage: string) => !only || only.includes(stage);

function cases(file: string): Case[] {
  const doc = parse(readFileSync(`${root}tests/golden/${file}`, "utf8")) as { cases: Case[] };
  return doc.cases;
}

const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

async function freshGiac(): Promise<GiacApi> {
  return (await loadNodeGiac(mjs)).giac;
}

const summary: { stage: string; ok: boolean; line: string }[] = [];
function report(stage: string, ok: boolean, line: string): void {
  summary.push({ stage, ok, line });
  console.log(`${ok ? "PASS" : "FAIL"} ${stage}: ${line}`);
}

function stageInterrupt(): void {
  const r = spawnSync(process.execPath, [`${root}spike/node/interrupt-test.mjs`], {
    env: { ...process.env, GIAC_MJS: mjs },
    encoding: "utf8",
    timeout: 300_000,
  });
  const out = `${r.stdout}${r.stderr}`.trim();
  report("interrupt", r.status === 0, out.split("\n").slice(-3).join(" | "));
}

async function stageHome(): Promise<void> {
  const cs = cases("home.yaml");
  const runs = new Map<string, HomeResult[]>(cs.map((c) => [c.id, []]));
  for (let r = 0; r < ROUNDS; r++) {
    const host = new EngineHost(await freshGiac());
    for (const c of cs) {
      const s: HomeSettings = { ...defaultHomeSettings, angle: c.settings?.angle ?? "rad" };
      runs.get(c.id)!.push(host.home(c.input!, s).result);
    }
  }
  let pass = 0;
  let slow = 0;
  let maxMed = 0;
  let assumed = 0;
  for (const c of cs) {
    const rs = runs.get(c.id)!;
    const shown = rs[0]!.display;
    const ok = rs.every((x) => x.display === c.expect);
    const med = median(rs.map((x) => x.totalMs));
    maxMed = Math.max(maxMed, med);
    if (ok) pass++;
    else console.log(`  home ${c.id}: got ${rs.map((x) => x.display).join(" / ")}, expect ${c.expect}`);
    if (!(med <= HOME_LIMIT_MS)) {
      slow++;
      console.log(`  home ${c.id}: median ${med.toFixed(1)} ms > ${HOME_LIMIT_MS} ms (${shown})`);
    }
    if (c.source === "assumed") assumed++;
  }
  report(
    "home",
    pass === cs.length && slow === 0,
    `${pass}/${cs.length} match (${assumed} assumed), ${slow} over ${HOME_LIMIT_MS} ms, max median ${maxMed.toFixed(1)} ms, rounds ${ROUNDS}`,
  );
}

async function stageSolve(): Promise<void> {
  const cs = cases("solve.yaml");
  const runs = new Map<string, SolveResult[]>(cs.map((c) => [c.id, []]));
  for (let r = 0; r < ROUNDS; r++) {
    const g = await freshGiac();
    g.eval("timeout 2");
    g.eval("ckevery 10");
    for (const c of cs) runs.get(c.id)!.push(solve1(g, c.eq!, c.var!, c.guess!, defaultSolveSettings));
  }
  let pass = 0;
  for (const c of cs) {
    const rs = runs.get(c.id)!;
    if (rs.every((x) => x.display === c.expect)) pass++;
    else console.log(`  solve ${c.id}: got ${rs.map((x) => x.display).join(" / ")}, expect ${c.expect}`);
  }
  report("solve", pass === cs.length, `${pass}/${cs.length} match, rounds ${ROUNDS}`);
}

async function stageBench(): Promise<void> {
  const cs = cases("bench.yaml");
  const host = new EngineHost(await freshGiac());
  let checked = 0;
  let pass = 0;
  const errors: string[] = [];
  for (const c of cs) {
    const r = host.cas(c.input!, defaultCasSettings).result;
    if (!r.ok) errors.push(`${c.id} (${r.error})`);
    if (c.expect === undefined) continue;
    checked++;
    if (r.ok && r.text === c.expect) pass++;
    else console.log(`  bench ${c.id}: got ${r.text}, expect ${c.expect}`);
  }
  report("bench", pass === checked, `${pass}/${checked} expect match, ${cs.length} run, errors: ${errors.length ? errors.join(", ") : "none"}`);
}

function equalByGiac(g: GiacApi, a: string, b: string): { ok: boolean; how: string } {
  if (a === b) return { ok: true, how: "identical" };
  const ea = g.eval(a);
  if (ea === g.eval(b) && !/undef|error/i.test(ea)) return { ok: true, how: "same value" };
  const diff = `(${a})-(${b})`;
  const s = g.eval(`simplify(${diff})`);
  if (s === "0" || s === "0=0") return { ok: true, how: "simplify" };
  const vars = g
    .eval(`lname(${diff})`)
    .replace(/[[\]\s]/g, "")
    .split(",")
    .filter((v) => v && v !== "pi" && v !== "i");
  // Fixed sample points (deterministic runs), inside (0.15, 1.85) like the original random ones.
  for (const x of [0.3719, 0.9137, 1.6453]) {
    const at = (e: string): string =>
      vars.length ? `subst(${e},[${vars.join(",")}],[${vars.map((_, j) => (x + j * 0.31).toFixed(6)).join(",")}])` : e;
    const r = g.eval(`evalf(abs(${at(diff)}) / max(1, abs(${at(`(${b})`)})))`);
    // Internal comparison only, never shown to users.
    const v = Number(r);
    if (!Number.isFinite(v) || v > 1e-8) return { ok: false, how: `numeric diff ${r} (simplify gave ${s.slice(0, 60)})` };
  }
  return { ok: true, how: "numeric" };
}

async function stageParser(): Promise<void> {
  const cs = cases("parser.yaml");
  const g = await freshGiac();
  let pass = 0;
  let run = 0;
  let gaps = 0;
  const gapPassing: string[] = [];
  for (const c of cs) {
    let produced: string;
    let r: { ok: boolean; how: string };
    try {
      produced = latexToGiac(c.latex!);
      r = equalByGiac(g, produced, c.expect!);
    } catch (e) {
      produced = "";
      r = { ok: false, how: `parser threw: ${e instanceof Error ? e.message : String(e)}` };
    }
    if (c.status === "gap") {
      gaps++;
      if (r.ok) gapPassing.push(c.id);
      continue;
    }
    run++;
    if (r.ok) pass++;
    else console.log(`  parser ${c.id}: ${c.latex} -> ${produced}, want ${c.expect}: ${r.how}`);
  }
  report(
    "parser",
    pass === run,
    `${pass}/${run} match, ${gaps} known gaps${gapPassing.length ? ` (now passing: ${gapPassing.join(", ")})` : ""}; total ${pass}/${cs.length}`,
  );
}

console.log(`golden: engine ${mjs}`);
if (want("interrupt")) stageInterrupt();
if (want("home")) await stageHome();
if (want("solve")) await stageSolve();
if (want("bench")) await stageBench();
if (want("parser")) await stageParser();
const failed = summary.filter((s) => !s.ok);
console.log(failed.length ? `\nGOLDEN GATE FAILED: ${failed.map((s) => s.stage).join(", ")}` : "\nGOLDEN GATE PASSED");
process.exit(failed.length ? 1 : 0);
