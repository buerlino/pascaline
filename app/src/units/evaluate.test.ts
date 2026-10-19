// SPDX-License-Identifier: GPL-3.0-or-later
// G40: the unit view's angle wrappers as text: sin, cos and tan take an angle, the inverses give one, and the parser's
// degree factor (R64) is taken off both. No engine (the golden gate's units stage evaluates them).
import { describe, expect, it } from "vitest";
import { withAngles } from "./evaluate.ts";

describe("withAngles (P15, G40)", () => {
  it("sin, cos and tan take an angle, without the parser's pasdeg", () => {
    expect(withAngles("sin(pasdeg*30)+cos(x)")).toBe("pasusin(30)+pasucos(x)");
  });
  it("an inverse gives an angle: the parser's /pasdeg after it goes", () => {
    expect(withAngles("(asin(1/2)/pasdeg)*2*m")).toBe("(pasuasin(1/2))*2*m");
    expect(withAngles("acos(x)")).toBe("pasuacos(x)");
    expect(withAngles("(atan2(3*m,4*m)/pasdeg)")).toBe("(pasuatan2(3*m,4*m))");
    expect(withAngles("(atan(1)/pasdeg)+(acot(1)/pasdeg)")).toBe("(pasuatan(1))+(pasuacot(1))");
  });
  it("nested calls and brackets inside the argument", () => {
    expect(withAngles("(asin((asin(1/2)/pasdeg)/(2*(1+1)))/pasdeg)")).toBe("(pasuasin((pasuasin(1/2))/(2*(1+1))))");
    expect(withAngles("sin(pasdeg*(asin(1/2)/pasdeg))")).toBe("pasusin((pasuasin(1/2)))");
  });
  it("leaves other names, a power of pasdeg and an unbalanced call alone", () => {
    expect(withAngles("asinh(1)+basin(2)")).toBe("asinh(1)+basin(2)");
    expect(withAngles("asin(x)/pasdeg^2")).toBe("pasuasin(x)/pasdeg^2");
    expect(withAngles("asin(x")).toBe("asin(x");
  });
});
