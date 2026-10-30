// SPDX-License-Identifier: GPL-3.0-or-later
// R50e (docs/05 3.4, 3.10; mockups/settings.html section 3): Settings › Appearance holds Theme, Brightness, High contrast
// and Plain keys. By touch and by keys; each value survives a reload; the first frame already has the stored theme;
// `prefers-contrast: more` counts at the first start only; a theme pick keeps the sheet open. The fake engine.
import { expect, test, type Page } from "@playwright/test";
import { open, tap } from "./helpers.ts";

const sheet = (page: Page) => page.getByTestId("menu");
const title = (page: Page) => page.getByTestId("sheet-title");
const row = (page: Page, id: string) => sheet(page).locator(`[role="menuitem"][data-id="${id}"]`);
const root = (page: Page) => page.locator("html");
const look = (page: Page) => page.evaluate(() => window.pascaline.session.settings.look);
const attrs = (page: Page) =>
  page.evaluate(() => ["data-family", "data-brightness", "data-contrast", "data-keys"].map((a) => document.documentElement.getAttribute(a)));
/** The look written to IndexedDB (a reload reads this, not the page's memory). */
const stored = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<unknown>((res) => {
        const req = indexedDB.open("pascaline");
        req.onsuccess = () => {
          const g = req.result.transaction("kv").objectStore("kv").get("settings");
          g.onsuccess = () => res((g.result as { value?: { look?: unknown } } | undefined)?.value?.look);
        };
      }),
  );
async function reload(page: Page): Promise<void> {
  await page.waitForTimeout(300); // the store writes behind the change
  await page.reload();
  await page.waitForFunction(() => customElements.get("math-field") !== undefined && window.pascaline !== undefined);
  await page.evaluate(() => window.pascaline.entry.ready);
  await page.waitForTimeout(150);
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 372, height: 767 });
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "dark" });
});
// every test but the last describe starts the app at once; "prefers-contrast: more" sets the media before the first start
test.beforeEach(async ({ page }, info) => {
  if (!info.title.startsWith("pc:")) await open(page);
});

