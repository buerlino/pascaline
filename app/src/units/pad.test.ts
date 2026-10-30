// SPDX-License-Identifier: GPL-3.0-or-later
// R24b: the unit pad's loader (units/pad.ts over spec/unit-pad.yaml): every cell lies on a maths key (a user cell on a
// user key), no key holds two cells, every unit and prefix id is a Find id (the full index, like find/specids.test.ts),
// and what a cell shows and emits in each layer.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";
import type { IndexItem } from "../find/types.ts";
import { actionFor, keyboard, labelFor, MATHS_ROW, type Key } from "../keyboard/keyboard.ts";
import { UnitPad, defaultUser } from "./pad.ts";

const here = dirname(fileURLToPath(import.meta.url));
const indexFile = join(here, "../find/_gen/find-index.json");
const items: IndexItem[] = existsSync(indexFile) ? (JSON.parse(readFileSync(indexFile, "utf8")) as IndexItem[]) : [];
const hasIndex = items.some((it) => it.kind === "unit");
const ids = new Set(items.map((i) => i.id));

interface Raw { key: string; tap?: string; up?: string; down?: string }
const spec = parse(readFileSync(join(here, "../../../spec/unit-pad.yaml"), "utf8")) as { keep: Raw[]; ops: Raw[]; prefixes: Raw[]; units: Raw[]; user: Raw[] };
const pad = new UnitPad();

/** What the keypad draws on key `id` with Shift and Alpha as given: the face, the two legends and whether it is dead. */
function shown(p: UnitPad, id: string, shift: boolean, alpha: boolean) {
  const k = p.key(keyboard.byId.get(id) as Key, undefined) as Key;
  const a = actionFor(k, shift, alpha);
  return {
    pad: k.pad,
    face: labelFor(k, shift, alpha) || k.label.primary || "",
    up: (shift && !alpha) || !k.label.shift ? "" : k.label.shift,
    down: alpha || !k.label.alpha ? "" : k.label.alpha,
    dead: !a || (a.kind === "special" && a.name === "none"),
  };
}

describe("the unit pad's cells", () => {
  it("lie on a maths key of spec/keyboard.yaml, a user cell on a user key", () => {
    for (const c of pad.cells) {
      const key = keyboard.byId.get(c.key);
      expect(key, `${c.key} is a key`).toBeDefined();
      if (c.kind === "user") expect(key?.user, `${c.key} is a user key`).toBe(true);
      else expect(key?.row, `${c.key} is in the maths rows`).toBeGreaterThanOrEqual(MATHS_ROW);
    }
  });

  it("are one per key: the spec lists no key twice, and every maths key but Shift and Alpha has its cell", () => {
    const listed = [...spec.keep, ...spec.ops, ...spec.prefixes, ...spec.units, ...spec.user].map((c) => c.key).filter((k) => k !== "shift" && k !== "alpha");
    expect(new Set(listed).size).toBe(listed.length);
    expect(pad.cells.length).toBe(listed.length);
    const maths = keyboard.keys.filter((k) => k.row >= MATHS_ROW && k.id !== "shift" && k.id !== "alpha").map((k) => k.id);
    expect(maths.filter((k) => !pad.cell(k))).toEqual([]);
    expect(pad.cells.filter((c) => c.kind === "user").map((c) => c.key)).toEqual(["u1", "u2", "u3", "u4", "u5", "u6"]);
  });

  it("refuse a key given two cells", () => {
    expect(() => new UnitPad({ d1: { tap: "m" } })).toThrow(/two cells/);
  });

  describe.skipIf(!hasIndex)("with the Find index", () => {
    it("name Find units and prefixes only", () => {
      const missing = pad.cells.flatMap((c) =>
        [c.tap, c.up, c.down].flatMap((l) => (l?.emit.do === "unit" ? [`unit:${l.emit.id}`] : l?.emit.do === "prefix" ? [`pfx:${l.emit.id}`] : [])),
      ).filter((i) => !ids.has(i));
      expect(missing).toEqual([]);
    });
  });
});

