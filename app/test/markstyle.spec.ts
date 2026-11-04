// SPDX-License-Identifier: GPL-3.0-or-later
// R124: Settings › Numbers › Marks. By default ("⚠ + reason") a ⚠ row shows R36's line under it in the warn colour, one
// line, drawn with the row: the row's box is as high at its first frame as after the line's text is in (the line's code
// loads with the first ⚠, never in the start chunk; docs/03 rule 8: nothing moves once drawn). ≈ and = rows show none.
// "⚠ coloured" is the row as before R124; "Muted" draws the mark in --muted. The setting survives a relaunch and goes into
// a preset's Numbers group; the unit view's result follows it. The two ⚠ cases are why.spec.ts's (G39 differ, G50
// normald_icdf unaudited) with their texts; the e2e of the backup is backup.spec.ts's.
import { expect, test, type Page } from "@playwright/test";
import { flick, open, tap } from "./helpers.ts";
import type { MarkStyle } from "../src/state/session.svelte.ts";

const DIFFER = "\\operatorname{int}\\left(\\operatorname{abs}\\left(x-\\sin\\left(10^{50}\\right)\\right),x,-1,1\\right)";
const DIFFER_WHY = "⚠ no digit confirmed · the exact and numeric answers differ";
const UNAUDITED = "\\operatorname{normald\\_icdf}\\left(2,-1,0.3\\right)";
const UNAUDITED_WHY = "⚠ normald_icdf is not checked";

const ready = (page: Page) => page.waitForFunction(() => window.pascaline.session.engineState === "ready", undefined, { timeout: 20_000 });
const done = (page: Page, n: number) => expect(page.locator('[data-status="done"]')).toHaveCount(n);
const reasons = (page: Page) => page.getByTestId("mark-reason");
const lastRow = (page: Page) => page.locator("article.item").last();

/** Set the mark style as the Settings row does (and store it). */
const setMarks = (page: Page, m: MarkStyle): Promise<void> =>
  page.evaluate((m) => {
    window.pascaline.session.settings.marks = m;
    window.pascaline.session.save();
  }, m);

/** Enter `latex` in the current view and wait for `rows` finished rows. */
async function run(page: Page, latex: string, rows: number): Promise<void> {
  await page.evaluate((l) => window.pascaline.session.submit(l), latex);
  await done(page, rows);
}

/** A theme token's colour as the page computes it. */
const token = (page: Page, name: string): Promise<string> =>
  page.evaluate((n) => {
    const probe = document.createElement("span");
    probe.style.color = `var(--${n})`;
    document.body.append(probe);
    const c = getComputedStyle(probe).color;
    probe.remove();
    return c;
  }, name);
const colourOf = (page: Page, testid: string): Promise<string> => page.getByTestId(testid).last().evaluate((e) => getComputedStyle(e).color);

/** From before Enter: the height of the new row's box at the frame it is first drawn as finished, and whether its reason
 *  line was there then. The observer fires before that frame is painted (a microtask after the change). */
async function watchFirstDraw(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as { __first?: { height: number; reason: boolean } };
    delete w.__first;
    const seen = new Set(document.querySelectorAll('article.item[data-status="done"]'));
    const mo = new MutationObserver(() => {
      const row = [...document.querySelectorAll('article.item[data-status="done"]')].find((r) => !seen.has(r));
      if (!row) return;
      w.__first = { height: row.getBoundingClientRect().height, reason: row.querySelector('[data-testid="mark-reason"]') !== null };
      mo.disconnect();
    });
    mo.observe(document.querySelector(".history") as Element, { subtree: true, childList: true, attributes: true, characterData: true });
  });
}
const firstDraw = (page: Page) => page.evaluate(() => (window as unknown as { __first?: { height: number; reason: boolean } }).__first);

/** The last row's reason line holds R36's words: the line its pick shows (▲ on the empty line, then Esc). */
async function sameAsPicked(page: Page): Promise<void> {
  await tap(page, ["up"]);
  const picked = (await page.getByTestId("row-why").innerText()).trim();
  await tap(page, ["esc"]);
  expect(await reasons(page).last().innerText()).toBe(picked);
}

test.beforeEach(async ({ page }) => {
  await open(page, "");
  await ready(page);
});

for (const view of ["home", "cas"] as const)
  test(`${view}: a ⚠ row shows its reason under it in the warn colour, drawn with the row; ≈ and = rows show none`, async ({ page }) => {
    await page.evaluate((v) => window.pascaline.session.setView(v), view);
    expect(await page.evaluate(() => window.pascaline.session.settings.marks)).toBe("reason"); // the default
    await watchFirstDraw(page);
    await run(page, DIFFER, 1);
    await expect(page.getByTestId("mark").last()).toHaveAttribute("data-mark", "⚠");
    await expect(reasons(page)).toHaveText(view === "home" ? DIFFER_WHY : /the exact and numeric answers differ$/);
    await sameAsPicked(page);
    const first = await firstDraw(page);
    expect(first?.reason, "the line's place is there at the first frame").toBe(true);
    expect((await lastRow(page).boundingBox())?.height).toBe(first?.height); // the row never grew
    expect(await colourOf(page, "mark-reason")).toBe(await token(page, "warn"));
    expect(await reasons(page).evaluate((e) => getComputedStyle(e).whiteSpace)).toBe("nowrap"); // one line, ellipsed
    await watchFirstDraw(page);
    await run(page, UNAUDITED, 2);
    await expect(reasons(page).last()).toHaveText(UNAUDITED_WHY);
    await sameAsPicked(page);
    expect((await lastRow(page).boundingBox())?.height).toBe((await firstDraw(page))?.height);
    await run(page, "\\frac{1}{4}", 3);
    await run(page, "\\sqrt{2}+0.5", 4);
    await expect(reasons(page)).toHaveCount(2); // the ⚠ rows only
    await expect(lastRow(page).getByTestId("mark-reason")).toHaveCount(0);
  });

