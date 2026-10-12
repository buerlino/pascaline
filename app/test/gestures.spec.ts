// SPDX-License-Identifier: GPL-3.0-or-later
// Keypad gestures (docs/decisions.md P7; backlog K1-K3, K5): one test per gesture, with synthetic touch moves.
import { expect, test } from "@playwright/test";
import { drag, entryValue, open, recordVibrations, tap, touch, twoFingers, vibrations } from "./helpers.ts";

test.beforeEach(async ({ page }) => {
  await recordVibrations(page);
  await open(page);
  await page.evaluate(() => window.pascaline.session.setHaptics({ on: true }));
});

const picked = (page: import("@playwright/test").Page) => page.locator('[data-selected="true"] .result');

test("K1 trackpad: a drag steps in 2D with a tick per step; a tap on an edge is one step", async ({ page }) => {
  await tap(page, ["d1", "enter", "d2", "enter", "d3", "enter"]);
  await expect(page.locator('[data-status="done"]')).toHaveCount(3);
  // up/down: on an empty line Up picks history rows, as the arrow keys do
  await drag(page, "up", 0, -30); // two steps
  await expect(picked(page)).toHaveAttribute("data-text", "2");
  await drag(page, "down", 4, 14); // one step, the small sideways slip makes none
  await expect(picked(page)).toHaveAttribute("data-text", "3");
  await tap(page, ["esc"]);
  await expect(page.locator('[data-selected="true"]')).toHaveCount(0);

  // left/right through the text: a tick per step
  await tap(page, ["d1", "d2", "d3", "d4"]);
  const before = (await vibrations(page)).length;
  await drag(page, "left", -40, 0); // three steps (12 px each); the drag leaves the pad, it keeps counting
  expect((await vibrations(page)).length - before).toBe(1 + 3); // touch + three steps
  await tap(page, ["d9"]);
  expect(await entryValue(page)).toBe("19234");
  await tap(page, ["right", "d5"]); // a tap is one step
  expect(await entryValue(page)).toBe("192534");
  await drag(page, "right", 13, 0);
  await drag(page, "right", -26, 0); // dragging back steps back
  await tap(page, ["d0"]);
  expect(await entryValue(page)).toBe("1920534");
});

test("K2 hold and drag: hold anywhere on the keypad, then drag moves the cursor; keys fire on release", async ({ page }) => {
  const pad = page.locator(".pad");
  const HOLD = 450; // HOLD_MS (350) plus a margin
  // a tap still types
  await tap(page, ["d1", "d2", "d3", "d4"]);
  expect(await entryValue(page)).toBe("1234");

  // hold a digit still, then drag: the keys dim, the cursor steps (a tick per step), the held key types nothing
  const before = (await vibrations(page)).length;
  let f = await touch(page, "d5");
  await page.waitForTimeout(HOLD);
  await expect(pad).toHaveAttribute("data-cursor", "true");
  expect(await entryValue(page)).toBe("1234");
  await f.move(-30, 0); // two steps left
  await f.end();
  await expect(pad).not.toHaveAttribute("data-cursor");
  expect((await vibrations(page)).length - before).toBe(1 + 1 + 2); // touch + hold + two steps
  await tap(page, ["d9"]);
  expect(await entryValue(page)).toBe("12934");

  // a hold released without moving types nothing and leaves no cursor mode behind
  f = await touch(page, "d7");
  await page.waitForTimeout(HOLD);
  await f.end();
  await expect(pad).not.toHaveAttribute("data-cursor");
  await tap(page, ["d8"]);
  expect(await entryValue(page)).toBe("129834");

  // a pending one-shot Shift is used up by the first drag step (as with the trackpad)
  await tap(page, ["shift"]);
  await expect(page.locator('[data-key="shift"]')).toHaveAttribute("aria-pressed", "true");
  f = await touch(page, "d5");
  await page.waitForTimeout(HOLD);
  await f.move(13, 0); // one step right
  await f.end();
  await expect(page.locator('[data-key="shift"]')).toHaveAttribute("aria-pressed", "false");
  await tap(page, ["d0"]);
  expect(await entryValue(page)).toBe("1298304");

  // a cancel (the browser takes the touch: a scroll, a system gesture) ends the cursor mode and types nothing
  f = await touch(page, "d5");
  await page.waitForTimeout(HOLD);
  await expect(pad).toHaveAttribute("data-cursor", "true");
  await f.cancel();
  await expect(pad).not.toHaveAttribute("data-cursor");
  expect(await entryValue(page)).toBe("1298304");

  // two fingers: a second finger during the hold fires the first key (fast two-thumb typing keeps its order) ...
  let two = await twoFingers(page, "d1", "d2");
  await two.second();
  await two.end();
  expect(await entryValue(page)).toBe("129830124");
  // ... and a second finger in cursor mode ends it; the new finger is an ordinary touch
  two = await twoFingers(page, "d5", "d6");
  await page.waitForTimeout(HOLD);
  await expect(pad).toHaveAttribute("data-cursor", "true");
  await two.second();
  await expect(pad).not.toHaveAttribute("data-cursor");
  await two.end();
  expect(await entryValue(page)).toBe("1298301264");

  // ⌫ keeps auto-repeat instead of the cursor: one delete on touch, more while held
  await tap(page, ["right"]);
  f = await touch(page, "bksp");
  expect(await entryValue(page)).toBe("129830126");
  await page.waitForTimeout(800);
  await expect(pad).not.toHaveAttribute("data-cursor");
  await f.end();
  const left = await entryValue(page);
  expect(left.length).toBeLessThanOrEqual(6);
  expect("129830126".startsWith(left)).toBe(true);
});
