<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# S25 report: results mode, the six top-right keys, the viewport room (sandra, 2026-11-05)

Pipeline run 643, branch `p1/sandra-resultskeys` from `phase-1` 6ce82ab8. The note: [r19](../research/r19-results-and-keys.md) (open). Nothing in `app/src` changed.

## What I verified (rerun commands)

- **t01 and t03 on today's keys** (`tests/tasks/tasks.yaml`). Prefix chips were dropped (night review 2026-10-31 fh-8), so t01 is now active as Math, p a r, Enter, `4700 , 1ᴇ4`, Enter: **14 presses**, the same as the plan with chips (`1ᴇ4` is the shortest 10k; Enter right after an exponent evaluates, as in t03). Find puts `fn:par` first after three letters (`rank.ts` search: `p` → prefixes, `pa` → `unit:Pa`, `par` → `fn:par`). t03 is now active as `2.2ᴇ-9 × 4.7ᴇ3`: **13 presses** (the plan was 10). Rerun: `cd app && PW_PORT=<port> GIAC_OUT=<dir> npx playwright test test/tasks.spec.ts`: 14 passed; t01 14/14, t03 13/13.
- **Find's letters on digit keys** (found while replaying t01). In Find a digit key types its digit, or picks row n on an empty filter (`app/src/views/sheetKeys.ts` `findKey` :85-86), so `p a 8` searched "pa8". The letter is a flick down. tasks.yaml's header said `r = d8, s = d9`, and t06's pending plan typed `e 9`. Both now use `{down: d8}` / `{down: d9}`. The docs were wrong, the code is right.
- **Geometry** (`node tools/probes/results-geometry.mjs --options`, about 40 s). Every strip and option in r19 part 3. The probe had been broken since R15c4: the first-start tips caught its taps, and it now opens with `tips=off`.
- **Jobs and key layouts** (`node tools/probes/results-keys.mjs --ends`, about 20 s). The counts in r19 parts 1 and 2. In the app: ⇤ ⇥ and the box ends work, and a tap reaches the line's ends only inside the formula's box.

### Part 1's counts in full (keys | touch | results mode, one action per visit; row k back)

412 × 839 (2.5 rows visible, 7.9 collapsed):

| job | k=1 | k=2 | k=3 | k=4 | k=6 |
|---|---|---|---|---|---|
| reuse (insert) | 2·1·3 | 3·1·3 | 4·2·3 | 5·2·3 | 7·2·3 |
| copy | 1·2·4 | 3·2·4 | 4·3·4 | 5·3·4 | 7·3·4 |
| delete | 2·2·4 | 3·2·4 | 4·3·4 | 5·3·4 | 7·3·4 |
| plot (R53) | 3·2·4 | 4·2·4 | 5·3·4 | 6·3·4 | 8·3·4 |
| store as A | 4·4·5 | 5·4·5 | 6·5·5 | 7·5·5 | 9·5·5 |

At 360 × 740 (1.36 rows) touch costs one scroll from k = 2 on. A visit with n actions on visible rows costs 2 + 2n in the mode and 2n by long press today.

## What changed

- `tests/tasks/tasks.yaml`: t01 and t03 active, t06's plan, and the header's Find letters.
- `tools/probes/results-geometry.mjs` (extended), `tools/probes/results-keys.mjs` (new), and their two rows in `tools/probes/README.md`.
- `docs/research/r19-results-and-keys.md` (new, 7.6 kB; the live notes are now 149.2 of 150 kB).
- `docs/decisions.md` "Needs the user": one short line (the file is at 39,996 of 40,000 bytes; the full entry is below).
- `docs/README.md`: r19's index entry. `tools/docs-check.mjs` requires every live note linked once, so this one shared-file line is applied rather than left to the report.

## Still to verify (who, how)

