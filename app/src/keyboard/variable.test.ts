// SPDX-License-Identifier: GPL-3.0-or-later
// R142: the italic flag of a legend comes from the spec's actions, for every key and layer.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { actionFor, loadKeyboard, labelFor } from "./keyboard.ts";
import { typesVariable } from "./variable.ts";

const kb = loadKeyboard(parse(readFileSync(new URL("../../../spec/keyboard.yaml", import.meta.url), "utf8")));

describe("typesVariable", () => {
  it("is true for one letter, any script", () => {
    for (const t of ["A", "z", "x", "α", "Ω"]) expect(typesVariable({ kind: "type", text: t })).toBe(true);
  });
  it("is false for digits, marks, operators, several letters, and every other kind of action", () => {
    for (const t of [":", ";", "#", "7", "-", "=", "_", " ", "ab", ""]) expect(typesVariable({ kind: "type", text: t })).toBe(false);
    expect(typesVariable({ kind: "insert", latex: "\\pi" })).toBe(false);
    expect(typesVariable({ kind: "cmd", name: "undo" })).toBe(false);
    expect(typesVariable({ kind: "special", name: "alpha" })).toBe(false);
    expect(typesVariable(undefined)).toBe(false);
    expect(typesVariable({ kind: "type", text: "é" })).toBe(true);
  });
});

describe("the spec's legends", () => {
  it("every Alpha letter A–Z is a variable, in both cases; x and y are; nothing else on the keys is", () => {
    const letters = new Set<string>();
    for (const k of kb.keys)
      for (const [shift, alpha] of [[false, false], [true, false], [false, true], [true, true]] as const)
        for (const cas of [false, true]) {
          const a = actionFor(k, shift, alpha, false, cas);
          const v = typesVariable(a);
          expect(v, `${k.id} shift=${shift} alpha=${alpha} cas=${cas}`).toBe(a?.kind === "type" && /^\p{L}$/u.test(a.text));
          if (v && a?.kind === "type") {
            letters.add(a.text);
            // the legend that shows it is that letter
            if (alpha && k.label.alpha) expect(labelFor(k, shift, alpha, cas)).toBe(a.text);
          }
        }
    for (const c of "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz") expect(letters.has(c), c).toBe(true);
    expect(letters.has("x") && letters.has("y")).toBe(true);
    expect([...letters].every((l) => /^\p{L}$/u.test(l))).toBe(true);
  });
  it("`:`, `;` and `#` on the Alpha layer are not variables", () => {
    for (const [id, t] of [["sub", ":"], ["add", ";"], ["d3", "#"]] as const) {
      const a = kb.keys.find((k) => k.id === id)?.actions.alpha;
      expect(a).toEqual({ kind: "type", text: t });
      expect(typesVariable(a)).toBe(false);
    }
  });
});
