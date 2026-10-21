// SPDX-License-Identifier: GPL-3.0-or-later
// Probe (S5): score a unit pad arrangement by the weighted mean presses of the units engineers use
// (tools/probes/unit-weights.yaml, from unit-freq/count.mjs), with flicks and with taps only, and search for the best
// one under S5's rules. Prints the draft's score, the best found, what moved, the curve of base cells, and the user
// cells' defaults. Results and reasoning: docs/archive/r9-unit-pad.md.
//   node tools/probes/pad-arrange.mjs                 the draft (spec/unit-pad.yaml) against the best found
//   node tools/probes/pad-arrange.mjs --spec          also print the best as spec/unit-pad.yaml `units:` and `user:` blocks
//   node tools/probes/pad-arrange.mjs --draft FILE    compare with another arrangement (default spec/unit-pad.yaml, which
//                                                     holds the result since S5; the hand-drawn draft is in git:
//                                                     git show 239463e:spec/unit-pad.yaml > tools/probes/_out/draft.yaml)
//   node tools/probes/pad-arrange.mjs --field F       the field whose units the gate checks (default chemical_process_hvac)
//   node tools/probes/pad-arrange.mjs --no-tie        without the tie rule
//   node tools/probes/pad-arrange.mjs --weights FILE  another weights file (default tools/probes/unit-weights.yaml)
//   node tools/probes/pad-arrange.mjs --corpus-only   weights from the three fields only (drops the tasks and S1 shares)
//
// Counting (docs/04 5.2): a tap 1, a flick 1, Shift or Alpha 1; with taps only an up or down item is Shift or Alpha
// then the cell, 2. A unit that has no cell goes through Find inside the slot: Math, the fewest letters that make it
// Find's first hit (find-cost.mjs: app/src/find/rank.ts on today's index, units and prefixes only), Enter. A prefixed unit without a
// cell takes the cheaper of the prefix cell then Find on the unit, or Find on the prefixed item (kcal). No reach model:
// there is no measured data on which key costs more to reach, so every cell costs the same and only which units have
// a cell, and on which layer, changes the score. That is why the search below is exact (see `best`).
//
// Needs app/node_modules (the `yaml` package); Node 22 runs rank.ts directly.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const { parse: parseYaml, stringify } = createRequire(join(root, 'app/package.json'))('yaml');
const argv = process.argv.slice(2);
const opt = (name) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : null);
const SPEC = argv.includes('--spec');
const CORPUS_ONLY = argv.includes('--corpus-only');
const weightsFile = opt('--weights') ?? join(root, 'tools/probes/unit-weights.yaml');
const W = parseYaml(readFileSync(weightsFile, 'utf8'));
const draftFile = opt('--draft') ?? join(root, 'spec/unit-pad.yaml');
const draft = parseYaml(readFileSync(draftFile, 'utf8'));
const { indexItems, byId, findCost, UNKNOWN, pairItem } = await import(pathToFileURL(join(root, 'tools/probes/find-cost.mjs')).href);

// ---- The expressions and their weights
const parseParts = (c) => c.split(' ').map((t) => { const [n, e] = t.split('^'); const [p, u] = n.includes(':') ? n.split(':') : [null, n]; return { p, u, e: e === undefined ? 1 : Number(e) }; });
let EXPR = W.expressions.map((x) => ({ parts: x.parts, f: parseParts(x.parts), w: x.weight, src: x.sources }));
if (CORPUS_ONLY) { // the three fields only, each a third
  const tot = {}; for (const x of EXPR) for (const [s, n] of Object.entries(x.src)) tot[s] = (tot[s] ?? 0) + n;
  EXPR = EXPR.map((x) => ({ ...x, w: ['mechanical_civil', 'electrical', 'chemical_process_hvac'].reduce((a, s) => a + (x.src[s] ?? 0) / W.uses[s] / 3, 0) })).filter((x) => x.w > 0);
}
const WSUM = EXPR.reduce((a, x) => a + x.w, 0);

