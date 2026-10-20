// SPDX-License-Identifier: GPL-3.0-or-later
// Solve app engine side (docs/02 section 4): one equation (solve1.ts), systems (Giac fsolve with GSL
// hybridsj / hybrids, then Giac's own Newton) and polynomials (Giac proot). Every candidate is polished
// at work precision and substituted back; the relative residual decides ⚠ (SolveSettings.warnRel).
// Synchronous, UI-free; runs in the Giac worker and in Node. Giac names here have no underscore.
import { safePrecision, toExactLiterals, type Giac, type HomeResult, type HomeSettings } from "./homeEval.ts";
import { confirmedDigits, decimalFromString, decimalToString, formatComplex, formatConfirmed, isZero, type ComplexValue, type DecimalValue } from "./format.ts";
import { valuePrecision } from "./numeric.ts";
import { defaultSolveSettings, negZero, num, solve1, type SolveSettings } from "./solve1.ts";
import { IDENT, type KnownValue, type SolveOutcome, type SolveRequest } from "./types.ts";
import { PASDEG } from "../input/angles.ts";

/** Giac's own interrupt for one call inside Solve and Function analysis: a safety net only; the
 *  solvers keep their own budgets and the user has Cancel. */
export const SOLVE_HARD_TIMEOUT_S = 30;

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
      // R64: the degree factor in every angle is ours, never an unknown
      if (n && IDENT.test(n) && n !== PASDEG && !seen.includes(n)) seen.push(n);
    }
  }
  return seen;
}

/** One real part as a DecimalValue (from a work-precision float or an exact integer). */
function realPart(giac: Giac, expr: string, work: number): DecimalValue | null {
  const t = giac.eval(`evalf(${expr},${work})`);
  return decimalFromString(negZero(t.trim()), work + 2);
}

/** Digits a root is polished with in the second precision (decisions M4-8). */
export const SECOND_POLISH = 20;

/**
 * A numeric HomeResult for the Giac expression `expr` (a value at work precision), rounded to `digits`.
 * With `check` (decisions M4-8), the same value from a second polish at a higher precision: the digits on which the
 * two agree are the confirmed ones (shown, and copied as `full`, up to P), and fewer than `digits` give ⚠ n. Without
 * it, the solver's own check stands (a converged polish and the residual substituted back; ⚠ on the outcome when that
 * fails): the shown digits count as confirmed and `full` is the shown text.
 */
export function numericResult(giac: Giac, expr: string, digits: number, work: number, ms = 0, check?: { expr: string; work: number }): HomeResult {
  const re = realPart(giac, `re(${expr})`, work);
  const im = realPart(giac, `im(${expr})`, work);
  if (!re || !im) {
    const text = giac.eval(`evalf(${expr},${digits})`);
    return { ok: false, display: text, path: "numeric", approximate: true, tieRisk: false, exactMs: 0, totalMs: ms, error: "engine", ...safePrecision(text) };
  }
  const base = { path: "numeric" as const, approximate: true, tieRisk: false, exactMs: 0, totalMs: ms };
  const re2 = check && realPart(giac, `re(${check.expr})`, check.work);
  const im2 = check && realPart(giac, `im(${check.expr})`, check.work);
  if (re2 && im2) {
    const P = valuePrecision(digits);
    const part = (a: DecimalValue, b: DecimalValue): number => (isZero(a) && isZero(b) ? P : confirmedDigits(a, b, work, P));
    const value: ComplexValue = { re: re2, im: im2 };
    const facts = { value, exactRational: false, reliableDigits: Math.min(part(re, re2), part(im, im2)) };
    return { ok: true, display: formatConfirmed(facts, { format: "STD", digits })!, ...facts, full: formatConfirmed(facts, { format: "STD", digits: P })!, ...base };
  }
  const value: ComplexValue = { re, im };
  const display = formatComplex(value, { format: "STD", digits }).text;
  return { ok: true, display, exactRational: false, reliableDigits: digits, full: display, value, ...base };
}

/** `name=value` substitutions for the known variables (exact literals). */
function knownSubst(knowns: KnownValue[] | undefined): { names: string[]; wrap: (e: string) => string } {
  const ks = knowns ?? [];
  if (!ks.length) return { names: [], wrap: (e) => e };
  const names = ks.map((k) => k.name);
  const vals = ks.map((k) => `(${toExactLiterals(k.value)})`);
  return { names, wrap: (e) => `subst(${e},[${names.join(",")}],[${vals.join(",")}])` };
}

/** A known moved by one unit in its last confirmed digit (G68f1): `digits` significant digits of `value`, plus one. */
export function movedKnown(k: KnownValue): KnownValue {
  const v = k.digits === undefined ? null : decimalFromString(k.value.replace("E", "e"));
  if (!v || k.digits === undefined || isZero(v)) return k;
  const n = Math.max(1, k.digits);
  const m = (BigInt(v.digits.slice(0, n).padEnd(n, "0")) + 1n).toString();
  const exp = m.length > n ? v.exp + 1 : v.exp;
  return { ...k, value: decimalToString({ neg: v.neg, digits: m.replace(/0+$/, ""), exp, sticky: false }) };
}

/** Significant digits on which two values agree (docs/04 2.4's agreement check), each part. */
function agreement(a: ComplexValue, b: ComplexValue, cap: number): number {
  const part = (x: DecimalValue, y: DecimalValue): number => (isZero(x) && isZero(y) ? cap : confirmedDigits(x, y, cap + 2, cap));
  return Math.min(part(a.re, b.re), part(a.im, b.im));
}

