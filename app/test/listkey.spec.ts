// SPDX-License-Identifier: GPL-3.0-or-later
// R54: the list key. Shift + 8 inserts `{□}` (the G2's Shift + 8, docs/04 5.1) with the cursor in its body; commas
// separate the elements, ▶ at the end of the body leaves the braces, a selection goes inside them (R17), and ⌫ at the
// start of the body removes the pair whole and keeps what it held, as for ( ). On the real engine: mean and stddevp of
// task t09's readings (tests/tasks/tasks.yaml; values from the oracle, tests/golden/home.yaml t09-mean, t09-stddevp).
import { expect, test, type Page } from "@playwright/test";
import { entryValue, open, tap } from "./helpers.ts";

const field = (page: Page) =>
  page.evaluate(() => {
    const mf = window.pascaline.entry.field;
    if (!mf) throw new Error("no field");
    return { pos: mf.position, last: mf.lastOffset, sel: mf.getValue(mf.selection, "latex") };
  });

test.describe("Shift + 8 (fake engine)", () => {
  test.beforeEach(async ({ page }) => {
    await open(page);
  });

  test("inserts {□} with the cursor inside; 1 , 2 , 3 ▶ leaves it", async ({ page }) => {
    await tap(page, ["shift", "d8"]);
    expect(await entryValue(page)).toBe("\\left\\{\\placeholder{}\\right\\}");
    // the cursor is in the body: the □ is what a key replaces
    expect((await field(page)).sel).toBe("\\placeholder{}");
    await tap(page, ["d1", "comma", "d2", "comma", "d3"]);
    expect(await entryValue(page)).toBe("\\left\\{1,2,3\\right\\}");
    await tap(page, ["right"]);
    const f = await field(page);
    expect(f.pos).toBe(f.last);
    await tap(page, ["add", "d4"]);
    expect(await entryValue(page)).toBe("\\left\\{1,2,3\\right\\}+4");
  });

  test("with 1,2 selected it wraps the selection (R17)", async ({ page }) => {
    await page.evaluate(() => {
      const mf = window.pascaline.entry.field;
      if (!mf) throw new Error("no field");
      mf.value = "1,2";
      mf.focus();
      mf.executeCommand("selectAll");
    });
    await tap(page, ["shift", "d8"]);
    expect(await entryValue(page)).toBe("\\left\\{1,2\\right\\}");
  });

  test("⌫ at the start of the body removes the pair whole and keeps its elements", async ({ page }) => {
    await tap(page, ["d5", "add", "shift", "d8", "d1", "comma", "d2"]);
    for (let i = 0; i < 3; i++) await tap(page, ["left"]);
    await tap(page, ["bksp"]);
    expect(await entryValue(page)).toBe("5+1,2");
  });
});

test.describe("Shift + 8 (real engine)", () => {
  test.beforeEach(async ({ page }) => {
    await open(page, "");
    await page.waitForFunction(() => window.pascaline.session.engineState === "ready", undefined, { timeout: 20_000 });
  });

  const READINGS = ["9.81", "9.79", "9.83", "9.80", "9.82", "9.78", "9.84", "9.81", "9.80", "9.82"];
  const list = `\\left\\{${READINGS.join(",")}\\right\\}`;
  const lastRow = (page: Page) => page.locator('[data-testid="result"]').last();

  for (const [name, text, mark] of [
    ["mean", "9.81", "="],
    ["stddevp", "0.0182574185835", "≈"],
  ] as const) {
    test(`${name} of t09's readings typed with Shift + 8: ${mark} ${text}`, async ({ page }) => {
      // the list from the key, then the function name as Find (R4a) will insert it, around the selected list
      await tap(page, ["shift", "d8"]);
      for (const [i, r] of READINGS.entries()) {
        if (i > 0) await tap(page, ["comma"]);
        await tap(page, [...r].map((c) => (c === "." ? "dot" : `d${c}`)));
      }
      await page.evaluate((n) => {
        const p = window.pascaline;
        p.entry.field?.executeCommand("selectAll");
        p.entry.run({ kind: "insert", latex: `\\operatorname{${n}}\\left(#0\\right)` });
      }, name);
      expect(await entryValue(page)).toBe(`\\operatorname{${name}}\\left(${list}\\right)`);
      await tap(page, ["enter"]);
      await expect(lastRow(page).locator(".result")).toHaveText(text);
      await expect(lastRow(page)).toContainText(mark);
    });
  }
});
