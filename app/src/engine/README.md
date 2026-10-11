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
| `homeEval.ts` | exact-first Home (from `spike/home`, 123/123 oracle cases) |
| `nodeGiac.ts` | loads a Giac build in Node for tests and the golden runner (`GIAC_MJS`, `GIAC_OUT`, else `engine/giac/_out/gsl`) |

```ts
const engine = new WorkerEngine();          // at launch (D2)
await engine.ready();
const h = await engine.home("1/3", defaultHomeSettings);   // h.display "0.333333333333"
const c = await engine.cas("sqrt(8)", defaultCasSettings); // c.latex: Giac latex(), tidy up and render (D4)
await engine.cancel();                       // pending calls reject with EngineCancelled
```

- **Modes (D3).** Home: exact with Giac's interrupt at `budgetMs` (300 ms), then floats; power limit 1e5.
  CAS: no fallback, `hardTimeoutS` (600 s) is only a safety net, the UI shows Cancel prominently after
  `CAS_SOFT_BUDGET_MS`; power limit 1e8. The host re-applies a mode only when mode or settings change.
- **Ans.** Home keeps its answer in `pasans`, CAS in `pcasans`; user variables are shared (one Giac context).
- **Errors.** `error: "syntax" | "timeout" | "engine"` for the UI's own translated message; Giac's text is in `display`/`text`.
- **Replay.** Definitions (`:=`, `=>`, `purge`, `assume`) are logged in the form that ran and replayed into a new worker.
  Not replayed: `Ans`, random values are re-drawn.

Tests: `npx vitest run src/engine` (the real-engine tests are skipped when no Giac build is found).