// ---- An arrangement: unit cells (tap, up, down), prefix cells, ops; all from one object
// ops are fixed (S5 rule 3): ÷ per (up ⁻¹), × , x² square (up √), xʸ cube (up fourth)
const OPS = { per: 'tap', square: 'tap', cube: 'tap', inverse: 'up', sqrt: 'up', fourth: 'up' };
const layerCost = (layer, flicks) => (layer === 'tap' ? 1 : flicks ? 1 : 2);
function index(arr) {
  const unit = new Map(), pfx = new Map();
  for (const c of arr.units) for (const l of ['tap', 'up', 'down']) if (c[l]) unit.set(c[l], l);
  for (const c of arr.prefixes) for (const l of ['tap', 'up', 'down']) if (c[l]) pfx.set(c[l], l);
  for (const c of arr.user ?? []) for (const l of ['tap', 'up', 'down']) if (c[l] && !unit.has(c[l])) unit.set(c[l], 'user-' + l);
  return { unit, pfx };
}
// The cost of one factor (prefix, unit, |exp|) and of an expression, as typePad in unit-presses.mjs types them.
function factorCost(ix, flicks, p, u, e) {
  let c = 0;
  if (e === 0.5) c += layerCost(OPS.sqrt, flicks);
  const onPad = ix.unit.has(u);
  const uc = onPad ? layerCost(ix.unit.get(u).replace('user-', ''), flicks) : null;
  const pc = p ? (ix.pfx.has(p) ? layerCost(ix.pfx.get(p), flicks) : findCost('pfx:' + p)) : 0;
  if (onPad) c += pc + uc;
  else {
    const fu = byId.has('unit:' + u) ? findCost('unit:' + u) : UNKNOWN;
    const item = p && pairItem(p, u);
    c += Math.min(pc + fu, item ? findCost(item) : Infinity);
  }
  if (e === 2) c += layerCost(OPS.square, flicks);
  else if (e === 3) c += layerCost(OPS.cube, flicks);
  else if (e === 4) c += layerCost(OPS.fourth, flicks);
  else if (e !== 1 && e !== 0.5) c += 2; // a power the pad has no cell for (rare)
  return c;
}
const PRODUCTS = { Wh: ['W', 'h'], Ah: ['A', 'h'], VA: ['V', 'A'] }; // a cell for a product replaces its two factors
function exprCost(ix, flicks, x) {
  let f = x.f.map((t) => ({ ...t }));
  for (const [cell, [a, b]] of Object.entries(PRODUCTS)) {
    if (!ix.unit.has(cell)) continue;
    const ia = f.findIndex((t) => t.u === a && t.e === 1), ib = f.findIndex((t) => t.u === b && t.e === 1 && !t.p);
    if (ia >= 0 && ib >= 0) { f[ia] = { ...f[ia], u: cell }; f.splice(ib, 1); }
    const ja = f.findIndex((t) => t.u === a && t.e === -1), jb = f.findIndex((t) => t.u === b && t.e === -1 && !t.p);
    if (ja >= 0 && jb >= 0) { f[ja] = { ...f[ja], u: cell }; f.splice(jb, 1); }
  }
  const num = f.filter((t) => t.e > 0), den = f.filter((t) => t.e < 0);
  let c = den.length ? layerCost(OPS.per, flicks) : 0;
  if (!num.length && den.length === 1 && den[0].e === -1) c = layerCost(OPS.inverse, flicks) - 0; // s⁻¹: unit then ⁻¹
  for (const t of num) c += factorCost(ix, flicks, t.p, t.u, t.e);
  for (const t of den) c += factorCost(ix, flicks, t.p, t.u, -t.e);
  return c;
}
function score(arr) {
  const ix = index(arr);
  const out = {};
  for (const flicks of [true, false]) {
    let s = 0;
    for (const x of EXPR) s += x.w * exprCost(ix, flicks, x);
    out[flicks ? 'flicks' : 'taps'] = s / WSUM;
  }
  return out;
}
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); const n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };

