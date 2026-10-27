<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Shift brief: after the core freeze, run by the owner

**Every package runs through `scripts/pipeline.sh`** (rules section 4): by day the owner starts one package at a time (`scripts/pipeline.sh <agent> "<ID>" --model <m>`, the table gives agent and model) and reads the RESULT line; at night `scripts/night.sh` runs the queue of section 0c. Nobody starts a worker or merges another way (CLAUDE.md). The standing rules in [rules.md](rules.md) apply; where the two differ, this brief wins. Each open package is one file in [packages/](packages/), in the shape the pipeline bundles (section 2). The shape of a package file: the heading `### <agent>, <ID>: <title>, branch \`p1/<agent>-<slug>\``; **Lane** (night-safe = no device, no APK, no eye on the UI; night (the night's device) = the device `night.sh` was started with, only, P23; day = the owner tries it or it changes the pipeline); **Starts when**; **Read** (repo paths get bundled, first 400 lines; the big shared docs by bare name and section); the steps; **Done when** (lines an auditor checks in the diff).

## 0. State and the path
`phase-1` at `1bb14d8` on 2026-10-27: by day R82f1 (`c9ac4e1`), R82f2 (`c151048`), R83 (`ec9cd4e`), R84 (`e25b93a`), A40 (`a9d7945`) and A16 (`777120e`; Enter p95 145–147 ms on the Tab One) merged, after the twelfth night ([its report](../archive/shifts/2026-10-27-night-report.md) and [second section](../archive/shifts/2026-10-27-night-2-report.md)). CORE 63/63 desktop; CORE DEVICE 62/62 on the Fairphone 6 (`a9d7945`). Every merge: `git log --merges --oneline phase-1`; the audits are in the Opus passes' defaults (decisions.md, older ones in [archive/decisions-2026-10.md](../archive/decisions-2026-10.md)) and the night reports ([archive/shifts/](../archive/shifts/)).

### The path after the freeze (owner, 2026-10-27; decisions.md "P23")
**The freeze ended** on 2026-10-27, before its count: repeated green runs added nothing, and the mornings' failures were UI (c46: F110, F117), not the engine. **The net stays:** every merge runs the core list (R74; [tests/core/core.yaml](../../tests/core/core.yaml), 66 cases, 63 active, 3 waiting for Find), night.sh runs the device's core list after each Opus pass when the night has a device (A33, A41), and the owner's [morning check](../../tests/core/MORNING.md) runs on the night's device. A red result is a bug to fix (a FIX of the next Opus pass, or a backlog bug line past a day of work), not a gate. **The pace** (owner, 2026-10-27): about two weeks of Claude Max are left (to about 2026-11-10). Each night carries about 9 hours of real work, the most important steps first, so a usage limit late costs the least; the day runs what needs the owner's eye.

**By day, one pipeline at a time** (owner, 2026-10-18), each after the one before is merged; the lane that needs the owner's look:
1. **Find:** R4a (after G113 and G114; R72 first, which tonight's queue holds), then a split of the start chunk (no package yet: it is cut on R4a's start chunk; R83 raised the budget to 61 kB, owner 2026-10-27, and the Settings base needs room), then R4b (after R15c3 and R49).
2. **The Settings base** (owner, 2026-10-27; decisions.md "Settings in the Mode sheet, and presets"; [mockups/settings.html](../mockups/settings.html)): R85, R49, R86, R57 (R4b sets the free keys in R49's levels; the comma is the owner's daily use); then R50e, R87 (before A7), R70, R15c4, R38a → R38b, R59; R88 (after R4b, R57, R50e) → R89; R55 (after R15c4); R53; R12b → R12c → R41; R36, R33 → R37, R40.
3. **The units:** R24b → R24c → R24d, R60–R63, R71; G81 with them.
4. **annabell on devices:** A9 with the owner's phone (F41); A43 (an update keeps the data; before A7); A4b after R4b; A7 → A8 on the owner's go.
5. **Every morning:** the owner's check (MORNING.md, on the night's device when the night had one, about 10 minutes). The day session writes each failed step as a backlog bug line on phase-1 and logs one line in `.coord/log.md`: `- HH:MM morning <date>: clean` or `- HH:MM morning <date>: fails <ids>`.

**At night, the night-safe lane** (section 0c; no APK, no eye on the UI): first what the next day's work waits for (R4a: G113, G114, R72), then silent wrong numbers and everyday bugs by reach (G115, G117, G118), the engine fuzzer G116, tools (A26, G79); the shortest steps last. **The nightly fuzz** (owner, 2026-10-27): from the night of 2026-10-28, once G116 is merged, every night runs `node scripts/sweep.ts --nightly --edges` once with its triage; that night's planner writes the step into 0c, sized by G116's report (time per 1,000 trees). A package whose lane says day runs by day, whatever room a night has.

**No package yet** (backlog, by reach): F73 and F107 (they waited for the end of the freeze), F80, F85, F70, F71; the background stream F61, F62, F86, F112, F114, G94, F106; what G116 finds. S20 (the MPFI spike) by day.

**Why this order:** silent wrong numbers first, by reach; R4a's gate before Find; Find before the Settings base (three core cases wait for it, and R4b fills the user keys); the start-chunk split before the Settings base needs its room; the units after (owner, 2026-10-27). R15c3 and R15c4 stay behind Find: the user keys stay empty until R4b, and the keys already moved by R15c1–R15c2 are what the hand learns now.

### The open packages of the day (the night's steps are in section 0c)

| # | Package | Agent, model | Lane | Starts when merged | Size |
|---|---|---|---|---|---|
| [R4a](packages/R4a.md) | Find on Math | ron, Opus (P17: input) | day | G113, G114, R72 | ~2 d |
| [R85](packages/R85.md) | Shift + Fmt opens Mode | ron, Sonnet | day | now | ~0.25 d |
| [A9](packages/A9.md) | Key vibration on the owner's phone | annabell, Sonnet | day (device) | the phone connected | ~0.5 d |
| [A43](packages/A43.md) | An app update keeps the user's data (before A7) | annabell, Sonnet | day (device) | now | ~0.5 d |

**Why these models:** Opus where a slip breaks entry, the unit chain or stored data for every later package, or gives a wrong number (P17: the engine, input and units); sandra and sofia run Opus; Sonnet elsewhere (an existing pattern, pinned by tests); the audit model follows P17.

## 0c. Night shifts: henri's plan (owner, 2026-10-14; queue rewritten 2026-10-27 after P23)
The queue below is the next nights'. **Start it from the phase-1 worktree:** `cd .claude/worktrees/phase-1 && setsid nohup scripts/night.sh --until 06:30 >> ../../../.tasks/night-<date>.out 2>&1 &`, with `ANDROID_SERIAL=<the night's device>` in front when the night has one (night.sh writes `.tasks/night-<date>.log` itself; the main checkout may be on another branch, without `scripts/`; `setsid` because a closed terminal kills night.sh but not its running pipeline, 2026-10-26). `scripts/night.sh` runs it (rules section 4): for every decision it starts a fresh henri (Sonnet, Read-only) who sees this section and the log's tail and replies with one `scripts/pipeline.sh` line; the script runs that line and asks again. **henri executes and decides nothing.** **Use the window** (owner, 2026-10-19): the queue runs until the usage limit or its end; what is not done stays in the queue for the next night (resumed from the log). The night queue holds what needs no APK and no eye on the UI (owner, 2026-10-18), except the night's device steps (rule 2).

### Rules for a night shift (they replace rules section 4's day use)
1. **One pipeline run at a time**, and never a worker started any other way. A package is `scripts/pipeline.sh <agent> "<ID>" --model <model from the table> --audit-model auto` (`--audit-model opus` where the queue's model column says "audit Opus"): fresh worker, checks, at most two fix rounds, sofia's audit (P17: the pipeline raises gorge packages, Opus workers and engine, input or units diffs to Opus), merge. A review-only merge is `scripts/pipeline.sh <agent> "<ID>" --no-worker --audit-model auto` (A10): phase-1 merged into the branch, checks, audit, merge; a conflict or a FIX is a fix round for the package's agent. Its RESULT line in the log is the step's state.
2. **Devices:** a night without a device (`ANDROID_SERIAL` unset; owner, 2026-10-27) logs `DEVICE SKIPPED` after each pass and runs no annabell device step. Otherwise only the night's device, plugged in by the owner, and only for a queue step whose lane says "night (the night's device)" (annabell). The night's device is `$ANDROID_SERIAL`, set when `night.sh` starts: the Tab One (`HA24BZ2Y`), or the Fairphone 6 (`4d42e62f`) while APODroid's night has the Tab One (owner, 2026-10-21). APODroid's locks are not ours, so a night on the Fairphone never touches `HA24BZ2Y`; After each Opus pass night.sh itself runs `scripts/pipeline.sh device <n>` (henri is not asked; A41); the next Opus pass reads its `CORE DEVICE` line, and a `new` case is a FIX. The night's device stays unlocked: the owner unlocks it once at plug-in, and its saved settings (`.coord/devices/<serial>.orig`, `STAY_ON=7`) keep the screen on while charging; never remove a PIN (banking keys; owner, 2026-10-22). Nobody else runs `adb` or `build.sh`. A missing or `unauthorized` tablet is not a failure: the worker says so in its report, the step stays unmerged and runs by day.
3. **henri decides nothing.** Anything this section does not settle: the pipeline logs it, and henri hands it to the next Opus pass (at once, if it blocks the queue). **Follow every Opus-pass recommendation as written.** Plan changes go to the owner through `docs/decisions.md` "Needs the user", written by the Opus pass.
4. **Workers tick their own backlog line** and file their "Needs the user" items on their branch (rules section 5); the audit sees them in the diff.
5. **Opus pass:** `scripts/pipeline.sh pass <n> "<IDs with merge commits or unmerged branches>" "<open questions or none>"` after every three finished packages (merged or left unmerged; fix packages from a pass count), and the last pass at the end of the queue. Each FIX line of its reply runs as `scripts/pipeline.sh <agent> "<prompt>" --id <ID>f1 --branch <branch> --model <m> --audit-model auto`, then QUEUE is followed. A prompt never holds a backtick or a `$` (`night.sh` refuses them; two refusals in a row end the night). The last pass's FIX packages get only their audit, then the report.
6. **Log:** the pipeline writes one line per step in `.coord/log.md` (time from `date`, step, agent and model, outcome, commit); `night.sh` logs each henri reply. The log is the queue state: henri continues from the first step without its result line (`MERGED`, `NOT MERGED` or `SKIPPED`).
7. **Usage limit:** the pipeline exits 75 and `night.sh` waits 30 minutes and retries, at most six times, then logs `STOPPED`. No retry loops in agents. The owner resumes with `scripts/night.sh` again. A usage limit in the two closing steps (rule 9) waits and retries that step.
8. **A step that ends without a RESULT line on stdout** (the pipeline died; A10 makes every exit print one): henri runs the same step once more; if the log then shows it twice without a RESULT, he skips it and goes on. **Worker gone without a report** (no commit): the pipeline logs `NOT MERGED (no commits)` and keeps the worktree; henri runs the same step once more (the pipeline resumes the branch). If that fails too, go on.
9. **The end:** after the last pass and its FIX packages, `scripts/pipeline.sh report` writes and commits the shift report; henri then answers `SHIFT DONE`. **On time (A17):** start `scripts/night.sh --until <HH:MM>` (`--dry-run` shows the plan); from that time, or at `--max-steps` minus 2, henri is asked only for the last Opus pass (or `NO PASS`), then night.sh runs the report and stops. The pipeline merges only the commit its audit read and stops with `NOT MERGED (the branch is not the audited HEAD)` otherwise.

### The queue (the night of 2026-10-27; steps 101–135 are done or dropped)
Estimates are wall-clock guesses from the log (a package 25 min to 2 h from start to MERGED; an engine patch adds a rebuild). A package merged by day is skipped (log it); a step whose "After" is not merged is skipped for that night and stays in the queue. The audit model follows rule 1. The Opus passes come from rule 5 (about 25 min each, after every three finished packages, FIX packages included) and are not rows. About 8 hours to 06:30 with the passes; 143 and 144 run only if the night has room, else they open the next night's queue.

| Step | What | Agent, model | Branch | After | Est. |
|---|---|---|---|---|---|
| 136 | [G113](packages/G113.md): a probability off the integers is 0; negbinomial_icdf exact (F101, F104) | gorge, Opus | `p1/gorge-pmfint` | — | 75 min |
| 137 | [G114](packages/G114.md): the census sees Giac's sequence answers (F108) | gorge, Sonnet | `p1/gorge-censusseq` | — | 40 min |
| 138 | [R72](packages/R72.md): parse.ts in three files, no behaviour change (before R4a by day) | ron, Opus | `p1/ron-m4a-parsesplit` | — | 50 min |
| 139 | [G115](packages/G115.md): atan near 1 is not π/4 (F113) | gorge, Opus | `p1/gorge-atannearone` | — | 75 min |
| 140 | [A26](packages/A26.md): the docs check sees every live doc | annabell, Sonnet | `p1/annabell-docsindex` | — | 25 min |
| 141 | [G116](packages/G116.md): the engine fuzzer, the oracle sweep at the edges | gorge, Opus | `p1/gorge-fuzz` | — | 2 h |
| 142 | [G117](packages/G117.md): a range a..b is not a decimal (F83) | gorge, Opus | `p1/gorge-rangeliteral` | — | 45 min |
| 143 | [G118](packages/G118.md): abs squared of a complex number (F111) | gorge, Opus | `p1/gorge-abssquare` | — | 75 min |
| 144 | [G79](packages/G79.md): the G2 checklist cannot drift from g2.yaml | gorge, Sonnet | `p1/gorge-g2check` | — | 30 min |
| 190 | **The last Opus pass** on what came after the last pass, then its FIX packages | Opus | — | — | 20 min + fixes |
| 191 | Shift report, then stop | — | — | — | 10 min |

### The commands henri replies with (one per decision; `scripts/night.sh` runs it)
- `scripts/pipeline.sh <agent> "<ID>" --model <sonnet|opus> --audit-model auto`: the next queue step not done (the queue's skip rule above); `--audit-model opus` where its row says "audit Opus".
- `scripts/pipeline.sh <agent> "<ID>" --no-worker --audit-model auto`: a review-only merge of a finished branch.
- `scripts/pipeline.sh <agent> "<FIX prompt, verbatim>" --id <IDf1> --branch <branch> --model <m> --audit-model auto`: a FIX line of the last Opus pass, one per call, in order. No backtick and no `$` anywhere in the line.
- `scripts/pipeline.sh pass <n> "<IDs with merge commits or unmerged branches>" "<open questions or none>"`.
- `scripts/pipeline.sh report`, then `SHIFT DONE`.

### Opus pass (instructions for the Opus agent)
You are the shift's quality gate and its decision-maker; henri executes your reply literally. Work in the worktree where `phase-1` is checked out (the pipeline tells you which); no code changes.
1. For each package: its package file (`docs/shifts/packages/<ID>.md`), its report (`git log -1 <merge>^2`, or the branch tip if unmerged), its diff (`git diff <merge>^1 <merge>`), and the audit's verdict from `.coord/log.md`.
2. Run once on `phase-1` (from `app/`, with absolute `GIAC_OUT`, `PASCALINE_DL_DIR` and `PASCALINE_QALC_DL_DIR`): typecheck, `npm run index` then `FIND_INDEX=required npm test`, e2e (its `CORE` line: the core list, R74), and the golden gate when engine or parser code changed. Take `tools/devlock.sh acquire host-cpu opus 1800` around them.
3. Check what an audit tends to miss: wrong or invented expected values (sources), a missing round trip, silent wrong numbers or marks (principle 3), scope, keys that moved, tests that pass for the wrong reason. An engine package gives its Giac calls per Enter before and after (`tools/probes/engine-calls.ts`). **The net (P23):** a core case that fails and is not `known:` is a FIX now; a device run since the last pass (night.sh's `CORE DEVICE` line, A33, A41) with a new failing case is a FIX or, past a day of work, a backlog bug line; a package that adds a feature its file does not name is a fix-or-revert.
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
`docs/shifts/<date>-night-report.md`, short and plain, from the log (`scripts/pipeline.sh report` starts a fresh writer with the log's night section on stdin): the core list's count on desktop and on the night's device (or DEVICE SKIPPED) first; what was merged (with commits); what is unmerged and why; the Opus passes' NOTES; what the owner must do (items under "Needs the user", the morning check); the queue left for the next night. Commit it on `phase-1` with `git commit -s` and the Sonnet trailer. Never push.

## 2. Read before you start (every package)
The pipeline hands you a bundle: your package file (`docs/shifts/packages/<ID>.md`), the first 400 lines of every file the block names by repo path, the report format below and the definition of done of section 8. Read further files by section (`grep -n '^#' <file>`, then the range), never whole files: every file you read is sent again on every later turn. The big shared docs are named in the blocks by bare name on purpose (`decisions.md "R15c"`, `backlog.md item 37`), so they stay out of the bundle: open only the section named.
- Your worktree and branch exist (`p1/<name>-<slug>` from `phase-1`, made by the pipeline); never switch branches in the main checkout. The shared paths and locks of rules section 5 (`GIAC_OUT`, `PASCALINE_DL_DIR`, `PASCALINE_QALC_DL_DIR`, `tools/devlock.sh` for heavy work) are set by the pipeline.
- [04-architecture.md](../04-architecture.md) sections 0 and 8, and the sections your package names. Where docs/04 and docs/02 differ, docs/04 wins.
- `docs/decisions.md` P23 (the core list is the net: a red case is a bug to fix before new work on the same code), P11, docs/03 section 0 rules 5–13 (they bind every package: one interaction model, keys never move, vertical space, removal tests), `docs/05-ui-plan.md` with its section 7, and `docs/feedback.md`.
- `docs/decisions.md`: P8, P9, P10, P15, P16, P17 and the defaults entry "2026-10-12 Architecture for the engineer core" (archive; docs/04 holds it). These are decided; don't reopen them. If a docs/04 decision turns out wrong in the code, don't change it silently: finish what you can, and put the evidence under "Needs a decision" in your report.
- **"Done when" names no shared doc (owner, 2026-10-24).** Text for a shared file (the list: rules section 5) goes in your report under "For shared files"; the Opus pass applies it, and an audit never sends a package back for it alone. Your package's own files and its backlog tick stay yours.
- **Scope:** only what your package file names: a fix that seems to need a new feature, key, view, setting or command stops and says so under "Needs a decision". Matrices are entered from the Tmpl palette (EN5's Shift + 5 waits).
- **No coordinator to message.** Stay inside the files your package names. Shared files follow rules section 5; devices are annabell's.

### Your report (every package)
End with a commit whose message body is the report. The audit and the Opus pass read it with `git log -1`. It holds:
- **Done:** what was built, item by item against the block's "Done when" lines.
- **Tests:** typecheck, vitest, e2e (with its `CORE` line) and golden counts as run.
  A test that passes on the old code is not a regression test: change it until it fails there, or list it under "Not done".
  Never run `app/scripts/behaviour-diff.ts` yourself: the audit runs it (A18; owner, 2026-10-22, after G76 lost 2 h to it).
- **Numbers:** for example the start chunk size before and after, or timings.
- **For shared files:** exact text for the backlog, decisions, THIRD_PARTY.md, docs/04, this brief. Never cut text you did not write to fit a docs budget: if a file is full, say so here and the Opus pass makes room.
- **Needs a decision:** anything left open.
- **Not done:** what's missing.

Then reply as the pipeline's prompt asks (at most five lines). Nobody is waiting for messages.

## 8. Definition of done
- **Each branch:** typecheck 0; `npm run index` (with `PASCALINE_DL_DIR` and `PASCALINE_QALC_DL_DIR` pointing at the main checkout's caches, as the pipeline sets them), then `FIND_INDEX=required npm test`, all pass (the Find query test fails rather than skips without the full index); e2e all pass, the core list included: every active case passes except its `known:` ones (the known-flaky `solve.spec.ts` persistence test and the Find 16 ms timing test may be re-run once); the golden gate when engine or parser code changed; by hand, `npm run gate` (from `app/`; `-- --quick` while working) runs all of these, the size test and a docs-size report in one command; SPDX headers; `git commit -s` with the trailer of the model that ran; the report commit; the start chunk size reported for UI packages; every "Done when" line of the block met or listed under "Not done".
- **Source size** (owner, 2026-10-20; `tools/docs-check.mjs` checks it, A22): no file grows past its line in `tools/line-baseline.yaml` and no new source file passes 800 lines, unless the same diff raises the line with a reason (the `calls-baseline.yaml` rule); a split lowers the line.
- **The net (P23):** a merge that turns a core case red is a bug the next Opus pass sends back as a FIX (section 0c, Opus pass step 3).

## 8a. Review and merge
Every review and merge is a pipeline run (rules section 4; CLAUDE.md): the audit by sofia on `git diff -U5 phase-1...<branch>` plus the block's "Done when" lines, then `git merge --no-ff --signoff` into `phase-1`. A finished branch from before the pipeline is merged with `scripts/pipeline.sh <agent> "<ID>" --no-worker` (A10). The Opus pass (section 0c) applies the reports' shared-file text, deletes merged package files and their rows, and files proposals under "Needs the user". Never push.
