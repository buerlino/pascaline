// SPDX-License-Identifier: GPL-3.0-or-later
// G59f1: the powers the principal-power route rewrites (text only; expected texts derived by hand from the rule).
import { describe, expect, it } from "vitest";
import { principalPowers } from "./powers.ts";

describe("principalPowers", () => {
  it("rewrites a power with a non-integer exponent and a base that is not a number literal, pi or e", () => {
    expect(principalPowers("(sin(37/10)-exp(1))^(asin(602000000)/1000)")).toBe("exp(((asin(602000000)/1000))*ln((sin(37/10)-exp(1))))");
    expect(principalPowers("(-3)^(i/1000)")).toBe("exp(((i/1000))*ln((-3)))");
    expect(principalPowers("x^y+1")).toBe("exp((y)*ln(x))+1");
    expect(principalPowers("f(2)^-sqrt(2)")).toBe("exp((-sqrt(2))*ln(f(2)))");
  });

  it("leaves powers with one value alone: an integer exponent, a literal, pi or e as base", () => {
    expect(principalPowers("(-3)^2")).toBeNull();
    expect(principalPowers("x^(-3)")).toBeNull();
    expect(principalPowers("2^(1/3)+pi^i+e^(i*pi)")).toBeNull();
    expect(principalPowers("-3^(1/2)")).toBeNull();
    expect(principalPowers("sin(x)")).toBeNull();
  });

  it("reads a^b^c as a^(b^c) and rewrites nested powers", () => {
    expect(principalPowers("x^y^z")).toBe("exp((exp((z)*ln(y)))*ln(x))");
    expect(principalPowers("(x^(1/2))^2")).toBe("(exp(((1/2))*ln(x)))^2");
  });

  it("gives nothing for element-wise powers, list bases and strings", () => {
    expect(principalPowers("[1,-2]^(1/2)")).toBeNull();
    expect(principalPowers('x^(1/2)+"a"')).toBeNull();
  });
});
