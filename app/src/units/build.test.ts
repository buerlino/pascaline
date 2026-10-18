// SPDX-License-Identifier: GPL-3.0-or-later
// The unit view's builder (G16): tokens → Giac text with the index's factors and the dimension symbols. A small table
// written here (factors as the index writes them), so the test runs without the generated index.
import { describe, expect, it } from "vitest";
import { buildJob, slotGiac } from "./build.ts";
import { factorTable } from "./factors.ts";
import { dimKeyOf, dimensionText, parseDimKey } from "./dims.ts";
import { unitErrorMessage } from "./messages.ts";
import type { IndexItem } from "../find/types.ts";

const unit = (id: string, si: string | undefined, dim: string | undefined, symbol = id): IndexItem => ({
  id: `unit:${id}`, kind: "unit", names: [id], title: id, ...(si ? { si } : {}), ...(dim !== undefined ? { dim } : {}), tier: 0, insert: `\\unit{${id}}{\\mathrm{${symbol}}}`,
});
const pfx = (id: string, si: string, symbol = id): IndexItem => ({ id: `pfx:${id}`, kind: "pfx", names: [id], title: id, si, tier: 0, insert: `\\pfx{${id}}{\\mathrm{${symbol}}}` });
const table = factorTable([
  unit("m", "1", "m1"), unit("h", "3600", "s1"), unit("s", "1", "s1"), unit("Hz", "1", "s-1"), unit("V", "1", "A-1kg1m2s-3"),
  unit("N", "1", "kg1m1s-2"), unit("deg", "pi/180", "rad1", "1°"), unit("oC", "1+5463/20", "K1", "°C"), unit("dB", undefined, "Np1"),
  unit("dBm", undefined, "kg1m2s-3"), unit("hp", undefined, "kg1m2s-3"), unit("km/h", "5/18", "m1s-1"),
  pfx("k", "1000"), pfx("n", "1/1000000000"), pfx("u", "1/1000000", "µ"), pfx("Ki", "1024"),
  { id: "const:c", kind: "const", names: ["c"], title: "c", value: "299792458", dim: "m1s-1", tier: 0, insert: "\\const{c}{c}" },
  { id: "const:G", kind: "const", names: ["G"], title: "G", value: "6.67430E-11", unc: "1.5E-15", dim: "kg-1m3s-2", tier: 0, insert: "\\const{G}{G}" },
]);

