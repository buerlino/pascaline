// SPDX-License-Identifier: GPL-3.0-or-later
// G82 (A20): a result must not depend on the speed of the device. Every home.yaml and precision.yaml case runs on the
// desktop twice: on the real clock and on a clock that runs SLOW× fast, which is how a device SLOW× slower looks to every
// budget (Giac's `timeout` reads performance.now through emscripten_get_now; Home's own deadlines, HOME_DEADLINE_MS, the
// WALK_BUDGET_MS of nonsquare.ts and novalue.ts and EXTRA_BUDGET_MS of numeric.ts, read performance.now and Date.now).
// Display, mark and copy text must agree; a case that still differs is in SPEED_KNOWN with its reason (decisions.md).
//   GIAC_OUT=<dir> node scripts/golden-speed.ts      # SLOW=8 (default; the Tab One is 5-8× slower than the desktop); also the golden gate's stage `steps`
//   ONLY=a20 GIAC_OUT=<dir> node scripts/golden-speed.ts   # A20's cases only
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

/** Cases that still differ between the real clock and one 8× fast, by stage/id, with the limit that makes them differ
 *  (decisions.md, Needs the user, "Home's clocks after G82"). They are listed by the gate, never hidden; a new one fails. */
export const SPEED_KNOWN: Record<string, string> = {
  // factorial(10^6): one GMP call of 1.0 s that never looks at the interrupt; 8× slower it passes HOME_DEADLINE_MS (2 s)
  "precision/g58-factorial-1e6-12": "HOME_DEADLINE_MS",
  "precision/g58-factorial-1e6-30": "HOME_DEADLINE_MS",
  // G137 (pending): acosh(cosh(3*sqrt(-pi))) takes about 1 s on the desktop (sqrt(-pi) is slow), so 8× slower the budget gives ⚠0
  "precision/g137-acosh-cosh-3sqrt-neg-pi-12": "HOME_DEADLINE_MS",
};

const root = fileURLToPath(new URL("../../", import.meta.url));
const load = (file: string): Case[] => (parse(readFileSync(`${root}tests/golden/${file}`, "utf8")) as { cases: Case[] }).cases;
const cases = (file: string, ids?: readonly string[]): Case[] => {
  const all = load(file);
  if (!ids) return all.map(typed);
  return ids.map((id) => {
    const c = all.find((x) => x.id === id);
    if (!c) throw new Error(`golden-speed: no case ${id} in ${file}`);
    return typed(c);
  });
};

/** The cases (all, or A20's) on the real clock and on a `slow`× fast one; the findings between the two runs, split into
 *  the known ones (SPEED_KNOWN) and the new ones. */
export async function speedFindings(
  slow: number,
  mjs: string = giacMjsPath(),
  only: "all" | "a20" = "all",
): Promise<{ findings: Finding[]; known: Finding[]; records: number }> {
  const fresh = async (): Promise<EngineHost> => {
    const { giac, bridge } = await loadNodeGiac(mjs);
    giac.eval(pasdegCommand("rad"));
    return new EngineHost(giac, bridge);
  };
  const home = cases("home.yaml", only === "a20" ? A20_CASES.home : undefined);
  const precision = cases("precision.yaml", only === "a20" ? A20_CASES.precision : undefined);
  const normal = await goldenRecords(home, precision, fresh);
  const slowed = await withFastClock(slow, () => goldenRecords(home, precision, fresh));
  const all = compareGolden(normal, slowed);
  const isKnown = (f: Finding): boolean => `${f.stage}/${f.id}` in SPEED_KNOWN;
  return { findings: all.filter((f) => !isKnown(f)), known: all.filter(isKnown), records: normal.length };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const slow = Number(process.env.SLOW ?? 8);
  const { findings, known, records } = await speedFindings(slow, giacMjsPath(), process.env.ONLY === "a20" ? "a20" : "all");
  const show = (f: Finding): string => describe(f).replace("desktop", "clock ×1").replace("device", `clock ×${slow}`);
  for (const f of known) console.log(`known (${SPEED_KNOWN[`${f.stage}/${f.id}`]}): ${show(f)}`);
  for (const f of findings) console.log(show(f));
  console.log(`${findings.length === 0 ? "SAME" : "DIFFERENT"}: ${records} cases, clock ×1 and ×${slow}, ${findings.length} new findings, ${known.length} known`);
  process.exit(findings.length === 0 ? 0 : 1);
}
