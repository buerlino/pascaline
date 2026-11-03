# SPDX-License-Identifier: GPL-3.0-or-later
# G61: the sweep's oracle. Reads a JSON list of {"mp": <python expr from gen.ts>, "deg": bool} on stdin and prints a JSON list of
#   {"kind": "value", "re": "...", "im": "..."}  at 100 digits, when 60 and 100 digits agree to 1e-45 (else 150 and 250 digits, else skip);
#     G162: an input whose exact literals hold a power 10^±k (1ᴇ-300, 10^{300}, a typed 1.000…01) starts both rungs 2k digits higher
#     (60+2k and 100+2k, then 150+2k and 250+2k): (1-cos 10^-k)·10^(2k) cancels 2k digits, and below that every rung gives the same wrong
#     value, so the agreement test would pass it. Past DPS_CAP digits the case is skipped with its reason, never judged at fewer.
#   {"kind": "novalue"}   a pole, a non-finite result
#   {"kind": "skip", "reason": "..."}   unstable, a convention (negative base to a non-integer power, 0^0), complex in DEG, too slow
# Run: tests/golden/.venv/bin/python -I tools/probes/sweep/oracle.py < requests.json   (mpmath 1.3.0)
import json, re as _re, signal, sys
from decimal import Decimal, InvalidOperation
from mpmath import mp, mpf, mpc, sqrt, exp, sinh, cosh, tanh, asinh, acosh, atanh, cbrt, sign, log, pi, e, factorial, fabs, sin, cos, tan, asin, acos, atan, isfinite


class Skip(Exception):
    pass


class Slow(Exception):
    pass


def _alarm(*_):
    raise Slow()


DEG = False


def _real_deg(x):
    if isinstance(x, mpc):
        if x.imag != 0:
            raise Skip("complex in DEG")
        return x.real
    return x


def _wrap_in(f):
    def g(x):
        if DEG:
            x = _real_deg(x) * pi / 180
        return f(x)
    return g


def _wrap_inv(f):
    def g(x):
        r = f(x)
        if DEG:
            if isinstance(x, mpc) or isinstance(r, mpc):
                raise Skip("complex in DEG")
            r = r * 180 / pi
        return r
    return g


SIN, COS, TAN = _wrap_in(sin), _wrap_in(cos), _wrap_in(tan)
ASIN, ATAN = _wrap_inv(asin), _wrap_inv(atan)
ACOS = _wrap_inv(acos)


def LN(x):
    return log(x)


def LOG10(x):
    return log(x, 10)


def ABS(x):
    return fabs(x)


def ACOSH(x):
    return acosh(x)


def ATANH(x):
    # G116: on the cut (a real |x| > 1) mpmath takes the lower side (atanh(3) = 0.35 - 1.57i); the oracle takes the textbook
    # 1/2 ln((1+x)/(1-x)) with the principal ln, which is Giac's (+1.57i). A convention, written down in the G116 report.
    if not isinstance(x, mpc) and abs(x) > 1:
        return log((1 + x) / (1 - x)) / 2
    return atanh(x)


def CBRT(x):
    # G116: the cube root key is Giac's surd(x,3), the real root of a negative real (realOddRoots); of a complex it is a convention
    if isinstance(x, mpc):
        if x.imag != 0:
            raise Skip("cube root of a complex")
        x = x.real
    return sign(x) * cbrt(fabs(x))


def DIV(a, b):
    return a / b


def FACT(n):
    return factorial(mpf(n))


def POW(a, b):
    if isinstance(b, mpc) is False and isinstance(a, mpc) is False:
        if a < 0 and b != int(b):
            raise Skip("negative base to a non-integer power")
        if a == 0 and b == 0:
            raise Skip("0^0")
        if a == 0 and b < 0:
            raise ZeroDivisionError
    return a ** b


def _cut(lo_on_cut):
    """G116: a function with a branch cut on the real axis. An argument on the cut whose imaginary part is only working-precision noise
    (at most 10^-(dps-10) of |x|) has no decidable side: cosh(ln(-1/2)) is -5/4 in exact maths, but mpmath carries an imaginary part of
    about 1E-100 whose sign then picks a side of acos. The oracle skips such an input rather than guess."""
    def wrap(f):
        def g(*a):
            x = a[0]
            if isinstance(x, mpc) and x.imag == 0:  # a signed zero (cos of a pure imaginary gives -0.0) must not pick the lower side
                x = x.real
                a = (x, *a[1:])
            if isinstance(x, mpc) and x.imag != 0 and abs(x.imag) <= abs(x) * mpf(10) ** (10 - mp.dps) and lo_on_cut(x.real):
                raise Skip("on a branch cut within the noise")
            return f(*a)
        return g
    return wrap