// ---- Quantities: Find's dimension, with the draft's partners kept on one cell (a reciprocal or close partner)
const dimOf = (u) => byId.get('unit:' + u)?.dim ?? { TR: 'kg1m2s-3', Ah: 'A1s1', VA: 'kg1m2s-3', var: 'kg1m2s-3', kip: 'kg1m1s-2' }[u] ?? '?';
const PARTNER = { S: 'ohm', Wb: 'T', rpm: 'Hz', Ah: 'C', rad: 'deg', VA: 'VA', var: 'VA' };
const quantity = (u) => (PARTNER[u] ? (u === 'VA' || u === 'var' ? 'apparent power' : dimOf(PARTNER[u])) : dimOf(u));
const Q_NAME = { m1: 'length', kg1: 'mass', s1: 'time', K1: 'temperature', A1: 'current', mol1: 'amount', rad1: 'angle', m3: 'volume', m2: 'area',
  'kg1m1s-2': 'force', 'kg1m-1s-2': 'pressure', 'kg1m2s-2': 'energy', 'kg1m2s-3': 'power', 'A-1kg1m2s-3': 'voltage', 'A-2kg1m2s-3': 'resistance',
  'A2kg-1m-2s4': 'capacitance', 'A-2kg1m2s-2': 'inductance', A1s1: 'charge', 'A-1kg1s-2': 'magnetic', 's-1': 'frequency', 'm1s-1': 'speed',
  'm2s-1': 'kinematic viscosity', 'kg1m-1s-1': 'viscosity', Np1: 'level', 'cd1rad2': 'luminous flux', 'm3s-1': 'volume flow', 'apparent power': 'apparent power' };
const SI = new Set(['m', 'g', 's', 'K', 'A', 'mol', 'cd', 'N', 'Pa', 'J', 'W', 'V', 'ohm', 'F', 'H', 'C', 'T', 'Hz', 'rad', 'S', 'Wb', 'L', 'deg', 'VA']);
const FAR_MORE = 2; // another unit takes the tap from the SI unit only when it is used at least twice as much

// ---- Each unit's weight as a factor (any prefix), from the expressions
const unitW = new Map();
for (const x of EXPR) for (const t of x.f) unitW.set(t.u, (unitW.get(t.u) ?? 0) + x.w);
for (const [cell, [a, b]] of Object.entries(PRODUCTS)) { // the weight a product cell would take
  const w = EXPR.filter((x) => x.f.some((t) => t.u === a && Math.abs(t.e) === 1) && x.f.some((t) => t.u === b && Math.abs(t.e) === 1 && !t.p)).reduce((s, x) => s + x.w, 0);
  if (w > 0) unitW.set(cell, w);
}

