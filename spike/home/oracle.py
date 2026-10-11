# SPDX-License-Identifier: GPL-3.0-or-later
"""Expected values for spike/home/cases.yaml, computed independently of Giac.

Each case is one YAML flow mapping per line. A case with an `oracle:` expression is evaluated here:
exact `Fraction` arithmetic where the expression stays rational, otherwise mpmath at 30 digits
(cross-checked at 60), then rounded to 12 significant digits, half away from zero, and printed in
the canonical format of spike/app/src/home/homeEval.ts (formatDecimal).

  spike/.venv/bin/python spike/home/oracle.py           # check: print cases whose expect differs
  spike/.venv/bin/python spike/home/oracle.py --write   # fill/refresh expect for source: oracle
  spike/.venv/bin/python spike/home/oracle.py spike/solve/cases.yaml [--write]   # another case file

`source: derived` cases keep their hand-written expect; an oracle expression on them is a cross-check.
"""
import json
import math
import re
import sys
from decimal import ROUND_HALF_UP, Decimal, localcontext
from fractions import Fraction
from pathlib import Path

import mpmath
import yaml
from mpmath import mp

CASES = Path(__file__).with_name("cases.yaml")
DIGITS = 12
KEYS = ["id", "angle", "input", "eq", "var", "guess", "oracle", "expect", "source", "note"]


def F(a, b=1):
    """Exact rational: F('0.1') == 1/10, F(1, 3) == 1/3."""
    return Fraction(a) / Fraction(b)


def M(x):
    """To mpmath (complex stays complex)."""
    if isinstance(x, Fraction):
        return mp.mpf(x.numerator) / x.denominator
    return x


def _wrap(name):
    f = getattr(mpmath, name)
    return lambda *a: f(*[M(x) for x in a])


def namespace():
    ns = {"F": F, "M": M, "factorial": math.factorial, "mp": mp, "mpf": mp.mpf, "mpc": mp.mpc, "I": mp.mpc(0, 1)}
    for n in ["sin", "cos", "tan", "asin", "acos", "atan", "sinh", "cosh", "tanh", "asinh", "acosh",
              "atanh", "exp", "ln", "log10", "sqrt", "cbrt", "gamma", "erf", "power", "nsum", "quad",
              "fabs", "fsum", "findroot", "lambertw", "polyroots", "e", "pi", "inf"]:
        ns[n] = _wrap(n) if callable(getattr(mpmath, n)) and n not in ("e", "pi", "inf") else getattr(mp, n)
    deg = lambda x: M(x) * mp.pi / 180
    ns.update(sind=lambda x: mp.sin(deg(x)), cosd=lambda x: mp.cos(deg(x)), tand=lambda x: mp.tan(deg(x)),
              asind=lambda x: mp.asin(M(x)) * 180 / mp.pi, acosd=lambda x: mp.acos(M(x)) * 180 / mp.pi,
              atand=lambda x: mp.atan(M(x)) * 180 / mp.pi)
    ns["pi"], ns["e"] = +mp.pi, +mp.e
    return ns


def round_decimal(d: Decimal) -> Decimal:
    if d == 0:
        return Decimal(0)
    with localcontext() as c:
        c.prec = DIGITS
        c.rounding = ROUND_HALF_UP  # half away from zero for Decimal
        return +d


def fmt_real(d: Decimal) -> str:
    """Mirror of formatDecimal in homeEval.ts."""
    if d == 0:
        return "0"
    sign, digits, exp = d.as_tuple()
    ds = "".join(map(str, digits)).rstrip("0") or "0"
    e10 = len(digits) + exp - 1  # exponent of the first digit
    s = "-" if sign else ""
    if -4 <= e10 < 12:
        if e10 < 0:
            return f"{s}0.{'0' * (-e10 - 1)}{ds}"
        if len(ds) <= e10 + 1:
            return s + ds + "0" * (e10 + 1 - len(ds))
        return f"{s}{ds[:e10 + 1]}.{ds[e10 + 1:]}"
    return f"{s}{ds[0]}{'.' + ds[1:] if len(ds) > 1 else ''}E{e10}"


