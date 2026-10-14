// SPDX-License-Identifier: GPL-3.0-or-later
// Copy of the Solve roots and the Function Plot readout values (docs/04 section 2.6, backlog step 9; P5): the default
// copy is the full value (every confirmed digit), the Menu has "as shown", and what was copied pastes back as the same
// value. From keys (Shift + View) and from touch (a long press). Expected values: oracle = mpmath 1.3.0 at 40 digits.
import { expect, test, type Locator, type Page } from "@playwright/test";
import { entryValue, open, tap } from "./helpers.ts";

test.use({ permissions: ["clipboard-read", "clipboard-write"] });
// The system clipboard is one for the whole browser: these tests run one after another.
test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ page }) => {
  await open(page, "");
  await page.waitForFunction(() => window.pascaline.session.engineState === "ready", undefined, { timeout: 20_000 });
});

const clipboard = (page: Page): Promise<string> => page.evaluate(() => navigator.clipboard.readText());
const setClipboard = (page: Page, text: string): Promise<void> => page.evaluate((s) => navigator.clipboard.writeText(s), text);

// oracle: lambertw(5) and sqrt(2); the copy holds at least 25 of these digits (a root is polished again at work precision + 20)
const LAMBERT5 = "1.326724665242200223635099297758079660129";
const SQRT2 = "1.41421356237309504880168872420969807857";
const digits = (s: string): number => s.replace(/\D/g, "").length;

/** A finger held on the element for 700 ms (CDP touch events), then lifted. */
async function longPress(page: Page, el: Locator): Promise<void> {
  const box = await el.boundingBox();
  if (!box) throw new Error("element is not visible");
  const cdp = await page.context().newCDPSession(page);
  const at = [{ x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height / 2), id: 1 }];
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: at });
  await page.waitForTimeout(700);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
}

/** Solve: x·e^x = 5 from guess 1, solved; the Num view is open. */
async function solved(page: Page): Promise<void> {
  await tap(page, ["apps", "d2", "symb"]);
  await expect(page.getByTestId("entry-label")).toHaveText("E1:");
  await tap(page, ["x", "shift", "ln", "x", "right", "shift", "dot", "d5", "enter", "num"]);
  const row = page.locator('[data-testid="solve-table"] tr[data-name="x"]');
  await expect(row).toBeVisible();
  await row.locator("th button").tap();
  await tap(page, ["esc", "d1", "enter", "menu", "d1"]); // guess 1, Menu → Solve
  await expect(row.locator("td")).toHaveText("1.32672466524");
}

test("Solve: Shift + View copies the full root, and it pastes back as the same value (P5)", async ({ page }) => {
  await solved(page);
  await tap(page, ["shift", "view"]);
  await expect(page.getByTestId("notice")).toHaveText("Copied");
  const text = await clipboard(page);
  expect(text.startsWith(LAMBERT5.slice(0, 26))).toBe(true);
  expect(digits(text)).toBeGreaterThan(25);
  await tap(page, ["esc", "shift", "menu", "enter"]);
  await expect(page.locator('[data-testid="solve-table"] tr[data-name="x"] td')).toHaveAttribute("data-value", text);
});

test("Solve: a long press on the value copies the full root; Menu → Copy as shown gives the shown digits", async ({ page }) => {
  await solved(page);
  await setClipboard(page, "");
  await longPress(page, page.locator('[data-testid="solve-table"] tr[data-name="x"] td'));
  await expect(page.getByTestId("notice")).toHaveText("Copied");
  expect((await clipboard(page)).startsWith(LAMBERT5.slice(0, 26))).toBe(true);
  expect(digits(await clipboard(page))).toBeGreaterThan(25);
  await tap(page, ["menu"]);
  await page.getByRole("menuitem", { name: /^\d Copy as shown$/ }).click();
  await expect.poll(() => clipboard(page)).toBe("1.32672466524");
});

test("Solve: the full root survives a reload; an edit drops it", async ({ page }) => {
  await solved(page);
  await page.waitForTimeout(800); // the store write is debounced
  await page.reload();
  await page.waitForFunction(() => window.pascaline.session.engineState === "ready", undefined, { timeout: 20_000 });
  await tap(page, ["apps", "d2", "num"]);
  await expect(page.locator('[data-testid="solve-table"] tr[data-name="x"] td')).toHaveText("1.32672466524");
  await tap(page, ["shift", "view"]);
  await expect.poll(async () => digits(await clipboard(page))).toBeGreaterThan(25);
  await tap(page, ["esc", "d2", "enter", "shift", "view"]);
  await expect.poll(() => clipboard(page)).toBe("2");
});

/** Function: F1 = x^2 - 2, the trace at x = 1, Plot, Menu → Root. */
async function root(page: Page): Promise<void> {
  await tap(page, ["symb"]);
  await expect(page.getByTestId("entry-label")).toHaveText("F1(x)=");
  await tap(page, ["x", "pow", "d2", "right", "sub", "d2", "enter", "plot"]);
  await page.waitForFunction(() => window.pascaline.plot.board !== undefined);
  await tap(page, Array<string>(10).fill("right")); // x = 1
  await expect(page.getByTestId("trace-x")).toHaveText("1");
  await tap(page, ["menu", "d1"]); // Root
  await expect(page.getByTestId("readout-x")).toHaveText("1.41421356237");
}

test("Function: Shift + View copies the full root x from the readout", async ({ page }) => {
  await root(page);
  await tap(page, ["shift", "view"]);
  await expect(page.getByTestId("notice")).toHaveText("Copied");
  const text = await clipboard(page);
  expect(text.startsWith(SQRT2.slice(0, 26))).toBe(true);
  expect(digits(text)).toBeGreaterThan(25);
  await tap(page, ["num", "esc", "shift", "menu"]); // paste on the Num start line
  await expect.poll(() => entryValue(page)).toBe(text);
});

test("Function: a long press on a readout value copies it in full; Menu → Copy as shown copies the shown digits", async ({ page }) => {
  await root(page);
  await setClipboard(page, "");
  await longPress(page, page.getByTestId("readout-x"));
  await expect(page.getByTestId("notice")).toHaveText("Copied");
  const text = await clipboard(page);
  expect(text.startsWith(SQRT2.slice(0, 26))).toBe(true);
  await tap(page, ["menu"]);
  await page.getByRole("menuitem", { name: /^\d Copy as shown$/ }).click();
  await expect.poll(() => clipboard(page)).toBe("1.41421356237");
});
