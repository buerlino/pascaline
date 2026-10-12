<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Cleanup audit, 2026-10-12

Verification and declutter pass. **Phase 1** is the read-only audit; **phase 2** (edits) starts only after the user approves items. The user approved area B on 2026-10-12 ("yes to all recommended decisions", icons from the logo) and then area C, G9 and the commits ("yes go ahead!"). Applied on `phase-1`, not pushed: `51927b0` (B code), `e7a208b` (B docs, G9), `8ff8576` (icons), `8f95cef` (spike archive). Area D, approved ("yes to everything"): `09665a6` (D1), `0e2a731` (D2–D12), `27f8378` (bench JSON). This report itself is not committed yet (to be committed after area G).

Rules of record read first: `CLAUDE.md`, `CONTRIBUTING.md`, `docs/backlog.md`, `docs/decisions.md`.

**Status of this report:** phase 1 is complete for all areas. A–D are applied; F is applied (the removal by the user, the small fixes in this commit set); E and G wait for approval (see "Needs the user").

## Summary

| Area | Found | Already applied | Safe to fix now | Needs a decision |
|---|---|---|---|---|
| A. Health baseline | 5 | A1 (counts, in D) | – | – (A4 waits for an upstream fix; A2, A3, A5 are informational) |
| B. Dead and deprecated code | 13 | 12 (`51927b0`, `e7a208b`, `8ff8576`) | – | – (B13, a flaky e2e test: watch it) |
| C. spike/ | 9 | 9 (`8f95cef`, `27f8378`) | – | – |
| D. Docs | 12 | 11 (`09665a6`, `0e2a731`); D9 kept on purpose | – | – |
| E. HP/Prime and network | 6 | – | E1, E6 | E3 (`hpprime` name). E2 needs a device check first; E4, E5 are fine as they are |
| F. Repo state and weight | 8 | F1, F3–F5 (the removal, run by the user); F2, F5, F8 fixes in this commit set | – | – (F7: re-measure on the device) |
| G. Build reproducibility | 9 | – | G1–G5, G8, G9 | – (G6, G7 are fine as they are) |

**Recommended order:**
1. **Now, in one approval, all S effort:**
   - E1 (Google services plugin out of the Gradle files);
   - E6 (the template tests);
   - G1 and G9 (the dead probe script and the Phase 0 skill);
   - G2 and G3 (device tools: serial from `ANDROID_SERIAL`, no absolute path);
   - G4 (hashes in THIRD_PARTY);
   - G5 (the "F-Droid uses build.sh" claim);
   - G8 (agent files point to `rules.md`).

   Why first: none of these changes app behaviour. Together they remove the only F-Droid scanner trigger (E1) and every reference to a path that no longer exists. The next shift's agents also read the right rules file. One `./build.sh --dev --engine-dir … --python-dir … --unsigned` run (no engine build) checks the two Gradle changes.
2. **Next device session:** E2 (drop the INTERNET permission) together with F7 (re-measure cold start). Both need the Tab One, and one session covers both.
3. **With the P6 decision:** E3. Whether `hpprime` stays as the import name belongs with how far we match the reference's Python module (P6).

## State audited

- Branch `phase-1`, HEAD `759060e` ("added logo", 2026-10-12 13:26), parent `4d9c3a1` (L8, G1, G2).
- The working tree was **clean** for the whole run (`git status --short` was empty before and after). At the start of this session the git snapshot showed HEAD `9eae138` with 15 modified files and `logo/` untracked. The user committed both at 13:26 (`git log`: `4d9c3a1` 13:26:12, `759060e` 13:26:55), and the baseline ran after that. So the baseline is for committed code.
- Node v22.23.2, npm 10.9.8.
- Prerequisites present, none rebuilt:
  - `engine/giac/_out/gsl/giac.{mjs,wasm}` (wasm 9 752 981 B, 2026-10-11 03:54);
  - `python/_out/dev/` (wasm 625 822 B, 2026-10-11 16:33);
  - `tests/golden/.venv`;
  - Playwright's Chromium.

## A. Health baseline

Delegated: the runs were done by a **sonnet** subagent, one suite at a time so the timings don't skew each other. I (Opus) checked every count and exit code below against the raw logs (`summary.txt`, `05-golden.log`, the tails of `03-vitest.log` and `04-e2e.log`) and reran `git status`, `git log` and `npm audit` myself. The logs are in the session scratchpad (`scratchpad/areaA/`) and are not committed.

| # | Suite | Command | Exit | Wall time | Result |
|---|---|---|---|---|---|
| 1 | install | `cd app && npm ci` | 0 | 2.8 s | 181 packages; "3 moderate severity vulnerabilities" |
| 2 | typecheck | `npm run typecheck` | 0 | 5.9 s | `504 FILES 0 ERRORS 0 WARNINGS` |
| 3 | unit | `GIAC_OUT=<abs>/engine/giac/_out/gsl npm test` (Vitest 5.0.3) | 0 | 4.3 s | 25/25 files, 315/315 tests; 0 skipped, 0 todo |
| 4 | e2e | `GIAC_OUT=<abs> npm run test:e2e -- --project=chromium-phone` | 0 | 40.3 s | 68 passed, **1 skipped**, 0 flaky, 0 failed (8 workers) |
| 5 | golden gate | `GIAC_OUT=<abs> PYTHON_OUT=<abs>/python/_out/dev npm run golden` | 0 | 9.3 s | `GOLDEN GATE PASSED` (details below) |
| 6 | python | `node python/smoke.mjs` (repo root) | 0 | 0.2 s | `micropython smoke OK … 625822 bytes wasm` |
| 7 | oracle | `tests/golden/.venv/bin/python tests/golden/oracle.py` | 0 | 0.4 s | `checked 6 file(s); problems: 0` |

Notes on the runs:
- `test:e2e` is plain `playwright test`. It runs every project unless you pass `--project`. `chromium-phone` (Pixel 7) is defined at `app/playwright.config.ts:18`.
- `python/` has no test runner other than `smoke.mjs`: no package.json, pytest setup or tests folder. The Python behaviour is tested through the golden gate (python 22/22) and `app/test/python.spec.ts`.

### Golden gate, actual vs CLAUDE.md

| Sub-suite | CLAUDE.md:131 says | Actual (`05-golden.log`) |
|---|---|---|
| interrupt | 16/16 | `16 interrupts, no escapes` (L6) |
| Home | 123/123 | `123/123 match (3 assumed), 0 over 500 ms, max median 319.0 ms` (L7) |
| Solve | 42/42 | `42/42 match` (L8) |
| Function | **24/24** | **`25/25 match`** (L9) |
| bench | 55 | `14/14 expect match, 55 run, errors: none` (L10) |
| parser | 324/326 (2 known gaps) | `324/324 match, 2 known gaps; total 324/326` (L11) |
| python | 22/22 | `22/22 match; Cancel terminate median 4.2 ms (desktop)` (L12) |

### Findings

- **A1. CLAUDE.md's Function count is stale.** It says 24/24 at `CLAUDE.md:131`, but the gate runs 25. The extra case is `table-pole` (`source: virtual-calc`, G2 item 19), added in `4d9c3a1` (`git show 4d9c3a1 -- tests/golden/function.yaml`: one `+` line). The same commit edited CLAUDE.md (2 lines) but not this count. *Proposed fix (phase 2):* change it to 25/25. A doc-only edit.
- **A2. One deliberate skip.** `app/test/plotbench.spec.ts:5` is skipped by `test.skip(process.env["VITE_MEASURE"] !== "1", "measurement builds only")` (`plotbench.spec.ts:6`). That is by design, not a defect. It means the Plot FPS overlay path has no e2e coverage in normal runs. *No action proposed*; listed so "1 skipped" is explained.
- **A3. No flaky tests, nothing over 10 s.** Slowest e2e tests (`04-e2e.log`):
  - `function.spec.ts:30`: 6.1 s
  - `python.spec.ts:35`: 5.6 s
  - `function.spec.ts:68`: 5.3 s
  - `solve.spec.ts:45`: 5.2 s
  - `function.spec.ts:47`: 5.0 s

  Vitest's default reporter gives no per-file times, but the whole run took 2.88 s, so no file can be over 10 s. The slowest Home golden median is 319 ms, under the gate's 500 ms limit.
- **A4. npm audit: 3 moderate, all from one dev-tool chain.** The chain is `@capacitor/cli@8.5.3` → `xcode@3.0.1` → `uuid@7.0.3` ("Missing buffer bounds check in v3/v5/v6 when buf is provided"; `npm ls uuid`, `npm audit --json`). `@capacitor/cli` is the only direct dependency involved. It is a build-time CLI, and xcode is its iOS project tooling, so nothing from this chain ships in the app bundle. I didn't check whether a newer `@capacitor/cli` drops `xcode` or `uuid@7`; could not tell from this run. *Proposed:* no action now. Recheck when Capacitor is next bumped.
- **A5. Vitest suggests caching.** `03-vitest.log` (end) says "transforming modules took 8.82s · 47% of tracked time … persist transforms across runs with fsModuleCache: true". That is advice, not a fault. The suite already runs in 4.3 s, so caching would add config for little gain. *No action proposed.*

**What "working" means for phase 2:** all 7 suites exit 0 with exactly the counts above (Function 25/25), e2e 68 passed + 1 skipped, typecheck 0 errors over 504 files. Every phase-2 change is rechecked against this.

## B. Dead and deprecated code

Audited at the same HEAD (`759060e`, clean tree). Raw sweep output is in `scratchpad/areaB/` (`knip-default.txt`, `markers.txt`, `css.txt`, `commented-code.txt`, `deps.txt`, `npmls.json`).

### What was run, and the short answer

| Check | How | Result |
|---|---|---|
| Unused files, exports, dependencies | `npx -y knip@5` in `app/` (knip 5.88.1, default config, not added to package.json) | 3 "unused files" and 1 "unused dependency", all false positives (B9). 29 value exports and 23 types flagged, but **only one symbol is dead**: `CAS_SOFT_BUDGET_MS` (B1). |
| Unused CSS | Svelte-scoped CSS: `svelte-check --threshold warning` reports Svelte's unused-selector warnings, and gave 0 warnings in area A. Global CSS: haiku sweep of `app/src/style.css` (the only tracked .css file). | No unused selectors. All 14 custom properties are used. `--caret-color` and `--selection-background-color` (`App.svelte:390-391`) are read by MathLive (`node_modules/mathlive/mathlive.mjs`). |
| TODO/FIXME/HACK/XXX | `git ls-files` (excluding `spec/mapping/`, `logo/`) piped to `grep -nE '\b(TODO\|FIXME\|HACK\|XXX)\b'` over the **whole repo** | **0 hits.** |
| "temporary", "for now", "workaround", "deprecated", "remove later" | haiku sweep | 0 hits. |
| "assumed" comments | haiku sweep: 74 lines (plus 12 `source: "assumed"` golden lines) | All cite a G2 item. Several items have since been answered, so those labels are out of date (B7). |
| Commented-out code | sonnet sweep (159 files); my own spot-check grep | **None.** 15 hits are usage lines or value examples in doc comments. |
| `any` and other type escapes in app/ | haiku sweep; I checked the hits | `as any` ×2 in one file (B6). `@ts-ignore`, `@ts-expect-error`, `@ts-nocheck`: 0. `as unknown as`: 16 (B8). |
| SPDX headers | haiku sweep | All 160 source files in scope have `GPL-3.0-or-later` in their first 5 lines. Outside scope, one miss: `spike/input/test/zz-timing.spec.ts` (line 1 is `import { test } …`), left for area C (spike). |
| Retired or unset options | grep plus reading | All four options the brief names are documented and tested, so all are kept (B10). |
| Engine/UI separation | grep for imports into `engine/` from outside `engine/` and `calc/` | **No violation** (B11). |
| Dependencies | sonnet sweep (package.json, lockfile, node_modules, THIRD_PARTY.md, `npm ls --omit=dev`); I verified the misses | Versions agree in all four places and every licence is GPL-compatible. Two shipped transitive packages are missing from THIRD_PARTY.md (B5). |

### Findings

