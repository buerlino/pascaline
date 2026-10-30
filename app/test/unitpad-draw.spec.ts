// SPDX-License-Identifier: GPL-3.0-or-later
// R24b: the unit pad drawn on the keys (`?pad=1`, dev only, until R24c opens it from the units key). Every cell, by
// keys and by touch (tap, flick up, flick down, Shift then the cell, Alpha then the cell), emits its action through the
// keypad's own gesture code; a user cell emits its unit; the cells are drawn in the keys' faces and legends, and every
// legend fits its key at 360 px.
import { expect, test, type Page } from "@playwright/test";
import { entryValue, flick, open, tap } from "./helpers.ts";

type Emit = { do: string; [k: string]: unknown };
interface Cell { key: string; kind: string; tap?: { emit: Emit }; up?: { emit: Emit }; down?: { emit: Emit } }

test.use({ viewport: { width: 360, height: 740 } });
test.beforeEach(async ({ page }) => {
  await open(page, "engine=fake&pad=1");
  await page.waitForFunction(() => window.pascaline.unitPad.model !== null);
});

const cells = (page: Page): Promise<Cell[]> => page.evaluate(() => JSON.parse(JSON.stringify(window.pascaline.unitPad.model?.cells ?? [])) as Cell[]);
const log = (page: Page): Promise<Emit[]> => page.evaluate(() => JSON.parse(JSON.stringify(window.pascaline.unitPad.log)) as Emit[]);
const clear = (page: Page): Promise<void> => page.evaluate(() => void (window.pascaline.unitPad.log.length = 0));
const onKey = (page: Page, id: string, layer?: "shift" | "alpha"): Promise<void> => page.evaluate(([i, l]) => window.pascaline.entry.onKey(i as string, l as never), [id, layer]);
const LAYERS = [["primary", "tap"], ["shift", "up"], ["alpha", "down"]] as const;

/** One press of `id` in `layer`, however the test reaches it. */
type Reach = (page: Page, id: string, layer: "primary" | "shift" | "alpha") => Promise<void>;
const ways: Record<string, Reach> = {
  "by keys": async (p, id, layer) => onKey(p, id, layer === "primary" ? undefined : layer),
  "by keys, Shift or Alpha then the cell": async (p, id, layer) => {
    if (layer !== "primary") await onKey(p, layer);
    await onKey(p, id);
  },
  "by touch, tap and flicks": async (p, id, layer) => (layer === "primary" ? tap(p, [id]) : flick(p, id, layer === "shift" ? "up" : "down")),
  "by touch, Shift or Alpha then the cell": async (p, id, layer) => tap(p, layer === "primary" ? [id] : [layer, id]),
};

for (const [name, reach] of Object.entries(ways))
  test(`every cell emits its action ${name}`, async ({ page }) => {
    const all = await cells(page);
    expect(all.length).toBeGreaterThan(40);
    for (const c of all)
      for (const [layer, leg] of LAYERS) {
        await clear(page);
        await reach(page, c.key, layer);
        const got = await log(page);
        // ⌫ fires on touch and has no flicks (gestures.ts REPEAT_KEYS): a slide on it is the tap
        const flicked = name === "by touch, tap and flicks" && c.key === "bksp" && layer !== "primary";
        expect(got, `${c.key} ${layer}`).toEqual(flicked ? [{ do: "delete" }] : c[leg] ? [c[leg].emit] : []);
      }
    // the pad typed nothing, and the one-shot Shift or Alpha was used up by each cell
    expect(await entryValue(page)).toBe("");
    expect(await page.evaluate(() => [window.pascaline.session.shift, window.pascaline.session.alpha])).toEqual([false, false]);
  });

