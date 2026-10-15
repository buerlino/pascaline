<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Architecture check after milestone 4a's entry work (sandra, 2026-10-15)

**Base:** `phase-1` at 3aa1a66, plus the Opus pass's docs commit 5a582b1, which landed during the check. Scope: R22–R31 and R42 against docs/04 and r6. The questions were: (1) drift between the code and the docs, (2) the key-press, ⌫ and cursor paths, (3) numbers shown without their mark, (4) the engine and Find boundaries, (5) risks to milestone 5.

**The answer in short:**
- The architecture holds. Nothing outside `app/src/engine/` calls Giac, Cancel and a crash both restart and replay, and the size test passes. Every numeric result in Home, CAS, Solve and Function gets its mark.
- **Two silent wrong answers** are left. A symbolic result with a float in it is unmarked (F36), and a result too long for a chip comes back as rounded digits marked `=` and loses Ans (F37).
- **The entry has one written ⌫ rule but three code definitions of "a box"**, and hardware keys take a second path (F38). The next packages R43, R4a and R24c would each add another copy.
- There are three small packages for the owner's yes (G27, R44, R45). Two package texts were corrected (R43, R24a/R24c).

## What I verified, and how

### (4) Engine and Find boundaries
- **The UI never calls Giac:** `grep` for `giac.eval` and for imports of `host`, `homeEval`, `nodeGiac`, `numeric`, `solve` and `analysis` outside `app/src/engine/`. Only `calc/engine.ts` and `calc/fake.ts` import from `homeEval.ts`, and they take a constant and a helper. The start chunk contains none of `pasans`, `toExactLiterals` or `regroup` (grep of the built chunk), so no engine code ships in it.
- **Cancellable workers:** `WorkerEngine.cancel()` terminates the worker, rejects everything pending and starts a new worker with the definitions log as `init.replay` (`workerEngine.ts:186-224`). A worker crash takes the same path (`onerror`). Still open and already packaged: the crash loop (F31, G19) and the memory cap (F32, G24).
- **Start-up budgets** (`npx vite build --outDir <scratch>`, then `node scripts/size-check.ts <scratch>`):

  | Chunk | Raw | gzip | Budget |
  |---|---|---|---|
  | Start chunk | 151.94 kB | 53.01 kB | 156 / 54 kB (0.99 kB gzip left) |
  | MathLive | 807.74 kB | — | — |
  | Precache | 12.3 MB | — | — |

  R35 has to come before R21a, as the brief already orders. The device bars were last measured on 2026-10-12; A4a measures them again.
- **Find:** the generated index is 325.7 kB raw and 67.1 kB gzip, with 1,850 items, 435 units (399 with `si`, 434 with `dim`) and 69 constants. The budget is 400 / 100. `rank.ts` runs on the main thread. There is no UI yet and no load hook yet (R4a).

### (3) Numbers shown without their mark
I extended `tools/probes/engine.ts` with `FACTS=1`, which prints the mark facts as `markOf` reads them. Values come from the mpmath oracle (`tests/golden/.venv`, 40 digits).

| Case | What happens today | Right value | Package |
|---|---|---|---|
| **F36:** Home and CAS `evalf(x+sin(10^22))` | Shows `x-0.54764225985` with no mark: `exactRational: false`, `reliableDigits: null`, no `warn`, so `markOf` returns nothing. `evalf(x^2-2=0)` shows `x^2-2.0=0.0` and `evalf([1/3,x])` shows `[0.333333333333,x]`, both unmarked. | x − 0.8522008497671888… (`oracle`), so every digit shown is wrong | G27 |
| **F37:** Home `2^10000` (display `1.99506311688E3010`, right) | The exact text has 3,011 digits. `session.svelte.ts:446` keeps `r.exact ?? r.full` only when it is ≤ 2 kB, so the item gets no chip. Tapping the result inserts the drawn LaTeX, which the parser reads as `1.99506311688*10^3010`. `×1` then shows `= 1.99506311688E3010`, marked exact. `homeEval.ts:485` already puts the right P-digit value in `r.full`. After it, `+3` on the empty line gives `= 3`: `lastChip()` returns nothing, so no `\ans` goes in, and the parser reads `+3` as 3. | 2^10000 = 1.995063116880758…E3010 (`oracle`), and Ans + 3 | R44 |

