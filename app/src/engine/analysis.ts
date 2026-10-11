// SPDX-License-Identifier: GPL-3.0-or-later
// Function app maths: the Num table (Home evaluation per cell) and the Plot analysis menu (root,
// extremum, intersection, slope, signed area), built on solve1.ts and Giac. Every number shown to the
// user comes from here (D7), never from the plot evaluator. Synchronous, UI-free.
import { homeEval, toExactLiterals, type Giac, type HomeResult, type HomeSettings } from "./homeEval.ts";
import { solve1, type SolveSettings } from "./solve1.ts";
import { num, numericResult, solveSettingsFor, withUnassigned } from "./solve.ts";
import type { AnalysisRequest, AnalysisResult, TableRequest } from "./types.ts";

/** Home's answer variable: analysis must not change what Ans means in Home. */
function keepingAns<T>(giac: Giac, fn: () => T): T {
  const had = giac.eval("pasans") !== "pasans";
  if (had) giac.eval("paskeep:=pasans");
  try {
    return fn();
  } finally {
    if (had) {
      giac.eval("pasans:=paskeep");
      giac.eval("purge(paskeep)");
    } else giac.eval("purge(pasans)");
  }
}

/**
 * Num table: rows by x, each cell what Home shows for fn at x (exact-first, homeEval). The caller's
 * Home mode (angle, Digits, budget) must already be applied by the host.
 */
export function table(giac: Giac, req: TableRequest, s: HomeSettings): HomeResult[][] {
  const v = req.variable ?? "x";
  return withUnassigned(giac, [v], () =>
    keepingAns(giac, () =>
      req.xs.map((x) =>
        req.fns.map((f) => {
          const r = homeEval(giac, `subst((${f}),${v}=(${x}))`, s);
          return r.ok ? r : { ...r, error: "engine" as const };
        }),
      ),
    ),
  );
}

function failed(error: AnalysisResult["error"], info: string, method: string, t0: number): AnalysisResult {
  return { ok: false, warn: false, info, method, error, ms: performance.now() - t0 };
}

function bound(giac: Giac, x: string | undefined): number | undefined {
  return x === undefined ? undefined : num(giac.eval(`evalf(${toExactLiterals(x)})`));
}

export function analyze(giac: Giac, req: AnalysisRequest, h: HomeSettings): AnalysisResult {
  const t0 = performance.now();
  const v = req.variable ?? "x";
  if (!/^[A-Za-z][A-Za-z0-9]*$/.test(v)) return failed("bad-input", `bad variable name ${v}`, "none", t0);
  try {
    return withUnassigned(giac, [v], () => run(giac, req, v, h, t0));
  } finally {
    giac.eval(`Digits:=${h.digits}`);
  }
}

