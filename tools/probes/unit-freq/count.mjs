// SPDX-License-Identifier: GPL-3.0-or-later
// S5: how often engineers use each unit, counted offline from the articles that fetch.mjs cached (three fields,
// weighted equally), plus the task benchmark and S1's 50 units. Writes tools/probes/unit-weights.yaml, which
// pad-arrange.mjs and unit-presses.mjs --weights read. Results and reasoning: docs/archive/r9-unit-pad.md.
//   node tools/probes/unit-freq/count.mjs            counts, the top of each field, and the weights file
//   node tools/probes/unit-freq/count.mjs --misses   also the commonest unit-like words after a number that were not read
//
// What counts as a use: a number followed by a unit, written as symbols (12 kN, 3.5 W/(m²·K), 10-mm) or as words
// (12 kilowatts, 3 metres per second), and the input unit of Wikipedia's {{convert}}, {{cvt}} and {{val}} templates
// (the unit the author wrote; the converted output is not counted). A parenthesised conversion right after another
// unit, "100 km (62 mi)", is not counted either. A unit's factors are kept with their prefixes ("k:N", "W m^-2 K^-1",
// the same "pfx:unit^exp" form as unit-presses.mjs), so a compound counts as itself and through its factors.
// Unit ids are Find's (`unit:<id>`, `pfx:<id>`; u = µ); a unit that Find lacks is kept and listed for G7.
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../..');
const { parse, stringify } = createRequire(join(root, 'app/package.json'))('yaml');
const MISSES = process.argv.includes('--misses');
const CAP = process.argv.includes('--cap') ? Number(process.argv[process.argv.indexOf('--cap') + 1]) : 3; // at most N uses of one unit per article (S5's choice; --cap Infinity counts every use)
const OUT = process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : join(root, 'tools/probes/unit-weights.yaml');
const CTX = process.argv.includes('--ctx') ? process.argv[process.argv.indexOf('--ctx') + 1] : null; // print each use of one canonical unit
const cache = join(root, 'tools/probes/_out/unit-freq/cache');
const lock = parse(readFileSync(join(here, 'sources.lock.yaml'), 'utf8'));

// ---- Find's ids
const index = JSON.parse(readFileSync(join(root, 'app/src/find/_gen/find-index.json'), 'utf8'));
const FIND_UNITS = new Set(index.filter((x) => x.kind === 'unit').map((x) => x.id.slice(5)));
const FIND_PFX = new Set(index.filter((x) => x.kind === 'pfx').map((x) => x.id.slice(4)));

