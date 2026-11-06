// SPDX-License-Identifier: GPL-3.0-or-later
// R12c: the key press is the only motion (owner, 2026-11-02). A pressed key looks different from a resting one in every
// family, in Plain keys and under High contrast (computed style, not a screenshot); no element has a transition or an
// animation, so prefers-reduced-motion has nothing left to turn off.
import { expect, test, type Page } from "@playwright/test";
import { open, tap } from "./helpers.ts";

const FAMILIES = ["n62", "graphite", "solarized", "gruvbox", "nord"] as const;
const MODES = [
  { keys: "colour", contrast: "normal" },
  { keys: "plain", contrast: "normal" },
  { keys: "colour", contrast: "high" },
  { keys: "plain", contrast: "high" },
] as const;

const set = (page: Page, family: string, brightness: string, keys: string, contrast: string): Promise<void> =>
  page.evaluate(
    async ([family, brightness, keys, contrast]) => {
      const url = "/src/theme/apply.ts";
      const m = (await import(/* @vite-ignore */ url)) as typeof import("../src/theme/apply.ts");
      await m.applyTheme({ family, brightness, contrast, keys } as never, document.documentElement);
    },
    [family, brightness, keys, contrast],
  );

/** What the key draws while held, as a pixel: the key's background, then its ::after layer over it (if any). */
const painted = (page: Page, id: string): Promise<{ rgba: number[]; after: string; filter: string }> =>
  page.evaluate((id) => {
    const el = document.querySelector<HTMLElement>(`.pad [data-key="${id}"]`);
    if (!el) throw new Error("no key");
    const c = document.createElement("canvas");
    c.width = c.height = 1;
    const g = c.getContext("2d", { willReadFrequently: true });
    if (!g) throw new Error("no canvas");
    const cs = getComputedStyle(el);
    const af = getComputedStyle(el, "::after");
    g.fillStyle = cs.backgroundColor;
    g.fillRect(0, 0, 1, 1);
    if (af.content !== "none" && af.content !== "normal") {
      g.fillStyle = af.backgroundColor;
      g.fillRect(0, 0, 1, 1);
    }
    return { rgba: [...g.getImageData(0, 0, 1, 1).data], after: af.content, filter: cs.filter };
  }, id);

for (const family of FAMILIES)
  for (const brightness of ["dark", "light"])
    test(`a held key differs from a resting one: ${family} ${brightness}, Plain keys and High contrast`, async ({ page }) => {
      await open(page);
      for (const id of ["d7", "add", "enter"]) {
        for (const m of MODES) {
          await set(page, family, brightness, m.keys, m.contrast);
          const box = await page.locator(`.pad [data-key="${id}"]`).boundingBox();
          if (!box) throw new Error(`no box for ${id}`);
          const rest = await painted(page, id);
          await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
          await page.mouse.down();
          const held = await painted(page, id);
          await page.mouse.up();
          const delta = Math.max(...rest.rgba.slice(0, 3).map((v, i) => Math.abs(v - (held.rgba[i] ?? v))));
          expect(delta, `${family} ${brightness} ${m.keys}/${m.contrast} ${id}: colour moved`).toBeGreaterThanOrEqual(24);
          expect(held.filter, "no brightness filter").toBe("none");
        }
      }
    });

// A trackpad zone is a transparent key over a round surface: its press is the glyph's opacity, no rectangle layer
// (whose corners would spill past the circle).
for (const m of MODES)
  test(`a held trackpad zone changes its opacity and draws no layer: ${m.keys}/${m.contrast}`, async ({ page }) => {
    await open(page);
    await set(page, "n62", "dark", m.keys, m.contrast);
    const state = (): Promise<{ opacity: string; after: string; bg: string }> =>
      page.evaluate(() => {
        const el = document.querySelector<HTMLElement>('.pad [data-key="up"]');
        if (!el) throw new Error("no key");
        return {
          opacity: getComputedStyle(el).opacity,
          after: getComputedStyle(el, "::after").content,
          bg: getComputedStyle(el).backgroundColor,
        };
      });
    const box = await page.locator('.pad [data-key="up"]').boundingBox();
    if (!box) throw new Error("no box for up");
    const rest = await state();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    const held = await state();
    await page.mouse.up();
    expect(rest.bg).toBe("rgba(0, 0, 0, 0)");
    expect(Number(held.opacity)).toBeGreaterThan(Number(rest.opacity));
    expect(["none", "normal"]).toContain(held.after);
  });

test("no element has a transition or an animation, sheets and tips included", async ({ page }) => {
  const scan = (): Promise<string[]> =>
    page.evaluate(() => {
      const bad: string[] = [];
      for (const el of document.querySelectorAll("*")) {
        for (const pseudo of [null, "::before", "::after"]) {
          const c = getComputedStyle(el, pseudo);
          // "Working…" (.late) is a 0 s animation with a delay: it draws nothing moving, it only hides for 150 ms
          const anim = c.animationName !== "none" && !el.classList.contains("late");
          const trans = c.transitionDuration.split(",").some((d) => parseFloat(d) > 0);
          if (anim || trans) bad.push(`${el.tagName.toLowerCase()}.${el.className}${pseudo ?? ""} ${c.animationName} ${c.transitionDuration}`);
        }
      }
      return bad;
    });
  await open(page);
  expect(await scan()).toEqual([]);
  await tap(page, ["tmpl"]);
  await page.locator('[role="menu"]').first().waitFor();
  expect(await page.locator('[role="menu"] [role="menuitem"]').count()).toBeGreaterThan(0);
  expect(await scan()).toEqual([]);
  await tap(page, ["esc"]);
  await open(page, "engine=fake&tips=on");
  await page.locator(".tips").first().waitFor();
  expect(await scan()).toEqual([]);
});
