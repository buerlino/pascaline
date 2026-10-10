// SPDX-License-Identifier: GPL-3.0-or-later
import { expect, test, type Page } from "@playwright/test";

async function tap(page: Page, ids: string[]): Promise<void> {
  for (const id of ids) await page.locator(`[data-key="${id}"]`).tap();
}
const value = (page: Page) => page.evaluate(() => window.pascalineInput.mf.value);

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => customElements.get("math-field") !== undefined);
  await page.waitForTimeout(300);
});

test("digits and operators build the expression", async ({ page }) => {
  await tap(page, ["d1", "d2", "add", "d3", "mul", "d4"]);
  expect(await value(page)).toBe("12+3\\times4");
});

test("focus and the caret stay in the math field; no MathLive keyboard", async ({ page }) => {
  await tap(page, ["d5", "d6"]);
  const st = await page.evaluate(() => ({
    active: document.activeElement?.tagName.toLowerCase(),
    vk: window.mathVirtualKeyboard?.visible,
    inputmode: [...(window.pascalineInput.mf.shadowRoot?.querySelectorAll("[inputmode]") ?? [])].map((e) => e.getAttribute("inputmode")),
  }));
  expect(st).toEqual({ active: "math-field", vk: false, inputmode: ["none"] });
});

test("fraction, power, sqrt templates", async ({ page }) => {
  await tap(page, ["d1", "frac", "d2"]);
  expect(await value(page)).toBe("\\frac12");
  await page.evaluate(() => (window.pascalineInput.mf.value = ""));
  await tap(page, ["x", "pow", "d3"]);
  expect(await value(page)).toBe("x^3");
  await page.evaluate(() => (window.pascalineInput.mf.value = ""));
  await tap(page, ["sqrt", "d9"]);
  expect(await value(page)).toBe("\\sqrt9");
});

test("function keys and parentheses", async ({ page }) => {
  await tap(page, ["sin", "x"]);
  expect(await value(page)).toBe("\\sin\\left(x\\right)");
});

test("shift layer is one-shot", async ({ page }) => {
  await tap(page, ["shift", "x", "x"]);
  expect(await value(page)).toBe("yx");
  await tap(page, ["bksp", "bksp"]);
  expect(await value(page)).toBe("");
});

test("cursor keys move the caret", async ({ page }) => {
  await tap(page, ["d1", "d2", "left", "d9"]);
  expect(await value(page)).toBe("192");
});

test("AC clears", async ({ page }) => {
  await tap(page, ["d1", "d2", "shift", "bksp"]);
  expect(await value(page)).toBe("");
});
