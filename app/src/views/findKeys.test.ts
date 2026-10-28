// SPDX-License-Identifier: GPL-3.0-or-later
// Find's sheet (R4a, docs/04 3.7, decisions.md S2 rule M1): its keys, and a level that searches.
import { describe, expect, it } from "vitest";
import type { MenuItem } from "../apps/types.ts";
import { keyboard, type Key } from "../keyboard/keyboard.ts";
import { Sheet } from "./sheet.svelte.ts";
import { findKey } from "./sheetKeys.ts";

const key = (id: string): Key => {
  const k = keyboard.byId.get(id);
  if (!k) throw new Error(`no key ${id}`);
  return k;
};
const ran: string[] = [];
const item = (id: string, extra: Partial<MenuItem> = {}): MenuItem => ({ id, label: id, run: () => void ran.push(id), ...extra });

describe("findKey: every key types its letter, digits pick only on an empty query", () => {
  it("a tap types the key's letter in lower case, Tmpl and Math too", () => {
    expect(findKey(key("tmpl"), undefined, false, true)).toEqual({ kind: "letter", ch: "c" });
    expect(findKey(key("math"), undefined, false, false)).toEqual({ kind: "letter", ch: "b" });
    expect(findKey(key("x"), undefined, false, true)).toEqual({ kind: "letter", ch: "d" });
  });
  it("a digit picks a row while the query is empty and types itself after a letter", () => {
    expect(findKey(key("d3"), undefined, false, true)).toEqual({ kind: "pick", n: 3 });
    expect(findKey(key("d0"), undefined, false, true)).toEqual({ kind: "pick", n: 10 });
    expect(findKey(key("d0"), undefined, false, false)).toEqual({ kind: "letter", ch: "0" });
  });
  it("a flick down types the letter on any key, digits included", () => {
    expect(findKey(key("d9"), "alpha", false, true)).toEqual({ kind: "letter", ch: "s" });
  });
  it("Shift + a key, or a flick up, types its own character; a letter's own character types nothing", () => {
    expect(findKey(key("d5"), undefined, true, true)).toEqual({ kind: "letter", ch: "5" });
    expect(findKey(key("dot"), "shift", false, false)).toEqual({ kind: "letter", ch: "." });
    expect(findKey(key("x"), undefined, true, false)).toEqual({ kind: "none" });
  });
  it("the arrows, Enter, Esc and ⌫ keep their sheet jobs", () => {
    expect(findKey(key("down"), undefined, false, false)).toEqual({ kind: "move", by: 1 });
    expect(findKey(key("enter"), undefined, false, false)).toEqual({ kind: "enter" });
    expect(findKey(key("esc"), undefined, false, false)).toEqual({ kind: "back" });
    expect(findKey(key("bksp"), undefined, false, false)).toEqual({ kind: "backspace" });
  });
});

describe("a level that searches (Find)", () => {
  const cats = (): MenuItem[] => [
    item("cat:a", { submenu: { title: "A", items: [item("one"), item("two")], search: (q) => [item(`in-a:${q}`)] } }),
    item("cat:b"),
  ];
  const find = (): Sheet => new Sheet("find", "Find", cats, { search: (q) => [item(`hit1:${q}`), item(`hit2:${q}`)], remember: false });

  it("takes letters (so it stays above the keypad) and numbers its categories on an empty query", () => {
    const s = find();
    expect(s.letters).toBe(true);
    expect(s.level.rows.map((r) => r.n)).toEqual([1, 2]);
  });
  it("a query shows the search's hits, unnumbered, the first highlighted; ⌫ back to the categories", () => {
    const s = find();
    s.level.type("s");
    s.level.type("o");
    expect(s.level.rows.map((r) => [r.item.id, r.n])).toEqual([["hit1:so", undefined], ["hit2:so", undefined]]);
    expect(s.level.current?.id).toBe("hit1:so");
    s.level.move(1);
    const p = s.enter();
    expect(p.kind === "run" && p.item.id).toBe("hit2:so");
    s.level.backspace();
    s.level.backspace();
    expect(s.level.rows.map((r) => r.item.id)).toEqual(["cat:a", "cat:b"]);
  });
  it("a category opens as a numbered level whose letters search within it", () => {
    const s = find();
    s.pickNumber(1);
    expect(s.depth).toBe(2);
    expect(s.level.rows.map((r) => r.n)).toEqual([1, 2]);
    s.level.type("x");
    expect(s.level.rows.map((r) => r.item.id)).toEqual(["in-a:x"]);
  });
});
