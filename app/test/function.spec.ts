// SPDX-License-Identifier: GPL-3.0-or-later
// Function app key-sequence tests on the real engine (docs/shifts/brief.md section 8, item 2).
// Expected numbers: oracle = mpmath 1.3.0 at 30 digits, rounded to 12 significant digits.
import { expect, test, type Page } from "@playwright/test";
import { entryValue, open, tap } from "./helpers.ts";

test.beforeEach(async ({ page }) => {
  await open(page, "");
  await page.waitForFunction(() => window.pascaline.session.engineState === "ready", undefined, { timeout: 20_000 });
});

/** Enter sin(x) in F1 and x^3-2x in F2 from Home, by keys. */
async function defineTwo(page: Page): Promise<void> {
  await tap(page, ["@symb"]);
  await expect(page.locator('[data-app="function"]')).toBeVisible();
  await expect(page.getByTestId("place")).toHaveAttribute("data-view", "symb");
  await expect(page.getByTestId("entry-label")).toHaveText("F1(x)=");
  await tap(page, ["sin", "x", "enter"]);
  await tap(page, ["down"]);
  await expect(page.getByTestId("entry-label")).toHaveText("F2(x)=");
  await tap(page, ["x", "pow", "d3", "right", "sub", "d2", "x", "enter"]);
  expect(await entryValue(page)).toBe("x^3-2x");
  await expect(page.locator('[data-name="F1"] .math')).toHaveAttribute("data-latex", "\\sin\\left(x\\right)");
  await expect(page.locator('[data-name="F2"] .math')).toHaveAttribute("data-latex", "x^3-2x");
}

const engineHome = (page: Page, giac: string): Promise<string> =>
  page.evaluate(async (g) => (await window.pascaline.calc.home(g, { digits: 12, angle: "rad", format: "std" })).display, giac);

test("Function: sin(x) and x^3-2x are drawn; the trace y comes from the engine", async ({ page }) => {
  await defineTwo(page);
  await tap(page, ["@plot"]);
  await expect(page.locator(".board canvas")).toBeVisible();
  await page.waitForFunction(() => window.pascaline.plot.board !== undefined);
  expect(await page.evaluate(() => window.pascaline.plot.curves)).toBe(2);
  await expect(page.getByTestId("trace-y")).toHaveAttribute("data-text", "0");
  // one trace step is 0.1 at the default window (virtual-calc, G2 item 24)
  await tap(page, ["right", "right", "right", "right", "right", "right"]);
  await expect(page.getByTestId("trace-x")).toHaveText("0.6");
  await expect(page.getByTestId("trace-y")).toHaveAttribute("data-text", "0.564642473395"); // oracle
  expect(await engineHome(page, "sin(0.6)")).toBe("0.564642473395");
  // ▼ traces F2: 0.6^3 - 1.2 = -0.984 (derived)
  await tap(page, ["down"]);
  await expect(page.getByTestId("trace-y")).toHaveAttribute("data-text", "-0.984");
});

test("Function: Num shows a table whose values match the engine", async ({ page }) => {
  await defineTwo(page);
  await tap(page, ["@num"]);
  // Num starts at 0 with step 0.1 (virtual-calc, G2 items 19 and 24)
  await expect(page.locator('[data-testid="num-table"] td.x').first()).toHaveText("0");
  await expect(page.locator('[data-testid="num-table"] td.x').nth(1)).toHaveText("0.1");
  await tap(page, ["@menu", "d2", "d1", "enter"]); // step 1
  const row = page.locator('[data-testid="num-table"] tr:has(td[data-x="1"])');
  await expect(row.locator("td").nth(1)).toHaveAttribute("data-text", "0.841470984808"); // oracle sin(1)
  await expect(row.locator("td").nth(2)).toHaveAttribute("data-text", "-1");
  expect(await engineHome(page, "sin(1)")).toBe("0.841470984808");
  // start 0.5 through the entry line, step 0.25 through the menu
  await tap(page, ["d0", "dot", "d5", "enter"]);
  await expect(page.locator('[data-testid="num-table"] td.x').first()).toHaveText("0.5");
  await tap(page, ["@menu", "d2", "d0", "dot", "d2", "d5", "enter"]);
  await expect(page.locator('[data-testid="num-table"] td.x').nth(1)).toHaveText("0.75");
  // ▼ scrolls by a row
  await tap(page, ["down"]);
  await expect(page.locator('[data-testid="num-table"] td.x').first()).toHaveText("0.75");
});