// ---- Symbols. A factor is [pfx, unit, exp]; a symbol maps to a list of factors.
const f = (unit, exp = 1, pfx = null) => [pfx, unit, exp];
// Units that take an SI prefix (their symbol, then the Find id).
const PREFIXABLE = {
  m: 'm', g: 'g', s: 's', A: 'A', K: 'K', mol: 'mol', cd: 'cd', N: 'N', Pa: 'Pa', J: 'J', W: 'W', V: 'V', Ω: 'ohm',
  F: 'F', H: 'H', C: 'C', T: 'T', Wb: 'Wb', Hz: 'Hz', L: 'L', l: 'L', eV: 'eV', S: 'S', lm: 'lm', lx: 'lx', Gy: 'Gy',
  Sv: 'Sv', Bq: 'Bq', bar: 'bar', cal: 'cal', t: 't',
};
// Products that also take a prefix (kWh, mAh, kVA): their factors.
const PREFIXABLE_PRODUCT = { Wh: [f('W'), f('h')], Ah: [f('A'), f('h')], VA: [f('V'), f('A')], var: [f('var')], VAr: [f('var')], var_: [f('var')] };
const PREFIX = { Y: 'Y', Z: 'Z', E: 'E', P: 'P', T: 'T', G: 'G', M: 'M', k: 'k', h: 'h', da: 'da', d: 'd', c: 'c', m: 'm', µ: 'u', μ: 'u', u: 'u', n: 'n', p: 'p', f: 'f' };
// Whole symbols, tried before prefix + unit (so Pa is not peta-are, min not milli-inch, cd not centi-day).
const WHOLE = {
  min: [f('min')], h: [f('h')], hr: [f('h')], hrs: [f('h')], d: [f('d')], sec: [f('s')],
  ft: [f('ft')], in: [f('in')], yd: [f('yd')], mi: [f('mi')], nmi: [f('nmi')], mil: [f('thou')], thou: [f('thou')],
  lb: [f('lb')], lbs: [f('lb')], lbm: [f('lb')], oz: [f('oz')], lbf: [f('lbf')], kgf: [f('kgf')], kip: [f('kip')], kips: [f('kip')],
  psi: [f('psi')], psia: [f('psi')], psig: [f('psi')], psid: [f('psi')], ksi: [f('ksi')], barg: [f('bar')], bara: [f('bar')],
  atm: [f('atm')], mmHg: [f('mmHg')], inHg: [f('inHg')], Torr: [f('Torr')], torr: [f('Torr')], inWC: [f('inWC')], mmWC: [f('mmWC')],
  mph: [f('mph')], kph: [f('m', 1, 'k'), f('h', -1)], kmh: [f('m', 1, 'k'), f('h', -1)], fps: [f('ft'), f('s', -1)],
  rpm: [f('rpm')], RPM: [f('rpm')], rps: [f('s', -1)], cfm: [f('cfm')], CFM: [f('cfm')], SCFM: [f('cfm')], scfm: [f('cfm')], gpm: [f('gpm')], GPM: [f('gpm')],
  BTU: [f('Btu')], Btu: [f('Btu')], hp: [f('hp')], bhp: [f('hp')], shp: [f('hp')], PS: [f('PS')],
  gal: [f('gal')], USgal: [f('gal')], impgal: [f('gal_UK')], bbl: [f('bbl')], cc: [f('m', 3, 'c')],
  '°C': [f('oC')], '℃': [f('oC')], '°F': [f('oF')], '℉': [f('oF')], '°R': [f('oR')], '°': [f('deg')], rad: [f('rad')], sr: [f('sr')],
  Å: [f('angstrom')], ha: [f('ha')], acre: [f('acre')], acres: [f('acre')], kn: [f('knot')], dB: [f('dB')], dBm: [f('dBm')],
  Nm: [f('N'), f('m')], kNm: [f('N', 1, 'k'), f('m')], MNm: [f('N', 1, 'M'), f('m')], RT: [f('TR')], TR: [f('TR')],
  Wh: [f('W'), f('h')], Ah: [f('A'), f('h')], VA: [f('V'), f('A')], mAh: [f('A', 1, 'm'), f('h')],
  µm: [f('m', 1, 'u')], um: [f('m', 1, 'u')], micron: [f('m', 1, 'u')], microns: [f('m', 1, 'u')],
  K: [f('K')], cP: [f('P', 1, 'c')], cSt: [f('St', 1, 'c')], Mt: null, kt: null, pH: null, Gt: null, Pt: null, // not units here
};
// The input unit codes of {{convert}} that are not plain symbols.
const CONVERT = {
  C: [f('oC')], F: [f('oF')], degC: [f('oC')], degF: [f('oF')], R: [f('oR')], 'e3BTU/h': [f('Btu'), f('h', -1)],
  sqft: [f('ft', 2)], sqin: [f('in', 2)], sqmi: [f('mi', 2)], sqyd: [f('yd', 2)], cuft: [f('ft', 3)], cuin: [f('in', 3)], cuyd: [f('yd', 3)],
  ft3: [f('ft', 3)], m3: [f('m', 3)], m2: [f('m', 2)], km2: [f('m', 2, 'k')], cm3: [f('m', 3, 'c')], cm2: [f('m', 2, 'c')], mm2: [f('m', 2, 'm')],
  LT: [f('l_ton')], ST: [f('s_ton')], 'short ton': [f('s_ton')], 'long ton': [f('l_ton')], t: [f('t')], MT: [f('t')],
  'lb.ft': [f('lbf'), f('ft')], 'lbf.ft': [f('lbf'), f('ft')], 'ft.lbf': [f('ft'), f('lbf')], 'ftlbf': [f('ft'), f('lbf')], 'lbft': [f('lbf'), f('ft')],
  'N.m': [f('N'), f('m')], 'Nm': [f('N'), f('m')], 'kN.m': [f('N', 1, 'k'), f('m')], 'kgm': [f('kgf'), f('m')], 'kg.m': [f('kgf'), f('m')], 'in.lb': [f('in'), f('lbf')], 'inlb': [f('in'), f('lbf')], 'in.lbf': [f('in'), f('lbf')],
  oilbbl: [f('bbl')], USgal: [f('gal')], impgal: [f('gal_UK')], usgal: [f('gal')], 'US gal': [f('gal')], USqt: [f('liq_qt')],
  kn: [f('knot')], knot: [f('knot')], 'km/h': [f('m', 1, 'k'), f('h', -1)], 'mi/h': [f('mph')], 'ft/s': [f('ft'), f('s', -1)],
  'e6cuft': [f('ft', 3)], 'e9cuft': [f('ft', 3)], 'e12cuft': [f('ft', 3)], 'e3cuft': [f('ft', 3)], 'e6m3': [f('m', 3)], 'e9m3': [f('m', 3)], 'e3m3': [f('m', 3)],
  'USgal/min': [f('gpm')], 'cuft/min': [f('cfm')], 'cuft/s': [f('cfs')], 'm3/s': [f('m', 3), f('s', -1)], 'm3/h': [f('m', 3), f('h', -1)],
  'kg/m3': [f('g', 1, 'k'), f('m', -3)], 'lb/cuft': [f('lb'), f('ft', -3)], 'g/cm3': [f('g'), f('m', -3, 'c')], 'lb/ft3': [f('lb'), f('ft', -3)],
  hp: [f('hp')], bhp: [f('hp')], PS: [f('PS')], mph: [f('mph')], ksi: [f('ksi')], psi: [f('psi')], kgf: [f('kgf')], lbf: [f('lbf')], shp: [f('hp')],
  'kgf/cm2': [f('kgf'), f('m', -2, 'c')], 'BTU/h': [f('Btu'), f('h', -1)], 'BTU/lb': [f('Btu'), f('lb', -1)], MBH: [f('Btu', 1, 'k'), f('h', -1)],
  tonne: [f('t')], tonnes: [f('t')], 'hp-h': [f('hp'), f('h')], 'kW.h': [f('W', 1, 'k'), f('h')], 'kWh': [f('W', 1, 'k'), f('h')],
};
// Words: SI prefix words and unit words (singular; plurals are derived), and words for powers.
const PREFIX_WORD = { yotta: 'Y', zetta: 'Z', exa: 'E', peta: 'P', tera: 'T', giga: 'G', mega: 'M', kilo: 'k', hecto: 'h', deca: 'da', deka: 'da', deci: 'd', centi: 'c', milli: 'm', micro: 'u', nano: 'n', pico: 'p', femto: 'f' };
const UNIT_WORD = {
  metre: 'm', meter: 'm', gram: 'g', gramme: 'g', second: 's', ampere: 'A', amp: 'A', kelvin: 'K', mole: 'mol', candela: 'cd', newton: 'N', pascal: 'Pa',
  joule: 'J', watt: 'W', volt: 'V', ohm: 'ohm', farad: 'F', henry: 'H', coulomb: 'C', tesla: 'T', weber: 'Wb', hertz: 'Hz', litre: 'L', liter: 'L',
  electronvolt: 'eV', siemens: 'S', lumen: 'lm', lux: 'lx', calorie: 'cal', tonne: 't', 'watt-hour': 'Wh', 'watt hour': 'Wh', 'ampere-hour': 'Ah', 'amp-hour': 'Ah', 'ampere hour': 'Ah', bar: 'bar',
  'volt-ampere': 'VA',
};
const PLAIN_WORD = { // no prefix
  minute: [f('min')], hour: [f('h')], day: [f('d')], foot: [f('ft')], feet: [f('ft')], inch: [f('in')], inches: [f('in')], yard: [f('yd')], mile: [f('mi')],
  pound: [f('lb')], 'pound-force': [f('lbf')], 'pounds-force': [f('lbf')], 'pound-foot': [f('lbf'), f('ft')], 'pound-feet': [f('lbf'), f('ft')], 'foot-pound': [f('ft'), f('lbf')],
  'pounds per square inch': [f('psi')], 'pound per square inch': [f('psi')], atmosphere: [f('atm')], horsepower: [f('hp')],
  'british thermal unit': [f('Btu')], gallon: [f('gal')], barrel: [f('bbl')], degree: [f('deg')], radian: [f('rad')],
  'degree celsius': [f('oC')], 'degrees celsius': [f('oC')], 'degree fahrenheit': [f('oF')], 'degrees fahrenheit': [f('oF')], 'degree rankine': [f('oR')],
  'revolutions per minute': [f('rpm')], 'revolution per minute': [f('rpm')], knot: [f('knot')], 'miles per hour': [f('mph')], 'mile per hour': [f('mph')],
  ton: [f('ton?')], 'refrigeration ton': [f('TR')], 'tons of refrigeration': [f('TR')], 'ton of refrigeration': [f('TR')], acre: [f('acre')], hectare: [f('ha')], decibel: [f('dB')], micron: [f('m', 1, 'u')],
};
const plural = (w) => (w.endsWith('s') || w.endsWith('z') ? [w] : w.endsWith('y') ? [w, w + 's'] : w.endsWith('ch') ? [w, w + 'es'] : [w, w + 's']);
const WORDS = new Map();
for (const [w, id] of Object.entries(UNIT_WORD)) {
  const facs = PREFIXABLE_PRODUCT[id] ?? [f(id)];
  for (const v of plural(w)) {
    WORDS.set(v, facs);
    for (const [pw, p] of Object.entries(PREFIX_WORD)) WORDS.set(pw + v, facs.map(([, u, e], i) => [i === 0 ? p : null, u, e]));
  }
  if (w.includes('-') || w.includes(' ')) { // watt-hours, ampere-hours
    const [a, b] = w.split(/[- ]/);
    for (const sep of ['-', ' ']) {
      const pl = a + sep + b + 's';
      WORDS.set(pl, facs);
      for (const [pw, p] of Object.entries(PREFIX_WORD)) WORDS.set(pw + pl, facs.map(([, u, e], i) => [i === 0 ? p : null, u, e]));
    }
  }
}
for (const [w, facs] of Object.entries(PLAIN_WORD)) for (const v of w.includes(' ') ? [w] : plural(w)) WORDS.set(v, facs);
WORDS.set('degrees', [f('deg')]);
const WORD_RE = new RegExp('^(?:' + [...WORDS.keys()].sort((a, b) => b.length - a.length).join('|') + ')(?![\\p{L}])', 'iu');
const POWER_WORD = { square: 2, squared: 2, cubic: 3, cubed: 3 };

