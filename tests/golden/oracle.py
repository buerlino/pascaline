# SPDX-License-Identifier: GPL-3.0-or-later
"""Golden cases: expected values computed independently of Giac, format checks, and the G2 checklist.

Every case file here is YAML with one flow mapping per case line (D8). A case with an `oracle:`
expression is evaluated here: exact `Fraction` arithmetic where it stays rational, otherwise mpmath
at 30 digits (cross-checked at 60), rounded to 12 significant digits half away from zero and printed
in the canonical text of app/src/engine/format.ts (STD).

  python3 -m venv tests/golden/.venv && tests/golden/.venv/bin/pip install mpmath==1.3.0 pyyaml==6.0.2
  tests/golden/.venv/bin/python tests/golden/oracle.py            # check every file, exit 1 on a problem
  tests/golden/.venv/bin/python tests/golden/oracle.py --write    # fill/refresh expect for source: oracle
  tests/golden/.venv/bin/python tests/golden/oracle.py --g2       # also regenerate tests/golden/G2-CHECKLIST.md
  tests/golden/.venv/bin/python tests/golden/oracle.py home.yaml  # one file
  tests/golden/.venv/bin/python tests/golden/oracle.py --digits 30 # default digits for cases without settings.digits (12)

A case may set `settings: { digits: N }` (precision.yaml): its oracle value is then rounded and printed to N
significant digits, evaluated at N+20 and N+50 digits for the stability check. In home.yaml and precision.yaml
every case whose `expect` is a number also carries `mark:` (docs/04 section 2.4): "=" when the shown text equals the
oracle value exactly, "≈" when it is rounded; "⚠" is never derived, it is written by hand for functions whose result
the engine cannot confirm (the case then needs a `note`). A case with a mark but no `expect` is mark-only.

Sources: `oracle` (expect written here), `derived` (by hand; an oracle expression must agree),
`device` / `virtual-calc` (seen on the reference calculator; an oracle expression must agree),
`assumed` (depends on an open G2 item, `g2:` required; a differing oracle is only noted).
"""
import functools
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
CHECKLIST = HERE.parent.parent / "tests/golden/G2-CHECKLIST.md"
DIGITS = 12  # default significant digits; --digits N changes it, settings.digits overrides it per case
MARK_FILES = {"home.yaml", "precision.yaml"}
MARKS = {"=", "≈", "⚠"}
SOURCES = {"oracle", "derived", "device", "virtual-calc", "assumed"}
KEYS = ["id", "kind", "input", "latex", "eq", "var", "guess", "f", "g", "x0", "lo", "hi", "a", "b", "xs", "settings", "oracle",
        "options", "before", "code", "file", "home", "expect", "mark", "source", "g2", "status", "group", "cat", "note"]
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
              "fabs", "fsum", "findroot", "lambertw", "polyroots", "erfc", "besselj", "airyai"]:
        ns[n] = _wrap(n)
    deg = lambda x: M(x) * mp.pi / 180
    ns.update(sind=lambda x: mp.sin(deg(x)), cosd=lambda x: mp.cos(deg(x)), tand=lambda x: mp.tan(deg(x)),
              asind=lambda x: mp.asin(M(x)) * 180 / mp.pi, acosd=lambda x: mp.acos(M(x)) * 180 / mp.pi,
              atand=lambda x: mp.atan(M(x)) * 180 / mp.pi)
    ns["pi"], ns["e"], ns["inf"] = +mp.pi, +mp.e, mp.inf
    ns["diff"] = mpmath.diff
    ns["sortroots"] = sortroots
    ns["S"] = lambda label: Label(label)
    return ns


class Label(str):
    """A non-numeric entry in an expected list (e.g. the extremum kind "min"), passed through as is."""


