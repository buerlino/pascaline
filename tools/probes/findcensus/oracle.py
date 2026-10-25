# SPDX-License-Identifier: GPL-3.0-or-later
# G110: the census's oracle. Reads a JSON list of {"name": <Find entry>, "args": [<python expr over N, pi, e, mpc, sqrt, log, ...>]}
# on stdin and prints a JSON list, one per request, in the sweep oracle's shape (tools/probes/sweep/oracle.py):
#   {"kind": "value", "re": "...", "im": "..."}  at 100 digits, when 60 and 100 digits agree to 1e-45
#   {"kind": "novalue"}                           a pole, a domain error, a non-finite result
#   {"kind": "skip", "reason": "..."}             no oracle for this function, these argument kinds (a list), or unstable
# Each function follows the definition in Giac's help line (doc/aide_cas, the English line), written here with mpmath (1.3.0):
# no value is copied from Giac. Integer functions are computed with Python integers.
# Run: tests/golden/.venv/bin/python -I tools/probes/findcensus/oracle.py < requests.json
import json, signal, sys
from mpmath import mp, mpf, mpc, sqrt, exp, log, pi, e, factorial, isfinite, isint
import mpmath as M


class Skip(Exception):
    pass


class Slow(Exception):
    pass


def _alarm(*_):
    raise Slow()


def N(s):
    return mpf(s)


def real(x):
    if isinstance(x, list):
        raise Skip("a list argument")
    if isinstance(x, mpc):
        if x.imag != 0:
            raise Skip("a complex argument")
        return x.real
    return mpf(x)


def integer(x):
    x = real(x)
    if not isint(x):
        raise Skip("a non-integer where the definition takes an integer")
    return int(x)


def is_prime(n):
    if n < 2:
        return False
    small = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71]
    for p in small:
        if n % p == 0:
            return n == p
    d, s = n - 1, 0
    while d % 2 == 0:
        d //= 2
        s += 1
    for a in small:  # Miller-Rabin with the first 20 primes as bases
        x = pow(a, d, n)
        if x in (1, n - 1):
            continue
        for _ in range(s - 1):
            x = x * x % n
            if x == n - 1:
                break
        else:
            return False
    return True


def nextprime(x):
    n = integer(x) + 1
    while not is_prime(n):
        n += 1
    return n


def prevprime(x):
    n = integer(x) - 1
    if n < 2:
        raise ValueError
    while not is_prime(n):
        n -= 1
    return n


def euler_phi(x):
    n = integer(x)
    if n < 1:
        raise ValueError
    r, m, p = n, n, 2
    while p * p <= m:
        if m % p == 0:
            while m % p == 0:
                m //= p
            r -= r // p
        p += 1
    if m > 1:
        r -= r // m
    return r


def perm(n, k):
    n, k = integer(n), integer(k)
    if k < 0 or n < k:
        raise ValueError
    return factorial(n) / factorial(n - k)


def comb(n, k):
    n, k = integer(n), integer(k)
    if k < 0 or n < k:
        raise ValueError
    return M.binomial(n, k)


def gammainc_lower(a, x):
    return M.gammainc(real(a), 0, real(x))


def _normal_icdf(*a):
    mu, s, p = (mpf(0), mpf(1), real(a[0])) if len(a) == 1 else (real(a[0]), real(a[1]), real(a[2]))
    if not (0 < p < 1):
        raise ValueError
    return mu + s * sqrt(2) * M.erfinv(2 * p - 1)


def _normald(*a):
    mu, s, x = (mpf(0), mpf(1), real(a[0])) if len(a) == 1 else (real(a[0]), real(a[1]), real(a[2]))
    return M.npdf(x, mu, s)


def _student_cdf(n, x):
    n, x = real(n), real(x)
    # P(T <= x) = 1 - I_{n/(n+x^2)}(n/2, 1/2)/2 for x >= 0
    t = M.betainc(n / 2, mpf(1) / 2, 0, n / (n + x * x), regularized=True) / 2
    return 1 - t if x >= 0 else t


def _student(n, x):
    n, x = real(n), real(x)
    return M.gamma((n + 1) / 2) / (sqrt(n * pi) * M.gamma(n / 2)) * (1 + x * x / n) ** (-(n + 1) / 2)


def _chisquare_cdf(n, x):
    n, x = real(n), real(x)
    return M.gammainc(n / 2, 0, x / 2, regularized=True) if x > 0 else mpf(0)


def _chisquare(n, x):
    n, x = real(n), real(x)
    if x < 0:
        return mpf(0)
    return x ** (n / 2 - 1) * exp(-x / 2) / (2 ** (n / 2) * M.gamma(n / 2))


def _exponential(l, x):
    l, x = real(l), real(x)
    return l * exp(-l * x) if x >= 0 else mpf(0)


def _exponential_cdf(l, x):
    l, x = real(l), real(x)
    return 1 - exp(-l * x) if x >= 0 else mpf(0)


def _poisson(mu, k):
    mu, k = real(mu), integer(k)
    if k < 0:
        return mpf(0)
    return exp(-mu) * mu ** k / factorial(k)


