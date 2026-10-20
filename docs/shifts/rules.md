<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Shift rules (every shift)

The standing rules for every agent of Pascaline: the workers gorge, ron and annabell, the advisor sandra, the auditor sofia and the coordinator henri (`.claude/agents/`). They bind together with `docs/rules-core.md`. The shift's own goal, tasks, definition of done and the night queue are in [brief.md](brief.md); where the two differ, the brief wins for that shift. Section numbers are stable, so the agent files' references keep working: workers read sections 3 and 5; section 4 is how a package runs through the pipeline, day and night.

## 1. Principles
The three principles in `docs/rules-core.md` decide every default:
- **fully open source, reuse first**;
- **speed and efficiency for engineers**;
- **precision you can trust** (no silent wrong answers; docs/04 section 2).

## 3. Hard rules (non-negotiable)
- **Clean room** (`docs/rules-core.md`):
  - No HP/Moravia code, firmware, manual text, screenshots, icons or fonts.
  - No NumWorks code.
  - No "HP" or "Prime" in identifiers, file names or UI strings.
- **The reference calculator is not ours to touch.**
  - The G2 stays off the laptop.
  - Virtual Calculator sessions run separately, on their own branch, with the user.
  - Anything taken from the reference calculator without an answer is `source: assumed`, with a G2-checklist question.
  - Never lose an answer the user already gave.
