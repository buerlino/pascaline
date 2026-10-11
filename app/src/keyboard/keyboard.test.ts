// SPDX-License-Identifier: GPL-3.0-or-later
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { latexToGiac } from "../input/latex-to-giac.ts";
import { actionFor, cellsIn, gridPlace, type Key, KeyboardSpecError, keyboard, labelFor, loadKeyboard, pythonLabel, pythonText, templates } from "./keyboard.ts";

const spec = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../../../spec/keyboard.yaml"), "utf8");

const all = templates(keyboard);

describe("keyboard spec", () => {
  it("loads: the reference grid (P4), 6 cells per row, 5 in the lower four rows, unique ids and positions", () => {
    expect(keyboard.columns).toBe(6);
    expect(keyboard.rows).toBe(10);
    expect(keyboard.units).toBe(30);
    expect(keyboard.byId.size).toBe(keyboard.keys.length);
    expect([3, 4, 5, 6, 7, 8, 9].map((r) => cellsIn(keyboard, r))).toEqual([6, 6, 6, 5, 5, 5, 5]);
  });

  it("rows 3-9 (the reference's r4-r10) are full; the upper cluster has the reference's gaps", () => {
    for (let r = 0; r < keyboard.rows; r++) {
      const used = keyboard.keys.filter((k) => k.row === r).reduce((n, k) => n + k.span, 0);
      if (r >= 3) expect(used, `row ${r}`).toBe(cellsIn(keyboard, r));
      else if (r < 2) expect(used, `row ${r}`).toBeLessThan(cellsIn(keyboard, r)); // Help, View, r2c1: not ours yet
    }
    expect(gridPlace(keyboard, keyboard.byId.get("enter") as Key)).toEqual({ start: 21, span: 10 });
    expect(gridPlace(keyboard, keyboard.byId.get("div") as Key)).toEqual({ start: 25, span: 6 });
  });

  it("every key says where it comes from", () => {
    for (const k of keyboard.keys) expect(["virtual-calc", "assumed", "device"], k.id).toContain(k.source);
    expect(spec.match(/source: virtual-calc/g)?.length ?? 0).toBeGreaterThanOrEqual(40);
  });

  it("moved functions sit on the reference's keys (P4)", () => {
    const at = (id: string, layer: "primary" | "shift") => keyboard.byId.get(id)?.actions[layer];
    expect(at("d3", "shift")).toMatchObject({ latex: "\\pi" });
    expect(at("d2", "shift")).toMatchObject({ latex: "\\imaginaryI" });
    expect(at("ln", "shift")).toMatchObject({ latex: "\\exponentialE^{#?}" });
    expect(at("log", "shift")).toMatchObject({ latex: "10^{#?}" });
    expect(at("div", "shift")).toMatchObject({ latex: "#@^{-1}" });
    expect(at("dot", "shift")).toEqual({ kind: "type", text: "=" });
    expect(at("enter", "shift")).toMatchObject({ latex: "\\operatorname{approx}\\left(#?\\right)" });
    expect(at("pow", "shift")).toMatchObject({ latex: "\\sqrt[#?]{#0}" });
    expect(at("sq", "shift")).toMatchObject({ latex: "\\sqrt{#0}" });
    expect(at("neg", "primary")).toEqual({ kind: "type", text: "-" });
    expect(at("neg", "shift")).toMatchObject({ latex: "\\left|#?\\right|" });
    expect(at("eex", "shift")).toMatchObject({ latex: "\\blacktriangleright" });
    expect(at("mul", "shift")).toMatchObject({ latex: "\\mathbin{\\measuredangle}" });
    expect(at("fmt", "primary")).toEqual({ kind: "special", name: "none" });
  });

  it("the division key makes a stacked fraction with the previous argument as numerator (device, 2026-10-11)", () => {
    const div = keyboard.byId.get("div");
    expect(div?.source).toBe("device");
    expect(div?.actions.primary).toMatchObject({ kind: "insert", latex: "\\frac{#@}{#?}" });
  });

  it("alpha reaches A-Z in the reference's key order (r4c1 A … r9c3 Z), then #, :, quote, ;", () => {
    const letters = [...keyboard.keys]
      .sort((a, b) => a.row - b.row || a.col - b.col)
      .flatMap((k) => (k.actions.alpha?.kind === "type" ? [k.actions.alpha.text] : []));
    expect(letters.join("")).toBe('ABCDEFGHIJKLMNOPQRSTUVWXYZ#:"' + ";");
  });

  it("alpha types capitals, shift+alpha lower case, alpha falls back to primary", () => {
    const vars = keyboard.byId.get("vars");
    const d3 = keyboard.byId.get("d3");
    const plus = keyboard.byId.get("add");
    const sin = keyboard.byId.get("sin");
    if (!vars || !plus || !sin || !d3) throw new Error("keys missing");
    expect(actionFor(vars, false, true)).toEqual({ kind: "type", text: "A" });
    expect(actionFor(vars, true, true)).toEqual({ kind: "type", text: "a" });
    expect(actionFor(d3, true, true)).toEqual({ kind: "type", text: "#" });
    expect(actionFor(keyboard.byId.get("enter") as Key, false, true)).toEqual({ kind: "special", name: "enter" });
    expect(actionFor(plus, true, false)).toBeUndefined();
    expect(labelFor(sin, true, false)).toBe("sin⁻¹");
  });

  it("every insert template has a sample, and our parser accepts the sample (rule: one parser case per template)", () => {
    expect(all.length).toBeGreaterThanOrEqual(24);
    for (const t of all) {
      const id = `${t.keyId}/${t.layer}/${t.variant}`;
      expect(t.sample, `${id} needs a sample`).toBeDefined();
      expect(() => latexToGiac((t.sample as readonly [string, string])[0]), id).not.toThrow();
    }
  });

  it("template samples really are the template with its placeholders filled", () => {
    for (const t of all) {
      const skeleton = t.latex.replace(/#[?@0]/g, "\u0000").split("\u0000");
      const sample = (t.sample as readonly [string, string])[0];
      let pos = 0;
      for (const part of skeleton) {
        const at = sample.indexOf(part, pos);
        expect(at, `${t.keyId}/${t.layer}/${t.variant}: sample ${sample} does not follow template ${t.latex}`).toBeGreaterThanOrEqual(pos);
        pos = at + part.length;
      }
    }
  });

  it("one-line mode swaps the stacked fraction and root for linear forms", () => {
    const div = keyboard.byId.get("div");
    const sq = keyboard.byId.get("sq");
    if (!div || !sq) throw new Error("keys missing");
    expect(actionFor(div, false, false, true)).toEqual({ kind: "insert", latex: "\\div", sample: ["5\\div5", "5/5"] });
    expect(actionFor(sq, true, false, true)).toMatchObject({ latex: "\\operatorname{sqrt}\\left(#?\\right)" });
    expect(actionFor(div, false, false, false)).toMatchObject({ latex: "\\frac{#@}{#?}" });
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
    expect(() => loadKeyboard(doc([{ ...key, span: 3 }]))).toThrow(/outside/);
    expect(() => loadKeyboard(doc([{ ...key, span: 2 }, { ...key, id: "b", col: 1 }]))).toThrow(/taken/);
    expect(() => loadKeyboard(doc([{ ...key, col: 1 }], { row_columns: { 0: 1 } }))).toThrow(/outside/);
    expect(loadKeyboard(doc([key], { row_columns: { 1: 3 } })).units).toBe(6);
    expect(() => loadKeyboard(doc([{ ...key, primary: { type: "1", cmd: "x" } }]))).toThrow(/exactly one/);
    expect(() => loadKeyboard(doc([{ ...key, primary: { special: "nope" } }]))).toThrow(/special/);
    expect(() => loadKeyboard(doc([{ ...key, cls: "huge" }]))).toThrow(/cls/);
    expect(() => loadKeyboard(doc([{ ...key, source: "guess" }]))).toThrow(/source/);
    expect(() => loadKeyboard(doc([{ ...key, shift: { type: "2" } }]))).toThrow(/shift needs both/);
  });
});

describe("Python layer", () => {
  const key = (id: string) => keyboard.byId.get(id) as NonNullable<ReturnType<typeof keyboard.byId.get>>;
  it("types Python text, keeps letters under alpha, and falls back where a key is not listed", () => {
    expect(pythonText(keyboard, key("pow"), false, false)).toBe("**");
    expect(pythonText(keyboard, key("paren"), true, false)).toBe(")");
    expect(pythonText(keyboard, key("eex"), true, false)).toBe("=");
    expect(pythonText(keyboard, key("space"), false, false)).toBeUndefined();
    expect(pythonText(keyboard, key("sin"), false, true)).toBeUndefined();
    expect(pythonText(keyboard, key("x"), false, false)).toBeUndefined();
    expect(pythonLabel(keyboard, key("eex"), "primary")).toBe("E");
  });
  it("covers every key whose normal primary action is a LaTeX template", () => {
    for (const k of keyboard.keys)
      if (k.actions.primary?.kind === "insert") expect(keyboard.python.get(k.id)?.text.primary, k.id).toBeDefined();
  });
});
