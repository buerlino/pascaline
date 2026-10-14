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
// 6. Second polish (decisions M4-8): the root is polished again at workDigits+20 into `pasx2`. The digits on which
//    pasx and pasx2 agree are the confirmed ones (numericResult in solve.ts): a root that cancellation in f leaves
//    right to 25 digits is shown with 25 and ⚠, not with 30.
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
  /** Search window (Plot: the visible x range). Roots outside it are not reported. */
  lo?: number;
  hi?: number;
}

export const defaultSolveSettings: SolveSettings = {
  digits: 12,
  workDigits: 30,
  warnRel: 1e-15,
  budgetMs: 2000,
  maxBracketSteps: 60,
};

/** A residual up to this many times the estimated rounding noise of f counts as 0 (SB1). */
const NOISE_FACTOR = 100;

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
export function num(s: string): number | undefined {
  const t = negZero(s.trim());
  if (!/^-?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/.test(t)) return undefined;
  const v = Number(t);
  return Number.isFinite(v) ? v : undefined;
}

/** Giac prints a negative zero MPFR float as `0.-000…`; read it as `-0.000…`. */
export function negZero(t: string): string {
  return t.replace(/^0\.-(0+)$/, "-0.$1");
}

/** A search point for the info line, through our formatter (no binary noise such as 1.6400000000000001). */
function pt(x: number): string {
  const d = decimalFromString(String(x));
  return d ? toText(formatReal(d, { format: "STD", digits: 12 })) : "?";
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

  // Sign tests run at workDigits on the exact point: at 12 digits an expanded degree-20 polynomial is rounding
  // noise near x = 15, which made the bracket search see sign changes that are not there (SB3).
  const f = (x: number) => {
    ev(`Digits:=${s.workDigits}`);
    const r = num(ev(`evalf(subst(pasf,${v}=exact(${x})))`));
    ev(`Digits:=${s.digits}`);
    return r;
  };

  /** Polish the Giac variable x (pasx) at `digits` (workDigits); returns the last relative step (0 when f is exactly 0). */
  const polish = (steps: number, x = "pasx", digits = s.workDigits): number => {
    ev(`Digits:=${digits}`);
    let rel = Infinity;
    for (let i = 0; i < steps; i++) {
      ev(`pasv:=evalf(subst([pasf,pasfa,pasfb],${v}=${x}))`);
      if (ev("pasv[0]==0") === "true") return 0;
      const st = ev("passt:=evalf(pasv[0]*pasv[1]/(pasv[1]^2-pasv[0]*pasv[2]))");
      const step = num(st);
      if (step === undefined) break;
      ev(`${x}:=${x}-passt`);
      const xv = num(ev(x));
      if (xv === undefined) break;
      const r = Math.abs(step) / Math.max(Math.abs(xv), 1e-300);
      // Converged to the noise of f: f/f' is noise over noise from here on, and the step grows again. Keep the
      // iterate before it (seen with a quadruple root, where one step lands within 1e-28 of the root).
      if (r > rel && rel < 1e-6) {
        ev(`${x}:=${x}+passt`);
        break;
      }
      rel = r;
      if (rel < 10 ** -(digits - 3)) break;
    }
    return rel;
  };

  /** Step 6: pasx polished again at workDigits+20, into pasx2 (an exact root is copied). */
  const polishAgain = (): void => {
    const W2 = s.workDigits + 20;
    ev(`Digits:=${W2}`);
    if (ev("type(pasx)") === "integer" || ev("type(pasx)") === "rational") {
      ev("pasx2:=pasx");
      return;
    }
    // evalf widens an MPFR value without loss; exact() would round it to a nearby simple fraction (2/3 for
    // 0.6666666667666…, a triple root where the polish cannot move).
    ev(`pasx2:=evalf(pasx,${W2})`);
    polish(8, "pasx2", W2);
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

  /** f, f', f'' at pasx widened to workDigits+20 (the same point, evaluated with 10^20 times less rounding noise). */
  const evalWide = (): [number, number, number] | undefined => {
    const W2 = s.workDigits + 20;
    ev(`Digits:=${W2}`);
    ev(`pasxh:=evalf(pasx,${W2})`);
    ev(`pasvh:=evalf(subst([pasf,pasfa,pasfb],${v}=pasxh))`);
    const w = [0, 1, 2].map((i) => num(ev(`pasvh[${i}]`)));
    ev(`Digits:=${s.workDigits}`);
    return w.every((x) => x !== undefined) ? (w as [number, number, number]) : undefined;
  };

  /** SB1. f(pasx) failed the residual check, but is it only the rounding noise of evaluating f at workDigits?
   *  The noise is estimated as |f_W(x) − f_{W+20}(x)| (an expanded product of 25 factors loses ~15 digits to
   *  cancellation). A residual within NOISE_FACTOR times that is indistinguishable from 0 at this precision. A pole,
   *  a jump or a wrong root has f_W = f_{W+20} (noise ~ 1e-30·|f|), so the residual stays far above the bound. */
  const noiseLimited = (): boolean => {
    ev(`Digits:=${s.workDigits}`);
    const fW = num(ev(`evalf(subst(pasf,${v}=pasx))`));
    const w = evalWide();
    if (fW === undefined || w === undefined) return false;
    const noise = Math.abs(fW - w[0]);
    return noise > 0 && Math.abs(fW) <= NOISE_FACTOR * noise;
  };

  /** SB2. f is exactly 0 on a plateau around pasx (a multiple root: (x−1/3)^4 is 0 at 30 digits for |x−1/3| < 1e-8).
   *  Evaluated at workDigits+20, f must be tiny but not 0, and the multiplicity estimate m = 1/(1 − f·f''/f'²)
   *  (exactly m for c·(x−r)^m) must be a small integer. The tail of exp(x) (m = ∞) or of a Gaussian (m ≈ 2x²) is no root. */
  const multipleRoot = (): boolean => {
    const w = evalWide();
    if (w === undefined) return false;
    const [f0, f1, f2] = w;
    if (f0 === 0 || f1 === 0 || Math.abs(f0) > s.warnRel) return false;
    const m = 1 / (1 - (f0 * f2) / (f1 * f1));
    return Number.isFinite(m) && m >= 1.9 && m <= 16 && Math.abs(m - Math.round(m)) < 0.15;
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
      if (!isolated && multipleRoot()) return { ok: true, rr: 0 };
      return { ok: isolated, rr };
    }
    if (rel < 1e-20 && rr <= s.warnRel) return { ok: true, rr };
    // A multiple root at 0 (3x² = 0, the extremum of x³): every polish step is the size of x, so the
    // relative step never shrinks. Accept only when the CAS proves the nearby integer is an exact root.
    if (snap()) return { ok: true, rr: 0 };
    // The polish stopped at the noise of f (relative step ≥ 1e-20) and f(root) is that noise: accept. The digits
    // are then checked by the second polish (finish), which shows only the digits both agree on.
    if (rel < 1e-8 && noiseLimited()) return { ok: true, rr: 0 };
    return { ok: false, rr };
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
    polishAgain();
    return done({ ok: true, display: show(), method, info: exact ? `${info}; exact root (checked by CAS)` : info, bracket, residualRel: rr, warn: rr > s.warnRel });
  };

  /** Bisection on [a, b] with the sign tests of f (workDigits); returns the midpoint of the last interval. */
  const bisect = (a: number, b: number): number => {
    let fa = f(a);
    for (let i = 0; i < 60 && fa !== undefined; i++) {
      const mid = (a + b) / 2;
      if (mid === a || mid === b) break;
      const fm = f(mid);
      if (fm === undefined) break;
      if (fm === 0) return mid;
      if (Math.sign(fm) === Math.sign(fa)) {
        a = mid;
        fa = fm;
      } else b = mid;
    }
    return (a + b) / 2;
  };

  // 2. bracket search
  const x0 = num(ev(`evalf(${guess})`));
  if (x0 === undefined) return done({ ok: false, display: "guess is not a real number", method: "none", info: "", warn: false });
  const h = Math.max(Math.abs(x0), 1) * 1e-2;
  const f0 = f(x0);
  const lo = s.lo ?? -Infinity;
  const hi = s.hi ?? Infinity;
  const sides = [-1, 1].map((dir) => ({ dir, x: x0, fx: f0, out: false }));
  for (let k = -1; k <= s.maxBracketSteps; k++) {
    if (now() - t0 > s.budgetMs || sides.every((sd) => sd.out)) break;
    const found: { a: number; b: number; zero: boolean }[] = [];
    if (k < 0) {
      if (f0 === 0) found.push({ a: x0, b: x0, zero: true });
    } else {
      for (const side of sides) {
        if (side.out) continue;
        let p = x0 + side.dir * h * 2 ** k;
        if (p < lo || p > hi) {
          side.out = true; // clamp the last step to the window edge, then stop this side
          p = side.dir < 0 ? lo : hi;
          if (p === side.x) continue;
        }
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
        const xb = m ? num(m[1] ?? "") : undefined;
        if (xb === undefined || xb < br.a || xb > br.b) setX(String(bisect(br.a, br.b)));
        else setX(m![1] ?? "");
      }
      ev("pasy:=pasx");
      let a = accept();
      const xp = num(ev("pasx"));
      if (!br.zero && (xp === undefined || xp < br.a || xp > br.b)) {
        ev("pasx:=pasy"); // polish left the bracket: keep Brent's value
        a = { ok: residual() <= s.warnRel, rr: residual() };
      }
      if (!br.zero && !a.ok) {
        // Brent runs in doubles: on an expanded high-degree polynomial its sign tests near the root are rounding
        // noise (SB3). Bisect with sign tests at workDigits instead, then polish again.
        setX(String(bisect(br.a, br.b)));
        ev("pasy:=pasx");
        a = accept();
        const xq = num(ev("pasx"));
        if (xq === undefined || xq < br.a || xq > br.b) {
          ev("pasx:=pasy");
          a = { ok: residual() <= s.warnRel, rr: residual() };
        }
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
      return finish(br.zero ? "exact-zero" : "brent", br.zero ? `f(${pt(br.a)})=0` : `sign change in [${pt(br.a)}, ${pt(br.b)}]`, rr, br.zero ? undefined : [br.a, br.b]);
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
  const xn = num(ev("pasx"));
  if (!a.ok || xn === undefined || xn < lo || xn > hi) {
    return done({ ok: false, display: "no root found", method: "none", info: rejected ? `${rejected} sign change(s) without a root (pole, jump or underflow)` : "no sign change, Newton did not converge", warn: false });
  }
  return finish("newton", "no sign change: Newton + polish (even-multiplicity root or touch)", a.rr);
}
