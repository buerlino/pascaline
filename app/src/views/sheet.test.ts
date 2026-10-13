// SPDX-License-Identifier: GPL-3.0-or-later
// The sheet model and its keys (docs/05 3.1 with section 7).
import { beforeEach, describe, expect, it } from "vitest";
import type { MenuItem } from "../apps/types.ts";
import { keyboard, type Key } from "../keyboard/keyboard.ts";
import { FILTER_ABOVE, Sheet, forgetPicks, matches } from "./sheet.svelte.ts";
import { letterOf, sheetKey } from "./sheetKeys.ts";

const ran: string[] = [];
const item = (id: string, extra: Partial<MenuItem> = {}): MenuItem => ({ id, label: id, run: () => void ran.push(id), ...extra });
const key = (id: string): Key => {
  const k = keyboard.byId.get(id);
  if (!k) throw new Error(`no key ${id}`);
  return k;
};

beforeEach(() => {
  ran.length = 0;
  forgetPicks();
});

describe("Sheet: picking", () => {
  const plot = (): MenuItem[] => [
    item("Root"),
    item("Extremum", { disabled: true, reason: "Define a function first" }),
    item("Intersection", { submenu: { title: "Intersection of F1(x) and", items: [item("F2(x)"), item("x-axis")] } }),
    item("Slope"),
  ];

  it("a digit picks the row with that number; disabled rows keep their place and number, and do nothing", () => {
    const s = new Sheet("t", "Menu", plot);
    expect(s.level.rows.map((r) => r.n)).toEqual([1, 2, 3, 4]);
    expect(s.pickNumber(2)).toEqual({ kind: "stay" });
    expect(s.pickNumber(4)).toMatchObject({ kind: "run", item: { id: "Slope" } });
  });

  it("starts on the first row that can be picked, Enter picks the highlighted row", () => {
    const s = new Sheet("t", "Menu", () => [item("a", { disabled: true }), item("b"), item("c")]);
    expect(s.level.current?.id).toBe("b");
    expect(s.enter()).toMatchObject({ kind: "run", item: { id: "b" } });
  });

  it("▲ ▼ move round the ends and may rest on a disabled row (to read its reason); Enter there does nothing", () => {
    const s = new Sheet("t", "Menu", plot);
    expect(s.level.current?.id).toBe("Root");
    s.level.move(-1);
    expect(s.level.current?.id).toBe("Slope");
    s.level.move(1);
    s.level.move(1);
    expect(s.level.current?.id).toBe("Extremum");
    expect(s.enter()).toEqual({ kind: "stay" });
  });

  it("a submenu opens on top (digit, Enter or ▶), the path is in the title; back returns, false at the root", () => {
    const s = new Sheet("t", "Menu", plot);
    expect(s.right()).toEqual({ kind: "stay" }); // Root has no submenu
    expect(s.depth).toBe(1);
    s.pickNumber(3);
    expect(s.depth).toBe(2);
    expect(s.path).toBe("Menu › Intersection of F1(x) and");
    expect(s.level.title).toBe("Intersection of F1(x) and");
    expect(s.back()).toBe(true);
    expect(s.level.current?.id).toBe("Intersection");
    s.level.move(1);
    s.level.move(-1);
    s.right();
    expect(s.depth).toBe(2);
    expect(s.pickNumber(2)).toMatchObject({ kind: "run", item: { id: "x-axis" } });
    s.back();
    expect(s.back()).toBe(false);
  });

  it("0 picks the tenth row; rows past the tenth have no number", () => {
    const s = new Sheet("t", "Long", () => Array.from({ length: 12 }, (_, i) => item(`i${i + 1}`)));
    const rows = s.level.rows;
    expect(rows.map((r) => r.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, undefined, undefined]);
    expect(s.pickNumber(10)).toMatchObject({ item: { id: "i10" } });
    expect(s.activate(11)).toMatchObject({ item: { id: "i12" } }); // a tap reaches it
  });
});

