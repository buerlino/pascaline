// SPDX-License-Identifier: GPL-3.0-or-later
// Copy, paste, share and export (docs/04 section 2.6, backlog step 9, P5): one test per action and a copy → paste round
// trip, by key sequences on the real engine. Expected values are derived: the decimal expansion of 1/3 and 2/3.
import { expect, test, type Page } from "@playwright/test";
import { entryValue, open, tap, useClipboardLock } from "./helpers.ts";

test.use({ permissions: ["clipboard-read", "clipboard-write"] });
// The system clipboard is one for the whole browser: these tests run one after another.
test.describe.configure({ mode: "serial" });

useClipboardLock(); // R74f1: first hook, so the lock is held before the page opens

test.beforeEach(async ({ page }) => {
  await open(page, "");
  await page.waitForFunction(() => window.pascaline.session.engineState === "ready", undefined, { timeout: 20_000 });
});

const clipboard = (page: Page): Promise<string> => page.evaluate(() => navigator.clipboard.readText());
const setClipboard = (page: Page, text: string): Promise<void> => page.evaluate((s) => navigator.clipboard.writeText(s), text);
const done = (page: Page, n: number) => expect(page.locator('[data-status="done"]')).toHaveCount(n);
const lastResult = (page: Page) => page.locator('[data-testid="result"]').last().locator(".result");

const THIRD = "0." + "3".repeat(40);
const TWO_THIRDS = "0." + "6".repeat(39) + "7";

/** 1 ÷ 3 Enter, then 2 ÷ 3 Enter. */
async function thirds(page: Page): Promise<void> {
  await tap(page, ["d1", "div", "d3", "enter"]);
  await done(page, 1);
  await tap(page, ["d2", "div", "d3", "enter"]);
  await done(page, 2);
}

const pickMenu = async (page: Page, label: string): Promise<void> => {
  await tap(page, ["@menu"]);
  await expect(page.getByTestId("menu")).toBeVisible();
  await page.getByRole("menuitem", { name: new RegExp(`^\\d ${label}$`) }).click();
};

/** Menu → 6 Copy as › → the item. */
const pickCopyAs = async (page: Page, label: string): Promise<void> => {
  await tap(page, ["@menu", "d6"]);
  await expect(page.getByTestId("menu")).toBeVisible();
  await page.getByRole("menuitem", { name: new RegExp(`^\\d ${label}$`) }).click();
};

test("Copy: copies the full value of the last result, not the 12 shown digits", async ({ page }) => {
  await thirds(page);
  await expect(lastResult(page)).toHaveAttribute("data-text", "0.666666666667");
  await tap(page, ["copy"]);
  await expect(page.getByTestId("notice")).toHaveText("Copied");
  await expect.poll(() => clipboard(page)).toBe(TWO_THIRDS);
});

test("Copy: copies the picked row (Up on an empty line)", async ({ page }) => {
  await thirds(page);
  await tap(page, ["up", "up", "copy"]);
  await expect.poll(() => clipboard(page)).toBe(THIRD);
});

test("Menu with a picked row copies that row, not the last result (R13, S2 I1)", async ({ page }) => {
  await tap(page, ["d1", "div", "d3", "enter"]);
  await done(page, 1);
  await tap(page, ["d2", "div", "d3", "enter"]);
  await done(page, 2);
  await tap(page, ["d1", "div", "d4", "enter"]);
  await done(page, 3);
  await tap(page, ["up", "up"]);
  await pickMenu(page, "Copy");
  await expect(page.getByTestId("notice")).toHaveText("Copied");
  await expect.poll(() => clipboard(page)).toBe(TWO_THIRDS);
});

test("Shift + Copy (Paste) pastes a number as the keyboard's own LaTeX", async ({ page }) => {
  await setClipboard(page, "1.5E-3");
  await tap(page, ["shift", "copy"]);
  await expect.poll(() => entryValue(page)).toBe("1.5\\emark-3"); // drawn 1.5ᴇ-3, as the exponent key types it (R14)
  await tap(page, ["esc"]);
  await setClipboard(page, "1.5-2*i");
  await tap(page, ["shift", "copy"]);
  await expect.poll(() => entryValue(page)).toBe("1.5-2\\imaginaryI");
});

test("Paste refuses what is not a number, and says so", async ({ page }) => {
  await setClipboard(page, "hello");
  await tap(page, ["shift", "copy"]);
  await expect(page.getByTestId("notice")).toHaveText("Paste: not a number");
  expect(await entryValue(page)).toBe("");
});

test("copy → paste gives the value back (P5)", async ({ page }) => {
  await thirds(page);
  await tap(page, ["copy"]); // 2/3, 40 digits
  await tap(page, ["shift", "copy"]);
  await expect.poll(() => entryValue(page)).toBe(TWO_THIRDS);
  await tap(page, ["enter"]);
  await done(page, 3);
  await expect(lastResult(page)).toHaveAttribute("data-text", "0.666666666667");
  // and a number with an exponent, through the E key of the clipboard text
  await setClipboard(page, "2.5E-4");
  await tap(page, ["shift", "copy", "mul", "d4", "enter"]);
  await done(page, 4);
  await expect(lastResult(page)).toHaveAttribute("data-text", "0.001"); // 2.5E-4 × 4
});

