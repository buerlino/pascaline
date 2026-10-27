// SPDX-License-Identifier: GPL-3.0-or-later
// Probe (G15, decides P15): can the unit view compute on Giac, with the exact factors of the Find index, instead of a
// qalc worker? Every case runs both ways: Giac with the index's factors (this file's builder), and qalc's own answer
// from the dev build (as engine/qalc/run-cases.mjs runs it). Differences are settled by an oracle value (mpmath) or a
// derivation. Also: the mismatch and temperature checks, first-order uncertainty with Giac's diff, desktop timing, and
// the units of the index without an exact factor, each with what it needs.
//
//   node tools/probes/units-giac.mjs            the tables and the gate, in the terminal
//   node tools/probes/units-giac.mjs --md       also writes tools/probes/_out/units-giac.md (the tables for a report)
//
// Needs: the Find index (cd app && npm run index; app/src/find/_gen/find-index.json), a Giac build (GIAC_OUT or
// GIAC_MJS, absolute, else engine/giac/_out/gsl of this checkout), a qalc build with qalc_eval (QALC_OUT, else
// engine/qalc/_out/dev of this checkout or of the main checkout), the oracle venv (tests/golden/.venv, of this
// checkout or the main one; ORACLE_PY overrides) and app/node_modules (the `yaml` package). Read-only; writes only to
// tools/probes/_out/.
//
// The model (P15, docs/04 4.3):
//   - a unit token (prefix id, unit id, power) is its exact factor (the index's `si`, times the prefix's power of ten)
//     times one Giac symbol per base dimension of its `dim` key, all to the power; a constant is its value times its
//     dimension symbols (exact when the index gives no uncertainty);
//   - a quantity is a number times its units; normal() gives the result; the result must be one number times one
//     product of dimension symbols (each exponent is d*diff(f,d)/f, which is a number only for a monomial), else the
//     dimensions of the terms are named ("L vs T");
//   - a conversion divides by the target's factor and dimensions and must leave a pure number;
//   - an affine unit (°C, °F: `si` is "a+b", K = a*x + b) is allowed only alone ("20 °C → °F"); inside arithmetic it
//     is flagged (G17 writes the rules); a logarithmic unit (dB, Np, dBm, bel; no `si`, or the Np dimension) is
//     flagged in every use (G17);
//   - uncertainty is first order, sigma = sqrt(sum (df/dx_i * sigma_i)^2), on the number part of f after the
//     dimension check (uncorrelated inputs, as cases.yaml's oracle).
//
// Case syntax in this file: Giac text with unit groups in braces, in the `parts` syntax of unit-presses.mjs:
// `{k:m h^-1}` = km·h⁻¹ (prefix:unit, powers, space = product), `{=c}` = the constant c, and `[12.34±0.05]` = a
// number with its standard uncertainty. Decimals in the text are made exact first, as Home does.
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const main = resolve(root, root.includes('/.claude/worktrees/') ? '../../..' : '.');
const { parse: parseYaml } = createRequire(join(root, 'app/package.json'))('yaml');
const MD = process.argv.includes('--md');
const firstOf = (...ps) => ps.find((p) => p && existsSync(p));

// ---------------------------------------------------------------- exact numbers (BigInt fractions)
const gcd = (a, b) => { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b) [a, b] = [b, a % b]; return a; };
const fr = (p, q = 1n) => { if (q < 0n) { p = -p; q = -q; } const g = gcd(p, q) || 1n; return { p: p / g, q: q / g }; };
const fsub = (a, b) => fr(a.p * b.q - b.p * a.q, a.q * b.q);
const fabs = (a) => ({ p: a.p < 0n ? -a.p : a.p, q: a.q });
const fle = (a, b) => a.p * b.q <= b.p * a.q;
const fmul = (a, b) => fr(a.p * b.p, a.q * b.q);
/** "12.34", "-0.5e-3", "6.62607015E-34", "0.157e1", "100/3" -> fraction. */
function parseNum(s) {
  s = String(s).trim();
  let m = s.match(/^(-?\d+)\/(\d+)$/);
  if (m) return fr(BigInt(m[1]), BigInt(m[2]));
  m = s.match(/^(-?)(\d*)\.?(\d*)(?:[eE]([-+]?\d+))?$/);
  if (!m || (m[2] === '' && m[3] === '')) return null;
  const digits = BigInt((m[2] || '0') + m[3]);
  const exp = Number(m[4] ?? 0) - m[3].length;
  const p = (m[1] ? -1n : 1n) * digits * (exp > 0 ? 10n ** BigInt(exp) : 1n);
  return fr(p, exp < 0 ? 10n ** BigInt(-exp) : 1n);
}
const ftext = (a) => (a.q === 1n ? `${a.p}` : `${a.p}/${a.q}`);
/** a ≈ b to a relative 10^-k (b the reference). */
function close(a, b, k = 35) {
  if (!a || !b) return false;
  const d = fabs(fsub(a, b));
  if (b.p === 0n) return fle(d, fr(1n, 10n ** BigInt(k)));
  return fle(d, fmul(fabs(b), fr(1n, 10n ** BigInt(k))));
}
const sig = (a, n = 15) => {
  if (!a) return '—';
  if (a.p === 0n) return '0';
  const neg = a.p < 0n, p = neg ? -a.p : a.p, q = a.q;
  let e = p.toString().length - q.toString().length; // 10^e <= p/q < 10^(e+1), after the fix-up
  const ge = (k) => (k >= 0 ? p >= q * 10n ** BigInt(k) : p * 10n ** BigInt(-k) >= q);
  if (!ge(e)) e -= 1;
  if (ge(e + 1)) e += 1;
  const k = n - 1 - e;
  const d = k >= 0 ? (p * 10n ** BigInt(k)) / q : p / (q * 10n ** BigInt(-k));
  const str = d.toString();
  const mant = `${str[0]}.${str.slice(1).replace(/0+$/, '')}`.replace(/\.$/, '');
  return `${neg ? '-' : ''}${mant}${e ? `e${e}` : ''}`;
};

