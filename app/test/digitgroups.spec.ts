// SPDX-License-Identifier: GPL-3.0-or-later
// R55: a drawn result has thin-space digit groups; the text, the tapped chip and Copy stay plain digits.
// Expected values are derived (1/3 to 12 digits; C(49,6) = 13983816).
import { expect, test, type Page } from "@playwright/test";
import { entryValue, open, tap, useClipboardLock } from "./helpers.ts";

test.use({ permissions: ["clipboard-read", "clipboard-write"] });
test.describe.configure({ mode: "serial" });
useClipboardLock();

const lastResult = (page: Page) => page.locator('[data-testid="result"]').last().locator(".result");
const done = (page: Page, n: number) => expect(page.locator('[data-status="done"]')).toHaveCount(n);

test.beforeEach(async ({ page }) => {
  await open(page, "");
  await page.waitForFunction(() => window.pascaline.session.engineState === "ready", undefined, { timeout: 20_000 });
});

test("a 12-digit result is drawn in groups; the text, the chip and ×3 stay plain (1/3 × 3 = 1)", async ({ page }) => {
  await tap(page, ["d1", "div", "d3", "enter"]);
  await done(page, 1);
  await expect(lastResult(page)).toHaveAttribute("data-text", "0.333333333333");
  await expect(lastResult(page).locator(".math")).toHaveAttribute("data-latex", "0.333\\,333\\,333\\,333");
  await lastResult(page).tap();
  const v = await entryValue(page);
  expect(v).toContain("\\res");
  expect(v).not.toContain("\\,"); // the chip's shown text is the plain digits
  await tap(page, ["mul", "d3", "enter"]);
  await done(page, 2);
  await expect(lastResult(page)).toHaveAttribute("data-text", "1");
  await expect(page.getByTestId("mark").last()).toHaveText("=");
});

test("a long integer is grouped from the right; a short one and a small exponent form are not", async ({ page }) => {
  await tap(page, ["d1", "d3", "d9", "d8", "d3", "d8", "d1", "d6", "enter"]);
  await done(page, 1);
  await expect(lastResult(page)).toHaveAttribute("data-text", "13983816");
  await expect(lastResult(page).locator(".math")).toHaveAttribute("data-latex", "13\\,983\\,816");
  await tap(page, ["d1", "d2", "d3", "d4", "enter"]);
  await done(page, 2);
  await expect(lastResult(page).locator(".math")).toHaveAttribute("data-latex", "1234");
});

test("Copy gives the plain digits of a grouped result", async ({ page }) => {
  await tap(page, ["d1", "div", "d3", "enter"]);
  await done(page, 1);
  await tap(page, ["copy"]);
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe("0." + "3".repeat(40));
});
