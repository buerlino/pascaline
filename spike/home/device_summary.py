# SPDX-License-Identifier: GPL-3.0-or-later
"""Medians over several on-device Home runs (Q3 on the tablet).

Each input file is the logcat text of one app launch with /?home=1, e.g. the stdout of
  tools/device_run.py page "/?home=1" --wait home-done --timeout 300 > run1.txt
Usage: python3 spike/home/device_summary.py run*.txt
"""
import json
import re
import statistics
import sys

runs = []
for path in sys.argv[1:]:
    cases, summary = {}, None
    for line in open(path, encoding="utf-8", errors="replace"):
        m = re.search(r"PASCALINE_HOME (case|summary) (\{.*\})", line)
        if not m:
            continue
        d = json.loads(m.group(2))
        if m.group(1) == "case":
            cases[d["id"]] = d
        else:
            summary = d
    runs.append((path, cases, summary))

complete = [r for r in runs if r[2]]
print(f"runs: {len(runs)}, complete: {len(complete)}")
for path, _, s in complete:
    print(f"  {path}: {s['pass']}/{s['n']} pass, max {s['maxMs']} ms, fails {s['fails']}")
ids = sorted({i for _, c, _ in complete for i in c})
med = {i: statistics.median(c[i]["totalMs"] for _, c, _ in complete if i in c) for i in ids}
always_ok = [i for i in ids if all(c.get(i, {}).get("ok") for _, c, _ in complete)]
xs = sorted(med.values())
pct = lambda p: xs[min(len(xs) - 1, -(-len(xs) * p // 100) - 1)]
over = [(i, med[i]) for i in ids if med[i] > 500]
print(f"Q3 device: {len(always_ok)}/{len(ids)} match in every run; per-case median p50 {pct(50)} ms, "
      f"p95 {pct(95)} ms, max {xs[-1]} ms; over 500 ms: {over or 'none'}")
print("slowest:", sorted(((v, i) for i, v in med.items()), reverse=True)[:6])
