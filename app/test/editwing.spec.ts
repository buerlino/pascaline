// SPDX-License-Identifier: GPL-3.0-or-later
// R15c2: the R3 cluster's editing wing (⇤ ⇥, Undo | Redo, Copy | Paste, Esc's jobs), Store from the last result and the
// round pad's hub (decisions.md "R15c" points 1–5, "R15c Store"). Expected values are derived (what the keys must type).
import { expect, test } from "@playwright/test";
import { drag, entryValue, open, recordVibrations, tap, touch, vibrations } from "./helpers.ts";

test("⇤ and ⇥ go to the line's ends", async ({ page }) => {
  await open(page);
  await tap(page, ["d1", "d2", "d3", "lstart", "d9"]);
  expect(await entryValue(page)).toBe("9123");
  await tap(page, ["left", "lend", "d5"]);
  expect(await entryValue(page)).toBe("91235");
  // from inside a fraction too: ⇤ leaves the box for the start of the line
  await tap(page, ["bksp", "bksp", "bksp", "bksp", "bksp"]);
  await tap(page, ["d1", "d2", "div", "d3", "d4", "lstart", "d7"]);
  expect(await entryValue(page)).toBe("7\\frac{12}{34}");
});

test("Shift + ⇤ and Shift + ⇥ go to the ends of the box: a numerator, an exponent", async ({ page }) => {
  await open(page);
  // the prototype's finding: 12 ÷ 34, Shift + ⇤, 5 puts the 5 at the start of the denominator
  await tap(page, ["d1", "d2", "div", "d3", "d4", "shift", "lstart", "d5"]);
  expect(await entryValue(page)).toBe("\\frac{12}{534}");
  await page.evaluate(() => window.pascaline.entry.clear());
  await tap(page, ["d2", "pow", "d3", "d4", "shift", "lstart", "d7"]);
  expect(await entryValue(page)).toBe("2^{734}");
  await tap(page, ["shift", "lend", "d5"]);
  expect(await entryValue(page)).toBe("2^{7345}");
  // the end of the box is not the end of the line: a digit after Shift + ⇥ stays in the exponent
  await tap(page, ["left", "left", "shift", "lend", "d6"]);
  expect(await entryValue(page)).toBe("2^{73456}");
});

test("Undo, then Redo (Shift + Undo)", async ({ page }) => {
  await open(page);
  await tap(page, ["d1", "add", "d2", "mul", "d3"]);
  await tap(page, ["undo"]);
  expect(await entryValue(page)).toBe("1+2\\times");
  await tap(page, ["undo"]);
  expect(await entryValue(page)).toBe("1+2");
  await tap(page, ["shift", "undo"]);
  expect(await entryValue(page)).toBe("1+2\\times");
  await tap(page, ["shift", "undo"]);
  expect(await entryValue(page)).toBe("1+2\\times3");
  // a template comes back whole
  await tap(page, ["div", "d4", "undo"]);
  expect(await entryValue(page)).toBe("1+2\\times\\frac{3}{\\placeholder{}}");
  await tap(page, ["shift", "undo"]);
  expect(await entryValue(page)).toBe("1+2\\times\\frac34"); // MathLive's short form of \\frac{3}{4}
  await expect(page.locator('[data-key="undo"] .shiftlegend')).toHaveText("Redo");
});

test("⇤ ⇥ and Undo are dead in a view without an entry line (Plot)", async ({ page }) => {
  await recordVibrations(page);
  await open(page);
  await page.evaluate(() => window.pascaline.session.setHaptics({ on: true }));
  await page.getByTestId("place").tap();
  await tap(page, ["d3"]); // Function
  await page.getByTestId("tab-plot").tap();
  await expect(page.getByTestId("place")).toHaveAttribute("data-view", "plot");
  for (const id of ["lstart", "lend", "undo"]) {
    await expect(page.locator(`[data-key="${id}"]`)).toHaveAttribute("data-key", id);
    const before = (await vibrations(page)).length;
    await tap(page, [id]);
    await expect.poll(async () => (await vibrations(page)).length - before).toBe(3); // the touch, then the double dead-key buzz
  }
});

