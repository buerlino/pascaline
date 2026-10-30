// SPDX-License-Identifier: GPL-3.0-or-later
// R4b (docs/04 3.4, 5.1; docs/05 3.4): Vars lists the user's stored names and inserts one; Shift + Math, Memory,
// deletes one and clears all; Settings › Your keys sets U1–U6 (tap, Shift, Alpha) from Find or from a place, and a slot
// fires after a reload. Every path by keys (digits, Enter, Esc) and by touch (taps on the rows). The real engine: the
// names come from its definitions log.
import { expect, test, type Page } from "@playwright/test";
import { entryValue, flick, open, tap } from "./helpers.ts";

const find = (page: Page) => page.getByTestId("find");
const menu = (page: Page) => page.getByTestId("menu");
const rows = (page: Page) => find(page).getByRole("menuitem");
const row = (page: Page, id: string) => find(page).locator(`[role="menuitem"][data-id="${id}"]`);
const mrow = (page: Page, id: string) => menu(page).locator(`[role="menuitem"][data-id="${id}"]`);
const active = (page: Page) => find(page).locator('[role="menuitem"][data-active="true"]');
const mactive = (page: Page) => menu(page).locator('[role="menuitem"][data-active="true"]');
const title = (page: Page) => page.getByTestId("sheet-title");
const lastResult = (page: Page) => page.locator('[data-testid="result"]').last().locator(".result");
const names = (page: Page) => page.evaluate(() => window.pascaline.session.userNames.map((u) => u.name).sort());

