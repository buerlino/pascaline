<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Shift brief: milestone 4a "feel" and milestone 4 "Find and trust", with milestone 5's engine work beside them (run by the owner)

**Night shifts:** henri runs the queue in section 0c; for a night shift 0c wins over everything below and over rules sections 4, 10 and 11. **Manual mode (user, 2026-10-12)** otherwise: there is no coordinator. The owner starts each work package as its own session and, when it is done, a short review session that checks and merges it (section 8a). The standing rules in [rules.md](rules.md) still apply (sections 1, 3, 5, 6, 9). Where they say "Henri" or "message", read this brief instead; where the two differ, this brief wins.

## 0. State at start
`phase-1` on 2026-10-14. Merged: milestone 4 packages G0–G6 (with G5f1), R1–R3, R19, R20, A1–A3; milestone 4a packages R5, A5, R6, S1, S2, R7–R10, R13, R14, R15a, R16, R17, R18 (with R18f1 and R18f2) and F8. The night shift of 2026-10-14 ended after R20 (owner); the owner's verification of 2026-10-14 (`ef857a6`) took the place of its second Opus pass and its report. S2's menu rules (decisions.md "S2: one menu system") are written into the package texts below. No package waits for an APK to be tried (owner, 2026-10-13): a package starts when the one before it is merged. The text of finished packages is in git history. Left for the owner: the unmerged `p1/ron-eve-gestures` (the old flick classifier; backlog C7).

