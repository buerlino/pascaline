// SPDX-License-Identifier: GPL-3.0-or-later
// R11: the actions of a history row (Home and CAS), from keys and from touch. One list of nine (S2 rules M1, M2): the
// row buttons are items 1-5, the Menu and the long press show all nine, and they act on the picked row, else the last
// result (Delete: the last row). Expected values are derived: 1/3 and 2/3 as 12 shown digits.
import { expect, test, type Page } from "@playwright/test";
import { entryValue, open, tap } from "./helpers.ts";

test.use({ permissions: ["clipboard-read", "clipboard-write"] });
test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ page }) => {
  await open(page, "");
  await page.waitForFunction(() => window.pascaline.session.engineState === "ready", undefined, { timeout: 20_000 });
});

const clipboard = (page: Page): Promise<string> => page.evaluate(() => navigator.clipboard.readText());
const done = (page: Page, n: number) => expect(page.locator('[data-status="done"]')).toHaveCount(n);
const bar = (page: Page) => page.getByTestId("row-actions");
const item = (page: Page, name: RegExp) => page.getByTestId("menu").getByRole("menuitem", { name });

/** 1÷3, 2÷3 and 1÷4, each finished. */
async function three(page: Page): Promise<void> {
  for (const keys of [["d1", "div", "d3"], ["d2", "div", "d3"], ["d1", "div", "d4"]]) {
    await tap(page, [...keys, "enter"]);
  }
  await done(page, 3);
}

test("Up on an empty line shows the row buttons; typing hides them", async ({ page }) => {
  await three(page);
  await expect(bar(page)).toHaveCount(0);
  await tap(page, ["up"]);
  await expect(bar(page).getByRole("button")).toHaveText(["Insert", "Recall", "Copy", "Store ▶", "Delete"]);
  await tap(page, ["d5"]);
  await expect(bar(page)).toHaveCount(0);
  expect(await entryValue(page)).toBe("5");
});

test("the row buttons act on the picked row (touch)", async ({ page }) => {
  await three(page);
  await tap(page, ["up", "up"]); // 2/3
  await bar(page).getByRole("button", { name: "Copy" }).tap();
  await expect.poll(() => clipboard(page)).toBe("0." + "6".repeat(39) + "7");
  await expect(bar(page)).toHaveCount(0); // an action ends the pick
  await tap(page, ["up", "up"]);
  await bar(page).getByRole("button", { name: "Insert" }).tap();
  expect(await entryValue(page)).toContain("\\res");
});

test("Recall puts the entry back on the line", async ({ page }) => {
  await three(page);
  await tap(page, ["up", "up"]);
  await bar(page).getByRole("button", { name: "Recall" }).tap();
  expect(await entryValue(page)).toBe("\\frac23");
});

test("Store ▶ puts the result and the store arrow on the line, ready for the name", async ({ page }) => {
  await three(page);
  await tap(page, ["up"]);
  await bar(page).getByRole("button", { name: "Store ▶" }).tap();
  const v = await entryValue(page);
  expect(v).toContain("\\res");
  expect(v.endsWith("\\blacktriangleright")).toBe(true);
  await tap(page, ["alpha", "vars", "enter"]); // 1/4 ▶ A
  await done(page, 4);
  await tap(page, ["alpha", "vars", "enter"]);
  await expect(page.locator('[data-testid="result"] .result').last()).toHaveAttribute("data-text", "0.25");
});

test("Delete removes the picked row and only that one", async ({ page }) => {
  await three(page);
  await tap(page, ["up", "up"]);
  await bar(page).getByRole("button", { name: "Delete" }).tap();
  await done(page, 2);
  const texts = await page.locator('[data-testid="result"] .result').evaluateAll((els) => els.map((e) => e.getAttribute("data-text")));
  expect(texts).toEqual(["0.333333333333", "0.25"]);
});

test("Menu is one list of nine, the same with or without a picked row", async ({ page }) => {
  await three(page);
  const names = ["Insert", "Recall", "Copy", "Store ▶", "Delete", "Copy as›", "Paste", "Share session", "Clear history"];
  await tap(page, ["menu"]);
  await expect(page.getByTestId("menu").getByRole("menuitem")).toHaveText(names.map((n, i) => `${i + 1}${n}`));
  await tap(page, ["cancel", "up", "menu"]);
  await expect(page.getByTestId("menu").getByRole("menuitem")).toHaveText(names.map((n, i) => `${i + 1}${n}`));
});

