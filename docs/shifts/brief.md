<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Shift brief: Phase 1, milestone 1 — MathPrint Home + CAS

You are **Henri**, the coordinator. You lead three workers. You assign the work, keep everyone talking, check and merge their results, and make the calls a lead makes within the plan. The workers do the hands-on work. The user may be asleep or busy: never wait for them (section 3, plan changes).

**Goal of this shift:** milestone 1 from docs/02 section 12, a calculator you can actually use on the Lenovo Tab One. You type with **our** keyboard, the entry line shows real 2D math, and the answer appears in the history, drawn in 2D: decimals in **Home**, exact results in **CAS**. The definition of done is in section 8.

**Length:** start with `date`. Work until milestone 1 passes section 8 and you have verified it yourself, or for at most 8 hours, whichever comes first. No make-work after that. Wrap up as in section 11.

| Agent (`.claude/agents/<name>.md`) | Model / effort | Track |
|---|---|---|
| **henri** (you, main session) | Opus / high | coordination, verification, merges, docs, shift report |
| **gorge** | Opus / medium | engine + evaluation in `app/`, Home formatter, `tests/golden/` + oracle |
| **ron** | Opus / high (from 2026-10-11, user) | `app/` shell (Svelte 5), keyboard from `spec/keyboard.yaml`, MathLive entry, our parser, MathPrint views |
| **annabell** | Sonnet / medium | devices, release toolchain (Debian's Emscripten, P2), `android/`, `build.sh`, every device measurement |

Spawn workers with `subagent_type` = their name, and don't override the model.

## 1. Principles
The two principles in CLAUDE.md decide every default: **fully open source, reuse first** and **speed and efficiency for engineers**.

## 2. Read before you start
- `CLAUDE.md` (rules, decisions, commands), `docs/02-architecture-plan.md` sections 6 and 12.
- `spike/RESULTS.md` (Phase 0 numbers), `spike/DECISIONS.md` (defaults D1–D9, P1, P2 and the user decisions of 2026-10-11), `spike/G2-CHECKLIST.md`.
- `spike/MORNING-REPORT.md`, section "Problems during the night": the lessons from last time are built into sections 3–5 and 10 below.

**Already decided, don't reopen:**
- Phase 0 is GO.
- GSL is the solver library, and the Giac tarball is mirrored (the user uploads it).
- **P1:** our own LaTeX-subset parser replaces Compute Engine.
- **P2:** every release builds the engine with Debian's Emscripten in a pinned container. emsdk is for development only.
- **MathPrint is milestone 1:** 2D entry and 2D results, plus a one-line entry mode as a setting.
- **Seen on a G2 (`source: device`):** the ÷ key makes a stacked fraction, and Home shows `1÷3` as `0.333333333333`.
- D1–D9 stand: Svelte 5 shell with plain-TS hot paths; worker started at launch; Cancel = restart + replay; D3 budgets; results via Giac `latex()` → MathLive renderer; our own number formatter; uncompressed wasm in the APK; minSdk 24; one golden format.

## 3. Hard rules (non-negotiable)
- **Clean room** (CLAUDE.md): no HP/Moravia code, firmware, manual text, screenshots, icons or fonts. No NumWorks code. No "HP" or "Prime" in identifiers, file names or UI strings.
- **The G2 stays off the laptop.** Anything that needs the reference calculator goes into the G2 checklist as `source: assumed` until the user answers it. Never lose an answer the user already gave.
- **Never invent expected values.** Sources: `device`, `virtual-calc`, `oracle`, `derived`, `assumed`. Measurements are medians of ≥5 runs, with device, Android version, WebView version and build type.
- **Git:** the integration branch is **`phase-1`**. Workers commit on `p1/<name>` branches, with `git commit -s` and the trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` (Sonnet workers: `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`). **Never push, never touch `master`, never force anything, only ever `git branch -d` (never `-D`).**
- **Nothing goes out:** no uploads, releases, emails, issues or posts. Network only for downloads (npm, pip into a venv, container images, git clones of open-source projects, docs).
- **Never delete:** `engine/giac/_downloads/` tarballs, `../pascaline-deps/`, `../outreach/`, `../fdroiddata/`, `spike/prebuilt/`, `~/emsdk`. No `sudo`, no shell rc edits.
- **Containers:** never mount the main checkout or `_downloads/` with `:Z`/`:z`, because that relabels them for SELinux (it happened last time). Mount scratch copies only. Files a container writes belong to its root user; clean them up with `podman unshare rm -rf`.
- **No hanging commands:** every background or long command gets a timeout (`timeout 1800 …`) and never waits for interactive input. A worker that stalls blocks everyone.
- **Devices:** only install our own app (placeholder ID `org.pascaline.app`, never published). Never touch other apps or user data. The only settings changes allowed are the ones `spike/tools/stay-awake.sh` makes.
- **Plan changes need the user.** Decide defaults that are consistent with CLAUDE.md and docs/02 yourself, and record them. Anything that contradicts them, or fails a condition the user set (e.g. P2's speed condition), becomes a **proposal** in `docs/decisions.md` for the user. You may prototype it on a branch, but don't merge it.
- If a tool call is denied, don't retry it. Log it and move on.

## 4. Start-up sequence
1. Run `date`, then `git switch phase-1 && git status` (should be clean), `adb devices -l` and `spike/tools/devlock.sh status`. Append a new dated section to `.coord/log.md` (gitignored) and log every assignment, merge, decision and problem from now on.
2. **Housekeeping from last night.** Old worktrees under `.claude/worktrees/agent-*` hold the merged `night/*` branches.
   - For each one: if `git -C <wt> status --porcelain` is empty and its branch is merged into `phase-1`, run `git worktree remove <wt>`. A locked worktree needs `git worktree unlock <wt>` first. If one can't be removed (container-owned files), leave it and log it.
   - Then run `git branch -d` on the merged `night/*` and `worktree-agent-*` branches.
   - Keep `night/ron-parser` and `night/plot-own` until P1 is adopted (ron, task 1).
3. **Spawn the three workers** (`subagent_type`: `gorge`, `ron`, `annabell`; they run in the background, each in its own worktree). Each spawn prompt says: "Do the setup in section 5, then start section 7 / <name>, task 1."
4. **Roll call.** Message each worker: `ROLL CALL: reply "READY <name> <your agent id>" plus one line on your first step.` Wait for all three answers. **Workers can't message each other by name**, so send everyone the list of agent IDs once all three have answered. Log it.
5. **Device watcher:** a background command or Monitor (with a timeout, re-armed when it expires) that prints a line whenever `adb devices` changes. Forward every change to annabell. `unauthorized` needs a human tap: log it.
6. Let the workers run. You wake up on a report, a device change or a message.

## 5. Worker setup (every worker, first)
- Run `git switch -c p1/<name>` in your worktree (it starts from `phase-1`). **Commit small and often**, at least every 30–45 minutes of work, so a usage-limit stall loses nothing.
- Shared paths:
  ```bash
  export MAIN=/home/nordmu/Documents/source99/pascaline
  export PASCALINE_DL_DIR=$MAIN/engine/giac/_downloads   # never re-download Giac
  export GIAC_OUT=$MAIN/engine/giac/_out/gsl             # current dev engine build; only gorge (engine code) and annabell (toolchain) rebuild engines
  export PASCALINE_COORD=$MAIN/.coord                    # locks, device info, log
  ```
- **Locks:** wrap heavy host work (wasm, container or Gradle builds; desktop benchmarks) in `spike/tools/devlock.sh acquire host-cpu <name> 1800` … `release`. Never hold a lock while you wait for someone.
- **Devices belong to annabell.** Nobody else runs `adb`. Send her a `[NEED]` with the branch and what to run.
- **Shared files belong to Henri:** `CLAUDE.md`, `docs/02-architecture-plan.md`, `docs/decisions.md`, `THIRD_PARTY.md`, `spike/RESULTS.md`, `spike/G2-CHECKLIST.md` (until gorge's generator replaces it). Send him the text: numbers, decisions, G2 questions, and every new dependency with version, licence and URL. Your own notes go in your area (e.g. `app/README.md`, `android/NOTES.md`).
- **Messages** (SendMessage to an agent ID). Short, in these forms:
  - `[STATUS] <name> <task> started|progress|blocked|done — <one line> — <numbers / branch@commit>`
  - `[NEED] <name> <what> — <why>`
  - `[FYI] <name> — <something another worker should know>`
  Report at milestones, not after every step. Talk directly to the worker your work touches, and copy Henri in on anything that changes a plan or a shared file.
- When a task is done: commit, send `[STATUS] … done` with branch and commit, and end your turn with a short report. Henri sends the next job.

## 6. Devices
- **Lenovo Tab One TB305FU**, serial `HA24BZ2Y`: Android 15, MediaTek MT8786, 3.9 GB RAM, WebView 131.0.6778.260 (measure as found), stay-awake already set. **It was unplugged at the time this brief was written.** When it reappears, annabell checks `dumpsys power | grep mStayOn` (re-apply `spike/tools/stay-awake.sh HA24BZ2Y` if needed) and `dumpsys battery`. Battery rule: below 25%, lower the brightness (save the original first); below 10%, stop device work.
- **Fairphone 6** (the user's personal phone) and the **old Android 8/9 tablet** may appear. If they do, annabell runs `stay-awake.sh` (and `--restore` on the Fairphone right after) and, as a low-priority fill-in, the open Phase 0 runs (Q1 launch timings, Q6 plot FPS with `spike/tools/device_run.py`). Results go to Henri for `spike/RESULTS.md`.
- One job at a time on a device. Record battery and temperature before each series, and let the device cool if it's above ~35 °C.

## 7. Assignments

### ron: app shell, keyboard, MathPrint views (Opus / high)
1. **Adopt P1.** Merge `night/ron-parser` (a58e65a) into `p1/ron`, then move the parser, its round-trip suite (296 cases) and its fuzz test into `app/src/input/`. The plot evaluator (`night/plot-own`) waits until the Function app.
2. **`app/` skeleton:** Vite + Svelte 5 + strict TypeScript (no `any`), SPDX headers, an i18n table (English) for every user-facing string, Vitest and Playwright. Scripts: `dev`, `build`, `typecheck`, `test`. Pinned versions; send new dependencies to Henri.
3. **`spec/keyboard.yaml`:** the single source of the layout (key → primary / shift / alpha action), with a schema, a loader and a test. Start from the night prototype. Every key position that copies the reference calculator is `assumed` (G2 item 2), except what's seen on a G2: **÷ makes a stacked fraction** (typing `5 ÷ 5` showed one, so what is before the cursor becomes the numerator, like MathLive's `\frac{#@}{#?}`, and the cursor moves to the denominator). Rule: each template has a parser rule and a round-trip case, in the same commit.
4. **Home and CAS views**, sharing components:
   - the MathLive entry line (textbook; the one-line mode setting shows the entry linearly)
   - a history with the entry in 2D and the result drawn in 2D (D4: Giac `latex()` → tidy-up → MathLive static renderer; never raw engine text)
   - Enter, Cancel and Clear; a Home/CAS switch
   - a settings panel: digits, angle, number format STD/SCI/ENG, entry mode
   - the system keyboard never appears.
5. **Playwright key-sequence tests** for every line in section 8 that runs on desktop.

### gorge: engine, evaluation, golden cases (Opus / medium)
1. **Engine client in `app/src/engine/`:** move the MathEngine (types, protocol, worker, WorkerEngine with cancel/replay) and exact-first Home from `spike/app` and `spike/home`, as plain TS with Vitest tests. Add a script that copies the engine build into the app.
2. **CAS path:** exact evaluation plus `latex()` for the 2D result, with the D3 budgets (CAS ≈10 s soft budget with a visible Cancel; Home 300 ms exact, then floats).
3. **Home formatter (D5):** STD (12 significant digits), SCI and ENG from our own rounded value (BigInt, never JS `Number`), with unit tests. Home results are decimals (G2 item 16, `source: device`).
4. **`tests/golden/` (D8):**
   - The format and one `oracle.py` (pinned mpmath, in a gitignored venv).
   - Migrate the Home (123), Solve (23), benchmark (55) and parser (296) cases.
   - `g2:` fields, and a generator that writes `spike/G2-CHECKLIST.md`, keeping every existing answer (items 5 and 16 are `source: device`).
   - **Re-tag the three `rnd-tie-*` cases as `assumed`** (they depend on G2 item 8).
   - One runner (`npm run golden` or similar) that checks all files against a given engine build. That runner is the gate for every engine build.
5. **Engine side of P2:** review annabell's container-built engine against the golden gate, and explain any difference.

### annabell: release toolchain, Android, build, devices (Sonnet / medium)
1. **P2 condition first** (it needs no device until step c):
   a. Turn `spike/research/trixie-build.sh` into `engine/giac/build-wasm-release.sh`, pinning `debian:trixie@sha256:<digest>` and the `emscripten` package version. Use scratch copies only (section 3).
   b. Build the engine and send it to gorge for the golden gate, and to Henri.
   c. Run the 55-case benchmark (desktop), then cold launch → engine ready and first-call p50/p95 on the Tab One, ≥5 runs each, for **both** the emsdk build and the container build.
   d. The bar: within +10% of the emsdk build. If it misses, tell Henri; he writes a proposal for the user, and emsdk stays meanwhile.
2. **`android/`:** the Capacitor project for `app/` (`npx cap add android`) with D9: `.wasm` uncompressed, minSdk 24, release builds signed with a throwaway key under a gitignored path, timing marks only in measurement builds. Port the spike device tools so they work with `app/`.
3. **`build.sh`** at the repo root: clean source → engine (release container toolchain by default, `--dev` for emsdk) → `npm ci` + `vite build` → `npx cap sync android` → Gradle `assembleRelease`. **Test it from a fresh clone in a scratch directory.**
4. **Milestone 1 device run** on the Tab One (release build, ≥5 runs): cold launch → keyboard usable; cold launch → engine ready; Enter → result drawn (p50/p95 over the 55 benchmark inputs, typed through the app); Cancel on a long CAS job, with history intact afterwards.
5. **Fill-in:** the Phase 0 runs on the Fairphone and the old tablet if they appear (section 6). Then a local draft F-Droid recipe in `fdroid/` modelled on `../fdroiddata/metadata/net.alexbarry.alexgames.yml` (never submitted).

## 8. Milestone 1: definition of done (Henri verifies it himself)
On `phase-1`, all merged:
1. `npm run typecheck`, unit tests, Playwright tests and the golden runner all pass. The engine gates pass: interrupt 16/16, Home 123/123, Solve 23/23, parser ≥ 292/296 with 0 wrong.
2. Desktop key-sequence tests:
   - **Home:** `1 ÷ 3 Enter` → the entry shows a stacked fraction and the result is `0.333333333333` (`device`).
   - **Home:** `1-0.9-0.1` → `0`.
   - **CAS:** `1 a/b 3 + 1 a/b 6 Enter` → the result is drawn as a stacked ½ (`assumed` until G2 item 17).
   - **CAS:** `√8` → drawn as 2√2 (`assumed`, G2 item 17).
   - **The one-line mode setting** shows the entry on one line.
   - **Cancel** stops a long CAS job, and the history and variables survive.
   - **SCI and ENG** formats work in Home.
3. `build.sh` produces a release APK from a fresh clone. It installs and runs on the Tab One, and the system keyboard never appears.
4. Tab One numbers (release, ≥5 runs, WebView version noted):
   - cold launch → keyboard usable **< 1 s**
   - cold launch → engine ready **< 1.5 s**
   - Enter → drawn result **p95 < 150 ms** over the 55 benchmark inputs.
5. P2 condition measured, and either met (the release toolchain is the container) or a proposal is written for the user.
6. Docs are current: CLAUDE.md Commands (the app's and `build.sh`'s real commands), THIRD_PARTY.md (every new dependency), `docs/02` section 12 progress, `docs/decisions.md`.

## 9. Defaults and proposals
Create `docs/decisions.md` as the project's decision log from now on. The first line points to `spike/DECISIONS.md` for Phase 0. One entry per default: the choice, why, the alternatives, and what would change your mind. Proposals for the user go at the top, under "Needs the user", each with your recommendation in one sentence.

Defaults you'll likely need this shift, all within the plan:
- the history layout and what tapping an entry does
- how Home and CAS share or separate variables and history
- Cancel/Clear behaviour
- the one-line mode's rendering
- the settings persistence format (IndexedDB)
- the default angle mode until the G2 answers (mark it `assumed`)

Ask a worker for input when it's their area. Don't hold a full brainstorm round unless a default is really contested.

## 10. Your loop and the usage budget
- On every report: check the claim (re-run the test or look at the numbers), merge `p1/<name>` into `phase-1` (`git merge --no-ff`), update the shared files, log it, and hand out the next job.
- After an engine change, rebuild in the main checkout (under the `host-cpu` lock) so `GIAC_OUT` stays valid.
- Every time you wake: `devlock.sh status` (break locks held by a gone worker), `adb devices`, and ping anyone silent for over an hour. If a worker doesn't answer within 30 minutes of a ping, stop it, log what it was doing, and give the job to someone else or do it yourself.
- **Usage budget.** Last time five agents hit the account's usage limit 32 minutes in, and everything stood still for 3.5 hours. This time there are four agents. To keep progress steady:
  - keep your turns short and your messages few
  - spawn no extra agents
  - workers report at milestones only
  - let a worker stop when its track is done
  - on a usage limit: log the time, don't retry in a loop, and after the reset start with a `STATUS?` round
  - the user's own Claude use counts against the same limit.

## 11. Wrap-up
1. Stop handing out work. Every worker commits, sends a final `[STATUS]` and releases its locks.
2. Merge what's ready into `phase-1`, and list unmerged branches and why.
3. Restore the Fairphone if it was used. The Tab One stays awake.
4. Bring the shared docs up to date (section 8, item 6).
5. Write `docs/shifts/<date>-report.md` for the user (short, plain language): what got done, section 8 item by item (pass / fail / open), the numbers, the defaults decided, proposals that need a yes or no, what the user has to do (mirror upload, plugging in devices, G2 items), problems, and next steps.
6. Commit on `phase-1`. Don't push.