NS = dict(mpf=mpf, sqrt=sqrt, exp=exp, sinh=sinh, cosh=cosh, tanh=tanh, asinh=asinh, SIN=SIN, COS=COS, TAN=TAN, ASIN=ASIN, ACOS=ACOS,
          ATAN=ATAN, ACOSH=ACOSH, ATANH=ATANH, CBRT=CBRT, LN=LN, LOG10=LOG10, ABS=ABS, DIV=DIV, FACT=FACT, POW=POW)
for _k, _on in (("sqrt", lambda r: r < 0), ("LN", lambda r: r < 0), ("LOG10", lambda r: r < 0), ("POW", lambda r: r < 0),
                ("ASIN", lambda r: abs(r) > 1), ("ACOS", lambda r: abs(r) > 1), ("ATANH", lambda r: abs(r) > 1), ("ACOSH", lambda r: r < 1)):
    NS[_k] = _cut(_on)(NS[_k])


def at(expr, dps):
    mp.dps = dps
    ns = dict(NS, PI=+pi, E=+e)
    v = eval(expr, {"__builtins__": {}}, ns)
    if isinstance(v, mpc):
        re, im = v.real, v.imag
    else:
        re, im = mpf(v), mpf(0)
    if not (isfinite(re) and isfinite(im)):
        raise ZeroDivisionError
    if DEG and im != 0:
        raise Skip("complex in DEG")
    return re, im


def agree(a, b):
    scale = max(abs(a[0]), abs(a[1]), abs(b[0]), abs(b[1]))
    if scale == 0:
        return True
    tol = scale * mpf(10) ** -45
    return abs(a[0] - b[0]) <= tol and abs(a[1] - b[1]) <= tol


# G162: the highest rung (250+2k) a case may need; k up to 1000 (the edge generator's 1ᴇ±1000) stays under the 3 s limit per case
DPS_CAP = 2250
_POW10 = _re.compile(r"POW\(mpf\('10'\),mpf\('(-?\d+)'\)\)")
_LIT = _re.compile(r"mpf\('([^']*)'\)")


def tens(expr):
    """G162: the largest k such that an exact literal of the input holds 10^±k: 10^{k} typed as a power, the exponent of 1ᴇ-k, or the
    first and last digit of a typed decimal (1.000…01 holds 10^-k, 100…001 holds 10^k)."""
    k = 0
    for m in _POW10.finditer(expr):
        k = max(k, abs(int(m.group(1))))
    for m in _LIT.finditer(expr):
        try:
            t = Decimal(m.group(1)).as_tuple()
        except InvalidOperation:
            continue
        if not isinstance(t.exponent, int):
            continue
        k = max(k, abs(t.exponent), abs(t.exponent + len(t.digits) - 1))
    return k


def one(expr):
    up = 2 * tens(expr)
    if 250 + up > DPS_CAP:
        return {"kind": "skip", "reason": f"needs {250 + up} digits (10^±{up // 2}), past the oracle's cap of {DPS_CAP}"}
    for lo, hi in ((60 + up, 100 + up), (150 + up, 250 + up)):
        a = at(expr, lo)
        b = at(expr, hi)
        if agree(a, b):
            mp.dps = hi
            return {"kind": "value", "re": mp.nstr(b[0], 100), "im": mp.nstr(b[1], 100)}
    return {"kind": "skip", "reason": f"unstable at {60 + up}/{100 + up} and {150 + up}/{250 + up} digits"}


def main():
    global DEG
    out = []
    signal.signal(signal.SIGALRM, _alarm)
    for q in json.load(sys.stdin):
        DEG = bool(q.get("deg"))
        signal.setitimer(signal.ITIMER_REAL, 3.0)
        try:
            out.append(one(q["mp"]))
        except Skip as s:
            out.append({"kind": "skip", "reason": str(s)})
        except (ZeroDivisionError, ValueError):
            out.append({"kind": "novalue"})
        except Slow:
            out.append({"kind": "skip", "reason": "oracle too slow (3 s)"})
        except (OverflowError, MemoryError):
            out.append({"kind": "skip", "reason": "oracle overflow"})
        except Exception as x:  # G116: an edge input mpmath cannot take (NoConvergence, …) is a skip, never the end of the run
            out.append({"kind": "skip", "reason": f"oracle error: {type(x).__name__}"})
        finally:
            signal.setitimer(signal.ITIMER_REAL, 0)
    json.dump(out, sys.stdout)


main()
