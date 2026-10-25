// SPDX-License-Identifier: GPL-3.0-or-later
// Probe (G110, bug-patterns family 5, hunt lead 6): a census of the kinds of answer Giac gives for Find's tier-1 functions, before
// Find puts them one tap away. Each function's first typeable example of Giac's help, written as the keys write it (the Find insert
// with its arguments), and for a call on numbers also an integer, a decimal, a negative and a list as its last argument, goes
// through our parser and the host in Home and in CAS. Every answer is classed: checked (a number whose mark mpmath confirms),
// unchecked (a number, no oracle), symbolic, refused (a message), raw (Giac's raw text), wrong (a wrong value or mark), state (a
// name or setting left behind), hang, crash. tools/probes/findcensus/ holds the parts; app/scripts/findcensus.ts is the gate stage.
//   node tools/probes/find-census.ts                 # every tier-1 function: the class counts, then every finding
//   node tools/probes/find-census.ts erfc plot sto   # these functions only, every input with its class
//   ALL=1 node tools/probes/find-census.ts           # every input with its class
// Needs the Find index (`npm run index` in app/), Giac's tarball (PASCALINE_DL_DIR, default the main checkout's cache), mpmath
// (tests/golden/.venv) and the engine as tools/probes/engine.ts (GIAC_OUT). WORKERS (default 4) engines run side by side.
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { FINDINGS } from "./findcensus/classify.ts";
import { aideCas, census, oracleFor, plan, pythonFor, tier1 } from "./findcensus/run.ts";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const common = spawnSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], { cwd: repo, encoding: "utf8" }).stdout.trim();
const mainCheckout = common ? resolve(common, "..") : repo;

const names = process.argv.slice(2);
const t0 = performance.now();
const p = plan(tier1(repo), await aideCas(mainCheckout), names.length ? new Set(names) : undefined);
const oracles = oracleFor(p.samples, pythonFor(repo, mainCheckout), resolve(repo, "tools/probes/findcensus/oracle.py"));
const { rows, restarts } = await census(p.samples, oracles, 6000, Number(process.env["WORKERS"] ?? 4));
const all = names.length > 0 || process.env["ALL"] === "1";
for (const r of rows) {
  if (all || FINDINGS.has(r.cls)) console.log(`${r.cls.padEnd(9)} ${r.id}  ${r.latex}  =>  ${r.detail}`);
}
for (const n of p.none) if (all) console.log(`no sample ${n.name}: ${n.why}`);
const counts = new Map<string, number>();
for (const r of rows) counts.set(`${r.view} ${r.cls}`, (counts.get(`${r.view} ${r.cls}`) ?? 0) + 1);
const line = (v: string): string => [...counts].filter(([k]) => k.startsWith(v)).map(([k, n]) => `${k.slice(v.length + 1)} ${n}`).join(", ");
console.log(`FIND CENSUS: ${p.samples.length} inputs of ${p.samples.length ? new Set(p.samples.map((s) => s.name)).size : 0} functions (${p.none.length} without a sample), ${rows.length} runs; ${restarts} engine restarts; ${((performance.now() - t0) / 1000).toFixed(1)} s`);
console.log(`  home: ${line("home")}`);
console.log(`  cas: ${line("cas")}`);
