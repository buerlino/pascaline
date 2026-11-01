// SPDX-License-Identifier: GPL-3.0-or-later
// R108: with the decimal comma on, Solve's roots and the Function and Solve Num tables show and copy their numbers with
// the comma (R57 had done Home, CAS, Copy and Paste). Expected values are the oracle's (mpmath 30 digits, 12 shown):
// sqrt(2) = 1.41421356237, lambertw(5) = 1.32672466524, sin(1) = 0.841470984808; sin(0.1) = 0.0998334166468.
import { expect, test, type Page } from "@playwright/test";
import { open, tap, useClipboardLock } from "./helpers.ts";

test.use({ permissions: ["clipboard-read", "clipboard-write"] });
test.describe.configure({ mode: "serial" });
useClipboardLock();

test.beforeEach(async ({ page }) => {
  await open(page, "");
  await page.waitForFunction(() => window.pascaline.session.engineState === "ready", undefined, { timeout: 20_000 });
  await page.evaluate(() => window.pascaline.session.setDecimalMark("comma"));
});

const clipboard = (page: Page): Promise<string> => page.evaluate(() => navigator.clipboard.readText());
const row = (page: Page, name: string) => page.locator(`[data-testid="solve-table"] tr[data-name="${name}"]`);

test("Solve: the roots of x²-2 read 1,41421356237 (Polynomial roots)", async ({ page }) => {
  await tap(page, ["@place", "d4", "@symb"]);
  await expect(page.getByTestId("entry-label")).toHaveText("E1:");
  await tap(page, ["x", "pow", "d2", "right", "sub", "d2", "shift", "dot", "d0", "enter", "@num"]);
  await expect(row(page, "x")).toBeVisible();
  await tap(page, ["@menu", "d2"]);
  await expect(page.locator('[data-testid="solve-roots"] li')).toHaveText(["x = -1,41421356237", "x = 1,41421356237"]);
});

test("Solve: Num shows x·eˣ=5 as 1,32672466524, Copy gives the comma, point mode still the point", async ({ page }) => {
  await tap(page, ["@place", "d4", "@symb"]);
  await tap(page, ["x", "shift", "ln", "x", "right", "shift", "dot", "d5", "enter", "@num"]);
  await row(page, "x").locator("th button").tap();
  await tap(page, ["esc", "d1", "enter", "@menu", "d1"]); // guess 1, Menu → Solve
  await expect(row(page, "x").locator("td")).toHaveText("1,32672466524");
  await expect(row(page, "x").locator("td")).toHaveAttribute("data-value", /^1\.3267246652/); // the stored value keeps the point
  await tap(page, ["copy"]);
  await expect.poll(() => clipboard(page)).toMatch(/^1,3267246652\d{10,}$/);
  await page.evaluate(() => window.pascaline.session.setDecimalMark("point"));
  await expect(row(page, "x").locator("td")).toHaveText("1.32672466524");
});

test("Function: a Num row shows sin(0,1) and sin(1) with the comma; the CSV is ; separated", async ({ page }) => {
  await tap(page, ["@symb", "sin", "x", "enter", "@num"]);
  const cell = (x: string) => page.locator(`[data-testid="num-table"] tr:has(td[data-x="${x}"]) td`);
  await expect(cell("0.1").first()).toHaveText("0,1");
  await expect(cell("0.1").nth(1)).toHaveAttribute("data-text", "0,0998334166468"); // oracle sin(0.1)
  await tap(page, ["@menu", "d2", "d1", "enter"]); // step 1
  await expect(cell("1").nth(1)).toHaveAttribute("data-text", "0,841470984808"); // oracle sin(1)
  await tap(page, ["copy"]);
  await expect.poll(() => clipboard(page)).toMatch(/^x;F1\r\n0;0\r\n1;0,84147098480\d*\r\n/);
  await page.evaluate(() => window.pascaline.session.setDecimalMark("point"));
  await expect(cell("1").nth(1)).toHaveAttribute("data-text", "0.841470984808");
});
