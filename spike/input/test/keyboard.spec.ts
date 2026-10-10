// SPDX-License-Identifier: GPL-3.0-or-later
import { expect, test, type Page } from "@playwright/test";

async function tap(page: Page, ids: string[]): Promise<void> {
  for (const id of ids) await page.locator(`[data-key="${id}"]`).tap();
}
const value = (page: Page) => page.evaluate(() => window.pascalineInput.mf.value);

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => customElements.get("math-field") !== undefined);
  await page.waitForFunction(() => window.pascalineInput?.timing.serializerReadyMs !== undefined);
  await page.waitForTimeout(200);
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

// End to end: key taps -> MathLive LaTeX -> serializer -> Giac string (exact text; equality is tested in spike/serializer).
const SEQUENCES: [string, string[], string][] = [
  ["fraction", ["d1", "frac", "d2"], "1/2"],
  ["fraction then continue", ["d1", "frac", "d2", "right", "add", "d3"], "1/2+3"],
  ["power leaves exponent with right", ["x", "pow", "d2", "right", "add", "d1"], "x^2+1"],
  ["power without right stays in exponent", ["x", "pow", "d2", "add", "d1"], "x^(2+1)"],
  ["square via shift", ["x", "shift", "pow", "add", "d1"], "x^2+1"],
  ["sqrt", ["sqrt", "d2", "d5", "right", "mul", "d2"], "sqrt(25)*2"],
  ["sin of expression", ["sin", "d2", "x", "right", "add", "d1"], "sin(2*x)+1"],
  ["asin via shift", ["shift", "sin", "d1", "frac", "d2"], "asin(1/2)"],
  ["implicit product", ["d2", "x", "add", "d3", "x"], "2*x+3*x"],
  ["division sign", ["d8", "div", "d2", "div", "d2"], "8/2/2"],
  ["parentheses", ["lpar", "d1", "add", "d2", "rpar", "mul", "d3"], "(1+2)*3"],
  ["e^x and ln", ["shift", "ln", "x", "right", "add", "ln", "x"], "exp(x)+ln(x)"],
  ["pi and i", ["d2", "pi", "add", "i"], "2*pi+i"],
  ["minus", ["lpar", "d1", "sub", "d4", "rpar"], "(1-4)"],
];
for (const [name, keys, want] of SEQUENCES) {
  test(`keys to Giac: ${name}`, async ({ page }) => {
    await tap(page, keys);
    expect(await page.evaluate(() => window.pascalineInput.giac())).toBe(want);
  });
}
