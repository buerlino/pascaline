// SPDX-License-Identifier: GPL-3.0-or-later
// U0 (docs/05 section 1): the quick UI fixes. Regression tests for what the owner's screenshots showed.
import { expect, test } from "@playwright/test";
import { entryValue, open, tap } from "./helpers.ts";

test.beforeEach(async ({ page }) => {
  await open(page);
});

test("finding 4: with Alpha lock on, a digit picks from the open Apps list; it does not type a letter behind it", async ({ page }) => {
  await tap(page, ["alpha", "alpha"]);
  await expect(page.locator('[data-key="alpha"]')).toHaveAttribute("data-locked", "true");
  await tap(page, ["apps"]);
  await expect(page.getByTestId("apps")).toBeVisible();
  await tap(page, ["d1"]);
  expect(await entryValue(page)).toBe(""); // not "Y"
  await expect(page.getByTestId("apps")).toBeHidden();
  await expect(page.getByTestId("place")).toHaveAttribute("data-app", /.+/); // item 1 was opened
  // the lock is still on: the sheet never touched the modifiers
  await expect(page.locator('[data-key="alpha"]')).toHaveAttribute("data-locked", "true");
});

test("finding 4: Shift is ignored by an open list too (Shift 2 picks item 2)", async ({ page }) => {
  await tap(page, ["apps"]);
  await expect(page.getByTestId("apps")).toBeVisible();
  await tap(page, ["shift", "d2"]);
  expect(await entryValue(page)).toBe("");
  await expect(page.getByTestId("apps")).toBeHidden();
});

// ---- finding 1: legends get their own space (never cut, never overlap) ----------------------------------------------
type Box = { x: number; y: number; w: number; h: number };
const overlaps = (a: Box, b: Box): boolean => a.x < b.x + b.w - 0.5 && b.x < a.x + a.w - 0.5 && a.y < b.y + b.h - 0.5 && b.y < a.y + a.h - 0.5;

