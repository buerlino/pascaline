// SPDX-License-Identifier: GPL-3.0-or-later
// G116: the edge generator of the oracle sweep, beside gen.ts (which the gate's fixed seed keeps unchanged). The same Case shape and
// operator mix, depth up to 3, but the leaves sit where Giac goes wrong: next to branch cuts and singular points (±1 ± 10^-k,
// cos(π/N), sin(π/2 − π/N), 0 ± 10^-k, π/2 ± 10^-k, 90 ± 10^-k for DEG, negative reals under √, ln and acosh), integers past the
// double (2^31, 2^53 ± 1, 10^20 + 1, 30!), and huge and tiny magnitudes (1ᴇ±300, 1ᴇ±1000, 10^50). The functions add acosh, atanh and
// the cube root to gen.ts's. Pure; `childrenOf` gives a generated tree's operands, for the smallest subtree that still fails.
import { lcg, type Case } from "./gen.ts";

interface Node extends Case {
  atom: boolean;
  plain: boolean;
  kids: Node[];
}

/** Every leaf class; 2,000 trees of one seed hold each at least once (sweep.test.ts). */
export const EDGE_CLASSES = ["cut", "cospi", "sinpi", "zero", "halfpi", "deg90", "neg", "int", "huge", "tiny", "plain"] as const;
export type EdgeClass = (typeof EDGE_CLASSES)[number];

const KS = [3, 6, 9, 15];
const NS = [3, 4, 5, 6, 7, 8];
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
  { latex: "\\operatorname{acosh}", mp: "ACOSH", angle: false },
  { latex: "\\operatorname{atanh}", mp: "ATANH", angle: false },
  { latex: "\\ln", mp: "LN", angle: false },
  { latex: "\\log", mp: "LOG10", angle: false },
];

const pick = <T>(r: () => number, a: readonly T[]): T => a[Math.min(a.length - 1, Math.floor(r() * a.length))]!;
const lf = (latex: string, mp: string, atom: boolean, plain: boolean, angle = false): Node => ({ latex, mp, angle, atom, plain, kids: [] });
const tenTo = (k: number): { latex: string; mp: string } => ({ latex: `10^{${k}}`, mp: `POW(mpf('10'),mpf('${k}'))` });

/** 1 ± 10^-k (or −1 ± 10^-k), as a typed decimal or as a power. */
function cut(r: () => number): Node {
  const k = pick(r, KS);
  const one = r() < 0.5 ? 1 : -1;
  const plus = r() < 0.5;
  if (r() < 0.5) {
    const v = one + (plus ? 1 : -1) * 10 ** -k; // the text below is exact; v only picks the digits
    const abs = Math.abs(v);
    const text = abs >= 1 ? `1.${"0".repeat(k - 1)}1` : `0.${"9".repeat(k)}`;
    const t = `${v < 0 ? "-" : ""}${text}`;
    return lf(t, `mpf('${t}')`, v > 0, v > 0);
  }
  const p = tenTo(-k);
  const o = one < 0 ? "-1" : "1";
  return lf(`${o}${plus ? "+" : "-"}${p.latex}`, `(mpf('${o}'))${plus ? "+" : "-"}(${p.mp})`, false, false);
}

function leaf(r: () => number, seen?: Map<string, number>): Node {
  const cls = pick(r, EDGE_CLASSES);
  seen?.set(cls, (seen.get(cls) ?? 0) + 1);
  switch (cls) {
    case "cut":
      return cut(r);
    case "cospi": {
      const p = tenTo(pick(r, NS));
      return lf(`\\cos\\left(\\frac{\\pi}{${p.latex}}\\right)`, `COS(DIV(PI,${p.mp}))`, true, false, true);
    }
    case "sinpi": {
      const p = tenTo(pick(r, NS));
      return lf(`\\sin\\left(\\frac{\\pi}{2}-\\frac{\\pi}{${p.latex}}\\right)`, `SIN((DIV(PI,mpf('2')))-(DIV(PI,${p.mp})))`, true, false, true);
    }
    case "zero": {
      const k = pick(r, KS);
      const neg = r() < 0.4;
      if (r() < 0.5) {
        const t = `${neg ? "-" : ""}1ᴇ-${k}`;
        return lf(t, `mpf('${neg ? "-" : ""}1e-${k}')`, false, false);
      }
      const p = tenTo(-k);
      return neg ? lf(`-${p.latex}`, `-(${p.mp})`, false, false) : lf(p.latex, p.mp, false, false);
    }
    case "halfpi": {
      const p = tenTo(-pick(r, KS));
      const s = r() < 0.5 ? "+" : "-";
      return lf(`\\frac{\\pi}{2}${s}${p.latex}`, `(DIV(PI,mpf('2')))${s}(${p.mp})`, false, false);
    }
    case "deg90": {
      const p = tenTo(-pick(r, KS));
      const s = r() < 0.5 ? "+" : "-";
      return lf(`90${s}${p.latex}`, `(mpf('90'))${s}(${p.mp})`, false, false);
    }
    case "neg": {
      const a = pick(r, [
        { latex: "-2", mp: "mpf('-2')" },
        { latex: "-0.5", mp: "mpf('-0.5')" },
        { latex: "-1.000001", mp: "mpf('-1.000001')" },
        { latex: "-\\pi", mp: "-(PI)" },
      ]);
      const f = r();
      if (f < 1 / 3) return lf(`\\sqrt{${a.latex}}`, `sqrt(${a.mp})`, true, true);
      if (f < 2 / 3) return lf(`\\ln\\left(${a.latex}\\right)`, `LN(${a.mp})`, true, false);
      return lf(`\\operatorname{acosh}\\left(${a.latex}\\right)`, `ACOSH(${a.mp})`, true, false);
    }
    case "int": {
      const n = pick(r, ["0", "1", "-1", "2147483648", "9007199254740991", "9007199254740993", "100000000000000000001", "30!"]);
      if (n === "30!") return lf("30!", "FACT(30)", false, false);
      return lf(n, `mpf('${n}')`, !n.startsWith("-"), !n.startsWith("-"));
    }
    case "huge": {
      const k = pick(r, [300, 1000, 50]);
      if (k === 50) {
        const p = tenTo(50);
        return lf(p.latex, p.mp, false, false);
      }
      return lf(`1ᴇ${k}`, `mpf('1e${k}')`, false, false);
    }
    case "tiny": {
      const k = pick(r, [300, 1000]);
      return lf(`1ᴇ-${k}`, `mpf('1e-${k}')`, false, false);
    }
    case "plain": {
      const n = pick(r, ["2", "3", "0.5", "10", "\\pi"]);
      return lf(n, n === "\\pi" ? "PI" : `mpf('${n}')`, true, true);
    }
  }
}

