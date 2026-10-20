// SPDX-License-Identifier: GPL-3.0-or-later
// Probe (G58): time one Home Enter per input, through the engine host as the app calls it, and print the result.
//   timeout 20 node tools/probes/g58-hang.ts 'exp(1.5e8)'     # DIGITS=30, ANGLE=deg for other settings
import { EngineHost } from "../../app/src/engine/host.ts";
import { loadNodeGiac } from "../../app/src/engine/nodeGiac.ts";
import { defaultHomeSettings } from "../../app/src/engine/homeEval.ts";

const digits = Number(process.env.DIGITS ?? 12);
const angle = process.env.ANGLE === "deg" ? "deg" : "rad";
const settings = { ...defaultHomeSettings, digits, angle, workDigits: Math.max(30, digits + 10) } as const;
const { giac } = await loadNodeGiac();
const trace = process.env.TRACE === "1";
if (trace) {
  const evalOnce = giac.eval.bind(giac);
  giac.eval = (text: string) => {
    console.error(`  >>> ${text.slice(0, 100)}`);
    const t0 = performance.now();
    const out = evalOnce(text);
    console.error(`  ${(performance.now() - t0).toFixed(0).padStart(5)} ms  ${text.slice(0, 100)} -> ${out.slice(0, 60)}`);
    return out;
  };
}
const host = new EngineHost(giac);
for (const input of process.argv.slice(2)) {
  const t0 = performance.now();
  const { result: r } = host.home(input, settings);
  const ms = performance.now() - t0;
  console.log(`${input.padEnd(40)} ${ms.toFixed(0).padStart(6)} ms  ${r.ok ? "" : `error ${r.error} `}${r.display.slice(0, 60)} r=${r.reliableDigits}`);
}
