// SPDX-License-Identifier: GPL-3.0-or-later
// R85: Shift + Fmt (and a flick up on Fmt) opens Mode on Angle; the Fmt key's tap is unchanged (fmt.spec.ts).
import { expect, test, type Page } from "@playwright/test";
import { flick, open, tap } from "./helpers.ts";

const title = (page: Page) => page.getByTestId("sheet-title");
const angle = (page: Page) => page.evaluate(() => window.pascaline.session.settings.angle);

test("Shift, Fmt opens Mode (on Angle: the next test steps its value)", async ({ page }) => {
  await open(page);
  await tap(page, ["shift", "fmt"]);
  await expect(title(page)).toHaveText("Mode");
});

test("a flick up on Fmt does what Shift, Fmt does", async ({ page }) => {
  await open(page);
  await flick(page, "fmt", "up");
  await expect(title(page)).toHaveText("Mode");
});

test("Shift, Fmt, ▶, Enter switches RAD → DEG", async ({ page }) => {
  await open(page);
  expect(await angle(page)).toBe("rad");
  await tap(page, ["shift", "fmt", "right", "enter"]);
  expect(await angle(page)).toBe("deg");
});

test("Shift, Fmt, 5 opens Settings", async ({ page }) => {
  await open(page);
  await tap(page, ["shift", "fmt", "d5"]);
  await expect(page.getByTestId("sheet-title")).toHaveText("Mode › Settings");
});

test("the Fmt key's Shift legend reads Mode and fits its face in every theme family", async ({ page }) => {
  await open(page);
  for (const family of ["pascaline", "graphite", "solarized", "gruvbox", "nord"]) {
    await page.evaluate(
      async (family) => {
        const url = "/src/theme/apply.ts";
        const m = (await import(/* @vite-ignore */ url)) as typeof import("../src/theme/apply.ts");
        await m.applyTheme({ family, brightness: "dark", contrast: "normal", keys: "colour" } as never, document.documentElement);
      },
      family,
    );
    const r = await page.locator('[data-key="fmt"]').evaluate((key) => {
      const l = key.querySelector<HTMLElement>(".shiftlegend");
      return { text: l?.textContent?.trim(), fits: l ? l.scrollWidth <= key.clientWidth : false };
    });
    expect(r, family).toEqual({ text: "Mode", fits: true });
  }
});
