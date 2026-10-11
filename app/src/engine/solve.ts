// SPDX-License-Identifier: GPL-3.0-or-later
// Solve app engine side (docs/02 section 4): one equation (solve1.ts), systems (Giac fsolve with GSL
// hybridsj / hybrids, then Giac's own Newton) and polynomials (Giac proot). Every candidate is polished
// at work precision and substituted back; the relative residual decides ⚠ (SolveSettings.warnRel).
// Synchronous, UI-free; runs in the Giac worker and in Node. Giac names here have no underscore.
import { toExactLiterals, type Giac, type HomeResult, type HomeSettings } from "./homeEval.ts";
import { decimalFromString, formatComplex, type ComplexValue, type DecimalValue } from "./format.ts";
import { defaultSolveSettings, solve1, type SolveSettings } from "./solve1.ts";
import type { KnownValue, SolveOutcome, SolveRequest } from "./types.ts";

/** Internal numbers only (comparisons, search points); never shown to users. */
export function num(s: string): number | undefined {
  const t = negZero(s.trim());
  if (!/^-?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/.test(t)) return undefined;
  const v = Number(t);
  return Number.isFinite(v) ? v : undefined;
}

/** Giac's own interrupt for one call inside Solve and Function analysis: a safety net only; the
 *  solvers keep their own budgets and the user has Cancel. */
export const SOLVE_HARD_TIMEOUT_S = 30;

/** Giac prints a negative zero MPFR float as `0.-000…`; read it as `-0.000…`. */
function negZero(t: string): string {
  return t.replace(/^0\.-(0+)$/, "-0.$1");
}

/** A variable name: letters/digits, optionally one subscript (`x_1`, `v_c`); Giac reads these as plain identifiers. */
export const IDENT = /^[A-Za-z][A-Za-z0-9]*(?:_[A-Za-z0-9]+)?$/;

/** The solver settings for a Home settings object (digits; tuning stays at its defaults). */
export function solveSettingsFor(h: HomeSettings, extra: Partial<SolveSettings> = {}): SolveSettings {
  return { ...defaultSolveSettings, digits: h.digits, workDigits: Math.max(defaultSolveSettings.workDigits, h.digits + 10), ...extra };
}

/**
 * Runs `fn` with the given names unassigned. A user's `X:=7` from Home would otherwise turn the
 * equation into a number. The values are kept inside Giac (`pasz0`, …: no text round trip) and put
 * back afterwards. A Cancel terminates the worker before the restore; the client's replay log still
 * holds the user's definition, so the restarted engine has it again.
 */
export function withUnassigned<T>(giac: Giac, names: string[], fn: () => T): T {
  const saved: { name: string; slot: string }[] = [];
  names.forEach((name, i) => {
    if (!IDENT.test(name)) throw new Error(`bad variable name ${name}`);
    if (giac.eval(name) === name) return; // not assigned
    const slot = `pasz${i}`;
    giac.eval(`${slot}:=${name}`);
    giac.eval(`purge(${name})`);
    saved.push({ name, slot });
  });
  try {
    return fn();
  } finally {
    for (const { name, slot } of saved) {
      giac.eval(`${name}:=${slot}`);
      giac.eval(`purge(${slot})`);
    }
  }
}

/** Variables in the equations, constants excluded, in order of first appearance. */
export function unknownsOf(giac: Giac, equations: string[]): string[] {
  const seen: string[] = [];
  for (const eq of equations) {
    const out = giac.eval(`lname(quote(${eq}))`);
    if (out.startsWith("GIAC_ERROR")) continue;
    for (const n of out.replace(/[[\]\s]/g, "").split(",")) {
      if (n && IDENT.test(n) && !seen.includes(n)) seen.push(n);
    }
  }
  return seen;
}

/** One real part as a DecimalValue (from a work-precision float or an exact integer). */
function realPart(giac: Giac, expr: string, work: number): DecimalValue | null {
  const t = giac.eval(`evalf(${expr},${work})`);
  return decimalFromString(negZero(t.trim()));
}

