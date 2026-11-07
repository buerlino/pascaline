// SPDX-License-Identifier: GPL-3.0-or-later
// R147 (owner, 2026-11-06, point 8; the G2's way): a tap on a history row's result or input picks the row, a second tap
// on the picked row inserts the result (a chip) or recalls the input. A scroll drag does neither. While a row is picked
// on an empty line its buttons lie over the entry line's slot (R3, r19 section 3), so no history pixel moves. Expected
// values are derived: 7 and 8 are exact integers, so their chips are \res{n}{7} and \res{n}{8}.
import { expect, test, type Locator, type Page } from "@playwright/test";
import { entryValue, open, tap } from "./helpers.ts";

test.beforeEach(async ({ page }) => {
  await open(page, "");
  await page.waitForFunction(() => window.n62.session.engineState === "ready", undefined, { timeout: 20_000 });
});

const bar = (page: Page): Locator => page.getByTestId("row-actions");
const rows = (page: Page): Locator => page.locator("article.item");
const results = (page: Page): Locator => page.locator('[data-testid="result"] .result');
const inputs = (page: Page): Locator => page.locator("article.item .in");
const selected = (page: Page): Locator => page.locator('article.item[data-selected="true"]');

/** 7 and 8, each finished (8 is the last row). */
async function two(page: Page): Promise<void> {
  await tap(page, ["d7", "enter", "d8", "enter"]);
  await expect(page.locator('[data-status="done"]')).toHaveCount(2);
}

/** One finger, by CDP touch events: down on the element's centre, then `dy` px in steps, then up after `holdMs`. */
async function finger(page: Page, el: Locator, dy: number, holdMs = 0): Promise<void> {
  const box = await el.boundingBox();
  if (!box) throw new Error("not visible");
  const x = Math.round(box.x + box.width / 2);
  const y = Math.round(box.y + box.height / 2);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y, id: 1 }] });
  for (let i = 1; i <= 8 && dy !== 0; i++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: Math.round(y + (dy * i) / 8), id: 1 }] });
    await page.waitForTimeout(16);
  }
  if (holdMs > 0) await page.waitForTimeout(holdMs);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
}

const tops = (page: Page): Promise<number[]> => rows(page).evaluateAll((els) => els.map((e) => e.getBoundingClientRect().top));
const keyTop = (page: Page): Promise<number> => page.locator('[data-key="d5"]').evaluate((e) => e.getBoundingClientRect().top);
const boxOf = async (l: Locator): Promise<{ y: number; height: number }> => {
  const b = await l.boundingBox();
  if (!b) throw new Error("not visible");
  return b;
};

test("a tap on a result picks its row; a second tap inserts it and ends the pick", async ({ page }) => {
  await two(page);
  await results(page).last().tap();
  await expect(selected(page)).toHaveCount(1);
  await expect(rows(page).last()).toHaveAttribute("data-selected", "true");
  await expect(bar(page).getByRole("button")).toHaveText(["Insert", "Recall", "Copy", "Store ▶", "Delete"]);
  expect(await entryValue(page)).toBe(""); // the line is as it was
  await results(page).last().tap();
  expect(await entryValue(page)).toMatch(/^\\res\{\d+\}\{8\}$/);
  await expect(selected(page)).toHaveCount(0);
  await expect(bar(page)).toHaveCount(0);
});

test("a tap on an input picks its row; a second tap recalls it", async ({ page }) => {
  await two(page);
  await inputs(page).first().tap();
  await expect(rows(page).first()).toHaveAttribute("data-selected", "true");
  await expect(bar(page)).toBeVisible();
  expect(await entryValue(page)).toBe("");
  await inputs(page).first().tap();
  expect(await entryValue(page)).toBe("7");
  await expect(selected(page)).toHaveCount(0);
  await expect(bar(page)).toHaveCount(0);
});

