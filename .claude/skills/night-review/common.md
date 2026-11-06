<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# COMMON: the rules for every agent of a night review

Step 0b fills in every `{…}` from `$RUN/values.sh` (times as `Sun 01:45`) and writes the block below, from "N62 repo" to the end, to `$RUN/common.md`. The coordinator pastes that file verbatim at the top of every agent prompt. Change a rule here, never in a prompt.

---

N62 repo: main checkout `{MAIN}`. Read the code from the review worktree `{REVIEW}` (a snapshot of branch phase-1 at `{BASE}`; the run's files are in `{RUN}`). Read `docs/rules-core.md` first: it is binding (goal, three principles, clean-room rules, maths correctness, "never invent expected values"). `docs/README.md` says what to read for which question. Read files by section (`grep -n '^#' <file>`, then a range), never whole large files.

**The night lanes run on this machine until about {END}. To leave them alone:** never edit, commit, push, merge, stash, reset or switch branches anywhere; the only files you write are your report and your probes in `{RUN}`. Never touch `{P1}` or any `.claude/worktrees/pl-*` worktree (`git show`, `git log` and `git diff` on their branches are fine). Never run the full vitest, e2e, `npm run golden`, `npm run gate`, `npm run gallery`, `npm run size`, `vite build`, `build.sh`, `build-wasm*.sh`, `npm ci` or `npm install`. Never take or release a `tools/devlock.sh` lock, use adb or a device, or start `scripts/pipeline.sh`, `scripts/night.sh` or `scripts/gc.sh`. Never read `.tasks/*/*.log` or the other paths `.claude/settings.json` denies. Nothing leaves this machine: no `gh`, no network writes, no e-mail, no issues. The owner's untracked files are not yours: list them, never move, edit or delete them.

**Your shell stays in `{MAIN}`.** Never `cd`, not even in a subshell: use `git -C <dir>`, full paths, and `env -C <dir> <command>` for a tool that must run in its directory.

**CPU guard (the lanes' golden and e2e checks flake under load).** Run a `node`, `npx`, `tsx`, `vitest` or `python` command only inside the check, in the same command: `{DL} status | grep -q '^host-cpu:' && echo 'host-cpu held: not run' || <your command>`. A check in one command and the run in the next is a breach. While it's held, do reading work and try again later; if it stays held until your deadline is near, mark the finding "(to verify)" with the command that would settle it.

**Allowed, one command at a time and short, behind the guard:**
- `GIAC_OUT={MAIN}/engine/giac/_out/gsl node {REVIEW}/engine/giac/smoke.mjs '<expr>'` (a few at a time). That build can be older than the base: for an engine finding, say which build ran (`date -r {MAIN}/engine/giac/_out/gsl/giac.wasm`).
- `{MAIN}/tests/golden/.venv/bin/python` with mpmath for oracle values (`tests/golden/README.md`).
- `env -C {REVIEW}/app npx vitest run <one test file>` (at most 2 minutes, never two at once).
- `env -C {REVIEW}/app npx tsx <a probe>`: one from `{REVIEW}/tools/probes/` or one you write in `{RUN}/probes/` (full path).
- Without the guard: Read, Grep, Glob, and `git log/show/diff/grep/branch/for-each-ref` on any branch.
- Anything heavier: mark the finding "(to verify)" and name the command that would settle it.

**Ids:** you mint none (docs/shifts/rules.md section 9). Label findings `<your prefix>-1`, `-2`, …; a verifier's new finding is `v<prefix>-1`.

**Evidence standard per finding:**
- label; a one-line title;
- severity: S1 = a wrong number, a false mark, a freeze, or a lost answer or stored data that a user can reach; S2 = a broken or misleading flow; S3 = friction, cleanup, structure;
- reach: can a user hit it today, and how (the key sequence or the view);
- evidence: file:line at `{BASE}`, the command you ran and what it printed, and for every expected value its source by rules-core (`oracle`, `device`, `virtual-calc`, `derived` or `assumed`);
- overlap: grep `docs/backlog.md`, `docs/shifts/packages/`, `docs/shifts/brief.md`, `docs/decisions.md` and `docs/archive/` for the same thing; name the line or package it touches, or "new";
- a fix shape in one paragraph, without code; confidence (high, medium, low).

**Don't report:**
- anything already in the backlog, a package or a decision, unless you have new evidence (then say what's new);
- what the lanes are building now: {EXCLUDE};
- an item of the last review's note (`{LAST_NOTE}`) again, unless it's still open and you have new evidence.

Never reopen a decided entry of `docs/decisions.md`: a disagreement goes in your report as a proposal for the owner, with evidence.

**Your report:** one Markdown file at the path your prompt names, at most 25 kB. First a summary of at most 30 lines (the findings by severity, one line each), then each finding in full under a heading `### <label>: <title>`. Finish it by your deadline even if it's incomplete, and say what you didn't cover. Your final reply: the file path, the number of findings by severity, and nothing else.