// ---------------------------------------------------------------- the index
const idxPath = firstOf(join(root, 'app/src/find/_gen/find-index.json'), join(main, 'app/src/find/_gen/find-index.json'));
if (!idxPath) throw new Error('no Find index: cd app && npm run index');
const index = JSON.parse(readFileSync(idxPath, 'utf8'));
const byId = new Map(index.map((i) => [i.id, i]));
const units = index.filter((i) => i.kind === 'unit');
const DIMS = { m: ['pasdimL', 'L'], kg: ['pasdimM', 'M'], s: ['pasdimT', 'T'], A: ['pasdimI', 'I'], K: ['pasdimK', 'Θ'],
  mol: ['pasdimN', 'N'], cd: ['pasdimJ', 'J'], rad: ['pasdimA', 'angle'], Np: ['pasdimNp', 'Np'], bit: ['pasdimB', 'bit'] };
const SYMS = Object.values(DIMS).map((d) => d[0]);
const dimOf = (key) => {
  const out = new Map();
  for (const m of (key ?? '').matchAll(/([A-Za-z]+?)(-?\d+)/g)) {
    if (!DIMS[m[1]]) throw new Error(`unknown base dimension ${m[1]} in ${key}`);
    out.set(m[1], Number(m[2]));
  }
  return out;
};
const dimName = (exps) => {
  const parts = SYMS.map((s, i) => [Object.values(DIMS)[i][1], exps[i]]).filter(([, e]) => e && e !== '0');
  return parts.length ? parts.map(([n, e]) => (e === '1' || e === 1 ? n : `${n}^${e}`)).join('·') : '1';
};
const LOG_IDS = new Set(['dB', 'bel', 'Np', 'dBm', 'dBW', 'B']);
const ADD = new Set(parseYaml(readFileSync(join(root, 'spec/units-menu.yaml'), 'utf8')).add_to_find.map((x) => x.id));
const isAffine = (u) => /\+/.test(u.si ?? '');
const isLog = (u) => LOG_IDS.has(u.id.slice(5)) || /Np/.test(u.dim ?? '');

// ---------------------------------------------------------------- the builder (tokens -> Giac text)
class Flag extends Error { constructor(kind, msg) { super(msg); this.kind = kind; } }
/** "k:m h^-1" -> [{pfx:'k', u:'m', e:'1'}, {u:'h', e:'-1'}]; "=c" -> [{c:'c'}]. */
function tokens(parts) {
  if (parts.startsWith('=')) return [{ c: parts.slice(1) }];
  return parts.trim().split(/\s+/).map((t) => {
    const m = t.match(/^(?:([A-Za-z]+):)?([^:^]+)(?:\^(-?[\d./]+))?$/);
    if (!m) throw new Error(`bad unit token ${t}`);
    return { pfx: m[1], u: m[2], e: m[3] ? ftext(parseNum(m[3])) : '1' };
  });
}
/** One token -> its Giac factor text (factor times dimension symbols, to the power). */
function tokenGiac(t) {
  if (t.c) {
    const c = byId.get(`const:${t.c}`);
    if (!c) throw new Flag('nofactor', `no constant ${t.c} in the index`);
    if (c.unc) throw new Flag('unc', `the constant ${t.c} has an uncertainty (${c.unc}): it enters as a value ± σ (G18)`);
    const v = parseNum(c.value);
    if (!v) throw new Flag('nofactor', `constant ${t.c}: value ${c.value} is not a decimal`);
    const d = [...dimOf(c.dim)].map(([b, e]) => `${DIMS[b][0]}^${e}`);
    return `(${ftext(v)}${d.length ? `*${d.join('*')}` : ''})`;
  }
  const u = byId.get(`unit:${t.u}`);
  if (!u) throw new Flag('nofactor', `no unit ${t.u} in the index${ADD.has(t.u) ? ' (G7 adds it: spec/units-menu.yaml add_to_find)' : ''}`);
  if (isLog(u)) throw new Flag('log', `${t.u} is a logarithmic unit (G17's rules)`);
  if (!u.si) throw new Flag('nofactor', `${t.u} has no exact factor in the index (${owner(u)})`);
  if (isAffine(u)) throw new Flag('temp', `${t.u} is an absolute temperature: use K or Δ°C for a temperature difference`);
  let f = `(${u.si})`;
  if (t.pfx) {
    const p = byId.get(`pfx:${t.pfx}`);
    if (!p) throw new Flag('nofactor', `no prefix ${t.pfx}`);
    f = `${p.si}*${f}`;
  }
  const d = [...dimOf(u.dim)].map(([b, e]) => `${DIMS[b][0]}^${e}`);
  const body = `(${f}${d.length ? `*${d.join('*')}` : ''})`;
  return t.e === '1' ? body : `${body}^(${t.e})`;
}
const groupGiac = (parts) => `(${tokens(parts).map(tokenGiac).join('*')})`;
/** Case text -> {giac, uvars:[{sym, v, s}]}: unit groups substituted, decimals exact, [v±s] as symbols. */
function build(text) {
  const uvars = [];
  let g = text.replace(/\[([^\]±]+)±([^\]]+)\]/g, (_, v, s) => {
    const sym = `pasux${String.fromCharCode(97 + uvars.length)}`; // letters: the number pass below must not see digits
    uvars.push({ sym, v: parseNum(v), s: parseNum(s) });
    return sym;
  });
  const groups = [];
  g = g.replace(/\{([^}]+)\}/g, (_, parts) => { groups.push(parts); return `§${String.fromCharCode(97 + groups.length - 1)}§`; });
  g = g.replace(/(?<![A-Za-z_])(\d+\.\d*|\.\d+|\d+)(?:[eE]([-+]?\d+))?/g, (s) => `(${ftext(parseNum(s))})`);
  g = g.replace(/§([a-z])§/g, (_, i) => groupGiac(groups[i.charCodeAt(0) - 97]));
  g = g.replace(/\b(sin|cos|tan)\(/g, 'pasu$1('); // an angle: its unit is dropped, any other unit is an error
  return { giac: g, uvars };
}

