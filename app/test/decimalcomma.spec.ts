// SPDX-License-Identifier: GPL-3.0-or-later
// R57: the decimal comma as a setting (Settings › Numbers › Decimal mark). In comma mode the . key shows and types the
// comma (MathLive's {,}), the , key shows and types ; (the argument separator), a hardware . or , types the mark, results
// are drawn and copied with the comma, and a pasted 1,5e-3 is a number. Key sequences on the real engine. Expected values
// are derived: 3,5 × 2 = 7, 1,5 ÷ 2 = 0,75, 1,5ᴇ-3 = 0,0015, 3,ᴇ3 = 3.ᴇ3 = 3000.
import { expect, test, type Page } from "@playwright/test";
import { entryValue, open, tap, useClipboardLock } from "./helpers.ts";

test.use({ permissions: ["clipboard-read", "clipboard-write"] });
// The system clipboard is one for the whole browser: these tests run one after another.
test.describe.configure({ mode: "serial" });

useClipboardLock();

test.beforeEach(async ({ page }) => {
  await open(page, "");
  await page.waitForFunction(() => window.pascaline.session.engineState === "ready", undefined, { timeout: 20_000 });
  await page.evaluate(() => window.pascaline.session.setDecimalMark("comma"));
  await page.evaluate(() => window.pascaline.entry.focus());
});

const clipboard = (page: Page): Promise<string> => page.evaluate(() => navigator.clipboard.readText());
const setClipboard = (page: Page, text: string): Promise<void> => page.evaluate((s) => navigator.clipboard.writeText(s), text);
const lastResult = (page: Page) => page.locator('[data-testid="result"]').last().locator(".result");
const resultIs = async (page: Page, text: string, count: number): Promise<void> => {
  // 15 s: a result waits for the engine, which a full e2e run on a loaded machine starts slowly (run 340: 5 s was not enough)
  await expect(page.locator('[data-status="done"]')).toHaveCount(count, { timeout: 15_000 });
  await expect(lastResult(page)).toHaveAttribute("data-text", text);
};
/** max( ) as Find puts it on the line (R4a: a function's name is reached through Find); the cursor is inside the brackets. */
const maxCall = (page: Page): Promise<void> =>
  page.evaluate(() => window.pascaline.entry.run({ kind: "insert", latex: "\\operatorname{max}\\left(#0\\right)" }));
const face = (page: Page, id: string): Promise<string> => page.locator(`[data-key="${id}"] .main`).first().innerText();

test("the faces: . shows , and , shows ; in comma mode; point mode has them as before; the keys do not move", async ({ page }) => {
  const box = async (id: string) => page.locator(`[data-key="${id}"]`).first().boundingBox();
  const before = [await box("dot"), await box("comma")];
  expect((await face(page, "dot")).trim()).toBe(",");
  expect((await face(page, "comma")).trim()).toBe(";");
  expect([await box("dot"), await box("comma")]).toEqual(before);
  await page.evaluate(() => window.pascaline.session.setDecimalMark("point"));
  await expect.poll(async () => (await face(page, "dot")).trim()).toBe(".");
  expect((await face(page, "comma")).trim()).toBe(",");
  expect([await box("dot"), await box("comma")]).toEqual(before);
});

test("3 , 5 × 2 draws 7, and the line holds MathLive's decimal comma", async ({ page }) => {
  await tap(page, ["d3", "dot", "d5", "mul", "d2"]);
  expect(await entryValue(page)).toBe("3{,}5\\times2");
  await tap(page, ["enter"]);
  await resultIs(page, "7", 1);
});

test("1 , 5 ÷ 2 draws 0,75", async ({ page }) => {
  await tap(page, ["d1", "dot", "d5", "div", "d2", "enter"]);
  await resultIs(page, "0,75", 1);
  await expect(lastResult(page)).toContainText("0,75");
});

test("max(1;2) typed with letters and the , key (;) gives 2; a list element is never read as a decimal", async ({ page }) => {
  await maxCall(page);
  await tap(page, ["d1", "comma", "d2"]);
  expect(await entryValue(page)).toMatch(/1;2/);
  await tap(page, ["enter"]);
  await resultIs(page, "2", 1);
});

test("a copied result reads 0,75, and copy → paste gives the value back", async ({ page }) => {
  await tap(page, ["d1", "dot", "d5", "div", "d2", "enter"]);
  await resultIs(page, "0,75", 1);
  await tap(page, ["copy"]);
  await expect.poll(() => clipboard(page)).toBe("0,75");
  await tap(page, ["esc", "shift", "copy"]);
  await expect.poll(() => entryValue(page)).toBe("0{,}75");
  await tap(page, ["mul", "d4", "enter"]);
  await resultIs(page, "3", 2);
});

