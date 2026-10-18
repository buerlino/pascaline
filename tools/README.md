<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Device and coordination tools

Run from the repo root. Shared state (locks, run logs) lives in the **main checkout's** `.coord/`, which is gitignored: `devlock.sh` finds it with `git rev-parse --git-common-dir`, so a lock taken in a git worktree is the shared one. `PASCALINE_COORD` overrides it. `tools/devlock.test.sh` checks this (acquire in a worktree, see it from the main checkout). Take the device lock before touching a device, and the `host-cpu` lock before a heavy build. `build.sh` takes `host-cpu` itself: if you already hold it, run it with `NO_LOCK=1`, or its qalc step waits for your own lock forever.

```bash
tools/stay-awake.sh <serial>            # keep a device awake, record SoC/RAM/WebView; --restore undoes it
tools/devlock.sh acquire <serial|host-cpu> <owner> [wait_s]   # release / status / break

tools/device-build.sh [--measure] [--install] [--engine-dir DIR] # build our APK (wraps ./build.sh), prints its path
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

Night-shift coordinators (docs/shifts/rules.md section 4a):
```bash
scripts/night.sh            # the night shift: a fresh Read-only henri per decision, scripts/pipeline.sh per package (docs/shifts/rules.md section 4)
# check after editing .claude/agents/* or the script: the call must come back FOREGROUND
CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0 timeout 600 claude --model sonnet --effort low --permission-mode auto -p 'Test only. Call the Agent tool once with subagent_type "ron", model "haiku", run_in_background false, prompt "Test only: reply with the single word PONG." Then reply with one line: FOREGROUND or BACKGROUND (how the call came back), then what the agent returned.'
```

Desktop probes (no device): `tools/probes/` checks what the engine, the parser and the qalc and Find data do today; see its README.

Docs check (no device): `node tools/docs-check.mjs` checks every Markdown link and the docs' size budgets, and while brief section 7 exists, that it equals `docs/shifts/packages/`; `npm run gate` runs it (S7).
