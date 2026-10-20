// SPDX-License-Identifier: GPL-3.0-or-later
// R21a (decisions.md "R21", docs/05 3.1): the pick sheets rise over the keypad's maths rows (3–9), anchored at its
// bottom edge, and fit their rows without a scroll; no key moves, and the top cluster stays uncovered and live.
// Shift + 6 draws each cell over the key that picks it. The fake engine, except for the Tmpl flow.
import { expect, test, type Page } from "@playwright/test";
import { entryValue, open, tap } from "./helpers.ts";

const sheet = (page: Page) => page.locator('[role="menu"]');

type Box = { x: number; y: number; width: number; height: number };
async function boxOf(page: Page, selector: string): Promise<Box> {
  const b = await page.locator(selector).first().boundingBox();
  if (!b) throw new Error(`${selector} is not visible`);
  return b;
}
/** The box of every key, by id. */
const keyBoxes = (page: Page): Promise<Record<string, [number, number, number, number]>> =>
  page.evaluate(() => {
    const out: Record<string, [number, number, number, number]> = {};
    for (const el of document.querySelectorAll<HTMLElement>("[data-key]")) {
      const r = el.getBoundingClientRect();
      out[el.dataset["key"] ?? ""] = [r.x, r.y, r.width, r.height].map((v) => Math.round(v * 10) / 10) as [number, number, number, number];
    }
    return out;
  });

/** Every pick sheet and the keys that open it from a fresh Home (each ends with the sheet open). */
const OPENERS: Record<string, (page: Page) => Promise<void>> = {
  apps: (page) => tap(page, ["@place"]),
  "home menu": (page) => tap(page, ["@menu"]),
  "function plot menu": async (page) => {
    await tap(page, ["@symb"]);
    await expect(page.getByTestId("entry-label")).toHaveText("F1(x)=");
    await tap(page, ["@plot", "@menu"]); // no function defined: every row but one disabled, with its reason
  },
  "solve menu": async (page) => {
    await tap(page, ["@place"]);
    await sheet(page).getByRole("menuitem", { name: "4 Solve" }).click();
    await expect(page.locator('[data-app="solve"]')).toBeVisible();
    await tap(page, ["@num", "@menu"]); // no equation: every row disabled
  },
  mode: (page) => tap(page, ["@mode"]),
  "mode digits": async (page) => {
    await tap(page, ["@mode"]);
    await sheet(page).getByRole("menuitem", { name: "3 Significant digits" }).tap(); // the 3 key is under the sheet: its row is where it was
    await expect(page.getByTestId("sheet-title")).toHaveText("Mode › Significant digits");
  },
  tmpl: (page) => tap(page, ["tmpl"]),
  "shift 6": (page) => tap(page, ["shift", "d6"]),
  "shift 9": (page) => tap(page, ["shift", "d9"]),
};

async function openSheet(page: Page, name: string): Promise<void> {
  await (OPENERS[name] as (page: Page) => Promise<void>)(page);
  await expect(sheet(page)).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" }); // no rise animation: the boxes are final at once
});

