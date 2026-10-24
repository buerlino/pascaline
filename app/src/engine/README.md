<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# app/src/engine: the MathEngine

The UI talks to maths only through `MathEngine` (`types.ts`); `WorkerEngine` is the implementation.

| File | Role |
|---|---|
| `types.ts` | `MathEngine`, `CasSettings`/`CasResult`, `EngineCancelled`, `CAS_SOFT_BUDGET_MS` |
| `workerEngine.ts` | main thread: starts the worker, Cancel = terminate + new worker + replay of definitions; a crash takes the same path |
| `protocol.ts` | messages between the two |
| `giac.worker.ts` | the Web Worker: loads `engine/giac.mjs` (copied to `app/public/engine/` by `npm run engine:copy`) |
| `host.ts` | engine side, synchronous, UI-free: Home/CAS modes (D3), syntax-error detection, replay log. Also runs in Node |
| `homeEval.ts` | exact-first Home (from the Phase 0 spike, 123/123 oracle cases); results carry a `value` and the precision facts; `sigfig` and our other engine definitions |
| `numeric.ts` | honest precision (docs/04 2.4): reads values, shapes (lists, matrices), the agreement check at two precisions, the re-evaluation of floats from Giac's numeric code, the double fallback |
| `constUnc.ts` | G26: constants sent by name (`pasc_<id>`) with a table of values and CODATA σ; the first-order σ of a Home result and its `uncDigits` |
| `format.ts` | Home number formatter (D5): STD/SCI/ENG/FIX/PFX from a BigInt-derived `DecimalValue`, no engine round trip; `markOf()` and `formatConfirmed()` turn the engine's facts into the mark and the digits shown |
| `nodeGiac.ts` | loads a Giac build in Node for tests and the golden runner (`GIAC_MJS`, `GIAC_OUT`, else `engine/giac/_out/gsl`) |

```ts
const engine = new WorkerEngine();          // at launch (D2)
await engine.ready();
const h = await engine.home("1/3", defaultHomeSettings);   // h.display "0.333333333333"
const c = await engine.cas("sqrt(8)", defaultCasSettings); // c.latex: Giac latex(), tidy up and render (D4)
await engine.cancel();                       // pending calls reject with EngineCancelled
```

- **Modes (D3).** Home: exact with Giac's interrupt after `budgetSteps` checks (G82; 300 ms on the desktop), then floats; power limit 1e5.
  CAS: no fallback, `hardTimeoutS` (600 s) is only a safety net, the UI shows Cancel prominently after
  `CAS_SOFT_BUDGET_MS`; power limit 1e8. The host re-applies a mode only when mode or settings change.
- **Ans.** Home keeps its answer in `pasans`, CAS in `pcasans`; user variables are shared (one Giac context).
- **Precision (G2, docs/04 2.4–2.10).** Every result carries `facts: ValueFacts` (G76, `types.ts`): `exact`, `reliableDigits`
  (null = not limited), maybe `warn` with `why`, `inexact` and `uncDigits`; carriers pass it whole;
  `display` shows confirmed digits only. Exact non-rationals: `evalf` at P = max(40, digits+10) and P+20 (one more step to
  P+40 if they disagree). A float Giac's numeric code returned on the exact path: run again with a double and with MPFR
  (`warn: "unaudited"` unless every function is in `AUDITED_FUNCTIONS`), or at P and P+20 when all are audited. Float
  fallback: W = max(workDigits, digits+10) and W+20. CAS: typed decimals exact (P9); a float result gets `numeric`.
  `full` is the exact text (≤ 2 kB) or every confirmed digit up to P. `grep warn`/`markOf` for the details.
- **Errors.** `error: "syntax" | "timeout" | "engine"` for the UI's own translated message; Giac's text is in `display`/`text`. G39 adds the refusals `"integralDiverges" | "seriesDiverges" | "noLimit"` (`converge.ts`: a number for a divergent integral or series, or a limit that does not exist); their text is `error.<code>` in `i18n/enEngine.ts`.
- **Replay.** Definitions (`:=`, `=>`, `purge`, `assume`) are logged in the form that ran and replayed into a new worker.
  Not replayed: `Ans`, random values are re-drawn.

Tests: `npx vitest run src/engine` (the real-engine tests are skipped when no Giac build is found).
