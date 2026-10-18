// SPDX-License-Identifier: GPL-3.0-or-later
// Shared by pad-arrange.mjs and unit-presses.mjs --weights: what a unit costs through Find inside a unit slot. Math,
// the fewest letters that make the item Find's first hit (app/src/find/rank.ts on today's index, units and prefixes
// only, units first), Enter. Infinity when no name of the item gets it to the top; UNKNOWN for an id Find lacks
// (package G7 adds it), counted as a long Find trip and listed by the callers.
// Node 22 runs rank.ts directly.
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const indexItems = JSON.parse(readFileSync(join(root, 'app/src/find/_gen/find-index.json'), 'utf8'));
const { prepare, search } = await import(pathToFileURL(join(root, 'app/src/find/rank.ts')).href);
const findIndex = prepare(indexItems);
export const byId = new Map(indexItems.map((it) => [it.id, it]));
export const UNKNOWN = 8;

const memo = new Map();
export function findCost(id) {
  if (memo.has(id)) return memo.get(id);
  const it = byId.get(id);
  let best = Infinity;
  if (it) for (const name of it.names) {
    const q = name.toLowerCase().replace(/[\s_]/g, '');
    if (!/^[a-z0-9]+$/.test(q)) continue;
    for (let n = 1; n <= q.length && n + 2 < best; n++) {
      const hit = search(findIndex, q.slice(0, n), { filter: ['unit', 'pfx'], prefer: ['unit'], limit: 1 })[0];
      if (hit?.item.id === id) { best = n + 2; break; }
    }
  }
  memo.set(id, best);
  return best;
}
// A unit's Find trip, or UNKNOWN when Find lacks it.
export const unitFind = (u) => (byId.has('unit:' + u) ? findCost('unit:' + u) : UNKNOWN);
// Find's item for a prefixed unit, if it has one (kcal, kWh, MJ, uF).
export const pairItem = (p, u) => (byId.has(`unit:${p}${u}`) ? `unit:${p}${u}` : null);
