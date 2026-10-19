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
  unit("m", "1", "m1"), unit("h", "3600", "s1"), unit("s", "1", "s1"), unit("Hz", "1", "s-1"), unit("rev", "1", ""), unit("rpm", "1/60", "s-1"), unit("V", "1", "A-1kg1m2s-3"),
  unit("N", "1", "kg1m1s-2"), unit("deg", "pi/180", "rad1", "1°"), unit("oC", "1+5463/20", "K1", "°C"), unit("dB", undefined, "Np1"),
  unit("dBm", undefined, "kg1m2s-3"), unit("hp", undefined, "kg1m2s-3"), unit("Np", "1", "Np1"), unit("km/h", "5/18", "m1s-1"),
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
    expect(job).toEqual({ expr: "2*(((1000)*(1)*pasdimM^(1)*pasdimL^(1)*pasdimT^(-2)))*3*(((1)*pasdimL^(1)))", inexact: false,
      check: "pasz1*(((1000)*(1)*pasdimM^(1)*pasdimL^(1)*pasdimT^(-2)))*(((1)*pasdimL^(1)))",
      shows: [{ text: "kN·m", dim: "kg1m2s-2", factor: "1000" }, { text: "kN", dim: "kg1m1s-2", factor: "1000" }, { text: "m", dim: "m1", factor: "1" }] });
  });
  it("G25: typed units that multiply to factor 1 are kept (N·m), the end slot is named", () => {
    const job = buildJob({ formula: "5*pasu1*2*pasu2", slots: [{ tokens: [{ unit: "N" }] }, { tokens: [{ unit: "m" }] }] }, table);
    expect((job as { shows: unknown[] }).shows[0]).toEqual({ text: "N·m", dim: "kg1m2s-2", factor: "1" });
    const end = buildJob({ formula: "pasu1", slots: [{ tokens: [{ unit: "m" }, { unit: "s", power: "-1" }], per: 1 }], end: { tokens: [{ prefix: "k", unit: "m" }, { unit: "h" }], per: 1 } }, table);
    expect(end).toMatchObject({ endUnit: "km/h" });
  });
  it("G25f1: a product with at most one prefixed token is kept, two prefixes go to SI", () => {
    const kw = buildJob({ formula: "2*pasu1*3*pasu2", slots: [{ tokens: [{ prefix: "k", unit: "N" }] }, { tokens: [{ unit: "m" }] }] }, table);
    expect((kw as { shows: { text: string }[] }).shows[0]!.text).toBe("kN·m");
    const two = buildJob({ formula: "4.7*pasu1*2.2*pasu2", slots: [{ tokens: [{ prefix: "k", unit: "ohm" }] }, { tokens: [{ prefix: "n", unit: "F" }] }] }, table);
    expect(((two as { shows?: { text: string }[] }).shows ?? []).map((x) => x.text)).not.toContain("kΩ·nF");
  });
  it("G25: rev is a pure count of cycles and rpm is 1 rev/min", () => {
    expect(table.units.get("rev")).toMatchObject({ si: "1", dim: "" });
    expect(table.units.get("rpm")).toMatchObject({ si: "1/60", dim: "s-1" });
  });
  it("a compound unit of the index is one factor", () => {
    expect(slotGiac({ tokens: [{ unit: "km/h" }] }, table)).toBe("(((5/18)*pasdimL^(1)*pasdimT^(-1)))");
  });
  it("the end slot and the constants (an uncertain one makes the job inexact)", () => {
    const job = buildJob({ formula: "pask1*pask2*pasu1", slots: [{ tokens: [{ unit: "s" }] }], consts: ["c", "G"], end: { tokens: [{ unit: "m" }] } }, table);
    expect(job).toMatchObject({
      expr: "((299792458)*pasdimL^(1)*pasdimT^(-1))*((6.67430E-11)*pasdimM^(-1)*pasdimL^(3)*pasdimT^(-2))*(((1)*pasdimT^(1)))",
      end: "(((1)*pasdimL^(1)))",
      inexact: true,
    });
    expect(buildJob({ formula: "2*pask1", slots: [], consts: ["c"] }, table)).toMatchObject({ inexact: false });
  });
  it("refuses an absolute temperature, a logarithmic unit and a unit with no factor, naming it", () => {
    const refuse = (u: string, formula = "2*pasu1*3") => buildJob({ formula, slots: [{ tokens: [{ unit: u }] }] }, table);
    expect(refuse("oC")).toEqual({ error: "temperature", unit: "°C" });
    expect(refuse("dB")).toEqual({ error: "logarithmic", unit: "dB" });
    expect(refuse("dBm", "2+pasu1")).toEqual({ error: "logarithmic", unit: "dBm" });
    expect(refuse("oC", "2+3*pasu1")).toEqual({ error: "temperature", unit: "°C" });
    expect(refuse("oC", "2*pasu1+pasu2")).toEqual({ error: "temperature", unit: "°C" });
    expect(buildJob({ formula: "2*pasu1", slots: [{ tokens: [{ prefix: "k", unit: "dB" }] }] }, table)).toEqual({ error: "logarithmic", unit: "dB" });
    expect(refuse("hp", "2*pasu1")).toEqual({ error: "nofactor", unit: "hp" });
    expect(unitErrorMessage({ error: "nofactor", unit: "hp" })).toBe("No exact factor for hp yet");
    expect(unitErrorMessage({ error: "temperature", unit: "°C" })).toBe("Use K or Δ°C for a temperature difference");
    expect(unitErrorMessage({ error: "logarithmic", unit: "dB" })).toBe("dB converts only");
  });
  it("an absolute temperature or a logarithmic unit alone is its kelvin or ratio value; at the end, offset or level", () => {
    const one = (u: string, formula = "20*pasu1") => buildJob({ formula, slots: [{ tokens: [{ unit: u }] }] }, table);
    expect(one("oC")).toEqual({ expr: "(((1)*(20)+(5463/20))*pasdimK^(1))", inexact: false, absTemp: true });
    expect(one("oC", "-(1+2)*3*pasu1")).toMatchObject({ expr: "(((1)*(-(1+2)*3)+(5463/20))*pasdimK^(1))" });
    expect(one("dB", "pasu1")).toEqual({ error: "logarithmic", unit: "dB" });
    expect(one("Np", "3*pasu1")).toEqual({ error: "logarithmic", unit: "Np" });
    expect(one("dBm", "3*pasu1")).toMatchObject({ expr: expect.stringContaining("pasup((3)/10)") });
    expect(one("oC", "1.5e-3*pasu1")).toMatchObject({ expr: expect.stringContaining("(1.5e-3)") });
    expect(one("oC", "2e3-1*pasu1")).toMatchObject({ error: "temperature" });
    expect(one("oC", "pasupm(20,0.5)*pasu1")).toMatchObject({ absTemp: true, inexact: true, unc: { vars: [{ name: "pasv1", value: "20", sigma: "0.5" }] } });
    expect(one("oC", "pasupm(20,0.5)*pasu1")).toMatchObject({ expr: expect.stringContaining("(20)") });
    expect(one("oC", "pasupm(20,0.5)*2*pasu1")).toMatchObject({ error: "temperature" });
    expect(one("dB", "pasupm(3,0.1)*pasu1")).toEqual({ error: "logarithmic", unit: "dB" });
    const to = (u: string) => buildJob({ formula: "2*pasu1", slots: [{ tokens: [{ unit: "m" }] }], end: { tokens: [{ unit: u }] } }, table);
    expect(to("oC")).toMatchObject({ end: "((1)*pasdimK^(1))", endOffset: "5463/20" });
    expect(to("dBm")).toMatchObject({ end: "((1/1000)*pasdimM^(1)*pasdimL^(2)*pasdimT^(-3))", endLog: "10*log10(pasux)" });
    expect(to("Np")).toMatchObject({ endLog: "ln(pasux)" });
    expect(buildJob({ formula: "2*pasu1", slots: [{ tokens: [{ unit: "m" }] }], end: { tokens: [{ unit: "dB" }, { unit: "m" }] } }, table)).toEqual({ error: "logarithmic", unit: "dB" });
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
    expect(unitErrorMessage({ error: "cycle", unit: "rpm" })).toBe("rpm counts turns: write tr/min for an angular speed");
    expect(unitErrorMessage({ error: "cycle", unit: "rev" })).toBe("rev counts turns: write tr for an angle");
  });
});

