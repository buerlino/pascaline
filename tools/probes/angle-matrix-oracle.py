# SPDX-License-Identifier: GPL-3.0-or-later
# The right values of tools/probes/angle-matrix.ts (S14), from mpmath at 40 digits (`oracle`). A degree is pi/180;
# for a complex argument the same factor (z degrees = z*pi/180), which is how the `derived` cases of D5 read.
#   tests/golden/.venv/bin/python -I tools/probes/angle-matrix-oracle.py
import mpmath as m

m.mp.dps = 40
d = m.pi / 180


def show(z):
    z = m.mpc(z)
    return "%s %s" % (m.nstr(z.real, 20), m.nstr(z.imag, 20))


CASES = {
    "D4 cosh(90i)": m.cosh(90j),
    "D4 sinh(90i)": m.sinh(90j),
    "D4 cosh(1+i)": m.cosh(1 + 1j),
    "D4 solve cosh(i*x)=1/2: acosh(1/2)/i": m.acosh(0.5) / 1j,
    "D5 cos((30+i) deg)": m.cos((30 + 1j) * d),
    "D5 tan((45+i) deg)": m.tan((45 + 1j) * d),
    "D5 abs(sin((1+i) deg))": abs(m.sin((1 + 1j) * d)),
    "D5 cos(i deg)": m.cos(1j * d),
    "D6 acos(2) in deg": m.acos(2) / d,
    "D6 acos(3/2) in deg": m.acos(m.mpf(3) / 2) / d,
    "D6 asin(2) in deg": m.asin(2) / d,
    "D7 int 1/(1+x^2), 0..1": m.pi / 4,
    "D7 int 1/sqrt(1-x^2), 0..1/2": m.pi / 6,
    "D7 ilaplace at t=1: sin(1)": m.sin(1),
    "D7 laplace of sin(t deg) at s=1": d / (1 + d**2),
    "D7 int x*sin(x deg), 0..90": m.quad(lambda x: x * m.sin(x * d), [0, 90]),
    "D7 limit (1+1/n)^n": m.e,
    "D12 (-8)^0.2": m.power(-8, m.mpf(1) / 5),
    "D12 (-1)^0.1": m.power(-1, m.mpf(1) / 10),
    "D12 (-32)^(1/5)": m.power(-32, m.mpf(1) / 5),
    "F1 atan(3/4) in deg": m.atan(m.mpf(3) / 4) / d,
    "F1 atan(3/4) in rad": m.atan(m.mpf(3) / 4),
    "F1 sin(1 deg)": m.sin(d),
    "F1 sin(1)": m.sin(1),
    "F2 exp(90i)": m.exp(90j),
    "F2 exp(1+30i)": m.exp(1 + 30j),
    "F3 int exp(i*x), 0..90 (exp ignores the mode)": m.quad(lambda x: m.exp(1j * x), [0, 90]),
    "control sin(30) in rad": m.sin(30),
}

for k, v in CASES.items():
    print(k, "=>", show(v))
