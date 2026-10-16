// SPDX-License-Identifier: GPL-3.0-or-later
// R9 flicks (docs/decisions.md P7 points 2 and 3, P11): flick up = the key's shift function, flick down = its letter,
// the lock flicks on Shift and Alpha, the bubble and tick, one motion with no wait, two thumbs, the tap counter, and
// keys typed while an app loads keeping their layer. Synthetic touches through CDP, as in gestures.spec.ts.
import { expect, test, type CDPSession, type Page } from "@playwright/test";
import { entryValue, flick, open, recordVibrations, tap, touch, vibrations } from "./helpers.ts";

test.beforeEach(async ({ page }) => {
  await recordVibrations(page);
  await open(page);
  await page.evaluate(() => window.pascaline.session.setHaptics({ on: true }));
});

const bubble = (page: Page) => page.getByTestId("flick-bubble");
const mods = (page: Page) =>
  page.evaluate(() => {
    const s = window.pascaline.session;
    return { shift: s.shift, alpha: s.alpha, shiftLock: s.shiftLock, alphaLock: s.alphaLock, capsLock: s.capsLock };
  });
const taps = (page: Page) => page.evaluate(() => ({ shift: window.pascaline.session.taps.counts.shift, alpha: window.pascaline.session.taps.counts.alpha }));

async function centre(page: Page, id: string): Promise<{ x: number; y: number }> {
  const box = await page.locator(`[data-key="${id}"]`).boundingBox();
  if (!box) throw new Error(`key ${id} is not visible`);
  return { x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height / 2) };
}
const send = (cdp: CDPSession, type: "touchStart" | "touchMove" | "touchEnd", points: { x: number; y: number; id: number }[]) =>
  cdp.send("Input.dispatchTouchEvent", { type, touchPoints: points });

test("flick up types the shift function, flick down the letter (capital); a tap stays the plain key", async ({ page }) => {
  await flick(page, "dot", "up"); // =
  await flick(page, "vars", "down"); // A
  await flick(page, "d5", "down"); // V
  await flick(page, "add", "down"); // ;
  await tap(page, ["d5"]);
  expect(await entryValue(page)).toBe("=AV;5");
  // a flick never changes the Shift/Alpha state
  expect(await mods(page)).toEqual({ shift: false, alpha: false, shiftLock: false, alphaLock: false, capsLock: false });
});

test("a flick in a direction with no function does nothing (the bubble says ✕)", async ({ page }) => {
  const f = await touch(page, "d5"); // 5 has no shift function
  await f.move(0, -35);
  await expect(bubble(page)).toHaveText("✕");
  await expect(bubble(page)).toHaveAttribute("data-none", "true");
  await f.end();
  expect(await entryValue(page)).toBe("");
});

test("the removed layers are dead: ◀ and ▶ have no shift layer, 0 has no quote; the bubble says ✕ and nothing fires (R13)", async ({ page }) => {
  const f = await touch(page, "d0");
  await f.move(0, 35);
  await expect(bubble(page)).toHaveText("✕");
  await f.end();
  await tap(page, ["shift", "left", "shift", "right"]); // |◀ and ▶| are gone: the arrows stay one step
  await tap(page, ["alpha", "d0"]); // alpha does not fall back to 0 either
  expect(await entryValue(page)).toBe("");
  await expect(page.locator('[data-key="left"][data-dead="true"]')).toHaveCount(0); // dim only in the shifted layer
  await tap(page, ["shift"]);
  await expect(page.locator('[data-key="left"]')).toHaveAttribute("data-dead", "true");
  await expect(page.locator('[data-key="right"]')).toHaveAttribute("data-dead", "true");
});

test("a key that does nothing in the open view gives a double haptic: Menu in Symb, Tmpl in Plot, Fmt in an app (R13)", async ({ page }) => {
  await page.evaluate(() => window.pascaline.session.setHaptics({ on: true, ms: 10 }));
  await tap(page, ["symb"]); // the last app (Function) opens on its Symb view
  await expect(page.getByTestId("place")).toContainText("Symb");
  const before = (await vibrations(page)).length;
  await tap(page, ["menu"]);
  await expect.poll(async () => (await vibrations(page)).length - before).toBe(3); // key down + the double
  await tap(page, ["plot"]);
  const b2 = (await vibrations(page)).length;
  await tap(page, ["tmpl"]);
  await expect.poll(async () => (await vibrations(page)).length - b2).toBe(3);
});

