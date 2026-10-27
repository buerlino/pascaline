// SPDX-License-Identifier: GPL-3.0-or-later
// R83: the Menu names its view; a view with no rows of its own points to the view that has them.
import { beforeEach, describe, expect, it } from "vitest";
import type { Calc, CalcSettings } from "../calc/port.ts";
import { forgetPicks } from "../views/sheet.svelte.ts";
import type { FunctionApp } from "./function/app.svelte.ts";
import { AppShell } from "./shell.svelte.ts";

// theme.svelte.ts (loaded with the Function app) reads the page's brightness; the apps load on first use, after this.
Object.assign(globalThis, {
  document: { documentElement: { dataset: {} } },
  MutationObserver: class { observe(): void {} },
});

const settings: CalcSettings = { digits: 12, angle: "rad", format: "std" };
const kv = { get: async () => undefined, set: async () => undefined };
const line = { value: "", set() {}, clear() {} };

function shell(): AppShell {
  const s = new AppShell({} as Calc, kv, line, () => settings);
  s.homeMenu = () => [{ id: "copy", label: "Copy" }];
  s.homeView = () => "home";
  return s;
}
const ids = (s: AppShell): string[] => (s.sheet?.level.items ?? []).map((i) => i.id);

describe("R83 the Menu says whose it is", () => {
  beforeEach(() => forgetPicks());

  it("names Home and CAS", () => {
    const s = shell();
    s.toggleMenu();
    expect(s.sheet?.path).toBe("Home menu");
    expect(s.sheet?.icon).toBe("home");
    s.closeSheet();
    s.homeView = () => "cas";
    s.toggleMenu();
    expect(s.sheet?.path).toBe("CAS menu");
  });

  it("names every view of Function and Solve", async () => {
    const s = shell();
    for (const [app, view, name] of [["function", "symb", "Symb"], ["function", "plot", "Plot"], ["function", "num", "Num"], ["solve", "symb", "Symb"], ["solve", "num", "Num"]] as const) {
      await s.open(app, view);
      s.toggleMenu();
      expect(s.sheet?.path).toBe(`${name} menu`);
      expect(s.sheet?.icon).toBe(view);
      s.closeSheet();
    }
  });

  it("Function's Symb Menu points to Plot's, by tap row, Enter and digit", async () => {
    for (const pick of ["digit", "enter"] as const) {
      const s = shell();
      await s.open("function", "symb");
      (s.instance as FunctionApp).define(0, "x^2");
      s.toggleMenu();
      expect(ids(s)).toEqual(["in-plot", "settings"]);
      expect(s.sheet?.level.items[0]?.label).toBe("Root, extremum … in Plot");
      if (pick === "digit") expect(s.pick(1)).toBe(true);
      else s.picked(s.sheet!.enter());
      await Promise.resolve();
      await Promise.resolve();
      expect(s.view).toBe("plot");
      expect(s.sheet?.path).toBe("Plot menu");
      expect(s.sheet?.level.current?.id).toBe("root");
      expect(ids(s)[0]).toBe("root");
    }
  });

  it("Solve's Symb Menu points to Num's", async () => {
    const s = shell();
    await s.open("solve", "symb");
    s.toggleMenu();
    expect(s.sheet?.level.items[0]?.label).toBe("Solve, polynomial roots … in Num");
    s.pick(1);
    await Promise.resolve();
    await Promise.resolve();
    expect(s.view).toBe("num");
    expect(s.sheet?.path).toBe("Num menu");
    expect(s.sheet?.level.items[0]?.id).toBe("solve"); // disabled without an equation, so the highlight starts on Settings
  });

  it("a view with rows of its own gets no pointer", async () => {
    const s = shell();
    for (const [app, view] of [["function", "plot"], ["function", "num"], ["solve", "num"]] as const) {
      await s.open(app, view);
      s.toggleMenu();
      expect(ids(s).some((i) => i.startsWith("in-"))).toBe(false);
      s.closeSheet();
    }
    s.close();
    s.toggleMenu();
    expect(ids(s)).toEqual(["copy", "settings"]);
  });
});
