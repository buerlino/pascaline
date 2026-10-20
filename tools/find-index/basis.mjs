// SPDX-License-Identifier: GPL-3.0-or-later
// G80: the basis of an inexact constant. libqalculate gives most derived constants as a formula over a few measured
// ones (fine_structure, rydberg, electron_u, ...); the index keeps each as Giac text over those leaves
// (`pasl_<leaf>`) and exact numbers, so a correlation (Z_0*e^2/(2h) is exactly alpha) is not lost in a flat value.
// Pure: takes the parsed variables (ref name -> { value, unit, unc, formula }), returns { basis, leaves } or { why }.

/** Units whose SI factor is 1 (the value is already in SI base units). */
const SI_UNITS = new Set(["m", "s", "kg", "C", "J", "K", "mol", "A"]);
const unitIsSi = (u) => !u || u.split("*").every((t) => SI_UNITS.has(t.replace(/\^\(?-?\d+\)?$/, "").trim()));

function tokenize(s) {
  const t = s.replace(/×/g, "*").replace(/−/g, "-");
  const out = [];
  for (const m of t.matchAll(/\s*(\d+\.?\d*(?:[eE][+-]?\d+)?|\.\d+|[A-Za-z_][A-Za-z0-9_]*|[()+\-*/^,])/gy)) out.push(m[1]);
  return out;
}

/** exact Giac text of a decimal: 6.62607015E-34 -> 662607015*10^(-42) */
export function exactNumber(text) {
  const m = /^(\d*)\.?(\d*)(?:[eE]([+-]?\d+))?$/.exec(text);
  const digits = (m[1] + m[2]).replace(/^0+(?=\d)/, "");
  const exp = Number(m[3] ?? 0) - m[2].length;
  return exp === 0 ? digits : `(${digits}*10^(${exp}))`;
}

/** Expands `ref` into Giac text. vars: Map ref -> { value, unit, unc, leafUnit }; returns { text } or { why }. */
export function basisOf(ref, vars) {
  const leaves = new Set();
  const stack = [];
  const fail = (why) => { throw Object.assign(new Error(why), { basisWhy: why }); };

  function expand(name, asNumber) {
    if (name === "pi") return "pi";
    if (name === "e") return "exp(1)";
    const v = vars.get(name);
    if (!v) fail(`unknown name ${name}`);
    if (v.unc !== undefined) {
      if (v.unit === "u" ? !asNumber : !unitIsSi(v.unit)) fail(`${name} has the unit ${v.unit}, not SI base units`);
      leaves.add(name);
      return `pasl_${name}`;
    }
    if (v.formula === undefined) {
      if (!unitIsSi(v.unit)) fail(`${name} has the unit ${v.unit}`);
      return exactNumber(v.value);
    }
    if (v.unit === "auto" || v.unit === "u" || v.unit?.includes("eV")) fail(`${name} carries a unit conversion`);
    if (stack.includes(name)) fail(`${name} refers to itself`);
    stack.push(name);
    try { return `(${parse(v.formula)})`; } finally { stack.pop(); }
  }

  function parse(src) {
    const tk = tokenize(src);
    let i = 0;
    const peek = () => tk[i];
    const next = () => tk[i++];
    const sum = () => {
      let a = prod();
      while (peek() === "+" || peek() === "-") { const op = next(); a = `${a}${op}${prod()}`; }
      return a;
    };
    const prod = () => {
      let a = unary();
      for (;;) {
        const p = peek();
        if (p === "*" || p === "/") { next(); a = `${a}${p}${unary()}`; }
        else if (p !== undefined && /^[A-Za-z_(]/.test(p) && /^[\d.]/.test(tk[i - 1] ?? "")) a = `${a}*${unary()}`; // 4pi
        else return a;
      }
    };
    const unary = () => {
      if (peek() === "-") { next(); return `(-${unary()})`; }
      return power();
    };
    const power = () => {
      const a = atom();
      if (peek() !== "^") return a;
      next();
      return `${a}^${unary()}`;
    };
    const atom = () => {
      const t = next();
      if (t === undefined) fail("formula ends early");
      if (t === "(") { const a = sum(); if (next() !== ")") fail("unbalanced ("); return `(${a})`; }
      if (/^[\d.]/.test(t)) return exactNumber(t);
      if (t === "nounit" && peek() === "(") { // nounit(x): the pure number of a leaf in u
        next();
        const a = expand(next(), true);
        if (next() !== ")") fail("unbalanced (");
        return a;
      }
      if (peek() === "(") {
        next();
        const a = sum();
        if (next() !== ")") fail("unbalanced (");
        if (t === "sqrt") return `sqrt(${a})`;
        return fail(`${t}() has no Giac form here`);
      }
      return expand(t, false);
    };
    const r = sum();
    if (i < tk.length) fail(`cannot read ${tk[i]}`);
    return r;
  }
  try {
    if (!vars.has(ref)) return { why: `no variable ${ref}` };
    const text = expand(ref, false);
    return { text: text.replace(/^\((.*)\)$/s, "$1"), leaves: [...leaves].sort() };
  } catch (e) {
    if (e.basisWhy) return { why: e.basisWhy };
    throw e;
  }
}