// ---------------------------------------------------------------- Giac
const { loadNodeGiac } = await import(pathToFileURL(join(root, 'app/src/engine/nodeGiac.ts')).href);
if (!process.env.GIAC_OUT && !process.env.GIAC_MJS && !existsSync(join(root, 'engine/giac/_out/gsl/giac.mjs')))
  process.env.GIAC_OUT = join(main, 'engine/giac/_out/gsl');
const { giac } = await loadNodeGiac();
let calls = 0;
const ev = (s) => { calls++; const r = giac.eval(s); if (process.env.DEBUG) console.error(s.slice(0, 300), "=>", r); return r; };
const S = `[${SYMS.join(',')}]`;
// pasuq(f): [exponents, number part] when f is one term; [exponents, terms' exponents] otherwise.
ev(`pasuq(f):={local a,c,t; if (f==0) return [[${SYMS.map(() => 0).join(',')}],0]; ` +
   `a:=map(${S},k->normal(k*diff(f,k)/f)); ` +
   `if (lvar(a)==[]) { c:=normal(f/product(zip((x,y)->x^y,${S},a))); return [a,c]; } ` +
   `t:=expand(f); if (sommet(t)!='+') return [a,"nonmono"]; ` +
   `return [a,map([op(t)],u->map(${S},k->normal(k*diff(u,k)/u)))]; }`);
// pasua(x): the argument of sin, cos, tan as a pure number in radians: x may carry the angle dimension once (30 °)
// or none (a bare number: radians here; the unit view's angle mode is G16's); anything else gives the free symbol
// pasubad, which no result may contain.
ev(`pasua(x):={local w,y; if (x==0) return 0; w:=normal(pasdimA*diff(x,pasdimA)/x); y:=normal(subst(x,pasdimA,1)); ` +
   `if ((w!=0 and w!=1) or ${SYMS.map((d) => `has(y,${d})`).join(' or ')}) return pasubad; return y; }`);
for (const f of ['sin', 'cos', 'tan']) ev(`pasu${f}(x):=${f}(pasua(x))`);
// pasuu(f,xs,vs,ss): first-order uncertainty of f at xs=vs: [exponents, value number part, sigma number part].
ev(`pasuu(f,xs,vs,ss):={local F,r,g; F:=normal(subst(f,xs,vs)); r:=pasuq(F); if (lvar(r[0])!=[]) return r; ` +
   `g:=normal(f/product(zip((x,y)->x^y,${S},r[0]))); ` +
   `return [r[0],r[1],normal(sqrt(sum(seq((subst(diff(g,xs[j]),xs,vs)*ss[j])^2,j,0,size(xs)-1))))]; }`);
