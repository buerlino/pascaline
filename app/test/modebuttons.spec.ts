// SPDX-License-Identifier: GPL-3.0-or-later
// R86 (docs/05 3.4, mockups/settings.html section 1): Mode shows Angle, Format and Entry as buttons, one per value, where
// that saves a press: a tap on a button sets the value and closes the sheet. The digits chip opens the digits list
// itself. By keys nothing changes: ◀ ▶ move the mark with the sheet open, a digit steps the row, Enter closes. Fake engine.
import { expect, test, type Page } from "@playwright/test";
import { open, tap } from "./helpers.ts";

const sheet = (page: Page) => page.getByTestId("menu");
const title = (page: Page) => page.getByTestId("sheet-title");
const opt = (page: Page, row: string, id: string) => sheet(page).locator(`[data-id="${row}"] [data-option="${id}"]`);
const setting = <K extends "angle" | "format" | "entry" | "digits">(page: Page, k: K) => page.evaluate((k) => window.pascaline.session.settings[k], k);

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page);
});

test.describe("by touch", () => {
  test("STD → SCI in 2 taps (the pill, SCI): the value is set and the sheet is closed", async ({ page }) => {
    await page.getByTestId("chip-format").tap();
    await expect(opt(page, "format", "std")).toHaveAttribute("aria-pressed", "true");
    await opt(page, "format", "sci").tap();
    await expect(sheet(page)).toHaveCount(0);
    expect(await setting(page, "format")).toBe("sci");
    await expect(page.getByTestId("chip-format")).toHaveText("SCI");
  });

  test("STD → PFX in 2 taps", async ({ page }) => {
    await page.getByTestId("chip-format").tap();
    await opt(page, "format", "pfx").tap();
    await expect(sheet(page)).toHaveCount(0);
    expect(await setting(page, "format")).toBe("pfx");
  });

  test("one-line entry in 2 taps, and back to textbook in 2", async ({ page }) => {
    await page.getByTestId("chip-format").tap();
    await opt(page, "entry", "line").tap();
    await expect(sheet(page)).toHaveCount(0);
    expect(await setting(page, "entry")).toBe("line");
    await page.getByTestId("chip-format").tap();
    await expect(opt(page, "entry", "line")).toHaveAttribute("aria-pressed", "true");
    await opt(page, "entry", "textbook").tap();
    expect(await setting(page, "entry")).toBe("textbook");
  });

  test("the angle row has its buttons too: DEG sets and closes", async ({ page }) => {
    await page.getByTestId("chip-format").tap();
    await opt(page, "angle", "deg").tap();
    await expect(sheet(page)).toHaveCount(0);
    expect(await setting(page, "angle")).toBe("deg");
  });

  test("the digits chip opens Mode › Significant digits; 20 is one more tap; ◀ from that list goes up to Mode", async ({ page }) => {
    await page.getByTestId("chip-digits").tap();
    await expect(title(page)).toHaveText("Mode › Significant digits");
    await expect(sheet(page).locator('[data-id="12"]')).toHaveAttribute("data-selected", "true");
    await tap(page, ["left"]);
    await expect(title(page)).toHaveText("Mode");
    await tap(page, ["esc"]);
    await expect(sheet(page)).toHaveCount(0);
    await page.getByTestId("chip-digits").tap();
    await sheet(page).locator('[data-id="20"]').tap();
    await expect(sheet(page)).toHaveCount(0);
    expect(await setting(page, "digits")).toBe(20);
  });

  test("a tap on a row's name steps its value forward and the sheet stays; digits keep their ◀ ▶ row", async ({ page }) => {
    await page.getByTestId("chip-format").tap();
    await sheet(page).locator('[data-id="format"] .label').tap();
    expect(await setting(page, "format")).toBe("sci");
    await expect(sheet(page)).toBeVisible();
    await expect(opt(page, "format", "sci")).toHaveAttribute("aria-pressed", "true");
    await expect(sheet(page).locator('[data-id="digits"]').getByTestId("step-up")).toHaveCount(1);
    await expect(sheet(page).locator('[data-id="format"]').getByTestId("step-up")).toHaveCount(0);
  });
});

test.describe("by keys", () => {
  test("◀ ▶ move the mark with the sheet open, a digit steps the row forward, Enter closes", async ({ page }) => {
    await page.getByTestId("chip-format").tap();
    await tap(page, ["right"]);
    await expect(opt(page, "format", "sci")).toHaveAttribute("aria-pressed", "true");
    await expect(sheet(page)).toBeVisible();
    await tap(page, ["left", "left"]);
    await expect(opt(page, "format", "pfx")).toHaveAttribute("aria-pressed", "true"); // round the end
    await tap(page, ["up", "d1"]); // Angle row: the digit steps it
    expect(await setting(page, "angle")).toBe("deg");
    await expect(sheet(page)).toBeVisible();
    await tap(page, ["enter"]);
    await expect(sheet(page)).toHaveCount(0);
  });

  test("@mode, right, enter gives what it gave: the angle unit switches", async ({ page }) => {
    await tap(page, ["@mode", "right", "enter"]);
    expect(await setting(page, "angle")).toBe("deg");
    await expect(sheet(page)).toHaveCount(0);
  });
});

for (const [w, h] of [
  [360, 767],
  [372, 767],
] as const)
  test(`at ${w} × ${h}: every button is at least 44 × 44 px and Mode fits without a scroll`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await page.getByTestId("chip-format").tap();
    const buttons = sheet(page).locator("[data-option]");
    await expect(buttons).toHaveCount(8); // 2 + 4 + 2
    for (const b of await buttons.evaluateAll((els) => els.map((e) => e.getBoundingClientRect())))
      expect(b.width >= 44 && b.height >= 44).toBe(true);
    const m = await sheet(page).locator(".list").evaluate((el) => ({ scroll: el.scrollHeight, client: el.clientHeight }));
    expect(m.scroll).toBeLessThanOrEqual(m.client);
    await expect(page.getByTestId("sheet-count")).toHaveCount(0);
    const overflow = await sheet(page).locator(".row").evaluateAll((rows) => rows.map((r) => r.scrollWidth - r.clientWidth));
    expect(Math.max(...overflow)).toBeLessThanOrEqual(0);
  });