test("Menu 5 deletes the last row when none is picked, and 2 recalls its entry", async ({ page }) => {
  await three(page);
  await tap(page, ["menu", "d2"]);
  expect(await entryValue(page)).toBe("\\frac14");
  await tap(page, ["esc", "menu", "d5"]);
  await done(page, 2);
});

test("Menu 5 on a picked row deletes that row, not the last", async ({ page }) => {
  await three(page);
  await tap(page, ["up", "up", "menu", "d5"]);
  await done(page, 2);
  const texts = await page.locator('[data-testid="result"] .result').evaluateAll((els) => els.map((e) => e.getAttribute("data-text")));
  expect(texts).toEqual(["0.333333333333", "0.25"]);
});

test("Menu 6 opens Copy as: as shown, exact, LaTeX", async ({ page }) => {
  await tap(page, ["d1", "div", "d3", "enter"]);
  await done(page, 1);
  await tap(page, ["menu", "d6"]);
  await expect(page.getByTestId("menu").getByRole("menuitem")).toHaveText(["1As shown", "2Exact", "3LaTeX"]);
  await tap(page, ["d2"]);
  await expect.poll(() => clipboard(page)).toBe("1/3");
});

test("a long press opens the same nine on that row", async ({ page }) => {
  await three(page);
  const first = page.locator('[data-testid="result"] .result').first();
  const box = await first.boundingBox();
  if (!box) throw new Error("no result row");
  await page.mouse.move(box.x + 4, box.y + 4);
  await page.mouse.down();
  await page.waitForTimeout(700);
  await page.mouse.up();
  await expect(page.getByTestId("menu").getByRole("menuitem")).toHaveCount(9);
  await item(page, /^5 ?Delete$/).click();
  await done(page, 2);
  const texts = await page.locator('[data-testid="result"] .result').evaluateAll((els) => els.map((e) => e.getAttribute("data-text")));
  expect(texts).toEqual(["0.666666666667", "0.25"]);
});

test("with an empty history the actions are disabled; with only an error row they say why", async ({ page }) => {
  await tap(page, ["menu"]);
  await expect(item(page, /^1 ?Insert/)).toBeDisabled();
  await expect(item(page, /^5 ?Delete/)).toBeDisabled();
  await expect(item(page, /^9 ?Clear history/)).toBeDisabled();
  await tap(page, ["cancel", "d1", "emark", "d2", "dot", "d5", "enter"]); // 1ᴇ2.5: an error row: there are rows, but no result
  await expect(page.locator('[data-status="error"]')).toHaveCount(1);
  await tap(page, ["menu"]);
  await expect(item(page, /^1 ?Insert/)).toBeDisabled();
  await expect(page.getByTestId("menu")).toContainText("No result yet");
  await expect(item(page, /^2 ?Recall/)).toBeDisabled();
});

test("the row buttons cost no viewport: the keypad does not move", async ({ page }) => {
  await three(page);
  const top = () => page.locator('[data-key="d5"]').evaluate((e) => e.getBoundingClientRect().top);
  const before = await top();
  await tap(page, ["up"]);
  await expect(bar(page)).toBeVisible();
  expect(await top()).toBe(before);
});

test("CAS has the same buttons and its own rows", async ({ page }) => {
  await tap(page, ["d1", "d2", "enter"]);
  await done(page, 1);
  await tap(page, ["u3", "d3", "d4", "enter"]);
  await done(page, 1); // the CAS history is separate
  await tap(page, ["up"]);
  await expect(bar(page).getByRole("button")).toHaveText(["Insert", "Recall", "Copy", "Store ▶", "Delete"]);
  await bar(page).getByRole("button", { name: "Delete" }).tap();
  await expect(page.locator('[data-status="done"]')).toHaveCount(0);
  await tap(page, ["u2"]);
  await done(page, 1); // Home still has its row
  await tap(page, ["menu"]);
  await expect(page.getByTestId("menu").getByRole("menuitem")).toHaveCount(9);
});
