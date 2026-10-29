#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""R81 (F99): does the system keyboard come up when Pascaline returns from another app? On the device only: desktop
Playwright fakes the lifecycle events, and a synthetic blur leaves document.hasFocus() true, which a real one does not.

usage: ANDROID_SERIAL=<serial> tools/probes/ime-return.py [--n 5] [--ways home,recents,shade] [--tap X:Y] [--pause 1.5]
       ANDROID_SERIAL=<serial> tools/probes/ime-return.py --watch SECONDS
  --tap X:Y   a key of our keypad (a digit), tapped before every round so the entry has the focus when leaving
  --watch S   A46: no gestures of its own. Clears logcat, waits S seconds while you switch away and back by hand
              (type 5 5, home, swipe along the bar), then prints each Pascaline ImeTracker `onRequestShow ... reason`
              line and each SHOW_/HIDE_ reason with its time; exit 1 if any show for the package was logged
              (SHOW_AUTO_EDITOR_FORWARD_NAV or other). Injected input never reproduced the bug, so use the hand.
  --ways      home: the home key, then the launcher intent (as the icon); recents: the recent-apps key, then a tap on
              the screen's centre (our card); shade: the notification shade down and up (no hide)
Prints one line per return with `dumpsys input_method`'s mInputShown and the focused window, then a count. Exit 0 when
the system keyboard never showed, 1 when it did. Holds the device lock; touches nothing but key events and taps."""
import argparse, os, re, subprocess, sys, time

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


def watch(secs: float) -> int:
    subprocess.run(["adb", "-s", S, "logcat", "-c"], timeout=30)
    print(f"watching {secs:.0f} s: switch away and back by hand now", flush=True)
    time.sleep(secs)
    log = subprocess.run(["adb", "-s", S, "logcat", "-d", "-v", "time", "-s", "ImeTracker"], capture_output=True, text=True, timeout=60).stdout
    shows = 0
    for l in log.splitlines():
        if PKG not in l:
            continue
        m = re.search(r"reason\s+(\w+)", l) or re.search(r"\b((?:SHOW|HIDE)_\w+)", l)
        if "onRequestShow" in l or (m and m.group(1).startswith("SHOW_")):
            shows += 1
            print("SHOW", l.strip())
        elif m and m.group(1).startswith("HIDE_"):
            print("HIDE", l.strip())
    print(f"IME WATCH {shows} shows for {PKG}")
    return 1 if shows else 0


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=5)
    ap.add_argument("--ways", default="home,recents,shade")
    ap.add_argument("--tap", default="")
    ap.add_argument("--pause", type=float, default=1.5)
    ap.add_argument("--watch", type=float, default=0)
    o = ap.parse_args()
    owner = f"ime-return-{os.getpid()}"
    lock = os.path.join(REPO, "tools", "devlock.sh")
    if subprocess.run([lock, "acquire", S, owner, "600"]).returncode != 0:
        sys.exit(f"device {S} busy")
    bad = total = 0
    try:
        if o.watch:
            return watch(o.watch)
        if "isKeyguardShowing=true" in adb("dumpsys", "window"):
            sys.exit("the device is locked: unlock it first")
        launch()
        time.sleep(3)
        for way in o.ways.split(","):
            for i in range(1, o.n + 1):
                if o.tap:
                    adb("input", "tap", *o.tap.split(":"))
                    time.sleep(0.8)
                    print(f"{way} {i}: before leaving: {shown()[1]}")
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
