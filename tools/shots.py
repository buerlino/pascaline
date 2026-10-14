#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Cold-start a page N times and save a screenshot of each (for pages whose numbers only show on screen).
Device: $ANDROID_SERIAL (default the Tab One).
usage: shots.py PATH N OUTPREFIX [WAIT_S]"""
import os, subprocess, sys, time

S = os.environ.get("ANDROID_SERIAL", "HA24BZ2Y")
path, n, out = sys.argv[1], int(sys.argv[2]), sys.argv[3]
wait = float(sys.argv[4]) if len(sys.argv) > 4 else 6
def adb(*a, **k):
    return subprocess.run(["adb", "-s", S, *a], capture_output=True, **k).stdout
for i in range(n):
    adb("shell", "am", "force-stop", "io.github.buerlino.pascaline")
    time.sleep(1.5)
    adb("shell", "am", "start", "-W", "-n", "io.github.buerlino.pascaline/.MainActivity", "--es", "path", path)
    time.sleep(wait)
    open(f"{out}{i}.png", "wb").write(adb("exec-out", "screencap", "-p"))
