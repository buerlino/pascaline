// SPDX-License-Identifier: GPL-3.0-or-later
// R40: the digits past what a constant's σ leaves (G26's uncDigits) are drawn muted, the mark stays ≈ and Copy gives
// every digit; a tap on the row shows σ (2 significant digits) and U = 2σ. The constants are the Find index's own
// chips (find/finder.ts putOnLine, as a pick puts them). Expected values are derived: G·5.972ᴇ24 = 3.98589196ᴇ14
// with σ = 1.5ᴇ-15·5.972ᴇ24 = 8.958ᴇ9, so five digits hold (host.test.ts G26); μ₀·ε₀·c² = 1 exactly, σ 0 (G81).
import { expect, test, type Page } from "@playwright/test";
import { open, tap, useClipboardLock } from "./helpers.ts";
import type * as Finder from "../src/find/finder.ts";

test.use({ permissions: ["clipboard-read", "clipboard-write"] });
test.describe.configure({ mode: "serial" });
useClipboardLock();

const done = (page: Page, n: number) => expect(page.locator('[data-status="done"]')).toHaveCount(n);
const lastResult = (page: Page) => page.locator('[data-testid="result"]').last().locator(".result");
const lastMark = (page: Page) => page.getByTestId("mark").last();
const muted = (page: Page) => lastResult(page).locator(".unc");
const digitsOf = (s: string | null): string => (s ?? "").replace(/[^0-9]/g, "");
const ready = (page: Page) => page.waitForFunction(() => window.pascaline.session.engineState === "ready", undefined, { timeout: 20_000 });

/** The Find index's constant `id` on the entry line, as a pick puts it (its value, σ, basis and leaves). */
async function putConst(page: Page, id: string): Promise<void> {
  await page.evaluate(async (cid) => {
    const url = "/src/find/finder.ts";
    const f = (await import(/* @vite-ignore */ url)) as typeof Finder;
    const it = (await f.loadIndex(true)).byId.get(`const:${cid}`);
    if (!it) throw new Error(`no constant ${cid} in the index`);
    f.putOnLine(window.pascaline.entry, it);
  }, id);
}

/** G × 5.972ᴇ24, Enter. */
async function gTimesEarth(page: Page, rows: number): Promise<void> {
  await putConst(page, "G");
  await tap(page, ["mul", "d5", "dot", "d9", "d7", "d2", "emark", "d2", "d4", "enter"]);
  await done(page, rows);
}

test.beforeEach(async ({ page }) => {
  await open(page, "");
  await ready(page);
});

test("G × 5.972ᴇ24: the digits past uncDigits are muted, the mark is ≈, Copy gives every digit; the same cut at 30 digits", async ({ page }) => {
  await gTimesEarth(page, 1);
  await expect(lastMark(page)).toHaveAttribute("data-mark", "≈");
  await expect(lastResult(page)).toHaveAttribute("data-text", "3.98589196E14");
  await expect(muted(page)).toHaveCount(1);
  expect(digitsOf(await muted(page).textContent())).toBe("9196"); // 3.9858 hold: σ's first digit is at 10⁹
  const color = (sel: string) => page.locator(sel).last().evaluate((e) => getComputedStyle(e).color);
  const mutedColor = await page.evaluate(() => {
    const p = document.createElement("p");
    p.style.color = "var(--muted)";
    document.body.append(p);
    const c = getComputedStyle(p).color;
    p.remove();
    return c;
  });
  expect(await color('[data-testid="result"] .result .unc')).toBe(mutedColor);
  await tap(page, ["copy"]);
  await expect(page.getByTestId("notice")).toHaveText("Copied");
  await expect.poll(async () => digitsOf(await page.evaluate(() => navigator.clipboard.readText()))).toMatch(/^398589196/);
  await page.evaluate(() => window.pascaline.session.setDigits(30));
  await gTimesEarth(page, 2);
  await expect(lastMark(page)).toHaveAttribute("data-mark", "≈");
  expect(digitsOf(await muted(page).textContent())).toBe("9196000000"); // 398589196000000: the same five digits hold
});

