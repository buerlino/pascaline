// SPDX-License-Identifier: GPL-3.0-or-later
// R21a: rows and cells shrink to the room over the keypad, down to the floor (docs/05 3.1 "fit, then scroll").
import { describe, expect, it } from "vitest";
import type { MenuItem } from "../apps/types.ts";
import { Sheet } from "./sheet.svelte.ts";
import { CELL_FLOOR, OPTIONS, fitCell, fitRow, hasSteps, REASON, ROW, ROW_FLOOR, rowHeight, showsReason, STEP } from "./sheetFit.ts";

const plain = { reason: false, steps: false };
const rows = (n: number, r = plain) => Array.from({ length: n }, () => r);

describe("fitRow", () => {
  it("keeps the normal height when the rows fit", () => {
    expect(fitRow(5 * ROW, rows(5))).toBe(ROW);
    expect(fitRow(1000, rows(5))).toBe(ROW);
  });
  it("shrinks to the room, never above it", () => {
    const row = fitRow(337, rows(9)); // Mode › Significant digits over the keypad of a Pixel 7
    expect(row).toBeLessThan(ROW);
    expect(row).toBeGreaterThanOrEqual(ROW_FLOOR);
    expect(9 * row).toBeLessThanOrEqual(337);
    expect(9 * (row + 0.5)).toBeGreaterThan(337);
  });
  it("a row with a button per value is 52 px (R86)", () => {
    expect(rowHeight(36, { reason: false, steps: false, options: true })).toBe(OPTIONS);
    expect(rowHeight(42, { reason: false, steps: false, options: false })).toBe(42);
  });
  it("stops at the floor: below it the list scrolls", () => {
    expect(fitRow(100, rows(9))).toBe(ROW_FLOOR);
  });
  it("counts a reason line and a value row's ◀ ▶ buttons in the row's own height", () => {
    expect(rowHeight(40, { reason: true, steps: false })).toBe(40 + REASON);
    expect(rowHeight(36, { reason: false, steps: true })).toBe(STEP);
    expect(rowHeight(36, { reason: true, steps: true })).toBe(36 + REASON);
    // four value rows and one plain row: the plain one shrinks first, the value rows stay 44
    expect(fitRow(4 * STEP + ROW, [...rows(4, { reason: false, steps: true }), plain])).toBe(ROW);
    expect(fitRow(4 * STEP + 38, [...rows(4, { reason: false, steps: true }), plain])).toBe(38);
  });
});

describe("fitCell", () => {
  it("keeps the palette's normal height when the grid fits, shrinks to the floor, never below", () => {
    expect(fitCell(400, 3, 58)).toBe(58);
    expect(fitCell(3 * 50 + 2 * 4, 3, 58)).toBe(50);
    expect(fitCell(60, 3, 58)).toBe(CELL_FLOOR);
  });
});

describe("showsReason", () => {
  const off = (id: string, reason: string): MenuItem => ({ id, label: id, disabled: true, reason });
  const on = (id: string): MenuItem => ({ id, label: id });
  it("says why once for neighbouring disabled rows with the same reason, under the last of them", () => {
    // Function › Plot with no function: five rows share one reason, two the next one
    const items = [off("root", "A"), off("ext", "A"), off("int", "A"), off("slope", "A"), off("area", "A"), on("default"), off("copy", "B"), off("shown", "B")];
    expect(items.map((_, i) => showsReason(items, i))).toEqual([false, false, false, false, true, false, false, true]);
  });
  it("a different reason, or a live row between, gives each its own line", () => {
    const items = [off("a", "A"), off("b", "B"), off("c", "A"), on("d"), off("e", "A")];
    expect(items.map((_, i) => showsReason(items, i))).toEqual([true, true, true, false, true]);
  });
  it("a live row or a row without a reason says nothing", () => {
    expect(showsReason([on("a")], 0)).toBe(false);
    expect(showsReason([{ id: "a", label: "a", disabled: true }], 0)).toBe(false);
  });
});

describe("the ◀ ▶ buttons of a value row", () => {
  it("a row has them when it has a value changed in place", () => {
    expect(hasSteps({ id: "a", label: "a", value: "1", adjust: () => undefined })).toBe(true);
    expect(hasSteps({ id: "a", label: "a", value: "1" })).toBe(false);
    expect(hasSteps({ id: "a", label: "a", adjust: () => undefined })).toBe(false);
  });
  it("a tap on one steps that row's value and highlights it; a disabled row does nothing", () => {
    let n = 0;
    let m = 0;
    const s = new Sheet("t", "T", () => [
      { id: "a", label: "a", value: String(n), adjust: (by) => void (n += by) },
      { id: "b", label: "b", value: String(m), adjust: (by) => void (m += by) },
      { id: "c", label: "c", value: "x", disabled: true, adjust: () => void (m = 99) },
    ]);
    expect(s.level.highlight).toBe(0);
    s.adjustAt(1, -1);
    expect([n, m, s.level.highlight]).toEqual([0, -1, 1]);
    s.adjustAt(0, 1);
    expect([n, m, s.level.highlight]).toEqual([1, -1, 0]);
    s.adjustAt(2, 1);
    expect([m, s.level.highlight]).toEqual([-1, 0]);
  });
});

describe("where a sheet goes", () => {
  it("a list that takes letters stays above the keypad; every other sheet goes over it", () => {
    const short = new Sheet("t", "T", () => [{ id: "a", label: "a" }]);
    const long = new Sheet("u", "U", () => Array.from({ length: 14 }, (_, i) => ({ id: `${i}`, label: `${i}` })));
    const grid = new Sheet("tmpl", "Tmpl", () => Array.from({ length: 18 }, (_, i) => ({ id: `${i}`, label: `${i}` })), { columns: 6 });
    expect([short.letters, long.letters, grid.letters]).toEqual([false, true, false]);
  });
});