- **B1. `CAS_SOFT_BUDGET_MS` is dead, and the UI hard-codes a copy.**
  - `app/src/engine/types.ts:18` exports `CAS_SOFT_BUDGET_MS = 10_000`. `grep -rnw` finds no reader anywhere in `app/`.
  - The budget is actually enforced by `const SOFT_MS = 10_000` at `app/src/views/History.svelte:68` (comment at :67, "D3: CAS soft budget"), used at :93.
  - `docs/decisions.md:49` and `app/src/engine/README.md:8,27` present the constant as the budget.

  *Proposed:* re-export the constant through `calc/port.ts`, use it in History.svelte and delete `SOFT_MS`. That keeps the docs true and moves no behaviour.
- **B2. The name check is copied once.**
  - `app/src/apps/solve/app.svelte.ts:20` `NAME` is character-for-character the regex `IDENT` at `app/src/engine/solve.ts:29`. Its own comment at :19 says "engine IDENT".
  - The brief's example pair is already fixed: `analysis.ts:7` imports `IDENT` from `solve.ts`.
  - `python/calcHost.ts:15` `NAME` is a different rule (Python names allow `_` anywhere), so it is not a duplicate.

  *Proposed:* re-export `IDENT` through `calc/port.ts` and use it in the Solve app.
- **B3. `plainNumber` is written twice, and the copies differ.**
  - `app/src/apps/solve/app.svelte.ts:49` (exported) matches `\\times\s*10` and returns `undefined` unless `parseDec` accepts the result.
  - `app/src/apps/function/app.svelte.ts:491` (private) matches `\\times10` with no space allowed, and returns the raw string (the caller at :124 then runs `parseDec`).
  - So `1.5\times 10^{3}` with a space converts in Solve but not in Function. Whether MathLive ever emits that space: could not tell.

  *Proposed:* Function imports the Solve version. Add a unit case for the spaced form first.
- **B4. `num()` is written twice in the engine.**
  - `app/src/engine/solve1.ts:55` repeats `app/src/engine/solve.ts:12`, minus the `negZero` fix for Giac's `0.-000…` text (solve.ts:24-26).
  - `solve.ts` imports `solve1.ts` (solve.ts:8). So the clean single copy lives in `solve1.ts`, with `negZero`, and `solve.ts` imports it.
  - Whether `0.-…` text ever reaches `solve1`: could not tell.
- **B5. THIRD_PARTY.md misses two shipped transitive packages.**
  - `@codemirror/streamparser` 6.0.0 (MIT) and `@marijn/find-cluster-break` 1.0.4 (MIT) are in the production tree (`npm ls --omit=dev`). They are imported by shipped code: `grep` finds them in `node_modules/@codemirror/language/dist/index.js` and `@codemirror/state/dist/index.js`.
  - THIRD_PARTY.md:54-55 lists the other CodeMirror transitives but not these two.
  - `tslib` 2.8.1 (0BSD) is also in the tree under `@capacitor/core`, but Capacitor's ESM build doesn't import it, so it isn't bundled.

  *Proposed:* add the two to the transitive list at THIRD_PARTY.md:54.

  The rest checked out:
  - All 19 entries in `app/package.json` have the same version in package.json, the lockfile, node_modules and THIRD_PARTY.md.
  - Production-tree licences are MIT, 0BSD, and MIT OR LGPL-3.0-or-later (JSXGraph).
  - `libqalculate` and `libxml2` are marked spike-only and nothing in `app/src` uses them.
- **B6. `as any` in `app/src/solveBench.ts:28`.**
  - Two casts on `calc.solve(c.req as any, s as any)`, under `// eslint-disable-next-line @typescript-eslint/no-explicit-any` (:27). CLAUDE.md says "no `any`".
  - The project has no ESLint (not in package.json), so the disable comment does nothing.
  - The file only loads in measurement builds (`main.ts:22-26`).
  - Likely cause: the case literals at :19-20 widen `kind` to `string`.

  *Proposed:* type the cases as `SolveRequest` and `s` as `CalcSettings`, drop both casts and the comment; typecheck confirms.
- **B7. "assumed" labels for G2 items that now have answers.** All 31 G2 items have Virtual Calculator answers (`docs/backlog.md:33`), but these places still say "assumed":
  - Item 4/11, odd roots, answered −2, the same as ours:
    - `app/src/input/emit.ts:10,170` and `emit-js.test.ts:13`.
    - `docs/decisions.md:187`: "This is assumed (G2 item 4)".
    - Three golden cases, `tests/golden/parser.yaml:323-325` (`source: "assumed", g2: 4`). Their expected values match the answer; only the `source` tag is out of date. `tests/golden/README.md:32` describes how to re-tag them. **Needs the user** (golden files).
  - Item 17, CAS 2D results, answered "Confirms our exact-2D-in-CAS default": `app/test/views.spec.ts:31,41`.
    - Item 17 does **not** cover a/b mixed numbers, but `controller.ts:167`, `entry-forms.test.ts:27` and `decisions.md:67-71` cite it for them. The relevant answer is item 29, which backlog G6 already tracks (`backlog.md:73`; needs a real-G2 check).
  - Item 15, number formats: `app/src/engine/format.ts:10` ("until G2 checklist item 15 is answered") and the heading at `docs/decisions.md:58`.
    - The answer differs from ours: six formats (adds Floating and Rounded); a digits box defaulting to 8 for non-Standard; a thousands separator (`12,345.6789`). See `g2.yaml` item 15.
    - **This difference is not tracked anywhere:** G1–G8 cover items 19–31 only (`backlog.md:65-75`), and `grep` finds no follow-up for item 15. **Needs the user:** follow the reference or keep ours.
  - Items 12–14, Solve:
    - The decision heading `docs/decisions.md:140` says "assumed". Items 13 and 14 differ from ours ("Extremum found", and no pole message). P5(d) chose to keep our wording; G3 tracks item 20.
    - **Out of date, stronger case:** `docs/decisions.md:143` says "Known gap: subscripted names (`x_1`) aren't solvable yet, because … `IDENT` … rejects the underscore". This was fixed in `a3ddd52` (the regex at `solve.ts:29` accepts `x_1`), L1 is done (`backlog.md:104`), and `app/test/subscript.spec.ts` covers it.

  *Proposed:*
  - Doc and comment edits: the "assumed" wording for items 4, 11 and 17 (CAS display), and remove the stale x_1 sentence.
  - Item 15 and the golden re-tag go to "Needs the user".
  - Half-even rounding stays as is: item 8's answer is marked unsure and waits for a real-G2 check (`backlog.md:40`).
- **B8. Format names are spelled two ways, converted by cast in 4 places.**
  - `calc/port.ts:12` `NumberFormat = "std"|"sci"|"eng"` and `engine/format.ts:34` `NumberFormat = "STD"|"SCI"|"ENG"|"FIX"` share a name.
  - The UI converts with `s.format.toUpperCase() as "STD" | "SCI" | "ENG"` at `apps/solve/app.svelte.ts:96,239` and `apps/function/app.svelte.ts:97,100`.
  - Meanwhile `state/displayMode.ts:101` already has a typed map (`BASE`), and `displayMode.ts:95` re-spells the union.

  *Proposed (low priority):* one exported mapping function and no casts.

  The 16 `as unknown as` casts sit at typed boundaries and need no action:
  - worker `self` (`giac.worker.ts:30`, `python.worker.ts:6`);
  - Worker → `WorkerLike` (`workerEngine.ts:47`, `pythonEngine.ts:37`);
  - JSXGraph module and objects (`FunctionPlot.svelte:71,102,170`);
  - a lazy Svelte component (`apps/types.ts:89`);
  - the Capacitor global (`pwa.ts:23`);
  - 7 in tests.
- **B9. knip false positives (no action).** All four are in use:
  - `pwa/sw.js` is read by `vite-plugin-pwa-lite.ts:37`.
  - `scripts/compare-engines.ts` is a CLI documented at `CLAUDE.md:132` and `tests/golden/README.md:28`.
  - `scripts/gen-icons.mjs` is a run-once CLI (see B12).
  - `@capacitor/android` is a Gradle module (`android/capacitor.settings.gradle:3`, `build.sh:68-69`).

  The other knip flags are not dead code:
  - The 29 flagged value exports and 23 types are used inside their own file, so only the `export` keyword is surplus. The exception is `CAS_SOFT_BUDGET_MS` (B1).
  - Some are unused re-exports: `latex-to-giac.ts:6` re-exports `SerializeError` (everyone imports it from `emit.ts:5`), and `apps/{python,solve}/index.ts` re-export the app classes.

  *Proposed:* no action. Trimming `export` keywords is cosmetic.
- **B10. The options the brief names are all kept, since each is documented and tested.**
  - **Half-even rounding:** `format.ts:33,110`; tested in `format.test.ts:58-66,157,166`; documented "switched off until G2 item 8" (`decisions.md:59`). The default is `half-away` (`format.ts:192`), and nothing in the app passes `half-even`.
  - **`?engine=fake`:** gated by `import.meta.env.DEV` (`calc/index.ts:8-11`), so a production build can't reach it. Used by e2e (`test/helpers.ts:11` default, plus `history-perf`, `persist` and `function.spec.ts:160`) and by unit tests (`session.test.ts`, `session.fmt.test.ts`). `pwa.test.ts:19` checks the service worker isn't registered with it.
  - **`decimalComma`:** `parse.ts:21-22,79,145`, `latex-to-giac.ts:9-10,36`; tested at `parser.yaml:333-336`; documented in `decisions.md:186-191` and `backlog.md:109`. **No setting sets it:** `grep` finds no use in `app/src` outside the parser files. Users can't reach it yet.
  - **`realOddRoots`:** `emit.ts:11,172`; on by default; `false` only in the test `parser.yaml:327`; documented in `decisions.md:187`.

  *Proposed:* keep all four.
- **B11. The engine/UI separation holds.**
  - Outside `engine/`, `app/src` imports only `engine/format.ts` (a pure formatter with no imports at all) and `engine/types.ts` (types plus `defaultCasSettings`).
  - `python/nodeMath.ts` imports `EngineHost` and `nodeGiac`, but only `scripts/golden.ts` and `calcHost.test.ts` import it, so it never runs in the browser.
  - `python/calcHost.ts:66-67` reaches Giac only through `MathEngine.eval`.
  - The `console.log` calls in `bench.ts`, `marks.ts`, `plotBench.ts`, `pythonBench.ts` and `solveBench.ts` are the logcat markers that `tools/device_run.py` reads. They are compiled away outside measurement builds (`marks.ts:8`, `main.ts:22`).
- **B12. The app still uses the placeholder icons. Needs the user.**
  - `app/scripts/gen-icons.mjs:2-4` and `app/public/icons/icon.svg:3` say the icons are placeholders until "the project owner's" artwork exists.
  - The user committed `logo/pascaline_{front,back}.svg` in `759060e`, but nothing references `logo/` (`grep` over md/sh/ts/mjs).
  - The tracked PNGs `app/public/icons/icon-{192,512,maskable-512}.png` were made by that script.
  - I did not touch `logo/`.

  *Question for the user:* should the app icons come from the logo (then `gen-icons.mjs` and the placeholders go), or is the logo for something else?

### B, phase 2 (approved 2026-10-12, applied: `51927b0`, `e7a208b`, `8ff8576`)

Edits by Opus (not delegated). Checks afterwards, all from `app/` with an absolute `GIAC_OUT`/`PYTHON_OUT` (logs in `scratchpad/phase2B/`):
- `npm run typecheck`: 0 errors, 0 warnings (504 files).
- `npm test`: 25 files, **316 passed**.
- `npm run golden`: interrupt 16/16, Home 123/123, Solve 42/42, Function 25/25, bench 14/14 (55 run), parser 324/326 (2 known gaps), python 22/22. All PASS.
- `npm run test:e2e`: first run 67 passed, 1 skipped, **1 failed**: `solve.spec.ts:116` "Solve: equations and values are stored" (after reload, `x` read `0`, want `-3`; the test took 7.2 s). The same spec passed 5 out of 5 alone (`--repeat-each=5`) and the full suite then passed twice (68 passed each time). So it is a flake under load, not a regression; it was not seen in area A. Logged as **B13**.
- `npm run build`: OK; `dist/icons/` has the new icons.

