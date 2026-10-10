#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Print the medians from .coord/device-runs.jsonl (written by device_run.py), one line per series."""
import json, os, sys

main = os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")).split("/.claude/worktrees/")[0]
path = os.path.join(os.environ.get("PASCALINE_COORD", os.path.join(main, ".coord")), "device-runs.jsonl")
last = int(sys.argv[1]) if len(sys.argv) > 1 else 6
for line in open(path).read().strip().splitlines()[-last:]:
    d = json.loads(line)
    if d["kind"] == "start":
        s = {k: v["p50"] for k, v in d["summary"].items()}
        print(d["t"], "start", d["mode"], d["build"], f"n={d['runs']}", "bat", d["before"], "->", d["after"])
        print("   p50:", s)
        print("   firstResult raw:", [r.get("firstResultMs") for r in d["raw"]], "total raw:", [r.get("totalTime") for r in d["raw"]])
    elif d["kind"] == "bench":
        keep = {k: v for k, v in d.items() if k not in ("perCase", "t")}
        print(d["t"], "bench", json.dumps(keep))
    else:
        print(d["t"], d["kind"], d.get("level"), d.get("tempC"))