describe("what a cell shows and emits", () => {
  it("shows a unit on the tap, its flicks as legends, and emits unit ids", () => {
    expect(shown(pad, "d9", false, false)).toMatchObject({ pad: "unit", face: "m", up: "ft", down: "in", dead: false });
    expect(pad.press("d9", "primary")).toEqual({ do: "unit", id: "m" });
    expect(pad.press("d9", "shift")).toEqual({ do: "unit", id: "ft" });
    expect(pad.press("d9", "alpha")).toEqual({ do: "unit", id: "in" });
  });

  it("shows the layer in the face (Shift: the up item) and leaves its legend out", () => {
    expect(shown(pad, "d9", true, false)).toMatchObject({ face: "ft", up: "", down: "in" });
    expect(shown(pad, "d9", false, true)).toMatchObject({ face: "in", up: "ft", down: "" });
  });

  it("draws the Find ids as symbols and uses the spec's labels", () => {
    expect(shown(pad, "space", false, false)).toMatchObject({ face: "K", up: "°C", down: "°F" });
    expect(shown(pad, "tan", false, false)).toMatchObject({ face: "Ω", up: "S" });
    expect(pad.press("tan", "primary")).toEqual({ do: "unit", id: "ohm" });
    expect(shown(pad, "frac", false, false)).toMatchObject({ face: "°", up: "rad" });
    expect(shown(pad, "vars", false, false)).toMatchObject({ face: "mi", up: "yd", down: "mil" });
    expect(pad.press("vars", "alpha")).toEqual({ do: "unit", id: "thou" });
  });

  it("emits a prefix for a prefix cell, marked as one", () => {
    expect(shown(pad, "d2", false, false)).toMatchObject({ pad: "prefix", face: "µ" });
    expect(pad.press("d2", "primary")).toEqual({ do: "prefix", id: "u" });
    expect(pad.press("d4", "alpha")).toEqual({ do: "prefix", id: "h" });
    expect(pad.press("d7", "shift")).toEqual({ do: "prefix", id: "T" });
  });

  it("maps the operator keys to R24a's actions (× changes nothing but is a press)", () => {
    expect(pad.press("div", "primary")).toEqual({ do: "per" });
    expect(pad.press("div", "shift")).toEqual({ do: "power", n: -1 });
    expect(pad.press("mul", "primary")).toEqual({ do: "times" });
    expect(pad.press("sq", "primary")).toEqual({ do: "power", n: 2 });
    expect(pad.press("sq", "shift")).toEqual({ do: "sqrt" });
    expect(pad.press("pow", "primary")).toEqual({ do: "power", n: 3 });
    expect(pad.press("pow", "shift")).toEqual({ do: "power", n: 4 });
  });

  it("keeps Math, ⌫ and Enter, and leaves Shift and Alpha to the keypad", () => {
    expect(pad.press("math", "primary")).toEqual({ do: "find" });
    expect(pad.press("bksp", "primary")).toEqual({ do: "delete" });
    expect(pad.press("enter", "primary")).toEqual({ do: "next" });
    expect(pad.press("enter", "shift")).toEqual({ do: "evaluate" });
    expect(pad.press("shift", "primary")).toBeUndefined();
    expect(pad.press("alpha", "primary")).toBeUndefined();
    expect(pad.press("esc", "primary")).toBeUndefined();
  });

  it("is dead where a cell has nothing: null, and the legends say so", () => {
    expect(pad.press("d1", "shift")).toBeNull();
    expect(shown(pad, "d1", true, false)).toMatchObject({ dead: true });
    expect(pad.press("math", "shift")).toBeNull();
  });

  it("marks the user cells and emits their units; an empty one is dim with a +", () => {
    expect(shown(pad, "u3", false, false)).toMatchObject({ pad: "user", face: "ton", up: "l ton" });
    expect(pad.press("u3", "primary")).toEqual({ do: "unit", id: "s_ton" });
    expect(pad.press("u3", "shift")).toEqual({ do: "unit", id: "l_ton" });
    expect(pad.press("u4", "shift")).toEqual({ do: "unit", id: "eV" });
    const mine = new UnitPad({ ...defaultUser(), u1: {}, u2: { tap: "H", down: "mH", label: { down: "mH" } } });
    expect(shown(mine, "u1", false, false)).toMatchObject({ pad: "empty", face: "+", dead: true });
    expect(mine.press("u1", "primary")).toBeNull();
    expect(mine.press("u2", "alpha")).toEqual({ do: "unit", id: "mH" });
  });
});

it("finds the full generated index (otherwise the Find-id test was skipped)", () => {
  if (hasIndex) return;
  const msg = "app/src/find/_gen/find-index.json is missing or holds functions only; run npm run index";
  if (process.env["FIND_INDEX"] === "required") expect.fail(msg);
  console.warn(`pad.test: ${msg}; the test was skipped`);
});

describe("the keypad's drawing of a cell", () => {
  it("shows a user cell's flick down as its alpha legend, and a cell with no leg in a layer is dead there", () => {
    const mine = new UnitPad({ u2: { tap: "H", down: "mH" } });
    expect(shown(mine, "u2", false, false)).toMatchObject({ face: "H", up: "", down: "mH" });
    expect(shown(mine, "u2", false, true)).toMatchObject({ face: "mH", dead: false });
    expect(shown(mine, "u2", true, false)).toMatchObject({ dead: true });
    expect(shown(pad, "d1", false, true)).toMatchObject({ dead: true }); // the prefix m has no flick down: Alpha does not fall back to the tap
  });

  it("leaves a key that is not a cell to the keypad, and a user cell no longer a user key", () => {
    expect(pad.key(keyboard.byId.get("esc") as Key, undefined)).toBeUndefined();
    expect(pad.key(keyboard.byId.get("u3") as Key, undefined)?.user).toBeUndefined();
  });
});