test("Menu: Copy as › As shown, Exact, LaTeX", async ({ page }) => {
  await tap(page, ["d1", "div", "d3", "enter"]);
  await done(page, 1);
  await pickCopyAs(page, "As shown");
  await expect.poll(() => clipboard(page)).toBe("0.333333333333");
  await pickCopyAs(page, "Exact");
  await expect.poll(() => clipboard(page)).toBe("1/3");
  await pickCopyAs(page, "LaTeX");
  await expect.poll(() => clipboard(page)).toContain("0.333333333333");
  await pickMenu(page, "Copy");
  await expect.poll(() => clipboard(page)).toBe(THIRD);
});

test("Menu: Copy exact is on for an exact result and off for one that is only digits", async ({ page }) => {
  await tap(page, ["d2", "sq", "enter"]);
  await done(page, 1);
  await tap(page, ["@menu", "d6"]);
  await expect(page.getByRole("menuitem", { name: /Exact$/ })).toBeEnabled(); // 2² = 4
  await tap(page, ["esc", "esc", "shift", "enter", "d1", "div", "d3", "enter"]); // back out of Copy as and the Menu; approx(1/3)
  await done(page, 2);
  await tap(page, ["@menu", "d6"]);
  await expect(page.getByRole("menuitem", { name: /Exact$/ })).toBeDisabled(); // approx(1/3) is digits only
});

test("Menu: Share session shares, or copies one line per entry when the device cannot share", async ({ page }) => {
  await thirds(page);
  await pickMenu(page, "Share session");
  await expect(page.getByTestId("notice")).toHaveText("This device cannot share: copied instead");
  expect((await clipboard(page)).split("\n")).toEqual([`1/3 ≈ ${THIRD}`, `2/3 ≈ ${TWO_THIRDS}`]);
});

test("Menu: Share session opens the share sheet where the platform has one", async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { __shared: unknown[] }).__shared = [];
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: (d: unknown) => ((window as unknown as { __shared: unknown[] }).__shared.push(d), Promise.resolve()),
    });
  });
  await open(page, "");
  await page.waitForFunction(() => window.pascaline.session.engineState === "ready", undefined, { timeout: 20_000 });
  await tap(page, ["d1", "d2", "enter"]);
  await done(page, 1);
  await pickMenu(page, "Share session");
  await expect(page.getByTestId("notice")).toHaveText("Shared");
  expect(await page.evaluate(() => (window as unknown as { __shared: { text: string }[] }).__shared[0]?.text)).toBe("12 = 12");
});

test("Menu: Clear history empties the view", async ({ page }) => {
  await thirds(page);
  await pickMenu(page, "Clear history");
  await expect(page.locator('[data-status="done"]')).toHaveCount(0);
});

test("a long press on a history row opens the Menu list on that row, and the lift does not insert the result", async ({ page }) => {
  await thirds(page);
  const first = page.locator('[data-testid="result"] .result').first();
  const box = await first.boundingBox();
  if (!box) throw new Error("no result row");
  await page.mouse.move(box.x + 4, box.y + 4);
  await page.mouse.down();
  await page.waitForTimeout(700);
  await expect(page.getByTestId("menu")).toBeVisible();
  await page.mouse.up();
  await expect(page.getByRole("menuitem")).toHaveCount(9);
  await page.getByRole("menuitem", { name: /^\d Copy$/ }).click();
  await expect.poll(() => clipboard(page)).toBe(THIRD); // the first row, not the last
  expect(await entryValue(page)).toBe("");
});

test("a short tap on a history row still puts the result on the line", async ({ page }) => {
  await tap(page, ["d1", "div", "d3", "enter"]);
  await done(page, 1);
  await lastResult(page).click();
  await expect(page.getByTestId("menu")).toHaveCount(0);
  expect(await entryValue(page)).toContain("\\res");
});

test("Num: the table as CSV with full values, from Copy and from the Menu", async ({ page }) => {
  await tap(page, ["@symb", "d1", "div", "x", "enter", "@num"]);
  const td = page.locator('[data-testid="num-table"] tr:has(td[data-x="0.1"]) td').nth(1);
  await expect(td).toHaveAttribute("data-text", "10");
  await tap(page, ["copy"]);
  await expect(page.getByTestId("notice")).toHaveText("Copied");
  const csv = (await clipboard(page)).split("\r\n");
  expect(csv.slice(0, 4)).toEqual(["x,F1", "0,NaN", "0.1,10", "0.2,5"]);
  await setClipboard(page, "");
  await pickMenu(page, "Copy table as CSV");
  await expect(page.getByTestId("notice")).toHaveText("Copied the table as CSV");
  expect((await clipboard(page)).startsWith("x,F1\r\n")).toBe(true);
});
