// SPDX-License-Identifier: GPL-3.0-or-later
// Keypad gestures (docs/decisions.md P7, P11; backlog K1, K5): one test per gesture, with synthetic touch moves.
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

test("keys fire when the finger lifts: a slip or a long hold is still the key, a cancel types nothing, no cursor mode", async ({ page }) => {
  const pad = page.locator(".pad");
  await tap(page, ["d1", "d2", "d3", "d4"]);
  expect(await entryValue(page)).toBe("1234");

  // touching types nothing yet; lifting does. A long hold is that key, never a cursor (P11: hold-and-drag is gone)
  let f = await touch(page, "d5");
  expect(await entryValue(page)).toBe("1234");
  await page.waitForTimeout(600);
  await expect(pad).not.toHaveAttribute("data-cursor");
  await f.move(-30, 0); // dragging a key moves no cursor
  await f.end();
  expect(await entryValue(page)).toBe("12345");

  // a cancel (the browser takes the touch: a scroll, a system gesture) types nothing
  f = await touch(page, "d6");
  await f.cancel();
  expect(await entryValue(page)).toBe("12345");

  // two fingers: a second finger fires the first key at once (fast two-thumb typing keeps its order), even after a hold
  let two = await twoFingers(page, "d1", "d2");
  await page.waitForTimeout(600);
  await two.second();
  await two.end();
  expect(await entryValue(page)).toBe("1234512");

  // ⌫ keeps auto-repeat: one delete on touch, more while held
  await tap(page, ["right"]);
  f = await touch(page, "bksp");
  expect(await entryValue(page)).toBe("123451");
  await page.waitForTimeout(800);
  await f.end();
  const left = await entryValue(page);
  expect(left.length).toBeLessThanOrEqual(4);
  expect("123451".startsWith(left)).toBe(true);
});
