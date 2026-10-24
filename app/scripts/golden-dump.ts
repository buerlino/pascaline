// SPDX-License-Identifier: GPL-3.0-or-later
// A20: the desktop side of the WebView comparison. One round of the Home and precision cases on the same engine
// build, written as JSON for golden-compare.ts.  GIAC_OUT=<dir> node scripts/golden-dump.ts out.json
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { EngineHost } from "../src/engine/host.ts";
import { pasdegCommand } from "../src/engine/homeEval.ts";
import { giacMjsPath, loadNodeGiac } from "../src/engine/nodeGiac.ts";
import { goldenRecords, typed, type Case } from "../src/goldenRun.ts";

const root = fileURLToPath(new URL("../../", import.meta.url));
const cases = (file: string): Case[] => (parse(readFileSync(`${root}tests/golden/${file}`, "utf8")) as { cases: Case[] }).cases.map(typed);
const fresh = async (): Promise<EngineHost> => {
  const { giac, bridge } = await loadNodeGiac(giacMjsPath());
  giac.eval(pasdegCommand("rad"));
  return new EngineHost(giac, bridge);
};
const out = process.argv[2];
if (!out) throw new Error("usage: golden-dump.ts out.json");
const recs = await goldenRecords(cases("home.yaml"), cases("precision.yaml"), fresh);
writeFileSync(out, JSON.stringify(recs));
console.log(`${recs.length} records → ${out}`);
