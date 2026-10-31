// SPDX-License-Identifier: GPL-3.0-or-later
// R24d: Find in a unit slot and the user cells of the unit pad (docs/archive/r9-unit-pad.md 2.9 and section 1). Math in a
// slot opens Find on units and prefixes, an empty query shows the units menu by category, a pick lands as tokens (a
// prefixed unit as a prefix and a unit), the units that are not on the pad each within the probe's Find count, a user
// cell is set from a Find hit ("Put on the unit pad": the cell, then its tap, up or down) and from Settings › Your keys ›
// Unit pad cells, survives a restart and resets to its default, an empty user cell opens Find, and a unit without an exact
// factor is marked in its row.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import { parse } from "yaml";
import { flick, open, tap } from "./helpers.ts";

type Tok = { prefix?: string; unit: string; power?: string };
const here = (p: string): string => fileURLToPath(new URL(p, import.meta.url));

const up = (page: Page): Promise<unknown> =>
  page.waitForFunction(() => window.pascaline.unitView !== undefined && document.activeElement === window.pascaline.unitView.element && document.querySelector('[data-pad="unit"]') !== null);
const unitsKey = async (page: Page): Promise<void> => {
  await flick(page, "tmpl", "up");
  await up(page);
};
const find = (page: Page) => page.getByTestId("find");
const rows = (page: Page) => find(page).getByRole("menuitem");
const row = (page: Page, id: string) => find(page).locator(`[role="menuitem"][data-id="${id}"]`);
const slot = (page: Page, id = "u1"): Promise<{ tokens: Tok[]; per?: number } | undefined> =>
  page.evaluate((id) => window.pascaline.unitView?.view.model(id)?.slot, id);
const tokens = async (page: Page): Promise<Tok[]> => (await slot(page))?.tokens ?? [];

/** The key whose Alpha layer is a letter: Find types it on a flick down, on any key (docs/04 3.7). */
const LETTER = new Map<string, string>();
for (const k of (parse(readFileSync(here("../../spec/keyboard.yaml"), "utf8")) as { keys: { id: string; alpha?: { type?: string } }[] }).keys) {
  const t = k.alpha?.type;
  if (t !== undefined && /^[A-Za-z]$/.test(t) && !LETTER.has(t.toLowerCase())) LETTER.set(t.toLowerCase(), k.id);
}
/** Type letters into Find: one press each, a tap (a digit key picks a row on an empty query, so a flick down there). */
async function typeFind(page: Page, text: string): Promise<void> {
  for (const ch of text.toLowerCase()) {
    const id = LETTER.get(ch);
    if (!id) throw new Error(`no key types ${ch}`);
    if (/^d\d$/.test(id)) await flick(page, id, "down");
    else await tap(page, [id]);
  }
}
/** Math, then wait for Find to be drawn: a flick typed while its code loads would be taken for another key's (R8 queue). */
const openFind = async (page: Page, ...then: string[]): Promise<void> => {
  await tap(page, ["math"]);
  await expect(find(page)).toBeVisible();
  if (then.length) await tap(page, then);
};
/** A restart: the store write is asynchronous, so give it a moment; then the page again, as `open` leaves it. */
const restart = async (page: Page): Promise<void> => {
  await page.waitForTimeout(300);
  await page.reload();
  await page.waitForFunction(() => customElements.get("math-field") !== undefined && window.pascaline !== undefined);
  await page.evaluate(() => window.pascaline.entry.ready);
  await page.waitForTimeout(150);
};
const emptyOf = async (page: Page): Promise<void> => {
  for (let i = 0; i < 8 && !(await page.evaluate(() => window.pascaline.unitView?.view.model("u1")?.empty)); i++) await tap(page, ["bksp"]);
};