test("while sliding, the bubble shows what will fire, with one tick at the threshold; back to the middle cancels", async ({ page }) => {
  const before = (await vibrations(page)).length;
  const f = await touch(page, "dot");
  expect((await vibrations(page)).length - before).toBe(1); // the touch
  await f.move(0, -10, 2); // under the threshold: no bubble, no tick
  await expect(bubble(page)).toHaveCount(0);
  await f.move(0, -35, 3);
  await expect(bubble(page)).toHaveText("=");
  await expect(bubble(page)).toHaveAttribute("data-dir", "up");
  expect((await vibrations(page)).length - before).toBe(2); // + the tick at the threshold
  await f.move(0, 30, 4); // through the middle to the other side: the letter… (dot has none: the plain key's face)
  await expect(bubble(page)).toHaveAttribute("data-dir", "down");
  await f.move(0, 2, 3); // back to the middle
  await expect(bubble(page)).toHaveCount(0);
  await f.end();
  expect(await entryValue(page)).toBe(""); // cancelled: nothing fires
  // the bubble sits above its key
  const g = await touch(page, "d2");
  await g.move(0, 30);
  const [b, k] = [await bubble(page).boundingBox(), await page.locator('[data-key="d2"]').boundingBox()];
  expect(b && k && b.y + b.height <= k.y + 1 && Math.abs(b.x + b.width / 2 - (k.x + k.width / 2)) < 2).toBe(true);
  await expect(bubble(page)).toHaveText("Z");
  await g.end();
  expect(await entryValue(page)).toBe("Z");
});

test("a sideways slip is still the tap; the arrows (trackpad) and ⌫ (repeat) have no flicks", async ({ page }) => {
  const f = await touch(page, "d7");
  await f.move(28, -14);
  await expect(bubble(page)).toHaveCount(0);
  await f.end();
  expect(await entryValue(page)).toBe("7");
  await tap(page, ["d8", "d9"]);
  // ⌫ deletes on touch; sliding up is no Shift ⌫ (Del)
  const b = await touch(page, "bksp");
  await b.move(0, -40);
  await expect(bubble(page)).toHaveCount(0);
  await b.end();
  expect(await entryValue(page)).toBe("78");
  // an arrow slid up is a trackpad drag (steps), never a flick
  await page.evaluate(() => window.pascaline.entry.clear());
  await tap(page, ["d1", "enter", "d2", "enter"]);
  await expect(page.locator('[data-status="done"]')).toHaveCount(2);
  await page.evaluate(() => window.pascaline.entry.clear());
  const a = await touch(page, "right");
  await a.move(0, -30);
  await expect(bubble(page)).toHaveCount(0);
  await a.end();
  await expect(page.locator('[data-selected="true"] .result')).toHaveAttribute("data-text", "1");
});

test("one motion, no wait: touch, slide and lift within 100 ms is a flick (move events start at once)", async ({ page }) => {
  // The page's own event times, not the harness's wall clock (each CDP round trip adds its own wait).
  await page.evaluate(() => {
    const w = window as unknown as { __ptr: [string, number][] };
    w.__ptr = [];
    for (const type of ["pointerdown", "pointermove", "pointerup"])
      document.addEventListener(type, (ev) => void w.__ptr.push([type, ev.timeStamp]), { capture: true });
  });
  const span = () =>
    page.evaluate(() => {
      const w = window as unknown as { __ptr: [string, number][] };
      const ev = w.__ptr;
      w.__ptr = [];
      const down = ev.find(([t]) => t === "pointerdown");
      const up = ev.find(([t]) => t === "pointerup");
      const moved = ev.findIndex(([t]) => t === "pointermove") === 1; // the first event after the touch is a move
      return { ms: down && up ? up[1] - down[1] : Infinity, moved };
    });
  // touch, two moves and the lift, sent without waiting between them (one motion)
  const c = await centre(page, "dot");
  const cdp = await page.context().newCDPSession(page);
  const at = (dy: number) => [{ x: c.x, y: c.y + dy, id: 1 }];
  await Promise.all([send(cdp, "touchStart", at(0)), send(cdp, "touchMove", at(-12)), send(cdp, "touchMove", at(-30)), send(cdp, "touchEnd", [])]);
  const first = await span();
  expect(first.moved).toBe(true);
  expect(first.ms).toBeLessThan(100);
  expect(await entryValue(page)).toBe("=");
  // the same with the very first move already far out (a fast finger): still the flick, down this time
  const v = await centre(page, "vars");
  await Promise.all([
    send(cdp, "touchStart", [{ ...v, id: 1 }]),
    send(cdp, "touchMove", [{ x: v.x, y: v.y + 40, id: 1 }]),
    send(cdp, "touchEnd", []),
  ]);
  const second = await span();
  await cdp.detach();
  expect(second.moved).toBe(true);
  expect(second.ms).toBeLessThan(100);
  expect(await entryValue(page)).toBe("=A");
});

