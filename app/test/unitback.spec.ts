// SPDX-License-Identifier: GPL-3.0-or-later
// R63: the way back from the unit view (docs/04 4.3 "The way back", 2.8; docs/archive/r17-unit-result.md sections 2
// and 4), on the engine. A unit-view result is a Home history row that keeps its request (the line, its slots and end
// slot) and its Quantity summary, saved with the history; ▲ or a tap picks it as any row and puts R61's chip on the line:
// the number in the unit shown, the unit set apart, worth the chip's own value (σ too); Home has no units, so the row
// computed from it says the unit was dropped. The units key on a line with such a chip fills the slot after it with the
// chip's unit. Expected values: oracle (mpmath, tasks.yaml t04: 2π·0.025 = 0.1570796326794896619…, so 4π·0.025 =
// 0.3141592653589793238…) and derived (t10: 12.34·3.2 = 39.488, σ² = 1.548381 by G41, decisions.md R61).
import { expect, test, type Page } from "@playwright/test";
import { entryValue, flick, open, tap, useClipboardLock } from "./helpers.ts";

const up = (page: Page): Promise<unknown> =>
  page.waitForFunction(() => window.n62.unitView !== undefined && document.activeElement === window.n62.unitView.element && document.querySelector('[data-pad="unit"]') !== null);
const unitsKey = async (page: Page): Promise<void> => {
  await flick(page, "tmpl", "up");
  await up(page);
};
const result = (page: Page) => page.getByTestId("unit-result");
const chip = (page: Page, text: string) => page.getByTestId("unit-alt").filter({ hasText: new RegExp(`^${text}$`) });
const lastRow = (page: Page) => page.locator("article.item").last();
/** The view's slot as text: `m`, `m:m`, `m^2`, `` (empty). */
const slotText = (page: Page, id: string): Promise<string> =>
  page.evaluate((id) => {
    const s = window.n62.unitView?.view.model(id)?.slot;
    return (s?.tokens ?? []).map((t, i) => `${i === s?.per ? "/ " : ""}${t.prefix ? `${t.prefix}:` : ""}${t.unit}${t.power ? `^${t.power}` : ""}`).join(" ");
  }, id);
/** The chip table of the entry line, and the one result chip on it. */
const lineChip = (page: Page) =>
  page.evaluate(() => {
    const table = window.n62.entry.chips;
    const keys = Object.keys(table).filter((k) => k.startsWith("res:"));
    return keys.length === 1 ? table[keys[0] as string] : undefined;
  });
const leaveView = async (page: Page): Promise<void> => {
  await tap(page, ["esc"]);
  await page.waitForFunction(() => window.n62.unitView === undefined);
};

/** 2 × π × 2 5 in mm, evaluated, then the m alternative (t04 with the view). */
async function t04(page: Page): Promise<void> {
  await tap(page, ["d2", "mul"]);
  await flick(page, "d3", "up");
  await tap(page, ["mul", "d2", "d5"]);
  await unitsKey(page);
  await tap(page, ["enter", "d1", "d9"]);
  await flick(page, "enter", "up");
  await expect(page.getByTestId("unit-unit")).toHaveText("mm");
  // under load a tap can land while the row is still being drawn and do nothing: tap again until the result is in m
  await expect(async () => {
    if ((await result(page).getAttribute("data-unit")) !== "m") await chip(page, "m").tap({ timeout: 1000 });
    await expect(result(page)).toHaveAttribute("data-text", "0.157079632679", { timeout: 1000 });
  }).toPass({ timeout: 10_000 });
  await expect(page.getByTestId("unit-unit")).toHaveText("m");
}

/** (12.34 ± 0.05) m × (3.2 ± 0.1) m, ± on Shift + `,` (R71), evaluated: ≈ 39.5 ± 1.2 m². */
async function t10(page: Page): Promise<void> {
  await tap(page, ["d1", "d2", "dot", "d3", "d4", "shift", "comma", "d0", "dot", "d0", "d5"]);
  await tap(page, ["mul", "d3", "dot", "d2", "shift", "comma", "d0", "dot", "d1"]);
  await unitsKey(page);
  await tap(page, ["d9", "enter", "d9"]);
  await flick(page, "enter", "up");
  await expect(result(page).locator(".value")).toHaveText("39.5 ± 1.2");
}

