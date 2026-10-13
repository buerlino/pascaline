// SPDX-License-Identifier: GPL-3.0-or-later
// Chips on the entry line (docs/04 2.8 and 3.6): the browser half of the MathLive macro check (the value keeps the
// macro, the chip looks unlike a variable; a screenshot is attached to the report), and chips that keep their value
// through recall and relaunch. Expected values are derived.
import { expect, test, type Page } from "@playwright/test";
import { entryValue, open, tap } from "./helpers.ts";

const lastResult = (page: Page) => page.locator('[data-testid="result"]').last().locator(".result");
const ready = (page: Page) =>
  page.waitForFunction(() => window.pascaline.session.engineState === "ready", undefined, { timeout: 20_000 });

/** The look of the first chip on the entry line and of a variable typed after it. */
function looks(page: Page): Promise<{ chipBg: string; chipGlyph: string; varGlyph: string; plainBg: string }> {
  return page.evaluate(() => {
    const root = window.pascaline.entry.field?.shadowRoot;
    const chip = root?.querySelector<HTMLElement>('[style*="--chip-bg"]');
    const glyphs = [...(root?.querySelectorAll<HTMLElement>(".ML__cmr, .ML__mathit") ?? [])];
    const x = glyphs.find((g) => g.textContent === "x" && !chip?.contains(g));
    return {
      chipBg: chip ? getComputedStyle(chip).backgroundColor : "",
      chipGlyph: chip?.querySelector(".ML__cmr, .ML__mathit")?.className ?? "",
      varGlyph: x?.className ?? "",
      plainBg: x ? getComputedStyle(x).backgroundColor : "",
    };
  });
}

test("MathLive keeps a chip macro in the value and draws it as a chip, not a variable", async ({ page }, info) => {
  await open(page);
  await page.evaluate(() => window.pascaline.entry.insertConst("c", "c", { value: "299792458", exact: true }));
  await tap(page, ["mul", "x"]);
  expect(await entryValue(page)).toBe("\\const{c}{c}\\times x");
  const l = await looks(page);
  expect(l.chipGlyph).toContain("ML__cmr"); // upright
  expect(l.varGlyph).toContain("ML__mathit"); // the variable x is italic
  expect(l.chipBg).not.toBe("rgba(0, 0, 0, 0)"); // accent background
  expect(l.chipBg).not.toBe(l.plainBg);
  info.attach("chip-vs-variable", { body: await page.locator("math-field").first().screenshot(), contentType: "image/png" });
  // the chip is one unit: the cursor steps over it and ⌫ deletes it whole
  await tap(page, ["bksp", "bksp", "bksp"]);
  expect(await entryValue(page)).toBe("");
  expect(await page.evaluate(() => window.pascaline.entry.chips)).toEqual({});
});

test("a recalled entry keeps the values of its chips, also after a relaunch", async ({ page }) => {
  await open(page, "");
  await ready(page);
  await tap(page, ["d1", "div", "d3", "enter"]);
  await expect(lastResult(page)).toHaveAttribute("data-text", "0.333333333333");
  await lastResult(page).tap();
  expect(await entryValue(page)).toBe("\\res{1}{0.333333333333}");
  await tap(page, ["mul", "d3", "enter"]);
  await expect(lastResult(page)).toHaveAttribute("data-text", "1");
  // tap the entry (not the result): it comes back with its chip, and gives 1 again
  await page.locator('[data-status="done"] .in').last().tap();
  expect(await entryValue(page)).toBe("\\res{1}{0.333333333333}\\times3");
  await tap(page, ["enter"]);
  await expect(page.locator('[data-status="done"]')).toHaveCount(3);
  await expect(lastResult(page)).toHaveAttribute("data-text", "1");
  await page.waitForTimeout(800); // the store write is debounced (400 ms)
  await page.reload();
  await page.waitForFunction(() => window.pascaline !== undefined);
  await ready(page);
  await expect(page.locator('[data-status="done"]')).toHaveCount(3);
  await page.locator('[data-status="done"] .in').last().tap();
  expect(await entryValue(page)).toBe("\\res{1}{0.333333333333}\\times3");
  await tap(page, ["enter"]);
  await expect(page.locator('[data-status="done"]')).toHaveCount(4);
  await expect(lastResult(page)).toHaveAttribute("data-text", "1");
});

test("÷, x² and x⁻¹ after a chip take the whole chip", async ({ page }) => {
  await open(page, "");
  await ready(page);
  await tap(page, ["d1", "frac", "d2", "right", "sub", "d1", "enter"]);
  await expect(lastResult(page)).toHaveAttribute("data-text", "-0.5");
  await lastResult(page).tap();
  await tap(page, ["sq"]);
  expect(await entryValue(page)).toBe("\\res{1}{-0.5}^2");
  await tap(page, ["enter"]);
  await expect(lastResult(page)).toHaveAttribute("data-text", "0.25"); // (−1/2)² = 1/4, not −(1/2)²
  await lastResult(page).tap();
  await tap(page, ["div", "d2"]);
  expect(await entryValue(page)).toBe("\\frac{\\res{2}{0.25}}{2}"); // chip 2: the counter no longer restarts at Enter (R16)
  await tap(page, ["enter"]);
  await expect(lastResult(page)).toHaveAttribute("data-text", "0.125");
  await lastResult(page).tap();
  await tap(page, ["shift", "div", "enter"]);
  await expect(lastResult(page)).toHaveAttribute("data-text", "8");
});
