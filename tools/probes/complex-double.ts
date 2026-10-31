// SPDX-License-Identifier: GPL-3.0-or-later
// G140 probe: special functions at a non-real argument, Home at 12 and 30 digits, against the oracle (mpmath).
// For each input: Home's display, mark and reliableDigits; bridge-3's `doubles` flag of the exact result at P, P+20
// and P+60; whether the P+60 value of each part is exactly a binary64 (exact BigInt arithmetic).
//   node tools/probes/complex-double.ts ['Zeta(1/2+i)' …]
import { EngineHost } from "../../app/src/engine/host.ts";
import { loadNodeGiac } from "../../app/src/engine/nodeGiac.ts";
import { defaultHomeSettings, precisionFacts } from "../../app/src/engine/homeEval.ts";
import { markOf } from "../../app/src/engine/format.ts";
import { binary64Of } from "../../app/src/engine/binary64.ts";
import { decimalFromString } from "../../app/src/engine/format.ts";

const INPUTS = process.argv.length > 2 ? process.argv.slice(2) : [
  "Zeta(1/2+i)", "Gamma(1+i)", "Psi(1+i)", "Beta(1+i,2)", "erf(1+i)", "erfc(1+i)", "Ei(1+i)", "Si(1+i)", "Ci(1+i)",
  "LambertW(1+i)", "BesselJ(1,1+i)", "BesselY(1,1+i)", "Airy_Ai(1+i)", "Airy_Bi(1+i)",
];
const { giac, bridge } = await loadNodeGiac();
const host = new EngineHost(giac, bridge);
const P = 40;
for (const input of INPUTS) {
  for (const digits of [12, 30]) {
    const r = host.home(input, { ...defaultHomeSettings, digits, workDigits: Math.max(30, digits + 10) }).result;
    const m = r.ok ? markOf(precisionFacts(r), { mode: "STD", digits } as never) : null;
    console.log(`${input} @${digits}: ${m ? m.mark + (m.n !== undefined ? m.n : "") : "-"} ${r.display} rel=${r.facts.reliableDigits} warn=${r.facts.warn ?? ""} exact=${r.exact ?? ""}`);
  }
  giac.eval("Digits:=40");
  const v = bridge.value(input, [P, P + 20, P + 60]);
  const at = v.at?.[String(P + 60)]?.[0];
  const dyadic = at ? at.map((t) => { const d = decimalFromString(t, P + 60); return d && binary64Of(d, P + 60) !== null ? "binary64" : "mpfr"; }).join("/") : "none";
  console.log(`   kind=${v.kind} doubles=${JSON.stringify(v.doubles)} P+60: ${dyadic} ${at ? at.join(" | ").slice(0, 160) : ""}`);
}
