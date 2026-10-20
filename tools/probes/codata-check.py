# SPDX-License-Identifier: GPL-3.0-or-later
# libqalculate #1045: its derived physical constants against CODATA 2022 (`oracle`, mpmath at 50 digits).
# Each constant is computed from libqalculate's own formula and inputs (variables.xml) with first-order propagation of
# independent uncertainties, then value and uncertainty are rounded to the nearest digit as CODATA prints them (two
# significant digits of uncertainty). On 5.13.1 this reproduces qalc's propagated uncertainties to four digits
# (lambda_C 7.5144E-22, quantum_circulation 1.1264E-13). Compare values, never qalc's ± display: it widens the
# uncertainty (neutron_mass prints 8.5E-37 for 8.433E-37).
#   tests/golden/.venv/bin/python -I tools/probes/codata-check.py ALLASCII            5.13.1, master and CODATA side by side
#   tests/golden/.venv/bin/python -I tools/probes/codata-check.py ALLASCII --window   the u(alpha) that fixes each alpha-linked constant
#   tests/golden/.venv/bin/python -I tools/probes/codata-check.py ALLASCII --final    how many of 22 match at candidate uncertainties
# ALLASCII is NIST's CODATA 2022 table, https://physics.nist.gov/cuu/Constants/Table/allascii.txt (download it once,
# e.g. to tools/probes/_out/allascii.txt; this probe uses no network).
import sys

import mpmath as M

M.mp.dps = 50
mpf = M.mpf
h = mpf("6.62607015e-34")
c = mpf(299792458)
e = mpf("1.602176634e-19")
pi = M.pi

# libqalculate's inputs (value, uncertainty): a = alpha, R = Rydberg constant, A* = relative atomic masses.
# 5.13.1: data/variables.xml.in of the pinned tarball; master: the same file at 92ecde7 (2026-10-19).
V5131 = dict(a=("7.29735256434e-3", "1.13e-12"), R=("10973731.5681569", "0.000012"), Ae=("5.485799090441e-4", "9.7e-15"),
             Amu=("0.1134289257", "2.5e-9"), Atau=("1.90754", "1.3e-4"), Ap=("1.0072764665789", "8.3e-12"),
             An=("1.00866491606", "4.0e-10"))
MASTER = dict(V5131)
MASTER.update(a=("7.29735256434e-3", "1.1322e-12"), R=("10973731.56815693", "0.000012"),
              Amu=("0.113428925701", "2.502e-9"), Atau=("1.9075375", "1.29e-4"))


def defs():
    """Each constant as (k, {input: power}): value = k * prod(input ** power), keyed by its CODATA name."""
    hb = h / (2 * pi)
    me = (2 * h / c, {"R": 1, "a": -2})
    mu = (2 * h / c, {"R": 1, "a": -2, "Ae": -1})

    def m(x):
        return (mu[0], {**mu[1], x: 1})

    def inv(t, k):
        return (k / t[0], {q: -p for q, p in t[1].items()})

    return {
        "Compton wavelength": inv(me, h / c),
        "reduced Compton wavelength": inv(me, hb / c),
        "muon Compton wavelength": inv(m("Amu"), h / c),
        "reduced muon Compton wavelength": inv(m("Amu"), hb / c),
        "tau Compton wavelength": inv(m("Atau"), h / c),
        "reduced tau Compton wavelength": inv(m("Atau"), hb / c),
        "proton Compton wavelength": inv(m("Ap"), h / c),
        "reduced proton Compton wavelength": inv(m("Ap"), hb / c),
        "neutron Compton wavelength": inv(m("An"), h / c),
        "Hartree energy": (2 * h * c, {"R": 1}),
        "characteristic impedance of vacuum": (2 * h / e**2, {"a": 1}),
        "vacuum mag. permeability": (2 * h / (c * e**2), {"a": 1}),
        "tau mass": m("Atau"),
        "muon mass": m("Amu"),
        "neutron mass": m("An"),
        "proton mass": m("Ap"),
        "electron mass": me,
        "atomic mass constant": mu,
        "quantum of circulation": inv(me, h / 2),
        "classical electron radius": (1 / (4 * pi), {"a": 3, "R": -1}),
        "Thomson cross section": ((8 * pi / 3) / (4 * pi) ** 2, {"a": 6, "R": -2}),
        "Bohr radius": (1 / (4 * pi), {"a": 1, "R": -1}),
    }


def ev(inp, k, pw):
    """Value and first-order standard uncertainty of k * prod(x ** p), inputs independent."""
    v, var = k, mpf(0)
    for q, p in pw.items():
        x, u = mpf(inp[q][0]), mpf(inp[q][1])
        v *= x**p
        var += (p * u / x) ** 2
    return v, abs(v) * M.sqrt(var)


