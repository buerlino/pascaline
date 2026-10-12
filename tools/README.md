<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# Device and coordination tools

Run from the repo root. Shared state (locks, run logs) lives in `.coord/`, which is gitignored. Take the device lock before touching a device, and the `host-cpu` lock before a heavy build.

```bash
tools/stay-awake.sh <serial>            # keep a device awake, record SoC/RAM/WebView; --restore undoes it
tools/devlock.sh acquire <serial|host-cpu> <owner> [wait_s]   # release / status / break

tools/device-build.sh [--measure] [--install] [--engine-dir DIR] # build our APK (wraps ./build.sh), prints its path
tools/device_run.py start --mode first|cold|warm --runs 7         # launch timings from logcat marks
tools/device_run.py bench --runs 5                                 # the 55 benchmark cases on the device
tools/device_run.py page PATH [--wait MARK]                       # a measurement page; its results go to .coord/device-runs.jsonl
tools/runs_summary.py                                             # medians from .coord/device-runs.jsonl
```

Smaller helpers (usage in each file's header):
- `page-series.py`: open a page N times and log the series.
- `shots.py`: cold-start a page N times and keep a screenshot of each.
- `tap-seq.py`: tap a sequence and report whether the system keyboard is shown after each tap.
- `probe-wasm.py`: the R2 wasm start-up probe (its page lived in the archived Phase 0 spike app).
