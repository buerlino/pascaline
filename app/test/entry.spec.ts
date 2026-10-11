// SPDX-License-Identifier: GPL-3.0-or-later
// Entry leftovers L2–L5 (docs/backlog.md), key-sequence tests on the real engine. Expected values are derived.
import { expect, test, type Page } from "@playwright/test";
import { entryValue, open, tap } from "./helpers.ts";

test.beforeEach(async ({ page }) => {
  await open(page, "");
  await page.waitForFunction(() => window.pascaline.session.engineState === "ready", undefined, { timeout: 20_000 });
});

const lastResult = (page: Page) => page.locator('[data-testid="result"]').last().locator(".result");

test("L2: 2 a/b a/b 1 ▶ 2 is the mixed number 2½; ×2 gives 5", async ({ page }) => {
  await tap(page, ["d2", "frac", "frac", "d1", "right", "d2", "right", "mul", "d2"]);
  expect(await entryValue(page)).toBe("2\\tfrac12\\times2");
  await tap(page, ["enter"]);
  await expect(lastResult(page)).toHaveAttribute("data-text", "5");
  // one a/b keeps the plain fraction: 1 a/b 4 → ¼ = 0.25
  await tap(page, ["d1", "frac", "d4", "enter"]);
  await expect(lastResult(page)).toHaveAttribute("data-text", "0.25");
});

test("L3: alpha twice locks lowercase letters, alpha again unlocks; shift alpha alpha locks capitals", async ({ page }) => {
  const alpha = page.locator('[data-key="alpha"]');
  await tap(page, ["alpha", "alpha"]);
  await expect(alpha).toHaveAttribute("data-locked", "true");
  await tap(page, ["sin", "cos", "tan"]);
  expect(await entryValue(page)).toBe("abc");
  await tap(page, ["alpha"]);
  await expect(alpha).not.toHaveAttribute("data-locked", "true");
  await tap(page, ["d7"]);
  expect(await entryValue(page)).toBe("abc7");
  await tap(page, ["shift", "bksp", "shift", "alpha", "alpha", "sin", "cos", "shift", "tan"]);
  expect(await entryValue(page)).toBe("ABc");
  await tap(page, ["alpha", "d7"]);
  expect(await entryValue(page)).toBe("ABc7");
});

test("L4: in one-line mode xʸ and a typed ^ are a literal caret; 2^10 gives 1024", async ({ page }) => {
  await page.evaluate(() => window.pascaline.session.setEntry("line"));
  await tap(page, ["d2", "pow", "d1", "d0"]);
  expect(await entryValue(page)).toBe('2\\char"5E 10');
  await tap(page, ["enter"]);
  await expect(lastResult(page)).toHaveAttribute("data-text", "1024");
  await page.locator("math-field").first().focus();
  await page.keyboard.type("3^2+1");
  expect(await entryValue(page)).toBe('3\\char"5E 2+1');
  await tap(page, ["enter"]);
  await expect(lastResult(page)).toHaveAttribute("data-text", "10");
});

test("L5: tapping a result puts it on the entry line, in Home and CAS", async ({ page }) => {
  await tap(page, ["d1", "div", "d4", "enter"]);
  await expect(lastResult(page)).toHaveAttribute("data-text", "0.25");
  await tap(page, ["d2", "mul"]);
  await lastResult(page).tap();
  expect(await entryValue(page)).toBe("2\\times0.25");
  await tap(page, ["enter"]);
  await expect(lastResult(page)).toHaveAttribute("data-text", "0.5");
  // CAS: x+1 comes back bracketed, so 2×(x+1) stays a product
  await tap(page, ["app"]);
  await expect(page.locator('[data-view="cas"]')).toHaveAttribute("aria-selected", "true");
  await tap(page, ["x", "add", "d1", "enter"]);
  await expect(page.locator('[data-testid="result"]').last().locator(".math")).toHaveAttribute("data-latex", "x+1");
  await tap(page, ["d2", "mul"]);
  await lastResult(page).tap();
  expect(await entryValue(page)).toBe("2\\times\\left(x+1\\right)");
  await tap(page, ["enter"]);
  await expect(page.locator('[data-testid="result"]').last().locator(".math")).toHaveAttribute("data-latex", /2\\left\(x\+1\\right\)|2x\+2/);
});