const wrap = (n: Node, base = false): string => ((base ? n.plain : n.atom) ? n.latex : `\\left(${n.latex}\\right)`);
const node = (latex: string, mp: string, kids: Node[], atom: boolean, plain: boolean, angle = false): Node => ({
  latex,
  mp,
  angle: angle || kids.some((k) => k.angle),
  atom,
  plain,
  kids,
});

function build(r: () => number, depth: number, seen?: Map<string, number>): Node {
  if (depth <= 0 || r() < 0.25) return leaf(r, seen);
  const x = r();
  const sub = (): Node => build(r, depth - 1, seen);
  if (x < 0.35) {
    const f = pick(r, FNS);
    const a = sub();
    return node(`${f.latex}\\left(${a.latex}\\right)`, `${f.mp}(${a.mp})`, [a], true, false, f.angle);
  }
  if (x < 0.4) {
    const a = sub();
    return node(`\\sqrt{${a.latex}}`, `sqrt(${a.mp})`, [a], true, true);
  }
  if (x < 0.44) {
    const a = sub();
    return node(`\\sqrt[3]{${a.latex}}`, `CBRT(${a.mp})`, [a], true, true);
  }
  if (x < 0.48) {
    const a = sub();
    return node(`e^{${a.latex}}`, `exp(${a.mp})`, [a], false, false);
  }
  if (x < 0.52) {
    const a = sub();
    return node(`\\left|${a.latex}\\right|`, `ABS(${a.mp})`, [a], true, true);
  }
  const a = sub();
  const b = sub();
  if (x < 0.62) return node(`${wrap(a)}+${wrap(b)}`, `(${a.mp})+(${b.mp})`, [a, b], false, false);
  if (x < 0.72) return node(`${wrap(a)}-${wrap(b)}`, `(${a.mp})-(${b.mp})`, [a, b], false, false);
  if (x < 0.82) return node(`${wrap(a)}\\times ${wrap(b)}`, `(${a.mp})*(${b.mp})`, [a, b], false, false);
  if (x < 0.92) return node(`\\frac{${a.latex}}{${b.latex}}`, `DIV(${a.mp},${b.mp})`, [a, b], true, true);
  return node(`${wrap(a, true)}^{${b.latex}}`, `POW(${a.mp},${b.mp})`, [a, b], false, false);
}

const KIDS = new Map<string, Case[]>();
const toCase = (n: Node): Case => ({ latex: n.latex, mp: n.mp, angle: n.angle });
function remember(n: Node): void {
  if (n.kids.length === 0 || KIDS.has(n.latex)) return;
  KIDS.set(n.latex, n.kids.map(toCase));
  n.kids.forEach(remember);
}

/** `count` edge trees from `seed`, depth up to 3. `seen` (optional) counts the leaf classes drawn. */
export function generateEdges(seed: number, count: number, seen?: Map<string, number>): Case[] {
  const r = lcg(seed);
  const out: Case[] = [];
  for (let i = 0; i < count; i++) {
    const t = build(r, 3, seen);
    remember(t);
    out.push(toCase(t));
  }
  return out;
}

/** The operands of a tree generateEdges gave (a leaf, or a tree it did not give, has none). */
export function childrenOf(latex: string): Case[] {
  return KIDS.get(latex) ?? [];
}
