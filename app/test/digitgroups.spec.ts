// SPDX-License-Identifier: GPL-3.0-or-later
// R55: a drawn result has thin-space digit groups; the text, the tapped chip and Copy stay plain digits.
// R125: Settings › Numbers › Digit groups picks the separator (the thin space, the apostrophe, the comma); under the
// decimal comma the comma is never one (its button is off, a stored comma draws as the thin space).
// Expected values are derived (1/3 to 12 digits; C(49,6) = 13983816; 123456789 and 1234567.5 as typed).
import { expect, test, type Page } from "@playwright/test";
import { entryValue, flick, lastResult, open, tap, useClipboardLock } from "./helpers.ts";

test.use({ permissions: ["clipboard-read", "clipboard-write"] });
test.describe.configure({ mode: "serial" });
useClipboardLock();
const done = (page: Page, n: number) => expect(page.locator('[data-status="done"]')).toHaveCount(n);

test.beforeEach(async ({ page }) => {
  await open(page, "");
  await page.waitForFunction(() => window.pascaline.session.engineState === "ready", undefined, { timeout: 20_000 });
});

test("a 12-digit result is drawn in groups; the text, the chip and ×3 stay plain (1/3 × 3 = 1)", async ({ page }) => {
  await tap(page, ["d1", "div", "d3", "enter"]);
  await done(page, 1);
  await expect(lastResult(page)).toHaveAttribute("data-text", "0.333333333333");
  await expect(lastResult(page).locator(".math")).toHaveAttribute("data-latex", "0.333\\,333\\,333\\,333");
  await lastResult(page).tap();
  const v = await entryValue(page);
  expect(v).toContain("\\res");
  expect(v).not.toContain("\\,"); // the chip's shown text is the plain digits
  await tap(page, ["mul", "d3", "enter"]);
  await done(page, 2);
  await expect(lastResult(page)).toHaveAttribute("data-text", "1");
  await expect(page.getByTestId("mark").last()).toHaveText("=");
});

test("a long integer is grouped from the right; a short one and a small exponent form are not", async ({ page }) => {
  await tap(page, ["d1", "d3", "d9", "d8", "d3", "d8", "d1", "d6", "enter"]);
  await done(page, 1);
  await expect(lastResult(page)).toHaveAttribute("data-text", "13983816");
  await expect(lastResult(page).locator(".math")).toHaveAttribute("data-latex", "13\\,983\\,816");
  await tap(page, ["d1", "d2", "d3", "d4", "enter"]);
  await done(page, 2);
  await expect(lastResult(page).locator(".math")).toHaveAttribute("data-latex", "1234");
});

test("Copy gives the plain digits of a grouped result", async ({ page }) => {
  await tap(page, ["d1", "div", "d3", "enter"]);
  await done(page, 1);
  await tap(page, ["copy"]);
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe("0." + "3".repeat(40));
});

// ---- R125: the separator setting

const NINE = ["d1", "d2", "d3", "d4", "d5", "d6", "d7", "d8", "d9"];
const groupsRow = (page: Page) => page.getByTestId("menu").locator('[data-id="groups"]');
/** Settings › Numbers (Mode's row 6, then section 2), as a user opens it. */
async function numbers(page: Page): Promise<void> {
  await page.getByTestId("chip-format").tap();
  await tap(page, ["d6", "d2"]);
  await expect(page.getByTestId("sheet-title")).toHaveText("Mode › Settings › Numbers");
}

