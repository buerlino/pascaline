<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# app/src/engine: the MathEngine

The UI talks to maths only through `MathEngine` (`types.ts`); `WorkerEngine` is the implementation.

**Import direction (G147, checked by the gate's `rules` stage, `app/scripts/import-rules.ts`).** What the start chunk reaches imports from here only `types`, `format`, `defs`, `giacPrint`, `workerEngine`, `protocol`, `homeDefaults` and `pasdeg`; everything else loads in the Worker or in a lazy chunk. Nothing here imports from `views/`, `state/`, `keyboard/`, `entry/`, `apps/`, `render/` or `input/` (those import from here); the only edges into `units/` are named in the check (`units/types.ts` for the unit job's types, `units/evaluate.ts` for the unit evaluator that runs in the Worker). Stored data (the library's version and migration) is passed in, not imported.

One line per module: what it owns, who calls it. Groups as in docs/04 section 6.1.

**Main thread (in the start chunk)**

| File | Role |
|---|---|
| `types.ts` | `MathEngine`, `CasSettings`/`CasResult`, `ValueFacts`, `EngineCancelled`, `CAS_SOFT_BUDGET_MS`; imported by `calc/`, `state/`, `apps/`, `find/`, `units/` |
| `workerEngine.ts` | starts the worker, Cancel = terminate + new worker + replay of definitions; a crash takes the same path; called by `calc/engine.ts` |
| `protocol.ts` | messages between `workerEngine.ts` and `host.ts` (via `giac.worker.ts`) |
| `homeDefaults.ts` | Home's default settings, `HOME_BUDGET_STEPS`, `safePrecision` (R103): what `calc/` reads without `homeEval.ts`'s graph |
| `pasdeg.ts` | the name of the degree factor alone; read by `state/session.svelte.ts` and `angles.ts` |
| `exactLiterals.ts` | G163: decimal literals as exact rationals (`toExactLiterals`), pure text with no engine; `homeEval.ts` re-exports it, the unit view's chunks read it from here |
| `format.ts` | Home number formatter (D5): STD/SCI/ENG/FIX/PFX from a BigInt-derived `DecimalValue`, no engine round trip; `markOf()` and `formatConfirmed()` turn the engine's facts into the mark and the digits shown; `precisionFacts()` maps a result to them (G163); called by `state/`, `render/`, `apps/`, `clipboard/` |
| `defs.ts` | the definitions log (docs/04 6.2): plain data and pure functions used on both sides; called by `workerEngine.ts`, `host.ts`, `find/`, `state/backup.ts` |
| `giacPrint.ts` | G105: the one reader of Giac text (string skip, bracket walk, names, lists); no imports of its own; used by nearly every module here and by `render/`, `state/results.ts`, `units/` |

**Worker side: the host and the Home pipeline**

| File | Role |
|---|---|
| `giac.worker.ts` | the Web Worker: loads `engine/giac.mjs` (copied to `app/public/engine/` by `npm run engine:copy`) and runs `host.ts`; started by `workerEngine.ts` |
| `host.ts` | engine side, synchronous, UI-free: Home/CAS modes (D3), syntax-error detection, replay log; also runs in Node (golden runner, tests) |
| `homeEval.ts` | exact-first Home (from the Phase 0 spike): results carry a `value` and the precision facts; `sigfig` and our other engine definitions; called by `host.ts`, `solve.ts`, `analysis.ts`, `units/` |
| `numeric.ts` | honest precision (docs/04 2.4): values, shapes, the agreement check at two precisions, the re-evaluation of floats, the double fallback; called by `homeEval.ts` and most guards |
| `decisions.ts` | G38: the decisions Giac makes inside an exact evaluation, and their second run at P+20 and P+40; called by `homeEval.ts`, `host.ts` |
| `facts.ts` | the mark facts that stored names lend (M4-7); called by `host.ts` |
| `stateRead.ts` | G65: which names an input stored and read, from Giac's own state; called by `host.ts`, `facts.ts` |
| `chipFacts.ts` | G49: a result reused through Ans or a chip (`pasr_<k>`) keeps its facts; called by `host.ts`, `workerEngine.ts` |
| `constUnc.ts` | G26: constants sent by name (`pasc_<id>`) with CODATA values and σ; the first-order σ of a Home result and its `uncDigits`; called by `host.ts` |
| `constBasis.ts` | G81: an inexact constant's basis (value over its measured leaves); called by `constUnc.ts`, `units/` |
| `converge.ts` | G39: refusals for a divergent integral or series and a limit that does not exist; called by `homeEval.ts`, `host.ts`, `analysis.ts` |
| `icdf.ts` | G44: inverse distributions polished by substituting back; called by `homeEval.ts`, `numeric.ts` |
| `eseries.ts` | IEC 60063 E-series as published (G30); called by `homeEval.ts`, `decisions.ts`, `host.ts` |
| `binary64.ts` | G140: whether a part Giac printed holds only a double's bits (exact BigInt); called by `numeric.ts` |
| `complex.ts` | G50, G60: the complex workaround (our atan); called by `numeric.ts`, `homeEval.ts`, `stateRead.ts` |
| `powers.ts` | G59f1: powers that Giac's exact evaluation may move to another branch; called by `homeEval.ts` |
| `asked.ts` | G91: the precision an `evalf(e,n)`/`approx(e,n)` asks for, made a literal; called by `host.ts` |
| `assumed.ts` | G92: an assumption Giac's `simplify` leaves is put back; called by `host.ts`, `stateRead.ts` |

**Worker side: what Giac must not answer as text (guards of docs/04 6.1)**

| File | Role |
|---|---|
| `bridge.ts` | G85: typed wrappers for the JSON exports of `engine/giac/wasm/api.cc` (names, stores, settings, a value's kind); called by `host.ts`, `numeric.ts` and the guards |
| `ctxGate.ts` | G102: Giac's `Digits` set through bridge-1, applied before the next call; called by `host.ts` |
| `tree.ts` | G103: the tree of a quoted input or stored body for `nonsquare.ts` and `novalue.ts` |
| `stores.ts` | G100: whether an input stores, from Giac's tree; called by `host.ts`, `homeEval.ts`, `defs.ts`, `library.ts` |
| `flags.ts` | G67: Giac's global settings that user text can change, put back after the call; called by `host.ts`, `stores.ts`, `library.ts` |
| `ourNames.ts` | G54: our replacements for Giac functions by the name the user writes; called by `input/emit.ts`, `host.ts`, `library.ts` |
| `listargs.ts` | G111: functions that read one list argument as their argument list; called by `homeEval.ts`, `host.ts` |
| `listargsTable.ts` | generated table for `listargs.ts` (`tools/probes/list-args.ts`) |
| `listargsEvidence.ts` | generated evidence behind that table; read by its test only |
| `matrixType.ts` | G130: Giac's matrix subtype printed as `matrix[…]`; called by `homeEval.ts`, `host.ts` |
| `nonsquare.ts` | G97: powers of a non-square matrix; called by `homeEval.ts`, `host.ts` |
| `novalue.ts` | G78: no number that went through a division by zero; called by `homeEval.ts`, `listargs.ts` |
| `polyvec.ts` | G106: a list plus or minus a number read as polynomial coefficients; called by `homeEval.ts`, `host.ts` |

**Angles (route R, S14)**

| File | Role |
|---|---|
| `angles.ts` | R64: the angle mode in Giac text: `rewriteAngles`, `dropAngleFactor` and the tables (`ANGLE_IN`, `ANGLE_OUT`, …); called by `input/emit.ts`, `homeEval.ts`, `host.ts`, `library.ts`, `units/evaluate.ts` (moved here from `input/`, G147) |
| `degrees.ts` | G46: a symbolic result is radian text, read in degrees in DEG; called by `homeEval.ts`, `host.ts` |
| `angleMigration.ts` | G46: the stored definitions log and library text brought to route R; loaded by `state/migrations.ts` |

**Apps and stored text**

| File | Role |
|---|---|
| `solve1.ts` | Solve-app strategy for one equation in one unknown; called by `solve.ts`, `analysis.ts` |
| `solve.ts` | Solve app engine side: systems, polynomials, every candidate polished; called by `host.ts` |
| `analysis.ts` | Function app: the Num table and the Plot analysis menu (root, extremum, intersection, slope, area); called by `host.ts` |
| `library.ts` | S4, G33: the library file, read as a whole, defined through `cas()`, tested; loaded lazily (`state/libraryFormat.ts` passes it the stored data's version and migration) |

**Node only (never bundled)**

| File | Role |
|---|---|
| `nodeGiac.ts` | loads a Giac build in Node for tests and the golden runner (`GIAC_MJS`, `GIAC_OUT`, else `engine/giac/_out/gsl`) |
| `fakeGiac.ts` | a `Giac` that answers evals with fixed texts, for tests without an engine |

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