// ---- The search. With no reach model every cell costs the same, so an arrangement is: which quantities get a cell,
// which units sit on each cell, and which unit is on the tap. Under flicks every layer costs 1, so a unit's saving
// (its Find cost minus 1, times its weight) does not depend on where it sits; a cell's value is the sum of its three
// units' savings, and the n-th cell of a quantity holds its (3n-2)th to (3n)th most valuable units, worth no more than
// the cell before. So picking the 20 most valuable cells one at a time is optimal (an exchange argument), and the
// taps-only score then only decides the order within a cell, which the tap rule (SI unless another is used twice as
// much) and then weight settle. The product cells (Wh) and Find's prefixed items make the saving slightly
// non-additive, so a full rescore with one-swap local search checks the result afterwards.
function saving(u, ix0, wf = (x) => x.w) {
  // the score drop when u alone gets a tap cell (flicks), every other unit as in ix0 (prefixes on the pad);
  // wf gives an expression's weight (the user cells rank by the owner's field)
  const ix = { unit: new Map(ix0.unit), pfx: ix0.pfx };
  ix.unit.delete(u);
  const hits = (x) => x.f.some((t) => t.u === u) || (PRODUCTS[u] && x.f.some((t) => PRODUCTS[u].includes(t.u)));
  const before = EXPR.reduce((s, x) => s + (hits(x) ? wf(x) * exprCost(ix, true, x) : 0), 0);
  ix.unit.set(u, 'tap');
  const after = EXPR.reduce((s, x) => s + (hits(x) ? wf(x) * exprCost(ix, true, x) : 0), 0);
  return before - after;
}
function orderCell(units) {
  const s = [...units].sort((a, b) => (unitW.get(b) ?? 0) - (unitW.get(a) ?? 0));
  const si = s.find((u) => SI.has(u));
  if (si && s[0] !== si && (unitW.get(s[0]) ?? 0) < FAR_MORE * (unitW.get(si) ?? 0)) return [si, ...s.filter((u) => u !== si)];
  return s;
}
// The tie rule (S5 step 2: a tie goes to keeping a quantity's units on one cell): a further cell of a quantity that
// already has one loses to the first cell of a new quantity worth at least (1 - TIE) as much. 15 % because the counts
// carry that much noise: the cap per article (1, 3, 10, none) alone moves a cell's value by more than that (T 23.2,
// 20.4, 18.2, 13.8 per mille). --no-tie turns it off and gives the plain optimum.
const TIE = argv.includes('--no-tie') ? 0 : 0.15;
function best(nCells, prefixes, base = { unit: new Map() }) {
  const ix0 = { unit: base.unit, pfx: index({ units: [], prefixes }).pfx };
  const byQ = new Map();
  for (const u of unitW.keys()) {
    if (!byId.has('unit:' + u) && !PRODUCTS[u] && !['TR', 'kip', 'var'].includes(u)) continue;
    const q = quantity(u);
    if (q === 'm2' || q === 'm3s-1') continue; // area and flow are products of pad units (m ², m ³ ÷ h); cfm, gpm go to Find or a user cell
    const v = saving(u, ix0);
    if (v > 0) (byQ.get(q) ?? byQ.set(q, []).get(q)).push({ u, v });
  }
  const pool = [];
  for (const [q, list] of byQ) {
    list.sort((a, b) => b.v - a.v);
    for (let i = 0; i < list.length; i += 3) pool.push({ q, units: list.slice(i, i + 3).map((x) => x.u), v: list.slice(i, i + 3).reduce((s, x) => s + x.v, 0), n: i / 3 });
  }
  pool.sort((a, b) => b.v - a.v);
  // greedy: a quantity's chunks come out in order, since their values decrease
  const picked = [], placed = new Set(), ties = [];
  while (picked.length < nCells && pool.length) {
    let i = 0;
    if (placed.has(pool[0].q)) {
      const j = pool.findIndex((c) => !placed.has(c.q) && c.v >= (1 - TIE) * pool[0].v);
      if (j > 0) { ties.push({ won: pool[j], lost: pool[0] }); i = j; }
    }
    const [c] = pool.splice(i, 1);
    picked.push(c); placed.add(c.q);
  }
  return { cells: picked.map((c) => ({ quantity: Q_NAME[c.q] ?? c.q, units: orderCell(c.units), v: c.v })), next: pool.slice(0, 6), ties };
}
// The savings are measured against a pad: first an empty one, then the pad found, until the pad stops changing. That
// makes a product cell's value its real gain (Ah saves one press when A and h have cells, not a Find trip).
function bestIter(nCells, prefixes) {
  let base = new Map(), r, key = '';
  for (let i = 0; i < 6; i++) {
    r = best(nCells, prefixes, { unit: base });
    base = index(asArr(r.cells, prefixes)).unit;
    const k = [...base.keys()].sort().join(' ');
    if (k === key) break;
    key = k;
  }
  return r;
}
const asArr = (cells, prefixes) => ({ units: cells.map((c) => ({ quantity: c.quantity, tap: c.units[0], up: c.units[1], down: c.units[2] })), prefixes });