test("a user cell emits its unit; an empty one shows a dim + and is dead", async ({ page }) => {
  await clear(page);
  await tap(page, ["u3"]);
  await flick(page, "u3", "up");
  await flick(page, "u4", "up");
  expect(await log(page)).toEqual([{ do: "unit", id: "s_ton" }, { do: "unit", id: "l_ton" }, { do: "unit", id: "eV" }]);
  await expect(page.locator('[data-key="u3"] .main')).toHaveText("ton");
  await expect(page.locator('[data-key="u3"] .shiftlegend')).toHaveText("l ton");
  await expect(page.locator('[data-key="u3"]')).toHaveAttribute("data-user", "set");
  await page.evaluate(() => {
    const m = window.pascaline.unitPad.model;
    if (m) window.pascaline.unitPad.model = new (m.constructor as new (u: object) => typeof m)({});
  });
  await expect(page.locator('[data-key="u1"] .main')).toHaveText("+");
  await expect(page.locator('[data-key="u1"]')).toHaveAttribute("data-user", "empty");
  await clear(page);
  await tap(page, ["u1"]);
  expect(await log(page)).toEqual([]);
});

test("the cells are the keys' own faces and legends, the prefixes in their own colour", async ({ page }) => {
  const text = (id: string, part: string) => page.locator(`[data-key="${id}"] .${part}`);
  await expect(text("d9", "main")).toHaveText("m");
  await expect(text("d9", "shiftlegend")).toHaveText("ft");
  await expect(text("d9", "alphalegend")).toHaveText("in");
  await expect(text("vars", "alphalegend")).toHaveText("mil");
  await expect(text("math", "main")).toHaveText("Find");
  await tap(page, ["shift"]);
  await expect(text("d9", "main")).toHaveText("ft");
  await expect(text("d9", "shiftlegend")).toHaveText("");
  await tap(page, ["shift"]); // off again
  const bg = (id: string): Promise<string> => page.locator(`[data-key="${id}"]`).evaluate((el) => getComputedStyle(el).backgroundColor);
  await expect(page.locator('[data-key="d1"]')).toHaveAttribute("data-pad", "prefix");
  await expect(page.locator('[data-key="d9"]')).toHaveAttribute("data-pad", "unit");
  expect(await bg("d1")).not.toBe(await bg("d9")); // the prefix m and the metre m never look alike
  expect(await bg("d1")).toBe(await bg("d7"));
  // the keys outside the pad are as they were
  await expect(text("esc", "main")).toHaveText("Esc");
  await tap(page, ["esc", "undo"]);
  expect(await log(page)).toEqual([]);
});

test("a flick on a cell shows its unit in the bubble; no flick there is ✕", async ({ page }) => {
  const { touch } = await import("./helpers.ts");
  const f = await touch(page, "d9");
  await f.move(0, -35);
  await expect(page.getByTestId("flick-bubble")).toHaveText("ft");
  await f.end();
  const g = await touch(page, "d1"); // the prefix m has no flick down
  await g.move(0, 35);
  await expect(page.getByTestId("flick-bubble")).toHaveText("✕");
  await g.end();
  expect(await log(page)).toEqual([{ do: "unit", id: "ft" }]);
});

test("every legend and face fits its key within the fit code's floor at 360 px", async ({ page }) => {
  for (const state of [[], ["shift"], ["alpha"]]) {
    await tap(page, state);
    const bad = await page.evaluate(() => {
      const out: string[] = [];
      for (const key of document.querySelectorAll<HTMLElement>(".pad .key")) {
        const room = key.clientWidth - parseFloat(getComputedStyle(key).paddingLeft) - parseFloat(getComputedStyle(key).paddingRight);
        for (const el of key.querySelectorAll<HTMLElement>("[data-fit]")) {
          if (el.textContent === "") continue;
          const floor = el.dataset["fit"] === "legend" ? 8 : 9;
          if (el.scrollWidth > room + 0.5 || parseFloat(getComputedStyle(el).fontSize) < floor)
            out.push(`${key.dataset["key"]} ${el.className} "${el.textContent}" ${el.scrollWidth}/${room}px at ${getComputedStyle(el).fontSize}`);
        }
      }
      return out;
    });
    expect(bad, state.join("+") || "plain").toEqual([]);
    if (state.length) await tap(page, state); // off again
  }
});
