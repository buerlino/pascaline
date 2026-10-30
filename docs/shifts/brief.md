<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Shift brief: after the core freeze, run by the owner

**Every package runs through `scripts/pipeline.sh`** (rules section 4): by day the owner starts one package at a time (`scripts/pipeline.sh <agent> "<ID>" --model <m>`, the table gives agent and model) and reads the RESULT line; at night `scripts/night.sh` runs the queue of section 0c. Nobody starts a worker or merges another way (CLAUDE.md). The standing rules in [rules.md](rules.md) apply; where the two differ, this brief wins. Each open package is one file in [packages/](packages/), in the shape the pipeline bundles (section 2). The shape of a package file: the heading `### <agent>, <ID>: <title>, branch \`p1/<agent>-<slug>\``; **Lane** (night-safe = no device, no APK, no eye on the UI; night (the night's device) = the device `night.sh` was started with, only, P23; day = the owner tries it or it changes the pipeline); **Starts when**; **Read** (repo paths get bundled, first 400 lines; the big shared docs by bare name and section); the steps; **Done when** (lines an auditor checks in the diff).

## 0. State and the path
`phase-1` at `fa52380` on 2026-10-29, after the fourteenth night ([its report](../archive/shifts/2026-10-29-night-report.md)), the day-night of 2026-10-29 ([its section](../archive/shifts/2026-10-29-night-report-2.md)) and the evening's A44, G131, G132 (Opus pass 12: all ok; F134, F135 filed). CORE 66/66 desktop (`2fb13a4`); CORE DEVICE 65/65 on the Fairphone 6 (`35b6dc6`, one case is desktop only). Every merge: `git log --merges --oneline phase-1`; the audits are in the Opus passes' defaults (decisions.md, older ones in [archive/decisions-2026-10.md](../archive/decisions-2026-10.md)) and the night reports ([archive/shifts/](../archive/shifts/)).

### The path after the freeze (owner, 2026-10-27; decisions.md "P23")
**The freeze ended** on 2026-10-27, before its count: repeated green runs added nothing, and the mornings' failures were UI (c46: F110, F117), not the engine. **The net stays:** every merge runs the core list (R74; [tests/core/core.yaml](../../tests/core/core.yaml), 66 cases, all active), night.sh runs the device's core list after each Opus pass when the night has a device (A33, A41), and the owner's [morning check](../../tests/core/MORNING.md) runs on the night's device. A red result is a bug to fix (a FIX of the next Opus pass, or a backlog bug line past a day of work), not a gate. **The pace** (owner, 2026-10-27): about two weeks of Claude Max are left (to about 2026-11-10). Each night carries about 9 hours of real work, the most important steps first, so a usage limit late costs the least; the day runs what needs the owner's eye.

**Two lanes** (owner, 2026-10-29; decisions.md P17 and "Owner answers of 2026-10-29"): once A47a–A47c are merged, lane A (ron's UI) and lane B (the release, then the engine) run around the clock, each with its own table in section 0c, merged through one queue (A47b); until then one run at a time. ron's packages run at night too: the owner's look moves to three milestone reviews (after R87; after R86, R57, R50e; after R24d), and a package's "owner's eye" item joins the next review. Device steps and the owner's acts (a key, a tag, a phone) stay by day. The order:
1. **Find:** R4a merged (`b9f0042`, 2026-10-28; R90 by day); R91 (`e80eda0`: start chunk 61.02 → 57.81 kB gzip, pin 58.5 kB; the Fairphone before/after waits for annabell), R15c3 (`6e43091`), R49 (`d60fbfb`), R87 (`56d017f`) merged; then R4b.
2. **The Settings base** (owner, 2026-10-27; decisions.md "Settings in the Mode sheet, and presets"; [mockups/settings.html](../mockups/settings.html)): R85 (`1d35189`) and R49 merged, then R86, R57 (R4b sets the free keys in R49's levels; the comma is the owner's daily use), R50e; after the units: R70, R15c4, R38a → R38b, R59; R88 (after R4b, R57, R50e) → R89; R55 (after R15c4); R53; R12b → R12c → R41; R36, R33 → R37, R40.
3. **The units** (owner, 2026-10-29: right after R86, R57, R50e): R24b → R24c → R24d, R60–R63, R71; G81 with them.
4. **Lane B, to v0.1.0** (the APK and the website from one tag): A43 (an update keeps the data, on a device by day; A48 and A50 merged), A7 (signing, the owner's key made off this laptop), A49 (after R91), A45 (after R87, A49), A8 (the owner's test tag); A9 with the owner's phone by day (F41); then wrong numbers by reach, C4.
5. **Every morning:** the owner's check (MORNING.md, on the night's device when the night had one, about 10 minutes). The day session writes each failed step as a backlog bug line on phase-1 and logs one line in `.coord/log.md`: `- HH:MM morning <date>: clean` or `- HH:MM morning <date>: fails <ids>`.

**The weekly extreme night** (owner, 2026-10-29; replaces the nightly fuzz of 2026-10-27): once a week lane B runs the extreme-input packages (G133, G134 now) and the fuzz, `node scripts/sweep.ts --nightly --edges` once with its triage, as a one-night package with a new ID written from G136's text (it uses A44's known-rows file); the Opus pass files the backlog lines. Wrong numbers of everyday or medium reach run any time, by reach.

**No package yet** (backlog, by reach): F73 (it waited for the end of the freeze), F80, F85, F70, F71; the background stream F62, G94, F106; what G116 finds. S20 (the MPFI spike) by day.

**Why this order:** the lanes first (A47a–A47c): every later run uses them; silent wrong numbers by reach; R91 before R49 and A49 (room in the start chunk; A49 handles its chunks); A43 → A7 (stored data safe before the first signed release); R87 and A49 before A45 (owner, 2026-10-29); R15c3 and R49 before R4b (R4b fills the user keys in R49's levels); the units right after R86, R57, R50e (owner, 2026-10-29).

### The day's packages (a device or an owner's act; the rest is in section 0c's tables)

| # | Package | Agent, model | Lane | Starts when merged | Size |
|---|---|---|---|---|---|
| [A9](packages/A9.md) | Key vibration on the owner's phone | annabell, Sonnet | day (device) | the phone connected | ~0.5 d |
| [A43](packages/A43.md) | An app update keeps the user's data (before A7) | annabell, Sonnet | day (device) | A50 | ~0.5 d |
| [A7](packages/A7.md) | Release signing | annabell, Sonnet | day (the owner's key) | A48, A43; the key's table filled | ~0.5 d |
| [A8](packages/A8.md) | The release workflow | annabell, Opus | day (the owner's test tag) | A7 | ~0.5 d |

**Why these models:** Opus where a slip breaks entry, the unit chain or stored data for every later package, or gives a wrong number (P17: the engine, input and units); sandra and sofia run Opus; Sonnet elsewhere (an existing pattern, pinned by tests); the audit model follows P17.

## 0c. Night shifts: henri's plan (owner, 2026-10-14; queue rewritten 2026-10-27 after P23)
Tonight's queue (one lane, to 07:00) comes first, then each lane's table; With the lanes, start both from the phase-1 worktree: `cd .claude/worktrees/phase-1 && setsid nohup scripts/night.sh --lane A --until 16:00 >> ../../../.tasks/night-<date>-A.out 2>&1 &` and the same with `--lane B` and `night-<date>-B.out` (`ANDROID_SERIAL=<the night's device>` in front of each when the night has one; night.sh writes `.tasks/night-<date>-<lane>.log`). The owner stops a lane with `scripts/night.sh --stop A` (or `B`; `all` for a night without lanes): it logs `STOPPED night.sh (lane A): by the owner` and the lane ends after its running step. **Start it from the phase-1 worktree:** `cd .claude/worktrees/phase-1 && setsid nohup scripts/night.sh --until 06:30 >> ../../../.tasks/night-<date>.out 2>&1 &`, with `ANDROID_SERIAL=<the night's device>` in front when the night has one (night.sh writes `.tasks/night-<date>.log` itself; the main checkout may be on another branch, without `scripts/`; `setsid` because a closed terminal kills night.sh but not its running pipeline, 2026-10-26). `scripts/night.sh` runs it (rules section 4): for every decision it starts a fresh henri (Sonnet, Read-only) who sees this section and the log's tail and replies with one `scripts/pipeline.sh` line; the script runs that line and asks again. **henri executes and decides nothing.** **Use the window** (owner, 2026-10-19): the queue runs until the usage limit or its end; what is not done stays in the queue for the next night (resumed from the log). The night queue holds what needs no APK and no eye on the UI (owner, 2026-10-18), except the night's device steps (rule 2).

### Rules for a night shift (they replace rules section 4's day use)
1. **One pipeline run at a time** in a night without lanes; with the lanes (`night.sh --lane A|B`, A47c) one per lane, merged through one queue (A47b). night.sh refuses a second start of a lane, a lane while a night without lanes runs, and the reverse (`.coord/night-A.pid`, `night-B.pid`, `night-all.pid`); never a worker started any other way. A package is `scripts/pipeline.sh <agent> "<ID>" --model <model from the table> --audit-model auto` (`--audit-model opus` where the queue's model column says "audit Opus"): fresh worker, checks, at most two fix rounds, sofia's audit (P17: the pipeline raises gorge packages, Opus workers and engine, input or units diffs to Opus), merge. A review-only merge is `scripts/pipeline.sh <agent> "<ID>" --no-worker --audit-model auto` (A10): phase-1 merged into the branch, checks, audit, merge; a conflict or a FIX is a fix round for the package's agent. Its RESULT line in the log is the step's state.
2. **Devices:** a night without a device (`ANDROID_SERIAL` unset; owner, 2026-10-27) logs `DEVICE SKIPPED` after each pass and runs no annabell device step. Otherwise only the night's device, plugged in by the owner, and only for a queue step whose lane says "night (the night's device)" (annabell). The night's device is `$ANDROID_SERIAL`, set when `night.sh` starts: the Tab One (`HA24BZ2Y`), or the Fairphone 6 (`4d42e62f`) while APODroid's night has the Tab One (owner, 2026-10-21). APODroid's locks are not ours, so a night on the Fairphone never touches `HA24BZ2Y`; After each Opus pass night.sh itself runs `scripts/pipeline.sh device <n>` (henri is not asked; A41); the next Opus pass reads its `CORE DEVICE` line, and a `new` case is a FIX. The night's device stays unlocked: the owner unlocks it once at plug-in, and its saved settings (`.coord/devices/<serial>.orig`, `STAY_ON=7`) keep the screen on while charging; never remove a PIN (banking keys; owner, 2026-10-22). Nobody else runs `adb` or `build.sh`. A missing or `unauthorized` tablet is not a failure: the worker says so in its report, the step stays unmerged and runs by day.
3. **henri decides nothing.** Anything this section does not settle: the pipeline logs it, and henri hands it to the next Opus pass (at once, if it blocks the queue). **Follow every Opus-pass recommendation as written.** Plan changes go to the owner through `docs/decisions.md` "Needs the user", written by the Opus pass.
4. **Workers tick their own backlog line** and file their "Needs the user" items on their branch (rules section 5); the audit sees them in the diff.
5. **Opus pass:** `scripts/pipeline.sh pass <n> "<IDs with merge commits or unmerged branches>" "<open questions or none>"` after every three finished packages (merged or left unmerged; fix packages from a pass count; in lanes each lane counts its own), and the last pass at the end of the queue. Each FIX line of its reply runs as `scripts/pipeline.sh <agent> "<prompt>" --id <ID>f1 --branch <branch> --model <m> --audit-model auto`, then QUEUE is followed. A prompt never holds a backtick or a `$` (`night.sh` refuses them; two refusals in a row end the night). The last pass's FIX packages get only their audit, then the report: lane A's night.sh writes it after lane B's night.sh has ended (at most 5 h); lane B's night ends after its last pass.
6. **Log:** the pipeline writes one line per step in `.coord/log.md` (time from `date`, step, agent and model, outcome, commit); `night.sh` logs each henri reply. In lanes every line of a lane starts with `[A]` or `[B]` after its time; henri reads his lane's last 80 lines and the other lane's finished steps since the night header. The log is the queue state: henri continues from the first step without its result line (`MERGED`, `NOT MERGED` or `SKIPPED`).
7. **Usage limit:** the pipeline exits 75 and `night.sh` waits 30 minutes and retries, at most six times, then logs `STOPPED`. No retry loops in agents. The owner resumes with `scripts/night.sh` again. A usage limit in the two closing steps (rule 9) waits and retries that step.
8. **A step that ends without a RESULT line on stdout** (the pipeline died; A10 makes every exit print one): henri runs the same step once more; if the log then shows it twice without a RESULT, he skips it and goes on. **Worker gone without a report** (no commit): the pipeline logs `NOT MERGED (no commits)` and keeps the worktree; henri runs the same step once more (the pipeline resumes the branch). If that fails too, go on.
9. **The end:** after the last pass and its FIX packages, `scripts/pipeline.sh report` writes and commits the shift report; henri then answers `SHIFT DONE`. **On time (A17):** start `scripts/night.sh --until <HH:MM>` (`--dry-run` shows the plan); from that time, or at `--max-steps` minus 2, henri is asked only for the last Opus pass (or `NO PASS`), then night.sh runs the report and stops. The pipeline merges only the commit its audit read and stops with `NOT MERGED (the branch is not the audited HEAD)` otherwise.
10. **"Lane: day" (owner, 2026-10-29):** a package whose lane says day runs at night too, unless it needs a device or an owner's act (a key, a tag, the phone); its "owner's eye" item joins the next milestone review (section 0).
11. **Selftest:** a selftest step is `scripts/pipeline.sh selftest` (from A47a); its line `selftest: PASSED` finishes it; `selftest: FAILED` ends the night: henri answers `SHIFT DONE`, and the owner reads the log.
12. **No lanes in the morning** (A47c not merged, or a selftest failed): the owner starts `scripts/night.sh` without `--lane`, and henri runs lane B's rows 401–405, then lane A's from 301, as one queue.

### Tonight: 2026-10-30 17:00 to Saturday 09:00, both lanes on the Tab One (owner, 2026-10-30)
`ANDROID_SERIAL=HA24BZ2Y` for both lanes, `--until 09:00`; CORE DEVICE after each pass. Tonight is lane B's weekly extreme night (rows 406–408 run). A step whose "After" is not merged is skipped. The FIX lines of Opus pass 18 (log, 17:52) run first in lane A, verbatim; lane B's A49f1 is row 403's package, not pass 17's FIX line.

### Lane A queue (ron's UI)
Milestone reviews (section 0): after R50e; after R24d.

| Step | What | Agent, model | Branch | After |
|---|---|---|---|---|
| 305 | R4bf1: Opus pass 18's FIX line, verbatim (R4b's pin to 59.25 kB, its docs lines) | ron, Sonnet | `p1/ron-m4-vars` | — |
| 307 | R57f1: Opus pass 18's FIX line, verbatim (a bare comma always separates arguments) | ron, Opus | `p1/ron-m4a-decimalcomma` | 305 run |
| 308 | [R50e](packages/R50e.md) Settings › Appearance | ron, Sonnet | `p1/ron-m4a-appearance` | R49 |
| 309 | [R24b](packages/R24b.md) the pad drawn over the keys | ron, Sonnet | `p1/ron-m5-unitpad` | R86, R57, R50e |
| 310 | [R24c](packages/R24c.md) the unit view entry | ron, Opus | `p1/ron-m5-unitview` | R24b |
| 311 | [R24d](packages/R24d.md) Find in a slot and the user cells | ron, Sonnet | `p1/ron-m5-usercells` | R24c, R4b |

### Lane B queue (the release, then the engine)
A43, A7, A8 and A9 run by day (section 0). Steps 406–408 run only on the weekly extreme night the owner names (tonight).

| Step | What | Agent, model | Branch | After |
|---|---|---|---|---|
| 401 | [A51](packages/A51.md) a timing check reruns on a quiet host | annabell, Sonnet | `p1/annabell-quietrerun` | — |
| 403 | [A49f1](packages/A49f1.md) A49 under App.svelte's line limit (replaces pass 17's FIX) | ron, Sonnet (audit Opus) | `p1/annabell-pwaharden` | 401 run |
| 405 | [A45](packages/A45.md) the web version on GitHub Pages | annabell, Sonnet (audit Opus) | `p1/annabell-pages` | R87, A49 |
| 406 | [G133](packages/G133.md) asin of a tiny imaginary number (F132) | gorge, Opus | `p1/gorge-asintiny` | the weekly night |
| 407 | [G134](packages/G134.md) asinh on its cut, ∛ of a tiny real (F131, F133) | gorge, Opus | `p1/gorge-cutsmall` | the weekly night |
| 408 | [G137](packages/G137.md) the weekly fuzz and its triage | gorge, Opus | `p1/gorge-nightfuzz-1030` | the weekly night |

### The commands henri replies with (one per decision; `scripts/night.sh` runs it)
- `scripts/pipeline.sh <agent> "<ID>" --model <sonnet|opus> --audit-model auto`: the next queue step not done (the queue's skip rule above); `--audit-model opus` where its row says "audit Opus".
- `scripts/pipeline.sh <agent> "<ID>" --no-worker --audit-model auto`: a review-only merge of a finished branch.
- `scripts/pipeline.sh <agent> "<FIX prompt, verbatim>" --id <IDf1> --branch <branch> --model <m> --audit-model auto`: a FIX line of the last Opus pass, one per call, in order. No backtick and no `$` anywhere in the line.
- `scripts/pipeline.sh pass <n> "<IDs with merge commits or unmerged branches>" "<open questions or none>"`.
- `scripts/pipeline.sh selftest`: a selftest step (rule 11): the shell tests (`scripts/pipeline.test.sh`, `scripts/night.test.sh`, `scripts/gc.test.sh`, `tools/devlock.test.sh`); stdout `RESULT selftest: PASSED` or `RESULT selftest: FAILED (<test>: <first failing line>)`; options after it are ignored.
- `scripts/pipeline.sh report`, then `SHIFT DONE`.

### Opus pass (instructions for the Opus agent)
You are the shift's quality gate and its decision-maker; henri executes your reply literally. Work in the worktree where `phase-1` is checked out (the pipeline tells you which); no code changes.
1. For each package: its package file (`docs/shifts/packages/<ID>.md`), its report (`git log -1 <merge>^2`, or the branch tip if unmerged), its diff (`git diff <merge>^1 <merge>`), and the audit's verdict from `.coord/log.md`.
2. Run once on `phase-1` (from `app/`, with absolute `GIAC_OUT`, `PASCALINE_DL_DIR` and `PASCALINE_QALC_DL_DIR`): typecheck, `npm run index` then `FIND_INDEX=required npm test`, e2e (its `CORE` line: the core list, R74), and the golden gate when engine or parser code changed. Take `tools/devlock.sh acquire host-cpu opus 1800` around them.
3. Check what an audit tends to miss: wrong or invented expected values (sources), a missing round trip, silent wrong numbers or marks (principle 3), scope, keys that moved, tests that pass for the wrong reason. An engine package gives its Giac calls per Enter before and after (`tools/probes/engine-calls.ts`). **The net (P23):** a core case that fails and is not `known:` is a FIX now; a device run since the last pass (night.sh's `CORE DEVICE` line, A33, A41) with a new failing case is a FIX or, past a day of work, a backlog bug line; a package that adds a feature its file does not name is a fix-or-revert.
4. Decide each "Needs a decision" item of these packages and each open question from the log: a default within the plan goes into `docs/decisions.md` (rules section 9); a plan change goes under "Needs the user" with your recommendation in one sentence. Apply the "For shared files" text of the packages' reports, delete each merged package's file and its row from section 0's table or 0c's queue, and run `node tools/docs-check.mjs`. Commit those doc changes on `phase-1` with `git commit -s` and the Opus trailer; the pipeline holds `integ` for the whole pass (A47b), so take no lock yourself. After a flake census (`FLAKES <n>` line in the log, file `.tasks/flakes-<date>.md`): write one backlog line per flaky test, named by file and title, and add a wall-clock test to `isTiming` in `app/scripts/pipeline-logs.ts`, the tests the pipeline reruns once (A25).
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
