// SPDX-License-Identifier: GPL-3.0-or-later
// Smoke test for our source-built engine/giac/_out/giac.mjs in Node.
const variant = process.env.VARIANT ?? "gsl";
const { default: createGiacModule } = await import(`../../engine/giac/_out/${variant}/giac.mjs`);

globalThis.UI = { add_evalf: 0, js_bigint: 0, disable3d: -1, Datestart: Date.now() };
const t0 = performance.now();
const M = await createGiacModule({ print: () => {}, printErr: () => {} });
const tLoaded = performance.now();
const init = M.cwrap("giac_init", "number", []);
const evalS = M.cwrap("giac_eval", "string", ["string"]);
init();
console.log(`instantiate ${(tLoaded - t0).toFixed(0)} ms, init ${(performance.now() - tLoaded).toFixed(0)} ms`);
for (const s of process.argv.slice(2)) {
  const a = performance.now();
  const r = evalS(s);
  console.log(JSON.stringify(s), "=>", r, `(${(performance.now() - a).toFixed(1)} ms)`);
}
