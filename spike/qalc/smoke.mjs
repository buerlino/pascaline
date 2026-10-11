// SPDX-License-Identifier: GPL-3.0-or-later
// P3 spike: node spike/qalc/smoke.mjs <out dir> [expr...]  -> prints timings and results.
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const dir = resolve(process.argv[2] ?? 'spike/qalc/_work/out');
const exprs = process.argv.slice(3);
const t0 = performance.now();
const factory = (await import(pathToFileURL(`${dir}/qalc.mjs`).href)).default;
const m = await factory();
const t1 = performance.now();
const ok = m._qalc_init();
const t2 = performance.now();
const calc = m.cwrap('qalc_calc', 'string', ['string']);
const first = calc('5 km/h to m/s');
const t3 = performance.now();
console.log(JSON.stringify({ instantiate_ms: +(t1 - t0).toFixed(1), init_ms: +(t2 - t1).toFixed(1),
  first_calc_ms: +(t3 - t2).toFixed(1), total_ms: +(t3 - t0).toFixed(1), init_ok: ok, first }));
for (const e of exprs) {
  const s = performance.now();
  const r = calc(e);
  console.log(`${e}  =>  ${r}   (${(performance.now() - s).toFixed(1)} ms)`);
}
