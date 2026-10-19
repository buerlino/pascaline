<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Shift brief: milestone 4a "feel" and milestone 4 "Find and trust", with milestone 5's unit view beside them (run by the owner)

**Every package runs through `scripts/pipeline.sh`** (rules section 4): by day the owner starts one package at a time (`scripts/pipeline.sh <agent> "<ID>" --model <m>`, the table gives agent and model) and reads the RESULT line; at night `scripts/night.sh` runs the queue of section 0c. Nobody starts a worker or merges another way (CLAUDE.md). The standing rules in [rules.md](rules.md) apply; where the two differ, this brief wins. Each open package is one file in [packages/](packages/), in the shape the pipeline bundles (section 2). The shape of a package file: the heading `### <agent>, <ID>: <title>, branch \`p1/<agent>-<slug>\``; **Lane** (night-safe = no device, no APK, no eye on the UI; day = the owner tries it); **Starts when**; **Read** (repo paths get bundled, first 400 lines; the big shared docs by bare name and section); the steps; **Done when** (lines an auditor checks in the diff).

## 0. State and the path
`phase-1` on 2026-10-19 after the night (runs 53–74, Opus passes 20–27, `feef6e5`; what it left: [research/night-shift-check-2026-10-19.md](../research/night-shift-check-2026-10-19.md)). Before it, after Opus pass 19 (S7, `b6370a5`), checked as a whole ([research/check-2026-10-19.md](../research/check-2026-10-19.md): five silent wrong numbers, packages A15, G34, G21b, G35, G36, S10), then deeper ([research/deep-check-2026-10-19-angle-marks.md](../research/deep-check-2026-10-19-angle-marks.md)). Every merge and its commit: `git log --merges --oneline phase-1`; the audits are in the Opus passes' defaults (decisions.md, older ones in [archive/decisions-2026-10.md](../archive/decisions-2026-10.md)) and the night reports ([archive/shifts/](../archive/shifts/)).

