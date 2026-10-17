// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { canPick, pickAfter, pickAtOrBefore } from "./pickRows.ts";

const rows = (...s: string[]) => s.map((status) => ({ status })) as { status: "done" | "note" | "error" }[];

describe("pickRows (P4, G19): a note row is never picked", () => {
  it("Up from an empty line picks the last row that is not a note", () => {
    expect(pickAtOrBefore(rows("note", "done", "done"), 2)).toBe(2);
    expect(pickAtOrBefore(rows("note", "done"), 1)).toBe(1);
  });

  it("with only a note in the history there is nothing to pick (Up falls through)", () => {
    expect(pickAtOrBefore(rows("note"), 0)).toBeNull();
    expect(pickAtOrBefore(rows(), -1)).toBeNull();
  });

  it("Up from the first real row stays on it instead of stepping onto the note", () => {
    const r = rows("note", "done", "done");
    expect(pickAtOrBefore(r, 0)).toBeNull(); // the caller keeps the current pick
    expect(pickAtOrBefore(r, 1)).toBe(1);
  });

  it("Down skips a note and ends at null past the last row", () => {
    expect(pickAfter(rows("done", "note", "done"), 0)).toBe(2);
    expect(pickAfter(rows("done", "done"), 1)).toBeNull();
    expect(pickAfter(rows("done", "note"), 0)).toBeNull();
  });

  it("canPick: a note and a missing row are not pickable", () => {
    expect(canPick(rows("note", "done"), 0)).toBe(false);
    expect(canPick(rows("note", "done"), 1)).toBe(true);
    expect(canPick(rows("done"), 5)).toBe(false);
  });
});