test("Function: root, extremum and intersection from the Plot menu (oracle)", async ({ page }) => {
  await defineTwo(page);
  await tap(page, ["@plot"]);
  await page.waitForFunction(() => window.pascaline.plot.board !== undefined);
  await tap(page, ["down"]); // trace F2
  await tap(page, Array<string>(10).fill("right")); // x = 1
  await expect(page.getByTestId("trace-x")).toHaveText("1");
  await tap(page, ["@menu", "d1"]); // Root
  await expect(page.getByTestId("readout-x")).toHaveText("1.41421356237"); // oracle sqrt(2)
  await expect(page.getByTestId("readout-info")).not.toHaveText(/⚠/);
  await tap(page, ["@menu", "d2"]); // Extremum near 1.414
  await expect(page.getByTestId("readout-x")).toHaveText("0.816496580928"); // oracle sqrt(2/3)
  await expect(page.getByTestId("readout-y")).toHaveText("-1.0886621079"); // oracle
  await tap(page, Array<string>(8).fill("right")); // 0.8 → 1.6
  await expect(page.getByTestId("trace-x")).toHaveText("1.6");
  // Intersection asks for the second function: the other functions that are on, then the x-axis (virtual-calc, G2 item 25)
  await tap(page, ["@menu", "d3"]);
  const list = page.getByTestId("menu").getByRole("menu");
  await expect(list).toHaveAttribute("aria-label", "Intersection of F2(x) and");
  await expect(list.getByRole("menuitem")).toHaveText(["1F1(x)", "2x-axis"]);
  await tap(page, ["d1"]); // F1
  await expect(page.getByTestId("readout-x")).toHaveText("1.61784493243"); // oracle findroot
  await expect(page.getByTestId("readout-y")).toHaveText("0.998893418501");
});

test("Function: definitions, window and view survive a reload", async ({ page }) => {
  await defineTwo(page);
  await tap(page, ["@plot"]);
  await page.waitForFunction(() => window.pascaline.plot.board !== undefined);
  await page.evaluate(() => window.pascaline.shell.flush());
  await page.waitForTimeout(300);
  await page.reload();
  await page.waitForFunction(() => window.pascaline?.shell?.current !== undefined, undefined, { timeout: 20_000 });
  await expect(page.locator('[data-app="function"]')).toBeVisible();
  await expect(page.getByTestId("place")).toHaveAttribute("data-view", "plot");
  await tap(page, ["@symb"]);
  await expect(page.locator('[data-name="F2"] .math')).toHaveAttribute("data-latex", "x^3-2x");
});

test("Function: a sign change at the pole of 1/x is not a root: ⚠ and no x", async ({ page }) => {
  await tap(page, ["@symb"]);
  await expect(page.getByTestId("entry-label")).toHaveText("F1(x)=");
  await tap(page, ["d1", "div", "x", "enter", "@plot"]);
  await page.waitForFunction(() => window.pascaline.plot.board !== undefined);
  await tap(page, ["right", "right"]); // x = 0.2
  await expect(page.getByTestId("trace-y")).toHaveAttribute("data-text", "5"); // derived
  await tap(page, ["@menu", "d1"]);
  await expect(page.getByTestId("readout-info")).toContainText("⚠");
  await expect(page.getByTestId("readout-x")).toHaveCount(0);
});

