// SPDX-License-Identifier: GPL-3.0-or-later
// R24a: the slot model, one test per rule of docs/research/r9-unit-pad.md sections 2.2–2.6, the refusals with their
// i18n messages, the LaTeX and the reading (S1 guard 3), and the 50 units of tools/probes/unit-presses.mjs and every
// expression of tools/probes/unit-weights.yaml typed as the probe's typePad types them.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";
import type { IndexItem } from "../find/types.ts";
import { unitText } from "../i18n/enUnits.ts";
import { SlotModel, slotCatalogue, type PadAction, type SlotCatalogue } from "./slot.ts";
import type { UnitSlot } from "./types.ts";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "../../..");

const unit = (id: string, sym: string, title: string, si?: string, dim?: string): IndexItem =>
  ({ id: `unit:${id}`, kind: "unit", names: [id], title, tier: 0, insert: `\\unit{${id}}{\\mathrm{${sym}}}`,
    ...(si !== undefined ? { si } : {}), ...(dim !== undefined ? { dim } : {}) });
const pfx = (id: string, sym: string, title: string, si?: string): IndexItem =>
  ({ id: `pfx:${id}`, kind: "pfx", names: [id], title, tier: 0, insert: `\\pfx{${id}}{\\mathrm{${sym}}}`, ...(si !== undefined ? { si } : {}) });

// Items as the Find index writes them (titles, inserts, si and dim copied from the generated index, 2026-10-18).
const ITEMS: IndexItem[] = [
  pfx("k", "k", "Kilo (10^3)", "1000"), pfx("M", "M", "Mega (10^6)", "1000000"), pfx("m", "m", "Milli (10^-3)", "1/1000"),
  pfx("u", "µ", "Micro (10^-6)", "1/1000000"), pfx("n", "n", "Nano (10^-9)", "1/1000000000"), pfx("G", "G", "Giga (10^9)", "1000000000"),
  pfx("d", "d", "Deci (10^-1)", "1/10"),
  unit("m", "m", "Meter", "1", "m1"), unit("km", "km", "Kilometer", "1000", "m1"), unit("mm", "mm", "Millimeter", "1/1000", "m1"),
  unit("N", "N", "Newton", "1", "kg1m1s-2"), unit("kN", "kN", "Kilonewton", "1000", "kg1m1s-2"), unit("s", "s", "Second", "1", "s1"),
  unit("ms", "ms", "Millisecond", "1/1000", "s1"), unit("h", "h", "Hour", "3600", "s1"),
  unit("J", "J", "Joule", "1", "kg1m2s-2"), unit("g", "g", "Gram", "1/1000", "kg1"), unit("kg", "kg", "Kilogram", "1", "kg1"),
  unit("K", "K", "Kelvin", "1", "K1"), unit("V", "V", "Volt", "1", "A-1kg1m2s-3"), unit("Hz", "Hz", "Hertz", "1", "s-1"),
  unit("Pa", "Pa", "Pascal", "1", "kg1m-1s-2"), unit("MPa", "MPa", "Megapascal", "1000000", "kg1m-1s-2"),
  unit("ohm", "Ω", "Ohm", "1", "A-2kg1m2s-3"), unit("kohm", "kΩ", "Kiloohm (kΩ)", "1000", "A-2kg1m2s-3"),
  unit("oC", "°C", "Degree Celsius", "1+5463/20", "K1"), unit("deg", "1°", "Degree", "pi/180", "rad1"),
  unit("s_ton", "s_ton", "Short Ton", "45359237/50000", "kg1"), unit("Wh", "W\\cdot\\,h", "Watt hour", "3600", "kg1m2s-2"),
  unit("W", "W", "Watt", "1", "kg1m2s-3"), unit("kWh", "kW\\cdot\\,h", "Kilowatt hour", "3600000", "kg1m2s-2"),
  unit("um", "µm", "Micrometer", "1/1000000", "m1"),
  // Pairs whose ids are other units (R24af1): m + in is min, d + B is dB, n + mi is nmi.
  unit("in", "in", "Inch", "127/5000", "m1"), unit("min", "min", "Minute", "60", "s1"), unit("B", "B", "Byte (8-bit)", "8", "bit1"),
  unit("dB", "dB", "Decibel", undefined, "Np1"), unit("mi", "mi", "Mile", "201168/125", "m1"),
  unit("nmi", "nmi", "Nautical Mile", "1852", "m1"),
  // A pair with pi in its factor (kcmil is k + cmil).
  unit("cmil", "cmil", "Circular Mil", "16129*pi/10^14", "m2"), unit("kcmil", "kcmil", "Thousand of Circular Mil", "16129*pi/10^11", "m2"),
];
const CAT = slotCatalogue(ITEMS);

