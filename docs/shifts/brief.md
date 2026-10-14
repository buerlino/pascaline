<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Shift brief: milestone 4a "feel", then the rest of milestone 4 "Find and trust" (shifts `m4a` and `m4`, run by the owner)

**Night shift 2026-10-14:** henri runs the queue in section 0c; for that shift 0c wins over everything below and over rules sections 4, 10 and 11. **Manual mode (user, 2026-10-12)** otherwise: there is no coordinator. The owner starts each work package as its own session and, when it is done, a short review session that checks and merges it (section 8a). The standing rules in [rules.md](rules.md) still apply (sections 1, 3, 5, 6, 9). Where they say "Henri" or "message", read this brief instead; where the two differ, this brief wins.

## 0. State at start
`phase-1` after the merges of R17, S2, R13, R16, R14 (2026-10-13) and R18 (2026-10-14). Merged: milestone 4 packages G0–G4, R1–R3, A1–A3; milestone 4a packages R5, A5, R6, S1, R7, R8, R9, R10, R13, R14, R16, R17, R18. **Next:** R22 and R23 (the entry bugs F9 and F10, 2026-10-14), then R21, then R15b (the owner approved layout D on 2026-10-14), after one device run on the Tab One. S2 is done: its menu rules (decisions.md "S2: one menu system", accepted 2026-10-13) add items to R18, R15, R11 and R4, written into their text below. No package waits for an APK to be tried (owner, 2026-10-13): a package starts when the one before it is merged. The text of finished packages is in git history (`git show b2f1e7e:docs/shifts/brief.md`). Left for the owner: the unmerged `p1/ron-eve-gestures` (the old flick classifier; backlog C7).

## 0c. Night shift 2026-10-14: henri's plan (owner, 2026-10-14)
The owner planned this shift in advance. henri (Sonnet, medium) **executes it and decides nothing**: he spawns one fresh agent per step with the prompts below, waits, logs, and spawns the next. After each Opus pass he hands over to a fresh henri (rule 11), so no henri carries a long context. **Low usage comes first** (the week is at 75%): the aim is to make the 5-hour window last, not to fill it. Whatever is not done stays in the queue for tomorrow.

### Rules for this shift (they replace rules sections 4, 10 and 11, but not 4a, and change section 8a)
1. **One agent at a time.** Never two workers, or a worker and a reviewer, at once.
2. **A fresh agent for every step:** each package, each review, each fix round and each Opus pass is a new spawn. Never SendMessage to give an agent a second task. Prompts are the templates below with the blanks filled in, nothing more (the agents read the brief themselves).
3. **Spawn in the foreground** (`run_in_background: false`): the call returns when the agent is done (rules section 4a: if a call still comes back as a background launch, log it and wait for its notification, never end the session). This is needed because henri_2 and later run headless, and a headless session ends with its turn. Do not poll, sleep, read diffs, run tests or builds, or read files beyond this brief and `.coord/log.md`.
4. **No APKs, no devices:** skip section 8a step 5a and its feedback.md line. Nobody runs `adb` or `build.sh`. annabell is not used tonight.
5. **Models:** workers run Sonnet, effort medium. One exception: R18 runs Opus (signed in 0b), effort medium. Reviews run Sonnet, effort medium (section 8a says Opus; tonight Sonnet). Opus passes run Opus, effort medium.
6. **henri decides nothing.** A question, a blocked worker, a conflict or anything this section does not settle: log it and hand it to the next Opus pass (run that pass at once if the question blocks the queue). **Follow every Opus-pass recommendation as written.** Plan changes go to the owner through `docs/decisions.md` "Needs the user", written by the Opus pass.
7. **Start-up:** `date`; `git switch phase-1 && git status` (must be clean; if not, stop and log); `tools/devlock.sh status`. henri_1 appends a section "2026-10-14 night" to `.coord/log.md`; a later henri logs `START henri_<n>` under it and reads the log from the last HANDOVER on. No roll call, no device watcher.
8. **Log:** one line per step in `.coord/log.md`: the time from `date +%H:%M` (never estimated), step, agent and model, outcome, commit. The log is the queue state: on a resume, read it and continue from the first step not done.
9. **Usage limit:** if a spawn fails or you hit a limit, log the time, the queue position and `STOPPED henri_<n>`, and end without starting a next henri. No retry loops. The owner resumes with `tools/henri-next.sh <n+1>` (or interactively: `claude --agent henri "Resume the night shift from .coord/log.md."`).
10. **Worker gone without a report** (no report commit): spawn one fresh worker with the same prompt (it continues from the branch's last commit). If that one also fails, log it, leave the branch, and go on with the next package.
11. **A fresh henri after every Opus pass** (owner, 2026-10-14). The owner's interactive session is henri_1. Once an Opus pass has replied, log its reply in full (its FIX lines and QUEUE are the next henri's orders), then log `HANDOVER henri_<n> → henri_<n+1>; next: <step>`, run `tools/henri-next.sh <n+1>` (it takes the next free number if that one was used, and starts a detached headless session that reads this brief and the log; output in `.coord/henri_<n+1>.out`), and end your turn. Do nothing more after that, even if woken: the new henri owns the queue. Your number n is in your prompt (henri_1 if none). The final pass (step 8) hands over the same way; that henri does its FIX packages and the report.

