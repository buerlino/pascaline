// SPDX-License-Identifier: GPL-3.0-or-later
// R125: Solve's and Function's readouts draw the digit groups with Settings › Numbers › Digit groups' separator, as
// Home does; Copy's text (`fmtValue`, `fmt`) stays plain. Expected values are derived (groups of three from the point).
import { describe, expect, it, vi } from "vitest";
import type { GroupSep } from "../render/home.ts";
import type { AppHost } from "./types.ts";
import type { Cell } from "./function/engineApi.ts";
// the Function app imports the page brightness, which reads the document
vi.mock("../theme.svelte.ts", () => ({ brightness: () => "dark" }));
import { SolveApp } from "./solve/app.svelte.ts";
import { FunctionApp } from "./function/app.svelte.ts";

const host = (groupSep: GroupSep | undefined, comma = false): AppHost =>
  ({
    settings: { digits: 12, angle: "rad", format: "std", decimalMark: comma ? "comma" : "point", ...(groupSep ? { groupSep } : {}) },
    calc: { ready: async () => undefined },
    kv: { get: async () => undefined, set: async () => undefined },
    userNames: [],
    setEntry: () => undefined,
    copy: () => undefined,
    notice: () => undefined,
  }) as unknown as AppHost;

describe("R125: Solve's Num view", () => {
  const value = (sep: GroupSep | undefined, v: string, comma = false): [string, string] => {
    const app = new SolveApp(host(sep, comma));
    app.values = { x: v };
    return [app.drawn(app.fmtValue("x")), app.fmtValue("x")];
  };
  it("a value and a root in groups with the separator; the text Copy takes stays plain", () => {
    expect(value(undefined, "123456789")).toEqual(["123\u2009456\u2009789", "123456789"]);
    expect(value("thin", "123456789")).toEqual(["123\u2009456\u2009789", "123456789"]);
    expect(value("apos", "123456789")).toEqual(["123’456’789", "123456789"]);
    expect(value("comma", "1234567.89")).toEqual(["1,234,567.89", "1234567.89"]);
    expect(value("apos", "1234")).toEqual(["1234", "1234"]);
    const app = new SolveApp(host("apos"));
    expect(app.drawn(app.mark("-1.41421356237"))).toBe("-1.414’213’562’37");
  });
  it("under the decimal comma a stored comma draws as the thin space, and the mark's digits group from it", () => {
    expect(value("comma", "1234567.5", true)).toEqual(["1\u2009234\u2009567,5", "1234567,5"]);
    expect(value("apos", "0.333333333333", true)).toEqual(["0,333’333’333’333", "0,333333333333"]);
  });
});

describe("R125: Function's Num cells, x and readouts", () => {
  const cell = (display: string): Cell => ({ ok: true, display, facts: { exact: true, reliableDigits: null } });
  it("a cell and an x in groups with the separator; the cell's text (data-text, Copy) stays plain", () => {
    for (const [sep, want, x] of [
      ["thin", "1\u2009500\u2009000", "123\u2009456.5"],
      ["apos", "1’500’000", "123’456.5"],
      ["comma", "1,500,000", "123,456.5"],
    ] as const) {
      const app = new FunctionApp(host(sep));
      expect(app.fmt(cell("1500000"))).toBe("1500000");
      expect(app.drawn(app.fmt(cell("1500000")))).toBe(want);
      expect(app.drawn(app.fmtX("123456.5"))).toBe(x);
    }
    const app = new FunctionApp(host("apos"));
    expect(app.drawn(`${app.fmtX("12345")} … ${app.fmtX("123456")}`)).toBe("12’345 … 123’456"); // the area's range line
  });
  it("under the decimal comma a stored comma draws as the thin space", () => {
    const app = new FunctionApp(host("comma", true));
    expect(app.drawn(app.fmt(cell("1500000.25")))).toBe("1\u2009500\u2009000,25");
    expect(app.fmt(cell("1500000.25"))).toBe("1500000,25");
  });
});