const P = (id: string): PadAction => ({ do: "prefix", id });
const U = (id: string): PadAction => ({ do: "unit", id });
const PER: PadAction = { do: "per" };
const POW = (n: 2 | 3 | 4 | -1): PadAction => ({ do: "power", n });
const SQRT: PadAction = { do: "sqrt" };
const DEL: PadAction = { do: "delete" };

function typed(actions: readonly PadAction[], cat: SlotCatalogue = CAT): SlotModel {
  const s = new SlotModel(cat);
  for (const a of actions) {
    const r = s.apply(a);
    if (!r.ok) throw new Error(`${JSON.stringify(a)} refused: ${r.message}`);
  }
  return s;
}
const slotOf = (...a: PadAction[]): UnitSlot => typed(a).slot;

describe("r9 2.2: a prefix arms", () => {
  it("the next unit takes it", () => {
    const s = typed([P("k")]);
    expect(s.armed).toEqual({ prefix: "k", sqrt: false });
    expect(s.slot).toEqual({ tokens: [] });
    s.apply(U("N"));
    expect(s.slot).toEqual({ tokens: [{ prefix: "k", unit: "N" }] });
    expect(s.armed).toEqual({ sqrt: false });
  });
  it("another prefix replaces it", () => {
    expect(slotOf(P("k"), P("M"), U("Pa"))).toEqual({ tokens: [{ prefix: "M", unit: "Pa" }] });
  });
  it("the same prefix again disarms it", () => {
    const s = typed([P("m"), P("m")]);
    expect(s.armed).toEqual({ sqrt: false });
    s.apply(U("m"));
    expect(s.slot).toEqual({ tokens: [{ unit: "m" }] });
  });
  it("is used once: the unit after the next is bare", () => {
    expect(slotOf(P("k"), U("N"), U("m"))).toEqual({ tokens: [{ prefix: "k", unit: "N" }, { unit: "m" }] });
  });
  it("is shown highlighted in the LaTeX", () => {
    expect(typed([U("N"), P("k")]).latex).toBe("\\mathrm{N}\\cdot\\class{pas-armed}{\\mathrm{k}}");
  });
});

describe("r9 2.3: units in a row multiply", () => {
  it("N, m is N·m and the prefix m then s is ms", () => {
    expect(slotOf(U("N"), U("m"))).toEqual({ tokens: [{ unit: "N" }, { unit: "m" }] });
    expect(slotOf(P("m"), U("s"))).toEqual({ tokens: [{ prefix: "m", unit: "s" }] });
    expect(typed([U("N"), U("m")]).latex).toBe("\\mathrm{N}\\cdot\\mathrm{m}");
  });
});

