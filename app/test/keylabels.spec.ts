// SPDX-License-Identifier: GPL-3.0-or-later
// R41: the keys and the sheets have names for a screen reader (TalkBack): an aria-label per key and layer, the other layers
// in the aria-description, no unnamed button in the accessibility snapshot of the keypad and of each sheet.
import { expect, test, type Page } from "@playwright/test";
import { open, tap } from "./helpers.ts";

const key = (page: Page, id: string) => page.locator(`.pad [data-key="${id}"]`);
/** The lazy names are in (they load after the first paint). */
const named = (page: Page) => expect(key(page, "sin")).toHaveAttribute("aria-label", "sine");

/** Lines of an accessibility snapshot that are a button without a name. */
const unnamed = (snapshot: string): string[] => snapshot.split("\n").filter((l) => /^\s*- button(\s*\[[^\]]*\])*\s*:?\s*$/.test(l));

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 412, height: 915 });
  await open(page);
  await named(page);
});

test("a key is named in words, with its Shift and Alpha layers in the description", async ({ page }) => {
  await expect(key(page, "sin")).toHaveAttribute("aria-description", "Shift: arc sine. Alpha: G");
  await expect(key(page, "div")).toHaveAttribute("aria-description", /Shift: x to the minus one/);
  await expect(key(page, "emark")).toHaveAttribute("aria-label", "E for the exponent");
  await expect(key(page, "shift")).toHaveAttribute("aria-label", "Shift");
  await expect(key(page, "alpha")).toHaveAttribute("aria-label", "Alpha");
});

test("the label follows the layer: Shift on, sin is arc sine", async ({ page }) => {
  await tap(page, ["shift"]);
  await expect(key(page, "sin")).toHaveAttribute("aria-label", "arc sine");
  await expect(key(page, "sin")).toHaveAttribute("aria-description", "Alpha: G");
  await page.evaluate(() => window.n62.session.clearModifiers());
  await expect(key(page, "sin")).toHaveAttribute("aria-label", "sine");
});

test("every key has a label and the keypad's accessibility snapshot has no unnamed button", async ({ page }) => {
  const labels = await page.locator(".pad button.key").evaluateAll((els) => els.map((e) => [e.getAttribute("data-key"), e.getAttribute("aria-label")]));
  expect(labels.length).toBeGreaterThan(50);
  expect(labels.filter(([, l]) => !l)).toEqual([]);
  const snap = await page.locator(".pad").ariaSnapshot();
  expect(snap).toContain('button "sine"');
  expect(unnamed(snap)).toEqual([]);
});

test("the labels hold in the CAS view: Alpha types lower case there", async ({ page }) => {
  await tap(page, ["@cas"]);
  await expect(key(page, "sin")).toHaveAttribute("aria-description", "Shift: arc sine. Alpha: g");
});

// Every pick sheet, as fit.spec.ts opens them
const SHEETS: [string, (p: Page) => Promise<void>][] = [
  ["apps", (p) => tap(p, ["@place"])],
  ["home menu", (p) => tap(p, ["@menu"])],
  ["mode", (p) => tap(p, ["@mode"])],
  ["settings", (p) => tap(p, ["@mode", "d6"])],
  ["tmpl", (p) => tap(p, ["tmpl"])],
  ["shift 6", (p) => tap(p, ["shift", "d6"])],
  ["shift 9", (p) => tap(p, ["shift", "d9"])],
];
for (const [name, openIt] of SHEETS)
  test(`the ${name} sheet has no unnamed button`, async ({ page }) => {
    await openIt(page);
    await expect(page.locator('[role="menu"]')).toBeVisible();
    const snap = await page.locator('[role="menu"]').ariaSnapshot();
    expect(snap).toContain("button");
    expect(unnamed(snap)).toEqual([]);
    // and the keys under the open sheet stay named
    await expect(key(page, "sin")).toHaveAttribute("aria-label", /.+/);
  });