### The queue
Estimates are wall-clock guesses. Each package is: worker, then review; a "fix" verdict adds a fix round (fresh worker, then a fresh review), at most two rounds; after the second "NOT MERGED" leave the branch unmerged, log it, go on. **Opus pass:** after every three finished packages (merged or left unmerged; fix packages from a pass count), and step 8 at the end of the queue. Step 8 is the last pass: the FIX packages it orders get only their Sonnet review, then the report.

| Step | What | Agent, model | Branch | Est. |
|---|---|---|---|---|
| 1 | R18 Shift palettes (section 7) | ron, **Opus** | `p1/ron-m4a-shiftpal` | 2 h + review |
| 2 | R15a top-cluster mockups (section 7; ends with the page; the owner picks in the morning) | ron, Sonnet | `p1/ron-m4a-top` | 30 min + review |
| 3 | G5 solver bugs SB1–SB4 (section 7) | gorge, Sonnet | `p1/gorge-m4-sb` | 1 h + review |
| 4 | **Opus pass 1** on steps 1–3, then its FIX packages | Opus | — | 20 min + fixes |
| 5 | G6 the §2.3 audit (section 7) | gorge, Sonnet | `p1/gorge-m4-prec` | 1 h + review |
| 8 | **Opus pass 2** on what came after pass 1, then its FIX packages | Opus | — | 20 min + fixes |
| 9 | Shift report, then stop (the henri started after step 8) | henri_n | — | 10 min |

Not tonight: R15b (layout D approved; waits for a device run) and everything after it in 0b, R4 and A4 (after 4a), milestone 5.

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

### Shift report (step 9, the last henri)
`docs/shifts/2026-10-14-night-report.md`, short and plain, from the log and the agents' replies (log `SHIFT DONE` at the end; start no further henri): what was merged (with commits); what is unmerged and why; the Opus passes' NOTES; what the owner must do (pick an R15a layout; items under "Needs the user"); the queue left for tomorrow. Commit it on `phase-1` with `git commit -s` and the Sonnet trailer. Never push.

## 0b. Milestone 4a packages (P11, signed off by the owner 2026-10-13): **do these first**
Goal: the owner's feedback of 2026-10-13 ([feedback.md](../feedback.md)) and the UI plan ([05-ui-plan.md](../05-ui-plan.md); its **section 7 wins** where it differs). Backlog "Milestone 4a" is binding. The m4 packages of 0a that are not done (R4, A4) come after 4a.

| # | Package | Agent, model | Branch | Start when merged | Size |
|---|---|---|---|---|---|
| R22 | Bug F9: the system keyboard on return, again | ron, Sonnet | `p1/ron-m4a-refocus` | now | ~0.5 d |
| R23 | Bug F10: ⌫ stuck at a bracket | ron, **Opus** | `p1/ron-m4a-bksp` | R22 (same file); G2 item 44 answered, or start on the default | ~1 d |
| R21 | Pick sheets over the keypad, Settings over everything | ron, **Opus** | `p1/ron-m4a-fit` | R23; runs before R15b | ~2 d |
| R15b | Top cluster: implementation | ron, **Opus** | `p1/ron-m4a-top` (same) | a device run on the Tab One (backlog Needs the user item 7) | ~2 d |
| R11 | History-row actions, Home and CAS (U3) | ron, Sonnet | `p1/ron-m4a-rows` | R15b | ~1 d |
| R12a | Visual pass: mockups for the owner | ron, Sonnet | `p1/ron-m4a-look` | R11 (draws the final keypad, so after R15b) | ~0.5 d |
| R12b | Visual pass: implementation (U5, U7, theme) | ron, Sonnet | `p1/ron-m4a-look` (same) | R12a approved by the owner | ~2.5 d |

