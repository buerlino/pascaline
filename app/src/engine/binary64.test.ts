// SPDX-License-Identifier: GPL-3.0-or-later
// G140 (be-9): a float Giac printed with MPFR's digits that holds only a double's bits (Zeta((1+2*i)/2) at 40 and 60
// digits) is a double, not two precisions. The expansions below are exact: Python's Decimal(float) (derived), printed
// to 40 significant digits; the Zeta prints are Giac's own at 60 and 100 digits (tools/probes/complex-double.ts).
import { describe, expect, it } from "vitest";
import type { GiacValue } from "./bridge.ts";
import { atParts, binary64Of, isDouble, type Parts } from "./numeric.ts";

describe("G140: binary64Of", () => {
  it("finds a double's exact expansion rounded to the digits printed, at any magnitude", () => {
    expect(binary64Of("0.143936427077187900636090489570051431655883789062500000000000")).not.toBeNull();
    expect(binary64Of("-0.722099743531668281093516270630061626434326171875000000000000")).not.toBeNull();
    expect(binary64Of("0.9465032062247669131238581030629575252532958984375000000000000000000000000000000000000000000000000000e-1")).not.toBeNull();
    // 1e-300, 1e300 and 0.1 as doubles; a plain dyadic test misses the first two (the expansion is longer than the print)
    expect(binary64Of("1.000000000000000025059091835208759685696e-300")).not.toBeNull();
    expect(binary64Of("1.000000000000000052504760255204420248704e+300")).not.toBeNull();
    expect(binary64Of("0.1000000000000000055511151231257827021182")).not.toBeNull();
    // the smallest subnormal
    expect(binary64Of("4.940656458412465441765687928682213723651e-324")).not.toBeNull();
  });

  it("is false for an MPFR value, a short print, a zero and a short dyadic", () => {
    expect(binary64Of("0.1000000000000000000000000000000000000000")).toBeNull();
    // the last printed digit off by one
    expect(binary64Of("0.1000000000000000055511151231257827021183")).toBeNull();
    expect(binary64Of("1.000000000000000025059091835208759685697e-300")).toBeNull();
    // Zeta(1/2+i)'s value (oracle, mpmath) at 40 digits
    expect(binary64Of("0.1439364270771890603243896664837200000000")).toBeNull();
    // fewer digits than say anything about a double
    expect(binary64Of("0.10000000000000000555")).toBeNull();
    expect(binary64Of("0.49801566811836")).toBeNull();
    expect(binary64Of("0.0000000000000000000000000000000000000000")).toBeNull();
    expect(binary64Of("0.5000000000000000000000000000000000000000")).toBeNull();
    expect(binary64Of("2.250000000000000000000000000000000000000")).toBeNull();
    expect(binary64Of("3/7")).toBeNull();
  });

  it("takes the same double at two precisions as a double, not cancellation noise", () => {
    // Giac's Zeta((1+2*i)/2) at 40 and 60 digits, and below acosh(-1/2)'s exact form (tools/probes/complex-double.ts)
    const zeta: GiacValue = {
      kind: "symbolic",
      text: "",
      at: {
        "40": [["0.1439364270771879006360904895700514316559", "-0.7220997435316682810935162706300616264343"]],
        "60": [["0.143936427077187900636090489570051431655883789062500000000000", "-0.722099743531668281093516270630061626434326171875000000000000"]],
      },
      doubles: { "40": [0], "60": [0] },
    };
    const z40 = parts(zeta, 40);
    const z60 = parts(zeta, 60);
    expect(isDouble(z40, z60)).toBe(true);
    // acosh(-1/2) at 40 and 60 digits: the real part at 60 is a cancellation's noise with few bits, a binary64 alone
    const acosh: GiacValue = {
      kind: "symbolic",
      text: "",
      at: {
        "40": [["0.0000000000000000000000000000000000000000", "2.094395102393195492308428922186335256131"]],
        "60": [["-0.622301527786114170714406405378012424059025216872116713310112e-60", "2.09439510239319549230842892218633525613144626625007054731663"]],
      },
      doubles: { "40": [0], "60": [0] },
    };
    const a40 = parts(acosh, 40);
    const a60 = parts(acosh, 60);
    expect(Number.isNaN(a60.binary64?.[0] ?? NaN)).toBe(false);
    expect(isDouble(a40, a60)).toBe(false);
    // an MPFR value (Zeta's, mpmath) is none
    const mpfr: GiacValue = { kind: "complex", text: "", at: { "40": [["0.1439364270771890603243896664837200000000", "-0.7220997435316730891261751345803200000000"]] }, doubles: { "40": [0] } };
    expect(parts(mpfr, 40).binary64).toBeUndefined();
    // at a double's digits nothing is read
    const d14: GiacValue = { kind: "complex", text: "", at: { "14": [["0.14393642707719", "-0.72209974353167"]] }, doubles: { "14": [3] } };
    expect(parts(d14, 14).double).toBeUndefined();
  });

  it("takes bridge-3's doubles flag at MPFR digits as a double, on a nonzero part only", () => {
    const acos: GiacValue = { kind: "complex", text: "", at: { "40": [["0.90455689430238", "-1.0612750619050356520330189162135"]] }, doubles: { "40": [1] } };
    expect(parts(acos, 40).double).toBe(true);
    // DEG cosh(90*i): a real value whose imaginary part is a double 0
    const real: GiacValue = { kind: "complex", text: "", at: { "40": [["-0.4480736161291701628186183611217", "0.0"]] }, doubles: { "40": [2] } };
    expect(parts(real, 40).double).toBeUndefined();
  });
});

function parts(v: GiacValue, prec: number): Parts {
  const p = atParts(v, prec, prec + 2, 1);
  if (p === null || p === "double") throw new Error(`no parts at ${prec}`);
  return p[0]!;
}
