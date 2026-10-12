<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Shift rules (every shift)

The standing rules for a coordinator shift: Henri and the workers gorge, ron and annabell (`.claude/agents/`). sandra is the owner's advisor (`.claude/agents/sandra.md`): Henri may spawn her for a research or architecture task; she writes docs, probes and proposals, not feature code, and never touches devices. They bind together with `CLAUDE.md`. The shift's own goal, tasks, definition of done and per-worker assignments are in [brief.md](brief.md); where the two differ, the brief wins for that shift. Section numbers match the old single-file brief (sections 0, 2, 7 and 8 are in the brief), so the agent files' references still work.

## 1. Principles
The three principles in CLAUDE.md decide every default:
- **fully open source, reuse first**;
- **speed and efficiency for engineers**;
- **precision you can trust** (no silent wrong answers; docs/04 section 2).

## 3. Hard rules (non-negotiable)
- **Clean room** (CLAUDE.md):
  - No HP/Moravia code, firmware, manual text, screenshots, icons or fonts.
  - No NumWorks code.
  - No "HP" or "Prime" in identifiers, file names or UI strings. Compatibility modules (the Python graphics module) use the name scripts import, but the files and identifiers on our side get our own names.
- **The reference calculator is not ours to touch.**
  - The G2 stays off the laptop.
  - Virtual Calculator sessions run separately, on their own branch, with the user.
  - Anything taken from the reference calculator without an answer is `source: assumed`, with a G2-checklist question.
  - Never lose an answer the user already gave.
