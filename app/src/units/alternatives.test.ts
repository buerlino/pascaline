// SPDX-License-Identifier: GPL-3.0-or-later
// R60: the unit result's alternatives as data (docs/archive/r17-unit-result.md sections 0.2 and 3). The quantities are
// the evaluator's for these inputs (r17 section 1, the golden units stage); the factors are the full Find index's, so
// every alternative's slot is checked to build a job. A tap is an end slot (withEnd); the golden units stage runs it.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";
import type { IndexItem } from "../find/types.ts";
import type { HomeResult } from "../engine/homeEval.ts";
import { requestOf, slotOf } from "../../scripts/unit-case.ts";
import { alternatives, readTargets, withEnd, writeTarget, UNIT_TARGETS, type AltContext } from "./alternatives.ts";
import { buildJob } from "./build.ts";
import { factorTable } from "./factors.ts";
import { padUnitCells, userUnitCells } from "./padCells.ts";
import { defaultUser } from "./pad.ts";
import { isUnitError, type Quantity, type UnitSlot } from "./types.ts";
import type { Kv } from "../state/storage.ts";

const here = dirname(fileURLToPath(import.meta.url));
const indexFile = join(here, "../find/_gen/find-index.json");
const items: IndexItem[] = existsSync(indexFile) ? (JSON.parse(readFileSync(indexFile, "utf8")) as IndexItem[]) : [];
const hasIndex = items.some((it) => it.kind === "unit");
const table = factorTable(items);
const pad = padUnitCells(parse(readFileSync(join(here, "../../../spec/unit-pad.yaml"), "utf8")));
const user = userUnitCells(defaultUser());

/** A quantity as the evaluator returns it for `input` (only what the row reads: the dimension, the unit shown and its
 *  slot, the SI unit with its prefix). */
function qty(dimension: string | null, unit: string, shown: string | UnitSlot | undefined, siPrefixed: string): Quantity {
  return {
    value: { display: "1" } as HomeResult,
    dimension,
    unit,
    dimensionText: null,
    ...(shown !== undefined ? { shownSlot: typeof shown === "string" ? slotOf(shown, table) : shown } : {}),
    siPrefixed,
    ms: 0,
  };
}

function row(q: Quantity, input: string, to?: string, target?: string): { texts: string[]; ctx: AltContext } {
  const ctx: AltContext = { table, pad, user, req: requestOf(input, to, table), ...(target ? { target: slotOf(target, table) } : {}) };
  return { texts: alternatives(q, ctx).map((a) => a.text), ctx };
}

/** Every alternative's slot as the end slot builds a job without a refusal. */
function allBuild(q: Quantity, ctx: AltContext): void {
  const alts = alternatives(q, ctx);
  expect(alts.length).toBeGreaterThan(0);
  for (const a of alts) {
    const job = buildJob(withEnd(ctx.req, a), table);
    expect(isUnitError(job) ? `${a.text}: ${JSON.stringify(job)}` : "ok").toBe("ok");
  }
}

const it_ = hasIndex || process.env["FIND_INDEX"] === "required" ? it : it.skip;