test.describe("Find in a slot", () => {
  test.beforeEach(async ({ page }) => open(page, "engine=fake"));

  test("Math opens Find on units and prefixes; the empty query shows the units menu by category, a category lists its units", async ({ page }) => {
    await unitsKey(page);
    await openFind(page);
    await expect(page.getByTestId("sheet-title")).toHaveText("Find");
    const ids = await rows(page).evaluateAll((els) => els.map((e) => e.getAttribute("data-id")));
    expect(ids.slice(0, 4)).toEqual(["ucat:prefixes", "ucat:Length", "ucat:Area", "ucat:Volume"]);
    expect(ids).toContain("ucat:Pressure");
    expect(ids).toContain("ucat:Electricity");
    await expect(row(page, "ucat:Length")).toContainText("Length");
    await tap(page, ["d2"]); // Length
    await expect(page.getByTestId("sheet-title")).toHaveText("Find › Length");
    const length = await rows(page).evaluateAll((els) => els.map((e) => e.getAttribute("data-id")));
    expect(length.slice(0, 3)).toEqual(["unit:m", "unit:km", "unit:cm"]);
    expect(length).toContain("unit:ft");
    await tap(page, ["esc"]);
    await tap(page, ["d1"]); // Prefixes
    const pfx = await rows(page).evaluateAll((els) => els.map((e) => e.getAttribute("data-id")));
    expect(pfx).toHaveLength(24);
    expect(pfx.slice(0, 2)).toEqual(["pfx:Y", "pfx:Z"]);
    await tap(page, ["esc", "esc"]); // back to the categories, then out
    await expect(find(page)).toBeHidden();
    await expect(page.locator('[data-key="d9"][data-pad="unit"]')).toBeVisible();
  });

  test("a pick lands in the slot as tokens: a prefixed unit as a prefix and a unit, a prefix from the list arms, a plain unit is one", async ({ page }) => {
    await unitsKey(page);
    await openFind(page);
    await typeFind(page, "mpa");
    await expect(rows(page).first()).toHaveAttribute("data-id", "unit:MPa");
    await tap(page, ["enter"]);
    await expect(find(page)).toBeHidden();
    expect(await tokens(page)).toEqual([{ prefix: "M", unit: "Pa" }]);
    await expect(page.getByTestId("unit-reading")).toHaveText("megapascal");
    await tap(page, ["bksp"]); // the unit goes, the prefix is armed again, as for two presses
    await tap(page, ["bksp"]);
    expect(await tokens(page)).toEqual([]);
    await openFind(page, "d1", "d7"); // Prefixes, 7: M
    expect(await page.evaluate(() => window.pascaline.unitView?.view.model("u1")?.armed)).toEqual({ prefix: "M", sqrt: false });
    await tap(page, ["bksp"]);
    await openFind(page);
    await typeFind(page, "psi");
    await tap(page, ["enter"]);
    expect(await tokens(page)).toEqual([{ unit: "psi" }]);
    // a product the menu names (Area: cm^2) goes in as its factors
    await emptyOf(page);
    await openFind(page, "d3"); // Area
    await row(page, "uprod:cm^2").tap();
    expect(await tokens(page)).toEqual([{ unit: "cm", power: "2" }]);
  });

  test("the units that are not on the pad, each within the probe's Find count (Math, the letters that make it the first hit, Enter)", async ({ page }) => {
    test.setTimeout(120_000);
    const wanted = ["angstrom", "arcmin", "arcsec", "mmHg", "oz", "cfm"];
    const probe = JSON.parse(
      execFileSync(
        process.execPath,
        [
          "--input-type=module",
          "-e",
          `import { byId, findCost } from ${JSON.stringify(here("../../tools/probes/find-cost.mjs"))};
           import { prepare, search } from ${JSON.stringify(here("../src/find/rank.ts"))};
           import { indexItems } from ${JSON.stringify(here("../../tools/probes/find-cost.mjs"))};
           const idx = prepare(indexItems);
           const out = {};
           for (const u of ${JSON.stringify(wanted)}) {
             const cost = findCost('unit:' + u);
             let query = null;
             for (const name of byId.get('unit:' + u).names) {
               const q = name.toLowerCase().replace(/[\\s_]/g, '');
               if (!/^[a-z0-9]+$/.test(q)) continue;
               for (let n = 1; n <= q.length && query === null; n++)
                 if (n + 2 === cost && search(idx, q.slice(0, n), { filter: ['unit', 'pfx'], prefer: ['unit'], limit: 1 })[0]?.item.id === 'unit:' + u) query = q.slice(0, n);
             }
             out[u] = { cost, query };
           }
           console.log(JSON.stringify(out));`,
        ],
        { encoding: "utf8" },
      ),
    ) as Record<string, { cost: number; query: string }>;
    await unitsKey(page);
    for (const u of wanted) {
      const { cost, query } = probe[u] as { cost: number; query: string };
      expect(query, u).toBeTruthy();
      await openFind(page);
      await typeFind(page, query);
      await tap(page, ["enter"]);
      const got = await tokens(page);
      const meant = got.map((t) => `${t.prefix ?? ""}${t.unit}`).join(" ");
      expect(meant, `${u} typed as ${query}`).toBe(u);
      expect(2 + query.length, `${u}: presses`).toBeLessThanOrEqual(cost);
      await emptyOf(page);
    }
  });

  test("a unit without an exact factor is marked in its row, in the search and in a category", async ({ page }) => {
    await unitsKey(page);
    await openFind(page);
    await typeFind(page, "db");
    await expect(row(page, "unit:dB").getByTestId("row-note")).toHaveText("converts only");
    await tap(page, ["esc"]);
    await openFind(page);
    await typeFind(page, "da");
    await expect(row(page, "unit:Da").getByTestId("row-note")).toHaveText("no exact factor");
    await tap(page, ["esc"]);
    await openFind(page, "d2"); // Length: every unit there has a factor
    await expect(find(page).getByTestId("row-note")).toHaveCount(0);
  });
});

