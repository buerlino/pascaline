<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Shift brief: milestone 4a "feel", then the rest of milestone 4 "Find and trust" (shifts `m4a` and `m4`, run by the owner)

**Night shift 2026-10-14:** henri runs the queue in section 0c; for that shift 0c wins over everything below and over rules sections 4, 10 and 11. **Manual mode (user, 2026-10-12)** otherwise: there is no coordinator. The owner starts each work package as its own session and, when it is done, a short review session that checks and merges it (section 8a). The standing rules in [rules.md](rules.md) still apply (sections 1, 3, 5, 6, 9). Where they say "Henri" or "message", read this brief instead; where the two differ, this brief wins.

## 0. State at start
`phase-1` after the merges of R17, S2, R13, R16 and R14 (2026-10-13). Merged: milestone 4 packages G0–G4, R1–R3, A1–A3; milestone 4a packages R5, A5, R6, S1, R7, R8, R9, R10, R13, R14, R16, R17. **Next:** R18, then R15a and R15b. S2 is done: its menu rules (decisions.md "S2: one menu system", accepted 2026-10-13) add items to R18, R15, R11 and R4, written into their text below. No package waits for an APK to be tried (owner, 2026-10-13): a package starts when the one before it is merged. The text of finished packages is in git history (`git show b2f1e7e:docs/shifts/brief.md`). Left for the owner: the unmerged `p1/ron-eve-gestures` (the old flick classifier; backlog C7).

## 0c. Night shift 2026-10-14: henri's plan (owner, 2026-10-14)
The owner planned this shift in advance. henri (Sonnet, medium) **executes it and decides nothing**: he spawns one fresh agent per step with the prompts below, waits, logs, and spawns the next. **Low usage comes first** (the week is at 75%): the aim is to make the 5-hour window last, not to fill it. Whatever is not done stays in the queue for tomorrow.