### The path (owner, 2026-10-14; decisions.md "The package path")
Three lanes run side by side. Each table below gives a package's prerequisites; this is the order.
- **ron, one package at a time** (the owner's day work; each ends with an APK on the phone):
  1. R22, R23 (the entry bugs F9 and F10).
  2. The entry-bug packages: R25a, R25b, R25c, R26a–R26h, then R27b. R27a comes when G2 item 48 is answered.
  3. R21a (pick sheets over the keypad), R21b (the Settings page and Android back).
  4. R11 (history-row actions), while annabell's device run A4a takes place.
  5. R15b (the top cluster, after A4a's report).
  6. R12a (mockups). While the owner looks at them: R4a (Find on Math), then R4b (Vars, Memory, the user keys).
  7. R12b (tokens and history rows), R12c (theme, press feedback, reduced motion).
  
  The unit-pad packages of 0d (R24a–R24d) and R28 (0e) go in when their prerequisites are merged.
- **gorge, beside ron** (no UI; the night queue of 0c): G10, G11, G12, G13, G14 (section 0e). G7 comes when S5 is merged (0d).
- **annabell:** A4a when the owner connects the Tab One, after R21b and before R15b. A4b after R4b, which completes milestone 4.
- **sandra:** S5 now; S4 on the owner's go (0d).

**Why this order:**
- R11 uses no key that R15b moves, so it fills the wait for the device run.
- R4a fills the wait for the owner's pick of the mockups, and R12b's token pass then covers Find too.
- gorge's packages have no UI, and R24c needs milestone 5 items 1 and 2.
- Big packages are split where they split cleanly (the owner's rule for the unit pad: about a day or less). R15b and R4a stay whole, since each half would leave the keypad or Find half built.

## 0c. Night shifts: henri's plan (owner, 2026-10-14)
The owner plans each night in advance, and the queue below is the next night's. henri (Sonnet, medium) **executes it and decides nothing**: he spawns one fresh agent per step with the prompts below, waits, logs, and spawns the next. After each Opus pass he hands over to a fresh henri (rule 11), so no henri carries a long context. **Low usage comes first:** the aim is to make the 5-hour window last, not to fill it. Whatever is not done stays in the queue for the next night. The night queue is the gorge lane (section 0e): engine packages with no UI, no APK and no device, checked by their golden and unit tests. The ron lane runs by day, when the owner can try each APK.

### Rules for a night shift (they replace rules sections 4, 10 and 11, but not 4a, and change section 8a)
1. **One agent at a time.** Never two workers, or a worker and a reviewer, at once.
2. **A fresh agent for every step:** each package, each review, each fix round and each Opus pass is a new spawn. Never SendMessage to give an agent a second task. Prompts are the templates below with the blanks filled in, nothing more (the agents read the brief themselves).
3. **Spawn in the foreground** (`run_in_background: false`): the call returns when the agent is done (rules section 4a: if a call still comes back as a background launch, log it and wait for its notification, never end the session). This is needed because henri_2 and later run headless, and a headless session ends with its turn. Do not poll, sleep, read diffs, run tests or builds, or read files beyond this brief and `.coord/log.md`.
4. **No APKs, no devices:** skip section 8a step 5a and its feedback.md line. Nobody runs `adb` or `build.sh`. annabell is not used at night.
5. **Models:** workers run Sonnet, effort medium (the model in the queue table wins if it says otherwise). Reviews run Sonnet, effort medium (section 8a says Opus; at night Sonnet). Opus passes run Opus, effort medium.
6. **henri decides nothing.** A question, a blocked worker, a conflict or anything this section does not settle: log it and hand it to the next Opus pass (run that pass at once if the question blocks the queue). **Follow every Opus-pass recommendation as written.** Plan changes go to the owner through `docs/decisions.md` "Needs the user", written by the Opus pass.
7. **Start-up:** `date`; `git switch phase-1 && git status` (must be clean; if not, stop and log); `tools/devlock.sh status`. henri_1 appends a section "<date> night" to `.coord/log.md`; a later henri logs `START henri_<n>` under it and reads the log from the last HANDOVER on. No roll call, no device watcher.
8. **Log:** one line per step in `.coord/log.md`: the time from `date +%H:%M` (never estimated), step, agent and model, outcome, commit. The log is the queue state: on a resume, read it and continue from the first step not done.
9. **Usage limit:** if a spawn fails or you hit a limit, log the time, the queue position and `STOPPED henri_<n>`, and end without starting a next henri. No retry loops. The owner resumes with `tools/henri-next.sh <n+1>` (or interactively: `claude --agent henri "Resume the night shift from .coord/log.md."`).
10. **Worker gone without a report** (no report commit): spawn one fresh worker with the same prompt (it continues from the branch's last commit). If that one also fails, log it, leave the branch, and go on with the next package.
11. **A fresh henri after every Opus pass** (owner, 2026-10-14). The owner's interactive session is henri_1. Once an Opus pass has replied, log its reply in full (its FIX lines and QUEUE are the next henri's orders), then log `HANDOVER henri_<n> → henri_<n+1>; next: <step>`, run `tools/henri-next.sh <n+1>` (it takes the next free number if that one was used, and starts a detached headless session that reads this brief and the log; output in `.coord/henri_<n+1>.out`), and end your turn. Do nothing more after that, even if woken: the new henri owns the queue. Your number n is in your prompt (henri_1 if none). The final pass (step 7) hands over the same way; that henri does its FIX packages and the report.

### The queue (the next night: the gorge lane of section 0e)
Estimates are wall-clock guesses. Each package is: worker, then review; a "fix" verdict adds a fix round (fresh worker, then a fresh review), at most two rounds; after the second "NOT MERGED" leave the branch unmerged, log it, go on. **Opus pass:** after every three finished packages (merged or left unmerged; fix packages from a pass count), and step 7 at the end of the queue. Step 7 is the last pass: the FIX packages it orders get only their Sonnet review, then the report. A package already merged by day is skipped (log it).

| Step | What | Agent, model | Branch | Est. |
|---|---|---|---|---|
| 1 | G10 qalc glue: the result JSON (section 7) | gorge, Sonnet | `p1/gorge-m5-glue` | 1 h + review |
| 2 | G11 the `UnitEngine` worker and client (section 7) | gorge, Sonnet | `p1/gorge-m5-worker` | 1.5 h + review |
| 3 | G12 the units checks and `units.yaml` (section 7) | gorge, Sonnet | `p1/gorge-m5-adapter` | 1.5 h + review |
| 4 | **Opus pass 1** on steps 1–3, then its FIX packages | Opus | — | 20 min + fixes |
| 5 | G13 the hp patch and the data audit (section 7) | gorge, Sonnet | `p1/gorge-m5-qalcdata` | 1 h + review |
| 6 | G14 exact results marked ≈ (section 7) | gorge, Sonnet | `p1/gorge-m4-marks` | 45 min + review |
| 7 | **Opus pass 2** (the last) on what came after pass 1, then its FIX packages | Opus | — | 20 min + fixes |
| 8 | Shift report, then stop (the henri started after step 7) | henri_n | — | 10 min |

Not at night: the ron lane (by day, with the owner's APK checks), devices (A4a, A4b), S5, and G7 (it waits for S5).

### Prompt templates (Agent tool; `run_in_background: false`; `effort: "medium"`)
**Worker** (`subagent_type` = the agent in the table, `model` = its model):
> Do package `<ID>` in docs/shifts/brief.md section 7, under the night-shift rules of section 0c. You already run in your own worktree: skip the `git worktree add` step of section 2 and run `git switch -c <branch> phase-1` there (or `git switch <branch>` if the branch exists, and continue from its last commit). End with the report commit of section 2, then reply in at most five lines: branch, last commit, done or not done.

**Review** (`subagent_type: "general-purpose"`, `model: "sonnet"`):
> Review and merge package `<ID>` (branch `<branch>`): follow section 8a of docs/shifts/brief.md with the night changes of section 0c (skip step 5a; for a docs-only package such as R15a, skip the test runs). Reply in at most ten lines: `MERGED <merge commit>`, or `NOT MERGED` with the findings (at most five, each with file:line and the fix), plus any item you put under "Needs the user".

**Fix round** (same agent and model as the package):
> Fix the review findings for package `<ID>` on branch `<branch>` (docs/shifts/brief.md section 0c rules; you already run in your own worktree: `git switch <branch>` there): `<the findings, verbatim>`. End with a report commit, then reply in at most five lines.

**Opus pass** (`subagent_type: "general-purpose"`, `model: "opus"`):
> Opus pass `<n>` of the night shift: follow "Opus pass" in docs/shifts/brief.md section 0c for packages `<IDs with their merge commits or unmerged branches>`. Open questions from the log: `<lines, or none>`.

### Opus pass (instructions for the Opus agent)
You are the shift's quality gate and its decision-maker; henri executes your reply literally. Work in the main checkout on `phase-1`; no code changes.
1. For each package: its text in section 7, its report (`git log -1 <merge>^2`, or the branch tip if unmerged), its diff (`git diff <merge>^1 <merge>`), and the Sonnet review's verdict from `.coord/log.md`.
2. Run once on `phase-1` (from `app/`, with absolute `GIAC_OUT`): typecheck, `npm run index` then `FIND_INDEX=required npm test`, e2e, and the golden gate when engine or parser code changed. Take `tools/devlock.sh acquire host-cpu opus 1800` around them.
3. Check what a Sonnet review tends to miss: wrong or invented expected values (sources), a missing round trip, silent wrong numbers or marks (principle 3), scope, keys that moved, tests that pass for the wrong reason.
4. Decide each "Needs a decision" item of these packages and each open question from the log: a default within the plan goes into `docs/decisions.md` (rules section 9); a plan change goes under "Needs the user" with your recommendation in one sentence. Commit those doc changes on `phase-1` with `git commit -s` and the Opus trailer.
5. Reply in exactly this form (one FIX line per needed fix package; fix IDs are `<ID>f1`, `<ID>f2`):
```
OPUS PASS <n>
VERDICT: <ID> ok | <ID> fix — <one line each>
FIX <ID>f1: agent <ron|gorge>, model <sonnet|opus>, branch <new branch from phase-1>, prompt: <one paragraph with file:line and the fix>
QUEUE: unchanged | <the remaining steps in a new order, or steps to drop>
NOTES: <at most three lines for the shift report>
```
henri runs each FIX as a package (the Worker template with "Do package …" replaced by the FIX prompt and `<branch>` by the FIX branch, then a review), then continues with QUEUE.

### Shift report (step 8, the last henri)
`docs/shifts/<date>-night-report.md`, short and plain, from the log and the agents' replies (log `SHIFT DONE` at the end; start no further henri): what was merged (with commits); what is unmerged and why; the Opus passes' NOTES; what the owner must do (items under "Needs the user"); the queue left for the next night. Commit it on `phase-1` with `git commit -s` and the Sonnet trailer. Never push.

## 0b. Milestone 4a packages (P11, signed off by the owner 2026-10-13): **do these first**
Goal: the owner's feedback of 2026-10-13 ([feedback.md](../feedback.md)) and the UI plan ([05-ui-plan.md](../05-ui-plan.md); its **section 7 wins** where it differs). Backlog "Milestone 4a" is binding. The m4 packages of 0a (R4a, R4b, A4b) run between R12a and R12b (section 0, "The path"); A4a is in this table because R15b waits for it.

| # | Package | Agent, model | Branch | Start when merged | Size |
|---|---|---|---|---|---|
| R22 | Bug F9: the system keyboard on return, again | ron, Sonnet | `p1/ron-m4a-refocus` | now | ~0.5 d |
| R23 | Bug F10: ⌫ stuck at a bracket | ron, **Opus** | `p1/ron-m4a-bksp` | R22 (same file); G2 item 44 answered, or start on the default | ~1 d |
| R25a | Bugs F11, F12: gestures end when the app goes away | ron, Sonnet | `p1/ron-m4a-awaygest` | R22 | ~0.5 d |
| R25b | Bug F14: ⌫ held with a mouse | ron, Sonnet | `p1/ron-m4a-mouserepeat` | R25a (same file) | ~0.25 d |
| R25c | Bug F13: no focus while the app is away | ron, Sonnet | `p1/ron-m4a-focusguard` | R22 (same test file) | ~0.25 d |
| R26a | The ⌫ grid test over every template (F10, F15–F21) | ron, Sonnet | `p1/ron-m4a-bkspgrid` | R23 | ~0.5 d |
| R26b | Bug F16: the hardware Backspace and Delete | ron, Sonnet | `p1/ron-m4a-hwdelete` | R23 | ~0.25 d |
| R26c | Bug F15: ⌫ right after a closing bracket | ron, **Opus** | `p1/ron-m4a-bkspclose` | R26a, R26b; G2 item 46 answered, or start on the default | ~0.5 d |
| R26d | Bug F17: powers and exponents | ron, **Opus** | `p1/ron-m4a-bksppow` | R26c (same file); G2 item 47 | ~0.5–1 d |
| R26e | Bug F18: fractions and roots | ron, **Opus** | `p1/ron-m4a-bkspfrac` | R26d; G2 item 47 | ~0.5 d |
| R26f | Bug F19: lim, Σ, Π, ∫ | ron, **Opus** | `p1/ron-m4a-bksplimits` | R26e | ~0.5 d |
| R26g | Bug F20: matrices, vectors, piecewise | ron, **Opus** | `p1/ron-m4a-bksparray` | R26f; G2 item 51 | ~0.5 d |
| R26h | Bug F21: log base, EQ, DMS, evaluate-at bounds | ron, **Opus** | `p1/ron-m4a-bkspmarks` | R26g; G2 item 49 | ~0.5 d |
| R27a | Bug F22: 10ˣ after a digit joins the number | ron, **Opus** | `p1/ron-m4a-tenpow` | G2 item 48 answered and the owner's pick of the fix | ~0.5 d |
| R27b | Bug F23: cursor stops where no box is | ron, **Opus** | `p1/ron-m4a-cursorstops` | R26h (same file); G2 item 50 | ~0.5–1 d |
| R21a | Pick sheets over the keypad, and fit | ron, **Opus** | `p1/ron-m4a-fit` | R27b (the entry-bug packages; R27a may come later) | ~1.5 d |
| R21b | The Settings page, and Android back | ron, Sonnet | `p1/ron-m4a-settings` | R21a | ~0.75 d |
| A4a | Device run before R15b | annabell, Sonnet | `p1/annabell-m4a-device` | R21b; the owner connects the Tab One (and the S8+) | ~0.5 d |
| R11 | History-row actions, Home and CAS (U3) | ron, Sonnet | `p1/ron-m4a-rows` | R21b (runs while A4a takes place) | ~1 d |
| R15b | Top cluster: implementation | ron, **Opus** | `p1/ron-m4a-top` (same) | R11, and A4a's report says R15b may start | ~2 d |
| R12a | Visual pass: mockups for the owner | ron, Sonnet | `p1/ron-m4a-look` | R15b (it draws the final keypad) | ~0.5 d |
| R12b | Visual pass: tokens and history rows (U5, U7) | ron, Sonnet | `p1/ron-m4a-look` (same) | R12a approved by the owner, and R4b (so Find is in the pass) | ~1.5 d |
| R12c | Visual pass: theme, press feedback, reduced motion | ron, Sonnet | `p1/ron-m4a-theme` | R12b | ~1 d |

**No waiting for a tried APK** (owner, 2026-10-13): each ron package still ends with an APK on the owner's phone (section 8a step 5a), but the next package starts as soon as the review has merged it; the owner's notes come back through feedback.md as feel items. Only the two mockup steps (R15a, R12a) wait, for the owner's pick. **Why these models:** Opus where a mistake breaks entry for every later package: R7 (the sheet every list is built on), R9 (a gesture classifier that misfires corrupts typing), R10, R14 and R18 (parser rules and round trips), R15b (moves keys that every test names), R21a (the layer every pick sheet and the unit pad are drawn on), R26c–R27b (the ⌫ and cursor paths run on every key press; a wrong step deletes or moves what the user typed). Sonnet elsewhere, with an Opus review per package; R25a–R26b are small and pinned by their tests, and R21b, R11 and R12a–R12c follow existing patterns.

## 0a. Work packages (milestone 4), between R12a and R12b
Goal: milestone 4 of P8, built to [04-architecture.md](../04-architecture.md). The task text in `docs/backlog.md` "Engineer core, milestone 4" is binding. Each package names its backlog step; § numbers point into docs/04. R4 is split in two and A4 in two (A4a is in 0b); where 0d says "R4 merged", read R4a and R4b.

| # | Package | Backlog step | Agent, model | Branch | Start when merged | Size |
|---|---|---|---|---|---|---|
| R4a | Find on Math (EN1, part 1) | 8 | ron, Sonnet | `p1/ron-m4-find` | R12a done (the owner looks at the mockups meanwhile); R21b | ~2 d |
| R4b | Vars, Memory and the user keys from Find (EN1, part 2) | 8 | ron, Sonnet | `p1/ron-m4-vars` | R4a and R15b | ~1 d |
| A4b | Find timing on the Tab One | 12 | annabell, Sonnet | `p1/annabell-m4-find` | R4b; Tab One connected | ~0.25 d |

If the owner wants Find sooner, R4a can go right after R21b: it uses no key that R15b moves.

### How to start a package
From the main checkout (`/home/nordmu/Documents/source99/pascaline`), one terminal per package:

```bash
claude --agent <ron|gorge|annabell> --model <sonnet|opus> "Do package <ID> in docs/shifts/brief.md."
```

Check `/model` once at the start: the agent files pin `model: opus`, and the flag should override it. A package that runs out of usage can be resumed (`claude --continue` in the same terminal) or restarted with the same command: the agent finds its branch and continues from its last commit.

## 0e. The gorge lane: milestone 5's engine work, beside the ron lane (owner, 2026-10-14)
Backlog milestone 5 items 1–3, and C9, with no UI: a worker, a check layer, data and marks. They run now, beside the ron lane and as the night queue (0c), because R24c needs items 1 and 2. P11's reason for doing milestone 4a first (Find and the unit view sit on the keypad and the screen) does not touch them. Where 0d says "milestone 5 items 1–2 (U1, U2) merged", read G10, G11, G12 and R28. New gorge ids start at G10, because G8 and G9 are ids in the backlog's G2 follow-ups.

| # | Package | Backlog | Agent, model | Branch | Start when merged | Size |
|---|---|---|---|---|---|---|
| G10 | qalc glue: the result JSON | m5 item 1 | gorge, Sonnet | `p1/gorge-m5-glue` | now | ~0.75 d |
| G11 | The `UnitEngine` worker and client | m5 item 1 | gorge, Sonnet | `p1/gorge-m5-worker` | G10 | ~1 d |
| G12 | The units checks, marks and `units.yaml` | m5 item 2 (gorge half) | gorge, Sonnet | `p1/gorge-m5-adapter` | G11 | ~1 d |
| G13 | The hp patch and the data audit | m5 item 3 | gorge, Sonnet | `p1/gorge-m5-qalcdata` | G12 | ~1 d |
| G14 | Exact results marked ≈ | C9 | gorge, Sonnet | `p1/gorge-m4-marks` | now (any time; Home only) | ~0.5 d |
| R28 | Units mode in the parser | m5 item 2 (ron half) | ron, **Opus** | `p1/ron-m5-unitparse` | R24a and G12; before R24c | ~1 d |

**Why these models:** G10–G14 follow existing patterns (the Giac worker, the golden gate, the Find checks), and their golden and unit tests pin them; each gets an Opus pass at night. R28 adds parser rules with round trips (Opus, as R14 and R18).

## 0d. Packages from the owner's discussion of 2026-10-14 (the Alpha keys, Find, the unit pad, the laptop connection)
Each waits for what its row says; none changes the 0b packages or their order. Background: [feedback.md](../feedback.md) #40–#44, decisions.md "The letters stay" and P14 (decided 2026-10-14), [research/r9-unit-pad.md](../research/r9-unit-pad.md), backlog "Parked ideas" (the laptop connection).

**The unit pad is built in small packages** (owner, 2026-10-14: a session should not run out of tokens): one concern each, about a day or less, with its own short reading list. Read only what your package names. In order: S5 finds the arrangement; G7 puts every id in Find; R24a to R24d build the entry. R24a needs no UI and can start as soon as G7 is merged.

| # | Package | Agent, model | Branch | Start when | Size |
|---|---|---|---|---|---|
| S5 | The unit pad's arrangement and its user cells (research) | sandra, Opus | `p1/sandra-padlayout` | now | ~1 d |
| G7 | Find data for the unit pad and the units menu | gorge, Sonnet | `p1/gorge-m5-finddata` | S5 merged (its test reads the final arrangement); no UI, so it can run beside a ron package | ~0.5 d |
| R24a | The slot model (no UI) | ron, **Opus** | `p1/ron-m5-unitslot` | G7 merged | ~0.5 d |
| R24b | The pad drawn over the keys | ron, Sonnet | `p1/ron-m5-unitpad` | the owner accepted S5's arrangement; R21 merged | ~1 d |
| R24c | The unit view entry: slots, Enter, evaluation | ron, **Opus** | `p1/ron-m5-unitview` | R24a, R24b and milestone 5 items 1–2 (U1, U2) merged | ~1 d |
| R24d | Find in a slot and the user cells | ron, Sonnet | `p1/ron-m5-usercells` | R24c, R4 and R15b merged | ~0.5 d |
| S4 | The laptop connection: design note | sandra, Opus | `p1/sandra-connector` | the owner's go (parked until about 2026-10-20) | ~0.5 d |

**Why these models:** R24a builds the slot model the parser reads and R24c ties pad, slots and evaluation together, so a mistake there corrupts unit entry everywhere (Opus, as R9 and R18). R24b draws on R21's layer and R24d stores cells as R15b stores the user keys; each follows an existing pattern and its tests pin it (Sonnet). G7 is data and one test (Sonnet). S4 and S5 are research with probes (sandra runs Opus).

**Not packaged yet:** the rest of backlog milestone 5 item 4, the result view (value, mark, unit, dimension, one-tap alternatives, `units.targets`, the `\res` chip back to Home). It gets its packages when U1 and U2 are merged, since their reports fix what a result carries.

## 2. Read before you start (every package)
Read only the sections named here and in your package, not whole files: find them with `grep -n '^#' <file>`, then read that range. Every file you read is sent again on every later turn.
- **Your first step:** make your own worktree from `phase-1`, never switch branches in the main checkout (other packages run there at the same time):
  ```bash
  cd /home/nordmu/Documents/source99/pascaline
  git worktree add .claude/worktrees/m4-<id> -b p1/<name>-m4-<pkg> phase-1   # or, when resuming: git worktree add .claude/worktrees/m4-<id> p1/<name>-m4-<pkg>
  cd .claude/worktrees/m4-<id>
  ```
  Then the shared paths and locks of rules section 5 (`GIAC_OUT`, `PASCALINE_DL_DIR`, `tools/devlock.sh` for heavy work).
- [04-architecture.md](../04-architecture.md) sections 0 and 8, and the sections your package names. Where docs/04 and docs/02 differ, docs/04 wins.
- `docs/backlog.md` "Engineer core", milestone 4: your step's text (files, tests, gate).
- **From 2026-10-13:** `docs/decisions.md` P11, docs/03 section 0 rules 5–13 (they bind every package: one interaction model, keys never move, vertical space, removal tests), `docs/05-ui-plan.md` with its section 7, and `docs/feedback.md`.
- `docs/decisions.md`: P8, P9, P10 and the defaults entry "2026-10-12 Architecture for the engineer core". These are decided; don't reopen them. If a docs/04 decision turns out wrong in the code, don't change it silently: finish what you can, and put the evidence under "Needs a decision" in your report.
- Not in milestone 4: the unit view (milestone 5: its engine work is section 0e, its entry section 0d), matrices, bases and everyday functions (milestone 6), Help = context help (milestone 6), prefix entry chips (gated by task 3).
- **No coordinator to message.** Stay inside the files your package names. Shared files (`CLAUDE.md`, `docs/*`, `THIRD_PARTY.md`, `.claude/agents/*`) are not yours. Put the text for them in your report, and the review session applies it. Devices are only for A4a and A4b.

### Your report (every package)
End with a commit whose message body is the report. The review session reads it with `git log -1`. It holds:
- **Done:** what was built, item by item against the backlog step.
- **Tests:** typecheck, vitest, e2e and golden counts as run.
- **Numbers:** for example the start chunk size before and after, or timings.
- **For shared files:** exact text for the backlog, decisions, THIRD_PARTY.md, docs/04.
- **Needs a decision:** anything left open.
- **Not done:** what's missing.

Then end your turn.

## 7. Packages

### ron, R4a: Find on Math, branch `p1/ron-m4-find`
Backlog step 8, its Find part. Starts when R12a is done and R21b is merged.
- **Key:** Math = Find (§5.1).
- **Inside Find:** keys follow §3.7, ranking §3.5 (`app/src/find/rank.ts`), preview and insertion §3.6.
- **Where:** Find takes letters (inside Find every key types its letter), so it is a letter list in R21's sense: it stays above the keypad, where the sheets were before R21a, and is not drawn over the keypad (decisions.md "R21"). It is built on the sheet (docs/05 3.1, 3.6 and section 7). Letters: a tap on a non-digit key, a flick down on any key. Esc and Android back close it (R21b's helper).
- **Content:** the index items; `?bench=find`. No usage ranking and no `find.usage` (P11). An empty query shows the G2-style Math menu (fixed categories in a fixed order), numbered: on an empty query digits pick a category, after a letter they type (S2 rule M1).
- **Loading:** Find is a lazy chunk, and the index is fetched only when the browser is idle after the engine is ready.
- **Data:** the generated index (G4, merged): `prepare()` and `search()` in `app/src/find/rank.ts`. The schema is fixed by §3.3; a change goes under "Needs a decision".

Gate:
- task 5 active and within budget
- ranking unit tests
- the query test
- the size test
- no index request before idle

### ron, R4b: Vars, Memory and the user keys from Find, branch `p1/ron-m4-vars`
Backlog step 8, the rest. Starts when R4a and R15b are merged. Read R4a's report, docs/04 3.4 and 5.1, R15b's user-key code and its storage key in `state/storage.ts`.
- **Vars** = Find on the user's variables and functions: the live items from `defined` (§3.4), with R4a's keys, preview and insertion.
- **Shift + Math = Memory:** the same list with delete and clear all (§5.1).
- **User keys:** Settings › User keys (the place R21b left) sets U1–U3 and their Shift layers from Find, in R15b's stamped store. Reset gives back the defaults of `spec/keyboard.yaml` (U2 = Home, U3 = CAS). R15b's text promised this setting "with R4".

Gate: e2e per path by keys and by touch (Vars, Memory delete and clear all, a user key set from Find and pressed again after a reload); task 5 unchanged; the size test.

### annabell, A4b: Find timing on the Tab One, branch `p1/annabell-m4-find`
Backlog step 12, its Find part. Starts when R4b is merged and the Tab One is connected (rules section 6). Find per key (`?bench=find`, §3.2) against the §8.3 bar; a miss goes under "Needs a decision" with the number (docs/04 says what changes: incremental Find). Leave an APK built from `phase-1` on the Tab One for the owner. Then the report says whether milestone 4's gate (section 8) is complete.

### Milestone 4a packages (section 0b)

### ron, R22: the system keyboard on return, again (bug F9), branch `p1/ron-m4a-refocus`
Backlog F9 (cause and proof there; decisions.md "Focus on return"). Read `app/src/main.ts` (`dropFocus`), `EntryController.create()` in `app/src/entry/controller.ts`, `app/test/softkeyboard.spec.ts`, and r6-pipelines section 7. Commits in this order:
1. **Test first** (`app/test/softkeyboard.spec.ts`, failing on today's code): extend `leaveAndReturn` with the two event orders (window `blur` then hidden, and hidden then `blur`), then three away-and-back cycles in a row. After each return, wait 150 ms (MathLive focuses 60 ms late) and check that nothing editable is focused. Run it twice: after a tap on a digit, and after a trackpad drag (`drag(page, "left", -30, 0)`). Add a third case with window `blur` and `focus` only, no hide, three times. That is the notification shade, the share sheet or a permission prompt (feedback #45). Today the second cycle focuses the keyboard sink (Playwright, 2026-10-14). Then a digit key still types.
2. **Fix:** `Field.restoreFocusWhenDocumentFocused = false` in `create()`, beside `fontsDirectory` and the other statics, with a one-line comment that names K0/F9. Keep `dropFocus`.
3. **What the restore did for us on a desktop** cannot be checked by an agent, since synthetic window events do not move the real focus. It is the owner's check after the merge; write it into the report: `npm run dev` in desktop Firefox, type on the line, switch windows (Alt+Tab) and back, type on the hardware keyboard. The browser should restore the focus by itself. If the keys no longer reach the line, the fix is `entry.focus()` on window `focus`, on `pointer: fine` only (a follow-up, not part of R22).
4. **Report.** The owner checks the APK by hand: drag on the arrow keys, switch away and back three times, fast. Then the same after plain taps, and pull the notification shade down and up twice. Shared-file text: backlog F9 "Done", the decisions entry if the build differs.
Gate: softkeyboard e2e green (it fails without the fix), gestures and flicks e2e green, start chunk unchanged.

### ron, R23: ⌫ stuck at a bracket (bug F10), branch `p1/ron-m4a-bksp`
Backlog F10 (cause and the stuck cases there); the rule is decisions.md "⌫ at a bracket" (binding unless G2 item 44 says otherwise; if the owner has answered it, the G2 way wins, unless it leaves a half pair). Read `app/src/entry/controller.ts` (`run`, `selectCompound`: how to find the atom a cursor sits in from offsets and depths), the `bksp` key in `spec/keyboard.yaml`, every `\left` template in `spec/keyboard.yaml` (function keys, `paren`, abs, lists, the Tmpl cells, the evaluate-at bar `\left. … \right|_{…}`), and r6-pipelines section 7. Commits in this order:
1. **Tests first** (`app/test/bksp.spec.ts`, failing on today's code), by keys, the line read after each ⌫:
   - log log, then ⌫ until the line is empty: `\log\left(\placeholder{}\right)` after one ⌫, the empty line after two. The same for sin, ln, √ (as a control), and the Tmpl log base.
   - log 2 ⌫ ⌫ → the empty line; `( )` 2 ⌫ ⌫ → the empty line.
   - sin 2 3 ◀ ◀ ⌫ → `23`, cursor before the 2; 5 `( )` 2 ◀ ⌫ → `52`; abs with content, the same.
   - Shift + ⌫ (Del) right before a closing bracket: the mirror cases.
   - No line the keys can build ever holds `\left.` with a real `\right)` (or the reverse) after a ⌫, except the evaluate-at template, which owns its `\left.`.
   - ⌫ still removes one character, one chip (`captureSelection`) and one ᴇ as today (the R14 and R16 cases stay green), and Shift + Cancel (undo) brings the deleted template back whole.
2. **Fix** in `EntryController.run`: before MathLive's `deleteBackward` (and `deleteForward`), when the cursor is at the start (end) of a pair's body, select the template (the name before the pair when the same key inserted it: `\log`, `\sin`, `\ln`, `\operatorname{…}`, a `\log_{…}` with its base; else the pair alone) and replace it with the body's LaTeX, leaving the cursor where the opening bracket was. An empty function body becomes nothing; then, as for log log, the outer body gets its placeholder back. Public MathLive API only (`getElementInfo`, offsets, `selection`, `insert`); no patch to MathLive. Put the ⌫/Del logic in a new plain-TS module `app/src/entry/delete.ts`, called from `run`: R26b–R26h extend it for every other template (decisions.md "⌫ and Del keep a template whole"). If the pair is the evaluate-at bar, the whole template follows the same rule (body kept, bounds dropped); say in the report if that feels wrong.
3. **Parser message** (`app/src/input/parse.ts`): a `\left.` closed by anything but the bar says "unmatched bracket", not "expected the evaluate-at bar". Its parser case (an error case, `derived`) goes in the same commit.
4. **Report** with the G2 item 44 answer, if the owner gave one. Not in R23: the hardware Backspace (R26b), ⌫ right after a closing bracket (R26c), the other templates (R26d–R26h). Shared-file text: backlog F10 "Done", the decisions entry if the build differs, r6 section 7 if MathLive behaved otherwise.
Gate: `bksp.spec.ts` green (it fails without the fix), `selection.spec.ts`, `undo.spec.ts`, `entry.spec.ts`, `chips.spec.ts`, `tmpl.spec.ts`, gestures e2e green; vitest and the golden gate (parser changed); start chunk within 0.5 kB gzip.

### The entry-bug packages R25a–R27b (bugs F11–F23, found by probing 2026-10-14)
These are small packages, one concern each, each with its own short reading list. Read only what your package names.
- Backlog milestone 4a items 21–33 have the summary.
- The rules are in decisions.md "⌫ and Del keep a template whole" and "Nothing takes focus while the app is away".
- r6-pipelines section 7 explains how MathLive behaves and how to probe it.
- Every "behaviour today" below was reproduced in Playwright (Pixel 7 profile, `?engine=fake`, 2026-10-14). ‸ is the cursor.
- The key names are the ids of `spec/keyboard.yaml`, and a Tmpl cell is driven by `window.pascaline.entry.run({ kind: "insert", latex })`.
- **Tests first** in every package: the new test fails on today's code. Then the fix, then the report commit (section 2).
- A G2 item that is answered before the package starts wins over the default, unless it breaks point 1 of "⌫ and Del keep a template whole".

### ron, R25a: gestures end when the app goes away (bugs F11, F12), branch `p1/ron-m4a-awaygest`
Read: `app/src/keyboard/Keypad.svelte` (the gesture code, lines 81–236), `app/src/keyboard/gestures.ts` (`Repeat`), `app/test/helpers.ts` (`touch`), `app/test/gestures.spec.ts`, decisions.md "Nothing takes focus while the app is away" point 1.

**Behaviour today:**
- **F11:**
  1. Type `1`…`9`, then hold ⌫: `touch(page, "bksp")`, with no lift.
  2. Fire the window `blur`, then hide the page (`document.hidden` true, then `visibilitychange`).
  3. The auto-repeat keeps running: the line is `12345678` at the hide and empty 1 s later.
  4. Every repeat calls `run()`, which calls `mf.focus()`. The keyboard sink (`SPAN.ML__keyboard-sink`) is focused while away and still on return. On Android that opens the system keyboard (K0). Same result with MathLive's restore on or off, so R22 does not fix it.
- **F12:** `touch(page, "d7")` with no lift, hide and show the page, then tap 2. The line is `72`. The 7's gesture stayed in the `gestures` map, and the next `pointerdown` finishes it (`down()`, line 151, `finish(g)` fires its key). A trackpad touch left behind the same way fires its arrow on the next key.

**Reachable on a phone?** Only if Android sends no `pointercancel` for a touch that is down while the app leaves (a second finger on the nav button, or the home gesture). Not checked on a device. The fix is cheap either way, and it also covers a lost `pointerup`.

**Fix:**
- Add a `cancelAll()` in Keypad.svelte: it runs `cancel()` on every gesture, clears the map and hides the bubble.
- Call it on `visibilitychange` when hidden, on `pagehide`, and on window `blur` when `matchMedia("(pointer: coarse)")` matches.
- Add the listeners in the component's `$effect` and remove them on destroy.
- Nothing fires and ⌫ stops, as on `pointercancel`.

**Commits:**
1. **Tests** (`gestures.spec.ts`): F11 (the line is unchanged 1 s after the hide, and nothing editable is focused) and F12 (`2`, not `72`). The same two with window `blur` only, no hide. A trackpad touch interrupted by a hide fires no arrow on the next key.
2. **Fix.**
3. **Report.** The owner's APK check: hold ⌫ with one finger, press the home button with the other hand, then come back. The line is as it was, and no system keyboard shows.

Gate: gestures, flicks and softkeyboard e2e green; start chunk unchanged (±0.1 kB).

### ron, R25b: ⌫ held with a mouse (bug F14), branch `p1/ron-m4a-mouserepeat`
Read: `app/src/keyboard/Keypad.svelte` `down()` (lines 146–172) and `cancelled()`; `app/test/gestures.spec.ts`.

**Behaviour today** (desktop, mouse):
1. Type 12 digits.
2. `page.mouse.down()` on ⌫, wait 100 ms.
3. Move to y = 60 (over the history) and `mouse.up()`.
4. Result: 11 digits at the release, and the line is empty 0.8 s later. The repeat goes on until the next press on the keypad.

**Cause:** the ⌫ branch returns before `padEl?.setPointerCapture(ev.pointerId)` (line 163). A mouse has no implicit capture (a touch has), so the `pointerup` lands outside the pad and `up()` never runs.

**Fix:**
- Take the capture before the ⌫ branch: move the `try { setPointerCapture }` above it.
- Also stop the repeat on `lostpointercapture`.

**Commits:**
1. **Test** (`gestures.spec.ts`): the case above. The line keeps its 11 digits 0.8 s after the release.
2. **Fix.**
3. **Report.**

Gate: gestures e2e green; the touch ⌫ repeat tests unchanged.

### ron, R25c: no focus while the app is away (bug F13), branch `p1/ron-m4a-focusguard`
Read: `app/src/main.ts` (`dropFocus`, lines 36–51), `app/test/softkeyboard.spec.ts` (`leaveAndReturn`, `focused`), r6-pipelines section 7 ("Focus is late", "A focus cannot be taken back during its 60 ms"), decisions.md "Nothing takes focus while the app is away" point 3.

**Behaviour today:**
1. Type 1, leave and return (`leaveAndReturn`). The field is blurred.
2. In one `page.evaluate`: `entry.run({ kind: "type", text: "2" })`, then window `blur`, then the page hidden.
3. Right after the hide nothing is focused. 200 ms later the keyboard sink is, with MathLive's restore on or off.

**Cause:**
- `mf.focus()` on a blurred field focuses the sink 60 ms later, in a timer (`mathlive.mjs` 40266–40303).
- `dropFocus` runs before the timer and finds nothing to blur.
- Hard to hit by hand (a key less than 60 ms before leaving), but every later async focus takes the same road: an auto-repeat (F11), an insert after an `await` (paste, `clipboard/actions.svelte.ts` 104–114).

**Fix:**
- Add a capturing `focusin` listener on `document` in `main.ts`.
- When `document.hidden` is true, or on `pointer: coarse` while `!document.hasFocus()`, it calls `dropFocus()`.
- Check that a focus on the sink inside the shadow root reaches the listener (`focusin` is composed). If not, listen on the field's shadow root as well.
- If a blur inside the event does not hold, defer it with `queueMicrotask`.

**Commits:**
1. **Test** (`softkeyboard.spec.ts`): the case above; nothing editable is focused 200 ms after the hide.
2. **Fix.**
3. **Report.**

Gate: softkeyboard e2e green (fails without the fix); start chunk unchanged.

### ron, R26a: the ⌫ grid test over every template, branch `p1/ron-m4a-bkspgrid`
Test only, no app code. Read: `spec/keyboard.yaml` (every `insert:` that holds a template, including `templates:`), `app/test/helpers.ts`, R23's `app/test/bksp.spec.ts`, r6-pipelines section 7, decisions.md "⌫ and Del keep a template whole".

**Build** `app/test/bksp-grid.spec.ts`.
- **Templates:** every one the keys insert, read from keyboard.yaml so that a new key joins the grid by itself. There were 32 on 2026-10-14: the function keys, `( )`, `| |`, the power keys, eˣ, 10ˣ, √, ⁿ√, ÷, the one-line inserts, and every Tmpl cell.
- **How:** drive the entry through `window.pascaline.entry.run` (the same path as a key). Read the line after each step and parse it with `loadParser()` from `/src/input/parser.ts` in the page.
- **Scenarios** (each with at most 16 steps):
  - `empty`: the template on an empty line, then ⌫ until the line is empty.
  - `content`: 5, the template, 2, then ⌫ until the line is empty.
  - `fromEnd`: the same, with the cursor moved to the end first.
  - `boxStart`: 5, the template, 2 3, ◀ ◀ (the cursor at the start of the first box), then ⌫ until the line is empty.
  - `delFromStart`: 5, the template, 2, the cursor to the start, then Del until the line is empty.
  - `delBeforeClose`: the template, 2, then Del until the line is empty.
  - `nested`: the template twice, then ⌫ until the line is empty.
- **Checks after each step** (the rule's points):
  - No half pair outside evaluate-at (1).
  - No `^` or `_` at the start of a group or after an operator (1, 6).
  - No lost box or lone mark (2).
  - No ⌫ deleted something before the template while the cursor was in it (3).
  - No exponent moved to a new base (6).
- **Checks at the end:** the line is empty (8), and no step was a no-op except ⌫ at the line's start or Del at its end.
- **Known failures:** mark each failing case `test.fail()` with its bug id in the title (F10, F15–F21), so the suite is green and each later package flips its own cases.
- **The probe of 2026-10-14 found** (with F10, before R23):
  - In `empty`, 18 of 32 templates leave debris: EQ, one-line x⁻¹, xʸ, x², x⁻¹, ⁿ√, evaluate-at, piecewise, matrix, row, column, lim, ∫, mixed, Σ, Π, log base, DMS.
  - In `content`, 24 of 32 never reach the empty line: all ten bracket templates, plus ⁿ√, evaluate-at, ∂, piecewise, the three matrices, lim, ∫, mixed, Σ, Π, log base and DMS.

Gate: the grid green (with its `test.fail` marks) in under 60 s. The report lists the number of `test.fail` cases per bug id.

### ron, R26b: the hardware Backspace and Delete take our path (bug F16), branch `p1/ron-m4a-hwdelete`
Read: `app/src/entry/controller.ts` lines 109–131 (the capturing `keydown` listener for `^`) and `app/src/entry/delete.ts` (from R23).

**Behaviour today:** desktop, log log, then four presses of the hardware Backspace (`page.keyboard.press("Backspace")`). The line is stuck at `\log\left.\right)`, the bug R23 fixes for the on-screen ⌫.

**Cause:** a physical key goes straight to MathLive's own keydown handler. `EntryController.run` sees only the on-screen keys, and R23's fix and every R26 package live in `run`.

**Fix:**
- In the capturing `keydown` listener (controller.ts line 113), Backspace becomes `this.run({ kind: "cmd", name: "deleteBackward" })` and Delete becomes `deleteForward`, each with `preventDefault` and `stopPropagation`.
- A held key arrives as repeated keydowns and takes the same path.
- Ctrl + Backspace (delete a word): leave it to MathLive, or route it too, and say which in the report.

**Commits:**
1. **Tests** (`bksp.spec.ts`): log log by the hardware Backspace reaches the empty line; Delete before a closing bracket, the mirror.
2. **Fix.**
3. **Report.**

Gate: bksp, entry and undo e2e green.

### ron, R26c: ⌫ right after a closing bracket (bug F15), branch `p1/ron-m4a-bkspclose`
Read: `app/src/entry/delete.ts`, `app/test/bksp-grid.spec.ts`, decisions.md "⌫ and Del keep a template whole" point 5 (G2 item 46 may overrule it).

**Behaviour today:**
- `sin 2 ▶ ⌫` (the cursor after `)`, then ⌫) leaves `\sin\left(2\right.`: the `)` is gone, the cursor sits after the 2, and the line reads `sin(2`.
- No key types `)` back, so `sin 2 ▶ ⌫ ⌫ 3` gives `sin(3`, and Enter says "expected closing ) at '.'". That is an error, not a wrong number.
- Every pair does this: the function keys, `( )`, `| |` (`5|2|‸ ⌫` → `5|2`), the one-line √ and x⁻¹, and the brackets inside lim, Σ, Π and log base.
- From the end of the line, `5 sin 2` ⌫ ⌫ ⌫ … does reach the empty line, through `sin(2`, `sin(`, `sin`.

**Cause:** `onDelete` on a `\left…\right` pair from outside (`mathlive.mjs` 31712–31734, the branch that is not at the start). While the opening bracket is real, it sets the closing one to `.`.

**Fix (default):**
- ⌫ right after a pair, or after a function's pair (R23's name rule), moves the cursor to the end of the body and deletes nothing. ⌫ after a root or a fraction already does this.
- Del right before a function name or an opening bracket moves to the start of the body.
- Once the body is empty, the emptied box shows □ (point 2) and R23's rule removes the template on the next ⌫.

**Commits:**
1. **Tests:** flip the grid's F15 cases. By keys:
   - `sin 2 ▶ ⌫` → `\sin\left(2\right)`, with the cursor after the 2.
   - `sin 2 ▶ ⌫ ⌫` → `\sin\left(\placeholder{}\right)`.
   - One more ⌫ → the empty line.
   - Del mirrors each case.
2. **Fix.**
3. **Report** with the G2 item 46 answer.

Gate: bksp-grid (its F15 cases pass), bksp, selection, undo and tmpl e2e green.

### ron, R26d: powers and exponents (bug F17), branch `p1/ron-m4a-bksppow`
Templates: x² `#@^{2}`, xʸ `#@^{#?}`, x⁻¹ `#@^{-1}`, eˣ `\exponentialE^{#0}`, 10ˣ `10^{#0}`, the one-line x⁻¹ `\left(#@\right)^{-1}`. Read: `app/src/entry/delete.ts`, `app/src/entry/controller.ts` (`isPower`, `selectCompound`), the grid, decisions.md "⌫ and Del keep a template whole" points 3, 4 and 6.

**Behaviour today:**
- `2 + x² ⌫ ⌫` → `2^2`. The first ⌫ deletes the empty base □ and leaves `2+^2`; the second deletes the +, and the exponent lands on the 2. Enter computes 4.
- x² on an empty line with no history (`\placeholder{}^2`), then ⌫ → `^2`. After that ⌫ does nothing, because the cursor sits before an exponent with no base. xʸ and x⁻¹ behave the same.
- `5 xʸ 2 3 ◀ ◀ ⌫ ⌫` → `^{23}`. The first ⌫ at the start of the exponent moves the cursor out, just after the 5; the second deletes the 5 and leaves the exponent alone.
- `5 eˣ 2 3 ◀ ◀ ⌫ ⌫` → `5^{23}`. The second ⌫ deletes the e, and the exponent moves onto the 5: 5·e²³ became 5²³, computed without an error.
- `5 10ˣ 2 3 ◀ ◀ ⌫ ⌫` → `51^{23}`, then `5^{23}`, then `^{23}`. Each ⌫ deletes a digit of the base under the exponent.
- `10ˣ` on an empty line, ⌫ ⌫ ⌫ passes through `10` and `1`.

**Cause:**
- MathLive keeps an exponent as a branch of its base atom. A placeholder base is an atom that ⌫ deletes.
- The exponent then becomes a lone `subsup` atom that attaches to whatever stands before it (`mathlive.mjs` 31797–31861, `deleteBackward` 31872).

**Fix** (default points 3, 4 and 6; the details are for the package to settle and report):
- ⌫ at the start of an exponent steps to the end of the base, as ◀ does, and deletes nothing.
- A ⌫ that would empty a base carrying an exponent leaves □ as the base.
- ⌫ in an empty base:
  - removes the whole power when the exponent is the key's own (x², x⁻¹) or empty;
  - selects the power first when the exponent holds typed content.
- **Open:** whether 10ˣ's and eˣ's bases (10, e) count as the key's own and go with the exponent in one ⌫. Recommended: yes, so that `10ˣ ⌫` empties the line.

**Commits:**
1. **Tests:** flip the grid's F17 cases. By keys:
   - `2 + x² ⌫ ⌫` → `2`.
   - x² ⌫ with no history → the empty line.
   - `5 eˣ 2 3 ◀ ◀ ⌫ ⌫` never puts an exponent on the 5.
   - `5 xʸ 2 3 ◀ ◀ ⌫` leaves the cursor after the 5, and the line keeps `5^{23}`.
   - One more ⌫ gives `\placeholder{}^{23}`.
2. **Fix** in `delete.ts`.
3. **Report** with the G2 item 47 answer (second part).

Gate: bksp-grid F17 cases pass; selection (R17's power keys), entry and undo e2e; vitest.

### ron, R26e: fractions and roots (bug F18), branch `p1/ron-m4a-bkspfrac`
Templates: ÷ and a b/c (`\frac{#@}{#?}`), √ (`\sqrt{#0}`), ⁿ√ (`\sqrt[#?]{#0}`), the mixed number (`#@\tfrac{#?}{#?}`), ∂ (`\frac{\partial#0}{\partial#?}`). Read: `app/src/entry/delete.ts`, `controller.ts` (`selectCompound`, L8/L9), the grid, decisions.md "⌫ and Del keep a template whole" points 2–4.

**Behaviour today:**
- ⁿ√ on an empty line, ⌫ with the cursor in the empty index → `\sqrt{\placeholder{}}`, with the cursor before it. ⌫ then does nothing, and the n-th root template has become a square root.
- `\sqrt[3]{8}` with the cursor after the 3, ⌫ → the LaTeX is `\sqrt8`, so Enter computes √8. The emptied index disappears from the LaTeX; typing 4 at once gives `\sqrt[4]{8}` back.
- `5 ⁿ√ 2 3 ◀ ◀ ⌫` (the cursor at the start of the index) moves the cursor out. The next ⌫ deletes the 5, and `\sqrt[23]{□}` stays in front of the cursor for good.
- The mixed number on an empty line, ⌫ → `\tfrac{□}{□}` stays, with the cursor at 0. `5 mixed 2 3 ◀ ◀ ⌫ ⌫` → `\tfrac{23}{□}`: the whole part is deleted, and the line says "a mixed number needs a whole number before its fraction".
- `5 ∂ 2 3 ◀ ◀ ⌫` deletes the ∂ mark alone (`5\frac{23}{\partial□}`). The next ⌫ moves out of the fraction, the one after deletes the 5, and then ⌫ is stuck.
- ÷ twice on an empty line with no history (a nested fraction), then ⌫ → `\frac{}{\placeholder{}}`: an empty numerator without □, stuck.
- `5 ÷ 2 3 ◀ ◀ ⌫` (the start of the denominator) → `523`. This is MathLive's unwrap. It goes away under point 3, where ⌫ steps to the end of the numerator.
- `5 √ 2 3 ◀ ◀ ⌫` → `523`. This follows the accepted F10 rule (content kept, as `5(‸2)` gives `52`). Leave it as built.

**Cause:**
- `onDelete` for `surd` (`mathlive.mjs` 31737–31768): an emptied index branch is removed, and the cursor goes before the root.
- `onDelete` for `genfrac` (31769–31796): at the start of the second part, the two parts are joined.
- Placeholders are deleted as atoms.

**Fix** (points 2–4):
- An emptied index or part keeps its □.
- ⌫ at the start of the denominator steps to the end of the numerator.
- ⌫ at the start of ⁿ√'s index (its first box) follows point 4: it selects the root first when the radicand holds something, and removes it otherwise.
- The mixed number and ∂ follow the same rules with their boxes. The ∂ marks go only with the template.

**Commits:**
1. **Tests:** flip the grid's F18 cases, and add the cases above by keys.
2. **Fix.**
3. **Report** with the G2 item 47 answer (first part).

Gate: bksp-grid F18; selection (the L8/L9 fraction and root cases), tmpl and undo e2e; vitest.

### ron, R26f: lim, Σ, Π and ∫ (bug F19), branch `p1/ron-m4a-bksplimits`
Templates: `\lim_{#?\to#?}\left(#0\right)`, `\sum_{#?=#?}^{#?}\left(#0\right)`, `\prod_{…}`, `\int_{#?}^{#?}#0\,\mathrm{d}#?`. Read: `app/src/entry/delete.ts`, the grid, decisions.md "⌫ and Del keep a template whole" points 1–5.

**Behaviour today:**
- Each of them on an empty line, then ⌫: the first box's □ is deleted and ⌫ does nothing more.
  - lim: `\lim_{\to□}(□)`.
  - Σ: `\sum_{=□}^{□}(□)`.
  - ∫: `\int^{□}□\,d□`, with the lower limit gone.
- `5 lim 2 3 ◀ ◀ ⌫ ⌫`: the cursor moves out of the box and the 5 is deleted. The template stays, and the cursor stays in front of it.
- From the end of the line (`5 lim 2`, cursor at the end, ⌫ repeatedly):
  1. The bracket goes alone (F15).
  2. Then the boxes and marks go one by one: `\lim_{2\to}`, `\lim_2`.
  3. A bare `\lim` is left that ⌫ cannot remove, because the cursor ends before it. `\sum`, `\prod` and `\int` end the same way.
- Del: `lim 2` then Del repeatedly deletes the → (`\lim_{2□}`), and then the boxes merge (`\lim_2\left(□\right)`). Σ loses its =, and ∫ loses its `\,` and d (`\int_2□`). No key types any of them back.

**Cause:**
- The bounds of these operators are `subsup` or `extensible-symbol` branches (`mathlive.mjs` 31797–31861).
- An emptied branch is removed, and ⌫ at the start of a branch moves out in front of the operator.
- The marks (→, =, `\,`, d) are plain atoms.

**Fix** (points 1–5 and the Del mirror): the operator, its marks and its boxes are one template.

**Commits:**
1. **Tests:** the grid's F19 cases, and the cases above by keys, Del included.
2. **Fix.**
3. **Report.**

Gate: bksp-grid F19; tmpl e2e; vitest.

### ron, R26g: matrices, vectors and piecewise (bug F20), branch `p1/ron-m4a-bksparray`
Templates: the 2×2 matrix, the row and column vectors, piecewise (all Tmpl cells). Read: `app/src/entry/delete.ts`, the grid, decisions.md "⌫ and Del keep a template whole" points 2–5.

**Behaviour today:**
- Each of them on an empty line, then ⌫: the first cell's □ is deleted (`\begin{pmatrix} & □\\ …`), and ⌫ does nothing more. The cursor stays in the empty cell.
- ⌫ at the start of a cell with content (`2 3 ◀ ◀ ⌫`) does nothing.
- ⌫ right after a filled matrix deletes the whole matrix in one press: `5`, the matrix, `2`, cursor to the end, ⌫ → `5`. Undo brings it back.
- Del from before it does the same.
- In piecewise, the cursor also stops inside `\text{if }` (R27b).

**Cause:**
- `ArrayAtom`: `onDelete` handles only multiline arrays, through `deleteRow` (`mathlive.mjs` 31709).
- A cell is a branch, and ⌫ at the start of a branch is not handled.
- Placeholders are deleted as atoms.

**Fix:**
- An emptied cell keeps its □ (point 2).
- ⌫ at the start of a cell steps to the end of the cell before it, in reading order; Del is the mirror (point 3).
- At the first cell, point 4 applies: the empty template goes in one ⌫, and a filled one is selected first.
- ⌫ right after the template steps into its last cell (point 5).
- **Open:** whether ⌫ at the start of a row should remove an empty row, as MathLive's `deleteRow` does for multiline arrays. Default: no, the template's shape stays (2×2, 1×2, 2×1, two lines).

**Commits:**
1. **Tests:** the grid's F20 cases and the cases above.
2. **Fix.**
3. **Report** with the G2 item 51 answer.

Gate: bksp-grid F20; tmpl e2e; vitest.

### ron, R26h: log base, EQ, DMS and the evaluate-at bounds (bug F21), branch `p1/ron-m4a-bkspmarks`
Templates: `\log_{#?}\left(#0\right)`, `\operatorname{EQ}\left(#0,#?\right)`, `#?\degree#?\prime#?\doubleprime`, `\left.#0\right|_{#?=#?}`. Read: `app/src/entry/delete.ts`, the grid, decisions.md "⌫ and Del keep a template whole" points 1–4.

**Behaviour today:**
- **Log base:**
  - Tmpl log base, 16 in the base, then one ⌫: the whole `\log_{16}` goes and `\left(□\right)` is left. One ⌫ undid three key presses.
  - `5 logbase 2 3 ◀ ◀ ⌫` does the same, and the next ⌫ deletes the 5.
  - On an empty line, ⌫ leaves `(□)`.
- **EQ:**
  - EQ on an empty line, then ⌫ → `EQ(,□)`: the first box is gone and a bare comma is left. After that ⌫ is stuck (F10's loop).
  - Del before the comma deletes it, and the boxes merge (`EQ(2□)`).
- **DMS:**
  - On an empty line, ⌫ leaves `°□′□″`, with the cursor before it.
  - `5 DMS 2 3 ◀ ◀ ⌫` deletes the 5 (`23°…`).
  - Del deletes the marks one by one (`2□′□″`).
- **Evaluate-at:**
  - On an empty line, ⌫ with the cursor in the empty body leaves `_{□=□}`, a subscript without its bar, and is stuck. The body cases are R23's.
  - Del right before the bar removes it and leaves `2_{□=□}`.

**Cause:**
- Log base: a MathLive special case, where any ⌫ in the subscript of `\log` or `\ln` deletes the whole operator (`mathlive.mjs` 31863).
- EQ and DMS: the comma and ° ′ ″ are plain atoms, and the placeholders are atoms too.
- Evaluate-at: a pair with `\left.` and an empty body is removed whole, and its subscript stays behind.

**Fix** (points 1–4 and the Del mirror):
- In the log base, ⌫ deletes one character. To avoid MathLive's special case, select the one atom before the cursor and delete the selection: that goes through `deleteRange`, not `onDelete`. Check that it does.
- The comma, ° ′ ″ and the bar are marks of their template.

**Commits:**
1. **Tests:** the grid's F21 cases and the cases above by keys.
2. **Fix.**
3. **Report** with the G2 item 49 answer.

Gate: bksp-grid F21 (after this the grid should hold no `test.fail` left); tmpl, bksp and undo e2e; vitest.

### ron, R27a: 10ˣ after a digit joins the number (bug F22), branch `p1/ron-m4a-tenpow`
**Starts only after G2 item 48 is answered and the owner has picked the fix.** Read: the `log` key in `spec/keyboard.yaml` (line 175, Shift = `10^{#0}`), the DMS cell, `app/src/input/parse.ts` (number tokens), decisions.md "The exponent mark (R14)".

**Behaviour today:**
- `5 10ˣ 2` shows `510²` (LaTeX `510^2`), and Enter computes 510² = 260 100. Someone who meant 5·10² = 500 sees a plausible line.
- The same join happens with 5, the DMS cell and 2 3 → `523°`.
- The exponent key ᴇ is the right key for 5·10², but a G2 hand also reaches for Shift + LOG.

**Cause:** the template's digits go straight after the 5, in the same number. The LaTeX cannot tell `510^2` from a typed 510².

**Fix (open, for the owner):**
- (a) After a digit, insert `\times10^{#0}`. The line shows 5×10², which is what was meant.
- (b) Keep the template, and have the parser refuse a number that runs into a 10ˣ. This needs a mark in the LaTeX, such as the group `{10}^{…}`, and a parser rule with a round trip.
- (c) Leave it as it is: the line shows 510², which is what it computes.

Recommendation: (a), if the G2 shows `5*10^2` or similar. DMS is the same question at a lower priority, since no engineer types a digit right before a DMS cell.

**Commits:**
1. **Test** by keys (`entry.spec.ts`).
2. **Fix.**
3. **Report.**

Gate: entry, selection and tmpl e2e; vitest, plus the golden gate if the parser changes.

### ron, R27b: the cursor stops where no box is (bug F23), branch `p1/ron-m4a-cursorstops`
Read: `app/src/entry/controller.ts` (`run`, `nextBox` line 266), `app/src/keyboard/Keypad.svelte` `step()` (a trackpad step is the arrow key's `run`), r6-pipelines section 7 ("◀ and ▶ visit every offset").

**Behaviour today:** ◀ and ▶ visit every offset from one end to the other, and a trackpad drag steps through the same ones. Setting `mf.position` to each offset and typing 7 gives:
- **Between a function name and its bracket:** `\sin‸\left(2\right)` → `\sin7\left(2\right)`, drawn "sin 7 (2)", which the parser reads as sin(7·2) = sin 14 with no mark. The log base does the same: `\log_2‸\left(8\right)` → 7 gives log₂(56).
- **Inside names:** EQ (offsets 1–3), approx, NOT and the one-line sqrt. A 7 gives `\operatorname{7\mathrm{EQ}}`, an error.
- **Inside the `if ` of piecewise** (offsets 4–6 and 13–15) and **inside the d of ∫** (`\mathrm{d7}`): errors.
- Each of these is one more trackpad step: a drag across `approx(…)` crosses six letters.

**Cause:** MathLive's cursor visits every atom boundary. `nextBox` skips marks only while an empty box is still ahead.

**Fix** (direction; the details are open):
- In `run`, after `moveToNextChar` or `moveToPreviousChar` (keys and trackpad steps alike), keep stepping while the new position is not a stop. A non-stop is a position inside an `\operatorname`, `\text` or `\mathrm` group, or between a function name and the `\left` it was inserted with.
- Alternative: make the names atomic for the cursor, as the chips are (MathLive macros with `captureSelection`). That changes the LaTeX the parser reads.
- Open for the owner (G2 item 50): whether the parser should also refuse a bare function name followed by a term and a bracket (`sin 7(2)`), whatever the cursor does.

**Commits:**
1. **Tests** (new `app/test/cursor.spec.ts`):
   - The offsets that ◀ and ▶ visit for sin, EQ, approx, piecewise and ∫.
   - A digit typed at every offset the keys reach lands in a box, or is refused.
2. **Fix.**
3. **Report** with the G2 item 50 answer.

Gate: cursor, gestures, tmpl, selection and bksp-grid e2e green; the trackpad presses in the task benchmark do not go up.

### ron, R21a: pick sheets over the keypad, branch `p1/ron-m4a-fit`
The owner's frictions (2026-10-14): a sheet in the viewport is far from the thumb while typing, the Tmpl grid scrolls on the phone, Settings is too small. R21 is built in two packages: R21a the pick sheets, R21b the Settings page. Where 0d says "R21 merged" (R24b), read R21a. Decided: decisions.md "R21" (binding); the target text is already in docs/05 2 (rule 1), 3.1 and 3.4 and docs/03 rule 8. Read those, decisions.md "Sheet defaults (R7)", "Mode and Settings sheets (R8)", "S2: one menu system", and `app/src/views/` (`Sheet.svelte`, `sheet.svelte.ts`, `sheetKeys.ts`, `modeSheet.ts`) with the sheet parts of `App.svelte`, `apps/shell.svelte.ts` and `keyboard/Keypad.svelte`. Commits in this order:
1. **Tests first** (`app/test/fit.spec.ts`, failing on today's code), at 412 × 915:
   - **Keys never move:** the box of every key is the same before a sheet opens, while it is open and after it closes (Apps, Menu, Mode, Tmpl, Shift + 6, Shift + 9; R21b adds Settings).
   - **Where:** a pick sheet's bottom edge is the keypad's bottom edge, its top is not above the top of keypad row 3, and `elementFromPoint` at the centre of ▲, ▼, ◀, ▶, Esc, Cancel and Menu hits that key while the sheet is open.
   - **Fit:** every pick sheet shows all its items without a scroll (`scrollHeight <= clientHeight`): Apps, the Home Menu, the Function Plot and Solve menus, Mode, Mode › Significant digits (9 rows), Tmpl, Shift + 6, Shift + 9; at 360 × 740 the same for Tmpl, Shift + 6, Shift + 9 and Mode.
   - **Flow:** a tap on a Tmpl cell closes the sheet, puts the template on the line with the cursor in its first box, and the next digit key types into it. Shift + 6: the `≤` cell's box covers the 8 key's box.
2. **Over the keypad** (`Sheet.svelte`, `App.svelte`, the model only if it must): mount the pick sheets in a layer over the keypad's maths rows, anchored at its bottom edge and as tall as its rows need, up to the top of row 3; the top cluster stays uncovered and live. Keep every sheet key job (`sheetKeys.ts`) for the keys still visible; a maths key a short sheet leaves visible is dimmed and keeps its sheet job (a digit picks its row; nothing types into the line, rule 4). A tap in the viewport closes the sheet. A list that takes letters (filterable, Find later) stays where sheets are today, above the keypad. The rise animation stays within one frame and 120 ms (rule 6).
3. **Fit** (`Sheet.svelte`): rows and cells shrink to the room, from today's size down to the floor: list rows 36 px (font and padding together; the number column stays), grid cells 44 px (today 58 px for Tmpl, 46 px for the Shift palettes); below the floor, today's scroll cue and count. Grids have no title row: the title, the highlighted cell's name and × share the hint line. Two-line rows (disabled reasons) count their own height. CSS where it can (a custom property set from one ResizeObserver), no per-frame work.
4. **Shift + 6 over its keys:** each relations cell is drawn over the key in its `pick:` (keyboard.yaml `relations:`), using the keys' boxes; the cells without a key (none today) and Shift + 9 and Tmpl stay a grid.
5. **Mode for the thumb:** each value row gets ◀ ▶ buttons (at least 44 × 44 px) beside the value; a tap on the row still steps forward.
6. **Gallery:** Home menu, Mode, Mode › digits, Tmpl, Shift + 6, Shift + 9 over the keypad, Tmpl and Mode at 360 × 740; light and dark; rebuild.
7. **Report** ("For shared files": anything in docs/05 3.1 the build changed; R7 open point 5, the Function Plot reasons, judged again with the new rows; the code comments that said "never over the keypad" are yours to fix).
Gate: `fit.spec.ts` green; `sheet.spec.ts`, `status.spec.ts` (viewport share unchanged), the Mode e2e, gestures and flicks e2e green; start chunk within the budget (156 kB raw, 54 kB gzip); gallery rebuilt. Not in this package: the Settings page (R21b), R15b's keys, the theme, Find.

### ron, R21b: the Settings page and Android back, branch `p1/ron-m4a-settings`
Starts when R21a is merged. Decided: decisions.md "R21" (the Settings page) and backlog C8 (Android back). Read decisions.md "R21" and "Mode and Settings sheets (R8)", docs/05 3.4, R21a's report, `app/src/views/modeSheet.ts`, the Settings and sheet parts of `App.svelte`, and `android/app/src/main/java/io/github/buerlino/pascaline/MainActivity.java`.

**Why back needs Java:** Capacitor 8.5.3 has no back handling of its own (no `onBackPressed` or `canGoBack` in its Android sources), `@capacitor/app` is not installed, and `MainActivity` does not override back. So on the APK the back gesture leaves the app whatever the page does, while a `history.back()` e2e passes in Chromium all the same (checked 2026-10-14).

Commits in this order:
1. **Tests first:**
   - Settings e2e by touch, by hardware keys and by `history.back()`.
   - `fit.spec.ts` "keys never move" gains Settings.
   - `history.back()` closes an open pick sheet, and the next key works as before.
   - Opening and closing Settings or a sheet five times leaves the history length as it was, so back with nothing open leaves the app.
2. **Settings page** (new `app/src/views/SettingsPage.svelte`; `modeSheet.ts` keeps the item lists):
   - **Where:** opened where Settings opens today (Mode's last row; Shift + Home/CAS until R15b). It covers the whole window, status line included.
   - **Layout:** one scrolling page with section headings instead of submenus: Format key cycle (its switches and Decimals), Vibration (on, strength, length), Shift / Alpha taps (counts, reset).
   - **Rows:** a value row has its label, its value and ◀ ▶ buttons of at least 44 × 44 px; a switch row toggles on a tap; disabled rows keep their reason.
   - **Close:** × in the header, Android back, Esc on a hardware keyboard.
   - **Hardware keys:** ▲ ▼ move, ◀ ▶ step, Enter or space toggles, Esc closes.
   - **Leave a place** for Theme (R12c), User keys (R4b) and About; build none.
3. **Back acts as Esc for the open layer:**
   - One small helper pushes a history entry when Settings or a pick sheet opens, and closes that layer on `popstate`.
   - Closing the layer by Esc, ×, a pick or a tap in the viewport takes its entry back, so the history never grows.
   - With nothing open, back leaves the app as today.
   - No new dependency. R4a's Find uses the same helper.
4. **Java** (in `android/`, annabell's folder; allowed for this one file): in `MainActivity`, an `OnBackPressedCallback` calls the WebView's `goBack()` when `canGoBack()` is true; otherwise it lets the default run, so the app leaves. About 15 lines. A4a checks it on the device.
5. **Gallery:** the Settings page, light and dark, at 412 × 915 and 360 × 740; rebuild.
6. **Report.** "For shared files": backlog C8 done in R21b, with the device check in A4a; docs/05 3.4 if the page differs.

Gate: the Settings e2e (touch, hardware keys, `history.back()`), `fit.spec.ts`, `sheet.spec.ts`, `status.spec.ts`, the Mode e2e (rewritten where it opened Settings as a sheet), gestures e2e green; the Java compiles (`./build.sh --dev --unsigned` under the host-cpu lock); start chunk within the budget (the Settings page loads lazily if it grows the chunk by more than 1 kB); gallery rebuilt.

### annabell, A4a: device run before R15b, branch `p1/annabell-m4a-device`
Starts when R21b is merged and the owner connects the Tab One, with the S8+ for the WebView checks (rules section 6). One device session for every check that waits for no later package: backlog Needs the user item 7, milestone 4 step 12 without Find, C6, the C8 check and K1. In order:
1. **Build:** a full `./build.sh` from `phase-1` with the qalc step (no `--no-units`). This closes milestone 4 steps 6 and 7's open "full `./build.sh` run". Then fix C6:
   - `tools/device_run.py status|start` report the build type of a `--measure` build;
   - `tools/stay-awake.sh` restores from any worktree.
2. **Tab One, against the §8.3 bars** (medians of ≥ 5 runs, with device, Android, WebView and build type):
   - cold start (L7): keyboard usable and engine ready;
   - a Shift tap and the fit pass;
   - Enter p95 at digits 12, 20 and 30 (`?bench=1&digits=N`, 5 cold runs);
   - the replay of 200 definitions (milestone 4 step 10);
   - the start-chunk raise: keyboard usable may not move by more than 50 ms against the numbers of 2026-10-12;
   - R21a's sheet rise: within one frame and 120 ms.
3. **Behaviour on the devices:**
   - `navigator.clipboard` and `navigator.share` in WebView 131;
   - Android back (R21b) closes Settings and an open sheet, and leaves the app from an empty Home;
   - K1's `touch-action: none`: no scroll or zoom side effects;
   - the flick thresholds (20 px arm, 12 px cancel): misfires in a minute of typing;
   - whether Android sends `pointercancel` for a touch held while the app leaves (R25a's open question);
   - ᴇ drawn on the S8+'s Chrome 101 WebView.
4. Leave an APK built from `phase-1` on the Tab One for the owner to try.

Report against the §8.3 bars. A miss goes under "Needs a decision" with the number; docs/04 says what changes (digits capped at 20). The report ends with one line: whether R15b may start.

### ron, R15b: top cluster, branch `p1/ron-m4a-top`
P12 points 2 and 3 and open point B. **R15a is done:** `docs/mockups/top-cluster.html` holds the layouts A, B, C and the press table. **The owner turned down A, B and C (2026-10-14); the page now holds layout D** (the cross stays, every key at its G2 place, three free keys U1–U3 with Shift layers, 48 px cluster rows; decisions.md). **R15b:** build D (approved by the owner 2026-10-14) with **U2 = Home and U3 = CAS as defaults** in `spec/keyboard.yaml` (decisions.md "R15a: layout D"); the free keys get their slots and storage here (a stamped key in `state/storage.ts`), their Find-based setting comes with R4b. Edit the grid in `spec/keyboard.yaml` (the maths rows 3–9 do not move), replace the `app` and `cas` keys by the user keys U2 and U3 with those defaults (their old Shift layers go), make the place name a button, move the pad, keep the `cancel` key's id and its Shift layer (Undo, R16), update the trackpad zones, the legends, `tools/probes/unit-presses.mjs` and every test that names a moved key; keys typed while an app loads (R8) now include the status taps; remove `app` and `cas` (and `symb`/`plot`/`num` if they fold) from `PASS` in `views/sheetKeys.ts` and `AT_ONCE` in `App.svelte`; the place-name tap no longer opens Apps (`status.spec.ts` changes). Gate: e2e for each path in the press table, viewport share not below R8's 0.354, keyboard test, gallery, gestures and flicks e2e. Shared-file text in the report.

### ron, R11: history-row actions, branch `p1/ron-m4a-rows`
Starts when R21b is merged; it runs before R15b, since it uses no key that R15b moves (Menu keeps its G2 place in layout D), and its Menu rises over the keypad as R21a built. docs/05 3.3 and 3.5 limited by section 7 point 2: **Home and CAS only.** ▲ on an empty line picks a row (exists); a row of buttons appears above the entry line: Insert · Recall · Copy · Store ▶ · Delete; hidden while typing; **the Menu is one fixed list of nine (S2, accepted): 1 Insert, 2 Recall, 3 Copy, 4 Store ▶, 5 Delete, 6 Copy as › (as shown, exact, LaTeX), 7 Paste, 8 Share session, 9 Clear history**, the same numbers whether or not a row is picked, acting on the picked row, else the last result (Delete: the last row); the buttons are items 1–5; the long press opens the same list on its row. Build the actions as one list used by the buttons, Menu and long press, so the "results mode" idea can reuse it. Gate: e2e per action from keys and from touch; task benchmark has no task with more presses; history performance test unchanged.

### ron, R12a, R12b and R12c: visual pass, branches `p1/ron-m4a-look` (R12a, R12b) and `p1/ron-m4a-theme` (R12c)
**R12a** (after R15b): read the owner's UI points in `docs/feedback.md` (and anything added since); make mockups as one static HTML page (Home with history, a pick sheet over the keypad, the Mode sheet, the Settings page, Plot; light and dark at phone size) in `docs/mockups/` and end the package. The owner reviews them on the phone and says what to change; R4a and R4b run meanwhile.

**R12b** (started with the owner's notes, after R4b, so Find is in the pass): design tokens in one file (docs/05 3.10: colours per role, type scale, 4 px spacing, radii, motion); no colour or size written directly in a component, Find's included; history rows (3.5). Gate: contrast test, gallery reviewed by the owner, start chunk within 2 kB of before.

**R12c** (after R12b): **theme setting System / Light / Dark on R21b's Settings page, Dark by default on Android, System in the PWA**; press feedback within one frame; `prefers-reduced-motion`. Gate: contrast test in both themes; e2e for the setting (it survives a reload); gallery rebuilt; start chunk within 0.5 kB of before.

### Packages of section 0e

### gorge, G10: qalc glue, the result JSON, branch `p1/gorge-m5-glue`
Backlog milestone 5 item 1, part 1. No UI. Read docs/04 4.1, 4.2, 8.2 (`Quantity`, `UnitError`) and Appendix C; `engine/qalc/glue.cc` (today `qalc_set_precision`, `qalc_parse`, `qalc_print`, `qalc_eval`: JSON for the Find index generator), `engine/qalc/smoke.mjs`, `engine/qalc/cases.yaml` with `check.py` and `run-cases.mjs` (the 26 spike cases).
1. **Tests first:** a Node test beside `smoke.mjs` (or `run-cases.mjs` extended) that calls the new entry point and checks the JSON, failing on today's glue. Use docs/04 4.1's table, sources `derived` or `oracle` only:
   - `72 km/h to m/s` = 20, exact;
   - `1 in to mm` = 127/5, exact;
   - `1/3 m to cm` = 100/3, exact;
   - `90 deg to rad`, approximate, at P digits;
   - `G` with its uncertainty;
   - `(12.34 ± 0.05) m * (3.2 ± 0.1) m` with its uncertainty;
   - the dimension of `1 lbf`;
   - an unknown name gives an error with qalc's message.
2. **The entry point** returns one JSON result per call, with the fields of docs/04 8.2's `Quantity`:
   - the number as an exact fraction when qalc's structure is not approximate, else a decimal at P = max(40, digits + 10);
   - the unit part as canonical qalc names with exponents;
   - the dimension (from `convertToBaseUnits`), the value in SI base units, the uncertainty and qalc's approximate flag;
   - or an error.
   
   Keep the generator's entry points working.
3. **Appendix C's open items:** whether currency data is in the compiled definitions (currencies stay off), and the Rankine name.
4. **Build** with `engine/qalc/build-wasm.sh dev` under the host-cpu lock. The release build is milestone 5 item 5's.

Gate: the new test, `node engine/qalc/smoke.mjs engine/qalc/_out/dev`, `python3 engine/qalc/check.py` as before, `npm run index` clean with the new build. Report: the JSON shape with two examples, for G11.

### gorge, G11: the `UnitEngine` worker and client, branch `p1/gorge-m5-worker`
Backlog milestone 5 item 1, part 2. Starts when G10 is merged. No UI. Read docs/04 4.2, 6.1 and 8.2 (`Calc.units()`, `UnitEngine`), G10's report, and the Giac worker's pattern in `app/src/engine/` (`workerEngine.ts`, `giac.worker.ts`, `protocol.ts`).
1. **Tests first** (Vitest in `app/src/units/`, with the qalc dev build from `QALC_OUT`):
   - `evaluate()` returns G10's result as a `Quantity` or a `UnitError`;
   - `cancel()` terminates and respawns the worker, and the next call works;
   - nothing loads qalc before the first call (lazy);
   - a cancel during the load.
2. **Build** the worker and client in `app/src/units/` on the Giac worker's pattern: an async interface, a module worker, Cancel = terminate and respawn, nothing to replay. Add `Calc.units()` as docs/04 8.2 names it. Nothing in the start chunk imports it.

Gate: the worker tests, typecheck, vitest; the size test (start chunk unchanged). Report: the client's API, for G12, R28 and R24c.

### gorge, G12: the units checks, marks and `units.yaml`, branch `p1/gorge-m5-adapter`
Backlog milestone 5 item 2, the gorge half (the parser half is R28). Starts when G11 is merged. No UI and no parser: the input is qalc text from whitelisted names, as R24a's slot model and R28 will build it. Read docs/04 2.4 (marks), 2.7 (SI prefixes), 4.3 ("Our adapter checks", "Result", "Temperature", "Logarithmic units") and 8.2 (`UnitError`), G11's report, `app/scripts/golden.ts`.
1. **Tests first:** `tests/golden/units.yaml` in the golden gate. Take the 26 spike cases of `engine/qalc/cases.yaml` (temperature, prefixes, dimension errors, uncertainty, exactness marks), plus:
   - `72 km/h → m/s` = 20 `=`;
   - `1 in → mm` = 25.4 `=`;
   - the checks below.
   
   Sources `derived` or `oracle` only. hp and mmHg stay out until G13.
2. **The checks** (`app/src/units/`), on what qalc lets through:
   - **One term:** the formula with its units must give a single term (number × units), else "Units don't match: L vs T", naming the term.
   - **Temperature:** an absolute temperature only alone. `20 °C → °F` = 68; `20 °C × 2` is refused with "Use K or Δ°C for a temperature difference".
   - **End slot:** with an end slot, a dimension mismatch names both dimensions.
   - **Logarithmic units:** conversions only (dB, dBm, Np).
   
   Messages go through the i18n table.
3. **The result:**
   - the mark by the 2.4 rules, with qalc's approximate flag as the engine fact;
   - the value through our formatter at the digits setting;
   - the unit shown: the units typed when they fit the dimension, else SI with an SI prefix (2.7);
   - the dimension as `L·T⁻¹`.
   
   `units.targets` and the way back to Home are the result view's (0d, not packaged yet).
4. **Golden runner:** `npm run golden` runs `units.yaml` with the qalc build (`QALC_OUT`) and reports its count.

Gate: the golden gate passes with the units section; vitest; typecheck. Report: the input and output of the checks, for R28 and R24c; the counts for `tests/golden/README.md`.

### gorge, G13: the hp patch and the data audit, branch `p1/gorge-m5-qalcdata`
Backlog milestone 5 item 3 (P3 decision 3; docs/04 2.3 #10 and 4.5). Starts when G12 is merged. No UI. Read `engine/giac/patches/README.md` (the pattern), `engine/qalc/build-wasm.sh`, `find/units.yaml` (its `checks` and `known` entries), `tools/find-index/generate.mjs`, backlog "Needs the user" item 6.
1. **Tests first:** in `units.yaml`, failing on today's build:
   - `1 hp → W` = 745.69987158227022 W (550 ft·lbf/s, `derived`);
   - `1 mmHg → Pa` = 133.322387415 Pa (13.5951 g/cm³ × 1 mm × 9.80665 m/s², `derived`).
2. **The patch:** `engine/qalc/patches/` with a README, a minimal patch of `units.xml`, applied by `build-wasm.sh`. The SHA-checked tarball stays untouched.
3. **The audit, once:** every unit and constant in Find's index against its exact definition and CODATA 2022. Each difference becomes a patch with a case, or a `known` entry with its reason. The `known` marks on hp and mmHg in `find/units.yaml` come out; the index build fails until they do, by design.
4. **Upstream:** the report holds the text of the libqalculate issues for the owner (backlog "Needs the user" item 6).

Gate: the golden gate (units), `npm run index` clean, the qalc dev build. The release build picks the patch up through `build-wasm.sh`; annabell checks it in milestone 5 item 5.

### gorge, G14: exact results marked ≈, branch `p1/gorge-m4-marks`
Backlog C9. Home only; can run at any time. Read docs/04 2.4, `app/src/engine/homeEval.ts`, `markOf()` in `app/src/engine/format.ts`, `decideFloatTest` in `app/src/engine/homeEval.ts` (R18f2), and the render of an unevaluated test (`app/src/render/home.ts`).
1. **Tests first** (golden, `derived`):
   - `mod(7.5,2)` = 1.5 with the `=` mark: the typed 7.5 is exact (15/2), and so is the remainder 3/2.
   - A test that stays as typed shows its decimal as typed: `romberg(exp(-x^2),x,0,1)==0.746824132812` is drawn with `0.746824132812`, not `746824132812/10^12`.
2. **Fix** where the mark goes wrong (the exact-first path, the agreement check or `markOf`) and where the rewritten literal reaches the display. The render file is ron's; the change there stays as small as the fix needs.

Gate: the golden gate (home, precision), vitest, typecheck.

### ron, R28: units mode in the parser, branch `p1/ron-m5-unitparse`
Backlog milestone 5 item 2, the ron half. **Its text is written when R24a has reported** (the slot tokens) **and G12 has reported** (the checks' input). Until then nobody starts it. Scope from the backlog:
- `\pm` (uncertainty) and `\to` (the end slot), in units mode only;
- the formula with its slots as qalc text, from whitelisted names only;
- a round trip per token.

It must be merged before R24c.

### Packages of section 0d

### sandra, S5: the unit pad's arrangement and its user cells, branch `p1/sandra-padlayout`
P14 is decided (decisions.md) with the owner's amendment (feedback #43): one fixed base arrangement for everyone, measured, not guessed, plus a few user cells for the units of one's own work. The draft in `spec/unit-pad.yaml` was arranged by hand. Find the arrangement that costs the fewest presses for the units engineers use most, as a keyboard gives its best keys to the most used letters. Read: r9 sections 1–3 and 6, decisions.md P14, `spec/unit-pad.yaml`, docs/04 5.2 (the counting rule), and in `tools/probes/unit-presses.mjs` the `UNITS` list and `typePad`. No app code.
0. **Ask the owner first** for their own most used units (10 to 20, with prefixes, such as kN, MPa, mm) and their field. Their list is one source among the others, not the whole answer.
1. **How often each unit is used.** Count units in open engineering text, with at least three fields weighted equally (mechanical and civil; electrical; chemical, process and HVAC), since principle 2 asks for one pad with no split by discipline. Candidate sources: open textbooks (OpenStax, CC BY), Wikipedia's engineering articles, the unit tables of open standards. Add the task benchmark (`tests/tasks/tasks.yaml`), S1's 50 units and the owner's list. Download once into a gitignored cache, record each file's SHA-256, then count offline (`tools/probes/unit-freq/`, under the probe rules). Count a prefixed unit as prefix plus unit (kN = k + N) and a compound by its factors, and keep the compound counts as well. Result: `tools/probes/unit-weights.yaml` (Find id, weight, sources).
2. **The cost:** docs/04 5.2 (tap 1, flick 1, Shift or Alpha 1), with the taps-only count beside it, since S1 showed the pad must pass without flicks. A tie goes to the tap over the flick, then to keeping a quantity's units on one cell. Use no reach model unless there is measured data, and say so.
3. **Fixed, do not move:**
   - Shift, Alpha, ⌫, Enter and Math (Find) at their places.
   - ÷, ×, x² and xʸ as the operators.
   - The prefixes on the number keys, biggest first.
   - One quantity per cell, with its SI unit on the tap unless the data shows another unit of that quantity is used far more. K against °C is the known case (r9 open point 2): answer it from the data.
4. **Search:** a probe `tools/probes/pad-arrange.mjs` that scores an arrangement (weighted mean presses, with flicks and with taps only) and searches under these rules (exhaustive or a local search; say which, and why it is enough). Print the draft's score, the best found and what moved. Add `--weights` to `unit-presses.mjs`, so it prints the weighted mean beside the median.
5. **How many user cells** (the owner left the number open; their first idea was about four). Score the best arrangement with 1 to 6 base cells given up to user cells, so you know what each cell costs the base units. Propose a number from that curve, with the cells next to each other so they are easy to find. Give them defaults: the most used units that got no base cell, with the owner's units first.
6. **Write:**
   - `spec/unit-pad.yaml` with the result: schema 2, with a `user:` list holding the cells and their defaults.
   - r9 sections 1, 3 and 6, rewritten for the result.
   - A static phone-size mockup, `docs/mockups/unit-pad.html` (light and dark, like `top-cluster.html`), so the owner can judge it on the phone.
   - In the report, the proposal "P14 arrangement" for decisions.md "Needs the user": the grid, the number of user cells and the curve behind it, K or °C, and the units that left the pad.

Gate:
- On S1's 50 units, the median is ≤ 2 both with flicks and with taps only.
- The weighted mean beats the draft's, or equals it with the reason given.
- Each of the owner's units takes ≤ 3 presses, or the reason is named.
- Every id on the pad is a Find id, or it is listed for G7.

### gorge, G7: Find data for the unit pad and the units menu, branch `p1/gorge-m5-finddata`
Backlog milestone 5 item 4 (its `add_to_find` part) and docs/research/r9-unit-pad.md section 7. Starts after S5, so the test reads the final arrangement. No UI.
1. **Test first** (`app/src/find/specids.test.ts`, failing on today's index): every unit and prefix id in `spec/unit-pad.yaml` (the user cells' defaults included) and every grid entry of `spec/units-menu.yaml` (the `first` lists, with products such as `ft*lbf`, `Btu/h` or `m^3/h` split into their factors, and the prefixes) resolves to a Find item (`unit:<id>`, `pfx:<id>`); the constants in `constants.lists` resolve to `const:<id>` (Math's e, π and i excepted). Today it fails at least on `Ah`; add the ids S5's report lists as missing, and list every failure in the report.
2. **Add** `add_to_find` (kip, fbm, Ah, mAh) and the constants StdT and StdP to the curated data (`find/units.yaml`), each with a `checks` entry whose size is exact from its definition (`derived` or `oracle`), and query phrases for them in `tests/tasks/find-queries.yaml` ("ampere hour", "kip", "board foot", "standard temperature").
3. **r7 section 3's list:** `mmH2O` and `percent` are not in today's index, although r7 assumed Find carried them. Find out why (qalc data, a generator skip; `percent` and `ppm` are qalc constants, not units). Then either add the unit with a check, or write the reason into `find/units.yaml`'s comments. `%` gets no unit cell (r9 section 3).
4. **Size:** the index stays within budget (≤ 400 kB raw, ≤ 100 kB gzip; G4 left it at 395 kB raw); report the new size.
5. **Report** with the shared-file text for the backlog (milestone 5 item 4: the `add_to_find` part done).

Gate: the new test, the query test (every phrase in the top 3, at least 90 % first), `npm run index` clean, the size budget.

### sandra, S4: the laptop connection, design note, branch `p1/sandra-connector`
Starts on the owner's go (a parked idea, decided around 2026-10-20). Read: feedback #5b, #17, #40; backlog "Parked ideas" (the shape as written 2026-10-14); docs/04 3.4 (live entries) and 6.2 (the `defs` log); decisions.md P11 (Python removed); CLAUDE.md's F-Droid rules (offline, no network). Write `docs/research/r10-connector.md`, and put the proposal for decisions.md "Needs the user" in your report. Answer each point with evidence (probes in `tools/probes/`):
1. **The file:** format (Giac definitions `name(args):=body`, one comment line per function with a one-line description; optional test lines checked at import, so a library carries its own golden cases?), encoding, size limit, and what an import refuses (anything stateful beyond a definition).
2. **Onto the phone without the INTERNET permission:** a file input in the Capacitor WebView (does it open Android's picker without a plugin? probe it in Chromium; the device check is annabell's later), "open with" or share to the app (an intent filter; what Capacitor needs; MIT plugins only), the File System Access API in the PWA. Recommend one.
3. **Import and export:** into the `defs` log with a name-clash rule and the `DATA_VERSION` stamp; the replay time at 200 definitions; how the functions appear in Vars and Find (kind `userfn`, description from the comment) and on a user key (U1–U3); export the other way.
4. **The laptop side:** the desktop web app as the test bench (same engine, same marks); a small Node command around `app/src/engine/nodeGiac.ts` that runs a library file and its tests (the MCP or AI hook would sit on the same). Cost and licence of each part.
5. Removal test, cost per worker, what would change it. No feature code: probes and the note only.

### ron, R24a: the slot model, branch `p1/ron-m5-unitslot`
The first of four unit-pad packages, with no UI. Read: r9 section 2 (the rules), docs/04 4.3 (Grammar per slot), r7 section 5.4 (the guards), and `typePad` in `tools/probes/unit-presses.mjs`.
1. **The MathLive check first** (r7 section 8; R24c depends on it). Check that a read-only MathLive field with one `\placeholder[id]{}` per slot shows a slot's LaTeX (a unit with a power, a stacked ÷), and that our key routing reaches the active prompt. Use a throwaway e2e and keep it out of the commit. If it fails, put the evidence under "Needs a decision", and build the model anyway: it does not depend on the display.
2. **Tests first** (`app/src/units/slot.test.ts`), one per rule of r9 sections 2.2–2.6:
   - A prefix arms; another replaces it; the same one again disarms it.
   - Units in a row multiply; one ÷ per slot.
   - ², ³, ⁴ and ⁻¹ act on the unit before, √ on the unit after.
   - ⌫ removes the last token.
   - A prefix alone and a second ÷ are refused, with a message from the i18n table.

   Also, for every unit of the probe's 50 and of S5's weights list, the model's qalc text equals `typePad`'s or its canonical form.
3. **The model** (`app/src/units/slot.ts`, plain TS): a token list per slot (prefix id, unit id, power, the place of the ÷). It gives:
   - the LaTeX shown;
   - the qalc text, from whitelisted ids only;
   - the reading in words, from Find's titles. A prefixed pair outside Find's list is marked (S1 guard 3).

   Its input is pad actions (`prefix`, `unit`, `per`, `power`, `sqrt`, `delete`), never keys, so R24b and R24c plug into it.

Gate: the tests, typecheck, and the start chunk unchanged (nothing imports the model yet). Report: the MathLive check's result and the action names, for R24b.

### ron, R24b: the pad drawn over the keys, branch `p1/ron-m5-unitpad`
Starts when the owner has accepted S5's arrangement and R21 is merged. No slots yet: the pad emits R24a's actions. Read: r9 section 1, `spec/unit-pad.yaml`, R21's layer (Shift + 6 drawn over its keys), `keyboard/fit.ts` and R9's legend drawing.
1. **Tests first**:
   - A Vitest for the loader. Every key id is a maths key of `spec/keyboard.yaml`, no key holds two cells, and every unit or prefix id is a Find id.
   - An e2e (`app/test/unitpad-draw.spec.ts`), by keys and by touch. Every cell, by tap, flick up, flick down, Shift then the cell and Alpha then the cell, emits its action. A user cell emits its unit.
2. **Load lazily** (a dynamic import with the unit view), never in the start chunk.
3. **Draw** over the maths rows with R21's layer, each cell on its key's box. Prefix cells get their own colour token. Each cell shows up to three legends, fitted by `fit.ts`. The user cells are marked, and an empty one shows a dim "+".
4. **Route every press** through the keypad's own gesture code (tap, flick, bubble, haptic), mapped by key id and layer. A dev-only switch (`?pad=1`) shows the pad for the gallery until R24c opens it from the units key.
5. **Gallery:** the pad in light and dark, at 360 × 740 and 412 × 915.

Gate:
- The tests pass, and the gestures and flicks e2e are unchanged.
- Every legend fits at 360 px within the fit code's 8 px floor, or the report names the cells that do not.
- The size test passes, with the start chunk unchanged.
- The owner has reviewed the gallery.

### ron, R24c: the unit view entry, branch `p1/ron-m5-unitview`
Starts when R24a, R24b and milestone 5 items 1–2 (U1 the qalc worker, U2 the adapter) are merged. Read: r9 sections 2.1, 2.7 and 2.8, docs/04 4.3, and the reports of R24a and R24b.
1. **Tests first** (`app/test/unitpad.spec.ts`), by keys and by touch:
   - The units key on a line, on a picked history row, and on an empty line (quantity 1) opens the slots with the pad up.
   - Pad presses fill the active slot, and the reading under the formula follows every press.
   - Enter goes to the next slot, Enter in the end slot evaluates, and a flick up on Enter evaluates at once.
   - ◀ ▶ move between slots, and Esc keeps the slots with the line.

   Also replay as e2e the 44 of the probe's 50 units that sit on the draft pad, each within the probe's count. The other six go through Find in R24d. Tasks t02 and t04 must be within their plans.
2. **Build:**
   - The read-only formula with a slot after every number, as R24a's check found.
   - R24a's model per slot, with R24b's pad up while a slot is active.
   - Evaluation through U2's adapter, with the result shown as U2 returns it. The full result view is not packaged yet (section 0d).
3. **`spec/keyboard.yaml`:** `unit_slot:` loses `letters`, `symbols`, `ops` and `exponent_leave`. The probe's `--pad` mode becomes its default, and the letter modes stay for comparison.
4. **Report** with the shared-file text: docs/04 4.3 rewritten for the pad, the status line at the top of r7, and backlog milestone 5 item 4.

Gate:
- `unitpad.spec.ts` passes.
- The probe's medians are ≤ 2, both with flicks and with taps only.
- t02 and t04 are within their plans.
- The gestures and flicks e2e and the keyboard test pass.
- The size test passes, with the start chunk unchanged.

### ron, R24d: Find in a slot and the user cells, branch `p1/ron-m5-usercells`
Starts when R24c, R4 (Find) and R15b (the user keys and their storage) are merged. Read: r9 section 2.9, decisions.md P14 (the user cells), R15b's user-key code and its storage key in `state/storage.ts`, and R4's report.
1. **Tests first:**
   - Math in a slot opens Find on units and prefixes, and an empty query shows the units menu by category (`spec/units-menu.yaml`).
   - A pick lands in the slot as tokens: a prefixed unit becomes a prefix plus a unit.
   - The six of the probe's 50 units that are not on the pad, each within the probe's Find count.
   - A user cell is set from a Find hit ("Put on the unit pad", choosing the cell and its tap, up or down) and from Settings › Unit pad. It survives a restart and can be reset to its default.
   - An empty user cell opens Find.
2. **Build:** store the cells in the stamped store beside the user keys (a key such as `unitPadCells`), on the same code path as U1–U3 wherever it fits. A user cell holds one Find unit, with or without a prefix (MPa, mmH₂O). Its defaults come from `spec/unit-pad.yaml` `user:`.
3. **Gallery:** Find in a slot, the units menu, and a user cell being set.

Gate: the tests, the Find query test unchanged, and the size test.

## 8. Definition of done
- **Each branch:** typecheck 0; `npm run index` (with `QALC_OUT=<main checkout>/engine/qalc/_out/dev` in a worktree), then `FIND_INDEX=required npm test`, all pass (the Find query test fails rather than skips without the full index); e2e all pass (the known-flaky `solve.spec.ts` persistence test may be re-run once); SPDX headers; `git commit -s` with the trailer (`Claude Opus 5.5` or `Claude Sonnet 5.5`, whichever model ran); the report commit; start chunk size reported for UI packages.
- **Milestone 4 is done when:**
  - task 5 is within budget
  - the query test passes
  - the golden gate passes with marks and `precision.yaml`
  - no §2.3 item #1–#9 is left (each fixed, with its regression case passing)
  - the size test passes
  - the Tab One bars of §8.3 hold, or a measured miss is written up as a proposal in `docs/decisions.md`

## 8a. Review and merge (one short Opus session per finished package)
```bash
claude --model opus "Review and merge package <ID>: follow section 8a of docs/shifts/brief.md."
```
The reviewer works in the main checkout on `phase-1`:
1. `git status` is clean, and the prerequisites in the table are merged. If not, stop and say so.
2. Use the package's branch from its table (0a, 0b, 0d or 0e). Read the report (`git log -1 <branch>`) and the diff (`git diff phase-1...<branch>`) against the backlog step and the docs/04 sections it names. Check the claims:
   - expected values come from the oracle or are `derived`
   - every new token has its round-trip case
   - no file outside the package's scope is changed
3. In the package's worktree, run:
   - typecheck, vitest and e2e
   - the golden gate (absolute `GIAC_OUT`) when engine-side or parser code changed
   - the size test, once A1 is in
4. **Problems:** don't merge. List them, at most five, each with `file:line` and the fix. The owner restarts the package with "Fix the review findings for package <ID>: …".
5. **Otherwise:**
   - `git merge --no-ff` into `phase-1`
   - apply the report's "For shared files" text
   - tick the backlog step with the commit
   - put "Needs a decision" items under "Needs the user" in `docs/decisions.md`; when the owner decides one, move it to "Decided proposals"
   - **rewrite, don't amend:** where the package changes what a doc says, change that text in place (no "amended"/"superseded" notes or strikeouts; git keeps the history), and remove the finished package's text from section 7 of this brief and its row from its table
   - remove the worktree, then `git branch -d`
   - commit with `git commit -s`
   - never push
5a. **After merging a ron package (4a), build and install the owner's APK** from the main checkout: `./build.sh --engine-dir engine/giac/_out/gsl --no-units --install` (the script takes the host-cpu lock). Install only `io.github.buerlino.pascaline`, on the owner's phone (the only device the owner connects for this). Then tell the owner what to try, in three lines at most, and append a line to `docs/feedback.md` "waiting for the owner's notes on <package>".
6. When a merge completes milestone 4: write `docs/shifts/<date>-m4-report.md` (rules section 11, step 5) and add milestone 4 to docs/02 section 12. The report says what the owner should try on the APK: marks, Find, copy and paste, and the empty-line Ans.