def to_decimal(x) -> Decimal:
    if isinstance(x, Fraction):
        with localcontext() as c:
            c.prec = 80
            return Decimal(x.numerator) / Decimal(x.denominator)
    return Decimal(mp.nstr(x, mp.dps, strip_zeros=False)) if x != 0 else Decimal(0)


def exact_fraction_round(x: Fraction) -> Decimal:
    """Exact rounding of a rational (no double rounding)."""
    if x == 0:
        return Decimal(0)
    neg, a = x < 0, abs(x)
    e = len(str(a.numerator)) - len(str(a.denominator))
    if a < Fraction(10) ** e:
        e -= 1
    scaled = a * Fraction(10) ** (DIGITS - 1 - e)
    m = scaled.numerator // scaled.denominator
    if 2 * (scaled - m) >= 1:
        m += 1
    # m has DIGITS digits, or DIGITS+1 after a carry (10^DIGITS); the value is m * 10^(e-DIGITS+1) either way.
    return Decimal((1 if neg else 0, tuple(int(c) for c in str(m)), e - DIGITS + 1))


def display(x) -> str:
    if isinstance(x, int):
        x = Fraction(x)
    if isinstance(x, Fraction):
        return fmt_real(exact_fraction_round(x))
    x = mp.mpmathify(x)
    if isinstance(x, mp.mpc):
        re_, im_ = fmt_real(round_decimal(to_decimal(x.real))), fmt_real(round_decimal(to_decimal(x.imag)))
        if im_ == "0":
            return re_
        ims = im_.lstrip("-")
        if re_ == "0":
            return f"{'-' if im_.startswith('-') else ''}{ims}*i"
        return f"{re_}{'-' if im_.startswith('-') else '+'}{ims}*i"
    return fmt_real(round_decimal(to_decimal(x)))


def evaluate(expr: str, dps: int) -> str:
    mp.dps = dps
    return display(eval(expr, namespace()))  # expressions come from our own cases.yaml


def emit(case: dict) -> str:
    parts = []
    for k in KEYS:
        if k in case:
            parts.append(f"{k}: {json.dumps(case[k], ensure_ascii=False)}")
    return "  - { " + ", ".join(parts) + " }"


def main(write: bool) -> int:
    cases_path = next((Path(a) for a in sys.argv[1:] if not a.startswith("--")), CASES)
    lines = cases_path.read_text().splitlines()
    bad = 0
    out = []
    for line in lines:
        m = re.match(r"^\s*- (\{.*\})\s*$", line)
        if not m:
            out.append(line)
            continue
        case = yaml.safe_load(m.group(1))
        if "oracle" in case:
            v30, v60 = evaluate(case["oracle"], 30), evaluate(case["oracle"], 60)
            if v30 != v60:
                print(f"UNSTABLE {case['id']}: 30 digits {v30} vs 60 digits {v60}")
                bad += 1
            if case["source"] == "oracle":
                if case.get("expect") != v30:
                    if not write:
                        print(f"DIFF {case['id']}: expect {case.get('expect')!r} oracle {v30!r}")
                        bad += 1
                    case["expect"] = v30
            elif case.get("expect") != v30:
                print(f"CROSS-CHECK {case['id']} ({case['source']}): expect {case.get('expect')!r} oracle {v30!r}")
                bad += 1
        # --write normalises every case line (all values quoted, fixed key order): run.ts relies on it.
        out.append(emit(case) if write else line)
    if write:
        cases_path.write_text("\n".join(out) + "\n")
    print(f"{'written' if write else 'checked'}; problems: {bad}")
    return 1 if bad and not write else 0


if __name__ == "__main__":
    sys.exit(main("--write" in sys.argv))
