#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-or-later
"""On-device measurements for the Pascaline spike shell (org.pascaline.app) on one tablet.

  spike/tools/device_run.py status                       # battery, temperature, WebView, app version
  spike/tools/device_run.py start  [--runs 7] [--mode cold|warm|first]
  spike/tools/device_run.py bench  [--runs 5]            # 55 cases per launch, p50/p95, cancel
  spike/tools/device_run.py page PATH [--wait MARK] [--timeout 60]   # open another page, print its marks

Modes for `start`: first = fresh install (no WebView code cache), cold = process killed with
am force-stop (code cache present), warm = app in background, brought back to front.
Results are JSON lines on stdout and appended to .coord/device-runs.jsonl. Only the tablet's own
app is installed or removed; the caller must hold the device lock (devlock.sh acquire <serial> ...).
"""
import argparse, json, os, re, statistics, subprocess, sys, time

SERIAL = os.environ.get("ANDROID_SERIAL", "HA24BZ2Y")
PKG = "org.pascaline.app"
ACT = f"{PKG}/.MainActivity"
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "../.."))
MAIN = REPO.split("/.claude/worktrees/")[0]
COORD = os.environ.get("PASCALINE_COORD", os.path.join(MAIN, ".coord"))


def adb(*args, check=True, timeout=120):
    r = subprocess.run(["adb", "-s", SERIAL, *args], capture_output=True, text=True, timeout=timeout)
    if check and r.returncode != 0:
        raise RuntimeError(f"adb {' '.join(args)}: {r.stderr.strip() or r.stdout.strip()}")
    return r.stdout


def sh(cmd, **kw):
    return adb("shell", cmd, **kw)


def battery():
    out = sh("dumpsys battery")
    g = lambda k: int(re.search(rf"{k}: (-?\d+)", out).group(1))
    return {"level": g("level"), "tempC": g("temperature") / 10}


def env_info():
    web = re.search(r"\(name, version\): \((.*)\)", sh("dumpsys webviewupdate")) or None
    ver = re.search(r"versionName=(\S+)", sh(f"dumpsys package {PKG}"))
    # same data stay-awake.sh recorded, with the current build type
    dbg = "DEBUGGABLE" in sh(f"dumpsys package {PKG}")
    return {
        "device": sh("getprop ro.product.model").strip(),
        "android": sh("getprop ro.build.version.release").strip() + " (SDK " + sh("getprop ro.build.version.sdk").strip() + ")",
        "webview": (web.group(1) if web else sh("dumpsys webviewupdate | grep -m1 -i 'current webview'").strip()),
        "build": "debug" if dbg else "release",
        "appVersion": ver.group(1) if ver else "?",
    }


def log_result(rec):
    rec = {"t": time.strftime("%Y-%m-%dT%H:%M:%S"), **rec}
    line = json.dumps(rec)
    print(line, flush=True)
    os.makedirs(COORD, exist_ok=True)
    with open(os.path.join(COORD, "device-runs.jsonl"), "a") as f:
        f.write(line + "\n")


def logcat_clear():
    adb("logcat", "-b", "all", "-c")


def logcat_dump():
    return adb("logcat", "-d", "-v", "epoch", "-s", "PASCALINE_T:I", "Capacitor/Console:I", "chromium:I")


def parse_marks(text):
    """name -> dict of fields (first occurrence wins), from both Java and JS marks."""
    marks = {}
    for line in text.splitlines():
        m = re.search(r"PASCALINE_(?:T|BENCH):? (\S+) (.*)$", line)
        if not m:
            continue
        name, rest = m.group(1), m.group(2)
        fields = dict(re.findall(r"(\w+)=(\S+)", rest))
        marks.setdefault(name, fields)
    return marks


def wait_for(mark, timeout):
    t0 = time.time()
    while time.time() - t0 < timeout:
        txt = logcat_dump()
        if re.search(rf"PASCALINE_T {re.escape(mark)} ", txt):
            return txt
        time.sleep(0.5)
    return logcat_dump()


def am_start_w(extra=""):
    out = sh(f"am start -W -n {ACT} {extra}")
    g = lambda k: (int(m.group(1)) if (m := re.search(rf"{k}: (\d+)", out)) else None)
    return {"thisTime": g("ThisTime"), "totalTime": g("TotalTime"), "waitTime": g("WaitTime")}


def start_once(mode, timeout=60):
    if mode == "first":
        apk = os.environ.get("APK", os.path.join(REPO, os.environ.get("APP_APK", "android/app/build/outputs/apk/release/app-release.apk")))
        adb("uninstall", PKG, check=False)
        adb("install", apk)
    if mode in ("first", "cold"):
        sh(f"am force-stop {PKG}")
        time.sleep(1.5)
    logcat_clear()
    if mode == "warm":
        sh("input keyevent KEYCODE_HOME")
        time.sleep(1.5)
        logcat_clear()
    page = os.environ.get("PAGE_PATH")   # e.g. "/?wasmcache=1" for an experiment variant
    t = am_start_w(f'--es path "{page}"' if page else "")
    txt = wait_for(os.environ.get("READY_MARK", "first-result"), timeout)   # app/ has no first-result at launch: READY_MARK=engine-ready if mode != "warm" else logcat_dump()
    marks = parse_marks(txt)
    rec = dict(t)
    try:
        p0 = int(marks["proc-start"]["epoch"])
        rec["activityMs"] = int(marks["activity-created"]["sinceProc"])
        if "js-start" in marks:
            rec["jsStartMs"] = int(marks["js-start"]["epoch"]) - p0
        if "keyboard-ready" in marks:
            rec["keyboardReadyMs"] = int(marks["keyboard-ready"]["epoch"]) - p0
        if "engine-ready" in marks:
            er = marks["engine-ready"]
            rec["engineReadyMs"] = int(er["epoch"]) - p0
            for key, field in (("instantiateMs", "instantiateMs"), ("initMs", "initMs"), ("workerReadyMs", "readyMs")):
                if field in er:
                    rec[key] = float(er[field])
        if "first-result" in marks:
            rec["firstResultMs"] = int(marks["first-result"]["epoch"]) - p0
    except KeyError:
        pass
    return rec


