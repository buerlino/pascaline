// SPDX-License-Identifier: GPL-3.0-or-later
// R135 (F71): CAS Σ_{k=1}^{2000} cos(k)/k answers with an exact sum of 2000 cosines over one common denominator (text
// 1,749,440 characters, LaTeX 1,773,448 on the engine build of 2026-11-05). MathLive cannot draw it (its SSR build took 2.5 s
// and overflowed the stack), and the row showed the LaTeX source. Now the row is a drawn note, and Copy holds the whole text.
import { expect, test } from "@playwright/test";
import { open, tap, tapTwice, useClipboardLock } from "./helpers.ts";

test.use({ permissions: ["clipboard-read", "clipboard-write"] });
test.describe.configure({ mode: "serial" });
useClipboardLock();

test("CAS Σ cos(k)/k to 2000: a drawn note, no LaTeX source, and Copy still holds the whole text", async ({ page }) => {
  test.setTimeout(120_000);
  await open(page, "");
  await page.waitForFunction(() => window.n62.session.engineState === "ready", undefined, { timeout: 20_000 });
  await tap(page, ["@cas"]);
  await expect(page.getByTestId("place")).toHaveAttribute("data-view", "cas");
  await page.evaluate(() => window.n62.entry.run({ kind: "insert", latex: "\\sum_{k=1}^{2000}\\frac{\\cos\\left(k\\right)}{k}" }));
  await tap(page, ["enter"]);
  const row = page.locator('[data-testid="result"]').last();
  await expect(row.locator(".math")).toContainText("Too long to draw", { timeout: 60_000 });
  const html = await row.innerHTML();
  expect(html).not.toContain("\\frac");
  expect(html.length).toBeLessThan(2000);
  await expect(row.locator(".math")).toHaveAttribute("role", "math");
  await expect(row.locator(".math")).not.toHaveAttribute("data-latex", /.+/);
  await tap(page, ["copy"]);
  await expect(page.getByTestId("notice")).toBeVisible({ timeout: 10_000 });
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText().then((s) => s.length)), { timeout: 10_000 }).toBeGreaterThan(0);
  const text = await page.evaluate(() => navigator.clipboard.readText());
  expect(text.length).toBeGreaterThan(1_700_000); // what Copy copies on phase-1: the full text (1,749,440 characters)
  expect(text.length).toBeLessThan(1_800_000);
  // R135f2: the tap on the result puts nothing on the line (its 1.77 MB of LaTeX overflowed MathLive's stack)
  const line = (): Promise<string> => page.evaluate(() => window.n62.entry.value);
  await tapTwice(row.locator("button.result"), "click"); // R147: the first tap picks the row
  await expect(page.getByTestId("notice")).toHaveText("Too long to insert: Copy holds it");
  const after = await line();
  expect(after).toBe("");
  expect(after.length).toBeLessThan(100);
});
