// SPDX-License-Identifier: GPL-3.0-or-later
// R112: key vibration is one pulse per touch, at finger-down. Pad steps and armed flicks are silent; a dead key's
// double pulse (docs/05 3.7) is the only second pulse. Counts are navigator.vibrate calls (recordVibrations).
import { expect, test } from "@playwright/test";
import { drag, entryValue, flick, open, recordVibrations, tap, touch, vibrations } from "./helpers.ts";

test.beforeEach(async ({ page }) => {
  await recordVibrations(page);
  await open(page);
  await page.evaluate(() => window.pascaline.session.setHaptics({ on: true, ms: 10 }));
});

const since = async (page: import("@playwright/test").Page, run: () => Promise<void>): Promise<number> => {
  const before = (await vibrations(page)).length;
  await run();
  await page.waitForTimeout(300); // a dead key's second pulse comes ~80 ms after the first
  return (await vibrations(page)).length - before;
};

test("a drag on the arrow pad over five steps is one pulse, and the cursor still moves", async ({ page }) => {
  await tap(page, ["d1", "d2", "d3", "d4", "d5", "d6"]);
  expect(await since(page, () => drag(page, "left", -64, 0))).toBe(1); // five steps (12 px each)
  await tap(page, ["d9"]);
  expect(await entryValue(page)).toBe("1923456"); // five steps left of the end: after the 1
});

test("a flick up or down is one pulse and still fires; a tap is one pulse", async ({ page }) => {
  expect(await since(page, () => flick(page, "dot", "up"))).toBe(1);
  expect(await entryValue(page)).toBe("=");
  expect(await since(page, () => flick(page, "d5", "down"))).toBe(1);
  expect(await entryValue(page)).toBe("=V");
  expect(await since(page, () => tap(page, ["d7"]))).toBe(1);
  expect(await entryValue(page)).toBe("=V7");
});

test("a dead key keeps its double pulse after the touch", async ({ page }) => {
  await tap(page, ["@symb"]);
  // Fmt is dead only once the app is in (it opens async; before that Fmt cycles the format)
  await page.waitForFunction(() => window.pascaline.shell.app !== null && window.pascaline.shell.current !== undefined);
  expect(await since(page, () => tap(page, ["fmt"]))).toBe(3); // the touch, then the double
});

test("a flick armed, slid back and lifted is one pulse and fires nothing", async ({ page }) => {
  const n = await since(page, async () => {
    const f = await touch(page, "dot");
    await f.move(0, -35, 3);
    await expect(page.getByTestId("flick-bubble")).toBeVisible();
    await f.move(0, 2, 4); // back to the middle: cancelled
    await f.end();
  });
  expect(n).toBe(1);
  expect(await entryValue(page)).toBe("");
});
