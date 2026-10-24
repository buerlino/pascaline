<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# A stable core: where we are, and what to do (2026-10-24)

**Status (2026-10-24): decided.** The owner took every step of section 4: core cases c57–c60; A36 (red before green); the "Done when" rule (brief section 2); A37 (the flake census); one core run on the Tab One; the freeze ends on the P23 bar plus those two; G104 → G105 → G110 (the census) before R4a (decisions.md "Owner answers of 2026-10-24, evening").

Read on `phase-1` at `5452c73` (G64f1 merged, 21:13), with the coordination log `.coord/log.md` up to pipeline run 229 (G108, in its first fix round at 22:21). I ran no gate myself. Every number below comes from a command in section 6.

## 0. The answer

**The core list will soon say "holds", but the core is not stable yet.** The list has been green on desktop since 2026-10-23 and green on the Fairphone for one night. In the same three days, 18 new bug ids appeared (F69–F86). As far as the log shows, the core list found none of them. A third of all merges were still follow-up fixes of merged work, the same share as before the freeze.

**My recommendation: no bulk tests and no more symptom fixes. Make the gate catch what the audit catches, then end the freeze on the bar you already set.** Concretely, in this order:
1. **Close the exit you defined:** two morning checks (none is reported yet), and three list cases in the core list before R80 changes how lists are sent.
2. **Two cheap pipeline changes** that go after where the fix rounds actually come from: a regression test must fail on the old code (checked by the pipeline, not claimed), and docs text leaves "Done when".
3. **Remove causes, not symptoms:** G109 → R80 tonight, as planned. G105 (the remaining readers of Giac text) and a Giac output-shape census go before Find (R4a), because Find will expose hundreds of commands at once.
4. **One flake census and one Tab One run** before the second green night counts, so "green" means green on the slow device too.

The rest stays in the background stream, as P23 says.

## 1. Where we are against the exit criteria

