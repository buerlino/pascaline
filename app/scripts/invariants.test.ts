// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { invariantsOf, invariantsStage, type InvariantFailure } from "./invariants.ts";

const fail = (id: string, check = "a"): InvariantFailure => ({ id, check, detail: "RAD 1, DEG 2" });

describe("invariants stage verdict", () => {
  it("passes with no failure and no known entry", () => {
    expect(invariantsStage([], []).ok).toBe(true);
  });
  it("fails on a wrong DEG answer that is not known", () => {
    const r = invariantsStage([fail("home:x")], []);
    expect(r.ok).toBe(false);
    expect(r.lines[0]).toContain("NEW home:x");
  });
  it("passes when the failures are exactly the known ones", () => {
    const r = invariantsStage([fail("home:x")], [{ id: "home:x", check: "a", package: "G46" }]);
    expect(r.ok).toBe(true);
    expect(r.summary).toBe("1 known failures, 0 new, 0 now passing");
  });
  it("fails on a known failure that now passes, so the list is pruned", () => {
    const r = invariantsStage([], [{ id: "home:x", check: "a", package: "G46" }]);
    expect(r.ok).toBe(false);
    expect(r.lines[0]).toContain("NOW PASSING");
  });
  it("tells a known id with another check apart", () => {
    expect(invariantsStage([fail("home:x", "d")], [{ id: "home:x", check: "a", package: "G46" }]).ok).toBe(false);
  });
});

describe("invariantsOf: angle-free inputs", () => {
  it("takes exp, hyperbolic functions and powers of negatives", () => {
    for (const t of ["exp(i*90)", "cosh(90*i)", "(-8)^0.2", "1/3", "sqrt(2)"]) expect(invariantsOf(t).angleFree, t).toBe(true);
  });
  it("leaves out trig, inverse trig, arg, atan2, polar and the degree sign", () => {
    for (const t of ["sin(1)", "acos(0.3)", "arg(1+i)", "atan2(1,2)", "polar_coordinates(1+i)", "30°", "tan(45)"]) expect(invariantsOf(t).angleFree, t).toBe(false);
  });
  it("counts a before entry", () => {
    expect(invariantsOf("X", ["X:=sin(1)"]).angleFree).toBe(false);
  });
});
