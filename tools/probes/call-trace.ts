// SPDX-License-Identifier: GPL-3.0-or-later
// Probe (hindsight note, 2026-10-20): every Giac call one Home Enter makes, in order, with a rough class each, so we
// can see how many calls compute and how many only ask Giac about the shape of something it already returned as text.
// Classes (by the call text, a heuristic):
//   setup    Digits:=, timeout, ckevery, angle, pasdeg, our definitions
//   compute  the input itself, or evalf/approx/regroup/exact of it (a value read at a precision)
//   ask      type(), lname, size, dim, string(), re()/im() as text, a bare name (is it defined?): questions about form
//   store    a := of ours (pas… names, chips)
//   other
//   GIAC_OUT=<dir> node tools/probes/call-trace.ts ['input' …]   (STORED=1: a, b, f stored first, as engine-calls.ts)
// Read-only; no network.
import { EngineHost, type GiacApi } from "../../app/src/engine/host.ts";
import { loadNodeGiac } from "../../app/src/engine/nodeGiac.ts";
import { defaultHomeSettings } from "../../app/src/engine/homeEval.ts";

const inputs = process.argv.slice(2).length ? process.argv.slice(2) : ["1/3", "sqrt(2)", "sin(1)+1/7", "[1/3,sqrt(2)]", "x^2+1", "floor(10*pi)", "a*b+1"];
const { giac } = await loadNodeGiac();
const calls: string[] = [];
const traced: GiacApi = {
  eval: (s: string) => {
    calls.push(s);
    return giac.eval(s);
  },
  setPowLimit: (n: number) => giac.setPowLimit(n),
  messages: () => giac.messages(),
  clearMessages: () => giac.clearMessages(),
};
const host = new EngineHost(traced);
if (process.env.STORED === "1") for (const s of ["a:=1/3", "b:=sqrt(2)", "f(x):=x^2+a"]) host.home(s, defaultHomeSettings);
host.home("0", defaultHomeSettings); // the mode is set once; not counted below

const classOf = (c: string): string => {
  if (/^(Digits:=|timeout |ckevery |angle_radian|pasdeg:=|purge\(pasdeg)/.test(c) || /^[a-z]+\(.*\):=/.test(c) && /^pas/.test(c)) return "setup";
  if (/^pas[a-z_0-9]*:=|^purge\(pas/.test(c)) return "store";
  if (/\b(evalf|approx|regroup|exact|normal|simplify)\(/.test(c)) return "compute";
  if (/\b(type|lname|size|dim|string|print|re|im|denom|numer|is_real|has|sommet|feuille|subtype)\(/.test(c) || /^[A-Za-z_][A-Za-z0-9_]*$/.test(c)) return "ask";
  return "other";
};
const totals: Record<string, number> = {};
for (const i of inputs) {
  calls.length = 0;
  const r = host.home(i, defaultHomeSettings).result;
  const by: Record<string, number> = {};
  for (const c of calls) {
    const k = c.includes(i) && !/^pas/.test(c) && classOf(c) !== "ask" ? "compute" : classOf(c);
    by[k] = (by[k] ?? 0) + 1;
    totals[k] = (totals[k] ?? 0) + 1;
  }
  console.log(`${JSON.stringify(i)} => ${r.display}: ${calls.length} calls ${JSON.stringify(by)}`);
  if (process.env.SHOW === "1") for (const c of calls) console.log(`    [${classOf(c)}] ${c.slice(0, 140)}`);
}
console.log(`totals ${JSON.stringify(totals)}`);
