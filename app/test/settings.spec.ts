// SPDX-License-Identifier: GPL-3.0-or-later
// R21b (decisions.md "R21", backlog C8): the Settings page, by touch, by hardware keys and by Android back
// (`history.back()`); back closes an open pick sheet; the history never grows. The fake engine.
import { expect, test, type Page } from "@playwright/test";
import { open, tap } from "./helpers.ts";

const page_ = (page: Page) => page.getByTestId("settings");
const row = (page: Page, id: string) => page_(page).locator(`[data-id="${id}"]`);
const sheet = (page: Page) => page.locator('[role="menu"]');
const historyLength = (page: Page) => page.evaluate(() => history.length);
/** history.back() is asynchronous: wait for its popstate. */
const back = async (page: Page) => {
  await page.evaluate(() => history.back());
};

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page);
});

test.describe("by touch", () => {
  test("× closes it; it covers the whole window, status line included", async ({ page }) => {
    await tap(page, ["shift", "apps", "d5"]);
    await expect(page_(page)).toBeVisible();
    const [box, win] = await Promise.all([page_(page).boundingBox(), page.evaluate(() => [innerWidth, innerHeight])]);
    expect(box).toMatchObject({ x: 0, y: 0 });
    expect(Math.round(box?.width ?? 0)).toBe(win[0]);
    expect(Math.round(box?.height ?? 0)).toBe(win[1]);
    await page.getByTestId("settings-close").tap();
    await expect(page_(page)).toBeHidden();
  });

  test("sections instead of submenus; a tick toggles; ◀ ▶ buttons are at least 44 × 44 px", async ({ page }) => {
    await tap(page, ["shift", "apps", "d5"]);
    await expect(page_(page)).toBeVisible();
    expect(await page.locator('[data-testid="settings"] section').evaluateAll((els) => els.map((e) => e.getAttribute("data-section")))).toEqual(["fmtCycle", "vibration", "taps"]);
    await expect(row(page, "pfx")).toHaveAttribute("aria-checked", "false");
    await row(page, "pfx").tap();
    await expect(row(page, "pfx")).toHaveAttribute("aria-checked", "true");
    expect(await page.evaluate(() => window.pascaline.session.settings.fmtCycle)).toContain("pfx");
    for (const b of await row(page, "decimals").locator("button").evaluateAll((els) => els.map((e) => e.getBoundingClientRect())))
      expect(Math.min(b.width, b.height)).toBeGreaterThanOrEqual(44);
    await row(page, "decimals").getByTestId("step-up").tap();
    expect(await page.evaluate(() => window.pascaline.session.settings.fixDecimals)).toBe(5);
  });

  test("a disabled row keeps its reason", async ({ page }) => {
    await tap(page, ["shift", "apps", "d5"]);
    await expect(row(page, "ms").getByTestId("settings-reason")).toHaveText("Switch key vibration on first");
    await row(page, "haptics").tap();
    await expect(row(page, "ms").getByTestId("settings-reason")).toHaveCount(0);
  });
});

test.describe("by hardware keys", () => {
  test("▲ ▼ move, ◀ ▶ step, Enter or space toggles, Esc closes", async ({ page }) => {
    await tap(page, ["shift", "apps", "d5"]);
    const active = page_(page).locator('[data-active="true"]');
    await expect(active).toHaveAttribute("data-id", "std");
    await page.keyboard.press("ArrowDown");
    await expect(active).toHaveAttribute("data-id", "sci");
    await page.keyboard.press("Enter"); // Scientific off
    await expect(row(page, "sci")).toHaveAttribute("aria-checked", "false");
    await page.keyboard.press(" "); // and on again
    await expect(row(page, "sci")).toHaveAttribute("aria-checked", "true");
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("ArrowUp"); // round the end: Reset
    await expect(active).toHaveAttribute("data-id", "reset");
    for (let i = 0; i < 6; i++) await page.keyboard.press("ArrowUp"); // since, alpha, shift, ms, strength, haptics
    await expect(active).toHaveAttribute("data-id", "haptics");
    await page.keyboard.press("ArrowRight");
    expect(await page.evaluate(() => window.pascaline.session.settings.haptics.on)).toBe(true);
    await page.keyboard.press("ArrowLeft");
    expect(await page.evaluate(() => window.pascaline.session.settings.haptics.on)).toBe(false);
    expect(await page.evaluate(() => window.pascaline.entry.value)).toBe(""); // nothing reached the entry line
    await page.keyboard.press("Escape");
    await expect(page_(page)).toBeHidden();
  });

  test("the keypad's keys drive it too: ▼ ▶ switches vibration on, Cancel closes", async ({ page }) => {
    await tap(page, ["shift", "apps", "d5"]);
    await tap(page, ["down", "down", "down", "down", "down", "down", "right"]);
    expect(await page.evaluate(() => window.pascaline.session.settings.haptics.on)).toBe(true);
    await tap(page, ["d5", "cancel"]);
    await expect(page_(page)).toBeHidden();
    expect(await page.evaluate(() => window.pascaline.entry.value)).toBe(""); // the 5 went nowhere
  });
});

test.describe("Android back (history.back())", () => {
  test("back closes the page, and the next key works as before", async ({ page }) => {
    await tap(page, ["shift", "apps", "d5"]);
    await expect(page_(page)).toBeVisible();
    await back(page);
    await expect(page_(page)).toBeHidden();
    await tap(page, ["d4", "d2"]);
    expect(await page.evaluate(() => window.pascaline.entry.value)).toBe("42");
  });

  test("back closes an open pick sheet, and the next key works as before", async ({ page }) => {
    await tap(page, ["apps"]);
    await expect(sheet(page)).toBeVisible();
    await back(page);
    await expect(sheet(page)).toHaveCount(0);
    await tap(page, ["d7"]);
    expect(await page.evaluate(() => window.pascaline.entry.value)).toBe("7");
  });

  // R15b: Settings is reached through the Mode sheet only; before the fix in backLayer.ts the page's entry was pushed
  // before the sheet's was taken back, so every open after the first left one entry behind
  test("opening and closing the page or a sheet five times leaves the history as it was", async ({ page }) => {
    const before = await historyLength(page);
    for (let i = 0; i < 5; i++) {
      await tap(page, ["shift", "apps", "d5"]);
      await expect(page_(page)).toBeVisible();
      expect(await historyLength(page)).toBe(before + 1);
      await [() => tap(page, ["esc"]), () => page.getByTestId("settings-close").tap(), () => tap(page, ["cancel"]), () => tap(page, ["menu"]), () => page.keyboard.press("Escape")][i]!();
      await expect(page_(page)).toBeHidden();
      await tap(page, ["apps"]);
      await expect(sheet(page)).toBeVisible();
      await page.getByRole("menuitem").first().tap(); // a pick closes it
      await expect(sheet(page)).toHaveCount(0);
    }
    await expect.poll(() => page.evaluate(() => history.state?.pascalineLayer)).toBeUndefined();
    await page.waitForTimeout(100);
    // the entries it pushed were taken back: the position is where it began, so back leaves the app
    expect(await historyLength(page)).toBeLessThanOrEqual(before + 1);
    expect(await page.evaluate(() => history.state)).toBeNull();
  });

  test("Mode then Settings (a sheet gives way to the page) takes one entry; back closes the page only", async ({ page }) => {
    await tap(page, ["shift", "apps", "d5"]);
    await expect(page_(page)).toBeVisible();
    await back(page);
    await expect(page_(page)).toBeHidden();
    expect(await page.evaluate(() => history.state)).toBeNull();
  });
});
