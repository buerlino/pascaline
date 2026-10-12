// SPDX-License-Identifier: GPL-3.0-or-later
// Probe (not the real ranking): per-keystroke cost and first hits of a tiered Find ranking over the rough index
// from extract.py. Desktop numbers only; the device number comes from ?bench=find.
//   node tools/probes/find/rank.mjs                 # timing over 20 queries x 20 rounds, then sample hits
//   node tools/probes/find/rank.mjs speed kph ohm   # first hits for your own queries
import { readFileSync } from 'node:fs';

const items = JSON.parse(readFileSync(new URL('../_out/find/index.json', import.meta.url), 'utf8'));
const prep = items.map((it, i) => ({ i, names: it.n.map((s) => s.toLowerCase()), words: (it.d ?? '').toLowerCase().split(/[^a-z0-9µμ°ω]+/).filter(Boolean) }));

/** Edit distance <= 1 (insertion, deletion, substitution, adjacent transposition). */
function ed1(a, b) {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  if (a.length === b.length) return a.slice(i + 1) === b.slice(i + 1) || (a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2));
  return a.length > b.length ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1);
}

function search(q) {
  q = q.toLowerCase();
  const out = [];
  for (const p of prep) {
    let s = 0;
    for (const n of p.names) {
      if (n === q) s = Math.max(s, 100);
      else if (n.startsWith(q)) s = Math.max(s, 80 - Math.min(10, n.length - q.length));
      else if (n.split('_').some((w) => w.startsWith(q))) s = Math.max(s, 60);
      else if (q.length >= 4 && ed1(q, n.slice(0, q.length + 1))) s = Math.max(s, 20);
    }
    if (s < 50 && p.words.some((w) => w.startsWith(q))) s = Math.max(s, 40);
    if (s > 0) out.push([s, p.i]);
  }
  out.sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  return out.slice(0, 8);
}

const show = (q) => console.log(q, '->', search(q).slice(0, 4).map(([s, i]) => `${items[i].k}:${items[i].n[0]}(${s})`).join(' '));
const own = process.argv.slice(2);
if (own.length) {
  own.forEach(show);
} else {
  const queries = ['s', 'sp', 'spe', 'spee', 'speed', 'kph', 'ohm', 'boltz', 'stdev', 'eps', 'c', 'in', 'inch', 'normald', 'normlad', 'factor', 'mu', 'µ', 'deg', 'det'];
  for (let k = 0; k < 3; k++) queries.forEach(search);
  const times = [];
  for (let k = 0; k < 20; k++) for (const q of queries) { const a = performance.now(); search(q); times.push(performance.now() - a); }
  times.sort((a, b) => a - b);
  console.log(JSON.stringify({ items: items.length, p50_ms: +times[times.length >> 1].toFixed(3), p95_ms: +times[Math.floor(times.length * 0.95)].toFixed(3), max_ms: +times.at(-1).toFixed(3) }));
  ['speed', 'kph', 'ohm', 'boltz', 'stdev', 'normlad', 'inch', 'eps'].forEach(show);
}
