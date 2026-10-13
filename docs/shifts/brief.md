<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Shift brief: milestone 4a "feel", then the rest of milestone 4 "Find and trust" (shifts `m4a` and `m4`, run by the owner)

**Manual mode (user, 2026-10-12):** there is no coordinator. The owner starts each work package as its own session and, when it is done, a short review session that checks and merges it (section 8a). The standing rules in [rules.md](rules.md) still apply (sections 1, 3, 5, 6, 9). Where they say "Henri" or "message", read this brief instead; where the two differ, this brief wins.

## 0. State at start
`phase-1` at `f296a92` (2026-10-13). Merged: milestone 4 packages G0–G4, R1–R3, A1–A3; milestone 4a packages R5, A5, R6, S1, R7, R8, R9, R10. **Next:** R17 (URGENT: a silent wrong answer), R13, R16, R14, R18, then R15a and R15b. S2 is done: its menu rules (decisions.md "S2: one menu system", accepted 2026-10-13) add items to R13, R18, R15, R11 and R4, written into their text below. No package waits for an APK to be tried (owner, 2026-10-13): a package starts when the one before it is merged. The text of finished packages is in git history (`git show b2f1e7e:docs/shifts/brief.md`). Left for the owner: the unmerged `p1/ron-eve-gestures` (the old flick classifier; backlog C7).

## 0b. Milestone 4a packages (P11, signed off by the owner 2026-10-13): **do these first**
Goal: the owner's feedback of 2026-10-13 ([feedback.md](../feedback.md)) and the UI plan ([05-ui-plan.md](../05-ui-plan.md); its **section 7 wins** where it differs). Backlog "Milestone 4a" is binding. The m4 packages of 0a that are not done (R4, A4) come after 4a.

> **URGENT: R17 goes next** (owner, 2026-10-13). With text selected, x², xʸ and x⁻¹ square only the last character (`1+2` selected, x² gives `1+2²` = 5, not 9) and every function key deletes the selection. The first is a silent wrong answer (CLAUDE.md principle 3). R17's every-key test covers R10's Tmpl palette too; R17 must be merged before R13, R14 and R18, which add or change keys. Full text: section 7, "R17".

| # | Package | Agent, model | Branch | Start when merged | Size |
|---|---|---|---|---|---|
| **R17** | **URGENT: a selection survives every key (bug)** | ron, Sonnet (Opus review) | `p1/ron-m4a-selection` | now | ~0.5–1 d |
| R13 | Dead layers off (quote, Shift + ◀ ▶), plus S2's Menu-row fix, Decimals move, dead-key haptic | ron, Sonnet | `p1/ron-m4a-dead` | R17 | ~0.5 d |
| R16 | Undo on Shift + Cancel (P13) | ron, Sonnet | `p1/ron-m4a-undo` | R13 | ~0.5 d |
| R14 | The exponent key (`ᴇ`) | ron, **Opus** | `p1/ron-m4a-exp` | R16 | ~1 d |
| R18 | The Shift palettes: Shift + 6 relations and logic, Shift + 9 symbols and Greek | ron, **Opus** | `p1/ron-m4a-shiftpal` | R14 | ~1.5 d |
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

### ron, R17 (URGENT): a selection survives every key, branch `p1/ron-m4a-selection`
Owner's bug report, 2026-10-13 ([feedback.md](../feedback.md) #37): with some entry selected, ÷ divides the whole selection, but the abs key replaces it with an empty `|□|`. Sandra's investigation (same day, probed in the real app with Playwright on Chromium, Pixel 7 profile, `?engine=fake`, MathLive 0.111.1) found that it is not only abs, and that one form of it gives a wrong number without any warning. Do this package **now**, before R13. R10 rewrote much of `spec/keyboard.yaml` (the `templates:` palette), so the yaml line numbers below are as of `fbe96ff`: find each template by its key id, and include the palette's own templates (`keyboard.palette`) in the every-key test. Size ~0.5–1 d. Sonnet is enough because the change is small and a spec-wide test guards it; the Opus review (section 8a) must check the contract below, not only that the tests pass.

**Why it is urgent.** CLAUDE.md principle 3 says no silent wrong answers. A user who selects `1+2` and presses x² sees `1+2²` and Enter gives 5 instead of 9. The deleted-selection cases are less dangerous (the user sees the empty box) but they cost retyping on a calculator whose point is speed. Both hit the key set that R10 (Tmpl palette), R14 (the exponent key) and R4 (Find inserts functions) are about to extend, so the rule has to exist, and be tested for every key, before they land.