/** Pick the last history row with ▲ on an empty line and put its result on the line (Enter). */
async function pickLast(page: Page): Promise<void> {
  await page.evaluate(() => window.n62.entry.clear());
  await tap(page, ["up", "enter"]);
  await expect.poll(() => entryValue(page)).toMatch(/^\\res\{\d+\}/);
}

test.describe("the way back from the unit view (R63)", () => {
  test.beforeEach(async ({ page }) => {
    await open(page, "");
    await page.waitForFunction(() => window.n62.session.engineState === "ready", undefined, { timeout: 20_000 });
  });

  test("2π·25 mm, tap m, pick the row: the row reads 0.157079632679 m, the chip 0.157079632679 with m set apart, and chip × 2 in Home is ≈ 0.314159265359, unit dropped", async ({ page }) => {
    await t04(page);
    // one row for this visit of the view, holding its last result (the m alternative), its line, slots and summary
    const row = await page.evaluate(() => {
      const r = window.n62.session.home.at(-1);
      return r && { latex: r.latex, status: r.status, unit: r.units?.unit, dim: r.units?.dim, slots: Object.keys(r.units?.slots ?? {}).sort() };
    });
    expect(row).toEqual({ latex: "2\\times\\pi\\times25", status: "done", unit: "m", dim: "m1", slots: ["end", "u2"] });
    await expect(page.locator("article.item")).toHaveCount(1);
    await expect(lastRow(page).locator(".result")).toHaveAttribute("data-text", "0.157079632679 m");
    await expect(lastRow(page).getByTestId("mark")).toHaveText("≈");
    expect(await lastRow(page).locator(".out .math").getAttribute("data-latex")).toContain("\\text{m}");
    await leaveView(page);
    await pickLast(page);
    const line = await entryValue(page);
    // the chip is drawn as the number shown, the unit after it smaller, muted and upright (set apart)
    expect(line).toMatch(/^\\res\{\d+\}\{0\.157079632679\\htmlStyle\{color:var\(--muted\);font-size:smaller\}\{\\,\\text\{m\}\}\}$/);
    // its value: R61's quantityChip, the exact number in the unit shown with its unit as label and slot
    expect(await lineChip(page)).toEqual({ value: "1/20*pi", exact: true, unit: { text: "m", dim: "m1", slot: { tokens: [{ unit: "m" }] } } });
    await tap(page, ["mul", "d2", "enter"]);
    await expect(page.locator('[data-status="done"]')).toHaveCount(2);
    await expect(lastRow(page).locator(".result")).toHaveAttribute("data-text", "0.314159265359");
    await expect(lastRow(page).getByTestId("mark")).toHaveText("≈");
    await expect(lastRow(page).getByTestId("unit-dropped")).toHaveText("unit dropped: Home has no units");
    // Ans after a unit result is the same chip
    await page.evaluate(() => window.n62.session.home.splice(-1, 1));
    const ans = await page.evaluate(() => window.n62.session.lastChip("home"));
    expect(ans).toEqual({ value: "1/20*pi", exact: true, unit: { text: "m", dim: "m1", slot: { tokens: [{ unit: "m" }] } } });
  });

  test("after a unit result, a line without its chip or Ans gets no unit-dropped note; Ans × 2 does", async ({ page }) => {
    await t04(page);
    await leaveView(page);
    await page.evaluate(() => window.n62.entry.clear());
    await tap(page, ["d1", "add", "d1", "enter"]);
    await expect(page.locator('[data-status="done"]')).toHaveCount(2);
    await expect(lastRow(page).locator(".result")).toHaveAttribute("data-text", "2");
    await expect(lastRow(page).getByTestId("unit-dropped")).toHaveCount(0);
    // the unit row is the last result again: × on an empty line starts with Ans (docs/04 2.8), which is its chip
    await page.evaluate(() => window.n62.session.home.splice(-1, 1));
    await tap(page, ["mul", "d2", "enter"]);
    await expect(page.locator('[data-status="done"]')).toHaveCount(2);
    await expect(lastRow(page).locator(".result")).toHaveAttribute("data-text", "0.314159265359");
    await expect(lastRow(page).getByTestId("unit-dropped")).toHaveText("unit dropped: Home has no units");
  });

  test("R121: 4700 ▶ R, then R × 2 with A shows = 9400 A with the note R has no unit, in the view and in its Home row (derived)", async ({ page }) => {
    await tap(page, ["d4", "d7", "d0", "d0", "shift", "emark", "alpha", "d8", "enter"]);
    await expect(page.locator('[data-status="done"]')).toHaveCount(1);
    await page.evaluate(() => window.n62.entry.clear());
    await tap(page, ["alpha", "d8", "mul", "d2"]);
    await unitsKey(page);
    await tap(page, ["sin"]);
    await flick(page, "enter", "up");
    await expect(result(page)).toHaveAttribute("data-text", "9400");
    await expect(page.getByTestId("unit-unit")).toHaveText("A");
    const note = page.getByTestId("unit-view").getByTestId("unit-names");
    await expect(note).toHaveText("R has no unit: a Home value");
    await expect(note).toHaveClass("note");
    await leaveView(page);
    await expect(lastRow(page).locator(".result")).toHaveAttribute("data-text", "9400 A");
    await expect(lastRow(page).getByTestId("unit-names")).toHaveText("R has no unit: a Home value");
    // the stored row of a line without a name (t04) has none
    await page.evaluate(() => window.n62.entry.clear());
    await t04(page);
    await leaveView(page);
    await expect(lastRow(page).getByTestId("unit-names")).toHaveCount(0);
  });

  test("the units key on chip × 2 fills the slot after the chip with m; the 2 keeps its own empty slot", async ({ page }) => {
    await t04(page);
    await leaveView(page);
    await pickLast(page);
    await tap(page, ["mul", "d2"]);
    await unitsKey(page);
    expect(await slotText(page, "u1")).toBe("m");
    expect(await slotText(page, "u2")).toBe("");
    await flick(page, "enter", "up");
    await expect(result(page)).toHaveAttribute("data-text", "0.314159265359");
    await expect(page.getByTestId("unit-unit")).toHaveText("m");
  });

  // Fix round 2 (run 466): a unit row whose chip is missing (σ with no chip text, or a stored chip that fails its check)
  // goes on the line as Home's number alone, never with its ± σ or unit LaTeX
  test("t10's row with no chip: ▲ Enter puts 39.488 alone on the line", async ({ page }) => {
    await t10(page);
    await leaveView(page);
    await page.evaluate(() => {
      const u = window.n62.session.home.at(-1)?.units;
      if (u) delete u.chip;
    });
    expect(await page.evaluate(() => window.n62.session.chipFor(window.n62.session.home.at(-1)!))).toBeUndefined();
    await page.evaluate(() => window.n62.entry.clear());
    await tap(page, ["up", "enter"]);
    await expect.poll(() => entryValue(page)).toBe("39.488");
  });

  test("t10's row: chip × 2 is never = and carries uncDigits; the chip keeps σ in m²", async ({ page }) => {
    await t10(page);
    await expect(lastRow(page).getByTestId("mark")).toHaveText("≈");
    await leaveView(page);
    await pickLast(page);
    expect(await lineChip(page)).toEqual({
      value: "4936/125",
      exact: false,
      reliableDigits: null,
      unc: "sqrt(1548381)/1000",
      unit: { text: "m²", dim: "m2", slot: { tokens: [{ unit: "m", power: "2" }] } },
    });
    await tap(page, ["mul", "d2", "enter"]);
    await expect(page.locator('[data-status="done"]')).toHaveCount(2);
    await expect(lastRow(page).locator(".result")).toHaveAttribute("data-text", "78.976");
    await expect(lastRow(page).getByTestId("mark")).not.toHaveText("=");
    const facts = await page.evaluate(() => window.n62.session.home.at(-1)?.facts);
    expect(facts?.exact).toBe(false);
    // σ = 2·1.244339583875… = 2.48867916775…, its first digit at 10⁰: one digit of 78.976 lies before it (constUnc.ts
    // uncDigitsOf, derived: exp 1 − exp 0)
    expect(facts?.uncDigits).toBe(1);
  });

  test("a relaunch keeps the row, its slots and its chip's facts; the units key on the picked row shows its slots again", async ({ page }) => {
    await t04(page);
    await leaveView(page);
    const before = await page.evaluate(() => window.n62.session.chipFor(window.n62.session.home.at(-1)!));
    await page.waitForTimeout(800); // the store write is debounced (400 ms) and asynchronous
    await page.reload();
    await page.waitForFunction(() => window.n62?.session.engineState === "ready", undefined, { timeout: 20_000 });
    await expect(page.locator('[data-status="done"]')).toHaveCount(1);
    await expect(lastRow(page).locator(".result")).toHaveAttribute("data-text", "0.157079632679 m");
    expect(await lastRow(page).locator(".out .math").getAttribute("data-latex")).toContain("\\text{m}");
    expect(await page.evaluate(() => window.n62.session.chipFor(window.n62.session.home.at(-1)!))).toEqual(before);
    await page.evaluate(() => window.n62.entry.ready);
    await page.evaluate(() => window.n62.entry.clear());
    await tap(page, ["up"]);
    await unitsKey(page);
    expect(await slotText(page, "u1")).toBe("");
    expect(await slotText(page, "u2")).toBe("m:m");
    expect(await slotText(page, "end")).toBe("m");
    await flick(page, "enter", "up");
    await expect(result(page)).toHaveAttribute("data-text", "0.157079632679");
    await expect(page.getByTestId("unit-unit")).toHaveText("m");
    await leaveView(page);
    await pickLast(page);
    expect(await lineChip(page)).toEqual(before);
  });

  // Fix round 1 (run 459): only the picked row seeds the slots. The same line typed again after a relaunch is a new
  // request: its slots start empty, so k m ÷ h gives 72 km/h, not km/h written after the stored km/h (1/s², unitresult.spec).
  test("after a relaunch, the units key on the same line typed again starts with empty slots", async ({ page }) => {
    await tap(page, ["d7", "d2"]);
    await unitsKey(page);
    await tap(page, ["d4", "d9", "div"]);
    await flick(page, "d3", "up");
    await flick(page, "enter", "up");
    await expect(result(page)).toHaveAttribute("data-unit", "km/h");
    await leaveView(page);
    await page.waitForTimeout(800); // the store write is debounced (400 ms) and asynchronous
    await page.reload();
    await page.waitForFunction(() => window.n62?.session.engineState === "ready", undefined, { timeout: 20_000 });
    await expect(page.locator('[data-status="done"]')).toHaveCount(1); // the stored unit row is back before the key
    await page.evaluate(() => window.n62.entry.ready);
    await page.evaluate(() => window.n62.entry.clear());
    await tap(page, ["d7", "d2"]);
    await unitsKey(page);
    expect(await slotText(page, "u1")).toBe("");
    expect(await slotText(page, "end")).toBe("");
    await tap(page, ["d4", "d9", "div"]);
    await flick(page, "d3", "up");
    await flick(page, "enter", "up");
    await expect(result(page)).toHaveAttribute("data-text", "72");
    await expect(result(page)).toHaveAttribute("data-unit", "km/h");
  });
});

