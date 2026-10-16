// SPDX-License-Identifier: GPL-3.0-or-later
// R32 (F28, UI half): a CAS result that used a value stored in another view says so under the result, in one muted
// line. The values are derived: x:=3 makes x^2-1 equal to 8 (docs/backlog F28).
import { expect, test, type Page } from "@playwright/test";
import { open, tap } from "./helpers.ts";

test.describe.configure({ mode: "serial" });

const done = (page: Page, n: number) => expect(page.locator('[data-status="done"]')).toHaveCount(n);
const uses = (page: Page) => page.getByTestId("uses");
const submit = (page: Page, latex: string): Promise<void> =>
  page.evaluate((l) => window.pascaline.session.submit(l), latex);

test.beforeEach(async ({ page }) => {
  await open(page, "");
  await page.waitForFunction(() => window.pascaline.session.engineState === "ready", undefined, { timeout: 20_000 });
});

/** Home 3 ▶ x, then the CAS view. */
async function storedInHome(page: Page): Promise<void> {
  await tap(page, ["d3", "shift", "emark", "x", "enter"]); // 3▶x
  await done(page, 1);
  await tap(page, ["app"]);
}

test("a stored value a CAS result used is named under it", async ({ page }) => {
  await storedInHome(page);
  await submit(page, "\\operatorname{factor}\\left(x^2-1\\right)");
  await done(page, 1);
  await expect(page.locator('[data-testid="result"] .result').last()).toHaveAttribute("data-text", "8");
  await expect(uses(page)).toHaveCount(1);
  await expect(uses(page)).toHaveText("x = 3 · stored in Home");
});

test("a CAS result without a stored name has no line", async ({ page }) => {
  await tap(page, ["app"]);
  await submit(page, "\\operatorname{factor}\\left(x^2-1\\right)");
  await done(page, 1);
  await expect(uses(page)).toHaveCount(0);
});

test("the line comes back after a reload", async ({ page }) => {
  await storedInHome(page);
  await submit(page, "\\operatorname{factor}\\left(x^2-1\\right)");
  await done(page, 1);
  await expect(uses(page)).toHaveText("x = 3 · stored in Home");
  await page.waitForTimeout(800); // the store write is debounced (400 ms) and asynchronous
  await page.reload();
  await page.waitForFunction(() => window.pascaline !== undefined);
  await done(page, 1);
  await expect(uses(page)).toHaveText("x = 3 · stored in Home");
});

test("after three names the rest is counted: +1", async ({ page }) => {
  for (const [v, n] of [[1, "x"], [2, "y"], [3, "z"], [4, "A"], [5, "A"]]) await submit(page, `${v}\\blacktriangleright ${n}`);
  await done(page, 5);
  await tap(page, ["app"]);
  await submit(page, "x+y+z+A");
  await done(page, 1);
  await expect(uses(page)).toHaveText("x = 1, y = 2, z = 3 +1 · stored in Home");
});
