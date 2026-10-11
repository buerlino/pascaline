// SPDX-License-Identifier: GPL-3.0-or-later
// Solve-app strategy for one equation in one unknown (docs/02 section 4), from the spike (23/23 cases).
//
// 1. f = left - right, f' and f'' exact from Giac.
// 2. Bracket search: from the guess, step outwards on both sides (h, 2h, 4h, …) until f changes sign.
// 3. Bracket → Brent (GSL via Giac `fsolve(f, x=a..b, brent_solver)`, double precision).
//    No bracket → damped Newton from the guess at `workDigits`.
// 4. Polish at `workDigits` with Schröder's step f·f'/(f'²−f·f''), which converges fast on simple and
//    multiple roots alike (plain Newton is only linear on x²=0).
// 5. Residual check: |f(root)| / max(1, |left(root)|, |right(root)|) at `workDigits`; above `warnRel` → ⚠.
//    A sign change whose "root" fails the check is a pole or jump (tan(x) at π/2): the search goes on.
// Runs synchronously next to the engine (inside the Giac worker, or in Node for tests).
// Giac variable names have no underscore: `name_d`, `name_f` … parse as a value with a unit.
import { toExactLiterals, type Giac } from "./homeEval.ts";
import { decimalFromString, formatReal, toText } from "./format.ts";

export interface SolveSettings {
  digits: number;
  workDigits: number;
  warnRel: number;
  budgetMs: number;
  maxBracketSteps: number;
}

export const defaultSolveSettings: SolveSettings = {
  digits: 12,
  workDigits: 30,
  warnRel: 1e-15,
  budgetMs: 2000,
  maxBracketSteps: 60,
};

export type SolveMethod = "exact-zero" | "brent" | "newton" | "none";

export interface SolveResult {
  ok: boolean;
  /** Root rounded to `digits` significant digits (STD, format.ts), or a reason when !ok. */
  display: string;
  method: SolveMethod;
  /** Info line, like a calculator's "sign reversal" note: what happened. */
  info: string;
  bracket?: [number, number];
  /** Relative residual at workDigits (see above). */
  residualRel?: number;
  warn: boolean;
  /** Sign changes rejected as poles/jumps before the answer. */
  rejected: number;
  ms: number;
}

/** Internal numbers only (search points, comparisons); never shown to users. */
function num(s: string): number | undefined {
  const t = s.trim();
  if (!/^-?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/.test(t)) return undefined;
  const v = Number(t);
  return Number.isFinite(v) ? v : undefined;
}

