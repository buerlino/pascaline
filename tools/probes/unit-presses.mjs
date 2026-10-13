// SPDX-License-Identifier: GPL-3.0-or-later
// Probe (S1, P11 "units after the formula"): how many key presses it takes to type a unit into a unit slot, from the
// `unit_slot:` section of spec/keyboard.yaml and the keys' alpha letters. Prints the median over 50 common
// engineering units (the gate of P8 rule 2: median <= 4), the worst ten, every symbol the layout cannot type, a few
// whole tasks, and, when a qalc build is found, whether qalc reads each typed unit as meant and what it makes of the
// same letters in the wrong case. Results and reasoning: docs/research/r7-unit-slots.md.
//
//   node tools/probes/unit-presses.mjs                 flicks (P11: flick down = lower case, flick up = capital)
//   node tools/probes/unit-presses.mjs --taps          the G2 way only: Alpha, key = capital; Shift, Alpha, key = lower
//   node tools/probes/unit-presses.mjs --lower-lock    no flicks, but a slot starts in a lower-case letter lock (a tap on
//                                                      a letter key types its lower case, Alpha + key the capital; digit
//                                                      keys type digits only in an exponent, as in every mode): the
//                                                      fallback if flicks go
//   node tools/probes/unit-presses.mjs --no-auto-leave an exponent needs ▶ before the next unit
//   node tools/probes/unit-presses.mjs --read BTU lbm  what qalc's own parser reads for each text, and nothing else
//   QALC_OUT=<dir with qalc.mjs> node tools/probes/unit-presses.mjs   (default: engine/qalc/_out/dev of this checkout
//                                                                    or of the main checkout; skipped if none)
//
// Counting (docs/04 5.2): every press counts 1, a flick counts 1, Shift and Alpha count 1. The cursor starts in the
// empty slot; moving between slots is counted only in the tasks. Needs app/node_modules (the `yaml` package).
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const { parse: parseYaml } = createRequire(join(root, 'app/package.json'))('yaml');
const argv = process.argv.slice(2);
const args = new Set(argv);
const READ = argv[0] === '--read' ? argv.slice(1) : null;
const LOCK = args.has('--lower-lock');
const FLICKS = !args.has('--taps') && !LOCK;
const AUTO_LEAVE = !args.has('--no-auto-leave');

