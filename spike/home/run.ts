// SPDX-License-Identifier: GPL-3.0-or-later
// Runs spike/home/cases.yaml through homeEval on the source-built Giac in Node and checks Q3:
// every case matches its expected value, and no case takes over 500 ms (median of ROUNDS fresh engines).
//   node spike/home/run.ts                 # GIAC_MJS=<giac.mjs> (default: this checkout's _out/gsl)
//   ROUNDS=5 OUT=results.json node spike/home/run.ts
import { readFileSync, writeFileSync } from "node:fs";
import { homeEval, homeSetupCommands, defaultHomeSettings, roundDecimalString, formatDecimal } from "../app/src/home/homeEval.ts";
import type { Giac, HomeResult, HomeSettings } from "../app/src/home/homeEval.ts";

interface Case {
  id: string;
  input: string;
  expect?: string;
  source: string;
  angle?: "rad" | "deg";
  note?: string;
}

interface GiacModule {
  cwrap(name: string, ret: string | null, args: string[]): (...a: (string | number)[]) => string & number;
}

const here = new URL(".", import.meta.url);
const mjs = process.env.GIAC_MJS ?? new URL("../../engine/giac/_out/gsl/giac.mjs", here).pathname;
const ROUNDS = Number(process.env.ROUNDS ?? 5);
const LIMIT_MS = 500;

function loadCases(): Case[] {
  const text = readFileSync(new URL("cases.yaml", here), "utf8");
  const cases: Case[] = [];
  for (const line of text.split("\n")) {
    if (!/^\s*- \{/.test(line)) continue;
    const c: Record<string, string> = {};
    for (const m of line.matchAll(/(\w+): ("(?:[^"\\]|\\.)*")/g)) c[m[1]] = JSON.parse(m[2]) as string;
    cases.push(c as unknown as Case);
  }
  return cases;
}

(globalThis as Record<string, unknown>).UI = { add_evalf: 0, js_bigint: 0, disable3d: -1, Datestart: Date.now() };
const { default: create } = (await import(mjs)) as { default: (o: object) => Promise<GiacModule> };

async function engine(s: HomeSettings): Promise<Giac & { setAngle(a: "rad" | "deg"): void }> {
  const M = await create({ print: () => {}, printErr: () => {} });
  M.cwrap("giac_init", "number", [])();
  const ev = M.cwrap("giac_eval", "string", ["string"]);
  M.cwrap("giac_set_pow_limit", "number", ["number"])(s.powLimit);
  const giac: Giac = { eval: (x: string) => ev(x) };
  let angle: "rad" | "deg" | null = null;
  return {
    eval: giac.eval,
    setAngle(a) {
      if (a === angle) return;
      for (const c of homeSetupCommands({ ...s, angle: a })) giac.eval(c);
      angle = a;
    },
  };
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

async function runAll(s: HomeSettings, rounds: number): Promise<Map<string, HomeResult[]>> {
  const cases = loadCases();
  const res = new Map<string, HomeResult[]>(cases.map((c) => [c.id, []]));
  for (let r = 0; r < rounds; r++) {
    const g = await engine(s);
    for (const c of cases) {
      g.setAngle(c.angle ?? "rad");
      let out: HomeResult;
      try {
        out = homeEval(g, c.input, { ...s, angle: c.angle ?? "rad" });
      } catch (e) {
        out = { ok: false, display: `exception: ${String(e)}`, path: "float-error", approximate: true, tieRisk: false, exactMs: NaN, totalMs: NaN };
      }
      res.get(c.id)!.push(out);
    }
  }
  return res;
}

const cases = loadCases();
const s = defaultHomeSettings;
const results = await runAll(s, ROUNDS);
let pass = 0;
let slow = 0;
let maxMed = 0;
const rows: object[] = [];
const paths: Record<string, number> = {};
for (const c of cases) {
  const rs = results.get(c.id)!;
  const display = rs[0].display;
  const consistent = rs.every((r) => r.display === display);
  const med = median(rs.map((r) => r.totalMs));
  const ok = c.expect !== undefined && display === c.expect && consistent;
  if (ok) pass++;
  if (!(med <= LIMIT_MS)) slow++;
  maxMed = Math.max(maxMed, med);
  paths[rs[0].path] = (paths[rs[0].path] ?? 0) + 1;
  const flag = ok ? "ok  " : "FAIL";
  const extra = [rs[0].approximate ? "approx" : "", rs[0].tieRisk ? "TIE-RISK" : "", consistent ? "" : "INCONSISTENT"].filter(Boolean).join(" ");
  console.log(
    `${flag} ${c.id.padEnd(24)} ${rs[0].path.padEnd(13)} ${med.toFixed(1).padStart(7)} ms  ${display.slice(0, 40).padEnd(40)}${ok ? "" : `  expect ${c.expect}`} ${extra}`,
  );
  rows.push({ id: c.id, input: c.input, expect: c.expect, source: c.source, display, ok, path: rs[0].path, approximate: rs[0].approximate, tieRisk: rs[0].tieRisk, medianMs: med, maxMs: Math.max(...rs.map((r) => r.totalMs)), exactMedianMs: median(rs.map((r) => r.exactMs)) });
}

// Comparison: the size guard re-evaluating in float (the literal plan) instead of rounding the exact value.
const alt = await runAll({ ...s, guardMode: "reeval-float" }, 1);
const altDiffs: string[] = [];
for (const c of cases) {
  const a = alt.get(c.id)![0];
  const b = results.get(c.id)![0];
  if (a.display !== b.display) altDiffs.push(`${c.id}: round-exact ${b.display} | reeval-float ${a.display} | expect ${c.expect}`);
}

// Baseline: what plain floating-point Giac (input as typed, evalf at 12 digits) would show.
const base = await engine(s);
const baseFails: string[] = [];
for (const c of cases) {
  base.setAngle(c.angle ?? "rad");
  const out = base.eval(`evalf(${c.input})`);
  // re/im inside Giac: re-parsing a printed float beyond double range (0.1995e3011) gives infinity.
  const re = roundDecimalString(base.eval(`re(evalf(${c.input}))`), s.digits);
  const im = roundDecimalString(base.eval(`im(evalf(${c.input}))`), s.digits);
  const shown = re && im ? (im.digits === "0" ? formatDecimal(re) : `${formatDecimal(re)} ${formatDecimal(im)}*i`) : out;
  if (shown !== c.expect && !(re && im && im.digits !== "0")) baseFails.push(`${c.id}: ${shown} (expect ${c.expect})`);
}

console.log(`\nQ3: ${pass}/${cases.length} match; ${slow} case(s) over ${LIMIT_MS} ms; max median ${maxMed.toFixed(1)} ms; rounds ${ROUNDS}`);
console.log(`paths: ${JSON.stringify(paths)}`);
console.log(`guardMode reeval-float differs on ${altDiffs.length} case(s)${altDiffs.length ? ":\n  " + altDiffs.join("\n  ") : ""}`);
console.log(`baseline (plain float Giac, real results only) wrong on ${baseFails.length} case(s):\n  ${baseFails.join("\n  ")}`);
if (process.env.OUT) writeFileSync(process.env.OUT, JSON.stringify({ engine: mjs, rounds: ROUNDS, settings: s, rows, altDiffs, baseFails }, null, 1));
process.exit(pass === cases.length && slow === 0 ? 0 : 1);