describe("r9 2.4: ÷ makes the rest of the slot the denominator", () => {
  it("J ÷ k g K is J/(kg·K)", () => {
    const s = typed([U("J"), PER, P("k"), U("g"), U("K")]);
    expect(s.slot).toEqual({ tokens: [{ unit: "J" }, { prefix: "k", unit: "g" }, { unit: "K" }], per: 1 });
    expect(s.latex).toBe("\\frac{\\mathrm{J}}{\\mathrm{k}\\mathrm{g}\\cdot\\mathrm{K}}");
  });
  it("on an empty slot it means 1/…: the slot has the powers negated and no ÷ (the evaluator wants a numerator)", () => {
    const s = typed([PER, U("s")]);
    expect(s.slot).toEqual({ tokens: [{ unit: "s", power: "-1" }] });
    expect(s.latex).toBe("\\frac{1}{\\mathrm{s}}");
  });
  it("a ÷ with nothing after it yet shows an empty denominator and is left out of the slot", () => {
    const s = typed([U("m"), PER]);
    expect(s.slot).toEqual({ tokens: [{ unit: "m" }] });
    expect(s.latex).toBe("\\frac{\\mathrm{m}}{\\class{pas-empty}{\\square}}");
  });
  it("a second ÷ is refused with the i18n message, and the slot is unchanged", () => {
    const s = typed([U("m"), PER, U("s")]);
    const r = s.apply(PER);
    expect(r).toEqual({ ok: false, key: "units.slot.secondPer", message: unitText("units.slot.secondPer") });
    expect(s.slot).toEqual({ tokens: [{ unit: "m" }, { unit: "s" }], per: 1 });
  });
});

describe("r9 2.5: powers act on the unit before, √ on the unit after", () => {
  it("², ³ and ⁴ act on the unit before", () => {
    expect(slotOf(U("m"), POW(2))).toEqual({ tokens: [{ unit: "m", power: "2" }] });
    expect(slotOf(P("k"), U("g"), U("m"), POW(3))).toEqual({ tokens: [{ prefix: "k", unit: "g" }, { unit: "m", power: "3" }] });
    expect(slotOf(U("s"), POW(4))).toEqual({ tokens: [{ unit: "s", power: "4" }] });
  });
  it("⁻¹ acts on the unit before, and turns a power's sign: K⁻¹, m²⁻¹ = m⁻²", () => {
    expect(slotOf(U("K"), POW(-1))).toEqual({ tokens: [{ unit: "K", power: "-1" }] });
    expect(slotOf(U("m"), POW(2), POW(-1))).toEqual({ tokens: [{ unit: "m", power: "-2" }] });
    expect(slotOf(U("m"), POW(-1), POW(3))).toEqual({ tokens: [{ unit: "m", power: "-3" }] });
  });
  it("a power below the ÷ belongs to its unit: m/s²", () => {
    const s = typed([U("m"), PER, U("s"), POW(2)]);
    expect(s.slot).toEqual({ tokens: [{ unit: "m" }, { unit: "s", power: "2" }], per: 1 });
    expect(s.latex).toBe("\\frac{\\mathrm{m}}{\\mathrm{s}^{2}}");
  });
  it("the prefix is inside the power: k m ² is (km)²", () => {
    const s = typed([P("k"), U("m"), POW(2)]);
    expect(s.slot).toEqual({ tokens: [{ prefix: "k", unit: "m", power: "2" }] });
    expect(s.latex).toBe("\\mathrm{k}\\mathrm{m}^{2}");
  });
  it("√ acts on the unit after: n V ÷ √ Hz is nV/√Hz (nV is no Find item, so it is marked)", () => {
    const s = typed([P("n"), U("V"), PER, SQRT, U("Hz")]);
    expect(s.slot).toEqual({ tokens: [{ prefix: "n", unit: "V" }, { unit: "Hz", power: "1/2" }], per: 1 });
    expect(s.latex).toBe("\\frac{\\class{pas-rare}{\\mathrm{n}\\mathrm{V}}}{\\sqrt{\\mathrm{Hz}}}");
  });
  it("√ takes the prefix with it, and a power after it multiplies: √ k Hz ³ is (kHz)^(3/2)", () => {
    expect(slotOf(SQRT, P("k"), U("Hz"))).toEqual({ tokens: [{ prefix: "k", unit: "Hz", power: "1/2" }] });
    expect(slotOf(SQRT, U("Hz"), POW(3))).toEqual({ tokens: [{ unit: "Hz", power: "3/2" }] });
    expect(slotOf(SQRT, U("Hz"), POW(2))).toEqual({ tokens: [{ unit: "Hz" }] });
    expect(slotOf(SQRT, U("Hz"), POW(-1))).toEqual({ tokens: [{ unit: "Hz", power: "-1/2" }] });
  });
  it("√ again disarms it, as a prefix", () => {
    expect(slotOf(SQRT, SQRT, U("Hz"))).toEqual({ tokens: [{ unit: "Hz" }] });
  });
  it("a power with no unit before it is refused: on an empty slot, after ÷, after an armed prefix or √", () => {
    for (const before of [[], [U("m"), PER], [U("m"), P("k")], [U("m"), SQRT]] as PadAction[][]) {
      const s = typed(before);
      const was = s.latex;
      const r = s.apply(POW(2));
      expect(r.ok).toBe(false);
      expect(s.latex).toBe(was);
    }
    expect(typed([]).apply(POW(-1))).toEqual({ ok: false, key: "units.slot.powerAlone", message: unitText("units.slot.powerAlone") });
    expect(typed([U("m"), P("k")]).apply(POW(2))).toMatchObject({ key: "units.slot.prefixAlone" });
  });
});

