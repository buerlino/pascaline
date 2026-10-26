<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Device and coordination tools

Run from the repo root. Shared state (locks, run logs) lives in the **main checkout's** `.coord/`, which is gitignored: `devlock.sh` finds it with `git rev-parse --git-common-dir`, so a lock taken in a git worktree is the shared one. `PASCALINE_COORD` overrides it. `tools/devlock.test.sh` checks this (acquire in a worktree, see it from the main checkout). A lock records its holder's pid and host only when the caller opts in with `PASCALINE_LOCK_PID=<its long-lived pid>` (`build.sh`, `pipeline.sh` and the build-wasm scripts export `$$`; an agent's or a hand-held lock records none); `acquire` breaks a lock whose pid is gone on this host (`broke stale lock <name> (pid <n> gone)`), a lock without a pid only `break` does, and `status` shows the pid. Take the device lock before touching a device, and the `host-cpu` lock before a heavy build. `build.sh` takes `host-cpu` itself: if you already hold it, run it with `NO_LOCK=1`, or its qalc step waits for your own lock forever. `scripts/pipeline.sh` copies `node_modules` from the phase-1 worktree's `app/` (`npm ci --prefer-offline` there first when stale), never from the main checkout.

```bash
tools/stay-awake.sh <serial>            # keep a device awake, record SoC/RAM/WebView; --restore undoes it
tools/devlock.sh acquire <serial|host-cpu> <owner> [wait_s]   # release / status / break

tools/device-build.sh [--measure] [--install] [--engine-dir DIR] # build our APK (wraps ./build.sh), prints its path
tools/device-build.sh --test --install                             # the test build: WebView debugging on (never release), installed on $ANDROID_SERIAL
tools/core-device.sh [--only c05,c07]                             # the core list on the device's WebView over adb (A32): lock, stay-awake, pm clear per case; CORE DEVICE line, .coord/device-runs.jsonl
tools/device_run.py status                                        # battery, temperature, WebView, app version
tools/device_run.py start --mode first|cold|warm --runs 7         # launch timings from logcat marks (waits for engine-ready)
tools/device_run.py bench --runs 5                                 # the 55 benchmark cases on the device
tools/device_run.py page PATH [--wait MARK]                       # a measurement page; its results go to .coord/device-runs.jsonl
tools/runs_summary.py                                             # medians from .coord/device-runs.jsonl
```

All of them use `$ANDROID_SERIAL` (default: the Tab One). Smaller helpers (usage in each file's header):
- `page-series.py`: open a page N times and log the series.
- `shots.py`: cold-start a page N times and keep a screenshot of each.
- `tap-seq.py`: tap a sequence and report whether the system keyboard is shown after each tap.
Night-shift coordinators (docs/shifts/rules.md section 4). Run them from the phase-1 worktree (`cd .claude/worktrees/phase-1`): the main checkout may be on another branch, without `scripts/`.
```bash
scripts/night.sh --until 07:30   # the night shift: a fresh Read-only henri per decision, scripts/pipeline.sh per package (docs/shifts/rules.md section 4)
                                 # from --until (or at --max-steps minus 2) only the last Opus pass and the report run, then it stops
scripts/night.sh --until 07:30 --dry-run   # prints each step's kind on a simulated clock and the two closing steps; starts nothing
```

Desktop probes (no device): `tools/probes/` checks what the engine, the parser and the qalc and Find data do today; see its README.

Docs check (no device): `node tools/docs-check.mjs` checks every Markdown link and the docs' size budgets; `npm run gate` runs it (S7).

Release gate (A42): `tools/release-gate.sh` runs the golden gate, the canaries and the core list on `_out/release` (the engine the APK carries), rebuilding it first unless its `.release-key` stamp matches; one line per stage, last line `RELEASE GATE PASSED` or `RELEASE GATE FAILED: <stages>`. Test: `tools/release-gate.test.sh`. Needs `npm run index` done in the checkout; run it when the host is quiet (under load, `invariants` and core c46/c47 time out).