test.describe("at 412 × 915", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 412, height: 915 });
    await open(page);
  });

  test("keys never move: Settings (a page over everything) open and closed again", async ({ page }) => {
    const before = await keyBoxes(page);
    await tap(page, ["@mode", "d5"]);
    await expect(page.getByTestId("settings")).toBeVisible();
    expect(await keyBoxes(page)).toEqual(before);
    await tap(page, ["esc"]);
    await expect(page.getByTestId("settings")).toBeHidden();
    expect(await keyBoxes(page)).toEqual(before);
  });

  for (const name of ["apps", "home menu", "mode", "tmpl", "shift 6", "shift 9"])
    test(`keys never move: ${name} open and closed again`, async ({ page }) => {
      const before = await keyBoxes(page);
      await openSheet(page, name);
      expect(await keyBoxes(page)).toEqual(before);
      await tap(page, ["esc"]);
      await expect(sheet(page)).toHaveCount(0);
      expect(await keyBoxes(page)).toEqual(before);
    });

  for (const name of Object.keys(OPENERS))
    test(`where: ${name} sits over the maths rows, at the keypad's bottom edge; the top cluster stays live`, async ({ page }) => {
      await openSheet(page, name);
      const [s, pad, row3] = await Promise.all([boxOf(page, '[role="menu"]'), boxOf(page, ".pad"), boxOf(page, '[data-key="vars"]')]);
      expect(Math.abs(s.y + s.height - (pad.y + pad.height))).toBeLessThanOrEqual(1);
      expect(s.y).toBeGreaterThanOrEqual(row3.y - 1);
      const hits = await page.evaluate((ids) => {
        return ids.map((id) => {
          const r = document.querySelector(`[data-key="${id}"]`)?.getBoundingClientRect();
          if (!r) return "missing";
          const el = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
          return el?.closest<HTMLElement>("[data-key]")?.dataset["key"] ?? el?.className ?? "nothing";
        });
      }, ["up", "down", "left", "right", "view", "esc", "undo", "copy", "lstart", "lend"]);
      expect(hits).toEqual(["up", "down", "left", "right", "view", "esc", "undo", "copy", "lstart", "lend"]);
    });

  // R15c1: Settings as the last row makes the Home menu (10 rows) and the Plot menu (9, two lines of reasons) taller than
  // the 337 px over the maths rows at 36 px a row: they scroll, with the count in the title row (docs/05 3.1)
  const SCROLLS = ["home menu", "function plot menu"];
  for (const name of SCROLLS)
    test(`fit: ${name} is the one case that scrolls, and says so with its count`, async ({ page }) => {
      await openSheet(page, name);
      const m = await sheet(page).locator(".list").evaluate((el) => ({ scroll: el.scrollHeight, client: el.clientHeight }));
      expect(m.scroll).toBeGreaterThan(m.client);
      await expect(page.getByTestId("sheet-count")).toHaveCount(1);
    });

  for (const name of Object.keys(OPENERS).filter((n) => !SCROLLS.includes(n)))
    test(`fit: ${name} shows all its items without a scroll`, async ({ page }) => {
      await openSheet(page, name);
      const box = sheet(page).locator(".list, .grid");
      const m = await box.evaluate((el) => ({ scroll: el.scrollHeight, client: el.clientHeight }));
      expect(m.scroll).toBeLessThanOrEqual(m.client);
      await expect(page.getByTestId("sheet-count")).toHaveCount(0);
    });

  test("a list row never goes below the floor of 36 px, and a value row's ◀ ▶ buttons are at least 44 × 44 px", async ({ page }) => {
    await openSheet(page, "mode digits");
    for (const b of await sheet(page).getByRole("menuitem").evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height)))
      expect(b).toBeGreaterThanOrEqual(36);
    await tap(page, ["esc"]);
    const buttons = sheet(page).locator('[data-testid="step-down"], [data-testid="step-up"]');
    await expect(buttons).toHaveCount(8); // angle, format, digits, entry
    for (const b of await buttons.evaluateAll((els) => els.map((e) => e.getBoundingClientRect())))
      expect(b.width >= 44 && b.height >= 44).toBe(true);
  });

  test("a grid has no title row: the title, the highlighted cell's name and × share the hint line", async ({ page }) => {
    await openSheet(page, "tmpl");
    const [title, hint, close] = await Promise.all([
      boxOf(page, '[data-testid="sheet-title"]'),
      boxOf(page, '[data-testid="sheet-hint"]'),
      boxOf(page, '[role="menu"] [aria-label="Close"]'),
    ]);
    await expect(page.getByTestId("sheet-hint")).toHaveText("Fraction");
    const mid = (b: Box): number => b.y + b.height / 2;
    expect(Math.abs(mid(title) - mid(hint))).toBeLessThanOrEqual(3);
    expect(Math.abs(mid(title) - mid(close))).toBeLessThanOrEqual(3);
  });

  test("Shift + 6: each cell is drawn over the key that picks it (≤ over 8)", async ({ page }) => {
    await openSheet(page, "shift 6");
    for (const [cell, key] of [["le", "d8"], ["lt", "d7"], ["ge", "div"], ["or", "mul"], ["not", "d1"], ["eq", "d3"]]) {
      const [c, k] = await Promise.all([boxOf(page, `[role="menu"] [data-id="${cell}"]`), boxOf(page, `[data-key="${key}"]`)]);
      expect(c.x).toBeLessThanOrEqual(k.x + 1);
      expect(c.y).toBeLessThanOrEqual(k.y + 1);
      expect(c.x + c.width).toBeGreaterThanOrEqual(k.x + k.width - 1);
      expect(c.y + c.height).toBeGreaterThanOrEqual(k.y + k.height - 1);
    }
  });

  test("a short sheet leaves the maths keys above it visible, dimmed, with their sheet job; nothing types into the line", async ({ page }) => {
    await openSheet(page, "apps");
    const hits = await page.evaluate((ids) =>
      ids.map((id) => {
        const r = document.querySelector(`[data-key="${id}"]`)?.getBoundingClientRect();
        return r ? document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.closest<HTMLElement>("[data-key]")?.dataset["key"] : undefined;
      }), ["sq", "sin", "tmpl"]);
    expect(hits).toEqual(["sq", "sin", "tmpl"]); // the Apps sheet is four rows high (Home, CAS, the two apps; R15b)
    await expect(page.getByTestId("sheet-dim")).toBeVisible();
    await tap(page, ["sq", "sin"]); // neither has a job in a short list
    await expect(sheet(page)).toBeVisible();
    expect(await entryValue(page)).toBe("");
    await tap(page, ["tmpl"]); // Tmpl keeps its job: it opens its palette in place of Apps
    await expect(page.getByTestId("sheet-hint")).toHaveText("Fraction");
    await tap(page, ["tmpl"]);
    await expect(sheet(page)).toHaveCount(0);
  });

  test("a digit key under the sheet still picks its row (by a hardware key)", async ({ page }) => {
    await openSheet(page, "apps");
    await page.keyboard.press("4");
    await expect(page.locator('[data-app="solve"]')).toBeVisible();
  });

  test("a tap in the viewport closes the sheet; nothing is picked", async ({ page }) => {
    await openSheet(page, "home menu");
    await page.locator(".screen").click({ position: { x: 20, y: 20 } });
    await expect(sheet(page)).toHaveCount(0);
    await expect(page.locator('[data-app="function"]')).toHaveCount(0);
  });

  test("a list that takes letters stays above the keypad", async ({ page }) => {
    await page.evaluate(() => {
      const items = Array.from({ length: 14 }, (_, i) => ({ id: `u${i}`, label: `unit ${i}` }));
      window.pascaline.shell.showMenu("Units", items);
    });
    const [s, pad] = await Promise.all([boxOf(page, '[role="menu"]'), boxOf(page, ".pad")]);
    expect(s.y + s.height).toBeLessThanOrEqual(pad.y + 1);
  });
});

test.describe("at 360 × 740", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await open(page);
  });
  for (const name of ["tmpl", "shift 6", "shift 9", "mode"])
    test(`fit: ${name} shows all its items without a scroll`, async ({ page }) => {
      await openSheet(page, name);
      const box = sheet(page).locator(".list, .grid");
      const m = await box.evaluate((el) => ({ scroll: el.scrollHeight, client: el.clientHeight }));
      expect(m.scroll).toBeLessThanOrEqual(m.client);
      const [s, pad] = await Promise.all([boxOf(page, '[role="menu"]'), boxOf(page, ".pad")]);
      expect(Math.abs(s.y + s.height - (pad.y + pad.height))).toBeLessThanOrEqual(1);
    });
});

test("flow: a tap on a Tmpl cell closes the sheet, the template goes on the line with the cursor in its first box, and the next digit types into it", async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await open(page);
  await tap(page, ["tmpl"]);
  await sheet(page).locator('[data-id="frac"]').tap();
  await expect(sheet(page)).toHaveCount(0);
  await tap(page, ["d5"]);
  expect(await entryValue(page)).toMatch(/^\\frac\{5\}\{/);
});
