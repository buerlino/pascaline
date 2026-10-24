// SPDX-License-Identifier: GPL-3.0-or-later
// G82 (A20): a result must not depend on the speed of the device. The golden cases that differed on the Tab One (A20's
// 16, and two more an earlier run showed) run on the desktop twice: on the real clock and on a clock that runs SLOW×
// fast, which is how a device SLOW× slower looks to every budget (Giac's `timeout` reads performance.now through
// emscripten_get_now; Home's own deadlines read performance.now and Date.now). Display, mark and copy text must agree.
//   GIAC_OUT=<dir> node scripts/golden-speed.ts      # SLOW=6 (default; the Tab One is 5-8× slower than the desktop); also the golden gate's stage `steps`
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parse } from "yaml";
import { EngineHost } from "../src/engine/host.ts";
import { pasdegCommand } from "../src/engine/homeEval.ts";
import { giacMjsPath, loadNodeGiac } from "../src/engine/nodeGiac.ts";
import { goldenRecords, typed, type Case } from "../src/goldenRun.ts";
import { compareGolden, describe, type Finding } from "./golden-compare.ts";

/** A20's findings (decisions.md, the A20 entry), by stage and case id. */
export const A20_CASES: { home: readonly string[]; precision: readonly string[] } = {
  home: ["sum-1.1^k-500", "fn-int-sinx/x", "g39-int-tan-plus-x", "g44f2-seq-normald_icdf-1e-30-x3", "rad-asin0.5"],
  precision: [
    "prec-2-normald_icdf-value", "prec-g44-normald_icdf-1e-10-30", "prec-g44-normald_icdf-1-1e-12-12", "prec-g44-normald_icdf-1-1e-12-30",
    "prec-g44-chisquare_icdf-3-0.95-12", "prec-g44-chisquare_icdf-3-0.95-30", "prec-g44f1-fisher_icdf-3-4-1-1e-20-12",
    "prec-g44f1-fisher_icdf-3-4-1-1e-20-30", "prec-g44f2-chisquare_icdf-3-1-1e-30-12", "prec-g44f2-chisquare_icdf-3-1-1e-30-30",
    "prec-g44f2f1-chisquare_icdf-3-0.9-12", "prec-g44f2f1-chisquare_icdf-1-0.95-12", "prec-g44-student_icdf-5-0.975-30",
  ],
};

/** Runs `fn` with performance.now and Date.now running `k`× fast (continuous at the switch), then puts them back. */
export async function withFastClock<T>(k: number, fn: () => Promise<T>): Promise<T> {
  const perf = performance.now.bind(performance);
  const date = Date.now;
  const p0 = perf();
  const d0 = date();
  performance.now = () => p0 + (perf() - p0) * k;
  Date.now = () => Math.round(d0 + (date() - d0) * k);
  try {
    return await fn();
  } finally {
    performance.now = perf;
    Date.now = date;
  }
}

const root = fileURLToPath(new URL("../../", import.meta.url));
const cases = (file: string, ids: readonly string[]): Case[] => {
  const all = (parse(readFileSync(`${root}tests/golden/${file}`, "utf8")) as { cases: Case[] }).cases;
  return ids.map((id) => {
    const c = all.find((x) => x.id === id);
    if (!c) throw new Error(`golden-speed: no case ${id} in ${file}`);
    return typed(c);
  });
};

/** The A20 cases on the real clock and on a `slow`× fast one; the findings between the two runs. */
export async function speedFindings(slow: number, mjs: string = giacMjsPath()): Promise<{ findings: Finding[]; records: number }> {
  const fresh = async (): Promise<EngineHost> => {
    const { giac, bridge } = await loadNodeGiac(mjs);
    giac.eval(pasdegCommand("rad"));
    return new EngineHost(giac, bridge);
  };
  const home = cases("home.yaml", A20_CASES.home);
  const precision = cases("precision.yaml", A20_CASES.precision);
  const normal = await goldenRecords(home, precision, fresh);
  const slowed = await withFastClock(slow, () => goldenRecords(home, precision, fresh));
  return { findings: compareGolden(normal, slowed), records: normal.length };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const slow = Number(process.env.SLOW ?? 6);
  const { findings, records } = await speedFindings(slow);
  for (const f of findings) console.log(describe(f).replace("desktop", "clock ×1").replace("device", `clock ×${slow}`));
  console.log(`${findings.length === 0 ? "SAME" : "DIFFERENT"}: ${records} A20 cases, clock ×1 and ×${slow}, ${findings.length} findings`);
  process.exit(findings.length === 0 ? 0 : 1);
}
