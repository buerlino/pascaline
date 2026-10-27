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
    } finally {
      await ctx.close();
    }
  });
