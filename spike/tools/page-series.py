#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Open a page of the shell N times (force-stop between), keep each run's logcat marks, and log the series.
usage: page-series.py PATH WAITMARK N OUTDIR [TIMEOUT_S]
Writes OUTDIR/run<i>.txt (device_run.py page output) and appends a record to .coord/device-runs.jsonl."""
import json, os, re, subprocess, sys, time

path, mark, n, outdir = sys.argv[1], sys.argv[2], int(sys.argv[3]), sys.argv[4]
timeout = sys.argv[5] if len(sys.argv) > 5 else "300"
here = os.path.dirname(os.path.abspath(__file__))
os.makedirs(outdir, exist_ok=True)

def bat():
    o = subprocess.run(["adb", "-s", "HA24BZ2Y", "shell", "dumpsys", "battery"], capture_output=True, text=True).stdout
    return {"level": int(re.search(r"level: (\d+)", o).group(1)), "tempC": int(re.search(r"temperature: (\d+)", o).group(1)) / 10}

before = bat()
for i in range(1, n + 1):
    while bat()["tempC"] > 35:
        time.sleep(30)
    r = subprocess.run([sys.executable, os.path.join(here, "device_run.py"), "page", path, "--wait", mark, "--timeout", timeout], capture_output=True, text=True)
    open(os.path.join(outdir, f"run{i}.txt"), "w").write(r.stdout)
    time.sleep(2)
rec = {"t": time.strftime("%Y-%m-%dT%H:%M:%S"), "kind": "page-series", "path": path, "waitMark": mark, "runs": n, "before": before, "after": bat(), "outdir": outdir}
with open("/home/nordmu/Documents/source99/pascaline/.coord/device-runs.jsonl", "a") as f:
    f.write(json.dumps(rec) + "\n")
print(json.dumps(rec))