**No waiting for a tried APK** (owner, 2026-10-13): each ron package still ends with an APK on the owner's phone (section 8a step 5a), but the next package starts as soon as the review has merged it; the owner's notes come back through feedback.md as feel items. Only the two mockup steps (R15a, R12a) wait, for the owner's pick. **Why these models:** Opus where a mistake breaks entry for every later package: R7 (the sheet every list is built on), R9 (a gesture classifier that misfires corrupts typing), R10, R14 and R18 (parser rules and round trips), R15b (moves keys that every test names). Sonnet elsewhere, with an Opus review per package.

## 0a. Work packages (milestone 4), after 4a
Goal: milestone 4 of P8, built to [04-architecture.md](../04-architecture.md). The task text in `docs/backlog.md` "Engineer core, milestone 4" is binding. Each package names its backlog step; § numbers point into docs/04.

| # | Package | Backlog step | Agent, model | Branch | Start when merged | Size |
|---|---|---|---|---|---|---|
| R4 | Find UI (EN1) | 8 | ron, Sonnet | `p1/ron-m4-find` | R7 (the sheet), after 4a | ~3 d |
| A4 | Device bars on the Tab One | 12 | annabell, Sonnet | `p1/annabell-m4-device` | R4; Tab One connected | ~0.5 d |

### How to start a package
From the main checkout (`/home/nordmu/Documents/source99/pascaline`), one terminal per package:

```bash
claude --agent <ron|gorge|annabell> --model <sonnet|opus> "Do package <ID> in docs/shifts/brief.md."
```

Check `/model` once at the start: the agent files pin `model: opus`, and the flag should override it. A package that runs out of usage can be resumed (`claude --continue` in the same terminal) or restarted with the same command: the agent finds its branch and continues from its last commit.

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
- Not in this milestone: the unit view and the qalc worker (milestone 5), matrices, bases and everyday functions (milestone 6), Help = context help (milestone 6), prefix entry chips (gated by task 3).
- **No coordinator to message.** Stay inside the files your package names. Shared files (`CLAUDE.md`, `docs/*`, `THIRD_PARTY.md`, `.claude/agents/*`) are not yours. Put the text for them in your report, and the review session applies it. Devices are only for A4.

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

### ron, R4: Find UI, branch `p1/ron-m4-find`
Backlog step 8.
- **Keys:** Math = Find, Vars = Find on variables, Shift + Math = Memory (§5.1).
- **Inside Find:** keys follow §3.7, ranking §3.5 (`app/src/find/rank.ts`), preview and insertion §3.6.
- **Content:** live items from `defined` (§3.4); `?bench=find`. No usage ranking and no `find.usage` (P11); an empty query shows the G2-style Math menu (fixed categories in a fixed order), numbered: on an empty query digits pick a category, after a letter they type (S2 rule M1). Built on R7's sheet (docs/05 3.1, 3.6 and section 7); letters: a tap on a non-digit key, a flick down on any key.
- **Loading:** Find is a lazy chunk, and the index is fetched only when the browser is idle after the engine is ready.
- **Data:** the generated index (G4, merged): `prepare()` and `search()` in `app/src/find/rank.ts`. The schema is fixed by §3.3; a change goes under "Needs a decision".

Gate:
- task 5 active and within budget
- ranking unit tests
- the query test
- the size test

### annabell, A4: device bars, branch `p1/annabell-m4-device`
Backlog step 12, when the Tab One is connected (rules section 6). On the device:
- install an APK built from `phase-1`, and leave it for the owner to try
- cold start (L7)
- Enter p95 at digits 12, 20 and 30 (`?bench=1&digits=N`, 5 cold runs)
- Find per key (`?bench=find`)
- whether `navigator.clipboard` and `navigator.share` work in WebView 131