const list = (s) => {
  if (typeof s !== "string" || s[0] !== "[") throw new Error(`Giac: ${s}`);
  // split a top-level Giac list "[a,b,[c,d]]" into its items
  const out = []; let depth = 0, cur = '';
  for (const ch of s.slice(1, -1)) {
    if ((ch === ',' && depth === 0)) { out.push(cur.trim()); cur = ''; continue; }
    if ('[('.includes(ch)) depth++;
    if ('])'.includes(ch)) depth--;
    cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
};
const numOf = (c) => {
  const x = parseNum(c);
  if (x) return { exact: c, v: x };
  const d = ev(`evalf(${c},50)`); // the real evaluator needs digits too (Home's agreement check: two precisions)
  return { exact: c, v: parseNum(d), approx: true };
};
const isNum = (s) => /^-?\d+(\/\d+)?$/.test(s);

/** Evaluate a case on Giac: {kind:'value', exact, v, dim, sigma?} or {kind:<flag>, msg}. */
function giacEval(c) {
  try {
    // an affine unit alone: "x*{oC}" (optionally → a unit, also affine)
    const alone = c.giac.match(/^\s*(-?[\d./]+)\s*\*\s*\{([^}\s]+)\}\s*$/);
    const aff = (parts) => { const t = tokens(parts); const u = t.length === 1 && !t[0].pfx && t[0].e === '1' && byId.get(`unit:${t[0].u}`); return u && isAffine(u) ? u : null; };
    if (alone && (aff(alone[2]) || (c.to && aff(c.to)))) {
      const from = aff(alone[2]), to = c.to && aff(c.to);
      const [a, b] = from ? from.si.split('+') : ['1', '0'];
      const kText = from ? `(${a})*(${ftext(parseNum(alone[1]))})+(${b})` : `(${ftext(parseNum(alone[1]))})*${groupGiac(alone[2])}`;
      if (!from) { // K → °C: the source must be a temperature (Θ)
        const r = list(ev(`pasuq(normal(${kText}))`));
        if (dimName(list(r[0])) !== 'Θ') throw new Flag('mismatch', `Units don't match: ${dimName(list(r[0]))} vs Θ`);
      }
      const val = from && !to ? `normal(${kText})` : to ? `normal(((${kText})${from ? '' : '/pasdimK'}-(${to.si.split('+')[1]}))/(${to.si.split('+')[0]}))` : null;
      const out = ev(val);
      return { kind: 'value', ...numOf(out), dim: c.to ? '1' : 'Θ' };
    }
    const b = build(c.giac);
    let f = b.giac;
    if (c.to) f = `(${f})/${groupGiac(c.to)}`;
    let r;
    if (b.uvars.length) {
      const xs = `[${b.uvars.map((u) => u.sym).join(',')}]`, vs = `[${b.uvars.map((u) => ftext(u.v)).join(',')}]`, ss = `[${b.uvars.map((u) => ftext(u.s)).join(',')}]`;
      r = list(ev(`pasuu(normal(${f}),${xs},${vs},${ss})`));
    } else r = list(ev(`pasuq(normal(${f}))`));
    if (r.join().includes('pasubad')) return { kind: 'mismatch', msg: 'sin, cos and tan take an angle or a pure number' };
    const a = list(r[0]);
    if (!a.every(isNum)) {
      if (r[1] === '"nonmono"') return { kind: 'mismatch', msg: 'not one number times units (a unit inside a function?)' };
      const terms = [...new Set(list(r[1]).map((t) => dimName(list(t))))];
      return { kind: 'mismatch', msg: `Units don't match: ${terms.join(' vs ')}` };
    }
    const dim = dimName(a);
    if (c.to && dim !== '1') { // name both sides (one more call, on the error path only)
      const src = dimName(list(list(ev(`pasuq(normal(${b.giac}))`))[0]));
      const dst = dimName(list(list(ev(`pasuq(normal(${groupGiac(c.to)}))`))[0]));
      return { kind: 'mismatch', msg: `Units don't match: ${src} vs ${dst}` };
    }
    const out = { kind: 'value', ...numOf(r[1]), dim };
    if (r[2] !== undefined) out.sigma = numOf(r[2]);
    return out;
  } catch (e) {
    if (e instanceof Flag) return { kind: e.kind, msg: e.message };
    throw e;
  }
}

// ---------------------------------------------------------------- qalc
const qdir = firstOf(process.env.QALC_OUT, join(root, 'engine/qalc/_out/dev'), join(main, 'engine/qalc/_out/dev'));
if (!qdir) throw new Error('no qalc build: engine/qalc/build-wasm.sh dev (or QALC_OUT)');
const qm = await (await import(pathToFileURL(join(qdir, 'qalc.mjs')).href)).default();
if (qm._qalc_init() !== 1) throw new Error('qalc_init failed');
qm._qalc_set_precision(40);
const qev = qm.cwrap('qalc_eval', 'string', ['string', 'number']);
const qcalc = qm.cwrap('qalc_calc', 'string', ['string']);
const QBASE = { m: 'm', g: 'kg', s: 's', A: 'A', K: 'K', mol: 'mol', cd: 'cd', rad: 'rad', Np: 'Np', bit: 'bit' };
/** qalc's value: {v, sigma?, dim} (SI, or the number part of a "to" result), or {kind:'sum'|'other', text}. */
function qalcEval(text, to) {
  const t = JSON.parse(qev(text, to ? 0 : 2)).tree;
  let v = fr(1n), sigma = null, approx = false; const dims = new Map(); let bad = null;
  const num = (n) => {
    if (n.p !== undefined) return fr(BigInt(n.p), BigInt(n.q));
    approx = true;
    if (n.unc && !/e-[5-9]\d/.test(n.unc)) sigma = parseNum(n.unc); // a real uncertainty, not interval noise
    return parseNum(n.dec);
  };
  const walk = (n, e) => {
    if (n.t === 'num') { const x = num(n); v = e === 1 ? fmul(v, x) : bad = 'num^'; return; }
    if (n.t === 'unit') {
      if (to) return; // a "to" result is in the target unit by construction
      const b = QBASE[n.u];
      if (!b || n.pfx) { bad = `unit ${n.pfx ?? ''}${n.u}`; return; }
      dims.set(b, (dims.get(b) ?? 0) + e);
      if (n.u === 'g') v = fmul(v, e > 0 ? fr(1n, 1000n ** BigInt(e)) : fr(1000n ** BigInt(-e)));
      return;
    }
    if (n.t === 'mul') { for (const c of n.c) walk(c, e); return; }
    if (n.t === 'pow' && n.c[1].t === 'num' && n.c[1].p !== undefined) {
      const x = n.c[0], k = e * Number(n.c[1].p) / Number(n.c[1].q);
      if (x.t === 'unit' && Number.isInteger(k)) { walk(x, k); return; }
      if (x.t === 'unit' && !to && QBASE[x.u] && x.u !== 'g' && !x.pfx) { dims.set(QBASE[x.u], (dims.get(QBASE[x.u]) ?? 0) + k); return; }
    }
    bad = n.t;
  };
  walk(t, 1);
  if (bad) return { kind: t.t === 'add' ? 'sum' : 'other', text: qcalc(text) };
  if (sigma) sigma = fabs(sigma);
  const ex = (k) => (Number.isInteger(k) ? String(k) : ftext(parseNum(String(k)) ?? fr(0n)));
  const dim = to ? '1' : dimName(SYMS.map((_, i) => ex(dims.get(Object.keys(DIMS)[i]) ?? 0)));
  return { kind: 'value', v, sigma, dim, approx, text: qcalc(text) };
}

