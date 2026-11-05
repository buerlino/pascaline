// SPDX-License-Identifier: GPL-3.0-or-later
// R132 (docs/04 3.2 E3): a Find key touches few rows of the list. The rows built and patched per key, counted in the
// DOM with a MutationObserver: only the rows the sheet's room shows plus a margin are built, a hit that stays in the
// result keeps its row node (moved, not built again; untouched where it keeps its place), and rows below the room are
// built when the list is scrolled to them or the highlight moves down to them. The model of the same is
// src/views/findRows.test.ts. The fake engine; the full generated index (`npm run index`).
import { expect, test, type Page } from "@playwright/test";
import { open, tap } from "./helpers.ts";

const find = (page: Page) => page.getByTestId("find");
const rows = (page: Page) => find(page).locator(".list .row");

interface KeyCount {
  readonly built: number;
  readonly patched: number;
  readonly fresh: number;
  readonly samePlace: number;
  readonly shown: number;
  readonly hits: number;
}

/** Type `ch` into Find and count, once the list is drawn, the row nodes built and the rows patched (a row whose
 *  attributes or text changed; a row moved is neither), beside the hits new to the drawn rows and the drawn hits that
 *  kept their place. */
const typeCounted = (page: Page, ch: string): Promise<KeyCount> =>
  page.evaluate(async (ch) => {
    const list = document.querySelector('[data-testid="find"] .list') as HTMLElement;
    const before = [...list.querySelectorAll<HTMLElement>(".row")];
    const ids = new Map(before.map((el, i) => [el.dataset["id"], i] as const));
    const old = new Set<Node>(before);
    const built = new Set<Node>();
    const patched = new Set<Element>();
    const mo = new MutationObserver((recs) => {
      for (const r of recs) {
        // a moved row is removed and added again: only a node the list did not hold before is built
        for (const n of r.addedNodes) if (n instanceof HTMLElement && n.classList.contains("row") && !old.has(n)) built.add(n);
        const el = r.target instanceof Element ? r.target : r.target.parentElement;
        const row = el?.closest(".row");
        if (row && !(r.type === "childList" && r.target === list)) patched.add(row);
      }
    });
    mo.observe(list, { subtree: true, childList: true, attributes: true, characterData: true });
    window.pascaline.shell.sheet?.level.type(ch);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    mo.disconnect();
    const after = [...list.querySelectorAll<HTMLElement>(".row")];
    const fresh = after.filter((el) => !ids.has(el.dataset["id"])).length;
    const samePlace = after.filter((el, i) => ids.get(el.dataset["id"]) === i).length;
    for (const n of built) patched.delete(n as Element);
    return { built: built.size, patched: [...patched].filter((el) => after.includes(el as HTMLElement)).length, fresh, samePlace, shown: after.length, hits: window.pascaline.shell.sheet?.level.rows.length ?? 0 };
  }, ch);

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page);
  await tap(page, ["math"]);
  await expect(rows(page)).toHaveCount(10);
});

test("a Find key builds only the rows in view plus a margin, and a hit that stays keeps its row", async ({ page }) => {
  const room = await find(page).evaluate((e) => e.clientHeight);
  const most = Math.ceil(room / 36) + 4; // sheetWindow.ts: the rows the room holds at the floor height, and the margin
  const first = await typeCounted(page, "p");
  expect(first.hits).toBe(50);
  expect(first.shown).toBeLessThanOrEqual(most);
  expect(first.shown).toBeLessThan(first.hits);
  expect(first.built).toBe(first.shown); // the categories' rows go, the hits are new
  // the rows not built are a spacer as tall as they are: the list scrolls as far as with every row there
  const rest = await find(page).getByTestId("sheet-rest").evaluate((e) => e.getBoundingClientRect().height);
  const rowH = await rows(page).first().evaluate((e) => e.getBoundingClientRect().height);
  expect(rest).toBeCloseTo((first.hits - first.shown) * rowH, 0);
  let stayed = 0;
  for (const ch of "ressure") {
    const k = await typeCounted(page, ch);
    expect(k.built, `${ch}: rows built are the new hits`).toBe(k.fresh);
    expect(k.patched, `${ch}: rows patched`).toBeLessThanOrEqual(k.shown - k.samePlace);
    stayed += k.shown - k.fresh;
  }
  expect(stayed).toBeGreaterThan(10);
});

test("rows below the room are built when the list is scrolled down or the highlight moves down to them", async ({ page }) => {
  await typeCounted(page, "s");
  const shown = await rows(page).count();
  expect(shown).toBeLessThan(50);
  await find(page).locator(".list").evaluate((e) => e.scrollTo({ top: e.scrollHeight }));
  await expect(rows(page)).toHaveCount(50);
  await expect(find(page).getByTestId("sheet-rest")).toHaveCount(0);
  await tap(page, ["bksp", "math"]); // a new query: back to the rows in view
  await expect(find(page).getByTestId("sheet-filter")).toHaveText("b");
  await expect.poll(() => rows(page).count()).toBeLessThan(50);
  const before = await rows(page).count();
  for (let i = 0; i < before + 2; i++) await tap(page, ["down"]);
  const active = find(page).locator('.row[data-active="true"]');
  await expect(active).toBeInViewport();
  expect(await rows(page).count()).toBeGreaterThan(before);
});