test.describe("the level", () => {
  test("Mode, 5, 1: Theme with its dots and name, Brightness, and two switches with a line each", async ({ page }) => {
    await tap(page, ["@mode", "d5", "d1"]);
    await expect(title(page)).toHaveText("Mode › Settings › Appearance");
    await expect(sheet(page).getByRole("menuitem")).toHaveCount(4);
    await expect(row(page, "theme").getByTestId("row-dots").locator("i")).toHaveCount(5);
    await expect(row(page, "theme").getByTestId("sheet-value")).toHaveText("Pascaline");
    await expect(row(page, "brightness").getByTestId("sheet-value")).toHaveText("System");
    await expect(row(page, "contrast").getByTestId("row-hint")).toHaveText("Text at 7:1, outlined keys");
    await expect(row(page, "plain").getByTestId("row-hint")).toHaveText("No colour coding");
  });

  test("by keys: ▶ ◀ step the theme in place, Enter lists the five, a digit picks and the sheet stays", async ({ page }) => {
    await tap(page, ["@mode", "d5", "d1", "right"]);
    await expect(root(page)).toHaveAttribute("data-family", "graphite");
    await expect(row(page, "theme").getByTestId("sheet-value")).toHaveText("Graphite");
    await tap(page, ["left", "left"]);
    await expect(row(page, "theme").getByTestId("sheet-value")).toHaveText("Nord");
    await tap(page, ["enter"]);
    await expect(title(page)).toHaveText("Settings › Appearance › Theme");
    await expect(sheet(page).getByRole("menuitem")).toHaveCount(5);
    await expect(sheet(page).locator('[data-active="true"]')).toHaveAttribute("data-id", "nord");
    await tap(page, ["d3"]);
    await expect(root(page)).toHaveAttribute("data-family", "solarized");
    await expect(title(page)).toHaveText("Settings › Appearance › Theme"); // a pick keeps the sheet open
    await tap(page, ["esc"]);
    await expect(title(page)).toHaveText("Mode › Settings › Appearance");
    await tap(page, ["down", "right", "right"]); // Brightness: Light, Dark
    await expect(row(page, "brightness").getByTestId("sheet-value")).toHaveText("Dark");
    await tap(page, ["d3", "d4"]);
    expect(await look(page)).toEqual({ family: "solarized", brightness: "dark", contrast: true, plain: true });
    await expect.poll(() => attrs(page)).toEqual(["solarized", "dark", "high", "plain"]); // the lazy CSS is in first
  });

  test("by touch: a tap on Theme lists the five with their dots; a pick keeps the sheet open and the page follows", async ({ page }) => {
    await tap(page, ["@mode", "d5"]);
    await row(page, "appearance").tap();
    await row(page, "theme").locator(".label").tap();
    await expect(title(page)).toHaveText("Settings › Appearance › Theme");
    await expect(sheet(page).locator("[data-testid=row-dots]")).toHaveCount(5);
    await row(page, "gruvbox").tap();
    await expect(sheet(page)).toBeVisible();
    await expect(root(page)).toHaveAttribute("data-family", "gruvbox");
    await expect(row(page, "gruvbox")).toHaveAttribute("data-selected", "true");
    // the status line above the sheet already wears the theme
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--bg").trim())).toBe("#1d2021");
    await sheet(page).getByRole("button", { name: "Back" }).tap();
    await row(page, "brightness").getByTestId("step-up").tap();
    await expect(root(page)).toHaveAttribute("data-brightness", "light");
    await row(page, "contrast").tap();
    await row(page, "plain").tap();
    await expect(root(page)).toHaveAttribute("data-contrast", "high");
    await expect(root(page)).toHaveAttribute("data-keys", "plain");
    await expect(sheet(page)).toBeVisible();
  });

  test("two theme picks in a row end in the last one", async ({ page }) => {
    await tap(page, ["@mode", "d5", "d1", "enter", "d2", "d5"]);
    await expect(root(page)).toHaveAttribute("data-family", "nord");
    await page.waitForTimeout(400);
    await expect(root(page)).toHaveAttribute("data-family", "nord");
  });
});

test.describe("survives a reload", () => {
  test("each of the four values, set by touch", async ({ page }) => {
    await tap(page, ["@mode", "d5"]);
    await row(page, "appearance").tap();
    await row(page, "theme").getByTestId("step-up").tap();
    await row(page, "theme").getByTestId("step-up").tap(); // Solarized
    await row(page, "brightness").getByTestId("step-up").tap(); // Light
    await row(page, "contrast").tap();
    await row(page, "plain").tap();
    await expect.poll(() => stored(page)).toEqual({ family: "solarized", brightness: "light", contrast: true, plain: true });
    await reload(page);
    expect(await look(page)).toEqual({ family: "solarized", brightness: "light", contrast: true, plain: true });
    expect(await attrs(page)).toEqual(["solarized", "light", "high", "plain"]);
    await tap(page, ["@mode", "d5", "d1"]);
    await expect(row(page, "theme").getByTestId("sheet-value")).toHaveText("Solarized");
    await expect(row(page, "brightness").getByTestId("sheet-value")).toHaveText("Light");
    await expect(row(page, "contrast")).toHaveAttribute("data-selected", "true");
    await expect(row(page, "plain")).toHaveAttribute("data-selected", "true");
  });

  test("each of the four values, set by keys", async ({ page }) => {
    await tap(page, ["@mode", "d5", "d1", "left", "down", "left", "d3", "d4"]); // Nord, Dark, High contrast, Plain keys
    await expect.poll(() => stored(page)).toEqual({ family: "nord", brightness: "dark", contrast: true, plain: true });
    await reload(page);
    expect(await attrs(page)).toEqual(["nord", "dark", "high", "plain"]);
    await tap(page, ["@mode", "d5", "d1"]);
    await expect(row(page, "theme").getByTestId("sheet-value")).toHaveText("Nord");
  });

  test("switching the switches off again survives too", async ({ page }) => {
    await tap(page, ["@mode", "d5", "d1", "d3", "d4", "d3", "d4"]);
    await expect.poll(() => attrs(page)).toEqual(["pascaline", "dark", null, null]);
    await expect.poll(() => stored(page)).toEqual({ family: "pascaline", brightness: "system", contrast: false, plain: false });
    await reload(page);
    expect(await attrs(page)).toEqual(["pascaline", "dark", null, null]);
  });
});