| Criterion (P23, `tests/core/README.md`) | State |
|---|---|
| Every active case passes on desktop | Yes: CORE 53/53 (known 0, needs 3) at every Opus pass since pass 61 (log lines 2767–3143) |
| …and on the night's device | Yes, one night: CORE DEVICE 52/52 on the Fairphone (device runs 61, 63, 71; c53 Share is desktop-only, `app/scripts/core-device.test.ts:27`) |
| Two nights in a row | **1 of 2.** The night into 2026-10-23 ran no core list (A35's stale lock) |
| Two clean morning checks | **0 of 2.** The checks of 2026-10-22 and 2026-10-24 were never reported (log, 20:14). There is no `morning <date>: clean` line in the log |
| The Tab One | **Never ran the core list.** Every device run was on the Fairphone. The Tab One is the speed reference (Enter p95 at the 150 ms bar) |

So on the machine side, one more green night ends the freeze. The morning check is the one step only you can do, and without it the freeze cannot end.

## 2. What the numbers say

### 2.1 The core list is a smoke test, not a stability measure
- The 56 cases (`tests/core/core.yaml`) are short single tasks: entry 16, home 12, cas 8, trig 6, state 6, matrix 4, solve 2, function 2.
- Since R74 merged (run 171), every core failure in the log was the setup, not a bug: lock-screen timeouts (device 903, line 2622), one run under load (c52, pass 65, line 2921). No core case caught a regression in code.
- Bugs are found elsewhere: F79–F86 by Opus passes 61–66, F68–F72 by sandra's replay and the freeze check, the rest by sweeps and package reports.
- **The list has gaps where open bugs sit.** Lists are on Shift 8 (`spec/keyboard.yaml:246–256`), so everyday keys reach them. F77 (`L²` of a stored `{1,4}` shows 17) and F82 (`2÷L` stays unevaluated) are open "core lane" bugs, yet **no core case contains a list**. R80 changes how every `{ }` is sent to Giac, and today nothing in the core list would see it break. There is also no Σ case with a value (the Σ template, `keyboard.yaml:454–459`; c55 uses Σ only as a long job).

### 2.2 The freeze has not lowered the follow-up rate
| | 2026-10-14 → 10-21 | Since the freeze (10-21 18:00 →) |
|---|---|---|
| `feat` / `fix` / `test` commits | 81 / 179 / 128 | 16 / 71 / 42 |
| Package merges | 141 | 51 |
| …of them `f1`/`f2` follow-ups | 42 (30 %) | 18 (35 %) |

Some fix work is expected in a freeze. But the follow-up share is the "merged changes break things" signal that started P23, and it has not moved. The list operators show the pattern: R77 → R78 → R78f1 → R79 → G106 → G106f1, and now G109 → R80 replaces the rewrites. That is eight packages for one cause. You already took the cause route on 2026-10-24, and that was the right call.

### 2.3 The audit catches what the gate does not
Runs 170–229: 60 pipeline runs, 48 merges. **Checks failed 11 times; the audit said FIX 41 times.** Eight packages ran out of fix rounds (G97, R77, G106, G103, G82, G89, G96, G64). Most fix rounds start at the audit, after a green gate. Here is my split of the 41, by their one-line summaries (a reading, not a measurement):

| Kind | Count | Examples |
|---|---|---|
| A real bug in app code that the gate passed | ~13 | G97 the Num table calls homeEval with the raw value; R69 copyMark ignores the item's display mode; G106 a CAS assignment skips the guard; G87 `arg` in the angle set |
| A test too weak, missing, or passing for the wrong reason | ~10 | G96 NaN > 1e-11 is false, so undef passed; G86f1 never checks the first result is a truth value; G88f1 the judge ignores a raised count |
| Docs bookkeeping asked by "Done when" | ~10 | docs/04 lines (G82 twice, G86, G106), patches README (G97, G82f1, S17 twice), THIRD_PARTY (G77) |
| Tooling code | ~8 | the giac-regress exporter (G89, G89f1, G89f2), devlock (A35), the pipeline (A28, A33f1) |

Two of these are cheap to fix:
- **Docs bookkeeping** cost about a quarter of the fix rounds, and it pushed G82 and S17 into extra rounds. The brief already says shared-doc text goes under "For shared files" for the Opus pass (brief section 2), but the package files still put docs/04 and README lines under "Done when".
- **Weak tests:** bug-patterns family 14 already lists this as open process. "The regression test failed before the fix" is the worker's claim, and nobody reruns it on the old code.

### 2.4 The gate is large, but thin on the keys and on timing
- Size: vitest 1787, e2e 1142, golden home 380, precision 396, solve 55, function 28, units 166, parser 623. Known-failure lists: sweep 17, seqsweep 5, viewsweep 2, invariants 0, casback 0.
- **The keys path is still thin:** 30 of 380 home and 27 of 396 precision cases enter as `latex:`; solve, function and units have none. hind-4 (2026-10-24) covers only new cases.
- **Timing flakes cost green runs:** `homeDeadline` (2 s wall clock) failed in 2 of 4 runs at pass 65 under load; `g58-factorial-1e6-12` (2000 ms) cost A28 a round; e2e lazysheet F42 and the hwkeys race cost G96 two rounds; c52 failed once under load. Under a "two nights in a row" rule, one flake resets the count.
- **Text glue is going down, slowly:** 283 → 272 text matches in the G88 ratchet (`app/scripts/text-baseline.json`; 211 of them in `app/src/engine`, numeric.ts alone 31).

## 3. So: more tests, or more bug fixes?

**Tests: yes, but targeted, not more volume.** Volume is not the gap: the audit finds about one bug in app code for every four runs on a green gate. Three kinds of test pay off:
1. **A core case for each open bug that everyday keys reach,** marked `known:` until its fix. That is the README's own rule ("the regression case of a bug the list missed"). Today it means lists.
2. **A test that must fail on the old code,** checked by the pipeline.
3. **A flake census,** so a red run means a bug.

**Bug fixes: yes, but only by cause.** The background stream (F61, F62, F70, F71, F86, G94) stays in the background: those are extreme inputs, already caught and marked. In the core, the remaining cause is our layer reading Giac's text (hindsight 1.1). The bridge moves removed most of it; G104 → G105 remove the rest.

## 4. The proposal, in order

| # | Step | Who, lane | Size | Needs |
|---|---|---|---|---|
| 1 | **Morning check** on the Fairphone, on the APK of device run 71 (`2312594`) if it is still installed, else after tonight; log `morning <date>: clean` or `fails` | you | 10 min | — |
| 2 | **Three list cases in the core list**, before R80 runs: c57 `{1,4}+1` → `{2,5}` (R78, passes); c58 `{1,4}` Store L, then L x² → `{1,16}` (`known: F77`); c59 2 ÷ L → `{2,0.5}` (`known: F82`). Values derived. Optionally c60: the Σ template, Σ_{k=1}^{10} k² = 385 | sandra writes them, R80 removes the `known:` | 30 min | your word (the list changes only with you) |
| 3 | **G109 → R80** tonight, as queued (119a–b) | gorge, ron, Opus | 2.5 h | — |
| 4 | **Red before green:** a pipeline stage runs the branch's new or changed test files against phase-1's source and fails a fix package whose tests all pass there. A FIX audit verdict for a missing failure then turns into a check failure, which costs less | annabell, day | ~0.5 d | an id |
| 5 | **"Done when" names no shared doc:** a rule line in brief section 2. Text for docs/04, the patches README and THIRD_PARTY goes under "For shared files", and the Opus pass applies it. The package's own files stay in "Done when" | rule line (Opus pass) | 10 min | your OK |
| 6 | **Flake census:** when the night has no step to start, run vitest and e2e five times on one unchanged commit. Every failure is a flake. Each flake gets a backlog line, and wall-clock tests move to the timing stage that already retries once | annabell, night-safe | machine time | an id |
| 7 | **One core run on the Tab One** by day, before the second green night counts. c52 (float fallback in budget) and c55 (Esc) depend on time, and the Tab One's Giac calls are 10–30× slower | annabell, day (device) | ~0.25 d | the Tab One free |
| 8 | **End the freeze** on the P23 bar: the Opus pass writes the core report | — | — | 1–7 |
| 9 | **Before R4a:** G104 → G105 (the remaining readers), then a census of Giac's output shapes for Find's tier-1 entries (bug-patterns lead 6), run as a sweep through the keys. Make it R4a's gate. Find widens the reach more than all earlier packages together. N1 (`cas_setup`, `approx_mode`) is the kind of bug Find makes one tap away | gorge, Opus | ~1 d | — |

**Why this order:** 1 and 2 are minutes and decide whether the bar is honest. 3 is already planned. 4 and 5 go after the biggest sources of fix rounds and cost under a day. 6 and 7 make sure the second green night means something. 9 matters most once Find lands, so it runs right after the freeze, not inside it.

**What I would not do:**
- Widen the exit bar beyond 2 and 7. The freeze has a cost: Find and units wait, and you felt the stall on 2026-10-21.
- Move any background bug into the core lane unless everyday keys reach it.
- Add golden cases in bulk. G61's keyboard generator already covers the old Giac-text cases.

## 5. What I did not check
- I ran no gate and no probe; the counts are from the log and git (section 6).
- The split of the 41 audit verdicts is my reading of their first lines.
- The list case values (step 2) are derived by hand; the case writer checks them against the harness and the oracle.
- Whether the Fairphone still has `2312594`'s APK installed.

## 6. How to rerun
```bash
# commits and merges since the freeze (phase-1 worktree)
git log --no-merges --since="2026-10-21 18:00" --format=%s phase-1 | sed -E 's/^([a-z]+).*/\1/' | sort | uniq -c
git log --merges --since="2026-10-21 18:00" --format=%s phase-1 | grep '^Merge p1' | grep -cE ': [A-Z][0-9]+[a-z0-9]*f[0-9]'
# check failures and audit verdicts since run 170 (main checkout)
n=$(grep -n "pipeline #170 " .coord/log.md | head -1 | cut -d: -f1)
tail -n +$n .coord/log.md | grep -cE "checks failed"; tail -n +$n .coord/log.md | grep -oE ": audit [A-Z]+" | sort | uniq -c
# core counts over time
grep -noE "CORE( DEVICE)? [0-9]+/[0-9]+" .coord/log.md | tail -30
# golden cases through the keys
for f in home precision solve function units; do echo $f $(grep -oE '\bid: ' tests/golden/$f.yaml | wc -l) $(grep -oE '\blatex: ' tests/golden/$f.yaml | wc -l); done
```