test.describe("the user cells", () => {
  test.beforeEach(async ({ page }) => open(page, "engine=fake"));

  const cell = (page: Page, key: string) => page.locator(`[data-key="${key}"]`);

  test("'Put on the unit pad' on a Find hit: the cell, then its tap, up or down; the cell is drawn and works; it survives a restart", async ({ page }) => {
    await unitsKey(page);
    await expect(cell(page, "u1").locator(".main")).toHaveText("dB");
    await openFind(page);
    await typeFind(page, "mpa");
    await expect(page.getByTestId("find-put")).toHaveText("Put on the unit pad ▶");
    await tap(page, ["right"]); // ▶ on the row
    await expect(page.getByTestId("sheet-title")).toHaveText("Which cell?");
    await expect(page.getByRole("menuitem").first()).toContainText("U1");
    await tap(page, ["d1"]); // U1
    await expect(page.getByTestId("sheet-title")).toHaveText("Which cell? › U1");
    await expect(page.getByRole("menuitem")).toHaveCount(3);
    await tap(page, ["d2"]); // Flick up
    await expect(page.getByTestId("sheet-title")).toBeHidden();
    expect(await tokens(page)).toEqual([]); // the unit was put on the pad, not in the slot
    await expect(cell(page, "u1").locator(".shiftlegend")).toHaveText("MPa");
    await expect(cell(page, "u1").locator(".main")).toHaveText("dB"); // (the tap keeps its default)
    await flick(page, "u1", "up");
    expect(await tokens(page)).toEqual([{ prefix: "M", unit: "Pa" }]);
    await emptyOf(page);
    // a restart: the cells come from the stamped store
    await restart(page);
    await unitsKey(page);
    await expect(cell(page, "u1").locator(".shiftlegend")).toHaveText("MPa");
  });

  test("by touch: the button under the preview opens the cells; a restart keeps the leg, and the others keep their defaults", async ({ page }) => {
    await tap(page, ["shift", "tmpl"]); // the G2 way (no flick before the touch taps)
    await up(page);
    await openFind(page);
    await typeFind(page, "mmhg");
    await page.getByTestId("find-put").tap();
    await page.getByRole("menuitem", { name: /U6/ }).tap();
    await page.getByRole("menuitem", { name: /Flick down/ }).tap();
    await expect(cell(page, "u6").locator(".alphalegend")).toHaveText("mmHg");
    await restart(page); // the cells come from the stamped store
    await tap(page, ["shift", "tmpl"]);
    await up(page);
    await expect(cell(page, "u6").locator(".alphalegend")).toHaveText("mmHg");
    await expect(cell(page, "u6").locator(".main")).toHaveText("P"); // (the default tap)
    await flick(page, "u6", "down");
    expect(await tokens(page)).toEqual([{ unit: "mmHg" }]);
  });

  test("Settings › Your keys › Unit pad cells sets a leg from Find, empties it, and gives it its default back", async ({ page }) => {
    await tap(page, ["@mode", "d5", "d4"]);
    await expect(page.getByTestId("sheet-title")).toHaveText("Mode › Settings › Your keys");
    await page.locator('[role="menuitem"][data-id="unitcells"]').tap();
    await expect(page.getByTestId("sheet-title")).toHaveText("Settings › Your keys › Unit pad cells");
    const leg = (id: string) => page.locator(`[role="menuitem"][data-id="${id}"]`);
    await expect(leg("u1:primary").getByTestId("sheet-value")).toHaveText("dB");
    await expect(leg("u4:shift").getByTestId("sheet-value")).toHaveText("eV");
    await leg("u1:alpha").tap();
    await page.locator('[role="menuitem"][data-id="find"]').tap();
    await expect(find(page)).toBeVisible();
    await typeFind(page, "kwh");
    await tap(page, ["enter"]);
    await expect(find(page)).toBeHidden();
    // the leg is set: the pad shows it
    await restart(page);
    await unitsKey(page);
    await expect(cell(page, "u1").locator(".alphalegend")).toHaveText("kWh");
    await flick(page, "u1", "down");
    expect(await tokens(page)).toEqual([{ prefix: "k", unit: "Wh" }]);
    await emptyOf(page);
    // empty the tap in Settings: the cell is a "+" and opens Find
    await tap(page, ["esc"]);
    await tap(page, ["@mode", "d5", "d4"]);
    await page.locator('[role="menuitem"][data-id="unitcells"]').tap();
    await leg("u1:primary").tap();
    await page.locator('[role="menuitem"][data-id="empty"]').tap();
    await page.evaluate(() => window.pascaline.shell.closeSheet());
    await unitsKey(page);
    await expect(cell(page, "u1").locator(".main")).toHaveText("+");
    await tap(page, ["u1"]); // an empty user cell opens Find
    await expect(find(page)).toBeVisible();
    await typeFind(page, "ohm");
    await tap(page, ["enter"]); // the pick sets the cell and lands in the slot
    expect(await tokens(page)).toEqual([{ unit: "ohm" }]);
    await expect(cell(page, "u1").locator(".main")).toHaveText("Ω");
    await emptyOf(page);
    // back to the default
    await tap(page, ["esc"]);
    await tap(page, ["@mode", "d5", "d4"]);
    await page.locator('[role="menuitem"][data-id="unitcells"]').tap();
    await leg("u1:primary").tap();
    await page.locator('[role="menuitem"][data-id="default"]').tap();
    await page.evaluate(() => window.pascaline.shell.closeSheet());
    await unitsKey(page);
    await expect(cell(page, "u1").locator(".main")).toHaveText("dB");
  });
});