// One-swap local search: replace any unit on a cell by a unit of the same quantity that has no cell; keep a change
// only if it lowers the flicks score, then the taps-only score. Layers are not searched: under flicks every layer costs
// 1, and with taps only up and down both cost 2, so the only layer that matters is the tap, which the tap rule decides.
const better = (a, b) => a.flicks < b.flicks - 1e-12 || (Math.abs(a.flicks - b.flicks) <= 1e-12 && a.taps < b.taps - 1e-12);
function localCheck(arr) {
  let cur = score(arr), improved = [];
  const all = [...unitW.keys()];
  for (let round = 0; round < 3; round++) {
    let any = false;
    for (let k = 0; k < arr.units.length; k++) for (const l of ['tap', 'up', 'down']) {
      const c = arr.units[k];
      const onPad = new Set(arr.units.flatMap((x) => [x.tap, x.up, x.down]).filter(Boolean));
      for (const u of all) if (!onPad.has(u) && quantity(u) === quantity(c.tap)) {
        const t = { ...arr, units: arr.units.map((x, i) => (i === k ? { ...x, [l]: u } : x)) };
        const s = score(t); if (better(s, cur)) { improved.push(`${c[l] ?? '(empty)'} -> ${u}`); arr = t; cur = s; any = true; }
      }
    }
    if (!any) break;
  }
  return { arr, score: cur, improved };
}

// The final arrangement: each cell's tap by the tap rule (orderCell); up and down cost the same, so a unit that was on
// the draft keeps its layer, and a new one takes the free layer, the more used on up. Keys: no reach model, so where a
// cell sits is not scored; a quantity keeps the draft's key, except the cells PLACE puts next to their kin when the
// draft's cells freed those keys: magnetic flux density into the electricity row (A V Ω F T, where H was), speed and the
// second length cell into row 3 (where C and T were), the second pressure cell into row 9 beside Pa (Fmt's cell).
const PLACE = { magnetic: 'log', speed: 'tmpl', 'length 2': 'vars', 'pressure 2': 'fmt' };
const HOME = { 'apparent power': 'log', charge: 'vars', inductance: 'log' };
function finalize(arr, draftArr) {
  const draftLayer = new Map(), draftKey = new Map();
  for (const c of draftArr.units) { draftKey.set(c.quantity, c.key); for (const l of ['tap', 'up', 'down']) if (c[l]) draftLayer.set(c[l], l); }
  const seen = new Map();
  const cells = arr.units.map((c) => {
    const n = (seen.get(c.quantity) ?? 0) + 1; seen.set(c.quantity, n);
    const name = n > 1 ? `${c.quantity} ${n}` : c.quantity;
    const [tap, ...rest] = orderCell([c.tap, c.up, c.down].filter(Boolean));
    const cell = { key: undefined, quantity: name, tap };
    const free = ['up', 'down'];
    for (const u of rest) if (free.includes(draftLayer.get(u))) { cell[draftLayer.get(u)] = u; free.splice(free.indexOf(draftLayer.get(u)), 1); }
    for (const u of rest.filter((u) => !Object.values(cell).includes(u))) cell[free.shift()] = u;
    return cell;
  });
  const keys = new Set(draftArr.units.map((c) => c.key));
  for (const c of cells) if (PLACE[c.quantity] && keys.has(PLACE[c.quantity]) && !cells.some((d) => d.key === PLACE[c.quantity])) c.key = PLACE[c.quantity];
  for (const c of cells) if (!c.key && draftKey.has(c.quantity) && !cells.some((d) => d.key === draftKey.get(c.quantity))) c.key = draftKey.get(c.quantity);
  const used = new Set(cells.map((c) => c.key).filter(Boolean));
  const freed = draftArr.units.map((c) => c.key).filter((k) => !used.has(k));
  for (const c of cells.filter((c) => !c.key)) {
    const k = freed.includes(HOME[c.quantity]) ? HOME[c.quantity] : freed[0];
    c.key = k; freed.splice(freed.indexOf(k), 1);
  }
  const order = draftArr.units.map((c) => c.key);
  cells.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
  return { units: cells.map(({ key, quantity, tap, up, down }) => Object.fromEntries(Object.entries({ key, quantity, tap, up, down }).filter(([, v]) => v !== undefined))), prefixes: arr.prefixes };
}