test("only exact constants (c): no muted digit; μ₀ × ε₀ × c² from chips is 1, ≈, none either, also beside a user's pasl_fine_structure", async ({ page }) => {
  await putConst(page, "c");
  await tap(page, ["mul", "d2", "enter"]);
  await done(page, 1);
  await expect(lastResult(page)).toHaveAttribute("data-text", "599584916");
  await expect(muted(page)).toHaveCount(0);
  const muEpsC2 = async () => {
    const rows = (await page.locator('[data-status="done"]').count()) + 1;
    await putConst(page, "mu_0");
    await tap(page, ["mul"]);
    await putConst(page, "epsilon_0");
    await tap(page, ["mul"]);
    await putConst(page, "c");
    await tap(page, ["sq", "enter"]);
    await done(page, rows);
    await expect(lastResult(page)).toHaveAttribute("data-text", "1");
    await expect(lastMark(page)).toHaveAttribute("data-mark", "≈");
    await expect(muted(page)).toHaveCount(0);
    expect(await page.evaluate(() => window.pascaline.session.home.at(-1)?.facts?.uncDigits)).toBeUndefined();
  };
  await muEpsC2();
  // our leaf names are ours (family 9): a user's variable of the same name changes neither the value nor σ
  await page.evaluate(() => window.pascaline.session.submit("x", "pasl_fine_structure:=5"));
  await expect(page.locator('[data-testid="result"]')).toHaveCount(3);
  await muEpsC2();
});

test("a tap on the row shows its σ line, a second hides it; with Muted digits a tap shows nothing; the setting goes into a preset and survives a relaunch", async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 }); // the presets' sheet, as presetsMode.spec.ts
  await gTimesEarth(page, 1);
  const sigma = page.getByTestId("sigma");
  await expect(sigma).toHaveCount(0);
  await lastMark(page).tap();
  await expect(sigma).toHaveText("σ = 9.0ᴇ9 · U = 2σ = 1.8ᴇ10 (k = 2)"); // 2 × 8.958ᴇ9 = 1.7916ᴇ10
  await lastMark(page).tap();
  await expect(sigma).toHaveCount(0);
  // Settings › Numbers › Uncertainty (row 4): a digit steps the value row to Muted digits
  await tap(page, ["@mode", "d6", "d2", "d4"]);
  await expect(page.getByTestId("menu").locator('[data-id="uncertainty"]').getByTestId("sheet-value")).toHaveText("Muted digits");
  await tap(page, ["esc", "esc", "esc"]);
  await expect(page.getByTestId("menu")).toHaveCount(0);
  await lastMark(page).tap();
  await expect(muted(page)).toHaveCount(1); // the digits stay muted
  await expect(sigma).toHaveCount(0);
  // a preset holds it (Numbers): saved with Muted digits, applied after a change back
  await tap(page, ["@mode", "d5"]);
  await page.getByTestId("menu").locator('[role="menuitem"][data-id="save"]').tap();
  await expect(page.getByTestId("entry-label")).toHaveText("Preset name");
  await tap(page, ["alpha", "emark", "enter"]); // the name "P" (Alpha on the ᴇ key)
  await expect(page.getByTestId("notice")).toHaveText("Saved P");
  await page.evaluate(() => window.pascaline.session.setUncertainty("sigma"));
  await tap(page, ["@mode", "d5"]);
  await page.getByTestId("menu").locator('[role="menuitem"][data-id="p1"]').tap();
  await expect.poll(() => page.evaluate(() => window.pascaline.session.settings.uncertainty)).toBe("muted");
  await page.waitForTimeout(800); // the store write is debounced
  await page.reload();
  await page.waitForFunction(() => window.pascaline !== undefined);
  await ready(page);
  expect(await page.evaluate(() => window.pascaline.session.settings.uncertainty)).toBe("muted");
});
