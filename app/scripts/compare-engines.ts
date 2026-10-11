// SPDX-License-Identifier: GPL-3.0-or-later
// Prints every golden input whose engine output differs between two Giac builds (e.g. emsdk vs the
// release container, P2). Home: display; bench: CAS text and latex; parser intents: Giac's value.
//   node scripts/compare-engines.ts <a/giac.mjs> <b/giac.mjs>
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { EngineHost } from "../src/engine/host.ts";
import { defaultHomeSettings } from "../src/engine/homeEval.ts";
import { loadNodeGiac } from "../src/engine/nodeGiac.ts";
import { defaultCasSettings } from "../src/engine/types.ts";

interface Case {
  id: string;
  input?: string;
  expect?: string;
  settings?: { angle?: "rad" | "deg" };
}

const [a, b] = process.argv.slice(2);
if (!a || !b) {
  console.error("usage: node scripts/compare-engines.ts <a/giac.mjs> <b/giac.mjs>");
  process.exit(2);
}
const root = fileURLToPath(new URL("../../", import.meta.url));
const load = (f: string): Case[] => (parse(readFileSync(`${root}tests/golden/${f}`, "utf8")) as { cases: Case[] }).cases;

async function outputs(mjs: string): Promise<Map<string, string>> {
  const host = new EngineHost((await loadNodeGiac(mjs)).giac);
  const out = new Map<string, string>();
  for (const c of load("home.yaml")) {
    out.set(`home/${c.id}`, host.home(c.input!, { ...defaultHomeSettings, angle: c.settings?.angle ?? "rad" }).result.display);
  }
  for (const c of load("bench.yaml")) {
    const r = host.cas(c.input!, defaultCasSettings).result;
    out.set(`bench/${c.id}`, `${r.text} | ${r.latex}`);
  }
  for (const c of load("parser.yaml")) out.set(`parser/${c.id}`, host.eval(c.expect!).output);
  return out;
}

const [oa, ob] = [await outputs(a), await outputs(b)];
let diffs = 0;
for (const [k, va] of oa) {
  const vb = ob.get(k);
  if (va === vb) continue;
  diffs++;
  console.log(`${k}\n  a: ${va}\n  b: ${vb}`);
}
console.log(`${diffs} difference(s) in ${oa.size} outputs`);
