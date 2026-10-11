<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Solve app strategy, one equation (spike prototype, docs/02 section 4)

Files: `spike/app/src/solve/solve1.ts` (runs next to the engine, like homeEval), `cases.yaml` (23 cases),
`run.ts` (Node runner). Expected values: `spike/home/oracle.py spike/solve/cases.yaml` (mpmath) or `derived`.

```bash
node spike/solve/run.ts                                   # ROUNDS=5, GIAC_MJS=<giac.mjs>
spike/.venv/bin/python spike/home/oracle.py spike/solve/cases.yaml
```

## Result (desktop, Node 22.23, giac.wasm 62b24490…, 2026-10-11)
23/23 match, medians of 5 fresh engines: 1.9–4 ms for bracketed roots, 13–28 ms when Newton is needed,
57 ms for `exp(x)=0` (search runs to the end of its range before "no root found"). Residuals of
accepted roots ≤ 5e-29 relative.

## Strategy as built
1. f = left − right with **decimal literals made exact** (`0.5` → 1/2, `1e100` → 10^100); f′, f″ exact from Giac.
2. Bracket search in doubles from the guess: points x0 ± h·2^k (h = 1% of max(|x0|,1)), both sides per round;
   complex or undefined values are skipped.
3. Each sign change → Brent (`fsolve(f, x=a..b, brent_solver)`, GSL, double precision) → polish at 30 digits
   with Schröder's step f·f′/(f′² − f·f″) (quadratic for simple and multiple roots) → accepted only if the
   polish converged (relative step < 1e-20) and the relative residual |f|/max(1,|left|,|right|) ≤ 1e-15.
   A sign change that fails is a **pole or jump** (tan at π/2, 1/x at 0) and the search goes on.
   Among roots found in the same round, the one **nearest the guess** wins.
4. No bracket anywhere → damped Newton from the guess at 30 digits, same polish and checks.
5. **Exact snap:** if the root is within 1e-9 of an integer (including 0) and Giac proves
   `simplify(f(n)) == 0`, show n ("exact root (checked by CAS)").
6. The info line says which path was taken (sign change interval, Newton, rejected sign changes).

## Findings
- Values assigned at `Digits:=12` stay **doubles** after `Digits:=30` (`evalf` keeps them double); go through
  `evalf(exact(v),30)`. A double literal inside f (`0.5*sin(E)`, `1e100`) does the same to every evaluation
  of f, so the 30-digit polish stalls at ~1e-16. Exact literals fix both (same function as Home).
- **Underflow can fake a root**: `exp(x)=0` evaluates to exactly 0 near x = −1.4e9 even in MPFR. An exact zero
  is accepted only if the CAS proves it or f is nonzero just beside it (±1e-25 relative).
- **Cancellation at touching roots**: `cos(x)=1` is exactly 0 at 30 digits for every |x| < 1e-15, so Newton
  stops at 7e-16. The exact snap turns it into 0, proven by the CAS, not by tolerance.
- Giac reads `name_d`, `name_f` … as a value with a unit suffix, so `pas_f:=…` fails. No underscores in
  internal variable names (homeEval's `pas_ans` renamed to `pasans`).
- `fsolve` with `brent_solver` returns `[]` when the "root" is a pole, which helps too.

## Not covered yet (next steps)
- Systems (GSL `hybrids`/`hybridsj`), polynomials (`proot`), the Solve app's Num/Plot views.
- Snap to simple rationals or surds (only integers today); roots of very flat functions far from integers.
- Search range: points up to ±h·2^60; whether the G2 uses the guess as "nearest root" or something else is a
  G2-checklist question.
- In the worker / on the Tab One (only Node so far, desktop only per the assignment).
