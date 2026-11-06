// SPDX-License-Identifier: GPL-3.0-or-later
// R116: the entry line's highlights follow our look, not the system's scheme. Before, MathLive drew the box of the
// bracket that holds the cursor in its own colour, picked by `prefers-color-scheme`: on the APK's Dark look under
// Android's light scheme a near-white box hid the white digits (night review 2026-11-02, Tab One). Here the system
// scheme and our brightness are set opposite each other (and the same), in every family: after `(`, `0` the box is
// --pick, the caret --alpha, the selection --pick with --text glyphs; the unit view's field gets the same mapping.
import { expect, test, type Page } from "@playwright/test";
import { open, tap } from "./helpers.ts";

const FAMILIES = ["n62", "graphite", "solarized", "gruvbox", "nord"] as const;

/** Put a look on the page as Settings › Appearance does, and wait for its colours (the lazy family file too). */
async function setLook(page: Page, family: string, brightness: "dark" | "light"): Promise<void> {
  await page.evaluate(
    ([f, b]) => {
      const s = window.n62.session;
      s.settings.look = { ...s.settings.look, family: f as typeof s.settings.look.family, brightness: b as "dark" | "light" };
      s.onLook?.({ ...s.settings.look });
    },
    [family, brightness],
  );
  await page.waitForFunction(([f, b]) => document.documentElement.dataset["family"] === f && document.documentElement.dataset["brightness"] === b, [family, brightness]);
  await page.waitForTimeout(300); // the lazy family file is in (the box and the tokens are read together after it)
}

/** What the entry line draws, as rgb() strings, next to what the tokens say. Every lookup throws when its value is
 *  missing (an unset token or MathLive variable, an empty computed value), so no check can pass on an inherited colour. */
function colours(page: Page, testid?: string) {
  return page.evaluate((id) => {
    const SENTINEL = "rgb(1, 2, 3)";
    /** A colour value as the browser computes it; inside a wrapper of a colour no theme uses, so a value that does not
     *  resolve (it would inherit) throws instead of passing as the page's text colour. */
    const rgb = (value: string, what: string): string => {
      if (!value.trim()) throw new Error(`${what}: empty value`);
      const w = document.createElement("div");
      w.style.color = SENTINEL;
      const d = document.createElement("div");
      d.style.color = value;
      w.append(d);
      document.body.append(w);
      const out = getComputedStyle(d).color;
      w.remove();
      if (out === SENTINEL) throw new Error(`${what}: ${value} does not resolve`);
      return out;
    };
    const root = getComputedStyle(document.documentElement);
    const tok = (name: string): string => rgb(root.getPropertyValue(`--${name}`), `--${name}`);
    const mf = id ? document.querySelector<HTMLElement>(`[data-testid="${id}"]`) : window.n62.entry.field;
    const sr = mf?.shadowRoot;
    if (!sr) throw new Error("no field");
    const cont = sr.querySelector(".ML__container");
    if (!cont) throw new Error("no .ML__container");
    const v = (name: string): string => rgb(getComputedStyle(cont).getPropertyValue(name), name);
    const box = sr.querySelector(".ML__contains-highlight");
    const sel = sr.querySelector(".ML__selection");
    const glyph = sr.querySelector(".ML__selected");
    // the bracket's own glyphs: MathLive colours the ( and ) of the pair that holds the cursor (not the box, an empty div)
    const brackets = [...sr.querySelectorAll(".ML__contains-caret.ML__open, .ML__contains-caret.ML__close")].map((e) => getComputedStyle(e).color);
    return {
      pick: tok("pick"),
      alpha: tok("alpha"),
      text: tok("text"),
      box: box ? getComputedStyle(box).backgroundColor : "no box",
      boxVar: v("--_contains-highlight-background-color"),
      bracketVar: v("--_contains-highlight-color"),
      brackets,
      caret: v("--_caret-color"),
      selVar: v("--_selection-background-color"),
      selColor: v("--_selection-color"),
      sel: sel ? getComputedStyle(sel).backgroundColor : "no selection",
      glyph: glyph ? getComputedStyle(glyph).color : "no glyph",
    };
  }, testid);
}

for (const [system, look] of [["light", "dark"], ["dark", "light"], ["dark", "dark"], ["light", "light"]] as const)
  for (const family of FAMILIES)
    test(`${family} ${look} under a ${system} system: ( 0 draws the bracket's box in --pick, the caret in --alpha; a selection is --pick with --text`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: system });
      await open(page);
      await setLook(page, family, look);
      await tap(page, ["paren", "d0"]);
      const c = await colours(page);
      expect(c.box, "the box of the bracket that holds the cursor").toBe(c.pick);
      expect(c.caret, "the caret").toBe(c.alpha);
      expect(c.brackets, "the bracket's own glyphs, ( and )").toEqual([c.text, c.text]);
      await page.evaluate(() => window.n62.entry.field?.executeCommand("extendSelectionBackward"));
      const s = await colours(page);
      expect(s.sel, "the selection").toBe(s.pick);
      expect(s.glyph, "the selected glyph").toBe(s.text);
    });

test("the unit view's field (dark look, light system) takes the same mapping", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await open(page);
  await setLook(page, "n62", "dark");
  await tap(page, ["d1", "shift", "tmpl"]);
  await page.getByTestId("unit-field").waitFor();
  const c = await colours(page, "unit-field");
  expect([c.boxVar, c.selVar, c.caret, c.selColor, c.bracketVar]).toEqual([c.pick, c.pick, c.alpha, c.text, c.text]);
});