### The path (owner, 2026-10-14; rewritten 2026-10-18 after the architecture pass and S7)
**By day, one pipeline at a time** (owner, 2026-10-18), in this order; each starts when the one before is merged:
0. **A17** before the next night if it fits; until then 0c's interim checks hold.
1. **R50b** (Pascaline in the app, half a day on the phone), **R15c1 → R15c2 → R15c3 → R15c4** (the R3 top cluster), **R55** (digit groups), **R49** (Settings rows), **R57** (the decimal comma, on R49's page pattern), **R50e** (Appearance; R50c, R50d at night).
2. **R4a** (Find on Math), **R4b** (Vars, Memory, the user keys), **R53** (results mode on the View key), **R36**, **R33**, **R37**, **R12b**, **R12c**, **R41**, **R40**.
3. The unit pad: **R24b** → **R24c** → **R24d** (after R4b).
4. annabell by day: **A16** (Enter p95, again after G53), **A9** and **A11** as soon as a device is connected; **A18** after G55 and A17; **A12** (G29 is merged); **A4b** after R4b; **A7 → A8** on the owner's go.
5. After S6: **R59** (also after R4b, G54 and A12), **R38a → R38b** (the owner's yes to S6's proposal first).

**At night** (section 0c), in the queue's order: S15 and the night check's packages, route R (R64 → G46), the checks' unit and gate packages, the sandra docs packages, then S12's removal packages (G45, R66–R68).

**Why this order:**
- R15c goes first among the feel packages: it changes keys the hand is learning (docs/03 rule 8). R4b sets the user keys, R53 uses the View key, R41 labels the keys, so all wait for it.
- R50b before R15c1 (owner, 2026-10-19): the R3 packages are written on its colour roles. R55 before R49: half a day of render code the owner then reads every day; R57 after R49 (its page pattern).
- The night check of 2026-10-19 ([research/night-shift-check-2026-10-19.md](../research/night-shift-check-2026-10-19.md)) goes first at night: silent marks (G48, G51) before Find makes `unapply` typable; S15 gives the passes room; G52 first, so no engine package raises the calls per Enter unseen (night check 2.3).
- Trust features after the code they build on: R33 and R37 after Find; R40 after G26 and R12b's tokens.
- The start chunk is 53.28 of 60 kB gzip (owner, 2026-10-19, set by A15; docs/04 8.3): every UI package reports its delta.

### The open packages
| # | Package | Agent, model | Lane | Starts when merged | Size |
|---|---|---|---|---|---|
| [S15](packages/S15.md) | decisions.md gets room again (≤ 34 kB) | sandra, Opus | night | now | ~0.25 d |
| [G48](packages/G48.md) | No `=` through an assignment that runs once | gorge, **Opus** | night | now; before R4a | ~0.75 d |
| [G47](packages/G47.md) | Golden cases for the displays G50 cut | gorge, Sonnet | night | now | ~0.25 d |
| [G51](packages/G51.md) | A CAS result that reads stored facts gets their mark | gorge, **Opus** | night | G48 | ~0.5 d |
| [G56](packages/G56.md) | Complex functions inside a stored function, in CAS | gorge, **Opus** | night | G51 | ~0.5 d |
| [G57](packages/G57.md) | A decision Giac cannot make is refused | gorge, **Opus** | night | G48 | ~0.5 d |
| [G52](packages/G52.md) | Giac calls per Enter in the golden gate | gorge, Sonnet | night | now | ~0.5 d |
| [G53](packages/G53.md) | The second decision costs at most 1.3× again | gorge, **Opus** | night | G52 | ~0.5 d |
| [G54](packages/G54.md) | Our function names in Giac text too | gorge, Sonnet | night | now; before R59 | ~0.5 d |
| [G55](packages/G55.md) | A behaviour diff between two trees | gorge, Sonnet | night | now | ~0.75 d |
| [S13](packages/S13.md) | Stored names from Giac's state (spike) | sandra, Opus | night | G48 | ~0.5 d |
| [A17](packages/A17.md) | The pipeline merges what it audited; `night.sh --until` | annabell, **Opus** | day | now | ~0.5 d |
| [A16](packages/A16.md) | Enter p95 on the Tab One after 2026-10-19 | annabell, Sonnet | day (device) | the Tab One connected | ~0.25 d |
| [A18](packages/A18.md) | The audit sees the behaviour diff | annabell, Sonnet | day | G55 and A17 | ~0.25 d |
| [R64](packages/R64.md) | The angle mode lives in our parser (route R) | ron, **Opus** | night | now (route R decided) | ~0.5 d |
| [G46](packages/G46.md) | Giac always in radians; pasexp goes | gorge, **Opus** | night | R64 | ~1 d |
| [G41](packages/G41.md) | σ beyond first order at a stationary point | gorge, **Opus** | night | G35; before R24c | ~0.5 d |
| [G37](packages/G37.md) | °C and °F inside a compound unit are an interval | gorge, **Opus** | night | G35; before R24c | ~0.5 d |
| [G40](packages/G40.md) | Angles in the unit view: inverses, ω·r, rpm | gorge, **Opus** | night | A15; before R24c | ~0.75 d |
| [G43](packages/G43.md) | The golden gate checks invariants across settings | gorge, Sonnet | night | A15 (store part: G34) | ~0.5 d |
| [G44](packages/G44.md) | Inverse distribution functions polished | gorge, **Opus** | night | A15 | ~0.5 d |
| [S11](packages/S11.md) | The unit result view as packages (R60–R63) | sandra, Opus | night | A14 | ~0.5 d |
| [G45](packages/G45.md) | One tie rule; the G2's Home answers on record | gorge, **Opus** | night | S12 | ~0.25 d |
| [R66](packages/R66.md) | The power form keeps Giac's principal root in Home | ron, **Opus** | night | S12 | ~0.25 d |
| [R67](packages/R67.md) | Letters e and i are names (R58b) | ron, **Opus** | night | S12, R66 | ~0.5 d |
| [R68](packages/R68.md) | ᴇ's leading 1 after an operator | ron, **Opus** | night | S12 | ~0.25 d |
| [R15c1](packages/R15c1.md) | The status line takes Apps, Menu and the views | ron, Sonnet | day | R50b | ~0.75 d |
| [R15c2](packages/R15c2.md) | The R3 keys: round pad, six user keys, the editing wing | ron, **Opus** | day | R15c1 | ~1.5 d |
| [R15c3](packages/R15c3.md) | The user keys' Alpha layer | ron, Sonnet | day | R15c2 | ~0.5 d |
| [R15c4](packages/R15c4.md) | First-start tips | ron, Sonnet | day | R15c2 | ~0.5 d |
| [R55](packages/R55.md) | Digit groups in drawn results | ron, Sonnet | day | R15c4 | ~0.5 d |
| [R49](packages/R49.md) | Settings as a list of rows, each with its own page | ron, Sonnet | day | R15c4 | ~0.75 d |
| [R50b](packages/R50b.md) | Pascaline in the app | ron, Sonnet | day, before R15c1 | A14 | ~0.5 d |
| [R50c](packages/R50c.md) | Theme generator, four more families | ron, Sonnet | night | R50b | ~0.75 d |
| [R50d](packages/R50d.md) | Plain keys and High contrast | ron, Sonnet | night | R50c | ~0.5 d |
| [R50e](packages/R50e.md) | Settings › Appearance | ron, Sonnet | day | R50d | ~1 d |
| [R57](packages/R57.md) | The decimal comma as a setting | ron, Sonnet | day | R49 and R50b | ~1 d |
| [R4a](packages/R4a.md) | Find on Math | ron, Sonnet | day | R15c chain (path step 2) | ~2 d |
| [R4b](packages/R4b.md) | Vars, Memory and the user keys from Find | ron, Sonnet | day | R4a and R15c3 | ~1 d |
| [R53](packages/R53.md) | Results mode on the View key (P16, S9) | ron, **Opus** | day | R15c2 and R4b | ~1.5 d |
| [R36](packages/R36.md) | A picked row says why it has its mark | ron, Sonnet | day | G22 (merged) | ~0.5 d |
| [R33](packages/R33.md) | Names with a value, marked on the line | ron, Sonnet | day | R4b | ~0.5 d |
| [R37](packages/R37.md) | The angle check | ron, Sonnet | day | R33 | ~0.75 d |
| [R12b](packages/R12b.md) | Visual pass: tokens and history rows | ron, Sonnet | day | R4b, R53, R50e | ~1.5 d |
| [R12c](packages/R12c.md) | Visual pass: press feedback, reduced motion | ron, Sonnet | day | R12b | ~1 d |
| [R41](packages/R41.md) | Key labels for TalkBack | ron, Sonnet | day | R12c | ~0.5 d |
| [R40](packages/R40.md) | Muted digits past a constant's uncertainty | ron, Sonnet | day | R41 | ~0.5 d |
| [R24b](packages/R24b.md) | The unit pad drawn over the keys | ron, Sonnet | day | now | ~1 d |
| [R24c](packages/R24c.md) | The unit view entry: slots, Enter, evaluation | ron, **Opus** | day | R24b, G35, G40, G41 | ~1 d |
| [R24d](packages/R24d.md) | Find in a slot and the user cells | ron, Sonnet | day | R24c and R4b | ~0.5 d |
| [R59](packages/R59.md) | The library rows: import and export (S4) | ron, Sonnet | day | R4b, S6, G54, A12 | ~0.5 d |
| [R38a](packages/R38a.md) | The backup: export everything | ron, Sonnet | day | S6 and the owner's yes | ~0.5 d |
| [R38b](packages/R38b.md) | The backup: restore from a file | ron, **Opus** | day | R38a | ~0.75 d |
| [A9](packages/A9.md) | Key vibration on the owner's phone | annabell, Sonnet | day (device) | the owner's phone connected | ~0.5 d |
| [A11](packages/A11.md) | Paste and Share on Android | annabell, Sonnet | day (device) | a device connected | ~0.5 d |
| [A12](packages/A12.md) | The defs replay re-measured on the Tab One | annabell, Sonnet | day (device) | the Tab One connected | ~0.25 d |
| [A4b](packages/A4b.md) | Find timing on the Tab One | annabell, Sonnet | day (device) | R4b; the Tab One connected | ~0.25 d |
| [A7](packages/A7.md) | Release signing and the version number | annabell, Sonnet | any time | the owner's go | ~0.5 d |
| [A8](packages/A8.md) | The release workflow | annabell, **Opus** | day | A7 | ~0.5 d |
| [S6](packages/S6.md) | Files in and out without INTERNET: the backup | sandra, Opus | night | A14 | ~0.5 d |
| [S8](packages/S8.md) | The outside-test protocol | sandra, Opus | night | S6 | ~0.25 d |

**Why these models:** Opus where a slip breaks entry, the unit chain or stored data for every later package, and where a slip gives a wrong number (the night's engine packages; the Sonnet ones get the Opus audit of night rule 1): R15c2 (it moves keys every test names), R53 (it hides the keypad; a wrong state leaves no keys), R24c (pad, slots and evaluation together), R38b (it overwrites stored data), A8 (the signing key on a machine we do not own); sandra runs Opus; Sonnet elsewhere (an existing pattern, pinned by tests); the audit model follows P17.
## 0c. Night shifts: henri's plan (owner, 2026-10-14; queue rewritten 2026-10-19)
The queue below is the next nights'. `scripts/night.sh` runs it (rules section 4): for every decision it starts a fresh henri (Sonnet, Read-only) who sees this section and the log's tail and replies with one `scripts/pipeline.sh` line; the script runs that line and asks again. **henri executes and decides nothing.** **Use the window** (owner, 2026-10-19): the queue runs until the usage limit or its end; what is not done stays in the queue for the next night (resumed from the log). The night queue holds what needs no APK, no device and no eye on the UI (owner, 2026-10-18); the rest of the ron lane runs by day.

### Rules for a night shift (they replace rules section 4's day use)
1. **One pipeline run at a time**, and never a worker started any other way. A package is `scripts/pipeline.sh <agent> "<ID>" --model <model from the table> --audit-model auto`: fresh worker, checks, at most two fix rounds, sofia's audit (P17: the pipeline raises gorge packages, Opus workers and engine, input or units diffs to Opus), merge. A review-only merge is `scripts/pipeline.sh <agent> "<ID>" --no-worker --audit-model auto` (A10): phase-1 merged into the branch, checks, audit, merge; a conflict or a FIX is a fix round for the package's agent. Its RESULT line in the log is the step's state.
2. **No devices:** nobody runs `adb` or `build.sh`. annabell is not used at night.
3. **henri decides nothing.** Anything this section does not settle: the pipeline logs it, and henri hands it to the next Opus pass (at once, if it blocks the queue). **Follow every Opus-pass recommendation as written.** Plan changes go to the owner through `docs/decisions.md` "Needs the user", written by the Opus pass.
4. **Workers tick their own backlog line** and file their "Needs the user" items on their branch (rules section 5); the audit sees them in the diff.
5. **Opus pass:** `scripts/pipeline.sh pass <n> "<IDs with merge commits or unmerged branches>" "<open questions or none>"` after every three finished packages (merged or left unmerged; fix packages from a pass count), and the last pass at the end of the queue. Each FIX line of its reply runs as `scripts/pipeline.sh <agent> "<prompt>" --id <ID>f1 --branch <branch> --model <m> --audit-model auto`, then QUEUE is followed. A prompt never holds a backtick or a `$` (`night.sh` refuses them; two refusals in a row end the night). The last pass's FIX packages get only their audit, then the report.
6. **Log:** the pipeline writes one line per step in `.coord/log.md` (time from `date`, step, agent and model, outcome, commit); `night.sh` logs each henri reply. The log is the queue state: henri continues from the first step without a RESULT line.
7. **Usage limit:** the pipeline exits 75 and `night.sh` waits 30 minutes and retries, at most six times, then logs `STOPPED`. No retry loops in agents. The owner resumes with `scripts/night.sh` again.
8. **A step that ends without a RESULT line** (the pipeline died; A10 makes every exit print one): henri runs the same step once more; if the log then shows it twice without a RESULT, he skips it and goes on. **Worker gone without a report** (no commit): the pipeline logs `NOT MERGED (no commits)` and keeps the worktree; henri runs the same step once more (the pipeline resumes the branch). If that fails too, go on.
9. **The end:** after the last pass and its FIX packages, `scripts/pipeline.sh report` writes and commits the shift report; henri then answers `SHIFT DONE`. **Until A17:** start `scripts/night.sh --max-steps 70`; a night running into the day ends after a RESULT line by stopping night.sh's loop process, never the pipeline.

### The queue (the next nights)
Estimates are wall-clock guesses. A package merged by day is skipped (log it); a step whose "after" is not merged is skipped for that night and stays in the queue. The audit model follows rule 1. The order: the silent wrong numbers by severity, then the gates and the docs, each after what it needs.

| Step | What | Agent, model | Branch | After | Est. |
|---|---|---|---|---|---|
| 30 | S15 decisions.md gets room again | sandra, Opus | `p1/sandra-decisionsroom` | — | 30 min |
| 31 | G52 Giac calls per Enter in the gate | gorge, Sonnet | `p1/gorge-m4-callcount` | — | 1 h |
| 32 | G48 no `=` through a run-once assignment | gorge, Opus | `p1/gorge-m4-runonce` | — | 1.5 h |
| 33 | G47 golden cases for the displays G50 cut | gorge, Sonnet | `p1/gorge-m4-shortprint` | — | 30 min |
| 34 | G51 a CAS result takes stored facts' mark | gorge, Opus | `p1/gorge-m4-casfacts` | G48 | 1 h |
| 35 | R64 the angle mode lives in our parser (route R) | ron, Opus | `p1/ron-m4-pasdeg` | — | 1.5 h |
| 36 | G46 Giac always in radians; pasexp goes | gorge, Opus | `p1/gorge-m4-radians` | R64 | 2.5 h |
| 37 | G56 complex functions inside a stored function | gorge, Opus | `p1/gorge-m4-complexbody` | G51 | 1 h |
| 38 | G57 a decision Giac cannot make is refused | gorge, Opus | `p1/gorge-m4-undecided` | G48 | 1 h |
| 39 | G37 °C inside a compound unit is an interval | gorge, Opus | `p1/gorge-m5-degcompound` | G35 | 1 h |
| 40 | G40 angles in the unit view | gorge, Opus | `p1/gorge-m5-angles` | A15 | 1.5 h |
| 41 | G43 invariants across settings in the gate | gorge, Sonnet | `p1/gorge-m4-invariants` | G34 | 1 h |
| 42 | G44 inverse distribution functions polished | gorge, Opus | `p1/gorge-m4-icdfpolish` | A15 | 1 h |
| 43 | G41 σ beyond first order at a stationary point | gorge, Opus | `p1/gorge-m5-sigma2` | G35 | 1 h |
| 44 | G53 the second decision at most 1.3× again | gorge, Opus | `p1/gorge-m4-decidecost` | G52 | 1.5 h |
| 45 | G54 our function names in Giac text | gorge, Sonnet | `p1/gorge-m4-ournames` | — | 1 h |
| 46 | G55 a behaviour diff between two trees | gorge, Sonnet | `p1/gorge-m4-behaviourdiff` | — | 1.5 h |
| 47 | S13 stored names from Giac's state (spike) | sandra, Opus | `p1/sandra-statefacts` | G48 | 1 h |
| 48 | S11 the unit result view as packages | sandra, Opus | `p1/sandra-unitresult` | A14 | 1 h |
| 49 | S6 files in and out without INTERNET | sandra, Opus | `p1/sandra-files` | S7 and A14 | 1 h |
| 50 | S8 the outside-test protocol | sandra, Opus | `p1/sandra-outside` | S6 | 30 min |
| 51 | R50c the theme generator and four more families | ron, Sonnet | `p1/ron-m4a-themegen` | R50b | 1.5 h |
| 52 | R50d Plain keys and High contrast in the components | ron, Sonnet | `p1/ron-m4a-plainkeys` | R50c | 1 h |
| 53 | G45 one tie rule, the G2's Home answers on record | gorge, Opus | `p1/gorge-m4-g2records` | S12 | 45 min |
| 54 | R66 the power form keeps Giac's principal root | ron, Opus | `p1/ron-m4-noR39` | S12 | 45 min |
| 55 | R67 letters e and i are names | ron, Opus | `p1/ron-m4-eiNames` | S12, R66 | 1 h |
| 56 | R68 ᴇ's leading 1 after an operator | ron, Opus | `p1/ron-m4-emark1` | S12 | 45 min |
| 57 | **The last Opus pass** on what came after pass 27, then its FIX packages | Opus | — | — | 20 min + fixes |
| 58 | Shift report, then stop | — | — | — | 10 min |

Not in the queue: the ron lane's day packages (section 0; R50c and R50d are queue steps); devices (A9, A4b, A11, A12, A16); A7 and A8 (the owner's go); A17 and A18 (the pipeline, by day); R59, R38a and R38b (after S6's report).

### The commands henri replies with (one per decision; `scripts/night.sh` runs it)
- `scripts/pipeline.sh <agent> "<ID>" --model <sonnet|opus> --audit-model auto`: the next queue step not done (skip steps the table or the log marks merged or skipped, and steps whose "after" is not merged).
- `scripts/pipeline.sh <agent> "<ID>" --no-worker --audit-model auto`: a review-only merge of a finished branch.
- `scripts/pipeline.sh <agent> "<FIX prompt, verbatim>" --id <IDf1> --branch <branch> --model <m> --audit-model auto`: a FIX line of the last Opus pass, one per call, in order. No backtick and no `$` anywhere in the line.
- `scripts/pipeline.sh pass <n> "<IDs with merge commits or unmerged branches>" "<open questions or none>"`.
- `scripts/pipeline.sh report`, then `SHIFT DONE`.

### Opus pass (instructions for the Opus agent)
You are the shift's quality gate and its decision-maker; henri executes your reply literally. Work in the worktree where `phase-1` is checked out (the pipeline tells you which); no code changes.
1. For each package: its package file (`docs/shifts/packages/<ID>.md`), its report (`git log -1 <merge>^2`, or the branch tip if unmerged), its diff (`git diff <merge>^1 <merge>`), and the audit's verdict from `.coord/log.md`.
2. Run once on `phase-1` (from `app/`, with absolute `GIAC_OUT`, `PASCALINE_DL_DIR` and `PASCALINE_QALC_DL_DIR`): typecheck, `npm run index` then `FIND_INDEX=required npm test`, e2e, and the golden gate when engine or parser code changed. Take `tools/devlock.sh acquire host-cpu opus 1800` around them.
3. Check what an audit tends to miss: wrong or invented expected values (sources), a missing round trip, silent wrong numbers or marks (principle 3), scope, keys that moved, tests that pass for the wrong reason. Until A17: each merge's `^2` is the commit its last audit approved (`run.log`); an engine package gives its Giac calls per Enter before and after (`tools/probes/engine-calls.ts`).
4. Decide each "Needs a decision" item of these packages and each open question from the log: a default within the plan goes into `docs/decisions.md` (rules section 9); a plan change goes under "Needs the user" with your recommendation in one sentence. Apply the "For shared files" text of the packages' reports, delete each merged package's file and its row from section 0's table, and run `node tools/docs-check.mjs`. Commit those doc changes on `phase-1` with `git commit -s` and the Opus trailer, under `tools/devlock.sh acquire integ opus 600` (A10).
5. Reply in exactly this form, nothing before `OPUS PASS` and nothing after NOTES, and no backtick or `$` in a FIX prompt (`night.sh` refuses the line; name files and code in plain words). Never edit a DECIDED entry of decisions.md on a proposal that is still OPEN; put the change under the proposal. One FIX line per needed fix package; fix IDs are `<ID>f1`, `<ID>f2`:
```
OPUS PASS <n>
VERDICT: <ID> ok | <ID> fix — <one line each>
FIX <ID>f1: agent <ron|gorge>, model <sonnet|opus>, branch <new branch from phase-1>, prompt: <one paragraph with file:line and the fix>
QUEUE: unchanged | <the remaining steps in a new order, or steps to drop>
NOTES: <at most three lines for the shift report>
```
henri runs each FIX as a package, then continues with QUEUE.

### Shift report (the last step)
`docs/shifts/<date>-night-report.md`, short and plain, from the log (`scripts/pipeline.sh report` starts a fresh writer with the log's night section on stdin): what was merged (with commits); what is unmerged and why; the Opus passes' NOTES; what the owner must do (items under "Needs the user"); the queue left for the next night. Commit it on `phase-1` with `git commit -s` and the Sonnet trailer. Never push.

## 2. Read before you start (every package)
The pipeline hands you a bundle: your package file (`docs/shifts/packages/<ID>.md`), the first 400 lines of every file the block names by repo path, the report format below and the definition of done of section 8. Read further files by section (`grep -n '^#' <file>`, then the range), never whole files: every file you read is sent again on every later turn. The big shared docs are named in the blocks by bare name on purpose (`decisions.md "R15c"`, `backlog.md item 37`), so they stay out of the bundle: open only the section named.
- Your worktree and branch exist (`p1/<name>-<slug>` from `phase-1`, made by the pipeline); never switch branches in the main checkout. The shared paths and locks of rules section 5 (`GIAC_OUT`, `PASCALINE_DL_DIR`, `PASCALINE_QALC_DL_DIR`, `tools/devlock.sh` for heavy work) are set by the pipeline.
- [04-architecture.md](../04-architecture.md) sections 0 and 8, and the sections your package names. Where docs/04 and docs/02 differ, docs/04 wins.
- **From 2026-10-13:** `docs/decisions.md` P11, docs/03 section 0 rules 5–13 (they bind every package: one interaction model, keys never move, vertical space, removal tests), `docs/05-ui-plan.md` with its section 7, and `docs/feedback.md`.
- `docs/decisions.md`: P8, P9, P10, P15, P16, P17 and the defaults entry "2026-10-12 Architecture for the engineer core". These are decided; don't reopen them. If a docs/04 decision turns out wrong in the code, don't change it silently: finish what you can, and put the evidence under "Needs a decision" in your report.
- Not in milestone 4: matrices (milestone 6; the list key alone is R54), bases and everyday functions (milestone 6; `par` and `eseries` alone are G30), Help = context help (milestone 6), prefix entry chips (gated by task 3).
- **No coordinator to message.** Stay inside the files your package names. On your branch you change only your own step's line in `docs/backlog.md` and your items under "Needs the user" or the defaults log in `docs/decisions.md`; the audit sees them in the diff. Everything else that is shared (`CLAUDE.md`, `docs/rules-core.md`, docs/02, docs/04, `THIRD_PARTY.md`, `.claude/agents/*`, this brief) goes as exact text into your report, and the next Opus pass applies it. Devices are only for annabell's day packages.

### Your report (every package)
End with a commit whose message body is the report. The audit and the Opus pass read it with `git log -1`. It holds:
- **Done:** what was built, item by item against the block's "Done when" lines.
- **Tests:** typecheck, vitest, e2e and golden counts as run.
  A test that passes on the old code is not a regression test: change it until it fails there, or list it under "Not done".
- **Numbers:** for example the start chunk size before and after, or timings.
- **For shared files:** exact text for the backlog, decisions, THIRD_PARTY.md, docs/04, this brief.
- **Needs a decision:** anything left open.
- **Not done:** what's missing.

Then reply as the pipeline's prompt asks (at most five lines). Nobody is waiting for messages.

## 8. Definition of done
- **Each branch:** typecheck 0; `npm run index` (with `PASCALINE_DL_DIR`, `PASCALINE_QALC_DL_DIR` and `QALC_OUT` pointing at the main checkout's caches and build, as the pipeline sets them), then `FIND_INDEX=required npm test`, all pass (the Find query test fails rather than skips without the full index); e2e all pass (the known-flaky `solve.spec.ts` persistence test and the Find 16 ms timing test may be re-run once); the golden gate when engine or parser code changed; by hand, `npm run gate` (from `app/`; `-- --quick` while working) runs all of these, the size test and a docs-size report in one command; SPDX headers; `git commit -s` with the trailer of the model that ran; the report commit; the start chunk size reported for UI packages; every "Done when" line of the block met or listed under "Not done".
- **Milestone 4 is done when:**
  - task 5 is within budget
  - the query test passes
  - the golden gate passes with marks and `precision.yaml`
  - no §2.3 item #1–#9 is left (each fixed, with its regression case passing)
  - the size test passes
  - the Tab One bars of §8.3 hold, or a measured miss is written up as a proposal in `docs/decisions.md`

## 8a. Review and merge
Every review and merge is a pipeline run (rules section 4; CLAUDE.md): the audit by sofia on `git diff -U5 phase-1...<branch>` plus the block's "Done when" lines, then `git merge --no-ff --signoff` into `phase-1`. A finished branch from before the pipeline is merged with `scripts/pipeline.sh <agent> "<ID>" --no-worker` (A10). The Opus pass (section 0c) applies the reports' shared-file text, deletes merged package files and their rows from section 0's table, and files proposals under "Needs the user". When a merge completes milestone 4, the Opus pass writes `docs/shifts/<date>-m4-report.md` and adds milestone 4 to docs/02 section 12. Never push.
