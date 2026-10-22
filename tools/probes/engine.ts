// SPDX-License-Identifier: GPL-3.0-or-later
// Probe: run inputs through the real engine host exactly as the app does, and print what the user would see.
//   node tools/probes/engine.ts 'sqrt(2)' '1/3'             # Home (exact-first), path, display, value, mark facts
//   MODE=cas node tools/probes/engine.ts '1-0.9-0.1'         # CAS view: Giac text and latex
//   MODE=raw node tools/probes/engine.ts 'Digits:=30' 'evalf(pi,40)'   # plain giac.eval, state kept between inputs
//   DIGITS=30 node tools/probes/engine.ts 'UTPN(10)'          # Home at another digits setting (workDigits = max(30, digits+10))
//   FACTS=1 MODE=cas node tools/probes/engine.ts 'evalf(x+sqrt(2))'   # also the mark facts (ValueFacts: exact, reliableDigits,
//                                                             # warn, full; CAS: approximate and numeric), as markOf reads them
// Engine: $GIAC_MJS, else $GIAC_OUT/giac.mjs, else engine/giac/_out/gsl (app/src/engine/nodeGiac.ts).
import { EngineHost } from "../../app/src/engine/host.ts";
import { loadNodeGiac } from "../../app/src/engine/nodeGiac.ts";
import { defaultHomeSettings } from "../../app/src/engine/homeEval.ts";
import { defaultCasSettings } from "../../app/src/engine/types.ts";
import type { DecimalValue } from "../../app/src/engine/format.ts";

const mode = process.env.MODE ?? "home";
const digits = Number(process.env.DIGITS ?? 12);
const angle = process.env.ANGLE === "deg" ? "deg" : "rad";
const facts = process.env.FACTS === "1";
const { giac } = await loadNodeGiac();
const host = new EngineHost(giac);

const dec = (v: DecimalValue): string => (v.digits === "" ? "0" : `${v.neg ? "-" : ""}0.${v.digits}e${v.exp + 1}${v.sticky ? " (more digits)" : ""}`);

for (const input of process.argv.slice(2)) {
  const t0 = performance.now();
  if (mode === "raw") {
    console.log(JSON.stringify(input), "=>", giac.eval(input));
    continue;
  }
  if (mode === "cas") {
    const r = host.cas(input, { ...defaultCasSettings, digits, angle }).result;
    console.log(JSON.stringify(input), "=>", JSON.stringify({ ok: r.ok, text: r.text, latex: r.latex, error: r.error }), `${(performance.now() - t0).toFixed(1)} ms`);
    if (facts) console.log("   facts", JSON.stringify({ approximate: r.approximate, facts: r.facts, numeric: r.numeric ? { display: r.numeric.display, facts: r.numeric.facts, full: r.numeric.full.slice(0, 60) } : undefined }));
    continue;
  }
  const r = host.home(input, { ...defaultHomeSettings, digits, angle, workDigits: Math.max(30, digits + 10) }).result;
  const ms = (performance.now() - t0).toFixed(1);
  console.log(JSON.stringify(input), "=>", JSON.stringify({ ok: r.ok, path: r.path, display: r.display, approximate: r.approximate, tieRisk: r.tieRisk, exact: r.exact?.slice(0, 80), error: r.error }));
  if (r.value) console.log("   value re", dec(r.value.re), r.value.im.digits ? `im ${dec(r.value.im)}` : "", `${ms} ms`);
  if (facts) console.log("   facts", JSON.stringify({ facts: r.facts, rational: r.rational, items: r.items?.length, full: r.full.slice(0, 60), fullLength: r.full.length, exactLength: r.exact?.length }));
}