// ---- The list: 50 units an engineer types, each with why it is on the list. Sources:
//   SI2, SI4, SI5, SI6, SI8  SI Brochure, 9th edition (BIPM, V4.01, June 2026), Tables 2 (base units), 4 (the 22
//                            special names), 5 and 6 (examples of coherent derived units), 8 (non-SI units for use with the SI)
//   t01…t10                  tests/tasks/tasks.yaml (the owner's ten benchmark tasks, 2026-10-12)
//   FB8                      docs/feedback.md #8 (owner: "nanometres, fractions too")
//   P11                      docs/decisions.md P11 (the owner's examples: kg·m²/s³ → W, 72 km/h → m/s)
//   D04                      docs/04-architecture.md 4.1 (the qalc spike's probe cases)
//   G4                       the common prefixed units of Find's draft unit data (gorge, G4: find/units.yaml)
// `parts` is what the slot must mean, in qalc reference names: "pfx:unit^exp" (u = µ, oC = °C, deg = °, ohm = Ω).
// "Most common" is a judgement from these sources, not a measured frequency (to verify: the owner's own list).
const UNITS = [
  // length
  { u: 'm', parts: 'm', src: 'SI2' },
  { u: 'mm', parts: 'm:m', src: 't04' },
  { u: 'km', parts: 'k:m', src: 't02' },
  { u: 'µm', parts: 'u:m', src: 'G4' },
  { u: 'nm', parts: 'n:m', src: 'FB8' },
  { u: 'in', parts: 'in', src: 'D04' },
  { u: 'ft', parts: 'ft', src: 'D04' },
  // mass, time, current, temperature
  { u: 'kg', parts: 'k:g', src: 'SI2' },
  { u: 'g', parts: 'g', src: 'G4 (mg, µg)' },
  { u: 's', parts: 's', src: 'SI2' },
  { u: 'ms', parts: 'm:s', src: 'G4' },
  { u: 'min', parts: 'min', src: 'SI8' },
  { u: 'h', parts: 'h', src: 'SI8, t02' },
  { u: 'A', parts: 'A', src: 'SI2' },
  { u: 'mA', parts: 'm:A', src: 'G4' },
  { u: 'K', parts: 'K', src: 'SI2' },
  { u: '°C', parts: 'oC', src: 'SI4, D04' },
  { u: '°F', parts: 'oF', src: 'D04' },
  // force, pressure, energy, power
  { u: 'N', parts: 'N', src: 'SI4' },
  { u: 'kN', parts: 'k:N', src: 'G4' },
  { u: 'Pa', parts: 'Pa', src: 'SI4' },
  { u: 'kPa', parts: 'k:Pa', src: 'G4' },
  { u: 'MPa', parts: 'M:Pa', src: 'G4' },
  { u: 'bar', parts: 'bar', src: 'SI8' },
  { u: 'psi', parts: 'psi', src: 'G4' },
  { u: 'J', parts: 'J', src: 'SI4' },
  { u: 'kWh', parts: 'k:W h', src: 'G4' },
  { u: 'W', parts: 'W', src: 'SI4, P11' },
  { u: 'kW', parts: 'k:W', src: 'G4' },
  // electrical, frequency, angle, volume, level
  { u: 'V', parts: 'V', src: 'SI4' },
  { u: 'Ω', parts: 'ohm', src: 'SI4' },
  { u: 'kΩ', parts: 'k:ohm', src: 't01, D04' },
  { u: 'µF', parts: 'u:F', src: 'D04' },
  { u: 'Hz', parts: 'Hz', src: 'SI4' },
  { u: '°', parts: 'deg', src: 'SI8' },
  { u: 'L', parts: 'L', src: 'SI8' },
  // compound units
  { u: 'm/s', parts: 'm s^-1', src: 'SI5, t02' },
  { u: 'km/h', parts: 'k:m h^-1', src: 't02, P11' },
  { u: 'm/s²', parts: 'm s^-2', src: 'SI5' },
  { u: 'N·m', parts: 'N m', src: 'SI6' },
  { u: 'kg/m³', parts: 'k:g m^-3', src: 'SI5' },
  { u: 'm²', parts: 'm^2', src: 'SI5, t10' },
  { u: 'm³', parts: 'm^3', src: 'SI5' },
  { u: 'Pa·s', parts: 'Pa s', src: 'SI6' },
  { u: 'W/(m·K)', parts: 'W m^-1 K^-1', src: 'SI6' },
  { u: 'J/(kg·K)', parts: 'J k:g^-1 K^-1', src: 'SI6' },
  { u: 'W/m²', parts: 'W m^-2', src: 'SI6' },
  { u: 'rad/s', parts: 'rad s^-1', src: 'SI6' },
  { u: 'L/min', parts: 'L min^-1', src: 'SI8 (litre and minute)' },
  { u: 'kg·m²/s³', parts: 'k:g m^2 s^-3', src: 'P11' },
];

// Not in the median: units that show what the layout cannot type, or that cost the most.
const EXTRA = [
  { u: 'Å', parts: 'angstrom', src: 'SI8' },
  { u: '′', parts: 'arcmin', src: 'SI8' },
  { u: '″', parts: 'arcsec', src: 'SI8' },
  { u: '%', parts: 'percent', src: 'ours (efficiency, tolerance)' },
  { u: 'Δ°C', parts: 'K', src: 'docs/04 4.3 (temperature difference)' },
  { u: 'mmH₂O', parts: 'mmH2O', src: 'ours (fans, ducts)' },
  { u: 'nV/√Hz', parts: 'n:V Hz^-0.5', src: 'ours (noise density)' },
  { u: 'MΩ', parts: 'M:ohm', src: 'G4' },
  { u: 'µs', parts: 'u:s', src: 'G4' },
  { u: 'K⁻¹', parts: 'K^-1', src: 'SI6 (J K⁻¹); thermal expansion' },
  { u: 'mm²/s', parts: 'm:m^2 s^-1', src: 'ours (kinematic viscosity)' },
  { u: 'W/(m²·K)', parts: 'W m^-2 K^-1', src: 'ours (heat transfer coefficient)' },
  { u: 'lbf', parts: 'lbf', src: 'D04' },
  { u: 'eV', parts: 'eV', src: 'SI8, D04' },
  { u: 'dB', parts: 'dB', src: 'SI8, D04' },
];