describe("r9 2.6: ⌫ removes the last token", () => {
  it("a power", () => {
    expect(typed([U("m"), POW(2), DEL]).slot).toEqual({ tokens: [{ unit: "m" }] });
    expect(typed([SQRT, U("Hz"), POW(3), DEL]).slot).toEqual({ tokens: [{ unit: "Hz", power: "1/2" }] });
  });
  it("a unit, leaving its prefix armed as it was typed", () => {
    const s = typed([U("N"), P("k"), U("m"), DEL]);
    expect(s.slot).toEqual({ tokens: [{ unit: "N" }] });
    expect(s.armed).toEqual({ prefix: "k", sqrt: false });
  });
  it("a prefix, then √, in the reverse order of the presses", () => {
    const s = typed([SQRT, P("k"), U("Hz"), DEL]);
    expect(s.armed).toEqual({ prefix: "k", sqrt: true });
    s.apply(DEL);
    expect(s.armed).toEqual({ sqrt: true });
    s.apply(DEL);
    expect(s.armed).toEqual({ sqrt: false });
    expect(s.empty).toBe(true);
  });
  it("the ÷", () => {
    const s = typed([U("m"), PER, DEL]);
    expect(s.latex).toBe("\\mathrm{m}");
    s.apply(PER); // one ÷ again is allowed
    s.apply(U("s"));
    expect(s.slot).toEqual({ tokens: [{ unit: "m" }, { unit: "s" }], per: 1 });
  });
  it("down to an empty slot, and on an empty slot nothing", () => {
    const s = typed([U("J"), PER, P("k"), U("g"), POW(2)]);
    for (let i = 0; i < 5; i++) s.apply(DEL);
    expect(s.empty).toBe(true);
    expect(s.apply(DEL)).toEqual({ ok: true });
    expect(s.slot).toEqual({ tokens: [] });
  });
});

describe("refusals (r7 5.4 guard 5, the SI's one solidus)", () => {
  it("a prefix alone cannot leave the slot, nor take a ÷", () => {
    const s = typed([P("k")]);
    expect(s.check()).toEqual({ ok: false, key: "units.slot.prefixAlone", message: unitText("units.slot.prefixAlone") });
    expect(s.apply(PER)).toMatchObject({ ok: false, key: "units.slot.prefixAlone" });
    expect(typed([U("N"), P("k")]).check()).toMatchObject({ ok: false, key: "units.slot.prefixAlone" });
  });
  it("a √ alone and a ÷ with nothing after it cannot leave the slot", () => {
    expect(typed([SQRT]).check()).toMatchObject({ ok: false, key: "units.slot.rootAlone" });
    expect(typed([U("m"), SQRT]).apply(PER)).toMatchObject({ ok: false, key: "units.slot.rootAlone" });
    expect(typed([U("m"), PER]).check()).toMatchObject({ ok: false, key: "units.slot.perEmpty" });
    expect(typed([PER]).check()).toMatchObject({ ok: false, key: "units.slot.perEmpty" });
  });
  it("a whole slot and an empty one can leave", () => {
    expect(typed([U("m"), PER, U("s")]).check()).toEqual({ ok: true });
    expect(typed([]).check()).toEqual({ ok: true });
  });
  it("an id outside Find's list is refused (guard 1: the slot holds Find ids only)", () => {
    const s = typed([]);
    expect(s.apply(U("furlong"))).toEqual({ ok: false, key: "units.slot.unknown", message: unitText("units.slot.unknown", { unit: "furlong" }) });
    expect(s.apply(P("Z"))).toMatchObject({ ok: false, key: "units.slot.unknown" });
    expect(s.empty).toBe(true);
  });
});