describe("the unit result's alternatives (R60)", () => {
  it_("L·T⁻¹ from 72 km/h: m/s first, then knot and mph, never km/h (shown)", () => {
    const q = qty("m1s-1", "km/h", "k:m / h", "m/s");
    const { texts, ctx } = row(q, "72*{k:m / h}");
    expect(texts.slice(0, 3)).toEqual(["m/s", "knot", "mph"]);
    expect(texts).not.toContain("km/h");
    expect(alternatives(q, ctx)[0]).toMatchObject({ kind: "si", slot: { tokens: [{ unit: "m" }, { unit: "s" }], per: 1 } });
    allBuild(q, ctx);
  });
  it_("L from 157.08 mm (t04): m first; mm (shown) is not offered again", () => {
    const q = qty("m1", "mm", "m:m", "mm");
    const { texts, ctx } = row(q, "2*pi*25*{m:m}");
    expect(texts[0]).toBe("m");
    expect(texts.slice(1)).toEqual(["ft", "in", "mi", "yd", "mil"]);
    allBuild(q, ctx);
  });
  it_("T from 10.34 µs: s, then h, min (the pad's time cell), then the user cell d", () => {
    const q = qty("s1", "µs", "u:s", "µs");
    const { texts, ctx } = row(q, "2.2*{n:F}*4.7*{k:ohm}");
    expect(texts.slice(0, 3)).toEqual(["s", "h", "min"]);
    expect(texts).toContain("d");
    expect(texts).not.toContain("µs");
    allBuild(q, ctx);
  });
  it_("L² from t10 (no cell of its own): the length cells squared, ft², in², mi², yd²", () => {
    // (the typed m·m merged, as build.ts shownUnits gives it; Find's own id `m^2` is another token)
    const q = qty("m2", "m²", { tokens: [{ unit: "m", power: "2" }] }, "m²");
    const { texts, ctx } = row(q, "pasupm(12.34,0.05)*{m}*pasupm(3.2,0.1)*{m}");
    expect(texts.slice(0, 4)).toEqual(["ft²", "in²", "mi²", "yd²"]);
    expect(texts).not.toContain("m²");
    allBuild(q, ctx);
  });
  it_("Θ from 20 °C (shown 293.15 K, absolute): °C, °F", () => {
    const q = qty("K1", "K", "K", "K");
    const { texts, ctx } = row(q, "20*{oC}");
    expect(texts).toEqual(["°C", "°F"]);
    allBuild(q, ctx);
    // a °C end slot is absolute too: K and °F
    expect(row(qty("K1", "°C", "oC", "K"), "20*{oC}", "oC").texts).toEqual(["K", "°F"]);
  });
  it_("Θ as an interval (K typed): K, Δ°C, Δ°F; never °C with its offset", () => {
    const q = qty("K1", "K", "K", "K");
    const { texts, ctx } = row(q, "5*{K}");
    expect(texts).toEqual(["Δ°C", "Δ°F"]);
    expect(alternatives(q, ctx).map((a) => a.slot.tokens[0]!.unit)).toEqual(["K", "oR"]);
    allBuild(q, ctx);
    expect(row(qty("K1", "°R", "oR", "K"), "9*{oR}").texts).toEqual(["K", "Δ°C"]);
  });
  it_("s⁻¹ gives Hz (the pad's tap unit) and never Bq", () => {
    const q = qty("s-1", "kHz", "k:Hz", "kHz");
    const { texts, ctx } = row(q, "1/(2*{u:s})");
    expect(texts[0]).toBe("Hz");
    expect(texts).toContain("rpm");
    expect(texts).not.toContain("Bq");
    allBuild(q, ctx);
  });
  it_("J/kg gives the base form m²/s², never Gy or Sv", () => {
    const q = qty("m2s-2", "J/kg", "J / kg", "m²/s²");
    const { texts, ctx } = row(q, "3*{J}/(2*{kg})");
    expect(texts[0]).toBe("m²/s²");
    expect(texts).not.toContain("Gy");
    expect(texts).not.toContain("Sv");
    expect(texts).not.toContain("J/kg");
    allBuild(q, ctx);
  });
  it_("a typed coherent unit is the SI one: N·m for a torque, not J", () => {
    const q = qty("kg1m2s-2", "kN·m", "k:N m", "kJ");
    const { texts } = row(q, "2*{k:N}*3*{m}");
    expect(texts.slice(0, 2)).toEqual(["N·m", "kJ"]);
  });
  it_("a target comes right after the SI units", () => {
    const t04 = row(qty("m1", "mm", "m:m", "mm"), "2*pi*25*{m:m}", undefined, "k:m");
    expect(t04.texts.slice(0, 3)).toEqual(["m", "km", "ft"]);
    // with an end slot in min: s, µs, then the target ms, then the pad's h (min is shown)
    const q = qty("s1", "min", "min", "µs");
    const { texts, ctx } = row(q, "2.2*{n:F}*4.7*{k:ohm}", "min", "m:s");
    expect(texts.slice(0, 4)).toEqual(["s", "µs", "ms", "h"]);
    expect(alternatives(q, ctx).map((a) => a.kind).slice(0, 4)).toEqual(["si", "siPrefixed", "target", "pad"]);
    // a target that is already in the row moves up, not twice
    expect(row(qty("m1", "mm", "m:m", "mm"), "2*pi*25*{m:m}", undefined, "yd").texts).toEqual(["m", "yd", "ft", "in", "mi", "mil"]);
  });
  it_("angles: rad and °, never rev (G32)", () => {
    const { texts } = row(qty("rad1", "°", "deg", "rad"), "asin(1/2)/pasdeg");
    expect(texts).toEqual(["rad"]);
    expect(row(qty("rad1", "rad", "rad", "rad"), "asin(1/2)/pasdeg").texts).toEqual(["°"]);
  });
  it_("a pure number or a 0 without a dimension has no row", () => {
    expect(row(qty("", "", undefined, ""), "2*{m}/(3*{m})").texts).toEqual([]);
    expect(row(qty(null, "", undefined, ""), "0").texts).toEqual([]);
  });
  it_("a tap is the end slot; nothing else of the request changes", () => {
    const req = requestOf("72*{k:m / h}", undefined, table);
    const q = qty("m1s-1", "km/h", "k:m / h", "m/s");
    const alt = alternatives(q, { table, pad, user, req })[0]!;
    expect(withEnd(req, alt)).toEqual({ ...req, end: alt.slot });
  });
});

describe("units.targets (R60)", () => {
  function memKv(): Kv & { data: Map<string, unknown> } {
    const data = new Map<string, unknown>();
    return { data, get: async <T>(k: string) => data.get(k) as T | undefined, set: async (k, v) => void data.set(k, v) };
  }
  it("a tap writes the slot for its dimension; reading gives it back; a bad record reads as none", async () => {
    const kv = memKv();
    expect(await readTargets(kv)).toEqual({});
    const ms: UnitSlot = { tokens: [{ prefix: "m", unit: "s" }] };
    await writeTarget(kv, "s1", ms);
    await writeTarget(kv, "m1", { tokens: [{ unit: "ft" }] });
    expect(await readTargets(kv)).toEqual({ s1: ms, m1: { tokens: [{ unit: "ft" }] } });
    expect(kv.data.has(UNIT_TARGETS)).toBe(true);
    kv.data.set(UNIT_TARGETS, { s1: "nonsense", m1: { tokens: [{ unit: 3 }] }, K1: { tokens: [{ unit: "K" }] } });
    expect(await readTargets(kv)).toEqual({ K1: { tokens: [{ unit: "K" }] } });
  });
});
