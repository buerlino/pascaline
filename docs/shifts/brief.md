<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Shift brief: the core freeze (P23), run by the owner

**Every package runs through `scripts/pipeline.sh`** (rules section 4): by day the owner starts one package at a time (`scripts/pipeline.sh <agent> "<ID>" --model <m>`, the table gives agent and model) and reads the RESULT line; at night `scripts/night.sh` runs the queue of section 0c. Nobody starts a worker or merges another way (CLAUDE.md). The standing rules in [rules.md](rules.md) apply; where the two differ, this brief wins. Each open package is one file in [packages/](packages/), in the shape the pipeline bundles (section 2). The shape of a package file: the heading `### <agent>, <ID>: <title>, branch \`p1/<agent>-<slug>\``; **Lane** (night-safe = no device, no APK, no eye on the UI; night (Tab One) = the plugged-in Tab One only, P23; day = the owner tries it or it changes the pipeline); **Starts when**; **Read** (repo paths get bundled, first 400 lines; the big shared docs by bare name and section); the steps; **Done when** (lines an auditor checks in the diff).

## 0. State and the path
`phase-1` at `fb50120` on 2026-10-26, after the eleventh night ([2026-10-26-night-report.md](2026-10-26-night-report.md)): runs 246–254 merged R81 (F99), R74f1, G109, R74f2 (F100), G111 and R80f1 (R80); Opus passes 76–81 found no regression. G112 (`p1/gorge-g112`, `642318e`, worktree `pl-254-g112`) is unmerged after two fix rounds: G112f1 (Opus pass 81's FIX line, `.coord/log.md` 07:06) runs on the same branch and merges both. Every merge: `git log --merges --oneline phase-1`; the audits are in the Opus passes' defaults (decisions.md, older ones in [archive/decisions-2026-10.md](../archive/decisions-2026-10.md)) and the night reports ([archive/shifts/](../archive/shifts/)).

### The path: the core freeze (owner, 2026-10-21; decisions.md "P23")
**Why.** Since 2026-10-14 phase-1 has had about two fix commits for every feature commit (`git log --no-merges` by `feat`/`fix`: 84 against 188, [freeze report](../archive/shifts/2026-10-21-sandra-freeze-report.md) section 1). Many are fix rounds before a merge, but 45 of 208 merges were follow-up packages (`<ID>f1`, `f2`) for work already merged (`git log --merges --since=2026-10-14 --format=%s phase-1`): merged changes break things too often. The open bugs are of two kinds. Most come from our layer guessing at Giac's printed text (settings, names, stores, bound variables, the kind of a number): the structured bridge (G85) removes their cause. The rest are precision edge cases inside Giac on extreme inputs. So: no new features until the core holds; the bridge first; "holds" is a fixed list, not a feeling; extreme inputs run as a background stream.

**What "holds" means:** decisions.md "P23" (2): every active case of [tests/core/core.yaml](../../tests/core/core.yaml) passes on desktop (R74) and on the night's device (A32, A33; the same one both nights) two nights in a row, and the owner's [morning check](../../tests/core/MORNING.md) on that device finds nothing on both mornings. The Tab One core run and the flake census come first (owner, 2026-10-24; both done 2026-10-25). **The count:** the 2026-10-25 morning check failed on F99 (the system keyboard on a return from another app), so it started again. The night into 2026-10-26 on the Fairphone 6 (`ANDROID_SERIAL=4d42e62f`) was green with R81 merged (CORE 57/57 on desktop, CORE DEVICE 56/56 on `446ed9f`): it is night 1 if the 2026-10-26 morning check is clean. Night 2 is the next night on the same phone. 3 cases need Find (R4a).

**What waits** (the packages keep their files; none starts until P23 ends, whatever its file says): Find R4a → R4b with R15c3 and R72; the unit chain R24b → R24c → R24d, R60–R63, R71; R49 → R55, R57, R70; R50e; R53; R12b → R12c → R41; R36, R33, R37, R40; R59; R38a → R38b; R15c4; A4b; G79, S20; A7 → A8 on the owner's go. **After the freeze, in that order:** Find (R4a, after G111: decisions.md "Owner answers of 2026-10-25"; three core cases wait for it: a command by name cannot be keyed today), then units, then the rest.

**By day, one pipeline at a time** (owner, 2026-10-18), each after the one before is merged:
1. **G112f1** first (gorge, Opus: `scripts/pipeline.sh gorge "<pass 81's FIX prompt>" --id G112f1 --branch p1/gorge-g112 --model opus --audit-model auto`), then **A41** (night.sh runs the device step after every pass), then **A38** (a resumed branch merges phase-1 first), annabell, Sonnet; both change a script the night runs on.
2. annabell on devices: **A16** (Enter p95, the third row: G65 is merged); **A9** with the owner's phone (F41); **A40** (a known core case that passes on the device); the library replay and A20 again (G82 is merged; no package).
3. When a slot is free (process, nothing users see): **A18**, **A22** → **A26**, **A27**, **A30**.
4. Every morning: the owner's check (MORNING.md, on the night's device, about 10 minutes). The day session writes each failed step as a backlog bug line on phase-1 and logs one line in `.coord/log.md`: `- HH:MM morning <date>: clean` or `- HH:MM morning <date>: fails <ids>` (section 8 counts these).