Checked and fine:
- A numeric CAS float carries `numeric` with its facts. `fsolve(x^3=2,x)` gets `⚠` (unaudited).
- Solve, Num and the Function readouts show only `⚠`, by design (`calc/shown.ts`).
- Lists up to 400 items get element marks. Longer ones come back as Giac's exact text, which has no float in it.

The Opus pass's F35 (an undecided closed `==` test shows `= 0`) is a third case of the same kind. It is now docs/04 2.3 #19 (R18f3).

### (2) Key-press, ⌫ and cursor paths: one rule or many special cases
**The rule is one:** decisions.md "⌫ and Del keep a template whole", points 1–8. **The code has several models:**
- **`delete.ts` (1,105 lines)** dispatches to one uniform model, `BoxTemplate` (boxes, main, arg, joins, gaps, open). That model covers ten template kinds, each found by a recogniser keyed on MathLive's atom LaTeX. Beside it run the older `Template` (bracket pairs, R23) and `Power` (exponents, R26d), plus three fallbacks: `stepIn`, `keepBox` and `inLogBase`.
- **What a box is** is written three times: in `delete.ts` (`startsBox`, `endsBox` at line 1013), in `stops.ts` (`isStop`, with its own regexes; it shares only `NAME`), and in `nextBox` (any `\placeholder` ahead, which is the cause of F34).
- **R43's package text** proposed a fourth test. That test misses the boxes that end at a mark (EQ's comma, DMS's ° and ′), which `endsBox()` handles.
- **The term before the cursor** is scanned five times: `selectENumber`, `selectCompound`, `selectChip`, `afterDigit` and hwkeys' `afterNumber`.
- **`EntryController.run` has ten branches** in front of MathLive (`controller.ts:276-326`).
- **Hardware keys take two paths:**
  - Digits, operators and `e` go through `press()`.
  - Backspace, Delete and letters call `entry.run` directly (`hwkeys.ts:128-131`, `:149`).
  - The arrow keys are not caught at all (`hwkeys.ts:133`), so they use MathLive's own steps. Those steps stop between sin and its bracket, have no ▶ jump, and ▲ picks no history row.
- **Tests:** the ⌫ grid reads every template from `spec/keyboard.yaml`. The cursor has no grid, which is how F34 got through.

What would break or duplicate in the later packages:

| Package | Effect |
|---|---|
| **R43** | Would add the fourth box test. Fixed in its text: it uses `endsBox()`, moves the box model to `entry/boxes.ts`, and adds a cursor grid. |
| **R21a** | No entry effect. The 0.99 kB start-chunk margin is the constraint (R35 first). |
| **R15b** | The arrows and the trackpad go through `run`, so they are unaffected. The hwkeys key-id map uses ids R15b does not move, and `hwkeys.spec.ts` covers them. |
| **R4a** | Find takes letters, so hardware letters must go through `press()` (R45 first). |
| **R24a–d** | See (5). |

### (5) Milestone 5 (P15, the unit evaluator on Giac)
- **The MathLive prompt check is done.** It was the open "to verify" item of r7 section 8, and R24a's step 1. I ran a throwaway Playwright probe (Pixel 7 profile, MathLive 0.111.1), then deleted it.
  - `setPromptValue` takes `\frac{\mathrm{km}}{\mathrm{h}}`, `\mathrm{m}^{2}`, a product, `\sqrt{…}` and a prefixed unit, and `getPromptValue` gives each back.
  - In a read-only field, `moveToNextChar` goes from prompt to prompt (u1 → u2 → end) and never into the formula.
  - **Trap 1:** `insert()` with the caret outside a prompt still edits the read-only formula (`72` became `972`).
  - **Trap 2:** neighbouring upright names merge when a prompt is read back (`\mathrm{k}\mathrm{\Omega}` → `\mathrm{k\Omega}`).
  - **Consequences:** R24a's token list is the only source of a slot, and R24c writes slots only through `setPromptValue`, never through `EntryController.run`. Its field also needs its own hardware-key capture. I wrote these into R24a, R24c, docs/04 4.3 and 5.5.
- **G15 is running** (worktree `m5-g15`, nothing committed yet). Until it merges, docs/04 section 4, 6.1, 8.x, Appendix C and CLAUDE.md's "Worker 3: libqalculate" line still describe the qalc worker. I added a P15 pointer to docs/04. The full rewrite comes with G15's merge, whose package already lists the files.

