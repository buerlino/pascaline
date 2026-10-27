// SPDX-License-Identifier: GPL-3.0-or-later
// R82f2 (F118): the status line at phone widths. The Fairphone 6 is 372 CSS px wide; 360 the small phone; 412 the
// Pixel 7 (the e2e default, where phase-1's cut never showed). In every place and state nothing in the header is cut or
// overflows it, ☰ is on screen and uncovered, and the views' and chips' boxes do not move when ⇧ or α shows or the
// engine starts (a fixed slot: a press must not move a tab from under the finger).
import { expect, test, type Page } from "@playwright/test";
import { seen } from "./core-lib.ts";
import { open } from "./helpers.ts";

const WIDTHS = [360, 372, 412] as const;
type Place = "home" | "cas" | "function:symb" | "function:plot" | "function:num" | "solve:symb" | "solve:num";
const PLACES: readonly Place[] = ["home", "cas", "function:symb", "function:plot", "function:num", "solve:symb", "solve:num"];

/** A modifier or engine state, set on the models directly (each from a clean one). */
type Mod = "none" | "shift" | "shiftLock" | "alpha" | "alphaLock" | "lowerLock" | "starting";
const MODS: readonly Mod[] = ["none", "shift", "shiftLock", "alpha", "alphaLock", "lowerLock", "starting"];
/** The chips' settings: the default, DEG, and the widest pill (DEG, two-digit digits, each format). */
const CHIPS = [
  { name: "default", angle: "rad", format: "std", digits: 12 },
  { name: "DEG", angle: "deg", format: "std", digits: 12 },
  { name: "DEG PFX 30", angle: "deg", format: "pfx", digits: 30 },
  { name: "DEG ENG 10", angle: "deg", format: "eng", digits: 10 },
  { name: "DEG SCI 10", angle: "deg", format: "sci", digits: 10 },
] as const;

async function goTo(page: Page, place: Place): Promise<void> {
  await page.evaluate(async (p) => {
    const { session, shell } = window.pascaline;
    if (p === "home" || p === "cas") {
      shell.close();
      session.view = p;
      return;
    }
    const [app, view] = p.split(":") as ["function" | "solve", "symb" | "plot" | "num"];
    await shell.open(app, view);
  }, place);
  await page.waitForFunction(() => window.pascaline.shell.loading === null);
}

async function setState(page: Page, chips: (typeof CHIPS)[number], mod: Mod): Promise<void> {
  await page.evaluate(
    ([c, m]) => {
      const s = window.pascaline.session;
      s.settings.angle = c.angle;
      s.settings.format = c.format;
      s.settings.digits = c.digits;
      s.shift = s.alpha = s.shiftLock = s.alphaLock = s.capsLock = false;
      s.engineState = m === "starting" ? "starting" : "ready";
      if (m === "shift") s.shift = true;
      if (m === "shiftLock") s.shift = s.shiftLock = true;
      if (m === "alpha") s.alpha = true;
      if (m === "alphaLock") s.alpha = s.alphaLock = true;
      if (m === "lowerLock") s.alpha = s.alphaLock = s.capsLock = s.shift = true;
    },
    [chips, mod] as const,
  );
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
}

/** What is wrong with the header's layout ("" = nothing), and the boxes of the controls that must not move. */
function measure(page: Page): Promise<{ bad: string[]; boxes: Record<string, string> }> {
  return page.evaluate(() => {
    const h = document.querySelector("header") as HTMLElement;
    const hr = h.getBoundingClientRect();
    const bad: string[] = [];
    if (h.scrollWidth > h.clientWidth) bad.push(`header overflows by ${h.scrollWidth - h.clientWidth} px`);
    const name = (e: Element): string => (e as HTMLElement).dataset["testid"] ?? `${e.tagName.toLowerCase()}.${(e as HTMLElement).className}`;
    for (const e of h.querySelectorAll<HTMLElement>("*")) {
      if (e instanceof SVGElement) continue;
      const r = e.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      if (e.scrollWidth > e.clientWidth + 0.5 && getComputedStyle(e).overflowX !== "visible") bad.push(`${name(e)} cut (${e.scrollWidth} > ${e.clientWidth})`);
      if (r.left < Math.max(0, hr.left) - 0.5 || r.right > Math.min(innerWidth, hr.right) + 0.5) bad.push(`${name(e)} outside the line (${Math.round(r.left)}–${Math.round(r.right)})`);
    }
    const boxes: Record<string, string> = {};
    for (const e of h.querySelectorAll<HTMLElement>('[data-testid^="tab-"], [data-testid^="chip-"], [data-testid="menu-button"], [data-testid="mod-slot"]')) {
      const r = e.getBoundingClientRect();
      boxes[e.dataset["testid"] as string] = `${r.left.toFixed(1)},${r.width.toFixed(1)}`;
    }
    return { bad, boxes };
  });
}

for (const width of WIDTHS)
  for (const place of PLACES)
    test(`the status line fits and holds still at ${width} px in ${place} (R82f2)`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width, height: 800 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
      const page = await ctx.newPage();
      try {
        await open(page);
        await goTo(page, place);
        const views = place.includes(":") ? (place.startsWith("solve") ? 2 : 3) : 0;
        await expect(page.getByRole("tab")).toHaveCount(views);
        for (const chips of CHIPS) {
          let base: Record<string, string> | undefined;
          for (const mod of MODS) {
            await setState(page, chips, mod);
            const at = `${width} px, ${place}, ${chips.name}, ${mod}`;
            const m = await measure(page);
            expect(m.bad, at).toEqual([]);
            expect(await seen(page, '[data-testid="menu-button"]'), `☰ at ${at}`).toBe("");
            for (const tab of await page.getByRole("tab").all()) {
              const id = await tab.getAttribute("data-testid");
              expect(await seen(page, `[data-testid="${id}"]`), `${id} at ${at}`).toBe("");
            }
            expect(m.boxes["mod-slot"], `the ⇧ α slot at ${at}`).toBeDefined();
            if (base === undefined) base = m.boxes;
            else expect(m.boxes, `boxes moved at ${at}`).toEqual(base);
          }
        }
      } finally {
        await ctx.close();
      }
    });