test("Function: signed area of x^2 from 0 to 1 is 1/3 (derived)", async ({ page }) => {
  await tap(page, ["@symb"]);
  await expect(page.getByTestId("entry-label")).toHaveText("F1(x)=");
  await tap(page, ["x", "sq", "enter", "@plot"]);
  await page.waitForFunction(() => window.pascaline.plot.board !== undefined);
  await tap(page, ["@menu", "d5"]); // start at x = 0
  await tap(page, Array<string>(10).fill("right")); // x = 1
  await expect(page.getByTestId("trace-x")).toHaveText("1");
  await tap(page, ["enter"]);
  await expect(page.getByTestId("readout-Signed area")).toHaveText("0.333333333333");
});

test("Function: Intersection with the x-axis is a root; Esc steps back out of the list", async ({ page }) => {
  await defineTwo(page);
  await tap(page, ["@plot"]);
  await page.waitForFunction(() => window.pascaline.plot.board !== undefined);
  await tap(page, ["down", ...Array<string>(10).fill("right")]); // F2 at x = 1
  await tap(page, ["@menu", "d3"]);
  await expect(page.getByTestId("menu").getByRole("menu")).toHaveAttribute("aria-label", "Intersection of F2(x) and");
  await tap(page, ["esc"]); // back one level (R15c: no close-all key)
  await expect(page.getByTestId("menu").getByRole("menu")).toHaveAttribute("aria-label", "Menu");
  await tap(page, ["esc"]);
  await expect(page.getByTestId("menu")).toHaveCount(0);
  await expect(page.getByTestId("readout-x")).toHaveCount(0);
  await tap(page, ["@menu", "d3", "d2"]); // x-axis
  await expect(page.getByTestId("readout-x")).toHaveText("1.41421356237"); // oracle sqrt(2), as golden root-sqrt2
  await expect(page.getByTestId("readout-y")).toHaveText("0");
  // the plain menu comes back on the next Menu press
  await tap(page, ["@menu"]);
  await expect(page.getByTestId("menu").getByRole("menu")).toHaveAttribute("aria-label", "Menu");
});

test("Function: Num shows NaN at the pole of 1/x (virtual-calc, G2 item 19)", async ({ page }) => {
  await tap(page, ["@symb"]);
  await expect(page.getByTestId("entry-label")).toHaveText("F1(x)=");
  await tap(page, ["d1", "div", "x", "enter", "@num"]);
  const cell = (x: string) => page.locator(`[data-testid="num-table"] tr:has(td[data-x="${x}"]) td`).nth(1);
  await expect(cell("0")).toHaveAttribute("data-text", "NaN");
  await expect(cell("0.1")).toHaveAttribute("data-text", "10");
  await expect(cell("0.3")).toHaveAttribute("data-text", "3.33333333333");
});

test("Esc stops a running Num job; the definitions survive", async ({ page }) => {
  await open(page, "engine=fake&delay=4000");
  await tap(page, ["@symb"]);
  await expect(page.getByTestId("entry-label")).toHaveText("F1(x)=");
  await tap(page, ["sin", "x", "enter", "@num"]);
  await page.waitForFunction(() => window.pascaline.shell.busy);
  await tap(page, ["esc"]);
  await page.waitForFunction(() => !window.pascaline.shell.busy, undefined, { timeout: 1000 });
  await tap(page, ["@symb"]);
  await expect(page.locator('[data-name="F1"] .math')).toHaveAttribute("data-latex", "\\sin\\left(x\\right)");
});

test("keys typed while the app's code is still loading are kept (regression)", async ({ page }) => {
  await tap(page, ["@symb", "sin", "x", "enter", "down", "d1", "div", "x", "enter"]);
  await expect(page.locator('[data-name="F1"] .math')).toHaveAttribute("data-latex", "\\sin\\left(x\\right)");
  await expect(page.locator('[data-name="F2"] .math')).toHaveAttribute("data-latex", "\\frac{1}{x}");
});

