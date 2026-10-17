// SPDX-License-Identifier: GPL-3.0-or-later
// R42 (bug F33): a finger tap lands where it went down. MathLive places the caret on pointerdown and, for touch only,
// a second time on pointerup from a stale atom-bounds cache; at the right edge of a fraction, root, power or bracket pair
// the second hit lands at the start of the line or box. A tap must give the same caret as a mouse click at the same point.
import { expect, test, type Page } from "@playwright/test";
import { entryValue, open } from "./helpers.ts";

const LINES = [
  "123+456",
  "\\frac{12}{34}",
  "\\frac{\\frac12}{\\placeholder{}}",
  "\\frac{\\frac12}{3}",
  "\\frac{1}{\\frac23}",
  "\\sqrt{\\frac12}",
  "2^{3}+1",
  "\\sin\\left(2\\right)+1",
];

interface Pt { x: number; y: number }

async function setLine(page: Page, latex: string, atEnd: boolean): Promise<void> {
  await page.evaluate(
    ([l, end]) => {
      const mf = window.pascaline.entry.field;
      if (!mf) throw new Error("no field");
      mf.value = l as string;
      mf.focus();
      mf.executeCommand(end ? "moveToMathfieldEnd" : "moveToMathfieldStart");
    },
    [latex, atEnd] as const,
  );
  await page.waitForTimeout(550); // MathLive reads a second tap within 500 ms as a double tap
}

const caret = (page: Page): Promise<number> => page.evaluate(() => window.pascaline.entry.field?.position ?? -1);

/** 1.5 px inside the right edge of every atom, at its height. */
async function edges(page: Page): Promise<Pt[]> {
  return page.evaluate(() => {
    const root = window.pascaline.entry.field?.shadowRoot;
    const pts = new Map<string, Pt>();
    for (const el of root?.querySelectorAll("[data-atom-id]") ?? []) {
      const r = el.getBoundingClientRect();
      if (r.width < 3 || r.height < 3) continue;
      const p = { x: Math.round((r.right - 1.5) * 10) / 10, y: Math.round((r.top + r.height / 2) * 10) / 10 };
      pts.set(`${p.x},${p.y}`, p);
    }
    return [...pts.values()];
  });
}

test("a finger tap puts the caret where a mouse click does", async ({ page }) => {
  await open(page);
  test.setTimeout(600_000);
  const bad: string[] = [];
  for (const latex of LINES) {
    for (const atEnd of [true, false]) {
      await setLine(page, latex, atEnd);
      for (const p of await edges(page)) {
        await setLine(page, latex, atEnd);
        await page.mouse.click(p.x, p.y);
        await page.waitForTimeout(50); // R47: a click, like a tap, settles off a stop after pointerup
        const m = await caret(page);
        await setLine(page, latex, atEnd);
        await page.touchscreen.tap(p.x, p.y);
        await page.waitForTimeout(50);
        const t = await caret(page);
        if (m !== t) bad.push(`${latex} ${atEnd ? "end" : "start"} (${p.x},${p.y}): mouse ${m}, finger ${t}`);
      }
    }
  }
  expect(bad).toEqual([]);
});

test("a tap right of the inner fraction types at the end of the outer numerator", async ({ page }) => {
  await open(page);
  await setLine(page, "\\frac{\\frac12}{\\placeholder{}}", true);
  const p = await page.evaluate(() => {
    const fr = [...(window.pascaline.entry.field?.shadowRoot?.querySelectorAll(".ML__mfrac") ?? [])];
    const inner = fr.find((e) => e.parentElement?.closest(".ML__mfrac"));
    if (!inner) throw new Error("no inner fraction");
    const r = inner.getBoundingClientRect();
    return { x: r.right + 4, y: r.top + r.height / 2 };
  });
  await page.touchscreen.tap(p.x, p.y);
  await page.waitForTimeout(50);
  await page.keyboard.type("9");
  expect(await entryValue(page)).toBe("\\frac{\\frac129}{\\placeholder{}}");
});
