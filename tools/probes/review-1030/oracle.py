# SPDX-License-Identifier: GPL-3.0-or-later
# Night review 2026-10-30, verifier vbe: independent oracle values for the be report's S1/S2 claims (mpmath).
# Run: tests/golden/.venv/bin/python -I tools/probes/review-1030/oracle.py
from mpmath import mp, mpf, mpc, sin, cos, sqrt, ncdf, zeta, gamma, e, exp, log

mp.dps = 500
T = mpf(10)
print("be-1 (1+10^-100)^(10^100) =", mp.nstr((1 + T**-100) ** (T**100), 15))
print("be-1 (1-10^-70)^(10^70)   =", mp.nstr((1 - T**-70) ** (T**70), 15))
print("be-1 (1+5/10^62)^(10^60)  =", mp.nstr((1 + 5 / T**62) ** (T**60), 15))
print("be-1 (1+10^-100)^(2*10^100) =", mp.nstr((1 + T**-100) ** (2 * T**100), 15))
print("be-1 (sin(1+10^-100)-sin(1))*10^100+1 =", mp.nstr((sin(1 + T**-100) - sin(1)) * T**100 + 1, 15))
print("be-1 (1-cos(10^-90))*10^180+1 =", mp.nstr((1 - cos(T**-90)) * T**180 + 1, 15))
print("be-1 1/(1-cos(10^-90)) =", mp.nstr(1 / (1 - cos(T**-90)), 15))
print("be-1 (1+10^-45)^(10^45) =", mp.nstr((1 + T**-45) ** (T**45), 15))
mp.dps = 60
print("be-9 zeta(1/2+i) =", mp.nstr(zeta(mpc(mpf(1) / 2, 1)), 32))
print("be-11 gamma(1+i) =", mp.nstr(gamma(mpc(1, 1)), 20))
mp.dps = 120
x = sqrt(mpf(33) / 10) + sin(T**-50)
print("be-10 eseries: (10x)^2-330 =", mp.nstr((10 * x) ** 2 - 330, 6), "-> >0 means nearer 2.2 by ratio")
print("be-10 eseries exact tie sqrt(33/10): (10x)^2-330 =", mp.nstr((10 * sqrt(mpf(33) / 10)) ** 2 - 330, 6))
y = mpf(5) / 4 - sin(T**-50)
print("be-10 sigfig: 1.25 - sin(1e-50) - 1.25 =", mp.nstr(y - mpf(5) / 4, 6), "-> < 0 rounds to 1.2")
mp.dps = 40
p = 1 - ncdf(mpf("0.5"))
print("be-2 floor(N(2.95,0.1)): P(>=3) =", mp.nstr(p, 10), " sigma =", mp.nstr(sqrt(p * (1 - p)), 6))
print("be-2 round(N(2.5,0.1)): sigma =", mp.nstr(sqrt(mpf(1) / 4), 6))
p = ncdf(mpf("-0.1"))
print("be-2 sign(N(0.01,0.1)): P(<0) =", mp.nstr(p, 10), " sigma =", mp.nstr(2 * sqrt(p * (1 - p)), 6))