// ---------------------------------------------------------------- oracle (mpmath, 50 digits)
const py = firstOf(process.env.ORACLE_PY, join(root, 'tests/golden/.venv/bin/python'), join(main, 'tests/golden/.venv/bin/python'));
function oracle(exprs) {
  if (!py) return exprs.map(() => null);
  const prog = 'import sys,json\nfrom mpmath import mp,mpf,pi,sqrt\nmp.dps=60\n' +
    'print(json.dumps([mp.nstr(eval(e),50,min_fixed=-9999,max_fixed=9999) if e else None for e in json.loads(sys.stdin.read())]))';
  const out = execFileSync(py, ['-I', '-c', prog], { input: JSON.stringify(exprs), encoding: 'utf8' });
  return JSON.parse(out).map((s) => (s ? parseNum(s) : null));
}

// ---------------------------------------------------------------- the cases
// The 26 spike cases (engine/qalc/cases.yaml: qalc text, oracle value and uncertainty); here their Giac form.
const SPIKE_GIAC = {
  u01: ['5*{k:m h^-1}', 'm s^-1'], u02: ['60*{mph}', 'k:m h^-1'], u03: ['1*{in}', 'c:m'], u04: ['1*{atm}', 'Pa'],
  u05: ['100*{oF}', 'oC'], u06: ['0*{oC}', 'K'], u07: ['1*{k:W h}', 'J'], u08: ['1*{eV}', 'J'], u09: ['1*{lbf}', 'N'],
  u10: ['1*{hp}', 'W', 'nofactor'], u11: ['1*{bar}', 'psi'], u12: ['1*{L}', 'm^3'], u13: ['1*{nmi}', 'm'], u14: ['1*{rad}', 'deg'],
  u15: ['3*{m}*4*{s}'],
  c01: ['{=c}'], c02: ['{=planck}'], c03: ['{=N_A}'], c04: ['{=k_B}'], c05: ['{=q_e}'], c06: ['{=gas_constant}'], c07: ['{=g_0}'],
  e01: ['[3±0.1]*[2±0.2]'], e02: ['[10±0.5]+[5±0.2]'], e03: ['[10±1]/[2±0.1]'], e04: ['[2±0.1]*{m}*[3±0.2]*{m}'],
};
const spike = parseYaml(readFileSync(join(root, 'engine/qalc/cases.yaml'), 'utf8')).cases;
const CASES = spike.map((s) => ({ group: 'spike', id: s.id, giac: SPIKE_GIAC[s.id][0], to: SPIKE_GIAC[s.id][1], expect: SPIKE_GIAC[s.id][2],
  qalc: s.expr, oracle: s.value, oracleUnc: s.unc, src: s.source, note: s.note }));
