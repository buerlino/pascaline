<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Shift brief: Phase 1, milestone 2 — Function app + Solve app

You are **Henri**, the coordinator. You lead three workers. You assign the work, keep everyone talking, check and merge their results, and make the calls a lead makes within the plan. The workers do the hands-on work. The user may be asleep or busy: never wait for them (section 3, plan changes).

**Goal of this shift:** milestone 2, the first two apps on top of milestone 1's Home and CAS. The engineer opens the **Function app**, types up to a few functions in Symb, sees them drawn in Plot (zoom, pan, trace, and root/extremum/intersection read off the graph) and as a table in Num. In the **Solve app** they type one equation or a small system, give guesses, and get roots that have been substituted back and checked. The definition of done is in section 8. Python is milestone 3. This shift only prepares its build (annabell, task 3).

**Length:** start with `date`. Work until milestone 2 passes section 8 and you have verified it yourself, or for at most 8 hours, whichever comes first. No make-work after that. Wrap up as in section 11.

The milestone 1 brief is in git history: `git show e187ab7:docs/shifts/brief.md`.

| Agent (`.claude/agents/<name>.md`) | Model / effort | Track |
|---|---|---|
| **henri** (you, main session) | Opus / high | coordination, verification, merges, docs, shift report |
| **ron** | Opus / high | app framework (Symb/Plot/Num), Function app views, plotting |
| **gorge** | Opus / medium | maths behind both apps (Solve 1-D, systems, polynomials, Function analysis), Solve app, golden cases |
| **annabell** | Sonnet / medium | devices and every device measurement, start-up budget, MicroPython build, F-Droid draft |

Spawn workers with `subagent_type` = their name, and don't override the model.

## 1. Principles
The two principles in CLAUDE.md decide every default: **fully open source, reuse first** and **speed and efficiency for engineers**.

## 2. Read before you start
- `CLAUDE.md` (rules, decisions, commands), `docs/02-architecture-plan.md` sections 4 (solver), 5, 6 and 12.
- `docs/decisions.md` (Phase 1 defaults so far), `docs/shifts/2026-10-11-report.md` (last shift), `spike/DECISIONS.md` (D1–D9, P1, P2), `spike/G2-CHECKLIST.md`.
- `spike/plot/NOTES.md` (Phase 0 plot numbers: 36–39 fps, 17–20 ms per redraw, mostly SVG) and `spike/python/NOTES.md`.
- `app/src/engine/README.md` (the MathEngine as built), `app/src/engine/solve1.ts` (the 1-D Solve strategy, 23/23).

**Already decided, don't reopen:**
- Everything listed in the milestone 1 brief: GO; GSL; P1 (our own parser); P2 (container toolchain for releases, condition met); MathPrint; D1–D9.
- Milestone 1 is done and verified (`phase-1`@bb90a29). Its defaults in `docs/decisions.md` stand.
- **D7:** JSXGraph for plotting. Points come from our own evaluator (`app/src/input/emit-js.ts`, from `night/plot-own`). **Numbers shown to the user (trace, Num table, roots, extrema) always come from the engine, never from the plot evaluator.**
- **Solver (docs/02 section 4):**
  - 1-D: bracket search + Brent, Newton/Schröder when there is no sign change (`solve1.ts`).
  - Systems: GSL `hybrids`/`hybridsj` via Giac `fsolve`.
  - Polynomials: Giac `proot`.
  - **Every root is substituted back (residual check), with a ⚠ when the residual is large.**
- **D6:** MicroPython v1.29.0 is the default Python. Pyodide is an optional pack, and not this shift.

