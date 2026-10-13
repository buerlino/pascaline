// SPDX-License-Identifier: GPL-3.0-or-later
import type { Page } from "@playwright/test";

/** Tap keys by their id in spec/keyboard.yaml (d0..d9, div, frac, shift, enter, ...). */
export async function tap(page: Page, ids: string[]): Promise<void> {
  for (const id of ids) await page.locator(`[data-key="${id}"]`).tap();
}

export const entryValue = (page: Page): Promise<string> => page.evaluate(() => window.pascaline.entry.value);

export async function open(page: Page, query = "engine=fake"): Promise<void> {
  await page.goto(`/?${query}`);
  await page.waitForFunction(() => customElements.get("math-field") !== undefined && window.pascaline !== undefined);
  await page.evaluate(() => window.pascaline.entry.ready);
  await page.waitForTimeout(150);
}

/**
 * One finger on a key (K5): synthetic touch events through CDP (`Input.dispatchTouchEvent`), since `locator.tap`
 * only taps. `move` slides the finger to an offset (CSS px) from the key's centre, in `steps` moves; `end` lifts it.
 */
export async function touch(
  page: Page,
  id: string,
): Promise<{
  move: (dx: number, dy: number, steps?: number) => Promise<void>;
  end: () => Promise<void>;
  cancel: () => Promise<void>;
}> {
  const box = await page.locator(`[data-key="${id}"]`).boundingBox();
  if (!box) throw new Error(`key ${id} is not visible`);
  const x0 = box.x + box.width / 2;
  const y0 = box.y + box.height / 2;
  const cdp = await page.context().newCDPSession(page);
  const at = (x: number, y: number) => [{ x: Math.round(x0 + x), y: Math.round(y0 + y), id: 1 }];
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: at(0, 0) });
  let cx = 0;
  let cy = 0;
  return {
    async move(dx, dy, steps = 6) {
      const fx = cx;
      const fy = cy;
      for (let i = 1; i <= steps; i++) {
        cx = fx + ((dx - fx) * i) / steps;
        cy = fy + ((dy - fy) * i) / steps;
        await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: at(cx, cy) });
      }
    },
    async end() {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await cdp.detach();
    },
    /** The browser takes the touch away (a scroll, a system gesture): pointercancel instead of a lift. */
    async cancel() {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });
      await cdp.detach();
    },
  };
}

/**
 * Two fingers: the first goes down on key `a` and stays, then a second comes down on key `b`; `end` lifts both
 * (second, then first). The first finger can be held (`page.waitForTimeout`) before `second` is called.
 */
export async function twoFingers(
  page: Page,
  a: string,
  b: string,
): Promise<{ second: () => Promise<void>; end: () => Promise<void> }> {
  const centre = async (id: string): Promise<{ x: number; y: number }> => {
    const box = await page.locator(`[data-key="${id}"]`).boundingBox();
    if (!box) throw new Error(`key ${id} is not visible`);
    return { x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height / 2) };
  };
  const p1 = { ...(await centre(a)), id: 1 };
  const p2 = { ...(await centre(b)), id: 2 };
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [p1] });
  return {
    async second() {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [p1, p2] });
    },
    async end() {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [p1] });
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await cdp.detach();
    },
  };
}

/** Drag from a key's centre by (dx, dy) and lift. */
export async function drag(page: Page, id: string, dx: number, dy: number): Promise<void> {
  const f = await touch(page, id);
  await f.move(dx, dy);
  await f.end();
}

/** Flick a key up (its shift layer) or down (its letter): a 40 px slide, then lift (R9; FlickTracker arms at 20 px). */
export const flick = (page: Page, id: string, dir: "up" | "down"): Promise<void> => drag(page, id, 0, dir === "up" ? -40 : 40);

/** Record navigator.vibrate calls (call before `open`); read them with `vibrations`. */
export async function recordVibrations(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const calls: unknown[] = [];
    (window as unknown as { __vib: unknown[] }).__vib = calls;
    Object.defineProperty(navigator, "vibrate", { configurable: true, value: (p: unknown) => (calls.push(p), true) });
  });
}
export const vibrations = (page: Page): Promise<unknown[]> => page.evaluate(() => (window as unknown as { __vib: unknown[] }).__vib);
