<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# The hunts

One block per hunt: a heading `## <prefix>: <title>` (the prefix labels the findings and names the report, `$RUN/reports/<prefix>.md`), a **Runs when** line the coordinator checks against step 0a's values, and the hunter's brief. The hunter prompt of `prompts.md` pastes the whole block, so `{…}` values are filled as in COMMON. To add or remove a hunt, add or delete one block; each hunt costs one hunter and one verifier.

"The merges" below means `git log --merges --first-parent --format='%h %ci %s' {SINCE}..{BASE}` (also in `{RUN}/merges.txt`): everything merged into phase-1 since the last review.

## ca: codebase analysis
**Runs when:** always.
- How well does the code follow `docs/04-architecture.md`? Module boundaries (engine code knows nothing about the UI), the direction of dependencies, and files near or over 800 lines against `tools/line-baseline.yaml`.
- Duplicated logic, dead exports and dead files, type safety (no `any`).
- Test gaps on the high-risk paths: engine, parser, units, uncertainty, stored data and its migration.
- **The start chunk:** its size against its budget (docs/04 section 8.3 and the "Start chunk" entry of `docs/decisions.md`; the newest measured size is in the log: `grep -n 'start chunk' {MAIN}/.coord/log.md | tail -3`). List what is statically imported into it that could load lazily, with the kB each would save (estimated from the source size, and say so; no build).
- Start with the files the merges changed most: `git -C {REVIEW} diff --stat {SINCE} {BASE} -- app/src | sort -t'|' -k2 -n | tail -15`.
- Output: a ranked list of structural problems with file:line.