describe("Sheet: the last pick is remembered per sheet and level", () => {
  it("reopening highlights the item picked last (Menu + Enter repeats it)", () => {
    const items = (): MenuItem[] => [item("a"), item("b"), item("c")];
    new Sheet("menu:home", "Menu", items).pickNumber(3);
    expect(new Sheet("menu:home", "Menu", items).level.current?.id).toBe("c");
    expect(new Sheet("menu:function:plot", "Menu", items).level.current?.id).toBe("a"); // another sheet
  });
  it("is kept by item id, so it follows the item; a pick that is now disabled falls back to the first live row", () => {
    new Sheet("m", "Menu", () => [item("a"), item("b")]).pickNumber(2);
    expect(new Sheet("m", "Menu", () => [item("x"), item("a"), item("b")]).level.current?.id).toBe("b");
    expect(new Sheet("m", "Menu", () => [item("a"), item("b", { disabled: true })]).level.current?.id).toBe("a");
  });
  it("in submenus too", () => {
    const items = (): MenuItem[] => [item("a"), item("s", { submenu: { title: "S", items: [item("x"), item("y")] } })];
    const s = new Sheet("m", "Menu", items);
    s.pickNumber(2);
    s.pickNumber(2);
    const again = new Sheet("m", "Menu", items);
    expect(again.level.current?.id).toBe("s");
    again.enter();
    expect(again.level.current?.id).toBe("y");
  });
});

describe("Sheet: the letter filter", () => {
  const long = (): MenuItem[] =>
    ["Copy", "Copy as shown", "Copy exact", "Paste", "Share session", "Clear history", "sin", "cos", "tan", "x-axis", "F1(x)", "Slope"].map((l) =>
      item(l),
    );

  it("is on for lists longer than ten items only", () => {
    expect(FILTER_ABOVE).toBe(10);
    expect(new Sheet("t", "L", long).level.filterable).toBe(true);
    const short = new Sheet("t", "S", () => long().slice(0, 10)).level;
    expect(short.filterable).toBe(false);
    expect(short.type("C")).toBe(false);
    expect(short.filter).toBe("");
  });

  it("matches the start of any word, ignoring case; the matches are numbered in order", () => {
    const s = new Sheet("t", "L", long);
    s.level.type("C");
    expect(s.level.rows.map((r) => r.item.id)).toEqual(["Copy", "Copy as shown", "Copy exact", "Clear history", "cos"]);
    s.level.type("O");
    expect(s.level.rows.map((r) => [r.n, r.item.id])).toEqual([
      [1, "Copy"],
      [2, "Copy as shown"],
      [3, "Copy exact"],
      [4, "cos"],
    ]);
    expect(s.level.current?.id).toBe("Copy");
    expect(s.pickNumber(4)).toMatchObject({ item: { id: "cos" } });
  });

  it("⌫ takes the last letter back; nothing to delete returns false", () => {
    const s = new Sheet("t", "L", long);
    s.level.type("S");
    s.level.type("H");
    expect(s.level.rows.map((r) => r.item.id)).toEqual(["Copy as shown", "Share session"]);
    expect(s.level.backspace()).toBe(true);
    expect(s.level.rows.length).toBe(4); // Copy as shown, Share session, sin, Slope
    s.level.backspace();
    expect(s.level.backspace()).toBe(false);
    expect(s.level.rows.length).toBe(12);
  });

  it("no match leaves nothing highlighted, and Enter does nothing", () => {
    const s = new Sheet("t", "L", long);
    s.level.type("Q");
    expect(s.level.rows).toEqual([]);
    expect(s.enter()).toEqual({ kind: "stay" });
    s.level.move(1);
    expect(s.level.highlight).toBe(-1);
  });

  it("word starts: after a space, a dash or a bracket", () => {
    expect(matches("x-axis", "a")).toBe(true);
    expect(matches("F1(x)", "x")).toBe(true);
    expect(matches("Copy as shown", "sh")).toBe(true);
    expect(matches("Copy", "py")).toBe(false);
  });
});