// ---- Run
const fmt = (s) => `flicks ${s.flicks.toFixed(3)}, taps only ${s.taps.toFixed(3)}`;
const draftArr = { units: draft.units.filter((c) => c.tap), prefixes: draft.prefixes };
const draftScore = score(draftArr);
console.log(`weights: ${weightsFile.replace(root + '/', '')}${CORPUS_ONLY ? ' (three fields only)' : ''}; ${EXPR.length} unit expressions`);
console.log(`${draftFile.replace(root + '/', '')} (${draftArr.units.length} unit cells): weighted mean presses ${fmt(draftScore)}`);
const NCELLS = 20; // the draft's 19 unit cells and Fmt's cell, freed when the user cells moved to U1-U6
const greedy = bestIter(NCELLS, draft.prefixes);
const lc = localCheck(asArr(greedy.cells, draft.prefixes));
const bestArr = finalize(lc.arr, { units: draft.units.filter((c) => c.tap || c.key === 'fmt') });
const bestScore = score(bestArr);
console.log(`best found (${NCELLS} unit cells): ${fmt(bestScore)}; one-swap local search ${lc.improved.length ? 'changed ' + lc.improved.join(', ') : 'found nothing better'}`);
for (const t of greedy.ties.filter((t) => !greedy.cells.some((c) => c.units.includes(t.lost.units[0])))) console.log(`tie rule: ${Q_NAME[t.won.q] ?? t.won.q} (${t.won.units.join(' ')}, ${(t.won.v * 1000).toFixed(1)}) over a further ${Q_NAME[t.lost.q] ?? t.lost.q} cell (${t.lost.units.join(' ')}, ${(t.lost.v * 1000).toFixed(1)})`);
const valueOf = new Map(greedy.cells.map((c) => [c.units.slice().sort().join(' '), c.v]));
console.log('\ncells (key, quantity, tap ↑up ↓down; value = weighted presses saved per use, per mille):');
for (const c of bestArr.units) {
  const v = valueOf.get([c.tap, c.up, c.down].filter(Boolean).sort().join(' '));
  console.log(`  ${c.key.padEnd(6)} ${c.quantity.padEnd(16)} ${[c.tap, c.up && '↑' + c.up, c.down && '↓' + c.down].filter(Boolean).join(' ').padEnd(18)} ${v === undefined ? '' : (v * 1000).toFixed(1)}`);
}
console.log('next in line (no cell): ' + greedy.next.map((c) => `${Q_NAME[c.q] ?? c.q}: ${c.units.join(' ')} ${(c.v * 1000).toFixed(1)}`).join(' | '));

// The tap rule's cases: a quantity whose most used unit is not its SI unit
for (const c of greedy.cells) {
  const si = c.units.find((u) => SI.has(u)), top = [...c.units].sort((a, b) => unitW.get(b) - unitW.get(a))[0];
  if (si && top !== si) console.log(`tap rule, ${c.quantity}: ${top} is used ${(unitW.get(top) / unitW.get(si)).toFixed(2)}x as much as ${si} (the tap moves at ${FAR_MORE}x): tap ${c.units[0]}`);
}
const flip = (from, to) => ({ ...bestArr, units: bestArr.units.map((c) => (c.tap === from && [c.up, c.down].includes(to) ? { ...c, tap: to, [c.up === to ? 'up' : 'down']: from } : c)) });
const kc = score(flip('K', 'oC'));
if (bestArr.units.some((c) => c.tap === 'K')) console.log(`with oC on the tap instead of K: ${fmt(kc)} (taps only ${(bestScore.taps - kc.taps).toFixed(3)} better)`);