Report against the §8.3 bars. A miss goes under "Needs a decision" with the number; docs/04 says what changes (digits capped at 20, incremental Find).

### Milestone 4a packages (section 0b)

### ron, R22: the system keyboard on return, again (bug F9), branch `p1/ron-m4a-refocus`
Backlog F9 (cause and proof there; decisions.md "Focus on return"). Read `app/src/main.ts` (`dropFocus`), `EntryController.create()` in `app/src/entry/controller.ts`, `app/test/softkeyboard.spec.ts`, and r6-pipelines section 7. Commits in this order:
1. **Test first** (`app/test/softkeyboard.spec.ts`, failing on today's code): extend `leaveAndReturn` with the two event orders (window `blur` then hidden, and hidden then `blur`), then three away-and-back cycles in a row. After each return, wait 150 ms (MathLive focuses 60 ms late) and check that nothing editable is focused. Run it twice: after a tap on a digit, and after a trackpad drag (`drag(page, "left", -30, 0)`). Then a digit key still types.
2. **Fix:** `Field.restoreFocusWhenDocumentFocused = false` in `create()`, beside `fontsDirectory` and the other statics, with a one-line comment that names K0/F9. Keep `dropFocus`.
3. **Check what the restore did for us,** by hand, since synthetic window events do not move the real focus: `npm run dev` in desktop Firefox, type on the line, switch windows (Alt+Tab) and back, type on the hardware keyboard. The browser should restore the focus by itself. If the keys no longer reach the line, put it under "Needs a decision" (the fix would be `entry.focus()` on window `focus`, on `pointer: fine` only) instead of building it.
4. **Report.** The owner checks the APK by hand: drag on the arrow keys, switch away and back three times, fast. Then the same after plain taps. Shared-file text: backlog F9 "Done", the decisions entry if the build differs.
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
2. **Fix** in `EntryController.run`: before MathLive's `deleteBackward` (and `deleteForward`), when the cursor is at the start (end) of a pair's body, select the template (the name before the pair when the same key inserted it: `\log`, `\sin`, `\ln`, `\operatorname{…}`, a `\log_{…}` with its base; else the pair alone) and replace it with the body's LaTeX, leaving the cursor where the opening bracket was. An empty function body becomes nothing; then, as for log log, the outer body gets its placeholder back. Public MathLive API only (`getElementInfo`, offsets, `selection`, `insert`); no patch to MathLive. If the pair is the evaluate-at bar, the whole template follows the same rule (body kept, bounds dropped); say in the report if that feels wrong.
3. **Parser message** (`app/src/input/parse.ts`): a `\left.` closed by anything but the bar says "unmatched bracket", not "expected the evaluate-at bar". Its parser case (an error case, `derived`) goes in the same commit.
4. **Report** with the G2 item 44 answer, if the owner gave one. Shared-file text: backlog F10 "Done", the decisions entry if the build differs, r6 section 7 if MathLive behaved otherwise.
Gate: `bksp.spec.ts` green (it fails without the fix), `selection.spec.ts`, `undo.spec.ts`, `entry.spec.ts`, `chips.spec.ts`, `tmpl.spec.ts`, gestures e2e green; vitest and the golden gate (parser changed); start chunk within 0.5 kB gzip.

### ron, R21: pick sheets over the keypad, Settings over everything, branch `p1/ron-m4a-fit`
The owner's frictions (2026-10-14): a sheet in the viewport is far from the thumb while typing, the Tmpl grid scrolls on the phone, Settings is too small. Decided: decisions.md "R21" (binding); the target text is already in docs/05 2 (rule 1), 3.1 and 3.4 and docs/03 rule 8. Read those, decisions.md "Sheet defaults (R7)", "Mode and Settings sheets (R8)", "S2: one menu system", and `app/src/views/` (`Sheet.svelte`, `sheet.svelte.ts`, `sheetKeys.ts`, `modeSheet.ts`) with the sheet parts of `App.svelte`, `apps/shell.svelte.ts` and `keyboard/Keypad.svelte`. Commits in this order:
1. **Tests first** (`app/test/fit.spec.ts`, failing on today's code), at 412 × 915:
   - **Keys never move:** the box of every key is the same before a sheet opens, while it is open and after it closes (Apps, Menu, Mode, Tmpl, Shift + 6, Shift + 9, Settings).
   - **Where:** a pick sheet's bottom edge is the keypad's bottom edge, its top is not above the top of keypad row 3, and `elementFromPoint` at the centre of ▲, ▼, ◀, ▶, Esc, Cancel and Menu hits that key while the sheet is open.
   - **Fit:** every pick sheet shows all its items without a scroll (`scrollHeight <= clientHeight`): Apps, the Home Menu, the Function Plot and Solve menus, Mode, Mode › Significant digits (9 rows), Tmpl, Shift + 6, Shift + 9; at 360 × 740 the same for Tmpl, Shift + 6, Shift + 9 and Mode.
   - **Flow:** a tap on a Tmpl cell closes the sheet, puts the template on the line with the cursor in its first box, and the next digit key types into it. Shift + 6: the `≤` cell's box covers the 8 key's box.
2. **Over the keypad** (`Sheet.svelte`, `App.svelte`, the model only if it must): mount the pick sheets in a layer over the keypad's maths rows, anchored at its bottom edge and as tall as its rows need, up to the top of row 3; the top cluster stays uncovered and live. Keep every sheet key job (`sheetKeys.ts`) for the keys still visible; a maths key a short sheet leaves visible is dimmed and keeps its sheet job (a digit picks its row; nothing types into the line, rule 4). A tap in the viewport closes the sheet. A list that takes letters (filterable, Find later) stays where sheets are today, above the keypad. The rise animation stays within one frame and 120 ms (rule 6).
3. **Fit** (`Sheet.svelte`): rows and cells shrink to the room, from today's size down to the floor: list rows 36 px (font and padding together; the number column stays), grid cells 44 px (today 58 px for Tmpl, 46 px for the Shift palettes); below the floor, today's scroll cue and count. Grids have no title row: the title, the highlighted cell's name and × share the hint line. Two-line rows (disabled reasons) count their own height. CSS where it can (a custom property set from one ResizeObserver), no per-frame work.
4. **Shift + 6 over its keys:** each relations cell is drawn over the key in its `pick:` (keyboard.yaml `relations:`), using the keys' boxes; the cells without a key (none today) and Shift + 9 and Tmpl stay a grid.
5. **Mode for the thumb:** each value row gets ◀ ▶ buttons (at least 44 × 44 px) beside the value; a tap on the row still steps forward.
6. **Settings page** (new `app/src/views/SettingsPage.svelte`; `modeSheet.ts` keeps the item lists): opened where Settings opens today (Mode's last row; Shift + Home/CAS until R15b); it covers the whole window, status line included. One scrolling page with section headings instead of submenus: Format key cycle (its switches and Decimals), Vibration (on, strength, length), Shift / Alpha taps (counts, reset). A value row: label, value, ◀ ▶ buttons of at least 44 × 44 px; a switch row toggles on a tap; disabled rows keep their reason. Close: × in the header, Android back (push a history entry on open, close on `popstate`; no new dependency), Esc on a hardware keyboard. Hardware keys: ▲ ▼ move, ◀ ▶ step, Enter or space toggles, Esc closes. Leave a place for Theme (R12b), User keys (R15b) and About; build none.
7. **Gallery:** Home menu, Mode, Mode › digits, Tmpl, Shift + 6, Shift + 9 over the keypad, the Settings page, Tmpl and Mode at 360 × 740; light and dark; rebuild.
8. **Report** ("For shared files": anything in docs/05 3.1 and 3.4 the build changed; R7 open point 5, the Function Plot reasons, judged again with the new rows; the code comments that said "never over the keypad" are yours to fix).
Gate: `fit.spec.ts` green; `sheet.spec.ts`, `status.spec.ts` (viewport share unchanged), the Mode and Settings e2e (rewritten where they opened Settings as a sheet), gestures and flicks e2e green; Settings e2e by touch, by hardware keys and by `history.back()`; start chunk within the budget (156 kB raw, 54 kB gzip; the Settings page loads lazily if it grows the chunk by more than 1 kB); gallery rebuilt. Not in this package: R15b's keys, the theme, Find.

### ron, R15b: top cluster, branch `p1/ron-m4a-top`
P12 points 2 and 3 and open point B. **R15a is done:** `docs/mockups/top-cluster.html` holds the layouts A, B, C and the press table. **The owner turned down A, B and C (2026-10-14); the page now holds layout D** (the cross stays, every key at its G2 place, three free keys U1–U3 with Shift layers, 48 px cluster rows; decisions.md). **R15b:** build D (approved by the owner 2026-10-14) with **U2 = Home and U3 = CAS as defaults** in `spec/keyboard.yaml` (decisions.md "R15a: layout D"); the free keys get their slots and storage here (a stamped key in `state/storage.ts`), their Find-based setting comes with R4. Edit the grid in `spec/keyboard.yaml` (the maths rows 3–9 do not move), replace the `app` and `cas` keys by the user keys U2 and U3 with those defaults (their old Shift layers go), make the place name a button, move the pad, keep the `cancel` key's id and its Shift layer (Undo, R16), update the trackpad zones, the legends, `tools/probes/unit-presses.mjs` and every test that names a moved key; keys typed while an app loads (R8) now include the status taps; remove `app` and `cas` (and `symb`/`plot`/`num` if they fold) from `PASS` in `views/sheetKeys.ts` and `AT_ONCE` in `App.svelte`; the place-name tap no longer opens Apps (`status.spec.ts` changes). Gate: e2e for each path in the press table, viewport share not below R8's 0.354, keyboard test, gallery, gestures and flicks e2e. Shared-file text in the report.

### ron, R11: history-row actions, branch `p1/ron-m4a-rows`
docs/05 3.3 and 3.5 limited by section 7 point 2: **Home and CAS only.** ▲ on an empty line picks a row (exists); a row of buttons appears above the entry line: Insert · Recall · Copy · Store ▶ · Delete; hidden while typing; **the Menu is one fixed list of nine (S2, accepted): 1 Insert, 2 Recall, 3 Copy, 4 Store ▶, 5 Delete, 6 Copy as › (as shown, exact, LaTeX), 7 Paste, 8 Share session, 9 Clear history**, the same numbers whether or not a row is picked, acting on the picked row, else the last result (Delete: the last row); the buttons are items 1–5; the long press opens the same list on its row. Build the actions as one list used by the buttons, Menu and long press, so the "results mode" idea can reuse it. Gate: e2e per action from keys and from touch; task benchmark has no task with more presses; history performance test unchanged.

### ron, R12a and R12b: visual pass, branch `p1/ron-m4a-look`
**R12a:** read the owner's UI points in `docs/feedback.md` (and anything added since); make mockups as one static HTML page (Home with history, a menu sheet, the Mode sheet, Settings, Plot; light and dark at phone size) in `docs/mockups/` and end the package. The owner reviews them on the phone and says what to change. **R12b** (started with the owner's notes): design tokens in one file (docs/05 3.10: colours per role, type scale, 4 px spacing, radii, motion); no colour or size written directly in a component; history rows (3.5); **theme setting System / Light / Dark, Dark by default on Android, System in the PWA**; press feedback within one frame; `prefers-reduced-motion`. Gate: contrast test, gallery reviewed by the owner, start chunk within 2 kB of before.

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

### Night packages (section 0c)

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
2. Use the package's branch from the table in 0a or 0b (4a branches are `p1/<name>-m4a-<pkg>`). Read the report (`git log -1 p1/<name>-m4-<pkg>`) and the diff (`git diff phase-1...p1/<name>-m4-<pkg>`) against the backlog step and the docs/04 sections it names. Check the claims:
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
   - **rewrite, don't amend:** where the package changes what a doc says, change that text in place (no "amended"/"superseded" notes or strikeouts; git keeps the history), and remove the finished package's text from section 7 of this brief and its row from 0a/0b
   - remove the worktree, then `git branch -d`
   - commit with `git commit -s`
   - never push
5a. **After merging a ron package (4a), build and install the owner's APK** from the main checkout: `./build.sh --engine-dir engine/giac/_out/gsl --no-units --install` (the script takes the host-cpu lock). Install only `org.pascaline.app`, on the owner's phone (the only device the owner connects for this). Then tell the owner what to try, in three lines at most, and append a line to `docs/feedback.md` "waiting for the owner's notes on <package>".
6. When a merge completes milestone 4: write `docs/shifts/<date>-m4-report.md` (rules section 11, step 5) and add milestone 4 to docs/02 section 12. The report says what the owner should try on the APK: marks, Find, copy and paste, and the empty-line Ans.
