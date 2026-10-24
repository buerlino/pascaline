// SPDX-License-Identifier: GPL-3.0-or-later
// G91: a precision that holds no name is read as the literal it gives; any other is unread (⚠ without a count).
import { describe, expect, it } from "vitest";
import { askedLiterals } from "./asked.ts";
import { unreadFacts, unreadPrecision, type ElementFacts, type Giac } from "./numeric.ts";
import { decimalFromString } from "./format.ts";
import type { GiacValue } from "./bridge.ts";

/** Giac's answers (as it prints them) for the texts askedLiterals evaluates, and the texts it was asked. */
function fakeGiac(answers: Record<string, string>): { giac: Giac; asked: string[] } {
  const asked: string[] = [];
  const giac: Giac = {
    eval: () => {
      throw new Error("not used");
    },
    value: (t): GiacValue => {
      asked.push(t);
      const out = answers[t] ?? "GIAC_ERROR: unexpected";
      if (out.startsWith("GIAC_ERROR")) return { kind: "error", text: out };
      const [num, den] = out.split("/");
      return den === undefined ? { kind: "integer", text: out, num } : { kind: "rational", text: out, num, den };
    },
  };
  return { giac, asked };
}

describe("askedLiterals (G91)", () => {
  it("puts in the literal a nameless precision gives, once per text, after the mode setup", () => {
    const { giac, asked } = fakeGiac({ "(2*10)": "20", "((200/10^1))": "20", "(2^4)": "16" });
    let ready = 0;
    const out = askedLiterals(giac, "approx(sin(10^30),2*10)+evalf(1/3,2*10)*evalf(pi,20.0)-evalf(e,2^4)", () => ready++);
    expect(out).toBe("approx(sin(10^30),20)+evalf(1/3,20)*evalf(pi,20)-evalf(e,16)");
    expect(asked).toEqual(["(2*10)", "((200/10^1))", "(2^4)"]);
    expect(ready).toBe(1);
  });

  it("reads nested calls and keeps literals, names and values out of range without a call for them", () => {
    const { giac, asked } = fakeGiac({ "(3*5)": "15", "(7/2)": "7/2", "(10^4)": "10000", "(1-1)": "0" });
    expect(askedLiterals(giac, "evalf(approx(x,3*5)+1,30)", () => {})).toBe("evalf(approx(x,15)+1,30)");
    expect(askedLiterals(giac, "approx(x,n)+evalf(x,k+1)+evalf(x,e)", () => {})).toBe("approx(x,n)+evalf(x,k+1)+evalf(x,e)");
    expect(askedLiterals(giac, "evalf(x,7/2)+evalf(x,10^4)+evalf(x,1-1)", () => {})).toBe("evalf(x,7/2)+evalf(x,10^4)+evalf(x,1-1)");
    expect(asked).toEqual(["(3*5)", "(7/2)", "(10^4)", "(1-1)"]);
  });

  it("makes no Giac call and no mode setup for an input whose precisions are literals", () => {
    const { giac, asked } = fakeGiac({});
    let ready = 0;
    expect(askedLiterals(giac, "approx(sin(10^30),20)+evalf(x)+sin(2*10)", () => ready++)).toBe("approx(sin(10^30),20)+evalf(x)+sin(2*10)");
    expect(asked).toEqual([]);
    expect(ready).toBe(0);
  });

  it("an engine error leaves the precision as typed", () => {
    const { giac } = fakeGiac({ "(9^9^9)": "GIAC_ERROR: Exponent overflow" });
    expect(askedLiterals(giac, "evalf(pi,9^9^9)", () => {})).toBe("evalf(pi,9^9^9)");
  });
});

describe("unreadPrecision (G91)", () => {
  it("is true for a precision that is no integer literal", () => {
    expect(unreadPrecision("approx(sin(10^30),n)")).toBe(true);
    expect(unreadPrecision("seq(evalf(sin(10^30),k),k,15,16)")).toBe(true);
    expect(unreadPrecision("exp(evalf(x,(5/2)))")).toBe(true);
    expect(unreadPrecision("approx(sin(10^30),20)+evalf(x)")).toBe(false);
    expect(unreadPrecision('"evalf(x,n)"+sin(n)')).toBe(false);
  });

  it("unreadFacts drops the count and marks the value unchecked, keeps an exact element and a warning it has", () => {
    const v = { re: decimalFromString("0.5", 12)!, im: decimalFromString("0", 12)! };
    const f: ElementFacts[] = [
      { value: v, exact: false, reliableDigits: 39, big: false },
      { value: v, exact: false, reliableDigits: 13, big: false, warn: "unaudited" },
      { value: v, exact: true, reliableDigits: null, big: false },
    ];
    expect(unreadFacts(f).map((x) => [x.reliableDigits, x.warn])).toEqual([[null, "unchecked"], [null, "unaudited"], [null, undefined]]);
    expect(unreadFacts(f)[2]).toBe(f[2]);
  });
});