/** A result with no more than `n` confirmed digits; the text shown and copied follows. */
function confirmAtMost(r: HomeResult, n: number, digits: number): HomeResult {
  if (!r.ok || !r.value || !(n < (r.reliableDigits ?? Infinity))) return r;
  const facts = { value: r.value, exactRational: false, reliableDigits: n };
  return { ...r, ...facts, display: formatConfirmed(facts, { format: "STD", digits })!, full: formatConfirmed(facts, { format: "STD", digits: valuePrecision(digits) })! };
}

/**
 * G68f1 (decisions G78f1, G68): a result computed from answer-knowns (those with `digits`) confirms only the digits on
 * which every solve agrees: one with the knowns as kept and, per answer-known, one with that known alone moved by one
 * unit in its last confirmed digit (moving all at once cancels in `x-z`). A digit count alone misses cancellation:
 * `(x-1.41421)*10^6` loses digits. Typed knowns are exact and not moved; a ⚠ known passes its ⚠ on, and so does a
 * moved solve that fails, finds other roots or agrees on no digit (nothing then confirms the digit shown).
 */
export function checkByKnowns(o: SolveOutcome, req: SolveRequest, digits: number, again: (r: SolveRequest) => SolveOutcome): SolveOutcome {
  const ks = req.knowns ?? [];
  if (!o.ok) return o;
  let warn = o.warn || ks.some((k) => k.warn);
  const P = valuePrecision(digits);
  const agreed = o.roots.map(() => P);
  let checked = false;
  // The same guesses: the same path to the same root, moved (a guess at the root costs solve1 more: 313 calls, not 218).
  ks.forEach((k, j) => {
    if (k.digits === undefined) return;
    checked = true;
    const o2 = again({ ...req, knowns: ks.map((x, i) => (i === j ? movedKnown(x) : x)) });
    const same = o2.ok && o2.roots.length === o.roots.length;
    if (!same) warn = true;
    o.roots.forEach((x, i) => {
      const a = x.result.value;
      const b = same ? o2.roots[i]?.result.value : undefined;
      const n = a && b ? agreement(a, b, P) : 0;
      if (n === 0) warn = true;
      agreed[i] = Math.min(agreed[i]!, n);
    });
  });
  if (!checked) return { ...o, warn };
  return { ...o, warn, roots: o.roots.map((x, i) => ({ ...x, result: confirmAtMost(x.result, agreed[i]!, digits) })) };
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
  const run = (r: SolveRequest): SolveOutcome => {
    const k = knownSubst(r.knowns);
    if (r.kind === "poly") return polyRoots(giac, r.equation, r.unknown, k.wrap, s, t0);
    if (r.equations.length !== r.unknowns.length || r.guesses.length !== r.unknowns.length || !r.unknowns.length)
      return fail("bad-input", "need as many equations and guesses as unknowns", t0);
    if (r.unknowns.length === 1) return one(giac, r.equations[0]!, r.unknowns[0]!, r.guesses[0]!, k, s, t0);
    return system(giac, r.equations, r.unknowns, r.guesses, k.wrap, s, t0);
  };
  try {
    return withUnassigned(giac, [...vars, ...ks.names], () => checkByKnowns(run(req), req, s.digits, run));
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
  // solve1 leaves the root in pasx (work precision) and pasx2 (polished again at work precision + 20).
  const result = numericResult(giac, "pasx", s.digits, s.workDigits, r.ms, { expr: "pasx2", work: s.workDigits + SECOND_POLISH });
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

  /** Newton polish of X (pasX) at `digits` (work precision) with the exact Jacobian; false if it breaks down. */
  const polish = (X = "pasX", digits = s.workDigits): boolean => {
    ev(`Digits:=${digits}`);
    for (let i = 0; i < 12; i++) {
      const step = ev(`passt:=evalf(linsolve(subst(pasJ,${V},${X}),-subst(pasF,${V},${X})))`);
      if (!realList(step, n)) return i > 0; // singular Jacobian at the root: keep what we have
      ev(`${X}:=${X}+passt`);
      const big = num(ev(`evalf(max(abs(passt))/max(1,max(abs(${X}))))`));
      if (big === undefined) return false;
      if (big < 10 ** -(digits - 3)) break;
    }
    return realList(ev(X), n) !== null;
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
  // M4-8: polished again at work precision + 20; the digits on which the two agree are shown.
  const W2 = s.workDigits + SECOND_POLISH;
  ev(`Digits:=${W2}`);
  ev(`pasX2:=evalf(pasX,${W2})`); // widened without loss (exact() rounds to a nearby simple fraction)
  const again = polish("pasX2", W2);
  const roots = vars.map((name, k) => ({
    name,
    result: numericResult(giac, `pasX[${k}]`, s.digits, s.workDigits, 0, again ? { expr: `pasX2[${k}]`, work: W2 } : undefined),
  }));
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
  // M4-8: each root polished again at work precision + 20 (pasr2); the digits on which the two agree are shown.
  const W2 = s.workDigits + SECOND_POLISH;
  ev(`Digits:=${W2}`);
  ev("pasr2:=pasr");
  for (let k = 0; k < count; k++) {
    ev(`pasz:=evalf(pasr[${k}],${W2})`);
    for (let i = 0; i < 4; i++) {
      const d = ev("pasdz:=horner(pasdc,pasz)");
      if (ev("pasdz==0") === "true" || d.startsWith("GIAC_ERROR")) break;
      ev("pasz:=evalf(pasz-horner(pasc,pasz)/pasdz)");
    }
    ev(`pasr2[${k}]:=pasz`);
  }
  const roots = Array.from({ length: count }, (_, k) => ({
    result: numericResult(giac, `pasr[${k}]`, s.digits, s.workDigits, 0, { expr: `pasr2[${k}]`, work: W2 }),
  }));
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