for (const width of [412, 360, 320]) {
  test(`keypad text fits its key in every layer, nothing overlaps (${width} px wide)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await open(page);
    const layers: [string, string[]][] = [
      ["primary", []],
      ["shift", ["shift"]],
      ["alpha", ["alpha"]],
      ["shift+alpha", ["shift", "alpha"]],
    ];
    for (const [layer, keys] of layers) {
      await page.evaluate(() => window.pascaline.session.clearModifiers());
      await tap(page, keys);
      const problems = await page.evaluate(() => {
        const out: string[] = [];
        const rect = (e: Element) => {
          const r = e.getBoundingClientRect();
          return { x: r.x, y: r.y, w: r.width, h: r.height };
        };
        for (const key of document.querySelectorAll<HTMLElement>(".pad .key")) {
          const id = key.dataset["key"];
          const kb = rect(key);
          const parts = [...key.querySelectorAll<HTMLElement>("[data-fit]")].filter((e) => (e.textContent ?? "").trim() !== "");
          for (const el of parts) {
            // the text's own width (scrollWidth) against the key; a range gives the glyph box even when the element is clipped
            const range = document.createRange();
            range.selectNodeContents(el);
            const tr = range.getBoundingClientRect();
            if (tr.left < kb.x - 0.5 || tr.right > kb.x + kb.w + 0.5) out.push(`${id}: "${el.textContent}" is cut by the key edge`);
          }
          // R9 (P7 point 2): the shift legend sits on its own line above the face, at the left; the letter on its own line
          // below the face, at the left. Element boxes, so a legend never rises or sinks into the face's row.
          const main = key.querySelector(".main")?.getBoundingClientRect();
          const sh = key.querySelector(".shiftlegend")?.getBoundingClientRect();
          const al = key.querySelector(".alphalegend")?.getBoundingClientRect();
          if (main && sh && sh.bottom > main.top + 0.5) out.push(`${id}: the face rises into the shift legend line`);
          if (main && al && al.top < main.bottom - 0.5) out.push(`${id}: the face sinks into the letter line`);
          if (sh && sh.left > kb.x + 8) out.push(`${id}: the shift legend is not at the left`);
          if (al && al.left > kb.x + 8) out.push(`${id}: the letter is not at the left`);
          if (al && al.bottom < kb.y + kb.h - 6) out.push(`${id}: the letter is not at the bottom`);
        }
        return out;
      });
      expect(problems, `layer ${layer}`).toEqual([]);
    }
  });
}

test("every key reserves a legend line above its face, and every key in a row with letters one below it, so faces sit level", async ({ page }) => {
  const rows = await page.evaluate(() => {
    const out: Record<string, number[]> = {};
    const faceTop = new Map<number, number[]>();
    for (const key of document.querySelectorAll<HTMLElement>(".pad .key")) {
      const legend = key.querySelector(".shiftlegend")?.getBoundingClientRect();
      const main = key.querySelector(".main")?.getBoundingClientRect();
      if (!legend || !main) throw new Error(`key ${key.dataset["key"]} has no legend line or face`);
      if (main.top < legend.bottom - 0.5) out[key.dataset["key"] ?? "?"] = [legend.bottom, main.top];
      const top = Math.round(key.getBoundingClientRect().top);
      // the face's centre relative to its key: level across a row of keys of one height
      const centre = main.top + main.height / 2 - key.getBoundingClientRect().top;
      faceTop.set(top, [...(faceTop.get(top) ?? []), centre]);
    }
    for (const [top, cs] of faceTop) if (Math.max(...cs) - Math.min(...cs) > 3) out[`row@${top}`] = cs;
    return out;
  });
  expect(rows).toEqual({}); // none whose face rises into the legend line, no row whose faces are not level
});

// ---- finding 3: dead keys dim only in the layers where they do nothing ---------------------------------------------------
const dead = async (page: import("@playwright/test").Page, id: string): Promise<boolean> =>
  (await page.locator(`[data-key="${id}"]`).getAttribute("data-dead")) === "true";

test("finding 3: Vars and Math are dimmed in the plain layer, Tmpl opens its palette (R10); all three type A, B, C in Alpha", async ({ page }) => {
  for (const id of ["vars", "math"]) expect(await dead(page, id), `${id} plain`).toBe(true);
  expect(await dead(page, "tmpl"), "tmpl plain").toBe(false);
  await tap(page, ["alpha"]);
  for (const id of ["vars", "math", "tmpl"]) expect(await dead(page, id), `${id} alpha`).toBe(false);
  await tap(page, ["vars"]); // the A
  expect(await entryValue(page)).toBe("A");
  await page.evaluate(() => window.pascaline.entry.clear());
  await tap(page, ["shift"]);
  for (const id of ["vars", "math", "tmpl"]) expect(await dead(page, id), `${id} shift`).toBe(true);
});

test("finding 3: a key is dimmed exactly where it does nothing (the shift layer of keys without a shift function)", async ({ page }) => {
  expect(await dead(page, "sin")).toBe(false);
  expect(await dead(page, "d5")).toBe(false);
  await tap(page, ["shift"]);
  expect(await dead(page, "sin")).toBe(false); // sin⁻¹
  expect(await dead(page, "up")).toBe(true); // ▲ has no shift function
  expect(await dead(page, "enter")).toBe(false); // ≈
  expect(await dead(page, "shift")).toBe(false); // the modifiers work in every layer
  expect(await dead(page, "alpha")).toBe(false);
  await tap(page, ["esc", "esc"]);
  await page.evaluate(() => window.pascaline.session.clearModifiers());
  expect(await dead(page, "up")).toBe(false);
});

test("finding 3: the Enter face stays readable in the Alpha layer (white, not blue on green)", async ({ page }) => {
  await tap(page, ["alpha"]);
  const colours = await page.evaluate(() => {
    const e = document.querySelector('[data-key="enter"]') as HTMLElement;
    const c = (el: Element) => getComputedStyle(el).color;
    return { face: c(e.querySelector(".main") as Element), key: getComputedStyle(e).backgroundColor };
  });
  expect(colours.face).toBe("rgb(255, 255, 255)");
});

// ---- finding 8: the Plot hint sits above the axes -----------------------------------------------------------------------
test("finding 8: with no function the Plot hint is a box above the x axis, on its own background", async ({ page }) => {
  await open(page, "");
  await page.waitForFunction(() => window.pascaline.session.engineState === "ready", undefined, { timeout: 20_000 });
  await tap(page, ["symb", "plot"]);
  const note = page.locator(".plot .note");
  await expect(note).toBeVisible();
  await page.waitForFunction(() => window.pascaline.plot.board !== undefined);
  const r = await page.evaluate(() => {
    const board = document.querySelector(".plot .board") as HTMLElement;
    const note = document.querySelector(".plot .note") as HTMLElement;
    const b = board.getBoundingClientRect();
    const n = note.getBoundingClientRect();
    const origin = (window.pascaline.plot.board as unknown as { origin: { scrCoords: number[] } }).origin.scrCoords;
    return { noteBottom: n.bottom - b.top, axisY: origin[2] ?? 0, bg: getComputedStyle(note).backgroundColor, left: n.left - b.left, right: b.right - n.right };
  });
  expect(r.noteBottom).toBeLessThan(r.axisY - 2);
  expect(r.bg).not.toBe("rgba(0, 0, 0, 0)");
  expect(r.left).toBeGreaterThanOrEqual(0);
  expect(r.right).toBeGreaterThanOrEqual(0);
});
