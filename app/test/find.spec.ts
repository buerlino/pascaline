// SPDX-License-Identifier: GPL-3.0-or-later
// R4a: Find on the Math key (docs/04 3.5–3.7, decisions.md S2 rule M1 and R21). Every key path by keys and by touch:
// open, type, pick by digit, pick by Enter, Esc, Android back, the preview. Find takes letters, so it stays above the
// keypad, over the history. The fake engine; the full generated index (`npm run index`).
import { expect, test, type Page } from "@playwright/test";
import { entryValue, flick, open, tap } from "./helpers.ts";

const find = (page: Page) => page.getByTestId("find");
const rows = (page: Page) => find(page).getByRole("menuitem");
const active = (page: Page) => find(page).locator('[role="menuitem"][data-active="true"]');

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page);
});

test.describe("by keys", () => {
  test("open: Math shows the Math menu, ten categories numbered 1…9, 0, above the keypad", async ({ page }) => {
    await tap(page, ["math"]);
    await expect(find(page)).toBeVisible();
    await expect(rows(page)).toHaveCount(10);
    await expect(rows(page).first()).toHaveAttribute("aria-label", "1 Arithmetic");
    await expect(rows(page).last()).toHaveAttribute("aria-label", "0 Units and prefixes");
    // a list that takes letters is not drawn over the keypad: the keys stay where they are and visible
    const sheetBottom = await find(page).locator('[role="menu"]').evaluate((e) => e.getBoundingClientRect().bottom);
    const keypadTop = await page.locator('[data-key="vars"]').evaluate((e) => e.getBoundingClientRect().top);
    expect(sheetBottom).toBeLessThanOrEqual(keypadTop + 1);
  });

  test("type: a key types its letter (Tmpl is c), the hits replace the menu unnumbered, the speed of light first", async ({ page }) => {
    await tap(page, ["math", "tmpl"]);
    await expect(find(page).getByTestId("sheet-filter")).toHaveText("c");
    await expect(active(page)).toHaveAttribute("data-id", "const:c");
    await expect(active(page).locator(".n")).toHaveText("");
    expect(await entryValue(page)).toBe("");
  });

  test("pick by Enter: Math, c, Enter puts the constant on the line as a chip and closes Find", async ({ page }) => {
    await tap(page, ["math", "tmpl", "enter"]);
    await expect(find(page)).toBeHidden();
    expect(await entryValue(page)).toBe("\\const{c}{c}");
  });

  test("pick by digit: on the empty query 9 opens Constants, 1 picks its first row; after a letter digits type", async ({ page }) => {
    await tap(page, ["math", "d9"]);
    await expect(find(page).getByTestId("sheet-title")).toHaveText("Find › Constants");
    const first = await rows(page).first().getAttribute("data-id");
    await tap(page, ["d1"]);
    await expect(find(page)).toBeHidden();
    expect(await entryValue(page)).toContain(`\\const{${(first ?? "").slice("const:".length)}}`);
    // log10: l o g are x², the comma and sin; 1 and 0 type themselves once a letter is there
    await tap(page, ["shift", "esc", "math", "sq", "comma", "sin", "d1", "d0"]);
    await expect(find(page).getByTestId("sheet-filter")).toHaveText("log10");
    await expect(active(page)).toHaveAttribute("data-id", "fn:log10");
  });

  test("a function goes in as its syntax with the cursor in its first argument", async ({ page }) => {
    await tap(page, ["math", "x", "frac", "div"]); // d e t
    await expect(active(page)).toHaveAttribute("data-id", "fn:det");
    await tap(page, ["enter", "d2"]);
    // MathLive keeps the name as \operatorname{\mathrm{det}}; the parser reads both
    expect(await entryValue(page)).toMatch(/^\\operatorname\{(\\mathrm\{)?det\}?\}\\left\(2\\right\)$/);
  });

  test("a flick down types a digit key's letter; Shift + a key types its own character", async ({ page }) => {
    await tap(page, ["math"]);
    await flick(page, "d9", "down"); // s
    await expect(find(page).getByTestId("sheet-filter")).toHaveText("s");
    await tap(page, ["shift", "d5"]);
    await expect(find(page).getByTestId("sheet-filter")).toHaveText("s5");
    await tap(page, ["bksp", "bksp"]);
    await expect(rows(page)).toHaveCount(10);
  });

  test("Esc goes back from a category, then closes; nothing reaches the line", async ({ page }) => {
    await tap(page, ["math", "d1"]);
    await expect(find(page).getByTestId("sheet-title")).toHaveText("Find › Arithmetic");
    await tap(page, ["esc"]);
    await expect(rows(page)).toHaveCount(10);
    await tap(page, ["tmpl", "esc"]);
    await expect(find(page)).toBeHidden();
    expect(await entryValue(page)).toBe("");
  });

  test("Android back closes Find, and the history does not grow", async ({ page }) => {
    const before = await page.evaluate(() => history.length);
    await tap(page, ["math", "tmpl"]);
    await expect(find(page)).toBeVisible();
    await page.evaluate(() => history.back());
    await expect(find(page)).toBeHidden();
    expect(await entryValue(page)).toBe("");
    await tap(page, ["math", "esc"]);
    await expect(find(page)).toBeHidden();
    await page.waitForTimeout(100);
    expect(await page.evaluate(() => history.length)).toBeLessThanOrEqual(before + 1);
  });

  test("the preview follows the highlight: a constant's value, a function's syntax, a unit without a factor marked", async ({ page }) => {
    await tap(page, ["math", "tmpl"]);
    await expect(find(page).getByTestId("find-preview")).toContainText("299792458");
    await tap(page, ["esc", "math"]);
    await flick(page, "d9", "down"); // s (a tap on 9 would open the ninth category)
    await tap(page, ["comma", "sq", "d5", "frac"]); // o l v e
    await expect(active(page)).toHaveAttribute("data-id", "fn:solve");
    await expect(find(page).getByTestId("find-preview")).toContainText("solve(eq, x)");
    await tap(page, ["bksp", "bksp", "bksp", "bksp"]); // s: many hits
    const first = await find(page).getByTestId("find-preview").textContent();
    await tap(page, ["down"]);
    await expect(find(page).getByTestId("find-preview")).not.toHaveText(first ?? "");
    await tap(page, ["esc", "math", "x", "math"]); // d b: dB (inside Find, Math types b)
    await expect(find(page).locator('[data-id="unit:dB"] [data-testid="row-note"]')).toHaveText("converts only");
  });
});

