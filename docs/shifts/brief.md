<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Shift brief: milestone 4a "feel" and milestone 4 "Find and trust", with milestone 5's unit view beside them (run by the owner)

**Every package runs through `scripts/pipeline.sh`** (rules section 4): by day the owner starts one package at a time (`scripts/pipeline.sh <agent> "<ID>" --model <m>`, the table gives agent and model) and reads the RESULT line; at night `scripts/night.sh` runs the queue of section 0c. Nobody starts a worker or merges another way (CLAUDE.md). The standing rules in [rules.md](rules.md) apply; where the two differ, this brief wins. Each open package is one file in [packages/](packages/), in the shape the pipeline bundles (section 2). The shape of a package file: the heading `### <agent>, <ID>: <title>, branch \`p1/<agent>-<slug>\``; **Lane** (night-safe = no device, no APK, no eye on the UI; day = the owner tries it); **Starts when**; **Read** (repo paths get bundled, first 400 lines; the big shared docs by bare name and section); the steps; **Done when** (lines an auditor checks in the diff).

## 0. State and the path
`phase-1` on 2026-10-20 after the fifth night (runs 89–118, Opus passes 32–42, `da7a59c`; [2026-10-20-night-report.md](2026-10-20-night-report.md)); the research of 2026-10-19 is decided ([consolidation report](../archive/shifts/2026-10-20-sandra-consolidation-report.md); decisions.md P18–P22). Every merge and its commit: `git log --merges --oneline phase-1`; the audits are in the Opus passes' defaults (decisions.md, older ones in [archive/decisions-2026-10.md](../archive/decisions-2026-10.md)) and the night reports ([archive/shifts/](../archive/shifts/)).

### The path (owner, 2026-10-14; rewritten 2026-10-20 after the research of 2026-10-19)
**Why.** The G2's flow is the backbone; principle 3 is what we add to it, and today it is broken in our own layer between Giac and the screen, not in the keys or the parser. Of the 16 open bugs (backlog F44–F59, rechecked on `da7a59c`), 10 are wrong code of ours; in the other 6 the wrong value comes from Giac and our layer passes it on under `=`, `≈` or as Giac's text. Ten reach users today. So we harden that layer before anything widens what reaches it, and fix each bug at its cause (P18, P19). The ron lane by day touches no engine code and goes on unchanged.

**By day, one pipeline at a time** (owner, 2026-10-18), each after the one before is merged:
1. **R15c2 → R15c3 → R15c4**, **R55**, **R49**, **R57**, **R50e**.
2. **R4a** once G67 and G71 are merged (night step 3), then **R4b**, **R53**, **R36**, **R33**, **R37**, **R12b**, **R12c**, **R41**, **R40** (R36 and R40 after G76).
3. The unit pad: **R24b** → **R24c** → **R24d** (after R4b). Nothing of the hardening blocks R24c.
4. annabell: **A16** again after G53, **A9** and **A11** with a device, **A18**, **A24**, **A25**, **A22**, **A19** (G64 waits for it), **A12**, **A4b** after R4b, **A20** with the Tab One, **A21** after F-Droid's answer, **A7 → A8** on the owner's go.
5. **R59** after G72 and G73/G74 (and R4b, A12); **R38a** (after A11) **→ R38b**; **R70** after R49 and **A23**, both before outside round 1; **R71** (±) after R24c.

