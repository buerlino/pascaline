// SPDX-License-Identifier: GPL-3.0-or-later
// P3 spike: libqalculate in its own module worker, as a lazily loaded engine would run.
import factory from './qalc.mjs';

const m = await factory();
const ok = m._qalc_init();
const calc = m.cwrap('qalc_calc', 'string', ['string']);
postMessage({ type: 'ready', ok });
onmessage = (e) => {
  const t = performance.now();
  const out = calc(e.data);
  postMessage({ type: 'result', out, ms: performance.now() - t });
};
