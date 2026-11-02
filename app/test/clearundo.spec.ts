// SPDX-License-Identifier: GPL-3.0-or-later
// R98 (night review 2026-10-30, bu-2 and fh-1): Clear history spares a running job, and every way to Clear or Delete
// can be undone. Undo on an empty line takes the Clear (or Delete) copy first, then the line's own undo (P13); on a
// line with text Undo is always the line's own. The fake engine echoes its input, so each row's result is its input.
import { expect, test, type Page } from "@playwright/test";
import { entryValue, flick, open, tap } from "./helpers.ts";

const texts = (page: Page): Promise<(string | null)[]> =>
  page.locator('[data-testid="result"] .result').evaluateAll((els) => els.map((e) => e.getAttribute("data-text")));
const rows = (page: Page) => page.locator("article.item");
const note = (page: Page) => page.getByTestId("undo-note");
const menuItem = (page: Page, name: RegExp) => page.getByTestId("menu").getByRole("menuitem", { name });

/** Rows 1, 2, 3, each finished before the next Enter (an Enter while a job runs is refused). */
async function three(page: Page): Promise<void> {
  for (const [k, d] of ["d1", "d2", "d3"].entries()) {
    await tap(page, [d, "enter"]);
    await expect(page.locator('[data-status="done"]')).toHaveCount(k + 1);
  }
}

const paths: { name: string; act: (page: Page) => Promise<void>; left: string[]; text: string }[] = [
  { name: "Shift + Esc", act: (page) => tap(page, ["shift", "esc"]), left: [], text: "History cleared · Undo" },
  { name: "a flick up on Esc", act: (page) => flick(page, "esc", "up"), left: [], text: "History cleared · Undo" },
  {
    name: "☰ Clear history",
    act: async (page) => {
      await tap(page, ["@menu"]);
      await menuItem(page, /Clear history/).click();
    },
    left: [],
    text: "History cleared · Undo",
  },
  {
    name: "☰ Delete of one row",
    act: async (page) => {
      await tap(page, ["up", "up"]); // the middle row
      await tap(page, ["@menu"]);
      await menuItem(page, /^5 ?Delete$/).click();
    },
    left: ["1", "3"],
    text: "Row deleted · Undo",
  },
];

for (const p of paths) {
  test(`${p.name}, then Undo on an empty line brings the rows back in their places`, async ({ page }) => {
    await open(page);
    await three(page);
    await p.act(page);
    await expect(rows(page)).toHaveCount(p.left.length);
    expect(await texts(page)).toEqual(p.left);
    await expect(note(page)).toHaveText(p.text);
    await tap(page, ["undo"]);
    await expect(rows(page)).toHaveCount(3);
    expect(await texts(page)).toEqual(["1", "2", "3"]);
    await expect(note(page)).toHaveCount(0);
    expect(await entryValue(page)).toBe("");
  });
}

test("a tap on the note brings the rows back", async ({ page }) => {
  await open(page);
  await three(page);
  await tap(page, ["shift", "esc"]);
  await note(page).tap();
  expect(await texts(page)).toEqual(["1", "2", "3"]);
  await expect(note(page)).toHaveCount(0);
});

test("a relaunch between Clear and Undo keeps the Undo", async ({ page }) => {
  await open(page);
  await three(page);
  await tap(page, ["shift", "esc"]);
  await expect(rows(page)).toHaveCount(0);
  await page.waitForTimeout(800); // the store write is debounced (400 ms) and asynchronous
  await open(page);
  await expect(note(page)).toHaveText("History cleared · Undo");
  await expect(rows(page)).toHaveCount(0);
  await tap(page, ["undo"]);
  await expect(rows(page)).toHaveCount(3);
  expect(await texts(page)).toEqual(["1", "2", "3"]);
});

test("Enter of a new input drops the Undo", async ({ page }) => {
  await open(page);
  await three(page);
  await tap(page, ["shift", "esc"]);
  await expect(note(page)).toBeVisible(); // the Undo is there until the Enter
  await tap(page, ["d5", "enter"]);
  await expect(page.locator('[data-status="done"]')).toHaveCount(1);
  await expect(note(page)).toHaveCount(0);
  await tap(page, ["undo"]); // now the line's own undo: the 5 comes back on the line, the rows stay gone
  await expect.poll(() => entryValue(page)).toBe("5");
  expect(await texts(page)).toEqual(["5"]);
});

test("the order with P13: Enter 1+1, Shift + Esc, Undo brings the rows back, Undo again brings 1+1 back on the line", async ({ page }) => {
  await open(page);
  await tap(page, ["d1", "add", "d1", "enter"]);
  await expect(page.locator('[data-status="done"]')).toHaveCount(1);
  expect(await entryValue(page)).toBe("");
  await tap(page, ["shift", "esc"]);
  await expect(rows(page)).toHaveCount(0);
  await tap(page, ["undo"]);
  await expect(rows(page)).toHaveCount(1);
  expect(await entryValue(page)).toBe("");
  await tap(page, ["undo"]);
  await expect.poll(() => entryValue(page)).toBe("1+1");
  await expect(rows(page)).toHaveCount(1);
});

test("Redo after the first Undo is the line's own Redo: it neither clears again nor changes the line", async ({ page }) => {
  await open(page);
  await tap(page, ["d1", "add", "d1", "enter"]);
  await expect(page.locator('[data-status="done"]')).toHaveCount(1);
  await tap(page, ["shift", "esc"]);
  await tap(page, ["undo"]);
  await expect(rows(page)).toHaveCount(1);
  await tap(page, ["shift", "undo"]); // Redo
  await expect(rows(page)).toHaveCount(1);
  expect(await entryValue(page)).toBe("");
  await tap(page, ["undo"]); // the line's own history is as it was: 1+1 comes back
  await expect.poll(() => entryValue(page)).toBe("1+1");
});

test("a line typed after the Clear makes Undo the line's own; the copy stays for the empty line", async ({ page }) => {
  await open(page);
  await three(page);
  await tap(page, ["shift", "esc"]);
  await tap(page, ["d7"]);
  expect(await entryValue(page)).toBe("7");
  await tap(page, ["undo"]);
  await expect.poll(() => entryValue(page)).toBe("");
  await expect(rows(page)).toHaveCount(0);
  await expect(note(page)).toBeVisible();
  await tap(page, ["undo"]);
  expect(await texts(page)).toEqual(["1", "2", "3"]);
});

test("Clear while a job runs: its row stays, Esc stops it, and the rows come back around it", async ({ page }) => {
  await open(page, "engine=fake&delay=3000");
  await tap(page, ["d1", "enter"]);
  await expect(page.locator('[data-status="done"]')).toHaveCount(1, { timeout: 10_000 });
  await tap(page, ["d2", "enter"]);
  await expect(page.locator('[data-status="pending"]')).toHaveCount(1);
  await tap(page, ["shift", "esc"]);
  await expect(rows(page)).toHaveCount(1);
  await expect(page.locator('[data-status="pending"]')).toHaveCount(1);
  await tap(page, ["d3", "enter"]); // refused while the job runs: the line keeps it
  expect(await entryValue(page)).toBe("3");
  await tap(page, ["esc"]); // stops the job, the line stays
  await expect(page.locator('[data-status="cancelled"]')).toHaveCount(1);
  expect(await entryValue(page)).toBe("3");
  await tap(page, ["esc", "undo"]); // the line cleared; Undo takes the copy first
  await expect(rows(page)).toHaveCount(2);
  await expect(page.locator("article.item").first()).toHaveAttribute("data-status", "done");
  await expect(page.locator("article.item").last()).toHaveAttribute("data-status", "cancelled");
});