// R63f1: Copy as shown gives the row as drawn, ± σ and the unit too (the clipboard is one for the whole browser)
test.describe("Copy as shown on a unit row (R63f1)", () => {
  test.use({ permissions: ["clipboard-read", "clipboard-write"] });
  test.describe.configure({ mode: "serial" });
  useClipboardLock(); // first hook, so the lock is held before the page opens
  test.beforeEach(async ({ page }) => {
    await open(page, "");
    await page.waitForFunction(() => window.n62.session.engineState === "ready", undefined, { timeout: 20_000 });
  });

  test("t10's row reads 39.488 ± 1.2 m², and Menu → Copy as › As shown copies that", async ({ page }) => {
    await t10(page);
    await leaveView(page);
    await expect(lastRow(page).locator(".result")).toHaveAttribute("data-text", "39.488 ± 1.2 m²");
    await tap(page, ["@menu", "d6"]);
    await expect(page.getByTestId("menu")).toBeVisible();
    await page.getByRole("menuitem", { name: /^\d As shown$/ }).click();
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe("39.488 ± 1.2 m²");
  });

  // R63f2: Share session writes the request with its units and the value with σ and unit, never the plain line with
  // the number in the result's unit (2×π×25 ≈ 0.157…, a silent wrong statement)
  test("Menu → Share session on t10's row: the request with its units, the value ending ± 1.2 m²", async ({ page }) => {
    await t10(page);
    await leaveView(page);
    await tap(page, ["@menu"]);
    await expect(page.getByTestId("menu")).toBeVisible();
    await page.getByRole("menuitem", { name: /^\d Share session$/ }).click();
    await expect(page.getByTestId("notice")).toHaveText("This device cannot share: copied instead");
    const text = await page.evaluate(() => navigator.clipboard.readText());
    expect(text).toBe("12.34±0.05 m×3.2±0.1 m ≈ 39.488 ± 1.2 m²");
  });
});
