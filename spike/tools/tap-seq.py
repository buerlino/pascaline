#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""Tap a sequence on the tablet and report the system-keyboard state after each tap.
usage: tap-seq.py name:x:y [name:x:y ...]   (prints mInputShown after every tap)"""
import subprocess, sys, time

S = "HA24BZ2Y"
def adb(*a):
    return subprocess.run(["adb", "-s", S, *a], capture_output=True, text=True).stdout

for spec in sys.argv[1:]:
    name, x, y = spec.split(":")
    adb("shell", "input", "tap", x, y)
    time.sleep(0.8)
    shown = [l.strip() for l in adb("shell", "dumpsys input_method").splitlines() if "mInputShown" in l][:1]
    print(name, shown)
