// SPDX-License-Identifier: GPL-3.0-or-later
// Probe (S4, docs/archive/r10-connector.md): the proposed function-library file, checked against the real engine host.
//   node tools/probes/library.ts check <file>   # read, check, define (through cas(), as if typed in CAS), run the tests
//   node tools/probes/library.ts replay          # replay time of 200 definitions: the ?bench=defs mix and 200 programs
//   node tools/probes/library.ts export          # define a sample as typed, write the log back out as a library, re-check it
// Since G33 and G100 it runs the app's library.ts (parseLibrary with Giac's tree, importLibrary, exportLibrary).
// Engine: $GIAC_MJS, else $GIAC_OUT/giac.mjs, else engine/giac/_out/gsl (app/src/engine/nodeGiac.ts).
import { readFileSync } from "node:fs";
import { EngineHost } from "../../app/src/engine/host.ts";
import { loadNodeGiac } from "../../app/src/engine/nodeGiac.ts";
import { defaultCasSettings } from "../../app/src/engine/types.ts";
import { applyDefChanges, type DefEntry } from "../../app/src/engine/defs.ts";
import { exportLibrary, importLibrary, parseLibrary } from "../../app/src/engine/library.ts";

const median = (xs: number[]): number => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;

async function fresh(): Promise<{ host: EngineHost; giac: { eval(s: string): string } }> {
  const { giac, bridge } = await loadNodeGiac();
  return { host: new EngineHost(giac, bridge), giac };
}

async function replayMs(make: (i: number) => string, n: number, runs = 5): Promise<{ ms: number[]; entries: number }> {
  const { host } = await fresh();
  let log: DefEntry[] = [];
  for (let i = 1; i <= n; i++) log = applyDefChanges(log, host.cas(make(i), defaultCasSettings).defs);
  const ms: number[] = [];
  for (let r = 0; r < runs; r++) ms.push((await fresh()).host.restore(log));
  return { ms, entries: log.length };
}

const [cmd, arg] = process.argv.slice(2);
if (cmd === "check") {
  const { host } = await fresh();
  const lib = parseLibrary(readFileSync(arg!), host.parse.bind(host));
  const t0 = performance.now();
  const r = importLibrary(host, lib, []);
  const ms = performance.now() - t0;
  if (!r.ok) throw new Error(r.error);
  const { plan, log } = r;
  for (const d of lib.defs) console.log(`${d.kind} ${d.name}: ${d.desc} (${d.tests.length} tests)`);
  console.log(JSON.stringify({ version: lib.version, defs: lib.defs.length, tests: lib.defs.reduce((s, d) => s + d.tests.length, 0), entries: log.length, plan, ms: +ms.toFixed(1) }));
} else if (cmd === "replay") {
  const bench = await replayMs((i) => (i <= 150 ? `dv${i}:=${i}/7+${i}` : `df${i - 150}(x):=x^2+${i - 150}*x+sin(${i - 150})`), 200);
  console.log("bench mix (150 values, 50 functions, as ?bench=defs):", bench.entries, "entries, median", median(bench.ms).toFixed(1), "ms", bench.ms.map((m) => m.toFixed(1)).join(" "));
  const prog = await replayMs((i) => `lib${i}(a,b):={\n  local s,k;\n  s:=0;\n  for (k:=1;k<=b;k++) { s:=s+a^k/k; }\n  return s+${i};\n}`, 200);
  console.log("200 library programs (local, for loop):", prog.entries, "entries, median", median(prog.ms).toFixed(1), "ms", prog.ms.map((m) => m.toFixed(1)).join(" "));
  const one = await replayMs((i) => `lf${i}(q,L):=q*L^2/8+${i}`, 200);
  console.log("200 one-line functions:", one.entries, "entries, median", median(one.ms).toFixed(1), "ms", one.ms.map((m) => m.toFixed(1)).join(" "));
} else if (cmd === "export") {
  const { host } = await fresh();
  let log: DefEntry[] = [];
  for (const s of ["beam(q,L):=q*L^2/8", "A:=5", "B:=A*2", "f(x):={\n  local a;\n  a:=x^2;\n  return a+1;\n}", "assume(x>0)", "C:=evalf(sqrt(2))"]) log = applyDefChanges(log, host.cas(s, defaultCasSettings).defs);
  const file = exportLibrary(log).text;
  console.log(file);
  const back = await fresh();
  const lib = parseLibrary(file, back.host.parse.bind(back.host));
  const r = importLibrary(back.host, lib, []);
  if (!r.ok) throw new Error(r.error);
  console.log("round trip:", JSON.stringify(r.plan), "values:", ["beam(2,4)", "B", "f(3)", "C"].map((s) => `${s}=${back.giac.eval(s)}`).join(" "));
} else {
  console.error("usage: node tools/probes/library.ts check <file> | replay | export");
  process.exit(2);
}
