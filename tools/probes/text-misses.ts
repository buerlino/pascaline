// SPDX-License-Identifier: GPL-3.0-or-later
// Probe (structure audit, 2026-10-20): the confirmed misses of our text readers (docs/archive/structure-audit-inventory.md).
// Each line runs one input through the real EngineHost (or solveRequest, or parseLibrary) and prints what the user
// gets, beside what is right. The audit's note cites these by their label (text-1 …). Oracle values: mpmath (the
// commands are in the note).
//   GIAC_OUT=<dir> node tools/probes/text-misses.ts [label …]
// Read-only; no network.
import { EngineHost } from "../../app/src/engine/host.ts";
import { loadNodeGiac, nodeHost } from "../../app/src/engine/nodeGiac.ts";
import { defaultHomeSettings } from "../../app/src/engine/homeEval.ts";
import { defaultCasSettings } from "../../app/src/engine/types.ts";
import { solveRequest } from "../../app/src/engine/solve.ts";
import { parseLibrary } from "../../app/src/engine/library.ts";
import { DATA_VERSION } from "../../app/src/state/storage.ts";
import { applyDefChanges, type DefEntry } from "../../app/src/engine/defs.ts";

const { giac, bridge } = await loadNodeGiac();
const host = new EngineHost(giac, bridge);
const home = (t: string): string => {
  const r = host.home(t, defaultHomeSettings);
  const x = r.result;
  return `${x.ok ? x.display : `error ${x.error}`} (exact ${x.facts.exact}, digits ${x.facts.reliableDigits}, warn ${x.facts.warn ?? "-"}, logged ${r.defs.length})`;
};
const cas = (t: string): string => {
  const r = host.cas(t, defaultCasSettings);
  return `${r.result.ok ? r.result.text : `error ${r.result.error}`} (logged ${r.defs.map((d) => ("set" in d ? `${d.set.kind}:${d.set.name}:${d.set.cmds.join("|")}` : `purge:${d.purge.join(",")}`)).join(" ") || "nothing"})`;
};
const lib = (body: string): string => {
  try {
    return `accepted ${parseLibrary(`// pascaline library ${DATA_VERSION}\n// d\n${body}\n`).defs.map((d) => d.name).join(",")}`;
  } catch (e) {
    return `refused: ${(e as Error).message}`;
  }
};
const solve = (eq: string): string => {
  const s = solveRequest(giac, { kind: "one", equations: [eq], unknowns: ["x"], guesses: ["1"] } as never, defaultHomeSettings);
  return s.ok ? s.roots.map((r) => r.result.display).join(", ") : `no root (${s.info})`;
};

/** The log keeps what was typed, not Giac's print (which drops a bracket): defined in one engine, replayed in a fresh one. */
const replay = async (): Promise<string> => {
  const a = (await nodeHost());
  let log: DefEntry[] = [];
  const shown: string[] = [];
  for (const i of ["g(x):=(pZ:=x)+1", "g(2)", "pZ"]) {
    const r = a.cas(i, defaultCasSettings);
    log = applyDefChanges(log, r.defs);
    shown.push(r.result.text.trim());
  }
  const b = (await nodeHost());
  b.restore(log);
  return `shown ${shown.join(" | ")}; log ${JSON.stringify(log.map((e) => e.cmds))}; after relaunch g(2) = ${b.cas("g(2)", defaultCasSettings).result.text}, pZ = ${b.cas("pZ", defaultCasSettings).result.text}`;
};
const replayed = await replay();

const CASES: [string, () => string, string][] = [
  ["text-1", () => home("approx(sin(10^30),2*10)"), "right: -0.0901169019121 (mpmath); the keys reach it (Shift + key: approx(…))"],
  ["text-2", () => home("floor((2^-(1/2)+3^-(1/2))^2-5/6-2*6^-(1/2)+1)"), "right: 1 (mpmath); the keyboard emits 2^(-1/2), which gives 1"],
  ["text-3", () => home("evalf((tanh)(1+i))"), "right: 1.08392332734+0.27175258532*i (mpmath); shown is coth, ≈"],
  ["text-4", () => cas("seq(k^2,k=1..3)"), "right: [1,4,9]; `1..3` read as the decimals 1. and .3"],
  ["text-5", () => (home("a:=1"), home("a+=1")), "the store is not logged: a relaunch brings back a = 1"],
  ["text-6", () => home('"1.123456789012345678"'), "a string: shown rounded and marked"],
  ["text-7", () => solve("subst(t^2,t=x)-2"), "right: 1.41421356237 (x^2-2 gives it)"],
  ["text-8", () => lib("f(x):={ approx_mode(1); x }"), "should be refused: it switches the engine to decimals"],
  ["text-9", () => lib('f(x):={ local s; s:="a\\"b:=1"; x }'), "should be accepted: Giac reads \\\" inside a string"],
  ["log-1", () => replayed, "fine: the log keeps the typed text, so the relaunch gives g(2) = 3 and pZ = 2 although Giac prints the body without its bracket"],
  ["text-10", () => (home("B:=evalf(sqrt(2),5)"), home("int(B^2,B,0,1)")), "right: = 0.333333333333 (B is bound; int(x^2,x,0,1) gives =)"],
];

const want = new Set(process.argv.slice(2));
for (const [label, run, note] of CASES) if (!want.size || want.has(label)) console.log(`${label}: ${run()}\n    ${note}`);
