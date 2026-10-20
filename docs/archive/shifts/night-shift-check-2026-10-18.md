# Master check of the night shift of 2026-10-18

**Status (2026-10-20): decided;** every finding is merged, in a package, or dropped (rules section 10: check reports go to the archive).

Written 2026-10-18 at 14:40, read-only, from `.coord/log.md`, `.tasks/night-2026-10-18.log`, `.tasks/archive/2026-10-18/*/` (bundles, check logs, run logs), `.tasks/pass-*/reply.md`, and the git history of `phase-1` in `.claude/worktrees/phase-1`. The shift ended at 14:18 (`SHIFT DONE`); nothing was running when the check started. Every claim is marked **verified** (I ran or read it) or **inferred** (taken from a log or a pass's reply that I did not reproduce).

## Verdict

**GOOD WITH FIXES.** Push `phase-1` (HEAD `26026e2`): **yes.** Every gate passes on HEAD, every merge commit is on the branch, nothing is left unmerged, and the fixes below are to the pipeline scripts and to bookkeeping, not to the code that was built. Before pushing, settle one thing with the other session that is editing docs on this machine (see "Open" at the end).

Gates run by me on `phase-1` `26026e2` at 14:22–14:27 (absolute `GIAC_OUT`, `PW_PORT=5277`, under the host-cpu lock; **verified**):

| Gate | Result |
|---|---|
| typecheck | 0 errors, 0 warnings (597 files) |
| vitest (`npm run index`, then `FIND_INDEX=required`) | 931 passed / 931, 56 files |
| golden gate | PASSED: home 158/158, precision 102/102 (1 pending), solve 54/54, function 28/28, bench 14/14, units 116/116 (p95 3.55 ms), parser 555/555 (2 known gaps) |
| e2e | 1018 passed, 1 skipped (4.4 min) |
| `oracle.py` | 7 files, 0 problems |

## Part 1: what was implemented

### The packages

Runs 3–25 of the pipeline, 8 Opus passes, 1 report. Every `MERGED` sha below is an ancestor of `phase-1` HEAD (**verified**, `git merge-base --is-ancestor`). Runs 3–5 (A6, G16, G17) and the owner's fix `1ac97d4` are already on `origin/phase-1`; the rest (73 commits) is not.

| Run | Id | Worker (model) | Outcome | Fix rounds | Audit (Sonnet) | Finding |
|---|---|---|---|---|---|---|
| 3 | A6 | annabell, review-only | MERGED `130c12f` | 1 (conflict `.gitignore`) | APPROVED r1 | ok; its own "Done when" (`npm run gate --quick` on phase-1) was not run by anyone (not verified) |
| 4 | G16 | gorge, review-only | MERGED `1bfd594` | 1 (conflict README table) | APPROVED r1 | ok; oracle 0 problems |
| 5 | G17 | gorge (Sonnet) | MERGED `a4496d5` | 0 | APPROVED r0 | 4 wrong or computed-not-refused numbers found by pass 1 → G17f1 |
| 6 | G17f1 | gorge (Sonnet) | MERGED `17fdfad` | 0 | APPROVED r0 | ok; `-1 K → °C` still computed → G18f1 |
| 7 | G18 | gorge (Sonnet) | MERGED `5b7e0d8` | 0 | APPROVED r0 | σ values right; 30-digit display for σ = 0, wrong refusal reason → G18f1 |
| 8 | G25 | gorge (Sonnet) | MERGED `d9b177a` | 1 (audit FIX, `dims.ts` text) | APPROVED r1 | `2 kN × 3 m` shown as 6 kJ → G25f1 |
| 9 | G18f1 | gorge (Sonnet) | MERGED `76e3eb6` | 0 | APPROVED r0 | ok |
| 10 | G25f1 | gorge (Sonnet) | MERGED `211f0db` | 0 | APPROVED r0 | ok |
| 11 | G13 | gorge (Sonnet) | MERGED `d08e955` | 0 | APPROVED r0 | ok; 13 CODATA overrides checked by pass 3 against NIST (inferred) |
| 12 | G22 | gorge (Sonnet) | MERGED `2da4017` | 1 (audit FIX) | APPROVED r1 | `why` missing for a stored float through the perturbation check → G22f1 |
| 13 | G23 | gorge (Sonnet) | MERGED `e1d24b9` | 1 (audit FIX) | APPROVED r1 | wall-clock test flaky, chip of a no-digit row drew a digit → G23f1 |
| 14 | R51 | ron (Opus) | MERGED `f970848` | 1 (audit FIX, duplicate case id) | APPROVED r1 | ok |
| 15 | G22f1 | gorge (Sonnet) | **NOT MERGED** | 2 | none (checks failed) | load flakes, see below |
| 16 | G23f1 | gorge (Sonnet) | MERGED `b5a2dfb` | 0 | APPROVED r0 | ok |
| 17 | R39 | ron (Opus) | MERGED `0f5ca8e` | 2 (audit FIX: CAS kept surd; then a timing test) | APPROVED r2 | ok; round 2 changed an unrelated timing test |
| 18 | G22f1 | gorge, review-only | MERGED `7556623` | 2 (conflict; audit FIX: no test for `once`) | APPROVED r2 | ok |
| 19 | R52 | ron (Sonnet) | MERGED `7c8c2c7` | 1 (audit FIX: lost `cannot plot:` prefix) | APPROVED r1 | ok |
| 20 | G14 | gorge (Sonnet) | MERGED `7635cfc` | 1 (golden failed: parser gate lacked `pasmod`) | APPROVED r1 | `x\bmod 3` = `x` marked `=` (silent wrong answer, older than G14) → G14f1 |
| 21 | G14f1 | gorge (Sonnet) | MERGED `9930ad6` | 0 | APPROVED r0 | ok |
| 22 | G26 | gorge (Opus) | MERGED `eb5eef2` | 1 (golden failed: units p95 6.16 ms under load; the fix round re-ran the same commit) | APPROVED r1 | ok |
| 23 | S4 | sandra (Opus) | MERGED `40c4bea` | 1 (audit FIX: report wording) | APPROVED r1 | ok, sections 1–5 present |
| 24 | S9 | sandra (Opus) | MERGED `027b4c8` | 0 | APPROVED r0 | ok, sections 1–4 present, 30 `file:line` citations |
| 25 | R50a | ron (Sonnet) | MERGED `08655e8` | 0 | APPROVED r0 | ok, nothing under `app/` |
| pass 1–8 | sofia (Opus) | | doc commits `5c2e23b 88af34b 249c9c4 cc352a8 c12ffe4 8535bc5 5a3f4b1 2c6017e` | | | see Part 2.3 |
| report | Sonnet | | `26026e2` | | | matches the log |

Queue steps 22, 23, 25, 26, 28, 29 (G7, R24a, R28, S7, S6, S8) were skipped because they wait for S5, which the owner holds uncommitted in the main checkout (**verified**: brief 0c table, pass 8 QUEUE).

### Spec against diff, for every merged package (**verified** by reading each `git diff <merge>^1 <merge>` against the bundle's `## Task`)

- **A6** (`app/scripts/gate.ts`, `gate-summary.ts` + 101-line test): what the spec names. The pipeline ran typecheck, vitest and e2e on it, not `npm run gate --quick`, which the spec's "Done when" asks; neither did I. Pass 1 found that `goldenPaths` in `gate.ts:65` and `scripts/pipeline.sh:237` do not list `app/src/units/`, so a units-only code change would skip the golden gate. Tonight every units package also changed `tests/golden/units.yaml`, so golden ran every time (**verified** in the run logs: `check golden: ok` on runs 5–10, 22). A6f1 (day, annabell) is in brief 0f.
- **G16**: 25 files, the unit evaluator as the bundle describes; golden `units` stage, `oracle.py` checks `exact` and `si`. Defaults recorded as pass 1 points 1–5.
- **G17 + G17f1**: `build.ts` `specialIn`/`aloneNumber`/`specialSource`/`specialEnd`, `evaluate.ts` `endOffset`/`endLog`, `pasup`/`pasul` definitions, messages through `enUnits.ts` (`units.logarithmic`, `units.level`, `units.belowzero`). Golden cases t01–t17 cover the spec's list (`20 °C → °F`, `100 °F → °C`, `300 K → °C`, `20 °C → K`, `20 °C × 2` and `20 °C + 5 K` refused, Δ°C, K, °R, `1 W → dBm`, `1 Np → dB`, dB in a product refused), plus G17f1's four (lone dB/bel/Np refused, level ≤ 0 refused, below 0 K refused, E notation accepted). Regression tests first: yes (`units.yaml`, `build.test.ts`).
- **G18 + G18f1**: `uncertainty.ts` (σ to 2 digits, value rounded to σ's last digit), `pasupm(value,sigma)` → `pasv<n>` symbols, σ by Giac `diff` at the values, divided by the end factor, through the level's derivative for dB. Cases g01–g16 cover product, sum, quotient, power, sqrt, no ±, a constant with CODATA σ, σ = 0, ± on °C/°F, ± inside sin in DEG and RAD. `unc_oracle` on each. R28's text now says how ± reaches the evaluator (pass 2 point 1).
- **G25 + G25f1**: `shownOf`/`shownUnits` (typed product kept when one unit, factor 1, at most one prefixed token, or the only slot), `chosenUnit` (SI with the prefix that puts the number in 1…999, mass stops at kg), `dimensionText`, `unitProduct`; `rev` and `rpm` in `factors.ts` over qalc's data. Cases d35, d35b, n01–n12 pin the rules. `Quantity`'s shape written into docs/04 8.2 by pass 2.
- **G13**: `find/units.yaml` `known` → `override` (our exact factor replaces qalc's, and the build fails once qalc agrees), hp, mmHg, inHg and 13 CODATA constants; `generate.mjs` counts overrides. Cases u10, q01–q04 and more. Nit: the 13 constant cases carry `source: derived`, but a CODATA value is a reference value, not derivable; pass 3 says it checked all 13 against NIST allascii.txt, which I could not reproduce offline (**inferred**).
- **G22 + G22f1**: `HomeResult.why` and `CasResult.why` (`unaudited`, `inherited`, `once`), filled in `homeEval.ts` (`whyOf`, `symbolicWhy`) and `host.ts` `inherited()`; G22f1 adds the names whose perturbation cost digits and `once` when the check cannot run. `host.test.ts` has the four cases the spec asks (unaudited `normald_icdf`, `inherited: ["B"]`, `once` for the double fallback, no `why` for an exact rational) plus G22f1's three. The audit of run 18 said it did not run the new test against the old `host.ts`; pass 5 says it did and it fails there (**inferred**).
- **G23 + G23f1**: `exactFacts` doubles the extra precision (P+40, P+80, …, `MAX_EVAL_DIGITS` = 1000) within a 50 ms budget checked between levels; `reliableDigits` 0 draws "⚠ no digit confirmed" (`mark.noDigit` in `en.ts`) and no number, in the history and as an inserted chip (`noDigit` helper in `displayMode.ts`). Golden `prec-G23-sin-1e100` (oracle) and `prec-G23-sin-1e2000` (mark-only); e2e `nodigit.spec.ts`; the wall-clock assertion replaced by an evalf-precision count. The spec's timing figures (`digits-cost.ts`, p95 within 10 %) are in the report and pass 4's defaults (**inferred**).
- **R51**: `parse.ts` marks a number after spacing after a number (`gap`) and refuses it with "put × between two numbers"; parser cases decimals-e05…e13 (errors) and decimals-18…24 (kept forms), chip-res-e12, chip-res-13; a new test that `parser.yaml` ids are unique (audit round 1 found a duplicate). Scope kept to `app/src/input/` and `parser.yaml` (**verified**).
- **R39**: `oddRootExponent()` in `emit.ts` (a literal p/q reduced, q odd → `surd(base,q)^p`), set for Home (`session.svelte.ts`), Solve and Function, not CAS; the plot evaluator does the same (`Math.cbrt`, else sign·pow). Golden r39-* in `home.yaml` (`virtual-calc` for −2, the rest `derived`/`oracle`) and roots-17…26 in `parser.yaml` (roots-26 pins CAS unchanged). Fix round 2 changed `app/src/find/queries.test.ts` (a 60 s vitest timeout on the Find timing test), a file outside R39's scope; pass 5 accepted it.
- **R52**: `app/src/i18n/enParser.ts` (keys `parse.*`), `SerializeError(message, key, vars)` in `errors.ts`, `parseFailText()` folds the three catches; `messages.test.ts` checks no literal is left and every key is used; `cannot plot: ` prefix kept with a test after the audit. Start chunk +0.04 kB, accepted as pass 6 point 2.
- **G14 + G14f1**: `pasmod` engine definition (irem on integers, `a-|b|·floor(a/|b|)` otherwise), `mod`, `Mod`, `Rem` and Find's `irem` all emit it; `restoreLiterals()` puts typed decimals back into a kept test (bracketed and bare `m/10^k`, with a boundary check). Golden g14-*, g14f1-* (`x\bmod 3` = `x-3*floor(x/3)`), parser misc-more-08 changed, `prec-eq-romberg` expectation changed to the typed decimal. The round-0 golden failure was real (the parser gate did not load our definitions); fixed in `roundtrip.test.ts`.
- **G26**: `constUnc.ts` (`withConstValues`, `inexactConstsIn`, `sigmaExpr`, `uncDigitsOf`), `home(input, settings, consts?)` through the protocol and `WorkerEngine`; `uncDigits` on `HomeResult`. Tests: quadrature of two constants, an exact constant gives none, σ = 0 gives none, without the table nothing changes. Scope as the spec.
- **S4, S9, R50a**: docs and probes only (`tools/probes/library.ts` + 14 library files, `results-geometry.mjs`, `docs/mockups/palettes-r50.html`); nothing under `app/` or `android/` (**verified** by the diff stats). Pass 8 says the mockup's contrast code gives 0 failures for all 6 themes (**inferred**).

### CLAUDE.md rules on the whole night diff (`origin/phase-1..HEAD`, **verified**)

- SPDX header on every added source file (`.ts`, `.mjs`, `.html` excluded as docs; probe `.txt` fixtures excluded): none missing.
- "HP" / "Prime": nowhere in added code or strings. One sentence in the mockup's HTML comment ("nothing here comes from any HP skin or screenshot") is the clean-room note, not a UI string.
- No new dependency: `app/package.json`, `package-lock.json` and `THIRD_PARTY.md` unchanged (A6 added one script line to `package.json` only).
- No `any` added. No Giac call from the UI: the only new `giac`-named imports are `mathJsonToGiac` (the text serializer) and the `Giac` type inside `app/src/engine/`.
- User-facing strings through i18n: `enUnits.ts` (G17, G17f1), `en.ts` `mark.noDigit` (G23), `enParser.ts` (R52).
- A regression test before each fix: every fix package's prompt required cases that fail on the old code, and each merged with them (`units.yaml`, `host.test.ts`, `home.yaml`, `parser.yaml`, `nodigit.spec.ts`). Whether each case was seen failing first is the worker's claim (**inferred**); the audits did not rerun them against the old code.
- Commits: every merge is `--no-ff --signoff`; worker and pass commits carry `Signed-off-by` and the model's `Co-Authored-By` (**verified** on five samples).

### The unmerged first run of G22f1 (run 15): a flaky test under load, not a bug (**verified**)

- Round 0 vitest: two timing tests failed, `precision.test.ts` G23 (`76.9 ms` against 50) and `queries.test.ts` "16 ms per key" (vitest's 5 s timeout). Neither is in G22f1's files (`host.ts`, `host.test.ts`).
- Fix round 1 made no commit (the log's "fix round 1 done, fdd5d42" is the worker's own sha). Round 1 vitest: only the Find timing test failed. Fix round 2 (`0a4bd42`) gave that test a 30 s timeout.
- Round 2 e2e: 1008 passed, 1 skipped, 8 did not run, 1 failed: `test/copy.spec.ts:89` "copy → paste gives the value back (P5)", a clipboard poll that waited 5 s for the pasted value and got "" (`check-2-e2e.log:2110-2135`). The branch does not touch copy, paste or the entry; the same test passed in run 18 (twice), in pass 5's run and in mine.
- Run 18 (review-only merge after pass 5) resolved the one conflict (`queries.test.ts`: phase-1's 60 s from R39 kept) and passed every check twice; the audit asked for a test of the `once` line, which fix round 2 added. Merged as `7556623`.
- Pass 5's "host load 12 on 16 cores" is **inferred** (I cannot read back the load). The cause is consistent: three timing-sensitive tests and one 5 s poll all failed in the same 8 minutes.

### G15: `60 rpm → rad/s` (**verified** in the code)

- `app/src/units/factors.ts:43-45` overrides the index: `rev` = 1 (a count), `rpm` = 1/60 with dimension `s-1`. So `60 rpm → rad/s` is refused by the dimension check with the generic text "Units don't match: T⁻¹ vs T⁻¹·angle" (golden d29). **No message points to tr/min.** `60 rpm → rev/s` = 1 (n05) and `1 rpm → Hz` = 1/60 (d28) work.
- The Find index (`app/src/find/_gen/find-index.json`) still has `unit:rpm` with `dim: rad1s-1`, `si: pi/30`, and `rev`, `revolution`, `cycle` as names of `unit:tr` (2π rad). So Find shows "Revolutions per Minute" with an angular dimension while the evaluator computes a frequency, and a user who finds "rev" inserts `tr`, an angle, while `{rev}` typed as a slot is the count. G7 (which waits for S5) is to bring the index in line (pass 2 point 3).
- The question is under "Needs the user" (backlog item 4, decisions.md "G15") with pass 2's recommendation: keep the refusal and give it its own message, "rpm counts turns: write tr/min for an angular speed". There is no golden case for `tr/min` (**verified**: no `{tr` in `units.yaml`); the claim that `60 tr/min → rad/s` = 2π works today is pass 2's (**inferred**).

## Part 2: did the pipeline work

### 2.1 The known bugs, and the refusals (**verified** from the logs and `git log -p` of the scripts)

| Bug | Fix | Stayed fixed? |
|---|---|---|
| relative `$0` after `cd` | `1c0cdf0` 01:49 (re-exec by absolute path) | yes: `systemd-inhibit` re-exec worked at 01:54 and 09:05 |
| rc=127, main checkout lacks `scripts/` | `e400fe6` 01:50 (henri's command runs in the phase-1 worktree) | yes from the 01:54 restart; the 9 rc=127 lines at 01:49–01:51 are the old `night.sh` still running |
| `git branch -d` from the main checkout | `1c0cdf0` (`git -C "$integ" branch -d`) | yes: every night branch is gone, no `pl-*` worktree left |
| quoted `;` refused | `1ac97d4` 09:04 | yes: henri's later prompts with `;` and `:` inside quotes passed |
| `gc.sh` path | `1ac97d4` (`"$integ/scripts/gc.sh"`) | yes: gc applied at 09:19, 10:05, 10:39, 12:29, 13:21, 14:06; it failed once before the fix (01:59, run 3) |

The "refused" lines, grouped: the night log has 14 lines containing "refus", `.coord/log.md`'s night section 15. Only **three** are pipeline refusals (`night.sh: refused command with shell metacharacters`): 02:16 twice (`;` inside the quoted open question, the pre-fix filter; `night.sh` then exited after two in a row, **without a STOPPED line**, and the night stood still until the owner restarted it at 09:05: 6 h 49 min lost) and 11:23 once (backticks in pass 4's FIX prompt; the filter refuses backticks anywhere, by design, since `eval` would expand them; henri #15 retried without them and it ran). Every other "refused" line is domain text in the Opus replies and prompts ("a lone dB is refused", "refuse both before taking the log"). Nothing is unexplained.

### 2.2 Restarts, stalls, lost steps, fix rounds that fixed nothing (**verified**)

- Restarts: one (09:05, by the owner, after the 02:16 stop). No usage-limit wait (no exit 75), no 14400 s timeout, no `STOPPED`, no step without a RESULT line after 01:54.
- Pass 1 was answered twice by henri at 02:16 (#4, #5) before the restart; both refused, neither ran; the 09:05 henri #1 ran it once. No duplicate run.
- No package merged without an APPROVED audit (every MERGED line is preceded by `audit APPROVED` in the same run). No audit approved something the gates later broke: my run of all four gates on HEAD passes.
- Opus passes found 7 defects after a Sonnet APPROVED (G17 ×4, G18 ×3, G25, G22, G23 ×2, G14): 6 of the 16 primary packages needed a fix package. None was a merge that had to be reverted, but it is the signal P17's "would change if" names (a Sonnet audit missing what an Opus one catches): the audits approved silent wrong numbers (`20 dB` = 10 Np, `-300 °C` = −26.85 K, `x\bmod 3` = `x`).
- Fix rounds that fixed nothing: run 15 fix 1 (no commit; the two failures were timing tests outside the package) and run 22 fix 1 (no commit; golden units p95 6.16 ms against the 5 ms bar, passed on the rerun with 3.50 ms). Fix rounds that changed an unrelated file to pass: run 17 round 2 and run 15 round 2 (both `queries.test.ts`, which then conflicted in run 18). All four are the same cause: timing assertions under load. Pass 5 recommends a rerun before a fix round counts; that package is not written yet.

### 2.3 The Opus passes against brief 0c (**verified** against `.tasks/pass-*/reply.md` and the doc commits)

- All eight follow the form (OPUS PASS, VERDICT per package, FIX lines, QUEUE, NOTES) and ran the gates on phase-1 (NOTES give the counts). Passes 6 and 7 carry stray text around the block ("Waiting for e2e and the golden gate to finish.", a ``` fence, "The watch on the gates had already done its job"); henri still parsed them.
- Every FIX line became a package and merged: G17f1 (pass 1), G18f1 and G25f1 (pass 2), G22f1 and G23f1 (pass 4), G14f1 (pass 6). Pass 5's QUEUE line (review-only merge of G22f1) was run as written (henri #19).
- Defaults recorded: decisions.md "2026-10-18 Opus pass 1…7 defaults" and "R39 defaults"; pass 8 recorded none (S9 and R50a are docs). "Needs the user": S9 and S4 entries written; G15's rpm question under the existing G15 entry and backlog item 4.
- Shared-file texts applied: docs/04 8.2 (`Quantity`, `UnitRequest`, `why`, `uncDigits`), R28's and R40's package texts, CLAUDE.md one line (pass 1), merged blocks and lane rows removed from brief section 7 (none of the 16 ids is left, **verified**).
- **One decision that should have waited for the owner:** pass 8 (`2c6017e`) rewrote the last sentence of decisions.md **P7 point 5**, a DECIDED entry, to "R53 collapses the keypad in Home and CAS only; the collapse in Plot … waits until the removal test shows the mode in use". That is S9's recommendation, which is still OPEN under "Needs the user". If the owner says no to S9, P7 point 5 must be restored (the old text is in `2c6017e^:docs/decisions.md`).
- Minor: pass 2 point 3 changed G7's package text (adds `rev` and `rpm` to `find/units.yaml`); a plan change, but it only keeps Find and the evaluator consistent and is noted in the G15 entry.

### 2.4 Integrity (**verified**)

- gc ran after runs 6, 9, 12, 18, 21, 24 (every 3rd run number; run 15 had no merge and run 3's gc failed before the fix). It archived runs 001–024 to `.tasks/archive/2026-10-18/` and `.coord/handoff-*.md`, `*.patch`, `*-night.md` from earlier days; deleted nothing else (its "Deleted" sections are empty). Run 025 stays in `.tasks/` until the next gc. The counter is 25.
- Worktrees: `phase-1`, `archpass`, `m4-r12a`, `pipeline-remodel` (all older than the night, all clean); no `pl-*` worktree left. Branches: no `p1/gorge-*`, `p1/ron-m4-*`, `p1/sandra-*` left; `p1/ron-eve-gestures` is the stale one backlog item 9 already asks the owner to delete. gc's report lists `p1/archpass` and `p1/pipeline-remodel` as merged and deletable.
- Locks: `.coord/locks/` empty. Main checkout (`p1/sandra-padlayout`, S5) clean. `.coord/log.md` is consistent with git: every `MERGED <sha>` exists on phase-1; every RESULT line in the night log has its pipeline lines in `.coord/log.md`.
- Still running: the owner's dev server from 2026-10-17 (pid 4016472, `vite --port 5181` in the main checkout, 22 h 52 min). Pass 4's e2e on the default port hit it. Not touched.

### 2.5 Cost and speed (**verified** from the run logs' seconds)

| Run | Id | Wall | In checks | In agents | Fix rounds |
|---|---|---|---|---|---|
| 3 | A6 | 5 min | 4 | 0 | 1 |
| 4 | G16 | 5 | 4 | 0 | 1 |
| 5 | G17 | 11 | 4 | 6 | 0 |
| 6 | G17f1 | 7 | 5 | 2 | 0 |
| 7 | G18 | 10 | 4 | 5 | 0 |
| 8 | G25 | 19 | 10 | 9 | 1 |
| 9 | G18f1 | 7 | 5 | 2 | 0 |
| 10 | G25f1 | 7 | 4 | 2 | 0 |
| 11 | G13 | 5 | 0 | 4 | 0 |
| 12 | G22 | 14 | 9 | 4 | 1 |
| 13 | G23 | 14 | 9 | 4 | 1 |
| 14 | R51 | 16 | 10 | 6 | 1 |
| 15 | G22f1 (unmerged) | 7 | 6 | 1 | 2 |
| 16 | G23f1 | 7 | 5 | 2 | 0 |
| 17 | R39 | 22 | 11 | 10 | 2 |
| 18 | G22f1 | 13 | 10 | 3 | 2 |
| 19 | R52 | 16 | 11 | 4 | 1 |
| 20 | G14 | 13 | 9 | 3 | 1 |
| 21 | G14f1 | 6 | 5 | 1 | 0 |
| 22 | G26 | 18 | 10 | 7 | 1 |
| 23 | S4 | 10 | 0 | 10 | 1 |
| 24 | S9 | 8 | 0 | 8 | 0 |
| 25 | R50a | 4 | 0 | 3 | 0 |

Totals: 23 runs, 244 min wall; about 135 min (55 %) in the deterministic checks, about 96 min in agents (worker, fix, audit). The 8 Opus passes took 75 min (6–15 min each). The night's work from 01:54 to 14:18 is 12 h 24 min, of which 6 h 49 min was the stop at 02:16.

**The bottleneck is e2e:** every round costs about 4.4 min (31 e2e rounds ≈ 137 min); typecheck 7 s, vitest 13 s, golden 13 s. A package with one fix round pays e2e twice. The second cost is the fix round itself (about 2–3 min of agent plus the full check round), and four of the night's twelve fix rounds were load flakes.

## Findings, ranked

### Bugs in what was built

1. **(medium, G15) Find and the evaluator disagree on rpm and rev** until G7: `find-index.json` has `unit:rpm` as π/30 rad/s and `rev` as a name of `tr`; `factors.ts:43-45` makes rpm 1/60 Hz and rev a count. A "rev" from Find inserts an angle. G7 waits for S5. Fix: merge S5, run G7; until then the refusal of `60 rpm → rad/s` has only the generic mismatch text (`units.yaml` d29), not the tr/min hint pass 2 recommends.
2. **(low, R39/G22f1) Scope creep in `app/src/find/queries.test.ts`:** two packages changed a timing test outside their files to get past a load failure (R39 fix round 2: 60 s timeout; G22f1 fix round 2: 30 s, dropped at the merge). The test now hides behind a 60 s vitest timeout and the busy-host skip. Fix: the small load-proof package pass 4 and 5 ask for (`scripts/pipeline.sh` rerun + the test's own skip), not more timeouts.
3. **(low, A6) `npm run gate --quick` on phase-1** is A6's own "Done when" and was not run by the pipeline or by me; and A6f1 (the golden trigger for `app/src/units/`, `find/`, `tools/find-index/` in `gate.ts:65` and `pipeline.sh:237`) is still open. A units-only code change on a day branch would skip the golden gate.
4. **(nit, G13) `source: derived` on the 13 CODATA constant cases** (`units.yaml` q03–q15): the values are NIST reference values, not derivations; the note names CODATA 2022, so the source is clear, but the tag is wrong by the golden-test rule. Fix: a note-level `source` or an `assumed`-style tag that points at allascii.txt.
5. **(nit, G23) A row with no confirmed digit has no tap target** (the result button is empty), noted by pass 5 for R36/R12b (**inferred**, not seen by me).

### Bugs in the pipeline

1. **(high) `scripts/pipeline.sh:254-262`, the one-time rerun of `src/find/queries.test.ts` never fires.** It greps `^ *(FAIL|❯) +…\.test\.ts` in the vitest log, but vitest writes colour codes before `FAIL` (`check-1-vitest.log:103`: `^[[41m^[[1m FAIL ^[[22m^[[49m src/find/queries.test.ts`), so `failed` is empty and the failure counts as a fix round. Run 15 round 1 is the proof: only that test failed, and `run.log` has no "re-running it alone" line. Fix: run vitest with `FORCE_COLOR=0` (or `--reporter=basic`), or strip escapes before the grep (`sed 's/\x1b\[[0-9;]*m//g'`).
2. **(high) `scripts/night.sh:48`: two refused replies in a row end the night silently** (`exit 1` with no `STOPPED` line and no `say`), which cost 6 h 49 min at 02:16. The metachar fix is in, but a backtick or `$` in a FIX prompt (as at 11:23) can still stop the night if henri repeats it. Fix: log `STOPPED night.sh: henri's command refused twice` before the exit, tell henri in the prompt to write FIX prompts without backticks and `$`, and let sofia's pass instructions say the same for FIX lines.
3. **(medium) Timing assertions count as code failures.** Four of twelve fix rounds (runs 15 ×2, 17 round 2, 22) were the units p95 bar (5 ms), the Find 16 ms/key test, the G23 50 ms test (now gone) and a 5 s clipboard poll in `copy.spec.ts:93`. Fix (pass 5's package): on a failure whose only failing items are in a known list of timing checks, rerun once before a fix round; and run `vitest` and `e2e` under the same host-cpu lock as the Opus pass (they already are inside the pipeline, but the pass's own gate runs are not serialised against a pipeline run).
4. **(medium) The `pass` subcommand sets no `PW_PORT`** (`pipeline.sh:74-90`), so a pass's e2e uses the default 5181 and can meet a dev server from another checkout (pass 4, pid 4016472). Passes 5–8 picked a port themselves. Fix: `export PW_PORT=$((5290 + n))` in the pass branch, and say it in the pass prompt.
5. **(low) Sonnet audits approved seven defects that the Opus passes caught** (2.2 above); no merge was lost, but the fix packages cost 7 runs ≈ 55 min plus the second check rounds. P17's own "would change if" says: Opus audits for the engine lane at night. Worth a decision.
6. **(low) Pass 8 edited a decided entry** (P7 point 5) on S9's open recommendation (2.3 above). Fix: restore the sentence unless the owner says yes to S9, and add to the pass instructions: never edit a DECIDED entry on a proposal that is still OPEN.
7. **(low) Pass replies with stray text** (passes 6 and 7) and pass prompts that put backticks into FIX lines (pass 4): the reply form is not enforced. Fix: the pass prompt says "no backticks, no `$`, nothing before OPUS PASS".

## What the owner must decide

1. **S9 (results mode):** yes or no to the 44 px slice, the six actions, Plot as Menu item 6, the removal test (decisions.md "2026-10-18 S9"). A no also means restoring P7 point 5 (`2c6017e`).
2. **S4 (what a library file carries):** definitions only (recommended) or also settings and user-key slots.
3. **G15 (`60 rpm → rad/s`):** keep the refusal and add the tr/min message (recommended by pass 2), and let G7 bring the Find index in line (needs S5 merged).
4. **R50a:** pick a palette, or a mix, on the phone (`docs/mockups/palettes-r50.html`); R50b writes it.
5. **S5:** commit or merge the unit-pad research in the main checkout; G7, R24a, R28, S7, S6, S8 wait for it.
6. **Pipeline packages for annabell (day):** A6f1 (golden trigger), the vitest colour fix and the timing rerun (pipeline bugs 1–4 above), the `STOPPED` line in `night.sh`.
7. **Audit model at night** (pipeline finding 5): keep Sonnet with the Opus pass every three packages, or Opus for the engine lane.
8. **Housekeeping:** stop the dev server pid 4016472 when done with it; `git branch -D p1/ron-eve-gestures` (backlog item 9); push `phase-1`.

## Open

Another Claude session on this machine (`pascaline-90`) is editing docs while this check was written. Its answer (14:45): it works only on branch `p1/sandra-features` in `.claude/worktrees/sandra-features`, branched from `phase-1` at `26026e2`; it edits `docs/shifts/brief.md` (a new section 0h, the night queue, new section 7 blocks), `docs/backlog.md`, `docs/decisions.md` (a new decided entry, A4a points 2 and 5), `docs/04-architecture.md` (5.1, 5.3, 8.3), `docs/06-keypad-vs-g2.md`, `tests/golden/g2.yaml` (items 60 and 61) and the generated `G2-CHECKLIST.md`; nothing under `docs/research/` and nothing on `phase-1`. No conflict with this file. The packages this report proposes (pipeline findings 1–4, A6f1) are not written into the brief yet; the owner asked to wait for that session's diffs first.
