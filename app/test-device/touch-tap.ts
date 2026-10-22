// SPDX-License-Identifier: GPL-3.0-or-later
// A32: a page attached over adb has no touch context, so Playwright's locator.tap() refuses. This gives the locator a tap
// that sends the same touch the finger would, through the WebView's own input path (CDP Input.dispatchTouchEvent, as
// test/helpers.ts's `touch` does): touchStart and touchEnd at the element's centre.
import type { CDPSession, Locator, Page } from "@playwright/test";

const sessions = new WeakMap<Page, Promise<CDPSession>>();
const cdpOf = (page: Page): Promise<CDPSession> => {
  let s = sessions.get(page);
  if (!s) {
    s = page.context().newCDPSession(page);
    sessions.set(page, s);
  }
  return s;
};

// a status-line control opens a lazily loaded sheet (the Apps sheet took 200-800 ms on the Fairphone 6); a key waits less
const SETTLE_KEY_MS = 150;
const SETTLE_SHEET_MS = 800;
const opensSheet = async (l: Locator): Promise<boolean> =>
  /^(place|menu-button|chip-.*)$/.test((await l.first().getAttribute("data-testid", { timeout: 1000 }).catch(() => null)) ?? "");

type TapOptions = { timeout?: number };

export function installTouchTap(page: Page): void {
  const proto = Object.getPrototypeOf(page.locator("body")) as { tap: (this: Locator, o?: TapOptions) => Promise<void>; __touchTap?: true };
  if (proto.__touchTap) return;
  proto.__touchTap = true;
  proto.tap = async function (this: Locator, o: TapOptions = {}): Promise<void> {
    const timeout = o.timeout ?? 10_000;
    const sheet = await opensSheet(this);
    await this.scrollIntoViewIfNeeded({ timeout });
    const box = await this.boundingBox({ timeout });
    if (!box) throw new Error("locator.tap: element has no box");
    const pg = this.page();
    const cdp = await cdpOf(pg);
    const at = [{ x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height / 2), id: 1 }];
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: at });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    // Playwright's own tap returns after the page has reacted; over this route the next call can arrive before a lazily
    // loaded sheet (Apps, Tmpl) is up, and a key pressed meanwhile is typed into the line instead (found on the Fairphone 6)
    await pg.waitForTimeout(sheet ? SETTLE_SHEET_MS : SETTLE_KEY_MS);
  };
}