test.describe("the first frame", () => {
  test("shows the stored theme before main.ts has run (its file held)", async ({ page }) => {
    await tap(page, ["@mode", "d5", "d1", "left", "d3", "d4"]); // Nord, High contrast, Plain keys
    await expect.poll(() => page.evaluate(() => localStorage.getItem("pascaline.look"))).toContain('"plain":true');
    await expect.poll(() => page.evaluate(() => localStorage.getItem("pascaline.look"))).toContain('"bg":"#');
    await page.waitForTimeout(300);
    const mirrorBg = await page.evaluate(() => (JSON.parse(localStorage.getItem("pascaline.look") ?? "{}") as { bg: string }).bg);
    let release: () => void = () => {};
    const held = new Promise<void>((res) => (release = res));
    await page.route(/\/src\/main\.ts/, async (route) => {
      await held;
      await route.abort();
    });
    await page.goto("/?engine=fake", { waitUntil: "commit" });
    await page.waitForFunction(() => document.documentElement.getAttribute("data-family") === "nord");
    expect(await page.evaluate(() => window.pascaline)).toBeUndefined(); // the app has not started
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--bg").trim())).toBe(mirrorBg);
    expect(await attrs(page)).toEqual(["nord", "dark", "high", "plain"]);
    expect(await page.evaluate(() => document.querySelector('meta[name="theme-color"]')?.getAttribute("content"))).toBe(
      await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--bg").trim()),
    );
    expect(await page.evaluate(() => [...document.querySelectorAll("link[rel=stylesheet]")].map((l) => l.getAttribute("href") ?? "").filter((h) => /theme\/(nord|modes)\.css/.test(h)).length)).toBe(2);
    await page.screenshot({ path: "test-results/appearance-first-frame.png" });
    release();
  });

  test("Brightness Light in a Dark-scheme browser: the first frame is light", async ({ page }) => {
    await tap(page, ["@mode", "d5", "d1", "down", "right"]); // Light
    await expect(root(page)).toHaveAttribute("data-brightness", "light");
    await page.waitForTimeout(300);
    let release: () => void = () => {};
    const held = new Promise<void>((res) => (release = res));
    await page.route(/\/src\/main\.ts/, async (route) => {
      await held;
      await route.abort();
    });
    await page.goto("/?engine=fake", { waitUntil: "commit" });
    await page.waitForFunction(() => document.documentElement.getAttribute("data-brightness") === "light");
    release();
  });
});

test.describe("prefers-contrast: more", () => {
  test("pc: turns High contrast on at the first start only", async ({ page }) => {
    await page.emulateMedia({ contrast: "more" });
    await open(page);
    expect(await attrs(page)).toEqual(["pascaline", "dark", "high", null]);
    expect((await look(page)).contrast).toBe(true);
    await page.emulateMedia({ contrast: "no-preference" });
    await reload(page);
    expect((await look(page)).contrast).toBe(true); // stored: the setting decides now
    expect(await attrs(page)).toEqual(["pascaline", "dark", "high", null]);
  });

  test("pc: a start with the setting off stays off even when the phone asks for more", async ({ page }) => {
    await page.emulateMedia({ contrast: "no-preference" });
    await open(page); // the first start: not asked
    expect((await look(page)).contrast).toBe(false);
    await page.emulateMedia({ contrast: "more" });
    await reload(page);
    expect((await look(page)).contrast).toBe(false);
    expect(await attrs(page)).toEqual(["pascaline", "dark", null, null]);
  });
});
