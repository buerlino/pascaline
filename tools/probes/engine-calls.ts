// SPDX-License-Identifier: GPL-3.0-or-later
// Probe: Giac calls and desktop time per Home Enter, through the engine host as the app calls it. The call count does
// not depend on the machine's load, so two trees compare fairly (night check 2026-10-19, section 2.3).
//   node tools/probes/engine-calls.ts                  # the 15 default inputs, with a, b and f stored first
//   node tools/probes/engine-calls.ts 'sin(1)' 'f(b)'  # other inputs (a, b and f are still stored)
//   DIGITS=30 node tools/probes/engine-calls.ts        # another digits setting
// Run it in each tree to compare (a worktree of the older commit with a link to an app/node_modules).
// Engine: $GIAC_MJS, else $GIAC_OUT/giac.mjs, else engine/giac/_out/gsl (app/src/engine/nodeGiac.ts).
import { EngineHost } from "../../app/src/engine/host.ts";
import { loadNodeGiac } from "../../app/src/engine/nodeGiac.ts";
import { defaultHomeSettings } from "../../app/src/engine/homeEval.ts";

const DEFAULT_INPUTS = [
  "1/3", "2+3", "sqrt(2)", "sin(1)", "a*b+1", "f(3)", "f(b)", "exp(-0.5)", "atan(2)", "0.1+0.2",
  "int(x^2,x,0,1)", "normald_cdf(1.96)", "floor(2.7)", "round(2.25,1)", "a+b+f(a)",
];
const digits = Number(process.env.DIGITS ?? 12);
const settings = { ...defaultHomeSettings, digits, workDigits: Math.max(30, digits + 10) };
const { giac, bridge } = await loadNodeGiac();
let calls = 0;
const evalOnce = giac.eval.bind(giac);
giac.eval = (text: string) => {
  calls++;
  return evalOnce(text);
};
const host = new EngineHost(giac, bridge);
for (const setup of ["a:=2.5", "b:=sqrt(2)", "f(x):=x^2+a"]) host.home(setup, settings);

const inputs = process.argv.length > 2 ? process.argv.slice(2) : DEFAULT_INPUTS;
let total = 0;
for (const input of inputs) {
  const times: number[] = [];
  let count = 0;
  for (let k = 0; k < 5; k++) {
    calls = 0;
    const t0 = performance.now();
    host.home(input, settings);
    times.push(performance.now() - t0);
    count = calls;
  }
  times.sort((x, y) => x - y);
  total += count;
  console.log(`${input.padEnd(28)} calls ${String(count).padStart(3)}  median ${times[2]!.toFixed(1)} ms`);
}
console.log(`total calls ${total} (${inputs.length} inputs, digits ${digits})`);