def _poisson_cdf(mu, k):
    mu, k = real(mu), M.floor(real(k))
    return sum((_poisson(mu, mpf(j)) for j in range(0, int(k) + 1)), mpf(0)) if k >= 0 else mpf(0)


def _utpn(*a):
    mu, v, x = (mpf(0), mpf(1), real(a[0])) if len(a) == 1 else (real(a[0]), real(a[1]), real(a[2]))
    return M.erfc((x - mu) / sqrt(2 * v)) / 2


def _utpc(n, x):
    return 1 - _chisquare_cdf(n, x)


def _utpt(n, x):
    return 1 - _student_cdf(n, x)


def one_arg(f):
    return lambda x: f(real(x))


# name -> function of the Find entry's arguments, as Giac's help line defines it
FN = {
    "erfc": one_arg(M.erfc),
    "Ei": one_arg(M.ei),
    "Ci": one_arg(M.ci),
    "Si": one_arg(M.si),
    "Li": one_arg(M.li),
    "Zeta": one_arg(M.zeta),
    "LambertW": lambda x, k=0: M.lambertw(real(x), integer(k)),
    "BesselJ": lambda p, x: M.besselj(real(p), real(x)),
    "besselJ": lambda x, p: M.besselj(real(p), real(x)),
    "BesselY": lambda p, x: M.bessely(real(p), real(x)),
    "besselY": lambda x, p: M.bessely(real(p), real(x)),
    "Airy_Ai": one_arg(M.airyai),
    "Airy_Bi": one_arg(M.airybi),
    "Beta": lambda a, b, p=None: M.beta(real(a), real(b)) if p is None else M.betainc(real(a), real(b), 0, real(p)),
    "Psi": lambda a, n=0: M.psi(integer(n), real(a)),
    "igamma": gammainc_lower,
    "ugamma": lambda a, x: M.gammainc(real(a), real(x)),
    "acosh": one_arg(M.acosh),
    "asinh": one_arg(M.asinh),
    "atanh": one_arg(M.atanh),
    "acsc": lambda x: M.asin(1 / real(x)),
    "asec": lambda x: M.acos(1 / real(x)),
    "cot": one_arg(M.cot),
    "csc": one_arg(M.csc),
    "sec": one_arg(M.sec),
    "sinc": lambda x: M.sin(real(x)) / real(x) if real(x) != 0 else mpf(1),
    "log2": lambda x: log(real(x), 2),
    "logb": lambda x, b: log(real(x)) / log(real(b)),
    "alog10": lambda x: mpf(10) ** real(x),
    "atan2": lambda y, x: M.atan2(real(y), real(x)),
    "sign": lambda x: mpf(M.sign(real(x))),
    "nextprime": nextprime,
    "prevprime": prevprime,
    "euler": euler_phi,
    "perm": perm,
    "comb": comb,
    "normald": _normald,
    "normal_icdf": _normal_icdf,
    "student": _student,
    "student_cdf": _student_cdf,
    "chisquare": _chisquare,
    "chisquare_cdf": _chisquare_cdf,
    "exponential": _exponential,
    "exponential_cdf": _exponential_cdf,
    "poisson": _poisson,
    "poisson_cdf": _poisson_cdf,
    "UTPN": _utpn,
    "UTPC": _utpc,
    "UTPT": _utpt,
}

NS = dict(N=N, mpf=mpf, mpc=mpc, sqrt=sqrt, exp=exp, log=log, sin=M.sin, cos=M.cos, tan=M.tan, factorial=factorial)


def at(name, args, dps):
    mp.dps = dps
    ns = dict(NS, pi=+pi, e=+e)
    vals = [eval(a, {"__builtins__": {}}, ns) for a in args]
    v = FN[name](*vals)
    if isinstance(v, int):
        v = mpf(v)
    if isinstance(v, mpc):
        re, im = v.real, v.imag
    else:
        re, im = mpf(v), mpf(0)
    if not (isfinite(re) and isfinite(im)):
        raise ZeroDivisionError
    return re, im


def agree(a, b):
    scale = max(abs(a[0]), abs(a[1]), abs(b[0]), abs(b[1]))
    if scale == 0:
        return True
    tol = scale * mpf(10) ** -45
    return abs(a[0] - b[0]) <= tol and abs(a[1] - b[1]) <= tol


def one(q):
    name, args = q["name"], q["args"]
    if name not in FN:
        raise Skip("no oracle for this function")
    if args is None:
        raise Skip("an argument the oracle cannot read")
    a = at(name, args, 60)
    b = at(name, args, 100)
    if not agree(a, b):
        return {"kind": "skip", "reason": "unstable at 60/100 digits"}
    mp.dps = 100
    return {"kind": "value", "re": mp.nstr(b[0], 100), "im": mp.nstr(b[1], 100)}


def main():
    out = []
    signal.signal(signal.SIGALRM, _alarm)
    for q in json.load(sys.stdin):
        signal.setitimer(signal.ITIMER_REAL, 3.0)
        try:
            out.append(one(q))
        except Skip as s:
            out.append({"kind": "skip", "reason": str(s)})
        except TypeError:
            out.append({"kind": "skip", "reason": "another argument count"})
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