/** A numeric HomeResult for the Giac expression `expr` (a value at work precision), rounded to `digits`. */
export function numericResult(giac: Giac, expr: string, digits: number, work: number, ms = 0): HomeResult {
  const re = realPart(giac, `re(${expr})`, work);
  const im = realPart(giac, `im(${expr})`, work);
  if (!re || !im) {
    const text = giac.eval(`evalf(${expr},${digits})`);
    return { ok: false, display: text, path: "numeric", approximate: true, tieRisk: false, exactMs: 0, totalMs: ms, error: "engine" };
  }
  const value: ComplexValue = { re, im };
  return {
    ok: true,
    display: formatComplex(value, { format: "STD", digits }).text,
    value,
    path: "numeric",
    approximate: true,
    tieRisk: false,
    exactMs: 0,
    totalMs: ms,
  };
}

/** `name=value` substitutions for the known variables (exact literals). */
function knownSubst(knowns: KnownValue[] | undefined): { names: string[]; wrap: (e: string) => string } {
  const ks = knowns ?? [];
  if (!ks.length) return { names: [], wrap: (e) => e };
  const names = ks.map((k) => k.name);
  const vals = ks.map((k) => `(${toExactLiterals(k.value)})`);
  return { names, wrap: (e) => `subst(${e},[${names.join(",")}],[${vals.join(",")}])` };
}

const HAS_EQ = /(^|[^:<>=!])=([^=]|$)/;

/** Giac text of left − right (or the expression itself), decimals exact, knowns substituted. */
function difference(eq: string, wrap: (e: string) => string): { f: string; lhs: string; rhs: string } {
  const e = toExactLiterals(eq);
  if (!HAS_EQ.test(eq)) return { f: wrap(`(${e})`), lhs: wrap(`(${e})`), rhs: "0" };
  return { f: wrap(`(left(${e})-right(${e}))`), lhs: wrap(`left(${e})`), rhs: wrap(`right(${e})`) };
}

function fail(error: SolveOutcome["error"], info: string, t0: number): SolveOutcome {
  return { ok: false, roots: [], method: "none", info, warn: false, error, ms: performance.now() - t0 };
}

export function solveRequest(giac: Giac, req: SolveRequest, h: HomeSettings, extra: Partial<SolveSettings> = {}): SolveOutcome {
  const s = solveSettingsFor(h, extra);
  const t0 = performance.now();
  const ks = knownSubst(req.knowns);
  const vars = req.kind === "poly" ? [req.unknown] : req.unknowns;
  for (const v of [...vars, ...ks.names]) if (!IDENT.test(v)) return fail("bad-input", `bad variable name ${v}`, t0);
  if (ks.names.some((n) => vars.includes(n))) return fail("bad-input", "a variable is both known and unknown", t0);
  try {
    return withUnassigned(giac, [...vars, ...ks.names], () => {
      if (req.kind === "poly") return polyRoots(giac, req.equation, req.unknown, ks.wrap, s, t0);
      if (req.equations.length !== req.unknowns.length || req.guesses.length !== req.unknowns.length || !req.unknowns.length)
        return fail("bad-input", "need as many equations and guesses as unknowns", t0);
      if (req.unknowns.length === 1) return one(giac, req.equations[0]!, req.unknowns[0]!, req.guesses[0]!, ks, s, t0);
      return system(giac, req.equations, req.unknowns, req.guesses, ks.wrap, s, t0);
    });
  } finally {
    giac.eval(`Digits:=${h.digits}`);
  }
}

function one(giac: Giac, eq: string, v: string, guess: string, ks: ReturnType<typeof knownSubst>, s: SolveSettings, t0: number): SolveOutcome {
  // solve1 makes its own literals exact; knowns go in as a subst() around the equation.
  const r = solve1(giac, ks.names.length ? ks.wrap(`(${eq})`) : eq, v, toExactLiterals(guess), s);
  if (!r.ok) {
    const error = r.info === "bad equation" ? "syntax" : r.display.startsWith("guess") ? "bad-input" : "no-root";
    return { ok: false, roots: [], method: "none", info: r.info || r.display, warn: false, error, ms: performance.now() - t0 };
  }
  // solve1 leaves the root in pasx (work precision).
  const result = numericResult(giac, "pasx", s.digits, s.workDigits, r.ms);
  return {
    ok: result.ok,
    roots: [{ name: v, result }],
    method: r.method,
    info: r.info,
    residualRel: r.residualRel,
    warn: r.warn,
    ms: performance.now() - t0,
  };
}

