// SPDX-License-Identifier: GPL-3.0-or-later
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { SAMPLE_CHIPS } from "../input/chips.ts";
import { latexToGiac } from "../input/latex-to-giac.ts";
import { parse } from "yaml";
import { shippedKeyboard } from "./shipped.ts";
import { actionFor, cellsIn, gridPlace, type Key, KeyboardSpecError, keyboard, labelFor, loadKeyboard, templates } from "./keyboard.ts";

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
    expect(at("fmt", "primary")).toEqual({ kind: "special", name: "fmt" });
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
    const minus = keyboard.byId.get("sub");
    const sin = keyboard.byId.get("sin");
    if (!vars || !plus || !minus || !sin || !d3) throw new Error("keys missing");
    expect(actionFor(vars, false, true)).toEqual({ kind: "type", text: "A" });
    expect(actionFor(vars, true, true)).toEqual({ kind: "type", text: "a" });
    expect(actionFor(d3, true, true)).toEqual({ kind: "type", text: "#" });
    expect(actionFor(keyboard.byId.get("enter") as Key, false, true)).toEqual({ kind: "special", name: "enter" });
    expect(actionFor(minus, true, false)).toBeUndefined(); // shift − (Base) comes with EN6
    expect(actionFor(plus, true, false)).toEqual({ kind: "insert", latex: "\\ans", sample: ["\\ans", "7"] }); // docs/04 2.8
    expect(labelFor(sin, true, false)).toBe("sin⁻¹");
  });

  it("every insert template has a sample, and our parser accepts the sample (rule: one parser case per template)", () => {
    expect(all.length).toBeGreaterThanOrEqual(24);
    for (const t of all) {
      const id = `${t.keyId}/${t.layer}/${t.variant}`;
      expect(t.sample, `${id} needs a sample`).toBeDefined();
      expect(() => latexToGiac((t.sample as readonly [string, string])[0], { chips: SAMPLE_CHIPS }), id).not.toThrow();
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

  // R17: a selection is the argument of a key (the contract is in the spec/keyboard.yaml header; test/selection.spec.ts
  // presses every key with a selection). So an insert template names its argument slot with #0 (the selection or a box)
  // or #@ (the selection or what is before the cursor), never with #? (always an empty box, the selection is lost).
  // The templates below have NO argument slot: a selection is replaced, as typing does. Add a new one on purpose, with a reason.
  const NO_ARGUMENT: Record<string, string> = {
    "eex/primary/normal": "the exponent mark: a mark, not a function (R14 makes it a typed character)",
    "eex/shift/normal": "store ▸: it follows the value, the name comes after",
    "d9/shift/normal": "∞: a constant",
    "d2/shift/normal": "i: a constant",
    "d3/shift/normal": "π: a constant",
    "add/shift/normal": "Ans: a value",
    "mul/primary/normal": "×: an operator",
    "mul/shift/normal": "∡: an operator (polar form)",
    "div/primary/line": "÷ in one-line entry: an operator",
    "frac/primary/line": "a b/c in one-line entry: an operator",
    "tmpl:cases/primary/normal": "a table of two lines: no main argument",
    "tmpl:matrix22/primary/normal": "the cells of a matrix are not an argument",
    "tmpl:rowvec/primary/normal": "the cells of a matrix are not an argument",
    "tmpl:colvec/primary/normal": "the cells of a matrix are not an argument",
    "tmpl:dms/primary/normal": "three boxes of equal standing: none is the argument",
  };
  // The one-line forms of xʸ and x²: a bare caret. EntryController.run() brackets a selection in front of it (R17).
  const CARET = ['\\char"5E '];

  it("every insert template takes the selection as its argument (#0 or #@), or is on the NO_ARGUMENT list (R17)", () => {
    const seen = new Set<string>();
    for (const t of all) {
      const id = `${t.keyId}/${t.layer}/${t.variant}`;
      seen.add(id);
      const takes = t.latex.includes("#@") || t.latex.includes("#0") || CARET.some((c) => t.latex.startsWith(c));
      if (id in NO_ARGUMENT) expect(takes, `${id} is on NO_ARGUMENT but has an argument slot: ${t.latex}`).toBe(false);
      else expect(takes, `${id}: ${t.latex} has no #0 or #@, so a selection would be lost; use #0 for the argument slot`).toBe(true);
    }
    for (const id of Object.keys(NO_ARGUMENT)) expect(seen.has(id), `${id} is on NO_ARGUMENT but is not a template`).toBe(true);
  });

  it("a power key's one-line form never binds the exponent to the last character of a selection (R17)", () => {
    for (const t of all.filter((x) => x.variant === "line")) expect(t.latex.startsWith("#@^"), `${t.keyId}/${t.layer}: use \\left(#@\\right)^…`).toBe(false);
  });

  it("one-line mode swaps the stacked fraction and root for linear forms", () => {
    const div = keyboard.byId.get("div");
    const sq = keyboard.byId.get("sq");
    if (!div || !sq) throw new Error("keys missing");
    expect(actionFor(div, false, false, true)).toEqual({ kind: "insert", latex: "\\div", sample: ["5\\div5", "5/5"] });
    expect(actionFor(sq, true, false, true)).toMatchObject({ latex: "\\operatorname{sqrt}\\left(#?\\right)" });
    expect(actionFor(div, false, false, false)).toMatchObject({ latex: "\\frac{#@}{#?}" });
  });

  it("the Tmpl palette (R10): the reference's 6 × 3 grid, every cell a template, row by row", () => {
    const p = keyboard.palette;
    expect(p.columns).toBe(6);
    expect(p.items.map((i) => i.id)).toEqual([
      "frac", "power", "evalat", "deriv", "cases", "matrix22",
      "sqrt", "nthroot", "limit", "integral", "rowvec", "colvec",
      "abs", "mixed", "sum", "product", "logbase", "dms",
    ]);
    p.items.forEach((it, i) => expect([it.row, it.col], it.id).toEqual([Math.floor(i / 6), i % 6]));
    for (const it of p.items) expect(it.action.kind, it.id).toBe("insert");
    // the cells that are a key's template are that key's action, one-line form included
    expect(p.items.find((i) => i.id === "frac")?.action).toBe(keyboard.byId.get("frac")?.actions.primary);
    expect(p.items.find((i) => i.id === "abs")?.action).toBe(keyboard.byId.get("neg")?.actions.shift);
    // our readings of the photo, listed for the owner to confirm on the G2
    expect(p.items.filter((i) => i.check).map((i) => i.id)).toEqual(["evalat", "rowvec", "mixed"]);
  });

  it("Tmpl opens the palette; a b/c is the fraction while typing", () => {
    expect(keyboard.byId.get("tmpl")?.actions.primary).toEqual({ kind: "special", name: "tmpl" });
    expect(keyboard.byId.get("frac")?.label.primary).toBe("a b/c");
  });

  it("the built app's copy (no sample, source, check or unit_slot) loads to the same keys and palette", () => {
    const slim = shippedKeyboard(parse(spec));
    expect(JSON.stringify(slim)).not.toMatch(/"(sample|source|check|unit_slot)"/);
    const k = loadKeyboard(slim);
    const plain = (a: unknown) => JSON.parse(JSON.stringify(a, (key, v: unknown) => (["sample", "source", "check"].includes(key) ? undefined : v)));
    expect(plain(k.keys)).toEqual(plain(keyboard.keys));
    expect(plain(k.palette)).toEqual(plain(keyboard.palette));
  });

  it("rejects broken palettes", () => {
    const key = { id: "a", row: 0, col: 0, cls: "num", label: { primary: "1" }, primary: { insert: "#@^{2}", sample: ["3^{2}", "9"] }, source: "assumed" };
    const doc = (items: object[]) => ({ schema: 1, columns: 2, keys: [key], templates: { columns: 2, items } });
    const own = { id: "t", row: 0, col: 0, insert: "\\sqrt{#?}", sample: ["\\sqrt{4}", "2"] };
    expect(loadKeyboard(doc([own, { id: "k", row: 0, col: 1, key: "a", layer: "primary" }])).palette.items).toHaveLength(2);
    expect(() => loadKeyboard(doc([own, own]))).toThrow(/duplicate/);
    expect(() => loadKeyboard(doc([own, { ...own, id: "u" }]))).toThrow(/taken/);
    expect(() => loadKeyboard(doc([{ ...own, col: 2 }]))).toThrow(/outside/);
    expect(() => loadKeyboard(doc([{ id: "t", row: 0, col: 0, insert: "x" }]))).toThrow(/sample/);
    expect(() => loadKeyboard(doc([{ id: "t", row: 0, col: 0, key: "a", layer: "shift" }]))).toThrow(/no template/);
    expect(() => loadKeyboard(doc([{ id: "t", row: 0, col: 0, key: "nope", layer: "primary" }]))).toThrow(/no template/);
    expect(() => loadKeyboard(doc([{ ...own, key: "a", layer: "primary" }]))).toThrow(/not both/);
  });

  it("contains no trademarked names", () => {
    // (the TeX command \prime, the minutes mark of the DMS template, is not a name)
    expect(spec.replace(/\\(?:double)?prime\b/g, "")).not.toMatch(/\bHP\b|\bPrime\b/i);
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
