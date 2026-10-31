# SPDX-License-Identifier: GPL-3.0-or-later
# G81: the oracle of app/src/engine/constCorr.test.ts: value and first-order sigma over the basis leaves (G80, libqalculate
# 5.13.1, CODATA 2022), mpmath at 50 digits. Run: tests/golden/.venv/bin/python tests/golden/oracle_constcorr.py
from mpmath import mp, mpf, sqrt, diff
mp.dps = 50
h = mpf(662607015)*mpf(10)**-42; e = mpf(1602176634)*mpf(10)**-28; c = mpf(299792458)
L = {"a": (mpf("7.29735256434E-3"), mpf("1.13E-12")), "R": (mpf("10973731.5681569"), mpf("0.000012")),
     "pu": (mpf("1.0072764665789"), mpf("8.3E-12")), "eu": (mpf("5.485799090441E-4"), mpf("9.7E-15"))}
mu0 = lambda a: 2*h*a/(c*e**2)
eps0 = lambda a: e**2/(2*h*a*c)
me = lambda R, a: 2*R*h/(c*a**2)
mp_ = lambda pu, R, a, eu: pu*(2*R*h/(c*a**2*eu))
def sig(f, names):
    vals = [L[n][0] for n in names]
    s = 0
    for i, n in enumerate(names):
        g = lambda x, i=i: f(*[x if j == i else vals[j] for j in range(len(vals))])
        s += (diff(g, vals[i]) * L[n][1])**2
    return f(*vals), sqrt(s)
print("mu0eps0c2", sig(lambda a: mu0(a)*eps0(a)*c**2, ["a"]))
print("Z0", sig(lambda a: sqrt(mu0(a)/eps0(a)), ["a"]))
print("mp/me", sig(lambda pu, R, a, eu: mp_(pu, R, a, eu)/me(R, a), ["pu", "R", "a", "eu"]))