describe("Sheet: settings changed in place (docs/05 3.4)", () => {
  const value = { v: 1 };
  const row = (id: string, extra: Partial<MenuItem> = {}): MenuItem => ({
    id,
    label: id,
    get value() {
      return String(value.v);
    },
    adjust: (by) => void (value.v += by),
    ...extra,
  });

  it("▶ and ◀ step the highlighted value; a digit or a tap steps it forward and the sheet stays; Enter closes", () => {
    value.v = 1;
    const s = new Sheet("m", "Mode", () => [row("a"), item("b")]);
    expect(s.right()).toEqual({ kind: "stay" });
    expect(value.v).toBe(2);
    expect(s.left()).toBe(true);
    expect(value.v).toBe(1);
    expect(s.pickNumber(1)).toEqual({ kind: "stay" });
    expect(s.activate(0)).toEqual({ kind: "stay" });
    expect(value.v).toBe(3);
    expect(s.enter().kind).toBe("run"); // picked as it stands: shell.picked closes the sheet
    expect(value.v).toBe(3);
  });
  it("◀ on a row that is not a setting is not taken (it goes back), and a disabled setting does not step", () => {
    value.v = 1;
    const s = new Sheet("m", "Mode", () => [item("b"), row("a", { disabled: true })]);
    expect(s.left()).toBe(false);
    s.level.move(1);
    expect(s.right()).toEqual({ kind: "stay" });
    expect(s.left()).toBe(false);
    expect(value.v).toBe(1);
  });
  it("a setting with a list of values: a digit opens the list, Enter opens it too, the current value is marked and highlighted", () => {
    value.v = 20;
    const list = [4, 12, 20].map((n) => ({ id: String(n), label: String(n), get selected() { return value.v === n; }, run: () => void (value.v = n) }));
    const s = new Sheet("m", "Mode", () => [row("digits", { submenu: { title: "Digits", items: list } })]);
    expect(s.pickNumber(1)).toEqual({ kind: "stay" });
    expect(s.depth).toBe(2);
    expect(s.level.current?.id).toBe("20");
    const at12 = s.pickNumber(2);
    expect(at12.kind).toBe("run");
    if (at12.kind === "run") at12.item.run?.();
    expect(value.v).toBe(12);
  });
  it("a switch (keep) runs and the sheet stays", () => {
    const s = new Sheet("m", "Cycle", () => [item("x", { keep: true }), item("y")]);
    expect(s.pickNumber(1)).toEqual({ kind: "stay" });
    expect(s.enter()).toEqual({ kind: "stay" });
    expect(ran).toEqual(["x", "x"]);
  });
  it("remember: false always starts on the first row, and `at` starts on the row asked for", () => {
    const items = () => [item("a"), item("b"), item("c")];
    new Sheet("m", "Mode", items).pickNumber(3);
    expect(new Sheet("m", "Mode", items, { remember: false }).level.current?.id).toBe("a");
    expect(new Sheet("m", "Mode", items, { remember: false, at: "b" }).level.current?.id).toBe("b");
    expect(new Sheet("m", "Mode", items, { at: "nope" }).level.current?.id).toBe("c");
  });
});

describe("sheet keys (docs/05 3.1)", () => {
  it("digits pick 1…9 and 0 = 10, whatever the layer", () => {
    expect(sheetKey(key("d1"), false)).toEqual({ kind: "pick", n: 1 });
    expect(sheetKey(key("d0"), true)).toEqual({ kind: "pick", n: 10 });
  });
  it("arrows move and go back/forward, Enter picks, Esc and ◀ go back, Cancel closes, ⌫ edits the filter", () => {
    expect(sheetKey(key("up"), false)).toEqual({ kind: "move", by: -1 });
    expect(sheetKey(key("down"), false)).toEqual({ kind: "move", by: 1 });
    expect(sheetKey(key("right"), false)).toEqual({ kind: "right" });
    expect(sheetKey(key("left"), false)).toEqual({ kind: "left" });
    expect(sheetKey(key("esc"), false)).toEqual({ kind: "back" });
    expect(sheetKey(key("enter"), false)).toEqual({ kind: "enter" });
    expect(sheetKey(key("cancel"), false)).toEqual({ kind: "close" });
    expect(sheetKey(key("bksp"), false)).toEqual({ kind: "backspace" });
  });
  it("Shift, Alpha, Menu, Apps and the keys that change place keep their own job", () => {
    for (const id of ["shift", "alpha", "menu", "apps", "app", "cas", "symb", "plot", "num"]) expect(sheetKey(key(id), false), id).toEqual({ kind: "pass" });
  });
  it("a non-digit key types its letter into a long list's filter, and does nothing in a short list", () => {
    expect(sheetKey(key("sin"), true)).toEqual({ kind: "letter", ch: "G" });
    expect(sheetKey(key("vars"), true)).toEqual({ kind: "letter", ch: "A" });
    expect(sheetKey(key("sin"), false)).toEqual({ kind: "none" });
    expect(sheetKey(key("sub"), true)).toEqual({ kind: "none" }); // its alpha is ":"
    expect(sheetKey(key("view"), true)).toEqual({ kind: "none" });
  });
  it("every letter A–Z is on exactly one non-digit key, or on a digit key (reached by a flick in R9)", () => {
    const letters = keyboard.keys.map((k) => [k.id, letterOf(k)] as const).filter(([, l]) => l !== undefined);
    expect(letters.map(([, l]) => l).sort().join("")).toBe("ABCDEFGHIJKLMNOPQRSTUVWXYZ");
  });
});
