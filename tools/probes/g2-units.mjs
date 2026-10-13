// SPDX-License-Identifier: GPL-3.0-or-later
// Probe (milestone 5 item 4): the units of Xcas's units menu (Giac source, doc/en/xcasmenu, Phys/<category>/...)
// against our Find index. For each it asks our Giac build what the unit is, `mksa(1_<name>)`, and compares that with
// the Find unit of that name (dimension and SI factor): the same, a different factor (Giac keeps an older or a wrong
// definition), or missing from Find. The menu itself does not come from here: spec/units-menu.yaml builds its grids
// from Find (the G2's flow, our data, 2026-10-13). What this finds: Giac sizes to report upstream (the US
// quart), names Giac does not read as units, and common units Find lacks.
//
//   node tools/probes/g2-units.mjs            one line per unit: category, name, verdict, Find id, Giac and Find factors
//   node tools/probes/g2-units.mjs --json     the same as JSON (tools/probes/_out/g2-units.json)
//
// Needs the Giac tarball (PASCALINE_DL_DIR, default engine/giac/_downloads; SHA-256 checked), a Giac build
// (GIAC_OUT, default engine/giac/_out/gsl) and a Find index (app/src/find/_gen/find-index.json: `cd app && npm run
// index`). Same factor = equal to 9 significant digits. Giac treats angles as dimensionless and Find keeps `rad`,
// so rad is left out of the dimension.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const TAR = join(process.env.PASCALINE_DL_DIR ?? join(REPO, 'engine/giac/_downloads'), 'giac-2.1.0.tar.gz');
const SHA = '1d9536e02ce6a336793ebf11c02b93f084e28af2350871914acafa60282b5a67';
const GIAC = join(resolve(process.env.GIAC_OUT ?? join(REPO, 'engine/giac/_out/gsl')), 'giac.mjs');
const INDEX = join(REPO, 'app/src/find/_gen/find-index.json');
for (const f of [TAR, GIAC, INDEX]) if (!existsSync(f)) { console.error(`missing: ${f}`); process.exit(2); }
if (createHash('sha256').update(readFileSync(TAR)).digest('hex') !== SHA) throw new Error(`SHA-256 mismatch: ${TAR}`);
const member = (name) => execFileSync('tar', ['-xzOf', TAR, name], { maxBuffer: 64 << 20 }).toString('utf8');

// Giac: mksa(1_<expr>) -> "<coeff>_(kg*m^-1.0*s^-2.0)", or the input back when the name is unknown.
globalThis.UI = { add_evalf: 0, js_bigint: 0, disable3d: -1, Datestart: Date.now() };
const M = await (await import(pathToFileURL(GIAC).href)).default({ print: () => {}, printErr: () => {} });
M.cwrap('giac_init', 'number', [])();
const giacEval = M.cwrap('giac_eval', 'string', ['string']);
function giacUnit(e) {
  const r = giacEval(`mksa(1_${e})`).trim();
  const m = r.match(/^([-+0-9.e]+)(?:_\(?(.*?)\)?)?$/);
  if (!m) return null;
  const dim = {};
  for (const t of (m[2] ?? '').split('*').filter(Boolean)) { const [b, x] = t.split('^'); dim[b] = x ? +x : 1; }
  return { f: +m[1], dim };
}

// Find: units by every name, SI prefixes by symbol. si is an exact text ("pi/180", "1/1000"); a unit without one
// is a known error in qalc's data (find/units.yaml `checks`), so it gets no factor here either.
const index = JSON.parse(readFileSync(INDEX, 'utf8'));
const num = (s) => (s == null ? NaN : Function(`const pi=Math.PI; return (${s.replace(/\^/g, '**')})`)());
const parseDim = (d) => Object.fromEntries([...(d ?? '').matchAll(/([A-Za-z]+)(-?\d+)/g)].map((m) => [m[1], +m[2]]));
const FIND = new Map(); const FPFX = {};
for (const it of index) {
  if (it.kind === 'unit') for (const n of [it.id.slice(5), ...it.names]) if (!FIND.has(n)) FIND.set(n, { id: it.id, f: num(it.si), dim: parseDim(it.dim) });
  if (it.kind === 'pfx' && !/i$/.test(it.id)) FPFX[it.id.slice(4)] = num(it.si);
}

