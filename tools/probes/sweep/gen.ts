// SPDX-License-Identifier: GPL-3.0-or-later
// G61: the generator of the oracle sweep (r16 Appendix B). A seeded LCG builds a tree of depth up to 3; each tree prints as keyboard
// LaTeX (what the keys write, through our parser) and as an mpmath expression for oracle.py. Pure.

export interface Case {
  /** Keyboard LaTeX. */
  latex: string;
  /** The same tree as a Python expression over oracle.py's names (SIN, POW, DIV, mpf('2.5'), …). */
  mp: string;
  /** True when the tree holds a trig or inverse trig function (it also runs in DEG). */
  angle: boolean;
}

interface Node extends Case {
  /** Plain leaf or closed form that needs no brackets as an operand; a power base is stricter (`plain`). */
  atom: boolean;
  plain: boolean;
}

/** The LCG of Appendix B: seed·1103515245 + 12345, 31 bits. */
export function lcg(seed: number): () => number {
  let s = BigInt(Math.abs(Math.trunc(seed))) & 0x7fffffffn;
  return () => {
    s = (s * 1103515245n + 12345n) & 0x7fffffffn;
    return Number(s) / 2147483648;
  };
}

const INTS = [0, 1, 2, 3, 5, 7, 10, 12];
const DECIMALS = ["0.1", "0.2", "0.3", "2.5", "0.001", "1.05", "9.81", "3.7"];
const EMANT = ["1.5", "2", "6.02"];
const EEXP = [3, -3, 8, -8, 22, -15];
const FACTS = [3, 5, 7, 10];
const FNS: { latex: string; mp: string; angle: boolean }[] = [
  { latex: "\\sin", mp: "SIN", angle: true },
  { latex: "\\cos", mp: "COS", angle: true },
  { latex: "\\tan", mp: "TAN", angle: true },
  { latex: "\\arcsin", mp: "ASIN", angle: true },
  { latex: "\\arccos", mp: "ACOS", angle: true },
  { latex: "\\arctan", mp: "ATAN", angle: true },
  { latex: "\\sinh", mp: "sinh", angle: false },
  { latex: "\\cosh", mp: "cosh", angle: false },
  { latex: "\\tanh", mp: "tanh", angle: false },
  { latex: "\\operatorname{asinh}", mp: "asinh", angle: false },
  { latex: "\\ln", mp: "LN", angle: false },
  { latex: "\\log", mp: "LOG10", angle: false },
];

const pick = <T>(r: () => number, a: readonly T[]): T => a[Math.min(a.length - 1, Math.floor(r() * a.length))]!;

function leaf(r: () => number): Node {
  const x = r();
  if (x < 0.45) {
    const n = pick(r, INTS);
    return { latex: `${n}`, mp: `mpf('${n}')`, angle: false, atom: true, plain: true };
  }
  if (x < 0.7) {
    const d = pick(r, DECIMALS);
    return { latex: d, mp: `mpf('${d}')`, angle: false, atom: true, plain: true };
  }
  if (x < 0.8) return { latex: "\\pi", mp: "PI", angle: false, atom: true, plain: true };
  if (x < 0.85) return { latex: "e", mp: "E", angle: false, atom: true, plain: true };
  if (x < 0.92) {
    const m = pick(r, EMANT);
    const k = pick(r, EEXP);
    return { latex: `${m}ᴇ${k}`, mp: `mpf('${m}e${k}')`, angle: false, atom: false, plain: false };
  }
  const n = pick(r, FACTS);
  return { latex: `${n}!`, mp: `FACT(${n})`, angle: false, atom: false, plain: false };
}

const wrap = (n: Node, base = false): string => ((base ? n.plain : n.atom) ? n.latex : `\\left(${n.latex}\\right)`);

function build(r: () => number, depth: number): Node {
  if (depth <= 0 || r() < 0.25) return leaf(r);
  const x = r();
  const sub = (): Node => build(r, depth - 1);
  if (x < 0.35) {
    const f = pick(r, FNS);
    const a = sub();
    return { latex: `${f.latex}\\left(${a.latex}\\right)`, mp: `${f.mp}(${a.mp})`, angle: f.angle || a.angle, atom: true, plain: false };
  }
  if (x < 0.42) {
    const a = sub();
    return { latex: `\\sqrt{${a.latex}}`, mp: `sqrt(${a.mp})`, angle: a.angle, atom: true, plain: true };
  }
  if (x < 0.47) {
    const a = sub();
    return { latex: `e^{${a.latex}}`, mp: `exp(${a.mp})`, angle: a.angle, atom: false, plain: false };
  }
  if (x < 0.5) {
    const a = sub();
    return { latex: `\\left|${a.latex}\\right|`, mp: `ABS(${a.mp})`, angle: a.angle, atom: true, plain: true };
  }
  const a = sub();
  const b = sub();
  const angle = a.angle || b.angle;
  if (x < 0.62) return { latex: `${wrap(a)}+${wrap(b)}`, mp: `(${a.mp})+(${b.mp})`, angle, atom: false, plain: false };
  if (x < 0.72) return { latex: `${wrap(a)}-${wrap(b)}`, mp: `(${a.mp})-(${b.mp})`, angle, atom: false, plain: false };
  if (x < 0.82) return { latex: `${wrap(a)}\\times ${wrap(b)}`, mp: `(${a.mp})*(${b.mp})`, angle, atom: false, plain: false };
  if (x < 0.92) return { latex: `\\frac{${a.latex}}{${b.latex}}`, mp: `DIV(${a.mp},${b.mp})`, angle, atom: true, plain: true };
  return { latex: `${wrap(a, true)}^{${b.latex}}`, mp: `POW(${a.mp},${b.mp})`, angle, atom: false, plain: false };
}

/** `count` trees from `seed`, depth up to 3. */
export function generate(seed: number, count: number): Case[] {
  const r = lcg(seed);
  const out: Case[] = [];
  for (let i = 0; i < count; i++) {
    const t = build(r, 3);
    out.push({ latex: t.latex, mp: t.mp, angle: t.angle });
  }
  return out;
}

/** Inputs that were found wrong or hanging and stay in every run at 12 digits in RAD (backlog F44, G58: they hung Home). */
export const PINNED: Case[] = [
  { latex: "e^{1.5ᴇ8}", mp: "exp(mpf('1.5e8'))", angle: false },
  { latex: "\\sqrt{e^{2ᴇ8}}", mp: "sqrt(exp(mpf('2e8')))", angle: false },
  { latex: "3+\\frac{e^{1.5ᴇ8}}{\\arcsin\\left(3\\right)}", mp: "(mpf('3'))+DIV(exp(mpf('1.5e8')),ASIN(mpf('3')))", angle: false },
  { latex: "\\arccos\\left(\\left(5!\\right)^{2.5+5!}\\right)", mp: "ACOS(POW(FACT(5),(mpf('2.5'))+FACT(5)))", angle: false },
  { latex: "e^{10^{7}}", mp: "exp(POW(mpf('10'),mpf('7')))", angle: false },
];
