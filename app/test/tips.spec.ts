// SPDX-License-Identifier: GPL-3.0-or-later
// R15c4 (decisions.md "R15c" point 7): the first-start tips. A one-time overlay over the app, in its own lazy chunk: it
// dims the screen, rings the place name and ☰, and says what each opens. Any tap or key closes it and does nothing else;
// Android back closes it. It is shown once (the flag is in the kv store), and Settings › Help and about shows it again.
// `open` adds tips=off to every other test; `tips=on` keeps the default.
import { expect, test, type Page } from "@playwright/test";
import { entryValue, open, tap } from "./helpers.ts";

const tips = (page: Page) => page.getByTestId("tips");
const ON = "engine=fake&tips=on";
const TIPS_CHUNK = /tipsHost/;

/** The stored flag, read from IndexedDB as the app wrote it. */
const stored = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<unknown>((resolve) => {
        const req = indexedDB.open("pascaline", 1);
        req.onerror = () => resolve(null);
        req.onsuccess = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains("kv")) return resolve(null);
          const g = db.transaction("kv", "readonly").objectStore("kv").get("tipsSeen");
          g.onsuccess = () => resolve(g.result ?? null);
          g.onerror = () => resolve(null);
        };
      }),
  );

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("a fresh profile shows the tips; a reload does not", async ({ page }) => {
  await open(page, ON);
  await expect(tips(page)).toBeVisible();
  await expect(tips(page)).toContainText("Tap the name for your apps, Home and CAS");
  await expect(tips(page)).toContainText("Tap ☰ for the menu: copy, paste, settings");
  await expect(page.getByTestId("tips-got-it")).toHaveText("Got it");
  await page.getByTestId("tips-got-it").tap();
  await expect(tips(page)).toHaveCount(0);
  await expect.poll(() => stored(page)).not.toBeNull();
  await open(page, ON);
  await page.waitForTimeout(1500); // the first start showed it by now
  await expect(tips(page)).toHaveCount(0);
});

test("the tips are shown once even if they are not closed before a reload", async ({ page }) => {
  await open(page, ON);
  await expect(tips(page)).toBeVisible();
  await expect.poll(() => stored(page)).not.toBeNull();
  await open(page, ON);
  await page.waitForTimeout(1500);
  await expect(tips(page)).toHaveCount(0);
});

test("the rings sit on the place name and ☰, measured from their boxes", async ({ page }) => {
  await open(page, ON);
  await expect(tips(page)).toBeVisible();
  for (const [ring, target] of [["tips-ring-place", "place"], ["tips-ring-menu", "menu-button"]] as const) {
    const r = (await page.getByTestId(ring).boundingBox())!;
    const b = (await page.getByTestId(target).boundingBox())!;
    // (a ring is kept 2 px inside the screen, so it may start up to 2 px inside the control's box)
    expect(r.x, ring).toBeLessThanOrEqual(b.x + 2);
    expect(r.y, ring).toBeLessThanOrEqual(b.y + 2);
    expect(r.x + r.width, ring).toBeGreaterThanOrEqual(b.x + b.width - 2);
    expect(r.y + r.height, ring).toBeGreaterThanOrEqual(b.y + b.height);
    expect(r.width, ring).toBeLessThanOrEqual(b.width + 16);
    expect(r.height, ring).toBeLessThanOrEqual(b.height + 16);
  }
});

test("a key press only closes the tips; so does a tap on the keypad, and Android back", async ({ page }) => {
  await open(page, ON);
  await expect(tips(page)).toBeVisible();
  await page.keyboard.press("5");
  await expect(tips(page)).toHaveCount(0);
  expect(await entryValue(page)).toBe("");
  expect(await page.evaluate(() => window.pascaline.session.taps.counts.presses)).toBe(0);
  await page.evaluate(() => window.pascaline.entry.ready);
  // the Settings row shows them again (below); a tap on a key under the overlay closes it and presses nothing
  await tap(page, ["@mode", "d5", "d7"]);
  await page.getByTestId("menu").locator('[data-id="tips"]').tap();
  await expect(tips(page)).toBeVisible();
  await page.mouse.click(206, 700); // the keypad is under the overlay
  await expect(tips(page)).toHaveCount(0);
  expect(await entryValue(page)).toBe("");
  await tap(page, ["@mode", "d5", "d7"]);
  await page.getByTestId("menu").locator('[data-id="tips"]').tap();
  await expect(tips(page)).toBeVisible();
  await page.evaluate(() => history.back());
  await expect(tips(page)).toHaveCount(0);
  await tap(page, ["d4", "d2"]);
  expect(await entryValue(page)).toBe("42");
});

test("Settings › Help and about: its first row shows the tips again, after they were seen", async ({ page }) => {
  await open(page); // tips=off: nothing shown
  await page.waitForTimeout(500);
  await expect(tips(page)).toHaveCount(0);
  await tap(page, ["@mode", "d5", "d7"]);
  const rows = page.getByTestId("menu").getByRole("menuitem");
  await expect(rows.first()).toHaveAttribute("data-id", "tips");
  await expect(rows.first()).toContainText("Show the first-start tips");
  await rows.first().tap();
  await expect(page.getByTestId("menu")).toHaveCount(0);
  await expect(tips(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(tips(page)).toHaveCount(0);
  expect(await entryValue(page)).toBe("");
});

test("the overlay's code is its own chunk: not fetched with tips=off, fetched after the start when they show", async ({ page }) => {
  const urls: string[] = [];
  page.on("request", (r) => urls.push(r.url()));
  await open(page); // tips=off
  await page.waitForTimeout(1500);
  expect(urls.filter((u) => TIPS_CHUNK.test(u))).toEqual([]);
  const fresh = await page.context().newPage();
  const more: string[] = [];
  fresh.on("request", (r) => more.push(r.url()));
  await fresh.goto("/?engine=fake&tips=on");
  await expect(fresh.getByTestId("tips")).toBeVisible();
  expect(more.filter((u) => TIPS_CHUNK.test(u)).length).toBeGreaterThan(0);
});

test("it follows prefers-reduced-motion", async ({ page }) => {
  await open(page, ON);
  await expect(tips(page)).toBeVisible();
  expect(await tips(page).evaluate((e) => getComputedStyle(e).animationName)).toBe("none");
});