test("Settings › Numbers › Digit groups › ’: 123456789 is drawn 123’456’789; Copy, the entry line and a chip have no groups", async ({ page }) => {
  await numbers(page);
  await expect(groupsRow(page).locator(".opt")).toHaveText(["1\u2009234", "1’234", "1,234"]);
  await expect(groupsRow(page).locator('[data-option="thin"]')).toHaveAttribute("aria-pressed", "true");
  await groupsRow(page).locator('[data-option="apos"]').tap();
  await expect(page.getByTestId("menu")).toBeHidden(); // a button closes the sheet (R86)
  await tap(page, [...NINE, "enter"]);
  await done(page, 1);
  await expect(lastResult(page)).toHaveAttribute("data-text", "123456789");
  await expect(lastResult(page).locator(".math")).toHaveAttribute("data-latex", "123\\text{'}456\\text{'}789");
  await expect(lastResult(page).locator(".math")).toHaveText("123’456’789");
  await tap(page, ["copy"]);
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe("123456789");
  await lastResult(page).tap();
  const v = await entryValue(page);
  expect(v).toContain("\\res");
  expect(v).not.toMatch(/'|’|\\,/); // the chip's shown text is the plain digits
});

test("R125f1: with ’ or , only the digits before the point are grouped on Home; the thin space groups both sides", async ({ page }) => {
  const PI = ["d3", "dot", "d1", "d4", "d1", "d5", "d9", "d2", "d6", "d5", "d3", "d5", "d9", "enter"];
  const BIG = ["d1", "d2", "d3", "d4", "d5", "d6", "d7", "dot", "d8", "d9", "d1", "d2", "d3", "enter"];
  const cases: [string, string, string][] = [
    ["comma", "3.14159265359", "1{,}234{,}567.89123"],
    ["apos", "3.14159265359", "1\\text{'}234\\text{'}567.89123"],
    ["thin", "3.141\\,592\\,653\\,59", "1\\,234\\,567.891\\,23"],
  ];
  let n = 0;
  for (const [sep, pi, big] of cases) {
    await page.evaluate((v) => (window.pascaline.session.settings.groupSep = v as "thin"), sep);
    await tap(page, PI);
    await done(page, ++n);
    await expect(lastResult(page).locator(".math")).toHaveAttribute("data-latex", pi);
    await tap(page, BIG);
    await done(page, ++n);
    await expect(lastResult(page).locator(".math")).toHaveAttribute("data-latex", big);
    await expect(lastResult(page)).toHaveAttribute("data-text", "1234567.89123");
  }
});

test("CAS draws the separator too, and the comma with the point", async ({ page }) => {
  await page.evaluate(() => {
    window.pascaline.session.settings.groupSep = "comma";
    window.pascaline.session.setView("cas");
  });
  await page.evaluate(() => window.pascaline.session.submit("\\operatorname{evalf}\\left(\\frac{123456789}{100}\\right)"));
  await done(page, 1);
  await expect(lastResult(page).locator(".math")).toHaveAttribute("data-latex", "1{,}234{,}567.89");
  await expect(lastResult(page)).toHaveAttribute("data-text", "1234567.89");
});

test("the unit view draws the separator (R120's path); its Copy text has none", async ({ page }) => {
  await page.evaluate(() => (window.pascaline.session.settings.groupSep = "apos"));
  await tap(page, ["d2", "mul", "shift", "d3", "mul", "d2", "d5"]);
  await flick(page, "tmpl", "up");
  await page.waitForFunction(() => window.pascaline.unitView !== undefined && document.querySelector('[data-pad="unit"]') !== null);
  await flick(page, "enter", "up");
  await expect(page.getByTestId("unit-result").locator(".value")).toHaveText("157.079632679");
  await expect(page.getByTestId("unit-result")).toHaveAttribute("data-text", "157.079632679");
});

test("under the decimal comma the comma is never a separator: its button is off with the reason, a stored comma draws as the thin space", async ({ page }) => {
  await page.evaluate(() => {
    window.pascaline.session.settings.groupSep = "comma";
    window.pascaline.session.setDecimalMark("comma");
  });
  await tap(page, ["d1", "d2", "d3", "d4", "d5", "d6", "d7", "dot", "d5", "enter"]);
  await done(page, 1);
  await expect(lastResult(page).locator(".math")).toHaveAttribute("data-latex", "1\\,234\\,567{,}5");
  await expect(lastResult(page)).toHaveAttribute("data-text", "1234567,5");
  await numbers(page);
  await expect(groupsRow(page).locator('[data-option="comma"]')).toBeDisabled();
  await expect(groupsRow(page).locator('[data-option="thin"]')).toHaveAttribute("aria-pressed", "true");
  await expect(groupsRow(page).getByTestId("row-hint")).toHaveText("Not the comma: the decimal mark is the comma");
  expect(await page.evaluate(() => window.pascaline.session.settings.groupSep)).toBe("comma"); // nothing stored silently
});

test("the setting survives a relaunch, goes into a preset and into a backup", async ({ page }) => {
  await page.evaluate(() => {
    window.pascaline.session.settings.groupSep = "apos";
    window.pascaline.session.save();
  });
  await page.waitForTimeout(900); // the writes are debounced and asynchronous
  await page.reload();
  await page.waitForFunction(() => window.pascaline !== undefined);
  await page.evaluate(() => window.pascaline.entry.ready);
  expect(await page.evaluate(() => window.pascaline.session.settings.groupSep)).toBe("apos");
  const after = await page.evaluate(async (path) => {
    const { session, userKeys } = window.pascaline;
    const presets = await ((await import(/* @vite-ignore */ path)) as typeof import("../src/views/modeSheet.ts")).presetsFor(session, userKeys);
    const id = presets.capture("Swiss", ["numbers"]);
    session.settings.groupSep = "thin";
    await presets.apply(id);
    return { held: presets.list[0]?.groups.numbers?.["groupSep"], now: session.settings.groupSep };
  }, "/src/views/modeSheet.ts");
  expect(after).toEqual({ held: "apos", now: "apos" });
  await page.waitForTimeout(900); // the apply's write
  const backup = await page.evaluate(
    async ([b, raw]) => {
      const { makeBackup } = (await import(/* @vite-ignore */ b)) as typeof import("../src/state/backup.ts");
      const { kvGetRaw } = (await import(/* @vite-ignore */ raw)) as typeof import("../src/state/storageRaw.ts");
      return (await makeBackup(kvGetRaw, new Date())).parts["settings"]?.value as { groupSep?: string } | undefined;
    },
    ["/src/state/backup.ts", "/src/state/storageRaw.ts"] as const,
  );
  expect(backup?.groupSep).toBe("apos");
});

test("Solve's Num view draws the separator: the root of x=123456789 is 123’456’789; data-value and Copy stay plain", async ({ page }) => {
  await page.evaluate(() => (window.pascaline.session.settings.groupSep = "apos"));
  await tap(page, ["@place", "d4", "@symb"]);
  await expect(page.getByTestId("entry-label")).toHaveText("E1:");
  await tap(page, ["x", "shift", "dot", ...NINE, "enter"]);
  await tap(page, ["@num"]);
  const x = page.locator('[data-testid="solve-table"] tr[data-name="x"] td');
  await expect(x).toBeVisible();
  await tap(page, ["@menu", "d1"]); // Solve
  await expect(x).toHaveAttribute("data-value", "123456789");
  await expect(x).toHaveText("123’456’789");
  await tap(page, ["copy"]);
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe("123456789");
  await page.evaluate(() => (window.pascaline.session.settings.groupSep = "thin")); // the default: a gap, not a character
  await expect(x).toHaveText("123456789");
  await expect(x.locator(".gsep")).toHaveCount(2);
});

test("Function's Num cells draw the separator: x·1000000 at x = 0.1 is 100’000; data-text stays plain", async ({ page }) => {
  await page.evaluate(() => (window.pascaline.session.settings.groupSep = "apos"));
  await tap(page, ["@symb"]);
  await expect(page.getByTestId("entry-label")).toHaveText("F1(x)=");
  await tap(page, ["x", "mul", "d1", "d0", "d0", "d0", "d0", "d0", "d0", "enter"]);
  await tap(page, ["@num"]);
  const row = page.locator('[data-testid="num-table"] tbody tr').nth(1); // the start 0, the step 0.1 (function.spec.ts)
  await expect(row.locator("td.x")).toHaveText("0.1");
  const cell = row.locator("td").nth(1);
  await expect(cell).toHaveAttribute("data-text", "100000");
  await expect(cell).toHaveText("100’000");
  await page.evaluate(() => {
    window.pascaline.session.settings.groupSep = "comma";
    window.pascaline.session.setDecimalMark("comma"); // a stored comma under the decimal comma: the thin space
  });
  await expect(cell).toHaveText("100000");
  await expect(cell.locator(".gsep")).toHaveCount(1);
});