def codata(path):
    """NIST allascii.txt: name -> (value, uncertainty); exact constants are skipped."""
    out = {}
    for line in open(path, encoding="utf-8"):
        if len(line) < 110 or line.startswith(("Quantity", "-")):
            continue
        name = line[:60].strip()
        val = line[60:85].replace(" ", "").replace("...", "")
        unc = line[85:110].replace(" ", "")
        try:
            out[name] = (mpf(val), mpf(unc))
        except ValueError:
            pass
    return out


def fmt(v, u):
    """CODATA style: the uncertainty to two significant digits, the value to the same place."""
    eu = int(M.floor(M.log10(u))) - 1
    return int(M.nint(v / mpf(10) ** eu)), int(M.nint(u / mpf(10) ** eu)), eu


def show(f):
    return f"{f[0]}({f[1]})e{f[2]}"


def table(cod):
    print(f"{'constant':36} {'5.13.1':>26} {'master':>26} {'CODATA 2022':>26}  5.13.1 / master")
    for n, (k, pw) in defs().items():
        C = cod[n]
        ce = fmt(*C)
        r = []
        for inp in (V5131, MASTER):
            v, u = ev(inp, k, pw)
            f = fmt(v, u)
            r.append((f, f == ce, u / C[1]))
        print(f"{n:36} {show(r[0][0]):>26} {show(r[1][0]):>26} {show(ce):>26}  "
              f"{'ok' if r[0][1] else 'DIFF'} / {'ok' if r[1][1] else 'DIFF'}   "
              f"u/u_C {float(r[0][2]):.4f} {float(r[1][2]):.4f}")


def window(cod):
    """For each alpha-linked constant on master's inputs: the u(alpha) range that gives CODATA's printed uncertainty."""
    rows = []
    lo_all, hi_all = mpf("1.05e-12"), mpf("1.25e-12")
    for n, (k, pw) in defs().items():
        if "a" not in pw:
            continue
        ce = fmt(*cod[n])
        eu = ce[2]

        def unc(ua):
            inp = dict(MASTER)
            inp["a"] = (MASTER["a"][0], ua)
            return ev(inp, k, pw)

        v, _ = unc(MASTER["a"][1])
        vok = int(M.nint(v / mpf(10) ** eu)) == ce[0]

        def solve(t):
            # the propagated uncertainty grows with u(alpha): bisect for the u(alpha) where it reaches t
            a, b = mpf("1e-14"), mpf("1e-10")
            if unc(a)[1] > t:
                return a
            for _ in range(200):
                mid = (a + b) / 2
                if unc(mid)[1] > t:
                    b = mid
                else:
                    a = mid
            return a

        lo = solve((ce[1] - mpf("0.5")) * mpf(10) ** eu)
        hi = solve((ce[1] + mpf("0.5")) * mpf(10) ** eu)
        rows.append((n, lo, hi, vok))
        lo_all, hi_all = max(lo_all, lo), min(hi_all, hi)
    for n, lo, hi, vok in sorted(rows, key=lambda r: r[2]):
        print(f"{n:36} u(alpha) in [{float(lo):.5e}, {float(hi):.5e}]   value digits {'ok' if vok else 'DIFF'}")
    print("intersection:", float(lo_all), float(hi_all), "empty" if lo_all > hi_all else "non-empty")


def final(cod):
    D = defs()

    def check(inp, label):
        bad = []
        for n, (k, pw) in D.items():
            ce = fmt(*cod[n])
            f = fmt(*ev(inp, k, pw))
            if f != ce:
                bad.append(f"{n}: {f[0]}({f[1]}) vs CODATA {ce[0]}({ce[1]})")
        print(label, "->", len(D) - len(bad), "of", len(D), "match;", bad if bad else "all match")

    check(V5131, "5.13.1")
    check(MASTER, "master 92ecde7")
    t = dict(MASTER)
    t["a"] = (MASTER["a"][0], "1.137e-12")
    check(t, "master, u(alpha)=1.137e-12")
    for ua in ["2.502e-9", "2.51e-9", "2.52e-9", "2.53e-9", "2.54e-9", "2.55e-9", "2.56e-9"]:
        t2 = dict(t)
        t2["Amu"] = (MASTER["Amu"][0], ua)
        check(t2, f"  + u(A_mu)={ua}")


if __name__ == "__main__":
    if len(sys.argv) < 2 or sys.argv[1].startswith("-"):
        sys.exit(__doc__ or "usage: codata-check.py ALLASCII [--window|--final]  (see the header)")
    cod = codata(sys.argv[1])
    mode = sys.argv[2] if len(sys.argv) > 2 else ""
    {"--window": window, "--final": final}.get(mode, table)(cod)
