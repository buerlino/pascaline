// SPDX-License-Identifier: GPL-3.0-or-later
// G68f1: an answer-known moves by one unit in its last confirmed digit; a typed known does not move. Derived by hand.
import { describe, expect, it } from "vitest";
import { movedKnown } from "./solve.ts";

describe("movedKnown", () => {
  it("adds one unit in the last confirmed digit", () => {
    expect(movedKnown({ name: "x", value: "1.4142135623731", digits: 14 }).value).toBe("0.14142135623732e1");
    expect(movedKnown({ name: "x", value: "2", digits: 5 }).value).toBe("0.20001e1"); // trailing zeros dropped by Copy
    expect(movedKnown({ name: "x", value: "9.99", digits: 3 }).value).toBe("0.1e2"); // the carry
    expect(movedKnown({ name: "x", value: "-1.5e-3", digits: 2 }).value).toBe("-0.16e-2"); // away from zero
  });
  it("leaves a typed known and zero as they are", () => {
    expect(movedKnown({ name: "x", value: "1.5" }).value).toBe("1.5");
    expect(movedKnown({ name: "x", value: "0", digits: 3 }).value).toBe("0");
  });
});
