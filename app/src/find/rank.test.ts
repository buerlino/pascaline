// SPDX-License-Identifier: GPL-3.0-or-later
// The ranking rules of docs/04 3.5 on a small hand-made index (the real index is tested in queries.test.ts).
import { describe, expect, it } from "vitest";
import { noteUse, oneEdit, prepare, search } from "./rank.ts";
import type { FindItem } from "./types.ts";

const item = (id: string, names: string[], title: string, extra: Partial<FindItem> = {}): FindItem =>
  ({ id, kind: id.split(":")[0] as FindItem["kind"], names, title, tier: 0, insert: "x", ...extra });

const items: FindItem[] = [
  item("const:c", ["c", "speed_of_light"], "Speed of Light in Vacuum"),
  item("pfx:c", ["centi", "c"], "Centi (10^-2)"),
  item("const:k_B", ["k_B", "boltzmann"], "Boltzmann Constant"),
  item("const:G_0", ["G_0", "conductance_quantum"], "Conductance Quantum"),
  item("const:g_0", ["g_0", "standard_gravity"], "Standard Acceleration due to Gravity"),
  item("unit:N", ["N", "newton"], "Newton"),
  item("const:G", ["G", "newtonian_constant"], "Newtonian Constant of Gravitation"),
  item("fn:normald", ["normald"], "normald", { tier: 1, desc: "Normal distribution density." }),
  item("fn:normal", ["normal"], "normal", { tier: 1, desc: "Simplifies an expression." }),
  item("fn:stddevp", ["stddevp", "stdev"], "Standard deviation (sample, n−1)"),
  item("fn:cosh", ["cosh"], "Hyperbolic cosine"),
  item("fn:cos", ["cos"], "Cosine"),
  item("unit:mW", ["mW"], "Milliwatt"),
  item("unit:MW", ["MW"], "Megawatt"),
];
const index = prepare(items);
const ids = (q: string, ctx = {}): string[] => search(index, q, { now: 0, ...ctx }).map((h) => h.item.id);

describe("Find ranking", () => {
  it("puts an exact name first, then prefixes, shorter first", () => {
    expect(ids("cos")).toEqual(["fn:cos", "fn:cosh"]);
    expect(ids("co")[0]).toBe("fn:cos");
  });

  it("ignores case, spaces and _: kb finds k_B, g0 prefers g_0 over G_0 by case", () => {
    expect(ids("kb")[0]).toBe("const:k_B");
    expect(ids("g0").slice(0, 2)).toEqual(["const:g_0", "const:G_0"]);
    expect(ids("G0")[0]).toBe("const:G_0");
    expect(ids("speed of light")[0]).toBe("const:c");
  });

  it("matches word prefixes inside names, then in titles and descriptions", () => {
    expect(ids("gravit")).toEqual(["const:g_0", "const:G"]); // a name word before a title word
    expect(ids("newton const")[0]).toBe("const:G");
    expect(ids("density")).toEqual(["fn:normald"]);
  });

  it("forgives one typo from 4 letters on, below every real match", () => {
    expect(ids("normlad")).toEqual(["fn:normald"]);
    expect(ids("stdve")).toEqual(["fn:stddevp"]);
    expect(ids("cso")).toEqual([]); // 3 letters: no typo match
    expect(oneEdit("abcd", "abdc")).toBe(true);
    expect(oneEdit("abcd", "abcd")).toBe(false);
    expect(oneEdit("abcd", "abxde")).toBe(false);
  });

  it("breaks ties by tier, then the context's kinds, then the id", () => {
    expect(ids("c").slice(0, 2)).toEqual(["const:c", "pfx:c"]);
    expect(ids("c", { prefer: ["pfx"] }).slice(0, 2)).toEqual(["pfx:c", "const:c"]);
    expect(ids("mw")).toEqual(["unit:MW", "unit:mW"]);
    expect(ids("normal")).toEqual(["fn:normal", "fn:normald"]);
  });

  it("ranks a used item first from its first letter (Math, letter, Enter)", () => {
    const usage = noteUse({}, "fn:cosh", 0);
    expect(ids("c", { usage })[0]).toBe("fn:cosh");
    // more uses and recent ones count more
    const both = noteUse(noteUse(noteUse(usage, "const:c", 0), "const:c", 0), "fn:cosh", 0);
    expect(ids("c", { usage: both }).slice(0, 2)).toEqual(["const:c", "fn:cosh"]);
    // a typo match gets no usage boost, so a used item never jumps over a real match through a typo
    expect(ids("cosj", { usage })).toEqual(ids("cosj"));
  });

  it("filters by kind and merges live items", () => {
    const live = [item("var:A", ["A"], "A = 5"), item("userfn:f", ["f"], "f(x) = x^2")];
    expect(ids("", { filter: ["var", "userfn"], live })).toEqual(["userfn:f", "var:A"]);
    expect(ids("a", { live })[0]).toBe("var:A");
  });

  it("keeps at most 500 ids in the usage table, dropping the least recent", () => {
    let u = {};
    for (let i = 0; i < 510; i++) u = noteUse(u, `fn:f${i}`, i);
    expect(Object.keys(u).length).toBe(500);
    expect(u).not.toHaveProperty("fn:f0");
    expect(u).toHaveProperty("fn:f509");
  });
});
