<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Shift brief: after the core freeze, run by the owner

**Every package runs through `scripts/pipeline.sh`** (rules section 4): by day the owner starts one package at a time (`scripts/pipeline.sh <agent> "<ID>" --model <m>`, the table gives agent and model) and reads the RESULT line; at night `scripts/night.sh` runs the queue of section 0c. Nobody starts a worker or merges another way (CLAUDE.md). The standing rules in [rules.md](rules.md) apply; where the two differ, this brief wins. Each open package is one file in [packages/](packages/), in the shape the pipeline bundles (section 2). The shape of a package file: the heading `### <agent>, <ID>: <title>, branch \`p1/<agent>-<slug>\``; **Lane** (night-safe = no device, no APK, no eye on the UI; night (the night's device) = the device `night.sh` was started with, only, P23; day = the owner tries it or it changes the pipeline); **Starts when**; **Read** (repo paths get bundled, first 400 lines; the big shared docs by bare name and section); the steps; **Done when** (lines an auditor checks in the diff).

## 0. State and the path
`phase-1` at `af2eda6` on 2026-11-05 (the weekly night: 10 merges, passes 66–70; pushed with `master` and the moved test tag `v0.1.0-test`). CORE 66/66 desktop (`3df889f`, pass 70); CORE DEVICE 65/65 on the Tab One (`af2eda6`, device 70; one case is desktop only). Every merge: `git log --merges --oneline phase-1`; the audits are in the Opus passes' defaults (decisions.md, older ones in [archive/decisions-2026-10.md](../archive/decisions-2026-10.md)) and the night reports ([archive/shifts/](../archive/shifts/)).

### The path after the freeze (owner, 2026-10-27; decisions.md "P23")
**The freeze ended** on 2026-10-27. **The net stays:** every merge runs the core list (R74; [tests/core/core.yaml](../../tests/core/core.yaml), 66 cases, all active), night.sh runs the device's core list after each Opus pass when the night has a device (A33, A41), and the owner's [morning check](../../tests/core/MORNING.md) runs on the night's device. A red result is a bug to fix (a FIX of the next Opus pass, or a backlog bug line past a day of work), not a gate. **The pace** (owner, 2026-10-27; the date 2026-11-01): Claude Max runs to 2026-11-17. Each night carries about 9 hours of real work, the most important steps first, so a usage limit late costs the least; the day runs what needs the owner's eye.

**Two lanes** (owner, 2026-10-29; decisions.md P17 and "Owner answers of 2026-10-29"): lane A (ron's UI) and lane B (the release, then the engine) run around the clock, each with its own table in section 0c, merged through one queue (A47b). ron's packages run at night too: the owner's look moves to the milestone reviews (Lane A's queue), and a package's "owner's eye" item joins the next review. Device steps and the owner's acts (a key, a tag, a phone) stay by day. The order:
1. **Find:** built; A4b (the Tab One's timing, the bar's point 4) by day; R91's before/after is in [ONE-TIME.md](../../tests/core/ONE-TIME.md).
2. **The Settings base** (owner, 2026-10-27; decisions.md "Settings in the Mode sheet, and presets"; [mockups/settings.html](../mockups/settings.html)): merged up to R89 → R59 and R12b → R12c → R41; R53; R36, R33 → R40 (R37 parked).
3. **The units** (owner, 2026-10-29: right after R86, R57, R50e): R24b–R24d, G81, R60–R63, R71 and R92 (the units menu's Constants and Tools) merged.
4. **Lane B, to v0.1.0** (the APK and the website from one tag): A7, A9, A43, A45 and A48–A50 merged; A8 (the owner's test tag); then wrong numbers by reach, C4. The bar and the days: [release-0.1.0.md](../release-0.1.0.md); from its freeze (Thu 11-12) both lanes run only its fixes.
5. **Every morning:** the owner's check (MORNING.md, on the night's device when the night had one, about 10 minutes). The day session writes each failed step as a backlog bug line on phase-1 and logs one line in `.coord/log.md`: `- HH:MM morning <date>: clean` or `- HH:MM morning <date>: fails <ids>`.

**The weekly extreme night** (owner, 2026-10-29; replaces the nightly fuzz of 2026-10-27): once a week lane B runs the extreme-input packages (none open) and the fuzz, in 10-minute slices (G167: from `app/`, each command as `../tools/devlock.sh slice <name> node scripts/sweep.ts …`; n = 4 for the 5,000 `--edges` trees: a part of 1,250 takes about 2 min at G138's 90 s per 1,000 trees, never more than 5,000 trees a part (8 min): `--nightly --edges --seed <clock> --count 5000 --part i/4` for i = 1..4, then `--shrink <seed>`; a missing part is named and exit 1; a long shrink: `--shrink <seed> --part i/m` for each i, then `--shrink <seed> --join`), with its triage (each week the text of G138, its package file at d1278849, with a new ID); the Opus pass files the backlog lines. Wrong numbers of everyday or medium reach run any time, by reach.

**No package yet** (backlog, by reach): F73, F80, F85, F70, F71; the background stream F62, G94; what G116 finds. S20 (the MPFI spike) by day.

**The night review** (owner, 2026-11-01; `/night-review`, `.claude/skills/night-review/`): beside the lanes on Mon 11-02, Fri 11-06, Mon 11-09 and Fri 11-13, the last whose packages the lanes can build before 2026-11-17; its packages wait in its open note (`docs/research/night-review-<date>`, section 2), and section 0c takes them a few rows at a time.

**Why this order:** silent wrong numbers by reach first; the units right after the Settings base (owner, 2026-10-29).

### The day's packages (a device or an owner's act; the rest is in section 0c's tables)

| # | Package | Agent, model | Lane | Starts when merged | Size |
|---|---|---|---|---|---|
| [A61](packages/A61.md) | What the WebView answers to `persisted()` | annabell, Sonnet | day (the Fairphone) | R96f1 | ~0.2 d |

**Why these models:** Opus where a slip breaks entry, the unit chain or stored data for every later package, or gives a wrong number (P17: the engine, input and units); sandra and sofia run Opus; Sonnet elsewhere (an existing pattern, pinned by tests); the audit model follows P17.

## 0c. Night shifts: henri's plan (owner, 2026-10-14; queue rewritten 2026-10-27 after P23)
With the lanes, start both from the phase-1 worktree: `cd .claude/worktrees/phase-1 && setsid nohup scripts/night.sh --lane A --until 16:00 >> ../../../.tasks/night-<date>-A.out 2>&1 &` and the same with `--lane B` and `night-<date>-B.out` (`ANDROID_SERIAL=<the night's device>` in front of each when the night has one; night.sh writes `.tasks/night-<date>-<lane>.log`). The owner stops a lane with `scripts/night.sh --stop A` (or `B`; `all` for a night without lanes): it logs `STOPPED night.sh (lane A): by the owner` and the lane ends after its running step. A night without lanes: the same without `--lane` (`night-<date>.out`); `setsid`, as a closed terminal kills night.sh (2026-10-26). `scripts/night.sh` runs it (rules section 4): for every decision it starts a fresh henri (Sonnet, Read-only) who sees this section and the log's tail and replies with one `scripts/pipeline.sh` line; the script runs that line and asks again. **henri executes and decides nothing.** **Use the window** (owner, 2026-10-19): the queue runs until the usage limit or its end; what is not done stays in the queue for the next night (resumed from the log). The night queue holds what needs no APK and no eye on the UI (owner, 2026-10-18), except the night's device steps (rule 2).

### Rules for a night shift (they replace rules section 4's day use)
1. **One pipeline run at a time** in a night without lanes; with the lanes (`night.sh --lane A|B`, A47c) one per lane, merged through one queue (A47b). night.sh refuses a second start of a lane, a lane while a night without lanes runs, and the reverse (`.coord/night-A.pid`, `night-B.pid`, `night-all.pid`); never a worker started any other way. A package is `scripts/pipeline.sh <agent> "<ID>" --model <model from the table> --audit-model auto` (`--audit-model opus` where the queue's model column says "audit Opus"): fresh worker, checks, at most two fix rounds, sofia's audit (P17: the pipeline raises gorge packages, Opus workers and engine, input or units diffs to Opus), merge. A review-only merge is `scripts/pipeline.sh <agent> "<ID>" --no-worker --audit-model auto` (A10): phase-1 merged into the branch, checks, audit, merge; a conflict or a FIX is a fix round for the package's agent. Its RESULT line in the log is the step's state.
2. **Devices:** a night without a device (`ANDROID_SERIAL` unset; owner, 2026-10-27) logs `DEVICE SKIPPED` after each pass and runs no annabell device step. Otherwise only the night's device, plugged in by the owner, and only for a queue step whose lane says "night (the night's device)" (annabell). The night's device is `$ANDROID_SERIAL`, set when `night.sh` starts: the Tab One (`HA24BZ2Y`), or the Fairphone 6 (`4d42e62f`) while APODroid's night has the Tab One (owner, 2026-10-21). APODroid's locks are not ours, so a night on the Fairphone never touches `HA24BZ2Y`; After each Opus pass night.sh itself runs `scripts/pipeline.sh device <n>` (henri is not asked; A41); the next Opus pass reads its `CORE DEVICE` line, and a `new` case is a FIX. The night's device stays unlocked: the owner unlocks it once at plug-in, and its saved settings (`.coord/devices/<serial>.orig`, `STAY_ON=7`) keep the screen on while charging (by day: `tools/stay-awake.sh <serial> --restore-real` puts back `.orig.real`); never remove a PIN (banking keys; owner, 2026-10-22). Nobody else runs `adb` or `build.sh`. A missing or `unauthorized` tablet is not a failure: the worker says so in its report, the step stays unmerged and runs by day.
3. **henri decides nothing.** Anything this section does not settle: the pipeline logs it, and henri hands it to the next Opus pass (at once, if it blocks the queue). **Follow every Opus-pass recommendation as written.** Plan changes go to the owner through `docs/decisions.md` "Needs the user", written by the Opus pass.
4. **Workers tick their own backlog line** and file their "Needs the user" items on their branch (rules section 5); the audit sees them in the diff.
5. **Opus pass:** `scripts/pipeline.sh pass <n> "<IDs with merge commits or unmerged branches>" "<open questions or none>"` after every three finished packages (merged or left unmerged; fix packages from a pass count; in lanes each lane counts its own), and the last pass at the end of the queue. Each FIX line of its reply runs as `scripts/pipeline.sh <agent> "<prompt>" --id <ID>f1 --branch <branch> --model <m> --audit-model auto`, then QUEUE is followed. A prompt never holds a backtick or a `$` (`night.sh` refuses them; two refusals in a row end the night). The last pass's FIX packages get only their audit, then the report: lane A's night.sh writes it after lane B's night.sh has ended (at most 5 h); lane B's night ends after its last pass.
6. **Log:** the pipeline writes one line per step in `.coord/log.md` (time from `date`, step, agent and model, outcome, commit); `night.sh` logs each henri reply. In lanes every line of a lane starts with `[A]` or `[B]` after its time; henri reads his lane's last 80 lines and the other lane's finished steps since the night header. The log is the queue state: henri continues from the first step without its result line (`MERGED`, `NOT MERGED` or `SKIPPED`).
7. **Usage limit:** the pipeline exits 75 and `night.sh` waits 30 minutes and retries, at most six times, then logs `STOPPED`. No retry loops in agents. The owner resumes with `scripts/night.sh` again. A usage limit in the two closing steps (rule 9) waits and retries that step.
8. **A step that ends without a RESULT line on stdout** (the pipeline died; A10 makes every exit print one): henri runs the same step once more; if the log then shows it twice without a RESULT, he skips it and goes on. **Worker gone without a report** (no commit): the pipeline logs `NOT MERGED (no commits)` and keeps the worktree; henri runs the same step once more (the pipeline resumes the branch). If that fails too, go on.
9. **The end:** after the last pass and its FIX packages, `scripts/pipeline.sh report` writes and commits the shift report; henri then answers `SHIFT DONE`. **On time (A17):** start `scripts/night.sh --until <HH:MM>` (`--dry-run` shows the plan); from that time, or at `--max-steps` minus 2, henri is asked only for the last Opus pass (or `NO PASS`), then night.sh runs the report and stops. The pipeline merges only the commit its audit read and stops with `NOT MERGED (the branch is not the audited HEAD)` otherwise.
10. **"Lane: day" (owner, 2026-10-29):** a package whose lane says day runs at night too, unless it needs a device or an owner's act (a key, a tag, the phone); its "owner's eye" item joins the next milestone review (section 0).
11. **Selftest:** a selftest step is `scripts/pipeline.sh selftest` (from A47a); its line `selftest: PASSED` finishes it; `selftest: FAILED` ends the night: henri answers `SHIFT DONE`, and the owner reads the log.
12. **No lanes in the morning** (a selftest failed): the owner starts `scripts/night.sh` without `--lane`, and henri runs lane B's rows, then lane A's, as one queue.

### Night 2026-11-05 to 11-06, to 05:30, both lanes on the Tab One (owner, 2026-11-05)
`ANDROID_SERIAL=HA24BZ2Y` for both lanes, `--until 05:30`; before the start the owner plugs in and unlocks the Tab One, and `tools/stay-awake.sh HA24BZ2Y --restore` runs (STAY_ON=7). CORE DEVICE after each pass. Lane A runs R132 (the release bar's point 4, owner 2026-11-05), then R59 (decisions.md "A62, R59's gate"), then the rest of its table; lane B runs G165, G166, G164, G167, A69, A71, then the rest of its table (owner, 2026-11-05: "add everything"; A65, A66 and A74 on the night's device). Every "After" was checked against the merges on 2026-11-05 ("–" is merged); a step whose "After" is not merged is skipped. Follow each Opus pass as written (rule 3).

### Lane A queue (ron's UI)
Milestone reviews (section 0): after R50e (with R116's gallery groups "Entry highlights (R116)" and the lifted --pick on the History picked row; R113's rings, gallery home-tips-small); after R24d (with R92's Constants and Tools; R108's gallery group "Decimal comma in apps"; R89 on the Fairphone: save two presets with different free keys and switch; R111's note at 360 px; R33's stored-name colour in each theme, decisions.md "Owner answers of 2026-11-02"; R120's gallery unitresult-t10-comma; R124's gallery group "Mark style (R124)" and R125's "Digit groups (R125)", ’ and , grouping only before the point since R125f1; G164's sample sources, decisions.md "Needs the user"; R59 on the Tab One: import a .txt library from Downloads and from Drive, paste a long one from the clipboard, read the 9 s notice).

| Step | What | Agent, model | Branch | After |
|---|---|---|---|---|
| 513 | [R135](packages/R135.md) a result too long to draw shows a drawn note, never raw LaTeX (F71) | ron, Sonnet | `p1/ron-longresult` | – |
| 482 | [R126](packages/R126.md) the backup's keys, pad cells and presets written down for your AI | ron, Sonnet | `p1/ron-backupformat` | – |
| 483 | [R129](packages/R129.md) the study's mockups: results mode, the six top-right keys | ron, Sonnet | `p1/ron-resultsmockup` | S25 |

### Lane B queue (the release, then the engine)
A8 and [A57](packages/A57.md) run by day; the night review's queue goes on in [its note](../research/night-review-2026-11-02.md) section 2.

| Step | What | Agent, model | Branch | After |
|---|---|---|---|---|
| 478 | [A69](packages/A69.md) a night stops before the disk is full; runs leave no temp folders | annabell, Sonnet | `p1/annabell-diskguard` | – |
| 479 | [A71](packages/A71.md) the red-first check can test against the stock engine | annabell, Sonnet | `p1/annabell-redstock` | – |
| 484 | [A74](packages/A74.md) Find per key on the Tab One again after R132 (E3, the bar's point 4) | annabell, Sonnet | `p1/annabell-findagain` | R132 |
| 491 | [G175](packages/G175.md) √ of exp(z) or of a complex power keeps the principal root (F135, F134; silent) | gorge, Opus | `p1/gorge-sqrtexp` | – |
| 492 | [G177](packages/G177.md) cos, sin, tan of half a complex atan, asin, acos take the right sign (F137; silent) | gorge, Opus | `p1/gorge-halfatrig` | – |
| 493 | [G171](packages/G171.md) a non-square power stays refused when the input calls a storing function (F88; silent) | gorge, Opus | `p1/gorge-nonsquarestore` | – |
| 494 | [G176](packages/G176.md) the limit of trunc at an integer from the right side (F170) | gorge, Opus | `p1/gorge-limtrunc` | – |
| 495 | [G178](packages/G178.md) a divergent integral inside an expression is refused, not ⚠ 1 (F115) | gorge, Opus | `p1/gorge-intdivexpr` | – |
| 496 | [G168](packages/G168.md) no value is a plain refusal: `undef`, empty calls, `DelAVars()`, the budget message (F93, F109) | gorge, Opus | `p1/gorge-novalue` | – |
| 497 | [G183](packages/G183.md) a crashed engine restarts and says so, never a JS error text (F122, F145, G94) | gorge, Opus | `p1/gorge-trapnet` | – |
| 498 | [G184](packages/G184.md) a Home step stopped by the time budget says "Stopped: it took too long" (F70) | gorge, Opus | `p1/gorge-floatstop` | – |
| 499 | [G185](packages/G185.md) a Home Enter that does not return in time is stopped with the time-limit message (F62) | gorge, Opus | `p1/gorge-homewatch` | G183 |
| 500 | [G169](packages/G169.md) a list as a distribution's x gives one value per element (F105, F93) | gorge, Opus | `p1/gorge-listlast` | – |
| 501 | [G172](packages/G172.md) a list element only a double can value shows its number with ⚠ (F73) | gorge, Opus | `p1/gorge-listdouble` | – |
| 502 | [G173](packages/G173.md) no Giac print forms: empty `seq[]`, `matrix[…]` in a list, `when` (F127, F108) | gorge, Opus | `p1/gorge-printforms` | – |
| 503 | [G179](packages/G179.md) a stored value read later keeps the mark it left with (F80, F63) | gorge, Opus | `p1/gorge-storedmark` | – |
| 504 | [G180](packages/G180.md) DEG sqrt(asinh(asin(3.7))) gets the same mark on any clock (F159) | gorge, Opus | `p1/gorge-degmarkclock` | – |
| 505 | [G186](packages/G186.md) Home's checks end on acos, asin, acosh of a huge or tiny real (F145) | gorge, Opus | `p1/gorge-cuthang` | – |
| 506 | [G187](packages/G187.md) a power that underflows past the range says Underflow, not a stack overflow (F122) | gorge, Opus | `p1/gorge-powunder` | – |
| 507 | [G170](packages/G170.md) ilaplace leaves no broken entry in Giac's variable list (F89) | gorge, Opus | `p1/gorge-ilaplacevars` | – |
| 508 | [G174](packages/G174.md) names stored through an argument (QR, LU…) reach the log; restart shows none of ours (F87, F96, F97) | gorge, Opus | `p1/gorge-argnames` | – |
| 509 | [G181](packages/G181.md) atanh and atan of a tiny non-real exact argument give z (F177) | gorge, Opus | `p1/gorge-atanhtiny` | G166 |
| 510 | [G182](packages/G182.md) the why line past the 1000-digit cap says what was checked (F178) | gorge, Sonnet | `p1/gorge-whypastcap` | G181 |
| 511 | [G188](packages/G188.md) the view sweep survives an engine crash and names it (G94) | gorge, Opus | `p1/gorge-viewcrash` | – |
| 485 | [A64](packages/A64.md) two pipeline guards that misfire | annabell, Opus | `p1/annabell-guardfix` | – |
| 486 | [A67](packages/A67.md) red-first counts only a test the branch adds or tightens | annabell, Opus | `p1/annabell-redfirst` | – |
| 487 | [A65](packages/A65.md) the sync folder on Android (the night's device) | annabell, Opus | `p1/annabell-syncfolder` | – |
| 488 | [A66](packages/A66.md) an optional key click, off by default (the night's device) | annabell, Sonnet | `p1/annabell-keyclick` | – |
| 489 | [S25](packages/S25.md) results mode and the six top-right keys, a study | sandra, Opus | `p1/sandra-resultskeys` | – |
| 490 | [A73f1](packages/A73f1.md) why a CAS-view start is 200 ms slower than Home (the night's device) | annabell, Sonnet | `p1/annabell-casstart` | R133 |

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