## fh: features an engineer will miss
**Runs when:** always.
- Read the goal and principles (rules-core), `docs/05-ui-plan.md`, section 0 of `docs/03-feature-analysis.md`, `spec/keyboard.yaml`, `tests/golden/g2.yaml` and the backlog's plan. The G2 guides but isn't copied, and the clean-room rules hold: no HP text, firmware or manual wording.
- Find what an engineer will miss in daily use before v0.1.0 that no package or backlog line plans: units, uncertainty, precision, history, entry, results, Find, Settings, the web version, data safety. The last note's feature items (`{LAST_NOTE}`) are known: don't repeat them.
- Per feature: who needs it and when, why it isn't covered, where it would go in the code, its size (at most a day each, or split it), and conflicts with decisions. A conflict becomes a proposal for the owner, never a package.
- Severities are user-value tiers here (S1 = an engineer can't do a daily task without it). Rank by user value; at most 15 features.

## be: bugs in the maths (engine, parser, marks)
**Runs when:** always.
- Silent wrong numbers and false marks (=, ≈, ⚠; principle 3, "the mark never lies"): branch cuts, signed zero, tiny and huge arguments, complex results in real mode, angle-mode (DEG/RAD/GRAD) leaks, approx/exact mode leaks, the decimal comma in every number path, units with their conversions and offsets, uncertainty (σ) through functions and constants, integer and rational edges.
- Look hardest at the number paths the merges added or changed.
- Leads: the bug families in `docs/research/bug-patterns.md`, the archive's `r16-verification.md`, the bug hunt (`archive/bug-hunt-2026-10-19.md` in docs/ at `98e96656`), and the last review's note. Don't repeat their findings: find new members of the families.
- Every expected value comes from the mpmath oracle or is derived and shown. Every finding has its `smoke.mjs` or probe command.

## bu: bugs in the app (keys, entry, state, views)
**Runs when:** always.
- Key routes (`spec/keyboard.yaml` against `app/src/keyboard/`), the Shift and Alpha layers and the free keys, MathLive entry and its round trip to our parser, history (store, recall, edit), stored data and its migration (an update must keep the user's data), the Mode sheet and Settings, Find, user keys, the decimal comma, the PWA update path and the web build.
- Start with the flows the merges changed.
- Find flows that lose an answer or an entry, freeze, show stale state, or differ between Home and CAS.
- Reproduce with a single-file vitest or a probe where you can; otherwise give file:line reasoning and mark it "(to verify)".

## dc: declutter (proposals only, no edits)
**Runs when:** always.
- **Code:** dead files and exports, unused dependencies (against `THIRD_PARTY.md`), stale feature flags, old probes, duplicate helpers, tests that test nothing.
- **Docs:** stale facts (a line that says something is open or "not filed" when `git log` or the code shows it done), research notes marked decided whose packages exist (rules section 10: they move to `docs/archive/`), package files of merged packages, broken or circular "see" chains, and the size budgets (`DOCS_CHECK_REPO={REVIEW} node {REVIEW}/tools/docs-check.mjs`, behind the guard). Where a budget is full, name stale text that could go.
- **Scripts and tools:** unused scripts, and `tools/probes` without a README row.
- Per item: what to do (delete, move, rewrite as given), the exact path, and why it's safe (what still references it, by `git grep`).

## vr: this period's ron merges
**Runs when:** the merges hold at least one `Merge p1/ron-*` (step 0a's "ron" count).
- Every `Merge p1/ron-*` of the merges, up to `{BASE}`.
- Per merge: its package file as it stood at the merge's first parent (`git show <merge>^1:docs/shifts/packages/<ID>.md`; it's deleted after the merge), its report (`git log -1 <merge>^2`) and its diff (`git diff <merge>^1 <merge>`).
- Check: each "Done when" line really met; tests that would fail on the parent (pick the riskiest test per package and judge it by reading, or run it as a single file at the parent through `git show` into `{RUN}/probes/` only if it's cheap, else "(to verify)"); invented expected values; keys that moved (`docs/03-feature-analysis.md` section 0, rules 5–13); scope creep; i18n of new strings.
- Many merges: cover the riskiest first (entry, stored data, numbers), and list the ones you only skimmed.

## vg: this period's gorge, annabell and sandra merges
**Runs when:** the merges hold at least one `Merge p1/gorge-*`, `p1/annabell-*` or `p1/sandra-*` (step 0a's second count).
- Every such merge up to `{BASE}`, with vr's checks, plus:
- golden cases and their `source:` tags;
- engine patches against `engine/giac/patches/README.md`;
- changes to `scripts/pipeline.sh`, `pipeline-lib.sh` and `night.sh`: races between the two lanes, the lock order (integ, then nodemods, then host-cpu), and what happens when a lane dies holding a lock;
- changes to the web build and its workflows (pinned actions, permissions).

## lo: leftovers of earlier sessions (record, don't fix)
**Runs when:** always.
Make an inventory. Skip `{REVIEW}`, `{RUN}` and the branches the lanes are working on.
- Untracked files in the main checkout and in every worktree except `pl-*` (`git -C <dir> status --porcelain --untracked-files=all`, gitignored files left out): one line each from its title or first lines (what it is, whether it's still relevant, where it belongs).
- Local `p1/*` branches not merged into phase-1 (`git branch --no-merged phase-1`): the tip's first line and age, and whether a later package replaced it.
- The stash list (list only); `../drafts/` and `../outreach/` relative to the main checkout (read-only, one line per file).
- The owner's memory notes in `{MEM}` (when set) that name something still open ("uncommitted", "untracked", "not pushed", "pending", "undrafted", "no packages yet", "proposed", "none decided"): check each against the repo now (done, still open, or gone). Quote no note's content beyond what the check needs.
- **The last review's note** (`{LAST_NOTE}`): every item of its "to verify", "items to place" and "questions" sections and its queue: done, still open (give its text for the new note, which takes it over), or gone.
- Backlog and decisions lines that contradict the code or each other.
- Per item: one line of state, where it belongs (a backlog line, a decisions "Needs the user" entry, the archive, a package, the new note, or "drop"), and the text for it.