test("a tap on another row moves the pick; its first tap inserts nothing", async ({ page }) => {
  await two(page);
  await results(page).first().tap();
  await expect(rows(page).first()).toHaveAttribute("data-selected", "true");
  await results(page).last().tap();
  await expect(rows(page).last()).toHaveAttribute("data-selected", "true");
  await expect(selected(page)).toHaveCount(1);
  expect(await entryValue(page)).toBe("");
  await inputs(page).first().tap(); // another row's input: a pick too, not a recall
  await expect(rows(page).first()).toHaveAttribute("data-selected", "true");
  expect(await entryValue(page)).toBe("");
});

test("Esc, a tap on the history's empty part, or a key that types drops the pick", async ({ page }) => {
  await two(page);
  await results(page).last().tap();
  await expect(bar(page)).toBeVisible();
  await tap(page, ["esc"]);
  await expect(selected(page)).toHaveCount(0);
  await expect(bar(page)).toHaveCount(0);
  expect(await entryValue(page)).toBe("");

  await results(page).last().tap();
  await expect(bar(page)).toBeVisible();
  await page.locator("section.history").tap({ position: { x: 20, y: 12 } }); // above the rows (they sit at the bottom)
  await expect(selected(page)).toHaveCount(0);
  await expect(bar(page)).toHaveCount(0);

  await results(page).last().tap();
  await expect(bar(page)).toBeVisible();
  await tap(page, ["d5"]);
  await expect(selected(page)).toHaveCount(0);
  await expect(bar(page)).toHaveCount(0);
  expect(await entryValue(page)).toBe("5");
});

test("Enter on a tapped pick inserts, as after ▲", async ({ page }) => {
  await two(page);
  await results(page).first().tap();
  await tap(page, ["enter"]);
  expect(await entryValue(page)).toMatch(/^\\res\{\d+\}\{7\}$/);
  await expect(bar(page)).toHaveCount(0);
});

test("a scroll drag neither picks nor inserts; a long press still opens the row menu", async ({ page }) => {
  for (let i = 1; i <= 6; i++) await tap(page, [`d${i}`, "enter"]);
  await expect(page.locator('[data-status="done"]')).toHaveCount(6);
  await finger(page, results(page).last(), 0, 700);
  await expect(page.getByTestId("menu").getByRole("menuitem")).toHaveCount(9);
  expect(await entryValue(page)).toBe("");
  await expect(selected(page)).toHaveCount(0);
  await tap(page, ["esc"]);
  await expect(page.getByTestId("menu")).toHaveCount(0);
  await finger(page, results(page).last(), -40);
  await finger(page, inputs(page).last(), 40);
  await page.waitForTimeout(300);
  await expect(selected(page)).toHaveCount(0);
  await expect(bar(page)).toHaveCount(0);
  expect(await entryValue(page)).toBe("");
});

test("on an empty line the picked row's buttons lie over the line: no history pixel and no key moves", async ({ page }) => {
  await two(page);
  const before = await tops(page);
  const keys = await keyTop(page);
  const line = await boxOf(page.locator(".entry"));
  await results(page).last().tap();
  await expect(bar(page)).toBeVisible();
  expect(await tops(page)).toEqual(before);
  expect(await keyTop(page)).toBe(keys);
  const b = await boxOf(bar(page));
  expect(Math.abs(b.y + b.height - (line.y + line.height))).toBeLessThan(1); // the same bottom edge as the line's box
  // the keys pick the same way (▲) and lay the buttons in the same place
  await tap(page, ["esc", "up"]);
  await expect(bar(page)).toBeVisible();
  expect(await tops(page)).toEqual(before);
  expect(Math.abs((await boxOf(bar(page))).y - b.y)).toBeLessThan(1);
});

test("with text on the line a tapped pick shows its buttons above the line, not over it", async ({ page }) => {
  await two(page);
  await tap(page, ["d5"]);
  await results(page).first().tap();
  await expect(bar(page)).toBeVisible();
  expect(await entryValue(page)).toBe("5");
  const b = await boxOf(bar(page));
  const line = await boxOf(page.locator(".entry"));
  expect(b.y + b.height).toBeLessThanOrEqual(line.y + 0.5);
  await results(page).first().tap(); // the second tap inserts at the cursor
  expect(await entryValue(page)).toMatch(/^5\\res\{\d+\}\{7\}$/);
});