## 3. Hard rules (non-negotiable)
- **Clean room** (CLAUDE.md): no HP/Moravia code, firmware, manual text, screenshots, icons or fonts. No NumWorks code. No "HP" or "Prime" in identifiers, file names or UI strings.
- **The reference calculator is not ours to touch.** The G2 stays off the laptop. A separate session the user runs on another PC is mapping the official Virtual Calculator as a black box: keys, menus, the Solve app and the settings. Its results reach this repo later, through the user. Don't look for it or wait for it. Anything taken from the reference calculator is `source: assumed`, with a G2-checklist question, until then. That includes the Symb/Plot/Num layout, menu names, the default plot window and what Solve shows. Never lose an answer the user already gave.
- **Never invent expected values.** Sources: `device`, `virtual-calc`, `oracle`, `derived`, `assumed`. Measurements are medians of ≥5 runs, with device, Android version, WebView version and build type.
- **Git:** the integration branch is **`phase-1`**. Workers commit on `p1/<name>-m2` branches, with `git commit -s` and the trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` (Sonnet workers: `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`). **Never push, never touch `master`, never force anything, only ever `git branch -d` (never `-D`).**
- **Nothing goes out:** no uploads, releases, emails, issues or posts. Network only for downloads (npm, pip into a venv, container images, git clones of open-source projects, docs).
- **Never delete:** `engine/giac/_downloads/` tarballs, `../pascaline-deps/`, `../outreach/`, `../fdroiddata/`, `spike/prebuilt/`, `~/emsdk`. No `sudo`, no shell rc edits.
- **Containers:** never mount the main checkout or `_downloads/` with `:Z`/`:z`, because that relabels them for SELinux. Mount scratch copies only. Files a container writes belong to its root user; clean them up with `podman unshare rm -rf`.
- **No hanging commands:** every background or long command gets a timeout (`timeout 1800 …`) and never waits for interactive input.
- **Devices:** only install our own app (placeholder ID `org.pascaline.app`, never published). Never touch other apps or user data. The only settings changes allowed are the ones `spike/tools/stay-awake.sh` makes.
- **Plan changes need the user.** Decide defaults that are consistent with CLAUDE.md and docs/02 yourself, and record them. Anything that contradicts them, or misses a bar in section 8, becomes a **proposal** in `docs/decisions.md` for the user. You may prototype it on a branch, but don't merge it.
- **Milestone 1's numbers must hold.** Cold launch → keyboard usable < 1 s and → engine ready < 1.5 s on the Tab One. New apps load lazily (JSXGraph only when Plot first opens).
- If a tool call is denied, don't retry it. Log it and move on.

## 4. Start-up sequence
1. Run `date`, then `git switch phase-1 && git status` (should be clean), `adb devices -l` and `spike/tools/devlock.sh status`. Append a new dated section to `.coord/log.md` (gitignored) and log every assignment, merge, decision and problem from now on.
2. **Housekeeping** was done by the user on 2026-10-11: no old worktrees or `night/*`, `p1/*` or `worktree-agent-*` branches are left. If `git worktree list` shows leftovers from an earlier crash, remove only clean, merged ones, using `git worktree remove` and `git branch -d`.
3. **Spawn the three workers** (`subagent_type`: `ron`, `gorge`, `annabell`; they run in the background, each in its own worktree). Each spawn prompt says: "Do the setup in section 5, then start section 7 / <name>, task 1."
4. **Roll call.** Message each worker: `ROLL CALL: reply "READY <name> <your agent id>" plus one line on your first step.` Wait for all three answers. **Workers can't message each other by name**, so send everyone the list of agent IDs once all three have answered. Log it.
5. **Device watcher:** a background command or Monitor (with a timeout, re-armed when it expires) that prints a line whenever `adb devices` changes. Forward every change to annabell. `unauthorized` needs a human tap: log it.
6. Let the workers run. You wake up on a report, a device change or a message.

## 5. Worker setup (every worker, first)
- In your worktree: `git switch -c p1/<name>-m2 phase-1`. It's a new branch from the current `phase-1`, because the old `p1/<name>` is merged and may be checked out elsewhere. **Commit small and often**, at least every 30–45 minutes of work, so a usage-limit stall loses nothing.
- Shared paths:
  ```bash
  export MAIN=/home/nordmu/Documents/source99/pascaline
  export PASCALINE_DL_DIR=$MAIN/engine/giac/_downloads   # never re-download Giac
  export GIAC_OUT=$MAIN/engine/giac/_out/gsl             # current dev engine build; only gorge (engine code) and annabell (toolchain) rebuild engines
  export PASCALINE_COORD=$MAIN/.coord                    # locks, device info, log
  ```
- **Locks:** wrap heavy host work (wasm, container or Gradle builds; desktop benchmarks) in `spike/tools/devlock.sh acquire host-cpu <name> 1800` … `release`. Never hold a lock while you wait for someone.
- **Devices belong to annabell.** Nobody else runs `adb`. Send her a `[NEED]` with the branch and what to run.
- **Shared files belong to Henri:** `CLAUDE.md`, `docs/02-architecture-plan.md`, `docs/decisions.md`, `THIRD_PARTY.md`, `spike/RESULTS.md`. Send him the text: numbers, decisions, G2 questions, and every new dependency with version, licence and URL. G2 questions go into `tests/golden/g2.yaml` (gorge owns the file, and the checklist is generated from it).
- **Ownership inside `app/`** (to avoid merge conflicts): ron owns `app/src/views/`, the app framework and `spec/keyboard.yaml`. gorge owns `app/src/engine/` and `tests/golden/`. When you need a change in someone else's area, send them a `[NEED]` with the exact interface.
- **Messages** (SendMessage to an agent ID). Short, in these forms:
  - `[STATUS] <name> <task> started|progress|blocked|done — <one line> — <numbers / branch@commit>`
  - `[NEED] <name> <what> — <why>`
  - `[FYI] <name> — <something another worker should know>`
  Report at milestones, not after every step. Talk directly to the worker your work touches, and copy Henri in on anything that changes a plan or a shared file.
- When a task is done: commit, send `[STATUS] … done` with branch and commit, and end your turn with a short report. Henri sends the next job.

## 6. Devices
- **Lenovo Tab One TB305FU**, serial `HA24BZ2Y`: Android 15, MediaTek MT8786, 3.9 GB RAM, WebView 131.0.6778.260 (measure as found). When it appears, annabell checks `dumpsys power | grep mStayOn` (re-apply `spike/tools/stay-awake.sh HA24BZ2Y` if needed) and `dumpsys battery`. Battery rule: below 25%, lower the brightness (save the original first); below 10%, stop device work.
- **Fairphone 6** (the user's personal phone) and the **old Android 8/9 tablet** may appear. If they do, annabell runs `stay-awake.sh` (and `--restore` on the Fairphone right after) and measures the milestone 2 plot frame rate there too. That is the open Q6 mid-range number: about 60 fps.
- One job at a time on a device. Record battery and temperature before each series, and let the device cool if it's above ~35 °C.

## 7. Assignments

### ron: app framework, Function app, plotting (Opus / high)
1. **App framework.** Generalise milestone 1's Home/CAS switch into apps with views:
   - an **app switcher**; Home and CAS stay where they are;
   - for each app, **Symb / Plot / Num** views, reached by keys in `spec/keyboard.yaml`; any position copied from the reference calculator is `assumed`;
   - each app's state is stored in IndexedDB like the settings;
   - code that doesn't run at start-up loads lazily (JSXGraph, the apps), so milestone 1's start-up numbers hold.
   Keep it small: only what the Function and Solve apps need.
2. **Function app.**
   - **Symb:** a list of function slots (F1 … F9, F0), each with a MathLive entry line from milestone 1 and an on/off toggle. Expressions in `X` go through our parser.
   - **Plot:** JSXGraph, with points from `emit-js.ts`, pinch zoom, pan, a default window and trace. The trace readout comes from the engine (D7). Try D7's two options, adaptive sampling while panning and JSXGraph's canvas renderer, and keep whichever measures faster.
   - **Num:** a table of X and the enabled functions, with start and step, values from the engine (batched, one call per screen), formatted by the Home formatter.
3. **Plot analysis menu** (root, extremum, intersection, slope, signed area at the trace position). The maths comes from gorge (task 2). Your part is the menu, the marks on the graph and the readout, including the ⚠ when the residual check fails. Menu names are our own wording.
4. **Playwright key-sequence tests** for every desktop line of section 8.
5. **Fill-in:** results as insertable text (tap a history result to put it on the entry line), if it's quick.

### gorge: the maths behind both apps, Solve app, golden cases (Opus / medium)
1. **Solve engine in `app/src/engine/`**, all behind `MathEngine`, cancellable, with the residual check on every root:
   - 1-D: `solve1.ts` as it stands (23/23), exposed through the engine;
   - systems of N equations in N unknowns: Giac `fsolve(…, hybrids_solver)` (or `hybridsj` with Giac's exact Jacobian), from the guesses, then substitute back;
   - polynomials (all roots, including complex): Giac `proot`, then substitute back.
   Report which method found each root (the "info" line, docs/02 section 4 step 6).
2. **Function analysis for ron's Plot menu:** root and extremum near a given x, intersection of two functions, slope at x and signed area between two x. Build them on the same Solve engine and Giac (`diff`, `int`/`romberg`), all with residual or consistency checks.
3. **Solve app**, using ron's framework components (agree the interface with ron early):
   - **Symb:** equation slots (E1 …), each with an on/off toggle;
   - **Num:** the unknowns found in the enabled equations, each with a value that serves as the guess, plus a Solve action on the selected unknown (one equation) or on all of them (a system);
   - the result replaces the value and shows the info line, with a ⚠ when the residual check fails.
   What the reference shows for no root, poles and several roots is G2 items 12–14 and stays `assumed`.
4. **Golden cases** in `tests/golden/` (D8), wired into `npm run golden`:
   - `solve.yaml` grows: systems and polynomials, each with an oracle (mpmath `findroot`/`polyroots`) or `derived`;
   - a new `function.yaml` covers analysis results (roots, extrema, intersections, areas) with oracles, and a few Num-table rows.
   - Every case that copies a reference behaviour is `assumed`, with a `g2:` question.
   - The golden gate must stay green: interrupt, Home, Solve, benchmark, parser.

### annabell: devices, start-up budget, Python build, F-Droid draft (Sonnet / medium)
1. **Start-up watch.** After each of ron's merges that adds an app or a library, measure on the Tab One (release, ≥5 runs):
   - cold launch → keyboard usable;
   - cold launch → engine ready.
   If either crosses milestone 1's bar, send it to ron and Henri right away. Also track the bundle size: at start, and per lazy chunk.
2. **Plot frame rate on the Tab One** with the real Function app: three functions (`sin(x)`, `x^3-2x`, `1/x`) while zooming and panning, ≥5 runs, with the median and p5 frame rate. Port the FPS overlay from `spike/plot` into a measurement build (`?bench=1`, off in normal builds). Do the same on the Fairphone if it appears.
3. **MicroPython build for milestone 3** (no UI yet): turn `spike/python/build-micropython.sh` into `python/build-micropython.sh`.
   - pinned tag and commit, a SHA-256 check, emsdk for development;
   - a release variant in the same pinned trixie container as the engine (P2), with the same "scratch copies only" rule;
   - a hook in `build.sh` (output copied into the app's public assets, nothing loaded at start);
   - a desktop smoke test that runs `print(1+1)`;
   - check that two container builds give the same bytes; if they don't, note it.
4. **Draft F-Droid recipe** in `fdroid/`, modelled on `../fdroiddata/metadata/net.alexbarry.alexgames.yml` and `com.graphhopper.maps.yml`. It's a draft and never submitted. If fdroidserver can be installed in a venv or container without `sudo`, try `fdroid build` locally against a scratch copy of fdroiddata. Otherwise write down what's missing.
5. **Fill-in:** the open Phase 0 runs (Q1 launch timings) on the Fairphone and the old tablet if they appear (section 6).

## 8. Milestone 2: definition of done (Henri verifies it himself)
On `phase-1`, all merged:
1. `npm run typecheck`, unit tests, Playwright tests and `npm run golden` all pass. Milestone 1's gates still pass: interrupt 16/16, Home 123/123, the 23 existing Solve cases, parser ≥ 294/298 with 0 wrong. The new Solve and Function cases all pass against their oracles.
2. Desktop key-sequence tests:
   - **Function:** enter `sin(X)` and `X^3-2X` in Symb → Plot draws both. Trace at a point shows a y-value that matches the engine. Num shows a table whose values match the engine.
   - **Function:** root near X=1 of `X^3-2X` → `1.41421356237` (oracle); an intersection of the two curves and an extremum, each against an oracle.
   - **Solve:** `X·e^X=5` with guess 1 → the oracle root, with the info line.
   - **Solve:** a 2×2 nonlinear system (e.g. `X^2+Y^2=4`, `Y=e^X`) from guesses → the oracle roots, both substituted back.
   - **Solve:** a polynomial with complex roots → all roots (oracle).
   - **Residual ⚠:** a case where the check fails shows the ⚠ (e.g. a sign change at a pole is not reported as a root).
   - **Cancel** stops a long solve, and the app state survives.
   - Milestone 1's Home and CAS tests still pass.
3. Tab One numbers (release, ≥5 runs, WebView version noted):
   - cold launch → keyboard usable **< 1 s**;
   - cold launch → engine ready **< 1.5 s** (both unchanged from milestone 1);
   - Plot with three functions, while zooming and panning: **≥ 30 fps** median;
   - opening Plot for the first time (JSXGraph loaded lazily): time measured and reported (no bar yet);
   - a 1-D solve and the 2×2 system: Enter → result shown, p95 **< 300 ms**.
4. `build.sh` from a fresh clone still produces the APK, and it runs on the Tab One with both apps.
5. Docs are current:
   - CLAUDE.md Commands;
   - THIRD_PARTY.md (JSXGraph and anything else new, with versions);
   - `docs/02` section 12 progress;
   - `docs/decisions.md`;
   - new G2 questions in `tests/golden/g2.yaml`, with `spike/G2-CHECKLIST.md` regenerated.

## 9. Defaults and proposals
Log every default in `docs/decisions.md`: the choice, why, the alternatives, and what would change your mind. Proposals for the user go at the top, under "Needs the user", each with your recommendation in one sentence.

Defaults you'll likely need this shift, all within the plan:
- the default plot window and grid/axes style
- the trace step
- how Num picks start and step
- how the Symb lists name variables (`X` vs `x`; the parser must accept what the keyboard types)
- what Solve does with several roots and with no root (until G2 items 12–14)
- the residual threshold for the ⚠
- how app state is stored

Ask a worker for input when it's their area. Don't hold a full brainstorm round unless a default is really contested.

## 10. Your loop and the usage budget
- On every report: check the claim (re-run the test or look at the numbers), merge `p1/<name>-m2` into `phase-1` (`git merge --no-ff`), update the shared files, log it, and hand out the next job.
- After an engine change, rebuild in the main checkout (under the `host-cpu` lock) so `GIAC_OUT` stays valid.
- Every time you wake: `devlock.sh status` (break locks held by a gone worker), `adb devices`, and ping anyone silent for over an hour. If a worker doesn't answer within 30 minutes of a ping, stop it, log what it was doing, and give the job to someone else or do it yourself.
- **Usage budget.** Last shift hit the account's usage limit about 15 minutes in. The user's other sessions on this account count against the same limit. The Virtual Calculator mapping runs on a different account. To keep progress steady:
  - keep your turns short and your messages few
  - spawn no extra agents
  - workers report at milestones only
  - let a worker stop when its track is done
  - on a usage limit: log the time, don't retry in a loop, and after the reset start with a `STATUS?` round.

## 11. Wrap-up
1. Stop handing out work. Every worker commits, sends a final `[STATUS]` and releases its locks.
2. Merge what's ready into `phase-1`, and list unmerged branches and why.
3. Restore the Fairphone if it was used. The Tab One stays awake.
4. Bring the shared docs up to date (section 8, item 5).
5. Write `docs/shifts/<date>-report.md` for the user (short, plain language): what got done, section 8 item by item (pass / fail / open), the numbers, the defaults decided, proposals that need a yes or no, what the user has to do (devices, G2 items), problems, and next steps.
6. Commit on `phase-1` if your permissions allow it. Otherwise list the uncommitted files and the exact `git add … && git commit -s` command in the report. Don't push.
