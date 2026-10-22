// SPDX-License-Identifier: GPL-3.0-or-later
// G76: one ValueFacts type. The fact types of one value are it (plus their own fields), checked by typecheck; stored
// items written before G76 (history `exactRational`, definitions without `exact`) read back through readValueFacts.
import { describe, expect, it } from "vitest";
import { readValueFacts, valueFactsOf, type ChipEntry, type HomeResult, type CasResult, type ValueFacts } from "./types.ts";
import type { NameFacts } from "./defs.ts";
import { validDefs } from "./defs.ts";
import type { ElementFacts } from "./numeric.ts";
import type { PrecisionFacts } from "./format.ts";
import type { ResultFacts } from "../state/displayMode.ts";
import type { Chip } from "../input/chips.ts";

// --- Type tests (run by typecheck): each type that describes one value is assignable to ValueFacts --------------------
type IsFacts<T> = [T] extends [ValueFacts] ? true : false;
const assignable: [
  IsFacts<NameFacts>,
  IsFacts<ChipEntry>,
  IsFacts<ElementFacts>,
  IsFacts<PrecisionFacts>,
  IsFacts<ResultFacts>,
  // a Chip's reliableDigits may be absent (stored chips, constants: the same as null); with it, a Chip is ValueFacts
  IsFacts<Chip & Pick<ValueFacts, "reliableDigits">>,
  IsFacts<HomeResult["facts"]>,
  IsFacts<CasResult["facts"]>,
] = [true, true, true, true, true, true, true, true];
// A Chip's fact fields are ValueFacts' own (same names, same types).
const chipFields: IsFacts<Required<Pick<Chip, "exact" | "warn">> & Pick<ValueFacts, "reliableDigits">> = true;
void [assignable, chipFields];

describe("readValueFacts: stored facts, old and new (G76)", () => {
  it("a history item stored before G76 says exactRational: read as exact", () => {
    expect(readValueFacts({ exactRational: true, reliableDigits: null })).toEqual({ exact: true, reliableDigits: null });
    expect(readValueFacts({ exactRational: false, reliableDigits: 11, warn: "unaudited" })).toEqual({ exact: false, reliableDigits: 11, warn: "unaudited" });
  });
  it("a definitions entry stored before G76 has no exact: it claims nothing", () => {
    expect(readValueFacts({ reliableDigits: null, inexact: true })).toEqual({ exact: false, reliableDigits: null, inexact: true });
  });
  it("a new item keeps every fact", () => {
    const f: ValueFacts = { exact: false, reliableDigits: 5, warn: "unchecked", why: { unaudited: ["romberg"], once: true }, inexact: true, uncDigits: 4 };
    expect(readValueFacts(JSON.parse(JSON.stringify(f)))).toEqual(f);
  });
  it("a field of the wrong type drops the facts", () => {
    for (const bad of [{ exact: "yes", reliableDigits: 1 }, { exact: true, reliableDigits: "x" }, { exact: false, reliableDigits: 1, warn: "nope" }, { exact: false, reliableDigits: 1, inexact: false }, { exact: false, reliableDigits: 1, uncDigits: -1 }, { exact: false, reliableDigits: 1, why: { unaudited: "romberg" } }, { exact: false, reliableDigits: 1, why: { other: true } }, null, 3])
      expect(readValueFacts(bad), JSON.stringify(bad)).toBeNull();
  });
  it("valueFactsOf keeps the facts and nothing else", () => {
    const e: ElementFacts = { value: { re: { neg: false, digits: "1", exp: 0, sticky: false }, im: { neg: false, digits: "", exp: 0, sticky: false } }, exact: false, reliableDigits: 3, warn: "unaudited", big: false, at: 40 };
    expect(valueFactsOf(e)).toEqual({ exact: false, reliableDigits: 3, warn: "unaudited" });
  });
});

describe("validDefs reads an entry stored before G76", () => {
  it("its facts gain exact: false; the rest stays", () => {
    const old = { name: "A", kind: "var", cmds: ["A:=(0.7468241328)"], facts: { reliableDigits: 10, warn: "unaudited" }, preview: "0.7468241328", view: "home", time: 1 };
    expect(validDefs([old])).toEqual([{ ...old, facts: { exact: false, reliableDigits: 10, warn: "unaudited" } }]);
  });
});
