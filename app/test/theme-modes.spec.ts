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

const token = (page: Page, name: string): Promise<string> =>
  page.evaluate((n) => {
    const p = document.createElement("span");
    p.style.color = getComputedStyle(document.documentElement).getPropertyValue(n);
    document.body.append(p);
    const c = getComputedStyle(p).color;
    p.remove();
    return c;
  }, name);

test("Plain keys: the ⚠ mark and error text keep their colour; a sheet number is bold in the text colour", async ({ page }) => {
  await open(page, "");
  await page.waitForFunction(() => window.pascaline.session.engineState === "ready", undefined, { timeout: 20_000 });
  await set(page, "plain", "normal");
  const text = await page.evaluate(() => getComputedStyle(document.body).color);
  await page.evaluate(() => window.pascaline.session.submit("\\sin\\left(10^{2000}\\right)"));
  const mark = page.getByTestId("mark");
  await expect(mark).toHaveAttribute("data-mark", "⚠");
  expect((await style(page, '[data-testid="mark"]')).c).toBe(await token(page, "--warn"));
  expect((await style(page, '[data-testid="mark"]')).c).not.toBe(text);
  await tap(page, ["esc", "d1", "emark", "d2", "dot", "d5", "enter"]); // an error row
  await expect(page.locator('[data-status="error"]')).toHaveCount(1);
  expect((await style(page, '.out .error')).c).toBe(await token(page, "--error"));
  expect((await style(page, '.out .error')).c).not.toBe(text);
  await page.evaluate(() => {
    const w = window as unknown as { pascaline: { shell: { showMenu: (t: string, i: { id: string; label: string; run: () => void }[]) => void } } };
    w.pascaline.shell.showMenu("T", [{ id: "a", label: "one", run: () => {} }]);
  });
  await expect(page.getByTestId("menu")).toBeVisible();
  const n = await style(page, '[data-testid="menu"] .n');
  expect(n.w).toBe("700");
  expect(n.c).toBe(text);
});

test("High contrast: a locked Shift keeps a wider outline than a one-shot press", async ({ page }) => {
  await open(page);
  await set(page, "colour", "high");
  await tap(page, ["shift"]);
  const press = await style(page, '[data-key="shift"]');
  expect(parseFloat(press.o)).toBe(2);
  await tap(page, ["shift"]); // off
  const box = (await page.locator('[data-key="shift"]').boundingBox())!;
  const [x, y] = [box.x + box.width / 2, box.y + box.height / 2];
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y - 60, { steps: 6 });
  await page.mouse.up();
  await expect(page.locator('[data-key="shift"]')).toHaveAttribute("data-locked", "true");
  expect(parseFloat((await style(page, '[data-key="shift"]')).o)).toBeGreaterThan(parseFloat(press.o));
});

test("High contrast draws a 1.5 px outline round every key", async ({ page }) => {
  await open(page);
  expect((await style(page, '[data-key="x"]')).o).toBe("none");
  await set(page, "colour", "high");
  expect((await style(page, '[data-key="x"]')).o).toMatch(/^1(\.5)?px$/); // 1.5 px snaps to the device pixel
  expect((await style(page, '[data-key="enter"]')).o).toMatch(/^1(\.5)?px$/);
});
