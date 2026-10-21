# SPDX-License-Identifier: GPL-3.0-or-later
# G61: the sweep's oracle. Reads a JSON list of {"mp": <python expr from gen.ts>, "deg": bool} on stdin and prints a JSON list of
#   {"kind": "value", "re": "...", "im": "..."}  at 100 digits, when 60 and 100 digits agree to 1e-45 (else 150 and 250 digits, else skip)
#   {"kind": "novalue"}   a pole, a non-finite result
#   {"kind": "skip", "reason": "..."}   unstable, a convention (negative base to a non-integer power, 0^0), complex in DEG, too slow
# Run: tests/golden/.venv/bin/python -I tools/probes/sweep/oracle.py < requests.json   (mpmath 1.3.0)
import json, signal, sys
from mpmath import mp, mpf, mpc, sqrt, exp, sinh, cosh, tanh, asinh, log, pi, e, factorial, fabs, sin, cos, tan, asin, acos, atan, isfinite


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


NS = dict(mpf=mpf, sqrt=sqrt, exp=exp, sinh=sinh, cosh=cosh, tanh=tanh, asinh=asinh, SIN=SIN, COS=COS, TAN=TAN, ASIN=ASIN, ACOS=ACOS,
          ATAN=ATAN, LN=LN, LOG10=LOG10, ABS=ABS, DIV=DIV, FACT=FACT, POW=POW)


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


def one(expr):
    for lo, hi in ((60, 100), (150, 250)):
        a = at(expr, lo)
        b = at(expr, hi)
        if agree(a, b):
            mp.dps = hi
            return {"kind": "value", "re": mp.nstr(b[0], 100), "im": mp.nstr(b[1], 100)}
    return {"kind": "skip", "reason": "unstable at 60/100 and 150/250 digits"}


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
        finally:
            signal.setitimer(signal.ITIMER_REAL, 0)
    json.dump(out, sys.stdout)


main()
