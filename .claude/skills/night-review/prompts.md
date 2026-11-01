<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# The prompts

Every agent prompt starts with `$RUN/common.md` (COMMON, filled in by step 0b), verbatim, then the text below with its `{…}` filled from `$RUN/values.sh`. Times are written like `Sun 01:45`.

## Hunter (step 1; sandra, Opus, effort high)
> You are the `{prefix}` hunter of the night review on phase-1 `{BASE}`. Your hunt follows; it is yours alone, and a separate verifier will try to refute every finding.
>
> {the hunt's block from hunts.md, from its heading to the next}
>
> Write your report to `{RUN}/reports/{prefix}.md`. Finish by {D1 minus 15 minutes} even if it's incomplete, and say what you didn't cover.

## Verifier (step 2; sofia, Opus, effort high)
> You are the adversarial verifier of the report `{RUN}/reports/{prefix}.md`. Assume each finding is wrong until you have reproduced it yourself.
> - **For every S1 and S2 finding, and for every S3 when there are 20 or fewer (otherwise the 20 with the highest confidence):** reread the cited code at `{BASE}`, rerun the cited command (behind the CPU guard), recompute the expected value from its source (oracle values with mpmath yourself), and check the overlap claim by grepping the docs yourself.
> - **Per label, a verdict:** CONFIRMED (you reproduced it; your own evidence in one or two lines), REFUTED (why: wrong reading, already fixed, already planned, not reachable, or the expected value is wrong) or UNSURE (what would settle it). Give a corrected severity when the report's is wrong. A new finding of your own gets the label `v{prefix}-1` and the full evidence standard.
> - **For the `lo` report:** check that each item's state ("still open", "done") is true now.
> - Write `{RUN}/verified/{prefix}.md`: first a verdict table (label | verdict | severity | one-line reason), then the details. Finish by {D2 minus 10 minutes}. Your final reply: the path and the counts per verdict.

## Author (step 4; sandra, Opus, effort xhigh)
> From `{RUN}/knowledge.md`, write work packages as draft files in `{RUN}/packages/`, one file per package, named `NEW-<n>.md` (placeholder ids; the coordinator mints the real ones later).
> - **Format:** exactly like the open package files. Read the shape paragraph at the top of `docs/shifts/brief.md`, then three files in `docs/shifts/packages/` of `{REVIEW}`: the newest of ron, of gorge and of annabell. The header line `### <agent>, NEW-<n>: <title>, branch \`p1/<agent>-<slug>\``; **Lane:** and **Starts when:**; **Why:** (the evidence from knowledge.md with file:line and labels); **Read:**; numbered steps with **Tests first** that fail on phase-1; **Done when:** lines a check can test. Each file at most 5 kB.
> - **Rules:** one concern per package, at most about a day of work, split if bigger. Agent by area: ron for the UI, keys, entry, parser and views; gorge for the engine, golden tests, Find data and the number formatter; annabell for devices, builds, the release and the pipeline scripts; sandra for research notes. Model by P17: Opus where a slip gives a wrong number or breaks entry, units or stored data; Sonnet elsewhere. Lane by brief section 0c rule 10: night-safe, night, or day (it needs a device or an owner's act).
> - **Coverage:** every confirmed S1 finding gets a package, or joins an open package as an amendment (name it and give the text to add). S2 and S3 findings are grouped by code area where that keeps one concern. Never touch or duplicate the lanes' queue ({EXCLUDE}) or a decided entry.
> - **Room is short** (`{RUN}/budgets-start.txt`): only the first rows of each lane go into the brief, and S1 lines into the backlog while it has room. So the order matters most.
> - **Also write `{RUN}/packages/PLAN.md`:**
>   - the proposed order for lane A (ron's UI) and lane B (the release, then the engine), by importance first and dependencies second, one line of reason per package; extreme-input packages go to the weekly extreme night;
>   - the backlog "Open bugs" line for every S1 finding (rules section 9: label, base commit, one rerun command, reach);
>   - the decisions "Needs the user" entries, each with a one-sentence recommendation;
>   - the declutter actions, each part of a package or marked "docs edit, step 5";
>   - the leftovers' texts and where each goes, including the last note's open items that the new note takes over.
> - Finish your first version by {D3 plus a third of the time to D4}. Your final reply: the number of packages and their titles, one line each.

## Reviewer (step 4; sofia, Opus, effort xhigh)
> Review the package drafts in `{RUN}/packages/` and their `PLAN.md` against `{RUN}/knowledge.md` and the code at `{BASE}` (in `{REVIEW}`).
> - **Per package:** the evidence still holds (file:line right, the finding confirmed); one concern, at most a day; the tests come first and really fail on phase-1; the Done-when lines are testable; no overlap with an open package, a backlog line, a decision or the lanes' queue ({EXCLUDE}); agent, model and lane right by the rules; nothing reopens a decision; the clean-room rules hold; a UI change follows `docs/03-feature-analysis.md` section 0, rules 5–13 (keys never move).
> - **PLAN.md:** the order makes sense; nothing is missing (every confirmed S1 is covered); every backlog line has a rerun command.
> - **Reply** `AGREED` on its own line, or a numbered list of required changes, each with its file and reason. Only what must change, not style.

## The loop messages (step 4)
- To the author, by SendMessage: "Revise per this review: {the reviewer's list}. Reply with the files you changed."
- To the reviewer, by SendMessage: "Review the revision. Your previous points were: {the list}. The author changed: {the author's reply}."

## The step-8 handoff (step 7 writes it to `$RUN/STEP8-PROMPT.md`)
> Continue the night review of {DATE} with me: its step 8 (review, decide, commit). The coordinator wrote everything into the docs, uncommitted, and handed over.
>
> **Read first, in this order:** `{RUN}/SUMMARY.md` (section 0 first, if there is one); "Step 8" of `.claude/skills/night-review/SKILL.md` (it binds this session; source `{RUN}/values.sh` for its values); `{RUN}/id-map.md` and `{RUN}/decisions-made.md`; the review note `{NOTE}` in the review worktree `{REVIEW}` (branch `{BRANCH}`). Don't read the hunters' or verifiers' full reports: grep them by label.
>
> Then do step 8 from its item 1, in order: the night over and SUMMARY section 1 completed; the plan shown; my decisions asked with AskUserQuestion; the commit on the review branch only with my OK, then phase-1 merged into it; every minted id checked again; my answers applied and `docs ok`; the final diff; the merge into phase-1 under the integ lock only with my OK. Never push: I push.
>
> Rules: CLAUDE.md and `docs/rules-core.md` bind. `git commit -s` with the Co-Authored-By line, only with my OK; never push, force or `master`. The shell stays in the main checkout (`git -C`, full paths, never `cd`). One recommendation with plain reasons, not option tables. Opus, effort high.