// The draft against the best: what moved
const where = (arr) => { const m = new Map(); for (const c of arr.units) for (const l of ['tap', 'up', 'down']) if (c[l]) m.set(c[l], l); return m; };
const dW = where(draftArr), bW = where(bestArr);
const gone = [...dW.keys()].filter((u) => !bW.has(u)), added = [...bW.keys()].filter((u) => !dW.has(u));
const moved = [...bW.keys()].filter((u) => dW.has(u) && dW.get(u) !== bW.get(u)).map((u) => `${u} ${dW.get(u)}→${bW.get(u)}`);
console.log(`\nleft the pad: ${gone.join(' ') || 'none'}\nnew on the pad: ${added.join(' ') || 'none'}\nanother layer: ${moved.join(', ') || 'none'}`);
const notInFind = [...bW.keys()].filter((u) => !byId.has('unit:' + u));
console.log(`pad ids Find lacks (G7): ${notInFind.join(' ') || 'none'}`);

// The curve: what each base cell is worth (fewer cells, the rest of the pad as found)
console.log('\nbase cells -> weighted mean (flicks, taps only); the cell given up is the least valuable');
for (let n = NCELLS; n >= NCELLS - 6; n--) {
  const s = score(asArr(bestIter(n, draft.prefixes).cells, draft.prefixes));
  console.log(`  ${String(n).padStart(2)} cells: ${s.flicks.toFixed(3)}, ${s.taps.toFixed(3)}`);
}

// ---- The user cells U1-U6 (the owner's decision, 2026-10-17: six keys in the top cluster, tap, up and down each, so
// 18 slots that take no base cell). Defaults: the units with no base cell that save the most over all fields (one pad
// for every field, no startup question: the owner's decision of 2026-10-17, which overrides S5's "the owner's units
// first"), grouped by quantity like the base cells (viscosity with kinematic viscosity), the commonest unit on the tap.
// The owner's field (--field, default chemical_process_hvac, the owner's; the owner's own list is assumed: the field's
// commonest units) is checked: its units all have a base cell, so none has to come first.
const FIELD = opt('--field') ?? 'chemical_process_hvac';
const fieldW = (x) => (x.src[FIELD] ?? 0) / W.uses[FIELD];
const ixBest = index(bestArr);
const onPad = new Set(bW.keys());
const candidates = [...unitW.keys()].filter((u) => !onPad.has(u) && !PRODUCTS[u] && (byId.has('unit:' + u) || ['TR', 'kip', 'var'].includes(u)));
const rank = (wf) => candidates.map((u) => ({ u, v: saving(u, ixBest, wf), q: Q_NAME[quantity(u)] ?? quantity(u) })).filter((x) => x.v > 1e-9).sort((a, b) => b.v - a.v);
const rField = rank(fieldW), rAll = rank((x) => x.w);
const show = (r) => r.slice(0, 18).map((x) => `${x.u} ${(x.v * 1000).toFixed(2)} ${x.q}`).join(' | ');
console.log(`\nunits without a base cell, saving per mille, ${FIELD}:\n  ${show(rField)}\nall fields:\n  ${show(rAll)}`);
// keys: chunks of one quantity (up to 3), ranked by the field's saving; then the rest of the slots by all fields
const USER_PARTNER = { 'kinematic viscosity': 'viscosity' };
const keyChunks = (r) => { const byQ = new Map(); for (const x0 of r) { const x = { ...x0, q: USER_PARTNER[x0.q] ?? x0.q }; (byQ.get(x.q) ?? byQ.set(x.q, []).get(x.q)).push(x); } const out = []; for (const [q, l] of byQ) for (let i = 0; i < l.length; i += 3) out.push({ q, units: l.slice(i, i + 3), v: l.slice(i, i + 3).reduce((s, x) => s + x.v, 0) }); return out.sort((a, b) => b.v - a.v); };
const NUSER = 6;
const userKeys = keyChunks(rAll).slice(0, NUSER);
const user = userKeys.map((k, i) => { const [tap, up, down] = k.units.map((x) => x.u); return Object.fromEntries(Object.entries({ key: 'u' + (i + 1), quantity: k.q, tap, up, down }).filter(([, v]) => v)); });
console.log('user cells (defaults):');
for (const c of user) console.log(`  ${c.key} ${c.quantity.padEnd(16)} ${[c.tap, c.up && '↑' + c.up, c.down && '↓' + c.down].filter(Boolean).join(' ')}`);
const withUser = { ...bestArr, user };
const sF = (arr) => { const ix = index(arr); let a = 0, b = 0, w = 0; for (const x of EXPR) { const fw = fieldW(x); if (!fw) continue; a += fw * exprCost(ix, true, x); b += fw * exprCost(ix, false, x); w += fw; } return { flicks: a / w, taps: b / w }; };
console.log(`with the user cells: all fields ${fmt(score(withUser))}; ${FIELD} ${fmt(sF(withUser))} (base pad alone: ${fmt(sF(bestArr))})`);
// the curve of user slots: the weighted mean as the slots fill in rank order (the field's ranking)
console.log(`user slots filled in rank order -> ${FIELD} weighted mean (flicks, taps only), all fields (flicks)`);
for (const n of [0, 1, 2, 3, 4, 6, 8, 10, 12, 15, 18]) {
  const slots = rAll.slice(0, n).map((x, i) => ({ [['tap', 'up', 'down'][Math.floor(i / 6)]]: x.u }));
  const arr = { ...bestArr, user: slots };
  const f = sF(arr), a = score(arr);
  console.log(`  ${String(n).padStart(2)}: ${f.flicks.toFixed(3)}, ${f.taps.toFixed(3)}; ${a.flicks.toFixed(3)}`);
}

