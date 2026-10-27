// SPDX-License-Identifier: GPL-3.0-or-later
// R82 (F110): c46 (Function, F1 = x²−2, Plot, Menu, 1 Root) at phone sizes; the Root answer must be on screen and
// uncovered, the check core-lib's `text` expects make. The Fairphone 6 is 372×828 CSS px at DPR 3; the Pixel 7 the
// e2e default. "short" is the Fairphone's width on less height (bars, a larger font scale): there the stage above the
// keypad was squeezed below the readout's height, the board shrank to 0 and the keypad covered the readout (phase-1).
import { expect, test } from "@playwright/test";
import { loadCore, replay, seen, start } from "./core-lib.ts";

const c46 = loadCore().find((c) => c.id === "c46");
const SIZES = [
  ["Fairphone 6", 372, 828],
  ["Pixel 7", 412, 915],
  ["Fairphone 6 width, short", 372, 560],
] as const;

for (const [name, width, height] of SIZES)
  test(`c46's Root answer is on screen and uncovered at ${name} (${width}×${height})`, async ({ browser }) => {
    if (!c46) throw new Error("c46 is not in core.yaml");
    const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    try {
      await start(page);
      await replay(page, c46.keys);
      const sel = '[data-testid="readout-x"]';
      await expect(page.locator(sel)).toHaveText("1.41421356237");
      await expect.poll(() => seen(page, sel), { message: `c46 ${sel} at ${width}×${height}`, timeout: 2000 }).toBe("");
      // the column fits the screen: nothing scrolls, the keypad's last row ends on screen and is uncovered (audit, run 268)
      const fit = await page.evaluate(() => {
        const keys = document.querySelector(".keys")?.getBoundingClientRect();
        const last = [...document.querySelectorAll(".keys [data-key]")].at(-1);
        const r = last?.getBoundingClientRect();
        const hit = r ? document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) : null;
        return {
          scroll: (document.scrollingElement?.scrollHeight ?? 0) - innerHeight,
          keysBottom: (keys?.bottom ?? Infinity) - innerHeight,
          lastRowUncovered: !!(last && hit && (hit === last || last.contains(hit))),
        };
      });
      expect(fit.scroll, `c46 page scrolls at ${width}×${height}`).toBe(0);
      expect(fit.keysBottom, `c46 .keys bottom past the screen at ${width}×${height}`).toBeLessThanOrEqual(0);
      expect(fit.lastRowUncovered, `c46 keypad's last row covered at ${width}×${height}`).toBe(true);
    } finally {
      await ctx.close();
    }
  });

// R82f1 (F117): Plot's ☰ at the Fairphone's size. Every entry is on screen and uncovered without scrolling at 372×828
// and at 372×767 (the WebView's height there, bars taken off: CORE DEVICE's log); on the short screen each one is
// reachable: on screen, or the count cue shown and scrolled to. Phase-1 cut Settings, the ninth row, by 3 px at both.
const MENU_SIZES = [
  ["Fairphone 6", 372, 828, true],
  ["Fairphone 6 WebView", 372, 767, true],
  ["Fairphone 6 width, short", 372, 560, false],
] as const;
for (const [name, width, height, all] of MENU_SIZES)
  test(`Plot's Menu entries are all ${all ? "on screen" : "reachable"} at ${name} (${width}×${height})`, async ({ browser }) => {
    if (!c46) throw new Error("c46 is not in core.yaml");
    const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    try {
      await start(page);
      await replay(page, c46.keys.slice(0, c46.keys.indexOf("@menu") + 1));
      const rows = page.locator('[data-testid="menu"] .row[data-id]');
      await expect(rows.first()).toBeVisible();
      const ids = await rows.evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset["id"] ?? ""));
      expect(ids.slice(0, 2), "the Menu's first rows").toEqual(["root", "extremum"]);
      const cue = page.getByTestId("sheet-count");
      if (all) await expect(cue, `no scroll cue at ${width}×${height}`).toHaveCount(0);
      for (const id of ids) {
        const sel = `[data-testid="menu"] .row[data-id="${id}"]`;
        if (!all && (await seen(page, sel)) !== "") {
          await expect(cue, `${id} is cut, so the cue shows`).toBeVisible();
          await page.locator(sel).evaluate((e) => e.scrollIntoView({ block: "nearest" }));
        }
        await expect.poll(() => seen(page, sel), { message: `Menu row ${id} at ${width}×${height}`, timeout: 2000 }).toBe("");
      }
    } finally {
      await ctx.close();
    }
  });