**The evidence (reproduce it first; it is also the failing test).** Type `1 + 2`, select everything (`mf.executeCommand("selectAll")`), press one key, read `window.pascaline.entry.value`. For the one-atom case type `4 + 2` and select only the `2` (`mf.selection = { ranges: [[2, 3]] }`).

| Key (layer) | Template in `spec/keyboard.yaml` | `1+2` selected, today | Wanted |
|---|---|---|---|
| ÷, a/b | `\frac{#@}{#?}` | `\frac{1+2}{□}` | unchanged |
| `( )`, √, ⁿ√ | `\left(#0\right)`, `\sqrt{#0}`, `\sqrt[#?]{#0}` | `(1+2)`, `√(1+2)`, `ⁿ√(1+2)` | unchanged |
| **abs** (Shift + (−)) | `\left\|#?\right\|` | `\left\|□\right\|` (selection gone) | `\left\|1+2\right\|` |
| **sin, cos, tan, ln, log** | `\sin\left(#?\right)` … | `\sin\left(□\right)` (selection gone) | `\sin\left(1+2\right)` |
| **sin⁻¹, cos⁻¹, tan⁻¹, eˣ, 10ˣ** (Shift) | `\arcsin\left(#?\right)`, `\exponentialE^{#?}`, `10^{#?}` | empty argument (selection gone) | selection inside the argument or exponent |
| **approx** (Shift + Enter) | `\operatorname{approx}\left(#?\right)` | `\operatorname{approx}\left(□\right)` | `\operatorname{approx}\left(1+2\right)` |
| **x²** | `#@^{2}` | **`1+2^2`** (wrong value) | `\left(1+2\right)^2` |
| **xʸ** | `#@^{#?}` | **`1+2^{□}`** (wrong value) | `\left(1+2\right)^{□}` |
| **x⁻¹** (Shift + ÷) | `#@^{-1}` | **`1+2^{-1}`** (wrong value) | `\left(1+2\right)^{-1}` |

With only the `2` of `4+2` selected the same keys give `4+sin(□)`, `4+approx(□)` (the `2` is deleted) and `4+2^2` (fine, because the base is one atom; keep it without brackets). The one-line entry setting has the same gaps: the `line:` variants of √ (`\operatorname{sqrt}\left(#?\right)`, `spec/keyboard.yaml` line 176) and of xʸ and x² (`\char"5E …`, lines 113 and 172) use `#?` or a bare caret, so a selection is lost or mis-bound there too. Line numbers are as of `fbe96ff`.

**Cause.** The controller passes every key's template to MathLive's `insert()` (`app/src/entry/controller.ts` `apply()`, the `insert` case, with `selectionMode: "placeholder"`), and `insert()` replaces the selection. What survives depends on the token in the template:
- `#@` = the selection, or the atom before the cursor when nothing is selected. It is pasted as raw LaTeX, which is why `#@^{2}` binds the exponent to the last character of `1+2`.
- `#0` = the selection, or a placeholder when nothing is selected. Safe.
- `#?` = always an empty placeholder. The selection is discarded.

`EntryController.run()` has a bracket-wrapping rule for the `#@^` keys (L8, `selectCompound()` and the branch at `controller.ts:230`), but `selectCompound()` returns false at once when the selection is not collapsed (`controller.ts:277`), so the rule never runs for an explicit selection. The yaml header documents the three tokens but does not say which one a key must use, so each key got whichever its author wrote.

**The contract to build (write it into the code, the yaml header and the tests).**
1. A non-empty selection is the **argument** of any key whose template has an argument slot. Functions and exponent keys put it inside their brackets or exponent; ÷ and a/b take it as the numerator (already so); roots take it as the radicand (already so); **power keys take it as the base, in brackets unless it is a single plain term**.
2. Keys with **no argument slot** (π, ∞, i, ∡, ▸ store, Ans, the exponent mark) and **operators and typed characters** (+, −, ×, digits, letters, `.`, `,`) replace the selection, as typing does in any editor. Do not change that.
3. With **nothing selected** every key behaves exactly as today (placeholder, or the L8/L9 compound rules). The change must not alter a single existing key sequence without a selection.
4. The rule is checked for **every** key, so a key added later (R10's Tmpl palette, R14, R4's Find) cannot silently break it.

