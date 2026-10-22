// SPDX-License-Identifier: GPL-3.0-or-later
// Probe (S23, 2026-10-22): giac_parse (G85's bridge-2) on the store and binding forms the bridge moves rely on, and,
// for an argument starting with "!", what Giac itself prints for it (giac_eval). Run from app/ on an engine with the
// bridge exports (the shared engine since A28 rebuilt it after G85):
//   GIAC_OUT=<dir> node ../tools/probes/bridge-forms.ts            # the forms S23's packages cite
//   GIAC_OUT=<dir> node ../tools/probes/bridge-forms.ts '<text>' '!<giac input>' …
// Read-only; no network.
import { loadNodeGiac } from "../../app/src/engine/nodeGiac.ts";

const FORMS = [
  'expr("q:=5")', "bump(x):={ increment(cnt); return x; }", "bump(1)", "h(t):={local u; u:=t; DelVar(m); return u;}",
  "g(t):={n:=n+1;return t;}", "g2(t):=g(t)", 'k(t):={expr("q:=5");return t;}', "a+=1", "M[1,1]:=0", "(BesselJ(1,2))=>y",
  "purge(c)", "assume(x>0)", "restart(1)", "product(x,x,1,4)", "seq(x^2,x,1,3)", "sum(x^2,x=1..3)", "seq(x^2,x=1..3)",
  "limit(x^2,x,1)", "solve(x^2=4,x)", "diff(x^3,x)", "f(x):=x^-1",
  "!x:=3", "!diff(x^3,x)", "!product(x,x,1,4)", "!sum(x^2,x=1..3)", "!purge(x)",
];
const L = await loadNodeGiac();
const b = L.bridge;
if (!b) throw new Error("no bridge on this engine");
const args = process.argv.slice(2);
for (const t of args.length ? args : FORMS) {
  if (t.startsWith("!")) console.log(`giac  ${t.slice(1)} => ${L.giac.eval(t.slice(1))}`);
  else console.log(`parse ${t} => ${JSON.stringify(b.parse(t))}`);
}
