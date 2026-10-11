// SPDX-License-Identifier: GPL-3.0-or-later
// P3 spike: node spike/qalc/run-cases.mjs <out dir> <expr...>  -> JSON array of qalc outputs (for check.py).
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const factory = (await import(pathToFileURL(`${resolve(process.argv[2])}/qalc.mjs`).href)).default;
const m = await factory();
if (m._qalc_init() !== 1) throw new Error('qalc_init failed');
const calc = m.cwrap('qalc_calc', 'string', ['string']);
console.log(JSON.stringify(process.argv.slice(3).map((e) => calc(e))));