test("Esc: stops a running job, goes back a sheet level, drops a pick, closes Settings, else clears the line", async ({ page }) => {
  await open(page, "engine=fake&delay=2000");
  // a running job: Esc stops it (Cancel's job, R15c point 3)
  await tap(page, ["d2", "add", "d3", "enter", "esc"]);
  await expect(page.locator(".item").last()).toHaveAttribute("data-status", "cancelled");
  // a sheet: back one level; at the top it closes
  await page.evaluate(() =>
    window.pascaline.shell.showMenu("Test", [{ id: "more", label: "more", submenu: { title: "More", items: [{ id: "x", label: "x", run: () => {} }] } }]),
  );
  await tap(page, ["d1"]);
  await expect(page.getByTestId("sheet-title")).toHaveText("Test › More");
  await tap(page, ["esc"]);
  await expect(page.getByTestId("sheet-title")).toHaveText("Test");
  await tap(page, ["esc"]);
  await expect(page.getByTestId("menu")).toHaveCount(0);
  // a picked row: Esc drops the pick and nothing else
  await tap(page, ["up"]);
  await expect(page.locator('[data-selected="true"]')).toHaveCount(1);
  await tap(page, ["esc"]);
  await expect(page.locator('[data-selected="true"]')).toHaveCount(0);
  // Settings (R49, a level of the sheet): Esc goes back one level, the root closes
  await page.getByTestId("chip-digits").tap();
  await page.getByTestId("menu").locator('[data-id="settings"]').tap();
  await expect(page.getByTestId("sheet-title")).toHaveText("Mode › Settings");
  await tap(page, ["esc"]);
  await expect(page.getByTestId("sheet-title")).toHaveText("Mode");
  await tap(page, ["esc"]);
  await expect(page.getByTestId("menu")).toHaveCount(0);
  // otherwise it clears the line; a hardware Escape is the same key
  await tap(page, ["d7", "esc"]);
  expect(await entryValue(page)).toBe("");
  await tap(page, ["d8"]);
  await page.keyboard.press("Escape");
  expect(await entryValue(page)).toBe("");
  await tap(page, ["d4", "add", "d4", "enter"]);
  await page.waitForTimeout(100);
  await page.keyboard.press("Escape");
  await expect(page.locator(".item").last()).toHaveAttribute("data-status", "cancelled");
});

test("Store: Shift + ᴇ on an empty line after a result starts Ans ▶ (G2 item 58)", async ({ page }) => {
  await open(page);
  // no result yet: Store is bare
  await tap(page, ["shift", "emark"]);
  expect(await entryValue(page)).toBe("\\blacktriangleright");
  await tap(page, ["esc", "d5", "enter"]);
  await expect(page.locator('[data-status="done"]')).toHaveCount(1);
  await tap(page, ["shift", "emark", "alpha", "d1"]);
  expect(await entryValue(page)).toBe("\\ans\\blacktriangleright Y");
  // after something typed it follows the value, as before
  await tap(page, ["esc", "d9", "shift", "emark"]);
  expect(await entryValue(page)).toBe("9\\blacktriangleright");
});

test("the round pad: a hub ring at the centre; a drag from the hub steps the cursor, a tap on it does nothing; a drag from ▲ steps too", async ({ page }) => {
  await open(page);
  const pad = page.locator("[data-trackpad]").first();
  expect(await pad.evaluate((el) => getComputedStyle(el).borderTopLeftRadius)).toBe("50%");
  const hub = page.getByTestId("pad-hub");
  await expect(hub).toBeVisible();
  expect(await hub.evaluate((el) => getComputedStyle(el).borderTopStyle)).toBe("dashed");
  await tap(page, ["d1", "d2", "d3", "d4"]);
  // a tap on the hub: no step
  const t = await touch(page, '[data-testid="pad-hub"]');
  await t.end();
  await tap(page, ["d5"]);
  expect(await entryValue(page)).toBe("12345");
  // a drag from the hub: two steps left
  await drag(page, '[data-testid="pad-hub"]', -26, 0);
  await tap(page, ["d0"]);
  expect(await entryValue(page)).toBe("123045");
  // a drag that starts on ▲ steps sideways as well (one surface)
  await drag(page, "up", 13, 0);
  await tap(page, ["d9"]);
  expect(await entryValue(page)).toBe("1230495");
});
