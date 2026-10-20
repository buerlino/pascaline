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

// R44 (F37): a result whose exact text is over 2 kB keeps the engine's P-digit value as its chip, and Ans is never dropped.
test("a long result's chip keeps its value, marked approximate (2^10000 × 1)", async ({ page }) => {
  await open(page, "");
  await ready(page);
  await tap(page, ["d2", "pow", "d1", "d0", "d0", "d0", "d0", "right", "enter"]);
  await expect(lastResult(page)).toContainText("1.99506311688");
  await lastResult(page).tap();
  await tap(page, ["mul", "d1", "enter"]);
  const r = lastResult(page);
  await expect(page.locator('[data-status="done"]')).toHaveCount(2);
  await expect(r).toContainText("1.99506311688");
  expect(await r.getAttribute("data-text")).not.toMatch(/^=/);
  const chip = await page.evaluate(() => Object.values(window.pascaline.session.home.at(-1)?.chips ?? {})[0]);
  expect(chip?.value.startsWith("1.99506311688075")).toBe(true); // oracle 2^10000
  expect(chip?.exact).toBe(false);
});

test("an operator on an empty line after a long result starts with Ans", async ({ page }) => {
  await open(page, "");
  await ready(page);
  await tap(page, ["d2", "pow", "d1", "d0", "d0", "d0", "d0", "right", "enter"]);
  await expect(lastResult(page)).toContainText("1.99506311688");
  await tap(page, ["add", "d3"]);
  expect(await entryValue(page)).toMatch(/^\\ans/);
  await tap(page, ["enter"]);
  await expect(page.locator('[data-status="done"]')).toHaveCount(2);
  await expect(lastResult(page)).toContainText("1.99506311688");
});

test("a short exact result still gives an exact chip (1/3 × 3 = 1)", async ({ page }) => {
  await open(page, "");
  await ready(page);
  await tap(page, ["d1", "div", "d3", "enter"]);
  await lastResult(page).tap();
  await tap(page, ["mul", "d3", "enter"]);
  await expect(lastResult(page)).toHaveAttribute("data-text", "1");
});

// R65 (deep check 2026-10-19 D1, D2): a ⚠ result keeps its ⚠ through Ans and through a tapped chip, line after line.
// romberg(e^(-x²),x,0,1) is ⚠ 11 at 12 digits (unaudited); Ans·1 twice showed ≈ and then = 0.746824132812.
test("a ⚠ result stays ⚠ through Ans and a tapped chip (romberg × 1 × 1)", async ({ page }) => {
  await open(page, "");
  await ready(page);
  await page.evaluate(() => window.pascaline.session.submit("\\operatorname{romberg}\\left(\\exponentialE^{-x^2},x,0,1\\right)"));
  await expect(page.locator('[data-status="done"]')).toHaveCount(1);
  const mark = page.getByTestId("mark");
  await expect(mark.last()).toHaveAttribute("data-mark", "⚠");
  await tap(page, ["mul", "d1", "enter"]);
  await expect(page.locator('[data-status="done"]')).toHaveCount(2);
  await expect(mark.last()).toHaveAttribute("data-mark", "⚠");
  await tap(page, ["mul", "d1", "enter"]);
  await expect(page.locator('[data-status="done"]')).toHaveCount(3);
  await expect(mark.last()).toHaveAttribute("data-mark", "⚠");
  await page.locator('[data-testid="result"]').first().locator(".result").tap();
  await tap(page, ["mul", "d1", "enter"]);
  await expect(page.locator('[data-status="done"]')).toHaveCount(4);
  await expect(mark.last()).toHaveAttribute("data-mark", "⚠");
  const chip = await page.evaluate(() => Object.values(window.pascaline.session.home.at(-1)?.chips ?? {})[0]);
  expect(chip?.exact).toBe(false);
  expect(chip?.warn).toBe("unaudited");
});
