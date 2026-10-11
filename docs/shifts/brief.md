<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Shift brief: milestone 3 device numbers + mapping rebase (next session)

You are **Henri**, the coordinator. The rules from section 1 on are the same as in the milestone 3 shift and still bind; earlier briefs: `git show 739f45e:docs/shifts/brief.md` (milestone 3), `git show 52bdd33:docs/shifts/brief.md` (milestone 2).

**Goal:** close milestone 3 on real devices, then bring in the mapping. Small shift; usage is tight. **Spawn only annabell** (Sonnet) for device work. Henri does the merges, the rebase and the docs himself. Spawn ron or gorge only if a device run finds a bug in their area.

## 0. State at start (end of the 2026-10-11 milestone 3 shift)
- `phase-1` holds everything (report: `docs/shifts/2026-10-11-m3-report.md`). Desktop gates all pass. Not pushed.
- MicroPython builds: `python/_out/dev/` and `python/_out/release/` in the main checkout are current (our variant `python/variant/pascaline`). `npm run golden` needs an absolute `GIAC_OUT` and `PYTHON_OUT` (or `python/_out/dev`).
- **S8+** (`ce011711cdc8a10c05`): Android 9. Its factory WebView (Chrome 72) can't run the app. The user updates Chrome first. Minimum WebView is Chrome 95 (decisions.md).
- **Mapping branch `map/vc-1@d362296`** (4 commits on ba7dec1): `spec/keyboard.yaml` source tags, `tests/golden/g2.yaml` +16 answers + checklist, `spec/mapping/vc-2026-10-11/` (README with "Differences from our defaults", `SPOT-CHECK.md`). Not merged.