describe("the reading in words (r7 5.4 guards 2 and 3)", () => {
  it("names the unit from Find's titles, a pair in Find's list by its own title", () => {
    expect(typed([P("k"), U("N"), U("m")]).reading).toEqual({
      text: "kilonewton meter", marked: false,
      parts: [{ text: "kilonewton", marked: false }, { text: "meter", marked: false }],
    });
    expect(typed([P("k"), U("ohm")]).reading.text).toBe("kiloohm");
    expect(typed([U("oC")]).reading.text).toBe("degree Celsius");
  });
  it("marks a prefixed pair outside Find's list (Mm, Ms) and not its neighbour (mm, ms)", () => {
    expect(typed([P("M"), U("m")]).reading).toEqual({ text: "megameter", marked: true, parts: [{ text: "megameter", marked: true }] });
    expect(typed([P("m"), U("m")]).reading.marked).toBe(false);
    expect(typed([P("M"), U("s")]).reading.marked).toBe(true);
    expect(typed([P("M"), U("Pa"), PER, U("m")]).reading.marked).toBe(false);
  });
  it("marks a pair whose id is another unit (m + in is not min, d + B is not dB, n + mi is not nmi): R24af1", () => {
    expect(typed([P("m"), U("in")]).reading).toEqual({ text: "milliinch", marked: true, parts: [{ text: "milliinch", marked: true }] });
    expect(typed([P("d"), U("B")]).reading).toEqual({ text: "decibyte", marked: true, parts: [{ text: "decibyte", marked: true }] });
    expect(typed([P("n"), U("mi")]).reading).toEqual({ text: "nanomile", marked: true, parts: [{ text: "nanomile", marked: true }] });
    expect(typed([P("m"), U("in")]).latex).toBe("\\class{pas-rare}{\\mathrm{m}\\mathrm{in}}");
    expect(typed([P("n"), U("mi")]).latex).toBe("\\class{pas-rare}{\\mathrm{n}\\mathrm{mi}}");
  });
  it("still names a true pair by its own title, the factors compared exactly (k + m, M + Pa, k + cmil with pi)", () => {
    expect(typed([P("k"), U("m")]).reading).toEqual({ text: "kilometer", marked: false, parts: [{ text: "kilometer", marked: false }] });
    expect(typed([P("M"), U("Pa")]).reading.marked).toBe(false);
    expect(typed([P("k"), U("cmil")]).reading).toMatchObject({ text: "thousand of circular mil", marked: false });
    expect(typed([P("k"), U("m")]).latex).toBe("\\mathrm{k}\\mathrm{m}");
  });
  it("a catalogue without si or dim counts no pair (nothing to check it against)", () => {
    const bare = slotCatalogue([pfx("k", "k", "Kilo (10^3)"), unit("m", "m", "Meter"), unit("km", "km", "Kilometer")]);
    expect(typed([P("k"), U("m")], bare).reading).toMatchObject({ text: "kilometer", marked: true });
  });
  it("lower-cases a title-case title's later words, keeping acronyms and names (Nautical Mile, U.S., Celsius)", () => {
    expect(typed([U("nmi")]).reading.text).toBe("nautical mile");
    expect(typed([U("s_ton")]).reading.text).toBe("short ton");
    const cat = slotCatalogue([unit("in_US", "in", "U.S. Survey Inch", "100/3937", "m1"), unit("tTNT", "t", "Ton of TNT", "4184000000", "kg1m2s-2")]);
    expect(typed([U("in_US")], cat).reading.text).toBe("U.S. survey inch");
    expect(typed([U("tTNT")], cat).reading.text).toBe("ton of TNT");
    expect(typed([U("oC")]).reading.text).toBe("degree Celsius");
  });
  it("reads ÷, powers and √: per, squared, cubed, the fourth, a square root", () => {
    expect(typed([U("J"), PER, P("k"), U("g"), U("K")]).reading.text).toBe("joule per kilogram kelvin");
    expect(typed([U("m"), PER, U("s"), POW(2)]).reading.text).toBe("meter per second squared");
    expect(typed([P("k"), U("g"), U("m"), POW(3)]).reading.text).toBe("kilogram meter cubed");
    expect(typed([U("s"), POW(4)]).reading.text).toBe("second to the fourth");
    expect(typed([P("n"), U("V"), PER, SQRT, U("Hz")]).reading.text).toBe("nanovolt per square root of hertz");
    expect(typed([U("K"), POW(-1)]).reading.text).toBe("per kelvin");
    expect(typed([PER, U("s")]).reading.text).toBe("per second");
  });
});