// docs/04 4.1's table (rows not already in the spike cases), and tasks t02, t04, t10. Oracle expressions are the
// definitions (1959 yard and pound, SI 2019); `expect` names a check that must catch the case.
CASES.push(
  { group: 'docs04', id: 'd01', giac: '72*{k:m h^-1}', to: 'm s^-1', qalc: '72 km/h to m/s', oracle: '72*mpf(1000)/3600', src: 'derived' },
  { group: 'docs04', id: 'd02', giac: '1*{in}', to: 'm:m', qalc: '1 in to mm', oracle: "mpf('25.4')", src: 'derived' },
  { group: 'docs04', id: 'd03', giac: '1*{ft}', to: 'm', qalc: '1 ft to m', oracle: "mpf('0.3048')", src: 'derived' },
  { group: 'docs04', id: 'd04', giac: '1*{mph}', to: 'm s^-1', qalc: '1 mph to m/s', oracle: "1760*mpf('0.9144')/3600", src: 'derived' },
  { group: 'docs04', id: 'd05', giac: '1/3*{m}', to: 'c:m', qalc: '1/3 m to cm', oracle: 'mpf(100)/3', src: 'derived' },
  { group: 'docs04', id: 'd06', giac: '20*{oC}', to: 'K', qalc: '20 °C to K', oracle: "20+mpf('273.15')", src: 'derived' },
  { group: 'docs04', id: 'd07', giac: '300*{K}', to: 'oC', qalc: '300 K to °C', oracle: "300-mpf('273.15')", src: 'derived' },
  { group: 'docs04', id: 'd08', giac: '20*{oC}', to: 'oF', qalc: '20 °C to °F', oracle: "20*mpf(9)/5+32", src: 'derived' },
  { group: 'docs04', id: 'd09', giac: '90*{deg}', to: 'rad', qalc: '90 deg to rad', oracle: 'pi/2', src: 'oracle' },
  { group: 'docs04', id: 'd10', giac: 'sqrt(2)*{m}', qalc: 'sqrt(2) m', oracle: 'sqrt(2)', src: 'oracle' },
  { group: 'docs04', id: 'd11', giac: '4.7*{k:ohm}', qalc: '4.7 kΩ', oracle: '4700', src: 'derived' },
  { group: 'docs04', id: 'd12', giac: '1*{u:F}*4.7*{k:ohm}', qalc: '1 µF * 4.7 kΩ', oracle: "mpf('4.7e-3')", src: 'derived' },
  { group: 'docs04', id: 'd13', giac: '4.7*{k:ohm}*2.2*{n:F}', qalc: '4.7 kΩ * 2.2 nF', oracle: "mpf('1.034e-5')", src: 'derived' },
  { group: 'docs04', id: 'd14', giac: '1*{eV}', to: 'J', qalc: '1 eV to J', oracle: "mpf('1.602176634e-19')", src: 'derived' },
  { group: 'docs04', id: 'd15', giac: '1*{m}+1*{s}', qalc: '1 m + 1 s', expect: 'mismatch', src: 'derived' },
  { group: 'docs04', id: 'd16', giac: '20*{oC}+5*{oC}', qalc: '20 °C + 5 °C', expect: 'temp', src: 'derived' },
  { group: 'docs04', id: 'd17', giac: '20*{oC}*2', qalc: '20 °C * 2', expect: 'temp', src: 'derived' },
  { group: 'docs04', id: 'd18', giac: '1*{hp}', to: 'W', qalc: '1 hp to W', oracle: "550*mpf('0.3048')*mpf('0.45359237')*mpf('9.80665')", expect: 'nofactor', src: 'oracle' },
  { group: 'docs04', id: 'd19', giac: '1*{Np}', to: 'dB', qalc: '1 Np to dB', expect: 'log', src: 'derived' },
  { group: 'docs04', id: 'd20', giac: '1*{W}', to: 'dBm', qalc: '1 W to dBm', expect: 'log', src: 'derived' },
  { group: 'docs04', id: 'd21', giac: '{=G}', qalc: 'G', expect: 'unc', src: 'derived', note: 'value ± σ: G18' },
  { group: 'docs04', id: 'd22', giac: '{=m_e}', qalc: 'electron_mass', expect: 'unc', src: 'derived', note: 'value ± σ: G18' },
  { group: 'docs04', id: 'd23', giac: '1*{m}', to: 's', qalc: '1 m to s', expect: 'mismatch', src: 'derived', note: 'an end slot that does not fit' },
  { group: 'docs04', id: 'd24', giac: '1*{mmHg}', to: 'Pa', qalc: '1 mmHg to Pa', oracle: "mpf('13.5951')*mpf('9.80665')", expect: 'nofactor', src: 'oracle', note: 'conventional mmHg = 13.5951 g/cm³ · g_n · 1 mm (backlog Needs the user item 6)' },
  { group: 'docs04', id: 'd25', giac: '1*{Btu}', to: 'J', qalc: '1 Btu to J', oracle: "mpf('1055.05585262')", src: 'derived', note: 'International Table Btu = 1055.05585262 J' },
  { group: 'docs04', id: 'd26', giac: 'sin(30*{deg})', qalc: 'sin(30 deg)', oracle: 'mpf(1)/2', src: 'derived', note: 'an angle unit inside a function' },
  { group: 'docs04', id: 'd27', giac: '1*{rad} {s^-1}', to: 'Hz', qalc: '1 rad/s to Hz', expect: 'mismatch', src: 'derived', note: 'rad stays in the dimension key; qalc leaves Hz·rad' },
  { group: 'docs04', id: 'd28', giac: '1*{rpm}', to: 'Hz', qalc: '1 rpm to Hz', expect: 'mismatch', src: 'derived', note: '1 rpm = 1/60 Hz as a rotation rate; rad = 1 would give π/30, the 2π trap' },
  { group: 'docs04', id: 'd29', giac: '60*{rpm}', to: 'rad s^-1', qalc: '60 rpm to rad/s', oracle: '2*pi', src: 'derived' },
  { group: 'docs04', id: 'd30', giac: 'ln(2*{m})', qalc: 'ln(2 m)', expect: 'mismatch', src: 'derived', note: 'a unit inside a function' },
  { group: 'docs04', id: 'd31', giac: 'sin(2*{m})', qalc: 'sin(2 m)', expect: 'mismatch', src: 'derived' },
  { group: 'docs04', id: 'd32', giac: '1*{n:V Hz^-0.5}', qalc: '1 nV/sqrt(Hz)', oracle: "mpf('1e-9')", src: 'derived', note: 'a half power: V·Hz^-1/2 = L²·M·T^-5/2·I^-1' },
  { group: 'tasks', id: 't02', giac: '72*{k:m h^-1}', to: 'm s^-1', qalc: '72 km/h to m/s', oracle: '20', src: 'derived' },
  { group: 'tasks', id: 't04', giac: '2*pi*25*{m:m}', qalc: '2*pi*25 mm', oracle: "mpf('0.1570796326794896619231321691639751442099')", src: 'oracle' },
  { group: 'tasks', id: 't10', giac: '[12.34±0.05]*{m}*[3.2±0.1]*{m}', qalc: '(12.34±0.05) m * (3.2±0.1) m', oracle: "mpf('39.488')", oracleUnc: "mpf('1.244329538345851532731350590709587226327')", src: 'derived' },
);
// fix the docs04 d27 text: "1 rad/s" as a unit group
CASES.find((c) => c.id === 'd27').giac = '1*{rad s^-1}';