export function solve1(
  giac: Giac,
  equation: string,
  variable: string,
  guess: string,
  s: SolveSettings = defaultSolveSettings,
  now: () => number = () => performance.now(),
): SolveResult {
  const t0 = now();
  const v = variable;
  const ev = (x: string) => giac.eval(x);
  let rejected = 0;
  const done = (r: Omit<SolveResult, "ms" | "rejected">): SolveResult => {
    ev(`Digits:=${s.digits}`);
    return { ...r, rejected, ms: now() - t0 };
  };

  // 1. f and its derivatives
  const hasEq = /(^|[^:<>=!])=([^=]|$)/.test(equation);
  // Decimal literals exact (0.5 → 1/2, 1e100 → 10^100), as in Home: a double constant would make f
  // a double-precision function, capping the 30-digit polish at ~1e-16.
  ev(`pasq:=(${toExactLiterals(equation)})`);
  ev(hasEq ? "paslft:=left(pasq);pasrgt:=right(pasq)" : "paslft:=pasq;pasrgt:=0");
  const fdef = ev(`pasf:=paslft-pasrgt`);
  if (fdef.startsWith("GIAC_ERROR")) return done({ ok: false, display: fdef, method: "none", info: "bad equation", warn: false });
  ev(`pasfa:=diff(pasf,${v})`);
  ev(`pasfb:=diff(pasfa,${v})`);
  ev(`Digits:=${s.digits}`);

  const f = (x: number) => num(ev(`evalf(subst(pasf,${v}=${x}))`));

  /** Polish pasx at workDigits; returns the last relative step (0 when f is exactly 0). */
  const polish = (steps: number): number => {
    ev(`Digits:=${s.workDigits}`);
    let rel = Infinity;
    for (let i = 0; i < steps; i++) {
      ev(`pasv:=evalf(subst([pasf,pasfa,pasfb],${v}=pasx))`);
      if (ev("pasv[0]==0") === "true") return 0;
      const st = ev("passt:=evalf(pasv[0]*pasv[1]/(pasv[1]^2-pasv[0]*pasv[2]))");
      const step = num(st);
      if (step === undefined) break;
      ev("pasx:=pasx-passt");
      const x = num(ev("pasx"));
      if (x === undefined) break;
      rel = Math.abs(step) / Math.max(Math.abs(x), 1e-300);
      if (rel < 10 ** -(s.workDigits - 3)) break;
    }
    return rel;
  };

  /** Relative residual of pasx at workDigits. */
  const residual = (): number => {
    ev(`Digits:=${s.workDigits}`);
    const r = num(ev(`evalf(abs(subst(pasf,${v}=pasx)))`));
    const scale = num(ev(`evalf(max(1,abs(subst(paslft,${v}=pasx)),abs(subst(pasrgt,${v}=pasx))))`));
    return r === undefined || scale === undefined ? Infinity : r / scale;
  };

  const show = (): string => {
    const r = decimalFromString(ev(`evalf(pasx,${s.workDigits})`));
    return r ? toText(formatReal(r, { format: "STD", digits: s.digits })) : ev("pasx");
  };

  /** Set pasx from an internal number or Giac numeral, as a workDigits MPFR value. A value assigned
   *  at Digits:=12 stays a double even after Digits:=30, so go through exact() first. */
  const setX = (val: string) => {
    ev(`Digits:=${s.workDigits}`);
    ev(`pasx:=evalf(exact(${val}),${s.workDigits})`);
  };

  /** Converged polish (or f exactly 0) and a small residual: pasx is a root. */
  const accept = (): { ok: boolean; rr: number } => {
    const rel = polish(8);
    const rr = residual();
    if (ev(`evalf(subst(pasf,${v}=pasx))==0`) === "true") {
      // f is exactly 0 at workDigits. Real root, or underflow (exp(x) at x=-1e9 is 0 even in MPFR)?
      // Accept when the CAS proves an exact root nearby, or when f is nonzero just beside x.
      if (snap()) return { ok: true, rr: 0 };
      ev(`pasdl:=evalf(max(abs(pasx),1e-300)*10^(-${s.workDigits - 5}))`);
      const isolated = ev(`evalf(subst(pasf,${v}=pasx+pasdl))!=0 and evalf(subst(pasf,${v}=pasx-pasdl))!=0`) === "true";
      return { ok: isolated, rr };
    }
    return { ok: rel < 1e-20 && rr <= s.warnRel, rr };
  };

  /** Snap to 0 or to the nearest integer when Giac proves it is an exact root of the equation
   *  (decimal literals made exact). Cancellation can't be fixed by more Newton steps: cos(x)-1 is
   *  exactly 0 at 30 digits for every |x| < 1e-15, so the numeric root lands anywhere in there. */
  const snap = (): boolean => {
    const x = num(ev("pasx"));
    if (x === undefined) return false;
    const n = Math.round(x);
    if (Math.abs(x - n) > 1e-9 * Math.max(1, Math.abs(x)) || !Number.isSafeInteger(n)) return false;
    ev(`pasqx:=(${toExactLiterals(equation)})`);
    const lhsMinusRhs = hasEq ? "left(pasqx)-right(pasqx)" : "pasqx";
    if (ev(`simplify(subst(${lhsMinusRhs},${v}=${n}))==0`) !== "true") return false;
    ev(`pasx:=${n}`);
    return true;
  };

  const finish = (method: SolveMethod, info: string, rr: number, bracket?: [number, number]): SolveResult => {
    const exact = snap();
    return done({ ok: true, display: show(), method, info: exact ? `${info}; exact root (checked by CAS)` : info, bracket, residualRel: rr, warn: rr > s.warnRel });
  };

  // 2. bracket search
  const x0 = num(ev(`evalf(${guess})`));
  if (x0 === undefined) return done({ ok: false, display: "guess is not a real number", method: "none", info: "", warn: false });
  const h = Math.max(Math.abs(x0), 1) * 1e-2;
  const f0 = f(x0);
  const sides = [-1, 1].map((dir) => ({ dir, x: x0, fx: f0 }));
  for (let k = -1; k <= s.maxBracketSteps; k++) {
    if (now() - t0 > s.budgetMs) break;
    const found: { a: number; b: number; zero: boolean }[] = [];
    if (k < 0) {
      if (f0 === 0) found.push({ a: x0, b: x0, zero: true });
    } else {
      for (const side of sides) {
        const p = x0 + side.dir * h * 2 ** k;
        const fp = f(p);
        if (fp === undefined) continue; // outside the domain, a pole, or complex: keep the last good point
        if (fp === 0) found.push({ a: p, b: p, zero: true }); // zero in double precision: confirmed below
        else if (side.fx !== undefined && Math.sign(fp) !== Math.sign(side.fx)) found.push({ a: Math.min(side.x, p), b: Math.max(side.x, p), zero: false });
        side.x = p;
        side.fx = fp;
      }
    }
    // Both sides grow symmetrically, so brackets found in the same round can be equally far away:
    // solve each and keep the root nearest the guess.
    let best: { root: string; dist: number; br: (typeof found)[number]; rr: number } | null = null;
    for (const br of found) {
      if (br.zero) {
        setX(k < 0 ? toExactLiterals(guess) : String(br.a));
      } else {
        ev(`Digits:=${s.digits}`);
        const out = ev(`fsolve(pasf,${v}=${br.a}..${br.b},brent_solver)`);
        const m = /^\[([^,\]]+)/.exec(out);
        if (!m || num(m[1] ?? "") === undefined) {
          rejected++;
          continue;
        }
        setX(m[1] ?? "");
      }
      ev("pasy:=pasx");
      let a = accept();
      const xp = num(ev("pasx"));
      if (!br.zero && (xp === undefined || xp < br.a || xp > br.b)) {
        ev("pasx:=pasy"); // polish left the bracket: keep Brent's value
        a = { ok: residual() <= s.warnRel, rr: residual() };
      }
      if (!a.ok) {
        rejected++; // a sign change (or double-precision zero) that isn't a root: pole, jump or underflow
        continue;
      }
      const root = ev("pasx");
      const dist = Math.abs((num(root) ?? Infinity) - x0);
      if (!best || dist < best.dist) best = { root, dist, br, rr: a.rr };
    }
    if (best) {
      const { br, rr } = best;
      ev(`Digits:=${s.workDigits}`);
      ev(`pasx:=${best.root}`);
      return finish(br.zero ? "exact-zero" : "brent", br.zero ? `f(${br.a})=0` : `sign change in [${br.a}, ${br.b}]`, rr, br.zero ? undefined : [br.a, br.b]);
    }
  }

  // 3b. no usable bracket: damped Newton from the guess, then the same polish
  setX(toExactLiterals(guess));
  for (let i = 0; i < 120 && now() - t0 < s.budgetMs; i++) {
    const fx = num(ev(`evalf(abs(subst(pasf,${v}=pasx)))`));
    if (fx === undefined || fx === 0) break;
    const st = num(ev(`passt:=evalf(subst(pasf/pasfa,${v}=pasx))`));
    if (st === undefined) break;
    let lambda = 1;
    for (let j = 0; j < 20; j++) {
      const fn = num(ev(`evalf(abs(subst(pasf,${v}=pasx-${lambda}*passt)))`));
      if (fn !== undefined && fn <= fx) break;
      lambda /= 2;
    }
    ev(`pasx:=pasx-${lambda}*passt`);
    const x = num(ev("pasx"));
    if (x === undefined) break;
    if (Math.abs(st) <= 1e-12 * Math.max(Math.abs(x), 1e-300)) break;
  }
  const a = accept();
  if (!a.ok || num(ev("pasx")) === undefined) {
    return done({ ok: false, display: "no root found", method: "none", info: rejected ? `${rejected} sign change(s) without a root (pole, jump or underflow)` : "no sign change, Newton did not converge", warn: false });
  }
  return finish("newton", "no sign change: Newton + polish (even-multiplicity root or touch)", a.rr);
}
