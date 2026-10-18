<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Shift brief: milestone 4a "feel" and milestone 4 "Find and trust", with milestone 5's unit view beside them (run by the owner)

**Every package runs through `scripts/pipeline.sh`** (rules section 4): by day the owner starts one package at a time (`scripts/pipeline.sh <agent> "<ID>" --model <m>`, the table gives agent and model) and reads the RESULT line; at night `scripts/night.sh` runs the queue of section 0c. Nobody starts a worker or merges another way (CLAUDE.md). The standing rules in [rules.md](rules.md) apply; where the two differ, this brief wins. Each open package is one file in [packages/](packages/), in the shape the pipeline bundles (section 2). **Until A14 is merged, section 7 is the pipeline's copy of those files:** edit a package in both places; `node tools/docs-check.mjs` fails when they differ.

## 0. State and the path
`phase-1` on 2026-10-18, after Opus pass 19 (S7, `b6370a5`), checked as a whole on 2026-10-19 ([research/check-2026-10-19.md](../research/check-2026-10-19.md): five silent wrong numbers, packages A15, G34, G21b, G35, G36, S10), then deeper ([research/deep-check-2026-10-19-angle-marks.md](../research/deep-check-2026-10-19-angle-marks.md)). Every merge and its commit: `git log --merges --oneline phase-1`; the audits are in the Opus passes' defaults (decisions.md, older ones in [archive/decisions-2026-10.md](../archive/decisions-2026-10.md)) and the night reports ([archive/shifts/](../archive/shifts/)).