test("Apps key lists Home, CAS and the apps; U2 (Home by default) goes back to Home", async ({ page }) => {
  await tap(page, ["@place"]);
  await expect(page.getByTestId("apps")).toBeVisible();
  await tap(page, ["d4"]);
  await expect(page.locator('[data-app="solve"]')).toBeVisible();
  await tap(page, ["@home"]);
  await expect(page.getByTestId("place")).toHaveAttribute("data-view", "home");
  await tap(page, ["d1", "add", "d1", "enter"]);
  await expect(page.locator('[data-testid="result"] .result').last()).toHaveAttribute("data-text", "2");
});

test("Function: a warned root puts ⚠ on its readout lines, a clean one does not (M4-10)", async ({ page }) => {
  await defineTwo(page);
  await tap(page, ["@plot"]);
  await page.waitForFunction(() => window.pascaline.plot.board !== undefined);
  await tap(page, ["down"]);
  await tap(page, Array<string>(10).fill("right"));
  await tap(page, ["@menu", "d1"]); // Root
  await expect(page.getByTestId("readout-x")).toHaveText("1.41421356237");
  await expect(page.getByTestId("readout").getByTestId("mark")).toHaveCount(0);
  // the same root with fewer confirmed digits than shown: the x line gets the mark, the digits stay
  await page.evaluate(() => {
    const app = window.pascaline.shell.loaded.function!.instance as unknown as {
      fc: { analyze(...a: unknown[]): Promise<{ x?: Record<string, unknown>; y?: Record<string, unknown> }> };
    };
    const orig = app.fc.analyze.bind(app.fc);
    app.fc.analyze = async (...a) => {
      const r = await orig(...a);
      for (const c of [r.x, r.y]) if (c) Object.assign(c, { exactRational: false, reliableDigits: 4 });
      return r;
    };
  });
  await tap(page, ["@menu", "d1"]);
  await expect(page.getByTestId("readout").getByTestId("mark")).toHaveText(["⚠"]); // x only: y is the exact 0 at a checked root
});

test("Function in DEG: sin(x) is drawn in degrees; the curve is 0 at 180 and 1 at 90 (R64a)", async ({ page }) => {
  await page.getByTestId("chip-angle").tap();
  expect(await page.evaluate(() => window.pascaline.session.settings.angle)).toBe("deg");
  await tap(page, ["@symb"]);
  await tap(page, ["sin", "x", "enter"]);
  await tap(page, ["@plot"]);
  await page.waitForFunction(() => window.pascaline.plot.board !== undefined);
  const y = (x: number): Promise<number> =>
    page.evaluate((xv) => {
      const b = window.pascaline.plot.board as unknown as { objectsList: { elType: string; Y(x: number): number }[] };
      return (b.objectsList.find((o) => o.elType === "curve") as { Y(x: number): number }).Y(xv);
    }, x);
  expect(Math.abs(await y(180))).toBeLessThan(1e-12); // radians would give -0.801
  expect(await y(90)).toBeCloseTo(1, 12);
  // a window around 180, the trace at 180 reads 0 (the engine's value, in DEG)
  // move the board itself (it reports the window back to the app, as a pan would)
  await page.evaluate(() => {
    const b = window.pascaline.plot.board as unknown as { setBoundingBox(bb: number[], keep: boolean): void };
    b.setBoundingBox([0, 2, 360, -2], false);
  });
  await page.waitForFunction(() => {
    const f = window.pascaline.shell.loaded.function!.instance as unknown as { win: { xmax: number } | null };
    return f.win !== null && f.win.xmax > 300;
  });
  await page.evaluate(() => {
    const f = window.pascaline.shell.loaded.function!.instance as unknown as { traceTo(x: number): void };
    f.traceTo(180);
  });
  await expect(page.getByTestId("trace-x")).toHaveText("180");
  await expect(page.getByTestId("trace-y")).toHaveAttribute("data-text", "0");
  // Root from the trace at about 175 gives 180 (the drawn curve crosses there too)
  await page.evaluate(() => {
    const f = window.pascaline.shell.loaded.function!.instance as unknown as { traceTo(x: number): void };
    f.traceTo(175);
  });
  await tap(page, ["@menu", "d1"]);
  await expect(page.getByTestId("readout-x")).toHaveText("180");
});
