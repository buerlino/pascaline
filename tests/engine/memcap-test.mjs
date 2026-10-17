// SPDX-License-Identifier: GPL-3.0-or-later
// G24 (F32): a CAS job that keeps allocating must end (an exception out of giac_eval, or an error result), not hang
// or grow past the cap, and a fresh instance must work afterwards. The wasm heap is capped at 1 GB
// (-sMAXIMUM_MEMORY in build-wasm.sh); the worker turns the failure into "Out of memory" and restarts.
//   node memcap-test.mjs            # VARIANT=gsl (default) | base; GIAC_MJS=<path> overrides
const mjs = process.env.GIAC_MJS ?? `../../engine/giac/_out/${process.env.VARIANT ?? "gsl"}/giac.mjs`;
const { default: create } = await import(new URL(mjs, import.meta.url).href);
globalThis.UI = { add_evalf: 0, js_bigint: 0, disable3d: -1, Datestart: Date.now() };
const CAP = 1024 * 1024 * 1024;
const HOG = "makemat(1,30000,30000)"; // 900 million entries: far past 1 GB

async function fresh() {
  const M = await create({ print: () => {}, printErr: () => {} });
  M.cwrap("giac_init", "number", [])();
  return { M, ev: M.cwrap("giac_eval", "string", ["string"]) };
}
const failures = [];
const a = await fresh();
const t = performance.now();
let outcome = "returned";
try {
  const r = a.ev(HOG);
  if (!/error|undef|memory/i.test(r)) failures.push(`${HOG} returned a value: ${r.slice(0, 60)}`);
} catch {
  outcome = "threw";
}
const ms = performance.now() - t;
const bytes = (a.M.wasmMemory ?? a.M.asm?.memory ?? a.M.wasmExports?.memory)?.buffer.byteLength;
if (bytes === undefined) failures.push("the module does not expose its memory (add wasmMemory to EXPORTED_RUNTIME_METHODS)");
else if (bytes > CAP) failures.push(`heap grew to ${(bytes / CAP).toFixed(2)} GB, past the cap`);
const b = await fresh(); // what the worker does after the failure: a new instance
if (b.ev("7*6") !== "42") failures.push("a fresh instance does not work after the failure");
console.log(`${HOG}: ${outcome} in ${ms.toFixed(0)} ms, heap ${bytes === undefined ? "?" : (bytes / 1048576).toFixed(0) + " MB"}`);
if (failures.length) {
  console.log("FAIL\n" + failures.join("\n"));
  process.exit(1);
}
console.log("memcap test passed");