describe("unit view builder (G16)", () => {
  it("a unit is its factor times its dimension symbols", () => {
    expect(slotGiac({ tokens: [{ unit: "h" }] }, table)).toBe("(((3600)*pasdimT^(1)))");
    expect(slotGiac({ tokens: [{ unit: "V" }] }, table)).toBe("(((1)*pasdimM^(1)*pasdimL^(2)*pasdimT^(-3)*pasdimI^(-1)))");
  });
  it("a prefix multiplies the factor, inside the power (km² = (km)²)", () => {
    expect(slotGiac({ tokens: [{ prefix: "k", unit: "m", power: "2" }] }, table)).toBe("(((1000)*(1)*pasdimL^(1))^(2))");
    expect(slotGiac({ tokens: [{ prefix: "Ki", unit: "s" }] }, table)).toBe("(((1024)*(1)*pasdimT^(1)))");
  });
  it("the tokens after the ÷ are below it, with their powers", () => {
    expect(slotGiac({ tokens: [{ prefix: "k", unit: "m" }, { unit: "h" }], per: 1 }, table)).toBe("(((1000)*(1)*pasdimL^(1))*((3600)*pasdimT^(1))^(-1))");
    expect(slotGiac({ tokens: [{ unit: "m" }, { unit: "s", power: "2" }], per: 1 }, table)).toBe("(((1)*pasdimL^(1))*((1)*pasdimT^(1))^(-2))");
    expect(slotGiac({ tokens: [{ unit: "m" }, { unit: "s", power: "-1" }], per: 1 }, table)).toBe("(((1)*pasdimL^(1))*((1)*pasdimT^(1)))");
  });
  it("√ is the power 1/2 on the unit after it (nV/√Hz)", () => {
    expect(slotGiac({ tokens: [{ prefix: "n", unit: "V" }, { unit: "Hz", power: "1/2" }], per: 1 }, table)).toBe(
      "(((1/1000000000)*(1)*pasdimM^(1)*pasdimL^(2)*pasdimT^(-3)*pasdimI^(-1))*((1)*pasdimT^(-1))^(-1/2))",
    );
  });
  it("a user cell's prefixed unit is one token with its prefix", () => {
    const job = buildJob({ formula: "2*pasu1*3*pasu2", slots: [{ tokens: [{ prefix: "k", unit: "N" }] }, { tokens: [{ unit: "m" }] }] }, table);
    expect(job).toEqual({ expr: "2*(((1000)*(1)*pasdimM^(1)*pasdimL^(1)*pasdimT^(-2)))*3*(((1)*pasdimL^(1)))", inexact: false });
  });
  it("a compound unit of the index is one factor", () => {
    expect(slotGiac({ tokens: [{ unit: "km/h" }] }, table)).toBe("(((5/18)*pasdimL^(1)*pasdimT^(-1)))");
  });
  it("the end slot and the constants (an uncertain one makes the job inexact)", () => {
    const job = buildJob({ formula: "pask1*pask2*pasu1", slots: [{ tokens: [{ unit: "s" }] }], consts: ["c", "G"], end: { tokens: [{ unit: "m" }] } }, table);
    expect(job).toEqual({
      expr: "((299792458)*pasdimL^(1)*pasdimT^(-1))*((6.67430E-11)*pasdimM^(-1)*pasdimL^(3)*pasdimT^(-2))*(((1)*pasdimT^(1)))",
      end: "(((1)*pasdimL^(1)))",
      inexact: true,
    });
    expect(buildJob({ formula: "2*pask1", slots: [], consts: ["c"] }, table)).toMatchObject({ inexact: false });
  });
  it("refuses an absolute temperature, a logarithmic unit and a unit with no factor, naming it", () => {
    const refuse = (u: string) => buildJob({ formula: "2*pasu1", slots: [{ tokens: [{ unit: u }] }] }, table);
    expect(refuse("oC")).toEqual({ error: "temperature", unit: "°C" });
    expect(refuse("dB")).toEqual({ error: "logarithmic", unit: "dB" });
    expect(refuse("dBm")).toEqual({ error: "logarithmic", unit: "dBm" });
    expect(refuse("hp")).toEqual({ error: "nofactor", unit: "hp" });
    expect(unitErrorMessage({ error: "nofactor", unit: "hp" })).toBe("No exact factor for hp yet");
    expect(unitErrorMessage({ error: "temperature", unit: "°C" })).toBe("Use K or Δ°C for a temperature difference");
  });
  it("refuses a request that does not fit together", () => {
    const one = { tokens: [{ unit: "m" }] };
    expect(buildJob({ formula: "2*pasu1*pasu2", slots: [one] }, table)).toMatchObject({ error: "engine" });
    expect(buildJob({ formula: "2", slots: [one] }, table)).toMatchObject({ error: "engine" });
    expect(buildJob({ formula: "2*pasu1", slots: [{ tokens: [] }] }, table)).toMatchObject({ error: "engine" });
    expect(buildJob({ formula: "2*pasu1", slots: [{ tokens: [{ unit: "m" }], per: 1 }] }, table)).toMatchObject({ error: "engine" });
    expect(buildJob({ formula: "2*pasu1", slots: [{ tokens: [{ unit: "m", power: "x" }] }] }, table)).toMatchObject({ error: "engine" });
    expect(buildJob({ formula: "2*pasu1", slots: [{ tokens: [{ unit: "nope" }] }] }, table)).toMatchObject({ error: "engine" });
    expect(buildJob({ formula: "pasans*pasu1", slots: [one] }, table)).toMatchObject({ error: "engine" });
  });
});

describe("dimensions (G16)", () => {
  it("keys as the index writes them, text as a message writes them", () => {
    expect(parseDimKey("A-1kg1m2s-5/2")).toEqual(new Map([["A", "-1"], ["kg", "1"], ["m", "2"], ["s", "-5/2"]]));
    expect(dimKeyOf(["1", "1", "-2", "0", "0", "0", "0", "0", "0", "0"])).toBe("kg1m1s-2");
    expect(dimKeyOf(["0", "2", "-3", "0", "-1", "-1", "0", "0", "0", "0"])).toBe("K-1m2mol-1s-3");
    expect(dimKeyOf(Array(10).fill("0"))).toBe("");
    expect(dimensionText("kg1m2s-2")).toBe("M·L²·T⁻²");
    expect(dimensionText("m1s-1")).toBe("L·T⁻¹");
    expect(dimensionText("rad1s-1")).toBe("T⁻¹·angle");
    expect(dimensionText("A-1kg1m2s-5/2")).toBe("M·L²·T^(-5/2)·I⁻¹");
    expect(dimensionText("")).toBe("1");
    expect(unitErrorMessage({ error: "dimension", dims: ["m1", "s1"] })).toBe("Units don't match: L vs T");
  });
});
