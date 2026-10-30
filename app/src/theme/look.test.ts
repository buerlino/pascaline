// SPDX-License-Identifier: GPL-3.0-or-later
// R50e: the look's values, and the inline script of index.html that shows them before the first paint.
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { themeCssMap } from "../../vite-plugin-theme-css.ts";
import { defaultLook, validLook } from "./look.ts";
import { themeOf } from "./lookApply.ts";
import { FAMILIES, stepped } from "./lookView.ts";

describe("look", () => {
  it("the dots are the dark block's screen, number key, Enter, Shift and Alpha of the generated CSS", () => {
    const roles = ["bg", "key-num", "key-enter", "shift", "alpha"];
    for (const f of FAMILIES) {
      const file = f.id === "pascaline" ? "../style.css" : `./${f.id}.css`;
      const css = readFileSync(new URL(file, import.meta.url), "utf8");
      const block = css.match(new RegExp(`:root\\[data-family="${f.id}"\\]\\[data-brightness="dark"\\]\\s*\\{([^}]*)\\}`))?.[1] ?? "";
      expect(f.dots, f.id).toEqual(roles.map((r) => block.match(new RegExp(`--${r}:\\s*(#[0-9a-f]+)`))?.[1]));
    }
  });
  it("first-start defaults: Dark in the Android app, System in the browser, High contrast when asked", () => {
    expect(defaultLook()).toEqual({ family: "pascaline", brightness: "system", contrast: false, plain: false });
    expect(defaultLook(true, true)).toEqual({ family: "pascaline", brightness: "dark", contrast: true, plain: false });
  });
  it("System follows the phone; the other two do not", () => {
    const l = { ...defaultLook(), family: "nord" as const, plain: true };
    expect(themeOf(l, true)).toEqual({ family: "nord", brightness: "light", contrast: "normal", keys: "plain" });
    expect(themeOf({ ...l, brightness: "dark" }, true).brightness).toBe("dark");
    expect(themeOf({ ...l, brightness: "light", contrast: true }, false)).toMatchObject({ brightness: "light", contrast: "high" });
  });
  it("validLook keeps the fallback for a wrong field; stepped goes round", () => {
    expect(validLook({ family: "x", brightness: "light", contrast: 1, plain: true }, defaultLook())).toEqual({ family: "pascaline", brightness: "light", contrast: false, plain: true });
    expect(stepped(["a", "b", "c"], "c", 1)).toBe("a");
    expect(stepped(["a", "b", "c"], "a", -1)).toBe("c");
  });
});

/** Runs the first inline script of index.html on a fake page. */
function runInline(opts: { stored?: unknown; light?: boolean; more?: boolean; native?: boolean; throws?: boolean; files?: Record<string, string> }) {
  const html = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
  let script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1] ?? "";
  script = script.replace("/*theme-css*/{}", JSON.stringify(opts.files ?? { pascaline: "a/p.css", nord: "a/n.css", modes: "a/m.css" }));
  const attrs: Record<string, string> = {};
  const meta: Record<string, string> = {};
  const written: string[] = [];
  const document = {
    documentElement: { setAttribute: (k: string, v: string) => void (attrs[k] = v) },
    querySelector: () => ({ setAttribute: (k: string, v: string) => void (meta[k] = v) }),
    write: (h: string) => void written.push(h),
    baseURI: "http://x/",
  };
  const window = { matchMedia: (q: string) => ({ matches: q.includes("light") ? opts.light === true : opts.more === true }), Capacitor: opts.native ? { isNativePlatform: () => true } : undefined };
  const localStorage = { getItem: () => { if (opts.throws) throw new Error("blocked"); return opts.stored === undefined ? null : JSON.stringify(opts.stored); } };
  runInNewContext(script, { document, window, localStorage, matchMedia: window.matchMedia, URL });
  return { attrs, meta, written };
}

describe("the inline script of index.html", () => {
  it("shows the stored look and links its CSS", () => {
    const r = runInline({ stored: { family: "nord", brightness: "light", contrast: true, plain: true, bg: "#eceff4" } });
    expect(r.attrs).toEqual({ "data-family": "nord", "data-brightness": "light", "data-contrast": "high", "data-keys": "plain" });
    expect(r.meta["content"]).toBe("#eceff4");
    expect(r.written.map((w) => w.match(/href="([^"]+)"/)?.[1])).toEqual(["http://x/a/n.css", "http://x/a/m.css"]);
  });
  it("Pascaline with no switch links nothing; a stored System follows the phone", () => {
    const r = runInline({ stored: { family: "pascaline", brightness: "system", contrast: false, plain: false }, light: true });
    expect(r.attrs).toEqual({ "data-family": "pascaline", "data-brightness": "light" });
    expect(r.written).toEqual([]);
  });
  it("prefers-contrast: more counts only when nothing is stored", () => {
    expect(runInline({ more: true }).attrs["data-contrast"]).toBe("high");
    expect(runInline({ more: true, stored: { family: "pascaline", brightness: "dark", contrast: false, plain: false } }).attrs["data-contrast"]).toBeUndefined();
  });
  it("nothing stored: Dark in the Android app, System in the browser; a blocked store gives the same", () => {
    expect(runInline({ native: true, light: true }).attrs["data-brightness"]).toBe("dark");
    expect(runInline({ light: true }).attrs["data-brightness"]).toBe("light");
    expect(runInline({ throws: true, native: true }).attrs["data-brightness"]).toBe("dark");
  });
  it("a wrong stored value is ignored, field by field", () => {
    const r = runInline({ stored: { family: "x", brightness: "light", contrast: "yes", bg: "red; x" } });
    expect(r.attrs).toEqual({ "data-family": "pascaline", "data-brightness": "light" });
    expect(r.meta["content"]).toBeUndefined();
  });
});

describe("themeCssMap", () => {
  it("finds the six files by source name or by hashed name", () => {
    const m = themeCssMap([
      { fileName: "assets/x-1.css", originalFileNames: ["src/theme/nord.css"] },
      { fileName: "assets/graphite-AbC_1.css" },
      { fileName: "assets/index-1.css" },
    ]);
    expect(m).toEqual({ nord: "assets/x-1.css", graphite: "assets/graphite-AbC_1.css" });
  });
});
