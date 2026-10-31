// SPDX-License-Identifier: GPL-3.0-or-later
// R24d: the user cells of the unit pad: defaults from spec/unit-pad.yaml `user:`, the user's units over them in the
// stamped store, a restart, a reset, a pair (MPa), an emptied leg, and a damaged record.
import { describe, expect, it } from "vitest";
import { stamp, unstamp, type Kv } from "../state/storage.ts";
import { UnitPad } from "./pad.ts";
import { CELL_KEYS, UNIT_PAD_CELLS, UnitCells } from "./userCells.svelte.ts";

function memKv(): Kv & { data: Map<string, unknown> } {
  const data = new Map<string, unknown>();
  return {
    data,
    get: <T>(k: string) => Promise.resolve(data.get(k) as T | undefined),
    set: (k: string, v: unknown) => {
      data.set(k, structuredClone(v));
      return Promise.resolve();
    },
  };
}

describe("the user cells (R24d)", () => {
  it("are U1–U6 and, before anything is set, the defaults of spec/unit-pad.yaml", async () => {
    const c = new UnitCells(memKv());
    await c.restore();
    expect(CELL_KEYS).toEqual(["u1", "u2", "u3", "u4", "u5", "u6"]);
    expect(c.get("u1", "tap")).toEqual({ unit: "dB" });
    expect(c.textOf("u3", "tap")).toBe("ton"); // (the label of s_ton)
    expect(c.textOf("u3", "up")).toBe("l ton");
    expect(c.textOf("u4", "up")).toBe("eV");
    expect(c.get("u1", "up")).toBeUndefined();
    expect(c.count()).toBe(9); // the nine default legs (r9 section 6)
    expect(c.isSet("u1", "tap")).toBe(false);
  });

  it("a unit with a prefix is one leg (MPa, mm of water), drawn as the pad draws it and emitted as a pair", () => {
    const c = new UnitCells(memKv());
    c.set("u1", "tap", { unit: "Pa", prefix: "M" });
    c.set("u1", "up", { unit: "m", prefix: "u" });
    expect(c.textOf("u1", "tap")).toBe("MPa");
    expect(c.textOf("u1", "up")).toBe("µm");
    const pad = new UnitPad(c.userSet());
    expect(pad.press("u1", "primary")).toEqual({ do: "pair", prefix: "M", id: "Pa" });
    expect(pad.press("u1", "shift")).toEqual({ do: "pair", prefix: "u", id: "m" });
    expect(pad.press("u2", "primary")).toEqual({ do: "unit", id: "H" }); // (the others keep their defaults)
  });

  it("is stored stamped under unitPadCells, survives a restart, and a reset gives the default back", async () => {
    const kv = memKv();
    const c = new UnitCells(kv);
    c.set("u5", "tap", { unit: "h" });
    c.set("u5", "down", { unit: "min", label: "min" });
    c.set("u6", "tap", null); // emptied
    expect(kv.data.get(UNIT_PAD_CELLS)).toEqual({ u5: { tap: { unit: "h" }, down: { unit: "min", label: "min" } }, u6: { tap: null } });
    // the real store stamps what it is given and unstamps on read (storage.ts): the record round-trips
    expect(unstamp(UNIT_PAD_CELLS, stamp(kv.data.get(UNIT_PAD_CELLS))).value).toEqual(kv.data.get(UNIT_PAD_CELLS));

    const again = new UnitCells(kv); // a restart
    expect(again.textOf("u5", "tap")).toBe("d"); // (before the read: the default)
    await again.restore();
    expect(again.textOf("u5", "tap")).toBe("h");
    expect(again.textOf("u5", "down")).toBe("min");
    expect(again.get("u6", "tap")).toBeUndefined();
    expect(again.isSet("u6", "tap")).toBe(true);

    again.reset("u5", "tap");
    expect(again.textOf("u5", "tap")).toBe("d");
    expect(again.textOf("u5", "down")).toBe("min");
    again.reset("u5");
    again.reset("u6");
    expect(kv.data.get(UNIT_PAD_CELLS)).toEqual({});
    again.set("u1", "tap", { unit: "Pa" });
    again.reset();
    expect(again.get("u1", "tap")).toEqual({ unit: "dB" });
    expect(kv.data.get(UNIT_PAD_CELLS)).toEqual({});
  });

  it("an emptied leg is empty (the pad opens Find on it); a damaged record never breaks the pad", async () => {
    const kv = memKv();
    kv.data.set(UNIT_PAD_CELLS, { u1: { tap: null, up: { unit: 5 }, down: "x" }, u2: "bad", u3: { tap: { unit: "" } } });
    const c = new UnitCells(kv);
    await c.restore();
    expect(c.get("u1", "tap")).toBeUndefined();
    expect(c.get("u1", "up")).toBeUndefined(); // (no default there)
    expect(c.textOf("u2", "tap")).toBe("H");
    expect(c.textOf("u3", "tap")).toBe("ton");
    const pad = new UnitPad(c.userSet());
    expect(pad.press("u1", "primary")).toEqual({ do: "find", into: { key: "u1", leg: "tap" } });
  });

  it("refuses a key that is not a user cell, and a leg without a unit", () => {
    const c = new UnitCells(memKv());
    expect(() => c.set("d1", "tap", { unit: "m" })).toThrow();
    expect(() => c.set("u1", "tap", { unit: "" })).toThrow();
  });

  it("restore reads once: the unit view and Settings share one read", async () => {
    const c = new UnitCells(memKv());
    expect(c.restore()).toBe(c.restore());
  });
});