// ---- The layout
const kb = parseYaml(readFileSync(join(root, 'spec/keyboard.yaml'), 'utf8'));
const slot = kb.unit_slot;
if (!slot) throw new Error('spec/keyboard.yaml has no unit_slot: section');
const letterKey = new Map(); // 'A'..'Z' -> key id
const digitKey = new Map(); // '0'..'9' -> key id
for (const k of kb.keys) {
  const a = k.alpha?.type;
  if (typeof a === 'string' && /^[A-Z]$/.test(a)) letterKey.set(a, k.id);
  const p = k.primary?.type;
  if (typeof p === 'string' && /^[0-9]$/.test(p)) digitKey.set(p, k.id);
}
const symbolKey = new Map(slot.symbols.map((s) => [s.tap, s.key]));
const opKeys = new Map(slot.ops.map((o) => [o.text, o.keys]));
const autoLeave = AUTO_LEAVE && slot.exponent_leave === 'auto';
const SUP = { '²': '2', '³': '3', '⁴': '4' };

// Turns a unit as written into presses (key ids, ↓ = flick down, ↑ = flick up) and the text qalc gets.
function typeUnit(u) {
  const presses = [];
  const missing = [];
  let qalc = '';
  let inExp = false; // the cursor is in an exponent
  let inRoot = false; // the cursor is in a √
  let skipClose = 0; // parentheses after ÷ are not typed: the denominator collects the rest of the slot
  const leave = () => {
    if (inExp && !autoLeave) presses.push('right');
    if (inRoot) { presses.push('right'); qalc += ')'; inRoot = false; }
    inExp = false;
  };
  const chars = [...u];
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    if (/[A-Za-z]/.test(c)) {
      if (inExp) leave();
      const key = letterKey.get(c.toUpperCase());
      if (!key) { missing.push(c); continue; }
      const lower = c !== c.toUpperCase();
      if (FLICKS) presses.push((lower === (slot.letters.flick_down === 'lower') ? '↓' : '↑') + key);
      else if (LOCK) presses.push(...(lower ? [key] : ['alpha', key]));
      else presses.push(...(lower ? ['shift', 'alpha', key] : ['alpha', key]));
      qalc += c;
    } else if (symbolKey.has(c)) {
      if (inExp) leave();
      presses.push(symbolKey.get(c));
      qalc += c;
    } else if (c === '(' && skipClose > 0) {
      qalc += c;
    } else if (c === ')' && skipClose > 0) {
      skipClose--;
      qalc += c;
    } else if (c === '/' || c === '·') {
      if (inExp || inRoot) leave();
      presses.push(...opKeys.get(c));
      qalc += c === '/' ? '/' : '*';
      if (c === '/' && chars[i + 1] === '(') skipClose++;
    } else if (c in SUP) {
      if (c === '²') presses.push(...opKeys.get('²'));
      else presses.push(...opKeys.get('^'), digitKey.get(SUP[c]));
      inExp = true;
      qalc += '^' + SUP[c];
    } else if (c === '⁻' && chars[i + 1] === '¹') {
      presses.push(...opKeys.get('⁻¹'));
      qalc += '^-1';
      i++;
    } else if (c === '√') {
      presses.push(...opKeys.get('√'));
      qalc += 'sqrt(';
      inRoot = true;
    } else {
      missing.push(c);
    }
  }
  if (inRoot) qalc += ')';
  return { presses, missing, qalc };
}

// ---- Counting (skipped with --read)
if (READ) await readOnly();
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const n = s.length;
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
};
const rows = UNITS.map((x) => ({ ...x, ...typeUnit(x.u) }));
const extra = EXTRA.map((x) => ({ ...x, ...typeUnit(x.u) }));
const counts = rows.map((r) => r.presses.length);
const isCompound = (u) => /[/·²³⁻]/.test(u);
const single = rows.filter((r) => !isCompound(r.u)).map((r) => r.presses.length);
const compound = rows.filter((r) => isCompound(r.u)).map((r) => r.presses.length);

console.log(`unit slot press count (${FLICKS ? 'flicks' : LOCK ? 'no flicks, lower-case lock in the slot' : 'taps only, the G2 way'}; exponent leave: ${autoLeave ? 'auto' : '▶'})`);
console.log(`  ${rows.length} units: median ${median(counts)}, mean ${(counts.reduce((a, b) => a + b, 0) / counts.length).toFixed(2)}, max ${Math.max(...counts)}`);
console.log(`  ${single.length} single units: median ${median(single)}; ${compound.length} compound units: median ${median(compound)}`);
console.log(`  gate (P8 rule 2, median <= 4): ${median(counts) <= 4 ? 'PASS' : 'FAIL'}`);
const hist = {};
for (const n of counts) hist[n] = (hist[n] ?? 0) + 1;
console.log(`  presses: ${Object.entries(hist).map(([n, k]) => `${n}:${k}`).join('  ')}`);