test("no misfire on a fast tap sequence with small slips", async ({ page }) => {
  const keys = ["d1", "d2", "d3", "d4", "d5", "d6", "d7", "d8", "d9", "d0", "add", "d1", "mul", "d2", "sub", "d3"];
  const cdp = await page.context().newCDPSession(page);
  let i = 0;
  for (const id of keys) {
    const c = await centre(page, id);
    const slip = [-5, 6, -3, 7][i++ % 4] ?? 0;
    await send(cdp, "touchStart", [{ ...c, id: 1 }]);
    await send(cdp, "touchMove", [{ x: c.x + slip, y: c.y - slip, id: 1 }]);
    await send(cdp, "touchEnd", []);
  }
  await cdp.detach();
  expect(await entryValue(page)).toBe("1234567890+1\\times2-3");
});

test("two thumbs keep their order: a second finger fires the first one's flick at once", async ({ page }) => {
  const [a, b] = [await centre(page, "vars"), await centre(page, "d5")];
  const cdp = await page.context().newCDPSession(page);
  await send(cdp, "touchStart", [{ ...a, id: 1 }]);
  await send(cdp, "touchMove", [{ x: a.x, y: a.y + 30, id: 1 }]); // armed: A
  await send(cdp, "touchStart", [{ x: a.x, y: a.y + 30, id: 1 }, { ...b, id: 2 }]);
  expect(await entryValue(page)).toBe("A");
  await send(cdp, "touchMove", [{ x: a.x, y: a.y + 30, id: 1 }, { x: b.x, y: b.y - 30, id: 2 }]); // 5 up: nothing (no shift)
  await send(cdp, "touchMove", [{ x: a.x, y: a.y + 30, id: 1 }, { x: b.x, y: b.y + 30, id: 2 }]); // 5 down: V
  await send(cdp, "touchEnd", [{ x: a.x, y: a.y + 30, id: 1 }]);
  await send(cdp, "touchEnd", []);
  await cdp.detach();
  expect(await entryValue(page)).toBe("AV");
});

test("lock flicks: up on Shift locks shift; a tap on Shift unlocks", async ({ page }) => {
  await flick(page, "shift", "up");
  await expect(page.getByTestId("mod-shift")).toHaveText("⇧🔒");
  await expect(page.locator('[data-key="shift"]')).toHaveAttribute("data-locked", "true");
  await tap(page, ["dot", "dot"]);
  expect(await entryValue(page)).toBe("==");
  await tap(page, ["shift", "dot"]);
  expect(await entryValue(page)).toBe("==.");
  await expect(page.getByTestId("mod-shift")).toHaveCount(0);
  // a flick down on Shift does nothing
  await flick(page, "shift", "down");
  expect(await mods(page)).toEqual({ shift: false, alpha: false, shiftLock: false, alphaLock: false, capsLock: false });
});

test("lock flicks: down on Alpha locks capitals, and a flick up types `=` without leaving the lock (the G2 friction)", async ({ page }) => {
  await flick(page, "alpha", "down");
  await expect(page.getByTestId("mod-alpha")).toHaveText("α🔒");
  await tap(page, ["vars", "math"]);
  await flick(page, "dot", "up");
  await tap(page, ["d5"]);
  expect(await entryValue(page)).toBe("AB=V");
  expect((await mods(page)).alphaLock).toBe(true);
  await tap(page, ["alpha"]); // a tap unlocks, as before
  await tap(page, ["d5"]);
  expect(await entryValue(page)).toBe("AB=V5");
});

test("lock flicks: up on Alpha locks lower case; a flick down there gives the capital; the same flick unlocks", async ({ page }) => {
  await flick(page, "alpha", "up");
  expect(await mods(page)).toMatchObject({ alphaLock: true, capsLock: true });
  await tap(page, ["vars"]);
  await flick(page, "math", "down");
  await tap(page, ["tmpl"]);
  expect(await entryValue(page)).toBe("aBc");
  await flick(page, "alpha", "up");
  expect(await mods(page)).toEqual({ shift: false, alpha: false, shiftLock: false, alphaLock: false, capsLock: false });
  await tap(page, ["d1"]);
  expect(await entryValue(page)).toBe("aBc1");
});

