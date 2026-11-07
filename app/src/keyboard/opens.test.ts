// SPDX-License-Identifier: GPL-3.0-or-later
// R143: opensSheet() is true for exactly the specials that open a sheet and false for everything else.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { SPECIALS, keyboard, type ActionBody } from "./keyboard.ts";
import { OPENS_NOTHING, OPENS_SHEET, opensSheet } from "./opens.ts";

const spec = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../../../spec/keyboard.yaml"), "utf8");

describe("opensSheet (R143)", () => {
  it("is true for exactly the specials that open a sheet", () => {
    for (const name of ["vars", "find", "memory", "tmpl", "relations", "symbols", "mode", "settings", "apps", "menu"] as const)
      expect(opensSheet({ kind: "special", name }), name).toBe(true);
    for (const name of ["esc", "clear", "copy", "paste", "fmt", "units", "enter", "shift", "alpha", "none", "home", "cas", "switch", "symb", "plot", "num"] as const)
      expect(opensSheet({ kind: "special", name }), name).toBe(false);
  });

  it("is false for typing, templates, editing commands and a missing action", () => {
    const others: ActionBody[] = [{ kind: "type", text: "x" }, { kind: "insert", latex: "\\pi" }, { kind: "cmd", name: "undo" }];
    for (const a of others) expect(opensSheet(a), a.kind).toBe(false);
    expect(opensSheet(undefined)).toBe(false);
  });

  it("a new special must be classified: the two sets are disjoint and together exactly the specials", () => {
    for (const s of OPENS_SHEET) expect(OPENS_NOTHING.has(s), s).toBe(false);
    expect([...OPENS_SHEET, ...OPENS_NOTHING].sort()).toEqual([...SPECIALS].sort());
    // and every special the spec uses is one of them
    const used = new Set<string>();
    const walk = (v: unknown): void => {
      if (Array.isArray(v)) v.forEach(walk);
      else if (typeof v === "object" && v !== null)
        for (const [k, x] of Object.entries(v)) {
          if (k === "special" && typeof x === "string") used.add(x);
          else walk(x);
        }
    };
    walk(parse(spec));
    for (const s of used) expect(OPENS_SHEET.has(s as never) || OPENS_NOTHING.has(s as never), s).toBe(true);
  });

  it("the shipped layers that open a sheet are the ones the owner named (R143)", () => {
    const seen: string[] = [];
    for (const k of keyboard.keys)
      for (const layer of ["primary", "shift", "alpha"] as const) if (opensSheet(k.actions[layer])) seen.push(`${k.id}/${layer}`);
    expect(seen.sort()).toEqual(["d6/shift", "d9/shift", "fmt/shift", "help/shift", "math/primary", "math/shift", "tmpl/primary", "vars/primary"]);
  });
});