describe("the LaTeX shown", () => {
  it("uses the symbol of the chip, with the degree without its 1 and _ escaped", () => {
    expect(typed([U("deg")]).latex).toBe("\\mathrm{°}");
    expect(typed([U("s_ton")]).latex).toBe("\\mathrm{s\\_ton}");
    expect(typed([P("k"), U("Wh")]).latex).toBe("\\mathrm{k}\\mathrm{W\\cdot\\,h}");
    expect(typed([P("u"), U("m")]).latex).toBe("\\mathrm{µ}\\mathrm{m}");
  });
  it("marks a rare pair (the warning colour) and shows an armed √", () => {
    expect(typed([P("M"), U("m")]).latex).toBe("\\class{pas-rare}{\\mathrm{M}\\mathrm{m}}");
    expect(typed([SQRT]).latex).toBe("\\class{pas-armed}{\\sqrt{\\square}}");
  });
});

describe("restoring a slot (the line keeps its slots)", () => {
  it("a UnitSlot in gives the same UnitSlot out, and editing goes on from it", () => {
    const slot: UnitSlot = { tokens: [{ prefix: "n", unit: "V" }, { unit: "Hz", power: "1/2" }], per: 1 };
    const s = new SlotModel(CAT, slot);
    expect(s.slot).toEqual(slot);
    s.apply(DEL);
    expect(s.slot).toEqual({ tokens: [{ prefix: "n", unit: "V" }] });
    expect(s.armed).toEqual({ sqrt: true });
    expect(s.latex).toBe("\\frac{\\class{pas-rare}{\\mathrm{n}\\mathrm{V}}}{\\class{pas-armed}{\\sqrt{\\square}}}");
  });
  it("a power the pad cannot make is refused", () => {
    expect(() => new SlotModel(CAT, { tokens: [{ unit: "m", power: "1/3" }] })).toThrow();
    expect(() => new SlotModel(CAT, { tokens: [{ unit: "m" }], per: 2 })).toThrow();
  });
});

// ---- The probe's 50 units and S5's weights list, typed as typePad types them (tools/probes/unit-presses.mjs): the
// factors with a positive power, then ÷ and the rest; a product the pad has as one cell (Wh) as that cell. The model's
// tokens must mean the same prefixes, units and powers as typePad's `meant`.
interface Part { pfx: string | null; unit: string; exp: number }
interface Cell { tap?: string; up?: string; down?: string }
const pad = parse(readFileSync(join(root, "spec/unit-pad.yaml"), "utf8")) as { units: Cell[]; user: Cell[] };
const padUnits = new Set([...pad.units, ...pad.user].flatMap((c) => [c.tap, c.up, c.down]).filter((x): x is string => !!x));

