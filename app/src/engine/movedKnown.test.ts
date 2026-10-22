// SPDX-License-Identifier: GPL-3.0-or-later
// G68f1: an answer-known moves by one unit in its last confirmed digit; a typed known does not move. Derived by hand.
import { describe, expect, it } from "vitest";
import { checkByKnowns, movedKnown } from "./solve.ts";
import { decimalFromString, ZERO_VALUE } from "./format.ts";
import type { HomeResult, SolveOutcome, SolveRequest } from "./types.ts";

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

describe("checkByKnowns: a moved solve that confirms nothing gives ⚠", () => {
  const result = { ok: true, display: "10.0000000001", value: { re: decimalFromString("10.0000000001")!, im: ZERO_VALUE }, facts: { exact: false, reliableDigits: 12 } } as unknown as HomeResult;
  const o: SolveOutcome = { ok: true, roots: [{ name: "y", result }], method: "brent", info: "", warn: false, ms: 0 };
  const req: SolveRequest = { kind: "equations", equations: ["y=x*10"], unknowns: ["y"], guesses: ["1"], knowns: [{ name: "x", value: "1.00000000001", digits: 12 }] };
  it("the moved solve fails", () => {
    const r = checkByKnowns(o, req, 12, () => ({ ok: false, roots: [], method: "none", info: "no root", warn: false, error: "no-root", ms: 0 }));
    expect(r.warn).toBe(true);
    expect(r.roots[0]!.result.facts.reliableDigits).toBe(0);
  });
  it("the moved solve finds another number of roots", () => {
    const r = checkByKnowns(o, req, 12, () => ({ ...o, roots: [...o.roots, ...o.roots] }));
    expect(r.warn).toBe(true);
    expect(r.roots[0]!.result.facts.reliableDigits).toBe(0);
  });
  it("one moved solve per answer-known: each is moved alone (never both at once)", () => {
    const two: SolveRequest = { ...req, knowns: [{ name: "x", value: "2", digits: 5 }, { name: "z", value: "3", digits: 5 }, { name: "t", value: "7" }] };
    const seen: string[][] = [];
    checkByKnowns(o, two, 12, (r) => (seen.push((r.knowns ?? []).map((k) => k.value)), o));
    expect(seen).toEqual([
      ["0.20001e1", "3", "7"],
      ["2", "0.30001e1", "7"],
    ]);
  });
});