## What I changed

**docs/04-architecture.md**
- Header: the re-check note.
- Section 0, item 1: the `⚠` rule for a non-number with a float. Item 10: the P15 pointer.
- 1.2: the "today" cells brought up to date (keyboard, entry, parser, engine, Home, formatter, history, CAS, PWA, build).
- 2.1: a note that the table is dated before the marks, plus the reuse paragraph dated.
- 2.3: new rows #17 (F36), #18 (F37) and #19 (F35).
- 2.4: non-numbers with a float are `⚠`; rule 4 (`tieRisk`) marked not built and not needed. 2.9 made consistent with 2.4.
- 3.1 and 3.3: today's state and index size.
- Section 4: the P15 header. 4.3: the prompt check's result.
- **New 5.5:** the entry line, one key path and one box model.
- 8.2: `warn` added. 8.3: start chunk, index, precache and the qalc row; the unit-view size rule's path mismatch.
- Section 9: risk 6. Appendix C: the prompt rows.

**docs/research/r6-pipelines.md**
- Sections 1–4 rewritten. They still described the Python app, results inserted as rounded digits, definitions that were not stored, digits ≤ 15 and the 2026-10-12 sizes.
- Section 7: the prompt behaviour.
- Section 8: the 2026-10-15 drift list.
- Section 9: the probe's `FACTS=1`.

**docs/shifts/brief.md**
- New packages G27, R44 and R45: path lines, 0f table rows, and texts in section 7. Each starts only after the owner's yes.
- R43: reading list, fix direction (`endsBox()`, `entry/boxes.ts`), and the EQ and DMS tests plus the cursor grid.
- R24a step 1: done, with its consequences.
- R24c: `setPromptValue` only, key capture.

**docs/decisions.md:** "Needs the user": the entry for the three packages.

**docs/backlog.md:** "Needs the user" item 4, and "Trust and robustness" items 23–25.

**tools/probes/engine.ts and README:** `FACTS=1`.

Code: none. Commits: none.

## Still to verify (who checks it, and how)

| Item | Who | How |
|---|---|---|
| ▶ at the end of ½ inside `EQ(½,□)` and `½°□′□″`: the plain end-of-box test jumps, `endsBox()` stops | ron | R43's tests |
| With a sheet open, does a hardware letter type into the line behind it? | ron | R45's first test |
| How tall a stacked unit draws inside a prompt | ron | R24c's gallery at 360 × 740 |
| A units request in the Giac worker keeps Home's mode cache, Ans and the user's variables intact | gorge | G16's tests (as `keepingAns` does for Solve) |
| The `⚠` on symbolic results with floats is not noisy | owner | daily use after G27 |
| `app/scripts/size-check.ts:96` looks for `src/apps/units/`, but G16 and R24a write `app/src/units/` | the first package with a lazy chunk there (G16 or R24b), or A6 | point the rule at the new path |

## Top risks

1. **The entry's models drift apart** (docs/04 risk 6). F34 came from it. R43 (one box model and a cursor grid) and R45 (one key path) are the mitigation. MathLive upgrades must run both grids.
2. **The unit view's chain is long.** R24c waits for R24a ← G7 ← S5 (which waits for the owner's 10–20 most used units), for R24b ← S5 accepted + R21a, for R28 ← R24a + G16, and for G16 ← G15. **S5 is the head of the chain**, so the owner's unit list is the earliest lever.
3. **The start chunk has 0.99 kB gzip left.** R35 must land before R21a, as ordered. Any package that touches `App.svelte` or `main.ts` before R35 should check it.
4. **Under P15, qalc stays a build-time dependency** only for the index's values: a 7.5–8 min container build, plus libxml2 and libqalculate in the F-Droid recipe. This is worth a look after G15 merges: Giac could evaluate qalc's formula-defined constants from the XML at build time. Not a decision now.
5. **Docs say "qalc worker" until G15 merges.** A reader of docs/04 section 4 or CLAUDE.md alone would build the fallback. The pointer is in docs/04. CLAUDE.md is the owner's file, so I left it for G15's merge.

## For henri
Please review and commit (docs only, plus the probe option). The new packages wait for the owner's yes in decisions.md "Needs the user". The R43 amendment matters before R43 starts.