/** Parses Giac's printed list of reals: `[0.63,1.89]`. */
function realList(out: string, n: number): number[] | null {
  const m = /^\[(.*)\]$/.exec(out.trim());
  if (!m) return null;
  const xs = (m[1] ?? "").split(",").map(num);
  return xs.length === n && xs.every((x) => x !== undefined) ? (xs as number[]) : null;
}

function system(giac: Giac, eqs: string[], vars: string[], guesses: string[], wrap: (e: string) => string, s: SolveSettings, t0: number): SolveOutcome {
  const ev = (x: string) => giac.eval(x);
  const n = vars.length;
  const V = `[${vars.join(",")}]`;
  const parts = eqs.map((e) => difference(e, wrap));
  ev(`Digits:=${s.digits}`);
  const fdef = ev(`pasF:=[${parts.map((p) => p.f).join(",")}]`);
  if (fdef.startsWith("GIAC_ERROR")) return fail("syntax", fdef, t0);
  ev(`pasL:=[${parts.map((p) => p.lhs).join(",")}]`);
  ev(`pasR:=[${parts.map((p) => p.rhs).join(",")}]`);
  const jac = ev(`pasJ:=tran(diff(pasF,${V}))`); // diff(list, vars) has one row per variable
  if (jac.startsWith("GIAC_ERROR")) return fail("engine", jac, t0);
  const g = realList(ev(`evalf([${guesses.map((x) => toExactLiterals(x)).join(",")}])`), n);
  if (!g) return fail("bad-input", "guesses must be real numbers", t0);
  const G = `[${g.join(",")}]`;

  /** Newton polish of pasX at work precision with the exact Jacobian; false if it breaks down. */
  const polish = (): boolean => {
    ev(`Digits:=${s.workDigits}`);
    for (let i = 0; i < 12; i++) {
      const step = ev(`passt:=evalf(linsolve(subst(pasJ,${V},pasX),-subst(pasF,${V},pasX)))`);
      if (!realList(step, n)) return i > 0; // singular Jacobian at the root: keep what we have
      ev("pasX:=pasX+passt");
      const big = num(ev("evalf(max(abs(passt))/max(1,max(abs(pasX))))"));
      if (big === undefined) return false;
      if (big < 10 ** -(s.workDigits - 3)) break;
    }
    return realList(ev("pasX"), n) !== null;
  };
  /** Largest |f_k| / max(1, |left_k|, |right_k|) at pasX. */
  const residual = (): number => {
    ev(`Digits:=${s.workDigits}`);
    const r = num(ev(`evalf(max(seq(abs(subst(pasF[k],${V},pasX))/max(1,abs(subst(pasL[k],${V},pasX)),abs(subst(pasR[k],${V},pasX))),k,0,${n - 1})))`));
    return r ?? Infinity;
  };

  const methods: { m: "hybridsj" | "hybrids" | "giac-newton"; arg: string }[] = [
    { m: "hybridsj", arg: ",hybridsj_solver" },
    { m: "hybrids", arg: ",hybrids_solver" },
    { m: "giac-newton", arg: "" },
  ];
  const tried: string[] = [];
  let best: { m: (typeof methods)[number]["m"]; rr: number; x: string } | null = null;
  for (const { m, arg } of methods) {
    if (performance.now() - t0 > s.budgetMs) break;
    ev(`Digits:=${s.digits}`);
    const out = ev(`fsolve(pasF,${V},${G}${arg})`);
    const x = realList(out, n);
    if (!x) {
      tried.push(`${m}: no result`);
      continue;
    }
    ev(`Digits:=${s.workDigits}`);
    ev(`pasX:=evalf(exact([${x.join(",")}]),${s.workDigits})`);
    if (!polish()) {
      tried.push(`${m}: polish failed`);
      continue;
    }
    const rr = residual();
    if (!best || rr < best.rr) best = { m, rr, x: ev("pasX") };
    if (rr <= s.warnRel) break;
    tried.push(`${m}: residual ${rr.toExponential(1)}`);
  }
  if (!best || !(best.rr < 1e-6)) {
    return { ...fail("no-root", `no solution found from the guesses (${tried.join("; ")})`, t0), residualRel: best?.rr };
  }
  ev(`pasX:=${best.x}`);
  const warn = best.rr > s.warnRel;
  const roots = vars.map((name, k) => ({ name, result: numericResult(giac, `pasX[${k}]`, s.digits, s.workDigits) }));
  const via = { hybridsj: "GSL hybridsj (exact Jacobian)", hybrids: "GSL hybrids", "giac-newton": "Giac Newton" }[best.m];
  return {
    ok: roots.every((r) => r.result.ok),
    roots,
    method: best.m,
    info: `${via}, polished and substituted back${tried.length ? ` (before: ${tried.join("; ")})` : ""}`,
    residualRel: best.rr,
    warn,
    ms: performance.now() - t0,
  };
}