// Giac name -> the Find name we would insert, where the two differ. Checked by factor below, so a wrong alias
// shows as a difference, never as a match.
const ALIAS = {
  Angstrom: 'Å', lyr: 'ly', fm: 'fathom', fath: 'fathom', chain: 'ch', rod: 'rd', mille: 'nmi', mn: 'min',
  yr: 'yr', kph: 'km/h', tr: 'rev', arcs: 'arcsec', Ohm: 'Ω', Kcal: 'kcal', torr: 'Torr', grad: 'gra', mho: 'S',
  ton: 's_ton', tonUK: 'l_ton', ct: 'carat', lbt: 'lb_t', ozt: 'oz_t', ozfl: 'fl_oz', ozUK: 'fl_oz_UK',
  liqpt: 'liq_pt', ptUK: 'pt_UK', qt: 'liq_qt', cu: 'cup_US', tbsp: 'tbsp_US', tsp: 'tsp_US', galUS: 'gal',
  galUK: 'gal_UK', galC: 'gal_UK', bu: 'bu_UK', buUS: 'bu', therm: 'thm_ISO', flam: 'foot_lambert',
  rd: 'rad_radioactivity', Rankine: '°R', inch: 'in', fermi: 'fm', ftUS: 'ft_US', miUS: 'mi_US', inH2O: 'inWC',
};
function findUnit(n) {
  const a = ALIAS[n] ?? n;
  if (FIND.has(a)) return FIND.get(a);
  for (const [p, v] of Object.entries(FPFX)) if (a.startsWith(p) && FIND.has(a.slice(p.length))) {
    const u = FIND.get(a.slice(p.length)); return { id: `${p}+${u.id}`, f: v * u.f, dim: u.dim };
  }
  return null;
}
// A menu entry "(km*h^-1)" or "kWh": a product of name^exp.
function findExpr(e) {
  let f = 1; const dim = {}; const ids = [];
  for (const t of e.replace(/^\(|\)$/g, '').split('*')) {
    const [n, x = '1'] = t.split('^'); const u = findUnit(n);
    if (!u) return null;
    f *= u.f ** +x; ids.push(x === '1' ? u.id : `${u.id}^${x}`);
    for (const [b, p] of Object.entries(u.dim)) dim[b] = (dim[b] ?? 0) + p * +x;
  }
  return { f, dim, id: ids.join('·') };
}

const sameDim = (a, b) => [...new Set([...Object.keys(a), ...Object.keys(b)])]
  .filter((k) => k !== 'rad').every((k) => (a[k] ?? 0) === (b[k] ?? 0));
const sig = (x) => Number(x.toPrecision(9));

// Xcas's units menu, category by category, in its order (Unit Prefix, Constants and Monetary are not units here).
const rows = [];
for (const l of member('giac-2.1.0/doc/en/xcasmenu').split('\n')) {
  const [top, cat, item] = l.split('/');
  if (top !== 'Phys' || !item?.startsWith('__') || ['Constants', 'Monetary'].includes(cat)) continue;
  const name = item.slice(2).trim();
  const g = giacUnit(name); const f = findExpr(name);
  const verdict = !g ? 'not-in-giac' : !f ? 'missing' : Number.isNaN(f.f) ? 'no-factor'
    : !sameDim(g.dim, f.dim) ? 'dim-differs' : sig(g.f) === sig(f.f) ? 'same' : 'factor-differs';
  rows.push({ cat, name, verdict, find: f?.id ?? null, giac: g && sig(g.f), ours: f && sig(f.f) });
}
if (process.argv.includes('--json')) {
  mkdirSync(join(REPO, 'tools/probes/_out'), { recursive: true });
  writeFileSync(join(REPO, 'tools/probes/_out/g2-units.json'), JSON.stringify(rows, null, 1));
}
for (const r of rows) console.log([r.cat.padEnd(12), r.name.padEnd(16), r.verdict.padEnd(14), String(r.find ?? '-').padEnd(26), r.giac ?? '', r.ours ?? ''].join(' '));
const count = {}; for (const r of rows) count[r.verdict] = (count[r.verdict] ?? 0) + 1;
console.log(`\n${rows.length} units:`, count);
