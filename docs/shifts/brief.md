<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Shift brief: milestone 4a "feel" and milestone 4 "Find and trust", with milestone 5's engine work and the deep-dive fixes beside them (run by the owner)

**Every package runs through `scripts/pipeline.sh`** (rules section 4): by day the owner starts one package at a time (`scripts/pipeline.sh <agent> "<ID>" --model <m>`, the table gives agent and model) and reads the RESULT line; at night `scripts/night.sh` runs the queue of section 0c. Nobody starts a worker or merges another way (CLAUDE.md). The standing rules in [rules.md](rules.md) apply; where the two differ, this brief wins. Section 7 holds one block per package in the shape the pipeline bundles (section 2).

## 0. State at start
`phase-1` on 2026-10-18 (architecture pass, decisions.md P17). Merged: milestone 4 packages G0–G6 (with G5f1), R1–R3, R19, R20, A1–A3; milestone 4a packages R5, A5, R6, S1, S2, R7–R10, R13, R14, R15a, R16, R17, R18 (with R18f1–R18f3), F8, R22, R25a, R23, R25b, R25c, R42, R43, R45, R34, R35, R21a, R46 (with R46f1), R21b, R11, R32, A4a (2026-10-16), R15b, R47, B13; milestone 5's check G15 (P15 holds); the deep-dive packages G20, G27, R44, G24, G19, R29, R30. **Merged by the pipeline** (night of 2026-10-18, audited by Opus pass 1): A6 (`130c12f`), G16 (`1bfd594`), G17 (`a4496d5`); audited by Opus pass 2: G17f1 (`17fdfad`), G18 (`5b7e0d8`), G25 (`d9b177a`); audited by Opus pass 3: G18f1 (`76e3eb6`), G25f1 (`211f0db`), G13 (`d08e955`); audited by Opus pass 6: G22f1 (`7556623`), R52 (`7c8c2c7`), G14 (`7635cfc`); audited by Opus pass 7: G14f1 (`9930ad6`), G26 (`eb5eef2`), S4 (`40c4bea`, the scope waits for the owner). **Finished on its branch, not merged** (review-only mode of A10): R12a (`p1/ron-m4a-look`, the visual-pass mockups, waiting for the owner's look). **In progress by the owner:** S5 (`p1/sandra-padlayout`, uncommitted in the main checkout). The pipeline has not merged a package yet: A10 fixes what stops it (decisions.md P17) and runs first, by day, with `PASCALINE_QALC_DL_DIR=<main checkout>/engine/qalc/_downloads` set in the shell. The Opus pass of 2026-10-17 (sofia) audited the 17 merges from R27c to G28. S2's menu rules (decisions.md "S2: one menu system") are written into the package texts. No package waits for an APK to be tried (owner, 2026-10-13). The text of finished packages is in git history. Left for the owner: `git branch -D p1/ron-eve-gestures` (the old flick classifier, K2 removed by P11; agents never use `-D`).