function run(giac: Giac, req: AnalysisRequest, v: string, h: HomeSettings, t0: number): AnalysisResult {
  const ev = (x: string) => giac.eval(x);
  const ex = toExactLiterals;
  const s = solveSettingsFor(h);
  const W = s.workDigits;
  const at = (expr: string, point: string) => `subst(${expr},${v}=${point})`;

  /** A root of `eq` near x0 (inside lo..hi), via the 1-D Solve strategy; leaves it in pasx. */
  const rootOf = (eq: string, x0: string, lo?: string, hi?: string): { r: ReturnType<typeof solve1>; s2: SolveSettings } | AnalysisResult => {
    const s2: SolveSettings = { ...s, lo: bound(giac, lo), hi: bound(giac, hi) };
    if ((lo !== undefined && s2.lo === undefined) || (hi !== undefined && s2.hi === undefined)) return failed("bad-input", "window is not real", "none", t0);
    const r = solve1(giac, eq, v, ex(x0), s2);
    return { r, s2 };
  };
  const notFound = (r: ReturnType<typeof solve1>): AnalysisResult =>
    failed(r.info === "bad equation" ? "syntax" : r.display.startsWith("guess") ? "bad-input" : "no-root", r.info || r.display, "none", t0);

  switch (req.kind) {
    case "root":
    case "extremum":
    case "intersection": {
      const f = ex(req.f);
      const eq = req.kind === "root" ? `(${f})=0` : req.kind === "intersection" ? `(${f})=(${ex(req.g)})` : `diff(${f},${v})=0`;
      const found = rootOf(eq, req.x0, req.lo, req.hi);
      if (!("r" in found)) return found;
      const { r } = found;
      if (!r.ok) return notFound(r);
      ev(`Digits:=${W}`);
      ev(`pasxr:=pasx`);
      const x = numericResult(giac, "pasxr", s.digits, W);
      // At a root that passed the residual check, f is 0 to work precision: show 0, not 3E-30.
      const y = numericResult(giac, req.kind === "root" && !r.warn ? "0" : `evalf(${at(`(${f})`, "pasxr")},${W})`, s.digits, W);
      let extremum: AnalysisResult["extremum"];
      let info = r.info;
      if (req.kind === "extremum") {
        // Second derivative decides; when it is 0 (x^3 at 0, x^4 at 0) look at f on both sides.
        const d2 = num(ev(`evalf(${at(`diff(${f},${v},2)`, "pasxr")},${W})`));
        if (d2 !== undefined && d2 !== 0) extremum = d2 > 0 ? "min" : "max";
        else {
          ev(`pasdl:=evalf(max(abs(pasxr),1)*10^(-6),${W})`);
          const l = num(ev(`evalf(${at(`(${f})`, "pasxr-pasdl")}-${at(`(${f})`, "pasxr")},${W})`));
          const rr = num(ev(`evalf(${at(`(${f})`, "pasxr+pasdl")}-${at(`(${f})`, "pasxr")},${W})`));
          extremum = l !== undefined && rr !== undefined && l > 0 && rr > 0 ? "min" : l !== undefined && rr !== undefined && l < 0 && rr < 0 ? "max" : "flat";
        }
        info = `f'=0 (${r.info})${extremum === "flat" ? "; not a minimum or maximum (inflection)" : ""}`;
      }
      return { ok: x.ok && y.ok, x, y, extremum, warn: r.warn, info, method: r.method, ms: performance.now() - t0 };
    }
    case "slope": {
      const f = ex(req.f);
      ev(`Digits:=${W}`);
      ev(`pasxr:=evalf(${ex(req.x0)},${W})`);
      if (num(ev("pasxr")) === undefined) return failed("bad-input", "x is not a real number", "none", t0);
      const d = ev(`pasdv:=evalf(${at(`diff(${f},${v})`, "pasxr")},${W})`);
      if (num(d) === undefined) return failed("no-root", `f' is not defined here (${d})`, "diff", t0);
      // Consistency: a central difference at work precision must agree with the exact derivative.
      ev(`pash:=evalf(max(abs(pasxr),1)*10^(-${Math.floor(W / 3)}),${W})`);
      const cd = num(ev(`evalf((${at(`(${f})`, "pasxr+pash")}-${at(`(${f})`, "pasxr-pash")})/(2*pash),${W})`));
      const dv = num(d)!;
      const agree = cd !== undefined && Math.abs(cd - dv) <= 1e-8 * Math.max(1, Math.abs(dv));
      return {
        ok: true,
        x: numericResult(giac, "pasxr", s.digits, W),
        y: numericResult(giac, `evalf(${at(`(${f})`, "pasxr")},${W})`, s.digits, W),
        value: numericResult(giac, "pasdv", s.digits, W),
        warn: !agree,
        info: agree ? "exact derivative, matches a central difference" : "exact derivative and central difference disagree (kink or jump?)",
        method: "diff",
        ms: performance.now() - t0,
      };
    }
    case "area": {
      const integrand = req.g === undefined ? `(${ex(req.f)})` : `(${ex(req.f)})-(${ex(req.g)})`;
      const a = bound(giac, req.a);
      const b = bound(giac, req.b);
      if (a === undefined || b === undefined) return failed("bad-input", "bounds must be real numbers", "none", t0);
      if (a === b) {
        ev("pasar:=0");
        return { ok: true, value: numericResult(giac, "pasar", s.digits, W), warn: false, info: "a = b", method: "none", ms: performance.now() - t0 };
      }
      // Romberg at work precision; Giac returns two estimates when it does not converge, undef on a
      // singularity. Consistency check against Gauss–Kronrod in double precision (gaussquad).
      ev(`Digits:=${W}`);
      const A = `exact(${ex(req.a)})`;
      const B = `exact(${ex(req.b)})`;
      const rom = ev(`pasar:=romberg(${integrand},${v},${A},${B})`);
      let warn = false;
      let info = "Romberg";
      if (/^\[/.test(rom)) {
        ev("pasar:=(pasar[0]+pasar[1])/2");
        warn = true;
        info = "Romberg did not converge (singularity or kink?)";
      } else if (num(rom) === undefined) {
        return failed("no-root", `the integral does not converge (${rom})`, "romberg", t0);
      }
      ev(`Digits:=${s.digits}`);
      const gq = num(ev(`evalf(gaussquad(${integrand},${v},${A},${B}))`));
      ev(`Digits:=${W}`);
      const rv = num(ev("pasar"))!;
      const agree = gq !== undefined && Math.abs(gq - rv) <= 1e-8 * Math.max(1, Math.abs(rv));
      if (!agree) warn = true;
      info += agree ? ", matches Gauss quadrature" : ", disagrees with Gauss quadrature";
      return { ok: true, value: numericResult(giac, "pasar", s.digits, W), warn, info, method: "romberg", ms: performance.now() - t0 };
    }
  }
}