/** typePad's tokens and its `meant` text for `parts`. */
function probeParts(parts: string): { toks: Part[]; meant: string } {
  const toks: Part[] = parts.split(" ").map((p) => {
    const [name = "", e] = p.split("^");
    const [a, b] = name.includes(":") ? name.split(":") : [null, name];
    return { pfx: a ?? null, unit: b ?? "", exp: e === undefined ? 1 : Number(e) };
  });
  for (let i = 0; i < toks.length; i++) for (let j = 0; j < toks.length; j++) {
    const a = toks[i], b = toks[j];
    if (i !== j && a && b && Math.abs(a.exp) === 1 && b.exp === a.exp && !b.pfx && padUnits.has(a.unit + b.unit)) {
      toks[i] = { ...a, unit: a.unit + b.unit };
      toks.splice(j, 1);
      if (j < i) i--;
    }
  }
  const meant = toks.map((t) => (t.pfx ? t.pfx + ":" : "") + t.unit + (t.exp === 1 ? "" : "^" + t.exp)).sort().join(" ");
  return { toks, meant };
}

/** The pad actions for typePad's tokens. */
function padActions(toks: readonly Part[]): PadAction[] {
  const out: PadAction[] = [];
  const factor = (t: Part, e: number): void => {
    if (e === 0.5) out.push(SQRT);
    if (t.pfx) out.push(P(t.pfx));
    out.push(U(t.unit));
    if (e !== 1 && e !== 0.5) out.push(POW(e as 2 | 3 | 4));
  };
  const num = toks.filter((t) => t.exp > 0), den = toks.filter((t) => t.exp < 0);
  for (const t of num) factor(t, t.exp);
  if (den.length) out.push(PER);
  for (const t of den) factor(t, -t.exp);
  return out;
}

/** The slot as typePad's `meant`: "pfx:unit^exp", the powers below the ÷ negated, sorted. */
function meantOf(slot: UnitSlot): string {
  const per = slot.per ?? slot.tokens.length;
  return slot.tokens.map((t, i) => {
    const e = Number(t.power ?? "1") * (i >= per ? -1 : 1);
    return (t.prefix ? t.prefix + ":" : "") + t.unit + (e === 1 ? "" : "^" + e);
  }).sort().join(" ");
}

const probe = readFileSync(join(root, "tools/probes/unit-presses.mjs"), "utf8");
const unitsBlock = /const UNITS = \[([\s\S]*?)\n\];/.exec(probe)?.[1] ?? "";
const PROBE_50 = [...unitsBlock.matchAll(/parts: '([^']+)'/g)].map((m) => m[1] ?? "");
const weights = parse(readFileSync(join(root, "tools/probes/unit-weights.yaml"), "utf8")) as {
  units: { id: string }[]; prefixes: { id: string }[]; expressions: { parts: string }[];
};
const WEIGHTED = [...weights.expressions.map((x) => x.parts), ...weights.units.map((u) => u.id)];

/** A catalogue with every id the lists use (titles and symbols are the ids; only the ids matter here). */
function catalogueFor(list: readonly string[]): SlotCatalogue {
  const units = new Set<string>(), prefixes = new Set<string>();
  for (const parts of list) for (const t of probeParts(parts).toks) {
    units.add(t.unit);
    if (t.pfx) prefixes.add(t.pfx);
  }
  return slotCatalogue([...[...units].map((u) => unit(u, u, u)), ...[...prefixes].map((p) => pfx(p, p, p))]);
}

describe("the probe's units and S5's weights list, typed on the pad", () => {
  it("the lists are read whole", () => {
    expect(PROBE_50).toHaveLength(50);
    expect(weights.expressions.length).toBeGreaterThan(200);
  });
  for (const [name, list] of [["the probe's 50", PROBE_50], ["S5's weights", WEIGHTED]] as const) {
    it(`${name}: the model's tokens mean typePad's parts`, () => {
      const cat = catalogueFor(list);
      const wrong: string[] = [];
      for (const parts of list) {
        const { toks, meant } = probeParts(parts);
        const s = typed(padActions(toks), cat);
        if (meantOf(s.slot) !== meant || !s.check().ok) wrong.push(`${parts}: ${meantOf(s.slot)} for ${meant}`);
      }
      expect(wrong).toEqual([]);
    });
  }
});