describe("uncertain inputs (G18)", () => {
  it("pasupm(value,sigma) is a symbol for the worker and its value for the nominal text", () => {
    const job = buildJob({ formula: "pasupm(12.34,0.05)*pasu1*pasupm(3.2,0.1)*pasu2", slots: [{ tokens: [{ unit: "m" }] }, { tokens: [{ unit: "m" }] }] }, table);
    if ("error" in job) throw new Error(job.error);
    expect(job.inexact).toBe(true);
    expect(job.unc?.vars).toEqual([{ name: "pasv1", value: "12.34", sigma: "0.05" }, { name: "pasv2", value: "3.2", sigma: "0.1" }]);
    expect(job.unc?.expr).toBe("pasv1*(((1)*pasdimL^(1)))*pasv2*(((1)*pasdimL^(1)))");
    expect(job.expr).toBe("(12.34)*(((1)*pasdimL^(1)))*(3.2)*(((1)*pasdimL^(1)))");
  });
  it("commas inside the value and a nested call are kept apart", () => {
    const job = buildJob({ formula: "pasupm(max(1,2),0.1)*pasu1", slots: [{ tokens: [{ unit: "m" }] }] }, table);
    if ("error" in job) throw new Error(job.error);
    expect(job.unc?.vars[0]).toEqual({ name: "pasv1", value: "max(1,2)", sigma: "0.1" });
  });
  it("a constant with a CODATA uncertainty is an input once, however often it is used; c has none", () => {
    const job = buildJob({ formula: "pask1*pask1*pask2", slots: [], consts: ["G", "c"] }, table);
    if ("error" in job) throw new Error(job.error);
    expect(job.unc?.vars).toEqual([{ name: "pasv1", value: "6.67430E-11", sigma: "1.5E-15" }]);
    expect(job.unc?.expr).toBe("(pasv1*pasdimM^(-1)*pasdimL^(3)*pasdimT^(-2))*(pasv1*pasdimM^(-1)*pasdimL^(3)*pasdimT^(-2))*((299792458)*pasdimL^(1)*pasdimT^(-1))");
  });
  it("a value without ± has no uncertainty; a malformed ± is refused", () => {
    const job = buildJob({ formula: "12.34*pasu1", slots: [{ tokens: [{ unit: "m" }] }] }, table);
    if ("error" in job) throw new Error(job.error);
    expect(job.unc).toBeUndefined();
    expect(job.inexact).toBe(false);
    expect("error" in buildJob({ formula: "pasupm(1)*pasu1", slots: [{ tokens: [{ unit: "m" }] }] }, table)).toBe(true);
  });
});