- **Never invent expected values.** Sources: `device`, `virtual-calc`, `oracle`, `derived`, `assumed`. Measurements are medians of ≥5 runs, with device, Android version, WebView version and build type.
- **Git:**
  - The integration branch is **`phase-1`**.
  - Workers commit on `p1/<name>-<slug>` branches, with `git commit -s` and the trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Sonnet workers use `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
  - **Never push, never touch `master`, never force anything, and only ever use `git branch -d` (never `-D`).**
- **Nothing goes out:** no uploads, releases, emails, issues or posts. Network only for downloads: npm, pip into a venv, container images, git clones of open-source projects, docs.
- **Never delete:** `engine/giac/_downloads/` tarballs, `../pascaline-deps/`, `../outreach/`, `../fdroiddata/`, `spike/prebuilt/`, `~/emsdk`. No `sudo`, no shell rc edits.
- **Containers:** never mount the main checkout or `_downloads/` with `:Z`/`:z`. Mount scratch copies only. Clean up root-owned files with `podman unshare rm -rf`.
- **No hanging commands:** every long or background command gets a timeout (`timeout 1800 …`) and never waits for interactive input. Run a check in the foreground and read its exit code; never a background loop that waits on a process (`pgrep -f` matches the loop's own command line: run 58 hung 39 minutes on one).
- **Devices:** only install our own app (`io.github.buerlino.pascaline`, never published without the owner). Never touch other apps or user data. The only settings changes allowed are the ones `stay-awake.sh` makes.
- **Plan changes need the user.** Decide defaults that are consistent with `docs/rules-core.md`, docs/04 and docs/02 yourself, and record them. Anything that contradicts them, or misses a bar in the brief's definition of done, becomes a **proposal** in `docs/decisions.md`.
- **Start-up numbers must hold:** on the Tab One, cold launch → keyboard usable < 1 s and → engine ready < 1.5 s. Anything not needed at start loads lazily.
- If a tool call is denied, don't retry it. Log it and move on.

## 4. The pipeline (day and night)
Every package runs through `scripts/pipeline.sh <ron|gorge|annabell|sandra> "<ID or task>" [--model M] [--audit-model auto|sonnet|opus] [--branch B] [--id ID] [--no-worker] [--no-merge] [--dry-run]`, from any checkout of the repo. By day the owner runs one package at a time (P17). The script keeps every session small and short-lived:
1. **Bundle:** the package's file `docs/shifts/packages/<ID>.md` (or the task text), the files it names (capped), the report format of brief section 2 and the definition of done of section 8, written to `.tasks/<n>-<id>/spec.md`.
2. **Worker:** one fresh headless `claude -p --agent <name>` in its own worktree `.claude/worktrees/pl-<n>-<id>` on the package branch from `phase-1` (or resumed from the branch's last commit), the bundle on stdin, no Agent tool. It commits small, ticks its backlog line and files its "Needs the user" items in `docs/decisions.md` on its branch, and ends with the report commit.
3. **Checks**, deterministic, under the host-cpu lock: typecheck; `npm run index` then `FIND_INDEX=required npm test`; e2e when `app/` changed; the golden gate when `engine/`, `app/src/engine/`, `app/src/input/`, `app/src/units/`, `app/scripts/unit-case.ts`, `tests/golden/`, `find/` or `tools/find-index/` changed (`--checks` overrides); the gate regenerates the Find index when `find/` or `tools/find-index/` changed. A check whose failing items are all timing tests (the Find 16 ms/key test, the golden `units` p95 bar, the `solve.spec.ts` persistence test, the `copy.spec.ts` clipboard poll; `app/scripts/pipeline-logs.ts`) runs once more before it counts as a fix round. A failure feeds only the failing assertions or stack trace to a fresh fix round by the same agent.
4. **Audit:** sofia, fresh, with Read and Grep only, gets `git diff -U5 phase-1...<branch>` and the acceptance criteria on stdin, never whole files, and replies `APPROVED` or `FIX` with findings. The audit model (P17, enforced by A15 as a floor): Opus when the worker ran on Opus, for a gorge package, or when the diff touches `app/src/input/`, `app/src/engine/`, `app/src/units/`, `engine/` or `spec/keyboard.yaml`, even when the line names Sonnet (the raise is logged); Sonnet elsewhere; the Opus pass every three packages. **Review-only** (`--no-worker`, A10): a finished branch gets phase-1 merged into it first (a conflict is a fix round), then the checks, the audit and the merge. A `FIX` is a fix round. Checks and audit share **at most two fix rounds**; after that the branch stays unmerged and the run ends.
5. **Merge:** `git merge --no-ff --signoff` into `phase-1` in the worktree where `phase-1` is checked out (`.claude/worktrees/phase-1` when the main checkout is on another branch); a conflict leaves the branch unmerged. An interactive session that edits the `phase-1` worktree holds the same `integ` lock (`tools/devlock.sh acquire integ <name> 1800`) until its edits are committed and the worktree is clean, so no merge meets its edits. Then the worktree goes and the branch is deleted with `-d`. `--no-merge` stops before this step and prints the merge command.
6. **Bookkeeping:** one line per step in `.coord/log.md` (`- HH:MM pipeline #<n> <ID>: <step> — <outcome>`), the full logs in `.tasks/<n>-<id>/`, the run counter in `.tasks/counter`; every 3rd finished task runs `scripts/gc.sh --apply` (archive finished runs and handoffs into `.tasks/archive/`, delete scratch, list stale paths in `CLAUDE.md` and `docs/README.md`). Stdout is the one `RESULT #<n> <ID>: MERGED <commit> | NOT MERGED (<why>) | LIMIT` line; exit 75 is a usage limit.
- **By day** the owner starts a package with the script (the queue tables give agent, model and branch) and reads the RESULT line; the owner's own untracked files in the main checkout are never touched, because every agent works in a worktree.
- **At night** `scripts/night.sh` drives the queue of brief section 0c: it starts a fresh, Read-only henri for every decision (he sees section 0c and the log's tail, replies with one `scripts/pipeline.sh` line), runs that line, and asks again. On a usage limit it waits and retries; it stops on `SHIFT DONE` or, from `--until` or at the step cap minus 2, after the last Opus pass and the report. No session lives longer than one decision or one package, so no context grows, nothing compacts and no handover is needed (this replaces the 2026-10-14 "fresh henri after every Opus pass" rule, which solved the same problem by hand).
- **Opus passes** stay as the brief says: `scripts/pipeline.sh pass <n> "<IDs>"` runs sofia (Opus) on `phase-1`; her reply is logged in full and her FIX lines become packages (`--id <ID>f1 --branch <branch>`). The shift report is `scripts/pipeline.sh report`.
- **Nothing hangs:** every agent call and check runs under `timeout`; a worker that ends without a commit is logged `NOT MERGED (no commits)` and the queue goes on. Agent files never set `background: true` and no agent spawns another: the pipeline is the only way a worker starts.

## 5. Worker setup (every worker, first)
- The pipeline made your worktree and branch (`p1/<name>-<slug>` from `phase-1`); by hand, make them yourself (brief section 2). **Commit small and often**, at least every 30–45 minutes of work.
- Shared paths:
  ```bash
  export MAIN=/home/nordmu/Documents/source99/pascaline
  export PASCALINE_DL_DIR=$MAIN/engine/giac/_downloads   # never re-download Giac
  export GIAC_OUT=$MAIN/engine/giac/_out/gsl             # current dev engine build
  export PASCALINE_QALC_DL_DIR=$MAIN/engine/qalc/_downloads   # the Find index generator's libqalculate tarball (npm run index)
  export QALC_OUT=$MAIN/engine/qalc/_out/dev              # the qalc dev build: refresh-factors.mjs and the unit probes only (A21)
  export PASCALINE_COORD=$MAIN/.coord                    # locks, device info, log
  ```
  Build engines once in the main checkout under the host-cpu lock, then point at them, rather than building in every worktree.
- **Locks:** wrap heavy host work in `tools/devlock.sh acquire host-cpu <name> 1800` … `release`. Heavy work means wasm, container or Gradle builds, and desktop benchmarks. Never hold a lock while you wait for someone.
- **Devices belong to annabell.** Nobody else runs `adb`; a package that needs a measurement says so, and the owner runs it as an annabell package by day. Device commands: `tools/README.md`.
- **Shared files:** on your branch you change only your own step's line in `docs/backlog.md` and your items under "Needs the user" or the defaults log in `docs/decisions.md`; the audit sees them in the diff. Everything else that is shared (`CLAUDE.md`, `docs/rules-core.md`, `docs/02-architecture-plan.md`, `docs/04-architecture.md`, `THIRD_PARTY.md`, `spike/RESULTS.md`, `.claude/agents/*`, `docs/shifts/brief.md`) goes as exact text into your report, for the next Opus pass or the owner. A new dependency needs its `THIRD_PARTY.md` line in the report.
- **Ownership inside `app/`:**
  - **ron:** `app/src/views/`, `app/src/apps/`, `app/src/entry/`, `app/src/keyboard/`, `app/src/input/` (the parser; ron adds the `parser.yaml` row with each rule), `spec/keyboard.yaml`.
  - **gorge:** `app/src/engine/`, `tests/golden/` (with the oracle), the Find index generator and data.
  - **annabell:** `android/`, `build.sh`, `tools/`, the release toolchain.
  - **Agree the interfaces early.**
- **When a task is done:** commit, then reply as the pipeline's prompt asks (at most five lines). Nobody is waiting for messages: there is no coordinator to talk to.

## 6. Devices
- **Lenovo Tab One TB305FU**, serial `HA24BZ2Y`. Low-end; all bars are measured here.
  - Android 15, MediaTek MT8786, 3.9 GB RAM, WebView 131.0.6778.260 (measure as found).
  - Check `dumpsys power | grep mStayOn` (re-apply `stay-awake.sh` if needed) and `dumpsys battery`.
  - Battery rule: below 25%, lower the brightness (save the original first); below 10%, stop device work.
- **Samsung Galaxy S8+**, serial `ce011711cdc8a10c05`: the old-device class (Android 9, Chrome 101 WebView as updated by the user; the factory WebView was 72). 60 Hz panel.
  - If it shows `unauthorized`, the user taps "Allow USB debugging".
  - Same rules as the Tab One: our app only, battery and temperature before each series.
- **Fairphone 6** (the user's personal phone) may appear. If it does, annabell runs `stay-awake.sh`, measures what the brief asks, and runs `--restore` right after.
- One job at a time on a device. Let a device cool if it's above ~35 °C.

## 9. Defaults and proposals
Log every default in `docs/decisions.md`: the choice, why, the alternatives, and what would change your mind. Proposals for the user go at the top, under "Needs the user", each with your recommendation in one sentence; once decided, they move to "Decided proposals". When a decision changes what a doc says, rewrite that text in place: no "amended" or "superseded" notes, no strikeouts (git keeps the history).
- **Ids (owner, 2026-10-20).** Research notes and read-only sessions mint no ids: they label findings and proposals with the note's prefix (`hunt-N3`, `r16-G58`). An id is minted only when a backlog line, a package file or a decisions entry is written, after `git grep` on all branches, `.coord/log.md` and `.tasks/`. `tools/docs-check.mjs` fails on two package files or two backlog bug lines with the same id (A22).
- **Findings reach the docs.** A read-only session that finds a wrong number, a false mark, a freeze or a lost answer that users can reach today writes it, before it ends, as one line under backlog "Open bugs": label, base commit, one rerun command, reach. The owner commits it before the next pipeline run; the note can follow. A note that proposes a fix names the open lines and packages it overlaps and amends those instead of adding new ones.
- **Probe scripts.** A script a finding cites goes into `tools/probes/` with a README row, in the same commit as the note; a one-line `engine.ts` or `parse.ts` call written in the note counts as the script. A finding whose script is not in the repo is (to verify).

## 10. Research notes with an end (owner, 2026-10-20)
Every note in `docs/research/` opens, under its title, with one status line: **open** (what the owner must decide), **decided** (the decisions and package ids) or **reference**. A note marked decided whose packages exist moves to `docs/archive/` (`git mv`, links fixed) in the next docs commit; `scripts/gc.sh` lists them. Check reports go to `docs/archive/shifts/`. `tools/docs-check.mjs` caps the open and reference notes at 150 kB (A22; on once S18 has moved the decided notes).
