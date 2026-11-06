// SPDX-License-Identifier: GPL-3.0-or-later
// R33 (deep-dive item 15): a name that holds a value is drawn in the stored-name colour (--name-mark) on the entry
// line, in Home and in CAS; the LaTeX the parser reads is unchanged (the mark is CSS on MathLive's rendered letter, set
// after each render: entry/namemarks.ts). MathLive check, step 1 of the package: CSS on the rendered atoms keeps
// getValue(), the cursor and ⌫; applyStyle writes \textcolor into the value and a macro wrapper changes it too.
// The real engine: Home 3 ▶ x stores x; Shift + Math, Memory, deletes it.
import { expect, test, type Page } from "@playwright/test";
import { entryValue, open, tap } from "./helpers.ts";

const done = (page: Page, n: number) => expect(page.locator('[data-status="done"]')).toHaveCount(n);

/** The colour of each rendered variable letter on the line, in order, and the colour --name-mark resolves to. */
async function letters(page: Page): Promise<{ colours: string[]; texts: string[]; mark: string }> {
  return page.evaluate(() => {
    const mf = window.n62.entry.field;
    if (!mf?.shadowRoot) throw new Error("no field");
    const probe = document.createElement("span");
    probe.style.color = "var(--name-mark)";
    document.body.append(probe);
    const mark = getComputedStyle(probe).color;
    probe.remove();
    const spans = [...mf.shadowRoot.querySelectorAll<HTMLElement>(".ML__latex .ML__mathit")].filter((s) => s.children.length === 0);
    return { colours: spans.map((s) => getComputedStyle(s).color), texts: spans.map((s) => s.textContent ?? ""), mark };
  });
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await open(page, "");
  await page.waitForFunction(() => window.n62.session.engineState === "ready", undefined, { timeout: 20_000 });
});

async function storeX(page: Page): Promise<void> {
  await tap(page, ["d3", "shift", "emark", "x", "enter"]); // 3▶x
  await done(page, 1);
  await page.waitForFunction(() => window.n62.session.userNames.some((u) => u.name === "x"));
}

for (const view of ["home", "cas"] as const) {
  test(`${view}: a stored name on the line is drawn in the stored-name colour, a name that holds nothing is plain`, async ({ page }) => {
    await storeX(page);
    if (view === "cas") await tap(page, ["@cas"]);
    await tap(page, ["x", "add", "alpha", "vars"]); // x+a
    expect(await entryValue(page)).toMatch(/^x\+[aA]$/); // Alpha + Vars is A in Home, a in CAS; the LaTeX is as typed: nothing is added for the mark
    await expect.poll(async () => (await letters(page)).texts.map((t) => t.toLowerCase())).toEqual(["x", "a"]);
    const l = await letters(page);
    expect(l.colours[0]).toBe(l.mark);
    expect(l.colours[1]).not.toBe(l.mark); // a holds no value
    // the cursor and ⌫ are as before: one ⌫ takes the a, the next the x
    await tap(page, ["bksp"]);
    expect(await entryValue(page)).toBe("x+");
    await tap(page, ["bksp", "bksp"]);
    expect(await entryValue(page)).toBe("");
  });
}

test("after Memory deletes x, the next x is plain", async ({ page }) => {
  await storeX(page);
  await tap(page, ["x"]);
  await expect.poll(async () => (await letters(page)).colours[0]).toBe((await letters(page)).mark);
  await tap(page, ["bksp", "shift", "math", "enter", "esc"]); // Memory: Enter deletes the highlighted name
  await expect.poll(() => page.evaluate(() => window.n62.session.userNames.length)).toBe(0);
  await tap(page, ["x"]);
  expect(await entryValue(page)).toBe("x");
  await expect.poll(async () => {
    const l = await letters(page);
    return l.colours[0] === l.mark;
  }).toBe(false);
});

test("a letter inside a chip is never marked, whatever the chip shows", async ({ page }) => {
  await storeX(page);
  await page.evaluate(() => {
    const mf = window.n62.entry.field;
    if (mf) mf.value = "\\res{1}{x}+x";
  });
  await expect.poll(async () => (await letters(page)).texts).toEqual(["x", "x"]);
  const l = await letters(page);
  expect(l.colours[0]).not.toBe(l.mark);
  expect(l.colours[1]).toBe(l.mark);
});

test("a power of the name is marked, a subscripted letter is another name and is not", async ({ page }) => {
  await storeX(page);
  await page.evaluate(() => {
    const mf = window.n62.entry.field;
    if (mf) mf.value = "x^{2}+x_{1}";
  });
  await expect.poll(async () => (await letters(page)).texts).toEqual(["x", "x"]);
  const l = await letters(page);
  expect(l.colours[0]).toBe(l.mark);
  expect(l.colours[1]).not.toBe(l.mark);
});
