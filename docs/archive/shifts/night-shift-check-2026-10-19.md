<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Check of the night shift of 2026-10-19

**Status (2026-10-20): decided;** every finding is merged, in a package, or dropped (rules section 10: check reports go to the archive).

Written 2026-10-19, 10:00–11:00, read-only, while the night ran and after the owner stopped it (night.sh ended after Opus pass 27's reply, 10:14). From `.coord/log.md` (section "2026-10-19 night"), `.tasks/053-*` to `.tasks/074-*` (run logs, check logs), the reports in the merge commits, and probes on scratch worktrees of each merge commit (removed afterwards). **Verified** = I ran or read it; **inferred** = taken from a log or a pass's reply.

## Verdict

The night finished queue steps 17–29 in 22 pipeline runs and 8 Opus passes (20–27). Every gate is green on `phase-1` (pass 27 ran them on `2da6710`; `feef6e5` adds only its docs). It also left four things the passes did not catch or did not package:
- a regression that was on phase-1 for 20 minutes (fixed by G42f1, 2.1);
- three ways to a silent `=` through an assignment (2.2);
- an engine cost per Enter that nearly doubled, unreported and unmeasured on a device (2.3);
- a night that would have hit its step cap before its last pass and its report (3.1).

Section 4 gives the recommendations, section 5 what the owner decides.

## 1. The plan and what ran

The plan was brief section 0c as committed at `2473113` (00:32): steps 17–45, "the silent wrong numbers by severity, then the gates and the docs", then the last Opus pass and the report.

| Step | Package | Runs | Result (verified in the log and `git log --merges`) |
|---|---|---|---|
| 17 | S12 | 53 | merged `ad9e070` (two audit fix rounds) |
| 18 | S10 | 54 | `83474da` |
| 19 | S14 | 55 | `8eb3fc9`; route R waits for the owner |
| 20 | R64a | 56 | `86d9e2e` (two fix rounds, e2e) |
| 21 | G34 | 57 | `b6ba560` |
| 22 | G38 | 58, 60, 63 | not merged after two rounds; G38f1 `6bb2f81`, G38f2 `5083753` |
| 23 | G39 | 59, 61 | `36cfbd9` without its audited fix round; G39f1 `65b7fe1` |
| 24 | G35 | 62 | `5204408` |
| 25 | G49 | 64, 66, 67, 69, 72 | `3f6e273`; G49f1 `04c82a2`, G49f2 `ef23277`, G49f3 `d781f12`, G49f4 `20351f0` |
| 26 | R65 | 65 | `df3296b` |
| 27 | G36 | 68 | `299054b` (two fix rounds) |
| 28 | G50 | 70, 73 | not merged after two rounds; G50f1 `8872384` |
| 29 | G42 | 71, 74 | not merged after two rounds; G42f1 `2da6710` |

**Not reached:** steps 30–45 (G37, G40, G43, G44, G41, S11, S6, S8, R50c, R50d, G45, R66, R67, R68, the last pass, the report). R50c and R50d could not have run anyway, because R50b (a day package) is not merged. The night wrote no shift report, so this note is its record.

**Counts (verified):**
- 22 runs (53–74), 9 of them fix packages.
- Three packages not merged after two fix rounds (G38, G50, G42), all in the precision chain.
- Pass 27's doc commit is `feef6e5`; it had no FIX lines.

**Gates on `2da6710` (pass 27, inferred):** typecheck 0, vitest 1154/1154, e2e 1044 passed and 1 skipped, golden home 260/260, precision 222/222 with 1 pending, units 136, GOLDEN GATE PASSED.

**Each merge took the commit its audit approved** (verified: `<merge>^2` against the run log's last commit), except run 59. G39's merge took `aa1fad5` while the audit had approved `ee654cd`. Pass 22 found it, and G39f1 brought the fix.

## 2. Findings in the code

### 2.1 Round and trunc lost a digit on phase-1 from 09:48 to 10:08 (fixed)
G50 (`6f0bdad`) added `shortDigits` (`numeric.ts`): a part printed as a double when MPFR digits were asked confirms one digit fewer than it prints. A short exact value such as 12.35, which Giac's `round` returns as a double, prints short too, so it lost a digit. Bisected with `tools/probes/engine.ts` on every merge of the night (verified):

| Input | Before G50 (`20351f0`) | G50f1 merged (`8872384`) | G42f1 merged (`2da6710`) |
|---|---|---|---|
| `round(12.345,2)` | 12.35 | ≈ 12.4 (CAS: 12.4) | 12.35 |
| `round(pi,3)` | 3.142 | 3.14 | 3.142 |
| `trunc(2.567,2)` | 2.56 | ⚠ 2.6 | 2.56 |
| `round(-0.125,2)` | −0.12 | −0.1 | −0.12 |
| `normald_icdf(0.975)` | 1.95996398454 | 1.9599639845 | 1.95996398454 |

**Why five audits missed it:** it passed G50's three audit rounds, pass 26 and G50f1's two audits, because no golden case calls `round(x,n)` or `trunc(x,n)`. G42f1's own case `g42-round-digits-half-up` caught it once phase-1 was merged into G42's branch. G42f1's fix round (`efefbf6`) now caps only a 14- or 15-digit print, and pass 27 found no path where that lets a double through.

**Still open:**
- The fix is recorded under G42f1, not G50.
- No golden case pins these displays except g42's.

### 2.2 Three ways to a silent `=` through an assignment (G49 family; open)
F = `floor(sin(10^100)*10^12)`. Giac at 12 digits gives 899450126402; the true value is −372376123662 (mpmath at 250 digits). Probe on `2da6710` (verified):

| Input (Home unless named) | Shows | Path |
|---|---|---|
| `[q1,q2]:=[F,1]` | `= [899450126402,1]`, then `q1` is `=` | runs once |
| `q5,q6:=F,1` | `899450126402,1` with no mark | runs once |
| `F=>pE` | `= 899450126402`, then `pE` is `=` | runs once |
| `pA:=F`, `pu:=unapply(x+pA,x)`, `pu(0)` | `= 899450126402` | facts not lent |
| CAS `[r1,r2]:=[F,1]` | no mark (the plain list shows ⚠) | runs once |

These are right (⚠): `[F,1]`, `pA:=F`, `L:=[pA,1]`, `L2[1]:=pA`, `subst(x+1,x=pA)`, `pf(x):={local t; t:=pA; return x+t;}` then `pf(0)`, and `seq(F+k,k,1,2)` stored.

**Causes (verified in the code):**
- Every stateful input that is not `name:=value` runs once (`homeEval.ts:573`; CAS `host.ts:671`). G38's second decision is skipped for a run-once input (`homeEval.ts:595`), so an undecided result keeps its exact mark.
- `unapply` writes pA's value into the stored function (`(x)->x+899450126402`). G49f3's rule reads the names a body holds now, and here there is no name left to read. The defining input did read pA, but a variable's facts come only from its result.

**Reach today (inferred from the parser probe and S4):**
- `unapply` becomes reachable once Find can insert it (R4a). The parser emits `\operatorname{unapply}` as is, and `▶ B` stores it as `B:=…`.
- `[a,b]:=`, `a,b:=` and `=>` come only from Giac text. The parser emits none of them (the Store key gives `A:=…`), and S4's library file holds definitions only. A new path that sends Giac text (R59's import, R38b's restore) would reach them.

**The pattern:** G49 needed four follow-ups tonight. The next Opus pass found each one, and each was one more way to write a definition (Home, CAS, a name redefined later, an arrow). Giac's `VARS()` lists every name assigned by `:=`, `[a,b]:=`, `sto` and `unapply` (verified, raw mode). So the host could find the names an input stored by comparing Giac's state before and after it, instead of by reading the input's text.

**Also:** `sto(…)` is not in `STATEFUL` (`homeEval.ts:380`), and `definedBy` has no case for it. So it runs twice and stays out of the definitions log, and a name stored with it would be gone after a relaunch (inferred from the code). It becomes reachable through Find (R4a).

### 2.3 The engine cost per Enter nearly doubled, and no device has measured it
**Desktop timing.** Measured with `tools/probes/digits-cost.ts` (today's version in each tree) on the 163 inputs of `tests/golden/home.yaml` at `2473113`: 5 rounds, three runs each, idle machine, under the host-cpu lock (verified):

| Code | p50 at 12 digits | p95 at 12 digits | p95 at 30 digits |
|---|---|---|---|
| `36cfbd9` (before G38) | 0.24–0.27 ms | 2.37–2.60 ms | 2.34–2.49 ms |
| `6bb2f81` (G38f1 merged) | 0.45–0.59 ms | 4.81–5.56 ms | — |
| `20351f0` (G49f4 merged) | 0.43–0.45 ms | 4.77–5.18 ms | — |
| `feef6e5` (now) | 0.45–0.49 ms | 4.52–5.20 ms | 4.42–4.76 ms |

That is ×1.9 at p50 and at p95, all of it from G38f1.

**Giac calls per Home Enter.** Measured with `tools/probes/engine-calls.ts` (15 everyday inputs, with a, b and f stored): 82 at the night's start, 88 after G39, 168 after G38f1, 192 after G50f1, 187 now (G42f1's fix took 5 off `round`). The step at G50 is its `complexReads`, which reads up to 40 stored names per input (`numeric.ts:285`, `MAX_READS`).

**Why it passed:** G38 measured its own cost as 1.29×. Its default allows 1.3× (decisions.md Defaults, "The deep check of 2026-10-19 (exact answers and units)": "Would change if: G38's second decision costs more than 1.3 × the desktop p95"). G38f1 then added a Giac call per called name (`notBuiltin`) and the float reprint, and its report gave "Numbers: none". Each package compares with its parent, so the budget compounds. That default's trigger is now met.

**On the device:** the last Tab One measurement of Enter p95 was 138–160 ms against < 150 (A4a, 2026-10-16), with nothing since. Desktop 4.8 ms is far from any bar, but the Tab One runs these paths 10–30× slower (inferred from G29's replay ratio, 291/10.8).

### 2.4 The gate and the audits do not see side effects
2.1 passed five audits. An audit reads a diff for what it claims, and golden cases cover only the inputs someone wrote down. A 30-input before/after battery with no expected values found 2.1 in seconds. G43 (queued) compares settings within one tree, for Home and precision inputs only, and no CAS golden case runs in DEG (r14 section 3).

### 2.5 Our replacements for Giac functions live in two places
- **The parser** renames `mod`, `irem`, `median` and `percentile` (`emit.ts:152`, `CALL_NAME`).
- **The engine** rewrites tanh, asin, acos, atan and acosh in any text (`numeric.ts` `complexSafe`, G50).
- **Route R** puts the angle factor in the parser and plans the same rewrite for library imports (r14 section 5).

Giac text that does not pass through the parser gets Giac's own functions. Raw `median([1,2,3,4])` is 2 in Home and CAS (verified); the right value is 2.5. The paths that send Giac text are the library import (`library.ts`; R59 builds its UI), its `// test:` lines, and later the backup restore (R38b).

### 2.6 Shared-file text left out
G50's report (`f1b6b75`) gave text for docs/04 3.3 (tier 0 covers complex arguments in RAD) and for the backlog's Giac upstream list (complex asin, acos, atan and acosh without an MPFR path). Pass 26 held G50 back as unmerged, and pass 27 did not apply the text after G50f1. It is applied with this note.

### 2.7 Smaller
- **CAS stored tanh (pass 27; verified):** with `w:=tanh(i)` and `g(x):=tanh(x)+w`, `evalf(g(i))` in CAS shows ⚠ 0.9·i with no confirmed digit. The mark is honest, but the value shown is wrong. Home `g(i)` gives 3.11481544931·i, which is right (2·i·tan(1)).
- **G49f3's open item** had no queue step (verified): Home `pA:=F` shows ⚠, but CAS `pA`, `pA+1` and `pf(0)` (with `pf(x):=x+pA`) show `899450126402` with no mark.

### 2.8 A decision Giac cannot make shows a guess
`floor(cos(pi/7)-cos(2*pi/7)+cos(3*pi/7)+1/2)` shows ⚠ 0 (verified on `f4c8d26`, `6bb2f81` and `2da6710`). The exact value is 1, because cos(π/7) − cos(2π/7) + cos(3π/7) = 1/2. G38's report said ⚠ 1; its second fix round ("only a proven tie takes the cut's value, else ⚠") made it Giac's 0. The golden rows `g38-floor-cos-pi/7` and `g38-floor-cos-pi/7-1e-100` check the mark only, so nothing noticed. On a cut no precision decides the value, so any number shown is a guess. G39 refuses a divergent sum rather than show its principal value; the same rule would refuse this one (G57, for the owner).

## 3. Findings in the process
1. **The step cap.** `night.sh --max-steps 40` counts every henri decision. At 09:48, 29 were used and at least 20 steps remained (16 queue steps plus passes). The night would have ended "STOPPED night.sh: 40 steps" in the afternoon, with no last pass and no report.
2. **The night ran into the day.** By day only one pipeline runs at a time, so R50b could not start. R50b is the first package of the day path, and R15c1, R50c and R50d wait for it.
3. **Fix chains.** 9 of the 22 runs were fix packages. G38's chain took 02:26–06:19, and G49's five runs 06:19–09:24.
4. **Growth of the precision code.** In one night `numeric.ts` grew from 611 to 1202 lines, `host.ts` from 725 to 898 and `homeEval.ts` from 594 to 728; `converge.ts` (326 lines) is new. 2.1 and 2.2 sit in its text-matching helpers (`namesIn`, `functionsIn`, `boundIn`, `simpleAssignment`, `complexReads`).
5. **decisions.md was full** (39,994 of 40,000 bytes). Pass 25 cut G38's example to fit, and pass 26 filed G49f3's open item in the backlog. To fit this note's entries, two entries now point to the archive.
6. **The S12 packages' order.** The brief's path said S12's removal packages come first at night, but the queue table had them last (steps 40–43). henri follows the table, and the path text now says the same. R66 undoes R39 (merged on the night of 2026-10-18) in Home, and the S12 entry is still OPEN.
7. **A stray wait (verified in `.tasks/archive/2026-10-19/058-g38/`):** G38's worker committed its report at 02:58, but its `claude -p` stayed open until 03:37. A background `pgrep -f` loop of its own matched its own command line ("`pgrep` still finds is my earlier watcher loop"). The worker timeout is 3 h (`pipeline.sh:230`).
8. **The Opus replies' form.** Replies 20, 21, 24 and 27 began with a line before `OPUS PASS`, which the brief's form forbids; henri coped.
9. **Housekeeping (verified):**
   - The Vite server from 2026-10-17 (pid 4016472, port 5181) still runs.
   - Merged branches still with a worktree: `p1/archpass`, `p1/night-plan`, `p1/pipeline-remodel`, `p1/sandra-features`.

## 4. Recommendations, as packages (brief section 0; the night queue 0c)
| Finding | Package | Lane |
|---|---|---|
| 2.1 lost digit, guard it | **G47** golden display cases for `round`, `trunc`, `normald_icdf`, Home and CAS | night |
| 2.2 silent `=` through assignments | **G48**: a run-once result that rests on a decision is ⚠; a stored name takes the facts its input read; `sto(` is stateful | night, before R4a |
| 2.2 the pattern | **S13** spike: stored names from Giac's state (`VARS()`) instead of the text | night, after G48 |
| 2.7 CAS without a mark | **G51** a CAS result that reads stored facts gets their mark | night, after G48 |
| 2.7 CAS stored tanh | **G56** complex functions inside a stored function, in CAS | night, after G51 |
| 2.8 a guess on a cut | **G57** an undecided decision is refused | night, after G48 |
| 2.3 cost | **G52** Giac calls per Enter in the gate; **G53** the second decision back to 1.3× of `36cfbd9`; **A16** Enter p95 on the Tab One | night, night, day |
| 2.4 side effects | **G55** the behaviour-diff tool and corpus; **A18** its table in the audit | night, day |
| 2.5 two places | **G54** one rename of our names for Giac text (library import and test lines); R59 waits for it | night, before R59 |
| 2.6 lost text | applied in this note's commit | — |
| 3.1, 3.7, Opus pass 22 | **A17** the merge takes the audited commit; `night.sh --until`; the pass reply logged from `OPUS PASS`; no stray waits | day, before the next night if it fits |
| 3.5 decisions.md full | **S15** decisions.md back to 34 kB or less | night, first |

Amended packages: R36 words `why.decided`, `why.differ` and a complex `why.unaudited`; R64 reports R64a's Function chunk delta; G46 drops the DEG test of G50's definitions and adds DEG rows to `complex-audit.ts` (DEG `tanh(i)` shows Giac's coth under ⚠ today); R59 starts after G54. Until A17, brief 0c's Opus pass checks each merge's `^2` and the night starts with `--max-steps 70`; rules section 3 names the `pgrep -f` trap.

## 5. For the owner (decisions.md "Needs the user" and backlog.md)
**Decided by the owner on 2026-10-19, as recommended:** items 1–5. Route R puts R64 → G46 in the night queue after G51, and G21b is dropped. G57 runs after G48. The decisions are in decisions.md "Decided proposals"; their open texts are in the archive.

1. **S14:** yes to route R. Today 32 of 52 angle cases are wrong in DEG (r14).
2. **S12:** answer before the next night; R66 is queue step 41.
3. **The pipeline:** A17 by day before the night if it fits, and the behaviour-diff stage (G55, A18).
4. **The cost:** G52 and G53 at night, A16 on the Tab One (the trigger in G38's default is met).
5. **G57:** yes to refusing an undecided decision (backlog "Needs the user" item 9).
6. **Housekeeping:** done on 2026-10-19: the four merged worktrees and branches are gone (the archpass notes are kept in `.tasks/archive/2026-10-18/archpass-notes/`), and pid 4016472 is stopped. Left for the owner: `git branch -D p1/ron-eve-gestures` (unmerged).

## How to rerun
- **Displays and holes:** `node tools/probes/engine.ts '<input>' …` (`FACTS=1` adds the facts, `MODE=cas` runs CAS). For an older commit, run it in a worktree of that commit (`git worktree add --detach <dir> <sha>`, with a link to an `app/node_modules`).
- **Cost:** `CASES=<home.yaml of 2473113> DIGITS_LIST=12,30 ROUNDS=5 node tools/probes/digits-cost.ts` in each tree, under `tools/devlock.sh acquire host-cpu`. Copy today's probe into an older tree, because the old one stops at the steps cases.
- **Calls:** `node tools/probes/engine-calls.ts` in each tree.
- **Oracle:** `tests/golden/.venv/bin/python -I -c "import mpmath as m; m.mp.dps=250; print(m.floor(m.sin(m.mpf(10)**100)*10**12))"`.
