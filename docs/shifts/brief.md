<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Shift brief: milestone 4a "feel", then the rest of milestone 4 "Find and trust" (shifts `m4a` and `m4`, run by the owner)

**Manual mode (user, 2026-10-12):** there is no coordinator. The owner starts each work package as its own session and, when it is done, a short review session that checks and merges it (section 8a). The standing rules in [rules.md](rules.md) still apply (sections 1, 3, 5, 6, 9). Where they say "Henri" or "message", read this brief instead; where the two differ, this brief wins.

## 0. State at start
`phase-1` after the merges of R17, S2, R13, R16 and R14 (2026-10-13). Merged: milestone 4 packages G0–G4, R1–R3, A1–A3; milestone 4a packages R5, A5, R6, S1, R7, R8, R9, R10, R13, R14, R16, R17. **Next:** R18, then R15a and R15b. S2 is done: its menu rules (decisions.md "S2: one menu system", accepted 2026-10-13) add items to R18, R15, R11 and R4, written into their text below. No package waits for an APK to be tried (owner, 2026-10-13): a package starts when the one before it is merged. The text of finished packages is in git history (`git show b2f1e7e:docs/shifts/brief.md`). Left for the owner: the unmerged `p1/ron-eve-gestures` (the old flick classifier; backlog C7).

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