test("a pasted 1,5e-3 evaluates to 0,0015; a pasted 1.5 is refused", async ({ page }) => {
  await setClipboard(page, "1,5e-3");
  await tap(page, ["shift", "copy"]);
  await expect.poll(() => entryValue(page)).toBe("1{,}5\\emark-3");
  await tap(page, ["enter"]);
  await resultIs(page, "0,0015", 1);
  await setClipboard(page, "1.5");
  await tap(page, ["shift", "copy"]);
  await expect(page.getByTestId("notice")).toHaveText("Paste: not a number");
});

test("selectENumber reads the comma: after a pasted 1,5ᴇ-3, ÷ takes the whole number", async ({ page }) => {
  await setClipboard(page, "1,5e-3");
  await tap(page, ["shift", "copy", "div"]);
  expect(await entryValue(page)).toBe("\\frac{1{,}5\\emark-3}{\\placeholder{}}");
  await tap(page, ["d2", "enter"]);
  await resultIs(page, "0,00075", 1);
});

test("hardware keys: both . and , type the mark, ; separates, e after 3, is the exponent key", async ({ page }) => {
  await page.keyboard.type("3,5*2");
  expect(await entryValue(page)).toBe("3{,}5\\times2");
  await page.keyboard.press("Enter");
  await resultIs(page, "7", 1);
  await page.keyboard.type("3.5*2");
  expect(await entryValue(page)).toBe("3{,}5\\times2");
  await page.keyboard.press("Enter");
  await resultIs(page, "7", 2);
  await maxCall(page);
  await page.keyboard.type("1;2");
  await page.keyboard.press("Enter");
  await resultIs(page, "2", 3);
  await page.keyboard.type("1,5e-3");
  expect(await entryValue(page)).toBe("1{,}5\\emark-3");
});

test("3 , ᴇ 3 types no 1 and gives what 3.ᴇ3 gives in point mode; max(1;ᴇ3) shows 1ᴇ3", async ({ page }) => {
  await tap(page, ["d3", "dot", "emark", "d3"]);
  expect(await entryValue(page)).toBe("3{,}\\emark3");
  await tap(page, ["enter"]);
  await resultIs(page, "3000", 1);
  await page.evaluate(() => window.pascaline.session.setDecimalMark("point"));
  await tap(page, ["d3", "dot", "emark", "d3", "enter"]);
  await resultIs(page, "3000", 2);
  await page.evaluate(() => window.pascaline.session.setDecimalMark("comma"));
  await maxCall(page);
  await tap(page, ["d1", "comma", "emark", "d3"]);
  expect(await entryValue(page)).toMatch(/1;1\\emark3/);
  await tap(page, ["enter"]);
  await resultIs(page, "1000", 3);
});

test("max(1,5) in point mode gives 5; after Settings › Numbers › Decimal mark: Comma, the recalled entry still gives 5 (R57f1: parsing never depends on the mark)", async ({ page }) => {
  await page.evaluate(() => window.pascaline.session.setDecimalMark("point"));
  await maxCall(page);
  await tap(page, ["d1", "comma", "d5"]);
  await tap(page, ["enter"]);
  await resultIs(page, "5", 1);
  await page.getByTestId("chip-format").tap();
  await tap(page, ["d5", "d2"]);
  const mark = page.getByTestId("menu").locator('[role="menuitem"][data-id="mark"]');
  await expect(mark.getByTestId("sheet-value")).toHaveText("Point");
  const active = page.getByTestId("menu").locator('[data-active="true"]');
  for (let n = 0; n < 8 && (await active.getAttribute("data-id")) !== "mark"; n++) await tap(page, ["up"]);
  await expect(active).toHaveAttribute("data-id", "mark");
  await tap(page, ["right"]);
  await expect(mark.getByTestId("sheet-value")).toHaveText("Comma");
  await tap(page, ["esc", "esc", "esc"]);
  await expect(page.getByTestId("menu")).toHaveCount(0);
  expect(await page.evaluate(() => window.pascaline.session.settings.decimalMark)).toBe("comma");
  await tap(page, ["up"]);
  await page.getByTestId("row-actions").getByRole("button", { name: "Recall" }).tap();
  expect(await entryValue(page)).toMatch(/1,5/);
  await tap(page, ["enter"]);
  await resultIs(page, "5", 2);
});
