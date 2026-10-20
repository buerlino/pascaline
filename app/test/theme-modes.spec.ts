// SPDX-License-Identifier: GPL-3.0-or-later
// R50d: Plain keys (bold = Shift, italic = Alpha, colour exceptions kept) and High contrast (outline round the keys).
import { expect, test, type Page } from "@playwright/test";
import { open, tap } from "./helpers.ts";

const set = (page: Page, keys: "colour" | "plain", contrast: "normal" | "high"): Promise<void> =>
  page.evaluate(
    async ([keys, contrast]) => {
      const url = "/src/theme/apply.ts";
      const m = (await import(/* @vite-ignore */ url)) as typeof import("../src/theme/apply.ts");
      await m.applyTheme({ family: "pascaline", brightness: "dark", contrast: contrast as "normal", keys: keys as "plain" }, document.documentElement);
    },
    [keys, contrast],
  );
const style = (page: Page, sel: string): Promise<{ w: string; s: string; c: string; o: string }> =>
  page.locator(sel).first().evaluate((el) => {
    const c = getComputedStyle(el);
    return { w: c.fontWeight, s: c.fontStyle, c: c.color, o: c.outlineStyle === "solid" ? c.outlineWidth : "none" };
  });

test("Plain keys: bold is Shift, italic is Alpha; neither switch changes nothing", async ({ page }) => {
  await open(page);
  const before = [await style(page, '[data-key="x"] .shiftlegend'), await style(page, '[data-key="x"] .alphalegend')];
  expect(before.map((b) => [b.w, b.s])).toEqual([["400", "normal"], ["400", "normal"]]);
  await set(page, "plain", "normal");
  const text = await page.evaluate(() => getComputedStyle(document.body).color);
  const sl = await style(page, '[data-key="x"] .shiftlegend');
  expect(sl.w).toBe("700");
  expect(sl.c).toBe(text);
  const al = await style(page, '[data-key="x"] .alphalegend');
  expect(al.s).toBe("italic");
  expect(al.c).toBe(text);
  await tap(page, ["shift"]);
  const face = await style(page, '[data-key="x"] .main');
  expect(face.w).toBe("700");
  expect(face.c).toBe(text);
  await tap(page, ["alpha"]);
  await tap(page, ["alpha"]);
  expect((await style(page, '[data-key="x"] .main')).s).toBe("italic");
  await set(page, "colour", "normal");
  await page.evaluate(() => document.documentElement.removeAttribute("data-keys"));
  await tap(page, ["alpha"]);
});

test("Plain keys: error text keeps its colour, ⚠ too", async ({ page }) => {
  await open(page);
  await set(page, "plain", "normal");
  const col = await page.evaluate(() => {
    const mk = (cls: string, attr = ""): string => {
      const host = document.createElement("div");
      host.innerHTML = `<span class="${cls}" ${attr}></span>`;
      document.body.append(host);
      return getComputedStyle(host.firstElementChild as Element).color;
    };
    return { err: mk("error"), text: getComputedStyle(document.body).color };
  });
  // the selector is global in modes.css; the element exists only as a probe, so compare against the token
  const token = await page.evaluate(() => {
    const p = document.createElement("span");
    p.style.color = getComputedStyle(document.documentElement).getPropertyValue("--error");
    document.body.append(p);
    return getComputedStyle(p).color;
  });
  const probe = await page.evaluate(() => {
    const host = document.createElement("div");
    host.className = "sheet";
    host.innerHTML = '<span class="n">1</span><span class="mark" data-mark="⚠">⚠</span>';
    document.body.append(host);
    const [n, w] = [host.children[0]!, host.children[1]!].map((e) => getComputedStyle(e));
    return { nw: n!.fontWeight, nc: n!.color, wc: w!.color, warn: getComputedStyle(document.documentElement).getPropertyValue("--warn") };
  });
  expect(probe.nw).toBe("700");
  expect(probe.nc).toBe(col.text);
  expect(probe.wc).not.toBe(col.text);
  expect(col.err).toBe(token);
  expect(col.err).not.toBe(col.text);
});

test("High contrast draws a 1.5 px outline round every key", async ({ page }) => {
  await open(page);
  expect((await style(page, '[data-key="x"]')).o).toBe("none");
  await set(page, "colour", "high");
  expect((await style(page, '[data-key="x"]')).o).toMatch(/^1(\.5)?px$/); // 1.5 px snaps to the device pixel
  expect((await style(page, '[data-key="enter"]')).o).toMatch(/^1(\.5)?px$/); // 1.5 px snaps to the device pixel
});