**At night, the hardening, in this order** (gorge unless named; tests first, failing on `da7a59c`):
1. **Reachable today:** G58 (F44, Home hangs) → G59 (F45, F46) → G78 (F50, F51, refused with a reason); G68 (F53), G69 (F54), G70 (F56), R69 (F55).
2. **The cause in Giac:** G75 (patch 0003, complex `tanh`; measures whether the inverse functions patch as simply) → G60 (F47, only what the patch cannot fix) → G56 (narrowed to our CAS gap; dropped if nothing is left).
3. **Before R4a** (Find puts `cas_setup`, `purge`, `sto`, `trunc`, `Heaviside`, `BesselJ` one tap away): G67 (F52, Giac's flags), G71 (F48, F49, F59). G65 (S13; it takes F58) after G67, then G66 after G75.
4. **Before R59** (a library brings Giac text no parser has read): G72 (F57), G73 → G74 (one reader of Giac text). **Before R36 and R40:** G76.
5. **Engine and docs:** S17 (the workaround register with canaries) → G77 (the numbered Giac pin); S18 (status lines, decided notes to the archive).
6. **The instruments:** G61 → G62, G63; G64 after A19 (annabell, by day); then S16, an Opus pass, triages what they find into fix packages.

**Why this order:**
- Silent wrong numbers and freezes first, by reach: today's before R4a's, R4a's before R59's. G58 goes first: a hang hides every other answer.
- Find inserts LaTeX, which still passes our parser, so R4a needs step 3, not the reader; a library file skips the parser, so R59 needs the reader (step 4).
- G75 before G60 and G56: a patch at the cause ends at the pin that has Parisse's fix; a TypeScript workaround never ends (P19).
- The instruments after the fixes and the re-pin, so they test code that stays; then they stay in the gate.
- R15c goes first by day: it changes keys the hand is learning (docs/03 rule 8). R4b, R53 and R41 wait for it. R55 before R49; R57 after R49 (its page pattern).
- The start chunk is 56.00 of 60 kB gzip (docs/04 8.3), ~+0.3 per UI package: every UI package reports its delta, and Settings pages and the tips load lazily (docs/04 6.3).

### The open packages
The night's hardening packages are listed once, in the queue (section 0c), each linked to its file.

| # | Package | Agent, model | Lane | Starts when merged | Size |
|---|---|---|---|---|---|
| [A16](packages/A16.md) | Enter p95 on the Tab One after G53 | annabell, Sonnet | day (device) | G53 | ~0.25 d |
| [A18](packages/A18.md) | The audit sees the behaviour diff | annabell, Sonnet | day | now | ~0.25 d |
| [A24](packages/A24.md) | A worktree never empties another's node_modules | annabell, Sonnet | day | now | ~0.25 d |
| [A25](packages/A25.md) | The golden gate gates itself | annabell, Sonnet | day | now | ~0.1 d |
| [A23](packages/A23.md) | Android's backup off | annabell, Sonnet | day (device) | now | ~0.1 d |
| [A22](packages/A22.md) | The docs check knows ids, live notes and source sizes | annabell, Sonnet | day | now | ~0.25 d |
| [A19](packages/A19.md) | Giac's own test suite as an engine-gate stage | annabell, Sonnet | day | now | ~0.25 d |
| [A20](packages/A20.md) | The golden Home and precision stages in the WebView | annabell, Sonnet | day (device) | the Tab One connected | ~0.25 d |
| [A21](packages/A21.md) | libqalculate out of the build (P22) | annabell, Sonnet | day | F-Droid's answer | ~0.5 d |
| [R15c2](packages/R15c2.md) | The R3 keys: round pad, six user keys, the editing wing | ron, **Opus** | day | now | ~1.5 d |
| [R15c3](packages/R15c3.md) | The user keys' Alpha layer | ron, Sonnet | day | R15c2 | ~0.5 d |
| [R15c4](packages/R15c4.md) | First-start tips | ron, Sonnet | day | R15c2 | ~0.5 d |
| [R55](packages/R55.md) | Digit groups in drawn results | ron, Sonnet | day | R15c4 | ~0.5 d |
| [R49](packages/R49.md) | Settings as a list of rows, each with its own page | ron, Sonnet | day | R15c4 | ~0.75 d |
| [R50e](packages/R50e.md) | Settings › Appearance | ron, Sonnet | day | R50d | ~1 d |
| [R57](packages/R57.md) | The decimal comma as a setting | ron, Sonnet | day | R49 and R50b | ~1 d |
| [R4a](packages/R4a.md) | Find on Math | ron, Sonnet | day | R15c chain, G67, G71 | ~2 d |
| [R4b](packages/R4b.md) | Vars, Memory and the user keys from Find | ron, Sonnet | day | R4a and R15c3 | ~1 d |
| [R53](packages/R53.md) | Results mode on the View key (P16, S9) | ron, **Opus** | day | R15c2 and R4b | ~1.5 d |
| [R36](packages/R36.md) | A picked row says why it has its mark | ron, Sonnet | day | G76 | ~0.5 d |
| [R33](packages/R33.md) | Names with a value, marked on the line | ron, Sonnet | day | R4b | ~0.5 d |
| [R37](packages/R37.md) | The angle check | ron, Sonnet | day | R33 | ~0.75 d |
| [R12b](packages/R12b.md) | Visual pass: tokens and history rows | ron, Sonnet | day | R4b, R53, R50e | ~1.5 d |
| [R12c](packages/R12c.md) | Visual pass: press feedback, reduced motion | ron, Sonnet | day | R12b | ~1 d |
| [R41](packages/R41.md) | Key labels for TalkBack | ron, Sonnet | day | R12c | ~0.5 d |
| [R40](packages/R40.md) | Muted digits past a constant's uncertainty | ron, Sonnet | day | R41, G76 | ~0.5 d |
| [R24b](packages/R24b.md) | The unit pad drawn over the keys | ron, Sonnet | day | now | ~1 d |
| [R24c](packages/R24c.md) | The unit view entry: slots, Enter, evaluation | ron, **Opus** | day | R24b, G35, G40, G41 | ~1 d |
| [R24d](packages/R24d.md) | Find in a slot and the user cells | ron, Sonnet | day | R24c and R4b | ~0.5 d |
| [R60](packages/R60.md) | The unit result's alternatives as data (UI-free) | gorge, **Opus** | night | R24c | ~0.75 d |
| [R61](packages/R61.md) | The chip from a unit result, with its facts and σ (UI-free) | gorge, **Opus** | night | R24c | ~0.75 d |
| [R62](packages/R62.md) | The unit result view drawn | ron, Sonnet | day (gallery) | R60 | ~1 d |
| [R63](packages/R63.md) | The way back from the unit view; t02, t04 and t10 active | ron, **Opus** | day | R61 and R62 | ~1 d |
| [R59](packages/R59.md) | The library rows: import and export (S4) | ron, Sonnet | day | R4b, A12, G72, G74 | ~0.5 d |
| [R70](packages/R70.md) | The tap counter counts every press (S8) | ron, Sonnet | day | R49 | ~0.5 d |
| [R71](packages/R71.md) | ± on Shift + `,` (M4-2) | ron, Sonnet | day | R24c | ~0.5 d |
| [R38a](packages/R38a.md) | The backup: export everything | ron, Sonnet | day | A11 | ~0.5 d |
| [R38b](packages/R38b.md) | The backup: restore from a file | ron, **Opus** | day | R38a | ~0.75 d |
| [A9](packages/A9.md) | Key vibration on the owner's phone | annabell, Sonnet | day (device) | the owner's phone connected | ~0.5 d |
| [A11](packages/A11.md) | Paste and Share on Android | annabell, Sonnet | day (device) | a device connected | ~0.5 d |
| [A12](packages/A12.md) | The defs replay re-measured on the Tab One | annabell, Sonnet | day (device) | the Tab One connected | ~0.25 d |
| [A4b](packages/A4b.md) | Find timing on the Tab One | annabell, Sonnet | day (device) | R4b; the Tab One connected | ~0.25 d |
| [A7](packages/A7.md) | Release signing and the version number | annabell, Sonnet | any time | the owner's go | ~0.5 d |
| [A8](packages/A8.md) | The release workflow | annabell, **Opus** | day | A7 | ~0.5 d |

**Why these models:** Opus where a slip breaks entry, the unit chain or stored data for every later package, or gives a wrong number (R15c2, R53, R24c, R38b, A8, the night's engine packages); sandra and sofia run Opus; Sonnet elsewhere (an existing pattern, pinned by tests); the audit model follows P17.
## 0c. Night shifts: henri's plan (owner, 2026-10-14; queue rewritten 2026-10-19)
The queue below is the next nights'. `scripts/night.sh` runs it (rules section 4): for every decision it starts a fresh henri (Sonnet, Read-only) who sees this section and the log's tail and replies with one `scripts/pipeline.sh` line; the script runs that line and asks again. **henri executes and decides nothing.** **Use the window** (owner, 2026-10-19): the queue runs until the usage limit or its end; what is not done stays in the queue for the next night (resumed from the log). The night queue holds what needs no APK, no device and no eye on the UI (owner, 2026-10-18); the rest of the ron lane runs by day.

### Rules for a night shift (they replace rules section 4's day use)
1. **One pipeline run at a time**, and never a worker started any other way. A package is `scripts/pipeline.sh <agent> "<ID>" --model <model from the table> --audit-model auto`: fresh worker, checks, at most two fix rounds, sofia's audit (P17: the pipeline raises gorge packages, Opus workers and engine, input or units diffs to Opus), merge. A review-only merge is `scripts/pipeline.sh <agent> "<ID>" --no-worker --audit-model auto` (A10): phase-1 merged into the branch, checks, audit, merge; a conflict or a FIX is a fix round for the package's agent. Its RESULT line in the log is the step's state.
2. **No devices:** nobody runs `adb` or `build.sh`. annabell is not used at night.
3. **henri decides nothing.** Anything this section does not settle: the pipeline logs it, and henri hands it to the next Opus pass (at once, if it blocks the queue). **Follow every Opus-pass recommendation as written.** Plan changes go to the owner through `docs/decisions.md` "Needs the user", written by the Opus pass.
4. **Workers tick their own backlog line** and file their "Needs the user" items on their branch (rules section 5); the audit sees them in the diff.
5. **Opus pass:** `scripts/pipeline.sh pass <n> "<IDs with merge commits or unmerged branches>" "<open questions or none>"` after every three finished packages (merged or left unmerged; fix packages from a pass count), and the last pass at the end of the queue. Each FIX line of its reply runs as `scripts/pipeline.sh <agent> "<prompt>" --id <ID>f1 --branch <branch> --model <m> --audit-model auto`, then QUEUE is followed. A prompt never holds a backtick or a `$` (`night.sh` refuses them; two refusals in a row end the night). The last pass's FIX packages get only their audit, then the report.
6. **Log:** the pipeline writes one line per step in `.coord/log.md` (time from `date`, step, agent and model, outcome, commit); `night.sh` logs each henri reply. The log is the queue state: henri continues from the first step without a RESULT line.
7. **Usage limit:** the pipeline exits 75 and `night.sh` waits 30 minutes and retries, at most six times, then logs `STOPPED`. No retry loops in agents. The owner resumes with `scripts/night.sh` again. A usage limit in the two closing steps (rule 9) waits and retries that step.
8. **A step that ends without a RESULT line** (the pipeline died; A10 makes every exit print one): henri runs the same step once more; if the log then shows it twice without a RESULT, he skips it and goes on. **Worker gone without a report** (no commit): the pipeline logs `NOT MERGED (no commits)` and keeps the worktree; henri runs the same step once more (the pipeline resumes the branch). If that fails too, go on.
9. **The end:** after the last pass and its FIX packages, `scripts/pipeline.sh report` writes and commits the shift report; henri then answers `SHIFT DONE`. **On time (A17):** start `scripts/night.sh --until <HH:MM>` (`--dry-run` shows the plan); from that time, or at `--max-steps` minus 2, henri is asked only for the last Opus pass (or `NO PASS`), then night.sh runs the report and stops. The pipeline merges only the commit its audit read and stops with `NOT MERGED (the branch is not the audited HEAD)` otherwise.

### The queue (the next nights; rewritten 2026-10-20; steps 30–61 are done, or moved here)
Estimates are wall-clock guesses. A package merged by day is skipped (log it); a step whose "after" is not merged is skipped for that night and stays in the queue. The audit model follows rule 1. The order is the path's (section 0).

| Step | What | Agent, model | Branch | After | Est. |
|---|---|---|---|---|---|
| 62 | [G58](packages/G58.md) Home never hangs | gorge, Opus | `p1/gorge-m4-nohang` | — | 1.5 h |
| 63 | [G59](packages/G59.md) the exact path checked against evalf | gorge, Opus | `p1/gorge-m4-exactcheck` | G58 | 1.5 h |
| 64 | [G78](packages/G78.md) refused with a reason: ÷0, overflow, lost answers | gorge, Opus | `p1/gorge-m4-novalue` | G59 | 1 h |
| 65 | [G68](packages/G68.md) Solve's knowns carry every digit | gorge, Sonnet | `p1/gorge-m4-solveknowns` | — | 1 h |
| 66 | [G69](packages/G69.md) a bound variable inherits no facts | gorge, Sonnet | `p1/gorge-m4-boundfacts` | — | 1 h |
| 67 | [G70](packages/G70.md) Area refuses only where Home does | gorge, Sonnet | `p1/gorge-m4-areaundef` | — | 1 h |
| 68 | [R69](packages/R69.md) Copy session writes the screen's mark | ron, Sonnet | `p1/ron-m4-copymark` | — | 45 min |
| 69 | [G75](packages/G75.md) patch 0003: complex tanh in Giac | gorge, Opus | `p1/gorge-m4-tanhpatch` | — | 1.5 h |
| 70 | [G60](packages/G60.md) no double inside an MPFR result | gorge, Opus | `p1/gorge-m4-mpfrdoubles` | G75 | 1.5 h |
| 71 | [G56](packages/G56.md) the CAS check reads through a user function | gorge, Opus | `p1/gorge-m4-complexbody` | G60 | 1 h |
| 72 | [G67](packages/G67.md) Giac's flags restored, never logged | gorge, Opus | `p1/gorge-m4-flags` | — | 1.5 h |
| 73 | [G71](packages/G71.md) tier-1 functions that decide or drop to a double | gorge, Opus | `p1/gorge-m4-tier1decide` | — | 1.5 h |
| 74 | [G65](packages/G65.md) names from Giac's state (S13), with F58 | gorge, Opus | `p1/gorge-m4-statefacts` | G67 | 2 h |
| 75 | [G66](packages/G66.md) a store counter in Giac (next patch number) | gorge, Opus | `p1/gorge-m4-storecounter` | G65, G75 | 1.5 h |
| 76 | [G72](packages/G72.md) every store form counts as a store | gorge, Sonnet | `p1/gorge-m4-statewords` | — | 45 min |
| 77 | [G73](packages/G73.md) one reader of Giac text | gorge, Opus | `p1/gorge-m4-giactext` | G67 | 3 h |
| 78 | [G74](packages/G74.md) the readers move to it | gorge, Opus | `p1/gorge-m4-giactextmove` | G73, G72 | 3 h |
| 79 | [G76](packages/G76.md) the port carries every fact | gorge, Sonnet | `p1/gorge-m4-portfacts` | — | 1 h |
| 80 | [S17](packages/S17.md) the workaround register, with canaries | sandra, Opus | `p1/sandra-workarounds` | G75 | 1.5 h |
| 81 | [G77](packages/G77.md) Giac on the numbered Debian archive | gorge, Opus | `p1/gorge-m4-giacpin` | G75, S17 | 2 h |
| 82 | [S18](packages/S18.md) status lines; decided notes to the archive | sandra, Opus | `p1/sandra-noteslife` | — | 45 min |
| 83 | [G61](packages/G61.md) the oracle sweep as a gate stage | gorge, Sonnet | `p1/gorge-m4-oraclesweep` | G58 | 2 h |
| 84 | [G62](packages/G62.md) sequences and state in the sweep | gorge, Sonnet | `p1/gorge-m4-seqsweep` | G61 | 1.5 h |
| 85 | [G63](packages/G63.md) one value in every view | gorge, Sonnet | `p1/gorge-m4-viewsweep` | G61 | 1.5 h |
| 86 | [G64](packages/G64.md) CAS answers checked back | gorge, Sonnet | `p1/gorge-m4-casback` | A19 | 1.5 h |
| 87 | [S16](packages/S16.md) the hardening pass, run as `scripts/pipeline.sh pass <n> "G61 G62 G63 G64 A19" "S16: docs/shifts/packages/S16.md"` | sofia, Opus | — | G61–G64, A19 | 1 h + fixes |
| 88 | [R60](packages/R60.md) the unit result's alternatives as data | gorge, Opus | `p1/gorge-m5-unitalts` | R24c | 1.5 h |
| 89 | [R61](packages/R61.md) the chip from a unit result, facts and σ | gorge, Opus | `p1/gorge-m5-unitchip` | R24c | 1.5 h |
| 90 | **The last Opus pass** on what came after pass 42, then its FIX packages | Opus | — | — | 20 min + fixes |
| 91 | Shift report, then stop | — | — | — | 10 min |

Not in the queue: the day packages and annabell's (section 0).

### The commands henri replies with (one per decision; `scripts/night.sh` runs it)
- `scripts/pipeline.sh <agent> "<ID>" --model <sonnet|opus> --audit-model auto`: the next queue step not done (the queue's skip rule above).
- `scripts/pipeline.sh <agent> "<ID>" --no-worker --audit-model auto`: a review-only merge of a finished branch.
- `scripts/pipeline.sh <agent> "<FIX prompt, verbatim>" --id <IDf1> --branch <branch> --model <m> --audit-model auto`: a FIX line of the last Opus pass, one per call, in order. No backtick and no `$` anywhere in the line.
- `scripts/pipeline.sh pass <n> "<IDs with merge commits or unmerged branches>" "<open questions or none>"`.
- `scripts/pipeline.sh report`, then `SHIFT DONE`.

### Opus pass (instructions for the Opus agent)
You are the shift's quality gate and its decision-maker; henri executes your reply literally. Work in the worktree where `phase-1` is checked out (the pipeline tells you which); no code changes.
1. For each package: its package file (`docs/shifts/packages/<ID>.md`), its report (`git log -1 <merge>^2`, or the branch tip if unmerged), its diff (`git diff <merge>^1 <merge>`), and the audit's verdict from `.coord/log.md`.
2. Run once on `phase-1` (from `app/`, with absolute `GIAC_OUT`, `PASCALINE_DL_DIR` and `PASCALINE_QALC_DL_DIR`): typecheck, `npm run index` then `FIND_INDEX=required npm test`, e2e, and the golden gate when engine or parser code changed. Take `tools/devlock.sh acquire host-cpu opus 1800` around them.
3. Check what an audit tends to miss: wrong or invented expected values (sources), a missing round trip, silent wrong numbers or marks (principle 3), scope, keys that moved, tests that pass for the wrong reason. An engine package gives its Giac calls per Enter before and after (`tools/probes/engine-calls.ts`).
4. Decide each "Needs a decision" item of these packages and each open question from the log: a default within the plan goes into `docs/decisions.md` (rules section 9); a plan change goes under "Needs the user" with your recommendation in one sentence. Apply the "For shared files" text of the packages' reports, delete each merged package's file and its row from section 0's table, and run `node tools/docs-check.mjs`. Commit those doc changes on `phase-1` with `git commit -s` and the Opus trailer, under `tools/devlock.sh acquire integ opus 600` (A10).
5. Reply in exactly this form, nothing before `OPUS PASS` and nothing after NOTES, and no backtick or `$` in a FIX prompt (`night.sh` refuses the line; name files and code in plain words). Never edit a DECIDED entry of decisions.md on a proposal that is still OPEN; put the change under the proposal. One FIX line per needed fix package; fix IDs are `<ID>f1`, `<ID>f2`, never `<ID>f3` or `<ID>f2f1`: at a chain's second follow-up the next FIX removes the shared cause, as a new id with the family's earlier cases as its tests; more than a day of work goes under "Needs the user" (owner, 2026-10-20):
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
- `docs/decisions.md`: P8, P9, P10, P15, P16, P17 and the defaults entry "2026-10-12 Architecture for the engineer core" (archive; docs/04 holds it). These are decided; don't reopen them. If a docs/04 decision turns out wrong in the code, don't change it silently: finish what you can, and put the evidence under "Needs a decision" in your report.
- Not in milestone 4: matrices (milestone 6; the list key alone is R54), bases and everyday functions (milestone 6; `par` and `eseries` alone are G30), Help = context help (milestone 6), prefix entry chips (gated by task 3).
- **No coordinator to message.** Stay inside the files your package names. Shared files follow rules section 5; devices are annabell's.

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
- **Source size** (owner, 2026-10-20; checked once A22 is merged): no file grows past its line in `tools/line-baseline.yaml` and no new source file passes 800 lines, unless the same diff raises the line with a reason (the `calls-baseline.yaml` rule); a split lowers the line.
- **Milestone 4 is done when:**
  - task 5 is within budget
  - the query test passes
  - the golden gate passes with marks and `precision.yaml`
  - no §2.3 item #1–#9 is left (each fixed, with its regression case passing)
  - the size test passes
  - the Tab One bars of §8.3 hold, or a measured miss is written up as a proposal in `docs/decisions.md`

## 8a. Review and merge
Every review and merge is a pipeline run (rules section 4; CLAUDE.md): the audit by sofia on `git diff -U5 phase-1...<branch>` plus the block's "Done when" lines, then `git merge --no-ff --signoff` into `phase-1`. A finished branch from before the pipeline is merged with `scripts/pipeline.sh <agent> "<ID>" --no-worker` (A10). The Opus pass (section 0c) applies the reports' shared-file text, deletes merged package files and their rows from section 0's table, and files proposals under "Needs the user". When a merge completes milestone 4, the Opus pass writes `docs/shifts/<date>-m4-report.md` and adds milestone 4 to docs/02 section 12. Never push.