describe("the dimension check's text (G35)", () => {
  const m = { tokens: [{ unit: "m" }] };
  const s = { tokens: [{ unit: "s" }] };
  const M = "(((1)*pasdimL^(1)))";
  const T = "(((1)*pasdimT^(1)))";
  const job = (formula: string, slots = [m, s], end?: typeof m) => {
    const j = buildJob({ formula, slots, ...(end ? { end } : {}) }, table);
    if ("error" in j) throw new Error(unitErrorMessage(j));
    return j;
  };
  it("each term with a slot gets its own symbol for its numbers, so 0 m + 1 s keeps both terms", () => {
    const j = job("0*pasu1+1*pasu2");
    expect(j.expr).toBe(`0*${M}+1*${T}`);
    expect(j.check).toBe(`pasz1*${M}+pasz2*${T}`);
    expect(j.checkSum).toBe(true);
  });
  it("terms that cancel, a slot alone, a bracketed 0 and a ± value each get one", () => {
    expect(job("5*pasu1-5*pasu1+pasu2").check).toBe(`pasz1*${M}-pasz2*${M}+pasz3*${T}`);
    expect(job("(5-5)*pasu1+pasu2").check).toBe(`pasz1*${M}+pasz2*${T}`);
    expect(job("pasupm(0,0.1)*pasu1", [m]).check).toBe(`pasz1*${M}`);
  });
  it("a number below the ÷ goes too; a minus in front and E notation stay one term", () => {
    expect(job("1*pasu1/(0*pasu2)").check).toBe(`pasz2*${M}/(pasz1*${T})`);
    expect(job("-1.5e-3*pasu1", [m]).check).toBe(`-pasz1*${M}`);
    expect(job("-1.5e-3*pasu1", [m]).checkSum).toBeUndefined();
  });
  it("inside a function each argument is checked; a power without a slot is kept", () => {
    expect(job("max(1*pasu1,50*pasu2)", [m, m]).check).toBe(`pasz3*max(pasz1*${M},pasz2*${M})`);
    expect(job("max(1*pasu1,50*pasu2)", [m, m]).checkSum).toBeUndefined();
    expect(job("pasu1^(pasupm(2,0.1))", [m]).check).toBe(`pasz1*${M}^((2))`);
    expect(job("(2*pasu1)^(1/2)+3*pasu2^(1/2)", [m, m]).check).toBe(`pasz2*(pasz1*${M})^(1/2)+pasz3*${M}^(1/2)`);
  });
  it("−(5 °C) is told to put the minus on the number; −5 °C converts", () => {
    const oC = { tokens: [{ unit: "oC" }] };
    const r = buildJob({ formula: "-(5*pasu1)", slots: [oC] }, table);
    expect("error" in r && unitErrorMessage(r)).toBe("Put the minus on the number: −5 °C, not −(5 °C)");
    const pm = buildJob({ formula: "-(pasupm(20,0.5)*pasu1)", slots: [oC] }, table);
    expect("error" in pm && pm.error).toBe("minus");
    expect("error" in buildJob({ formula: "-5*pasu1", slots: [oC] }, table)).toBe(false);
    const sum = buildJob({ formula: "-(5*pasu1)+2", slots: [oC] }, table);
    expect("error" in sum && sum.error).toBe("temperature");
  });
});
