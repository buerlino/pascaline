// SPDX-License-Identifier: GPL-3.0-or-later
// Regression test for patch 0002 (sub-second caseval timeout): heavy inputs under short budgets must
// end as a normal "interruption" result, never as an exception escaping caseval, and the engine must
// stay usable. `ckevery 1` (check the clock on every control_c call) is the harshest setting: before
// the fix, a second timeout fired while Giac unwound the first one and escaped as WebAssembly.Exception.
//   node interrupt-test.mjs            # VARIANT=gsl (default) | base; GIAC_MJS=<path> overrides
const mjs = process.env.GIAC_MJS ?? `../../engine/giac/_out/${process.env.VARIANT ?? "gsl"}/giac.mjs`;
const { default: create } = await import(new URL(mjs, import.meta.url).href);
globalThis.UI = { add_evalf: 0, js_bigint: 0, disable3d: -1, Datestart: Date.now() };

const heavy = [
  "sum((10001/10000)^k,k,1,2000)",
  "product((1001/1000)^k,k,1,300)",
  "sum(1/k,k,1,30000)",
  "expand((x+y+z+1)^40)",
];
const SLACK_MS = 200; // allowed overshoot past the budget (desktop)

let M, ev, value;
async function fresh() {
  M = await create({ print: () => {}, printErr: () => {} });
  M.cwrap("giac_init", "number", [])();
  ev = M.cwrap("giac_eval", "string", ["string"]);
  // G85: giac_value (the bridge) evaluates outside caseval and must interrupt as it does; skipped on an engine without it.
  value = typeof M._giac_value === "function" ? M.cwrap("giac_value", "string", ["string", "string"]) : null;
}
await fresh();
const failures = [];
for (const ck of [1, 10]) {
  for (const budget of [0.05, 0.2]) {
    ev(`timeout ${budget}`);
    ev(`ckevery ${ck}`);
    for (const [via, h] of heavy.flatMap((h) => [["giac_eval", h], ...(value ? [["giac_value", h]] : [])])) {
      const t = performance.now();
      try {
        const r = via === "giac_eval" ? ev(h) : JSON.parse(value(h, "12,32")).text;
        const ms = performance.now() - t;
        if (!/interrupt/i.test(r)) failures.push(`${h} (${via}, ck ${ck}, ${budget}s) not interrupted: ${r.slice(0, 60)}`);
        else if (ms > budget * 1000 + SLACK_MS) failures.push(`${h} (${via}, ck ${ck}, ${budget}s) took ${ms.toFixed(0)} ms`);
        const after = via === "giac_eval" ? ev("7*6") : JSON.parse(value("7*6", "12")).text;
        if (after !== "42") failures.push(`engine unusable after ${h} (${via}): 7*6 → ${after}`);
      } catch (e) {
        failures.push(`${h} (${via}, ck ${ck}, ${budget}s) escaped caseval: ${e}`);
        await fresh();
        ev(`timeout ${budget}`);
        ev(`ckevery ${ck}`);
      }
    }
  }
}
ev("timeout 15");
if (failures.length) {
  console.log(`FAIL ${failures.length}\n  ` + failures.join("\n  "));
  process.exit(1);
}
console.log(`PASS interrupt-test: ${heavy.length * 4 * (value ? 2 : 1)} interrupts${value ? " (giac_eval and giac_value)" : ""}, no escapes`);
