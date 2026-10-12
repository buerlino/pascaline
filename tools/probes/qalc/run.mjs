// SPDX-License-Identifier: GPL-3.0-or-later
// Runs the qalc probe built by link.sh. Each line: fraction form | decimal form | qalc's approximation flags.
//   node tools/probes/qalc/run.mjs '72 km/h to m/s' '1 m + 1 s' 'mu0'
//   QMODE=1 QPREC=30 node tools/probes/qalc/run.mjs '1 lbf to N'     # QMODE 0 try exact, 1 exact, 2 approximate
import { pathToFileURL } from 'node:url';

const out = new URL('../_out/qalc/qprobe.mjs', import.meta.url);
const mode = Number(process.env.QMODE ?? 0);
const prec = Number(process.env.QPREC ?? 12);
const m = await (await import(pathToFileURL(out.pathname).href)).default();
if (!m._qp_init()) throw new Error('qalc definitions did not load');
const qp = m.cwrap('qp', 'string', ['string', 'number', 'number']);
for (const e of process.argv.slice(2)) {
  const t = performance.now();
  console.log(`${e}  =>  ${qp(e, mode, prec)}  (${(performance.now() - t).toFixed(1)} ms)`);
}
