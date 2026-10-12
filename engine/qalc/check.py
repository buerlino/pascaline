# SPDX-License-Identifier: GPL-3.0-or-later
"""Run engine/qalc/cases.yaml through the libqalculate wasm and check it with mpmath.

    tests/golden/.venv/bin/python engine/qalc/check.py <out dir with qalc.mjs>
"""
import json
import re
import subprocess
import sys
from pathlib import Path

import yaml
from mpmath import mp, mpf, pi, sqrt  # noqa: F401  (used by the case expressions)

mp.dps = 40
HERE = Path(__file__).resolve().parent
NUM = r"[-+]?\d+(?:\.\d+)?(?:e[-+]?\d+)?"


def half_ulp(text: str) -> mpf:
    """Half a unit in the last printed digit of a decimal like 1.23e-4."""
    mant, _, exp = text.partition("e")
    decimals = len(mant.split(".")[1]) if "." in mant else 0
    return mpf(10) ** (int(exp or 0) - decimals) / 2


def ok_number(printed: str, true: mpf) -> bool:
    return abs(mpf(printed) - true) <= half_ulp(printed) * (1 + mpf("1e-30"))


def main() -> int:
    out = sys.argv[1]
    cases = yaml.safe_load((HERE / "cases.yaml").read_text())["cases"]
    res = subprocess.run(["node", str(HERE / "run-cases.mjs"), out, *[c["expr"] for c in cases]],
                         check=True, capture_output=True, text=True, timeout=120)
    got = json.loads(res.stdout)
    passed = 0
    for c, g in zip(cases, got):
        m = re.fullmatch(rf"({NUM})(?:\s*(?:±|\+/-)\s*({NUM}))?\s*(.*)", g.replace("−", "-"))
        why = ""
        if not m:
            why = "unparsed"
        else:
            val, unc, unit = m.groups()
            if unit != c["unit"]:
                why = f"unit {unit!r} != {c['unit']!r}"
            elif not ok_number(val, eval(c["value"])):
                why = f"value off: true {mp.nstr(eval(c['value']), 15)}"
            elif "unc" in c and (unc is None or not ok_number(unc, eval(c["unc"]))):
                why = f"uncertainty off: true {mp.nstr(eval(c['unc']), 6)}"
        passed += not why
        print(f"{'PASS' if not why else 'FAIL'} {c['id']} {c['expr']!r} -> {g!r} {why}")
    print(f"{passed}/{len(cases)} pass")
    return 0 if passed == len(cases) else 1


if __name__ == "__main__":
    sys.exit(main())
