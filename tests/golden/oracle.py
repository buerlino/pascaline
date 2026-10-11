# SPDX-License-Identifier: GPL-3.0-or-later
"""Golden cases: expected values computed independently of Giac, format checks, and the G2 checklist.

Every case file here is YAML with one flow mapping per case line (D8). A case with an `oracle:`
expression is evaluated here: exact `Fraction` arithmetic where it stays rational, otherwise mpmath
at 30 digits (cross-checked at 60), rounded to 12 significant digits half away from zero and printed
in the canonical text of app/src/engine/format.ts (STD).

  python3 -m venv tests/golden/.venv && tests/golden/.venv/bin/pip install mpmath==1.3.0 pyyaml==6.0.2
  tests/golden/.venv/bin/python tests/golden/oracle.py            # check every file, exit 1 on a problem
  tests/golden/.venv/bin/python tests/golden/oracle.py --write    # fill/refresh expect for source: oracle
  tests/golden/.venv/bin/python tests/golden/oracle.py --g2       # also regenerate spike/G2-CHECKLIST.md
  tests/golden/.venv/bin/python tests/golden/oracle.py home.yaml  # one file

Sources: `oracle` (expect written here), `derived` (by hand; an oracle expression must agree),
`device` / `virtual-calc` (seen on the reference calculator; an oracle expression must agree),
`assumed` (depends on an open G2 item, `g2:` required; a differing oracle is only noted).
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

HERE = Path(__file__).resolve().parent
CHECKLIST = HERE.parent.parent / "spike/G2-CHECKLIST.md"
DIGITS = 12
SOURCES = {"oracle", "derived", "device", "virtual-calc", "assumed"}
KEYS = ["id", "input", "latex", "eq", "var", "guess", "settings", "oracle", "expect", "source", "g2", "status", "group", "cat", "note"]
CASE_LINE = re.compile(r"^\s*- (\{.*\})\s*$")


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
              "fabs", "fsum", "findroot", "lambertw", "polyroots"]:
        ns[n] = _wrap(n)
    deg = lambda x: M(x) * mp.pi / 180
    ns.update(sind=lambda x: mp.sin(deg(x)), cosd=lambda x: mp.cos(deg(x)), tand=lambda x: mp.tan(deg(x)),
              asind=lambda x: mp.asin(M(x)) * 180 / mp.pi, acosd=lambda x: mp.acos(M(x)) * 180 / mp.pi,
              atand=lambda x: mp.atan(M(x)) * 180 / mp.pi)
    ns["pi"], ns["e"], ns["inf"] = +mp.pi, +mp.e, mp.inf
    return ns


def round_decimal(d: Decimal) -> Decimal:
    if d == 0:
        return Decimal(0)
    with localcontext() as c:
        c.prec = DIGITS
        c.rounding = ROUND_HALF_UP  # half away from zero for Decimal
        return +d


def fmt_real(d: Decimal) -> str:
    """Mirror of STD in app/src/engine/format.ts at 12 digits."""
    if d == 0:
        return "0"
    sign, digits, exp = d.as_tuple()
    ds = "".join(map(str, digits)).rstrip("0") or "0"
    e10 = len(digits) + exp - 1  # exponent of the first digit
    s = "-" if sign else ""
    if -4 <= e10 < DIGITS:
        if e10 < 0:
            return f"{s}0.{'0' * (-e10 - 1)}{ds}"
        if len(ds) <= e10 + 1:
            return s + ds + "0" * (e10 + 1 - len(ds))
        return f"{s}{ds[:e10 + 1]}.{ds[e10 + 1:]}"
    return f"{s}{ds[0]}{'.' + ds[1:] if len(ds) > 1 else ''}E{e10}"


def to_decimal(x) -> Decimal:
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
    return display(eval(expr, namespace()))  # expressions come from our own case files


def emit_value(v) -> str:
    if isinstance(v, dict):
        return "{ " + ", ".join(f"{k}: {emit_value(x)}" for k, x in v.items()) + " }"
    if isinstance(v, int) and not isinstance(v, bool):
        return str(v)
    return json.dumps(v, ensure_ascii=False)


def emit(case: dict) -> str:
    unknown = [k for k in case if k not in KEYS]
    if unknown:
        raise ValueError(f"{case.get('id')}: unknown keys {unknown}")
    return "  - { " + ", ".join(f"{k}: {emit_value(case[k])}" for k in KEYS if k in case) + " }"


def case_files(args):
    named = [a for a in args if not a.startswith("--")]
    if named:
        return [p if p.is_absolute() else (HERE / p if (HERE / p).exists() else Path(p).resolve()) for p in map(Path, named)]
    return sorted(p for p in HERE.glob("*.yaml") if p.name != "g2.yaml")


def load_cases(path: Path):
    return [yaml.safe_load(m.group(1)) for m in map(CASE_LINE.match, path.read_text().splitlines()) if m]


def check_file(path: Path, write: bool, g2_items: set) -> int:
    lines = path.read_text().splitlines()
    bad = 0
    seen = set()
    out = []
    for line in lines:
        m = CASE_LINE.match(line)
        if not m:
            out.append(line)
            continue
        case = yaml.safe_load(m.group(1))
        cid = case.get("id")
        problems = []
        if cid in seen:
            problems.append("duplicate id")
        seen.add(cid)
        src = case.get("source")
        if src is None and "expect" not in case:
            pass  # a run-only case (benchmark timing set)
        elif src not in SOURCES:
            problems.append(f"source {src!r} not one of {sorted(SOURCES)}")
        if src == "oracle" and "oracle" not in case:
            problems.append("source oracle without an oracle expression")
        if src == "assumed" and "g2" not in case:
            problems.append("source assumed without a g2 item")
        if "g2" in case and case["g2"] not in g2_items:
            problems.append(f"g2 item {case['g2']} does not exist")
        if "oracle" in case:
            v30, v60 = evaluate(case["oracle"], 30), evaluate(case["oracle"], 60)
            if v30 != v60:
                problems.append(f"unstable oracle: 30 digits {v30} vs 60 digits {v60}")
            if src == "oracle":
                if case.get("expect") != v30:
                    if write:
                        case["expect"] = v30
                    else:
                        problems.append(f"expect {case.get('expect')!r} but oracle {v30!r}")
            elif case.get("expect") != v30:
                if src == "assumed":
                    print(f"NOTE {path.name} {cid} (assumed, G2 item {case.get('g2')}): expect {case.get('expect')!r}, oracle {v30!r}")
                else:
                    problems.append(f"cross-check ({src}): expect {case.get('expect')!r} but oracle {v30!r}")
        for p in problems:
            print(f"PROBLEM {path.name} {cid}: {p}")
        bad += len(problems)
        # --write normalises every case line (fixed key order, quoted strings).
        out.append(emit(case) if write else line)
    if write:
        path.write_text("\n".join(out) + "\n")
    return bad


def cell(s: str) -> str:
    return str(s).replace("|", "\\|").replace("\n", " ")


def write_checklist(items, files) -> None:
    links = {}
    for path in files:
        for c in load_cases(path):
            if "g2" in c:
                links.setdefault(c["g2"], []).append(f"`{path.stem}/{c['id']}`" + (" (assumed)" if c.get("source") == "assumed" else ""))
    out = [
        "<!-- SPDX-License-Identifier: GPL-3.0-or-later -->",
        "<!-- Generated by tests/golden/oracle.py --g2 from tests/golden/g2.yaml. Edit g2.yaml, not this file. -->",
        "# G2 checklist (for the user, by hand)",
        "Questions only a real HP Prime G2 (firmware 2.4 rev 15515) or the official Virtual Calculator can answer. "
        "The G2 is never connected to the laptop. Until a question is answered, anything that depends on it is "
        "`source: assumed`. Write the answer and the date next to each item (firmware version once, the first time); "
        "the answer then becomes `source: device` (or `virtual-calc`). The last column lists the golden cases that "
        "depend on each item (tests/golden/).",
        "",
        "| # | Area | Question | Why we ask | Asked by | Answer | Cases |",
        "|---|---|---|---|---|---|---|",
    ]
    for it in items:
        out.append("| " + " | ".join([str(it["n"]), cell(it["area"]), cell(it["question"]), cell(it["why"]),
                                       cell(it["asked_by"]), cell(it.get("answer", "")),
                                       ", ".join(links.get(it["n"], []))]) + " |")
    CHECKLIST.write_text("\n".join(out) + "\n")
    print(f"wrote {CHECKLIST}")


def main(argv) -> int:
    write = "--write" in argv
    items = yaml.safe_load((HERE / "g2.yaml").read_text())["items"]
    numbers = [it["n"] for it in items]
    bad = 0
    if len(set(numbers)) != len(numbers):
        print("PROBLEM g2.yaml: duplicate item numbers")
        bad += 1
    for it in items:
        if it.get("answer") and it.get("source") not in ("device", "virtual-calc"):
            print(f"PROBLEM g2.yaml item {it['n']}: answered but source is {it.get('source')!r}")
            bad += 1
    files = case_files(argv)
    for path in files:
        bad += check_file(path, write, set(numbers))
    if "--g2" in argv:
        write_checklist(items, sorted(p for p in HERE.glob("*.yaml") if p.name != "g2.yaml"))
    print(f"{'written' if write else 'checked'} {len(files)} file(s); problems: {bad}")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