def sortroots(roots):
    """Our order for polynomial roots (app/src/engine/solve.ts): reals ascending, then complex by real
    part, then imaginary part. A root counts as real when its imaginary part is below 1e-(dps-5)·|z|."""
    tol = mp.mpf(10) ** (-(mp.dps - 5))
    reals, cplx = [], []
    for z in roots:
        z = mp.mpmathify(z)
        if isinstance(z, mp.mpc) and abs(z.imag) > tol * abs(z):
            cplx.append(z)
        else:
            reals.append(mp.mpf(z.real) if isinstance(z, mp.mpc) else z)
    eq = mp.mpf(10) ** -20  # real parts this close count as equal (conjugate pairs), as in solve.ts

    def cmp(a, b):
        if abs(a.real - b.real) <= eq * max(1, abs(a), abs(b)):
            return -1 if a.imag < b.imag else (1 if a.imag > b.imag else 0)
        return -1 if a.real < b.real else 1

    return sorted(reals) + sorted(cplx, key=functools.cmp_to_key(cmp))


def round_decimal(d: Decimal, digits: int) -> Decimal:
    if d == 0:
        return Decimal(0)
    with localcontext() as c:
        c.prec = digits
        c.rounding = ROUND_HALF_UP  # half away from zero for Decimal
        return +d


def fmt_real(d: Decimal, digits: int) -> str:
    """Mirror of STD in app/src/engine/format.ts at `digits` significant digits."""
    if d == 0:
        return "0"
    sign, dd, exp = d.as_tuple()
    ds = "".join(map(str, dd)).rstrip("0") or "0"
    e10 = len(dd) + exp - 1  # exponent of the first digit
    s = "-" if sign else ""
    if -4 <= e10 < digits:
        if e10 < 0:
            return f"{s}0.{'0' * (-e10 - 1)}{ds}"
        if len(ds) <= e10 + 1:
            return s + ds + "0" * (e10 + 1 - len(ds))
        return f"{s}{ds[:e10 + 1]}.{ds[e10 + 1:]}"
    return f"{s}{ds[0]}{'.' + ds[1:] if len(ds) > 1 else ''}E{e10}"


def to_decimal(x) -> Decimal:
    return Decimal(mp.nstr(x, mp.dps, strip_zeros=False)) if x != 0 else Decimal(0)


def exact_fraction_round(x: Fraction, digits: int) -> Decimal:
    """Exact rounding of a rational (no double rounding)."""
    if x == 0:
        return Decimal(0)
    neg, a = x < 0, abs(x)
    e = len(str(a.numerator)) - len(str(a.denominator))
    if a < Fraction(10) ** e:
        e -= 1
    scaled = a * Fraction(10) ** (digits - 1 - e)
    m = scaled.numerator // scaled.denominator
    if 2 * (scaled - m) >= 1:
        m += 1
    # m has `digits` digits, or digits+1 after a carry (10^digits); the value is m * 10^(e-digits+1) either way.
    return Decimal((1 if neg else 0, tuple(int(c) for c in str(m)), e - digits + 1))


def display(x, digits=None):
    """STD text at `digits` (default 12); lists (systems, polynomial roots, table rows) element by element."""
    if digits is None:
        digits = DIGITS
    if isinstance(x, Label):
        return str(x)
    if isinstance(x, mp.matrix):
        return [display(x[i], digits) for i in range(x.rows)] if x.cols == 1 else [display(r, digits) for r in x.tolist()]
    if isinstance(x, (list, tuple)):
        return [display(v, digits) for v in x]
    if isinstance(x, int):
        x = Fraction(x)
    if isinstance(x, Fraction):
        return fmt_real(exact_fraction_round(x, digits), digits)
    x = mp.mpmathify(x)
    if isinstance(x, mp.mpc):
        re_, im_ = (fmt_real(round_decimal(to_decimal(x.real), digits), digits),
                    fmt_real(round_decimal(to_decimal(x.imag), digits), digits))
        if im_ == "0":
            return re_
        ims = im_.lstrip("-")
        imt = "i" if ims == "1" else f"{ims}*i"  # a unit imaginary part prints as i, not 1*i (format pass, 2026-10-11)
        if re_ == "0":
            return f"{'-' if im_.startswith('-') else ''}{imt}"
        return f"{re_}{'-' if im_.startswith('-') else '+'}{imt}"
    return fmt_real(round_decimal(to_decimal(x), digits), digits)


def raw(expr: str, dps: int):
    mp.dps = dps
    return eval(expr, namespace())  # expressions come from our own case files


def evaluate(expr: str, dps: int, digits=None):
    mp.dps = dps
    return display(eval(expr, namespace()), digits)  # expressions come from our own case files