async function start(page: Page): Promise<void> {
  await open(page, "");
  await page.waitForFunction(() => window.pascaline.session.engineState === "ready", undefined, { timeout: 20_000 });
}
/** `value ▶ name` in Home: Shift + the exponent key is Sto▶, Alpha + Vars is A, Alpha + Math is B. */
async function store(page: Page, digit: string, letterKey: "vars" | "math", count: number): Promise<void> {
  await tap(page, [digit, "shift", "emark", "alpha", letterKey, "enter"]);
  await expect(page.locator('[data-status="done"]')).toHaveCount(count);
}
/** The stored names are written asynchronously; a reload after this keeps them. */
async function reload(page: Page): Promise<void> {
  await page.waitForTimeout(900);
  await page.reload();
  await page.waitForFunction(() => window.pascaline?.session.engineState === "ready", undefined, { timeout: 20_000 });
  await page.evaluate(() => window.pascaline.entry.ready);
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test.describe("Vars", () => {
  test("by keys: Vars lists a stored name, also after a reload, and Enter inserts it", async ({ page }) => {
    await start(page);
    await store(page, "d5", "vars", 1);
    await tap(page, ["vars"]);
    await expect(find(page)).toBeVisible();
    await expect(title(page)).toHaveText("Vars");
    await expect(rows(page)).toHaveCount(1);
    await expect(active(page)).toHaveAttribute("data-id", "var:A");
    await expect(active(page)).toContainText("5");
    await expect(page.getByTestId("find-preview")).toHaveText("A = 5");
    await tap(page, ["enter"]);
    await expect(find(page)).toBeHidden();
    expect(await entryValue(page)).toBe("A");
    // the names come from the stored definitions after a relaunch
    await tap(page, ["esc"]);
    await reload(page);
    await tap(page, ["vars"]);
    await expect(row(page, "var:A")).toBeVisible();
    await tap(page, ["esc"]);
    await expect(find(page)).toBeHidden();
  });

  test("by keys: a typed letter searches the names, a digit picks the numbered row, a function goes in as a call", async ({ page }) => {
    await start(page);
    await store(page, "d5", "vars", 1);
    await store(page, "d7", "math", 2);
    await tap(page, ["shift", "alpha", "emark", "paren", "x", "right", "alpha", "sub", "shift", "dot", "x", "sq", "enter"]); // p(x):=x²
    await expect(page.locator('[data-status="done"]')).toHaveCount(3);
    await tap(page, ["vars"]);
    await expect(rows(page)).toHaveCount(3);
    await expect(rows(page).first()).toHaveAttribute("data-id", "userfn:p"); // the newest first
    await tap(page, ["vars"]); // inside Find the key types its letter: a
    await expect(find(page).getByTestId("sheet-filter")).toHaveText("a");
    await expect(rows(page)).toHaveCount(1);
    await expect(rows(page).first()).toHaveAttribute("data-id", "var:A");
    await tap(page, ["bksp", "d1"]); // empty again: 1 picks the first row, the function p
    await expect(find(page)).toBeHidden();
    expect(await entryValue(page)).toBe("p\\left(\\placeholder{}\\right)");
  });

  test("by touch: a tap on a row inserts the name", async ({ page }) => {
    await start(page);
    await store(page, "d5", "vars", 1);
    await tap(page, ["vars"]);
    await row(page, "var:A").tap();
    await expect(find(page)).toBeHidden();
    expect(await entryValue(page)).toBe("A");
  });
});

test.describe("Memory", () => {
  test("by keys: Enter deletes the highlighted name, the last row clears all on the second Enter", async ({ page }) => {
    await start(page);
    await store(page, "d5", "vars", 1);
    await store(page, "d7", "math", 2);
    await tap(page, ["shift", "math"]);
    await expect(title(page)).toHaveText("Memory");
    await expect(rows(page)).toHaveCount(3); // B, A and Clear all
    await expect(active(page)).toHaveAttribute("data-id", "var:B");
    await tap(page, ["enter"]); // deletes B; the sheet stays
    await expect(find(page)).toBeVisible();
    await expect(rows(page)).toHaveCount(2);
    await expect(row(page, "var:B")).toHaveCount(0);
    await expect.poll(() => names(page)).toEqual(["A"]);
    await tap(page, ["down", "enter"]); // Clear all asks once
    await expect(row(page, "clearall")).toContainText("Enter again clears 1");
    await expect(row(page, "var:A")).toBeVisible();
    await tap(page, ["enter"]);
    await expect(rows(page)).toHaveCount(0);
    await expect.poll(() => names(page)).toEqual([]);
    await tap(page, ["esc"]);
    await expect(find(page)).toBeHidden();
    // the engine forgot them too: A is not 5 any more
    await tap(page, ["alpha", "vars", "enter"]);
    await expect(page.locator('[data-status="done"],[data-status="error"]')).toHaveCount(3);
    await expect(lastResult(page)).not.toHaveAttribute("data-text", "5");
  });

  test("by keys: a deleted name stays deleted after a reload, and a search shows no deleted row", async ({ page }) => {
    await start(page);
    await store(page, "d5", "vars", 1);
    await store(page, "d7", "math", 2);
    await tap(page, ["shift", "math", "vars"]); // a: the search finds A only
    await expect(rows(page)).toHaveCount(1);
    await tap(page, ["enter"]);
    await expect(rows(page)).toHaveCount(0); // A is gone from the hits at once
    await tap(page, ["bksp"]);
    await expect(rows(page)).toHaveCount(2); // B and Clear all
    await reload(page);
    expect(await names(page)).toEqual(["B"]);
  });

  test("by touch: a tap on a name deletes it, two taps on Clear all clear the rest", async ({ page }) => {
    await start(page);
    await store(page, "d5", "vars", 1);
    await store(page, "d7", "math", 2);
    await tap(page, ["shift", "math"]);
    await row(page, "var:A").tap();
    await expect(row(page, "var:A")).toHaveCount(0);
    await expect.poll(() => names(page)).toEqual(["B"]);
    await row(page, "clearall").tap();
    await expect(row(page, "clearall")).toContainText("again");
    await row(page, "clearall").tap();
    await expect(rows(page)).toHaveCount(0);
    await expect.poll(() => names(page)).toEqual([]);
  });
});

test.describe("Your keys", () => {
  test("by keys: Settings lists the section, U3 goes to its row, a flick up to its Shift row", async ({ page }) => {
    await open(page);
    await tap(page, ["@mode", "d5", "d3"]);
    await expect(title(page)).toHaveText("Mode › Settings › Your keys");
    await expect(menu(page).getByRole("menuitem")).toHaveCount(19); // 18 slots and Reset all
    await expect(mrow(page, "u1:primary")).toContainText("Empty");
    await tap(page, ["u3"]);
    await expect(mactive(page)).toHaveAttribute("data-id", "u3:primary");
    await flick(page, "u3", "up");
    await expect(mactive(page)).toHaveAttribute("data-id", "u3:shift");
    await flick(page, "u5", "down");
    await expect(mactive(page)).toHaveAttribute("data-id", "u5:alpha");
    await expect(menu(page)).toBeVisible(); // no key went through to its job
    expect(await entryValue(page)).toBe("");
  });

  test("by keys: a constant picked from Find sits on U1 and fires after a reload", async ({ page }) => {
    await start(page);
    await tap(page, ["@mode", "d5", "d3", "d1", "d1"]); // Settings, Your keys, U1, Find…
    await expect(find(page)).toBeVisible();
    await expect(title(page)).toHaveText("Your key");
    await tap(page, ["tmpl"]); // c
    await expect(active(page)).toHaveAttribute("data-id", "const:c");
    await tap(page, ["enter"]);
    await expect(find(page)).toBeHidden();
    expect(await entryValue(page)).toBe(""); // the pick set the key, it did not insert
    await expect(page.locator('[data-key="u1"]')).toContainText("c");
    await reload(page);
    await expect(page.locator('[data-key="u1"]')).toContainText("c");
    await tap(page, ["u1"]);
    expect(await entryValue(page)).toBe("\\const{c}{c}");
    await tap(page, ["enter"]);
    await expect(page.locator('[data-status="done"]')).toHaveCount(1);
    await expect(lastResult(page)).toHaveAttribute("data-text", "299792458");
  });

  test("by keys: a place sits on a tap slot and opens; a function sits on a Shift slot and fires with Shift", async ({ page }) => {
    await start(page);
    await tap(page, ["@mode", "d5", "d3", "d4", "d3", "d3"]); // Your keys, U2, CAS (Find…, Home, CAS)
    await expect(mrow(page, "cas")).toHaveAttribute("data-selected", "true");
    await tap(page, ["esc"]);
    await expect(mrow(page, "u2:primary")).toContainText("CAS");
    await tap(page, ["esc", "esc", "esc"]); // Settings, Mode, closed
    await expect(menu(page)).toHaveCount(0);
    await tap(page, ["u2"]);
    await expect(page.getByTestId("place")).toHaveAttribute("data-view", "cas");
    // U2's Shift slot: abs by Find (a and b are the Vars and Math keys, s a flick down on 9)
    await tap(page, ["@mode", "d5", "d3", "d5", "d1"]); // U2 ⇧, Find…
    await expect(find(page)).toBeVisible();
    await tap(page, ["vars", "math"]);
    await flick(page, "d9", "down");
    await expect(find(page).getByTestId("sheet-filter")).toHaveText("abs");
    await expect(active(page)).toHaveAttribute("data-id", "fn:abs");
    await tap(page, ["enter"]);
    await expect(find(page)).toBeHidden();
    await tap(page, ["shift", "u2"]);
    expect(await entryValue(page)).toMatch(/abs/);
  });

  test("by keys: Empty this slot and Reset all give the slots back", async ({ page }) => {
    await open(page);
    await tap(page, ["@mode", "d5", "d3", "d1", "d3", "d2"]); // U1, Home (row 2)
    await expect(mrow(page, "home")).toHaveAttribute("data-selected", "true");
    await tap(page, ["d3", "d4"]); // CAS (row 3), then Apps (row 4): the tick moves
    await expect(mrow(page, "apps")).toHaveAttribute("data-selected", "true");
    await expect(mrow(page, "cas")).toHaveAttribute("data-selected", "false");
    await tap(page, ["esc"]);
    await expect(mrow(page, "u1:primary")).toContainText("Apps");
    await tap(page, ["d1", "d8"]); // U1's level again; Empty this slot is row 8
    await tap(page, ["esc"]);
    await expect(mrow(page, "u1:primary")).toContainText("Empty");
    await tap(page, ["d2", "d2", "esc"]); // U1 ⇧, Home, back
    await expect(mrow(page, "u1:shift")).toContainText("Home");
    await mrow(page, "reset").tap();
    await expect(mrow(page, "u1:shift")).toContainText("Empty");
  });

  test("by touch: rows set a place and a constant, and the key fires", async ({ page }) => {
    await start(page);
    await page.getByTestId("chip-format").tap();
    await mrow(page, "settings").tap();
    await mrow(page, "keys").tap();
    await mrow(page, "u3:primary").tap();
    await mrow(page, "cas").tap();
    await expect(mrow(page, "cas")).toHaveAttribute("data-selected", "true");
    await menu(page).getByRole("button", { name: "Back" }).tap();
    await expect(mrow(page, "u3:primary")).toContainText("CAS");
    // U1: Find…, then the constant by touch
    await mrow(page, "u1:primary").tap();
    await mrow(page, "find").tap();
    await expect(find(page)).toBeVisible();
    await tap(page, ["tmpl"]); // c
    await row(page, "const:c").tap();
    await expect(find(page)).toBeHidden();
    await expect(page.locator('[data-key="u1"]')).toContainText("c");
    await reload(page);
    await page.locator('[data-key="u3"]').tap();
    await expect(page.getByTestId("place")).toHaveAttribute("data-view", "cas");
    await page.locator('[data-key="u1"]').tap();
    expect(await entryValue(page)).toBe("\\const{c}{c}");
  });
});
