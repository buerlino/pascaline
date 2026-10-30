// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { applyTheme, needsFile, type Family, type Theme } from "./apply.ts";

/** Just enough of an element: attributes in a map. */
function fakeRoot(): HTMLElement & { attrs: Map<string, string> } {
  const attrs = new Map<string, string>();
  return { attrs, setAttribute: (k: string, v: string) => void attrs.set(k, v), removeAttribute: (k: string) => void attrs.delete(k) } as unknown as HTMLElement & { attrs: Map<string, string> };
}
const nord: Theme = { family: "nord", brightness: "light", contrast: "high", keys: "plain" };

describe("applyTheme", () => {
  it("sets the attributes only after the family's file is in", async () => {
    const root = fakeRoot();
    let release: () => void = () => {};
    const loaded: Family[] = [];
    const p = applyTheme(nord, root, (f) => new Promise((res) => { loaded.push(f); release = () => res(undefined); }));
    await Promise.resolve();
    expect(loaded).toEqual(["nord"]);
    expect(root.attrs.size).toBe(0);
    release();
    await p;
    expect([...root.attrs]).toEqual([["data-family", "nord"], ["data-brightness", "light"], ["data-contrast", "high"], ["data-keys", "plain"]]);
  });
  it("a failed load leaves the root as it was", async () => {
    const root = fakeRoot();
    root.setAttribute("data-family", "pascaline");
    await expect(applyTheme(nord, root, () => Promise.reject(new Error("offline")))).rejects.toThrow("offline");
    expect([...root.attrs]).toEqual([["data-family", "pascaline"]]);
  });
  it("removes the contrast and keys attributes when they are off", async () => {
    const root = fakeRoot();
    root.setAttribute("data-contrast", "high");
    root.setAttribute("data-keys", "plain");
    await applyTheme({ family: "graphite", brightness: "dark", contrast: "normal", keys: "colour" }, root, async () => {});
    expect([...root.attrs.keys()]).toEqual(["data-family", "data-brightness"]);
  });
  it("Pascaline without transforms loads nothing; with one, its file", async () => {
    const loaded: Family[] = [];
    const load = async (f: Family): Promise<void> => void loaded.push(f);
    await applyTheme({ family: "pascaline", brightness: "dark", contrast: "normal", keys: "colour" }, fakeRoot(), load);
    expect(loaded).toEqual([]);
    await applyTheme({ family: "pascaline", brightness: "dark", contrast: "high", keys: "colour" }, fakeRoot(), load);
    expect(loaded).toEqual(["pascaline"]);
    expect(needsFile({ family: "gruvbox", brightness: "dark", contrast: "normal", keys: "colour" })).toBe(true);
  });
});

describe("applyTheme, two changes in a row", () => {
  const t = (family: Family): Theme => ({ family, brightness: "dark", contrast: "normal", keys: "colour" });
  it("ends in the last one chosen when the first load is released last", async () => {
    const root = fakeRoot();
    const releases = new Map<Family, () => void>();
    const load = (f: Family): Promise<void> => new Promise((res) => void releases.set(f, res));
    const first = applyTheme(t("nord"), root, load);
    const second = applyTheme(t("graphite"), root, load);
    await Promise.resolve();
    releases.get("graphite")?.();
    await second;
    expect(root.attrs.get("data-family")).toBe("graphite");
    releases.get("nord")?.();
    await first;
    expect(root.attrs.get("data-family")).toBe("graphite");
  });
  it("a change after an unfinished one still wins when the first finishes first", async () => {
    const root = fakeRoot();
    const releases = new Map<Family, () => void>();
    const load = (f: Family): Promise<void> => new Promise((res) => void releases.set(f, res));
    const first = applyTheme(t("nord"), root, load);
    const second = applyTheme(t("gruvbox"), root, load);
    await Promise.resolve();
    releases.get("nord")?.();
    await first;
    expect(root.attrs.has("data-family")).toBe(false); // superseded: nothing set yet
    releases.get("gruvbox")?.();
    await second;
    expect(root.attrs.get("data-family")).toBe("gruvbox");
  });
});

describe("modes.css", () => {
  it("is loaded only with Plain keys or High contrast", async () => {
    let n = 0;
    const modes = async (): Promise<void> => void n++;
    const t = (o: Partial<Theme>): Theme => ({ family: "pascaline", brightness: "dark", contrast: "normal", keys: "colour", ...o });
    await applyTheme(t({}), fakeRoot(), async () => {}, modes);
    await applyTheme(t({ family: "nord" }), fakeRoot(), async () => {}, modes);
    expect(n).toBe(0);
    await applyTheme(t({ keys: "plain" }), fakeRoot(), async () => {}, modes);
    await applyTheme(t({ contrast: "high" }), fakeRoot(), async () => {}, modes);
    expect(n).toBe(2);
  });
});
