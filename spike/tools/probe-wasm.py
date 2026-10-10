#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""R2: cold-start public/wasmstart.html?v=<variant> N times, print the median of each reported field.
usage: probe-wasm.py VARIANT [N]   (caller holds the device lock)"""
import re, statistics, subprocess, sys, time

S = "HA24BZ2Y"
v, n = sys.argv[1], int(sys.argv[2]) if len(sys.argv) > 2 else 7
def adb(*a):
    return subprocess.run(["adb", "-s", S, *a], capture_output=True, text=True).stdout
rows = []
for i in range(n):
    adb("shell", "am", "force-stop", "org.pascaline.app")
    time.sleep(1.5)
    adb("logcat", "-b", "all", "-c")
    adb("shell", "am", "start", "-W", "-n", "org.pascaline.app/.MainActivity", "--es", "path", f"/wasmstart.html?v={v}")
    for _ in range(60):
        out = adb("logcat", "-d", "-s", "Capacitor/Console:I")
        m = re.search(r"PASCALINE_T wasmprobe (.*)", out)
        if m:
            rows.append(dict(re.findall(r"(\w+)=(\S+)", m.group(1))))
            break
        time.sleep(0.5)
bat = re.findall(r"(level|temperature): (\d+)", adb("shell", "dumpsys", "battery"))
print(v, "n=%d" % len(rows), dict(bat))
for k in ("totalMs", "fetchMs", "sinceStart", "hit"):
    xs = [float(r[k]) for r in rows if k in r]
    if xs:
        print("  %s median %.1f raw %s" % (k, statistics.median(xs), xs))