console.log('\nworst ten');
for (const r of [...rows].sort((a, b) => b.presses.length - a.presses.length).slice(0, 10))
  console.log(`  ${String(r.presses.length).padStart(2)}  ${r.u.padEnd(10)} ${r.presses.join(' ')}`);

console.log('\nall 50');
for (const r of rows) console.log(`  ${String(r.presses.length).padStart(2)}  ${r.u.padEnd(10)} ${r.presses.join(' ').padEnd(44)} ${r.src}`);

console.log('\nextra units (not in the median)');
for (const r of extra)
  console.log(`  ${String(r.presses.length).padStart(2)}  ${r.u.padEnd(10)} ${r.presses.join(' ').padEnd(44)} ${r.missing.length ? 'CANNOT TYPE ' + r.missing.join(' ') : ''}`);
const missing = new Set([...rows, ...extra].flatMap((r) => r.missing));
console.log(`\nsymbols the layout cannot type: ${missing.size ? [...missing].join(' ') : 'none'}`);
if (rows.some((r) => r.missing.length)) console.log('  (some are in the 50: their counts above are too low)');

// ---- Whole tasks (cursor and slot moves counted). The units key is Shift + Tmpl, or one flick up on Tmpl.
const unitsKey = FLICKS ? ['↑tmpl'] : ['shift', 'tmpl'];
const pi = FLICKS ? ['↑d3'] : ['shift', 'd3'];
const t = (name, budget, seq) => console.log(`  ${String(seq.length).padStart(2)}  ${name}${budget ? `  (tasks.yaml plan: ${budget})` : ''}`);
const P = (u) => typeUnit(u).presses;
console.log('\ntasks (sequences built from the same rules; docs/research/r7-unit-slots.md section 4)');
t('t02 72, units key, km/h → m/s', 15, ['d7', 'd2', ...unitsKey, ...P('km/h'), 'right', ...P('m/s'), 'enter']);
t('t02 72, units key, km/h, no end slot (result 20 m/s)', null, ['d7', 'd2', ...unitsKey, ...P('km/h'), 'enter']);
t('t04 2×π×25 then units: mm on 25, → m', 14, ['d2', 'mul', ...pi, 'mul', 'd2', 'd5', ...unitsKey, 'right', ...P('mm'), 'right', ...P('m'), 'enter']);
t('t04 the same, no end slot', null, ['d2', 'mul', ...pi, 'mul', 'd2', 'd5', ...unitsKey, 'right', ...P('mm'), 'enter']);
t('P11 kg·m²/s³ → W, empty line (unit check)', null, [...unitsKey, ...P('kg·m²/s³'), 'right', ...P('W'), 'enter']);
t('baseline 72 ÷ 3.6 (no unit checked)', 7, ['d7', 'd2', 'div', 'd3', 'dot', 'd6', 'enter']);

// ---- qalc: is each typed unit read as meant, and what do the same letters in the wrong case give?
function findQalc() {
  const cands = [process.env.QALC_OUT, join(root, 'engine/qalc/_out/dev')];
  try {
    const common = execFileSync('git', ['-C', root, 'rev-parse', '--path-format=absolute', '--git-common-dir'], { encoding: 'utf8' }).trim();
    cands.push(join(dirname(common), 'engine/qalc/_out/dev'));
  } catch { /* not a git checkout */ }
  return cands.find((d) => d && existsSync(join(d, 'qalc.mjs')));
}
async function readOnly() {
  const dir = findQalc();
  if (!dir) throw new Error('no qalc.mjs: build engine/qalc/build-wasm.sh dev or set QALC_OUT');
  const q = await (await import(pathToFileURL(join(dir, 'qalc.mjs')).href)).default();
  q._qalc_init();
  const parse = q.cwrap('qalc_parse', 'string', ['string']);
  const print = q.cwrap('qalc_print', 'string', ['string']);
  for (const e of READ) console.log(`${e.padEnd(12)} ${print(e).padEnd(16)} ${partsOf(JSON.parse(parse(e)))}`);
  process.exit(0);
}
const qdir = findQalc();
if (!qdir) {
  console.log('\nqalc: skipped (no qalc.mjs; build engine/qalc/build-wasm.sh dev or set QALC_OUT)');
  process.exit(0);
}
const m = await (await import(pathToFileURL(join(qdir, 'qalc.mjs')).href)).default();
m._qalc_init();
const qparse = m.cwrap('qalc_parse', 'string', ['string']);
const qeval = m.cwrap('qalc_eval', 'string', ['string', 'number']);