test.describe("by touch", () => {
  test("a tap on a category opens it, a tap on a row picks it, ‹ goes back, × closes", async ({ page }) => {
    await page.locator('[data-key="math"]').tap();
    await rows(page).nth(8).tap(); // Constants
    await expect(find(page).getByTestId("sheet-title")).toHaveText("Find › Constants");
    await find(page).getByRole("button", { name: "Back" }).tap();
    await expect(rows(page)).toHaveCount(10);
    await find(page).getByRole("button", { name: "Close" }).tap();
    await expect(find(page)).toBeHidden();
    await page.locator('[data-key="math"]').tap();
    await page.locator('[data-key="tmpl"]').tap();
    await find(page).locator('[data-id="const:c"]').tap();
    await expect(find(page)).toBeHidden();
    expect(await entryValue(page)).toBe("\\const{c}{c}");
  });

  test("a tap beside the sheet closes it; the preview shows the highlighted row", async ({ page }) => {
    await page.locator('[data-key="math"]').tap();
    await page.locator('[data-key="x"]').tap();
    await page.locator('[data-key="frac"]').tap();
    await page.locator('[data-key="div"]').tap();
    await expect(find(page).getByTestId("find-preview")).toContainText("det(M)");
    await find(page).tap({ position: { x: 5, y: 5 } });
    await expect(find(page)).toBeHidden();
    expect(await entryValue(page)).toBe("");
  });
});
