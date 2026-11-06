// SPDX-License-Identifier: GPL-3.0-or-later
// R114 (F157): Ctrl+V and every system paste (Shift+Insert, the context menu's Paste) go through the Paste key's path
// (clipboard/paste.ts): the comma mode and E notation are known, and anything that is not a number is refused with the
// Paste key's notice. Before, MathLive read the clipboard as maths: in comma mode max( + Ctrl+V of 1,5 gave 5, and
// 1e-3 entered e − 3 with Euler's e. Key sequences on the real engine; expected values are derived (1,5 is one number,
// max of it alone is itself; 1ᴇ-3 = 0,001).
import { expect, test, type Page } from "@playwright/test";
import { entryValue, lastResult, open, setClipboard, useClipboardLock } from "./helpers.ts";

test.use({ permissions: ["clipboard-read", "clipboard-write"] });
// The system clipboard is one for the whole browser: these tests run one after another.
test.describe.configure({ mode: "serial" });

useClipboardLock();

test.beforeEach(async ({ page }) => {
  await open(page, "");
  await page.waitForFunction(() => window.pascaline.session.engineState === "ready", undefined, { timeout: 20_000 });
  await page.evaluate(() => window.pascaline.entry.focus());
});

const comma = (page: Page): Promise<void> => page.evaluate(() => window.pascaline.session.setDecimalMark("comma"));
const resultIs = async (page: Page, text: string): Promise<void> => {
  await expect(page.locator('[data-status="done"]')).toHaveCount(1, { timeout: 15_000 });
  await expect(lastResult(page)).toHaveAttribute("data-text", text);
};
/** max( ) as Find puts it on the line; the cursor is inside the brackets. */
const maxCall = (page: Page): Promise<void> =>
  page.evaluate(() => window.pascaline.entry.run({ kind: "insert", latex: "\\operatorname{max}\\left(#0\\right)" }));

/** The two ways a paste reaches the field: the keys (Ctrl+V), or a `paste` event on the field's focused element, as
 *  Shift+Insert and the context menu's Paste deliver it (with the text in clipboardData, no clipboard read). */
const WAYS = {
  "Ctrl+V": async (page: Page, text: string): Promise<void> => {
    await setClipboard(page, text);
    await page.evaluate(() => window.pascaline.entry.focus());
    await page.keyboard.press("ControlOrMeta+V");
  },
  "a paste event": async (page: Page, text: string): Promise<void> => {
    await page.evaluate((s) => {
      const mf = window.pascaline.entry.field;
      if (!mf) throw new Error("no field");
      mf.focus();
      const target = mf.shadowRoot?.activeElement ?? mf.shadowRoot?.querySelector("textarea") ?? mf;
      const data = new DataTransfer();
      data.setData("text/plain", s);
      target.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true, composed: true }));
    }, text);
  },
} as const;

for (const [way, paste] of Object.entries(WAYS)) {
  test.describe(way, () => {
    test("comma mode: max( then 1,5 then Enter gives 1,5 (it was 5: the comma read as an argument comma)", async ({ page }) => {
      await comma(page);
      await maxCall(page);
      await paste(page, "1,5");
      await expect.poll(() => entryValue(page)).toContain("\\left(1{,}5\\right)");
      await page.keyboard.press("Enter");
      await resultIs(page, "1,5");
    });

    test("comma mode: 1e-3 then Enter gives 0,001 (it was e − 3 with Euler's e)", async ({ page }) => {
      await comma(page);
      await paste(page, "1e-3");
      await expect.poll(() => entryValue(page)).toBe("1\\emark-3");
      await page.keyboard.press("Enter");
      await resultIs(page, "0,001");
    });

    test("point mode: 1.5e-3 enters 1.5ᴇ-3, as the exponent key types it", async ({ page }) => {
      await paste(page, "1.5e-3");
      await expect.poll(() => entryValue(page)).toBe("1.5\\emark-3");
    });

    test("2*x+1 is refused with the Paste key's notice and the line stays as it was", async ({ page }) => {
      await page.keyboard.type("7");
      expect(await entryValue(page)).toBe("7");
      await paste(page, "2*x+1");
      await expect(page.getByTestId("notice")).toHaveText("Paste: not a number");
      expect(await entryValue(page)).toBe("7");
    });
  });
}