**Work, in this order (test first, CLAUDE.md "every bug fixed gets a regression test first").**
1. **Failing tests first.** Commit them failing, or in one commit with the fix if the project's hooks need green commits; say which in the report.
   - `app/src/keyboard/keyboard.test.ts`: using `templates(kb)` (`keyboard.ts:221`), every insert template, in both the normal and the `line` variant, contains `#@` or `#0`, unless `keyId/layer/variant` is in an explicit `NO_ARGUMENT` list in the test (π, ∞, i, ∡, ▸, Ans, `eex`, and the plain `\div`, `\times`-style line variants). A new key must be added to the list on purpose, with a reason next to it. Also assert that a `#@^` template is never combined with a plain `^` in `line` form (`\left(#@\right)^…` is the accepted shape, as in the x⁻¹ line variant today).
   - `app/test/selection.spec.ts` (new, Playwright, Pixel 7 profile like the other specs): for every key and layer in `spec/keyboard.yaml` that has an insert action (read the list from the loaded keyboard through the test hook `window.pascaline`, or from the yaml with the `yaml` package the app already depends on, so new keys are included automatically), with `1+2` selected, press it (Shift and Alpha through the tap helpers as in the other specs; one-line mode too, via the setting) and assert that the entry value still contains `1+2` unless the key is in the replace list of rule 2. Add the exact expected strings of the table above for abs, sin, x², xʸ, x⁻¹, approx and √ (these are `derived`: `(1+2)^2` is 9). Add the one-atom case (`4+2`, the `2` selected: `4+sin(2)`, `4+2^2`, no brackets) and the no-selection case for each of those keys (unchanged).
   - Also run the LaTeX of the x² and x⁻¹ cases through `latexToGiac` in a vitest and expect Giac text that evaluates to 9 and 1/3 (`(1+2)^2`, `(1+2)^(-1)`), so the value, not only the string, is checked.
2. **Templates in `spec/keyboard.yaml`.** Change the argument placeholder from `#?` to `#0` in: abs (line 185), sin, cos, tan, ln, log (lines 122, 131, 140, 149, 158), sin⁻¹, cos⁻¹, tan⁻¹, eˣ, 10ˣ (lines 123, 132, 141, 150, 159), approx (line 199), and the `line:` variant of √ (line 176). Do not touch `\frac{#@}{#?}`, `\sqrt[#?]{#0}` (the `#?` there is the index, on purpose) or `\left(#0\right)`. The `sample` fields do not change. Fix the existing tests that name the old strings (for example `keyboard.test.ts` line 112, `\operatorname{sqrt}\left(#?\right)`).
3. **Find's function inserts.** `functionInsert()` in `app/src/find/rank.ts:35` builds `\operatorname{id}\left(#?\right)` for every tier-1 function; change it to `#0` too, and update `app/src/find/insert.test.ts` (line 14 builds the same string; its `fill()` on line 15 replaces `#?` only, so make it replace `#0` as well). R4 (Find UI) inserts these, and a selected expression should become the argument of `normald_cdf(…)` as it does for sin. docs/04 lines 238 and 268 name the `#?` form: put the corrected text in the report's "For shared files", do not edit docs/04.
4. **The power keys with a selection (`controller.ts`).** In `run()`, extend the branch at line 230 so that a template starting with `#@^` also takes the bracketed form when the selection is **not collapsed** and is not a single plain term, giving `\left(#@\right)^{2}` (the existing code already does `\left(#@\right)${a.latex.slice(2)}`). A "single plain term" is a number (`/^[\d.]+$/`), one letter, or a chip (`isChipLatex`); read the selected LaTeX with `mf.getValue(mf.selection, "latex")` or the ranges equivalent. Keep `selectCompound()` for the collapsed case as it is. Check by probe that after the key the caret sits after the closing bracket or in the exponent placeholder as it does for the collapsed case, and that Shift, Alpha and the queued keys (R8/R9 loading queue) take the same path.
5. **Do not widen the scope.** No change to digits, operators, Backspace, paste, history-row insertion (`insert()`, `controller.ts:175`, replaces a selection on purpose) or the exponent key; R14 replaces `eex` with a typed character and keeps rule 2.
6. **Document the contract where the next author will read it:** the template paragraph of the `spec/keyboard.yaml` header (the `#?` / `#@` / `#0` lines): say that an argument slot must be `#0` (or `#@` for a prefix argument) and `#?` only for slots that are not the main argument (the index of ⁿ√, the denominator, the second operand), and point to the two tests. The research note `docs/research/r6-pipelines.md` is not yours: put its text in the report.