// Each field alone (is the one pad fair to every field?): the draft, the best, the best with the user cells
const fieldScore = (arr, f) => { const ix = index(arr); let a = 0, b = 0, w = 0; for (const x of EXPR) { const fw = (x.src[f] ?? 0) / W.uses[f]; if (!fw) continue; a += fw * exprCost(ix, true, x); b += fw * exprCost(ix, false, x); w += fw; } return { flicks: a / w, taps: b / w }; };
console.log('\neach field alone (flicks, taps only): draft -> best -> best with the user cells');
for (const f of ['mechanical_civil', 'electrical', 'chemical_process_hvac']) {
  const r = [draftArr, bestArr, withUser].map((a) => fieldScore(a, f)).map((s) => `${s.flicks.toFixed(3)}, ${s.taps.toFixed(3)}`);
  console.log(`  ${f.padEnd(22)} ${r.join(' -> ')}`);
}

// ---- Gates (S5): S1's 50 medians, the weighted mean against the draft, the owner's units within 3 presses
const s1 = EXPR.filter((x) => x.src.s1);
for (const [name, arr] of [['draft', draftArr], ['best', bestArr], ['best + user cells', withUser]]) {
  const ix = index(arr);
  const m = (fl) => median(s1.map((x) => exprCost(ix, fl, x)));
  console.log(`${name}: S1's ${s1.length} units, median with flicks ${m(true)}, taps only ${m(false)}`);
}
const ixU = index(withUser);
const owner = EXPR.filter((x) => (x.src[FIELD] ?? 0) >= 2).sort((a, b) => fieldW(b) - fieldW(a));
const ownerUnits = owner.filter((x) => x.f.length === 1 && x.f[0].e === 1);
console.log(`the owner's single units: ${ownerUnits.map((x) => `${x.parts} ${exprCost(ixU, true, x)}/${exprCost(ixU, false, x)}`).join(', ')} (presses with flicks/taps only)`);
const over = owner.filter((x) => exprCost(ixU, true, x) > 3);
console.log(`the owner's units (assumed: the ${owner.length} expressions used at least twice in ${FIELD}): ${owner.length - over.length} take <= 3 presses with flicks; over 3: ${over.map((x) => `${x.parts} (${exprCost(ixU, true, x)})`).join(', ') || 'none'}`);
const overT = owner.filter((x) => exprCost(ixU, false, x) > 3);
console.log(`  taps only, over 3: ${overT.map((x) => `${x.parts} (${exprCost(ixU, false, x)})`).join(', ') || 'none'}`);
if (SPEC) console.log('\n' + stringify({ units: bestArr.units, user }, { lineWidth: 0 }));