def summarize(recs, keys):
    out = {}
    for k in keys:
        xs = [r[k] for r in recs if k in r and r[k] is not None]
        if xs:
            out[k] = {"p50": round(statistics.median(xs), 1), "min": min(xs), "max": max(xs), "n": len(xs)}
    return out


def cmd_status(a):
    log_result({"kind": "status", **battery(), **env_info()})


def cmd_start(a):
    pre = battery()
    recs = []
    for i in range(a.runs):
        b = battery()
        if b["tempC"] > 35:
            print(f"warm ({b['tempC']} C), cooling 60 s", file=sys.stderr)
            time.sleep(60)
        recs.append(start_once(a.mode))
        time.sleep(2)
    keys = ["totalTime", "waitTime", "activityMs", "jsStartMs", "keyboardReadyMs", "engineReadyMs", "instantiateMs", "initMs", "firstResultMs"]
    log_result({"kind": "start", "mode": a.mode, "runs": a.runs, "before": pre, "after": battery(), **env_info(),
                "summary": summarize(recs, keys), "raw": recs})


def cmd_bench(a):
    runs = []
    pre = battery()
    for i in range(a.runs):
        sh(f"am force-stop {PKG}")
        time.sleep(1.5)
        logcat_clear()
        am_start_w(f'--es path "{os.environ.get("BENCH_PATH", "/?bench=1")}"')
        txt = wait_for("bench-done", 300)
        cases = {}
        summary = None
        for line in txt.splitlines():
            m = re.search(r"PASCALINE_BENCH (case|summary) (\{.*\})", line)
            if not m:
                continue
            d = json.loads(m.group(2))
            if m.group(1) == "case":
                cases[d["id"]] = d
            else:
                summary = d
        runs.append({"cases": cases, "summary": summary})
        time.sleep(2)
    ok = [r for r in runs if r["summary"]]
    ids = sorted({i for r in ok for i in r["cases"]})
    per_case = {i: {k: statistics.median(r["cases"][i][k] for r in ok if i in r["cases"]) for k in ("firstMs", "rtMs", "warmMs")} for i in ids}
    first = sorted(v["firstMs"] for v in per_case.values())
    warm = sorted(v["warmMs"] for v in per_case.values())
    pct = lambda xs, p: xs[min(len(xs) - 1, -(-len(xs) * p // 100) - 1)] if xs else None
    med = lambda k: round(statistics.median(r["summary"][k] for r in ok), 1) if ok else None
    log_result({
        "kind": "bench", "runs": a.runs, "completed": len(ok), "before": pre, "after": battery(), **env_info(),
        "nCases": len(ids),
        "caseMedianFirstP50": pct(first, 50), "caseMedianFirstP95": pct(first, 95), "caseMedianFirstMax": first[-1] if first else None,
        "caseMedianWarmP50": pct(warm, 50), "caseMedianWarmP95": pct(warm, 95),
        "perRunFirstP50": med("firstP50"), "perRunFirstP95": med("firstP95"), "cancelToReadyMs": med("cancelToReadyMs"),
        "varAfterReplay": sorted({r["summary"]["varAfterReplay"] for r in ok}),
        "errors": sorted({e for r in ok for e in r["summary"]["errors"]}),
        "mismatches": sorted({e for r in ok for e in r["summary"]["mismatches"]}),
        "slowest": sorted(((v["firstMs"], i) for i, v in per_case.items()), reverse=True)[:5],
        "perCase": per_case,
    })


def cmd_page(a):
    sh(f"am force-stop {PKG}")
    time.sleep(1.5)
    logcat_clear()
    am_start_w(f'--es path "{a.path}"')
    txt = wait_for(a.wait, a.timeout) if a.wait else (time.sleep(a.timeout), logcat_dump())[1]
    print(txt)


def main():
    ap = argparse.ArgumentParser()
    sp = ap.add_subparsers(dest="cmd", required=True)
    sp.add_parser("status").set_defaults(f=cmd_status)
    s = sp.add_parser("start"); s.add_argument("--runs", type=int, default=7); s.add_argument("--mode", choices=["first", "cold", "warm"], default="cold"); s.set_defaults(f=cmd_start)
    s = sp.add_parser("bench"); s.add_argument("--runs", type=int, default=5); s.set_defaults(f=cmd_bench)
    s = sp.add_parser("page"); s.add_argument("path"); s.add_argument("--wait"); s.add_argument("--timeout", type=int, default=30); s.set_defaults(f=cmd_page)
    a = ap.parse_args()
    a.f(a)


if __name__ == "__main__":
    main()