test("Shift and Alpha taps stay as on the G2 (one-shot, Alpha twice locks) and are counted; flicks are not", async ({ page }) => {
  await tap(page, ["shift", "dot", "alpha", "vars", "shift", "alpha", "math"]);
  expect(await entryValue(page)).toBe("=Ab");
  await tap(page, ["alpha", "alpha", "d5", "d5", "alpha"]);
  expect(await entryValue(page)).toBe("=AbVV");
  await flick(page, "shift", "up");
  await flick(page, "shift", "up");
  await flick(page, "alpha", "down");
  await flick(page, "alpha", "down");
  expect(await taps(page)).toEqual({ shift: 2, alpha: 5 });
  // the counter in Settings (Shift + Home/CAS), with its reset
  await tap(page, ["shift", "app"]);
  const value = (id: string) => page.locator(`[data-testid="settings"] [data-id="${id}"]`).getByTestId("settings-value");
  await expect(value("shift")).toHaveText("3"); // the Shift that opened Settings counts too
  await expect(value("alpha")).toHaveText("5");
  await expect(value("since")).toHaveText(/^\d{4}-\d\d-\d\d$/);
  await page.locator('[data-testid="settings"] [data-id="reset"]').tap();
  await expect(value("shift")).toHaveText("0");
  // stored on the device: still zero after a relaunch (the write waits a second)
  await page.waitForTimeout(1300);
  await page.reload();
  await page.waitForFunction(() => window.pascaline !== undefined);
  await page.evaluate(() => window.pascaline.session.taps.ready);
  expect(await taps(page)).toEqual({ shift: 0, alpha: 0 });
});

test("inside a sheet a flick down types the letter on any key, digits too; a tap on a digit still picks", async ({ page }) => {
  await page.evaluate(() => {
    const w = window as unknown as { ran: string[] };
    w.ran = [];
    const names = ["volt", "watt", "weber", "yard", "zeta", "zepto", "ampere", "bar", "coulomb", "day", "erg", "farad"];
    window.pascaline.shell.showMenu("Test", names.map((n) => ({ id: n, label: n, run: () => void w.ran.push(n) })));
  });
  await flick(page, "d2", "down"); // Z
  await expect(page.getByTestId("sheet-filter")).toHaveText("Z");
  await expect(page.getByTestId("menu").getByRole("menuitem")).toHaveText(["1zeta", "2zepto"]);
  await flick(page, "d2", "up"); // nothing in a sheet
  await expect(page.getByTestId("sheet-filter")).toHaveText("Z");
  await tap(page, ["d2"]);
  expect(await page.evaluate(() => (window as unknown as { ran: string[] }).ran)).toEqual(["zepto"]);
  expect(await entryValue(page)).toBe("");
});

test("keys typed while an app loads keep their layer: Plot, Shift, CAS opens the Mode sheet (decisions.md R8)", async ({ page }) => {
  let release = (): void => {};
  const gate = new Promise<void>((r) => (release = r));
  await page.route(/\/src\/apps\/function\/index\.ts/, async (route) => {
    await gate;
    await route.continue();
  });
  await tap(page, ["plot", "shift", "cas"]);
  expect(await page.evaluate(() => window.pascaline.shell.loading)).toBe("function");
  await expect(page.getByTestId("sheet-title")).toHaveText("Mode");
  release();
  await page.waitForFunction(() => window.pascaline.shell.app === "function" && window.pascaline.shell.loading === null);
  await expect(page.getByTestId("sheet-title")).toHaveText("Mode");
  await expect(page.getByTestId("place")).toHaveText("Function › Plot");
});

test("a typed key waiting for the load keeps its layer, and a Shift pressed after it stays for the next key", async ({ page }) => {
  let release = (): void => {};
  const gate = new Promise<void>((r) => (release = r));
  await page.route(/\/src\/apps\/function\/index\.ts/, async (route) => {
    await gate;
    await route.continue();
  });
  await tap(page, ["symb", "alpha", "vars", "shift", "dot", "d2", "shift"]);
  await flick(page, "math", "down");
  expect(await page.evaluate(() => window.pascaline.shell.loading)).toBe("function");
  release();
  await page.waitForFunction(() => window.pascaline.shell.app === "function" && window.pascaline.shell.loading === null);
  await expect.poll(() => entryValue(page)).toBe("A=2B");
  // the last Shift was used up by the flick, as a one-shot is by any key
  expect((await mods(page)).shift).toBe(false);
});
