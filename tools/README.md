<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Device and coordination tools

Run from the repo root. Shared state (locks, run logs) lives in the **main checkout's** `.coord/`, which is gitignored: `devlock.sh` finds it with `git rev-parse --git-common-dir`, so a lock taken in a git worktree is the shared one. `PASCALINE_COORD` overrides it. `tools/devlock.test.sh` checks this (acquire in a worktree, see it from the main checkout). Take the device lock before touching a device, and the `host-cpu` lock before a heavy build.

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

Desktop probes (no device): `tools/probes/` checks what the engine, the parser and the qalc and Find data do today; see its README.
