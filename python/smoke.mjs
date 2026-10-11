// SPDX-License-Identifier: GPL-3.0-or-later
// Desktop smoke test: node python/smoke.mjs [dir with micropython.mjs/.wasm]  (default python/_out/dev)
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
const dir = resolve(process.argv[2] ?? resolve(dirname(fileURLToPath(import.meta.url)), '_out/dev'));
const { loadMicroPython } = await import(pathToFileURL(resolve(dir, 'micropython.mjs')).href);
let out = '';
const mp = await loadMicroPython({ stdout: (s) => { out += s + '\n'; } });
mp.runPython('print(1+1)');
if (out.trim() !== '2') { console.error('FAIL: print(1+1) gave', JSON.stringify(out)); process.exit(1); }
out = '';
mp.runPython('import math, json');
mp.runPython('print(json.dumps([math.sqrt(4), 7//2]))');
if (out.trim() !== '[2.0, 3]') { console.error('FAIL: json/math gave', JSON.stringify(out)); process.exit(1); }
console.log('micropython smoke OK:', dir, readFileSync(resolve(dir, 'micropython.wasm')).length, 'bytes wasm');