// S1's 50 units (unit-presses.mjs UNITS), its extra list, and every unit on the draft pad (spec/unit-pad.yaml).
const up = readFileSync(join(root, 'tools/probes/unit-presses.mjs'), 'utf8');
const grab = (name) => [...up.match(new RegExp(`const ${name} = \\[([\\s\\S]*?)\\n\\];`))[1].matchAll(/\{ u: '([^']+)', parts: '([^']+)'/g)].map((m) => ({ u: m[1], parts: m[2] }));
const S1 = grab('UNITS'), EXTRA = grab('EXTRA');
const pad = parseYaml(readFileSync(join(root, 'spec/unit-pad.yaml'), 'utf8'));
const PAD = [...new Set(pad.units.flatMap((r) => [r.tap, r.up, r.down]).filter(Boolean))].map((id) => ({ u: id, parts: id }));
const PADP = pad.prefixes.flatMap((r) => [r.tap, r.up, r.down]).filter(Boolean);

// ---------------------------------------------------------------- run
const oracleExprs = CASES.flatMap((c) => [c.oracle ?? null, c.oracleUnc ?? null]);
const orv = oracle(oracleExprs.map((e) => (e === null ? '' : String(e))));
CASES.forEach((c, i) => { c.or = orv[2 * i]; c.orUnc = orv[2 * i + 1]; });

const verdict = (c, g, q) => {
  if (c.expect) {
    if (g.kind === c.expect) {
      const qOr = c.or && q.kind === 'value' ? (close(q.v, c.or, 30) ? '; qalc agrees with the oracle' : '; qalc wrong (oracle)') : '';
      return `caught (${c.expect})${qOr}`;
    }
    if (c.expect === 'unc' && g.kind === 'unc') return 'G18';
    return `NOT CAUGHT (Giac: ${g.kind})`;
  }
  if (g.kind !== 'value') return `GIAC ${g.kind.toUpperCase()}: ${g.msg}`;
  const tol = g.approx || q.approx ? 30 : 35;
  const gOr = c.or ? close(g.v, c.or, tol) : null;
  const qSame = q.kind === 'value' && close(q.v, g.v, tol) && (c.to || q.dim === g.dim);
  const uncOk = !c.orUnc || (g.sigma && close(g.sigma.v, c.orUnc, 30));
  if (gOr === false) return 'GIAC WRONG (oracle)';
  if (!uncOk) return 'GIAC σ WRONG';
  if (qSame) {
    if (c.orUnc && !(q.sigma && close(q.sigma, c.orUnc, 30))) return 'equal value; qalc σ differs';
    return 'equal';
  }
  if (gOr) return 'qalc wrong (oracle)';
  return 'DIFFER (no oracle)';
};

const rows = [];
for (const c of CASES) {
  const t0 = performance.now(); calls = 0;
  const g = giacEval(c);
  const ms = performance.now() - t0;
  let q;
  try { q = qalcEval(c.qalc, !!c.to); } catch (e) { q = { kind: 'error', text: String(e.message ?? e) }; }
  rows.push({ c, g, q, ms, calls, v: verdict(c, g, q) });
}

// units: 1 <unit> → SI
const unitRows = [];
const qalcName = (parts) => tokens(parts).map((t) => `${t.pfx ? (t.pfx === 'u' ? 'µ' : t.pfx) : ''}${t.u}${t.e !== '1' ? `^(${t.e})` : ''}`).join('*');
const seen = new Set();
for (const [list_, from] of [[S1, 'S1'], [PAD, 'pad'], [EXTRA, 'extra']]) {
  for (const x of list_) {
    if (seen.has(x.parts)) { unitRows.find((r) => r.parts === x.parts).from += `, ${from}`; continue; }
    seen.add(x.parts);
    const c = { giac: `1*{${x.parts}}` };
    calls = 0; const t0 = performance.now();
    const g = giacEval(c);
    const ms = performance.now() - t0;
    let q;
    try { q = qalcEval(`1 ${qalcName(x.parts)}`, false); } catch (e) { q = { kind: 'error', text: String(e.message ?? e) }; }
    let v;
    const noAngle = (d) => d.split('·').filter((x) => !/^angle/.test(x)).join('·') || '1';
    if (g.kind === 'value') {
      const same = q.kind === 'value' && close(q.v, g.v, g.approx ? 30 : 35);
      v = same && q.dim === g.dim ? 'equal'
        : same && q.dim === noAngle(g.dim) ? 'equal (qalc\'s SI form drops the angle: rad = 1)'
        : `DIFFER (qalc ${q.kind === 'value' ? `${sig(q.v)} ${q.dim}` : q.text})`;
    }
    else if (g.kind === 'temp') v = 'affine: alone only (G17)';
    else if (g.kind === 'log') v = 'logarithmic (G17)';
    else v = `no factor: ${g.msg}${from === 'extra' && !/G\d/.test(g.msg) ? ' (outside the gate: S1\'s extras; G13\'s data audit adds it)' : ''}`;
    unitRows.push({ u: x.u, parts: x.parts, from, g, q, ms, calls, v });
  }
}
for (const p of PADP) if (!byId.get(`pfx:${p}`)?.si) unitRows.push({ u: `prefix ${p}`, parts: p, from: 'pad', g: { kind: 'nofactor' }, v: 'NO PREFIX FACTOR' });

// timing: 3 rounds over every evaluable case and unit, the last timed
const evals = [...CASES.map((c) => c), ...unitRows.filter((r) => r.g.kind === 'value').map((r) => ({ giac: `1*{${r.parts}}` }))];
let times = [];
for (let round = 0; round < 3; round++) {
  times = [];
  for (const c of evals) { const t0 = performance.now(); giacEval(c); times.push(performance.now() - t0); }
}
const sorted = [...times].sort((a, b) => a - b);
const pct = (p) => sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
const callCounts = [];
for (const c of evals) { calls = 0; giacEval(c); callCounts.push(calls); }

// the units without an exact factor, and what each needs
function owner(u) {
  const id = u.id.slice(5);
  if (isLog(u)) return 'G17: a logarithmic rule';
  if (['hp', 'mmHg'].includes(id)) return 'G13: our exact factor (qalc\'s is wrong)';
  if (['nat', 'trit', 'Hart'].includes(id)) return 'G13: an exact irrational factor (1/ln 2, log2 3, log2 10 bit)';
  if (['cal_fifteen', 'cal_mean'].includes(id)) return 'G13: a measured calorie (no exact SI factor): a value with its uncertainty, or leave out';
  if (id === 'solar_mass') return 'a constant with its uncertainty (astronomical, not CODATA)';
  return 'a CODATA value with its uncertainty (as a constant)';
}
const noSi = units.filter((u) => !u.si);

// ---------------------------------------------------------------- print
const out = [];
const p = (s = '') => { out.push(s); console.log(s); };
const show = (g) => (g.kind === 'value' ? `${g.exact.length > 40 ? sig(g.v) : g.exact}${g.approx ? ` ≈ ${sig(g.v)}` : ''}${g.sigma ? ` ± ${g.sigma.exact} ≈ ${sig(g.sigma.v)}` : ''}${g.dim !== '1' ? ` ${g.dim}` : ''}` : `${g.kind}: ${g.msg}`);
const showQ = (q) => (q.kind === 'value' ? `${sig(q.v)}${q.sigma ? ` ± ${sig(q.sigma)}` : ''}${q.dim !== '1' ? ` ${q.dim}` : ''}` : `${q.kind}: ${q.text}`);
p(`units-giac probe (G15). Index: ${units.length} units, ${units.filter((u) => u.si).length} with si, ${units.filter((u) => u.dim).length} with dim. Giac ${process.env.GIAC_MJS ?? process.env.GIAC_OUT ?? 'default'}; qalc ${qdir}; oracle ${py ?? 'none'}`);
p('\n## Cases (Giac with the index factors; qalc dev build; oracle)\n');
p('| id | input | Giac | qalc | oracle | verdict |');
p('|---|---|---|---|---|---|');
for (const r of rows) p(`| ${r.c.id} | \`${r.c.qalc}\` | ${show(r.g)} | ${r.c.expect ? `\`${r.q.text}\`` : showQ(r.q)} | ${r.c.or ? sig(r.c.or) : '—'}${r.c.orUnc ? ` ± ${sig(r.c.orUnc)}` : ''} | ${r.v}${r.c.note ? ` (${r.c.note})` : ''} |`);
p('\n## 1 unit → SI (S1\'s 50, the draft pad, S1\'s extras)\n');
p('| unit | from | Giac (SI) | qalc (SI) | verdict |');
p('|---|---|---|---|---|');
for (const r of unitRows) p(`| ${r.u} | ${r.from} | ${r.g.kind === 'value' ? show(r.g) : r.g.kind} | ${r.q ? showQ(r.q) : '—'} | ${r.v} |`);
p(`\n## Timing (desktop, Node ${process.version}; Giac warm; 3 rounds over ${evals.length} evaluations, the last timed)\n`);
const slow = evals.map((c, i) => [times[i], c.qalc ?? c.giac]).sort((a, b) => b[0] - a[0]).slice(0, 3);
p(`median ${pct(50).toFixed(2)} ms, p95 ${pct(95).toFixed(2)} ms, max ${sorted.at(-1).toFixed(2)} ms; Giac calls per evaluation: ${[...new Set(callCounts)].sort().join(' or ')} (mean ${(callCounts.reduce((a, b) => a + b, 0) / callCounts.length).toFixed(2)}); slowest: ${slow.map(([t, x]) => `${x} ${t.toFixed(2)} ms`).join(', ')}`);
p(`\n## The ${noSi.length} units without si\n`);
const byOwner = new Map();
for (const u of noSi) { const o = owner(u); byOwner.set(o, [...(byOwner.get(o) ?? []), u.id.slice(5)]); }
for (const [o, ids] of byOwner) p(`- ${o} (${ids.length}): ${ids.join(', ')}`);

// the gate
const bad = rows.filter((r) => /WRONG|DIFFER|NOT CAUGHT|GIAC [A-Z]/.test(r.v));
const unitBad = unitRows.filter((r) => /S1|pad/.test(r.from) && (/DIFFER|NO PREFIX/.test(r.v) || (r.v.startsWith('no factor') && !/G13|G17|G7/.test(r.v))));
const t10 = rows.find((r) => r.c.id === 't10');
const caught = ['d15', 'd16', 'd17'].map((id) => rows.find((r) => r.c.id === id)).every((r) => r.v.startsWith('caught'));
p('\n## Gate (P15)\n');
p(`- every case equal, or qalc's error shown by an oracle/derived value: ${bad.length ? `FAIL (${bad.map((r) => r.c.id).join(', ')})` : 'PASS'}`);
p(`- 1 m + 1 s and 20 °C × 2 caught: ${caught ? 'PASS' : 'FAIL'}`);
p(`- t10's σ = ${t10.g.sigma?.exact} ≈ ${sig(t10.g.sigma?.v)}: ${t10.g.sigma && close(t10.g.sigma.v, t10.c.orUnc, 30) ? 'PASS' : 'FAIL'}`);
p(`- p95 ≤ 5 ms per evaluation: ${pct(95) <= 5 ? 'PASS' : 'FAIL'} (${pct(95).toFixed(2)} ms)`);
p(`- every unit on the draft pad and in S1's 50 has a factor or a named owner: ${unitBad.length ? `FAIL (${unitBad.map((r) => r.u).join(', ')})` : 'PASS'}`);
if (MD) {
  mkdirSync(join(root, 'tools/probes/_out'), { recursive: true });
  writeFileSync(join(root, 'tools/probes/_out/units-giac.md'), `${out.join('\n')}\n`);
}
