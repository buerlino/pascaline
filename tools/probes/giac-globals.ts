// SPDX-License-Identifier: GPL-3.0-or-later
// Probe (structure audit, 2026-10-20): which of Giac's global settings a user input can change, and whether the change
// leaks into later Home and CAS results through the host as it runs today. For each flag input: a fresh engine, a
// baseline of Home and CAS inputs, the flag typed in CAS, the same inputs again, then a relaunch (the definitions log
// replayed into a fresh engine) and the same inputs a third time. A row is printed for every input whose display,
// mark facts or CAS text changed.
//   GIAC_OUT=<dir> node tools/probes/giac-globals.ts            # every flag
//   GIAC_OUT=<dir> node tools/probes/giac-globals.ts 'xcas_mode:=1'   # one flag input
// Read-only; no network. Each flag loads its own engine (about 1 s on the desktop).
import { EngineHost } from "../../app/src/engine/host.ts";
import { loadNodeGiac } from "../../app/src/engine/nodeGiac.ts";
import { defaultHomeSettings } from "../../app/src/engine/homeEval.ts";
import { defaultCasSettings } from "../../app/src/engine/types.ts";
import { applyDefChanges, type DefEntry } from "../../app/src/engine/defs.ts";

const HOME = ["1/4", "0.1+0.2", "2^70", "sqrt(2)", "sin(1)", "exp(i*pi/3)", "int(x^2,x,0,1)", "123456789*1000", "1e-5"];
const CAS = ["1/3", "diff(sin(x),x)", "factor(x^4-1)", "solve(x^2=2,x)", "sqrt(-4)", "int(1/x,x)", "sqrt(x^2)", "series(sin(x),x,0,5)", "255", "1.5*x"];
const FLAGS = process.argv.slice(2).length
  ? process.argv.slice(2)
  : [
      "approx_mode:=1", "complex_mode:=1", "complex_variables:=1", "epsilon:=0.01", "increasing_power:=1",
      "all_trig_solutions:=1", "xcas_mode:=1", "xcas_mode:=3", "angle_radian:=0", "assume(x>0)", "with_sqrt(0)",
      "Digits:=5", "DIGITS:=5", "integer_format(16)", "scientific_format:=1", "cas_setup(1,0,0,1,0,[1e-12,1e-15],12,[1,100,0,25],0,1,0,1)",
      "timeout 0.001", "ckevery 1", "threads:=4", "complex_mode(1)", "HAngle:=0",
    ];

type Snap = Record<string, string>;
const home = { ...defaultHomeSettings };
const cas = { ...defaultCasSettings };

function snap(host: EngineHost): Snap {
  const s: Snap = {};
  for (const i of HOME) {
    const r = host.home(i, home).result;
    s[`home ${i}`] = `${r.display} exact=${r.facts.exact} rd=${r.facts.reliableDigits} warn=${r.facts.warn ?? "-"}`;
  }
  for (const i of CAS) {
    const r = host.cas(i, cas).result;
    s[`cas ${i}`] = r.ok ? r.text : `error ${r.error}`;
  }
  return s;
}

function diff(a: Snap, b: Snap): string[] {
  return Object.keys(a).filter((k) => a[k] !== b[k]).map((k) => `    ${k}: ${a[k]}  ->  ${b[k]}`);
}

for (const flag of FLAGS) {
  const { giac } = await loadNodeGiac();
  const host = new EngineHost(giac);
  const before = snap(host);
  const r = host.cas(flag, cas);
  const log: DefEntry[] = applyDefChanges([], r.defs);
  const after = snap(host);
  const fresh = new EngineHost((await loadNodeGiac()).giac);
  fresh.restore(log);
  const relaunch = snap(fresh);
  const d1 = diff(before, after);
  const d2 = diff(before, relaunch);
  console.log(`${JSON.stringify(flag)}: CAS => ${r.result.ok ? JSON.stringify(r.result.text) : `error ${r.result.error}`}; logged ${log.length ? JSON.stringify(log.map((e) => e.cmds).flat()) : "nothing"}`);
  console.log(`  same session: ${d1.length} changed${d1.length ? "\n" + d1.join("\n") : ""}`);
  console.log(`  after relaunch: ${d2.length} changed${d2.length ? "\n" + d2.join("\n") : ""}`);
}