## 0a. Tasks, in this order
1. **Start-up:** `date`, `git switch phase-1 && git status`, `adb devices -l`, `tools/devlock.sh status`; new section in `.coord/log.md`.
2. **Rebase the mapping (Henri):** in a worktree, `git rebase phase-1` on a copy of `map/vc-1` (new branch `map/vc-1-rebased`; never force or rewrite `map/vc-1`). Overlaps are only at the ends of `spec/keyboard.yaml` (our `python:` block) and `tests/golden/g2.yaml` (our items 26–28): keep both sides. Renumber the mapping's new g2 items after ours if needed, never changing any answer. Regenerate the checklist (`oracle.py --g2`). Run typecheck, Vitest, Playwright and golden. Don't merge it into `phase-1`: the user reviews and pushes it.
3. **Devices (annabell),** release + `--measure`, ≥5 runs, with WebView version, battery and temperature:
   - **Tab One:** cold launch → keyboard usable < 1 s and engine ready < 1.5 s; first Python open → shell ready < 0.5 s; Cancel on `while True: pass` → ready < 0.5 s; `calc.cas` round trip p95 < 50 ms. This needs the `?bench=python` mode first (annabell task 5 in the milestone 3 brief; measurement builds only). Record bundle sizes (start + lazy chunks).
   - **Fresh-clone `./build.sh`** → APK installed on the Tab One; Home, CAS, Function, Solve and Python each compute.
   - **S8+** (after the Chrome update): the same, plus plot fps with three functions and solve p95. No bar; failures are findings. Check that MathLive's styling is fine (it uses `:has()` / `@container`, Chrome 105).
   - Use `device_run.py page` so results land in `.coord/device-runs.jsonl` (C2's first real use).
4. **Docs and report:** fill the numbers into the m3 report, `docs/02` s12, `backlog.md` (D1), `spike/RESULTS.md` (S8+ = the old-device class). Commit on `phase-1`, don't push.
5. **If time is left:** list the mapping's "Differences from our defaults" as proposals or defaults for the following shift. Change nothing in the defaults yet.

## Definition of done
Tab One bars measured (pass or a written finding), the S8+ measured or blocked with a reason, the fresh-clone APK runs, `map/vc-1-rebased` passes all gates, docs updated, the report written.

## 1. Principles
The two principles in CLAUDE.md decide every default:
- **fully open source, reuse first**;
- **speed and efficiency for engineers.**

For this shift that means: MicroPython, never loaded at start; CodeMirror 6 for the editor; no new engine.

## 2. Read before you start
- `CLAUDE.md`, `docs/backlog.md` (**the task list for this shift**), and `docs/02-architecture-plan.md` sections 3, 5, 6 and 12.
- `docs/decisions.md` and the last shift reports (`docs/shifts/2026-10-11-m2-report.md`, `…-m2b-report.md`).
- `spike/DECISIONS.md` D6 (Python) and `spike/python/NOTES.md` (the `calc` bridge, the async/sync question, the Tab One numbers).
- `python/build-micropython.sh` and `python/smoke.mjs` (the build is done; `build.sh` copies the output into the app).
- `app/src/engine/README.md` (the MathEngine, the pattern to copy for the Python worker).

**Already decided, don't reopen:**
- Everything in the milestone 1 and 2 briefs: GO; GSL; P1 (our own parser); P2 (container toolchain); MathPrint; D1–D9; milestone 1 and 2 defaults in `docs/decisions.md`.
- **D6:**
  - MicroPython v1.29.0 is the Python.
  - Pyodide "Python+" is not part of this shift.
  - `calc.cas` is async, and a small preprocessor lets users leave out the `await`. A synchronous bridge is only worth it if the Capacitor shell can serve COOP/COEP. Check it (gorge, task 2), but don't build on it unless it works on the Tab One.
- **The Giac mirror is live** (release `deps-giac-2.1.0-1d9536e0`).
- **The user approved milestone 3** as written in `docs/backlog.md` (2026-10-11).

## 3. Hard rules (non-negotiable)
- **Clean room** (CLAUDE.md):
  - No HP/Moravia code, firmware, manual text, screenshots, icons or fonts.
  - No NumWorks code.
  - No "HP" or "Prime" in identifiers, file names or UI strings.
  - **The `hpprime`-compatible module:** write its API from public descriptions, in our own words. Its Python module name is the one compatibility needs. The file and identifiers on our side get our own names, e.g. `app/src/python/graphics.ts`. Function names and signatures that aren't publicly documented are `assumed`, with a G2 question.
- **The reference calculator is not ours to touch.**
  - The G2 stays off the laptop.
  - The Virtual Calculator mapping is integrated by a separate session on its own branch (section 0b). Don't look for it, wait for it or merge it.
  - Anything taken from the reference calculator is `source: assumed`, with a G2-checklist question.
  - Never lose an answer the user already gave.
- **Never invent expected values.** Sources: `device`, `virtual-calc`, `oracle`, `derived`, `assumed`. Measurements are medians of ≥5 runs, with device, Android version, WebView version and build type.
- **Git:**
  - The integration branch is **`phase-1`** (now on GitHub; that changes nothing for you).
  - Workers commit on `p1/<name>-m3` branches, with `git commit -s` and the trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Sonnet workers use `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.
  - **Never push, never touch `master`, never force anything, and only ever use `git branch -d` (never `-D`).**
- **Nothing goes out:** no uploads, releases, emails, issues or posts. Network only for downloads: npm, pip into a venv, container images, git clones of open-source projects, docs.
- **Never delete:** `engine/giac/_downloads/` tarballs, `../pascaline-deps/`, `../outreach/`, `../fdroiddata/`, `spike/prebuilt/`, `~/emsdk`. No `sudo`, no shell rc edits.
- **Containers:** never mount the main checkout or `_downloads/` with `:Z`/`:z`. Mount scratch copies only. Clean up root-owned files with `podman unshare rm -rf`.
- **No hanging commands:** every long or background command gets a timeout (`timeout 1800 …`) and never waits for interactive input.
- **Devices:** only install our own app (placeholder ID `org.pascaline.app`, never published). Never touch other apps or user data. The only settings changes allowed are the ones `stay-awake.sh` makes.
- **Plan changes need the user.** Decide defaults that are consistent with CLAUDE.md and docs/02 yourself, and record them. Anything that contradicts them, or misses a bar in section 8, becomes a **proposal** in `docs/decisions.md`.
- **Milestone 1's numbers must hold:** on the Tab One, cold launch → keyboard usable < 1 s and → engine ready < 1.5 s. Python, CodeMirror and the Python app load lazily, only when the Python app first opens.
- If a tool call is denied, don't retry it. Log it and move on.

## 4. Start-up sequence
1. Run `date`, `git switch phase-1 && git status` (should be clean), `adb devices -l` and `devlock.sh status`. Use `tools/devlock.sh`. Append a new dated section to `.coord/log.md` and log every assignment, merge, decision and problem.
2. **Spawn the three workers** (`subagent_type`: `ron`, `gorge`, `annabell`; background, each in its own worktree). Each spawn prompt says: "Do the setup in section 5, then start section 7 / <name>, task 1."
3. **Roll call.** Message each worker: `ROLL CALL: reply "READY <name> <your agent id>" plus one line on your first step.` Then send everyone the list of agent IDs. Workers can't message each other by name.
4. **Device watcher:** a background command or Monitor (with a timeout, re-armed when it expires). It prints a line whenever `adb devices` changes. Forward every change to annabell. `unauthorized` needs a human tap: log it.
5. Let the workers run. You wake up on a report, a device change or a message.

## 5. Worker setup (every worker, first)
- In your worktree: `git switch -c p1/<name>-m3b phase-1` (see section 0 for gorge's cherry-pick). **Commit small and often**, at least every 30–45 minutes of work.
- Shared paths:
  ```bash
  export MAIN=/home/nordmu/Documents/source99/pascaline
  export PASCALINE_DL_DIR=$MAIN/engine/giac/_downloads   # never re-download Giac
  export GIAC_OUT=$MAIN/engine/giac/_out/gsl             # current dev engine build
  export PASCALINE_COORD=$MAIN/.coord                    # locks, device info, log
  ```
  The MicroPython dev build: `python/build-micropython.sh dev` → `python/_out/dev/`. Build it once in the main checkout under the host-cpu lock, then point at it, rather than building it in every worktree.
- **Locks:** wrap heavy host work in `devlock.sh acquire host-cpu <name> 1800` … `release`. Heavy work means wasm, container or Gradle builds, and desktop benchmarks. Never hold a lock while you wait for someone.
- **Devices belong to annabell.** Nobody else runs `adb`. Send her a `[NEED]` with the branch and what to run.
- **Shared files belong to Henri:** `CLAUDE.md`, `docs/02-architecture-plan.md`, `docs/decisions.md`, `docs/backlog.md`, `THIRD_PARTY.md`, `spike/RESULTS.md`, `.claude/agents/*`. Send him the text: numbers, decisions, G2 questions, and every new dependency with version, licence and URL. G2 questions go into `tests/golden/g2.yaml`; gorge owns that file.
  - Exception: annabell's C1 commit may change paths in all of these files, and only paths.
- **Ownership inside `app/`:**
  - **ron:** `app/src/views/`, `app/src/apps/` (the framework and the Python app's views), `app/src/entry/`, `app/src/keyboard/`, `spec/keyboard.yaml`.
  - **gorge:** `app/src/engine/`, `app/src/python/` (new: worker, `calc`, the graphics module), `app/src/input/` (the parser, for L1/L6), `tests/golden/`.
  - **Agree the interfaces early.** Python worker ↔ app; graphics draw commands ↔ ron's canvas view; parser ↔ entry for subscripts.
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
- **Samsung Galaxy S8+**, serial `ce011711cdc8a10c05`. **New:** the user's test device for this project (2017, Android 9 expected, 60 Hz panel).
  - It was `unauthorized` at the start: the user taps "Allow USB debugging".
  - When it appears, annabell:
    - records the model, SoC, RAM, Android version and WebView version (`stay-awake.sh` does this);
    - keeps it awake.
  - This device stands in for the old-device class (Android 8/9). It's also our first 60 Hz frame-rate data point (Q6).
  - Same rules as the Tab One: our app only, battery and temperature before each series.
- **Fairphone 6** (the user's personal phone) may appear. If it does, annabell runs `stay-awake.sh`, measures the plot frame rate, and runs `--restore` right after.
- One job at a time on a device. Let a device cool if it's above ~35 °C.

## 7. Assignments

### ron: entry leftovers, Python app UI (Opus / high)
1. **Finish the entry leftovers** (backlog L1–L5), each with Playwright or unit tests:
   - **L1. Subscripted names.** `x_1`, `X_{1}` → Giac `x_1` (agreed; the engine part is merged, a3ddd52). Left: show results as `x_{1}` (`render/tidy.ts`) and the Playwright tests in Home, CAS, Solve and Function.
   - **L2. The a/b mixed-number key.** The form follows `docs/decisions.md` "Mixed numbers", `assumed` (G2 item 17).
   - **L3. Alpha lock.**
   - **L4. The literal-caret one-line entry mode** (setting).
   - **L5. Results as insertable text.** Tap or select a history result to put it on the entry line, in Home and CAS.
2. **Python app UI**, registered in the app framework and loaded lazily:
   - an **editor** with CodeMirror 6 (pin the exact version; send Henri the THIRD_PARTY rows). Scripts are stored in IndexedDB like app state, and a Run action;
   - a **shell** view: an input line and the output history;
   - a **canvas view** for the 320×240 graphics, scaled to fit, drawing gorge's command stream;
   - a **Python keyboard layer** in `spec/keyboard.yaml`: `:`, `=`, quotes, brackets, indent/tab, common keywords. Positions copied from the reference are `assumed`.
   - **Cancel** stops the running script through gorge's worker, and the editor and shell keep their state.
3. **Playwright tests** for every desktop line of section 8 that is in your area.

### gorge: Python runtime, `calc`, graphics, parser (Opus / medium)
1. **Python worker** in `app/src/python/`.
   - MicroPython (`python/_out/…`, copied by `build.sh`) runs in its own Web Worker behind a `PythonEngine` interface: async and cancellable, the same pattern as `MathEngine`.
   - It loads only the first time it is used.
   - Cancel terminates the worker and starts a fresh one, and the next run works.
   - stdout and stderr stream to the UI. Errors carry line numbers.
2. **`calc` module.**
   - `calc.cas("…")` sends a string to the Giac worker and returns the result. It is async, and a small preprocessor adds the `await`.
   - It can read and write Home variables.
   - It also offers a numeric `calc.eval`, if cheap.
   - **Check (≤1 hour) whether the Capacitor Android shell can serve COOP/COEP** (needed for `SharedArrayBuffer`, so for a synchronous bridge). Report what you find, then go with async.
3. **Graphics module** (the `hpprime`-compatible API from public documentation, in our own words).
   - Pixels, lines, rectangles, circles, text and clear on a 320×240 surface.
   - It is a batched command stream from the worker to ron's canvas view (or an OffscreenCanvas, if you measure that to be better).
   - Agree the command format with ron early.
4. **Parser work for L1 and L6.**
   - **L1:** the subscript rule, together with ron.
   - **L6:** close the 4 known gaps where a default is possible:
     - the real cube root of a negative number (`assumed`, G2 items 4/11, behind the same setting the reference has, if there is one);
     - sets;
     - decimal comma as an input setting;
     - one-letter user functions beyond f, g and h.
   - Each gets a parser rule plus round-trip cases. Any gap you leave open needs a written reason.
5. **Golden cases.**
   - Add a new `tests/golden/python.yaml`, wired into `npm run golden`. It covers `print`, arithmetic, `calc.cas` results (oracle or derived), an error with a line number, Cancel on `while True: pass`, and graphics commands (derived).
   - Add the L1/L6 parser cases.
   - The gate stays green.

### annabell: tooling move, S8+, measurements (Sonnet / medium)
1. **C1. Move the shipped tooling out of `spike/`**, as one commit, first thing. The other workers rebase after you announce it.
   - `tools/` → `tools/`;
   - `tests/engine/interrupt-test.mjs` → `tests/engine/interrupt-test.mjs`;
   - `tests/golden/G2-CHECKLIST.md` → `tests/golden/G2-CHECKLIST.md`.
   - Update every reference: `build.sh`, `engine/giac/*.sh`, `python/build-micropython.sh`, `app/scripts/golden.ts`, `tests/golden/oracle.py` and README, `app/src/*Bench.ts`, `app/src/marks.ts`, `MainActivity.java`, `android/NOTES.md`, `spec/keyboard.yaml`, `CLAUDE.md` Commands, `.claude/agents/*`, and this brief. `spike/` keeps only Phase 0 history (`git grep spike/` afterwards should only find history docs).
   - Prove it: `npm run golden`, then `oracle.py --g2`, then `./build.sh --dev --unsigned` all pass. `[FYI]` everyone with the commit.
2. **C2.** `device_run.py page` appends its `PASCALINE_BENCH` results (solve, plot, and later python) to `.coord/device-runs.jsonl`, and `runs_summary.py` reads them.
3. **Galaxy S8+ bring-up**, as soon as it is authorised. Record the specs, then measure `phase-1` there (release, ≥5 runs):
   - cold launch → keyboard usable and → engine ready;
   - the plot frame rate with three functions;
   - solve p95.

   If something fails on Android 9 (WebView features, wasm exceptions), that's a finding. Report it at once.
4. **Start-up watch.** After each merge that adds the Python app or CodeMirror, measure on the Tab One: keyboard usable and engine ready, ≥5 runs. Track the bundle size at start and per lazy chunk.
5. **Milestone 3 numbers** (section 8 item 3), on the Tab One and the S8+:
   - add a `?bench=python` measurement mode (measurement builds only), like `?bench=solve`;
   - measure first Python open → shell ready, Cancel → ready again, and the `calc.cas` round trip.

## 8. Definition of done (Henri verifies it himself)
On `phase-1`, all merged:
1. **Gates pass.**
   - `npm run typecheck`, unit tests, Playwright tests and `npm run golden` (now including Python) all pass.
   - Earlier gates still pass: interrupt 16/16, Home 123/123, Solve 42/42, Function 24/24.
   - Parser: all old cases still pass, with 0 wrong, plus the new L1/L6 cases.
2. **Desktop key-sequence tests:**
   - **Python shell:** `print(1+1)` → `2`; `import calc` then `calc.cas("factor(x^2-1)")` → `(x-1)*(x+1)`; a Home variable set in Home is read from Python, and a value written by Python is seen in Home.
   - **Python editor:** a saved script survives a reload and runs. An error shows its line number.
   - **Graphics:** a script draws a line and a circle, and the canvas shows them.
   - **Cancel:** Cancel on `while True: pass` stops it, and the next `print(1)` works.
   - **L1:** Solve with unknowns `x_1`, `x_2` solves a 2×2 system; `x_1` in Home is a variable, not a unit.
   - **L2–L5:** each has its own test.
   - Milestones 1 and 2 tests still pass.
3. **Device numbers** (release, ≥5 runs, WebView version noted):
   - **Tab One:** keyboard usable **< 1 s** and engine ready **< 1.5 s** (unchanged); first Python open → shell ready **< 0.5 s**; Cancel on an endless loop → ready again **< 0.5 s**; `calc.cas` round trip p95 **< 50 ms**.
   - **Galaxy S8+:** the same measurements plus milestone 2's plot fps and solve p95, reported. No bar on this device yet; a failure there is a finding.
4. **Tooling and builds.**
   - C1: no shipped code or command refers to `spike/`.
   - C2: the page benches are written to `device-runs.jsonl`.
   - `build.sh` from a fresh clone still produces the APK, and it runs on the Tab One with Home, CAS, Function, Solve and Python.
5. **Docs are current:**
   - `CLAUDE.md` (Commands, status);
   - `THIRD_PARTY.md` (CodeMirror and anything else new);
   - `docs/02` section 12;
   - `docs/decisions.md`;
   - `docs/backlog.md` (tick off what's done);
   - new G2 questions in `tests/golden/g2.yaml`, with the checklist regenerated.

## 9. Defaults and proposals
Log every default in `docs/decisions.md`: the choice, why, the alternatives, and what would change your mind. Proposals for the user go at the top, under "Needs the user", each with your recommendation in one sentence.

Defaults you'll likely need:
- how subscripted names map to Giac names;
- the Python app's views and how they map to Symb/Plot/Num, if at all;
- where scripts are stored and their size limit;
- the stdout buffering and output limits;
- what Cancel does to a half-drawn canvas;
- the graphics coordinate system and colours;
- the decimal-comma setting.

## 10. Your loop and the usage budget
- On every report: check the claim (re-run the test or look at the numbers), then merge `p1/<name>-m3b` into `phase-1` (`git merge --no-ff`). Update the shared files, log it, and hand out the next job.
- Every time you wake: run `devlock.sh status` (break locks held by a worker that is gone) and `adb devices`, and ping anyone who has been silent for over an hour. If a worker doesn't answer within 30 minutes of a ping, stop it, log what it was doing, and reassign the job.
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
4. Bring the shared docs up to date (section 8, item 5).
5. Write `docs/shifts/<date>-m3-report.md` for the user, short and in plain language. It covers:
   - what got done;
   - section 8, item by item;
   - the numbers;
   - the defaults decided;
   - proposals that need a yes or no;
   - what the user has to do;
   - problems;
   - next steps.
6. Commit on `phase-1`. Don't push.