**Gate.** Typecheck 0; vitest all pass (the new template test included); e2e all pass (the new `selection.spec.ts` included; also run `keys.spec.ts`, `entry.spec.ts`, `flicks.spec.ts` and `gestures.spec.ts`, because the key paths are shared); the golden gate is not needed (no parser or engine change), but the round-trip test of the samples must still pass; start chunk size reported (expect no change).

**Report adds:**
- The table above, re-run after the fix (before and after), as the **Tests** evidence.
- The list of keys in `NO_ARGUMENT` with their reasons.
- **For shared files:** a `docs/decisions.md` entry "A selection is the argument of the key (R17)" with the four contract rules; the corrected `functionInsert` text for docs/04 (3.3 and the line at 268); one sentence for `docs/research/r6-pipelines.md` section 1 (the EntryController line); the backlog tick.
- **Needs a decision:** (a) whether the real G2 wraps a selection for function keys (the owner asked for this behaviour; it is **not** verified on the G2 or the Virtual Calculator, so no `source: device` is claimed; add it to the optional spot-check list in `spec/mapping/vc-2026-10-11/SPOT-CHECK.md` only if the owner wants); (b) whether operators should wrap a selection (we say no, rule 2); (c) the bracket rule for a one-term selection of a name such as `ab` (we bracket anything that is not a number, one letter or a chip).
- **Not done:** anything from the list in step 5.

**Expected outcome for the owner to try on the APK (3 lines, section 5a):** select `1+2`, press x²: `(1+2)²` = 9. Select it and press sin or the abs shift: the selection is inside. Select just a `2` in `4+2` and press x²: `4+2²`.

