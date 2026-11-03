// SPDX-License-Identifier: GPL-3.0-or-later
// The unit view's builder (G16): tokens → Giac text with the index's factors and the dimension symbols. A small table
// written here (factors as the index writes them), so the test runs without the generated index.
import { describe, expect, it } from "vitest";
import { buildJob, slotGiac } from "./build.ts";
import { chipName } from "../input/chip-giac.ts";
import { ANS_KEY } from "../input/chips.ts";
import { CHIP_PREFIX, isChipName } from "../engine/ourNames.ts";
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
  unit("dBm", undefined, "kg1m2s-3"), unit("hp", undefined, "kg1m2s-3"), unit("W", "1", "kg1m2s-3"), unit("Wh", "3600", "kg1m2s-2"),
  unit("VA", "1", "kg1m2s-3"), unit("var", "1", "kg1m2s-3"), unit("TR", "52752792631/15000000", "kg1m2s-3"), unit("A", "1", "A1"), unit("J", "1", "kg1m2s-2"), unit("kcal", "4184", "kg1m2s-2"), unit("Np", "1", "Np1"), unit("km/h", "5/18", "m1s-1"),
  pfx("k", "1000"), pfx("M", "1000000"), pfx("n", "1/1000000000"), pfx("u", "1/1000000", "µ"), pfx("Ki", "1024"),
  { id: "const:c", kind: "const", names: ["c"], title: "c", value: "299792458", dim: "m1s-1", tier: 0, insert: "\\const{c}{c}" },
  { id: "const:G", kind: "const", names: ["G"], title: "G", value: "6.67430E-11", unc: "1.5E-15", dim: "kg-1m3s-2", tier: 0, insert: "\\const{G}{G}" },
]);