- **Never invent expected values.** Sources: `device`, `virtual-calc`, `oracle`, `derived`, `assumed`. Measurements are medians of ≥5 runs, with device, Android version, WebView version and build type.
- **Git:**
  - The integration branch is **`phase-1`**.
  - Workers commit on `p1/<name>-<shift>` branches, with `git commit -s` and the trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Sonnet workers use `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.
  - **Never push, never touch `master`, never force anything, and only ever use `git branch -d` (never `-D`).**
- **Nothing goes out:** no uploads, releases, emails, issues or posts. Network only for downloads: npm, pip into a venv, container images, git clones of open-source projects, docs.
- **Never delete:** `engine/giac/_downloads/` tarballs, `../pascaline-deps/`, `../outreach/`, `../fdroiddata/`, `spike/prebuilt/`, `~/emsdk`. No `sudo`, no shell rc edits.
- **Containers:** never mount the main checkout or `_downloads/` with `:Z`/`:z`. Mount scratch copies only. Clean up root-owned files with `podman unshare rm -rf`.
- **No hanging commands:** every long or background command gets a timeout (`timeout 1800 …`) and never waits for interactive input.
- **Devices:** only install our own app (placeholder ID `org.pascaline.app`, never published). Never touch other apps or user data. The only settings changes allowed are the ones `stay-awake.sh` makes.
- **Plan changes need the user.** Decide defaults that are consistent with CLAUDE.md, docs/04 and docs/02 yourself, and record them. Anything that contradicts them, or misses a bar in the brief's definition of done, becomes a **proposal** in `docs/decisions.md`.
- **Start-up numbers must hold:** on the Tab One, cold launch → keyboard usable < 1 s and → engine ready < 1.5 s. Anything not needed at start loads lazily.
- If a tool call is denied, don't retry it. Log it and move on.

## 4. Start-up sequence
1. Run `date`, `git switch phase-1 && git status` (should be clean), `adb devices -l` and `tools/devlock.sh status`. Append a new dated section to `.coord/log.md` and log every assignment, merge, decision and problem.
2. **Spawn the workers the brief names** (`subagent_type`: `ron`, `gorge`, `annabell`; background, each in its own worktree). Each spawn prompt says: "Do the setup in rules section 5, then start your task 1 in the brief."
3. **Roll call.** Message each worker: `ROLL CALL: reply "READY <name> <your agent id>" plus one line on your first step.` Then send everyone the list of agent IDs. Workers can't message each other by name.
4. **Device watcher:** a background command or Monitor (with a timeout, re-armed when it expires). It prints a line whenever `adb devices` changes. Forward every change to annabell. `unauthorized` needs a human tap: log it.
5. Let the workers run. You wake up on a report, a device change or a message.

## 5. Worker setup (every worker, first)
- In your worktree: `git switch -c p1/<name>-<shift> phase-1`. **Commit small and often**, at least every 30–45 minutes of work.
- Shared paths:
  ```bash
  export MAIN=/home/nordmu/Documents/source99/pascaline
  export PASCALINE_DL_DIR=$MAIN/engine/giac/_downloads   # never re-download Giac
  export GIAC_OUT=$MAIN/engine/giac/_out/gsl             # current dev engine build
  export PYTHON_OUT=$MAIN/python/_out/dev                # current MicroPython dev build
  export PASCALINE_COORD=$MAIN/.coord                    # locks, device info, log
  ```
  Build engines once in the main checkout under the host-cpu lock, then point at them, rather than building in every worktree.
- **Locks:** wrap heavy host work in `tools/devlock.sh acquire host-cpu <name> 1800` … `release`. Heavy work means wasm, container or Gradle builds, and desktop benchmarks. Never hold a lock while you wait for someone.
- **Devices belong to annabell.** Nobody else runs `adb`. Send her a `[NEED]` with the branch and what to run. Device commands: `tools/README.md`.
- **Shared files belong to Henri:** `CLAUDE.md`, `docs/02-architecture-plan.md`, `docs/04-architecture.md`, `docs/decisions.md`, `docs/backlog.md`, `THIRD_PARTY.md`, `spike/RESULTS.md`, `.claude/agents/*`. Send him the text: numbers, decisions, G2 questions, and every new dependency.
- **Ownership inside `app/`:**
  - **ron:** `app/src/views/`, `app/src/apps/`, `app/src/entry/`, `app/src/keyboard/`, `app/src/input/` (the parser; ron adds the `parser.yaml` row with each rule), `spec/keyboard.yaml`.
  - **gorge:** `app/src/engine/`, `app/src/python/`, `tests/golden/` (with the oracle), the Find index generator and data.
  - **annabell:** `android/`, `build.sh`, `tools/`, the release toolchain.
  - **Agree the interfaces early.**
- **Messages** (SendMessage to an agent ID). Short, in these forms:
  - `[STATUS] <name> <task> started|progress|blocked|done — <one line> — <numbers / branch@commit>`
  - `[NEED] <name> <what> — <why>`
  - `[FYI] <name> — <something another worker should know>`

  Report at milestones, not after every step.
- **When a task is done:** commit, send `[STATUS] … done` with the branch and commit, and end your turn with a short report.

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
Log every default in `docs/decisions.md`: the choice, why, the alternatives, and what would change your mind. Proposals for the user go at the top, under "Needs the user", each with your recommendation in one sentence.

## 10. Your loop and the usage budget
- On every report: check the claim (re-run the test or look at the numbers), then merge the worker's branch into `phase-1` (`git merge --no-ff`). Update the shared files, log it, and hand out the next job.
- Every time you wake: run `tools/devlock.sh status` (break locks held by a worker that is gone) and `adb devices`, and ping anyone who has been silent for over an hour. If a worker doesn't answer within 30 minutes of a ping, stop it, log what it was doing, and reassign the job.
- **Usage budget.** The user's other sessions count against the same limit. To keep progress steady:
  - keep your turns short and your messages few;
  - spawn no extra agents;
  - workers report at milestones only;
  - let a worker stop when its track is done.

  On a usage limit, log the time and don't retry in a loop. After the reset, start with a `STATUS?` round.

## 11. Wrap-up
1. Stop handing out work. Every worker commits, sends a final `[STATUS]` and releases its locks.
2. Merge what's ready into `phase-1`. List any unmerged branches and why they weren't merged.
3. Restore the Fairphone if it was used. The Tab One and the S8+ stay awake.
4. Bring the shared docs up to date (`docs/backlog.md`, `docs/decisions.md`, `docs/04-architecture.md` when a decision or budget changes, `docs/02-architecture-plan.md` section 12 for milestones).
5. Write `docs/shifts/<date>-<shift>-report.md` for the user, short and in plain language: what got done; the brief's definition of done, item by item; the numbers; the defaults decided; proposals that need a yes or no; what the user has to do; problems; next steps.
6. Commit on `phase-1`. Don't push.