// A parse tree as "pfx:unit^exp" parts, sorted; anything that is not a unit shows as ?name.
function partsOf(tree, dropNumbers = false) {
  const acc = new Map();
  const add = (k, e) => acc.set(k, (acc.get(k) ?? 0) + e);
  const walk = (t, e) => {
    if (t.t === 'unit') add((t.pfx ? t.pfx + ':' : '') + t.u, e);
    else if (t.t === 'mul') t.c.forEach((c) => walk(c, e));
    else if (t.t === 'pow' && t.c[1].t === 'num') walk(t.c[0], e * (Number(t.c[1].p) / Number(t.c[1].q)));
    else if (t.t === 'fn' && t.f === 'sqrt' && t.c.length === 1) walk(t.c[0], e / 2);
    else if (t.t === 'num' && ((t.p === '1' && t.q === '1') || dropNumbers)) { /* the 1 of 1/s; a factor in SI base units */ }
    else add('?' + (t.s ?? t.v ?? t.f ?? t.t), e);
  };
  walk(tree, 1);
  return [...acc].filter(([, e]) => e !== 0).map(([k, e]) => (e === 1 ? k : `${k}^${e}`)).sort().join(' ');
}
const canon = (p) => p.split(' ').sort().join(' ');
const reading = (text) => partsOf(JSON.parse(qparse(text)));
const base = (text) => partsOf(JSON.parse(qeval(text, 2)).tree, true);

console.log(`\nqalc (${qdir}): each unit as typed, read by qalc's own parser`);
let bad = 0;
for (const r of [...rows, ...extra].filter((x) => !x.missing.length)) {
  const got = reading(r.qalc);
  if (got !== canon(r.parts)) {
    bad++;
    console.log(`  MISREAD  ${r.u.padEnd(10)} qalc text ${r.qalc.padEnd(12)} reads ${got}, meant ${r.parts}`);
  }
}
console.log(`  ${bad === 0 ? 'every typed unit reads as meant' : `${bad} misread (our whitelist must take these, not qalc's parser)`}`);

// The same letters in another case (ASCII letters only): caught (not a unit), or silently another unit? "SAME DIM" is
// the worst kind: the dimension matches, so neither the end slot nor a dimension check can see it; only the live
// reading under the slot shows it.
console.log('\nwrong case (single units of the list): caught = not a unit; silent = another valid unit, with its SI base dimension');
const flip = (ch) => (ch === ch.toUpperCase() ? ch.toLowerCase() : ch.toUpperCase());
const variants = (s) => {
  const chars = [...s];
  const ascii = (f) => chars.map((ch) => (/[A-Za-z]/.test(ch) ? f(ch) : ch)).join('');
  const i = chars.findIndex((ch) => /[A-Za-z]/.test(ch));
  const first = chars.map((ch, j) => (j === i ? flip(ch) : ch)).join('');
  return [...new Set([ascii((c) => c.toLowerCase()), ascii((c) => c.toUpperCase()), first])].filter((v) => v !== s);
};
const seen = new Set();
const tally = { caught: 0, silent: 0, same: 0 };
for (const r of rows.filter((x) => !isCompound(x.u) && /[A-Za-z]/.test(x.u))) {
  const dim = base(r.qalc);
  for (const v of variants(r.qalc)) {
    if (seen.has(v)) continue;
    seen.add(v);
    const got = reading(v);
    if (got === canon(r.parts)) continue; // same unit (l = L): harmless
    if (got.includes('?')) { tally.caught++; console.log(`  caught    ${r.u.padEnd(5)} typed ${v.padEnd(6)} reads ${got}`); continue; }
    const d = base(v);
    const kind = d === dim ? 'SAME DIM' : 'silent';
    tally[d === dim ? 'same' : 'silent']++;
    console.log(`  ${kind.padEnd(9)} ${r.u.padEnd(5)} typed ${v.padEnd(6)} reads ${got.padEnd(10)} dimension ${d || '1'}${d === dim ? '' : ` (meant ${dim})`}`);
  }
}
console.log(`  ${tally.caught} caught, ${tally.silent} silently another dimension, ${tally.same} silently the same dimension`);