### The path (owner, 2026-10-14; rewritten 2026-10-18 after the owner's answers in the architecture pass)
**By day, one pipeline at a time** (owner, 2026-10-18), in this order; each starts when the one before is merged:
1. **A10** (the pipeline fixes; night-safe, but it must be in before the first night).
2. **R48** (bug F40), then **R15c1 → R15c2 → R15c3 → R15c4** (the R3 top cluster, decided 2026-10-17), **R49** (Settings rows), **R50b** (the palette the owner picked from R50a's mockup), the review-only merge of **R12a** once the owner has looked at the mockups.
3. **R4a** (Find on Math), **R4b** (Vars, Memory, the user keys), **R53** (results mode on the View key, after S9's note), **R36** (why the mark; G22 is merged by then), **R33**, **R37**, **R12b**, **R12c**, **R41**, **R40** (needs G26).
4. The unit pad: **R24b** (when the owner accepted S5's arrangement) → **R24c** (when R24a, R24b, R28, G16, G17 and G25 are merged) → **R24d** (after R4b).
5. annabell by day: **A9** as soon as the owner's phone is connected; **A4b** after R4b; **A7 → A8** on the owner's go (section 0g).

**At night** (section 0c): the gorge lane, the parser-only ron packages, the sandra docs packages and the review-only merges. Nothing that needs an APK, a device or an eye on the UI.

**Why this order:**
- A10 first: without it every pipeline run fails its Vitest check (the qalc tarball dir) and nine packages cannot start (combined blocks). It is the only package that runs before the pipeline is whole.
- Bugs first (feedback.md): R48 is small and touches no key R15c moves; R48 before R15c3, whose Alpha faces follow its rule. A9 waits only for the phone.
- R15c goes first among the feel packages: it changes keys the hand is learning (docs/03 rule 8). R4b sets the user keys, R53 uses the View key, R41 labels the keys, so all wait for it.
- G16 before G22: both change `app/src/engine/host.ts` and `protocol.ts`.
- Silent wrong answers next (principle 3): R51, R39, G22, G23, G14 lead the night queue after the unit evaluator's successors.
- Trust features after the code they build on: R36 after G22; R33 and R37 after Find; R40 after G26 and R12b's tokens.
- S7 (the docs diet) runs alone, on a night when nothing else is queued after it, because it moves the texts every package edits.
- The start-chunk budget has 1.06 kB gzip left (52.94 of 54 kB after R52): every UI package reports its delta.
## 0c. Night shifts: henri's plan (owner, 2026-10-14; pipeline 2026-10-18; queue rewritten 2026-10-18)
The owner plans each night in advance, and the queue below is the next nights'. `scripts/night.sh` runs it (rules section 4): for every decision it starts a fresh henri (Sonnet, Read-only) who sees this section and the log's tail and replies with one `scripts/pipeline.sh` line; the script runs that line and asks again. **henri executes and decides nothing.** **Low usage comes first:** the aim is to make the 5-hour window last, not to fill it; whatever is not done stays in the queue for the next night, which resumes from the log. The night queue holds what needs no APK, no device and no eye on the UI (owner, 2026-10-18): the gorge lane, the parser-only ron packages (R51, R39, R52, R28, R24a), the sandra docs packages (S4, S9, S7, S6, S8, R50a) and the review-only merges of finished branches. The rest of the ron lane runs by day.

### Rules for a night shift (they replace rules section 4's day use)
1. **One pipeline run at a time**, and never a worker started any other way. A package is `scripts/pipeline.sh <agent> "<ID>" --model <model from the table> --audit-model sonnet`: fresh worker, checks, at most two fix rounds, sofia's audit (Sonnet at night; by day the audit model follows P17), merge. A review-only merge is `scripts/pipeline.sh <agent> "<ID>" --no-worker --audit-model sonnet` (A10): phase-1 merged into the branch, checks, audit, merge; a conflict or a FIX is a fix round for the package's agent. Its RESULT line in the log is the step's state.
2. **No devices:** nobody runs `adb` or `build.sh`. annabell is not used at night, except for A6's review-only merge (no device).
3. **henri decides nothing.** A question, a blocked worker, a conflict or anything this section does not settle: the pipeline logs it, and henri hands it to the next Opus pass (at once, if it blocks the queue). **Follow every Opus-pass recommendation as written.** Plan changes go to the owner through `docs/decisions.md` "Needs the user", written by the Opus pass.
4. **Workers tick their own backlog line** and file their "Needs the user" items on their branch (rules section 5); the audit sees them in the diff.
5. **Opus pass:** `scripts/pipeline.sh pass <n> "<IDs with merge commits or unmerged branches>" "<open questions or none>"` after every three finished packages (merged or left unmerged; fix packages from a pass count), and the last pass at the end of the queue. Each FIX line of its reply runs as `scripts/pipeline.sh <agent> "<prompt>" --id <ID>f1 --branch <branch> --model <m> --audit-model sonnet`, then QUEUE is followed. The last pass's FIX packages get only their audit, then the report.
6. **Log:** the pipeline writes one line per step in `.coord/log.md` (time from `date`, step, agent and model, outcome, commit); `night.sh` logs each henri reply. The log is the queue state: henri continues from the first step without a RESULT line.
7. **Usage limit:** the pipeline exits 75 and `night.sh` waits 30 minutes and retries, at most six times, then logs `STOPPED`. No retry loops in agents. The owner resumes with `scripts/night.sh` again.
8. **A step that ends without a RESULT line** (the pipeline died: a busy lock, a dirty phase-1 worktree; A10 makes every exit print one): henri runs the same step once more; if the log then shows it twice without a RESULT, he skips it and goes on. **Worker gone without a report** (no commit): the pipeline logs `NOT MERGED (no commits)` and keeps the worktree; henri runs the same step once more (the pipeline resumes the branch). If that one also fails, go on with the next package.
9. **The end:** after the last pass and its FIX packages, `scripts/pipeline.sh report` writes and commits the shift report; henri then answers `SHIFT DONE`.

### The queue (the next nights; A10 must be merged by day before the first)
Estimates are wall-clock guesses. A package already merged by day is skipped (log it). A step whose prerequisite is not merged (the "after" column) is skipped for that night and stays in the queue.

| Step | What | Agent, model | Branch | After | Est. |
|---|---|---|---|---|---|
| 1 | A6 one gate command: review-only merge (`--no-worker`) | annabell, Sonnet | `p1/annabell-gate` | A10 merged | 15 min |
| 2 | G16 the unit evaluator: review-only merge (`--no-worker`; the README counts table is its fix round) | gorge, **Opus** | `p1/gorge-m5-unitcore` | A10 merged | 30 min |
| 3 | G17 temperatures and logarithmic units | gorge, Sonnet | `p1/gorge-m5-unittemp` | G16 | 1 h |
| 4 | **Opus pass 1** on steps 1–3 | Opus | — | — | 20 min + fixes |
| 5 | G18 uncertainty, first order | gorge, Sonnet | `p1/gorge-m5-unitunc` | G16 | 1 h |
| 6 | G25 the unit a result is shown in | gorge, Sonnet | `p1/gorge-m5-unitshow` | G16 | 1 h |
| 7 | G13 the hp and mmHg factors and the data audit | gorge, Sonnet | `p1/gorge-m5-qalcdata` | G16 | 1 h |
| 8 | **Opus pass 2** on steps 5–7 | Opus | — | — | 20 min + fixes |
| 9 | G22 why the mark: the reasons as facts | gorge, Sonnet | `p1/gorge-m4-why` | G16 | 1 h |
| 10 | G23 more precision before ⚠ | gorge, Sonnet | `p1/gorge-m4-escalate` | G22 | 1 h |
| 11 | R51 a space between two numbers (F43) | ron, **Opus** | `p1/ron-m4-numspace` | — | 45 min |
| 12 | **Opus pass 3** on steps 9–11 | Opus | — | — | 20 min + fixes |
| 13 | R39 the real odd root in Home (P5 b) | ron, **Opus** | `p1/ron-m4-oddroot` | R51 | 45 min |
| 14 | R52 the parser's messages in i18n | ron, Sonnet | `p1/ron-m4-parsemsg` | R39 | 1 h |
| 15 | G14 exact results marked ≈ (C9) | gorge, Sonnet | `p1/gorge-m4-marks` | G23 | 45 min |
| 16 | **Opus pass 4** on steps 13–15 | Opus | — | — | 20 min + fixes |
| 17 | G26 the digits a constant's uncertainty leaves | gorge, **Opus** | `p1/gorge-m4-constunc` | G23, G18 | 1.5 h |
| 18 | S4 the laptop connection: design note | sandra, Opus | `p1/sandra-connector` | — | 1 h |
| 19 | S9 results mode: design note (P16) | sandra, Opus | `p1/sandra-resultsmode` | — | 1 h |
| 20 | **Opus pass 5** on steps 17–19 | Opus | — | — | 20 min + fixes |
| 21 | R50a three colour palettes: a mockup | ron, Sonnet | `p1/ron-m4a-palettes` | — | 45 min |
| 22 | G7 Find data for the unit pad | gorge, Sonnet | `p1/gorge-m5-finddata` | S5 merged by the owner | 45 min |
| 23 | R24a the slot model | ron, **Opus** | `p1/ron-m5-unitslot` | G7 | 1 h |
| 24 | **Opus pass 6** on steps 21–23 | Opus | — | — | 20 min + fixes |
| 25 | R28 units mode in the parser | ron, **Opus** | `p1/ron-m5-unitparse` | R24a, G16 | 1 h |
| 26 | S7 the docs diet (alone: the last package of its night; the owner starts nothing until it is merged) | sandra, Opus | `p1/sandra-docsdiet` | S5 merged | 1.5 h |
| 27 | **Opus pass 7** on steps 25–26 | Opus | — | — | 20 min + fixes |
| 28 | S6 files in and out without INTERNET | sandra, Opus | `p1/sandra-files` | S7 | 1 h |
| 29 | S8 the outside-test protocol | sandra, Opus | `p1/sandra-outside` | S6 | 30 min |
| 30 | **Opus pass 8** (the last) on what came after pass 7, then its FIX packages | Opus | — | — | 20 min + fixes |
| 31 | Shift report, then stop | — | — | — | 10 min |

Not at night: the rest of the ron lane (by day; section 0); devices (A9, A4b); A7 and A8 (the owner's go); G21 (it waits for G2 item 54 and the owner's decision on F29); R38a and R38b (their texts are completed by S6's report).

### The commands henri replies with (one per decision; `scripts/night.sh` runs it)
- `scripts/pipeline.sh <agent> "<ID>" --model <sonnet|opus> --audit-model sonnet`: the next queue step not done (skip steps the table or the log marks merged or skipped, and steps whose "after" is not merged).
- `scripts/pipeline.sh <agent> "<ID>" --no-worker --audit-model sonnet`: a review-only merge (steps 1 and 2).
- `scripts/pipeline.sh <agent> "<FIX prompt, verbatim>" --id <IDf1> --branch <branch> --model <m> --audit-model sonnet`: a FIX line of the last Opus pass, one per call, in order.
- `scripts/pipeline.sh pass <n> "<IDs with merge commits or unmerged branches>" "<open questions or none>"`.
- `scripts/pipeline.sh report`, then `SHIFT DONE`.

### Opus pass (instructions for the Opus agent)
You are the shift's quality gate and its decision-maker; henri executes your reply literally. Work in the worktree where `phase-1` is checked out (the pipeline tells you which); no code changes.
1. For each package: its block in section 7, its report (`git log -1 <merge>^2`, or the branch tip if unmerged), its diff (`git diff <merge>^1 <merge>`), and the audit's verdict from `.coord/log.md`.
2. Run once on `phase-1` (from `app/`, with absolute `GIAC_OUT`, `PASCALINE_DL_DIR` and `PASCALINE_QALC_DL_DIR`): typecheck, `npm run index` then `FIND_INDEX=required npm test`, e2e, and the golden gate when engine or parser code changed. Take `tools/devlock.sh acquire host-cpu opus 1800` around them.
3. Check what an audit tends to miss: wrong or invented expected values (sources), a missing round trip, silent wrong numbers or marks (principle 3), scope, keys that moved, tests that pass for the wrong reason.
4. Decide each "Needs a decision" item of these packages and each open question from the log: a default within the plan goes into `docs/decisions.md` (rules section 9); a plan change goes under "Needs the user" with your recommendation in one sentence. Apply the "For shared files" text of the packages' reports and remove each merged package's block from section 7 and its row from its table. Commit those doc changes on `phase-1` with `git commit -s` and the Opus trailer, under `tools/devlock.sh acquire integ opus 600` (A10).
5. Reply in exactly this form (one FIX line per needed fix package; fix IDs are `<ID>f1`, `<ID>f2`):
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

## 0b. Milestone 4a packages (P11, signed off by the owner 2026-10-13): **do these first**
Goal: the owner's feedback of 2026-10-13 ([feedback.md](../feedback.md)) and the UI plan ([05-ui-plan.md](../05-ui-plan.md); its **section 7 wins** where it differs). Backlog "Milestone 4a" is binding. The m4 packages of 0a (R4a, R4b, A4b) run between R12a and R12b (section 0, "The path").

| # | Package | Agent, model | Branch | Start when merged | Lane | Size |
|---|---|---|---|---|---|---|
| R48 | Shift + Alpha: the faces show lower case (F40) | ron, Sonnet | `p1/ron-m4a-lowerfaces` | A10 | day | ~0.25 d |
| A9 | Key vibration on the owner's phone (F41) | annabell, Sonnet | `p1/annabell-haptics` | the owner's phone connected | day | ~0.5 d |
| R15c1 | The status line takes Apps, Menu and the views | ron, Sonnet | `p1/ron-m4a-statusline` | R48 | day | ~0.75 d |
| R15c2 | The R3 keys: round pad, six user keys, the editing wing | ron, **Opus** | `p1/ron-m4a-cluster` | R15c1 | day | ~1.5 d |
| R15c3 | The user keys' Alpha layer | ron, Sonnet | `p1/ron-m4a-useralpha` | R15c2 | day | ~0.5 d |
| R15c4 | First-start tips | ron, Sonnet | `p1/ron-m4a-tips` | R15c2 | day | ~0.5 d |
| R49 | Settings as a list of rows, each with its own page | ron, Sonnet | `p1/ron-m4a-settings` | R15c4 (it adds a Settings row) | day | ~0.75 d |
| R50b | The picked palette in the app | ron, Sonnet | `p1/ron-m4a-palette` | R50a picked by the owner, and R49 | day | ~0.5 d |
| R12a | Visual pass: mockups for the owner, finished on `p1/ron-m4a-look`: review-only merge | ron, Sonnet | `p1/ron-m4a-look` | the owner has looked at the mockups | day | 15 min |
| R12b | Visual pass: tokens and history rows (U5, U7) | ron, Sonnet | `p1/ron-m4a-tokens` | R12a merged, R4b, R53 | day | ~1.5 d |
| R12c | Visual pass: theme, press feedback, reduced motion | ron, Sonnet | `p1/ron-m4a-theme` | R12b | day | ~1 d |
| R53 | Results mode on the View key (P16) | ron, **Opus** | `p1/ron-m4a-results` | S9 (the owner's yes), R15c2, R4b | day | ~1.5 d |

**Why these models:** Opus where a mistake breaks entry for every later package: R15c2 (moves keys that every test names), R53 (hides the keypad and adds the viewport's controls; a wrong state leaves no keys). Sonnet elsewhere, with the audit model of P17 (Opus when the diff touches the parser, the engine or `spec/keyboard.yaml`).

## 0a. Work packages (milestone 4), between R12a and R12b
Goal: milestone 4 of P8, built to [04-architecture.md](../04-architecture.md). The task text in `docs/backlog.md` "Engineer core, milestone 4" is binding. Each package names its backlog step; § numbers point into docs/04. R4 is split in two; A4b is the second device run (the first, A4a, is done); where 0d says "R4 merged", read R4a and R4b.

| # | Package | Backlog step | Agent, model | Branch | Start when merged | Lane | Size |
|---|---|---|---|---|---|---|---|
| R4a | Find on Math (EN1, part 1) | 8 | ron, Sonnet | `p1/ron-m4-find` | R12a merged (the owner looks at the mockups meanwhile) | day | ~2 d |
| R4b | Vars, Memory and the user keys from Find (EN1, part 2) | 8 | ron, Sonnet | `p1/ron-m4-vars` | R4a and R15c3 | day | ~1 d |
| A4b | Find timing on the Tab One | 12 | annabell, Sonnet | `p1/annabell-m4-find` | R4b; Tab One connected | day | ~0.25 d |

### How to start a package
From any checkout of the repo, one at a time by day (owner, 2026-10-18):

```bash
export PASCALINE_QALC_DL_DIR=/home/nordmu/Documents/source99/pascaline/engine/qalc/_downloads   # until A10 is merged
scripts/pipeline.sh <ron|gorge|annabell|sandra> "<ID>" --model <sonnet|opus>      # the table gives agent and model; the audit model follows P17
scripts/pipeline.sh <agent> "<ID>" --no-worker                                    # a finished branch: review-only merge (A10)
scripts/pipeline.sh <agent> "<ID>" --dry-run                                      # see the bundle first
```

The RESULT line says `MERGED <commit>`, `NOT MERGED (<why>)` or `LIMIT`. A package left unmerged keeps its branch and worktree; the same command resumes it.
## 0e. The gorge lane: milestone 5's engine work, beside the ron lane (owner, 2026-10-14)
Backlog milestone 5 items 1–3, and C9, with no UI: an evaluator, its rules, data and marks. They run as the night queue (0c), because R24c needs items 1 and 2. P11's reason for doing milestone 4a first (Find and the unit view sit on the keypad and the screen) does not touch them.

**P15 (decisions.md; the owner, 2026-10-14; G15's check passed 2026-10-15):** the unit view computes on Giac, in the worker that is already loaded, with the exact factors of the Find index. libqalculate stays at build time, as the index's source. The qalc-worker fallback (G10–G12) was written for the case that P15 fell; it held, and the texts were removed on 2026-10-18 (git history, commit before P17).

Where 0d says "milestone 5 items 1–2 (U1, U2) merged", read G16, G17, G25 and R28. New gorge ids start at G10, because G8 and G9 are ids in the backlog's G2 follow-ups; the deep-dive packages G19–G24 and G26 are in 0f.

| # | Package | Backlog | Agent, model | Branch | Start when merged | Lane | Size |
|---|---|---|---|---|---|---|---|
| R28 | Units mode in the parser | m5 item 2 (ron half) | ron, **Opus** | `p1/ron-m5-unitparse` | R24a and G16; before R24c | night | ~1 d |

**Why these models:** G16 is the arithmetic every unit result rests on (Opus). G17, G18, G25, G13 and G14 follow G16's pattern or the golden gate, and their cases pin them (Sonnet, Opus pass at night). R28 adds parser rules with round trips (Opus, as R14 and R18).

## 0d. Packages from the owner's discussion of 2026-10-14 (the Alpha keys, Find, the unit pad, the laptop connection)
Each waits for what its row says; none changes the 0b packages or their order. Background: [feedback.md](../feedback.md) #40–#44, decisions.md "The letters stay" and P14 (decided 2026-10-14), [research/r9-unit-pad.md](../research/r9-unit-pad.md), backlog "Parked ideas" (the laptop connection).

**The unit pad is built in small packages** (owner, 2026-10-14: a session should not run out of tokens): one concern each, about a day or less, with its own short reading list. Read only what your package names. In order: S5 finds the arrangement; G7 puts every id in Find; R24a to R24d build the entry. R24a needs no UI and can start as soon as G7 is merged.

| # | Package | Agent, model | Branch | Start when | Lane | Size |
|---|---|---|---|---|---|---|
| S5 | The unit pad's arrangement and its user cells (research) | sandra, Opus | `p1/sandra-padlayout` | in progress by the owner (uncommitted, main checkout) | owner | ~1 d |
| G7 | Find data for the unit pad and the units menu | gorge, Sonnet | `p1/gorge-m5-finddata` | S5 merged (its test reads the final arrangement) | night | ~0.5 d |
| R24a | The slot model (no UI) | ron, **Opus** | `p1/ron-m5-unitslot` | G7 merged | night | ~0.5 d |
| R24b | The pad drawn over the keys | ron, Sonnet | `p1/ron-m5-unitpad` | the owner accepted S5's arrangement; R21a merged | day | ~1 d |
| R24c | The unit view entry: slots, Enter, evaluation | ron, **Opus** | `p1/ron-m5-unitview` | R24a, R24b, R28, G16, G17 and G25 merged | day | ~1 d |
| R24d | Find in a slot and the user cells | ron, Sonnet | `p1/ron-m5-usercells` | R24c and R4b merged | day | ~0.5 d |

**Why these models:** R24a builds the slot model the parser reads and R24c ties pad, slots and evaluation together, so a mistake there corrupts unit entry everywhere (Opus, as R9 and R18). R24b draws on R21's layer and R24d stores cells as R15b stores the user keys; each follows an existing pattern and its tests pin it (Sonnet). G7 is data and one test (Sonnet). S4 and S5 are research with probes (sandra runs Opus).

**Not packaged yet:** the rest of backlog milestone 5 item 4, the result view (value, mark, unit, dimension, one-tap alternatives, `units.targets`, the `\res` chip back to Home). It gets its packages when G16 and G25 are merged , since their reports fix what a result carries.

## 0f. Packages from the deep-dive review (owner, 2026-10-14)
The owner asked for a deep dive (feedback #47) and accepted all 24 findings. They are in decisions.md "The deep-dive review", P15 and P5. **Each package is small:** one concern, about a day or less, with its own reading list (the owner, feedback #48). Read only what your package names.

The order is by importance, then by what each needs (section 0, "The path"):
1. silent wrong answers;
2. robustness;
3. trust features;
4. process.

The milestone 5 packages that P15 brings (G16–G18, G25) are in 0e. Every "behaviour today" in the package blocks was probed on 2026-10-14, on the dev engine (`tools/probes/engine.ts`, `tools/probes/parse.ts`) or in the code. A10 (the pipeline fixes, P17) is the first package of the process lane.

| # | Package | Finding | Lane | Agent, model | Branch | Start when merged | Size |
|---|---|---|---|---|---|---|---|
| A10 | The pipeline fixes and the review-only mode (P17) | architecture pass | first, by day | annabell, Sonnet | `p1/annabell-pipeline` | now | ~0.5 d |
| G21 | `exp` ignores the angle mode | F29 | night | gorge, Sonnet | `p1/gorge-m4-expdeg` | G2 item 54 answered and the owner's decision on F29 (decisions.md) | ~0.25 d |
| R36 | A picked row says why it has its mark | review item 14 | day | ron, Sonnet | `p1/ron-m4a-why` | G22 (R32, same file, is merged) | ~0.5 d |
| R33 | Names with a value, marked on the line | review item 15 | day | ron, Sonnet | `p1/ron-m4a-namemarks` | R4b | ~0.5 d |
| R37 | The angle check | review item 16 | day | ron, Sonnet | `p1/ron-m4a-anglecheck` | R33 | ~0.75 d |
| R41 | Key labels for TalkBack | review item 19 | day | ron, Sonnet | `p1/ron-m4a-labels` | R12c | ~0.5 d |
| R40 | Muted digits past a constant's uncertainty | review item 17 | day | ron, Sonnet | `p1/ron-m4a-constdigits` | R41 and G26 | ~0.5 d |
| R38a | The backup: export everything | review item 18 | day | ron, Sonnet | `p1/ron-m4-backup` | S6, and the owner's yes to its proposal | ~0.5 d |
| R38b | The backup: restore from a file | review item 18 | day | ron, **Opus** | `p1/ron-m4-restore` | R38a | ~0.75 d |
| A6f1 | The gate's golden trigger covers the unit view (Opus pass 1) | review item 21 | day | annabell, Sonnet | `p1/annabell-gatefix` | — | 30 min |
| S7 | The docs diet | review item 20 | night, alone | sandra, Opus | `p1/sandra-docsdiet` | S5 merged; the last package of its night | ~0.5 d |
| S6 | Files in and out without INTERNET: the backup | review item 18 | night | sandra, Opus | `p1/sandra-files` | S7 | ~0.5 d |
| S8 | The outside-test protocol | review item 24 | night | sandra, Opus | `p1/sandra-outside` | S6 | ~0.25 d |

**Why these models:**
- **Opus:**
  - R51 and R39 change parser rules, and a slip there computes a different number (as R14 and R18).
  - G26 is precision maths every inexact constant passes through.
  - R38b overwrites the user's stored data.
  - The sandra packages are research and rewriting (sandra runs Opus).
- **Sonnet:** everything else follows an existing pattern and is pinned by its tests.

**Not a package:**
- The MathLive bug report (review item 23) is in backlog "Needs the user" item 6.
- The largest-font check (item 19) was done in A4a; what breaks is in decisions.md "A4a" point 4.

## 0g. The release path (owner, 2026-10-15)
The goal: pushing a tag `vX.Y.Z` builds, gates, signs and publishes the APK on GitHub, from clean source and with the owner's key, never from the laptop. The owner has stored the keystore secrets in the GitHub repo (2026-10-15). Found in the code on 2026-10-15:
- `android/app/build.gradle` lines 23–37 know only the alias `throwaway`, and fall back to the password `pascaline-throwaway`.
- `build.sh` lines 75–88 sign with the throwaway key unless `--unsigned` is passed. There is no release mode, so a release could silently get the throwaway key.
- `versionCode 1` / `versionName "1.0"` are placeholders. The F-Droid draft says 0.2.0 / 2.
- There is no `.github/`.

| # | Package | Lane | Agent, model | Branch | Start when merged | Size |
|---|---|---|---|---|---|---|
| A7 | Release signing and the version number | any time | annabell, Sonnet | `p1/annabell-release` | the owner's go | ~0.5 d |
| A8 | The release workflow | any time | annabell, **Opus** | `p1/annabell-releaseci` | A7 | ~0.5 d |

**Defaults (proposed 2026-10-15; the owner confirms them with the table below):**
- The first release is **v0.1.0, versionCode 1, a GitHub pre-release**.
- The version is written as literal numbers in `build.gradle`, not derived from the tag. The F-Droid draft (`UpdateCheckMode: Tags`, `AutoUpdateMode: Version`) reads it there (docs/02 section 8). The workflow fails when the tag is not `v<versionName>`.
- The golden gate runs on the release engine **before** anything is signed.
- Pushing the tag is the owner's act; no agent pushes a tag.

**The owner fills in before A7 starts** (names only; the values stay in GitHub):

| What | GitHub secret name | Note |
|---|---|---|
| keystore, base64 | `TODO` | `base64 -w0 release.jks` |
| store password | `TODO` | |
| key alias | `TODO` (secret or plain value) | |
| key password | `TODO` | same as the store password? |
| certificate SHA-256 | (plain, goes in the repo) | `keytool -list -v -keystore release.jks` → `SHA256:` line |

## 2. Read before you start (every package)
The pipeline hands you a bundle: your block from section 7, the first 400 lines of every file the block names by repo path, the report format below and the definition of done of section 8. Read further files by section (`grep -n '^#' <file>`, then the range), never whole files: every file you read is sent again on every later turn. The big shared docs are named in the blocks by bare name on purpose (`decisions.md "R15c"`, `backlog.md item 37`), so they stay out of the bundle: open only the section named.
- Your worktree and branch exist (`p1/<name>-<slug>` from `phase-1`, made by the pipeline); never switch branches in the main checkout. The shared paths and locks of rules section 5 (`GIAC_OUT`, `PASCALINE_DL_DIR`, `PASCALINE_QALC_DL_DIR`, `tools/devlock.sh` for heavy work) are set by the pipeline.
- [04-architecture.md](../04-architecture.md) sections 0 and 8, and the sections your package names. Where docs/04 and docs/02 differ, docs/04 wins.
- **From 2026-10-13:** `docs/decisions.md` P11, docs/03 section 0 rules 5–13 (they bind every package: one interaction model, keys never move, vertical space, removal tests), `docs/05-ui-plan.md` with its section 7, and `docs/feedback.md`.
- `docs/decisions.md`: P8, P9, P10, P15, P16, P17 and the defaults entry "2026-10-12 Architecture for the engineer core". These are decided; don't reopen them. If a docs/04 decision turns out wrong in the code, don't change it silently: finish what you can, and put the evidence under "Needs a decision" in your report.
- Not in milestone 4: matrices, bases and everyday functions (milestone 6), Help = context help (milestone 6), prefix entry chips (gated by task 3).
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

## 7. Packages
One block per package, in the shape the pipeline bundles: the heading `### <agent>, <ID>: <title>, branch \`p1/<agent>-<slug>\``; **Lane** (night-safe = no device, no APK, no eye on the UI; day = the owner tries it); **Starts when**; **Read** (repo paths get bundled, first 400 lines; the big shared docs by bare name and section); the steps; **Done when** (lines an auditor checks in the diff). A finished package's block is removed by the Opus pass.

### annabell, A10: the pipeline fixes and the review-only mode (P17), branch `p1/annabell-pipeline`
**Lane:** night-safe (scripts and tools only; no device), but it runs **first, by day**, because nothing else merges before it. Start it with `PASCALINE_QALC_DL_DIR=/home/nordmu/Documents/source99/pascaline/engine/qalc/_downloads` exported in the shell: the running pipeline needs it for its own Vitest check (fix 1 below).
**Read:** `scripts/pipeline.sh`, `scripts/night.sh`, `scripts/gc.sh`, `tools/devlock.sh`, `tools/devlock.test.sh` (the pattern for a shell test), `app/playwright.config.ts` (`PW_PORT`), `tools/find-index/generate.mjs` lines 36–60 (the tarball dirs), decisions.md P17, rules.md section 4, this brief's sections 0c and 2.
Evidence (`docs/shifts/2026-10-18-archpass-report.md`, section "Pipeline findings"): in a worktree `npm run index` fails with `missing …/engine/qalc/_downloads/libqalculate-5.13.1.tar.gz (set PASCALINE_QALC_DL_DIR)`; `scripts/pipeline.sh ron R12c --dry-run` exited 1 with no message (the heading said "branches"); `ron R15c3 --dry-run` said "has no heading"; no RESULT line is printed by `die`; `git merge-tree` shows `p1/gorge-m5-unitcore` conflicts with phase-1 in `tests/golden/README.md`.
Commits in this order:
1. **Test first:** `scripts/pipeline.test.sh` (no agent is started): for every `### <agent>, <ID>:` heading of brief section 7 in the phase-1 worktree, `scripts/pipeline.sh <agent> <ID> --dry-run` exits 0 and prints the heading's branch; a made-up ID exits 2 with a message naming it; with `PASCALINE_QALC_DL_DIR` unset the dry run still prints the dir it will export. The test fails on today's script.
2. **Environment:** export `PASCALINE_QALC_DL_DIR="${PASCALINE_QALC_DL_DIR:-$main/engine/qalc/_downloads}"` beside `PASCALINE_DL_DIR`; `PW_PORT=$((5200 + n % 100))` exported to the worker, the fix rounds and the checks.
3. **No silent exit:** the branch lookup from the heading never fails the script silently; a heading without `branch \`…\`` or an ID without a heading ends in `die` with the ID and the file named.
4. **A RESULT line on every exit:** `die` prints `RESULT #<n> <ID>: NOT MERGED (<why>)` (or `RESULT -: NOT STARTED (<why>)` before a run number exists) to stdout and logs one line; the lock wait stays 1800 s. `night.sh`: a pipeline command whose output has no RESULT line counts like `NOT MERGED`; the same command twice without a RESULT is logged `SKIPPED` and henri is told so through the log (rule 8 of section 0c).
5. **`--no-worker`** (review-only): the branch must exist; its worktree is reused or made; `git merge phase-1` into it first (a conflict is a fix round for `<agent>` with the conflict markers' files as the failing output; the worker resolves and commits); then the checks, the audit and the merge as today. The run's ID is the package's; the bundle is the block as usual (the auditor's criteria).
6. **`--audit-model auto`** (the new default): `opus` when `--model opus` or `git diff --name-only phase-1...HEAD` touches `app/src/input/`, `app/src/engine/`, `engine/` or `spec/keyboard.yaml`, else `sonnet`. `night.sh`'s henri commands pass `--audit-model sonnet` explicitly (0c).
7. **Locks:** `tools/devlock.sh acquire integ pipeline-<n> 600` around the merge into phase-1 and, in the `pass` subcommand's prompt, the instruction to take `integ` around the doc commit. `gc.sh` runs its path audit in the phase-1 worktree (`integ_dir`), not in the main checkout.
8. **Docs in the report:** the text for CLAUDE.md's pipeline lines (`--no-worker`, `--audit-model`, the two tarball dirs), rules.md section 4 (the options and the review-only step) and this brief's section 8 (the env line).
**Done when:**
- `scripts/pipeline.test.sh` passes on the branch and fails on phase-1's script (both runs in the report).
- `scripts/pipeline.sh gorge G16 --dry-run` and `ron R15c3 --dry-run` print a bundle each.
- Every `exit` path of pipeline.sh prints one RESULT line (grep the script: no `die` without it).
- `--no-worker`, `--audit-model auto` and `PW_PORT` are in the header comment and in `--dry-run`'s command list.
- No application code is changed (`app/src/` untouched).

### ron, R48: Shift + Alpha, the faces show lower case (F40), branch `p1/ron-m4a-lowerfaces`
**Lane:** day. **Starts when:** A10 is merged; before R15c3.
**Read:** backlog.md item 37 (F40) and feedback.md #52; `app/src/keyboard/keyboard.ts` (`labelFor`, `layerAction`); `app/src/keyboard/Keypad.svelte` (`face`, `hint`, `alphaHint`); `app/src/state/session.svelte.ts` (the lock flags; `capsLock` is the lower-case lock: it keeps Shift on with Alpha); `app/src/keyboard/keyboard.test.ts`.
- **The face shows what a tap types.** With Alpha and Shift both on (Shift + Alpha one-shot, or the lower-case lock), a key whose Alpha action is its own letter shows it in lower case. `labelFor` takes the same condition as `layerAction`, so the two cannot drift apart again. Keys whose Alpha layer falls back to the primary keep their face.
- **The flick bubble and the letter legend follow the same rule:** a flick down shows and types the same case.
**Done when:**
- A unit test of `labelFor` covers the four states (none, Alpha, Shift + Alpha, the two locks) and fails on today's code.
- e2e: Shift Alpha shows `a` on the A key and types `a`; Alpha alone shows `A`; the lower-case lock shows lower case until it is released.
- A gallery case of the lower-case layer, light and dark.
- Typecheck, unit and e2e tests pass; the start chunk is within +0.05 kB gzip (the number in the report).

### ron, R15c1: the status line takes Apps, Menu and the views, branch `p1/ron-m4a-statusline`
**Lane:** day. **Starts when:** R48 is merged. The first of four R3 packages (decisions.md "R15c", owner 2026-10-17). D's keys stay until R15c2, so for one package both paths work.
**Read:** decisions.md "R15c" (the layout, the layers, the costs) and "R15b" (the place name's target and the place actions); `docs/mockups/top-cluster-r15c.html` (option R3); `docs/06-keypad-vs-g2.md` section 3 point 2 and section 4 B; `docs/05-ui-plan.md` 3.2; `app/src/App.svelte` (`press()`, `PLACE_KEY`, `AT_ONCE`, `SHEET_KEYS`, `historyKey`); `app/src/views/modeSheet.ts` (the Apps sheet); `app/src/apps/shell.svelte.ts` (`menuItems`, `showMenu`); `app/test/status.spec.ts`; `app/test/topcluster.spec.ts`. The owner's prototype is `/home/nordmu/Documents/source99/pascaline/.coord/r15c-prototype.patch` (not in git; `git apply` it in a scratch worktree to see it run): take its shapes and commands, not its structure; its test switch `?cluster=r3`, its Settings section and `keyboard/clusterTest.ts` are not to be built.
- **The place name opens the Apps sheet** (special `apps`, through `press()` as `PLACE_KEY` does today), in Home, CAS and every app. It is drawn with ▾ instead of ⇄. The Apps sheet already lists Home and CAS first. The Home ↔ CAS switch on the name goes. Keep R15b's 96 × 28 px target and update the name's aria-label.
- **In an app: Symb, Plot and Num tabs** beside the name, the current one marked. Each tab goes through `press()` with a key whose special is `symb`, `plot` or `num`, so the sheet, queue and AT_ONCE rules hold. The name then shows only the app's name.
- **☰ at the right end** (special `menu`, through `press()`): the view's menu. On a picked row it opens the row's menu (R13, `historyKey` already does this). The target is at least 36 × 28 px.
- **Every ☰ menu ends with Settings.** In the Home/CAS list it is item 10 (key 0 picks it; S2's fixed numbers 1–9 stay), and in each app view's menu it is the last row.
- The status line stays 28 px (docs/03 rule 9) and fits at 360 px width in an app with the chips, DEG/RAD and ☰, with no overflow; the tabs may shrink before the chips do.
- **Docs:** docs/05 3.2 (the status line) and docs/06 section 3 point 2 and section 4 B, as exact text in the report.
**Done when:**
- e2e by touch and by keys: the name opens Apps, and Home and CAS are reached from it; the tabs switch views in Function and Solve; ☰ opens the Home menu, and on a picked row the row's menu; Settings is the last ☰ row. R15b's place-switch tests are changed to the new behaviour.
- Typecheck, unit and e2e tests pass; the gallery is rebuilt; the start chunk is at most +0.4 kB gzip (2.27 kB left before R15c; the number in the report).
- No key moved in `spec/keyboard.yaml`.

### ron, R15c2: the R3 keys: round pad, six user keys, the editing wing, branch `p1/ron-m4a-cluster`
**Lane:** day. **Opus:** it moves keys that every test names, as R15b did; it stays whole. **Starts when:** R15c1 is merged.
**Read:** decisions.md "R15c" points 1–6 and the open item "R15c: Store from the last result"; `docs/mockups/top-cluster-r15c.html` (R3); `docs/06-keypad-vs-g2.md`; `spec/keyboard.yaml` (rows 0–2 and the header's rules); `app/src/keyboard/keyboard.ts`; `app/src/keyboard/keyboard.test.ts`; `app/src/keyboard/Keypad.svelte` (the pad surface); `app/src/keyboard/gestures.ts`; `app/src/views/sheetKeys.ts` (`esc`, `cancel`); `app/src/App.svelte` (`special()`, `AT_ONCE`); `app/src/entry/ans.ts`; `app/src/i18n/en.ts`; `app/test/keys.spec.ts`; `app/test/topcluster.spec.ts`; `app/test/gestures.spec.ts`; `app/test/undo.spec.ts`. The prototype's finding: `\frac{12}{34}`, Shift + ⇤, 5 gives `\frac{12}{534}`, and a drag from the pad's hub steps the cursor.
- **`spec/keyboard.yaml` rows 0–2** as decisions.md "R15c" points 1–5: `u1`–`u6` in columns 0–1, all empty; `up` (row 0, columns 2–3), `left` and `right` (row 1), `down` (row 2, columns 2–3); `view` | `esc`, `undo` | `copy`, `lstart` | `lend` in columns 4–5. `source: assumed` for every new key, and the cluster's comments rewritten. `apps`, `symb`, `plot`, `num`, `help`, `menu` and `cancel` go.
- **Actions:** `esc` (Shift `clear`) takes today's Cancel job, then Esc's: it stops a running job, closes Settings, goes back one sheet level (`sheetKeys.ts`: `esc` → back; the `cancel` entry goes), drops a picked row, and otherwise clears the line. A hardware Escape is this key. The special `cancel` goes. `undo` (Shift `redo`): MathLive `undo` and `redo`. `copy` (Shift `paste`): the specials as they are. `lstart` and `lend`: `moveToMathfieldStart` and `moveToMathfieldEnd`; Shift: `moveToGroupStart` and `moveToGroupEnd`. `view`: `special: none` on tap until R53 (results mode, P16) and on Shift until Help exists, so the key is drawn dimmed as D's Help and View are. In an app view without an entry line, ⇤ ⇥, Undo and Redo are dead keys. Store on an empty line (`Ans ▶`) follows the owner's answer to the open item; with no answer yet, it stays as it is.
- **The round pad:** the trackpad surface is drawn round (`border-radius: 50%` on the existing surface, the four zones unchanged), with a dashed hub ring at the centre that does nothing on a tap.
- **The user keys:** six keys, each with a tap and a Shift layer (R15c3 adds Alpha). Stored slots of `u1`–`u3` stay valid. D's Home and CAS defaults on U2 and U3 go.
- **Docs** (exact text in the report): docs/04 5.1 (the key table); docs/06 section 1 (Help), section 2 (the Cancel and Shift + Apps rows go), section 3 points 2, 3 and 8, and a row for every R15c difference with its reason; backlog K4 → R53.
**Done when:**
- Every test that names a removed key moves to the new keys or to the status line (R15c1).
- New e2e: ⇤ ⇥ at the line's ends; Shift + ⇤ ⇥ in a numerator and in an exponent (`derived`: `\frac{12}{34}`, Shift + ⇤, 5 → `\frac{12}{534}`); Undo, then Redo; Esc stops a running job (from the Cancel tests), goes back a sheet level, drops a pick, and clears the line; the Copy and Paste key; a drag that starts on the hub and one that starts on ▲.
- `keyboard.test.ts`: the cluster has no letter line and six user keys; every legend in i18n.
- Typecheck; unit, e2e and gesture tests; the gallery rebuilt; the viewport share on the Pixel 7 profile still 0.354 (floor 0.35); the start chunk within budget; `npm run golden` unchanged (no engine change).

### ron, R15c3: the user keys' Alpha layer, branch `p1/ron-m4a-useralpha`
**Lane:** day (the faces are looked at). **Starts when:** R15c2 is merged.
**Read:** decisions.md "R15c" point 5; `app/src/keyboard/userKeys.svelte.ts` (`USER_LAYERS`, `resolve`, `set`, `reset`); `app/src/keyboard/userKeys.test.ts`; `app/src/keyboard/keyboard.ts` (the loader and `layerAction`); `app/src/keyboard/Keypad.svelte` (the face and the flick bubble); `spec/keyboard.yaml` (the Alpha fallback rule in the header); `app/test/keys.spec.ts`.
- The loader allows `alpha` on a user key. `USER_LAYERS` gains `alpha`; `resolve`, `set` and `reset` work per layer, and a stored record of the old two-layer shape still loads.
- An empty Alpha slot falls back to the tap layer, as every key's missing Alpha layer does.
- A flick down or Alpha + the key fires the Alpha slot. The cluster keeps no letter line: the face shows the Alpha binding while Alpha is on, and the flick bubble shows it while armed.
**Done when:**
- `userKeys.test.ts` covers three layers, the old record and the fallback (new cases fail on today's code).
- e2e: a user key with an Alpha binding (set through the model in the test) fires it by flick down and by Alpha + tap, and keeps it after a reload.
- Typecheck, unit and e2e tests pass; the gallery rebuilt; the start chunk delta in the report (≤ +0.2 kB gzip).

### ron, R15c4: first-start tips, branch `p1/ron-m4a-tips`
**Lane:** day. **Starts when:** R15c2 is merged.
**Read:** decisions.md "R15c" point 7 (the status line) and "Settings: a list of rows"; `app/src/App.svelte` (where a layer is mounted); `app/src/input/backLayer.ts` (`openLayer`); `app/src/state/storage.ts` (the kv keys); `app/src/views/modeSheet.ts` (`settingsSections()`); `app/test/settings.spec.ts`.
- A one-time overlay over the app, in its own lazy chunk, never in the start chunk. It dims the screen and rings the place name and ☰, measured from their boxes. Two tips: "Tap the name for your apps, Home and CAS" and "Tap ☰ for the menu: copy, paste, settings". A "Got it" button.
- Any tap or key closes it; the key does nothing else. Android back closes it (`openLayer`). It follows `prefers-reduced-motion`.
- It is shown once, with the flag stored in the kv store. A Settings row ("Show the first-start tips") shows it again (R49 moves it onto its page).
**Done when:**
- e2e: a fresh profile shows it; a reload does not; the Settings row shows it again; a key press only closes it.
- A gallery case, light and dark; i18n for every string.
- Typecheck, unit and e2e tests pass; the start chunk unchanged (the overlay's chunk is lazy: a network check in the e2e).

### ron, R49: Settings as a list of rows, each with its own page, branch `p1/ron-m4a-settings`
**Lane:** day. **Starts when:** R15c4 is merged (it adds a Settings row).
**Read:** decisions.md "Settings: a list of rows" (the shape, and the owner's answer if there is one) and "R21" point 4; `app/src/views/modeSheet.ts` (`settingsSections()`); `app/src/views/SettingsPage.svelte`; `app/src/views/settingsPage.svelte.ts`; `app/src/input/backLayer.ts` (Android back); `app/src/input/haptics.ts` (`vibrate()`, for "Try it"); `app/test/settings.spec.ts`.
- **The list:** one row per section, with its current value and ›: Format key cycle (the ticked notations), Key vibration (`Off`, or `On · 50 % · 15 ms`), Shift / Alpha taps (`settings.taps.value`), the first-start tips row of R15c4. A row opens its page, titled `Settings › <section>`.
- **Back:** ◀, Esc and Android back go from a page to the list, on the row that was open; from the list they close Settings; × closes Settings from anywhere. Digits pick rows and ▶ or Enter opens one, as in every sheet (S2).
- **Key vibration's page:** its three rows as today, plus **Try it**, which fires one pulse at the current values (the dead-key double pulse is unchanged).
- Later sections (Theme R12c, User keys R4b, About) are added as rows; leave a comment where.
- **Docs** (exact text in the report): docs/05 section 3 (Settings) and decisions.md "R21" point 4 (a pointer to the new entry).
**Done when:**
- e2e by touch and by keys: the list; each row opens its page and back returns to the list on the same row; values change in place as before; Try it fires one pulse (`recordVibrations`); Android back walks page → list → closed. `settings.spec.ts` moved to the new paths.
- Typecheck, unit and e2e tests pass; the gallery rebuilt (the list and each page, light and dark); the start chunk unchanged (Settings loads lazily).

### ron, R50b: the picked palette in the app, branch `p1/ron-m4a-palette`
**Lane:** day. **Starts when:** the owner has picked a palette from R50a (decisions.md "R50a" or feedback.md), and R49 is merged.
**Read:** the owner's pick; `docs/mockups/palettes-r50.html`; `app/src/style.css`; `app/src/style.test.ts`; `app/src/keyboard/Keypad.svelte` and `app/src/views/History.svelte` (colours written directly, if any).
- The picked values go into the existing tokens of `style.css`, dark and light. Any colour written directly in a component that the new palette touches moves to a token. R12b later puts the whole token file in place on these values.
**Done when:**
- `style.test.ts` covers every new text/background pair and passes.
- Typecheck and unit tests pass; the gallery rebuilt light and dark; the start chunk within +0.1 kB gzip (the number in the report).

### ron, R12a: visual pass, the mockups for the owner: review-only merge, branch `p1/ron-m4a-look`
**Lane:** day (the owner looks first). **Starts when:** the owner has looked at `docs/mockups/` on the branch (`p1/ron-m4a-look`, 2 commits: `8e8fa19`, `1672208`) and said what to change; run as `scripts/pipeline.sh ron R12a --no-worker` (A10). The branch is 43 commits behind phase-1 and merges clean (`git merge-tree`, 2026-10-18).
**Read:** the branch's report (`git log -1 p1/ron-m4a-look`); `docs/feedback.md` (the owner's notes on the mockups).
**Done when:**
- The branch merges into phase-1 with the mockups under `docs/mockups/`, no app code; the owner's change requests are listed in the report commit of the merge or in feedback.md for R12b.

### ron, R12b: visual pass, tokens and history rows (U5, U7), branch `p1/ron-m4a-tokens`
**Lane:** day. **Starts when:** R12a is merged with the owner's notes, and R4b and R53 are merged (so Find and results mode are in the pass).
**Read:** `docs/05-ui-plan.md` 3.5 and 3.10; the owner's notes (feedback.md); `app/src/style.css`; `app/src/style.test.ts`; `app/src/views/History.svelte`; `app/src/keyboard/Keypad.svelte`; `app/src/views/Sheet.svelte`; the Find chunk from R4a (`app/src/find/`).
- Design tokens in one file (colours per role with R50b's values, type scale, 4 px spacing, radii, motion); no colour or size written directly in a component, Find's and results mode's included; history rows as docs/05 3.5.
**Done when:**
- A grep in the report shows no hard-coded colour or size left in `app/src/**/*.svelte` outside the token file.
- The contrast test passes; the gallery rebuilt (the owner reviews it on the phone); the start chunk within 2 kB of before (the numbers in the report).

### ron, R12c: visual pass, theme, press feedback, reduced motion, branch `p1/ron-m4a-theme`
**Lane:** day. **Starts when:** R12b is merged.
**Read:** decisions.md "A4a" point 3 (the sheet rise, 73 ms); `app/src/views/SettingsPage.svelte` and `app/src/views/modeSheet.ts` (R49's rows); `app/src/state/storage.ts` (the settings schema); `app/src/keyboard/Keypad.svelte` (press feedback); `app/src/views/Sheet.svelte` (the rise); `app/test/settings.spec.ts`.
- Theme setting System / Light / Dark as a Settings row with its page (R49), Dark by default on Android, System in the PWA; press feedback within one frame; `prefers-reduced-motion`; profile the sheet rise with `?bench=keypad` and report where the 73 ms go.
**Done when:**
- e2e: the setting survives a reload; the contrast test passes in both themes; the gallery rebuilt; the start chunk within 0.5 kB of before (the number in the report); the sheet-rise numbers in the report.

### ron, R53: results mode on the View key (P16), branch `p1/ron-m4a-results`
**Lane:** day. **Opus** (it hides the keypad; a wrong state leaves the user without keys). **Starts when:** S9 is merged and the owner has said yes to its proposal (decisions.md "S9"), R15c2 is merged (the `view` key and Esc) and R4b is merged.
**Read:** `docs/research/r13-results-mode.md` sections 1–3; decisions.md P16, "S2: one menu system" and "S9"; `spec/keyboard.yaml` (the `view` key); `app/src/App.svelte` (`press()`, `run()`, `historyKey`, `cancel()`, the `.rowbar` line, the `sheetView` snippet and `.layer`, the `openLayer` effects); `app/src/views/History.svelte` (the row taps, `tapped`); `app/src/clipboard/actions.svelte.ts` (`menu()`, `rowButtons()`); `app/src/apps/shell.svelte.ts` (`open`); `app/src/apps/slots.svelte.ts` (`set`); `app/src/apps/function/compile.ts`; `app/src/keyboard/Keypad.svelte` (the `.pad` box); `app/src/input/backLayer.ts`; `app/src/state/taps.svelte.ts`; `app/src/views/modeSheet.ts` (the taps rows); `app/test/rows.spec.ts`; `app/test/status.spec.ts`; `app/test/topcluster.spec.ts`.
- **The key:** `view` gets `special: results` on its tap (Shift stays as it is). In Home and CAS it collapses the keypad. In an app it is a dead key (r13 1.4). It is not in `AT_ONCE` and it waits in the queue like other keys. View with a sheet or Settings open does what the sheet does with a cluster key today.
- **The slice:** the keypad slides down to a 44 px slice: the keypad's own top edge, a grip and the label "Keys" (i18n), `aria-label` "Show the keypad". Its height is a token. No key reflows, and the slide is ≤ 120 ms and off under `prefers-reduced-motion`. A tap anywhere on it brings the keypad back. The state is not stored (a reload has the keypad up).
- **Ways back:** the slice; Android back (one `openLayer` while collapsed); a hardware Escape after Esc's own jobs (stop a job, a sheet level, a pick); Insert, Recall and Store ▶. Typing on a hardware keyboard does not bring it back.
- **Rows:** while collapsed, a tap on a row's input or result picks it (`picked`), and the long press is unchanged. With the keypad up the taps keep their meaning. A pick made before View stays picked.
- **The line:** R11's `.rowbar` shows `menu(row).slice(0, 6)` while collapsed (five with the keypad up, as now). It stays one line.
- **Plot (Menu item 6):** S2's list becomes 1 Insert, 2 Recall, 3 Copy, 4 Store ▶, 5 Delete, 6 Plot, 7 Copy as, 8 Paste, 9 Share, 0 Clear, and Settings becomes the last row without a digit. Plot is enabled on a finished CAS row with no `numeric` whose input compiles to a drawable function of x (`compile.ts`). Otherwise it is disabled with "Nothing to plot in x". It puts the row's input into the Function app's first empty slot (else F1, replaced) and opens Plot. The Function app's code does not change.
- **A sheet while collapsed** rises from the slice's top edge over the history (the `view` placement), not over the absent maths rows.
- **Counters:** one named-count counter after `taps.svelte.ts` under the IndexedDB key `uses`: `view`, `pick`, and the six actions while collapsed, plus `plotUp`. Shown in Settings beside the taps rows ("Counters"; R49's page if it is merged), with Since and Reset.
- **Docs** (exact text in the report): docs/05 3.3 and 3.5 (the line in results mode, the sixth item), decisions.md P7 point 5 (Home and CAS only, Plot later), and S2's numbers.
**Done when:**
- e2e by touch and by keys: View collapses; the slice, Android back and Escape (after a pick is dropped) bring the keypad back; a reload has it up; a tap picks a row while collapsed and recalls or inserts while up; each of the six actions works on a picked row while collapsed (Insert, Recall and Store ▶ bring the keypad back; Copy, Delete and Plot do not); Plot is disabled on a Home number row with its reason; ☰ while collapsed shows the list over the history; a hardware letter types while collapsed and the keypad stays down; every counter counts and Reset clears them.
- `rows.spec.ts`'s Menu-number tests move to the new numbers (6 Plot, 7 Copy as); the "row buttons cost no viewport" test still holds with the keypad up.
- The viewport share with the keypad up is unchanged (0.354 on the Pixel 7 profile, floor 0.35); a new e2e asserts the collapsed share ≥ 0.9; the gallery has the collapsed state with a picked row, light and dark.
- Typecheck, unit and e2e tests pass; the start chunk within +0.5 kB gzip (the number in the report); `spec/keyboard.yaml` changes only the `view` key's primary action.

### ron, R4a: Find on Math, branch `p1/ron-m4-find`
**Lane:** day. **Starts when:** R12a is merged (the owner looks at the mockups meanwhile). Backlog step 8, its Find part.
**Read:** docs/04 sections 3.3–3.8 and 5.1; decisions.md "R21" (letter lists stay above the keypad) and "S2: one menu system" (rule M1); `app/src/find/rank.ts` (`prepare()`, `search()`, the item shape); `app/src/find/queries.test.ts`; `app/src/App.svelte` (`press()`, `SHEET_KEYS`, `sheetUndrawn()`, `typeLetter`, `insertResult`); `app/src/views/Sheet.svelte` and `app/src/views/sheet.svelte.ts` (the sheet every list is built on); `app/src/input/backLayer.ts` (`openLayer()`); `app/src/input/chips.ts` (`\const`, `\unit`, `\pfx` macros); `app/src/entry/macros.ts`; `app/scripts/size-check.ts` (the Find index budget); `tests/tasks/tasks.yaml` (task 5); `tests/tasks/find-queries.yaml`.
- **Key:** Math = Find (§5.1). **Inside Find:** keys follow §3.7, ranking §3.5, preview and insertion §3.6 (chips: `\const{ID}{symbol}` with value and uncertainty, `\unit`, `\pfx`; a function as its syntax with the cursor in the first argument).
- **Where:** Find takes letters (inside Find every key types its letter), so it is a letter list in R21's sense: it stays above the keypad, where the sheets were before R21a, and is not drawn over the keypad. It is built on the sheet (docs/05 3.1, 3.6 and section 7). Letters: a tap on a non-digit key, a flick down on any key. Esc and Android back close it (`openLayer()`). No `<input>` element: the system keyboard never appears (`app/test/softkeyboard.spec.ts` gets a Find case).
- **Content:** the index items; `?bench=find`. No usage ranking and no `find.usage` (P11). An empty query shows the G2-style Math menu (fixed categories in a fixed order), numbered: on an empty query digits pick a category, after a letter they type (S2 rule M1).
- **Loading:** Find is a lazy chunk, and the index is fetched only when the browser is idle after the engine is ready. **Data:** the generated index (G4); the schema is fixed by §3.3; a change goes under "Needs a decision".
**Done when:**
- Task 5 (`tests/tasks/tasks.yaml`) is active and within budget in `npm run test:tasks`.
- Ranking unit tests and the query test pass unchanged (100/100 first); e2e per key path (open, type, pick by digit, pick by Enter, Esc, Android back, the preview) by touch and by keys; the softkeyboard case for Find.
- The size test passes; an e2e asserts no index request before idle; the start chunk delta in the report.

### ron, R4b: Vars, Memory and the user keys from Find, branch `p1/ron-m4-vars`
**Lane:** day. **Starts when:** R4a and R15c3 are merged. Backlog step 8, the rest.
**Read:** R4a's report (`git log` of its merge); docs/04 3.4 and 5.1; decisions.md "R15c" point 5 (18 slots, all empty) and "R15b"; `app/src/keyboard/userKeys.svelte.ts` (with R15c3's Alpha layer); `app/src/keyboard/userKeys.test.ts`; `app/src/state/storage.ts` (the `userKeys` key); `app/src/engine/defs.ts` (`userNamesOf`); `app/src/calc/port.ts` (`names()`); `app/src/views/modeSheet.ts` (R49's Settings rows); `app/src/find/rank.ts`.
- **Vars** = Find on the user's variables and functions: the live items from `defined` (§3.4), with R4a's keys, preview and insertion.
- **Shift + Math = Memory:** the same list with delete and clear all (§5.1).
- **User keys:** Settings › User keys (R49's row pattern) sets U1–U6 and their Shift and Alpha layers (18 slots) from Find, in R15b's stamped store. Besides Find's functions, units and constants, a slot can hold a place or a sheet: Home, CAS, Apps, Menu, Mode, Settings. Reset empties a slot, since every slot ships empty after R15c2.
**Done when:**
- e2e per path by keys and by touch: Vars lists a stored name and inserts it; Memory deletes one and clears all; a user key set from Find fires after a reload; a slot holding a place opens it.
- Task 5 unchanged; the size test passes; the start chunk delta in the report.

### ron, R36: a picked row says why it has its mark, branch `p1/ron-m4a-why`
**Lane:** day. **Starts when:** G22 is merged (R32, same file, is). Deep-dive item 14.
**Read:** G22's report (`git log` of its merge; the `why` field); docs/04 2.4; `app/src/engine/format.ts` (`markOf()`, `PrecisionWarn`); `app/src/views/History.svelte` and `app/src/App.svelte` (R11's action line above the entry line); `app/src/input/chips.ts` (a constant chip's `unc`); `app/src/i18n/en.ts`; `app/test/rows.spec.ts`.
- The reason comes from G22's facts and the chip table, through the i18n table. It shows in the row's action line while the row is picked, and nowhere else (rule 9). Solve's residual ⚠ is out of scope.
**Done when:**
- `app/test/why.spec.ts`: pick a row (▲); the action line gives the reason in one line: `1/4` → "= exact"; `1/3` → "≈ rounded: the exact value is 1/3"; `normald_icdf(10^-10)` → "⚠ 9 of 12 digits confirmed · normald_icdf is not checked"; a result with G → "≈ uses G (± 1.5·10⁻¹⁵)"; a result from a stored float → "≈ uses B, itself rounded". The test fails on today's code.
- R11's row e2e passes; the viewport share unchanged; the start chunk within 0.3 kB gzip (the number in the report).

### ron, R33: names with a value, marked on the line, branch `p1/ron-m4a-namemarks`
**Lane:** day. **Starts when:** R4b is merged (Vars and Memory list the same names). Deep-dive item 15.
**Read:** decisions.md "The deep-dive review" item 15 (would change if); `app/src/entry/macros.ts`; `app/src/entry/controller.ts` (`create()`: MathLive's options); R4b's report (the live names); `app/src/calc/port.ts` (`names()`); `app/src/input/roundtrip.test.ts`.
1. **The MathLive check first.** Can a name on the line be drawn in another colour without changing the LaTeX the parser reads? Try three ways in a throwaway e2e: CSS on MathLive's rendered atoms, found by their text; `applyStyle` on a range; a macro wrapper that the parser strips. If none keeps `getValue()`, the cursor and ⌫ as they are, stop here: the report says so, and the item drops.
2. **Build:** the session's stored names, refreshed after each definition; the marking happens on render only.
**Done when:**
- Either the report says the check failed (which way failed how) and nothing else changed, or: e2e: after Home `3 ▶ X`, an X typed on the line is drawn in the stored-name colour, in Home and in CAS; after Memory deletes X, the next X is plain; the round trips and the parser golden cases are unchanged; the start chunk within 0.3 kB gzip.

### ron, R37: the angle check, branch `p1/ron-m4a-anglecheck`
**Lane:** day. **Starts when:** R33 is merged. Deep-dive item 16.
**Read:** decisions.md "The deep-dive review" item 16 (the rule and its removal test); `app/src/input/parse.ts` (`Degrees` and the `°` rule, lines 458–498); `app/src/input/latex-to-giac.ts` (the parsed tree); `app/src/views/History.svelte` (the result row and R11's action line); `app/src/state/session.svelte.ts` (the angle setting, `submit`); `app/src/state/taps.svelte.ts` (R9's counter); `app/src/views/modeSheet.ts` (Settings rows).
- **The rule:** in RAD, a trig function (sin, cos, tan, sec, csc, cot) whose whole argument is a literal whole multiple of 15, from 15 to 360, gets a hint under its result: "RAD · sin 30° = 0.5? Tap for DEG". In DEG, a trig argument that contains π gets "DEG · π in the angle: RAD?". A tap switches the angle setting and runs the line again as a new row, the G2 way of fixing it. The hint uses no line when it is not shown (rule 9).
- The detector works on the parsed tree, where the parser knows the argument is a literal. The hint uses the result row's muted style. **Removal test:** count hints shown and taken (as R9's tap counter, in Settings); if none is taken in two weeks of use, the code goes (docs/03 rule 11).
**Done when:**
- A unit test of the detector on the parsed tree; e2e: RAD `sin(30)` shows the hint, and a tap gives DEG and a new row `= 0.5`; RAD `sin(0.5)`, `sin(30x)`, `sin(7)` and `sin(30°)` show none; DEG `sin(π/6)` shows it, and DEG `sin(30)` does not.
- The parser golden cases are unchanged; the start chunk within 0.3 kB gzip.

### ron, R41: key labels for TalkBack, branch `p1/ron-m4a-labels`
**Lane:** day (the first device run after it tries TalkBack for a minute; annabell). **Starts when:** R12c is merged.
**Read:** decisions.md "A4a" point 4 (the largest system font); `app/src/keyboard/Keypad.svelte` (the key `<button>`); `spec/keyboard.yaml` (the labels per layer); `app/src/keyboard/fit.ts` (the fit pass); `app/src/i18n/en.ts`; `app/test/keys.spec.ts`; `app/test/fit.spec.ts`.
- `aria-label` and `aria-description` on the buttons, from i18n keys per key id and layer (English only), no visual change. The fit pass covers the Home/CAS face at font scale 1.5 and 2.0 (A4a point 4).
**Done when:**
- A Vitest over `spec/keyboard.yaml`: every key and layer has a name in the i18n table ("sine", "x to the minus one", "E for the exponent", "Shift"); it fails on today's code.
- e2e: Playwright's accessibility snapshot of the keypad and of each sheet has no unnamed button, and a key's Shift and Alpha layers are in its description ("Shift: arc sine"); gallery cases at font scale 1.5 and 2.0.
- The keys and gestures e2e pass; the start chunk within 0.5 kB gzip (if the names grow it more, they load with the i18n table lazily; the number in the report).

### ron, R40: muted digits past a constant's uncertainty, branch `p1/ron-m4a-constdigits`
**Lane:** day. **Starts when:** R41 and G26 are merged; it uses R12b's colour tokens.
**Read:** G26's report (`uncDigits`); `app/src/input/latex-to-giac.ts` (the chip table, `inexact`); `app/src/input/chips.ts`; `app/src/state/session.svelte.ts` (`submit`: what goes to `home()`); `app/src/views/History.svelte`; `app/src/style.css` (R12b's tokens); `app/src/style.test.ts`; `app/test/chips.spec.ts`.
- The parser sends an inexact constant chip as its name (`pasc_<id>`), and the app passes `{ [ID]: { value: chip.value, unc: chip.unc } }` from the chip table as the third argument of `engine.home()` and reads `result.uncDigits` (G26); it keeps setting `inexactInput` as today, since `home()` does not change the mark facts. The row draws the digits past `uncDigits` in one muted span; copy still gives every digit.
**Done when:**
- e2e: Home, G (as `\const{G}{G}`) × 5.972ᴇ24, Enter: the digits past G26's `uncDigits` are drawn with the muted token, and the mark stays `≈`; copy gives every digit; a result with only exact constants (c) has no muted digit; the same cut at 30 digits.
- The contrast test passes (the muted digits keep the floor for text); the start chunk within 0.3 kB gzip.

### ron, R24a: the slot model, branch `p1/ron-m5-unitslot`
**Lane:** night-safe (no UI: a plain TS model and its tests). **Opus** (the parser and the evaluator read it). **Starts when:** G7 is merged (the ids). The first of four unit-pad packages.
**Read:** `docs/research/r9-unit-pad.md` section 2 (the rules); docs/04 4.3 ("Grammar per slot", the MathLive check of 2026-10-15: the token list is the only source, the LaTeX is output only, the field is written only through `setPromptValue`); `docs/research/r7-unit-slots.md` section 5.4 (the guards); `tools/probes/unit-presses.mjs` (`typePad`, the `UNITS` list); `tools/probes/unit-weights.yaml` (S5's weights, once merged); `app/src/units/types.ts` (G16's `UnitSlot` and `UnitToken`: the model's output type); `app/src/find/rank.ts` (the item shape, for the reading in words); `app/src/i18n/enUnits.ts`.
- **Tests first** (`app/src/units/slot.test.ts`), one per rule of r9 sections 2.2–2.6: a prefix arms; another replaces it; the same one again disarms it. Units in a row multiply; one ÷ per slot. ², ³, ⁴ and ⁻¹ act on the unit before, √ on the unit after. ⌫ removes the last token. A prefix alone and a second ÷ are refused, with a message from the i18n table. For every unit of the probe's 50 and of S5's weights list, the model's tokens give the same prefixes, units and powers as `typePad`'s parts.
- **The model** (`app/src/units/slot.ts`, plain TS): a token list per slot that is exactly G16's `UnitSlot` (`tokens: UnitToken[]`, `per`), the LaTeX shown, and the reading in words from Find's titles (a prefixed pair outside Find's list is marked, S1 guard 3). Its input is pad actions (`prefix`, `unit`, `per`, `power`, `sqrt`, `delete`), never keys, so R24b and R24c plug into it.
**Done when:**
- `slot.test.ts` passes and covers every rule above; the model's output type is `UnitSlot` from `app/src/units/types.ts` (no second slot type).
- Typecheck passes; the start chunk is unchanged (nothing imports the model yet); the report names the action names for R24b.

### ron, R28: units mode in the parser, branch `p1/ron-m5-unitparse`
**Lane:** night-safe (parser and round trips). **Opus.** **Starts when:** R24a and G16 are merged; it must be merged before R24c. Backlog milestone 5 item 2, the ron half.
**Read:** G16's report (the `UnitRequest` input: `formula` as Giac text with `pasu1`, `pasu2`, … per slot and `pask1`, … per constant; `slots: UnitSlot[]`; `consts`; `end`); `app/src/units/types.ts`; `app/src/units/build.ts` and `app/src/units/build.test.ts` (what G16 builds from a request); R24a's report; docs/04 4.3; `app/src/input/parse.ts` (`tokenize`, the number branch, `besideResult`); `app/src/input/emit.ts` (`SerializeError`, the serialize options); `app/src/input/latex-to-giac.ts` (`latexToGiacInfo`, the chip table); `app/src/input/chips.ts`; `tests/golden/parser.yaml` (groups and the `chips:` field); `app/src/input/roundtrip.test.ts`.
- **Units mode** of the parser (an option of `latexToGiacInfo`): the line's LaTeX with a `\placeholder[u<i>]{}` prompt after every number and an optional end slot becomes `UnitRequest.formula`: each prompt is `pasu<i>` multiplying the number before it (`72*pasu1`), every `\const{ID}{…}` chip becomes `pask<j>` with `consts[j-1] = ID`, `\pm` after a number is the uncertainty, written `pasupm(value,sigma)` before the slot (`pasupm(12.34,0.05)*pasu1`; both plain numbers, no slot or constant inside; G18, decisions.md "Opus pass 2 defaults" point 1) and `\to` marks the end slot. The slots themselves come from R24a's model, never from the LaTeX. Outside units mode `\pm`, `\to` and a prompt are errors as today.
- A round trip per token in `parser.yaml` (a new group `units`): the LaTeX, the `formula` it must give and, through G16's builder, the Giac text; `error: true` cases for `\pm` and `\to` outside units mode and for a prompt with no number before it.
**Done when:**
- `parser.yaml` group `units` with at least eight round trips and three error cases, `derived`; the parser stage of the golden gate passes.
- `roundtrip.test.ts` is unchanged for every keyboard template; the golden gate, vitest and typecheck pass; the start chunk unchanged (the parser chunk's delta in the report).

### ron, R24b: the pad drawn over the keys, branch `p1/ron-m5-unitpad`
**Lane:** day (the gallery is reviewed). **Starts when:** the owner has accepted S5's arrangement (decisions.md "P14 arrangement") and R24a is merged. No slots yet: the pad emits R24a's actions.
**Read:** `docs/research/r9-unit-pad.md` section 1; `spec/unit-pad.yaml`; decisions.md "R21" (the layer: Shift + 6 drawn over its keys); `app/src/views/Sheet.svelte` (R21's layer); `app/src/keyboard/fit.ts`; `app/src/keyboard/Keypad.svelte` (R9's legend drawing, the gesture path); `app/src/keyboard/gestures.ts`; `app/src/units/slot.ts` (the actions); `app/test/gestures.spec.ts`; `app/test/flicks.spec.ts`.
- A Vitest for the loader: every key id is a maths key of `spec/keyboard.yaml`, no key holds two cells, and every unit or prefix id is a Find id. Load lazily (a dynamic import with the unit view), never in the start chunk.
- Draw over the maths rows with R21's layer, each cell on its key's box; prefix cells get their own colour token; each cell shows up to three legends, fitted by `fit.ts`; the user cells are marked, an empty one shows a dim "+". Route every press through the keypad's own gesture code (tap, flick, bubble, haptic), mapped by key id and layer. A dev-only switch (`?pad=1`) shows the pad for the gallery until R24c opens it from the units key.
**Done when:**
- The loader Vitest and `app/test/unitpad-draw.spec.ts` (by keys and by touch: every cell, by tap, flick up, flick down, Shift then the cell and Alpha then the cell, emits its action; a user cell emits its unit) pass; the gestures and flicks e2e are unchanged.
- Every legend fits at 360 px within the fit code's 8 px floor, or the report names the cells that do not; the gallery has the pad in light and dark at 360 × 740 and 412 × 915.
- The size test passes with the start chunk unchanged.

### ron, R24c: the unit view entry, branch `p1/ron-m5-unitview`
**Lane:** day. **Opus.** **Starts when:** R24a, R24b, R28, G16, G17 and G25 are merged.
**Read:** `docs/research/r9-unit-pad.md` sections 2.1, 2.7 and 2.8; docs/04 4.3 and 5.5 point 2 (the slot owns the key while it is active); the reports of R24a, R24b, R28 and G16; `app/src/units/types.ts`; `app/src/units/calc.ts` (`Calc.units()` lazy); `app/src/calc/engine.ts` (`EngineCalc` takes the index as an option: wire it); `app/src/App.svelte` (`press()`: the second key owner beside the sheet); `app/src/entry/controller.ts` and `app/src/entry/hwkeys.ts` (the capture `keydown` pattern); `spec/keyboard.yaml` (`unit_slot:`); `tools/probes/unit-presses.mjs`; `tests/tasks/tasks.yaml` (t02, t04).
- The read-only formula with a slot after every number (docs/04 4.3). Write a slot only with `setPromptValue` from R24a's model: `insert()` with the caret outside a prompt still changes the read-only formula. Keys reach the active slot through `press()`, never through `EntryController.run`; give the unit view's field a capture `keydown` like `entry/hwkeys.ts`, so a hardware key reaches the pad's actions or does nothing. R24a's model per slot, with R24b's pad up while a slot is active. Evaluation through `Calc.units()` with R28's parser output, the result shown as it returns it (the full result view is not packaged yet).
- `spec/keyboard.yaml`: `unit_slot:` loses `letters`, `symbols`, `ops` and `exponent_leave`; the probe's `--pad` mode becomes its default.
- **Report:** the shared-file text: docs/04 4.3 rewritten for the pad, the status line at the top of r7, and backlog milestone 5 item 4.
**Done when:**
- `app/test/unitpad.spec.ts` by keys and by touch: the units key on a line, on a picked history row, and on an empty line (quantity 1) opens the slots with the pad up; pad presses fill the active slot, and the reading under the formula follows every press; Enter goes to the next slot, Enter in the end slot evaluates, a flick up on Enter evaluates at once; ◀ ▶ move between slots, and Esc keeps the slots with the line; 44 of the probe's 50 units replayed, each within the probe's count.
- The probe's medians are ≤ 2, with flicks and with taps only; t02 and t04 within their plans (`npm run test:tasks`).
- The gestures and flicks e2e and the keyboard test pass; the size test passes with the start chunk unchanged; `app/test/softkeyboard.spec.ts` has a unit-view case (the prompts never summon the system keyboard).

### ron, R24d: Find in a slot and the user cells, branch `p1/ron-m5-usercells`
**Lane:** day. **Starts when:** R24c and R4b are merged.
**Read:** `docs/research/r9-unit-pad.md` section 2.9; decisions.md P14 (the user cells) and "P14 arrangement"; `spec/unit-pad.yaml` (`user:`); `spec/units-menu.yaml`; `app/src/keyboard/userKeys.svelte.ts` (the stamped store pattern); `app/src/state/storage.ts`; R4a's and R4b's reports (Find's keys and insertion); `app/src/find/rank.ts`.
- Store the cells in the stamped store beside the user keys (a key such as `unitPadCells`), on the same code path as U1–U6 wherever it fits. A user cell holds one Find unit, with or without a prefix (MPa, mmH₂O); its defaults come from `spec/unit-pad.yaml` `user:`.
**Done when:**
- e2e: Math in a slot opens Find on units and prefixes, and an empty query shows the units menu by category; a pick lands in the slot as tokens (a prefixed unit becomes a prefix plus a unit); the six of the probe's 50 units that are not on the pad, each within the probe's Find count; a user cell is set from a Find hit ("Put on the unit pad", choosing the cell and its tap, up or down) and from Settings › Unit pad, survives a restart and resets to its default; an empty user cell opens Find.
- The Find query test unchanged; the size test passes; the gallery has Find in a slot, the units menu and a user cell being set.

### ron, R38a: the backup: export everything, branch `p1/ron-m4-backup`
**Lane:** day. **Starts when:** S6 is merged and the owner has said yes to its proposal; **its steps are completed by S6's report** (the way a file goes out without INTERNET). Until then nobody starts it. Deep-dive item 18.
**Read:** `docs/research/r11-files.md` (S6); `app/src/state/storage.ts` (the keys, `DATA_VERSION`, the migrations); `app/src/clipboard/port.ts` (`share`); docs/04 6.2.
- One file (JSON, each part with its `DATA_VERSION` stamp) holding the history, the definitions, the settings, the user keys (and the unit-pad cells once they exist), sent out by S6's way.
**Done when:** an e2e exports the file and checks every part and stamp; typecheck, vitest and e2e pass; no new permission in `android/app/src/main/AndroidManifest.xml`.

### ron, R38b: the backup: restore from a file, branch `p1/ron-m4-restore`
**Lane:** day. **Opus** (it overwrites the user's stored data). **Starts when:** R38a is merged; **its steps are completed by S6's report**.
**Read:** `docs/research/r11-files.md` (S6); R38a's report; `app/src/state/storage.ts`; `app/src/input/backLayer.ts`.
- Read the file back, check it, show what it holds, then replace or merge as the user picks, through the stamped migrations. A file from a newer version is refused.
**Done when:** an e2e round trip export → clear → restore gives the same state; a newer-version file is refused with a message; typecheck, vitest and e2e pass.

### gorge, G21: `exp` ignores the angle mode (F29), branch `p1/gorge-m4-expdeg`
**Lane:** night-safe. **Starts when:** G2 item 54 is answered and the owner has decided F29 (decisions.md "Needs the user"); this text is the recommended fix; if the owner decides otherwise, the Opus pass gives the package the new rule. Backlog F29.
**Read:** decisions.md F29; `app/src/engine/host.ts` (`casSetupCommands`, `useHomeMode`: how DEG is set); `tests/golden/g2.yaml` item 54; `tests/golden/home.yaml`; `engine/giac/patches/README.md` (if the fix is a Giac patch).
**Behaviour today** (DEG): `exp(i*90)` = `i`, marked `=`; `exp(i*1)` = 0.999847695156+0.0174524064373·i (cos 1° + i·sin 1°); `exp(1+i*90)` = 2.71828182846·i; yet `exp(i*pi)` = −1. In RAD, `exp(i*90)` = −0.448073616129+0.893996663601·i.
- Find where Giac applies the angle mode to `exp` of an imaginary argument, and evaluate `exp` (and `e^`) without it, by a rewrite in the host or a Giac setting. If the fix is a Giac patch, follow `engine/giac/patches/README.md` and write the upstream report for the owner.
**Done when:**
- `home.yaml` and a CAS case, `derived`, failing on today's code: in DEG, the four inputs give their RAD values; `cos(90)+i*sin(90)` stays `i` in DEG, and polar entry with `∡` keeps degrees.
- The golden gate passes with the trig cases in DEG unchanged.

### gorge, G7: Find data for the unit pad and the units menu, branch `p1/gorge-m5-finddata`
**Lane:** night-safe. **Starts when:** S5 is merged by the owner (the test reads the final arrangement). Backlog milestone 5 item 4 (its `add_to_find` part) and `docs/research/r9-unit-pad.md` section 7.
**Read:** `spec/unit-pad.yaml` (the user cells' defaults included); `spec/units-menu.yaml` (the `first` lists, `constants.lists`); `find/units.yaml`; `find/aliases.yaml`; `tools/find-index/generate.mjs`; `tests/tasks/find-queries.yaml`; `app/src/find/queries.test.ts`; S5's report (the ids it lists as missing); `docs/research/r7-unit-slots.md` section 3 (its list).
- Add `add_to_find` (kip, fbm, Ah, mAh) and the constants StdT and StdP to the curated data (`find/units.yaml`), each with a `checks` entry whose size is exact from its definition (`derived` or `oracle`), and query phrases for them in `tests/tasks/find-queries.yaml` ("ampere hour", "kip", "board foot", "standard temperature"). `mmH2O` and `percent`: find out why they are not in the index (qalc data, a generator skip; `percent` and `ppm` are qalc constants, not units), then add the unit with a check or write the reason into `find/units.yaml`'s comments; `%` gets no unit cell.
- The cycle unit (G25, decisions.md "Opus pass 2 defaults" point 3): `rev` as its own unit in `find/units.yaml` (a count of cycles: dimension 1, factor 1) and `rpm` as 1/60 Hz, so the index agrees with `app/src/units/factors.ts`'s `CYCLES` (then drop that override); `rev` is no longer a name of `tr`. Query phrases "revolution" and "rpm".
**Done when:**
- `app/src/find/specids.test.ts` (failing on today's index): every unit and prefix id in `spec/unit-pad.yaml` and every grid entry of `spec/units-menu.yaml` (products such as `ft*lbf`, `Btu/h`, `m^3/h` split into their factors, and the prefixes) resolves to a Find item (`unit:<id>`, `pfx:<id>`); the constants in `constants.lists` resolve to `const:<id>` (e, π and i excepted).
- The query test passes (every phrase in the top 3, at least 90 % first); `npm run index` is clean; the index within budget (≤ 400 kB raw, ≤ 100 kB gzip; the size in the report).

### annabell, A6f1: the gate's golden trigger covers the unit view, branch `p1/annabell-gatefix`
**Lane:** day (no device). From Opus pass 1 (2026-10-18): A6 merged before G16, so the golden trigger does not know the unit view.
**Read:** `app/scripts/gate.ts` (`goldenPaths`, the `index` check's skip); `scripts/pipeline.sh` (the `golden` line of the auto checks); `docs/shifts/rules.md` section 4 step 3.
- The golden gate also runs when `app/src/units/`, `app/scripts/unit-case.ts`, `find/` or `tools/find-index/` change (the units stage reads them), in `gate.ts` and in `pipeline.sh`'s auto checks; the gate regenerates the Find index when `find/` or `tools/find-index/` changed against the base, not only when it is missing. Rules section 4 step 3 names the paths (the report gives the text).
**Done when:** `gate-summary.test.ts` or a new test shows a change in `app/src/units/evaluate.ts` alone selects golden, and a change in `find/aliases.yaml` regenerates the index; typecheck and vitest pass.

### annabell, A9: key vibration on the owner's phone (F41), branch `p1/annabell-haptics`
**Lane:** day (a phone with a motor; take the device lock; not the Tab One). **Starts when:** the owner's phone is connected.
**Read:** backlog.md item 38 (F41) and feedback.md #50; `app/src/input/haptics.ts`; `app/src/App.svelte` (`touched()`, `dead()`); `app/src/main.ts` (`loadNative()`); `android/app/src/main/java/io/github/buerlino/pascaline/PascalineHapticsPlugin.java` and `android/app/src/main/java/io/github/buerlino/pascaline/MainActivity.java` (its registration); decisions.md "P7" point 3 (the setting and its defaults); `tools/README.md` (devices).
- **Find the cause first, with logs, not guesses.** Install a measure build (`./build.sh --dev --measure --install <serial>`), switch Key vibration on, tap keys, and read logcat: the plugin logs `PASCALINE_HAPTICS` for every native pulse (measure builds only), and `adb shell dumpsys vibrator_manager` lists recent vibrations. In this order: (1) no `PASCALINE_HAPTICS` line: the native plugin is never used, so every pulse goes to `navigator.vibrate`, which the Android WebView may ignore: check `Capacitor.isPluginAvailable("PascalineHaptics")` and the dynamic import in `loadNative()`; (2) lines, but nothing felt: the pulse is too short or too weak (15 ms at amplitude 128): try longer pulses and full amplitude; on API 29+ `VibrationEffect.createPredefined(EFFECT_TICK)` or `View.performHapticFeedback(KEYBOARD_TAP)`; (3) lines, and dumpsys shows the vibration ignored or scaled to zero: the system's vibration settings (Android 13+ applies its touch-feedback intensity by usage): set the usage on the `VibrationAttributes`.
- **Fix** the cause found, in the plugin or in `haptics.ts`. If the defaults (50 %, 15 ms) cannot be felt, propose new ones in the report, measured on the phone.
**Done when:**
- A unit test for any TS change (the existing `recordVibrations` e2e helper covers the web path); the report holds the phone, the Android version, the cause with its log lines, the dumpsys entries for ten key taps, and what changed; the owner feels the pulses.

### annabell, A4b: Find timing on the Tab One, branch `p1/annabell-m4-find`
**Lane:** day (device). **Starts when:** R4b is merged and the Tab One is connected (rules section 6). Backlog step 12, its Find part.
**Read:** docs/04 3.2 and 8.3 (the per-key bar); `tools/README.md`; `tools/device_run.py`; `tools/page-series.py`; R4a's and R4b's reports (`?bench=find`).
- Find per key (`?bench=find`) against the §8.3 bar; a miss goes under "Needs a decision" with the number (docs/04 says what changes: incremental Find). Leave an APK built from `phase-1` on the Tab One for the owner. Then the report says whether milestone 4's gate (section 8) is complete.
**Done when:** the medians of ≥ 5 runs with device, Android, WebView and build type are in the report and in `.coord/device-runs.jsonl`; the backlog step 12 line and the milestone 4 gate line are ticked or the miss is a proposal in decisions.md.

### annabell, A7: release signing and the version number, branch `p1/annabell-release`
**Lane:** night-safe in itself (no device; the real key never touches this machine), but it **starts on the owner's go** with section 0g's secret table filled in.
**Read:** section 0g of this brief; `build.sh`; `android/app/build.gradle`; `fdroid/io.github.buerlino.pascaline.yml`; `fdroid/README.md`; `tools/devlock.test.sh` (the shell-test pattern).
1. **Gradle reads the whole key from the environment:** `PASCALINE_KEYSTORE`, `PASCALINE_KEYSTORE_PASS`, `PASCALINE_KEY_ALIAS`, `PASCALINE_KEY_PASS`. The defaults (`throwaway` / `pascaline-throwaway`) apply only when `PASCALINE_KEY_ALIAS` is unset, so dev builds keep working unchanged. No password or path is committed.
2. **`./build.sh --release`:** it fails before any build step when one of the four variables is missing, when the keystore file does not exist, or when the alias is `throwaway`; it never creates or falls back to the throwaway key; it refuses `--dev`, `--measure`, `--unsigned` and `--no-units`, allows `--engine-dir` and `--qalc-dir`; after Gradle it runs `apksigner verify --print-certs` and compares the certificate's SHA-256 with `android/release-cert.sha256` (one line, from 0g's table); on a mismatch it deletes the APK and fails; it writes `dist/pascaline-<versionName>.apk` and `.apk.sha256` as well as `dist/pascaline.apk`; the header comment is updated.
3. **The version:** `versionCode 1` and `versionName "0.1.0"` in `build.gradle`; `tools/check-version.sh vX.Y.Z` (exit 0 when the tag equals `v<versionName>`, else print both and exit 1); the F-Droid draft set to 0.1.0 / `v0.1.0` and 1.
4. **Report:** the shared-file text for backlog R2 and C4, `fdroid/README.md` (the version item is done), and CLAUDE.md's Commands line for `build.sh` (`--release`).
**Done when:**
- `tools/test-release-guard.sh` (no Gradle run) checks each refusal of step 2 and `check-version.sh` on a match (`v0.1.0`) and a mismatch (`v0.1.1`), and passes.
- `./build.sh --dev --engine-dir … --qalc-dir …` still produces a throwaway-signed APK (the command and its last line in the report).

### annabell, A8: the release workflow, branch `p1/annabell-releaseci`
**Lane:** day (the owner pushes the test tag). **Opus** (it handles the signing key on a machine we do not own). **Starts when:** A7 is merged.
**Read:** section 0g; `build.sh` (after A7); `engine/giac/build-wasm-release.sh` and `engine/qalc/build-wasm.sh` (`CONTAINER_ENGINE`, `NO_LOCK`); `app/scripts/golden.ts`; `tools/check-version.sh`.
Write `.github/workflows/release.yml`: trigger `push` of tags `v*` and `workflow_dispatch` with a tag input; runner `ubuntu-24.04` (podman); `permissions: contents: write`, nothing more; `concurrency` per tag; `timeout-minutes: 120`; every action pinned to a full commit SHA with the version in a comment (checkout, setup-java 21, setup-node 22), no other third-party action; the release created with `gh release create` and `GITHUB_TOKEN`. Steps in order: (1) `tools/check-version.sh "$GITHUB_REF_NAME"`; (2) engine and qalc in the pinned container with `NO_LOCK=1`; (3) the golden gate on `engine/giac/_out/release` (absolute `GIAC_OUT`), which must print `GOLDEN GATE PASSED` before the key is decoded; (4) decode the keystore into `$RUNNER_TEMP` (mode 600), then `NO_LOCK=1 ./build.sh --release --engine-dir … --qalc-dir …` with the secrets as `env:` of this step only, never in a `run:` line or `echo`, and an `if: always()` step that deletes the keystore; (5) `gh release create "$TAG" dist/pascaline-<v>.apk dist/pascaline-<v>.apk.sha256 --prerelease` when the major version is 0 or the tag has a `-`, with notes giving the commit, the engine and qalc `SHA256SUMS` and the certificate fingerprint. Not in this package: the PR/CI checks (backlog C3, which builds on A6) and the F-Droid submission (C4).
Also write `docs/release.md`, the owner's one-page checklist: bump versionCode and versionName (and the F-Droid draft) in one commit on `master`; `git tag -s vX.Y.Z` (or `-a`); `git push origin vX.Y.Z`; watch the run; check the SHA-256 and `apksigner verify --print-certs` on the downloaded APK; install over the last release; what a failed run leaves behind (nothing is published) and how to re-run.
**Done when:**
- The workflow passes `actionlint` (run once with `npx` or a container; not added to the repo); the run's log lines are in the report.
- On a throwaway tag `v0.0.1-test` from a test branch (the owner's OK, and the owner pushes it), the run ends with a pre-release whose APK verifies against `android/release-cert.sha256`; then the test release and tag are deleted. Then the owner pushes `v0.1.0`.

### sandra, S5: the unit pad's arrangement and its user cells, branch `p1/sandra-padlayout`
**Lane:** the owner's own (in progress in the main checkout, uncommitted on 2026-10-18: `docs/mockups/unit-pad.html`, `tools/probes/pad-arrange.mjs`, `tools/probes/find-cost.mjs`, `tools/probes/unit-freq/`, `tools/probes/unit-weights.yaml`, the report `docs/shifts/2026-10-17-sandra-padlayout-report.md`, and edits to `spec/unit-pad.yaml`, r9, the probes README, `unit-presses.mjs`, backlog.md and decisions.md). Not run by the pipeline; the owner commits and merges it (by hand, or `scripts/pipeline.sh sandra S5 --no-worker` after the commit). G7, R24a and S7 wait for it.
**Done when (the owner's own check):** on S1's 50 units the median is ≤ 2 with flicks and with taps only; the weighted mean beats the draft's or equals it with the reason given; each of the owner's units takes ≤ 3 presses or the reason is named; every id on the pad is a Find id or is listed for G7; `spec/unit-pad.yaml` schema 2 with `user:`; the proposal "P14 arrangement" is under decisions.md "Needs the user".

### sandra, S7: the docs diet, branch `p1/sandra-docsdiet`
**Lane:** night-safe, **alone**: the last package of its night, and the owner starts nothing until it is merged, because it moves the texts every package edits. **Starts when:** S5 is merged. Deep-dive items 20 and 22.
**Read:** this brief's sections 0, 2, 7 and 8; rules.md section 9; docs/README.md; `scripts/gc.sh` (the path audit); the sizes: decisions.md 143 kB, docs/04 91 kB, backlog.md 68 kB, this brief about 70 kB, the cleanup audit 93 kB (2026-10-18).
1. **One file per package:** section 7 moves to `docs/shifts/packages/<ID>.md`, one file each, in the same bundle shape (the pipeline's lookup then reads the file whose name is the ID: the exact change to `scripts/pipeline.sh` goes into the report for an A-package, and until it is merged section 7 stays as the source). Finished packages are deleted (git keeps them). The brief keeps sections 0 (the path and the tables, each row linking its file), 0c, 2 and 8.
2. **Decisions:** "Decided proposals" keeps what still binds, as Choice, Why (one line) and Would change if. The rest moves to `docs/archive/decisions-2026-10.md`, read only when a decision is questioned.
3. **Backlog:** one or two lines per open item, linking its package and decision. No causes and no steps to reproduce: they live in the package file.
4. **docs/04:** "today" statements that are now history (section 1.2's table, 2.1's "Marked today" column) are made current or cut.
5. **Archive:** the cleanup audit and the finished shift reports go to `docs/archive/`; docs/README.md indexes what stays (docs/03, 05, 06, feedback, the research notes, the shift docs).
6. **Budgets**, which A6's gate checks: the brief ≤ 25 kB, backlog ≤ 20 kB, decisions ≤ 40 kB, docs/04 ≤ 70 kB, a package file ≤ 6 kB.
**Done when:**
- Every link resolves (a small check in `tools/`, run in the report); the budgets hold (the sizes in the report); `scripts/gc.sh` reports no stale path.
- The report lists every moved section and where it went; nothing current is lost (the audit checks three facts at random from each file).

### sandra, S6: files in and out without INTERNET, the backup, branch `p1/sandra-files`
**Lane:** night-safe (Chromium probes; the device checks are annabell's, later). **Starts when:** S7 is merged. Deep-dive item 18; it also answers S4's point 2.
**Read:** `docs/rules-core.md` (offline, F-Droid); `android/app/src/main/AndroidManifest.xml` (no INTERNET); `app/src/clipboard/port.ts` (`share`); `app/src/state/storage.ts` (the keys, `DATA_VERSION`, the migrations); docs/04 6.2; backlog.md "Needs the user" item 7 (the move to the new app id had no backup); `THIRD_PARTY.md` (for any plugin).
1. **Out:** the Web Share API with a file in the Capacitor WebView (`navigator.canShare({ files })` on WebView 131); a download (`<a download>`) in the WebView and in the PWA; `@capacitor/filesystem` with `@capacitor/share` (MIT: their size, and what they need in the manifest). Recommend one that needs no new permission.
2. **In:** `<input type="file">` in the WebView (does it open Android's picker without a plugin, and does it keep the system keyboard closed?); "open with": an intent filter for the file type, and what `MainActivity` needs; the File System Access API in the PWA.
3. **The file:** JSON, one part per stored key with its stamp; what it holds (history, definitions, settings, user keys, later the unit-pad cells); its size at the limits (200 rows in each view, 500 definitions); what a restore refuses (a newer version, a broken stamp); merge or replace.
**Done when:**
- `docs/research/r11-files.md` exists with the three answers and their probes; the report gives the proposal for decisions.md "Needs the user" as one recommendation and the completed step lists of R38a and R38b for section 7; nothing under `app/` or `android/` changed.

### sandra, S8: the outside-test protocol, branch `p1/sandra-outside`
**Lane:** night-safe. **Starts when:** S6 is merged. Deep-dive item 24.
**Read:** `docs/03-feature-analysis.md` rules 1, 2 and 13; `tests/tasks/tasks.yaml`; `tests/tasks/find-queries.yaml`; decisions.md P14; backlog.md "Needs the user" items 0 and 8.
Write `docs/research/r12-outside-test.md` for two 30-minute rounds that the owner runs: three engineers or engineering students who have not seen the keys, from at least two fields; round 1 after R4b (Find), round 2 after R24c (the unit pad), before R24d's user cells are set; the ten tasks, ten Find queries in their own words, five units on the pad from a printed list; recorded: presses (the tap counter), time, misses, the words they typed (new aliases for `find-queries.yaml`), where they hesitated; privacy: no data leaves the phone, the owner takes the notes, no names are kept; what comes back: rows in feedback.md marked "outside". Add a one-page printable task sheet, `docs/mockups/outside-test.html`.
**Done when:** the note and the sheet exist; the owner can run round 1 with the sheet and an APK and nothing else (the report says what the owner prints and installs); nothing under `app/` changed.

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
Every review and merge is a pipeline run (rules section 4; CLAUDE.md): the audit by sofia on `git diff -U5 phase-1...<branch>` plus the block's "Done when" lines, then `git merge --no-ff --signoff` into `phase-1`. A finished branch from before the pipeline is merged with `scripts/pipeline.sh <agent> "<ID>" --no-worker` (A10). The Opus pass (section 0c) applies the reports' shared-file text, removes merged blocks from section 7 and their rows from the tables, and files proposals under "Needs the user". When a merge completes milestone 4, the Opus pass writes `docs/shifts/<date>-m4-report.md` and adds milestone 4 to docs/02 section 12. Never push.
