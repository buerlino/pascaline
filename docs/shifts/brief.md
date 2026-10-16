<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Shift brief: milestone 4a "feel" and milestone 4 "Find and trust", with milestone 5's engine work and the deep-dive fixes beside them (run by the owner)

**Night shifts:** henri runs the queue in section 0c; for a night shift 0c wins over everything below and over rules sections 4, 10 and 11. **Manual mode (user, 2026-10-12)** otherwise: there is no coordinator. The owner starts each work package as its own session and, when it is done, a short review session that checks and merges it (section 8a). The standing rules in [rules.md](rules.md) still apply (sections 1, 3, 5, 6, 9). Where they say "Henri" or "message", read this brief instead; where the two differ, this brief wins.

## 0. State at start
`phase-1` on 2026-10-14. Merged: milestone 4 packages G0–G6 (with G5f1), R1–R3, R19, R20, A1–A3; milestone 4a packages R5, A5, R6, S1, S2, R7–R10, R13, R14, R15a, R16, R17, R18 (with R18f1, R18f2 and R18f3), F8, R22, R25a, R23, R25b, R25c, R42, R43, R45 and R34; milestone 5's check G15 (P15 holds, 2026-10-15); the deep-dive packages G20 (F28's engine half, 2026-10-15) and G27 (F36, 2026-10-16). The night shift of 2026-10-14 ended after R20 (owner); the owner's verification of 2026-10-14 (`ef857a6`) took the place of its second Opus pass and its report. S2's menu rules (decisions.md "S2: one menu system") are written into the package texts below. No package waits for an APK to be tried (owner, 2026-10-13): a package starts when the one before it is merged. The text of finished packages is in git history. Left for the owner: the unmerged `p1/ron-eve-gestures` (the old flick classifier; backlog C7).

