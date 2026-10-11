// SPDX-License-Identifier: GPL-3.0-or-later
// Desktop key-sequence tests against the real engine (docs/shifts/brief.md section 8, item 2).
// Run with GIAC_OUT=<dir with giac.mjs> when the engine is not built in this checkout.
import { expect, test, type Page } from "@playwright/test";
import { entryValue, open, tap } from "./helpers.ts";

test.beforeEach(async ({ page }) => {
  await open(page, "");
  await page.waitForFunction(() => window.pascaline.session.engineState === "ready", undefined, { timeout: 20_000 });
});

const lastResult = (page: Page) => page.locator('[data-testid="result"]').last();
const lastText = (page: Page) => lastResult(page).locator(".result").getAttribute("data-text");

test("Home: 1 ÷ 3 Enter shows a stacked fraction and 0.333333333333 (device)", async ({ page }) => {
  await tap(page, ["d1", "div", "d3"]);
  expect(await entryValue(page)).toBe("\\frac13");
  await expect(page.locator("math-field").first()).toBeVisible();
  await tap(page, ["enter"]);
  await expect(lastResult(page).locator(".result")).toBeVisible();
  expect(await lastText(page)).toBe("0.333333333333");
  expect(await entryValue(page)).toBe("");
});

test("Home: 1-0.9-0.1 gives 0", async ({ page }) => {
  await tap(page, ["d1", "sub", "d0", "dot", "d9", "sub", "d0", "dot", "d1", "enter"]);
  await expect(lastResult(page).locator(".result")).toBeVisible();
  expect(await lastText(page)).toBe("0");
});

test("CAS: 1 a/b 3 + 1 a/b 6 Enter is drawn as a stacked one half (assumed, G2 item 17)", async ({ page }) => {
  await tap(page, ["app"]);
  await expect(page.locator('[data-view="cas"]')).toHaveAttribute("aria-selected", "true");
  await tap(page, ["d1", "frac", "d3", "right", "add", "d1", "frac", "d6", "enter"]);
  const res = lastResult(page).locator(".math");
  await expect(res).toBeVisible();
  expect(await res.getAttribute("data-latex")).toBe("\\frac{1}{2}");
  await expect(res.locator(".ML__mfrac")).toHaveCount(1);
});

test("CAS: √8 is drawn as 2√2 (assumed, G2 item 17)", async ({ page }) => {
  await tap(page, ["app", "sqrt", "d8", "enter"]);
  const res = lastResult(page).locator(".math");
  await expect(res).toBeVisible();
  expect(await res.getAttribute("data-latex")).toBe("2\\sqrt{2}");
});

test("one-line mode shows the entry on one line", async ({ page }) => {
  await page.evaluate(() => window.pascaline.session.setEntry("line"));
  await tap(page, ["d1", "div", "d3"]);
  expect(await entryValue(page)).toBe("1\\div3");
  await page.evaluate(() => window.pascaline.entry.clear());
  await tap(page, ["sqrt", "d8"]);
  expect(await entryValue(page)).not.toContain("\\sqrt{");
  await page.evaluate(() => window.pascaline.session.setEntry("textbook"));
});

test("Cancel stops a long CAS job; history and variables survive", async ({ page }) => {
  // a:=7 in Home (no store key on the keyboard yet), then a long CAS job (factoring a 65-digit semiprime takes ~16 s), then Cancel
  await page.evaluate(() => window.pascaline.entry.set("a:=7"));
  await tap(page, ["enter"]);
  await expect(lastResult(page).locator(".result")).toBeVisible();
  await tap(page, ["app"]);
  await page.evaluate(() =>
    window.pascaline.entry.set(
      "\\operatorname{ifactor}\\left(\\operatorname{nextprime}\\left(10^{32}\\right)\\times\\operatorname{nextprime}\\left(10^{33}\\right)\\right)",
    ),
  );
  await tap(page, ["enter"]);
  await expect(page.locator(".working")).toBeVisible();
  await tap(page, ["cancel"]);
  await expect(page.locator(".working")).toHaveCount(0);
  await expect(page.locator('[data-status="cancelled"]')).toHaveCount(1);
  // the engine is back and the variable is still there
  await tap(page, ["app"]);
  await page.evaluate(() => window.pascaline.entry.set("a+1"));
  await tap(page, ["enter"]);
  await expect(page.locator('[data-status="done"]').last()).toBeVisible({ timeout: 20_000 });
  expect(await lastText(page)).toBe("8");
  // the Home history entry from before is still on the page
  await expect(page.locator('[data-status="done"]')).toHaveCount(2);
});

test("SCI and ENG formats work in Home", async ({ page }) => {
  await page.evaluate(() => window.pascaline.session.setFormat("sci"));
  await tap(page, ["d1", "d2", "d3", "d4", "d5", "enter"]);
  await expect(lastResult(page).locator(".result")).toBeVisible();
  expect(await lastText(page)).toMatch(/^1\.2345\d*E\+?4$|^1\.2345\d*×10\^4$/);
  await page.evaluate(() => window.pascaline.session.setFormat("eng"));
  // engineering notation: exponent a multiple of 3 (12345 = 12.345E3), the same history entry re-formatted
  await expect(lastResult(page).locator(".result")).toHaveAttribute("data-text", /^12\.345\d*E3$/);
});

test("Store key: a := 7, then a+1 gives 8, all through keys", async ({ page }) => {
  await tap(page, ["alpha", "sin", "shift", "comma", "d7"]);
  expect(await entryValue(page)).toBe("a:=7");
  await tap(page, ["enter"]);
  await expect(lastResult(page).locator(".result")).toBeVisible();
  expect(await lastText(page)).toBe("7");
  await tap(page, ["alpha", "sin", "add", "d1", "enter"]);
  await expect(page.locator('[data-status="done"]')).toHaveCount(2);
  expect(await lastText(page)).toBe("8");
});

test("the system keyboard never appears", async ({ page }) => {
  await tap(page, ["d5", "d6"]);
  const st = await page.evaluate(() => ({
    active: document.activeElement?.tagName.toLowerCase(),
    vk: window.mathVirtualKeyboard?.visible,
    inputmode: [...(window.pascaline.entry.mf.shadowRoot?.querySelectorAll("[inputmode]") ?? [])].map((e) => e.getAttribute("inputmode")),
  }));
  expect(st).toEqual({ active: "math-field", vk: false, inputmode: ["none"] });
});
