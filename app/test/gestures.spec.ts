// SPDX-License-Identifier: GPL-3.0-or-later
// Keypad gestures (docs/decisions.md P7, P11; backlog K1, K5): one test per gesture, with synthetic touch moves.
import { expect, test, type Page } from "@playwright/test";
import {
  drag,
  entryValue,
  open,
  recordVibrations,
  tap,
  touch,
  twoFingers,
  vibrations,
} from "./helpers.ts";

test.beforeEach(async ({ page }) => {
  await recordVibrations(page);
  await open(page);
  await page.evaluate(() => window.pascaline.session.setHaptics({ on: true }));
});

const picked = (page: import("@playwright/test").Page) =>
  page.locator('[data-selected="true"] .result');

test("K1 trackpad: a drag steps in 2D with a tick per step; a tap on an edge is one step", async ({
  page,
}) => {
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

test("keys fire when the finger lifts: a slip or a long hold is still the key, a cancel types nothing, no cursor mode", async ({
  page,
}) => {
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

// F11, F12 (R25a): a gesture ends when the app goes away. Android may send no pointercancel for a touch that is down
// while the app leaves, so the pad cancels every gesture itself on hide, pagehide and (touch devices) window blur.

const away = (page: Page, via: "hide" | "blur" | "pagehide"): Promise<void> =>
  page.evaluate((how) => {
    if (how === "blur") window.dispatchEvent(new Event("blur"));
    else if (how === "pagehide") window.dispatchEvent(new Event("pagehide"));
    else {
      Object.defineProperty(document, "hidden", {
        value: true,
        configurable: true,
      });
      Object.defineProperty(document, "visibilityState", {
        value: "hidden",
        configurable: true,
      });
      document.dispatchEvent(new Event("visibilitychange"));
    }
  }, via);
const editableFocused = (page: Page): Promise<boolean> =>
  page.evaluate(() => {
    const a = document.activeElement;
    return (
      !!a &&
      (a.matches("input,textarea,[contenteditable],.ML__keyboard-sink") ||
        a.closest(".ML__keyboard-sink") !== null)
    );
  });

for (const via of ["hide", "blur", "pagehide"] as const) {
  test(`F11 (${via}): a held ⌫ stops when the app goes away and takes no focus`, async ({
    page,
  }) => {
    await tap(page, ["d1", "d2", "d3", "d4", "d5", "d6", "d7", "d8", "d9"]);
    await touch(page, "bksp");
    await page.waitForTimeout(700); // the repeat has started
    await away(page, via);
    const at = await entryValue(page);
    await page.waitForTimeout(1000);
    expect(await entryValue(page)).toBe(at);
    expect(at.length).toBeGreaterThan(0);
    // pagehide alone drops no focus (main.ts does that on hide and blur); the repeat must not take it either way
    if (via !== "pagehide") expect(await editableFocused(page)).toBe(false);
  });

  test(`F12 (${via}): a key held while the app goes away fires nothing on the next touch`, async ({
    page,
  }) => {
    await touch(page, "d7");
    await away(page, via);
    await tap(page, ["d2"]);
    expect(await entryValue(page)).toBe("2");
  });

  test(`F12 (${via}): an interrupted trackpad touch fires no arrow on the next key`, async ({
    page,
  }) => {
    await tap(page, ["d1", "d2", "d3"]);
    await touch(page, "left");
    await away(page, via);
    await tap(page, ["d9"]);
    expect(await entryValue(page)).toBe("1239");
  });
}

test("F14: a ⌫ held with a mouse stops at the release, even outside the keypad", async ({ page }) => {
  await tap(page, ["d1", "d2", "d3", "d4", "d5", "d6", "d7", "d8", "d9", "d1", "d2", "d3"]);
  const box = await page.locator('[data-key="bksp"]').boundingBox();
  if (!box) throw new Error("bksp is not visible");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(100);
  await page.mouse.move(box.x + box.width / 2, 60);
  await page.mouse.up();
  const at = await entryValue(page);
  expect(at).toBe("12345678912".slice(0, 11));
  await page.waitForTimeout(800);
  expect(await entryValue(page)).toBe(at);
});