describe("unit view builder (G16)", () => {
  it("takes the parser's degree factor (R64, G46): sin(pasdeg*30) and asin(1/2)/pasdeg are not a reserved name", () => {
    const sin = buildJob({ formula: "sin(pasdeg*(30*pasu1))", slots: [{ tokens: [{ unit: "deg" }] }] }, table);
    expect("error" in sin ? sin : sin.expr).toMatch(/^sin\(pasdeg\*\(30\*/);
    const asin = buildJob({ formula: "asin(1/2)/pasdeg", slots: [] }, table);
    expect("error" in asin ? asin : asin.expr).toBe("asin(1/2)/pasdeg");
    // another of our names stays refused
    expect(buildJob({ formula: "pasexp(1)", slots: [] }, table)).toMatchObject({ error: "engine" });
  });
  it("G40: a cycle unit on either side marks the job (no rad dropped); the degree's text is °, not the chip's 1°", () => {
    const deg = { tokens: [{ unit: "deg" }] };
    expect(buildJob({ formula: "30*pasu1", slots: [deg], end: { tokens: [{ unit: "rev" }] } }, table)).toMatchObject({ cycles: true });
    expect(buildJob({ formula: "30*pasu1", slots: [{ tokens: [{ prefix: "k", unit: "Hz" }] }] }, table)).toMatchObject({ cycles: true });
    const plain = buildJob({ formula: "30*pasu1*2*pasu2", slots: [deg, { tokens: [{ unit: "m" }] }], end: deg }, table);
    expect(plain).not.toHaveProperty("cycles");
    expect(plain).toMatchObject({ endUnit: "°" });
  });
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
      shows: [
        { text: "kN·m", dim: "kg1m2s-2", factor: "1000", slot: { tokens: [{ prefix: "k", unit: "N" }, { unit: "m" }] } },
        { text: "kN", dim: "kg1m1s-2", factor: "1000", slot: { tokens: [{ prefix: "k", unit: "N" }] } },
        { text: "m", dim: "m1", factor: "1", slot: { tokens: [{ unit: "m" }] } },
      ] });
  });
  it("G25: typed units that multiply to factor 1 are kept (N·m), the end slot is named", () => {
    const job = buildJob({ formula: "5*pasu1*2*pasu2", slots: [{ tokens: [{ unit: "N" }] }, { tokens: [{ unit: "m" }] }] }, table);
    expect((job as { shows: unknown[] }).shows[0]).toEqual({ text: "N·m", dim: "kg1m2s-2", factor: "1", slot: { tokens: [{ unit: "N" }, { unit: "m" }] } });
    // R60: the tokens as `text` reads them, the powers merged, the negative ones below the ÷
    const per = buildJob({ formula: "pasu1", slots: [{ tokens: [{ unit: "m" }, { unit: "s" }, { unit: "s" }], per: 1 }] }, table);
    expect((per as { shows: unknown[] }).shows[0]).toEqual({ text: "m/s²", dim: "m1s-2", factor: "1", slot: { tokens: [{ unit: "m" }, { unit: "s", power: "2" }], per: 1 } });
    const end = buildJob({ formula: "pasu1", slots: [{ tokens: [{ unit: "m" }, { unit: "s", power: "-1" }], per: 1 }], end: { tokens: [{ prefix: "k", unit: "m" }, { unit: "h" }], per: 1 } }, table);
    expect(end).toMatchObject({ endUnit: "km/h" });
  });
  it("G25f1: a product with at most one prefixed token is kept, two prefixes go to SI", () => {
    const kw = buildJob({ formula: "2*pasu1*3*pasu2", slots: [{ tokens: [{ prefix: "k", unit: "N" }] }, { tokens: [{ unit: "m" }] }] }, table);
    expect((kw as { shows: { text: string }[] }).shows[0]!.text).toBe("kN·m");
    const two = buildJob({ formula: "4.7*pasu1*2.2*pasu2", slots: [{ tokens: [{ prefix: "k", unit: "ohm" }] }, { tokens: [{ prefix: "n", unit: "F" }] }] }, table);
    expect(((two as { shows?: { text: string }[] }).shows ?? []).map((x) => x.text)).not.toContain("kΩ·nF");
  });
  it("G161: a job whose units name two of W, VA and var carries them (J counts as W); V·A and one kind alone carry none", () => {
    const one = (u: string, prefix?: string) => ({ tokens: [{ ...(prefix ? { prefix } : {}), unit: u }] });
    const conv = (from: ReturnType<typeof one>, to: ReturnType<typeof one>) => buildJob({ formula: "2*pasu1", slots: [from], end: to }, table);
    expect(conv(one("VA", "k"), one("W"))).toMatchObject({ powers: ["VA", "W"] });
    expect(conv(one("var", "k"), one("VA"))).toMatchObject({ powers: ["var", "VA"] });
    expect(conv(one("TR"), one("VA"))).toMatchObject({ powers: ["W", "VA"] });
    expect(conv(one("VA"), one("dBm"))).toMatchObject({ powers: ["VA", "W"] });
    // kVA·h is not kWh
    const kvah = buildJob({ formula: "2*pasu1*3*pasu2", slots: [one("VA", "k"), one("h")], end: one("Wh", "k") }, table);
    expect(kvah).toMatchObject({ powers: ["VA", "W"] });
    // a unit of energy is real energy: kVA·h is not MJ either, and VA is not J (fix round 1)
    const kvahJ = buildJob({ formula: "2*pasu1*3*pasu2", slots: [one("VA", "k"), one("h")], end: one("J", "M") }, table);
    expect(kvahJ).toMatchObject({ powers: ["VA", "W"] });
    expect(conv(one("VA"), one("J"))).toMatchObject({ powers: ["VA", "W"] });
    expect(conv(one("var", "k"), one("kcal"))).toMatchObject({ powers: ["var", "W"] });
    // a sum of real and reactive power, no end slot
    expect(buildJob({ formula: "3*pasu1+4*pasu2", slots: [one("W", "k"), one("var", "k")] }, table)).toMatchObject({ powers: ["W", "var"] });
    for (const ok of [conv(one("VA", "k"), one("VA")), conv(one("var"), one("var", "k")), conv(one("W", "k"), one("TR")),
      buildJob({ formula: "230*pasu1*2*pasu2", slots: [one("V"), one("A")], end: one("VA") }, table),
      buildJob({ formula: "230*pasu1*2*pasu2*3*pasu3", slots: [one("V"), one("A"), one("s")], end: one("J") }, table),
      buildJob({ formula: "5*pasu1*2*pasu2", slots: [one("N"), one("m")], end: one("J") }, table),
      buildJob({ formula: "2*pasu1*3*pasu2", slots: [one("W", "k"), one("h")], end: one("J", "M") }, table)]) {
      expect("error" in ok).toBe(false);
      expect(ok).not.toHaveProperty("powers");
    }
    expect(unitErrorMessage({ error: "power" })).toBe("VA, var and W differ by the power factor");
  });
  it("G161 fix 2: a product or quotient of kinds of power (P/S, Q/P) is a number, not a conversion: no powers; a sum keeps them", () => {
    const one = (u: string, prefix?: string) => ({ tokens: [{ ...(prefix ? { prefix } : {}), unit: u }] });
    const job = (formula: string, slots: ReturnType<typeof one>[], end?: ReturnType<typeof one>) => buildJob({ formula, slots, ...(end ? { end } : {}) }, table);
    for (const ok of [job("3*pasu1/(5*pasu2)", [one("W", "k"), one("VA", "k")]), job("4*pasu1/(3*pasu2)", [one("var", "k"), one("W", "k")]),
      job("4*pasu1/(5*pasu2)", [one("var", "k"), one("VA", "k")]), job("atan2(4*pasu1,3*pasu2)", [one("var", "k"), one("W", "k")], one("deg")),
      job("2*pasu1*3*pasu2/(4*pasu3)", [one("VA", "k"), one("h"), one("W", "k")], one("s"))]) {
      expect("error" in ok).toBe(false);
      expect(ok).not.toHaveProperty("powers");
    }
    // a sum inside a bracket, or a minus, still mixes them; an end slot of another kind too
    expect(job("(3*pasu1+4*pasu2)*2", [one("W", "k"), one("var", "k")])).toMatchObject({ powers: ["W", "var"] });
    expect(job("3*pasu1-4*pasu2/(5*pasu3)*pasu3", [one("W", "k"), one("var", "k"), one("h")])).toMatchObject({ powers: ["W", "var"] });
    expect(job("3*pasu1/(5*pasu2)*pasu2", [one("W", "k"), one("VA", "k")], one("W"))).toMatchObject({ powers: ["W", "VA"] });
  });
  it("G161f1 (Opus pass 60, decided): a sum whose terms name different kinds is refused, P/S + Q/S and √(P² + Q²) included", () => {
    const one = (u: string, prefix?: string) => ({ tokens: [{ ...(prefix ? { prefix } : {}), unit: u }] });
    const job = (formula: string, slots: ReturnType<typeof one>[], end?: ReturnType<typeof one>) => buildJob({ formula, slots, ...(end ? { end } : {}) }, table);
    // kinds read from the text cannot tell a ratio from a power in disguise (3 kW + 2 kVA·4 kvar/(1 kvar) adds S to P)
    expect(job("3*pasu1/(5*pasu2)+4*pasu3/(5*pasu4)", [one("W", "k"), one("VA", "k"), one("var", "k"), one("VA", "k")])).toMatchObject({ powers: ["W", "VA", "var"] });
    expect(job("3*pasu1+2*pasu2*4*pasu3/(1*pasu4)", [one("W", "k"), one("VA", "k"), one("var", "k"), one("var", "k")])).toMatchObject({ powers: ["W", "VA", "var"] });
    expect(job("sqrt((3*pasu1)^2+(4*pasu2)^2)", [one("W", "k"), one("var", "k")], one("VA", "k"))).toMatchObject({ powers: ["W", "var", "VA"] });
    expect(job("sqrt((3*pasu1)^2+(4*pasu2)^2)", [one("W", "k"), one("var", "k")])).toMatchObject({ powers: ["W", "var"] });
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
    // R115: a chip keeps its minus outside its call, as the parser writes −chip °C
    expect(one("oC", "(-pasupm((20),(1/2),pasr_1))*pasu1")).toMatchObject({ absTemp: true, unc: { expr: expect.stringContaining("(-pasv1)"), vars: [{ name: "pasv1", value: "(20)" }] } });
    expect(one("oC", "(-pasupm((20),(1/2),pasr_1))*pasu1")).toMatchObject({ expr: expect.stringContaining("(-((20)))") });
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
  it("G81: a constant with a basis enters as its basis, each leaf an input once, shared between constants", () => {
    const a = { fine_structure: { value: "7.3E-3", unc: "1E-12" }, exact_leaf: { value: "2", unc: "0" } };
    const t = factorTable([
      { id: "const:mu", kind: "const", names: ["mu"], title: "mu", value: "1.2E-6", unc: "2E-16", basis: "pasl_exact_leaf*pasl_fine_structure", basisLeaves: a, dim: "kg1", tier: 0, insert: "\\const{mu}{mu}" },
      { id: "const:eps", kind: "const", names: ["eps"], title: "eps", value: "8.8E-12", unc: "1E-21", basis: "1/pasl_fine_structure", basisLeaves: a, dim: "kg-1", tier: 0, insert: "\\const{eps}{eps}" },
    ]);
    const job = buildJob({ formula: "pask1*pask2", slots: [], consts: ["mu", "eps"] }, t);
    if ("error" in job) throw new Error(job.error);
    expect(job.unc?.vars).toEqual([{ name: "pasv1", value: "7.3E-3", sigma: "1E-12" }]);
    expect(job.unc?.expr).toBe("(((2)*pasv1)*pasdimM^(1))*((1/pasv1)*pasdimM^(-1))");
    expect(job.expr).toBe("(((2)*(7.3E-3))*pasdimM^(1))*((1/(7.3E-3))*pasdimM^(-1))");
  });
  it("R115: a chip's key makes one input per key, wherever the chip stands; a typed ± stays an input of its own", () => {
    const m = { tokens: [{ unit: "m" }] };
    const once = buildJob({ formula: "pasupm(12.34,0.05,pasr_1)*pasu1-pasupm(12.34,0.05,pasr_1)*pasu2", slots: [m, m] }, table);
    if ("error" in once) throw new Error(once.error);
    expect(once.unc?.vars).toEqual([{ name: "pasv1", value: "12.34", sigma: "0.05" }]);
    expect(once.unc?.expr).toBe("pasv1*(((1)*pasdimL^(1)))-pasv1*(((1)*pasdimL^(1)))");
    const two = buildJob({ formula: "pasupm(12.34,0.05,pasr_1)*pasu1-pasupm(12.34,0.05,pasr_2)*pasu2", slots: [m, m] }, table);
    if ("error" in two) throw new Error(two.error);
    expect(two.unc?.vars.map((v) => v.name)).toEqual(["pasv1", "pasv2"]);
    const typed = buildJob({ formula: "pasupm(12.34,0.05)*pasu1-pasupm(12.34,0.05)*pasu2", slots: [m, m] }, table);
    if ("error" in typed) throw new Error(typed.error);
    expect(typed.unc?.vars.map((v) => v.name)).toEqual(["pasv1", "pasv2"]);
    // one key with two values or a key that is not a chip's name is not the parser's: refused
    expect("error" in buildJob({ formula: "pasupm(1,0.1,pasr_1)*pasu1+pasupm(2,0.1,pasr_1)*pasu2", slots: [m, m] }, table)).toBe(true);
    expect("error" in buildJob({ formula: "pasupm(1,0.1,x)*pasu1", slots: [m] }, table)).toBe(true);
    expect("error" in buildJob({ formula: "pasupm(1,0.1,pasr_1,2)*pasu1", slots: [m] }, table)).toBe(true);
  });
  it("R115 (fix round 1): the key follows the parser's own chip names, from the one CHIP_PREFIX (P20, G145)", () => {
    const m = { tokens: [{ unit: "m" }] };
    // a pasr_ name the parser never writes is refused
    expect("error" in buildJob({ formula: "pasupm(1,0.1,pasr_foo)*pasu1", slots: [m] }, table)).toBe(true);
    expect("error" in buildJob({ formula: "pasupm(1,0.1,pasr_)*pasu1", slots: [m] }, table)).toBe(true);
    // every name chipName writes is a key: a result chip's and Ans's
    for (const k of ["res:7", ANS_KEY]) {
      const name = chipName(k)!;
      expect(name.startsWith(CHIP_PREFIX)).toBe(true);
      expect(isChipName(name)).toBe(true);
      const job = buildJob({ formula: `pasupm(1,0.1,${name})*pasu1+pasupm(1,0.1,${name})*pasu2`, slots: [m, m] }, table);
      if ("error" in job) throw new Error(job.error);
      expect(job.unc?.vars.map((v) => v.name)).toEqual(["pasv1"]);
    }
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
    expect("error" in r && unitErrorMessage(r)).toBe("Put the minus on the number, not before the bracket around °C");
    const pm = buildJob({ formula: "-(pasupm(20,0.5)*pasu1)", slots: [oC] }, table);
    expect("error" in pm && pm.error).toBe("minus");
    expect("error" in buildJob({ formula: "-5*pasu1", slots: [oC] }, table)).toBe(false);
    const sum = buildJob({ formula: "-(5*pasu1)+2", slots: [oC] }, table);
    expect("error" in sum && sum.error).toBe("temperature");
  });
});