### Rules for this shift (they replace rules sections 4, 10 and 11 and change section 8a)
1. **One agent at a time.** Never two workers, or a worker and a reviewer, at once.
2. **A fresh agent for every step:** each package, each review, each fix round and each Opus pass is a new spawn. Never SendMessage to give an agent a second task. Prompts are the templates below with the blanks filled in, nothing more (the agents read the brief themselves).
3. **Spawn in the background, then end your turn.** Do not poll, sleep, read diffs, run tests or builds, or read files beyond this brief and `.coord/log.md`. You wake when the agent finishes.
4. **No APKs, no devices:** skip section 8a step 5a and its feedback.md line. Nobody runs `adb` or `build.sh`. annabell is not used tonight.
5. **Models:** workers run Sonnet, effort medium. One exception: R18 runs Opus (signed in 0b), effort medium. Reviews run Sonnet, effort medium (section 8a says Opus; tonight Sonnet). Opus passes run Opus, effort medium.
6. **henri decides nothing.** A question, a blocked worker, a conflict or anything this section does not settle: log it and hand it to the next Opus pass (run that pass at once if the question blocks the queue). **Follow every Opus-pass recommendation as written.** Plan changes go to the owner through `docs/decisions.md` "Needs the user", written by the Opus pass.
7. **Start-up:** `date`; `git switch phase-1 && git status` (must be clean; if not, stop and log); `tools/devlock.sh status`. Append a section "2026-10-14 night" to `.coord/log.md`. No roll call, no device watcher.
8. **Log:** one line per step in `.coord/log.md`: time, step, agent and model, outcome, commit. The log is the queue state: on a resume, read it and continue from the first step not done.
9. **Usage limit:** if a spawn fails or you hit a limit, log the time and the queue position and end your turn. No retry loops. The owner resumes with `claude --agent henri "Resume the night shift from .coord/log.md."`
10. **Worker gone without a report** (no report commit): spawn one fresh worker with the same prompt (it continues from the branch's last commit). If that one also fails, log it, leave the branch, and go on with the next package.

### The queue
Estimates are wall-clock guesses. Each package is: worker, then review; a "fix" verdict adds a fix round (fresh worker, then a fresh review), at most two rounds; after the second "NOT MERGED" leave the branch unmerged, log it, go on. **Opus pass:** after every three finished packages (merged or left unmerged; fix packages from a pass count), and once at the end for any finished package no pass has covered yet.

| Step | What | Agent, model | Branch | Est. |
|---|---|---|---|---|
| 1 | R18 Shift palettes (section 7) | ron, **Opus** | `p1/ron-m4a-shiftpal` | 2 h + review |
| 2 | R15a top-cluster mockups (section 7; ends with the page; the owner picks in the morning) | ron, Sonnet | `p1/ron-m4a-top` | 30 min + review |
| 3 | G5 solver bugs SB1–SB4 (section 7) | gorge, Sonnet | `p1/gorge-m4-sb` | 1 h + review |
| 4 | **Opus pass 1** on steps 1–3, then its FIX packages | Opus | — | 20 min + fixes |
| 5 | G6 the §2.3 audit (section 7) | gorge, Sonnet | `p1/gorge-m4-prec` | 1 h + review |
| 6 | R19 M4-10 and the `mod` parser bug (section 7) | ron, Sonnet | `p1/ron-m4-fix` | 45 min + review |
| 7 | R20 Solve and analysis copy (section 7) | ron, Sonnet | `p1/ron-m4-copy` | 45 min + review |
| 8 | **Opus pass 2** on what came after pass 1, then its FIX packages | Opus | — | 20 min + fixes |
| 9 | Shift report, then stop | henri | — | 10 min |

Not tonight: R15b and everything after it in 0b (they wait for the owner's pick), R4 and A4 (after 4a), milestone 5.

### Prompt templates (Agent tool; `run_in_background: true`; `effort: "medium"`)
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

### Shift report (step 9, henri)
`docs/shifts/2026-10-14-night-report.md`, short and plain, from the log and the agents' replies: what was merged (with commits); what is unmerged and why; the Opus passes' NOTES; what the owner must do (pick an R15a layout; items under "Needs the user"); the queue left for tomorrow. Commit it on `phase-1` with `git commit -s` and the Sonnet trailer. Never push.

## 0b. Milestone 4a packages (P11, signed off by the owner 2026-10-13): **do these first**
Goal: the owner's feedback of 2026-10-13 ([feedback.md](../feedback.md)) and the UI plan ([05-ui-plan.md](../05-ui-plan.md); its **section 7 wins** where it differs). Backlog "Milestone 4a" is binding. The m4 packages of 0a that are not done (R4, A4) come after 4a.

| # | Package | Agent, model | Branch | Start when merged | Size |
|---|---|---|---|---|---|
| R18 | The Shift palettes: Shift + 6 relations and logic, Shift + 9 symbols and Greek | ron, **Opus** | `p1/ron-m4a-shiftpal` | now | ~1.5 d |
| R15a | Top cluster: mockups for the owner | ron, Sonnet | `p1/ron-m4a-top` | R18 | ~0.5 d |
| R15b | Top cluster: implementation | ron, **Opus** | `p1/ron-m4a-top` (same) | R15a approved by the owner | ~2 d |
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

### ron, R18: the Shift palettes, branch `p1/ron-m4a-shiftpal`
The owner's answers to R10 (2026-10-13, from photos of the G2). Two palettes on the sheet's grid variant (R10), each cell with its parser rule and round-trip case in the same commit:
- **Shift + 6, relations and logic, 4 × 3:** `<` `≤` `>` `≥` / `==` `≠` AND OR / NOT XOR EQ. The G2 labels each cell with the key at that place (7 8 9 ÷ / 4 5 6 × / 1 2 3), so that key picks it; do the same. These are where `<` and `≤` come from (piecewise conditions, R10). EQ (G2 item 32): the G2 puts the List command `EQ()` on the line; ours inserts `EQ(□,□)`, read by the parser as `==` of the two boxes (Giac has no EQ).
- **Shift + 9, symbols and Greek, 8 × 3:** `!` → ∞ ° ′ ″ & Å / α β γ Δ δ ε θ λ / μ ρ Σ σ τ φ χ Ω. It replaces ∞ on the key (∞: 5 presses by keys, 3 by touch, 2 by flick + tap; today 2). `!` is factorial. Greek letters become variable names that do not clash with Giac functions (`beta`, `gamma`, `Gamma`): the parser maps them, with a round trip per letter.
From S2 (accepted): Esc goes back and Cancel closes both palettes (6 and 9 pick inside them, so they cannot toggle); both open on the last pick, like Tmpl; ° uses R10's DMS parser rule (degrees in every angle mode), so `30°` means one thing; μ and Ω are variable names, never units. Update [06-keypad-vs-g2.md](../06-keypad-vs-g2.md) through the report. Gate: parser round trips, golden gate (parser change), keyboard test, e2e for both palettes (picked by key and by tap), R17's every-key selection test, size test.

### ron, R15a and R15b: top cluster, branch `p1/ron-m4a-top`
P12 points 2 and 3 and open point B. **R15a:** one static page `docs/mockups/top-cluster.html` (phone size, light and dark) with two or three layouts. Common: no Home or CAS key; the status line's place name switches Home ↔ CAS in one tap with a hit area taller than the line; the Mode sheet is a chip. Vary: how Symb, Plot and Num are reached; the arrow pad one line down; where Apps, Esc, Cancel, Menu, View and Help sit so the cluster takes fewer rows. For each: rows saved, the viewport share (floor 0.35, docs/03 rule 9), and a press table for the G2 sequences (Home → CAS → Home, Symb / Plot / Num, angle change, Settings, Esc, Cancel, Menu, Copy, Paste) against the G2's count; the fallback if the bar is slow. Use the task rows of [research/r8-menus.md](../research/r8-menus.md) section 2 in the press table. **From S2 (accepted), in every layout:** Mode also on Shift + Apps (a keys-only path; Settings stays Mode's last row); the Apps sheet lists 1 Home, 2 CAS, then the apps (keys-only Home ↔ CAS, and the fallback without a new flick). End the package; the owner picks. **R15b:** build the pick. Edit the grid in `spec/keyboard.yaml` (the maths rows 3–9 do not move), remove the `app` and `cas` keys and their Shift layers, make the place name a button, move the pad, keep the `cancel` key's id and its Shift layer (Undo, R16), update the trackpad zones, the legends, `tools/probes/unit-presses.mjs` and every test that names a moved key; keys typed while an app loads (R8) now include the status taps; remove `app` and `cas` (and `symb`/`plot`/`num` if they fold) from `PASS` in `views/sheetKeys.ts` and `AT_ONCE` in `App.svelte`; the place-name tap no longer opens Apps (`status.spec.ts` changes). Gate: e2e for each path in the press table, viewport share not below R8's 0.354, keyboard test, gallery, gestures and flicks e2e. Shared-file text in the report.

### ron, R11: history-row actions, branch `p1/ron-m4a-rows`
docs/05 3.3 and 3.5 limited by section 7 point 2: **Home and CAS only.** ▲ on an empty line picks a row (exists); a row of buttons appears above the entry line: Insert · Recall · Copy · Store ▶ · Delete; hidden while typing; **the Menu is one fixed list of nine (S2, accepted): 1 Insert, 2 Recall, 3 Copy, 4 Store ▶, 5 Delete, 6 Copy as › (as shown, exact, LaTeX), 7 Paste, 8 Share session, 9 Clear history**, the same numbers whether or not a row is picked, acting on the picked row, else the last result (Delete: the last row); the buttons are items 1–5; the long press opens the same list on its row. Build the actions as one list used by the buttons, Menu and long press, so the "results mode" idea can reuse it. Gate: e2e per action from keys and from touch; task benchmark has no task with more presses; history performance test unchanged.

### ron, R12a and R12b: visual pass, branch `p1/ron-m4a-look`
**R12a:** read the owner's UI points in `docs/feedback.md` (and anything added since); make mockups as one static HTML page (Home with history, a menu sheet, the Mode sheet, Settings, Plot; light and dark at phone size) in `docs/mockups/` and end the package. The owner reviews them on the phone and says what to change. **R12b** (started with the owner's notes): design tokens in one file (docs/05 3.10: colours per role, type scale, 4 px spacing, radii, motion); no colour or size written directly in a component; history rows (3.5); **theme setting System / Light / Dark, Dark by default on Android, System in the PWA**; press feedback within one frame; `prefers-reduced-motion`. Gate: contrast test, gallery reviewed by the owner, start chunk within 2 kB of before.

### Night packages (section 0c)

### gorge, G5: solver bugs SB1–SB4, branch `p1/gorge-m4-sb`
Backlog "Solve bugs". For each bug, in this order: the golden case (expected value from `oracle.py` or `derived`, never from memory), a commit where it fails, the fix, a commit where it passes. Files: `app/src/engine/` (`solve1.ts`, `numeric.ts`, `homeEval.ts`), `tests/golden/`. Keep every existing solve and precision case passing.
- **SB1:** `s30-wilk7`'s equation at digits 12 gives "no root found"; the residual check at W = 30 rejects a good root. A root that substitutes back within the rounding bound of the expanded polynomial is accepted; a wrong root is still rejected or marked `⚠`.
- **SB2:** `expand((x-1/3)^4)=0` finds no root. It must find a root near 1/3 (`derived`) with the mark the agreement check gives, never "no root found" and never `=`; a multiple root confirms fewer digits, and the mark must say so.
- **SB3:** the bracket search returns 3.333, not the root nearest the guess 15.33. The equation is in G3's report (`git show 29231d7`, `git log --grep=G3`); if it is not there, put SB3 under "Needs a decision" and skip it. Fix: the nearest root to the guess, or the bracket nearest the guess first.
- **SB4:** `[romberg(exp(-x^2),x,0,1),1/3]` marks 1/3 with ⚠13 (`floatFacts` gives every element the weakest mark). Each element carries its own mark; the list's mark is still the weakest. Check how Home draws per-element marks today; if it draws one mark per list, keep the list mark and put per-element display under "For shared files" as a ron follow-up.
Gate: golden gate, `solve.test.ts`, vitest, e2e `solve.spec.ts`.

### gorge, G6: the §2.3 audit, branch `p1/gorge-m4-prec`
Milestone 4 gate: "no §2.3 item #1–#9 is left". For #1–#6, #8 and #9 (#7 is moot): find the regression case (`tests/golden/`), run it, and record fixed (case id, commit) or open. Fix what is open and belongs to milestone 4, each regression case first: #2 (`normald_icdf` and the other inverse functions marked `⚠` and not tier 0; the polish is m6), #5 (a ≤ 14-digit fallback with `⚠` instead of the input as text). Anything open that is not m4 goes in the report with its milestone. Report: the new "Fix" column text for docs/04 §2.3 under "For shared files". Gate: golden gate, oracle check (`oracle.py`), vitest.

### ron, R19: M4-10 and the `mod` parser bug, branch `p1/ron-m4-fix`
- **M4-10** (decided 2026-10-12, decisions.md): (1) the Function Plot readout lines (root, extremum, intersection, area) get `⚠` when the value behind the line is warned; (2) a Solve `⚠` is kept across a reload (stored with the app state). A regression test first for each.
- **`\operatorname{mod}(a,b)`** (from G4, backlog milestone 4 step 7): the parser emits Giac `mod(a,b)`, which is an error. Emit the Giac form that gives what Find's `mod` entry says (read its insert and preview in the index); probe it with `node engine/giac/smoke.mjs`. Round-trip cases with a positive and a negative first argument, values `derived` from the definition Find states; if Find states no sign rule, record the negative case `assumed` with a G2-checklist question.
Gate: parser round trips, golden gate (parser change), e2e for both M4-10 points, size test.

### ron, R20: Solve and analysis copy, branch `p1/ron-m4-copy`
Backlog milestone 4 step 9, open part; docs/04 §2.6 row "Solve root, analysis value": the default copy (Shift + View, long press) copies the full value, and the Menu has "as shown". Use A3's `ClipboardPort` (`app/src/clipboard/`) and its full-value formatter; no new copy path. Covers the Solve roots and the Function Plot readout values. List and matrix element copy are not in this package. Gate: e2e for each from keys and from touch (paste back gives the same value, P5), size test.

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
