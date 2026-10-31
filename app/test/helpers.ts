// SPDX-License-Identifier: GPL-3.0-or-later
import { linkSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { test, type Page } from "@playwright/test";

/** The status line's controls (R15c1, R15c2), for keys that left the cluster: `@place` (the place name, the Apps
 *  sheet), `@menu` (☰), `@symb` / `@plot` / `@num` (the view tab; from Home or CAS the last app is opened first from the
 *  Apps sheet, as the old view keys did), `@home` and `@cas` (the Apps sheet's first two rows), `@mode` (the Mode
 *  sheet on its Angle row, as Shift + Apps opened it before R15c2: the format chip, then ▲). */
async function statusTap(page: Page, id: string): Promise<void> {
  const apps = page.getByTestId("apps");
  const fromApps = async (row: string): Promise<void> => {
    if (!(await apps.isVisible())) await page.getByTestId("place").tap();
    await apps.locator(`[role="menuitem"][data-id="${row}"]`).tap();
  };
  if (id === "@place") return page.getByTestId("place").tap();
  if (id === "@menu") return page.getByTestId("menu-button").tap();
  if (id === "@home" || id === "@cas") return fromApps(id.slice(1));
  if (id === "@mode") {
    await page.getByTestId("chip-format").tap();
    await page.getByTestId("menu").getByRole("menuitem").first().waitFor();
    return tap(page, ["up"]);
  }
  const view = id.slice(1);
  if (!["symb", "plot", "num"].includes(view)) throw new Error(`no status-line control ${id}`);
  const inApp = await page.evaluate(() => window.pascaline.shell.app !== null);
  if (!inApp) await fromApps(await page.evaluate(() => window.pascaline.shell.lastApp ?? "function"));
  await page.getByTestId(`tab-${view}`).tap();
}

/**
 * Tap keys by their id in spec/keyboard.yaml (d0..d9, div, frac, shift, enter, ...). A key under an open pick sheet
 * (R21a: the sheet is drawn over the maths rows, Settings too since R49) cannot be touched: the sheet's row or cell is where it was, and
 * fit.spec.ts taps those. Its key path stays for a hardware keyboard (docs/05 2 rule 1), so such a key is pressed the
 * way a hardware key is (R31: the keypad key with that character), in the current Shift/Alpha state. An id that
 * starts with `@` is a status-line control (statusTap).
 */
export async function tap(page: Page, ids: string[]): Promise<void> {
  const covered = (id: string): Promise<boolean> =>
    page.evaluate((id) => {
      const k = document.querySelector(`[data-key="${id}"]`);
      if (!k) return false;
      const r = k.getBoundingClientRect();
      const el = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return el !== null && !k.contains(el) && el.closest('[role="menu"]') !== null;
    }, id);
  const press = (id: string): Promise<void> => page.evaluate((id) => window.pascaline.entry.onKey(id, undefined as never, false), id);
  for (const id of ids) {
    if (id.startsWith("@")) {
      await statusTap(page, id);
      continue;
    }
    if (await covered(id)) {
      await press(id);
      continue;
    }
    try {
      await page.locator(`[data-key="${id}"]`).tap({ timeout: 3000 });
    } catch (e) {
      // a sheet whose code was still loading (the Mode sheet, R35) rose over the key meanwhile
      if (!(await covered(id))) throw e;
      await press(id);
    }
  }
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
  // a key id, or a CSS selector (starting with "[") for a surface that is not a key (the pad's hub, R15c2)
  const box = await page.locator(id.startsWith("[") ? id : `[data-key="${id}"]`).boundingBox();
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

// R74f1: the system clipboard is one for every Playwright worker, so a test that writes or reads it holds this lock
// (an exclusive lock file under test-results, holding its owner's pid and a nonce) for its whole run. A lock whose
// owner process is dead (a killed worker) is taken over; a live owner is never overridden, however long it holds.
const LOCK = resolve("test-results", "clipboard.lock");

const alive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === "EPERM";
  }
};

/** Wait for the clipboard lock and take it; returns the release function (safe to call twice; it removes only its own
 *  file). Throws once `timeoutMs` has passed without the lock, so a late acquisition never happens after the caller gave up. */
export async function acquireClipboardLock(timeoutMs = 120_000): Promise<() => void> {
  mkdirSync(dirname(LOCK), { recursive: true });
  const deadline = Date.now() + timeoutMs;
  const token = `${process.pid} ${Math.random().toString(36).slice(2)}`;
  for (;;) {
    try {
      writeFileSync(LOCK, token, { flag: "wx" });
      return () => {
        try {
          if (readFileSync(LOCK, "utf8") === token) rmSync(LOCK, { force: true });
        } catch {
          /* already gone */
        }
      };
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
      try {
        const pid = Number.parseInt(readFileSync(LOCK, "utf8"), 10);
        if (Number.isInteger(pid) && !alive(pid)) takeOverDead(pid);
      } catch {
        /* released meanwhile */
      }
      if (Date.now() >= deadline) throw new Error(`clipboard lock not free after ${timeoutMs} ms`);
      await new Promise((r) => setTimeout(r, 50 + Math.random() * 50));
    }
  }
}

/** Remove a lock whose owner `pid` is dead: rename it away (only one waiter gets the file) and, if it turns out to
 *  belong to a live process after all, link it back. */
function takeOverDead(pid: number): void {
  const mine = `${LOCK}.dead-${process.pid}-${Math.random().toString(36).slice(2)}`;
  renameSync(LOCK, mine);
  try {
    if (Number.parseInt(readFileSync(mine, "utf8"), 10) !== pid) linkSync(mine, LOCK);
  } catch {
    /* nothing to restore */
  } finally {
    rmSync(mine, { force: true });
  }
}

/** Run `fn` holding the clipboard lock; the lock is released in a finally block. */
export async function withClipboardLock<T>(fn: () => Promise<T>): Promise<T> {
  const release = await acquireClipboardLock();
  try {
    return await fn();
  } finally {
    release();
  }
}

/** Call at the top of a spec file or describe: every test in it holds the clipboard lock from its first hook to its last. */
export function useClipboardLock(): void {
  let release: (() => void) | undefined;
  test.beforeEach(async () => {
    test.setTimeout(test.info().project.timeout + 150_000); // the wait for the lock must not eat the test's own budget
    release = await acquireClipboardLock(120_000);
  });
  test.afterEach(() => {
    release?.();
    release = undefined;
  });
}
