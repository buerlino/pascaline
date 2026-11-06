// SPDX-License-Identifier: GPL-3.0-or-later
// R62: the unit view's result drawn (docs/04 4.3 "Result", docs/archive/r17-unit-result.md 0.3, the mockup
// `docs/mockups/unit-result.html` at `b1c44ee4`), on the engine: the value line (mark, value, unit, dimension), σ with
// its ⚠ before σ and the why-line, a note under a value that stays, a refusal with no row, and the alternatives row
// picked by touch (a tap on a chip) and by keys (▼ ◀ ▶ Enter, Esc leaves). A pick writes the unit into the end slot and
// evaluates again.
import { expect, test, type Page } from "@playwright/test";
import { flick, open, tap, useClipboardLock } from "./helpers.ts";

const up = (page: Page): Promise<unknown> =>
  page.waitForFunction(() => window.n62.unitView !== undefined && document.activeElement === window.n62.unitView.element && document.querySelector('[data-pad="unit"]') !== null);
const unitsKey = async (page: Page): Promise<void> => {
  await flick(page, "tmpl", "up");
  await up(page);
};
const result = (page: Page) => page.getByTestId("unit-result");
const mark = (page: Page) => page.getByTestId("unit-mark");
const chips = (page: Page) => page.getByTestId("unit-alt");
const chip = (page: Page, text: string) => chips(page).filter({ hasText: new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}$`) });
const texts = (page: Page): Promise<string[]> => chips(page).allTextContents();
const endSlot = (page: Page): Promise<string> =>
  page.evaluate(() => {
    const s = window.n62.unitView?.view.model("end")?.slot;
    return (s?.tokens ?? []).map((t, i) => `${i === s?.per ? "/ " : ""}${t.prefix ?? ""}${t.unit}${t.power ? `^${t.power}` : ""}`).join(" ");
  });

/** A key plan step: a key id, or ↑id for a flick up. */
async function plan(page: Page, steps: string): Promise<void> {
  for (const s of steps.split(" ")) {
    if (s.startsWith("↑")) await flick(page, s.slice(1), "up");
    else await tap(page, [s]);
  }
}

test.describe("the unit result view (R62)", () => {
  test.beforeEach(async ({ page }) => {
    await open(page, "");
    await page.waitForFunction(() => window.n62.session.engineState === "ready", undefined, { timeout: 20_000 });
  });

  /** 72 km/h, evaluated at once: the typed unit is kept (G25). */
  async function kmh(page: Page): Promise<void> {
    await plan(page, "d7 d2");
    await unitsKey(page);
    await plan(page, "d4 d9 div ↑d3 ↑enter");
    await expect(result(page)).toBeVisible();
  }

  test("72 km/h shows = 72 km/h and L·T⁻¹; the row has m/s and More…, not km/h; a tap on m/s shows = 20 m/s in the end slot", async ({ page }) => {
    await kmh(page);
    await expect(mark(page)).toHaveText("=");
    await expect(result(page).locator(".value")).toHaveText("72");
    await expect(page.getByTestId("unit-unit")).toHaveText("km/h");
    await expect(page.getByTestId("unit-dim")).toHaveText("L·T⁻¹");
    const row = await texts(page);
    expect(row).toContain("m/s");
    expect(row).not.toContain("km/h");
    await expect(page.getByTestId("unit-more")).toHaveText("More…");
    await chip(page, "m/s").tap();
    await expect(result(page)).toHaveAttribute("data-text", "20");
    await expect(result(page)).toHaveAttribute("data-unit", "m/s");
    await expect(mark(page)).toHaveText("=");
    expect(await endSlot(page)).toBe("m / s");
    expect(await page.evaluate(() => window.n62.unitView?.field.getPromptValue("end"))).toContain("\\mathrm{m}");
  });

  test("the row by keys (▼ ▶ Enter) picks what a tap on the same chip picks; Esc leaves the row, then the view", async ({ page }) => {
    await kmh(page);
    const row = await texts(page);
    const second = row[1] as string;
    await chips(page).nth(1).tap();
    await expect(result(page)).toHaveAttribute("data-unit", second);
    const byTap = [await result(page).getAttribute("data-text"), await result(page).getAttribute("data-unit")];
    await open(page, "");
    await page.waitForFunction(() => window.n62.session.engineState === "ready", undefined, { timeout: 20_000 });
    await kmh(page);
    expect(await texts(page)).toEqual(row); // the same line, the same row
    await tap(page, ["down"]);
    await expect(page.locator('[data-testid="unit-alt"][data-focus]')).toHaveText(row[0] as string);
    await tap(page, ["right"]);
    await expect(page.locator('[data-testid="unit-alt"][data-focus]')).toHaveText(second);
    await tap(page, ["enter"]);
    await expect(result(page)).toHaveAttribute("data-unit", second);
    expect([await result(page).getAttribute("data-text"), await result(page).getAttribute("data-unit")]).toEqual(byTap);
    // Esc leaves the row and keeps the view; ◀ stops at the first chip; the next Esc leaves the view
    await tap(page, ["down", "left"]);
    await expect(page.locator("[data-focus]")).toHaveCount(1);
    await tap(page, ["esc"]);
    await expect(page.locator("[data-focus]")).toHaveCount(0);
    await expect(page.getByTestId("unit-view")).toBeVisible();
    await tap(page, ["esc"]);
    await expect(page.getByTestId("unit-view")).toHaveCount(0);
  });

  test("a redraw of the same result (▼ ▲) keeps the row's chips, so a tap that lands during it still picks (G153 fix round 1)", async ({ page }) => {
    await kmh(page);
    const second = (await texts(page))[1] as string;
    await chips(page).nth(1).evaluate((b) => b.setAttribute("data-kept", ""));
    await tap(page, ["down"]);
    await expect(page.locator('[data-testid="unit-alt"][data-focus]')).toHaveCount(1);
    await tap(page, ["up"]);
    await expect(page.locator("[data-focus]")).toHaveCount(0);
    await expect(page.locator('[data-testid="unit-alt"][data-kept]')).toHaveText(second);
    await chips(page).nth(1).tap();
    await expect(result(page)).toHaveAttribute("data-unit", second);
  });

  test("2π·25 mm shows ≈ 157.079632679 mm and the m chip gives ≈ 0.157079632679 m (t04)", async ({ page }) => {
    await plan(page, "d2 mul ↑d3 mul d2 d5");
    await unitsKey(page);
    await plan(page, "enter d1 d9 ↑enter");
    await expect(mark(page)).toHaveText("≈");
    await expect(result(page).locator(".value")).toHaveText("157.079\u2009632\u2009679"); // R55's groups on screen (R120)
    await expect(result(page)).toHaveAttribute("data-text", "157.079632679"); // Copy's text: no groups
    await expect(page.getByTestId("unit-unit")).toHaveText("mm");
    await expect(page.getByTestId("unit-dim")).toHaveText("L");
    await expect(chips(page).first()).toHaveText("m");
    await chip(page, "m").tap();
    await expect(result(page)).toHaveAttribute("data-text", "0.157079632679");
    await expect(page.getByTestId("unit-unit")).toHaveText("m");
    await expect(mark(page)).toHaveText("≈");
  });

  test("a tap on the Wh chip of an energy result shows the unit Wh, never LaTeX or an id", async ({ page }) => {
    await plan(page, "d3 d6 d0 d0");
    await unitsKey(page);
    await plan(page, "neg ↑enter"); // 3600 J
    await expect(page.getByTestId("unit-unit")).toHaveText("J");
    await chip(page, "Wh").tap();
    await expect(result(page)).toHaveAttribute("data-unit", "Wh");
    await expect(page.getByTestId("unit-unit")).toHaveText("Wh");
    await expect(result(page)).toHaveAttribute("data-text", "1");
    expect(await endSlot(page)).toBe("Wh"); // the slot holds the unit, the result reads as the chip did
  });

  test("cos(0 ± 0.1) puts ⚠ just before σ, the why-line under it and the value and σ muted below; no dimension, no row", async ({ page }) => {
    await tap(page, ["cos", "d0", "shift", "comma", "d0", "dot", "d1"]);
    await unitsKey(page);
    await flick(page, "enter", "up");
    await expect(mark(page)).toHaveText("≈");
    await expect(result(page).locator(".value")).toHaveText(/ ± ⚠0\.0\d+$/);
    await expect(page.getByTestId("unit-warn")).toHaveText("⚠");
    await expect(page.getByTestId("unit-why")).toHaveText("first order does not hold here");
    await expect(page.getByTestId("unit-sub")).toContainText("σ 0.007\u2009071\u2009067\u200981"); // grouped (R120)
    await expect(page.getByTestId("unit-dim")).toHaveCount(0);
    await expect(page.getByTestId("unit-alts")).toHaveCount(0);
  });

  test("12.34 ± 0.05 m × 3.2 ± 0.1 m shows ≈ 39.5 ± 1.2 m² with the value and σ below", async ({ page }) => {
    await tap(page, ["d1", "d2", "dot", "d3", "d4", "shift", "comma", "d0", "dot", "d0", "d5"]);
    await tap(page, ["mul", "d3", "dot", "d2", "shift", "comma", "d0", "dot", "d1"]);
    await unitsKey(page);
    await plan(page, "d9 enter d9 ↑enter");
    await expect(mark(page)).toHaveText("≈");
    await expect(result(page).locator(".value")).toHaveText("39.5 ± 1.2");
    await expect(page.getByTestId("unit-unit")).toHaveText("m²");
    await expect(page.getByTestId("unit-sub")).toContainText("39.488 · σ 1.244");
    await expect(page.getByTestId("unit-warn")).toHaveCount(0);
    expect(await texts(page)).toContain("ft²");
  });

  test("3000 rpm × 0.1 m → m/s shows the rpm note under = 5 m/s, and the value stays", async ({ page }) => {
    await tap(page, ["d3", "d0", "d0", "d0", "mul", "d0", "dot", "d1"]);
    await unitsKey(page);
    await plan(page, "↑x enter d9 enter d9 div d3 ↑enter");
    await expect(mark(page)).toHaveText("=");
    await expect(result(page).locator(".value")).toHaveText("5");
    await expect(page.getByTestId("unit-unit")).toHaveText("m/s");
    await expect(page.getByTestId("unit-note")).toHaveText("rpm counts turns: the speed at radius r is 2π·r·n");
  });

  test("1 m + 1 s shows the refusal in the value's place: no mark, no row, no chip; the slots stay as typed", async ({ page }) => {
    await tap(page, ["d1", "add", "d1"]);
    await unitsKey(page);
    await plan(page, "d9 enter d3 ↑enter");
    await expect(page.getByTestId("unit-message")).toHaveText("Units don't match: L vs T");
    await expect(result(page)).toHaveCount(0);
    await expect(mark(page)).toHaveCount(0);
    await expect(page.getByTestId("unit-alts")).toHaveCount(0);
    await tap(page, ["down"]); // no row to enter: a dead key
    await expect(page.locator("[data-focus]")).toHaveCount(0);
    expect(await page.evaluate(() => window.n62.unitView?.view.model("u1")?.slot.tokens[0]?.unit)).toBe("m");
    expect(await page.evaluate(() => window.n62.unitView?.view.model("u2")?.slot.tokens[0]?.unit)).toBe("s");
  });

  test("More… opens Find and keeps the result; Esc there leaves the value line and the end slot as before More… (R118, vr-8)", async ({ page }) => {
    await kmh(page);
    const before = await endSlot(page); // (km/h was typed in the first slot and evaluated at once: the end slot is empty)
    const active = await page.evaluate(() => window.n62.unitView?.view.activeId);
    await page.getByTestId("unit-more").tap();
    await expect(page.getByTestId("find")).toBeVisible();
    await expect(page.getByTestId("unit-view")).toBeVisible();
    await tap(page, ["esc"]);
    await expect(page.getByTestId("find")).toBeHidden();
    await expect(page.getByTestId("unit-view")).toBeVisible();
    await expect(result(page)).toHaveAttribute("data-text", "72");
    await expect(result(page)).toHaveAttribute("data-unit", "km/h");
    await expect(mark(page)).toHaveText("=");
    expect(await endSlot(page)).toBe(before);
    expect(await page.evaluate(() => window.n62.unitView?.view.activeId)).toBe(active);
    expect(await page.evaluate(() => window.n62.unitView?.view.model("u1")?.slot.tokens.length)).toBe(2);
  });

  // R121 fix round 2: under the full suite's load More… showed no Find within 5 s, its module fetched only on the tap.
  test("Find on units is fetched while the view opens, so More… waits on no module (R121 fix round 2)", async ({ page }) => {
    const asked: string[] = [];
    page.on("request", (r) => void asked.push(new URL(r.url()).pathname));
    await kmh(page);
    await expect.poll(() => asked.includes("/src/units/find.ts")).toBe(true);
    await page.getByTestId("unit-more").tap();
    await expect(page.getByTestId("find")).toBeVisible();
  });

  // R125 fix round 1: the sheet's view is fetched when the browser is idle (R46); under the full suite's load it was not
  // in when More… opened Find, which was then not drawn. Here no idle callback ever runs: the view's own load brings it.
  test("More… draws Find when the sheet's view was never fetched while idle (R125 fix round 1)", async ({ page }) => {
    await page.addInitScript(() => {
      window.requestIdleCallback = () => 0;
    });
    await open(page, "");
    await page.waitForFunction(() => window.n62.session.engineState === "ready", undefined, { timeout: 20_000 });
    await kmh(page);
    await page.getByTestId("unit-more").tap();
    await expect(page.getByTestId("find")).toBeVisible();
  });

  test("More…, then a pick in Find: the end slot holds the picked unit and the result is in it", async ({ page }) => {
    await kmh(page);
    await page.getByTestId("unit-more").tap();
    const find = page.getByTestId("find");
    await expect(find).toBeVisible();
    await find.getByRole("menuitem").first().tap();
    await expect(find).toBeHidden();
    await expect(result(page)).toBeVisible();
    const unit = await result(page).getAttribute("data-unit");
    expect(unit).not.toBe("km/h");
    expect(await endSlot(page)).not.toBe("");
    expect(await page.evaluate(() => window.n62.unitView?.view.activeId)).toBe("end");
  });
});

// R120: in comma mode the unit view draws its result with the comma (R57), as the Home row of the same visit does; the
// screen has R55's groups, the data-text and Copy as shown none. Expected: derived, commaResult of t10's values (above).
test.describe("t10 with the decimal comma (R120)", () => {
  test.use({ permissions: ["clipboard-read", "clipboard-write"] });
  test.describe.configure({ mode: "serial" });
  useClipboardLock(); // first hook, so the lock is held before the page opens
  test.beforeEach(async ({ page }) => {
    await open(page, "");
    await page.waitForFunction(() => window.n62.session.engineState === "ready", undefined, { timeout: 20_000 });
    await page.evaluate(() => window.n62.session.setDecimalMark("comma"));
  });

  test("12,34 ± 0,05 m × 3,2 ± 0,1 m shows ≈ 39,5 ± 1,2 m² and 39,488 · σ 1,244…; the Home row and Copy as shown keep 39,488 ± 1,2 m²", async ({ page }) => {
    await tap(page, ["d1", "d2", "dot", "d3", "d4", "shift", "comma", "d0", "dot", "d0", "d5"]);
    await tap(page, ["mul", "d3", "dot", "d2", "shift", "comma", "d0", "dot", "d1"]);
    await unitsKey(page);
    await plan(page, "d9 enter d9 ↑enter");
    await expect(mark(page)).toHaveText("≈");
    await expect(result(page).locator(".value")).toHaveText("39,5 ± 1,2");
    await expect(page.getByTestId("unit-unit")).toHaveText("m²");
    await expect(page.getByTestId("unit-sub")).toContainText("39,488 · σ 1,244");
    await expect(page.getByTestId("unit-sub")).not.toContainText(".");
    await expect(result(page)).toHaveAttribute("data-text", "39,488");
    await tap(page, ["esc"]);
    await page.waitForFunction(() => window.n62.unitView === undefined);
    const row = page.locator("article.item").last().locator(".result");
    await expect(row).toHaveAttribute("data-text", "39,488 ± 1,2 m²");
    await tap(page, ["@menu", "d6"]);
    await expect(page.getByTestId("menu")).toBeVisible();
    await page.getByRole("menuitem", { name: /^\d As shown$/ }).click();
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe("39,488 ± 1,2 m²");
  });
});

test.describe("the row at phone widths", () => {
  for (const width of [320, 360, 412]) {
    test(`at ${width} px the row keeps More… on screen and, from 360 px, at least four chips`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await open(page, "");
      await page.waitForFunction(() => window.n62.session.engineState === "ready", undefined, { timeout: 20_000 });
      await plan(page, "d2 mul ↑d3 mul d2 d5");
      await unitsKey(page);
      await plan(page, "enter d1 d9 ↑enter");
      await expect(page.getByTestId("unit-alts")).toBeVisible();
      const shown = await page.locator('[data-testid="unit-alt"]:not([hidden])').count();
      expect(shown).toBeGreaterThanOrEqual(width >= 360 ? 4 : 1);
      await expect(page.getByTestId("unit-more")).toBeVisible();
      const box = await page.getByTestId("unit-more").boundingBox();
      expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(width);
      await chip(page, "m").tap(); // the chip is where it is drawn: a tap reaches it at every width
      await expect(result(page)).toHaveAttribute("data-unit", "m");
      test.info().annotations.push({ type: "chips", description: `${width}: ${shown}` });
    });
  }
});