### The path (owner, 2026-10-14; decisions.md "The package path" and "The deep-dive review")
Three lanes run side by side. Each table below gives a package's prerequisites; this is the order.
- **ron, one package at a time** (the owner's day work):
  1. R35 (a lighter start chunk), R21a (pick sheets over the keypad), R21b (the Settings page and Android back).
  2. R11 (history-row actions), while annabell's device run A4a takes place. Then R32 (the stored values under a CAS result, F28) and R36 (why a row has its mark, once G22 is merged; if it is not yet, the lane goes on and R36 follows).
  3. R15b (the top cluster, after A4a's report).
  4. R12a (mockups). While the owner looks at them: R4a (Find on Math), R4b (Vars, Memory, the user keys), R33 (names with a value, marked on the line), R37 (the angle check).
  5. R12b (tokens and history rows), R12c (theme, press feedback, reduced motion), R41 (key labels for TalkBack), then R40 (muted digits past a constant's uncertainty) once G26 is merged.

  The unit-pad packages of 0d (R24a–R24d), R28 (0e) and the backup packages R38a and R38b (0f) go in when their prerequisites are merged.
- **gorge, beside ron** (no UI; the night queue of 0c, which also carries ron's three parser-only packages R29, R30 and R39, and R44, which changes no UI): R29, then R44 (a silent wrong answer from the architecture check; the owner said yes 2026-10-15, F37), R30, G19, G24, then the unit evaluator G16, G17, G18, G25, G13, G22, R39, G14, G23, G26 (sections 0e and 0f). G7 comes when S5 is merged (0d); G21 when G2 item 54 is answered and the owner has decided F29.
- **annabell:** A4a when the owner connects the Tab One, after R21b and before R15b. A6 (one gate command) any time, beside the ron lane: it needs no device. A4b after R4b, which completes milestone 4. A7 and A8 (the release path, section 0g) when the owner says go; they need no device.
- **sandra:** S5 now; then S7 (the docs diet, when no package waits for its review), S6 (files in and out: the backup), S8 (the outside-test protocol). S4 on the owner's go (0d).

**Why this order:**
- R11 uses no key that R15b moves, so it fills the wait for the device run.
- R4a fills the wait for the owner's pick of the mockups, and R12b's token pass then covers Find too.
- gorge's packages have no UI, and R24c needs milestone 5 items 1 and 2.
- Big packages are split where they split cleanly (the owner's rule for the unit pad: about a day or less). R15b and R4a stay whole, since each half would leave the keypad or Find half built.
- **The deep-dive packages (0f, and G16–G18 and G25 in 0e) go by importance, then by what they need:**
  - **P15 holds** (G15, 2026-10-15): the unit evaluator is G16–G18 and G25 on Giac, and the three qalc packages G10–G12 are not needed.
  - **Silent wrong answers next (principle 3).** F24–F26 and F28's engine half are parser or engine work with no UI. So they lead the night queue and do not wait for the ron lane: R29 and R30 (G20 is merged).
  - **Robustness after that.** G19 and G24 are cheap, and G19 must be in before S4 imports libraries into the definitions log.
  - **Day packages sit next to the code they share:** R35 comes before R21a, whose gate is the start-chunk budget: 0.38 kB gzip are left (53.62 of 54 kB, after R34, 2026-10-16).
  - **Trust features after the code they build on:**
    - R32 and R36 add a line to the history rows R11 builds.
    - R33 and R37 touch no key that R15b moves, and R12b's tokens style them.
    - R41 labels the keys once R15b and R12 have placed and styled them.
    - R40 needs G26 and a muted token from R12b.
  - **S7 early:** every later session reads less.

## 0c. Night shifts: henri's plan (owner, 2026-10-14)
The owner plans each night in advance, and the queue below is the next night's. henri (Sonnet, medium) **executes it and decides nothing**: he spawns one fresh agent per step with the prompts below, waits, logs, and spawns the next. After each Opus pass he hands over to a fresh henri (rule 11), so no henri carries a long context. **Low usage comes first:** the aim is to make the 5-hour window last, not to fill it. Whatever is not done stays in the queue for the next night. The night queue is the gorge lane (sections 0e and 0f) plus ron's three parser-only packages (R29, R30, R39) and R44 (the chip value, no UI): no UI, no APK and no device, each checked by its golden, parser and unit tests. The rest of the ron lane runs by day, when the owner can try each APK. The queue is longer than one night: whatever is not done stays for the next one, which resumes from the log.

### Rules for a night shift (they replace rules sections 4, 10 and 11, but not 4a, and change section 8a)
1. **One agent at a time.** Never two workers, or a worker and a reviewer, at once.
2. **A fresh agent for every step:** each package, each review, each fix round and each Opus pass is a new spawn. Never SendMessage to give an agent a second task. Prompts are the templates below with the blanks filled in, nothing more (the agents read the brief themselves).
3. **Spawn in the foreground** (`run_in_background: false`): the call returns when the agent is done (rules section 4a: if a call still comes back as a background launch, log it and wait for its notification, never end the session). This is needed because henri_2 and later run headless, and a headless session ends with its turn. Do not poll, sleep, read diffs, run tests or builds, or read files beyond this brief and `.coord/log.md`.
4. **No devices:** nobody runs `adb` or `build.sh`. annabell is not used at night.
5. **Models:** workers run Sonnet, effort medium (the model in the queue table wins if it says otherwise). Reviews run Sonnet, effort medium (section 8a says Opus; at night Sonnet). Opus passes run Opus, effort medium.
6. **henri decides nothing.** A question, a blocked worker, a conflict or anything this section does not settle: log it and hand it to the next Opus pass (run that pass at once if the question blocks the queue). **Follow every Opus-pass recommendation as written.** Plan changes go to the owner through `docs/decisions.md` "Needs the user", written by the Opus pass.
7. **Start-up:** `date`; `git switch phase-1 && git status` (must be clean; if not, stop and log); `tools/devlock.sh status`. henri_1 appends a section "<date> night" to `.coord/log.md`; a later henri logs `START henri_<n>` under it and reads the log from the last HANDOVER on. No roll call, no device watcher.
8. **Log:** one line per step in `.coord/log.md`: the time from `date +%H:%M` (never estimated), step, agent and model, outcome, commit. The log is the queue state: on a resume, read it and continue from the first step not done.
9. **Usage limit:** if a spawn fails or you hit a limit, log the time, the queue position and `STOPPED henri_<n>`, and end without starting a next henri. No retry loops. The owner resumes with `tools/henri-next.sh <n+1>` (or interactively: `claude --agent henri "Resume the night shift from .coord/log.md."`).
10. **Worker gone without a report** (no report commit): spawn one fresh worker with the same prompt (it continues from the branch's last commit). If that one also fails, log it, leave the branch, and go on with the next package.
11. **A fresh henri after every Opus pass** (owner, 2026-10-14). The owner's interactive session is henri_1. Once an Opus pass has replied, log its reply in full (its FIX lines and QUEUE are the next henri's orders), then log `HANDOVER henri_<n> → henri_<n+1>; next: <step>`, run `tools/henri-next.sh <n+1>` (it takes the next free number if that one was used, and starts a detached headless session that reads this brief and the log; output in `.coord/henri_<n+1>.out`), and end your turn. Do nothing more after that, even if woken: the new henri owns the queue. Your number n is in your prompt (henri_1 if none). The final pass hands over the same way; that henri does its FIX packages and the report.

### The queue (the next nights: the gorge lane of sections 0e and 0f)
Estimates are wall-clock guesses. Each package is: worker, then review; a "fix" verdict adds a fix round (fresh worker, then a fresh review), at most two rounds; after the second "NOT MERGED" leave the branch unmerged, log it, go on. **Opus pass:** after every three finished packages (merged or left unmerged; fix packages from a pass count), and the last pass at the end of the queue (step 22). The last pass's FIX packages get only their Sonnet review, then the report. A package already merged by day is skipped (log it).

**P15 holds** (G15, merged by day 2026-10-15, `7f32949`): steps 9–13 run as listed.

| Step | What | Agent, model | Branch | Est. |
|---|---|---|---|---|
| 1 | G15 units on Giac: the check (decides P15): merged by day (`7f32949`), skip | gorge, **Opus** | `p1/gorge-m5-giacunits` | — |
| 2 | G20 the stored values a CAS result used (F28, engine half): merged by day (`462c163`), skip | gorge, Sonnet | `p1/gorge-m4-uses` | — |
| 3 | R29 where a number ends (F24, F25) | ron, **Opus** | `p1/ron-m4-numbers` | 1 h + review |
| 3a | G27 a result that is not a number but holds a float gets ⚠ (F36): merged by day (`adb2e3a`), skip | gorge, Sonnet | `p1/gorge-m4-symfloat` | — |
| 3b | R44 a long result's chip keeps its value, Ans never dropped (F37; after R29) | ron, Sonnet | `p1/ron-m4-longchip` | 45 min + review |
| 4 | **Opus pass 1** on steps 2–3b, then its FIX packages | Opus | — | 30 min + fixes |
| 5 | R30 ÷ in a flat line (F26) | ron, **Opus** | `p1/ron-m4-flatdiv` | 1 h + review |
| 6 | G19 a safe start (F31) | gorge, Sonnet | `p1/gorge-m4-safestart` | 1 h + review |
| 7 | G24 a memory cap for the Giac worker (F32) | gorge, Sonnet | `p1/gorge-m4-memcap` | 1 h + review |
| 8 | **Opus pass 2** on steps 5–7 | Opus | — | 20 min + fixes |
| 9 | G16 the unit evaluator: factors, dimensions, one term, the end slot | gorge, **Opus** | `p1/gorge-m5-unitcore` | 2 h + review |
| 10 | G17 temperatures and logarithmic units | gorge, Sonnet | `p1/gorge-m5-unittemp` | 1 h + review |
| 11 | G18 uncertainty, first order | gorge, Sonnet | `p1/gorge-m5-unitunc` | 1 h + review |
| 12 | **Opus pass 3** on steps 9–11 | Opus | — | 20 min + fixes |
| 13 | G25 the unit a result is shown in | gorge, Sonnet | `p1/gorge-m5-unitshow` | 1 h + review |
| 14 | G13 the hp and mmHg factors and the data audit | gorge, Sonnet | `p1/gorge-m5-qalcdata` | 1 h + review |
| 15 | G22 why the mark: the reasons as facts | gorge, Sonnet | `p1/gorge-m4-why` | 1 h + review |
| 16 | **Opus pass 4** on steps 13–15 | Opus | — | 20 min + fixes |
| 17 | R39 the real odd root in Home (P5 b) | ron, **Opus** | `p1/ron-m4-oddroot` | 45 min + review |
| 18 | G14 exact results marked ≈ (C9) | gorge, Sonnet | `p1/gorge-m4-marks` | 45 min + review |
| 19 | G23 more precision before ⚠ | gorge, Sonnet | `p1/gorge-m4-escalate` | 1 h + review |
| 20 | **Opus pass 5** on steps 17–19 | Opus | — | 20 min + fixes |
| 21 | G26 the digits a constant's uncertainty leaves | gorge, **Opus** | `p1/gorge-m4-constunc` | 1.5 h + review |
| 22 | **Opus pass 6** (the last) on what came after pass 5, then its FIX packages | Opus | — | 20 min + fixes |
| 23 | Shift report, then stop (the henri started after step 22) | henri_n | — | 10 min |

Not at night: the rest of the ron lane (by day); devices (A4a, A4b); A6; A7 and A8 (the release path); sandra (S4–S8); G7 (it waits for S5); and G21 (it waits for G2 item 54 and the owner's decision on F29).

### Prompt templates (Agent tool; `run_in_background: false`; `effort: "medium"`)
**Worker** (`subagent_type` = the agent in the table, `model` = its model):
> Do package `<ID>` in docs/shifts/brief.md section 7, under the night-shift rules of section 0c. You already run in your own worktree: skip the `git worktree add` step of section 2 and run `git switch -c <branch> phase-1` there (or `git switch <branch>` if the branch exists, and continue from its last commit). End with the report commit of section 2, then reply in at most five lines: branch, last commit, done or not done.

**Review** (`subagent_type: "general-purpose"`, `model: "sonnet"`):
> Review and merge package `<ID>` (branch `<branch>`): follow section 8a of docs/shifts/brief.md with the night changes of section 0c (for a docs-only package such as R15a, skip the test runs). Reply in at most ten lines: `MERGED <merge commit>`, or `NOT MERGED` with the findings (at most five, each with file:line and the fix), plus any item you put under "Needs the user".

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

### Shift report (the last step, the last henri)
`docs/shifts/<date>-night-report.md`, short and plain, from the log and the agents' replies (log `SHIFT DONE` at the end; start no further henri): what was merged (with commits); what is unmerged and why; the Opus passes' NOTES; what the owner must do (items under "Needs the user"); the queue left for the next night. Commit it on `phase-1` with `git commit -s` and the Sonnet trailer. Never push.

## 0b. Milestone 4a packages (P11, signed off by the owner 2026-10-13): **do these first**
Goal: the owner's feedback of 2026-10-13 ([feedback.md](../feedback.md)) and the UI plan ([05-ui-plan.md](../05-ui-plan.md); its **section 7 wins** where it differs). Backlog "Milestone 4a" is binding. The m4 packages of 0a (R4a, R4b, A4b) run between R12a and R12b (section 0, "The path"); A4a is in this table because R15b waits for it.

| # | Package | Agent, model | Branch | Start when merged | Size |
|---|---|---|---|---|---|
| R21a | Pick sheets over the keypad, and fit | ron, **Opus** | `p1/ron-m4a-fit` | R35 (section 0f; it follows the entry-bug packages) | ~1.5 d |
| R21b | The Settings page, and Android back | ron, Sonnet | `p1/ron-m4a-settings` | R21a | ~0.75 d |
| A4a | Device run before R15b | annabell, Sonnet | `p1/annabell-m4a-device` | R21b; the owner connects the Tab One (and the S8+) | ~0.5 d |
| R11 | History-row actions, Home and CAS (U3) | ron, Sonnet | `p1/ron-m4a-rows` | R21b (runs while A4a takes place) | ~1 d |
| R15b | Top cluster: implementation | ron, **Opus** | `p1/ron-m4a-top` (same) | R11, and A4a's report says R15b may start | ~2 d |
| R12a | Visual pass: mockups for the owner | ron, Sonnet | `p1/ron-m4a-look` | R15b (it draws the final keypad) | ~0.5 d |
| R12b | Visual pass: tokens and history rows (U5, U7) | ron, Sonnet | `p1/ron-m4a-look` (same) | R12a approved by the owner, and R4b (so Find is in the pass) | ~1.5 d |
| R12c | Visual pass: theme, press feedback, reduced motion | ron, Sonnet | `p1/ron-m4a-theme` | R12b | ~1 d |

A package starts as soon as the review has merged the one before it. Only the two mockup steps (R15a, R12a) wait, for the owner's pick. **Why these models:** Opus where a mistake breaks entry for every later package: R7 (the sheet every list is built on), R9 (a gesture classifier that misfires corrupts typing), R10, R14 and R18 (parser rules and round trips), R15b (moves keys that every test names), R21a (the layer every pick sheet and the unit pad are drawn on), R27a, R27b and R43 (the ⌫ and cursor paths run on every key press; a wrong step deletes or moves what the user typed). Sonnet elsewhere, with an Opus review per package; R26a and R26b are small and pinned by their tests, and R21b, R11 and R12a–R12c follow existing patterns.

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
Backlog milestone 5 items 1–3, and C9, with no UI: an evaluator, its rules, data and marks. They run now, beside the ron lane and as the night queue (0c), because R24c needs items 1 and 2. P11's reason for doing milestone 4a first (Find and the unit view sit on the keypad and the screen) does not touch them.

**P15 (decisions.md; the owner, 2026-10-14; G15's check passed 2026-10-15):** the unit view computes on Giac, in the worker that is already loaded, with the exact factors of the Find index. libqalculate stays at build time, as the index's source. Items 1 and 2 are G16, G17, G18 and G25. G10–G12, the qalc worker and its adapter as planned before P15, stay written as the fallback and are not run.

Where 0d says "milestone 5 items 1–2 (U1, U2) merged", read the unit evaluator (G16, G17, G25, or G10–G12 on the fallback) and R28. New gorge ids start at G10, because G8 and G9 are ids in the backlog's G2 follow-ups; the deep-dive packages G19–G24 and G26 are in 0f.

| # | Package | Backlog | Agent, model | Branch | Start when merged | Size |
|---|---|---|---|---|---|---|
| G16 | The unit evaluator: factors, dimensions, one term, the end slot | m5 item 1 | gorge, **Opus** | `p1/gorge-m5-unitcore` | now (G15 merged; P15 holds) | ~1 d |
| G17 | Temperatures and logarithmic units | m5 item 2 | gorge, Sonnet | `p1/gorge-m5-unittemp` | G16 | ~0.5 d |
| G18 | Uncertainty, first order | m5 item 2 | gorge, Sonnet | `p1/gorge-m5-unitunc` | G16 | ~0.5 d |
| G25 | The unit a result is shown in | m5 item 2 | gorge, Sonnet | `p1/gorge-m5-unitshow` | G16 | ~0.5 d |
| G13 | The hp and mmHg factors and the data audit | m5 item 3 | gorge, Sonnet | `p1/gorge-m5-qalcdata` | G16 (G12 on the fallback) | ~1 d |
| G14 | Exact results marked ≈ | C9 | gorge, Sonnet | `p1/gorge-m4-marks` | now (any time; Home only) | ~0.5 d |
| R28 | Units mode in the parser | m5 item 2 (ron half) | ron, **Opus** | `p1/ron-m5-unitparse` | R24a and G16 (G12 on the fallback); before R24c | ~1 d |
| G10 | *Fallback only:* qalc glue, the result JSON | m5 item 1 | gorge, Sonnet | `p1/gorge-m5-glue` | P15 falls (it held: G15); not run | ~0.75 d |
| G11 | *Fallback only:* the `UnitEngine` worker and client | m5 item 1 | gorge, Sonnet | `p1/gorge-m5-worker` | G10 | ~1 d |
| G12 | *Fallback only:* the units checks, marks and `units.yaml` | m5 item 2 (gorge half) | gorge, Sonnet | `p1/gorge-m5-adapter` | G11 | ~1 d |

**Why these models:**
- G16 is the arithmetic every unit result rests on (Opus).
- G17, G18, G25, G13 and G14 follow G16's pattern or the golden gate, and their cases pin them; each gets an Opus pass at night (Sonnet).
- R28 adds parser rules with round trips (Opus, as R14 and R18).
- G10–G12 follow the Giac worker's pattern (Sonnet).

## 0d. Packages from the owner's discussion of 2026-10-14 (the Alpha keys, Find, the unit pad, the laptop connection)
Each waits for what its row says; none changes the 0b packages or their order. Background: [feedback.md](../feedback.md) #40–#44, decisions.md "The letters stay" and P14 (decided 2026-10-14), [research/r9-unit-pad.md](../research/r9-unit-pad.md), backlog "Parked ideas" (the laptop connection).

**The unit pad is built in small packages** (owner, 2026-10-14: a session should not run out of tokens): one concern each, about a day or less, with its own short reading list. Read only what your package names. In order: S5 finds the arrangement; G7 puts every id in Find; R24a to R24d build the entry. R24a needs no UI and can start as soon as G7 is merged.

| # | Package | Agent, model | Branch | Start when | Size |
|---|---|---|---|---|---|
| S5 | The unit pad's arrangement and its user cells (research) | sandra, Opus | `p1/sandra-padlayout` | now | ~1 d |
| G7 | Find data for the unit pad and the units menu | gorge, Sonnet | `p1/gorge-m5-finddata` | S5 merged (its test reads the final arrangement); no UI, so it can run beside a ron package | ~0.5 d |
| R24a | The slot model (no UI) | ron, **Opus** | `p1/ron-m5-unitslot` | G7 merged | ~0.5 d |
| R24b | The pad drawn over the keys | ron, Sonnet | `p1/ron-m5-unitpad` | the owner accepted S5's arrangement; R21 merged | ~1 d |
| R24c | The unit view entry: slots, Enter, evaluation | ron, **Opus** | `p1/ron-m5-unitview` | R24a, R24b, R28 and the unit evaluator (G16, G17, G25; G10–G12 if P15 falls) merged | ~1 d |
| R24d | Find in a slot and the user cells | ron, Sonnet | `p1/ron-m5-usercells` | R24c, R4 and R15b merged | ~0.5 d |
| S4 | The laptop connection: design note | sandra, Opus | `p1/sandra-connector` | the owner's go (parked until about 2026-10-20) | ~0.5 d |

**Why these models:** R24a builds the slot model the parser reads and R24c ties pad, slots and evaluation together, so a mistake there corrupts unit entry everywhere (Opus, as R9 and R18). R24b draws on R21's layer and R24d stores cells as R15b stores the user keys; each follows an existing pattern and its tests pin it (Sonnet). G7 is data and one test (Sonnet). S4 and S5 are research with probes (sandra runs Opus).

**Not packaged yet:** the rest of backlog milestone 5 item 4, the result view (value, mark, unit, dimension, one-tap alternatives, `units.targets`, the `\res` chip back to Home). It gets its packages when G16 and G25 are merged (G10–G12 if P15 falls), since their reports fix what a result carries.

## 0f. Packages from the deep-dive review (owner, 2026-10-14)
The owner asked for a deep dive (feedback #47) and accepted all 24 findings. They are in decisions.md "The deep-dive review", P15 and P5. **Each package is small:** one concern, about a day or less, with its own reading list (the owner, feedback #48). Read only what your package names.

The order is by importance, then by what each needs (section 0, "The path"):
1. silent wrong answers;
2. robustness;
3. trust features;
4. process.

The milestone 5 packages that P15 brings (G16–G18, G25) are in 0e. Every "behaviour today" below was probed on 2026-10-14, on the dev engine (`tools/probes/engine.ts`, `tools/probes/parse.ts`) or in the code.

| # | Package | Finding | Lane | Agent, model | Branch | Start when merged | Size |
|---|---|---|---|---|---|---|---|
| R29 | Where a number ends | F24, F25 | night | ron, **Opus** | `p1/ron-m4-numbers` | now | ~0.5 d |
| R44 | A long result's chip keeps its value, and Ans is never dropped | F37 (architecture check, 2026-10-15) | night | ron, Sonnet | `p1/ron-m4-longchip` | R29 (chips, same tests) | ~0.25 d |
| R30 | ÷ in a flat line | F26 | night | ron, **Opus** | `p1/ron-m4-flatdiv` | R29 (same file) | ~0.5 d |
| G19 | A safe start | F31 | night | gorge, Sonnet | `p1/gorge-m4-safestart` | now | ~0.5 d |
| G24 | A memory cap for the Giac worker | F32 | night | gorge, Sonnet | `p1/gorge-m4-memcap` | now | ~0.5 d |
| G22 | Why the mark: the reasons as facts | review item 14 | night | gorge, Sonnet | `p1/gorge-m4-why` | now | ~0.5 d |
| R39 | The real odd root in Home | P5 (b) | night | ron, **Opus** | `p1/ron-m4-oddroot` | R30 (same file) | ~0.25 d |
| G23 | More precision before ⚠, and no unconfirmed digit | review item 13 | night | gorge, Sonnet | `p1/gorge-m4-escalate` | G22 (same file) | ~0.5 d |
| G26 | The digits a constant's uncertainty leaves | review item 17 | night | gorge, **Opus** | `p1/gorge-m4-constunc` | G23; and G18 if P15 holds | ~0.75 d |
| G21 | `exp` ignores the angle mode | F29 | night | gorge, Sonnet | `p1/gorge-m4-expdeg` | G2 item 54 answered and the owner's decision on F29 (decisions.md) | ~0.25 d |
| R35 | A lighter start chunk | review item 11 | day | ron, Sonnet | `p1/ron-m4a-slim` | R34 | ~0.5 d |
| R32 | The stored values under a CAS result | F28 | day | ron, Sonnet | `p1/ron-m4a-uses` | R11 | ~0.5 d |
| R36 | A picked row says why it has its mark | review item 14 | day | ron, Sonnet | `p1/ron-m4a-why` | R32 (same file) and G22 | ~0.5 d |
| R33 | Names with a value, marked on the line | review item 15 | day | ron, Sonnet | `p1/ron-m4a-namemarks` | R4b | ~0.5 d |
| R37 | The angle check | review item 16 | day | ron, Sonnet | `p1/ron-m4a-anglecheck` | R33 | ~0.75 d |
| R41 | Key labels for TalkBack | review item 19 | day | ron, Sonnet | `p1/ron-m4a-labels` | R12c | ~0.5 d |
| R40 | Muted digits past a constant's uncertainty | review item 17 | day | ron, Sonnet | `p1/ron-m4a-constdigits` | R41 and G26 | ~0.5 d |
| R38a | The backup: export everything | review item 18 | day | ron, Sonnet | `p1/ron-m4-backup` | S6, and the owner's yes to its proposal | ~0.5 d |
| R38b | The backup: restore from a file | review item 18 | day | ron, **Opus** | `p1/ron-m4-restore` | R38a | ~0.75 d |
| A6 | One gate command | review item 21 | any time | annabell, Sonnet | `p1/annabell-gate` | now (no device) | ~0.5 d |
| S7 | The docs diet | review item 20 | sandra | sandra, Opus | `p1/sandra-docsdiet` | S5, and no package waiting for its review | ~0.5 d |
| S6 | Files in and out without INTERNET: the backup | review item 18 | sandra | sandra, Opus | `p1/sandra-files` | S7 | ~0.5 d |
| S8 | The outside-test protocol | review item 24 | sandra | sandra, Opus | `p1/sandra-outside` | S6 | ~0.25 d |

**Why these models:**
- **Opus:**
  - R29, R30 and R39 change parser rules, and a slip there computes a different number (as R14 and R18).
  - G26 is precision maths every inexact constant passes through.
  - R38b overwrites the user's stored data.
  - The sandra packages are research and rewriting (sandra runs Opus).
- **Sonnet:** everything else follows an existing pattern and is pinned by its tests.

**Not a package:**
- The MathLive bug report (review item 23) is in backlog "Needs the user" item 6.
- The largest-font check (item 19) is in A4a.

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
  A test that passes on the old code is not a regression test: change it until it fails there, or list it under "Not done".
- **Numbers:** for example the start chunk size before and after, or timings.
- **For shared files:** exact text for the backlog, decisions, THIRD_PARTY.md, docs/04.
- **Needs a decision:** anything left open.
- **Not done:** what's missing.

Then end your turn with two commands for the owner, ready to paste, and nothing to try on a device:
- the review: `claude --model opus "Review and merge package <ID>: follow section 8a of docs/shifts/brief.md."`
- the next package once this one is merged: the next ID on "The path" (section 0) whose prerequisites will then be met, as section 0a "How to start a package" writes it, with the agent and model from its table.

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
   - whether Android sends `pointercancel` for a touch held while the app leaves (F11 and F12 are fixed in the app either way);
   - ᴇ drawn on the S8+'s Chrome 101 WebView;
   - the largest system font size (Android Settings › Display): do the keypad, the status line and a sheet still fit? If not, the report names what breaks (deep-dive item 19);
   - if G24 is merged: the input its report names goes past the memory cap, ends in the "Out of memory" message, and the app stays up;
   - if R35 is merged: the first tap after a cold start vibrates.

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

### gorge, G16: the unit evaluator: factors, dimensions, one term, the end slot, branch `p1/gorge-m5-unitcore`
Backlog milestone 5 item 1 (P15). Starts now (G15 merged 2026-10-15; P15 holds). No UI. Read:
- decisions.md P15, and G15's report and probe;
- docs/04 2.4 (marks), and 4.2, 4.3 and 8.2 as G15's merge left them;
- `app/src/engine/host.ts` (`home()`: how a request runs in the worker);
- `app/src/engine/numeric.ts` (the agreement check);
- `app/src/find/rank.ts` (`prepare()`, the item shape);
- `app/src/calc/port.ts`.

Defaults from G15 (decisions.md "G15: rpm → Hz, and the units with no exact factor"):
- a bare number inside sin, cos or tan follows the Home angle mode, as Home does (the probe read it as radians);
- `rpm → Hz` and `rad/s → Hz` are refused (angle·T⁻¹ vs T⁻¹), since rad stays in the dimension key;
- a unit with no exact factor (the 24 Planck, atomic and natural units, the solar mass) is refused with a message naming it, until G13 adds it.

Commits in this order:
1. **Tests first.**
   - `tests/golden/units.yaml`, a new section of the golden gate, sources `derived` or `oracle`:
     - the conversions and prefixes of the 26 spike cases;
     - `72 km/h → m/s` = 20 `=`, and `1 in → mm` = 25.4 `=`;
     - `1/3 m → cm` = 100/3, shown ≈ 33.3333333333;
     - `1 lbf → N` exact;
     - a mismatch: `1 m + 1 s` gives "Units don't match: L vs T";
     - an end slot that does not fit names both dimensions;
     - a unit with no factor is refused with a message naming it.

     Temperatures, logarithmic units and ± wait for G17 and G18.
   - A Vitest for the builder (tokens → Giac text): prefixes, powers, ÷, √, and a user cell's prefixed unit.
2. **The input:**
   - the formula as Giac text from our parser, with a placeholder per slot (`pasu1`, `pasu2`, …);
   - per slot, R24a's token list (prefix id, unit id, power, the place of the ÷);
   - the optional end slot.

   The factor table comes from the Find index (units' `si` and `dim`, prefixes' powers of ten). It loads with the unit view, never in the start chunk. The report gives the exact input type, for R28 and R24c.
3. **The evaluator** (`app/src/units/`, plain TS, plus a `units` request in the Giac worker beside `home`, so Cancel works as for Home):
   - it substitutes each slot by its factor times the dimension symbols, evaluates exactly, checks for one term, and converts to the end slot when there is one;
   - the result is a `Quantity` (docs/04 8.2): the value as an exact fraction or P digits, the dimension, and the SI value;
   - its mark comes from the same facts and `markOf()` as Home: an irrational value goes through the agreement check, as in Home.
4. **`Calc.units()`** returns it (docs/04 8.2, as G15's merge rewrote it).

Gate: the golden gate with the units section; vitest; typecheck; the size test (start chunk unchanged). Report: the input type and two examples, for R28, R24c, G17, G18 and G25.

### gorge, G17: temperatures and logarithmic units, branch `p1/gorge-m5-unittemp`
Backlog milestone 5 item 2 (P15). Starts when G16 is merged. Read docs/04 4.3 ("Temperature", "Logarithmic units"), G16's report, and its section of `units.yaml`.
1. **Tests first** (`units.yaml`, `derived`):
   - `20 °C → °F` = 68 `=`; `100 °F → °C` = 340/9; `300 K → °C` = 537/20; `20 °C → K` = 5863/20.
   - `20 °C × 2` and `20 °C + 5 K` are refused: "Use K or Δ°C for a temperature difference".
   - Δ°C and Δ°F (Find items), K and °R work as differences.
   - `1 W → dBm` = 30; `1 Np → dB` = 20/ln(10) ≈ 8.68588963807.
   - A dB value inside a product is refused: "dB converts only".
2. **The rules** in the evaluator:
   - An absolute temperature (°C, °F) is allowed only alone, as the whole quantity, and converts with its offset.
   - A logarithmic unit (dB, dBm, dBW, Np, B) is allowed only alone, and converts by its log rule.
   - Messages go through the i18n table.

Gate: golden gate (units), vitest, typecheck.

### gorge, G18: uncertainty, first order, branch `p1/gorge-m5-unitunc`
Backlog milestone 5 item 2 (P15); it settles decisions.md M4-2 point 2. Starts when G16 is merged. Read docs/04 2.6 (copy) and 4.3, G15's report (its uncertainty sketch), G16's report, and t10 in `tests/tasks/tasks.yaml`.
1. **Tests first** (`units.yaml`):
   - `(12.34 ± 0.05) m × (3.2 ± 0.1) m` = 39.488 ± 1.2443295383… m² (`derived`, first order), shown as 39.5 ± 1.2 m², the uncertainty to 2 significant digits (docs/04 2.6);
   - a sum, a quotient, a power and a `sqrt` of uncertain values (`derived`);
   - a value without ± carries no uncertainty;
   - a constant chip with a CODATA uncertainty (G) carries it.
2. **The rule:** σ = sqrt(Σ (∂f/∂xᵢ · σᵢ)²), computed exactly by Giac (`diff`), with the inputs treated as independent, then evaluated to P digits. A result with a σ is always `≈`.
3. **M4-2 point 2:** the report gives the shared-file text: docs/04's `39.5 ± 1.3` becomes `39.5 ± 1.2`, and t10 gets its expected value.

Gate: golden gate (units), vitest, typecheck.

### gorge, G25: the unit a result is shown in, branch `p1/gorge-m5-unitshow`
Backlog milestone 5 item 2 (P15; docs/04 4.3 "Result"). Starts when G16 is merged. Read docs/04 2.7 (SI prefixes) and 4.3 "Result", and G16's report.
1. **Tests first** (`units.yaml`):
   - Without an end slot, a result is shown in the units typed when they fit its dimension: `5 N × 2 m` stays N·m, not J.
   - Otherwise it is shown in SI with an SI prefix: `4.7 kΩ × 2.2 nF` = 10.34 µs.
   - The dimension text: `L·T⁻¹`, `M·L²·T⁻²`.
   - An end slot always wins.
2. **Build** the choice and the dimension text into the result (`Quantity.unit`, `Quantity.dimension`). `units.targets` and the way back to Home belong to the result view (0d, not packaged yet).

Gate: golden gate (units), vitest.

### gorge, G10 (fallback only): qalc glue, the result JSON, branch `p1/gorge-m5-glue`
**Fallback only** (decisions.md P15): it would run only if P15 fell; G15 showed that it holds (2026-10-15). Backlog milestone 5 item 1, part 1. No UI. Read docs/04 4.1, 4.2, 8.2 (`Quantity`, `UnitError`) and Appendix C; `engine/qalc/glue.cc` (today `qalc_set_precision`, `qalc_parse`, `qalc_print`, `qalc_eval`: JSON for the Find index generator), `engine/qalc/smoke.mjs`, `engine/qalc/cases.yaml` with `check.py` and `run-cases.mjs` (the 26 spike cases).
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

### gorge, G11 (fallback only): the `UnitEngine` worker and client, branch `p1/gorge-m5-worker`
**Fallback only** (decisions.md P15). Backlog milestone 5 item 1, part 2. Starts when G10 is merged. No UI. Read docs/04 4.2, 6.1 and 8.2 (`Calc.units()`, `UnitEngine`), G10's report, and the Giac worker's pattern in `app/src/engine/` (`workerEngine.ts`, `giac.worker.ts`, `protocol.ts`).
1. **Tests first** (Vitest in `app/src/units/`, with the qalc dev build from `QALC_OUT`):
   - `evaluate()` returns G10's result as a `Quantity` or a `UnitError`;
   - `cancel()` terminates and respawns the worker, and the next call works;
   - nothing loads qalc before the first call (lazy);
   - a cancel during the load.
2. **Build** the worker and client in `app/src/units/` on the Giac worker's pattern: an async interface, a module worker, Cancel = terminate and respawn, nothing to replay. Add `Calc.units()` as docs/04 8.2 names it. Nothing in the start chunk imports it.

Gate: the worker tests, typecheck, vitest; the size test (start chunk unchanged). Report: the client's API, for G12, R28 and R24c.

### gorge, G12 (fallback only): the units checks, marks and `units.yaml`, branch `p1/gorge-m5-adapter`
**Fallback only** (decisions.md P15). Backlog milestone 5 item 2, the gorge half (the parser half is R28). Starts when G11 is merged. No UI and no parser: the input is qalc text from whitelisted names, as R24a's slot model and R28 will build it. Read docs/04 2.4 (marks), 2.7 (SI prefixes), 4.3 ("Our adapter checks", "Result", "Temperature", "Logarithmic units") and 8.2 (`UnitError`), G11's report, `app/scripts/golden.ts`.
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

### gorge, G13: the hp and mmHg factors and the data audit, branch `p1/gorge-m5-qalcdata`
Backlog milestone 5 item 3 (P3 decision 3; docs/04 2.3 #10 and 4.5). Starts when G16 is merged (G12 on the fallback). No UI. Read:
- decisions.md P15;
- `find/units.yaml` (its `checks` and `known` entries) and `tools/find-index/generate.mjs`;
- backlog "Needs the user" item 6;
- on the fallback only: `engine/giac/patches/README.md` (the pattern) and `engine/qalc/build-wasm.sh`.

Steps:
1. **Tests first** (`units.yaml`, failing today):
   - `1 hp → W` = 745.69987158227022 W (550 ft·lbf/s, `derived`);
   - `1 mmHg → Pa` = 133.322387415 Pa (13.5951 g/cm³ × 1 mm × 9.80665 m/s², `derived`).
2. **The factors.** With P15 the unit view reads the index's factors, so the fix lives in the index:
   - `find/units.yaml` gives hp and mmHg their exact factors (`derived`), and the generator takes ours over qalc's;
   - a check fails once qalc's data agrees, so the override comes out then (today's `known` mark, turned round).

   On the fallback (qalc at run time): a minimal patch of `units.xml` in `engine/qalc/patches/` with a README, applied by `build-wasm.sh`. The SHA-checked tarball stays untouched.
3. **The audit, once:** every unit and constant in Find's index against its exact definition and CODATA 2022. Each difference becomes an override (or, on the fallback, a patch) with a case, or a `known` entry with its reason.
4. **Upstream:** the report holds the text of the libqalculate issues for the owner (backlog "Needs the user" item 6).

Gate: the golden gate (units) and `npm run index` clean. On the fallback also the qalc dev build; the release build picks the patch up through `build-wasm.sh`, and annabell checks it in milestone 5 item 5.

### gorge, G14: exact results marked ≈, branch `p1/gorge-m4-marks`
Backlog C9. Home only; can run at any time. Read docs/04 2.4, `app/src/engine/homeEval.ts`, `markOf()` in `app/src/engine/format.ts`, `decideFloatTest` in `app/src/engine/homeEval.ts` (R18f2), and the render of an unevaluated test (`app/src/render/home.ts`).
1. **Tests first** (golden, `derived`):
   - `mod(7.5,2)` = 1.5 with the `=` mark: the typed 7.5 is exact (15/2), and so is the remainder 3/2.
   - A test that stays as typed shows its decimal as typed: `romberg(exp(-x^2),x,0,1)==0.746824132812` is drawn with `0.746824132812`, not `746824132812/10^12`.
2. **Fix** where the mark goes wrong (the exact-first path, the agreement check or `markOf`) and where the rewritten literal reaches the display. The render file is ron's; the change there stays as small as the fix needs.

Gate: the golden gate (home, precision), vitest, typecheck.

### ron, R28: units mode in the parser, branch `p1/ron-m5-unitparse`
Backlog milestone 5 item 2, the ron half. **Its text is written when R24a has reported** (the slot tokens) **and G16 has reported** (the evaluator's input; G12 on the fallback). Until then nobody starts it. Scope from the backlog:
- `\pm` (uncertainty) and `\to` (the end slot), in units mode only;
- the formula as Giac text with a placeholder per slot, the slots as R24a's tokens (G16's input; on the fallback, qalc text from whitelisted names only);
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
   - A static phone-size mockup, `docs/mockups/unit-pad.html` (light and dark, like `top-cluster.html`), so the owner can judge it.
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
2. **Onto the phone without the INTERNET permission:** take S6's answer (`docs/research/r11-files.md`, the backup file's way in and out), and add only what a library file needs beyond it.
3. **Import and export:** into the `defs` log with a name-clash rule and the `DATA_VERSION` stamp; the replay time at 200 definitions; how the functions appear in Vars and Find (kind `userfn`, description from the comment) and on a user key (U1–U3); export the other way.
4. **The laptop side:** the desktop web app as the test bench (same engine, same marks); a small Node command around `app/src/engine/nodeGiac.ts` that runs a library file and its tests (the MCP or AI hook would sit on the same). Cost and licence of each part.
5. Removal test, cost per worker, what would change it. No feature code: probes and the note only.

### ron, R24a: the slot model, branch `p1/ron-m5-unitslot`
The first of four unit-pad packages, with no UI. Read: r9 section 2 (the rules), docs/04 4.3 (Grammar per slot), r7 section 5.4 (the guards), and `typePad` in `tools/probes/unit-presses.mjs`.
1. **The MathLive check: done** (sandra, throwaway probe, 2026-10-15; docs/04 4.3 and r6 section 7). Prompt values hold a stacked fraction, powers, products, √ and a prefixed unit, and ◀ ▶ go prompt to prompt in a read-only field. Two consequences for the model: MathLive merges neighbouring upright names when it reads a prompt back (`\mathrm{k}\mathrm{\Omega}` → `\mathrm{k\Omega}`), so the token list is the only source and the LaTeX is output only; and the field is written only through `setPromptValue` (R24c).
2. **Tests first** (`app/src/units/slot.test.ts`), one per rule of r9 sections 2.2–2.6:
   - A prefix arms; another replaces it; the same one again disarms it.
   - Units in a row multiply; one ÷ per slot.
   - ², ³, ⁴ and ⁻¹ act on the unit before, √ on the unit after.
   - ⌫ removes the last token.
   - A prefix alone and a second ÷ are refused, with a message from the i18n table.

   Also, for every unit of the probe's 50 and of S5's weights list, the model's tokens give the same prefixes, units and powers as `typePad`'s parts.
3. **The model** (`app/src/units/slot.ts`, plain TS): a token list per slot (prefix id, unit id, power, the place of the ÷). It gives:
   - the LaTeX shown;
   - the token list the unit evaluator reads (G16; on the fallback, qalc text from whitelisted ids only, for G12);
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
Starts when R24a, R24b, R28 and the unit evaluator (G16, G17, G25; G10–G12 if P15 falls) are merged. Read: r9 sections 2.1, 2.7 and 2.8, docs/04 4.3, and the reports of R24a and R24b.
1. **Tests first** (`app/test/unitpad.spec.ts`), by keys and by touch:
   - The units key on a line, on a picked history row, and on an empty line (quantity 1) opens the slots with the pad up.
   - Pad presses fill the active slot, and the reading under the formula follows every press.
   - Enter goes to the next slot, Enter in the end slot evaluates, and a flick up on Enter evaluates at once.
   - ◀ ▶ move between slots, and Esc keeps the slots with the line.

   Also replay as e2e the 44 of the probe's 50 units that sit on the draft pad, each within the probe's count. The other six go through Find in R24d. Tasks t02 and t04 must be within their plans.
2. **Build:**
   - The read-only formula with a slot after every number (docs/04 4.3). Write a slot only with `setPromptValue` from R24a's model: `insert()` with the caret outside a prompt still changes the read-only formula (probe, 2026-10-15). Keys reach the active slot through `press()` (docs/04 5.5 point 2: the slot owns the key while it is active), never through `EntryController.run`; give the unit view's field a capture `keydown` like `entry/hwkeys.ts`, so a hardware key reaches the pad's actions or does nothing, and never types into a prompt as MathLive text.
   - R24a's model per slot, with R24b's pad up while a slot is active.
   - Evaluation through the unit evaluator (`Calc.units()`), with the result shown as it returns it. The full result view is not packaged yet (section 0d).
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

### Packages of section 0f
Every package here: tests first (they fail on today's code), then the fix, then the report commit (section 2). The finding, its evidence and the decision are in decisions.md "The deep-dive review"; the backlog line is under "Trust and robustness".

### ron, R44: a long result's chip keeps its value, and Ans is never dropped (F37), branch `p1/ron-m4-longchip`
From the architecture check of 2026-10-15 (sandra; docs/04 2.3 #18). Starts when R29 is merged (the same chip code and tests; the owner said yes, 2026-10-15). Read: docs/04 2.3 #18 and 2.8, `app/src/state/session.svelte.ts` (`finish()` around line 446, `chipFor`, `lastChip`), `app/src/App.svelte` (`insertResult`, the Ans-first branch of `run()`), `app/src/engine/homeEval.ts:485` (what `full` holds), `app/src/input/parse.ts:634` (a missing chip).

**Behaviour today** (probes 2026-10-15): Home `2^10000` shows `≈ 1.99506311688E3010` (right). Tap it, `×1`, Enter: `= 1.99506311688E3010`, marked exact, for a value that is not 2^10000. Then `+3` on the empty line gives `= 3`, not Ans + 3.

**Cause:** `finish()` keeps `r.exact ?? r.full` as the chip value, and only when it is ≤ 2 kB. 2^10000's exact text has 3,011 digits, so the item gets no chip: `insertResult` inserts the drawn LaTeX (`1.99506311688\times10^{3010}`, an exact number to the parser), and `lastChip()` gives nothing, so Ans-first inserts no `\ans` and the parser reads `+3` as 3. `homeEval` already puts the right value in `r.full`: the exact text up to 2 kB, else the P-digit decimal.

**Commits:**
1. **Tests** (failing today; e2e in `app/test/chips.spec.ts` with the real engine, since the value matters): tap `2^10000`, `×1` → mark `≈` and the first 15 digits 1.99506311688075 (`oracle`); `2^10000` then `+3` → the line starts with Ans and the result is `≈ 1.99506311688E3010`; a short exact result still gives an exact chip (`1/3`, tap, `×3` → `= 1`, docs/04 2.3 #8).
2. **Fix:** the chip value is the engine's `full` (CAS: `numeric.full` when there is one), with `fullExact` following it. Ans-first inserts `\ans` whenever the view has a finished result; a result with no chip value (a symbolic text over 2 kB) then fails at Enter with a message that says why (today's text, "Ans: no result to use in this view yet", is wrong for it). The drawn LaTeX goes in only for a result that is not a number.
3. **Report.**

Gate: chips, entry and tasks e2e; vitest; typecheck; the start chunk within its budget.

### ron, R32: the stored values under a CAS result (F28, UI half), branch `p1/ron-m4a-uses`
Starts when R11 is merged (G20 is, `462c163`). Read:
- G20's report (`git log -1 dd0f65c`) and the open point decisions.md "G20: a name the input binds";
- `app/src/views/History.svelte` (a CAS row) and R11's row code;
- `app/src/i18n/en.ts`;
- docs/03 rule 9 (vertical space).

Commits in this order:
1. **Tests first** (`app/test/uses.spec.ts`):
   - Home `3 ▶ x`, then CAS `factor(x^2-1)`: under the result, a muted line "x = 3 · stored in Home";
   - a CAS result without a stored name has no line;
   - the line comes back after a reload (the history item stores `uses`).
2. **Build:**
   - The line goes under the CAS result, in the mark's muted style: one line, with "+2" after three names.
   - A tap on it does nothing new. Actions live in the picked row's Menu (R11), and Memory (R4b) deletes a stored value.

Gate: the e2e, the history performance test unchanged, the viewport share unchanged, start chunk within 0.3 kB gzip. **Removal test**, for the report: if the owner finds the line noisy after two weeks, it is shown only for values stored in another view.

### ron, R29: where a number ends (F24, F25), branch `p1/ron-m4-numbers`
Backlog F24 and F25. Parser only, no UI (night queue). Read:
- `app/src/input/parse.ts`: the lexer's number branch (lines 99–120) and `atom`;
- `app/src/input/chips.ts`, and `app/src/entry/macros.ts` (how a chip is drawn);
- `tests/golden/parser.yaml` (the arithmetic and implicit-multiplication groups);
- `tools/probes/parse.ts`.

**Behaviour today** (`tools/probes/parse.ts`):
- **F24:**
  - `2.5.3` → `2.5*.3`: 0.75, marked `=`. The keys type it: 2 . 5 . 3.
  - `1..5` → `1.*.5`, and `.5.5` → `.5*.5`.
- **F25** (with a chip table):
  - `\res{1}{0.5}3` → `(1/2)*3`;
  - `3\res{1}{0.5}` → `3*(1/2)`;
  - `\res{1}{0.5}\res{2}{0.25}` → `(1/2)*(1/4)`.

  The chip is a shaded box with the result's digits, so the line shows [0.5]3 with no × between them. On the G2 a tapped result lands as text, and a digit typed after it extends the number (0.53). `\ans3` is drawn as [Ans]3 and stays as it is.

Commits in this order:
1. **Tests first** (`parser.yaml`, error cases, `derived`):
   - every input above is an error;
   - kept as today: `\ans3`, `2\pi`, `3x`, `5.` (a trailing point), `\left(2\right)3`, `\res{1}{0.5}\times3`, a constant chip after a number (`2\const{c}{c}`: a symbol, not digits), and every keyboard template's round trip.
2. **Fix:**
   - A second decimal point (or decimal comma) inside a number is an error: "a number has one decimal point".
   - A number directly before or after a `\res` chip, or two `\res` chips side by side, is an error that names the fix: "put × between a result and a number".
   - Messages go through the i18n keys the parser uses.
3. **G2 items 55 and 56:** if the owner has answered them, the report says so. An answer that differs goes under "Needs a decision"; the error stays the default (principle 3).

Gate: the parser golden cases, the golden gate (parser), vitest, typecheck.

### ron, R30: ÷ in a flat line (F26), branch `p1/ron-m4-flatdiv`
Backlog F26. Parser only (night queue). Starts when R29 is merged (same file). Read:
- `app/src/input/parse.ts` `term()` (lines 355–376): ÷ and / take `signedImplicit()` on their right, so an implicit product binds tighter than the division;
- `tests/golden/g2.yaml` item 6;
- `parser.yaml` (the arithmetic, fractions and implicit-multiplication groups);
- the `line:` inserts in `spec/keyboard.yaml` (one-line ÷ is `\div`).

**Behaviour today:**
- `1/2x` → `1/(2*x)`;
- `6\div2\left(1+2\right)` → `6/(2*(1+2))` = 1;
- `1\div2\sqrt{3}` → `1/(2*sqrt(3))`;
- `8\div2\times4` → `8/2*4` = 16.

Textbook entry is not affected: there ÷ makes a stacked fraction.

**On the G2** (item 6, Virtual Calculator): pasted one-line `1/2x` is (1/2)·x. Typed in textbook entry without →, `1 ÷ 2 x` is 1/(2x), which our stacked fraction already gives. Item 6's answer says "matches our rule"; it no longer does.

Commits in this order:
1. **Tests first** (`parser.yaml`, `derived` from the G2's rule in item 6):
   - `1/2x` → `1/2*x`;
   - `6\div2\left(1+2\right)` → `6/2*(1+2)` = 9;
   - `1\div2\sqrt{3}` → `1/2*sqrt(3)`;
   - `a\div bc` → `a/b*c`;
   - unchanged: `\frac{1}{2x}`, `\frac{1}{2}x`, `8\div2\times4`, `1\div x^{2}` (a power is one factor), and every keyboard template's round trip.
2. **Fix:** in a flat line, ÷ and / take one factor on their right (a number, a name, a power, a function call or a bracket). The product then goes on left to right, as with ×.
3. **G2 item 53** (`6÷2(1+2)` in one-line entry): if it is answered, the report says so. A different answer goes under "Needs a decision".

Gate: the parser golden cases, the golden gate (parser), vitest; the task benchmark unchanged.

### ron, R39: the real odd root in Home (P5 b), branch `p1/ron-m4-oddroot`
decisions.md P5 (b), as revised on 2026-10-14. Parser only (night queue). Starts when R30 is merged (same file). Read:
- `app/src/input/emit.ts`: `realOddRoots` (line 13) and the root template (lines 205–215);
- where Home, Solve, Function and CAS set their serialize options;
- `app/src/input/emit-js.ts`, the plot evaluator;
- `tests/golden/g2.yaml` items 4 and 11;
- `parser.yaml` (roots and powers).

**Behaviour today:**
- `\sqrt[3]{-8}` → `surd(-8,3)` = −2 (L6).
- In Home, `\left(-8\right)^{\frac{1}{3}}` gives the principal root, 1+1.73205080757·i.
- The G2 gives −2 for `(-8)^(1/3)` in Home (items 4 and 11, Virtual Calculator).

Commits in this order:
1. **Tests first** (`parser.yaml` and `home.yaml`: `virtual-calc` for −2, `derived` otherwise). In Home:
   - `\left(-8\right)^{\frac{1}{3}}` = −2;
   - `\left(-8\right)^{\frac{2}{3}}` = 4;
   - `\left(-32\right)^{\frac{1}{5}}` = −2;
   - with −8 stored in X, `X^{\frac{1}{3}}` = −2;
   - an even denominator keeps the principal root: `\left(-8\right)^{\frac{1}{2}}` = 2.82842712475·i, as `sqrt(-8)` (P5 a);
   - an exponent that is not a literal fraction keeps Giac's power.

   In CAS, `(-8)^(1/3)` is unchanged. In the plot evaluator, `x^{1/3}` at x = −8 is −2.
2. **Fix:** with `realOddRoots`, now set for Home, Solve and Function but not CAS, a power whose exponent is a literal fraction p/q in lowest terms, with q odd, becomes `surd(base,q)^p`. The plot evaluator does the same.

Gate: parser and home golden cases, the golden gate, vitest.

### gorge, G19: a safe start (F31), branch `p1/gorge-m4-safestart`
Backlog F31. No UI beyond one message. Read:
- `app/src/engine/workerEngine.ts`: `start()` and `onerror` (lines 210–235), and the stored log's `define` message (lines 79–100);
- `app/src/engine/host.ts` `restore()` (lines 166–179);
- `app/src/engine/defs.ts` and `app/src/state/storage.ts`.

**Behaviour today:**
- `restore()` replays every stored definition with no guard.
- If one of them crashes the worker (out of memory, an engine abort), `onerror` restarts it and replays the same log again, and again.
- So the engine is never ready, and only clearing the app's data gets out, which loses the history and every definition.
- The risk grows once S4 imports libraries into the log.

Commits in this order:
1. **Tests first** (`workerEngine.test.ts`, with its fake worker):
   - a log whose replay crashes the worker twice: the third start runs without the log, `ready()` resolves, and the client reports `safeStart: { skipped: n }`;
   - the stored log stays untouched (for Memory and for R38a's export);
   - a replayed entry that only gives a Giac error does not count as a crash: the rest replays, as today.
2. **Build:**
   - Count failed starts in the stamped store, so a crash that kills the whole app counts too: write the count before the replay and clear it once `ready` is reached.
   - At two failed starts, start without the log and say so once, in a history line from the i18n table: "Your stored definitions were not loaded because they stopped the engine; Memory lists them."
   - The App side of that line is one small change in `App.svelte`, which the review accepts as part of this package.

Gate: vitest, typecheck, the start-up e2e unchanged, `replayMs` unchanged.

### gorge, G24: a memory cap for the Giac worker (F32), branch `p1/gorge-m4-memcap`
Backlog F32. Read:
- `engine/giac/build-wasm.sh` (line 188: `-sALLOW_MEMORY_GROWTH=1 -sINITIAL_MEMORY=64MB`, no `MAXIMUM_MEMORY`, so Emscripten's default of 2 GB) and `engine/giac/build-wasm-release.sh`;
- `app/src/engine/workerEngine.ts` (`onerror`, line 222: a crash restarts and replays);
- `app/src/i18n/en.ts`.

**Today:**
- A CAS job that keeps allocating can grow the worker toward 2 GB.
- On the 3.9 GB Tab One, Android may then kill the whole app (the worker lives in the WebView's renderer), not just the worker.
- The user sees the app restart and loses the half-typed line (F30).

Commits in this order:
1. **Tests first** (Node, with the dev build):
   - a job that goes past the cap ends in an "out of memory" result, not a hang, and the next call works after the restart and replay;
   - in `workerEngine.test.ts`: a worker error during a call gives the caller a `memory` error, with the i18n message "Out of memory: the engine was restarted".

   Name the input that goes past the cap in the report, for A4a.
2. **Build:**
   - `-sMAXIMUM_MEMORY=1GB` in the dev and release scripts (the P2 container's flags too);
   - `-sABORTING_MALLOC=1` if a failed allocation does not abort by default;
   - the client turns a worker abort during a call into that error.
3. **Rebuild** the dev engine under the host-cpu lock. Run the golden gate and `scripts/compare-engines.ts` against the build before; nothing may differ.

Gate: the golden gate, the new tests, `compare-engines.ts` clean. The device check (the app stays up on the Tab One) is A4a's.

### gorge, G22: why the mark, the reasons as facts, branch `p1/gorge-m4-why`
Deep-dive item 14; R36 shows these reasons. No UI. Read:
- docs/04 2.4;
- `app/src/engine/numeric.ts` (the agreement check, `fnWarn`, the audited list);
- `app/src/engine/homeEval.ts` (`HomeResult.warn`) and `inherited` in `app/src/engine/host.ts`;
- `PrecisionWarn` in `app/src/engine/format.ts`.

Commits in this order:
1. **Tests first** (Vitest on `host.home()` and `host.cas()`):
   - `normald_icdf(10^-10)` → `why: { unaudited: ["normald_icdf"] }`;
   - a result from a stored float → `why: { inherited: ["B"] }`;
   - a value evaluated only once (`BesselJ(1,2)` at 30 digits, the double fallback) → `why: { once: true }`;
   - an exact rational → no `why`.
2. **Build:** `HomeResult.why?: { unaudited?: string[]; inherited?: string[]; once?: boolean }`, filled where the warning is decided today: the function names the audit does not cover, and the stored names whose facts were inherited. A constant's uncertainty is not sent to the engine: R36 reads it from the chip table in the app.

Gate: vitest, the golden gate (home, precision), typecheck. Report: the field, for R36.

### gorge, G23: more precision before ⚠, and no unconfirmed digit, branch `p1/gorge-m4-escalate`
Deep-dive item 13. Starts when G22 is merged (same file). Read:
- docs/04 2.4 rule 2;
- `app/src/engine/numeric.ts`: `exactFacts` (lines 335–378) and the float path's steps (lines 445–475);
- `formatConfirmed` in `app/src/engine/format.ts`;
- `tests/golden/precision.yaml`;
- `tools/probes/digits-cost.ts`.

**Behaviour today:** `sin(10^100)` shows `⚠ -0.4`, with `reliableDigits` 0.
- Giac's 40- and 60-digit values are wrong, since reducing 10^100 modulo 2π needs about 100 digits.
- Its 80-digit value is right: −0.37237612366127668826… (`oracle`, mpmath at 150 digits).
- The check stops at P+40, so a digit is shown that nothing confirmed.

Commits in this order:
1. **Tests first** (`precision.yaml`, `oracle`):
   - `sin(10^100)` = ≈ −0.372376123661;
   - `sin(10^2000)`, which no evaluation within the budget confirms, shows `⚠` and no digit.
2. **Build:**
   - On the exact path, while fewer than `digits` agree, keep doubling the extra precision (P+80, P+160, …, at most 1000 digits) within 50 ms per result on the desktop, and stop at the first agreement.
   - `reliableDigits` 0 shows no digit. The app's text for it, "⚠ no digit confirmed", goes through the i18n table, a one-line change in `format.ts` or the render.

Gate: the golden gate (precision, home). The 123 Home inputs keep their desktop timings (`DIGITS_LIST=12,30 node tools/probes/digits-cost.ts`, p95 within 10 %).

### gorge, G26: the digits a constant's uncertainty leaves, branch `p1/gorge-m4-constunc`
Deep-dive item 17; R40 shows it. Starts when G23 is merged (same file) and, if P15 holds, G18 (its first-order rule). On the P15 fallback it brings its own rule. Read:
- decisions.md "The deep-dive review";
- docs/04 2.4 and 3.6 (constant chips carry value and uncertainty);
- `app/src/input/chips.ts` and `latex-to-giac.ts` (`inexact`);
- G18's report.

**Today:** a Home result from a constant with a CODATA uncertainty is marked `≈` and shows every digit.
- G·5.972ᴇ24 shows 12 digits, while G's relative uncertainty is 2.2·10⁻⁵.
- `≈` promises that every digit shown is right. That holds for the CODATA value, not for the quantity it measures.

Commits in this order:
1. **Tests first** (Vitest on `host.home()`, `derived`):
   - an input with its inexact constants as names (`pasc_G`) and a table `{ G: { value, unc } }` gives `uncDigits`: the digit position after which the first-order σ makes the digits uncertain;
   - two constants combine by the first-order rule;
   - an exact constant (c) gives none;
   - without the table, everything is as today.
2. **Build:** `home()` takes the optional table, substitutes the values, evaluates as today, computes σ (G18's rule), and reports `uncDigits` (absent when no constant is inexact). The parser's switch that sends constants as names is R40's.

Gate: vitest; the golden gate (home, precision) unchanged without the table.

### gorge, G21: `exp` ignores the angle mode (F29), branch `p1/gorge-m4-expdeg`
Backlog F29. Starts when G2 item 54 is answered and the owner has decided F29 (decisions.md "Needs the user"). This text is the recommended fix; if the owner decides otherwise, the review gives the package the new rule. Read:
- decisions.md F29;
- `casSetupCommands` and `useHomeMode` in `app/src/engine/host.ts` (how DEG is set);
- `tests/golden/g2.yaml` item 54.

**Behaviour today** (DEG):
- `exp(i*90)` = `i`, marked `=`;
- `exp(i*1)` = 0.999847695156+0.0174524064373·i, which is cos 1° + i·sin 1°;
- `exp(1+i*90)` = 2.71828182846·i;
- yet `exp(i*pi)` = −1.

In RAD, `exp(i*90)` = −0.448073616129+0.893996663601·i.

Commits in this order:
1. **Tests first** (`home.yaml` and a CAS case, `derived`): in DEG, the four inputs give their RAD values. `cos(90)+i*sin(90)` stays `i` in DEG (cos and sin are angle functions), and `polar` entry with `∡` keeps degrees.
2. **Fix:** find where Giac applies the angle mode to `exp` of an imaginary argument, and evaluate `exp` (and `e^`) without it, by a rewrite in the host or a Giac setting. If the fix is a Giac patch, follow `engine/giac/patches/README.md` and write the upstream report for the owner.

Gate: the golden gate; the trig cases in DEG unchanged.

### ron, R35: a lighter start chunk, branch `p1/ron-m4a-slim`
Deep-dive item 11; decisions.md "Start chunk: budget raised to 156 kB raw, 54 kB gzip". Starts when R34 is merged, and comes before R21a, whose gate is that budget. Read:
- `app/scripts/size-check.ts`;
- `app/src/input/haptics.ts`, and every import of `vibrate` and `hasStrength`;
- `app/vite.config.ts`.

**Today** (`vite build` with source maps, 2026-10-14): the start chunk is 150.11 kB raw, 52.41 kB gzip. Its largest parts:

| Source | Raw |
|---|---|
| `session.svelte.ts` | 10.3 kB |
| `App.svelte` | 8.8 kB |
| `@capacitor/core` (imported only by `haptics.ts`, for `registerPlugin` and `Capacitor`) | 7.8 kB |
| `spec/keyboard.yaml` | 7.6 kB |
| `format.ts` | 5.7 kB |
| `keyboard.ts` | 5.6 kB |
| `controller.ts` | 5.5 kB |
| `en.ts` | 5.2 kB |
| `Keypad.svelte` | 5.2 kB |
| `modeSheet.ts` | 4.0 kB |
| `Sheet.svelte` + `sheet.svelte.ts` | 6.8 kB |
| `displayMode.ts` | 3.1 kB |
| `History.svelte` | 3.1 kB |

Commits in this order:
1. **The probe** `tools/probes/start-chunk.mjs`: it builds with source maps into `_out/` and prints the start chunk's bytes per source, so later packages see what they add. The table above came from this method.
2. **Haptics:**
   - `haptics.ts` loads `@capacitor/core` with a dynamic import once the browser is idle after the keypad is drawn.
   - Until then `vibrate` uses `navigator.vibrate`, so the first tap of a cold start may vibrate without its strength.
   - `hasStrength()` reads a flag the load sets.
3. **One more cut, if it is clean:** the Mode sheet's item lists (`modeSheet.ts`) load on the first Mode or Settings open. Leave the sheet itself to R21a.

Gate: the size test, with the start chunk at least 2 kB gzip under today's 52.41 kB; the Mode and Settings e2e green; desktop keyboard-usable mark (`?bench=1`) not later. Report: the probe's table before and after.

### ron, R36: a picked row says why it has its mark, branch `p1/ron-m4a-why`
Deep-dive item 14. Starts when R32 (same file) and G22 are merged. Read:
- G22's report;
- docs/04 2.4, and `markOf()` in `app/src/engine/format.ts`;
- R11's row code (the action line above the entry line) and `app/src/input/chips.ts` (a constant chip's `unc`);
- `app/src/i18n/en.ts`.

Commits in this order:
1. **Tests first** (`app/test/why.spec.ts`). Pick a row (▲); the line R11 shows above the entry line gives the reason in one line:
   - `1/4` → "= exact";
   - `1/3` → "≈ rounded: the exact value is 1/3";
   - `normald_icdf(10^-10)` → "⚠ 9 of 12 digits confirmed · normald_icdf is not checked";
   - a result with G → "≈ uses G (± 1.5·10⁻¹⁵)";
   - a result from a stored float → "≈ uses B, itself rounded".

   Solve's residual ⚠ is out of scope.
2. **Build:** the reason comes from G22's facts and the chip table, through the i18n table. It shows in the row's action line while the row is picked, and nowhere else (rule 9).

Gate: the e2e, R11's row e2e, the viewport share unchanged, start chunk within 0.3 kB gzip.

### ron, R33: names with a value, marked on the line, branch `p1/ron-m4a-namemarks`
Deep-dive item 15. Starts when R4b is merged: Vars and Memory list the same names. Read:
- `app/src/entry/macros.ts` and `app/src/entry/controller.ts`;
- R4b's report (the live names) and `Calc.names()` (docs/04 3.4).

Commits in this order:
1. **The MathLive check first.** Can a name on the line be drawn in another colour without changing the LaTeX the parser reads? Try three ways in a throwaway e2e:
   - CSS on MathLive's rendered atoms, found by their text;
   - `applyStyle` on a range;
   - a macro wrapper that the parser strips.

   If none keeps `getValue()`, the cursor and ⌫ as they are, stop here: the report says so, and the item drops (decisions.md "The deep-dive review", would change if).
2. **Tests first** (e2e):
   - after Home `3 ▶ X`, an X typed on the line is drawn in the stored-name colour, in Home and in CAS;
   - after Memory deletes X, the next X is plain;
   - the parser's output is unchanged (the round trips).
3. **Build:** the session's stored names, refreshed after each definition; the marking happens on render only.

Gate: the e2e, the round trips, the parser golden cases unchanged; start chunk within 0.3 kB gzip.

### ron, R37: the angle check, branch `p1/ron-m4a-anglecheck`
Deep-dive item 16. Starts when R33 is merged. Read:
- decisions.md "The deep-dive review" (the rule and its removal test);
- `app/src/input/parse.ts` (`Degrees` and the `°` rule, lines 427–467);
- the history row and R11's action line;
- the angle setting in `app/src/state/session.svelte.ts`;
- `app/src/state/taps.svelte.ts` (R9's counter).

**The rule:**
- In RAD, a trig function (sin, cos, tan, sec, csc, cot) whose whole argument is a literal whole multiple of 15, from 15 to 360, gets a hint under its result: "RAD · sin 30° = 0.5? Tap for DEG".
- In DEG, a trig argument that contains π gets "DEG · π in the angle: RAD?".
- A tap switches the angle setting and runs the line again as a new row, the G2 way of fixing it.
- The hint uses no line when it is not shown (rule 9).

Commits in this order:
1. **Tests first:**
   - a unit test for the detector, on the parsed tree;
   - e2e: RAD `sin(30)` shows the hint, and a tap gives DEG and a new row `= 0.5`;
   - RAD `sin(0.5)`, `sin(30x)`, `sin(7)` and `sin(30°)` show none;
   - DEG `sin(π/6)` shows it, and DEG `sin(30)` does not.
2. **Build:** the detector works on the parsed tree, where the parser knows the argument is a literal. The hint uses the result row's muted style.
3. **Removal test:** count hints shown and taken (as R9's tap counter, in Settings). If none is taken in two weeks of use, the code goes (docs/03 rule 11).

Gate: the e2e, the parser tests, start chunk within 0.3 kB gzip.

### ron, R41: key labels for TalkBack, branch `p1/ron-m4a-labels`
Deep-dive item 19. Starts when R12c is merged: R15b places the keys and R12 styles them. Read:
- `app/src/keyboard/Keypad.svelte` (the key `<button>`, line 253);
- the labels per layer in `spec/keyboard.yaml`;
- `app/src/i18n/en.ts` and `app/test/keys.spec.ts`.

**Today:** no key has an accessible name (`aria-label` appears 0 times in `Keypad.svelte`). A screen reader reads the legends as drawn: "x⁻¹", "ᴇ", or nothing for an icon key.

Commits in this order:
1. **Tests first:**
   - a Vitest over `spec/keyboard.yaml`: every key and layer has a name in the i18n table ("sine", "x to the minus one", "E for the exponent", "Shift");
   - e2e: Playwright's accessibility snapshot of the keypad and of each sheet has no unnamed button, and a key's Shift and Alpha layers are in its description ("Shift: arc sine").
2. **Build:** `aria-label` and `aria-description` on the buttons, from i18n keys per key id and layer (English only). No visual change.

Gate: the tests, the keys and gestures e2e, start chunk within 0.5 kB gzip (if the names grow it more, they load with the i18n table lazily). The first device run after R41 tries TalkBack for a minute.

### ron, R40: muted digits past a constant's uncertainty, branch `p1/ron-m4a-constdigits`
Deep-dive item 17. Starts when R41 and G26 are merged; it uses R12b's colour tokens. Read:
- G26's report;
- `app/src/input/latex-to-giac.ts` (the chip table, `inexact`);
- `app/src/views/History.svelte`;
- R12b's token file;
- `app/src/style.test.ts` (contrast).

Commits in this order:
1. **Tests first** (e2e):
   - Home, G (inserted by Find or as `\const{G}{G}`) × 5.972ᴇ24, Enter: the digits past G26's `uncDigits` are drawn with the muted token, and the mark stays `≈`;
   - copy still gives every digit;
   - a result with only exact constants (c) has no muted digit;
   - the same cut at 30 digits.
2. **Build:**
   - The parser sends an inexact constant chip as its name (`pasc_<id>`), and the app passes the chip table's value and σ to `home()` (G26).
   - The row draws the digits past `uncDigits` in one muted span.

Gate: the e2e, the contrast test (the muted digits keep R12b's contrast floor for text), start chunk within 0.3 kB gzip.

### ron, R38a and R38b: the backup, export and restore, branches `p1/ron-m4-backup` and `p1/ron-m4-restore`
Deep-dive item 18. **Their texts are written when S6 has reported** (the way a file goes in and out without INTERNET) and the owner has said yes to its proposal; until then nobody starts them. Scope:
- **R38a, export:** one file (JSON, each part with its `DATA_VERSION` stamp) holding the history, the definitions, the settings, the user keys (and the unit-pad cells once they exist), sent out by S6's way.
- **R38b, restore:** read the file back, check it, show what it holds, then replace or merge as the user picks, through the stamped migrations. A file from a newer version is refused.

Gate (both): an e2e round trip, export → clear → restore, gives the same state.

### annabell, A6: one gate command, branch `p1/annabell-gate`
Deep-dive item 21; the local half of backlog C3. Any time, beside the ron lane (no device). Read:
- the scripts in `app/package.json`, `app/scripts/size-check.ts` and `app/scripts/golden.ts`;
- sections 8 and 8a of this brief;
- the test lines in `.claude/agents/*`.

Commits in this order:
1. **`npm run gate`** (`app/scripts/gate.ts`). It runs:
   - typecheck;
   - `npm run index` when the index is missing;
   - Vitest with `FIND_INDEX=required`;
   - e2e;
   - the golden gate, when engine or parser code changed against `phase-1` (`git diff --name-only phase-1...`);
   - the size test;
   - a docs-size check (S7 sets the budgets; until then it only reports the sizes).

   Each check prints **one line**, such as `PASS typecheck 0 errors (12 s)` or `FAIL e2e 2 of 214: solve.spec.ts:40, …`, with its full log in `app/_out/gate/<name>.log` (gitignored).
   - The exit code is non-zero on any FAIL.
   - `--quick` runs typecheck and Vitest only.
   - The known-flaky persistence test is re-run once, as section 8 allows.
2. **Tests:** a Vitest for the summary, which reads Vitest's and Playwright's JSON reporters, not their text.
3. **Report:**
   - the shared-file text for section 8 ("each branch: `npm run gate` passes") and 8a step 3, and for the agent files' test lines;
   - backlog C3: the GitHub workflow stays the owner's OK.

Gate: `npm run gate` passes on `phase-1` and fails on a branch with a broken test. Show both in the report.

### annabell, A7: release signing and the version number, branch `p1/annabell-release`
Section 0g. Starts on the owner's go, with 0g's secret table filled in. Read: `build.sh`; `android/app/build.gradle`; `fdroid/io.github.buerlino.pascaline.yml` and `fdroid/README.md`. No device; the real key never touches this machine.

Commits in this order:
1. **Gradle reads the whole key from the environment.** It reads `PASCALINE_KEYSTORE`, `PASCALINE_KEYSTORE_PASS`, `PASCALINE_KEY_ALIAS` and `PASCALINE_KEY_PASS`. The defaults (`throwaway` / `pascaline-throwaway`) apply only when `PASCALINE_KEY_ALIAS` is unset, so dev builds keep working unchanged. No password or path is committed.
2. **`./build.sh --release`.**
   - It fails before any build step when one of the four variables is missing, when the keystore file does not exist, or when the alias is `throwaway`. It never creates or falls back to the throwaway key.
   - It refuses `--dev`, `--measure`, `--unsigned` and `--no-units`. It allows `--engine-dir` and `--qalc-dir`, since A8 gates the engine first and then hands it in.
   - After Gradle, it runs `apksigner verify --print-certs` (build-tools under `ANDROID_HOME`) and compares the certificate's SHA-256 with `android/release-cert.sha256` (one line, from 0g's table; the fingerprint is public). On a mismatch it deletes the APK and fails.
   - It writes `dist/pascaline-<versionName>.apk` and `dist/pascaline-<versionName>.apk.sha256`, as well as `dist/pascaline.apk`.
   - Update the header comment of `build.sh`.
3. **The version.** Set `versionCode 1` and `versionName "0.1.0"` in `build.gradle`. Add `tools/check-version.sh vX.Y.Z`: exit 0 when the tag equals `v<versionName>`, otherwise print both and exit 1. In the F-Droid draft, set versionName, commit and CurrentVersion to 0.1.0 / `v0.1.0`, and versionCode and CurrentVersionCode to 1.
4. **Tests:** a small shell test (`tools/test-release-guard.sh`, no Gradle run) that checks each refusal in step 2 and `check-version.sh` on a match and a mismatch. Also: `./build.sh --dev --engine-dir … --qalc-dir …` still produces a throwaway-signed APK.
5. **Report:** the shared-file text for backlog R2 and C4, `fdroid/README.md` (the version item is done), and CLAUDE.md's Commands line for `build.sh` (`--release`).

Gate: the refusal test passes; a dev build still installs over the last one (the same throwaway key); `check-version.sh v0.1.0` passes and `v0.1.1` fails.

### annabell, A8: the release workflow, branch `p1/annabell-releaseci`
Section 0g. Starts when A7 is merged. **Opus:** it handles the signing key on a machine we do not own. Read: `build.sh` (after A7); `engine/giac/build-wasm-release.sh` and `engine/qalc/build-wasm.sh` (`CONTAINER_ENGINE`, `NO_LOCK`); `app/scripts/golden.ts`; this section's 0g.

Write `.github/workflows/release.yml`:
- **Trigger:** `push` of tags `v*`, and `workflow_dispatch` with a tag input (a re-run of a tag). Runner `ubuntu-24.04` (it has podman). `permissions: contents: write`, nothing more. `concurrency` per tag. `timeout-minutes: 120`: a 4-core runner needs about 20–40 min for the two container builds, not the 5 min of the 16-core laptop.
- **Every action is pinned to a full commit SHA**, with the version in a comment (checkout, setup-java 21, setup-node 22). No third-party actions beyond these; the release is created with `gh release create` and `GITHUB_TOKEN`.
- **Steps, in this order:**
  1. `tools/check-version.sh "$GITHUB_REF_NAME"`.
  2. Engine and qalc in the pinned container, with `NO_LOCK=1`.
  3. The golden gate on `engine/giac/_out/release` (absolute `GIAC_OUT`). It must print `GOLDEN GATE PASSED`, or the job stops **before** the key is decoded.
  4. Decode the keystore into `$RUNNER_TEMP` (mode 600), then `NO_LOCK=1 ./build.sh --release --engine-dir … --qalc-dir …`. The secrets go in as `env:` of this step only, never into a `run:` line or `echo`. An `if: always()` step deletes the keystore.
  5. `gh release create "$TAG" dist/pascaline-<v>.apk dist/pascaline-<v>.apk.sha256 --prerelease` when the major version is 0 or the tag has a `-`. The notes give the commit, the engine and qalc `SHA256SUMS`, and the certificate fingerprint.
- **Not in this package:** the PR/CI checks (backlog C3, which builds on A6), and the F-Droid submission (C4).

Also write **`docs/release.md`**, the owner's one-page checklist: bump versionCode and versionName (and the F-Droid draft) in one commit on `master`; `git tag -s vX.Y.Z` (or `-a`); `git push origin vX.Y.Z`; watch the run; check the SHA-256 and `apksigner verify --print-certs` on the downloaded APK; install over the last release. It also says what a failed run leaves behind (nothing is published) and how to re-run.

Gate: the workflow passes `actionlint` (run once with `npx` or a container; it is not added to the repo). On a fork or on a throwaway tag `v0.0.1-test` from a test branch (the owner's OK, and the owner pushes it), the run ends with a pre-release whose APK verifies against `android/release-cert.sha256`; then the test release and tag are deleted. Show the run's log lines in the report. Then the owner pushes `v0.1.0`.

### sandra, S7: the docs diet, branch `p1/sandra-docsdiet`
Deep-dive items 20 and 22. Starts when S5 is merged and no package waits for its review. The owner merges it before the next review starts, because it moves text the reviews edit. Read: this brief's sections 0, 2, 8 and 8a; rules.md section 9; the sizes below.

**Today** (2026-10-14; about 4 characters per token):
- decisions.md 108 kB, the brief 154 kB with section 0f, docs/04 76 kB, backlog.md 43 kB, the cleanup audit 93 kB.
- A fresh henri reads the whole brief, and a review session reads and edits backlog, decisions and the brief at every merge.
- One fact (P14) sits in seven files.

Steps:
1. **One file per package:** section 7 moves to `docs/shifts/packages/<ID>.md`, one file each. Finished packages are deleted (git keeps them). The brief keeps sections 0 (the path and the tables, each row linking its file), 0c, 2, 8 and 8a, and a package session reads only its own file.
2. **Decisions:** "Decided proposals" keeps what still binds, as Choice, Why (one line) and Would change if. The rest moves to `docs/archive/decisions-2026-10.md`, read only when a decision is questioned.
3. **Backlog:** one or two lines per open item, linking its package and decision. No causes and no steps to reproduce: they live in the package file.
4. **docs/04:** "today" statements that are now history (section 1.2's table, 2.1's "Marked today" column) are made current or cut.
5. **Archive:** the cleanup audit and the finished shift reports go to `docs/archive/`.
6. **Budgets**, which A6's gate checks: the brief ≤ 25 kB, backlog ≤ 20 kB, decisions ≤ 40 kB, docs/04 ≤ 70 kB, a package file ≤ 6 kB.

Nothing current may be lost: the report lists every moved section and where it went, and the review checks three facts at random from each file.

Gate: every link resolves (a small check in `tools/`), the budgets hold, and a package started from the new layout finds its text in one read.

### sandra, S6: files in and out without INTERNET, the backup, branch `p1/sandra-files`
Deep-dive item 18. It also answers S4's point 2 (how a file reaches the phone), which S4 then reuses. Starts when S7 is merged. Read:
- CLAUDE.md's offline and F-Droid rules, and `android/app/src/main/AndroidManifest.xml` (no INTERNET);
- `share` in `app/src/clipboard/port.ts`;
- `app/src/state/storage.ts` (the keys, `DATA_VERSION`, the migrations) and docs/04 6.2;
- backlog "Needs the user" item 7: the move to the new app id had no backup.

Answer each point with probes (Chromium; the device checks are annabell's, later):
1. **Out:**
   - the Web Share API with a file in the Capacitor WebView (`navigator.canShare({ files })` on WebView 131);
   - a download (`<a download>`) in the WebView and in the PWA;
   - `@capacitor/filesystem` with `@capacitor/share` (MIT: their size, and what they need in the manifest).

   Recommend one that needs no new permission.
2. **In:**
   - `<input type="file">` in the WebView: does it open Android's picker without a plugin?
   - "open with": an intent filter for the file type, and what `MainActivity` needs;
   - the File System Access API in the PWA.
3. **The file:**
   - JSON, one part per stored key with its stamp;
   - what it holds: history, definitions, settings, user keys, and later the unit-pad cells;
   - its size at the limits (200 rows in each view, 500 definitions);
   - what a restore refuses (a newer version, a broken stamp);
   - merge or replace.
4. **Write** `docs/research/r11-files.md`. The report gives:
   - the proposal for decisions.md "Needs the user", as one recommendation;
   - the texts of R38a and R38b for section 7.

### sandra, S8: the outside-test protocol, branch `p1/sandra-outside`
Deep-dive item 24. Starts when S6 is merged. Read:
- docs/03 rules 1, 2 and 13;
- `tests/tasks/tasks.yaml` and `tests/tasks/find-queries.yaml`;
- decisions.md P14;
- backlog "Needs the user" item 0 (the owner's own hand timing).

Write `docs/research/r12-outside-test.md`, for two 30-minute rounds that the owner runs:
- **Who:** three engineers or engineering students who have not seen the keys, from at least two fields.
- **When:** round 1 after R4b (Find); round 2 after R24c (the unit pad), before R24d's user cells are set.
- **What they do:** the ten tasks; ten Find queries in their own words ("type what you would call it"); five units on the pad from a printed list.
- **What is recorded:** presses (the tap counter), time, misses, the words they typed (new aliases for `find-queries.yaml`), and where they hesitated.
- **Privacy:** no data leaves the phone, the owner takes the notes, and no names are kept.
- **What comes back:** rows in feedback.md, marked "outside".

Add a one-page printable task sheet (`docs/mockups/outside-test.html`). Gate: the owner can run round 1 with the sheet and an APK and nothing else.

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
1. `git status` is clean, and the prerequisites in the table are merged. The package's worktree is clean, its report is the branch's last commit, and the worker's session has ended (no `claude --agent <worker>` for this package in `ps`). If not, stop and say so.
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
6. When a merge completes milestone 4: write `docs/shifts/<date>-m4-report.md` (rules section 11, step 5) and add milestone 4 to docs/02 section 12.
7. **End with the next command** for the owner, ready to paste, and nothing to try on a device: when merged, the start command of the next package on "The path" (section 0) whose prerequisites are now met, as section 0a "How to start a package" writes it, with the agent and model from its table; when not merged, the fix command of step 4 with the findings filled in.