def case_digits(case: dict) -> int:
    return int((case.get("settings") or {}).get("digits", DIGITS))


def stability_dps(digits: int):
    """Two working precisions whose rounded results must agree: 30 and 60 at 12 digits, digits+20 and +50 above."""
    return (30, 60) if digits <= 10 else (digits + 20, digits + 50)


NUM = r"\d+(?:\.\d+)?(?:E[+-]?\d+)?"
# A real part, optionally followed by a signed imaginary part; or an imaginary part alone (`32*i` is 32i, not 3+2i).
SHOWN = re.compile(rf"^(?:(?P<re>-?{NUM})(?:(?P<sign>[+-])(?P<imn>{NUM}\*)?i)?|(?P<ineg>-)?(?P<imo>{NUM}\*)?i)$")


def parse_shown(text):
    """The exact (re, im) a shown number stands for, or None when the text is not a number (lists, symbols, errors)."""
    if not isinstance(text, str) or text == "":
        return None
    m = SHOWN.match(text)
    if not m:
        return None
    if m["re"] is not None:
        re_ = Fraction(Decimal(m["re"]))
        if not m["sign"]:
            return re_, Fraction(0)
        mag = Fraction(Decimal(m["imn"][:-1])) if m["imn"] else Fraction(1)
        return re_, -mag if m["sign"] == "-" else mag
    mag = Fraction(Decimal(m["imo"][:-1])) if m["imo"] else Fraction(1)
    return Fraction(0), -mag if m["ineg"] else mag


def equals_shown(value, shown) -> bool:
    """True when the oracle value (exact Fraction, or an mpmath number at high precision) is exactly the shown number."""
    re_, im_ = shown
    if isinstance(value, int):
        value = Fraction(value)
    if isinstance(value, Fraction):
        return value == re_ and im_ == 0
    v = mp.mpmathify(value)
    parts = [(v.real, re_), (v.imag if isinstance(v, mp.mpc) else mp.mpf(0), im_)]
    # Relative to the size of the whole number, so exp(-1000) is not "equal" to a short text just because both are tiny.
    scale = max(abs(v), abs(mp.mpc(M(re_), M(im_))))
    tol = mp.mpf(10) ** (-(mp.dps - 10)) * scale
    return all(abs(a - M(b)) <= tol for a, b in parts)


def derived_mark(case: dict):
    """"=" when the oracle value is exactly the shown text, else "≈" (docs/04 section 2.4); None for non-numbers."""
    shown = parse_shown(case.get("expect"))
    if shown is None or "oracle" not in case:
        return None
    lo, hi = stability_dps(case_digits(case))
    return "=" if equals_shown(raw(case["oracle"], hi), shown) else "≈"


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


def check_mark(case: dict, write: bool) -> list:
    """The `mark:` field (docs/04 section 2.4). Numbers get "=" or "≈" from the oracle; "⚠" is written by hand."""
    mark = case.get("mark")
    if mark is not None and mark not in MARKS:
        return [f"mark {mark!r} not one of {sorted(MARKS)}"]
    if mark == "⚠":
        return [] if case.get("note") else ["mark ⚠ needs a note (why the result cannot be confirmed)"]
    if "expect" not in case:
        return [] if mark in (None, "⚠") else ["mark without expect needs ⚠ (a mark-only case has no value to derive from)"]
    want = derived_mark(case)
    if want is None:
        return [f"mark {mark!r} on a case whose expect is not a number"] if mark else []
    if mark == want:
        return []
    if write:
        case["mark"] = want
        return []
    return [f"mark {mark!r} but the oracle says {want!r}" if mark else f"numeric case without mark (oracle says {want!r})"]


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
            digits = case_digits(case)
            lo, hi = stability_dps(digits)
            v30, v60 = evaluate(case["oracle"], lo, digits), evaluate(case["oracle"], hi, digits)
            if v30 != v60:
                problems.append(f"unstable oracle: {lo} digits {v30} vs {hi} digits {v60}")
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
        if path.name in MARK_FILES:
            problems += check_mark(case, write)
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
    global DIGITS
    if "--digits" in argv:
        i = argv.index("--digits")
        DIGITS = int(argv[i + 1])
        argv = argv[:i] + argv[i + 2:]
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
