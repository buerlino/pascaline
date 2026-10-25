#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""R81 (F99): does the system keyboard come up when Pascaline returns from another app? On the device only: desktop
Playwright fakes the lifecycle events, and a synthetic blur leaves document.hasFocus() true, which a real one does not.

usage: ANDROID_SERIAL=<serial> tools/probes/ime-return.py [--n 5] [--ways home,recents,shade] [--tap X:Y] [--pause 1.5]
  --tap X:Y   a key of our keypad (a digit), tapped before each way's rounds so the entry has the focus when leaving
  --ways      home: the home key, then the launcher intent (as the icon); recents: the recent-apps key, then a tap on
              the screen's centre (our card); shade: the notification shade down and up (no hide)
Prints one line per return with `dumpsys input_method`'s mInputShown and the focused window, then a count. Exit 0 when
the system keyboard never showed, 1 when it did. Holds the device lock; touches nothing but key events and taps."""
import argparse, os, subprocess, sys, time

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PKG = "io.github.buerlino.pascaline"
S = os.environ.get("ANDROID_SERIAL") or sys.exit("set ANDROID_SERIAL to the device")


def adb(*a: str) -> str:
    return subprocess.run(["adb", "-s", S, "shell", *a], capture_output=True, text=True, timeout=30).stdout


def shown() -> tuple[bool, str]:
    ime = adb("dumpsys", "input_method")
    line = next((l.strip() for l in ime.splitlines() if "mInputShown" in l), "mInputShown=?")
    win = next((l.strip() for l in adb("dumpsys", "window").splitlines() if "mCurrentFocus" in l), "")
    return "mInputShown=true" in line, f"{line} | {win}"


def centre() -> tuple[str, str]:
    size = adb("wm", "size").strip().splitlines()[-1].split()[-1]  # "Override size: WxH" wins over "Physical size"
    w, h = size.split("x")
    return str(int(w) // 2), str(int(h) // 2)


def launch() -> None:
    adb("monkey", "-p", PKG, "-c", "android.intent.category.LAUNCHER", "1")


def away_and_back(way: str, pause: float) -> None:
    if way == "home":
        adb("input", "keyevent", "KEYCODE_HOME")
        time.sleep(pause)
        launch()
    elif way == "recents":
        adb("input", "keyevent", "KEYCODE_APP_SWITCH")
        time.sleep(pause)
        adb("input", "tap", *centre())
    elif way == "shade":
        adb("cmd", "statusbar", "expand-notifications")
        time.sleep(pause)
        adb("cmd", "statusbar", "collapse")
    else:
        sys.exit(f"unknown way {way}")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=5)
    ap.add_argument("--ways", default="home,recents,shade")
    ap.add_argument("--tap", default="")
    ap.add_argument("--pause", type=float, default=1.5)
    o = ap.parse_args()
    owner = f"ime-return-{os.getpid()}"
    lock = os.path.join(REPO, "tools", "devlock.sh")
    if subprocess.run([lock, "acquire", S, owner, "600"]).returncode != 0:
        sys.exit(f"device {S} busy")
    bad = total = 0
    try:
        if "isKeyguardShowing=true" in adb("dumpsys", "window"):
            sys.exit("the device is locked: unlock it first")
        launch()
        time.sleep(3)
        for way in o.ways.split(","):
            if o.tap:
                adb("input", "tap", *o.tap.split(":"))
                time.sleep(0.8)
                print(f"{way}: before leaving: {shown()[1]}")
            for i in range(1, o.n + 1):
                away_and_back(way, o.pause)
                time.sleep(o.pause)
                up, text = shown()
                total += 1
                bad += up
                print(f"{way} {i}/{o.n}: {'KEYBOARD ' if up else ''}{text}", flush=True)
    finally:
        subprocess.run([lock, "release", S, owner])
    print(f"IME RETURN {bad}/{total} returns showed the system keyboard")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