function polyRoots(giac: Giac, eq: string, v: string, wrap: (e: string) => string, s: SolveSettings, t0: number): SolveOutcome {
  const ev = (x: string) => giac.eval(x);
  const { f } = difference(eq, wrap);
  ev(`Digits:=${s.workDigits}`);
  const p = ev(`pasp:=normal(${f})`);
  if (p.startsWith("GIAC_ERROR")) return fail("syntax", p, t0);
  // A polynomial in v with numeric (possibly complex) coefficients.
  const ok = ev(`is_polynomial(pasp,${v})`) === "true" && ev(`pasc:=coeff(pasp,${v})`).startsWith("[") && ev("lname(pasc)") === "[]";
  if (!ok) return fail("bad-input", `not a polynomial in ${v} with numeric coefficients`, t0);
  const deg = num(ev("size(pasc)-1")) ?? 0;
  if (deg < 1) return fail("no-root", "constant: no roots", t0);
  ev(`pasr:=proot(pasc)`);
  // Polish each root with Newton on p (complex arithmetic), then the backward error |p(r)| / Σ|a_k||r|^k.
  const count = num(ev("size(pasr)")) ?? 0;
  if (count !== deg) return fail("engine", `proot returned ${count} roots for degree ${deg}`, t0);
  ev(`pasdc:=coeff(diff(pasp,${v}),${v})`);
  ev("pasac:=abs(pasc)");
  let worst = 0;
  for (let k = 0; k < count; k++) {
    ev(`pasz:=evalf(exact(pasr[${k}]),${s.workDigits})`); // proot may answer in double precision
    for (let i = 0; i < 3; i++) {
      const d = ev("pasdz:=horner(pasdc,pasz)");
      if (ev("pasdz==0") === "true" || d.startsWith("GIAC_ERROR")) break;
      ev("pasz:=evalf(pasz-horner(pasc,pasz)/pasdz)");
    }
    const rr = num(ev("evalf(abs(horner(pasc,pasz))/max(1e-300,horner(pasac,abs(pasz))))")) ?? Infinity;
    worst = Math.max(worst, rr);
    // Imaginary part below the work precision relative to |z|: a real root.
    if (ev(`abs(im(pasz))<=abs(pasz)*10^(-${s.workDigits - 5})`) === "true") ev("pasz:=re(pasz)");
    ev(`pasr[${k}]:=pasz`);
  }
  // Reals first (ascending), then complex by real part, then imaginary part.
  ev("pasr:=sort(pasr,(a,b)->when(im(a)==0,when(im(b)==0,re(a)<re(b),true),when(im(b)==0,false,when(abs(re(a)-re(b))<=10^(-20)*max(1,abs(a),abs(b)),im(a)<im(b),re(a)<re(b)))))");
  const roots = Array.from({ length: count }, (_, k) => ({ result: numericResult(giac, `pasr[${k}]`, s.digits, s.workDigits) }));
  const warn = worst > s.warnRel;
  return {
    ok: roots.every((r) => r.result.ok),
    roots,
    method: "proot",
    info: `all ${count} roots of a degree ${deg} polynomial (Giac proot), polished and substituted back`,
    residualRel: worst,
    warn,
    ms: performance.now() - t0,
  };
}
