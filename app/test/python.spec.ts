// SPDX-License-Identifier: GPL-3.0-or-later
// Python app key-sequence tests on the real engines (docs/shifts/brief.md section 8, item 2).
// Needs MicroPython in public/python/ (PYTHON_OUT=<dir> for npm run engine:copy). Expected values: derived.
import { expect, test, type Page } from "@playwright/test";
import { open, tap } from "./helpers.ts";

test.beforeEach(async ({ page }) => {
  await open(page, "");
  await page.waitForFunction(() => window.pascaline.session.engineState === "ready", undefined, { timeout: 20_000 });
});

/** Apps → Python, at a view; waits until MicroPython is ready. */
async function openPython(page: Page, view: "symb" | "plot" | "num"): Promise<void> {
  await tap(page, ["apps", "d3"]);
  await expect(page.locator('[data-app="python"]')).toBeVisible();
  await tap(page, [view]);
  await expect(page.getByTestId("python")).toHaveAttribute("data-status", "ready", { timeout: 20_000 });
}

const transcript = (page: Page) => page.getByTestId("py-transcript");
const lastOut = (page: Page) => transcript(page).locator('pre[data-kind="out"]').last();

/**
 * Type into the focused CodeMirror view: characters on the physical keyboard, each newline with our Enter
 * key (CodeMirror's Android input path, used under the phone profile, may merge a fast typed Enter).
 */
async function typeText(page: Page, text: string): Promise<void> {
  const parts = text.split("\n");
  for (let i = 0; i < parts.length; i++) {
    if (parts[i]) await page.keyboard.type(parts[i] as string);
    if (i < parts.length - 1) await tap(page, ["enter"]);
  }
}

test("Python shell: print(1+1) by keys gives 2; calc.cas factors through Giac", async ({ page }) => {
  await openPython(page, "num");
  // p r i n t ( 1 + 1 ) with alpha lock for the letters
  await tap(page, ["alpha", "alpha", "d4", "d6", "pi", "div", "log", "alpha", "lpar", "d1", "add", "d1", "rpar", "enter"]);
  await expect(lastOut(page)).toHaveText("2");
  await typeText(page, "import calc\n");
  await typeText(page, 'calc.cas("factor(x^2-1)")\n');
  await expect(lastOut(page)).toHaveText("'(x-1)*(x+1)'");
});

test("Python shell: a Home variable is read from Python, and a value Python writes is seen in Home", async ({ page }) => {
  // Home: A := 7
  await tap(page, ["shift", "alpha", "sin", "shift", "comma", "d7", "enter"]);
  await expect(page.locator('[data-testid="result"] .result').last()).toHaveAttribute("data-text", "7");
  await openPython(page, "num");
  await typeText(page, "import calc\n");
  await typeText(page, 'print(calc.cas("A*6"))\n');
  await expect(lastOut(page)).toHaveText("42");
  await typeText(page, 'calc.cas("B:=A+1")\n');
  await expect(transcript(page).locator("pre").last()).toContainText("8");
  await tap(page, ["app"]); // back to Home
  await tap(page, ["shift", "alpha", "cos", "enter"]);
  await expect(page.locator('[data-testid="result"] .result').last()).toHaveAttribute("data-text", "8");
});

test("Python editor: a saved script survives a reload and runs; an error shows its line number", async ({ page }) => {
  await openPython(page, "symb");
  await page.locator(".cm-content").first().focus();
  await typeText(page, "x = 6\nprint(x * 7)\n");
  await page.waitForTimeout(500); // the script is stored after 300 ms
  await page.reload();
  await page.waitForFunction(() => window.pascaline !== undefined);
  await tap(page, ["apps", "d3", "symb"]);
  await expect(page.locator(".cm-content").first()).toContainText("print(x * 7)");
  await expect(page.getByTestId("python")).toHaveAttribute("data-status", "ready", { timeout: 20_000 });
  await tap(page, ["menu", "d1"]); // Run
  await expect(page.locator('[data-view="num"]')).toHaveAttribute("aria-selected", "true");
  await expect(lastOut(page)).toHaveText("42");
  // an error on line 3
  await tap(page, ["symb"]);
  await page.locator(".cm-content").first().focus();
  await page.keyboard.press("Control+End");
  await typeText(page, "print(y)\n");
  await tap(page, ["menu", "d1"]);
  await tap(page, ["symb"]);
  await expect(page.getByTestId("py-error")).toHaveAttribute("data-line", "3");
  await expect(page.getByTestId("py-error")).toContainText("Line 3: NameError");
});

/** One pixel of the Python canvas as 0xRRGGBB. */
const pixel = (page: Page, x: number, y: number): Promise<number> =>
  page.evaluate(
    ([x, y]) => {
      const c = document.querySelector<HTMLCanvasElement>('[data-testid="py-canvas"]');
      const d = c?.getContext("2d")?.getImageData(x as number, y as number, 1, 1).data;
      return d ? ((d[0] as number) << 16) | ((d[1] as number) << 8) | (d[2] as number) : -1;
    },
    [x, y],
  );

test("Python graphics: a batch with a line and a circle is drawn on the 320×240 canvas", async ({ page }) => {
  // The drawing module's Python names arrive with gorge's graphics task; this drives the same command stream.
  await openPython(page, "plot");
  await expect(page.getByTestId("py-canvas")).toBeVisible();
  await page.evaluate(() => {
    const app = window.pascaline.shell.instance as unknown as { graphics(b: unknown[]): void };
    app.graphics([["clear", 0xffffff], ["line", 0, 10, 319, 10, 0xff0000], ["circle", 160, 120, 50, 0x0000ff], ["show"]]);
  });
  expect(await pixel(page, 100, 10)).toBe(0xff0000);
  expect(await pixel(page, 210, 120)).toBe(0x0000ff);
  expect(await pixel(page, 160, 120)).toBe(0xffffff);
  const box = await page.getByTestId("py-canvas").boundingBox();
  expect(box && Math.abs(box.width / box.height - 4 / 3) < 0.02).toBe(true);
});

test("Python graphics: a script draws a line and a circle; Run shows Graphics with those pixels", async ({ page }) => {
  await openPython(page, "symb");
  await page.locator(".cm-content").first().focus();
  await typeText(page, "import draw\ndraw.clear()\ndraw.line(0, 10, 319, 10, 0xff0000)\ndraw.circle(160, 120, 50, 0x0000ff)\n");
  await tap(page, ["menu", "d1"]); // Run
  await expect(page.locator('[data-view="plot"]')).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("py-canvas")).toBeVisible();
  // derived: the line covers y=10, the circle passes through (210, 120), its centre stays white
  await expect.poll(() => pixel(page, 100, 10)).toBe(0xff0000);
  await expect.poll(() => pixel(page, 210, 120)).toBe(0x0000ff);
  expect(await pixel(page, 160, 120)).toBe(0xffffff);
});

test("Python Cancel: Cancel stops while True: pass, and the next print(1) works; the editor keeps its text", async ({ page }) => {
  await openPython(page, "num");
  await typeText(page, "while True: pass\n\n");
  await expect(page.getByTestId("py-input")).toHaveAttribute("data-busy", "true");
  await page.waitForTimeout(300);
  await tap(page, ["cancel"]);
  await expect(page.getByTestId("py-input")).toHaveAttribute("data-busy", "false");
  await expect(transcript(page).locator('pre[data-kind="note"]').last()).toHaveText("Cancelled");
  await typeText(page, "print(1)\n");
  await expect(lastOut(page)).toHaveText("1");
});