### The path (owner, 2026-10-14; rewritten 2026-10-18 after the architecture pass and S7)
**By day, one pipeline at a time** (owner, 2026-10-18), in this order; each starts when the one before is merged:
1. **A14** (the pipeline reads the package files; section 7 goes), then **A15** (the pipeline enforces its audit model, size and docs checks), both before the next night.
2. **R50b** (Pascaline in the app, half a day on the phone), **R15c1 → R15c2 → R15c3 → R15c4** (the R3 top cluster), **R55** (digit groups), **R49** (Settings rows), **R57** (the decimal comma, on R49's page pattern), **R50e** (Appearance; R50c, R50d at night).
3. **R4a** (Find on Math), **R4b** (Vars, Memory, the user keys), **R53** (results mode on the View key), **R36**, **R33**, **R37**, **R12b**, **R12c**, **R41**, **R40**.
4. The unit pad: **R24b** → **R24c** → **R24d** (after R4b).
5. annabell by day: **A9** and **A11** as soon as a device is connected; **A12** (G29 is merged); **A4b** after R4b; **A7 → A8** on the owner's go.
6. After S6: **R59** (also after R4b; G33 is merged), **R38a → R38b** (the owner's yes to S6's proposal first).

**At night** (section 0c): S12 (engine defaults, not G2 copies) and its removal packages, then the checks' night-safe packages and the sandra docs packages.

**Why this order:**
- A14 first: until it is merged every package text lives twice. A15 next: the pipeline must enforce the audit model and run the size and docs checks itself.
- R15c goes first among the feel packages: it changes keys the hand is learning (docs/03 rule 8). R4b sets the user keys, R53 uses the View key, R41 labels the keys, so all wait for it.
- R50b before R15c1 (owner, 2026-10-19): the R3 packages are written on its colour roles. R55 before R49: half a day of render code the owner then reads every day; R57 after R49 (its page pattern).
- Trust features after the code they build on: R33 and R37 after Find; R40 after G26 and R12b's tokens.
- The start chunk is 53.28 of 60 kB gzip (owner, 2026-10-19, set by A15; docs/04 8.3): every UI package reports its delta.

### The open packages
| # | Package | Agent, model | Lane | Starts when merged | Size |
|---|---|---|---|---|---|
| [A14](packages/A14.md) | The pipeline reads the package files | annabell, Sonnet | day, first | S7 | ~0.25 d |
| [A15](packages/A15.md) | The pipeline enforces its rules | annabell, Sonnet | day, before the next night | A14 | ~0.5 d |
| [G34](packages/G34.md) | A carried value keeps what it showed when the angle mode changes | gorge, **Opus** | night | A15 | ~1 d |
| [G21b](packages/G21b.md) | exp ignores the angle mode inside Giac; pasexp goes | gorge, **Opus** | night | G34; S14's route P | ~1 d |
| [G49](packages/G49.md) | Marks travel through Ans, chips and Store: engine | gorge, **Opus** | night | G34 | ~1 d |
| [R65](packages/R65.md) | Marks travel through Ans and chips: session | ron, **Opus** | night | G49 | ~0.5 d |
| [S14](packages/S14.md) | Spike: Giac always in radians, degrees in our parser | sandra, Opus | night | nothing; before G21b | ~1 d |
| [G50](packages/G50.md) | Complex arguments of the audited functions | gorge, **Opus** | night | A15 | ~0.75 d |
| [R64](packages/R64.md) | The angle mode lives in our parser (route R) | ron, **Opus** | night | S14 and the owner's yes to route R | ~0.5 d |
| [R64a](packages/R64a.md) | The plot follows the angle mode (both routes) | ron, Sonnet | night | nothing | ~0.25 d |
| [G46](packages/G46.md) | Giac always in radians; pasexp goes (replaces G21b) | gorge, **Opus** | night | R64 | ~1 d |
| [G35](packages/G35.md) | The unit check sees every term, zero ones too | gorge, **Opus** | night | A15; before R24c | ~0.5 d |
| [G36](packages/G36.md) | FIX shows no unconfirmed digit in a complex number | gorge, Sonnet | night | A15 | ~0.25 d |
| [S10](packages/S10.md) | docs/04 diet, room for the next rewrites | sandra, Opus | night | nothing; before R15c2 | ~0.25 d |
| [G38](packages/G38.md) | The exact path decides at the value precision | gorge, **Opus** | night | A15 | ~0.75 d |
| [G39](packages/G39.md) | A divergent sum or integral is refused; Giac's pair is no list | gorge, **Opus** | night | A15 | ~0.75 d |
| [G41](packages/G41.md) | σ beyond first order at a stationary point | gorge, **Opus** | night | G35; before R24c | ~0.5 d |
| [G37](packages/G37.md) | °C and °F inside a compound unit are an interval | gorge, **Opus** | night | G35; before R24c | ~0.5 d |
| [G40](packages/G40.md) | Angles in the unit view: inverses, ω·r, rpm | gorge, **Opus** | night | A15; before R24c | ~0.75 d |
| [G42](packages/G42.md) | median, round and quartiles as the G2 and our display | gorge, Sonnet | night | A15 (round: G2 item 66) | ~0.5 d |
| [G43](packages/G43.md) | The golden gate checks invariants across settings | gorge, Sonnet | night | A15 (store part: G34) | ~0.5 d |
| [G44](packages/G44.md) | Inverse distribution functions polished | gorge, **Opus** | night | A15 | ~0.5 d |
| [S11](packages/S11.md) | The unit result view as packages (R60–R63) | sandra, Opus | night | A14 | ~0.5 d |
| [S12](packages/S12.md) | Engine defaults, not G2 copies: the audit, then its removal packages | sandra, Opus | night, first | nothing | ~0.5 d |
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
| [R59](packages/R59.md) | The library rows: import and export (S4) | ron, Sonnet | day | R4b and S6 | ~0.5 d |
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
1. **One pipeline run at a time**, and never a worker started any other way. A package is `scripts/pipeline.sh <agent> "<ID>" --model <model from the table> --audit-model <sonnet, or opus for a gorge package>`: fresh worker, checks, at most two fix rounds, sofia's audit (P17: Opus for gorge at night, Sonnet for ron and sandra; by day `auto`), merge. A review-only merge is `scripts/pipeline.sh <agent> "<ID>" --no-worker --audit-model <the same rule>` (A10): phase-1 merged into the branch, checks, audit, merge; a conflict or a FIX is a fix round for the package's agent. Its RESULT line in the log is the step's state.
2. **No devices:** nobody runs `adb` or `build.sh`. annabell is not used at night.
3. **henri decides nothing.** Anything this section does not settle: the pipeline logs it, and henri hands it to the next Opus pass (at once, if it blocks the queue). **Follow every Opus-pass recommendation as written.** Plan changes go to the owner through `docs/decisions.md` "Needs the user", written by the Opus pass.
4. **Workers tick their own backlog line** and file their "Needs the user" items on their branch (rules section 5); the audit sees them in the diff.
5. **Opus pass:** `scripts/pipeline.sh pass <n> "<IDs with merge commits or unmerged branches>" "<open questions or none>"` after every three finished packages (merged or left unmerged; fix packages from a pass count), and the last pass at the end of the queue. Each FIX line of its reply runs as `scripts/pipeline.sh <agent> "<prompt>" --id <ID>f1 --branch <branch> --model <m> --audit-model <sonnet, or opus for gorge>`, then QUEUE is followed. A prompt never holds a backtick or a `$` (`night.sh` refuses them; two refusals in a row end the night). The last pass's FIX packages get only their audit, then the report.
6. **Log:** the pipeline writes one line per step in `.coord/log.md` (time from `date`, step, agent and model, outcome, commit); `night.sh` logs each henri reply. The log is the queue state: henri continues from the first step without a RESULT line.
7. **Usage limit:** the pipeline exits 75 and `night.sh` waits 30 minutes and retries, at most six times, then logs `STOPPED`. No retry loops in agents. The owner resumes with `scripts/night.sh` again.
8. **A step that ends without a RESULT line** (the pipeline died; A10 makes every exit print one): henri runs the same step once more; if the log then shows it twice without a RESULT, he skips it and goes on. **Worker gone without a report** (no commit): the pipeline logs `NOT MERGED (no commits)` and keeps the worktree; henri runs the same step once more (the pipeline resumes the branch). If that fails too, go on.
9. **The end:** after the last pass and its FIX packages, `scripts/pipeline.sh report` writes and commits the shift report; henri then answers `SHIFT DONE`.

### The queue (the next nights)
Estimates are wall-clock guesses. A package merged by day is skipped (log it); a step whose "after" is not merged is skipped for that night and stays in the queue. The audit model follows rule 1. The order: the silent wrong numbers by severity, then the gates and the docs, each after what it needs.

| Step | What | Agent, model | Branch | After | Est. |
|---|---|---|---|---|---|
| 17 | S12 engine defaults, not G2 copies: the audit, then its removal packages | sandra, Opus | `p1/sandra-g2audit` | — | 1.5 h |
| 18 | S10 docs/04 diet | sandra, Opus | `p1/sandra-docs04diet` | — | 30 min |
| 19 | S14 spike: Giac always in radians | sandra, Opus | `p1/sandra-radspike` | — | 1.5 h |
| 20 | R64a the plot follows the angle mode | ron, Sonnet | `p1/ron-m4-plotdeg` | — | 45 min |
| 21 | G34 a carried value keeps what it showed when the angle mode changes | gorge, Opus | `p1/gorge-m4-anglefree` | A15 | 1.5 h |
| 22 | G38 the exact path decides at the value precision | gorge, Opus | `p1/gorge-m4-decideprec` | A15 | 1.5 h |
| 23 | G39 a divergent sum or integral is refused | gorge, Opus | `p1/gorge-m4-divergent` | A15 | 1.5 h |
| 24 | G35 the unit check sees every term, zero ones too | gorge, Opus | `p1/gorge-m5-zerodim` | A15 | 1 h |
| 25 | G49 marks through Ans, chips and Store: engine | gorge, Opus | `p1/gorge-m4-chipfacts` | G34 | 1.5 h |
| 26 | R65 marks through Ans and chips: session | ron, Opus | `p1/ron-m4-chipfacts` | G49 | 1 h |
| 27 | G36 FIX shows no unconfirmed digit in a complex number | gorge, Sonnet | `p1/gorge-m4-fixcomplex` | A15 | 30 min |
| 28 | G50 complex arguments of the audited functions | gorge, Opus | `p1/gorge-m4-complexaudit` | A15 | 1.5 h |
| 29 | G42 median, round, quartiles | gorge, Sonnet | `p1/gorge-m4-stats` | A15 | 1 h |
| 30 | G37 °C inside a compound unit is an interval | gorge, Opus | `p1/gorge-m5-degcompound` | G35 | 1 h |
| 31 | G40 angles in the unit view | gorge, Opus | `p1/gorge-m5-angles` | A15 | 1.5 h |
| 32 | G43 invariants across settings in the gate | gorge, Sonnet | `p1/gorge-m4-invariants` | G34 | 1 h |
| 33 | G44 inverse distribution functions polished | gorge, Opus | `p1/gorge-m4-icdfpolish` | A15 | 1 h |
| 34 | G41 σ beyond first order at a stationary point | gorge, Opus | `p1/gorge-m5-sigma2` | G35 | 1 h |
| 35 | S11 the unit result view as packages | sandra, Opus | `p1/sandra-unitresult` | A14 | 1 h |
| 36 | S6 files in and out without INTERNET | sandra, Opus | `p1/sandra-files` | S7 and A14 | 1 h |
| 37 | S8 the outside-test protocol | sandra, Opus | `p1/sandra-outside` | S6 | 30 min |
| 38 | R50c the theme generator and four more families | ron, Sonnet | `p1/ron-m4a-themegen` | R50b | 1.5 h |
| 39 | R50d Plain keys and High contrast in the components | ron, Sonnet | `p1/ron-m4a-plainkeys` | R50c | 1 h |
| 40 | **The last Opus pass** on what came after pass 19, then its FIX packages | Opus | — | — | 20 min + fixes |
| 41 | Shift report, then stop | — | — | — | 10 min |

Not in the queue: the ron lane's day packages (section 0; R64a, R65, R50c and R50d are queue steps); devices (A9, A4b, A11, A12); A7 and A8 (the owner's go); R59, R38a and R38b (after S6's report).

### The commands henri replies with (one per decision; `scripts/night.sh` runs it)
- `scripts/pipeline.sh <agent> "<ID>" --model <sonnet|opus> --audit-model <sonnet, or opus for gorge>`: the next queue step not done (skip steps the table or the log marks merged or skipped, and steps whose "after" is not merged).
- `scripts/pipeline.sh <agent> "<ID>" --no-worker --audit-model <sonnet, or opus for gorge>`: a review-only merge of a finished branch.
- `scripts/pipeline.sh <agent> "<FIX prompt, verbatim>" --id <IDf1> --branch <branch> --model <m> --audit-model <sonnet, or opus for gorge>`: a FIX line of the last Opus pass, one per call, in order. No backtick and no `$` anywhere in the line.
- `scripts/pipeline.sh pass <n> "<IDs with merge commits or unmerged branches>" "<open questions or none>"`.
- `scripts/pipeline.sh report`, then `SHIFT DONE`.

### Opus pass (instructions for the Opus agent)
You are the shift's quality gate and its decision-maker; henri executes your reply literally. Work in the worktree where `phase-1` is checked out (the pipeline tells you which); no code changes.
1. For each package: its package file (`docs/shifts/packages/<ID>.md`), its report (`git log -1 <merge>^2`, or the branch tip if unmerged), its diff (`git diff <merge>^1 <merge>`), and the audit's verdict from `.coord/log.md`.
2. Run once on `phase-1` (from `app/`, with absolute `GIAC_OUT`, `PASCALINE_DL_DIR` and `PASCALINE_QALC_DL_DIR`): typecheck, `npm run index` then `FIND_INDEX=required npm test`, e2e, and the golden gate when engine or parser code changed. Take `tools/devlock.sh acquire host-cpu opus 1800` around them.
3. Check what an audit tends to miss: wrong or invented expected values (sources), a missing round trip, silent wrong numbers or marks (principle 3), scope, keys that moved, tests that pass for the wrong reason.
4. Decide each "Needs a decision" item of these packages and each open question from the log: a default within the plan goes into `docs/decisions.md` (rules section 9); a plan change goes under "Needs the user" with your recommendation in one sentence. Apply the "For shared files" text of the packages' reports, delete each merged package's file (until A14 is merged, also its block in section 7) and its row from section 0's table, and run `node tools/docs-check.mjs`. Commit those doc changes on `phase-1` with `git commit -s` and the Opus trailer, under `tools/devlock.sh acquire integ opus 600` (A10).
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

## 7. Packages
The pipeline's copy of [packages/](packages/) until A14 is merged: edit a package here and in its file (`node tools/docs-check.mjs` fails when they differ); A14 deletes this section. The shape of a block: the heading `### <agent>, <ID>: <title>, branch \`p1/<agent>-<slug>\``; **Lane** (night-safe = no device, no APK, no eye on the UI; day = the owner tries it); **Starts when**; **Read** (repo paths get bundled, first 400 lines; the big shared docs by bare name and section); the steps; **Done when** (lines an auditor checks in the diff).

### annabell, A14: the pipeline reads the package files, branch `p1/annabell-pkgfiles`
**Lane:** night-safe (scripts and docs only), but it runs **first, by day**, right after S7: until it is merged every package text lives twice, in brief section 7 and in `docs/shifts/packages/` (`node tools/docs-check.mjs` checks they are the same). **Starts when:** S7 is merged.
**Read:** `scripts/pipeline.sh` (the spec lookup, about lines 130–150, and the bundle's report part); `scripts/pipeline.test.sh`; `tools/docs-check.mjs`; S7's report (`git log` of its merge: the exact change to `scripts/pipeline.sh` and the texts below); rules.md section 4 point 1; this brief's header and sections 0c, 2 and 8a.
1. **Test first:** `scripts/pipeline.test.sh` runs the dry run for every file of `docs/shifts/packages/` in the phase-1 worktree (agent, ID and branch from the file's first line) instead of every heading of section 7; a made-up ID still exits 2 with a message naming it. It fails on today's script once section 7 is gone.
2. **The lookup:** an ID's spec is `docs/shifts/packages/<ID>.md` in the phase-1 worktree, whose first line is the heading the branch is read from; a missing file ends in `die` naming the ID and the path. The bundle's report part ends at `## 8.` instead of `## 7.`. The header comment says so.
3. **The texts:** delete brief section 7 and the sentences that call it the pipeline's copy (the header, 0c's Opus pass point 4, 8a); rules.md section 4 point 1 and the agents' files say "the package file" (exact text in S7's report; the agents' files as text in the report).
4. **gc.sh's dry run** (S7's report, risk 4): `scripts/gc.sh` without `--apply` writes `.tasks/gc-<date>-dry.md`, so it no longer overwrites the day's applied report.
**Done when:**
- `scripts/pipeline.test.sh` passes on the branch; `scripts/pipeline.sh ron R15c1 --dry-run` prints a bundle whose task is `docs/shifts/packages/R15c1.md`.
- The brief has no section 7; `tools/docs-check.mjs` measures the whole brief against 28 kB (owner, 2026-10-19: sections 8 and 8a count from now on) and passes.
- No application code is changed (`app/src/` untouched).

### annabell, A15: the pipeline enforces its own rules, branch `p1/annabell-pipecheck`
**Lane:** day, right after A14 and before the next night (scripts and test config only). **Starts when:** A14 is merged. From `docs/research/check-2026-10-19.md` findings 9, 10, 11 and 14.
**Read:** `scripts/pipeline.sh` (the `--audit-model` handling, `run_checks` about lines 240–290); `scripts/pipeline.test.sh`; `app/scripts/size-check.ts`; `app/playwright.config.ts`; `tools/docs-check.mjs` (line 33); rules.md section 4 points 3–4; brief section 0c rule 1; decisions.md P17.
1. **Test first:** `scripts/pipeline.test.sh` covers each point below with a dry run; each fails on today's script.
2. **The audit model:** P17's `auto` choice is a floor. A gorge package at night, or a diff that touches `app/src/input/`, `app/src/engine/`, `app/src/units/`, `engine/` or `spec/keyboard.yaml`, is audited by Opus even when the line says `--audit-model sonnet`. The raise is logged (`audit model raised to opus: <why>`). Night rule 1's text in brief 0c gets `--audit-model auto` in henri's commands (exact text in the report).
3. **The checks:** `run_checks` adds `size` (`npm run build`, then `npm run size`) when `app/` changed, and `docs` (`node tools/docs-check.mjs`) on every run. Both count like the other checks: a failure is a fix round. `size-check.ts` exits 1 with a message when `dist/index.html` is older than the newest file under `app/src/` or `spec/`. The start-chunk budget at `size-check.ts:93` becomes 175 kB raw and 60 kB gzip (owner, 2026-10-19); docs/04 lines 411 and 487 follow (text in the report).
4. **No reused dev server:** `app/playwright.config.ts` sets `reuseExistingServer: false`, so a run on a port another checkout's Vite holds fails at once, with Playwright's "port in use" error, instead of testing that checkout's code. CLAUDE.md's e2e line gets "with PW_PORT=<free port>" (text in the report).
5. **docs-check:** only tracked Markdown counts (`git ls-files` without `-o`); untracked files with a broken link are listed as a warning line and do not fail.
6. **The e2e rerun** (night 3's report, follow-ups): when the pipeline reruns e2e for timing, it compares the failures it parsed with Playwright's own "N failed" summary line and logs a mismatch as a check failure.
**Done when:**
- `scripts/pipeline.test.sh` passes; a dry run of a gorge package with `--audit-model sonnet` prints the raised model.
- A branch that only touches `docs/backlog.md` with a broken link fails the `docs` check. `npm run size` on a stale `dist/` fails with the message. A second `npm run test:e2e` on a port another server holds fails at start.
- No application code changed (`app/src/` untouched).

### gorge, G34: a carried value keeps what it showed when the angle mode changes, branch `p1/gorge-m4-anglefree`
**Lane:** night-safe. **Starts when:** A15 is merged. From `docs/research/check-2026-10-19.md` findings 1 and 2 (silent wrong numbers).
**Read:** `app/src/engine/host.ts` (`defsAfter` and the store command `name:=(…)` about line 335; `homeRunRaw`; `restore`); `app/src/engine/homeEval.ts` (the result's `exact` and `full`; `pasexp` in `ENGINE_DEFINITIONS`); `app/src/state/session.svelte.ts` (`chipFor`, lines 455–458); `app/src/engine/library.ts` (`exportLibrary`); docs/04 2.4 and 2.8; decisions.md M4-7 and F29.
- **The bug:** in DEG, `TH:=atan(3/4)` shows 36.8698976458 and stores `TH:=(atan(3/4))`; in RAD, `TH` is 0.643501108793. `S:=sin(1)` in DEG, then RAD: 0.841470984808 instead of 0.0174524064373. The other way round goes wrong too. `A:=e^(i·90)` in DEG stores `cos(16200/pi)+i*sin(16200/pi)`, so RAD gives −0.299515394755−0.954091467473i instead of −0.448073616129+0.893996663601i. Ans and a `\res` chip carry the same text (`item.full`), and the library export writes it.
- **The rule (default, check 2026-10-19):** a Home value that leaves its evaluation (a stored value, Ans, a `\res` chip, an exported value) is the value shown, whatever the angle mode is later. A CAS value stays symbolic, as typed.
1. **Tests first.** A sequence form in `tests/golden/home.yaml`: a case with `steps` (input and angle per step) and the expected display and mark of the last step, run by the golden gate's home stage on one engine. Cases, sources `oracle` (mpmath) or `derived`: the three bugs above; `V:=sin(1)` in RAD, then DEG `V` = 0.841470984808; Ans after a DEG `sin(1)`, then RAD `Ans*2` = 0.0349048128746; `T:=sin(30)` in DEG (exact 1/2) stays `=` 0.5 in RAD; `R:=sqrt(2)` keeps its exact form. Each fails on today's code.
2. **The fix.** Giac re-reads a stored text in the angle mode of each later use, so a carried text must not depend on it. Where `host.ts` builds the store command, `exact` and `full`: an exact text that holds an angle-dependent function (sin, cos, tan and their inverses and reciprocals, and the cos/sin that pasexp returns) of a number is carried as its confirmed decimal, marked inexact. Later results are then `≈`, as with R44's inexact chip. An angle-free exact form that both modes read alike may replace the decimal where Giac gives one: probe it first (`tools/probes/engine.ts`, `MODE=raw`) and report which inputs keep an exact form. Texts with no such function (`1/2`, `sqrt(2)`) are unchanged.
3. **The preview and the facts** stay as they are (the preview already shows the right value). A stored value marked inexact gets its facts, as M4-7 says.
4. **Record the mode:** each `var` entry of the defs log gets the angle mode it was stored in (`angle`, absent for older entries), so that a later migration knows what an old text meant (`docs/research/deep-check-2026-10-19-angle-marks.md` Part 2 point 2; S14 and G46 use it). If S14's route R is built, G46 replaces this package's decimal by the angle-free exact form.
**Done when:**
- The new cases pass, and the golden gate passes with its counts in the report; vitest and typecheck pass.
- The report gives docs/04 2.8 one sentence: "A value that leaves its evaluation (stored, Ans, a chip, an export) is the value shown, independent of the angle mode." It also lists any input that loses its exact form, with its mark.
- Existing stored logs: a value stored before this package keeps its old text. The report says whether a migration (`migratedText`, `DATA_VERSION`) is worth it; if yes, the migration and its test are in.

### gorge, G21b: exp ignores the angle mode inside Giac; pasexp goes, branch `p1/gorge-m4-expdeg-patch`
**Lane:** night-safe (an engine build under the host-cpu lock, about 5 min). **Starts when:** G34 is merged, and S14 recommends route P (patch Giac per path) and the owner agrees; on route R, G46 replaces this package. Settled by F29 (decided; decisions.md "G21b"); from `docs/research/check-2026-10-19.md` findings 3, 4 and 7. On route P the scope grows by `docs/research/deep-check-2026-10-19-angle-marks.md` D4–D7 and D12 as S14's report lists them (cosh and sinh of imaginaries fall under point 4 as exp does).
**Read:** `engine/giac/patches/README.md` (how a patch is kept and reported); `engine/giac/build-wasm.sh`; Giac's `src/usual.cc` around `gen exp(const gen & e0,GIAC_CONTEXT)` (line 837 in giac-2.1.0: the float branch already switches to radians with `get_mode_set_radian`, line 872; the exact paths that turn exp of an imaginary into cos and sin do not); `app/src/engine/homeEval.ts` (`pasexp`, `expIgnoresAngle`, `showExp`); `app/src/engine/host.ts` (`homeRun`, `casRun`); `app/src/engine/numeric.ts` (the audited list); decisions.md F29.
- **The bugs (DEG):** Home `∫₀⁹⁰ e^(i·x) dx` gives `= 1+i` instead of 0.893996663601+1.44807361613i (derived: −i·e^(90i)+i). `gr(x):=e^(i·x)` typed in RAD, or imported from a library, gives `gr(90)` = `= i` instead of −0.448073616129+0.893996663601i. CAS `re(subst(exp(i*x),x=90))` gives 0 instead of −0.448073616129. The export writes `pasexp(` into a library file.
1. **Tests first:** golden home and precision cases for the four bugs above (sources `derived` or `oracle`), plus F29's typed cases (`e^(i·90)` in DEG and RAD), and a stored-log migration test (`pasexp(` → `exp(`).
2. **The patch:** find, by probe, where Giac's exact evaluation turns exp of an imaginary (or re, im, abs, arg of it) into cos and sin in the current angle mode, and do it in radians there, as the float branch does. The patch stays minimal, goes into `engine/giac/patches/` with its README entry, and the upstream report text goes in the report (for the owner's email). Rebuild the dev engine in the main checkout under the host-cpu lock.
3. **Then remove the rewrite:** `pasexp`, `expIgnoresAngle`, `showExp` and their call sites go. A `DATA_VERSION` migration turns `pasexp(` into `exp(` in the stored definitions and in library files read with an older stamp.
4. **Fallback (owner, 2026-10-19):** if the probe finds an exp path the patch cannot reach, `pasexp` stays for that path (steps 3's removal shrinks to the covered ones), and an exact exp with an imaginary part in DEG from an uncovered path carries a ⚠, never a silent value; one test per uncovered path, and the report lists them for the owner.
**Done when:**
- The new cases pass on the patched engine; `npm run golden` ends in GOLDEN GATE PASSED, with its counts and `compare-engines.ts` old against new in the report (only the intended differences).
- `grep -rn pasexp app/src` finds only the migration; vitest, typecheck and e2e pass.
- The release engine (`build-wasm-release.sh`) is not built here; the report says the patch applies to it unchanged.

### gorge, G35: the unit check sees every term, zero ones too, branch `p1/gorge-m5-zerodim`
**Lane:** night-safe. **Starts when:** A15 is merged; before R24c. From `docs/research/check-2026-10-19.md` findings 5 and 13.
**Read:** `app/src/units/evaluate.ts` (`UNIT_DEFINITIONS`, `pasuq` lines 32–36, `refusal`, the uncertainty path); `app/src/units/build.ts` (`buildJob`, how `pasupm` values become symbols); `app/src/units/types.ts`; `tests/golden/units.yaml` (header, d41, t14); `app/scripts/golden.ts` (stage units); docs/04 4.3 ("an exact 0 has no dimension").
- **The bug:** `pasuq` reads the dimension from `normal(f)`, where a term worth 0 is gone. `0 m + 1 s` → `= 1 s`; `5 m − 5 m + 1 s` → `= 1 s`; `0 m → s` → `= 0 s`; `0 ± 0.1 m` shows `0.00 ± 0.10` with no unit.
1. **Tests first,** in `units.yaml` (source `derived`): the four inputs above refused with "Units don't match: L vs T" (the last one keeps m and shows `0.00 ± 0.10 m`); `0 m` alone shows `0 m`; `5 m − 5 m` stays `= 0` (d41, now with unit m); `0 K → °C` stays −273.15 (t14). Also `−(5 °C) → K`, which today says "Use K or Δ°C for a temperature difference": it gets a message that says to put the minus on the number (`enUnits.ts`), or is read as −5 °C if the builder can tell it is one number. Also `1 m + 1 s − 1 s` refused (terms that cancel), and four refusals that show internal text get a message in the user's words (`docs/research/deep-check-2026-10-19-exact-units.md` E8): `floor(1.5 m)` ("Not a number: floor(3*pasdimL/2)"), `1 m/(0 s)` ("Not a number: infinity"), `irem(7 m, 2 m)` ("L vs L²") and `m^(2 ± 0.1)` ("… no uncertainty: [2]").
2. **The fix:** check the dimensions on the job with each number that multiplies a slot replaced by its own positive symbol (as G18 does for ± values), so no term vanishes; then evaluate the numbers as today. The p95 bar (5 ms desktop) still holds.
3. **docs/04 4.3:** the sentence "an exact 0 has no dimension" becomes "the dimension is checked per term before the numbers go in; a result 0 keeps the unit of its terms" (exact text in the report).
**Done when:**
- The new cases pass; the golden gate passes (units count and p95 in the report); vitest and typecheck pass; `oracle.py` 0 problems.

### gorge, G36: FIX shows no unconfirmed digit in a complex number, branch `p1/gorge-m4-fixcomplex`
**Lane:** night-safe (Sonnet worker, Opus audit as every gorge package at night). **Starts when:** A15 is merged. From `docs/research/check-2026-10-19.md` finding 8.
**Read:** `app/src/engine/format.ts` (`fix`, `fixFallsBack`, `digitsShown`, `confirmedOptions` lines 378–390, `markOf`); `app/src/engine/format.test.ts` (G31 and G31f1's cases); decisions.md "Opus pass 16 defaults" (G31's rule).
- **The bug:** `confirmedOptions` lowers `fixed` for one part, which can push the other part into the scientific fallback, and that shows `fixed + 1` digits. 0.0123 + 0.000123i with 1 confirmed digit in FIX 4 draws `0.01+1.23E-4*i` (⚠1): three digits in the imaginary part, one confirmed.
1. **Tests first** in `format.test.ts`: that case draws `0.01+1E-4*i` with ⚠1 (at most n significant digits in every part); 1.23456 + 0.00123i with 3 confirmed digits still draws `1.23+1.23E-3*i` (three digits, all confirmed). G31 and G31f1's cases are unchanged.
2. **The fix:** after lowering `fixed`, test each part's fallback again with the new value, and lower once more where a part now falls back (`n − 1` for it), until nothing changes; if `fixed` drops below 0, SCI with n digits, as today.
**Done when:** the new tests fail on today's code and pass; the golden gate passes (home and precision counts in the report); vitest and typecheck pass.

### gorge, G49: marks travel through Ans, chips and Store: the engine side, branch `p1/gorge-m4-chipfacts`
**Lane:** night-safe. **Starts when:** G34 is merged (its golden sequence form; A15 before it). From `docs/research/deep-check-2026-10-19-angle-marks.md` D1 and D3 (silent wrong numbers); R65 builds the session side on it.
**Read:** `app/src/engine/host.ts` (`home`, `inherited` about line 377, `defsAfter` and `snapshot` about lines 333–369, `factsOf`); `app/src/engine/constUnc.ts` (G26: constants sent by name, `pasc_<id>`, with a table: the pattern to follow); `app/src/engine/numeric.ts` (`perturbedDigits`); `app/src/engine/defs.ts` (`NameFacts`); `app/src/engine/protocol.ts` and `types.ts` (the home request); docs/04 2.4 and 2.8; decisions.md M4-4 and M4-7.
- **The bugs:** M4-7 protects a result computed from a stored float variable (its confirmed digits cap the result, and a perturbation in its last confirmed digit catches cancellation). A chip has no such facts: at 12 digits `romberg(exp(-x^2),x,0,1)` is `⚠ 0.74682413281`, and `Ans−0.7468241328124` is `≈ −4E-13` (right: 2.70253994674E-14, oracle). Store keeps facts only when the stored text prints a float (`host.ts:351`), so `A:=G·2` from a CODATA constant chip is stored as an exact rational, and `A÷2` is `= 6.6743E-11`.
1. **Tests first,** in the sequence form G34 adds to `tests/golden/home.yaml` (sources `oracle` or `derived`), driven through the host with a chip table: (a) the romberg sequence above at 12 and 30 digits gives ⚠ with the digits M4-7 gives for a stored `B` (prec-M4-7-cancel-30's values); (b) `normald_icdf(0.025)`, then chip·1000, then that chip÷1000 is never `=` and keeps ⚠ (unaudited); (c) `A:=G·2`, then `A÷2`, is `≈`, never `=`; (d) an exact chip (`1/3` carried exactly, M4-4) still gives `= 1` for ×3. Each fails on today's code.
2. **Chips by name, as G26's constants:** `home()` takes an optional chip table `{name: {value, reliableDigits, warn, exact}}`; an input names a chip that is not exact as `pasr_<k>` (R65's parser writes it). The host puts the values in for the run, and `inherited()` treats each named chip like a stored float variable: its confirmed digits cap the result, its warn passes on, and the perturbation check moves it in its last confirmed digit. An exact chip stays a literal, as today.
3. **Store keeps the facts:** a value stored from an input that held a chip or constant that is not exact gets `NameFacts` in the defs log even when its text is an exact rational: `inexact: true` (never `=`) plus the capped confirmed digits and warn. `factsOf` and `inherited()` read the new field.
4. **docs/04 2.8:** the report gives the sentence "Its facts travel (exact, confirmed digits, warn), through Ans, a chip and Store, for every later use", replacing "Its exactness travels".
**Done when:**
- The new cases pass; the golden gate passes (home and precision counts in the report); vitest and typecheck pass.
- The protocol change is backward compatible (no chip table: as today), so the app works before R65 lands.

### ron, R65: marks travel through Ans and chips: the session side, branch `p1/ron-m4-chipfacts`
**Lane:** night-safe (session state, parser and tests; nothing drawn changes). **Starts when:** G49 is merged. From `docs/research/deep-check-2026-10-19-angle-marks.md` D1 and D2 (silent wrong numbers).
**Read:** `app/src/state/session.svelte.ts` (`submit`, `chipFor` and `lastChip` about lines 455–472, `finish` about lines 476–560: the `full` and `fullExact` rule at 514–519); `app/src/input/chips.ts` (`Chip`, the stored chip table read back); `app/src/input/chip-giac.ts`; `app/src/calc/` (the home call); G49's report (the chip table the host takes); docs/04 2.8; decisions.md M4-4.
- **The bugs:** (1) `fullExact` ignores `inexactInput` (`session.svelte.ts:518`), so an inexact value becomes `=` two lines later: `normald_icdf(0.025)` is `⚠`, `Ans·1000` is `≈`, `Ans÷1000` is `= −1.95996398454`. (2) The chip value is `r.exact` when it exists (`:514`), and for a float that text holds digits past the confirmed ones (at 30 digits, romberg's chip carries 30 digits, 11 confirmed). (3) The chip carries only `exact`, so the next line cannot know its confirmed digits or its ⚠ (D1).
1. **Tests first** (`session.chips.test.ts` with the fake or the real engine, and one e2e key sequence): the three sequences of D1 and D2 at 12 digits give the marks G49's cases give; a tapped `\res` chip behaves as Ans; a chip table stored in the history and read back keeps its facts. Each fails on today's code.
2. **The fix:** `fullExact` is false when the input held a chip or constant that is not exact; a result that is not exact carries as its chip value its confirmed decimal (`r.full`), never a float text; `Chip` gains `reliableDigits` and `warn` (stored and read back by `chips.ts`); `chip-giac.ts` writes a chip that is not exact as the name `pasr_<k>` and the session sends the table G49 takes. An exact chip is unchanged (`1/3` tapped ×3 stays `= 1`).
**Done when:** the new tests pass; vitest, typecheck and e2e pass; the golden parser stage passes; the start chunk delta is in the report (`npm run size`).

### sandra, S14: spike: Giac always in radians, the degree mode in our parser, branch `p1/sandra-radspike`
**Lane:** night-safe (a probe and a report; the pipeline merges the branch, so the prototype lives inside the probe file). **Starts when:** nothing is pending (it writes only `tools/probes/` and its report); before G21b. From `docs/research/deep-check-2026-10-19-angle-marks.md` (Part 2 point 2; D4–D8 and D12) and `docs/research/check-2026-10-19.md` findings 1–4.
**Read:** the deep check's Part 1 and Part 2; `app/src/input/emit.ts` (the `Degrees` case about line 289, `PolarComplex`, how sin, asin and arg are emitted); `app/src/input/emit-js.ts` (FN1); `app/src/engine/host.ts` (`casSetupCommands`, `useHomeMode`, `useSolveMode`, `units`); `app/src/engine/homeEval.ts` (`pasexp`, `expIgnoresAngle`, `showExp`); `app/src/units/evaluate.ts` (the bare-number angle rule, units.yaml d36–d39); `app/src/engine/defs.ts` (`DefEntry`); `app/src/engine/library.ts` (S4's file format); decisions.md F29, G21b, G15.
- **The question:** Giac reads its global `angle_radian` in at least eight paths, each in its own way (exp, cosh and sinh of imaginaries, the `re`/`im` split of complex trig, inverse trig converted in double, antiderivatives, desolve and laplace, limit and series, stored text). Does running Giac with `angle_radian:=1` in every mode, with our parser putting the degrees where the user typed an angle (`sin(u*pasdeg)`, `asin(u)/pasdeg`, `arg(z)/pasdeg`, the polar entry; `pasdeg` = π/180 in DEG, 1 in RAD, set by the host), give the right value on every path and keep the G2's flow?
1. **The matrix first:** `tools/probes/angle-matrix.ts` (read-only, as the other probes): every input of the deep check's D4–D8, D12 and of the check's findings 1–4, including the sequences (store in one mode, recall in the other), each with its right value (`oracle` or `derived`, never from memory), run (a) on today's code and (b) with the prototype rewrite. Add it to `tools/probes/README.md`.
2. **The prototype:** the smallest change that runs (b), inside `tools/probes/angle-matrix.ts` (a text rewrite of the parser's output, or a patched copy of the emitter in the probe), never in `app/`. Run the golden gate's inputs through it, and list every case that changes and why.
3. **Measure and decide:** (a) the CAS view in DEG prints Giac's radian text (`pi/180*cos(pi*x/180)`): show three display options with examples (as printed; the factor rewritten back in the drawing; degrees marked with °) and recommend one; (b) user functions and library files: a body keeps `pasdeg`, so it follows the mode at call time; what S4's file format says; (c) the unit view's angle rule: `app/src/units/evaluate.ts` (`pasua`, `withAngles`) must follow `pasdeg`, and its inverses return a bare number in the mode's unit today (in DEG `asin(1/2)·2 m` is `= 60 m`; RAD gives 1.0471975512 m; the sibling pass's finding); (d) the stored logs: what a migration can and cannot do (the log does not record the mode a value was stored in; G34 starts recording it); (e) Enter p95 on the desktop with and without the factor (the bench stage).
4. **G2 questions:** read items 63–65 of `tests/golden/G2-CHECKLIST.md`; if answered, the recommendation follows them; if not, it says what each answer would change.
**Done when:**
- The report recommends route R (Giac in radians: R64 and G46 as written, with any change to their texts) or route P (patch Giac per path: G21b's scope, listed), with the matrix's before and after counts, the golden differences and the display choice with examples.
- The report gives docs/04 one paragraph for 2.x (the angle mode) and decisions.md one OPEN entry for the owner; `node tools/docs-check.mjs` passes.
- No file under `app/` changed (besides `tools/probes/`, the diff holds only S14's backlog line).

### gorge, G50: complex arguments of the audited functions, branch `p1/gorge-m4-complexaudit`
**Lane:** night-safe. **Starts when:** A15 is merged. From `docs/research/deep-check-2026-10-19-angle-marks.md` D9–D11 (RAD; the DEG column is S14's).
**Read:** `app/src/engine/numeric.ts` (`AUDITED_FUNCTIONS` lines 47–53, `isAudited`, `exactFacts` and `readParts`, `doubleFallback`); `app/src/engine/homeEval.ts` (`ENGINE_DEFINITIONS`, how pasexp is defined and loaded); `tests/golden/precision.yaml` (header, the 2.3 regression list); `engine/giac/patches/README.md` (how an upstream report is kept); docs/04 2.3 and 2.4 (rule 3, the tier-0 audit).
- **The bugs (RAD):**
  - **D9:** Giac's complex tanh is wrong. `evalf(tanh(i))` is −0.642092615934·i (coth(i); right 1.55740772465·i), and at Digits 40 every complex argument of the sweep is wrong. Home shows `tanh(i)` as a bare ⚠ with no right digit. tanh is on the audited list.
  - **D10:** complex `acos`, and `asin` on the imaginary axis, have no MPFR path: 14–15 digits at Digits 40 and 60. Home at 30 digits shows `acos(1+i)` with 14 digits under `≈`, where docs/04 2.4 asks for `⚠ 14`. `asin(2i)` prints a real part `0.-000…` that the formatter cannot read.
1. **The probe and the cases first:** `tools/probes/complex-audit.ts` (the deep check's sweep, in the repo: every audited function × 12 complex arguments × Digits 12, 40 and 60 against mpmath through `tests/golden/.venv`; in `tools/probes/README.md`); then `precision.yaml` cases (source `oracle`) for each function on two complex arguments at 12 and 30 digits, plus `tanh(i)`, `tanh(i/2)`, `acos(1+i)` at 30 digits and `asin(2i)`. They fail on today's code where the probe found a gap.
2. **The fix:** complex tanh is evaluated as sinh/cosh (an engine definition in the pattern of `ENGINE_DEFINITIONS`, loaded on use) or by a minimal Giac patch with its README entry, whichever the probe shows right at every Digits; the upstream report text goes in the report. For the functions with no MPFR path on complex arguments, either the ln formulas at P digits (asin z = −i·ln(iz+√(1−z²)), acos = π/2 − asin, atan by its ln form), each checked by the probe, or the float is treated as not audited (⚠, docs/04 2.4 rule 3). A part shown with fewer digits than the setting asks gets `⚠ n`.
3. **The audited list** says in its comment what was audited (real arguments; complex arguments as this package leaves them), and docs/04 2.4's tier-0 sentence gets that scope (text in the report).
**Done when:** the probe shows every function on every argument either right at P or marked ⚠; the new cases pass; the golden gate passes (precision count in the report); vitest and typecheck pass.

### ron, R64: the angle mode lives in our parser, branch `p1/ron-m4-pasdeg`
**Lane:** night-safe (the parser, checked by tests; nothing on screen moves). **Starts when:** S14 is merged and the owner has said yes to route R; on route P it is dropped (the plot is R64a, on both routes). From `docs/research/deep-check-2026-10-19-angle-marks.md` D8 and Part 2 point 2; S14's report wins where it differs from this text.
**Read:** S14's report; `app/src/input/emit.ts` (the trig, inverse and `arg` cases, `Degrees` about line 289, `PolarComplex`); `app/src/engine/host.ts` (the setup commands, where `pasdeg` is set); `tests/golden/parser.yaml` (formula cases); docs/06 (nothing here moves a key).
1. **The Giac text:** every angle function the user types carries the factor: `sin((u)*pasdeg)`, `asin(u)/pasdeg`, `arg(z)/pasdeg`, the polar entry's angle times `pasdeg`, the ° template as `u*pi/180` (no longer `angle_radian()`). The host sets `pasdeg:=1` in every mode for now, so nothing computes differently until G46 switches Giac to radians. The parser cases in `parser.yaml` and the round-trip cases follow; Solve, the Function app and the unit view use the same emitter.
**Done when:** the new tests pass; the golden gate passes with every count as before (only the parser stage's formula texts change, listed in the report); vitest, typecheck and e2e pass; the start chunk delta is in the report.

### ron, R64a: the plot follows the angle mode, branch `p1/ron-m4-plotdeg`
**Lane:** night-safe (the JS plot evaluator, checked by tests; no Giac path, so it holds on either S14 route). **Starts when:** nothing is pending. Split from R64 (its point 1); from `docs/research/deep-check-2026-10-19-angle-marks.md` D8.
**Read:** `app/src/input/emit-js.ts` (`CONST`, the `Degrees` case at line 49, how sin and asin are emitted); `app/src/input/emit.ts` line 291 (the ° factor `(pi/180)^angle_radian()`); `app/src/apps/function/compile.ts` (line 38: compiled once, no angle input); `app/src/apps/function/app.svelte.ts` (when it compiles; `host.analyze`, `host.table`); the Function app's tests.
- **The bug (verified, D8):** in DEG `sin(x)` is drawn in radians (−0.801 at x = 180, zero at π), while Root near 3 reports 0 and Extremum near 1.5 reports 90: Root, Extremum, Slope, Area and the Num table run Giac in the mode. The G2 plots in the angle mode.
1. **Tests first:** in DEG the compiled `sin(x)` is 0 at 180 and 1 at 90, `cos(x)` 0 at 90, `asin(x)` 90 at 1, `atan(x)` 45 at 1 (`derived`); `sin(90°)` is 1 in both modes; RAD unchanged; an e2e in DEG: plot `sin(x)`, the trace at 180 reads 0 and Root near 175 gives 180. Each fails on today's code.
2. **The fix:** the angle mode is an input to the compile; in DEG the evaluator multiplies the argument of sin, cos, tan, sec, csc and cot by π/180 and divides asin, acos and atan by it; the ° template's factor follows the mode as emit.ts:291 does (π/180 in RAD, 1 in DEG), never twice; the Function app compiles again when the mode changes.
**Done when:** the new tests pass; vitest, typecheck and e2e pass; `npm run golden` unchanged; the Function chunk's size delta in the report.

### gorge, G46: Giac always in radians; pasexp goes, branch `p1/gorge-m4-radians`
**Lane:** night-safe. **Starts when:** R64 is merged with its route-R part (S14 recommended route R and the owner said yes). Replaces G21b on that route. From `docs/research/deep-check-2026-10-19-angle-marks.md` D4–D7, D12 and `docs/research/check-2026-10-19.md` findings 1–4; S14's report wins where it differs.
**Read:** S14's report (the matrix, the display choice, the migration); `app/src/engine/host.ts` (`casSetupCommands`, `useHomeMode`, `useSolveMode`, `units`, `restore`); `app/src/engine/homeEval.ts` (`homeSetupCommands`, `pasexp`, `expIgnoresAngle`, `showExp`, `showExpResult`); `app/src/units/evaluate.ts` (the angle rule); `app/src/engine/defs.ts` and the `DATA_VERSION` migration pattern; `tools/probes/angle-matrix.ts`.
1. **Tests first:** every row of S14's matrix becomes a golden case (home, precision, solve or bench, sources `oracle` or `derived`): among them `cosh(90i)` in DEG = −0.448073616129 (≈, not `= 0`), `acos(2)` in DEG with real part 0, CAS `int(1/(1+x^2),x)` in DEG with the factor π/180, `desolve(y''+y=0)` in DEG, Solve `cosh(i·x)=1/2` in DEG = 1.0471975512, and the store-in-one-mode, recall-in-the-other sequences of G34. They fail before the switch.
2. **The switch:** `angle_radian:=1` in every mode (Home, CAS, Solve, table, units), and `pasdeg` set to `pi/180` in DEG and `1` in RAD with the mode. `pasexp`, `expIgnoresAngle`, `showExp` and their call sites go. The CAS view's DEG display as S14's report decides (if it needs a renderer change, the report names the ron package that follows).
3. **The stored logs:** a `DATA_VERSION` migration turns `pasexp(` into `exp(`; entries stored in DEG (G34 records the mode) whose text still holds an angle function are rewritten with the factor; older entries without a recorded mode are kept and listed in the report.
**Done when:**
- The golden gate ends in GOLDEN GATE PASSED with the counts, the cases that changed text and why; `grep -rn pasexp app/src` finds only the migration; vitest, typecheck and e2e pass; Enter p95 of the bench stage within 5 % of before.
- The report gives docs/04 the paragraph S14 drafted, and decisions.md marks G21b superseded.

### gorge, G38: the exact path decides at the value precision, branch `p1/gorge-m4-decideprec`
**Lane:** night-safe. **Starts when:** A15 is merged. From `docs/research/deep-check-2026-10-19-exact-units.md` E1 and Part 2 point 1 (silent wrong numbers, some marked `=`).
**Read:** `app/src/engine/host.ts` (`useHomeMode`, `casSetupCommands`, `homeRunRaw`, `casRunRaw`); `app/src/engine/homeEval.ts` (`homeEval`, the exact path and the float-returning path, `homeSetupCommands`); `app/src/engine/numeric.ts` (`valuePrecision`, `withDigits`, the agreement check); `tools/probes/digits-cost.ts`; docs/04 2.4 rules 2–3 and 2.5.
- **The bug:** Home and CAS run Giac's exact evaluation at `Digits` = the display digits, and Giac decides signs, comparisons, `floor` and `abs` at that precision. The agreement check then confirms the value of a wrong text. At 12 digits (oracle sin(10^50) = −0.78967249342931008271): `sign(sin(10^50))` → `= 1`; `sin(10^50)>0` → `true`; `abs(sin(10^50))` and `sqrt(sin(10^50)^2)` → `≈ −0.789672493429`; `max(sin(10^50),0)` → `≈ −0.789672493429` (right 0); `floor(sin(10^50)*10^12)` → `= 609741545567` (right −789672493430); `piecewise(sin(10^50)>0,1,2)` → `= 1` (right 2); `floor(exp(pi*sqrt(163))*10^20)` copies `…99999998448107520` (right `…99999999925007259`). At 30 digits the same. `Digits:=40` fixes these, but `floor(sin(10^60)*10^12)` is still wrong at 40 (933879932404) and right at 60 (830389765219).
- **The rule (default, deep check 2026-10-19):** the exact path runs at `Digits` = P (`valuePrecision`), and a result that rests on a numeric decision is computed again at P + 20 and must give the same text; if not, once more at P + 40, and the P + 20 and P + 40 texts must agree, else `⚠` without a count and a why-line ("decided at limited precision"). A decision is any of `floor ceil round frac fPart iPart sign abs max min piecewise when ifte`, a comparison (`< > <= >= == !=`), or `int sum limit solve` (they decide signs inside); `sqrt` of an even power is covered by running every input whose result came from these names or holds `abs(`.
1. **Tests first,** in `tests/golden/home.yaml` and `precision.yaml` (source `oracle`, mpmath at 200 digits): every row of the bug above, `floor(sin(10^60)*10^12)` `= 830389765219`, `floor(exp(pi*sqrt(163))*10^20)` with its exact text, and three that must not change: `floor(log10(1000))` `= 3`, `floor(cos(pi/7)-cos(2*pi/7)+cos(3*pi/7)+1/2)` `= 1`, `sign(sqrt(2)-1.4142135623730951)` `= -1`. A CAS bench case for `abs(sin(10^50))`. Each new one fails on today's code.
2. **The fix** in `homeSetupCommands`/`useHomeMode` and `casSetupCommands`: `Digits:=P` for the exact path. Check that rule 3 still works: the float-returning path (`normald_icdf`, `romberg`) is now evaluated on the MPFR side first and re-evaluated on the double side; `precision.yaml` must keep every count.
3. **The second decision** for the inputs above, in `homeEval` and `casRunRaw`, with `withDigits`. A rational result that both precisions agree on keeps `=`.
4. **Cost:** `DIGITS_LIST=12,30 node tools/probes/digits-cost.ts` before and after; the desktop p95 of the 123 inputs may grow by at most 1.3 × (docs/04 2.5's bar); the report gives both and the share of inputs that run a second decision.
**Done when:**
- The new cases pass; `npm run golden` ends in GOLDEN GATE PASSED with its counts in the report; vitest and typecheck pass.
- The report gives docs/04 2.4 one sentence for rule 2 (exact text): "The exact path runs at P; a result that rests on a numeric decision is decided at P and P + 20."

### gorge, G39: a divergent sum or integral is refused; Giac's pair is never a list, branch `p1/gorge-m4-divergent`
**Lane:** night-safe. **Starts when:** A15 is merged. From `docs/research/deep-check-2026-10-19-exact-units.md` E2, E6 and E9 (silent wrong numbers marked `=` or `≈`).
**Read:** `app/src/engine/homeEval.ts` (`homeEval`, `symbolic()`, the paths); `app/src/engine/host.ts` (`casRunRaw`); `app/src/engine/numeric.ts` (`shapeOf`, `resultFromFacts`); `app/src/input/emit.ts` (how ∫ and Σ templates become `int(…)` and `sum(…)`); the i18n table for Home's messages; docs/04 2.3 and 2.4; `docs/research/deep-check-2026-10-19-angle-marks.md` D7 (the DEG pairs).
- **The bugs (RAD; Home, and CAS the same):** `int(1/x,x,-1,1)`, `int(1/(x-1),x,0,2)` and `int(tan(x),x,0,pi)` → `= 0` (they do not converge; 0 is the principal value). `sum(cos(k),k,1,inf)` → `= -0.5`, `sum(sin(k),k,1,inf)` → `≈ 0.915243860856`, `sum(exp(i*k),k,0,inf)` → `≈ 0.5+0.915243860856i` (they do not converge; Abel sums). `int(abs(x-sin(10^50)),x,-1,1)` shows a list `[…, 1.35506364264]`: Giac's [exact, numeric] pair. `limit(sin(x),x,inf)` shows `bounded_function(2)`.
- **The rule (default, deep check 2026-10-19):** a number for something that does not exist is refused: "The integral does not converge" / "The series does not converge" / "No limit" (i18n keys). Giac's own `undef` answers (`int(1/(x-2)^3,x,0,3)`, `sum((-1)^k,k,0,inf)`) get the same messages.
1. **Tests first** (`home.yaml`, source `derived`; CAS bench cases): each bug above refused with its message; and these unchanged: `int(1/x^2,x,-1,1)` = +∞, `sum(1/k^2,k,1,inf)` ≈ 1.64493406685, `sum(cos(k)/k,k,1,inf)` ≈ 0.0420195058254, `sum((-1)^k/k,k,1,inf)` ≈ −0.69314718056, `int(1/(2+cos(x)),x,0,2*pi)` ≈ 3.62759872847, `int(exp(-x^2),x,-inf,inf)` ≈ 1.77245385091. Each refusal fails on today's code.
2. **The series check:** for `sum(t,k,a,inf)` with a finite exact result, `limit(t,k,inf)` must be 0; `bounded_function(…)`, `undef` or anything else non-zero refuses. (Probe: `limit(sin(k),k,inf)` = `bounded_function(2)`, `limit(exp(i*k),k,inf)` = `undef`, `limit(cos(k)/k,k,inf)` = 0.)
3. **The integral check:** for `int(f,x,a,b)` with a finite exact result, when `f` has a singular point in [a, b] (`singular(f,x)`, and for a periodic f its shifts inside [a, b]), `int(abs(f),x,a,b)` must be finite, else refuse (probe: `+infinity` for 1/x on [−1, 1] and tan on [0, π]). Only inputs with a singular point pay for the second integral; the report gives the cost on `home.yaml`.
4. **The pair:** a definite integral that returns a two-element list [exact, float] is shown as the float with `⚠` and a why-line ("the exact and numeric answers differ"), never as a list; the CAS shows both, with the `⚠`.
**Done when:**
- The new cases pass; `npm run golden` ends in GOLDEN GATE PASSED with its counts in the report; vitest and typecheck pass.
- The report lists any other `undef`-or-number route found while probing, and the docs/04 2.3 rows for E2 and E6 (exact text).

### gorge, G41: σ beyond first order at a stationary point, branch `p1/gorge-m5-sigma2`
**Lane:** night-safe. **Starts when:** G35 is merged (its `(0 ± 0.1 m)²` case needs G35's unit at a zero value); before R24c. From `docs/research/deep-check-2026-10-19-exact-units.md` E5 (a σ of 0 shown for a measured input).
**Read:** `app/src/units/evaluate.ts` (`uncertainty`, its `diff` terms and `pasuS`); `app/src/units/uncertainty.ts`; `app/src/units/types.ts` (`Uncertainty`); `tests/golden/units.yaml` (header, g01–g14); `tests/golden/oracle.py` (how `unc_oracle` is checked); docs/04 4.3 (G18's first order).
- **The bug:** G18's σ is first order, so at a stationary point it is 0: `cos(0 ± 0.1)` → `1 ± 0`; `sin(90° ± 1°)` → `1 ± 0`; `(0 ± 0.1 m)²` → `0 ± 0`. And `sqrt(0.01 ± 0.1 m²)` gives σ = 0.5 m on 0.1 m, although the input's interval reaches below 0.
- **The rule (default, deep check 2026-10-19; GUM 5.1.2, note, for uncorrelated inputs):** σ² = Σᵢ (∂f/∂xᵢ)² uᵢ² + Σᵢ Σⱼ [½ (∂²f/∂xᵢ∂xⱼ)² + ∂f/∂xᵢ · ∂³f/∂xᵢ∂xⱼ²] uᵢ² uⱼ², exactly with Giac's `diff` at the inputs' values. When the second-order part is more than 10 % of σ², the σ carries `⚠` with the why-line "first order does not hold here" (i18n). When an input's interval x ± 2σ reaches a point where f or its derivative is not defined (`singular`), the σ is shown with `⚠` and the why-line "the interval reaches a singular point".
1. **Tests first** in `units.yaml` (source `derived`, `unc_oracle` with the formula): `cos(pasupm(0,0.1))` σ = 0.0071 (0.00707106781187), with `⚠`; `sin(pasupm(90,1)*{deg})` σ = 0.00022 (0.000215397043199), with `⚠`; `(pasupm(0,0.1)*{m})^2` σ = 0.014 m² (0.0141421356237); `sqrt(pasupm(0.01,0.1)*{m^2})` with the singular-point `⚠`. g08's σ moves from 0.43 to 0.44 (derived: σ² = 0.18861 + 0.0047153, the level's curvature, 2.4 % of σ², so no `⚠`); g01–g05, g07, g09–g12 and g14 keep their text by hand calculation; check every g case and list each one that moves. Each new one fails on today's code.
2. **The fix** in `uncertainty()`: the second- and third-order `diff` terms (n inputs: n² terms), the 10 % test, the singular-point test, and the why-line on `Uncertainty` (optional field).
3. **p95:** the units stage stays within 5 ms (desktop); the report gives the cost of the new terms on g01 (two inputs).
**Done when:**
- The new cases pass; `npm run golden` ends in GOLDEN GATE PASSED with its counts in the report; `oracle.py` 0 problems; vitest and typecheck pass.
- The report gives docs/04 4.3's G18 sentence with the second order (exact text), and says that a Monte Carlo check (GUM Supplement 1) is not built: cos X with X ~ N(0, 0.1²) has the exact spread 0.0070358300299 against the formula's 0.00707106781187.

### gorge, G37: °C and °F inside a compound unit are a temperature interval, branch `p1/gorge-m5-degcompound`
**Lane:** night-safe. **Starts when:** G35 is merged (same files); before R24c. Decided by the owner 2026-10-19 (decisions.md "G37"); from `docs/research/check-2026-10-19.md` finding 12.
**Read:** `app/src/units/build.ts` (`tokenGiac`: the refusal of an affine unit, `specialIn` and its `bare` test, `buildJob`'s "allowed only alone" branch); `app/src/units/slot.ts` (`reading`); `app/src/units/messages.ts`; `tests/golden/units.yaml` (t01–t17, d43, g11–g12); decisions.md G17 and G37.
- **Today:** `1 J/(kg·°C) → J/(kg·K)` and `10 W/(m²·°C)` are refused with "Use K or Δ°C for a temperature difference", though engineering tables write these units with °C.
- **The rule (decided):** inside one slot, °C or °F together with another unit token, or with a power other than 1 (`J/(kg·°C)`, `W/(m²·°C)`, `°C⁻¹`, `°F·h·ft²/Btu`), is a temperature interval: 1 °C = 1 K, 1 °F = 5/9 K, no offset. The slot's reading says "per degree Celsius (difference)" (Find's title plus the i18n word). Alone in its slot, °C and °F keep their offset (G17), and the rules across slots stay: `20 °C + 5 K` (t07), `2 °C / 1 s` written as two slots (t08), `20 °C × 2` (d43) and `2 + 3 °F` (t09) are still refused.
1. **Tests first** in `units.yaml` (source `derived`): `1*{J / k:g oC}` → `J / k:g K` `= 1`; `10*{W / m^2 oC}` → `W / m^2 K` `= 10`; `1*{Btu / lb oF}` → `J / k:g K` `= 4186.8` (the IT Btu and the pound of the index: 2326 J/kg per Btu/lb, times 9/5); `2.3e-5*{oC^-1}` → `K^-1` `= 2.3E-5`; the reading of `J/(kg·°C)` in a slot test (`slot.test.ts`). t01–t17, d43 and g11–g12 unchanged. Each new case fails on today's code.
2. **The fix:** `tokenGiac` takes a flag "interval": an affine unit's factor without its offset (the `a` of K = a·x + b), used when `specialIn` finds the token not bare in a slot with another token or a power; the bare case is unchanged. The message for the refusals that stay is unchanged.
**Done when:**
- The new cases pass; `npm run golden` ends in GOLDEN GATE PASSED (units count and p95 in the report); vitest and typecheck pass; `oracle.py` 0 problems.
- The report gives docs/04 4.3's temperature sentence (exact text): "°C and °F alone carry their offset; inside a compound unit they are an interval."

### gorge, G40: angles in the unit view: inverses give an angle, ω·r and rpm, branch `p1/gorge-m5-angles`
**Lane:** night-safe. **Starts when:** A15 is merged; before R24c. Decided by the owner 2026-10-19 (decisions.md "Angles in the unit view"). From `docs/research/deep-check-2026-10-19-exact-units.md` E3, E4 and E8 (the ° text). On S14's route R, `pasua` and the new inverses follow `pasdeg` (S14's report says how).
**Read:** `app/src/units/evaluate.ts` (`UNIT_DEFINITIONS`: `pasua`, `pasusin`; `withAngles`; `refusal`, `cycleRefusal`; `unitEval`'s end-slot check); `app/src/units/build.ts` (`slotText`, `chosenUnit`'s typed units); `app/src/units/messages.ts`; `tests/golden/units.yaml` (d26–d29b, d36–d38, g14); docs/04 4.3; decisions.md G15, G25, G32.
- **The bugs:** in DEG, `asin(1/2)·1 rad` → `= 30 rad` (right: π/6 rad) and `asin(1/2)·2 m` → `= 60 m` (RAD: 1.0471975512 m); `asin(1/2) → °` is refused in both modes. `3000 rpm × 0.1 m → m/s` → `= 5 m/s`, while `10 rad/s × 0.5 m → m/s` and `90° × 1 N·m → J` are refused. `30° × 2 m` is shown as `60 1°·m`.
- **The rule (decided 2026-10-19):** (a) asin, acos, atan and atan2 give an angle (the rad dimension, the value in rad), in either mode; without an end slot an angle is shown in the mode's unit (° in DEG, rad in RAD). (b) An end slot whose dimension differs from the result's by exactly one rad (either way) converts with the rad dropped, and the result carries a note "rad = 1 dropped" (i18n), unless a cycle unit (rpm, rev, Hz, or a unit made of them) is on either side; then G32's refusal stays. (c) A product of a cycle unit and any other dimension gets the note "rpm counts turns: the speed at radius r is 2π·r·n" (i18n); its value is unchanged (a feed, 3000 rpm × 0.1 mm = 300 mm/min, stays right).
1. **Tests first** in `units.yaml` (source `derived`), both modes where it matters: `asin(1/2) → °` = 30 (`=`), `asin(1/2) → rad` ≈ 0.523598775598; DEG `asin(1/2)·1 rad` ≈ 0.523598775598 rad; `asin(1/2)·2 m → m` ≈ 1.0471975512 m with the note; `10 rad/s × 0.5 m → m/s` = 5 with the note; `90° × 1 N·m → J` ≈ 1.57079632679; `3000 tr/min × 0.1 m → m/s` ≈ 31.4159265359 with the note; `3000 rpm × 0.1 m → m/s` = 5 with the rpm note; `1 rad/s → Hz` and `60 rpm → rad/s` still refused (d27, d29); `30° × 2 m` shown with the unit `°·m`. Each new one fails on today's code.
2. **The fix** in `UNIT_DEFINITIONS` (an inverse wrapper beside `pasua`, applied by `withAngles`), the end-slot check in `unitEval`, the note in `Quantity` (a new optional field, typed in `types.ts`), and the unit text in `build.ts`.
3. **p95:** the units stage stays within 5 ms (desktop).
**Done when:**
- The new cases pass, every old units case passes unchanged except where the rule says so (each change listed in the report); `npm run golden` ends in GOLDEN GATE PASSED; vitest and typecheck pass; `oracle.py` 0 problems.
- The report gives docs/04 4.3's sentence on angles (exact text) and the G2 item 68 answer if the owner has given it.

### gorge, G42: median, round and the quartiles as the G2 and our display do, branch `p1/gorge-m4-stats`
**Lane:** night-safe (Sonnet worker, Opus audit as every gorge package at night). **Starts when:** A15 is merged. The `round` part waits for G2 item 66 and the quartile part for item 67; without an answer, build median and percentile only and say so in the report. From `docs/research/deep-check-2026-10-19-exact-units.md` E7.
**Read:** `app/src/engine/homeEval.ts` (`ENGINE_DEFINITIONS`, how `sigfig` and `par` are defined and loaded on first use, `definitionsUsedBy`); `app/src/engine/numeric.ts` (`AUDITED_FUNCTIONS`); `tests/golden/home.yaml` (the rounding and statistics rows, `stat-stddevp-sample`); `tests/golden/g2.yaml` items 66–67; backlog.md "Upstream reports" (Giac).
- **The bugs:** `median([1,2,3,4])` shows `⚠ 2` (right: 2.5): Giac takes the lower middle and returns a float. `round(-2.5)` = −2 and `round(-2.25,1)` = −2.2 (Giac rounds half up), while our display rounds half away from zero (−2.25 in FIX 1 shows −2.3). `percentile([1,2,3,4],50)` comes back unevaluated.
1. **Tests first** in `home.yaml` (source `derived`): `median([1,2,3,4])` `= 2.5`, `median([4,1,3,2])` `= 2.5`, `median([1,2,3])` `= 2`, `median([1.5,2.5])` `= 2`, `percentile([1,2,3,4],50)` `= 2.5`; and, with the G2's answers, `round(-2.5)`, `round(2.5)`, `round(-2.25,1)`, `quartile1([1,2,3,4,5,6])`, `quartile3(…)` with `g2: 66` / `g2: 67`. Each fails on today's code.
2. **The fix:** our engine definitions, exact on exact input and loaded on first use like `sigfig` (median: sort, the middle one or the mean of the two middle ones; percentile by the convention the G2 or item 67 names, else linear interpolation between closest ranks with that stated in Find's title text in the report; round half away from zero if item 66 says the G2 does). The names stay Giac's, so typed input and Find keep working; add them to `AUDITED_FUNCTIONS` only with their golden cases.
3. **Upstream:** the report gives the minimal cases for the Giac email (median of an even list; `round` of a negative half), in the backlog's form.
**Done when:**
- The new cases pass; `npm run golden` ends in GOLDEN GATE PASSED with its counts; vitest and typecheck pass.
- The report names each convention chosen and its source (G2 item or derived), and the Find title text for median, percentile and the quartiles (for R4a).

### gorge, G43: the golden gate checks invariants across settings, branch `p1/gorge-m4-invariants`
**Lane:** night-safe (Sonnet worker, Opus audit as every gorge package at night). **Starts when:** A15 is merged; the store-and-recall part needs G34's sequence form (skip it, and say so, if G34 is not merged). From `docs/research/deep-check-2026-10-19-exact-units.md` E10 and Part 2 point 5; sofia's check Part 2 point 1.
**Read:** `app/scripts/golden.ts` (the stages, `report`, how a stage passes); `tests/golden/README.md` (the counts); `tests/golden/home.yaml` and `precision.yaml` (headers); `app/src/engine/format.ts` (`formatReal`, `markOf`); `app/src/clipboard/` (the copy text and the paste reader, P5); docs/04 2.6 and 7.3.
- **The gap:** every golden case is one input in one setting, so a value that changes with the angle mode, the digits or a store goes unseen. A scratch probe of these invariants (no expected values) found `(-32)^(1/5)` and `(-8)^0.2` wrong in DEG among 169 angle-free inputs at its first run (deep check D12).
1. **A stage `invariants`** in `golden.ts`, over every `home.yaml` and `precision.yaml` input without settings: (a) an input with no angle function (sin, cos, tan, sec, csc, cot and their inverses, `arg`, `atan2`, the polar entry, °) shows the same text in RAD and DEG; exp, the hyperbolic functions and a power of a negative number hold no angle (F29; deep check D4, D12), so they are in it, and today's failures among them (`cosh(90i)`, `(-8)^0.2`) go into the known list; (b) a result confirmed at 12 and at 30 digits rounds to the same 12-digit text; (c) a number's copy text (Shift + View) read back by the paste reader gives the same value and mark (P5); (d) after G34: `X:=<input>` in one mode, then `X` in the other, shows what the store line showed.
2. **Known failures:** `tests/golden/invariants-known.yaml` lists each input that fails today with the package that fixes it (`(-32)^(1/5)`: S14/G46 or G21b). The stage passes when the failures are exactly the known ones and fails on a new failure or on a known one that now passes (so the list is pruned when a fix lands).
3. **The count** goes into `tests/golden/README.md` and the gate's summary line.
**Done when:**
- `npm run golden` runs the stage and ends in GOLDEN GATE PASSED; a deliberately broken copy (a test that feeds the stage a wrong DEG answer) makes it fail; vitest and typecheck pass.
- The report lists every known failure with its package, and the stage's desktop time (it must stay under 60 s).
- No engine or app code changed except `app/scripts/`.

### gorge, G44: inverse distribution functions polished by substituting back, branch `p1/gorge-m4-icdfpolish`
**Lane:** night-safe. **Starts when:** A15 is merged. From docs/04 2.3 #2 (open: the value polish) and `docs/research/deep-check-2026-10-19-exact-units.md` E11; the case `prec-2-normald_icdf-value` waits in `precision.yaml` as pending.
**Read:** `app/src/engine/homeEval.ts` (the float-returning path, rule 3, `ENGINE_DEFINITIONS`); `app/src/engine/numeric.ts` (`AUDITED_FUNCTIONS`, `floatFacts`); `tests/golden/precision.yaml` (`prec-2-*`); docs/04 2.3 #2 and 2.4 rule 3.
- **Today:** `normald_icdf(10^-10)` shows `⚠ 7 −6.36134` (right: −6.3613409024040562047, oracle): honest, but 7 digits where 12 are asked. Giac's routine and its re-evaluation agree on wrong digits beyond that, so the agreement check cannot do better.
1. **Tests first** in `precision.yaml` (source `oracle`, mpmath at 40 digits): `prec-2-normald_icdf-value` turned on; `normald_icdf(0.025)`, `normald_icdf(10^-10)`, `normald_icdf(1-10^-12)`, `student_icdf(5,0.975)`, `chisquare_icdf(3,0.95)`, `fisher_icdf(2,5,0.99)` at 12 and 30 digits, each `≈` with every digit confirmed. Each fails on today's code (⚠ or wrong digits).
2. **The polish** (an engine definition loaded on first use): from Giac's value x₀, solve F(x) = p at P digits with Newton on the forward function F (`normald_cdf`, `student_cdf`, `chisquare_cdf`, `fisher_cdf`; the derivative is the density, exact), stop when the step is below 10^−P; then the agreement check of rule 2 on the polished value at P and P + 20. If F itself is not audited, or Newton does not converge in 20 steps, or the residual |F(x) − p|/p is above 10^(−digits), keep today's `⚠` value.
3. Add the four inverse names to `AUDITED_FUNCTIONS` only for inputs that went through the polish (a fact on the result, not the global list).
**Done when:**
- The new cases pass; `npm run golden` ends in GOLDEN GATE PASSED with its counts; vitest and typecheck pass; `oracle.py` 0 problems.
- The report gives docs/04 2.3 #2's row as closed (exact text) and the desktop cost of one polished call.

### sandra, S11: the unit result view as packages, branch `p1/sandra-unitresult`
**Lane:** night-safe (docs and probes only). **Starts when:** A14 is merged. Ids R60–R63 are kept for the packages it writes. From backlog.md milestone 5 item 4 ("the result view gets its packages next") and `docs/research/deep-check-2026-10-19-exact-units.md` Part 3; S5 did the same for the pad.
**Read:** docs/04 4.3 and 4.4; `docs/research/r7-unit-slots.md` section 7 (the open points with defaults); `docs/research/r9-unit-pad.md` (S5's method and form); `app/src/units/types.ts` (`Quantity`, `Uncertainty`); `app/src/units/evaluate.ts` (`chosenUnit`, G25); decisions.md G25 and G18; the packages G35, G40, G41, G49 and R65 (what a result carries, and what a chip carries); `tests/tasks/tasks.yaml` (the unit tasks).
- **The view to package:** value, mark, unit, dimension, one-tap alternatives (other units of the same dimension), `units.targets`, σ with its `⚠` (G41), the notes of G40, and the `\res` chip back to Home.
1. **Decide, with evidence from probes and the tasks:** what the chip carries into Home (the value in the shown unit, or SI; its mark facts and σ as G49 carries a value's facts; whether the unit travels); which alternatives are offered and in which order (Find's weights from S5); how a refusal and a note are shown; the presses for tasks 1–4 and 10 with the view.
2. **Write the packages** as files in `docs/shifts/packages/` (R60–R63, each one concern, ≤ 1 d, UI-free parts split from UI parts so the model parts can run at night), with their rows for brief section 0 and 0c in the report, and a mockup in `docs/mockups/` if the layout needs the owner's eye.
3. **Owner questions** go to decisions.md "Needs the user" with one recommendation each.
**Done when:** the package files exist and pass `node tools/docs-check.mjs`; the report holds a short note in `docs/research/` (`r14-unit-result.md`) with the evidence; nothing under `app/` changed.

### sandra, S12: engine defaults, not G2 copies: the audit, then its removal packages, branch `p1/sandra-g2audit`
**Lane:** night-safe (research, docs and package files; no code). **Starts when:** nothing is pending (it needs neither A14 nor A15: it writes its packages in both places). The owner's word of 2026-10-19 (decisions.md "Engine defaults, not G2 copies"): the default is what the engine does as built; a special case stays only where the engine's result is a silent wrong number (principle 3) or where the G2's flow saves keystrokes (principle 2); the match with the G2 alone justifies nothing; between two equal readings the one with less code wins.
**Read:** `docs/decisions.md` (every entry that names the G2: `grep -n 'G2' docs/decisions.md`; P11, P12, F22, F29, R29, R58, R58b, "The units menu"); `docs/06-keypad-vs-g2.md` section 2; `tests/golden/g2.yaml` (the answered items, `source: device`, and the open ones: 41, 42, 52, 56, 63–68); `docs/03-feature-analysis.md` section 0; CLAUDE.md "The goal"; the code that holds our special cases: `app/src/engine/homeEval.ts` (`ENGINE_DEFINITIONS`, every `pas*` helper, `pasmod` at line 131), `app/src/input/emit.ts` (the rewrites; the `mod` comment at line 148), `app/src/entry/controller.ts` (the entry rules; R27a at line 356), `app/src/engine/numeric.ts` (`AUDITED_FUNCTIONS`).
- **The list:** every special case written to match the G2 or to depart from the engine's own result: the decisions and docs/06 rows above, every `pas*` helper and rewrite, every answered G2 item whose answer differs from what we do, and every open item's "why". One row each: the engine's own result (Giac, GSL, MathLive as built; probe it); ours; the code that holds ours (file:line, about how many lines, in which layer: template, parser, engine helper, display, test); which clause keeps it (principle 3 with the wrong number named, principle 2 with the keystrokes counted, or none); keep or drop.
- **Item 43 first:** `7 mod −3` is −2 on the G2 (the sign follows the divisor); ours is Euclidean, never negative (`pasmod`, with its reason in emit.ts); Giac's `irem` is the engine's own. Decide by the clauses, with the code size of each option; a golden case from the device records the G2 side either way.
- **The open G2 items:** for 41, 42, 52, 56 and 63–68 say whether any answer could change our code under the rule. An item that cannot gets "no code depends on the answer" in its `why` in `g2.yaml`, so the owner skips it; the checklist is regenerated with `tests/golden/.venv/bin/python -I tests/golden/oracle.py --g2`.
- **The removal packages:** for every row kept by no clause, one package file: gorge for engine helpers and golden cases, ron for entry and parser rules; worker Opus; night-safe; at most 0.5 d; one concern each; ids G45, G47, G48, G51, G52 and R66 upward. Each removes the special case, keeps the engine's result, re-sources its golden cases (`derived` or `oracle`, never `assumed`; a device case stays as the G2's record with the difference named) and rewrites the docs/06 row or the decisions line it rests on. Written in `docs/shifts/packages/` and, while the brief still has section 7 (before A14), verbatim there; a row each in the section 0 table and in the 0c queue before the last Opus pass, "After: S12" (owner, 2026-10-19: they run the same night). The brief must stay at or under 25 kB outside section 7: cut prose, never rows.
- **Rows already known** (master pass, 2026-10-19; S12 decides the clause): pasexp, expIgnoresAngle, showExp (`homeEval.ts` 143–148, `host.ts` 446) and the ° factor (`emit.ts` 291) are S14's: rowed as "S14 decides", no package. Item 40: `controller.ts` 349 adds the leading 1 to ᴇ only on an empty line, the G2 after an operator too (principle 2: widen, which also drops R14's refusal of `2×ᴇ3`). Items 44 and 46: the ⌫ rules of `entry/delete.ts` (63, about 125) that MathLive gets stuck without (F10, F15): principle 2. Item 50: `entry/stops.ts` 49 and `parse.ts` 989 (stops inside names): principle 2 and 3. Item 57: `controller.ts` 73 (▶ to the next empty box; OPEN R43 point 2): probe. Item 62, R58b: `emit.ts` 78 and 247 and `emit-js.ts` 15 read the letter e as exp(1); R58b is decided and has no package: S12 writes it too (ron, the form with less code: stand-ins `e_` and `i_` as the Greek letters, `parse.ts` 196 and `render/tidy.ts`, or the constant drawn upright).
- **Output:** `docs/research/g2-correspondence.md` (the table, the clause applied per row, the packages written); one entry in decisions.md "Needs the user" of at most 1 kB with the keep/drop list and the package id of each drop; docs/06 section 2 rows rewritten where their reason changes. decisions.md is at its 40 kB limit: make room the way the file already does, the text of the oldest decided group into `docs/archive/decisions-2026-10.md` and a one-line pointer in its place.
**Done when:** the note exists and every row holds file:line evidence; every drop has a package file (its section 7 copy before A14) and its two rows; `node tools/docs-check.mjs` passes; nothing under `app/`, `spec/` or `tests/` changed except `g2.yaml` and the regenerated checklist.

### ron, R15c1: the status line takes Apps, Menu and the views, branch `p1/ron-m4a-statusline`
**Lane:** day. **Starts when:** R50b is merged (owner, 2026-10-19; R48 is merged). The first of four R3 packages (decisions.md "R15c", owner 2026-10-17). D's keys stay until R15c2, so for one package both paths work.
**Read:** decisions.md "R15c" (the layout, the layers, the costs) and "R15b" (the place name's target and the place actions); `docs/mockups/top-cluster-r15c.html` (option R3); `docs/06-keypad-vs-g2.md` section 3 point 2 and section 4 B; `docs/05-ui-plan.md` 3.2; `app/src/App.svelte` (`press()`, `PLACE_KEY`, `AT_ONCE`, `SHEET_KEYS`, `historyKey`); `app/src/views/modeSheet.ts` (the Apps sheet); `app/src/apps/shell.svelte.ts` (`menuItems`, `showMenu`); `app/test/status.spec.ts`; `app/test/topcluster.spec.ts`. The owner's prototype is `/home/nordmu/Documents/source99/pascaline/.coord/r15c-prototype.patch` (not in git; `git apply` it in a scratch worktree to see it run): take its shapes and commands, not its structure; its test switch `?cluster=r3`, its Settings section and `keyboard/clusterTest.ts` are not to be built.
- **The place name opens the Apps sheet** (special `apps`, through `press()` as `PLACE_KEY` does today), in Home, CAS and every app. It is drawn with ▾ instead of ⇄. The Apps sheet already lists Home and CAS first. The Home ↔ CAS switch on the name goes. Keep R15b's 96 × 28 px target and update the name's aria-label.
- **In an app: Symb, Plot and Num tabs** beside the name, the current one marked. Each tab goes through `press()` with a key whose special is `symb`, `plot` or `num`, so the sheet, queue and AT_ONCE rules hold. The name then shows only the app's name.
- **☰ at the right end** (special `menu`, through `press()`): the view's menu. On a picked row it opens the row's menu (R13, `historyKey` already does this). The target is at least 36 × 28 px.
- **Every ☰ menu ends with Settings.** In the Home/CAS list it is item 10 (key 0 picks it; S2's fixed numbers 1–9 stay), and in each app view's menu it is the last row.
- The status line stays 28 px (docs/03 rule 9) and fits at 360 px width in an app with the chips, DEG/RAD and ☰, with no overflow; the tabs may shrink before the chips do.
- **Docs:** docs/05 3.2 (the status line) and docs/06 section 3 point 2 and section 4 B, as exact text in the report.
**Done when:**
- e2e by touch and by keys: the name opens Apps, and Home and CAS are reached from it; the tabs switch views in Function and Solve; ☰ opens the Home menu, and on a picked row the row's menu; Settings is the last ☰ row. R15b's place-switch tests are changed to the new behaviour.
- Typecheck, unit and e2e tests pass; the gallery is rebuilt; the start chunk is at most +0.4 kB gzip (of the 60 kB budget A15 sets; the number in the report).
- No key moved in `spec/keyboard.yaml`.

### ron, R15c2: the R3 keys: round pad, six user keys, the editing wing, branch `p1/ron-m4a-cluster`
**Lane:** day. **Opus:** it moves keys that every test names, as R15b did; it stays whole. **Starts when:** R15c1 is merged.
**Read:** decisions.md "R15c" points 1–6 and "R15c: Store from the last result"; `docs/mockups/top-cluster-r15c.html` (R3); `docs/06-keypad-vs-g2.md`; `spec/keyboard.yaml` (rows 0–2 and the header's rules); `app/src/keyboard/keyboard.ts`; `app/src/keyboard/keyboard.test.ts`; `app/src/keyboard/Keypad.svelte` (the pad surface); `app/src/keyboard/gestures.ts`; `app/src/views/sheetKeys.ts` (`esc`, `cancel`); `app/src/App.svelte` (`special()`, `AT_ONCE`); `app/src/entry/ans.ts`; `app/src/i18n/en.ts`; `app/test/keys.spec.ts`; `app/test/topcluster.spec.ts`; `app/test/gestures.spec.ts`; `app/test/undo.spec.ts`. The prototype's finding: `\frac{12}{34}`, Shift + ⇤, 5 gives `\frac{12}{534}`, and a drag from the pad's hub steps the cursor.
- **`spec/keyboard.yaml` rows 0–2** as decisions.md "R15c" points 1–5: `u1`–`u6` in columns 0–1, all empty; `up` (row 0, columns 2–3), `left` and `right` (row 1), `down` (row 2, columns 2–3); `view` | `esc`, `undo` | `copy`, `lstart` | `lend` in columns 4–5. `source: assumed` for every new key, and the cluster's comments rewritten. `apps`, `symb`, `plot`, `num`, `help`, `menu` and `cancel` go.
- **Actions:** `esc` (Shift `clear`) takes today's Cancel job, then Esc's: it stops a running job, closes Settings, goes back one sheet level (`sheetKeys.ts`: `esc` → back; the `cancel` entry goes), drops a picked row, and otherwise clears the line. A hardware Escape is this key. The special `cancel` goes. `undo` (Shift `redo`): MathLive `undo` and `redo`. `copy` (Shift `paste`): the specials as they are. `lstart` and `lend`: `moveToMathfieldStart` and `moveToMathfieldEnd`; Shift: `moveToGroupStart` and `moveToGroupEnd`. `view`: `special: none` on tap until R53 (results mode, P16) and on Shift until Help exists, so the key is drawn dimmed as D's Help and View are. In an app view without an entry line, ⇤ ⇥, Undo and Redo are dead keys. Store: Shift + ᴇ on an empty line after a result starts `Ans ▶` (owner, 2026-10-19; G2 item 58), in `entry/ans.ts`, with an e2e.
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
- The header comments of `spec/keyboard.yaml` (the Letters line and the flick-down line) still say that Alpha types the capital everywhere; they gain R58's rule: in the CAS view the case is swapped (Alpha lower case, Shift + Alpha the capital).
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
- Later sections (Appearance R50e, User keys R4b, About) are added as rows; leave a comment where.
- **Docs** (exact text in the report): docs/05 section 3 (Settings) and decisions.md "R21" point 4 (a pointer to the new entry).
**Done when:**
- e2e by touch and by keys: the list; each row opens its page and back returns to the list on the same row; values change in place as before; Try it fires one pulse (`recordVibrations`); Android back walks page → list → closed. `settings.spec.ts` moved to the new paths.
- Typecheck, unit and e2e tests pass; the gallery rebuilt (the list and each page, light and dark); the start chunk unchanged (Settings loads lazily).

### ron, R50b: Pascaline in the app, branch `p1/ron-m4a-palette`
**Lane:** day (the owner looks at the colours on the phone). **Starts when:** A14 is merged; before R15c1 (owner, 2026-10-19: the R3 packages are written on its colour roles).
**Read:** `docs/shifts/2026-10-18-themes-report.md` sections 1–3 (the owner's pick, 2026-10-18); `tools/probes/themes-audit.mjs` (`FAMILIES`, `checks()`; `node tools/probes/themes-audit.mjs --css` prints the values); `app/src/style.css`; `app/src/style.test.ts`; `app/index.html` (the inline script at lines 16–36); `app/src/App.svelte` lines 880–890; `app/src/views/History.svelte` line 279; `app/src/apps/function/FunctionPlot.svelte` line 116; `app/src/apps/function/app.svelte.ts` line 17 (`CURVE_COLORS`).
- **The tokens:** `style.css` moves to `:root[data-family="pascaline"][data-brightness="dark"]` and `…="light"]` blocks with the probe's Pascaline values, and adds the six roles `--approx` (≈), `--warn` (⚠), `--pick` (the picked row), `--focus` (focus ring and caret), `--key-on` and `--on-key-on` (a key that is on). Every place that draws one of these today borrows another token (`--shift`, `--alpha`, …): it takes its role.
- **No setting yet:** the brightness follows the system as today, with no frame drawn in the wrong one. Recommended: the existing inline script in `index.html` sets `data-family` and `data-brightness` from `matchMedia` before the first paint and follows a change of the system's setting; R50e later reads the stored values there.
- **The three colours written in components** become tokens: MathLive's `--selection-background-color` (`App.svelte:887`) takes `--pick`, the caret (`:886`) `--focus`; the prominent Cancel's `#fff` (`History.svelte:279`) an `--on-error` pair checked like `--on-enter`; the trace point's `#fff` (`FunctionPlot.svelte:116`) `--text`.
- **The contrast test** reads every `[data-family][data-brightness]` block (not the two blocks of `style.test.ts:16-18`) and checks the full pair list of the probe's `checks()` and the report's table (section 2). It also checks each of `CURVE_COLORS` against each block's `--bg` at 3:1; if one fails, the plot picks a list per brightness, and the test covers both.
**Done when:**
- `style.test.ts` fails on a block made to miss one pair (shown in the report), then passes on Pascaline light and dark.
- A grep in the report shows the three direct colours gone.
- `node tools/probes/themes-audit.mjs` still prints 40/40.
- Typecheck, unit and e2e tests pass; the gallery rebuilt light and dark; the start chunk within +0.3 kB gzip (the number in the report).
**What the owner looks at:** a day with Pascaline dark and light on the phone.

### ron, R50c: the theme generator and the other four families, branch `p1/ron-m4a-themegen`
**Lane:** night-safe (the tests decide; nothing changes on screen until R50e's setting picks a theme). **Starts when:** R50b is merged.
**Read:** `docs/shifts/2026-10-18-themes-report.md` sections 1, 2 and 3 (Size, Licences); `tools/probes/themes-audit.mjs` (all of it: `FAMILIES`, `base()`, `highContrast()`, `plain()`, `checks()`, `--css`); `app/src/style.css`; `app/src/style.test.ts`; `app/scripts/size-check.ts` line 93; `app/vite.config.ts`; `THIRD_PARTY.md`.
- **The generator:** a script in `app/scripts/` built from the probe's code writes every theme value: Pascaline's two start blocks in `style.css` (they must come out as R50b's, byte for byte) and one lazy CSS file per family with all its combinations (`[data-contrast="high"]`, `[data-keys="plain"]` and both), Pascaline's transforms included. An npm script runs it. A test fails when a generated file is out of date, and when any of the 40 combinations misses a pair of the contrast rules (report section 2) or a curve colour misses 3:1 on its `--bg`.
- **Loading:** one function (for example `applyTheme({ family, brightness, contrast, keys })` in `app/src/theme/`) loads the family's file, then sets the root's attributes, so no frame shows a family without its tokens. Nothing in the app calls it yet; R50e will.
- **The probe:** it imports the generator, or it is deleted (with the line for `tools/probes/README.md` in the report). The mockup stays as the owner's reference.
- **Licences:** Solarized (Ethan Schoonover), Gruvbox (Pavel Pertsev) and Nord (Arctic Ice Studio), MIT, colour values only, lightness adjusted where our contrast rules need it: exact `THIRD_PARTY.md` lines in the report.
**Done when:**
- The out-of-date test fails after a hand edit of a generated file (shown in the report); the contrast test covers all 40 combinations.
- Unit tests of the loading function (a fake loader: the attributes are set only after the file is in).
- e2e: no family file is fetched at start (a network check); with no attribute set by a test the screen is unchanged (the gallery shows no difference).
- Typecheck, unit and e2e tests pass; the start chunk within +0.1 kB gzip and each lazy file's size (the numbers in the report).

### ron, R50d: Plain keys and High contrast in the components, branch `p1/ron-m4a-plainkeys`
**Lane:** night-safe (the switches are only set by tests until R50e). **Starts when:** R50c is merged.
**Read:** `docs/shifts/2026-10-18-themes-report.md` section 1 points 2 and 3, and section 3 (the keypad's colour rules); `app/src/keyboard/Keypad.svelte` lines 360–460; `app/src/views/Sheet.svelte`; `app/src/views/History.svelte` and `app/src/render/Math.svelte` (⚠, error text, chips); R50c's loading function and generated files.
- **Plain keys** (`[data-keys="plain"]`; R50c's tokens already give the neutral key tones): Shift and Alpha legends in the text colour; **bold always means Shift** (the legend, the faces while Shift is on, the sheet numbers), **italic always means Alpha** (the letter legend in the maths font, the faces while Alpha is on); the flick bubble (`Keypad.svelte:459`) in bold text, not `--shift`; Enter inverted. The rules switch weight and style, never add a colour.
- **The two exceptions keep their colour in Plain keys:** ⚠ and error text (principle 3), and the plot curves.
- **High contrast** (`[data-contrast="high"]`): a 1.5 px outline in `--line` round every key and the round pad.
- **Size:** these rules go in the lazy CSS loaded with the switch (R50c's files), not in the start chunk.
**Done when:**
- e2e, with the attributes set through R50c's loading function: the computed weight and style of a Shift legend, a Shift face, a sheet number and an Alpha legend in Plain keys; ⚠ and an error keep their colour; the outline is drawn under High contrast; with neither switch, the computed styles are as before.
- Typecheck, unit and e2e tests pass; the start chunk unchanged (the number in the report).

### ron, R50e: Settings › Appearance, branch `p1/ron-m4a-appearance`
**Lane:** day (the owner tries it on the phone). **Starts when:** R50d is merged (R49 before it: its page pattern).
**Read:** `docs/shifts/2026-10-18-themes-report.md` sections 1, 2 (the mockup's Appearance page) and 3 (Startup, the Settings page); `docs/mockups/themes-r50.html` (the page as drawn); R50c's loading function; `app/index.html` (lines 8 and 16–36); `app/src/state/storage.ts`; `app/src/state/session.svelte.ts` (`Settings`, `SETTINGS_SCHEMA`) and `app/src/state/session.settings.test.ts` (the migration pattern); `app/src/views/SettingsPage.svelte`; `app/src/views/modeSheet.ts` (`settingsSections()`, the comment at line 87); `app/test/settings.spec.ts`; `app/playwright.gallery.config.ts`.
- **The row and the page:** `Appearance   Pascaline · Dark ›` opens `Settings › Appearance`: Theme as five radio rows with their swatch dots, Brightness System / Light / Dark, then High contrast and Plain keys as switches with one line of explanation each, as in the mockup. Keys drive it as every page (R49).
- **Stored** with the other settings: the schema goes up one, with a migration test. Defaults: Pascaline; Dark on Android, System in the PWA (docs/05 3.10); High contrast on at the first start when `prefers-contrast: more`, after that the setting decides.
- **The first frame:** the four values are mirrored into `localStorage` (every read and write in try/catch; IndexedDB stays the source), and the inline script of `index.html` sets the attributes and links the family's and the switches' CSS before the first paint; `<meta name="theme-color">` follows `--bg`. The comment at `modeSheet.ts:87` names this row.
- **Not here:** the colour of Android's status and navigation bars (open for the owner).
**Done when:**
- e2e by touch and by keys: each of the four values survives a reload; the first frame after a reload already shows the stored theme (hold `main.ts` with `page.route` and take the screenshot then); `prefers-contrast: more` turns High contrast on at the first start only.
- The schema migration test; the gallery with every family light and dark, plus one High-contrast and one Plain-keys set.
- Typecheck, unit and e2e tests pass; the start chunk within +0.4 kB gzip, the inline script included (the number in the report).
**What the owner looks at:** each family on the phone for a while, and a cold start with a non-default theme (no flash).

### ron, R12b: visual pass, tokens and history rows (U5, U7), branch `p1/ron-m4a-tokens`
**Lane:** day. **Starts when:** R12a is merged with the owner's notes, and R4b, R53 and R50e are merged (so Find, results mode and the themes are in the pass).
**Read:** `docs/05-ui-plan.md` 3.5 and 3.10; the owner's notes (feedback.md); `app/src/style.css` and the theme files of R50c; `app/src/style.test.ts`; `app/src/views/History.svelte`; `app/src/keyboard/Keypad.svelte`; `app/src/views/Sheet.svelte`; the Find chunk from R4a (`app/src/find/`).
- The theme files (R50b–R50d) stay the only source of colour; R12b chooses none. It adds the type scale, 4 px spacing, radii and motion as tokens; no colour or size written directly in a component, Find's and results mode's included; the entry line 52 px tall (feedback #54); history rows as docs/05 3.5.
**Done when:**
- A grep in the report shows no hard-coded colour or size left in `app/src/**/*.svelte` outside the token and theme files.
- The contrast test passes; the gallery rebuilt (the owner reviews it on the phone); the start chunk within 2 kB of before (the numbers in the report).

### ron, R12c: visual pass, press feedback, reduced motion, branch `p1/ron-m4a-motion`
**Lane:** day. **Starts when:** R12b is merged.
**Read:** decisions.md "A4a" point 3 (the sheet rise, 73 ms); `app/src/keyboard/Keypad.svelte` (press feedback; `.key:active` at line 368); `app/src/views/Sheet.svelte` (the rise); R50c's loading function.
- Press feedback within one frame, replacing `filter: brightness(1.4)`, and visible in every family, in Plain keys and under High contrast (the theme setting is R50e's); `prefers-reduced-motion`; profile the sheet rise with `?bench=keypad` and report where the 73 ms go.
**Done when:**
- e2e: the pressed state differs from the rest state in Pascaline, Plain keys and High contrast (computed style); reduced motion turns the rise off; the gallery rebuilt; the start chunk within 0.5 kB of before (the number in the report); the sheet-rise numbers in the report.

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
- **Content:** the index items; `?bench=find`. No usage ranking and no `find.usage` (P11). An empty query shows the G2-style Math menu (fixed categories in a fixed order), numbered: on an empty query digits pick a category, after a letter they type (S2 rule M1). A unit without an exact factor (the index's 34 "without si", e.g. Da; dB alone converts only) is marked in its row, so a pick never ends in a refusal three keys later (check 2026-10-19 finding 17).
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
**Lane:** day. **Opus.** **Starts when:** R24b, G35, G40 and G41 are merged (R24a, R28, G16, G17 and G25 are): through R24c the unit view is reached from the keys, and these fix its silent wrong numbers (`0 m + 1 s` = 1 s; DEG `asin(1/2)·1 rad` = 30 rad; `3000 rpm × 0.1 m → m/s` = 5; `cos(0 ± 0.1)` = 1 ± 0).
**Read:** `docs/research/r9-unit-pad.md` sections 2.1, 2.7 and 2.8; docs/04 4.3 and 5.5 point 2 (the slot owns the key while it is active); the reports of R24a, R24b, R28 and G16; `app/src/units/types.ts`; `app/src/units/calc.ts` (`Calc.units()` lazy); `app/src/calc/engine.ts` (`EngineCalc` takes the index as an option: wire it); `app/src/App.svelte` (`press()`: the second key owner beside the sheet); `app/src/entry/controller.ts` and `app/src/entry/hwkeys.ts` (the capture `keydown` pattern); `spec/keyboard.yaml` (`unit_slot:`); `tools/probes/unit-presses.mjs`; `tests/tasks/tasks.yaml` (t02, t04).
- The read-only formula with a slot after every number (docs/04 4.3). Write a slot only with `setPromptValue` from R24a's model: `insert()` with the caret outside a prompt still changes the read-only formula. Keys reach the active slot through `press()`, never through `EntryController.run`; give the unit view's field a capture `keydown` like `entry/hwkeys.ts`, so a hardware key reaches the pad's actions or does nothing. R24a's model per slot, with R24b's pad up while a slot is active. Evaluation through `Calc.units()` with R28's parser output, the result shown as it returns it (the full result view is not packaged yet).
- The reading in words: add British, American and Johnson to `PROPER` in `app/src/units/slot.ts` ("British thermal unit", archive/decisions-2026-10.md "Opus pass 15 defaults" point 4), with a test.
- `spec/keyboard.yaml`: `unit_slot:` loses `letters`, `symbols`, `ops` and `exponent_leave`; the probe's `--pad` mode becomes its default.
- **Report:** the shared-file text: docs/04 4.3 rewritten for the pad, the status line at the top of r7, and backlog m5 item 4.
**Done when:**
- `app/test/unitpad.spec.ts` by keys and by touch: the units key on a line, on a picked history row, and on an empty line (quantity 1) opens the slots with the pad up; pad presses fill the active slot, and the reading under the formula follows every press; Enter goes to the next slot, Enter in the end slot evaluates, a flick up on Enter evaluates at once; ◀ ▶ move between slots, and Esc keeps the slots with the line; 44 of the probe's 50 units replayed, each within the probe's count.
- e2e from the keys (check 2026-10-19 Part 2 point 5): `0 m + 1 s` refused, `−(20 ± 0.5 °C)` with G35's message, a °C slot (`20 °C → K` = 293.15).
- The probe's medians are ≤ 2, with flicks and with taps only; t02 and t04 within their plans (`npm run test:tasks`).
- The gestures and flicks e2e and the keyboard test pass; the size test passes with the start chunk unchanged; `app/test/softkeyboard.spec.ts` has a unit-view case (the prompts never summon the system keyboard).

### ron, R24d: Find in a slot and the user cells, branch `p1/ron-m5-usercells`
**Lane:** day. **Starts when:** R24c and R4b are merged.
**Read:** `docs/research/r9-unit-pad.md` section 2.9; decisions.md P14 (the user cells) and "P14 arrangement"; `spec/unit-pad.yaml` (`user:`); `spec/units-menu.yaml`; `app/src/keyboard/userKeys.svelte.ts` (the stamped store pattern); `app/src/state/storage.ts`; R4a's and R4b's reports (Find's keys and insertion); `app/src/find/rank.ts`.
- Store the cells in the stamped store beside the user keys (a key such as `unitPadCells`), on the same code path as U1–U6 wherever it fits. A user cell holds one Find unit, with or without a prefix (MPa, mmH₂O); its defaults come from `spec/unit-pad.yaml` `user:`.
- A unit row without an exact factor is marked as in R4a (check 2026-10-19 finding 17).
**Done when:**
- e2e: Math in a slot opens Find on units and prefixes, and an empty query shows the units menu by category; a pick lands in the slot as tokens (a prefixed unit becomes a prefix plus a unit); the six of the probe's 50 units that are not on the pad, each within the probe's Find count; a user cell is set from a Find hit ("Put on the unit pad", choosing the cell and its tap, up or down) and from Settings › Unit pad, survives a restart and resets to its default; an empty user cell opens Find.
- The Find query test unchanged; the size test passes; the gallery has Find in a slot, the units menu and a user cell being set.

### ron, R59: the library rows: import and export, branch `p1/ron-m4-library`
**Lane:** day (the file picker and the UI). **Starts when:** G33, R4b (Find's live items show `desc`) and S6 (the picker) are merged. decisions.md "S4".
**Read:** `docs/research/r10-connector.md` 2 and 3; S6's note (`docs/research/r11-files.md`, when it exists); `app/src/engine/library.ts` (G33's API from its report); `app/src/state/session.svelte.ts` (the Menu rows); the notice component the views use.
- Two Menu rows, Import library and Export library (through the Capacitor Filesystem and the picker S6 chose); the clash list and the test failures shown as one notice with the line numbers; the imported functions appear in Vars and Find with their `desc`. Settings and the user-key slots are not in the file (S4). The notice says that `// test:` lines run on plain Giac (radians, no exact-first), a guard and not a proof (check 2026-10-19 finding 16).
**Done when:** an e2e imports `beams.txt` through a stubbed picker and finds `beam_M` in Find with its description; a clash shows the notice and changes nothing; export writes the same text back; nothing changes for a user who never imports. Removal test (S4): fewer than two imports by the owner in the four weeks after it ships, and the rows go.

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

### ron, R55: digit groups in drawn results, branch `p1/ron-m4a-digitgroups`
**Lane:** day (the owner looks at it on the phone). **Starts when:** R15c4 is merged. Feature analysis 2026-10-18; G2 item 15 (`tests/golden/g2.yaml`: the G2 draws `12,345.6789`).
**Read:** `app/src/render/home.ts` lines 7–20 (`part`, `complexToLatex`) and `polarToLatex`; `app/src/state/displayMode.ts` lines 200–215 (where a row's latex is built); `app/src/render/insertable.ts` (the `\res{k}{shown}` chip: its text comes from the chip table, R2, never from the drawn latex); `app/src/clipboard/text.ts` line 49 (`realText`: the copy text stays plain); `app/src/input/parse.ts` (R51: a number, spacing, a number is an error, so a grouped text must never reach the entry line); `app/test/copy.spec.ts`; `app/test/gallery/`; docs/03 rule 11.
- **The rule:** in a drawn Home or CAS numeric result (history rows and the picked row), the mantissa's digits are grouped in threes from the decimal point outward, on both sides (owner, 2026-10-18), with a thin space (`\,`), only on a side with five or more digits (1234 and 0.1234 stay whole). The exponent, the prefix and the `E` form are untouched. Not in the entry line, not in a chip's text, not in copy, not in the status line. Our own look: a thin space, not the G2's comma, which would collide with R57's decimal comma.
- **Removal test:** if the owner finds the gaps noisy after two weeks, the function goes (no setting).
**Done when:**
- A Vitest of the grouping fails on today's code and passes: `0.333333333333` → `0.333\,333\,333\,333`, `13983816` → `13\,983\,816`, `1234` and `1.5E-9` unchanged, `-0.00012345` → `-0.000\,123\,45`, both parts of a complex, r and θ of a polar.
- e2e: a result is drawn grouped, a tap inserts the plain chip, and `×3` on a tapped 1/3 still gives `= 1`; Copy and Copy as shown give the plain digits (`copy.spec.ts` unchanged).
- The gallery rebuilt (home-history, light and dark); typecheck, vitest, e2e pass; the start chunk within +0.2 kB gzip (the number in the report); the rule and its removal test as a decisions.md defaults entry (text in the report).
**What the owner looks at:** a 12-digit result and a result like 1.034E-5 on the phone: do the gaps read as groups of one number, not as two numbers.

### ron, R57: the decimal comma as a setting, branch `p1/ron-m4a-decimalcomma`
**Lane:** day. **Starts when:** R49 (its page pattern) and R50b are merged. The owner types with a comma daily (2026-10-18). G2 item 61 asks whether the Prime has a decimal-mark setting and what it changes; its answer is recorded and followed where it is a G2 way, and it does not block the package.
**Read:** `app/src/input/parse.ts` lines 33–39 (`commaAt`, L6: with the option `3,5` and `3{,}5` are numbers, and `;` separates arguments); `app/src/input/latex-to-giac.ts` line 10; `app/src/clipboard/text.ts` lines 39–62 and 182 (`realText` with `decimalComma`, the `;`); `app/src/clipboard/paste.ts` line 67; `app/src/clipboard/actions.svelte.ts` lines 40–53 ("not a setting yet"); `app/src/state/session.svelte.ts` lines 50–64 (`Settings`, `SETTINGS_SCHEMA` 2) and `app/src/state/session.settings.test.ts` (the migration pattern); `spec/keyboard.yaml`, the `dot` (line 300) and `comma` (line 224) keys; `app/src/keyboard/keyboard.ts` (`labelFor`, `layerAction`); `app/src/entry/hwkeys.ts` (a typed `,` or `.`); `app/src/render/home.ts` (`part`); `app/src/engine/format.ts` line 228 (`toText` stays the canonical text, with a point); `app/src/entry/controller.ts` (`selectENumber`, R14: it finds a mantissa by digits and `.` only; backlog EN4's open note); the R49 page; `docs/05-ui-plan.md` section 3.
- **The setting:** Settings › Decimal mark: point (the default) or comma; schema 3 with a migration test.
- **Comma mode:** the `.` key shows and types `,` (MathLive's `{,}`, so it never reads as a list comma); the `,` key shows and types `;`, the argument separator the parser already expects; a hardware `.` or `,` both type the decimal mark; results are drawn with `{,}` (R55's thin-space groups stay); copy and paste pass the option (the code takes it); `selectENumber` reads the comma, with an e2e (paste `1,5ᴇ-3`, then ÷ takes the whole number). Point mode is unchanged, and every existing test runs in it.
- **Keys never move** (rule 8): only the two faces change with the mode, as the Alpha faces do.
**Done when:**
- e2e in comma mode, by keys: `3 , 5 × 2` draws `7`; `1 , 5 ÷ 2` draws `0,75`; `max(1;2)` typed with letters gives 2; a copied result reads `0,75`; a pasted `1,5e-3` evaluates to 0,0015; the hardware keys; `selectENumber` on a pasted number.
- The schema-3 migration tests; the gallery with one comma-mode result; typecheck, vitest, e2e and the parser golden cases pass; the start chunk within +0.3 kB gzip (the number in the report).
- The report holds the text for docs/05 section 3, and G2 item 61's answer if the owner has one.
**What the owner looks at:** a day of typing in comma mode: the two faces, a drawn result, a copied value pasted into a message.

### annabell, A9: key vibration on the owner's phone (F41), branch `p1/annabell-haptics`
**Lane:** day (a phone with a motor; take the device lock; not the Tab One). **Starts when:** the owner's phone is connected.
**Read:** feedback.md #50 (never tried on a phone with a motor: A4a ran on the Tab One, which has none); `app/src/input/haptics.ts`; `app/src/App.svelte` (`touched()`, `dead()`); `app/src/main.ts` (`loadNative()`); `android/app/src/main/java/io/github/buerlino/pascaline/PascalineHapticsPlugin.java` and `android/app/src/main/java/io/github/buerlino/pascaline/MainActivity.java` (its registration); decisions.md "P7" point 3 (the setting and its defaults); `tools/README.md` (devices).
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
**Lane:** night-safe in itself (no device; the real key never touches this machine), but it **starts on the owner's go** with the secret table below filled in. Goal (owner, 2026-10-15): pushing a tag `vX.Y.Z` builds, gates, signs and publishes the APK on GitHub, from clean source and with the owner's key, never from the laptop; the defaults are decisions.md "The release path".
**Read:** decisions.md "The release path"; `build.sh`; `android/app/build.gradle`; `fdroid/io.github.buerlino.pascaline.yml`; `fdroid/README.md`; `tools/devlock.test.sh` (the shell-test pattern).
1. **Gradle reads the whole key from the environment:** `PASCALINE_KEYSTORE`, `PASCALINE_KEYSTORE_PASS`, `PASCALINE_KEY_ALIAS`, `PASCALINE_KEY_PASS`. The defaults (`throwaway` / `pascaline-throwaway`) apply only when `PASCALINE_KEY_ALIAS` is unset, so dev builds keep working unchanged. No password or path is committed.
2. **`./build.sh --release`:** it fails before any build step when one of the four variables is missing, when the keystore file does not exist, or when the alias is `throwaway`; it never creates or falls back to the throwaway key; it refuses `--dev`, `--measure`, `--unsigned` and `--no-units`, allows `--engine-dir` and `--qalc-dir`; after Gradle it runs `apksigner verify --print-certs` and compares the certificate's SHA-256 with `android/release-cert.sha256` (one line, from the table below); on a mismatch it deletes the APK and fails; it writes `dist/pascaline-<versionName>.apk` and `.apk.sha256` as well as `dist/pascaline.apk`; the header comment is updated.
3. **The version:** `versionCode 1` and `versionName "0.1.0"` in `build.gradle`; `tools/check-version.sh vX.Y.Z` (exit 0 when the tag equals `v<versionName>`, else print both and exit 1); the F-Droid draft set to 0.1.0 / `v0.1.0` and 1.
4. **Report:** the shared-file text for backlog R2 and C4, `fdroid/README.md` (the version item is done), and CLAUDE.md's Commands line for `build.sh` (`--release`).
**Found in the code (2026-10-15):** `android/app/build.gradle` lines 23–37 know only the alias `throwaway` and fall back to the password `pascaline-throwaway`; `build.sh` lines 75–88 sign with the throwaway key unless `--unsigned` is passed, with no release mode, so a release could silently get the throwaway key; `versionCode 1` / `versionName "1.0"` are placeholders (the F-Droid draft says 0.2.0 / 2); there is no `.github/`.
**The owner fills in before A7 starts** (names only; the values stay in GitHub; the keystore secrets are stored there since 2026-10-15):

| What | GitHub secret name | Note |
|---|---|---|
| keystore, base64 | `TODO` | `base64 -w0 release.jks` |
| store password | `TODO` | |
| key alias | `TODO` (secret or plain value) | |
| key password | `TODO` | same as the store password? |
| certificate SHA-256 | (plain, goes in the repo) | `keytool -list -v -keystore release.jks` → `SHA256:` line |

**Done when:**
- `tools/test-release-guard.sh` (no Gradle run) checks each refusal of step 2 and `check-version.sh` on a match (`v0.1.0`) and a mismatch (`v0.1.1`), and passes.
- `./build.sh --dev --engine-dir … --qalc-dir …` still produces a throwaway-signed APK (the command and its last line in the report).

### annabell, A8: the release workflow, branch `p1/annabell-releaseci`
**Lane:** day (the owner pushes the test tag). **Opus** (it handles the signing key on a machine we do not own). **Starts when:** A7 is merged.
**Read:** decisions.md "The release path"; A7's report (the secret names); `build.sh` (after A7); `engine/giac/build-wasm-release.sh` and `engine/qalc/build-wasm.sh` (`CONTAINER_ENGINE`, `NO_LOCK`); `app/scripts/golden.ts`; `tools/check-version.sh`.
Write `.github/workflows/release.yml`: trigger `push` of tags `v*` and `workflow_dispatch` with a tag input; runner `ubuntu-24.04` (podman); `permissions: contents: write`, nothing more; `concurrency` per tag; `timeout-minutes: 120`; every action pinned to a full commit SHA with the version in a comment (checkout, setup-java 21, setup-node 22), no other third-party action; the release created with `gh release create` and `GITHUB_TOKEN`. Steps in order: (1) `tools/check-version.sh "$GITHUB_REF_NAME"`; (2) engine and qalc in the pinned container with `NO_LOCK=1`; (3) the golden gate on `engine/giac/_out/release` (absolute `GIAC_OUT`), which must print `GOLDEN GATE PASSED` before the key is decoded; (4) decode the keystore into `$RUNNER_TEMP` (mode 600), then `NO_LOCK=1 ./build.sh --release --engine-dir … --qalc-dir …` with the secrets as `env:` of this step only, never in a `run:` line or `echo`, and an `if: always()` step that deletes the keystore; (5) `gh release create "$TAG" dist/pascaline-<v>.apk dist/pascaline-<v>.apk.sha256 --prerelease` when the major version is 0 or the tag has a `-`, with notes giving the commit, the engine and qalc `SHA256SUMS` and the certificate fingerprint. Not in this package: the PR/CI checks (backlog C3, which builds on A6) and the F-Droid submission (C4).
Also write `docs/release.md`, the owner's one-page checklist: bump versionCode and versionName (and the F-Droid draft) in one commit on `master`; `git tag -s vX.Y.Z` (or `-a`); `git push origin vX.Y.Z`; watch the run; check the SHA-256 and `apksigner verify --print-certs` on the downloaded APK; install over the last release; what a failed run leaves behind (nothing is published) and how to re-run.
**Done when:**
- The workflow passes `actionlint` (run once with `npx` or a container; not added to the repo); the run's log lines are in the report.
- On a throwaway tag `v0.0.1-test` from a test branch (the owner's OK, and the owner pushes it), the run ends with a pre-release whose APK verifies against `android/release-cert.sha256`; then the test release and tag are deleted. Then the owner pushes `v0.1.0`.

### annabell, A11: Paste and Share on Android, branch `p1/annabell-clipboard`
**Lane:** day (the Tab One is enough for Paste: WebView 131 denies `readText` there; the owner's phone for Share when it is connected). **Starts when:** a device is connected; it can share the day with A9. decisions.md "A4a" point 5 (decided 2026-10-18: both plugins).
**Read:** `app/src/clipboard/port.ts` (`ClipboardPort`: `writeText`, `readText`, `share`) and `impl.ts`; `app/src/clipboard/port.test.ts`; `app/src/App.svelte` line 107 (the clipboard chunk is a dynamic import); `app/src/input/haptics.ts` lines 10–25 (`loadNative`: `@capacitor/core` is loaded when idle, `isPluginAvailable`); `build.sh` line 72 (`npx cap sync android`); `THIRD_PARTY.md` (the table); `app/scripts/size-check.ts` (the chunk rules); `android/app/src/main/AndroidManifest.xml` (VIBRATE only, C5); `docs/rules-core.md`; docs/04 2.6 and 8.2; `app/test/copy.spec.ts`.
- **Dependencies:** `@capacitor/clipboard` and `@capacitor/share`, the 8.x versions matching `@capacitor/core` 8.5.3, MIT, offline, no permission; pinned in `package.json`; two rows in THIRD_PARTY.md (name, version, licence, URL, "offline; no permission").
- **The port:** on a native platform with the plugins available, a `ClipboardPort` on `Clipboard.read`/`write` and `Share.share({ title, text })`, loaded inside the clipboard chunk (never in the start chunk); the web port stays for the PWA and when a plugin is missing. The text path is unchanged (`paste.ts` reads what comes back).
**Done when:**
- On the device: Shift + Menu pastes a copied `1.5e-3` into the line and it evaluates; Menu › Share session opens the Android share sheet; Copy still works; `adb shell dumpsys package io.github.buerlino.pascaline | grep permission` lists VIBRATE only.
- `port.test.ts` covers the choice (native when available, web otherwise); the size test passes with the start chunk unchanged; typecheck, vitest, e2e.
- The report holds the THIRD_PARTY.md rows and the text that closes "A4a" point 5.
**What the owner looks at:** Paste and Share on the phone, once.

### annabell, A12: the defs replay re-measured on the Tab One, branch `p1/annabell-replay`
**Lane:** day (the Tab One, the device lock). **Starts when:** G29 is merged and the Tab One is connected.
**Read:** G29's report; decisions.md "A4a" point 2; `tools/README.md` (measure builds, `device_run.py`); `app/src/bench.ts` (`?bench=defs`); `.coord/device-runs.jsonl` (the A4a row to compare with).
- A measure build from `phase-1`; seed the log with `?bench=defs`; cold start seven times; record the replay p50 and p95 and engine ready with 200 definitions, with device, Android, WebView and build type (rules section 3). With the same build, the cold start's keyboard-usable time against A4a's run (`d276ad6`); more than +50 ms goes under Needs the user (the start-chunk budget's rule, raised 2026-10-19).
**Done when:** the row is in `.coord/device-runs.jsonl` and the report; replay ≤ 50 ms and engine ready < 1.5 s, or the miss with the number and the next lever (values replayed lazily) under "Needs the user"; decisions.md "A4a" point 2 and docs/04 8.3's "Today" column get the number (text in the report).

### sandra, S10: docs/04 diet, room for the next rewrites, branch `p1/sandra-docs04diet`
**Lane:** night-safe (docs only). **Starts when:** nothing is pending (it writes no package file and no brief text); before R15c2 starts by day (R15c2 rewrites 5.1). From `docs/research/check-2026-10-19.md` finding 15.
**Read:** `docs/04-architecture.md` by section (`grep -n '^#'`); `tools/docs-check.mjs` (the 70 kB budget); `docs/research/r6-pipelines.md` (where probe evidence already lives); S7's report (the diet's rules: one place per fact).
- docs/04 is 69.5 of 70 kB. Move what is evidence, not architecture, out of it: Appendix A's probe tables and the units table of 4.3 into `docs/research/` (a new `r12-evidence.md`, or the existing r6), with a link back. Rewrite in place, never amend. The rules, the marks (2.4), the precision chain, the state model and the budgets stay in docs/04.
- Keep every anchor another file links to (docs-check checks the files, not the anchors: grep the repo for `04-architecture.md#`).
**Done when:** docs/04 is at most 60 kB; `node tools/docs-check.mjs` passes; nothing under `app/` changed; the report lists what moved where.

### sandra, S6: files in and out without INTERNET, the backup, branch `p1/sandra-files`
**Lane:** night-safe (Chromium probes; the device checks are annabell's, later). **Starts when:** S7 is merged. Deep-dive item 18; it also answers S4's point 2.
**Read:** `docs/rules-core.md` (offline, F-Droid); `android/app/src/main/AndroidManifest.xml` (no INTERNET); `app/src/clipboard/port.ts` (`share`); `app/src/state/storage.ts` (the keys, `DATA_VERSION`, the migrations); docs/04 6.2; backlog.md "Needs the user" (the move to the new app id had no backup); `THIRD_PARTY.md` (for any plugin).
1. **Out:** the Web Share API with a file in the Capacitor WebView (`navigator.canShare({ files })` on WebView 131); a download (`<a download>`) in the WebView and in the PWA; `@capacitor/filesystem` with `@capacitor/share` (MIT: their size, and what they need in the manifest). Recommend one that needs no new permission.
2. **In:** `<input type="file">` in the WebView (does it open Android's picker without a plugin, and does it keep the system keyboard closed?); "open with": an intent filter for the file type, and what `MainActivity` needs; the File System Access API in the PWA.
3. **The file:** JSON, one part per stored key with its stamp; what it holds (history, definitions, settings, user keys, later the unit-pad cells); its size at the limits (200 rows in each view, 500 definitions); what a restore refuses (a newer version, a broken stamp); merge or replace.
**Done when:**
- `docs/research/r11-files.md` exists with the three answers and their probes; the report gives the proposal for decisions.md "Needs the user" as one recommendation and the completed step lists of R38a and R38b for their package files; nothing under `app/` or `android/` changed.

### sandra, S8: the outside-test protocol, branch `p1/sandra-outside`
**Lane:** night-safe. **Starts when:** S6 is merged. Deep-dive item 24.
**Read:** `docs/03-feature-analysis.md` rules 1, 2 and 13; `tests/tasks/tasks.yaml`; `tests/tasks/find-queries.yaml`; decisions.md P14; backlog.md "Needs the user" (the hand timing, the outside testers).
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
Every review and merge is a pipeline run (rules section 4; CLAUDE.md): the audit by sofia on `git diff -U5 phase-1...<branch>` plus the block's "Done when" lines, then `git merge --no-ff --signoff` into `phase-1`. A finished branch from before the pipeline is merged with `scripts/pipeline.sh <agent> "<ID>" --no-worker` (A10). The Opus pass (section 0c) applies the reports' shared-file text, deletes merged package files (and, until A14, their blocks in section 7) and their rows from section 0's table, and files proposals under "Needs the user". When a merge completes milestone 4, the Opus pass writes `docs/shifts/<date>-m4-report.md` and adds milestone 4 to docs/02 section 12. Never push.