test("a tap on the reason line shows its full text; the row is not recalled", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await run(page, DIFFER, 1);
  const line = reasons(page);
  await expect(line).toHaveText(DIFFER_WHY);
  expect(await line.evaluate((e) => e.scrollWidth > e.clientWidth)).toBe(true); // ellipsed at this width
  await line.tap();
  await expect(line).toHaveAttribute("data-open", "true");
  expect(await line.evaluate((e) => getComputedStyle(e).whiteSpace)).not.toBe("nowrap");
  expect(await page.evaluate(() => window.pascaline.entry.value)).toBe("");
});

test("⚠ coloured: the row as before (the mark in --warn, no line); Muted: the mark in --muted", async ({ page }) => {
  await run(page, UNAUDITED, 1);
  await run(page, "\\sqrt{2}+0.5", 2);
  await expect(reasons(page)).toHaveCount(1);
  await setMarks(page, "colour");
  await expect(reasons(page)).toHaveCount(0);
  expect(await page.getByTestId("mark").first().evaluate((e) => getComputedStyle(e).color)).toBe(await token(page, "warn"));
  expect(await colourOf(page, "mark")).toBe(await token(page, "approx"));
  await setMarks(page, "muted");
  await expect(reasons(page)).toHaveCount(0);
  const muted = await token(page, "muted");
  expect(await page.getByTestId("mark").first().evaluate((e) => getComputedStyle(e).color)).toBe(muted);
  expect(await colourOf(page, "mark")).toBe(muted);
  await expect(page.getByTestId("mark").first()).toHaveText("⚠"); // the mark itself stays
});

test("the setting survives a relaunch, and a stored ⚠ row draws its line with its place kept", async ({ page }) => {
  await run(page, UNAUDITED, 1);
  await setMarks(page, "colour");
  await page.waitForTimeout(900); // the writes are debounced and asynchronous
  await page.reload();
  await page.waitForFunction(() => window.pascaline !== undefined);
  await page.evaluate(() => window.pascaline.entry.ready);
  await done(page, 1);
  expect(await page.evaluate(() => window.pascaline.session.settings.marks)).toBe("colour");
  await expect(reasons(page)).toHaveCount(0);
  await setMarks(page, "reason");
  await page.waitForTimeout(900);
  await page.reload();
  await page.waitForFunction(() => window.pascaline !== undefined);
  await done(page, 1);
  await expect(reasons(page)).toHaveText(UNAUDITED_WHY);
});

test("a preset's Numbers group holds the mark style", async ({ page }) => {
  const after = await page.evaluate(async (path) => {
    const { session, userKeys } = window.pascaline;
    const presets = await ((await import(/* @vite-ignore */ path)) as typeof import("../src/views/modeSheet.ts")).presetsFor(session, userKeys);
    session.settings.marks = "muted";
    const id = presets.capture("Quiet", ["numbers"]);
    session.settings.marks = "reason";
    await presets.apply(id);
    return { held: presets.list[0]?.groups.numbers?.["marks"], now: session.settings.marks };
  }, "/src/views/modeSheet.ts");
  expect(after).toEqual({ held: "muted", now: "muted" });
});

test("Settings › Numbers › Marks: three buttons, ⚠ + reason marked; a tap sets Muted", async ({ page }) => {
  await page.getByTestId("chip-format").tap();
  await tap(page, ["d6", "d2"]);
  const row = page.getByTestId("menu").locator('[data-id="marks"]');
  await expect(row.locator(".opt")).toHaveText(["Muted", "⚠ coloured", "⚠ + reason"]);
  await expect(row.locator('[data-option="reason"]')).toHaveAttribute("aria-pressed", "true");
  await row.locator('[data-option="muted"]').tap();
  expect(await page.evaluate(() => window.pascaline.session.settings.marks)).toBe("muted");
});

test("the unit view's result follows the style: its σ why-line with the reason only, its marks muted with Muted", async ({ page }) => {
  const unitView = async (): Promise<void> => {
    await flick(page, "tmpl", "up");
    await page.waitForFunction(() => window.pascaline.unitView !== undefined && document.querySelector('[data-pad="unit"]') !== null);
    await flick(page, "enter", "up");
    await expect(page.getByTestId("unit-result")).toBeVisible();
  };
  await tap(page, ["cos", "d0", "shift", "comma", "d0", "dot", "d1"]); // cos(0 ± 0.1): ⚠ before σ (unitresult.spec.ts)
  await unitView();
  await expect(page.getByTestId("unit-why")).toBeVisible();
  expect(await colourOf(page, "unit-warn")).toBe(await token(page, "warn"));
  await tap(page, ["esc"]);
  await setMarks(page, "colour");
  await tap(page, ["esc"]);
  await tap(page, ["cos", "d0", "shift", "comma", "d0", "dot", "d1"]);
  await unitView();
  await expect(page.getByTestId("unit-why")).toBeHidden();
  expect(await colourOf(page, "unit-warn")).toBe(await token(page, "warn"));
  await tap(page, ["esc"]);
  await setMarks(page, "muted");
  await tap(page, ["esc"]);
  await tap(page, ["cos", "d0", "shift", "comma", "d0", "dot", "d1"]);
  await unitView();
  await expect(page.getByTestId("unit-why")).toBeHidden();
  const muted = await token(page, "muted");
  expect(await colourOf(page, "unit-warn")).toBe(muted);
  expect(await colourOf(page, "unit-mark")).toBe(muted);
});
