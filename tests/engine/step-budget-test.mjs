// SPDX-License-Identifier: GPL-3.0-or-later
// Canary of patch 0004 (G82, the step budget): Giac's interrupt check counts its own calls, and `ckbudget N` interrupts
// after N of them, whatever the clock says. A heavy input under a step budget runs twice on a normal clock and twice on
// a clock that runs 8× fast (a device 8× slower, as Giac sees it): every run is interrupted after the same count of checks.
// With the budget off (`ckbudget 0`) the clock decides again, as before the patch. Fails on an engine without 0004.
//   node step-budget-test.mjs            # VARIANT=gsl (default) | base; GIAC_MJS=<path> overrides
const mjs = process.env.GIAC_MJS ?? `../../engine/giac/_out/${process.env.VARIANT ?? "gsl"}/giac.mjs`;
// emscripten_get_now reads performance.now at each call: scaling it slows the engine's clock without slowing the engine.
const realNow = performance.now.bind(performance);
let speed = 1;
let base = 0;
let shifted = 0;
performance.now = () => shifted + (realNow() - base) * speed;
const setSpeed = (k) => {
  shifted = performance.now();
  base = realNow();
  speed = k;
};
const { default: create } = await import(new URL(mjs, import.meta.url).href);
globalThis.UI = { add_evalf: 0, js_bigint: 0, disable3d: -1, Datestart: Date.now() };

const HEAVY = "sum((10001/10000)^k,k,1,2000)";
const BUDGET = 500; // checks; the whole sum takes about 50,000 (17 s on the desktop)
const M = await create({ print: () => {}, printErr: () => {} });
M.cwrap("giac_init", "number", [])();
const ev = M.cwrap("giac_eval", "string", ["string"]);
const value = typeof M._giac_value === "function" ? M.cwrap("giac_value", "string", ["string", "string"]) : null;
const failures = [];

const set = ev(`ckbudget ${BUDGET}`);
if (!new RegExp(`^Step budget ${BUDGET}$`).test(set)) failures.push(`ckbudget ${BUDGET} → ${set.slice(0, 60)} (no step budget in this engine)`);
if (failures.length) {
  // without the budget the sum would run to its end (17 s, six times): fail at once
  console.log(`FAIL step-budget-test ${failures.length}\n  ` + failures.join("\n  "));
  process.exit(1);
}
ev("timeout 600");
ev("ckevery 10");
const runs = [];
for (const [k, via] of [[1, "giac_eval"], [1, "giac_eval"], [8, "giac_eval"], [8, "giac_eval"], ...(value ? [[1, "giac_value"], [8, "giac_value"]] : [])]) {
  setSpeed(k);
  const r = via === "giac_eval" ? ev(HEAVY) : JSON.parse(value(HEAVY, "")).text;
  const count = ev("ckcount");
  runs.push({ k, via, count, interrupted: /interrupt/i.test(r) });
  if (ev("7*6") !== "42") failures.push(`engine unusable after the step budget (${via}, clock ×${k})`);
}
setSpeed(1);
const counts = new Set(runs.map((r) => r.count));
if (!runs.every((r) => r.interrupted)) failures.push(`not every run interrupted: ${JSON.stringify(runs)}`);
if (counts.size !== 1) failures.push(`the count differs between runs: ${JSON.stringify(runs)}`);
const [count] = counts;
if (!(Number(count) > BUDGET)) failures.push(`count ${count} not past the budget ${BUDGET}`);

// Off: the clock decides as before (0.2 s).
ev("ckbudget 0");
ev("timeout 0.2");
const off = ev(HEAVY);
if (!/interrupt/i.test(off)) failures.push(`with ckbudget 0 and timeout 0.2 the sum was not interrupted: ${off.slice(0, 60)}`);
ev("timeout 15");

if (failures.length) {
  console.log(`FAIL step-budget-test ${failures.length}\n  ` + failures.join("\n  "));
  process.exit(1);
}
console.log(`PASS step-budget-test: ${runs.length} runs interrupted at ${count} checks (budget ${BUDGET}, clock ×1 and ×8); with ckbudget 0 the 0.2 s clock interrupts`);