// A symbol (no power) as factors, or null.
function symbol(s) {
  if (Object.hasOwn(WHOLE, s)) return WHOLE[s];
  if (Object.hasOwn(PREFIXABLE, s)) return [f(PREFIXABLE[s])];
  if (Object.hasOwn(PREFIXABLE_PRODUCT, s)) return PREFIXABLE_PRODUCT[s];
  for (const pl of [2, 1]) {
    const p = s.slice(0, pl), rest = s.slice(pl);
    if (!Object.hasOwn(PREFIX, p) || !rest) continue;
    if (p === 'u' && rest.length > 2) continue; // 'us' is µs, but not words
    if (Object.hasOwn(PREFIXABLE, rest)) return [f(PREFIXABLE[rest], 1, PREFIX[p])];
    if (Object.hasOwn(PREFIXABLE_PRODUCT, rest)) return PREFIXABLE_PRODUCT[rest].map(([, u, e], i) => [i === 0 ? PREFIX[p] : null, u, e]);
  }
  return null;
}
const SUPERS = { '²': 2, '³': 3, '⁴': 4, '¹': 1 };
const pow = (facs, n) => facs.map(([p, u, e]) => [p, u, e * n]);

// ---- Reading a unit expression at the start of `s`. Returns { facs, len } or null.
const ATOM = /^(?:°[CFR]|℃|℉|°|Å|[A-Za-zµμΩ]+)/u;
function atomAt(s) {
  // words first (they are longer): "square metres", "kilowatt-hours", "metres"
  let i = 0, p = 1;
  const pw = /^(square|squared|cubic|cubed)\s+/i.exec(s);
  if (pw && /^(square|cubic)$/i.test(pw[1])) { p = POWER_WORD[pw[1].toLowerCase()]; i = pw[0].length; }
  const w = WORD_RE.exec(s.slice(i));
  if (w) {
    let facs = WORDS.get(w[0].toLowerCase()) ?? WORDS.get(w[0]);
    if (facs) {
      let len = i + w[0].length;
      const after = /^\s+(squared|cubed)\b/i.exec(s.slice(len));
      if (after) { p *= POWER_WORD[after[1].toLowerCase()]; len += after[0].length; }
      return { facs: pow(facs, p), len, word: true };
    }
  }
  const m = ATOM.exec(s);
  if (!m) return null;
  let tok = m[0];
  let facs = symbol(tok);
  // "m3", "m2" (no superscript) and "kWh" style: try the letters with a trailing power digit
  if (!facs) return null;
  let len = tok.length;
  let e = 1;
  const sup = /^(?:\^\(?([−-]?\d)\)?|([⁻]?[¹²³⁴])|([234])(?![\d.,]))/u.exec(s.slice(len));
  if (sup) {
    if (sup[1]) e = Number(sup[1].replace('−', '-'));
    else if (sup[2]) e = (sup[2].startsWith('⁻') ? -1 : 1) * SUPERS[sup[2].at(-1)];
    else e = Number(sup[3]);
    len += sup[0].length;
  }
  return { facs: pow(facs, e), len, word: false };
}
function unitExpr(s) {
  const first = atomAt(s);
  if (!first) return null;
  let facs = [...first.facs], len = first.len, per = false, words = first.word;
  for (;;) {
    const rest = s.slice(len);
    let j;
    if (words) j = /^(?:\s+per\s+|\s*\/\s*|-|\s+)/i.exec(rest);
    else j = /^(?:\/\(|\/|[·⋅∙*×.]|-)/.exec(rest);
    if (!j) break;
    const isPer = /per|\//i.test(j[0]);
    if (isPer && per) break; // one solidus
    const group = j[0] === '/(';
    const next = atomAt(rest.slice(j[0].length));
    if (!next) break;
    if (j[0] === '.' && !/^[A-Za-zµΩ°]/.test(rest.slice(1))) break;
    let add = next.facs, l = j[0].length + next.len;
    if (group) { // W/(m·K)
      let k = l;
      for (;;) {
        const jj = /^[·⋅∙*×.\s-]/.exec(rest.slice(k));
        if (!jj) break;
        const nn = atomAt(rest.slice(k + 1));
        if (!nn) break;
        add = add.concat(nn.facs); k += 1 + nn.len;
      }
      if (rest[k] !== ')') break;
      l = k + 1;
    }
    if (isPer) per = true;
    facs = facs.concat(per ? pow(add, -1) : add);
    len += l;
  }
  if (per === false && /^\s*\/\s*$/.test(s.slice(len, len + 1))) { /* a lone slash */ }
  return { facs, len };
}
// Canonical form: "pfx:unit^exp" factors combined and sorted, as unit-presses.mjs writes `parts`.
function canon(facs) {
  const m = new Map();
  for (const [p, u, e] of facs) { const k = (p ? p + ':' : '') + u; m.set(k, (m.get(k) ?? 0) + e); }
  return [...m].filter(([, e]) => e !== 0).sort(([a, ea], [b, eb]) => (eb > 0) - (ea > 0) || (a < b ? -1 : 1)).map(([k, e]) => (e === 1 ? k : `${k}^${e}`)).join(' ');
}

// ---- Wikitext to text, with the convert/val units taken out first.
function templates(text, found) {
  const one = (inner) => {
    const parts = inner.split('|').map((x) => x.trim());
    const name = parts[0].toLowerCase();
    if (name === 'convert' || name === 'cvt') {
      const pos = parts.slice(1).filter((x) => !x.includes('='));
      let i = 1;
      while (i < pos.length && /^(-|–|to|and|or|x|×|by|to\(-\)|\+\/-|±|&|and\(-\)|or\(-\)|\+)$/.test(pos[i])) i += 2;
      const code = pos[i];
      if (code === undefined) return '';
      const facs = CONVERT[code] ?? unitExpr(code.replace(/\./g, '·'))?.facs;
      found.push({ code, facs: facs && (unitExpr(code.replace(/\./g, '·'))?.len === code.length || CONVERT[code]) ? facs : null, via: 'convert' });
      return ' ⟦u⟧ ';
    }
    if (name === 'val') {
      const u = parts.find((x) => /^(u|ul|up|upl)\s*=/.test(x));
      if (u) {
        const code = u.split('=')[1].trim();
        const r = unitExpr(code.replace(/\./g, '·'));
        found.push({ code, facs: r && r.len === code.length ? r.facs : WORDS.get(code.toLowerCase()) ?? null, via: 'val' });
      }
      return ' ⟦u⟧ ';
    }
    if (/^(nbsp|thinsp|nnbsp)$/.test(name)) return ' ';
    if (name === 'sup') return '^' + (parts[1] ?? '');
    if (name === 'sub') return parts[1] ?? '';
    if (name === 'math' || name === 'mvar' || name === 'var') return ' ';
    if (name === 'nowrap' || name === 'nobr') return parts.slice(1).join('|');
    return ' ';
  };
  let prev;
  do { prev = text; text = text.replace(/\{\{([^{}]*)\}\}/g, (_, inner) => one(inner)); } while (text !== prev);
  return text;
}
function clean(w) {
  const cut = /^==\s*(References|Notes|Further reading|External links|Bibliography|Sources|Citations|See also)\s*==/im.exec(w);
  if (cut) w = w.slice(0, cut.index);
  let t = w.replace(/<!--[\s\S]*?-->/g, ' ').replace(/<ref[^>]*\/>/gi, ' ').replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, ' ');
  t = t.replace(/<math[\s\S]*?<\/math>/gi, ' ').replace(/<chem[\s\S]*?<\/chem>/gi, ' ').replace(/<ce>[\s\S]*?<\/ce>/gi, ' ');
  t = t.replace(/<sup>\s*([−-]?\d)\s*<\/sup>/gi, '^$1').replace(/<\/?(sub|small|span|abbr|nowiki|br|div|center|big|i|b|u|s)[^>]*>/gi, '');
  t = t.replace(/\{\|[\s\S]*?\|\}/g, (tab) => tab.replace(/\|\|/g, '\n|')); // keep tables, one cell per line
  return t;
}
function plain(t) {
  t = t.replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, '$1').replace(/\[https?:[^\s\]]*\s?([^\]]*)\]/g, '$1').replace(/'''?/g, '');
  t = t.replace(/&nbsp;|&#160;|&thinsp;|&#8201;|&#x202f;| | | /gi, ' ').replace(/&minus;/g, '−').replace(/&deg;/g, '°').replace(/&times;/g, '×')
    .replace(/&middot;|&sdot;/g, '·').replace(/&mu;|&micro;/g, 'µ').replace(/&Omega;|&ohm;/g, 'Ω').replace(/&ndash;/g, '–').replace(/&amp;/g, '&');
  return t;
}

// ---- Counting one text
const NUM = /(?<![\p{L}\p{N}_.,^])\d[\d,]*(?:\.\d+)?(?:\s*[×x]\s*10\^[−-]?\d+)?(?:\s*(?:–|-|to)\s*\d[\d,]*(?:\.\d+)?)?(?:[ ]?|-)(?=\S)/gu;
function countText(text, out, misses, field) {
  let lastEnd = -10;
  for (const m of text.matchAll(NUM)) {
    const start = m.index + m[0].length;
    const r = unitExpr(text.slice(start, start + 80));
    if (!r) {
      if (misses) { const w = /^[A-Za-zµΩ°][\wµΩ°/·²³]*/.exec(text.slice(start)); if (w) misses.set(w[0], (misses.get(w[0]) ?? 0) + 1); }
      continue;
    }
    const after = text.slice(start + r.len, start + r.len + 1);
    if (/[\p{L}\p{N}]/u.test(after)) continue; // "5 in the" is caught by WORD/ATOM boundaries; "10 Ma..." is not a unit
    const unitText = text.slice(start, start + r.len);
    const glued = !/[ -]$/.test(m[0]);
    if (glued && (/^[A-Za-z]$/.test(unitText) || unitText === 'in')) continue; // 1990s, 4K, 12V? only with a space
    if (r.facs.some(([, u]) => u === 'ton?')) { // a ton: refrigeration in HVAC context, else mass
      const ctx = text.slice(start + r.len, start + r.len + 50);
      const hvac = field === 'chemical_process_hvac' && /refrigerat|cooling|system|unit|chiller|capacity|kW|air/i.test(ctx);
      r.facs = r.facs.map(([p, u, e]) => [p, u === 'ton?' ? (hvac ? 'TR' : 't') : u, e]);
    }
    if (CTX && canon(r.facs) === CTX) console.log(`  [${field}] …${text.slice(Math.max(0, m.index - 40), start + r.len + 20).replace(/\s+/g, ' ')}…`);
    if (unitText === 'in' && !/^[\s]*[),.;:]/.test(text.slice(start + r.len, start + r.len + 2))) continue; // "in" only before punctuation
    // a conversion in brackets right after a unit: "100 km (62 mi)"
    const before = text.slice(Math.max(0, m.index - 4), m.index);
    if (/\(\s*(?:about|approx\.?|~)?\s*$/.test(before) && m.index - lastEnd <= 4) { lastEnd = start + r.len; continue; }
    out.push(r.facs);
    lastEnd = start + r.len;
  }
}

// ---- The corpus
const FIELDS = Object.keys(lock);
const perField = {};
const missesAll = new Map();
const unread = new Map();
for (const field of FIELDS) {
  const exprs = [];
  for (const a of lock[field]) {
    const raw = readFileSync(join(cache, field, a.file), 'utf8');
    if (createHash('sha256').update(raw).digest('hex') !== a.sha256) throw new Error(`SHA-256 mismatch: ${field}/${a.file} (rerun fetch.mjs on purpose, or restore the cache)`);
    const found = [];
    const text = plain(templates(clean(raw), found));
    const mine = [];
    for (const x of found) {
      if (x.facs) mine.push(x.facs);
      else unread.set(`${x.via}:${x.code}`, (unread.get(`${x.via}:${x.code}`) ?? 0) + 1);
    }
    countText(text, mine, MISSES ? missesAll : null, field);
    const seen = new Map();
    for (const facs of mine) { const k = canon(facs); const n = seen.get(k) ?? 0; if (n < CAP) exprs.push(facs); seen.set(k, n + 1); }
  }
  perField[field] = exprs.map(canon).filter(Boolean);
}

// ---- The benchmark: tests/tasks/tasks.yaml (the owner's ten tasks) and S1's 50 (unit-presses.mjs).
const TASKS = ['k:ohm', 'k:ohm', 'k:m h^-1', 'm s^-1', 'm:m', 'm', 'm', 'm^2']; // t01 (two resistors), t02, t04, t10 (to verify with each task's keys)
const s1src = readFileSync(join(root, 'tools/probes/unit-presses.mjs'), 'utf8');
const S1 = [...s1src.slice(s1src.indexOf('const UNITS'), s1src.indexOf('const EXTRA')).matchAll(/parts: '([^']+)'/g)].map((x) => canon(x[1].split(' ').map((t) => {
  const [n, e] = t.split('^'); const [p, u] = n.includes(':') ? n.split(':') : [null, n]; return [p, u, e === undefined ? 1 : Number(e)];
})));

// ---- Weights: each field 0.30 (its share of its own uses), the tasks 0.05, S1's list 0.05.
const SHARE = { mechanical_civil: 0.3, electrical: 0.3, chemical_process_hvac: 0.3, tasks: 0.05, s1: 0.05 };
const lists = { ...perField, tasks: TASKS, s1: S1 };
const exprW = new Map(); // canon -> { w, n: {source: count} }
for (const [src, list] of Object.entries(lists)) {
  for (const e of list) {
    const x = exprW.get(e) ?? { w: 0, n: {} };
    x.w += SHARE[src] / list.length; x.n[src] = (x.n[src] ?? 0) + 1;
    exprW.set(e, x);
  }
}
const factorsOf = (c) => c.split(' ').map((t) => { const [n, e] = t.split('^'); const [p, u] = n.includes(':') ? n.split(':') : [null, n]; return { p, u, e: e === undefined ? 1 : Number(e) }; });
const unitW = new Map(), pfxW = new Map(), pairW = new Map();
for (const [c, x] of exprW) for (const { p, u } of factorsOf(c)) {
  unitW.set(u, (unitW.get(u) ?? 0) + x.w);
  if (p) pfxW.set(p, (pfxW.get(p) ?? 0) + x.w);
  const k = (p ? p + ':' : '') + u; pairW.set(k, (pairW.get(k) ?? 0) + x.w);
}

// ---- Report
const r4 = (x) => Math.round(x * 1e4) / 1e4;
const top = (m, n) => [...m].sort((a, b) => b[1] - a[1]).slice(0, n);
for (const field of FIELDS) {
  const c = new Map(); for (const e of perField[field]) c.set(e, (c.get(e) ?? 0) + 1);
  console.log(`${field}: ${perField[field].length} uses in ${lock[field].length} articles; top 25:`);
  console.log('  ' + top(c, 25).map(([e, n]) => `${e} ${n}`).join(' | '));
}
console.log('\nunits (any prefix), weight per mille, top 60:');
console.log('  ' + top(unitW, 60).map(([u, w]) => `${u}${FIND_UNITS.has(u) ? '' : '(!)'} ${(w * 1000).toFixed(1)}`).join(' | '));
console.log('\nprefixes, weight per mille:');
console.log('  ' + top(pfxW, 20).map(([p, w]) => `${p} ${(w * 1000).toFixed(1)}`).join(' | '));
console.log('\nunit expressions, weight per mille, top 60:');
console.log('  ' + top(new Map([...exprW].map(([e, x]) => [e, x.w])), 60).map(([e, w]) => `${e} ${(w * 1000).toFixed(1)}`).join(' | '));
const notFind = [...unitW.keys()].filter((u) => !FIND_UNITS.has(u)).sort();
console.log('\nunit ids counted that Find lacks (for G7): ' + notFind.map((u) => `${u} (${(unitW.get(u) * 1000).toFixed(2)}‰)`).join(', '));
console.log('\ntemplate units not read: ' + top(unread, 30).map(([k, n]) => `${k} ${n}`).join(', '));
if (MISSES) console.log('\nwords after a number, not read (top 80): ' + top(missesAll, 80).map(([k, n]) => `${k} ${n}`).join(', '));

const doc = {
  note: `Written by tools/probes/unit-freq/count.mjs (S5). ${CAP < Infinity ? `A unit counts at most ${CAP} times per article. ` : ''}weight: the share of all unit uses, each field 0.30 of the whole (its share of its own uses), the task benchmark 0.05, S1\'s 50 units 0.05. Ids are Find\'s (u = µ, oC = °C, deg = °, ohm = Ω); find: false = not in Find today (G7).`,
  shares: SHARE,
  uses: Object.fromEntries(Object.entries(lists).map(([k, v]) => [k, v.length])),
  units: top(unitW, 1e9).map(([u, w]) => ({ id: u, weight: r4(w), find: FIND_UNITS.has(u) })),
  prefixes: top(pfxW, 1e9).map(([p, w]) => ({ id: p, weight: r4(w), find: FIND_PFX.has(p) })),
  expressions: top(new Map([...exprW].map(([e, x]) => [e, x.w])), 1e9).filter(([, w]) => w >= 0.0002).map(([e, w]) => ({ parts: e, weight: r4(w), sources: exprW.get(e).n })),
};
writeFileSync(OUT, '# SPDX-License-Identifier: GPL-3.0-or-later\n' + stringify(doc, { lineWidth: 0 }));
console.log(`\nwrote ${OUT.replace(root + '/', '')} (${doc.units.length} units, ${doc.prefixes.length} prefixes, ${doc.expressions.length} expressions)`);