### ron, R13: dead layers off, branch `p1/ron-m4a-dead`
P12 points 7 and 8 ([06-keypad-vs-g2.md](../06-keypad-vs-g2.md) section 3). In `spec/keyboard.yaml`: remove the `alpha` layer of `d0` (the quote mark) and the `shift` layers of `left` and `right` (`|◀`, `▶|`, `moveToMathfieldStart/End`); the gestures comment loses "shift ◀ = |◀"; the keys dim in those layers (the R6 rule) and a flick there shows ✕. Remove what only they used. List the free Shift cells in the report. (`!` gets its cell in R18's Shift + 9 palette.) **Plus three items from S2** ([research/r8-menus.md](../research/r8-menus.md) I1, I3, I8): (a) **Menu with a picked history row acts on that row** (today it drops the pick and copies the last result: `App.svelte:179-209`, `clipboard/actions.svelte.ts:57-61`); regression e2e first: three results, ▲ twice, Menu, Copy gives the middle one; (b) "Decimals in Fixed" moves from the Mode sheet to Settings › Format key cycle, as a value row under the Fixed tick (`views/modeSheet.ts`); (c) a key that does nothing in the open view (Menu in Symb, Tmpl in Plot, Fmt in an app) gives the dead-key double haptic of docs/05 3.7. Gate: keyboard test, gestures and flicks e2e, copy and status e2e, typecheck, vitest. No parser change.

### ron, R16: undo on Shift + Cancel, branch `p1/ron-m4a-undo`
P13 (decisions.md, accepted by the owner 2026-10-13). MathLive already keeps an undo history for the entry line, and a probe (2026-10-13, Playwright on the real app) showed it restores a deleted selection, a line cleared by Esc and a line cleared by Enter, one step per key press (a template insert is two). Read first: `app/src/entry/controller.ts` (`clear`, `set`, the `chips` getter, `run`), `spec/keyboard.yaml` (the `cancel` key, the gestures comment), `app/src/keyboard/keyboard.ts` (which `cmd` names it accepts). Four steps, **one commit each**, in this order:
1. **Chips survive Esc and Enter (bug first, regression test first).** `EntryController.clear()` empties the chip table and restarts `nextRes`, so undo after Esc or Enter on a line with a history-result or constant chip brings back `\res{k}{…}` with no value. First find out what the parser does with such a chip and put it in the report (an error is fine; a silent wrong answer is the bug). Then the rule: **undo never brings a chip back with a value other than its own.** Write the failing tests: (a) `1 + <result chip>`, Esc, undo, Enter gives the same result as before; (b) the same with Enter instead of Esc; (c) the collision case: a recalled history entry (`set`) whose chip key (`res:1`) is already in the table with another value, then undo. Fix: `clear()` keeps the table and `nextRes` (the `chips` getter already prunes to what is on the line); `set()` must not overwrite a key that holds another value. If the cheapest safe way is to reset MathLive's undo history in that one case (it has an internal `resetUndo`; check it is reachable from the field) or to renumber the recalled chips, take it and say which in the report.
2. **The key.** In `spec/keyboard.yaml` give `cancel` `shift: { cmd: undo }` and its legend a name (`$key.undo` in `app/src/i18n/en.ts`, "Undo"). The flick up on Cancel fires it through the existing flick path (the bubble shows "Undo"); nothing else about the key changes: the primary layer stays stop / close / clear. Undo on an empty history does nothing and raises no error. It works while a job is running (it edits the line, not the job). `endExponent` and the mixed-number trick (`mixedAfter`) must not be confused by an undo: check `2 a/b a/b` then undo.
3. **Tests.** New `app/test/undo.spec.ts` (real engine, phone size): select part of the line (set `mf.selection`, as `selectChip` does) + ⌫ + Shift + Cancel; select all + ⌫ + undo; Esc + undo; Enter + undo (the line is back, the history keeps its row); the flick up on Cancel from a real touch (`touch()` in `test/helpers.ts`); undo with nothing to undo; one-line mode; keyboard test and the legend in the gallery. Expected values are derived.
4. **Report.** Which apps the key covers: Home and CAS use the main entry line; check whether the Solve and Function slot editors use the same controller. If they do not, the key dims there (the R6 rule) and the report says so; do not build a second undo. Also report whether redo can be made to work in a few minutes (the probe's redo after undo did nothing); **no redo key in this package** either way.

Not in this package: redo, undoing Shift + Clear (wipes the history), undo across a relaunch, any new button, setting or screen element (docs/03 rules 7 and 9). **Removal test (docs/03 rule 11):** if the owner has not used Shift + Cancel after a week of daily use, the layer goes. Gate: typecheck, vitest, e2e (`undo`, `chips`, `entry`, `flicks`, `keys`), keyboard test, gallery; start chunk size reported (expected: no change). If R15b has moved the cluster by then, the `cancel` key keeps its id and its shift layer.

### ron, R14: the exponent key, branch `p1/ron-m4a-exp`
P12 point 4. The key at r7c1 (id `eex`) types the exponent mark `ᴇ` (U+1D07) as one token instead of the `\times10^{#?}` template; give the key id, i18n key and legend a name that is not EEX or ×10ⁿ (legend `ᴇ`); Shift stays Sto ▶. Parser: `<number>ᴇ<signed integer>` reads as number × 10^n exactly (`1.5ᴇ3` = 1500, as the template did), a missing mantissa on an empty line gets a leading 1 (the G2 shows `1ᴇ`), an exponent with a non-integer is an error that says so; one round-trip case per form in the same commit. Remove the `endExponent` workaround in `entry/controller.ts` (the exponent is no longer a nested atom) but keep its regression: `2.2ᴇ-9 × 4.7ᴇ3` (M4-2) must read as 1.034E-5 with the mark `=`. Paste (docs/04 2.6) enters `1.5ᴇ-3`. Check MathLive and the Android WebView draw `ᴇ` (fallback: a macro that draws a small-capital E). Results keep the E notation of Sci and Eng. Re-count the benchmark tasks that use the key and report presses against the template's. Gate: parser round trips, fuzz test, golden gate (parser change), e2e, size test.

### ron, R18: the Shift palettes, branch `p1/ron-m4a-shiftpal`
The owner's answers to R10 (2026-10-13, from photos of the G2). Two palettes on the sheet's grid variant (R10), each cell with its parser rule and round-trip case in the same commit:
- **Shift + 6, relations and logic, 4 × 3:** `<` `≤` `>` `≥` / `==` `≠` AND OR / NOT XOR EQ. The G2 labels each cell with the key at that place (7 8 9 ÷ / 4 5 6 × / 1 2 3), so that key picks it; do the same. These are where `<` and `≤` come from (piecewise conditions, R10). EQ: build it as recorded and ask (G2 checklist, `tests/golden/g2.yaml`).
- **Shift + 9, symbols and Greek, 8 × 3:** `!` → ∞ ° ′ ″ & Å / α β γ Δ δ ε θ λ / μ ρ Σ σ τ φ χ Ω. It replaces ∞ on the key (∞: 5 presses by keys, 3 by touch, 2 by flick + tap; today 2). `!` is factorial. Greek letters become variable names that do not clash with Giac functions (`beta`, `gamma`, `Gamma`): the parser maps them, with a round trip per letter.
From S2 (accepted): Esc goes back and Cancel closes both palettes (6 and 9 pick inside them, so they cannot toggle); both open on the last pick, like Tmpl; ° uses R10's DMS parser rule (degrees in every angle mode), so `30°` means one thing; μ and Ω are variable names, never units. Update [06-keypad-vs-g2.md](../06-keypad-vs-g2.md) through the report. Gate: parser round trips, golden gate (parser change), keyboard test, e2e for both palettes (picked by key and by tap), R17's every-key selection test, size test.

### ron, R15a and R15b: top cluster, branch `p1/ron-m4a-top`
P12 points 2 and 3 and open point B. **R15a:** one static page `docs/mockups/top-cluster.html` (phone size, light and dark) with two or three layouts. Common: no Home or CAS key; the status line's place name switches Home ↔ CAS in one tap with a hit area taller than the line; the Mode sheet is a chip. Vary: how Symb, Plot and Num are reached; the arrow pad one line down; where Apps, Esc, Cancel, Menu, View and Help sit so the cluster takes fewer rows. For each: rows saved, the viewport share (floor 0.35, docs/03 rule 9), and a press table for the G2 sequences (Home → CAS → Home, Symb / Plot / Num, angle change, Settings, Esc, Cancel, Menu, Copy, Paste) against the G2's count; the fallback if the bar is slow. Use the task rows of [research/r8-menus.md](../research/r8-menus.md) section 2 in the press table. **From S2 (accepted), in every layout:** Mode also on Shift + Apps (a keys-only path; Settings stays Mode's last row); the Apps sheet lists 1 Home, 2 CAS, then the apps (keys-only Home ↔ CAS, and the fallback without a new flick). End the package; the owner picks. **R15b:** build the pick. Edit the grid in `spec/keyboard.yaml` (the maths rows 3–9 do not move), remove the `app` and `cas` keys and their Shift layers, make the place name a button, move the pad, keep the `cancel` key's id and its Shift layer (Undo, R16), update the trackpad zones, the legends, `tools/probes/unit-presses.mjs` and every test that names a moved key; keys typed while an app loads (R8) now include the status taps; remove `app` and `cas` (and `symb`/`plot`/`num` if they fold) from `PASS` in `views/sheetKeys.ts` and `AT_ONCE` in `App.svelte`; the place-name tap no longer opens Apps (`status.spec.ts` changes). Gate: e2e for each path in the press table, viewport share not below R8's 0.354, keyboard test, gallery, gestures and flicks e2e. Shared-file text in the report.

### ron, R11: history-row actions, branch `p1/ron-m4a-rows`
docs/05 3.3 and 3.5 limited by section 7 point 2: **Home and CAS only.** ▲ on an empty line picks a row (exists); a row of buttons appears above the entry line: Insert · Recall · Copy · Store ▶ · Delete; hidden while typing; **the Menu is one fixed list of nine (S2, accepted): 1 Insert, 2 Recall, 3 Copy, 4 Store ▶, 5 Delete, 6 Copy as › (as shown, exact, LaTeX), 7 Paste, 8 Share session, 9 Clear history**, the same numbers whether or not a row is picked, acting on the picked row, else the last result (Delete: the last row); the buttons are items 1–5; the long press opens the same list on its row. Build the actions as one list used by the buttons, Menu and long press, so the "results mode" idea can reuse it. Gate: e2e per action from keys and from touch; task benchmark has no task with more presses; history performance test unchanged.

### ron, R12a and R12b: visual pass, branch `p1/ron-m4a-look`
**R12a:** read the owner's UI points in `docs/feedback.md` (and anything added since); make mockups as one static HTML page (Home with history, a menu sheet, the Mode sheet, Settings, Plot; light and dark at phone size) in `docs/mockups/` and end the package. The owner reviews them on the phone and says what to change. **R12b** (started with the owner's notes): design tokens in one file (docs/05 3.10: colours per role, type scale, 4 px spacing, radii, motion); no colour or size written directly in a component; history rows (3.5); **theme setting System / Light / Dark, Dark by default on Android, System in the PWA**; press feedback within one frame; `prefers-reduced-motion`. Gate: contrast test, gallery reviewed by the owner, start chunk within 2 kB of before.

## 8. Definition of done
- **Each branch:** typecheck 0; vitest all pass; e2e all pass (the known-flaky `solve.spec.ts` persistence test may be re-run once); SPDX headers; `git commit -s` with the trailer (`Claude Opus 5.5` or `Claude Sonnet 5.5`, whichever model ran); the report commit; start chunk size reported for UI packages.
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