**At night, the core lane** (section 0c's queue) holds no package: G112 (F103, one list read as a function's arguments, at the cause) goes by day as G112f1 above; its refusal rule for constructors (Opus pass 80) goes in through the branch, with F107. So the night runs process steps only (owner, 2026-10-26): A39, A19, then S16 (steps 125a, 125b, 130). Every merge runs the core list (R74), and the night's device runs it after each Opus pass (A33).

**The background stream** (only when no core step can start; each still gets caught and marked, principle 3): F101 and F104 → **G113** (after P23's night 2, before R4a; owner, 2026-10-26); S16 after A19; F61, F62, F86 and G94 (no package). G81 (σ through the basis) waits with the units. **If no step can start,** the night goes to its last pass and report: an early end is fine, there is no filler.

**Why this order:** the list first, so nothing merges blind; silent wrong numbers next, by reach; the bridge before the readers it would replace; the device run once its harness exists. R15c3 and R15c4 move behind Find: the user keys stay empty until R4b, and the keys already moved by R15c1–R15c2 are what the hand learns now.

### The open packages (the core lane and the day; the night's steps are in section 0c)

| # | Package | Agent, model | Lane | Starts when merged | Size |
|---|---|---|---|---|---|
| [A41](packages/A41.md) | night.sh runs the device step after every Opus pass | annabell, Sonnet | day | now | ~0.1 d |
| [A38](packages/A38.md) | A resumed branch merges phase-1 before its worker starts | annabell, Sonnet | day | now | ~0.25 d |
| [A39](packages/A39.md) | `npm run gate` judges e2e and vitest as the pipeline does | annabell, Sonnet | night (125a) | now | ~0.25 d |
| [A16](packages/A16.md) | Enter p95 on the Tab One, the third row | annabell, Sonnet | day (device) | now | ~0.25 d |
| [A9](packages/A9.md) | Key vibration on the owner's phone | annabell, Sonnet | day (device) | the phone connected | ~0.5 d |
| [A40](packages/A40.md) | A known core case that passes on the device is reported | annabell, Sonnet | day | now | ~0.1 d |
| [A19](packages/A19.md) | Giac's own test suite as an engine-gate stage | annabell, Sonnet | night (125b) | now | ~0.25 d |
| [G113](packages/G113.md) | A probability off the integers is 0; negbinomial_icdf exact (F101, F104) | gorge, Opus | night-safe | P23's night 2 | ~0.5 d |
| [A18](packages/A18.md) | The audit sees the behaviour diff | annabell, Sonnet | day | now | ~0.25 d |
| [A22](packages/A22.md) | The docs check knows ids, live notes and source sizes | annabell, Sonnet | day | now | ~0.25 d |
| [A26](packages/A26.md) | docs/README covers every live doc | annabell, Sonnet | day | A22 | ~0.25 d |
| [A27](packages/A27.md) | gc.sh takes what it misses | annabell, Sonnet | day | now | ~0.5 d |
| [A30](packages/A30.md) | QALC_OUT out of the gate and the pipeline | annabell, Sonnet | day | now | ~0.1 d |

**Why these models:** Opus where a slip breaks entry, the unit chain or stored data for every later package, or gives a wrong number (R75, G97, the night's engine packages); sandra and sofia run Opus; Sonnet elsewhere (an existing pattern, pinned by tests); the audit model follows P17.

## 0c. Night shifts: henri's plan (owner, 2026-10-14; queue rewritten 2026-10-21 for P23)
The queue below is the next nights'. **Start it from the phase-1 worktree:** `cd .claude/worktrees/phase-1 && ANDROID_SERIAL=<the night's device> scripts/night.sh --until 07:30` (the main checkout may be on another branch, without `scripts/`). `scripts/night.sh` runs it (rules section 4): for every decision it starts a fresh henri (Sonnet, Read-only) who sees this section and the log's tail and replies with one `scripts/pipeline.sh` line; the script runs that line and asks again. **henri executes and decides nothing.** **Use the window** (owner, 2026-10-19): the queue runs until the usage limit or its end; what is not done stays in the queue for the next night (resumed from the log). The night queue holds what needs no APK and no eye on the UI (owner, 2026-10-18), except the Tab One steps P23 allows (rule 2).

### Rules for a night shift (they replace rules section 4's day use)
1. **One pipeline run at a time**, and never a worker started any other way. A package is `scripts/pipeline.sh <agent> "<ID>" --model <model from the table> --audit-model auto` (`--audit-model opus` where the queue's model column says "audit Opus"): fresh worker, checks, at most two fix rounds, sofia's audit (P17: the pipeline raises gorge packages, Opus workers and engine, input or units diffs to Opus), merge. A review-only merge is `scripts/pipeline.sh <agent> "<ID>" --no-worker --audit-model auto` (A10): phase-1 merged into the branch, checks, audit, merge; a conflict or a FIX is a fix round for the package's agent. Its RESULT line in the log is the step's state.
2. **Devices (P23):** only the night's device, plugged in by the owner, and only for a queue step whose lane says "night (Tab One)" (annabell). The night's device is `$ANDROID_SERIAL`, set when `night.sh` starts: the Tab One (`HA24BZ2Y`), or the Fairphone 6 (`4d42e62f`) while APODroid's night has the Tab One (owner, 2026-10-21). APODroid's locks are not ours, so a night on the Fairphone never touches `HA24BZ2Y`; After each Opus pass, `scripts/pipeline.sh device <n>` (henri's line; the next Opus pass reads its `CORE DEVICE` line, and a `new` case is a FIX). The night's device stays unlocked: the owner unlocks it once at plug-in, and its saved settings (`.coord/devices/<serial>.orig`, `STAY_ON=7`) keep the screen on while charging; never remove a PIN (banking keys; owner, 2026-10-22). Nobody else runs `adb` or `build.sh`. A missing or `unauthorized` tablet is not a failure: the worker says so in its report, the step stays unmerged and runs by day.
3. **henri decides nothing.** Anything this section does not settle: the pipeline logs it, and henri hands it to the next Opus pass (at once, if it blocks the queue). **Follow every Opus-pass recommendation as written.** Plan changes go to the owner through `docs/decisions.md` "Needs the user", written by the Opus pass.
4. **Workers tick their own backlog line** and file their "Needs the user" items on their branch (rules section 5); the audit sees them in the diff.
5. **Opus pass:** `scripts/pipeline.sh pass <n> "<IDs with merge commits or unmerged branches>" "<open questions or none>"` after every three finished packages (merged or left unmerged; fix packages from a pass count), and the last pass at the end of the queue. Each FIX line of its reply runs as `scripts/pipeline.sh <agent> "<prompt>" --id <ID>f1 --branch <branch> --model <m> --audit-model auto`, then QUEUE is followed. A prompt never holds a backtick or a `$` (`night.sh` refuses them; two refusals in a row end the night). The last pass's FIX packages get only their audit, then the report.
6. **Log:** the pipeline writes one line per step in `.coord/log.md` (time from `date`, step, agent and model, outcome, commit); `night.sh` logs each henri reply. The log is the queue state: henri continues from the first step without a RESULT line.
7. **Usage limit:** the pipeline exits 75 and `night.sh` waits 30 minutes and retries, at most six times, then logs `STOPPED`. No retry loops in agents. The owner resumes with `scripts/night.sh` again. A usage limit in the two closing steps (rule 9) waits and retries that step.
8. **A step that ends without a RESULT line** (the pipeline died; A10 makes every exit print one): henri runs the same step once more; if the log then shows it twice without a RESULT, he skips it and goes on. **Worker gone without a report** (no commit): the pipeline logs `NOT MERGED (no commits)` and keeps the worktree; henri runs the same step once more (the pipeline resumes the branch). If that fails too, go on.
9. **The end:** after the last pass and its FIX packages, `scripts/pipeline.sh report` writes and commits the shift report; henri then answers `SHIFT DONE`. **On time (A17):** start `scripts/night.sh --until <HH:MM>` (`--dry-run` shows the plan); from that time, or at `--max-steps` minus 2, henri is asked only for the last Opus pass (or `NO PASS`), then night.sh runs the report and stops. The pipeline merges only the commit its audit read and stops with `NOT MERGED (the branch is not the audited HEAD)` otherwise.

### The queue (rewritten 2026-10-21 for P23; the steps before 101 are done or moved to the background)
Estimates are wall-clock guesses. A package merged by day is skipped (log it); a step whose "After" is not merged is skipped for that night and stays in the queue. The audit model follows rule 1. **The core lane (101–119b) comes first; a background step (120–134) runs only when no core step can start.**

| Step | What | Agent, model | Branch | After | Est. |
|---|---|---|---|---|---|
| 125a | [A39](packages/A39.md) `npm run gate` judges e2e and vitest as the pipeline does | annabell, Sonnet | `p1/annabell-gatetiming` | — | 45 min |
| 125b | [A19](packages/A19.md) Giac's own test suite as an engine-gate stage | annabell, Sonnet | `p1/annabell-giaccheck` | — | 1 h |
| 130 | [S16](packages/S16.md) the hardening pass, run as `scripts/pipeline.sh pass <n> "G61 G62 G63 G64 A19" "S16: docs/shifts/packages/S16.md"` | sofia, Opus | — | A19 | 1 h + fixes |
| 135 | The flake census (A37): `scripts/pipeline.sh flakes <n>`, when no core step can start, before the last pass; once per night until the freeze ends | — | — | A37 | 1 h |
| 190 | **The last Opus pass** on what came after the last pass, then its FIX packages | Opus | — | — | 20 min + fixes |
| 191 | Shift report, then stop | — | — | — | 10 min |

**G85's moves** (S23, 2026-10-22): G98 first, so the gate sees the app's input; then names, stores, settings, values (113–118). G66, G69, G72, G73, G74 and G95 are replaced (their tests moved); G82 runs as written, after the move they read.

### The commands henri replies with (one per decision; `scripts/night.sh` runs it)
- `scripts/pipeline.sh <agent> "<ID>" --model <sonnet|opus> --audit-model auto`: the next queue step not done (the queue's skip rule above); `--audit-model opus` where its row says "audit Opus".
- `scripts/pipeline.sh <agent> "<ID>" --no-worker --audit-model auto`: a review-only merge of a finished branch.
- `scripts/pipeline.sh <agent> "<FIX prompt, verbatim>" --id <IDf1> --branch <branch> --model <m> --audit-model auto`: a FIX line of the last Opus pass, one per call, in order. No backtick and no `$` anywhere in the line.
- `scripts/pipeline.sh pass <n> "<IDs with merge commits or unmerged branches>" "<open questions or none>"`.
- `scripts/pipeline.sh device <n>` right after `pass <n>`.
- `scripts/pipeline.sh report`, then `SHIFT DONE`.

### Opus pass (instructions for the Opus agent)
You are the shift's quality gate and its decision-maker; henri executes your reply literally. Work in the worktree where `phase-1` is checked out (the pipeline tells you which); no code changes.
1. For each package: its package file (`docs/shifts/packages/<ID>.md`), its report (`git log -1 <merge>^2`, or the branch tip if unmerged), its diff (`git diff <merge>^1 <merge>`), and the audit's verdict from `.coord/log.md`.
2. Run once on `phase-1` (from `app/`, with absolute `GIAC_OUT`, `PASCALINE_DL_DIR` and `PASCALINE_QALC_DL_DIR`): typecheck, `npm run index` then `FIND_INDEX=required npm test`, e2e (its `CORE` line: the core list, R74), and the golden gate when engine or parser code changed. Take `tools/devlock.sh acquire host-cpu opus 1800` around them.
3. Check what an audit tends to miss: wrong or invented expected values (sources), a missing round trip, silent wrong numbers or marks (principle 3), scope, keys that moved, tests that pass for the wrong reason. An engine package gives its Giac calls per Enter before and after (`tools/probes/engine-calls.ts`). **The freeze (P23):** a core case that fails and is not `known:` is a FIX now; a device run since the last pass (A32's report, later A33's `DEVICE` lines) with a new failing case is a FIX or, past a day of work, a backlog bug line; a package that adds a feature is a fix-or-revert, never a merge.
4. Decide each "Needs a decision" item of these packages and each open question from the log: a default within the plan goes into `docs/decisions.md` (rules section 9); a plan change goes under "Needs the user" with your recommendation in one sentence. Apply the "For shared files" text of the packages' reports, delete each merged package's file and its row from section 0's table or 0c's queue, and run `node tools/docs-check.mjs`. Commit those doc changes on `phase-1` with `git commit -s` and the Opus trailer, under `tools/devlock.sh acquire integ opus 600` (A10). After a flake census (`FLAKES <n>` line in the log, file `.tasks/flakes-<date>.md`): write one backlog line per flaky test, named by file and title, and add a wall-clock test to `isTiming` in `app/scripts/pipeline-logs.ts`, the tests the pipeline reruns once (A25).
5. Reply in exactly this form, nothing before `OPUS PASS` and nothing after NOTES, and no backtick or `$` in a FIX prompt (`night.sh` refuses the line; name files and code in plain words). Never edit a DECIDED entry of decisions.md on a proposal that is still OPEN; put the change under the proposal. One FIX line per needed fix package; fix IDs are `<ID>f1`, `<ID>f2`, never `<ID>f3` or `<ID>f2f1`: at a chain's second follow-up the next FIX removes the shared cause, as a new id with the family's earlier cases as its tests; more than a day of work goes under "Needs the user" (owner, 2026-10-20):
```
OPUS PASS <n>
VERDICT: <ID> ok | <ID> fix — <one line each>
FIX <ID>f1: agent <ron|gorge>, model <sonnet|opus>, branch <new branch from phase-1>, prompt: <one paragraph with file:line and the fix>
QUEUE: unchanged | <the remaining steps in a new order, or steps to drop>
NOTES: <at most three lines for the shift report; the CORE count first>
```
henri runs each FIX as a package, then continues with QUEUE.

### Shift report (the last step)
`docs/shifts/<date>-night-report.md`, short and plain, from the log (`scripts/pipeline.sh report` starts a fresh writer with the log's night section on stdin): the core list's count on desktop and on the Tab One first; what was merged (with commits); what is unmerged and why; the Opus passes' NOTES; what the owner must do (items under "Needs the user", the morning check); the queue left for the next night. Commit it on `phase-1` with `git commit -s` and the Sonnet trailer. Never push.

## 2. Read before you start (every package)
The pipeline hands you a bundle: your package file (`docs/shifts/packages/<ID>.md`), the first 400 lines of every file the block names by repo path, the report format below and the definition of done of section 8. Read further files by section (`grep -n '^#' <file>`, then the range), never whole files: every file you read is sent again on every later turn. The big shared docs are named in the blocks by bare name on purpose (`decisions.md "R15c"`, `backlog.md item 37`), so they stay out of the bundle: open only the section named.
- Your worktree and branch exist (`p1/<name>-<slug>` from `phase-1`, made by the pipeline); never switch branches in the main checkout. The shared paths and locks of rules section 5 (`GIAC_OUT`, `PASCALINE_DL_DIR`, `PASCALINE_QALC_DL_DIR`, `tools/devlock.sh` for heavy work) are set by the pipeline.
- [04-architecture.md](../04-architecture.md) sections 0 and 8, and the sections your package names. Where docs/04 and docs/02 differ, docs/04 wins.
- `docs/decisions.md` P23 (the freeze: fix, measure or remove, never widen), P11, docs/03 section 0 rules 5–13 (they bind every package: one interaction model, keys never move, vertical space, removal tests), `docs/05-ui-plan.md` with its section 7, and `docs/feedback.md`.
- `docs/decisions.md`: P8, P9, P10, P15, P16, P17 and the defaults entry "2026-10-12 Architecture for the engineer core" (archive; docs/04 holds it). These are decided; don't reopen them. If a docs/04 decision turns out wrong in the code, don't change it silently: finish what you can, and put the evidence under "Needs a decision" in your report.
- **"Done when" names no shared doc (owner, 2026-10-24).** Text for docs/04, `engine/giac/patches/README.md`, THIRD_PARTY.md and other shared docs goes in your report under "For shared files"; the Opus pass applies it, and an audit never sends a package back for it alone. Your package's own files and its backlog tick stay yours.
- **Not now (P23):** no new feature, key, view, setting or command; a fix that seems to need one stops and says so under "Needs a decision". Matrices are entered from the Tmpl palette (EN5's Shift + 5 waits); units, Find and Help wait.
- **No coordinator to message.** Stay inside the files your package names. Shared files follow rules section 5; devices are annabell's.

### Your report (every package)
End with a commit whose message body is the report. The audit and the Opus pass read it with `git log -1`. It holds:
- **Done:** what was built, item by item against the block's "Done when" lines.
- **Tests:** typecheck, vitest, e2e (with its `CORE` line) and golden counts as run.
  A test that passes on the old code is not a regression test: change it until it fails there, or list it under "Not done".
  Never run `app/scripts/behaviour-diff.ts` yourself: A18 makes the audit run it, and until A18 merges nobody does (owner, 2026-10-22, after G76 lost 2 h to it).
- **Numbers:** for example the start chunk size before and after, or timings.
- **For shared files:** exact text for the backlog, decisions, THIRD_PARTY.md, docs/04, this brief. Never cut text you did not write to fit a docs budget: if a file is full, say so here and the Opus pass makes room.
- **Needs a decision:** anything left open.
- **Not done:** what's missing.

Then reply as the pipeline's prompt asks (at most five lines). Nobody is waiting for messages.

## 8. Definition of done
- **Each branch:** typecheck 0; `npm run index` (with `PASCALINE_DL_DIR` and `PASCALINE_QALC_DL_DIR` pointing at the main checkout's caches, as the pipeline sets them), then `FIND_INDEX=required npm test`, all pass (the Find query test fails rather than skips without the full index); e2e all pass, the core list included: every active case passes except its `known:` ones (the known-flaky `solve.spec.ts` persistence test and the Find 16 ms timing test may be re-run once); the golden gate when engine or parser code changed; by hand, `npm run gate` (from `app/`; `-- --quick` while working) runs all of these, the size test and a docs-size report in one command; SPDX headers; `git commit -s` with the trailer of the model that ran; the report commit; the start chunk size reported for UI packages; every "Done when" line of the block met or listed under "Not done".
- **Source size** (owner, 2026-10-20; checked once A22 is merged): no file grows past its line in `tools/line-baseline.yaml` and no new source file passes 800 lines, unless the same diff raises the line with a reason (the `calls-baseline.yaml` rule); a split lowers the line.
- **The freeze ends (P23)** when section 0's bar ("What holds means") is met: two green nights on one device and two `morning <date>: clean` lines in `.coord/log.md` (section 0 day step 4). Then the Opus pass writes `docs/shifts/<date>-core-report.md` and the waiting list of section 0 starts, Find first.

## 8a. Review and merge
Every review and merge is a pipeline run (rules section 4; CLAUDE.md): the audit by sofia on `git diff -U5 phase-1...<branch>` plus the block's "Done when" lines, then `git merge --no-ff --signoff` into `phase-1`. A finished branch from before the pipeline is merged with `scripts/pipeline.sh <agent> "<ID>" --no-worker` (A10). The Opus pass (section 0c) applies the reports' shared-file text, deletes merged package files and their rows, and files proposals under "Needs the user". Never push.
