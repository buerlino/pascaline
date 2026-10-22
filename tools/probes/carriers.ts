// SPDX-License-Identifier: GPL-3.0-or-later
// Probe (structure audit, 2026-10-20): which facts of a result survive the step from the engine to the views. Each
// input runs through the real EngineHost; its HomeResult (or CasResult) then goes through the Calc port exactly as
// the app sends it (app/src/calc/engine.ts EngineCalc, with the host behind a MathEngine stand-in). Printed: every
// field the engine set that the view never receives. A fact the view never receives cannot reach a chip, Ans, a
// stored value, Copy or the why-line, so each such field is a carrier that drops a fact.
//   GIAC_OUT=<dir> node tools/probes/carriers.ts ['input' …]
// Read-only; no network.
import { EngineHost } from "../../app/src/engine/host.ts";
import { loadNodeGiac } from "../../app/src/engine/nodeGiac.ts";
import { EngineCalc } from "../../app/src/calc/engine.ts";
import type { MathEngine } from "../../app/src/engine/types.ts";

const HOME = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ["1/3", "sqrt(2)", "BesselJ(1,2)", "romberg(exp(-x^2),x,0,1)", "normald_icdf(0.025)", "[1/3,BesselJ(1,2)]", "2^200", "sign(sin(10^50))", "evalf(pi,30)"];
const CAS = ["evalf(BesselJ(1,2))", "x+sin(10^22)*1.0", "1/3"];

const { giac } = await loadNodeGiac();
const host = new EngineHost(giac);
const stand = {
  home: async (i: string, s: never, c?: never, ch?: never) => host.home(i, s, c, ch).result,
  cas: async (i: string, s: never) => host.cas(i, s).result,
} as unknown as MathEngine;
const calc = new EngineCalc(stand);
const settings = { digits: 12, angle: "rad", format: "std" } as never;

// A result's keys, with the facts it carries as one object (G76: `facts`) read key by key, so a fact dropped inside it shows.
const flat = (o: object): [string, unknown][] =>
  Object.entries(o).flatMap(([k, v]): [string, unknown][] => (k === "facts" && v && typeof v === "object" ? Object.entries(v).map(([j, w]): [string, unknown] => [`facts.${j}`, w]) : [[k, v]]));
const lost = (a: object, b: object): string[] => {
  const kept = new Set(flat(b).map(([k]) => k));
  return flat(a)
    .filter(([k, v]) => v !== undefined && !kept.has(k) && !/Ms$/.test(k))
    .map(([k, v]) => `${k}=${JSON.stringify(v).slice(0, 60)}`);
};

for (const i of HOME) {
  const r = host.home(i, { ...(await import("../../app/src/engine/homeEval.ts")).defaultHomeSettings }).result;
  const o = await calc.home(i, settings);
  const l = lost(r, o);
  console.log(`home ${JSON.stringify(i)}: ${l.length ? "lost " + l.join("; ") : "nothing lost"}`);
}
for (const i of CAS) {
  const r = host.cas(i, (await import("../../app/src/engine/types.ts")).defaultCasSettings).result;
  const o = await calc.cas(i, settings);
  const l = lost(r, o);
  console.log(`cas ${JSON.stringify(i)}: ${l.length ? "lost " + l.join("; ") : "nothing lost"}`);
}