| Item | What changed |
|---|---|
| B1 | `CAS_SOFT_BUDGET_MS` re-exported from `calc/port.ts`; `History.svelte` uses it; `SOFT_MS` removed. |
| B2 | `IDENT` moved from `engine/solve.ts` to `engine/types.ts` (already UI-safe: types plus constants, so the Solve app doesn't pull the solver into the main bundle); `solve.ts` and `analysis.ts` import it there; `calc/port.ts` re-exports it; the Solve app's copy `NAME` is gone. |
| B3 | One `plainNumber` in `apps/decimal.ts` (the Solve version, spaced `\times 10` allowed); Solve and Function import it. Unit test added first in `apps/apps.test.ts` (plain, braced and unbraced exponent, spaced form, rejects `\frac{1}{3}` and empty). |
| B4 | One `num()` in `engine/solve1.ts`, now with `negZero` (also exported; `solve.ts` uses it for `decimalFromString`); the copy in `solve.ts` is gone. |
| B5 | THIRD_PARTY.md: `@codemirror/streamparser` 6.0.0 and `@marijn/find-cluster-break` 1.0.4 added to the CodeMirror transitives. |
| B6 | `solveBench.ts`: cases typed as `SolveRequest`, settings as `CalcSettings`; both `as any` and the ESLint comment removed. |
| B7 | Items 4/11: "assumed" → "as on the reference" in `emit.ts:10,170`, `emit-js.test.ts:13`, `decisions.md` (L6 entry; the "would change if item 4" clause dropped). Item 17: `views.spec.ts:31,41` lose "assumed". Mixed numbers now cite item 29 / backlog G6 (still assumed) in `controller.ts:167`, `entry-forms.test.ts:27` and the `decisions.md` heading and "would change if". The stale x_1 "known gap" sentence in `decisions.md` now says x_1 is solvable (L1, `a3ddd52`). Golden: `parser.yaml` `l6-root-01`/`02` → `source: "virtual-calc"` with a note; `l6-root-03` (`surd(x,3)`, a serializer text the reference never showed) → `source: "derived"` with a note, since `virtual-calc` would overclaim. `oracle.py --g2` regenerated `G2-CHECKLIST.md` (item 4 no longer lists them as assumed; 0 problems). Expected values unchanged. |
| B8 | `engineFormat()` in `calc/port.ts` (typed map std→STD, sci→SCI, eng→ENG); the 4 `toUpperCase() as …` casts are gone; `DisplayContext.format` uses `NumberFormat`. |
| B12 | Icons from `logo/` (the logo files themselves untouched). `app/scripts/gen-icons.mjs` rewritten: it reads `logo/pascaline_back.svg` and `logo/pascaline_front.svg` (a 108×108 adaptive-icon pair; the mark stays inside the 66-unit safe circle), composes them and rasterises with `rsvg-convert` (librsvg 2.57.1, a system tool; outputs are committed as before, so builds don't need it). Regenerated: `app/public/icons/icon.svg` and the 192/512/maskable-512 PNGs (the "any" icons crop to the launcher's visible 72-unit square; the maskable one to 90 units, so the mark stays within the 40 % safe radius); Android `mipmap-*/ic_launcher_foreground.png` (108 dp per density), `ic_launcher.png` and `ic_launcher_round.png` (48 dp, for API 24–25), `values/ic_launcher_background.xml` (#FFFFFF → #0025B5, from the back layer), and the 11 `splash.png` files at the template sizes. These replace Capacitor's stock icon and splash, which were still in the APK. Checked by eye on a contact sheet. Not done: the unused template vectors `drawable-v24/ic_launcher_foreground.xml` and `drawable/ic_launcher_background.xml` (nothing references them) are left in place. |

Not applied, still open:
- **B7, item 15 (number formats). Done after approval (`e7a208b`):** backlog G9 added (also notes that the reference's digits count decimal places); `format.ts` and the `decisions.md` entry say "differs from the reference, G9". The original recommendation: **track it as backlog item G9 and leave the formatter alone for now.** The reference's six formats, digits box default 8 and thousands separator are a settings feature, which fits the R4 settings pass, not a cleanup. Then `format.ts:10` and the `decisions.md` heading say "differs from the reference, tracked as G9" instead of "assumed". **Needs the user** (I didn't give a recommendation before, so "yes to all" doesn't cover it).
- **B13. A flaky e2e test (still open).** `solve.spec.ts:116` failed once under full-suite load (above). Could not tell the cause from one failure; the test reloads right after `shell.flush()`. *Proposed:* watch it; if it fails again, look at whether the flush awaits the IndexedDB write before the reload.

## C. spike/ (100 tracked files)

Audited on the working tree above (B edits in place; none touch `spike/`). Raw output is in `scratchpad/areaC/` (`refs-<folder>.txt`, `refs-toplevel.txt`, `refs-relative.txt`, `binaries.txt`, `run-*.txt`).

### What was run

| Check | How | Result |
|---|---|---|
| Who refers to each folder | haiku: `git grep -n -E "spike/<S>(/\|\b)" -- ':!spike/'` per folder, plus cross-refs inside spike and relative `../spike/` paths | Outside spike, only docs and config refer to spike folders, except one code comment (`homeEval.ts:81`). No import, script or build step outside spike reads anything in it. |
| Every "spike" mention in code areas | my `git grep -i spike` over `tools tests app/scripts app/src app/test build.sh engine python` | Only comments: `homeEval.ts:2,81`, `solve1.ts:2`, `engine/README.md:13`, `bench.yaml:2`, and the `device_run.py:3` docstring ("the Pascaline spike shell"). |
| The brief's known live dependencies | `git grep` and `git ls-files` | `tools/devlock.sh` lives in `tools/` and has no spike reference. It is used by `build.sh:37`, `engine/giac/build-wasm-release.sh:28,32` and `python/build-micropython.sh:49`. `tests/engine/interrupt-test.mjs` exists, and `app/scripts/golden.ts:92` runs it. So **C1's move is confirmed** (`0b30497`, backlog.md:98). `spike/qalc` is live (below). |
| What spike scripts import | `git grep` for `../app`, `../engine`, `_out/` inside spike | `spike/serializer/*` and `spike/input/src/{main,serialize}.ts` import live parser code from `app/src/input/`. `spike/node`, `spike/home/run.ts`, `spike/solve/run.ts`, `spike/python/node-bench.mjs` and `spike/research/coverage-probe.mjs` load `engine/giac/_out/gsl`. The rest import only their own folder. |
| Do the cited or live-linked scripts still work? (cheap, desktop) | ran them | `node spike/node/source-smoke.mjs 'factor(x^4-1)'`: rc 0, `(x-1)*(x+1)*(x^2+1)`. `spike/serializer/fuzz-parser.mjs`: rc 0, 20000 inputs, 0 crashed. `spike/serializer/test-js.mjs`: **rc 1, 4 mismatches**: it still expects NaN for ∛ of negatives, but L6 made odd roots real. |
| Is spike content already covered elsewhere? | case-id comparison (Python + PyYAML); `wc -l`; `diff` | `spike/home/cases.yaml` 123/123 ids are in `tests/golden/home.yaml`. `spike/bench/cases.yaml` 55/55 are in `tests/golden/bench.yaml`. `spike/solve/cases.yaml` 23/23 are in `tests/golden/solve.yaml` (42). `spike/home/oracle.py` (177 lines) is replaced by `tests/golden/oracle.py` (307). `spike/python/build-micropython.sh` (22) by `python/build-micropython.sh` (91). `spike/research/trixie-build.sh` (17) by `engine/giac/build-wasm-release.sh` (52). `spike/serializer/fuzz-parser.mjs` has the same token list as `app/src/input/fuzz.test.ts`, which runs in Vitest. `spike/android/overlay/MainActivity.java` differs from the tracked `android/app/src/main/java/org/pascaline/app/MainActivity.java`, which is what `build.sh` builds. |
| Binary exceptions | sonnet: `find` for binary types under spike, `git ls-files`, `git check-ignore -v`, `grep` in RESULTS.md; I re-ran three `check-ignore`s and the tracked-binary count | **No binary is tracked under spike** (`git ls-files spike \| grep -E '\.(wasm\|so\|jar\|a\|apk\|aar\|o\|zip)$'`: 0; `file` check: 0). Every binary on disk is ignored. Gaps in RESULTS.md: C9. |

### Classification

| Folder | Files | Refs from outside spike | Status | Proposal |
|---|---|---|---|---|
| `qalc` | 9 | `docs/p3-units-plan.md:4,26` ("`engine/qalc/build-wasm.sh`, promoted from `spike/qalc/build-wasm.sh`"); `THIRD_PARTY.md:21` (spike-only section); `.gitignore:69-70` | Live: P3 input | **KEEP** until P3 starts. It then **MOVES** to `engine/qalc/`, as the plan says. |
| `node` | 3 | `CLAUDE.md:102-105` (commands) | `source-smoke.mjs` works. `compare-variants.mjs` is replaced by `app/scripts/compare-engines.ts` (two `giac.mjs` paths instead of two variant names). `prebuilt-smoke.cjs` loads Parisse's build in `spike/prebuilt/` (Phase 0 comparison). | **MOVE** `source-smoke.mjs` → `engine/giac/smoke.mjs`, next to `python/smoke.mjs`. **ARCHIVE** the other two. `spike/prebuilt/` itself stays on disk (CLAUDE.md: never delete). Update CLAUDE.md:102-105. |
| `research` | 7 | none by path. But **R5 `giac-help-licence.md` answers a question the docs still call open**: `backlog.md:123` (R4: "The Giac help-text licence is still to clarify with Parisse") and `docs/02-architecture-plan.md:134` ("check the licence"). | 5 notes still useful; 2 scripts replaced | **MOVE** the five notes (`engineer-needs`, `fdroid-feasibility`, `giac-help-licence`, `r2-wasm-start`, `r4-building-blocks`) → `docs/research/`, and point R4 / docs/02:134 at R5. **ARCHIVE** `trixie-build.sh` (replaced by `build-wasm-release.sh`) and `coverage-probe.mjs` (R3 probe). |
| `python` | 6 | `NOTES.md` is cited by `backlog.md:84` (done task P2) and `docs/shifts/brief.md:39` (reading list) | Scripts replaced (`python/build-micropython.sh`, `python/smoke.mjs`); NOTES still read | **MOVE** `NOTES.md` → `docs/research/python-notes.md` and update the 2 citations. **ARCHIVE** the 5 scripts. |
| `home` | 5 | `app/src/engine/homeEval.ts:81` ("See spike/home/NOTES.md … for the cost") | Fully covered by golden + `tests/golden/oracle.py`. The cited NOTES.md states the setting (`ckevery 10`, lines 17, 51) but **gives no cost figure**. | **ARCHIVE**. Repoint `homeEval.ts:81` to `engine/giac/patches/README.md` (patch 0002 row, which states `ckevery 10`), and drop "for the cost". |
| `app` | 23 | `CLAUDE.md:107-112` (commands); `.claude/skills/phase-0-spike/SKILL.md:53,58` | Replaced by `app/`: worker engine, device bench through `tools/device_run.py bench`, golden bench | **ARCHIVE**; remove CLAUDE.md:107-112. |
| `bench` | 1 | `SKILL.md:55` only | 55/55 in `tests/golden/bench.yaml`; read only by `spike/app/scripts/copy-engine.mjs` | **ARCHIVE** with `app`. |
| `solve` | 3 | none | 23/23 in `tests/golden/solve.yaml`; `run.ts` imports `spike/app`'s copy of solve1 | **ARCHIVE**. |
| `serializer` | 5 | `SKILL.md:66` only | `fuzz-parser` = `fuzz.test.ts`. `test-js` is stale (rc 1; `emit-js.test.ts` has the L6 rule). `run.mjs`/`diff-parsers.mjs` compare Compute Engine vs our parser; P1 dropped Compute Engine. Needs `spike/input/node_modules`. | **ARCHIVE**. |
| `input` | 15 | none | MathLive keyboard spike, replaced by `app/`; holds the one SPDX miss (`test/zz-timing.spec.ts`, area B) | **ARCHIVE** (that also clears the SPDX miss). |
| `plot` | 17 | none | JSXGraph and Python device pages; results in RESULTS.md (D7, Q4) | **ARCHIVE**. |
| `android` | 3 | none (inside spike: `spike/app/.gitignore:6`, RESULTS.md:50, DECISIONS.md:59) | Replaced by the tracked `android/` project | **ARCHIVE**. |
| `RESULTS.md`, `DECISIONS.md` | 2 | 18 lines in 7 files (CLAUDE.md, docs/02 ×4, docs/decisions.md:4, brief ×3, p3 plan, THIRD_PARTY, the skill ×6) | The Phase 0 record (D1–D9, P1/P2) | **KEEP** in place. Many links point here, and `spike/` keeps `qalc` until P3 anyway. |
| `MORNING-REPORT.md` | 1 | none | One night-shift report (2026-10-10/11) | **MOVE** → `docs/shifts/2026-10-11-morning-report.md`, next to the other shift reports. |

"ARCHIVE", per the brief, means: add a short "Archived" section to `spike/RESULTS.md` naming each folder, what it proved, where it lives now (golden file, app module) and the last commit that has it, then `git rm` the folder. Their results are already in RESULTS.md (Q1–Q5, P1–P3 sections). No folder is a plain DELETE, since each one backs a recorded result.

### Findings

- **C1. Nine of twelve folders can go** (ARCHIVE: `app`, `bench`, `home`, `solve`, `serializer`, `input`, `plot`, `android`, plus the scripts in `python`, `research` and `node`). Nothing outside spike imports or runs them, and their cases and checks are covered by golden files and Vitest (table above). Counted from `git ls-files spike`: 81 files are removed, 8 move out (`source-smoke.mjs`, 5 research notes, the python NOTES, the morning report) and 11 stay (`qalc/` 9, RESULTS.md, DECISIONS.md).
- **C2. Docs that point at spike folders need the same commit:**
  - `CLAUDE.md:102-112`: the spike/node and spike app command blocks.
  - `homeEval.ts:81`: points at a NOTES.md that has no cost figure.
  - `backlog.md:84` and `brief.md:39`: spike/python/NOTES.md.
  - `.claude/skills/phase-0-spike/SKILL.md`: the whole Phase 0 skill is built on spike paths, and Phase 0 is done. Whether the skill stays is for area G (agents and skills); I'm noting it here.
- **C3. The Giac help-text licence is answered but not recorded where it is needed.** See the `research` row. The note's own caveat stands ("a reading of the README, not legal advice"), so R4's "clarify with Parisse" may still be wanted. *Proposed:* link R5 from backlog R4 and docs/02:134; whether to still ask Parisse is the user's call.
- **C4. Stale lines in the Phase 0 record**, left as history unless the user wants notes added:
  - `spike/DECISIONS.md:75` names `spike/node/interrupt-test.mjs` (now `tests/engine/interrupt-test.mjs`).
  - `spike/RESULTS.md:153` names `spike/python/build-micropython.sh` (now `python/build-micropython.sh`).
  - *Proposed:* the "Archived" section lists the new places; the old lines stay.
- **C5. `docs/backlog.md:54-61` contradicts itself.** The heading "Code that still lives in `spike/` (task C1)" and "Shipped code still depends on it" are followed by "These moved out of `spike/` (C1, done)". *Proposed:* reword the heading as past tense (area D will collect wording fixes like this).
- **C6. `docs/shifts/brief.md:173` reads "`tests/engine/interrupt-test.mjs` → `tests/engine/interrupt-test.mjs`"**, probably a find-and-replace that also hit its own source path. Left for area D.
- **C7. `tools/device_run.py:3` calls the app "the Pascaline spike shell".** It now measures the real app. Left for area D.
- **C8. Ignored spike content on disk: about 650 MB, all untracked.**
  - node_modules: `spike/plot` 287 MB, `spike/input` 191 MB, `spike/app` 87 MB.
  - `spike/app/dist` 28 MB and `spike/app/public/engine` 28 MB: copies of our wasm and of Parisse's prebuilt.
  - `spike/prebuilt` 32 MB.
  - Archiving the folders in git leaves these on disk. Deleting them is **Needs the user** (untracked files). `spike/prebuilt/` stays in any case (CLAUDE.md).
- **C9. RESULTS.md's binary list is incomplete.**
  - It lists `spike/prebuilt/` (L150-151), Pyodide in `spike/python/_build/` (L154) and the MathLive fonts (L156).
  - **Listed but not on disk:** `spike/python/_build/`, the generated Capacitor project for spike/app, and GeoGebra's `libgmp.a`/`libmpfr.a` (L152, "not used").
  - **On disk but not listed by path:**
    - `spike/app/public/engine/{source/giac.wasm, prebuilt/giacwasm.js}`, ignored by `spike/app/.gitignore:2`;
    - `spike/app/dist/engine/…`, ignored by `.gitignore:5`;
    - `spike/prebuilt/giac-extracted.wasm`, covered by its folder's row.
  - The rule's intent holds: nothing is tracked, and `.gitignore` covers every one (rules at `.gitignore:5,21-22,47-48,69-70`, `spike/app/.gitignore:2`, `spike/input/.gitignore:4`).
  - *Proposed:* the "Archived" section notes that the spike/app copies are build outputs (gone with the folder). Nothing else is needed while `spike/prebuilt/` is the only kept exception.

### C, phase 2 (approved 2026-10-12, applied: `8f95cef`)

- Done as recommended. The ARCHIVE/MOVE list matches the table. The "Archived" section in `spike/RESULTS.md` names last commit `8ff8576`. Pointers were fixed in CLAUDE.md, backlog (C1 heading per C5, P2 notes, R4 → R5), brief, docs/02:134 (→ R5) and `homeEval.ts:81` (→ patches/README.md).
- C4 (old lines in the Phase 0 record) stays as history; the Archived section gives the new places.
- `engine/giac/smoke.mjs` ran after the move: `factor(x^4-1)` → `(x-1)*(x+1)*(x^2+1)`, `solve(x^2=2,x)` → `list[-sqrt(2),sqrt(2)]`.
- Gate after the commit: typecheck 0 errors, 316 unit tests, golden all PASS.
- `git ls-files spike` now lists `qalc/` (9 files), `RESULTS.md` and `DECISIONS.md`.
- Left for area G: `.claude/skills/phase-0-spike/SKILL.md` still cites the archived folders.
- C6 and C7 are left for area D.
- **Disk (C8):** deleted `spike/plot` and `spike/input` (287 MB and 192 MB, node_modules and copied fonts), and in `spike/app`: `node_modules`, `dist/`, `public/` (copies of our wasm, Parisse's prebuilt and the case JSONs) and `test-results/`. About 621 MB in total.
- **Kept, needs the user:** `spike/app/bench/results/*.json` (4 files, 60 KB): the raw Phase 0 desktop benchmark data (chromium and firefox, source and prebuilt, 2026-10-10). It isn't build output, and it was never committed. It shows as untracked now, because the deleted `spike/app/.gitignore` had covered it. Options: commit it into the Phase 0 record, or delete it (RESULTS.md has the medians). `spike/prebuilt/` (32 MB) stays, per `backlog.md:56` and the brief (not CLAUDE.md, see D4).

**Recommendation for C (as approved):** do it as one commit, "chore(spike): archive Phase 0 spikes". It covers the MOVEs (`engine/giac/smoke.mjs`, `docs/research/`, the morning report), the ARCHIVE `git rm`s, the "Archived" section in RESULTS.md and the C2/C3 doc pointers. Then `spike/` holds only `qalc/`, `RESULTS.md`, `DECISIONS.md` and the ignored `prebuilt/`. The untracked disk cleanup (C8) is a separate yes/no.


## D. Docs

Scope: the 31 tracked `.md` files outside `spec/mapping/` (raw data, kept as is), plus the CLAUDE.md commands. **Fix list, not fixes:** nothing below is edited yet.

### What was run

| Check | How | Result |
|---|---|---|
| Every repo path cited in a doc exists | script over `git ls-files '*.md'`: links and path-like words, `os.path.exists` + `git check-ignore` | 105 hits; after removing shorthand (`docs/02`), Giac-source paths (`src/Makefile.am`), relative paths that resolve (`scripts/…` from `app/`) and paths the P3 plan will create (`engine/qalc/…`), the real misses are the old `spike/` paths in the research notes moved in area C (D3) and in historical records (shift reports, `spike/RESULTS.md`, `spike/DECISIONS.md`) |
| Line-number citations (`file:NN`, `#LNN`) | sonnet sweep, then my own grep | **0** in the docs; nothing to go stale |
| Commands, flags, env vars, npm scripts | sonnet sweep over CLAUDE.md, README, CONTRIBUTING and the 7 sub-READMEs | 47 commands: 41 OK, 6 call external tools (could not tell), 0 missing scripts, flags or env vars. Spot check: the patch loop the patches README describes is `engine/giac/build-wasm.sh:164` |
| Golden counts | `yaml.safe_load` of each `tests/golden/*.yaml` | home 123, solve 42, **function 25**, bench 55 (14 with `expect`), **parser 326** (324 + 2 `status: gap`), python 22, g2 31 items |
| Unit and e2e counts | area A/B runs | Vitest 316, Playwright 68 |
| Bundle sizes (L7) | `npm run build` (Vite only, no engine build) | start chunk `index-*.js` **139.12 kB**, `mathlive.min-*.js` 807.73 kB, JSXGraph chunk 1 035 kB, Python chunk 377 kB (all lazy except the start chunk) |
| Status claims vs code | `grep` in `app/src`, `spec/keyboard.yaml`, `git log` | see D5–D8 |
| Repeated facts | `grep -c` of 18 key phrases over the 11 main docs | see D10 |

### Correction to area B (my error)

- **D1. `l6-root-01`/`02` were re-tagged wrongly in `e7a208b`.** They are `\sqrt[3]{-27}` → -3 and `\sqrt[5]{-32}` → -2 (`tests/golden/parser.yaml:323-324`), now `source: "virtual-calc"`. But G2 item 4 says the reference was "Tested as a power, not with a dedicated cube-root key", with `(-8)^(1/3)` only (`g2.yaml` item 4). Neither input nor the root template was observed, so `virtual-calc` overclaims. Also, P5(b) (`decisions.md` P5, DECIDED) keeps *our* power form complex, so for the power form we deliberately **differ** from the reference; only the root template gives the real root. *Fix:* both cases → `source: "derived"` (a real odd root of a negative number is provable), note "the reference gives -2 for `(-8)^(1/3)` (G2 items 4/11); ours keeps that complex (P5(b)), the root template gives the real root". The same wording goes to `emit.ts:10,170`, `emit-js.test.ts:13` and the `decisions.md` L6 entry ("The reference gives -2 too…"), which today read as if we matched the reference. Expected values don't change; rerun `oracle.py --g2`.

### Wrong facts (paths, counts, commands)

- **D2. Golden counts.**
  - `CLAUDE.md:122`: "Function 24/24" → 25/25 (already A1). "bench 55" is right as a case count; the gate checks 14 of them (`golden.ts:13`); say "bench 55 (14 checked)".
  - `tests/golden/README.md:16,18`: function 24 → 25; parser "298 … (4 known gaps)" → 326 (2 known gaps). The table lacks `python.yaml` (22). Line 26 lists the gate stages without `python` (`golden.ts:6` has it).
  - `docs/shifts/brief.md:193` repeats "Function 24/24" (see D7 for the brief as a whole).
- **D3. Research notes moved in area C still cite `spike/` paths:** `docs/research/engineer-needs.md:4`, `fdroid-feasibility.md:19,25`, `r2-wasm-start.md:7,21`. *Fix:* one line under each title: "Moved from `spike/research/` on 2026-10-12; the `spike/` paths below are in `git show 8ff8576`". `docs/shifts/2026-10-11-morning-report.md` gets the same line. (Historical shift reports are left as written: they are records of a shift.)
- **D4. The "never delete" rule is not in CLAUDE.md.** The brief says "spike/prebuilt/ (CLAUDE.md: never delete)", but `git log -S prebuilt -- CLAUDE.md` shows CLAUDE.md only ever had the prebuilt smoke command, which `8f95cef` removed with `spike/node`. The rule lives in `backlog.md:56` ("Never delete `engine/giac/_downloads/` or `spike/prebuilt/`"). My own C section above also said "per CLAUDE.md"; corrected. *Fix:* one line in CLAUDE.md "Non-negotiable rules" (it is a rule, read every session), and drop it from the backlog.
- **D5. `docs/decisions.md` entries that contradict the code:**
  - "Entry and history behaviour" (L75-82): "History isn't stored yet" (it is: `saveHistory()`, `app/src/state/session.svelte.ts:222`); "shift + alpha types capitals" and "Alpha lock comes later" (P4 flipped the case and L3 built the lock: `session.svelte.ts:131` "alpha, alpha locks capitals; shift, alpha, alpha lower case"); "exponents stay raised for now" in one-line mode (L4 made them linear, entry at L159); "all 40 cells are taken" (P4 replaced the grid).
  - "Alpha lock (assumed)" (L153-157): says "alpha twice locks lowercase; shift, alpha, alpha locks capitals", the reverse of the code since P4.
  *Fix:* rewrite both to what the code does; mark the Entry entry "updated 2026-10-12".
- **D6. Bundle size (`backlog.md` L7):** "94 kB at start" → 139 kB (MathLive 808 kB is right). Not a regression finding by itself (no budget is set), but it is the start-up number the backlog says to watch.

### Superseded text

- **D7. `docs/shifts/brief.md` is the brief of a finished shift** ("milestone 3 device numbers + mapping rebase"). All its tasks are done: device numbers (m3 report, `02` s12 item 6), the mapping merged (`632dab4`), the P3 spike (`spike/RESULTS.md` qalc section). Sections 7–8 are the even older milestone 3 assignments. Yet `CLAUDE.md:11` calls it "the current shift brief" and `.claude/agents/henri.md:8` tells Henri to "follow it". *Fix:* keep sections 1–6 and 9–11 (the standing rules: principles, hard rules, start-up, worker setup, devices, loop, wrap-up) as `docs/shifts/rules.md`; leave `brief.md` as a short stub "No shift is planned; the last brief is `git show <hash>:docs/shifts/brief.md`", to be rewritten when the next shift starts. Henri and the three worker agents then read `rules.md` + `brief.md`. (Changing `.claude/agents/` belongs to area G; this only names the dependency.)
- **D8. `docs/02-architecture-plan.md` contradicts later decisions:**
  - section 5 "Units, constants: Giac (Prime CAS units are Giac units)" and section 12b "Physical constants" / "Units" ("We don't need Qalculate's library"): replaced by P3 (libqalculate, "Giac units are not used", `decisions.md` P3 integration plan (1) and (7)).
  - section 12b "Decimal ⇄ scientific key" ("It changes the Home setting"): built differently as the Format key (`e9e9c89`; `spec/keyboard.yaml:246`, "cycles the display format of the last result"; `decisions.md` user requests 1).
  - section 8 "MVP … Python (numpy/sympy)": the MVP Python is MicroPython (D6); numpy/sympy is the optional Python+ pack.
  - section 12 item 3: "the old Android 8/9 tablet" is no longer needed (`backlog.md:35`, the S8+ covers that class).
  *Fix:* section 12b gets a status line per feature (constants and units → P3, `docs/p3-units-plan.md`; key → done, `e9e9c89`) and the old text goes; sections 5 and 8 get the one-word corrections. The rest of the plan (sections 1–11) is the design rationale and stays.
- **D9. `docs/01-feasibility-report.md`** already has an "Update" banner (line 3) saying only the legal analysis applies. CLAUDE.md, README and `02` point at it for section 3. *Recommendation:* leave it; it's 287 lines nobody needs to read except section 3, and the banner says so. Moving section 3 into its own file would be tidier but changes a "binding" document's location for no correctness gain.
- **Other stale status lines:**
  - `README.md:5` and `README.md:44`: "Python is next" (milestone 3 done 2026-10-11).
  - `CONTRIBUTING.md` section 5: "Build and test commands will be documented in the README as soon as there's code" (they are in CLAUDE.md "Commands"; README has none).
  - `CLAUDE.md:11` "Status (2026-10-11)": milestones correct; see D11 for moving it.
  - `docs/backlog.md:4` "Last reviewed 2026-10-11 by Henri, after milestone 2"; and see D12.
- **`decisions.md` "Would change if" conditions now answered** (all 31 G2 items have a Virtual Calculator answer; `g2.yaml`):
  - "Default angle mode: radians (assumed)": item 4's answer was taken in "default settings (radians, Standard)". So the reference's default is radians too: drop "(assumed)", cite item 4. (Strictly, the item records the setting in use, not a factory reset: "default settings" is its wording.)
  - "Solve app variables and results (assumed, G2 items 12–14, 20)" and "Residual check thresholds … or the G2 (items 12–14, 20)": answered; the differences were decided in P5(d) (keep our wording). Drop "(assumed)" and point at P5(d).
  - "Graphics modules (compatibility names assumed, G2 items 26–28)": item 26 lists the names and backlog G5 says the signatures match. Drop "assumed"; the open part is P6.
  - "Polynomial root order … Would change if: G2 item 21 shows another order": item 21 answered and matches; drop the clause.
  - "Home and CAS share one Giac context … (add to the G2 checklist)": never added (no such item in `g2.yaml`). Either add it as item 32 for the next session or drop the parenthesis. Could not tell the reference's behaviour from the existing answers.
  - "`calc.cas` is synchronous … Would change if the release build rejects `EM_ASYNC_JS` … or the Tab One misses the bars": both checked and not met (release MicroPython build in `python/_out/release`; Tab One bars passed, backlog D1). Add "checked 2026-10-11, holds".
  - `decisions.md` "Needs the user" (L6-36) holds the struck merge item and P3, P4, the user requests, P5 and the P3 plan, all ACCEPTED or DECIDED. Only P6 still needs the user. *Fix:* move the decided ones under a "Decided proposals" heading; leave P6.

### Duplicates: one home each

- **D10.** The facts repeated in two or more of CLAUDE.md, backlog, decisions, the plan, the READMEs and the brief (`grep -c` counts):

| Fact | Where now | One home | Elsewhere |
|---|---|---|---|
| Milestone status | CLAUDE.md:11, backlog "Where we are", `02` s12, README roadmap | `backlog.md` | CLAUDE.md one line "Status: docs/backlog.md"; README keeps its public one-liner |
| Device numbers (679 ms, 995 ms, fps…) | backlog "Is it on track", `02` s12, shift reports, RESULTS | shift reports (measured there) + `02` s12 (milestone history) | backlog: the bars and "all pass", link to the m3 report |
| Golden counts | CLAUDE.md:122, `tests/golden/README.md`, brief, decisions "Golden gate" | `tests/golden/README.md` table | CLAUDE.md: "the gate must print PASSED" without counts, so they can't go stale again (this is the third stale copy found: A1, D2) |
| Golden `source:` tags | CLAUDE.md, CONTRIBUTING s4, `tests/golden/README.md` | CLAUDE.md (rule) | the other two are for contributors and readers; keep, they say the same |
| Clean-room rules | CLAUDE.md, CONTRIBUTING s1, brief s3, `01` s3, `02` s10 | CLAUDE.md (agents) and CONTRIBUTING (humans) | brief: link instead of a copy (D7) |
| Key decisions (MathPrint, parser, exact-first, solver, toolchain) | CLAUDE.md "Key decisions" (≈11 long lines), `02` s6, `spike/DECISIONS.md`, `decisions.md` | `02` s6 + the decision logs | CLAUDE.md: one line each with the rule part only (see D11) |
| "Never delete" `_downloads`/`prebuilt` | backlog:56, brief, tests/golden README ("never delete an answer", unrelated) | CLAUDE.md rules (D4) | backlog drops it |
| Giac help licence | `02` s5, backlog R4, `docs/research/giac-help-licence.md` | the research note (R5) | the other two link (already so since `8f95cef`) |
| Absolute `GIAC_OUT` for golden | CLAUDE.md:122, backlog C1, brief | CLAUDE.md Commands | backlog C1 is done; drop the note (D12) |

- **D11. CLAUDE.md: 153 lines** (the brief's 162 was before area C). What could move out, about 45 lines in all:
  - "Planned repo layout" (14 lines, `CLAUDE.md:69-83`): every folder exists now (checked); it misses `tools/`, `logo/`, `fdroid/`, `tests/engine/`. A two-line "where things are" sentence, or nothing (`ls` shows it).
  - "Key decisions" (≈11 lines of the 20-line Architecture section): keep the diagram and a one-line rule per decision, link `02` s6 for the reasoning.
  - The Status paragraph (`CLAUDE.md:11`, one long line): one line pointing at the backlog.
  - Commands: the device block and the coordinator line (≈9 lines) could move to a `tools/README.md` (it doesn't exist yet); the rest is used most sessions and should stay.
  - "This machine (checked 2026-10-10)" (8 lines): stays; agents need "npm, not pnpm" and "Firefox only".
  Plus one line in (D4). Net about 110 lines.

### Backlog

- **D12. `docs/backlog.md`:**
  - **Struck-through and done, drop or fold into one "Done" line each:** Needs the user 3; Milestone 3 P1–P5 and D1; C1, C2; L1–L6 and L8 (L8 is still 12 lines of how-to for finished work, `backlog.md:108-115`); G1, G2; R1; "Physical constants menu". Their record is in the commits, the shift reports and `decisions.md`. A "Done (see git log and decisions.md)" list with the ids and hashes keeps the references working.
  - **Open items with a reason that no longer holds:**
    - "Where we are": "MVP release … Not started" (R1 is done: "In progress"); "Two of its three milestones are done" (all three); "the S8+ … gets measured in the milestone 3 shift" (done, D1); "Milestone 3 must load Python lazily" (done, P1).
    - "Branches and worktrees" (`backlog.md:52`): the three `.claude/worktrees/` it names; whether they still exist is area F's table. Could not tell yet.
    - C3 CI: "Add the engine gate later, once the Giac mirror exists". The mirror is live (`backlog.md:45`). The reason is gone; the user's "later, not now" (Needs the user 4) still holds.
    - C4 and R3: "an icon" is done (`8ff8576`); screenshots and store texts remain.
    - R1: "placeholder icons" were replaced in `8ff8576`.
    - L2: "(G2 item 17 for the form)". Item 17 is the CAS 2D display; the a b/c form is item 29 (the same wrong citation fixed in `decisions.md` in B7).
    - L6: "real odd roots (assumed, G2 item 4…)": answered (item 4); see D1 for what we match.
    - L7: 94 kB → 139 kB (D6).
  - **Duplicates of G1–G9 / L8:**
    - Needs the user 1 (item 29 spot check) = G6 = `decisions.md` "Mixed numbers … Would change if": keep it in Needs the user, G6 links there.
    - G3, G4 and G8 say "no change needed" or are already decided (P5(d)): close them, one line each.
    - G7 (units input) belongs in `docs/p3-units-plan.md`; leave a link.
    - "Unscheduled: A decimal ⇄ scientific (STD → SCI → ENG) key" is done as the Format key (`e9e9c89`); its remaining part (more formats) is G9. Drop it.
    - L9 overlaps L8 by design (same cause, reuse `selectCompound`); keep L9 open, it is not done (no Playwright case for it: `grep -nE 'L9|÷ ?3|div.*3' app/test/keys.spec.ts` finds nothing; could not tell without a run whether the bug still shows).

### Recommendation for D

Do it as **two commits**:
1. `fix(golden): l6-root cases are derived, not virtual-calc` (D1): two `source:` tags, the notes, the `emit.ts`/test/decisions wording, `oracle.py --g2`. It's a correctness record fix, so it goes first and alone.
2. `docs: refresh status, counts and decisions; trim the backlog` (D2–D12, minus D9): golden README and CLAUDE.md counts, research-note headers, the decisions rewrites, the plan's 12b status lines, README/CONTRIBUTING status, the backlog trim, the CLAUDE.md slim-down (to about 110 lines) and the never-delete rule, and the brief split into `rules.md` + a stub.

Needs the user: whether the "never delete" rule goes into CLAUDE.md (it's the rules section, which only you change), and whether the brief split is OK, since Henri's agent file reads it (the agent-file edit itself waits for area G).

### D, phase 2 (approved 2026-10-12, applied: `09665a6`, `0e2a731`, `27f8378`)

- **D1** in `09665a6`: `l6-root-01`/`02` → `derived`, the notes and the `emit.ts`, `emit-js.test.ts`, `decisions.md` wording. Checks: parser stage 324/326 (2 known gaps), `src/input` Vitest 90/90, `oracle.py` and `--g2` 0 problems (the checklist didn't change).
- **D2–D12** in `0e2a731`, as listed above, with these differences:
  - CLAUDE.md came to **135 lines**, not the estimated 110: the Commands block (the biggest section) stays, as recommended.
  - The never-delete rule went into CLAUDE.md "F-Droid readiness" and `docs/shifts/rules.md` section 3, and out of the backlog.
  - `docs/shifts/rules.md` keeps the old section numbers (1, 3–6, 9–11) so `.claude/agents/*` ("brief.md sections 1–6", "starting with section 4") still lead somewhere; the stub `brief.md` points there. Updating the agent files is area G.
  - New `tools/README.md` holds the device commands (`device_run.py page` checked against its argparse, `tools/device_run.py:247`). It notes that `probe-wasm.py` served a page of the archived spike app (for area G).
  - `spec/keyboard.yaml:60` cited G2 item 17 for the a b/c key like backlog L2; now "assumed" (item 29 is cited in the same line).
  - Checks: `vitest run` 316/316, `oracle.py` 0 problems, the path script over the changed docs (only the known false positives).
- **Bench JSON** in `27f8378`: moved to `spike/bench-results/` (not back into the archived `spike/app/`), `spike/RESULTS.md:47` updated. `spike/app/` is gone from disk.
- **Another session worked in the same checkout meanwhile.** It committed `f3b7d45` (K0 system-keyboard fix, P7 keypad gestures, backlog K0–K5) at 15:34, between my two D commits, touching `docs/backlog.md` and `docs/decisions.md`. `git show --stat f3b7d45` lists only its own 4 files, so none of my uncommitted edits went into it. My `decisions.md`, `backlog.md` and `keyboard.yaml` edits were applied as text replacements on top of its version, and P7 stays under "Needs the user" (its point 4 is open). Its backlog note of a flaky `solve.spec.ts` persistence test is the same as B13.

## E. HP/Prime and network

The brief's text for area E was never pasted. This section covers what the brief's delegation list names for E: a case-insensitive grep for "HP"/"Prime" and for network use, plus the Android permissions and Google dependencies (the CLAUDE.md F-Droid rules). It ran with `git grep` over tracked files in app/, android/app/, python/, engine/giac/wasm, tools/, fastlane/, fdroid/, `spec/keyboard.yaml`, README and `build.sh` (haiku sweep, re-checked below).

- **E1. The Capacitor template still brings in the Google services Gradle plugin.**
  - Evidence:
    - `android/build.gradle:11` has `classpath 'com.google.gms:google-services:4.4.4'`;
    - `android/app/build.gradle:64-71` applies `com.google.gms.google-services` when a `google-services.json` exists (none does).
  - CLAUDE.md forbids Google Play Services, and F-Droid recipes strip exactly this. Examples in `../fdroiddata`: `metadata/app.organicmaps.yml:35` (`sed -i -e '/com.google.gms/d'`) and `metadata/allen.town.focus.mastodon.yml:36`. Our recipe (`fdroid/org.pascaline.app.yml:27-44`) doesn't do that.
  - Risk: none for the app (no push notifications, no JSON file). Gradle no longer downloads the plugin.
  - Effort S. **FIX:** delete both blocks; check with one `build.sh` run.
- **E2. The INTERNET permission** (`android/app/src/main/AndroidManifest.xml:40`, template default).
  - The app is fully offline. Capacitor serves the assets locally, and the only network code is the service worker's same-origin fallback (E5).
  - Risk: **could not tell** without a device run whether the WebView setup needs it.
  - A later optional Pyodide download (non-F-Droid builds only, CLAUDE.md) would need it back in that flavour.
  - Effort S plus one device check. **FIX** in the next device session.
- **E3. `hpprime` is an identifier in our code:** `COMPAT_MODULE = "hpprime"` (`app/src/python/graphics.ts:12`), used in `graphics.test.ts:53,63`.
  - CLAUDE.md's legal rules say no "HP" or "Prime" in identifiers. The exception for compatibility modules ("use the name scripts import") exists only in `docs/shifts/rules.md:15`. The file comment (`graphics.ts:7-11`) says only the module name is fixed by compatibility.
  - Risk of renaming: scripts written for the reference calculator stop importing.
  - **ASK.** Recommendation: keep `hpprime` as the import name only, and write the exception into CLAUDE.md "Legal / clean room" so the rules of record say it.
- **E4. HP/Prime mentions in README and the store text are nominative, with the disclaimer:** `README.md:60` ("not affiliated with, endorsed by, or connected to HP Inc. or Moravia Consulting") and `fastlane/metadata/android/en-US/full_description.txt:7`. **KEEP.** The binary hits for "hp" in 4 PNGs are random bytes.
- **E5. Network code:** the only call is `return fetch(req)` in `app/pwa/sw.js:43`, after `sw.js:32` returns for any non-GET or cross-origin request, so it only fetches our own files on a cache miss. There's no XMLHttpRequest, WebSocket, EventSource, sendBeacon or importScripts. The other `http://` hits are XML namespaces. **KEEP.**
- **E6. Capacitor template test files nothing runs:**
  - `android/app/src/test/java/com/getcapacitor/myapp/ExampleUnitTest.java` (`assertEquals(4, 2 + 2)`);
  - `android/app/src/androidTest/java/com/getcapacitor/myapp/ExampleInstrumentedTest.java:24`, which asserts the package name `com.getcapacitor.app` (ours is `org.pascaline.app`, so it would fail).

  Risk: none. Their test dependencies (`android/app/build.gradle:14,57-59`, `android/variables.gradle:12-14`) can go in the same commit, checked by the same `build.sh` run. Effort S. **DELETE.**

## F. Repo state and weight

Read-only. Nothing was removed. The only writes were builds into the scratchpad and the usual `npm run build` into the gitignored `app/dist/`.

### What was run

- **Refs and worktrees:** a script over `git for-each-ref` and `git worktree list --porcelain`. For each ref it ran:
  - `git merge-base --is-ancestor <ref> phase-1|master`;
  - `git rev-list --count phase-1..<ref>` and `master..<ref>`;
  - the tip date;
  - `git status --porcelain` in the ref's worktree.
- For every ref with commits missing from `phase-1`: `git cherry -v phase-1 <ref>` (`-` means an equivalent patch is already in `phase-1`). For `map/vc-1`: `git range-diff` against `map/vc-1-rebased`.
- **History:**
  - `git count-objects -vH`;
  - the largest blobs reachable from any ref (`git rev-list --objects --all | git cat-file --batch-check`);
  - `git log --all --full-history` for the two binaries that turned up.
- **Disk:** `du` over every path that `git status --ignored` lists, per worktree, and over the two sibling checkouts.
- **Bundle:**
  - `npm run build` (exit 0);
  - a source-map build of `phase-1` and of the milestone 3 code (`p1/ron-m3c`, 6a8ee7c, merged as 739f45e), both into the scratchpad;
  - a small VLQ decoder that credits each byte of the start chunk to the module it came from.

### Refs and worktrees

There are **49 refs**, not the brief's 46: 43 local branches, 3 remote-tracking refs, 2 tags and 1 filter-branch backup. There are 19 worktrees under `.claude/worktrees/` plus the two sibling checkouts. Every tip is from 2026-10-10 or 2026-10-11, except `phase-1`.

Only **one commit on any ref has no equivalent in `phase-1`**: `be84510` on `p1/annabell-icon`, which 8ff8576 replaced. Everything else either is an ancestor of `phase-1`, or `git cherry` shows all its commits as `-`. Those are the copies from before the 2026-10-11 e-mail rewrite (`.coord/log.md:222-224`); the extra commit in each count is the old merge commit 632dab4.

| Ref | Worktree (size) | Tip | In `phase-1` | Commits not in `phase-1` | Untracked in worktree | Recommend |
|---|---|---|---|---|---|---|
| `phase-1` | main checkout | 27f8378, 10-12 | – | – | this report | **keep**; 8 commits ahead of `origin/phase-1` (759060e) |
| `master` (= `origin/master`) | – | b4431ae, 10-11 | yes | 0 | – | **keep**; `phase-1` is 12 commits ahead |
| `origin/HEAD`, `origin/master`, `origin/phase-1` | – | – | yes | 0 | – | **keep** (remote-tracking) |
| tags `deps-giac-2.1.0-1d9536e0`, `phase-0-done` | – | 28068b6, 42f3aae | yes | 0 | – | **keep** |
| `p1/annabell-m3` | agent-a706943b46be9d58f (400 MB) | 0b30497 | yes | 0 | – | remove |
| `p1/annabell-m3b` | agent-a85dce4dae13dd3c3 (369 MB) | 63e24ce | yes | 0 | `tools/__pycache__/` | remove |
| `p1/annabell-m3c` | agent-afd98b4bb82c431b6 (379 MB) | 9523384 | yes | 0 | – | remove |
| `p1/annabell-m3d` | agent-ade263426fb1218c8 (379 MB) | 3a49a61 | yes | 0 | – | remove |
| `p1/annabell-tab1` | agent-a5d74479312a6b448 (380 MB) | 53ca0db | yes | 0 | – | remove |
| `p1/gorge-m3b` | agent-a61d3383129f9422b (14 MB) | d76bff9 | yes | 0 | `app/node_modules` (symlink) | remove |
| `p1/gorge-xx` | agent-abdf27598d56a3580 (274 MB) | d1e9c7e | yes | 0 | – | remove |
| `p1/ron-m3` | agent-a7f5c9b0beae2e6df (232 MB) | 78d2337 | yes | 0 | – | remove |
| `p1/ron-m3c` | agent-acb8af0ea01a23f6b (286 MB) | 6a8ee7c | yes | 0 | – | remove (used read-only for the m3 bundle comparison below) |
| `p1/ron-pwa` | agent-a53dd06bd8122e008 (287 MB) | 07b91d1 | yes | 0 | – | remove |
| `p3/gorge-plan` | agent-a54615f2a676d871f (3 MB) | 7437fe7 | yes | 0 | – | remove |
| `map/vc-1-rebased` | `../pascaline-map-rebased` (274 MB) | f662526 | yes | 0 | – | remove |
| `p1/ron-m3b` | – | b559582 | yes | 0 | – | remove |
| 19 × `worktree-agent-<id>` (the Agent tool's own branches; their worktrees now hold `p1/*` branches) | – | 28068b6 (18), b4431ae (1) | yes | 0 | – | remove |
| `p1/annabell-haptics` | agent-ad2db561b99a2ed3c (375 MB) | 94d0345 | no | 7, all `-` | – | remove (`-D`) |
| `p1/ron-fmt` | agent-abf5af66545dbaec9 (13 MB) | 59de356 | no | 6, all `-` | `app/node_modules` (symlink) | remove (`-D`) |
| `p1/ron-p4` | agent-a54f3969c8ed8100c (242 MB) | 7ec4064 | no | 4, all `-` | – | remove (`-D`) |
| `p1/ron-p4b` | agent-ac2ea393ce1a157e5 (13 MB) | cfe4762 | no | 5, all `-` | `app/node_modules` (symlink), 10 scratch logs from 10-11 (`e2e1-3.log`, `g-*.log`, `size.log`, `tc.log`, `vt.log`; test output, nothing to keep) | remove (`-D`) |
| `p3/annabell-qalc` | agent-aa4795d13967a7269 (3 MB) | 35dac30 | no | 7, all `-` | – | remove (`-D`) |
| `p3/gorge-qalc` | agent-abdf38e4d538f57b3 (3 MB) | 6eedab3 | no | 6, all `-` | – | remove (`-D`) |
| `p1/gorge-m3` | agent-a34da427b609ba0bc (3 MB) | 75e79af | no | 1, `-` | – | remove (`-D`); see F2 |
| `map/vc-1` | `../pascaline-map` (261 MB) | d362296 | no | 4: 2 `-`, 2 `+` | – | remove (`-D`); see F3 |
| `p1/annabell-icon` | agent-afceb6f306df83a24 (380 MB) | be84510 | no | 1, `+` | – | remove (`-D`); see F4 |
| `refs/original/refs/heads/phase-1` | – | a17c1b9 | no | 15 | – | remove (`git update-ref -d`); see F1 |

### Findings

- **F1. Seven refs still hold the e-mail address that the 2026-10-11 rewrite took out of commit messages.** It is in one commit, the old merge 632dab4 (searched with `git log <ref> --grep`; the address isn't printed here).
  - It is reachable from `refs/original/refs/heads/phase-1` (the filter-branch backup, tree identical per `.coord/log.md:224`) and from the six pre-rewrite branches `p1/annabell-haptics`, `p1/ron-fmt`, `p1/ron-p4`, `p1/ron-p4b`, `p3/annabell-qalc`, `p3/gorge-qalc`.
  - `phase-1`, `master` and `origin/phase-1` have 0 matches.
  - Deleting those refs removes it from every branch. The objects stay in the reflog until it expires (90 days by default) or until `git reflog expire --expire-unreachable=now --all && git gc --prune=now` runs. That step can't be undone, so it's yours to choose.
- **F2. The backlog's "Branches and worktrees" note is out of date** (`docs/backlog.md:46`). It says three worktrees are left and that `p1/gorge-m3` must stay "until gorge has cherry-picked it". Actually there are 19 worktrees plus 2 sibling checkouts, and `git cherry` shows 75e79af as already in `phase-1`. After the removal the note can say only "none left".
- **F3. `map/vc-1` is fully in `phase-1` in its rebased form.**
  - `git range-diff` pairs all 4 commits with `map/vc-1-rebased` (merged in 5c101da).
  - Two are identical (`=`). The other two (`!`) differ only in the conflict resolution recorded at `.coord/log.md:198`: the `enter` line in `keyboard.yaml` keeps our Python block, and the G2 checklist was regenerated. The rebased side is a superset (it also lists `l6-root-0x` and items 26–27).
- **F4. `p1/annabell-icon` (be84510) is the only unique commit, and 8ff8576 replaced it** with icons from `logo/` (your choice in area B). Its `art/icon/` SVGs are not in `phase-1` (`git ls-tree -r phase-1 art/` is empty). After the branch is deleted, the commit can still be reached through the reflog until it expires.
- **F5. Four worktrees need `--force` to remove.**
  - What makes them unclean:
    - `app/node_modules` is a **symlink to the main checkout's `app/node_modules`** in three of them (`ls -ld`);
    - `tools/__pycache__/` in the fourth;
    - the logs above.
  - `.gitignore:4` is `node_modules/`, which doesn't match a symlink, so git reports the link as untracked.
  - To be safe, delete the link first (`rm <wt>/app/node_modules`, with no trailing slash) and then remove the worktree.
  - Nothing ignores `__pycache__/`, so `python3 tools/…` leaves it as untracked anywhere. A small `.gitignore` fix covers both: `node_modules` without the slash, and `__pycache__/`.
- **F6. History (informational; no rewrite proposed).**
  - `git count-objects -vH`: 2430 loose objects, 11.48 MiB, **0 packs**. `.git` is 15 MB, with 261 commits on all refs.
  - A plain `git gc` would pack them. It is safe because it keeps everything that's still reachable or in the reflog.
  - Tracked today: 301 files, 1.76 MB. The largest are `app/package-lock.json` (98 kB), `docs/02-architecture-plan.md` (41 kB) and `spec/mapping/vc-2026-10-11/home.yaml` (39 kB).
  - Two generated files exist only in history:
    - `spike/python/_out/standard/micropython.mjs` (240 kB, added 9c7b3f2, untracked again in 79736c1);
    - `android/gradle/wrapper/gradle-wrapper.jar` (44 kB, added e798ef8, dropped in 5b3b091, now in `.gitignore:60`).

    Both are reachable from `master`, so they are on GitHub. F-Droid scans the source tree at the build tag, not the history, so neither matters for the build.
  - Generated `package-lock.json` files from the archived spikes stay in history (84 kB at most).

### Disk

The checkout is 5.3 GB on disk. The ignored paths (`git status --ignored`, `du`):

| Path | Size | Safe to delete? | How to get it back |
|---|---|---|---|
| `.claude/worktrees/` (19) | 4 027 MB | **yes, through the removal above** (`git worktree remove`, not `rm`) | n/a |
| `../pascaline-map`, `../pascaline-map-rebased` | 261 + 274 MB | **yes, the same way** | n/a |
| `engine/giac/_build/` | 561 MB | yes, but the next engine build is a clean ≈5 min one (CLAUDE.md) | `engine/giac/build-wasm.sh` |
| `app/node_modules/` | 261 MB | no (daily use; three worktrees link to it) | `npm ci` in `app/` |
| `engine/giac/_downloads/` | 242 MB | **no** (CLAUDE.md never-delete rule) | – |
| `python/_downloads/` | 154 MB (`micropython-1.29.0.tar.xz`) | keep. It's the same kind of SHA-checked tarball cache as Giac's, though the never-delete rule doesn't name it. | `python/build-micropython.sh` downloads it again |
| `spike/prebuilt/` | 32 MB | **no** (never-delete) | – |
| `tests/golden/.venv/` | 23 MB | no (oracle) | the pip line in CLAUDE.md |
| `engine/giac/_out/` | 19 MB (`gsl` 9.4, `base` 9.2) | `base/` yes (comparisons only); `gsl/` no (the current dev engine, `GIAC_OUT`) | `WITH_GSL=0 engine/giac/build-wasm.sh fetch giac link` |
| `app/dist/` | 13 MB | yes | `npm run build` |
| `app/public/engine/`, `app/public/python/` | 10 + 0.7 MB | yes | `npm run engine:copy` (part of `dev` and `build`) |
| `.coord/` | 2.3 MB | no (shift log, device runs, locks; cited by the docs) | – |
| `python/_out/` | 1.5 MB | no (`PYTHON_OUT`) | `python/build-micropython.sh` |

There is no Android build output in the checkout: no `android/app/build`, `android/.gradle` or `dist/`. `build.sh` works on scratch copies.

**Recommendation:** the branch and worktree removal frees **≈4.6 GB**, which is nearly everything that's worth freeing. Deleting `_build/` gains another 561 MB at the cost of one slower engine build. Leave everything else.

### Performance budget

`npm run build` on `phase-1` (27f8378), the same as in area A:

| Chunk | Raw | Gzip | Loaded |
|---|---|---|---|
| `index-*.js` (start) | **139.12 kB** | 48.28 kB | at start, the only `<script>` in `dist/index.html`, no preloads |
| `index-*.css` | 25.49 kB | 8.95 kB | at start |
| `mathlive.min-*.js` | 807.73 kB | 222.09 kB | later, `import()` in the start chunk |
| `src-*.js` (JSXGraph) | 1 035.31 kB | 258.52 kB | only from the Function chunk |
| `python-*.js` | 377.18 kB | 127.99 kB | only when Python opens |
| `function` / `solve` / `SlotList` | 19.60 / 8.24 / 4.26 kB | | on demand |

**Trend of the start chunk:** 94 kB at milestone 1 (`docs/shifts/2026-10-11-report.md:64`), 108 kB at m2 (`m2-report.md:17`), 115 kB at m3 (`m3-report.md:26`; 116.59 kB rebuilt today from 6a8ee7c), **139 kB now**.

The growth since the last device measurement is **+22.6 kB (+19 %)**. Per module (m3 → now, raw bytes from the source maps):
- `@capacitor/core` +7.8 kB (new in the start chunk, imported by `app/src/input/haptics.ts:5`);
- `src/state` +4.8 kB (the Format key's `displayMode.ts`, `session.svelte.ts` +147 lines);
- `src/engine` +1.5 kB;
- `spec/keyboard.yaml` +1.3 kB (P4 layout, inlined);
- views, input, keyboard, i18n, entry and `App.svelte` about +1 kB each;
- the polyfills +0.5 kB.

The Svelte runtime is the largest part (42 kB) and didn't change.

- **F7. The bars are probably not broken, but nobody has measured since m3.**
  - The bars are device timings on the Tab One: keyboard usable 662 ms (bar 1 s) and engine ready 995 ms (bar 1.5 s), both from m3 builds (`docs/backlog.md:24`).
  - Since then the start chunk grew 19 %, and nobody has measured on a device. Desktop marks aren't comparable to those numbers, and this pass doesn't do device runs. **Could not tell** what the device effect is.
  - Recommendation: in the next device session, re-run `tools/device_run.py start --mode cold --runs 7` on the Tab One.
  - The one cheap cut is to load `@capacitor/core` only on the native build. `haptics.ts` uses it only when `Capacitor.isNativePlatform()` is true. That saves about 7.8 kB raw. Add it as a note under L7, not as a task, unless the device numbers drop.
- **F8. Small bug: `app/vite-plugin-pwa-lite.ts:24` builds the output path as `join(c.root, c.build.outDir)`.** An absolute `--outDir` therefore points into `app/<absolute path>`, and `closeBundle` fails with ENOENT after the chunks are written. That's what made the scratchpad build exit 1. `npm run build` isn't affected (it uses the default `dist`). The fix is `resolve` instead of `join`. Regression test: build with an absolute `outDir`.

### Recommendation for F

Phase 2, if you approve:
1. **Remove all 19 worktrees under `.claude/worktrees/`, both sibling checkouts, and every branch except `phase-1` and `master`.** That's 41 branches plus `refs/original`. Keep the tags and remote refs. Commands, as you'd run them:
   ```bash
   rm .claude/worktrees/{agent-a61d3383129f9422b,agent-abf5af66545dbaec9,agent-ac2ea393ce1a157e5}/app/node_modules   # symlinks only, no trailing slash
   for w in .claude/worktrees/agent-*; do git worktree remove --force "$w"; done
   git worktree remove ../pascaline-map && git worktree remove ../pascaline-map-rebased
   git branch -d <the 32 merged branches>          # ancestors of phase-1
   git branch -D p1/annabell-haptics p1/ron-fmt p1/ron-p4 p1/ron-p4b p3/annabell-qalc p3/gorge-qalc p1/gorge-m3 map/vc-1 p1/annabell-icon
   git update-ref -d refs/original/refs/heads/phase-1
   git worktree prune
   ```
   `-D` is needed for the 9 branches that aren't ancestors of `phase-1`: 8 whose commits are already in it as rebased or cherry-picked copies, plus `p1/annabell-icon`. `rules.md` section 3 forbids `-D` for the shift agents; here it would run with your explicit OK.
2. **Optional:** `git reflog expire --expire-unreachable=now --all && git gc --prune=now`, only if you want the old e-mail commit (F1) and be84510 out of the local object store now. It can't be undone. Otherwise run a plain `git gc`, which is safe and packs the 2430 loose objects.
3. **Small commits** (later, with area G):
   - `docs/backlog.md:46`: the worktree note becomes "none left" (F2), and L7 gets the trend and the Capacitor note (F7);
   - `.gitignore`: `node_modules` and `__pycache__/` (F5);
   - `fix(build)`: `resolve` in the PWA plugin, with its test (F8).
4. **Not now:** deleting `_build/` (561 MB) is fine whenever disk is tight.

### F, phase 2 (approved 2026-10-12: "yes to all your recommendations")

- **The user runs the removal from a command list.** It covers: the 19 worktrees, the 2 sibling checkouts, 32 branches with `-d`, 9 with `-D`, `refs/original`, then `reflog expire` plus `gc --prune=now` to take 632dab4 out of the local object store. Before the list was handed over, no process had its working directory inside a worktree (`/proc/*/cwd`), and no worktree was locked.
- **Where the address came from:** a hand-written `Signed-off-by:` line in 632dab4. `git config user.email` (`~/.gitconfig`) holds the current address, and no author or committer field on any ref has the old one. No file in any commit on any ref contains it (`git grep` over `git rev-list --all`).
- **Remote:** `git ls-remote origin` shows four tips (master, phase-1 at 759060e, HEAD, a tag), and none of them contains 632dab4. GitHub may still serve the commit by its SHA, since it was pushed before the 2026-10-11 force-push (`.coord/log.md:222`). Only a GitHub Support request removes that.
- **Kept from coming back:** local `commit-msg` and `pre-commit` hooks in `.git/hooks/` (not committed; worktrees share them) reject the address in a message or a staged change.
- **The removal is done** (checked afterwards):
  - `git worktree list` shows only the main checkout; `git branch` shows `master` and `phase-1`; 7 refs are left (2 branches, 3 remote-tracking, 2 tags);
  - `git cat-file -t 632dab4` gives "Not a valid object name", and `git log --all --format=%B | grep -ci <old domain>` gives 0;
  - the checkout went from 5.3 GB to 1.3 GB and `.git` from 15 MB to 1.7 MB (1 pack, 1.37 MiB);
  - `.coord/log.md` still names the old domain 3 times, but never the full address.
- **The small fixes**, committed with this report:
  - F8, regression test first: `app/src/pwaLite.test.ts` failed 2/2 on `join`, then passed 2/2 with `resolve`. The absolute-`--outDir` build now exits 0 and writes `sw.js`.
  - F5: `.gitignore` has `node_modules` without the slash and `__pycache__/`; `git check-ignore -v` confirms both.
  - F2 and F7: `docs/backlog.md` "Branches and worktrees" now says "none left", and L7 records the trend and the Capacitor note.
- **Baseline, before (area A / D) → after:**
  - typecheck: 0 errors over 504 → 506 files;
  - Vitest: 316 → 318 passed (the 2 new tests);
  - e2e: 68 + 1 skipped → 69 + 1 skipped (the extra one is the K0 test from `f3b7d45`);
  - `test:pwa`: 1/1;
  - golden: unchanged and PASSED (interrupt 16, Home 123, Solve 42, Function 25, bench 14/55, parser 324/326, python 22);
  - build: start chunk 139.12 kB, as before.

  Logs: `scratchpad/phase2F/`.

## G. Build reproducibility

What was run:
- a sonnet sweep over `build.sh`, `engine/giac/*.sh`, `python/*.sh`, the smoke scripts and `tools/*`: every path each script reads, the external commands, and every parsed flag and env var, with `test -e`, `git check-ignore -v`, `command -v` and `git grep`;
- a haiku sweep of the references to each `tools/` script;
- my own hash comparison (`sha256sum` of the cached tarballs and the Gradle zip against the scripts and `THIRD_PARTY.md`).

I re-checked every DELETE candidate (`git ls-files | grep wasmstart`, the scripts' headers, the agent and skill files).

- **G1. `tools/probe-wasm.py` can't run: its page is gone.**
  - It opens `/wasmstart.html` (`probe-wasm.py:16`). That page lived in `spike/app/public/` and went with the archive (8f95cef). `git ls-files | grep -i wasmstart` finds nothing.
  - No script calls it. Only `tools/README.md:21` and `docs/research/r2-wasm-start.md:8` cite it. R2 is finished (the research note has the numbers).
  - Risk: none; git history keeps it. Effort S.
  - **DELETE**, and point the README and the R2 note line at `git show 8f95cef^:tools/probe-wasm.py`.
- **G2. `page-series.py`, `shots.py` and `tap-seq.py` have no caller in code, but they are documented helpers** (`tools/README.md:18-20`) of the device workflow:
  - `tap-seq.py` is the K0 system-keyboard check that's still open in the backlog;
  - `page-series.py` gave the m3 series (`docs/shifts/2026-10-11-m3-report.md:50`).

  **KEEP**, with two **FIX**es (effort S):
  - (a) the Tab One serial is hard-coded (`page-series.py:14`, `shots.py:7`, `tap-seq.py:7`). `device_run.py:18` reads `ANDROID_SERIAL` with the same default. So `ANDROID_SERIAL=<S8+> page-series.py …` measures on the S8+ through `device_run.py` while it checks the **Tab One's** battery and temperature (`page-series.py:14,19`). That's a real bug for S8+ series.
  - (b) `page-series.py:25` writes to an absolute `/home/nordmu/…/.coord/device-runs.jsonl`. `device_run.py:24` uses `PASCALINE_COORD` or the repo's `.coord/`.
- **G3. `device_run.py` has stale text and dead knobs.**
  - Its docstring says "the Pascaline spike shell … on one tablet" (`device_run.py:3`).
  - `tools/README.md` doesn't list its `status` subcommand.
  - Four env vars are read but set or documented nowhere: `APK` and `APP_APK` (`:106`, two names for one thing), `PAGE_PATH` (`:117`; its comment cites the spike experiment `/?wasmcache=1`, and the `page` subcommand covers the use) and `BENCH_PATH` (`:177`).
  - Effort S. **FIX:** update the docstring; drop `APP_APK` and `PAGE_PATH`; document `APK` and `BENCH_PATH` in the docstring; add `status` to the README.
- **G4. All pinned hashes match. THIRD_PARTY.md lacks three of them.**
  - The tarball caches match their scripts:
    - Giac `1d9536e0`, GMP `a3c2b802`, MPFR `b67ba038` and GSL `6a99eeed` (`engine/giac/build-wasm.sh:28-43`);
    - MicroPython `d925a7c6` (`python/build-micropython.sh:25`);
    - the Gradle zip `bd711022` (`build.sh:83`).
  - The trixie image digest is the same in both container scripts and THIRD_PARTY.md:33. Giac, MicroPython, Gradle, libqalculate and libxml2 appear in THIRD_PARTY.md with matching prefix and suffix.
  - GMP, MPFR and GSL (`THIRD_PARTY.md:11-13`) only say "GPG signature checked", although the script pins a SHA-256 for each.
  - Effort S. **FIX:** add the three hashes so THIRD_PARTY.md and the scripts say the same.
- **G5. "F-Droid uses build.sh" is wrong in two places.**
  - `build.sh:3` says "F-Droid and CI use this script", and CLAUDE.md:71 says "`build.sh` (clean source → APK, used by F-Droid)".
  - `fdroid/README.md:6-7` explains that the recipe runs the steps itself, because the F-Droid VM can't nest the container (`fdroid/org.pascaline.app.yml:27-37`). There is no CI.
  - Effort S. **FIX:** the two phrases ("the F-Droid recipe mirrors these steps, see fdroid/README.md"). The CLAUDE.md line needs your OK.
- **G6. Flags and env vars: nothing else is dead.** Every flag or env var the scripts parse is either passed by a caller or documented in the script's own header: for example `build.sh:5-16` (`--python-dir`, `NO_LOCK`), `build-wasm-release.sh:7`, `build-micropython.sh:9-10`, and `device-build.sh:5` (`--serial`, `--no-python`). These are deliberate options. **KEEP.** CLAUDE.md:110 omits `--python-dir`; that's fine, since CLAUDE.md stays short.
- **G7. Paths and commands exist.**
  - Of 61 paths checked, all exist except the outputs the scripts create themselves (APKs, `dist/`, `android/_keys/`, `engine/giac/_out/release/`) and `wasmstart.html` (G1).
  - Every external command is installed. `emcc` and friends are on PATH only after `build-wasm.sh:62` sources `emsdk_env.sh`, which is by design (CLAUDE.md "Commands").
  - **KEEP.**
- **G8. The agent files still send the shift team to `brief.md` sections that moved to `rules.md`.**
  - `.claude/agents/ron.md:12`, `annabell.md:12` and `gorge.md:12` say "Read `docs/shifts/brief.md` sections 1–6".
  - `henri.md:8,11` says "Read docs/shifts/brief.md in full … starting with section 4".
  - Since `0e2a731` those sections live in `docs/shifts/rules.md`, with the same numbers. The stub brief points there, so it works with one extra hop.
  - Effort S. **FIX:** "Read `docs/shifts/rules.md` (sections 1, 3–6) and the shift's `brief.md`". `henri.md` starts at rules.md section 4.
- **G9. `.claude/skills/phase-0-spike/SKILL.md` is obsolete.**
  - Phase 0 ended with GO on 2026-10-11.
  - Six paths it cites no longer exist (`spike/app`, `spike/bench/cases.yaml`, `spike/home/cases.yaml`, `spike/serializer/cases.yaml` and others; `test -e`).
  - Its description triggers on "phase 0 or the spike", so a request about the P3 qalc spike could load it.
  - Risk: none; git history keeps it. Effort S. **DELETE.**

## Needs the user

Only real decisions:
1. **E3:** does `hpprime` stay as the Python import name? Recommendation: yes, as the import name only, plus one line in CLAUDE.md "Legal / clean room" stating the compatibility exception (now only in `rules.md:15`). Decide together with P6.
2. **One yes for the "now" batch** (E1, E6, G1–G5, G8, G9). It includes two CLAUDE.md edits: the G5 phrase, and the E3 line if you say yes to E3.
3. **Optional, only you can do it:** ask GitHub Support to remove commit `632dab4460105e35ef1927ef79b42bde17f71089` from `buerlino/pascaline`, together with its cached views (F1). No branch on GitHub contains it (`git ls-remote origin`).
4. **Still open from earlier, for reference:** P6 and P7 in `docs/decisions.md`, the K0 device check, and the real-G2 spot check (backlog "Needs the user").

## Could not check

- **Device effects:** the start-chunk growth (F7) and dropping INTERNET (E2). This pass doesn't do device runs.
- **Gradle after E1/E6:** not built in phase 1 (no app build beyond `vite build`). Phase 2 checks it with one `build.sh` run that reuses the existing engine.
- **The container release builds** (`build-wasm-release.sh`, `build-micropython.sh release`) weren't run, because this pass does no engine builds. Their pins were checked statically (G4).
- **Paths inside the tarballs and containers** (`/src`, `/dl`, `/w`, Giac's `src/*.cc`): the sonnet sweep marked them "could not tell".
- **Whether GitHub still serves 632dab4 by SHA:** that needs a GitHub web check, which I didn't do.
- **The cause of the B13 flake:** it showed up once.

## Sweeps delegated

| Sweep | Model | Checked by Opus |
|---|---|---|
| A: baseline test runs, timings, prerequisites | sonnet | every count and exit code against the raw logs; `git status`/`git log`/`npm audit` rerun |
| B: markers, type escapes, SPDX headers | haiku | the `as any` hit read in place; the SPDX miss shown with `head`; TODO/FIXME/HACK/XXX rerun over the whole repo (0) |
| B: global CSS usage | haiku | accepted; it agrees with svelte-check's 0 warnings |
| B: commented-out code | sonnet | my own grep for commented statements over app/, python/ and tools/ (0) |
| B: dependencies vs THIRD_PARTY.md, licences, spike deps | sonnet | the 3 THIRD_PARTY misses checked with `grep` and `npm ls`; runtime imports checked in node_modules dist files (tslib not bundled) |
| B: knip, options, duplicates, engine/UI boundary | done by Opus | n/a |
| C: references to each spike folder from outside and inside spike | haiku | the brief's named dependencies re-checked by my own `git grep -i spike` over the code areas; `homeEval.ts:81` and the NOTES.md it cites read in place |
| C: spike binaries vs RESULTS.md and .gitignore | sonnet | 3 `git check-ignore -v` re-run, tracked-binary count re-run (0), RESULTS.md L148-156 read |
| C: script runs, coverage comparisons, classification | done by Opus | n/a |
| D: line citations; commands, flags, env vars and npm scripts in CLAUDE.md and 9 READMEs | sonnet | the "0 citations" result re-grepped; the patch loop (`build-wasm.sh:164`) and the golden-README count mismatch checked myself |
| D: path-exists script, golden counts, status vs code, duplicates, backlog, phase 2 edits | done by Opus | n/a |
| F: refs/worktrees table, `git cherry`/`range-diff`, history blobs, `du`, bundle builds and the source-map attribution | done by Opus (scripts) | n/a; each result is a git/du/build command's output, so no subagent was used |
| E: "HP"/"Prime" grep, network-use grep, Android permissions and Google terms | haiku | every network hit read in place (`sw.js:32,43`); the `hpprime` hits and README/fastlane disclaimers opened; the Gradle plugin lines and the manifest read; F-Droid handling looked up in `../fdroiddata` myself |
| G: references to each `tools/` script | haiku | `wasmstart.html` absence re-run (`git ls-files`, `git grep`); the agent-file references grepped myself (the sweep reported none; they exist, G8) |
| G: paths, commands, flags and env vars in the build scripts and tools | sonnet | every "unused" flag checked against the script headers (all but the four `device_run.py` env vars are documented); the hard-coded serials and the absolute path grepped; hashes done by Opus with `sha256sum` |
