// SPDX-License-Identifier: GPL-3.0-or-later
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { latexToGiac } from "../input/latex-to-giac.ts";
import { actionFor, KeyboardSpecError, keyboard, labelFor, loadKeyboard, type Action } from "./keyboard.ts";

const spec = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../../../spec/keyboard.yaml"), "utf8");

const insertActions: { id: string; layer: string; a: Extract<Action, { kind: "insert" }> }[] = [];
for (const k of keyboard.keys)
  for (const [layer, a] of Object.entries(k.actions)) if (a.kind === "insert") insertActions.push({ id: k.id, layer, a });

describe("keyboard spec", () => {
  it("loads: 5 columns, 8 rows, unique ids and positions", () => {
    expect(keyboard.columns).toBe(5);
    expect(keyboard.rows).toBe(8);
    expect(keyboard.keys).toHaveLength(40);
    expect(keyboard.byId.size).toBe(40);
  });

  it("every layout cell is filled", () => {
    expect(keyboard.keys.length).toBe(keyboard.columns * keyboard.rows);
  });

  it("the division key makes a stacked fraction with the previous argument as numerator (device, 2026-10-11)", () => {
    const div = keyboard.byId.get("div");
    expect(div?.source).toBe("device");
    expect(div?.actions.primary).toMatchObject({ kind: "insert", latex: "\\frac{#@}{#?}" });
  });

  it("alpha reaches all 26 lowercase letters exactly once", () => {
    const letters = keyboard.keys.flatMap((k) => (k.actions.alpha?.kind === "type" ? [k.actions.alpha.text] : []));
    expect([...letters].sort().join("")).toBe("abcdefghijklmnopqrstuvwxyz");
  });

  it("alpha falls back to primary and shift+alpha types capitals", () => {
    const sin = keyboard.byId.get("sin");
    const plus = keyboard.byId.get("add");
    if (!sin || !plus) throw new Error("keys missing");
    expect(actionFor(sin, false, true)).toEqual({ kind: "type", text: "a" });
    expect(actionFor(sin, true, true)).toEqual({ kind: "type", text: "A" });
    expect(actionFor(plus, false, true)).toEqual(plus.actions.primary);
    expect(actionFor(plus, true, false)).toBeUndefined();
    expect(labelFor(sin, true, false)).toBe("sin⁻¹");
  });

  it("every insert template has a sample, and our parser accepts the sample (rule: one parser case per template)", () => {
    expect(insertActions.length).toBeGreaterThanOrEqual(20);
    for (const { id, layer, a } of insertActions) {
      expect(a.sample, `${id}/${layer} needs a sample`).toBeDefined();
      expect(() => latexToGiac((a.sample as readonly [string, string])[0]), `${id}/${layer}`).not.toThrow();
    }
  });

  it("template samples really are the template with its placeholders filled", () => {
    for (const { id, layer, a } of insertActions) {
      const skeleton = a.latex.replace(/#[?@0]/g, "\u0000").split("\u0000");
      const sample = (a.sample as readonly [string, string])[0];
      let pos = 0;
      for (const part of skeleton) {
        const at = sample.indexOf(part, pos);
        expect(at, `${id}/${layer}: sample ${sample} does not follow template ${a.latex}`).toBeGreaterThanOrEqual(pos);
        pos = at + part.length;
      }
    }
  });

  it("contains no trademarked names", () => {
    expect(spec).not.toMatch(/\bHP\b|\bPrime\b/i);
  });

  it("rejects broken specs", () => {
    const key = { id: "a", row: 0, col: 0, cls: "num", label: { primary: "1" }, primary: { type: "1" }, source: "assumed" };
    const doc = (k: object[], extra: object = {}) => ({ schema: 1, columns: 2, keys: k, ...extra });
    expect(() => loadKeyboard(doc([key]))).not.toThrow();
    expect(() => loadKeyboard({ ...doc([key]), schema: 2 })).toThrow(KeyboardSpecError);
    expect(() => loadKeyboard(doc([key, key]))).toThrow(/duplicate/);
    expect(() => loadKeyboard(doc([key, { ...key, id: "b" }]))).toThrow(/taken/);
    expect(() => loadKeyboard(doc([{ ...key, col: 2 }]))).toThrow(/outside/);
    expect(() => loadKeyboard(doc([{ ...key, primary: { type: "1", cmd: "x" } }]))).toThrow(/exactly one/);
    expect(() => loadKeyboard(doc([{ ...key, primary: { special: "nope" } }]))).toThrow(/special/);
    expect(() => loadKeyboard(doc([{ ...key, cls: "huge" }]))).toThrow(/cls/);
    expect(() => loadKeyboard(doc([{ ...key, source: "guess" }]))).toThrow(/source/);
    expect(() => loadKeyboard(doc([{ ...key, shift: { type: "2" } }]))).toThrow(/shift needs both/);
  });
});
