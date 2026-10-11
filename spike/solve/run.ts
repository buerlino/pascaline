// SPDX-License-Identifier: GPL-3.0-or-later
// Runs spike/solve/cases.yaml through solve1 on the source-built Giac in Node (median of ROUNDS fresh engines).
//   node spike/solve/run.ts          # GIAC_MJS=<giac.mjs>, ROUNDS=5
import { readFileSync } from "node:fs";
import { solve1, defaultSolveSettings, type SolveResult } from "../app/src/solve/solve1.ts";

interface Case { id: string; eq: string; var: string; guess: string; expect?: string; note?: string }
interface GiacModule { cwrap(name: string, ret: string, args: string[]): (...a: string[]) => string }

const here = new URL(".", import.meta.url);
const mjs = process.env.GIAC_MJS ?? new URL("../../engine/giac/_out/gsl/giac.mjs", here).pathname;
const ROUNDS = Number(process.env.ROUNDS ?? 5);

const cases: Case[] = [];
for (const line of readFileSync(new URL("cases.yaml", here), "utf8").split("\n")) {
  if (!/^\s*- \{/.test(line)) continue;
  const c: Record<string, string> = {};
  for (const m of line.matchAll(/(\w+): ("(?:[^"\\]|\\.)*")/g)) c[m[1]!] = JSON.parse(m[2]!) as string;
  cases.push(c as unknown as Case);
}

(globalThis as Record<string, unknown>).UI = { add_evalf: 0, js_bigint: 0, disable3d: -1, Datestart: Date.now() };
const { default: create } = (await import(mjs)) as { default: (o: object) => Promise<GiacModule> };

const results = new Map<string, SolveResult[]>(cases.map((c) => [c.id, []]));
for (let r = 0; r < ROUNDS; r++) {
  const M = await create({ print: () => {}, printErr: () => {} });
  M.cwrap("giac_init", "number", [])();
  const ev = M.cwrap("giac_eval", "string", ["string"]);
  ev("timeout 2");
  ev("ckevery 10");
  for (const c of cases) results.get(c.id)!.push(solve1({ eval: ev }, c.eq, c.var, c.guess, defaultSolveSettings));
}

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;
let pass = 0;
let maxMs = 0;
for (const c of cases) {
  const rs = results.get(c.id)!;
  const r = rs[0]!;
  const ok = rs.every((x) => x.display === c.expect);
  if (ok) pass++;
  const ms = median(rs.map((x) => x.ms));
  maxMs = Math.max(maxMs, ms);
  const res = r.residualRel === undefined ? "" : `res ${r.residualRel.toExponential(1)}`;
  console.log(`${ok ? "ok  " : "FAIL"} ${c.id.padEnd(16)} ${r.method.padEnd(10)} ${ms.toFixed(1).padStart(7)} ms  ${r.display.padEnd(18)}${ok ? "" : ` expect ${c.expect}`} ${res}${r.warn ? " WARN" : ""}${r.rejected ? ` rejected ${r.rejected}` : ""}  ${r.info}`);
}
console.log(`\nSolve: ${pass}/${cases.length} match; max median ${maxMs.toFixed(1)} ms; rounds ${ROUNDS}`);
process.exit(pass === cases.length ? 0 : 1);