1. **A stored unit result loses its unit and σ, end to end.** Today this is shown only by the code (`parse.ts:548-552`, `units/chip.ts:5`). Who: the named-values package's red-first e2e. How: t10's keys, ☰ 4, A, Enter, then A × 1, Enter; the row shows no σ and the mark is ≈.
2. **What "the move to end buttons did not really work well" means.** The owner names the case. The plain cases work (`--ends`).
3. **Use frequencies of the six keys.** R127's per-key counts are on the owner's phone (Settings › Counters, export). K0 beats K1 if ⇤ ⇥ taps exceed Redo + Paste.
4. **W2's row height** (one line per step). R129 draws it; R53b measures it in the app.
5. **R1 at font scale 1.5–2.0** (R41): do the short rows still fit their legends? Who: R53a's gallery case.

## Top risks

1. **Narrow phones are under the floor today.** At 360 × 740 the viewport is 198 px (0.268), and a picked row leaves 66 px of history, less than one 1÷3 row. The floor test runs only at 412 × 839 (`app/test/status.spec.ts:15`). This is no wrong number, but it is the size most Android phones have. R2 + R1 below 760 px fixes it (0.376).
2. **Results mode built as S9 shaped it saves no presses on visible rows.** If R53 is built before the worksheet (names) and the room, the removal test (14 collapses, 10 actions in 14 days) may remove a mode whose real job was never built.
3. **K1 moves four functions on keys the owner has learned for three weeks.** "Keys move once" (decisions, 2026-11-02 point 5): the pick must be final, and the first-start tips and `topcluster.spec.ts` change with it.

## For shared files (exact text)

**decisions.md "Needs the user"**, replacing the short line when the Opus pass makes room:

> **S25: results mode, the six keys, the room (pick from R129's mockup).** Recommendation: keys K1 (Undo | Redo and Copy | Paste each a pair on tap; Shift: Help | Clear, ⇤ | ⇥, ⇤□ | □⇥); results mode as the worksheet W (each row as today plus its stored name; a name keeps its unit and σ); the room R2 + R3, R1 below 760 px tall. Why: on a visible row the mode saves no press over a long press, so its job is the chain of named steps; Redo and Paste go from 2 presses to 1; 360 × 740 reaches the 0.35 floor. Cost: four keys change their face once; three ron packages and one gorge. Alternatives: K0 (today) or K2 (no jumps); W2 (one line per step); R2 alone. Would change if: R127's counts show ⇤ ⇥ used more than Redo + Paste (r19, linked as `research/r19-results-and-keys.md` from decisions.md).

**backlog.md "Needs the user"** (25 bytes free; for the Opus pass): `10. **S25:** pick the keys, results mode and the room from R129's mockup (decisions.md "Needs the user").`

**docs/05 3.5**, after the pick, replacing "(R12b; the 8 px more space is S25 part 3's)": "(R12b; 8 px more since R53a, paid by the keypad's 4 px gaps)".

**tests/tasks/README.md**, "Going active": "Milestone 4 turns on t05 (Find); milestone 5 on t01–t04 and t10 (t01 and t03 since S25, without prefix chips); milestone 6 on t06–t09."

**docs/shifts/packages/R129.md**, the whole file (the mockup package text):

> ### ron, R129: the study's mockups: results mode, the six top-right keys and the viewport room, branch `p1/ron-resultsmockup`
> **Lane:** A, day (the owner picks from it), **Sonnet** (a mockup page; nothing merges into `app/src`). **Starts when:** S25 is merged.
> **Why:** S25 (r19, linked as `../../research/r19-results-and-keys.md` from the package file) measured three layouts of the six keys, two screens for results mode and four room options. The owner picks from pictures, and keys move once (decisions.md, 2026-11-02 point 5).
> **Read:** r19 parts 1–3 and S25's report (`docs/shifts/2026-11-05-sandra-resultskeys-report.md`); `docs/mockups/top-cluster-r15c.html` (its phone drawing, Dark/Light/Both bar and summary table: reuse them); `docs/mockups/settings.html`; the theme tokens of `app/src/style.css` and the theme files (R50b–R50e); the probes' output (`node tools/probes/results-geometry.mjs --options`, `node tools/probes/results-keys.mjs`).
> 1. **The page** `docs/mockups/results-mode.html`, in the Pascaline theme, Dark and Light (the Dark/Light/Both bar), each phone drawn at 412 × 839 and 360 × 740 CSS px to scale:
>    - **Keys:** K0 (today), K1 (recommended), K2, as r19 part 2's table. Each shows the cluster with both layers' legends, a ghost of maths row 3, and under it r19's press row (Redo, Paste, ⇤ ⇥) and what moves.
>    - **Results mode:** W (recommended: today's rows plus a name tag on a stored row, e.g. `v = 20 m/s` over `72 km/h → m/s`, with σ muted and ⚠ with its reason line) and W2 (one line per step: name = result unit, the formula muted). Both are drawn collapsed: the 44 px slice, a picked row, and the line of six (Insert, Recall, Copy, Store ▶, Delete, Plot). Use five steps of an RC filter: R, C, τ = R·C, f = 1/(2πτ), with one ⚠ row. Write the measured viewport under each (767 px at 412 × 839, 668 px at 360 × 740).
>    - **Room:** today, R1, R2, R1 + R2 and R3 at both sizes, with the keypad drawn at its measured rows and gaps. Under each: viewport, share, history unpicked and picked, from r19 part 3's table. Draw the 0.35 floor as a line.
> 2. Nothing is drawn that S25 did not measure; a drawn number names its probe.
> 3. The report holds the "Needs the user" line: the pick of one per section, with S25's recommendation first (K1, W, R2 + R3 with R1 below 760 px).
> **Done when:** the page renders offline from the repo (no network, no fonts outside the repo); it is linked from `docs/mockups/` the way the other mockups are; the report holds the line; no file under `app/src` changes.

**docs/shifts/packages/R53.md, after the pick: what R53 becomes.** Four packages in this order, each ≤ 1 day, written by the Opus pass from the owner's pick:

1. **R53a (ron, Sonnet), keys and room.** `spec/keyboard.yaml` rows 1–2 as picked (K1: `undo` tap Undo / Shift ⇤; a new `redo` key with tap Redo / Shift ⇥; `copy` tap Copy / Shift ⇤□; a new `paste` key with tap Paste / Shift □⇥; `lstart` and `lend` go). Keypad gaps and padding go to 4 px. R82's short rows start at `max-height: 760px`. While a row is picked by ▲, its buttons sit in the empty entry line's slot, so the history does not jump. docs/05 3.5's 8 px more between entries. `status.spec.ts` asserts the floor at 360 × 740 too. The tips, `topcluster.spec.ts`, the gallery and docs/06's row change with them. Done when: Redo and Paste are one tap; the share is ≥ 0.35 at both sizes; picking a row moves no history pixel.
2. **R53b (ron, Opus), results mode as S9 shaped it, with W.** R53's current text (View collapses to the 44 px slice, a tap picks, the line of six, Plot as item 6, the ways back, the counters), plus the name tag on a stored row, and two new counters, `name` and `share`, while collapsed. Removal test as S9's.
3. **R53c (gorge, then ron), named values keep unit and σ.** A name stored from a unit result records its unit, dimension, σ and source row. The unit view reads it as a `\res` chip (R28 default 3 changes for such names only). Backup and library formats gain the fields with a version step (docs/04 6.2). Red-first: the end-to-end check under "Still to verify" 1.
4. **Later, by the removal test:** Share writes σ and the names (with F180's fix), and W2 if R129's pick is W2.

## Needs a decision

- The pick (above). t01's budget of 14 and t03's of 13 are measured counts that the owner agrees when a task goes active (`tests/tasks/README.md`).

## Not done

- R127's per-key counts were not read: they live on the owner's phone (still to verify 3).
- No backlog line was ticked: S25 has no line in `docs/backlog.md` (it is brief row 489 only), and the file is at 19,975 of 20,000 bytes.
