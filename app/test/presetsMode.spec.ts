// SPDX-License-Identifier: GPL-3.0-or-later
// R89 (docs/05 3.4, docs/mockups/settings.html section 4): presets in Mode. Row 5 is Preset (the active one's name, what
// it holds on a second line; ◀ ▶ apply the previous or next one with the sheet open; a tap, a digit or Enter lists them),
// Settings is row 6. `Mode › Presets`: the presets as radio rows, a pick applies and closes, then Save and Edit ›. A
// preset's page: five ticks, Update, Rename or delete ›. A name is typed in the entry line under the label "Preset name":
// Enter saves, Esc cancels, an empty or taken name is refused with a notice. A switch shows the notice naming what it
// set; the free keys' faces follow; a later change to a held setting puts a dot after the name. The fake engine.
import { expect, test, type Page } from "@playwright/test";
import { entryValue, open, tap } from "./helpers.ts";

const sheet = (page: Page) => page.getByTestId("menu");
const title = (page: Page) => page.getByTestId("sheet-title");
const row = (page: Page, id: string) => sheet(page).locator(`[role="menuitem"][data-id="${id}"]`);
const active = (page: Page) => sheet(page).locator('[data-active="true"]');
const rowIds = (page: Page) => sheet(page).getByRole("menuitem").evaluateAll((els) => els.map((e) => e.getAttribute("data-id")));
const notice = (page: Page) => page.getByTestId("notice");
const label = (page: Page) => page.getByTestId("entry-label");
const face = (page: Page, id: string) => page.locator(`[data-key="${id}"] .main`);
const historyRows = (page: Page) => page.evaluate(() => window.pascaline.session.items.length);
const angle = (page: Page) => page.evaluate(() => window.pascaline.session.settings.angle);

/** A free key's tap layer holds `label` (typing it). */
const setKey = (page: Page, id: string, label: string) =>
  page.evaluate(([id, label]) => window.pascaline.userKeys.set(id as string, "primary", { label: label as string, action: { type: label as string } }), [id, label]);

/** Mode › Presets › Save, the name typed on a hardware keyboard, Enter. */
async function saveAs(page: Page, name: string): Promise<void> {
  await tap(page, ["@mode", "d5"]);
  await expect(title(page)).toHaveText("Mode › Presets");
  await row(page, "save").tap();
  await expect(label(page)).toHaveText("Preset name");
  await page.keyboard.type(name);
  await page.keyboard.press("Enter");
  await expect(notice(page)).toHaveText(`Saved ${name}`);
  await expect(label(page)).toHaveCount(0);
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page);
});

test.describe("by keys", () => {
  test("Mode's rows: Preset is 5, Settings 6; 5 lists the presets; Save names one in the entry line with Alpha letters, Enter saves, the line comes back", async ({ page }) => {
    await tap(page, ["d1", "d2", "@mode"]);
    expect(await rowIds(page)).toEqual(["angle", "format", "digits", "entry", "preset", "settings"]);
    await expect(row(page, "preset").getByTestId("sheet-value")).toHaveText("None");
    await tap(page, ["d6"]);
    await expect(title(page)).toHaveText("Mode › Settings");
    await tap(page, ["esc", "d5"]);
    await expect(title(page)).toHaveText("Mode › Presets");
    expect(await rowIds(page)).toEqual(["save", "edit"]);
    await expect(row(page, "edit")).toHaveAttribute("aria-disabled", "true"); // nothing to edit yet
    await tap(page, ["d1"]);
    await expect(sheet(page)).toHaveCount(0);
    await expect(label(page)).toHaveText("Preset name");
    expect(await entryValue(page)).toBe("");
    await tap(page, ["alpha", "vars", "alpha", "math"]);
    expect(await entryValue(page)).toBe("AB");
    await tap(page, ["enter"]);
    await expect(notice(page)).toHaveText("Saved AB");
    await expect(label(page)).toHaveCount(0);
    expect(await entryValue(page)).toBe("12"); // the line as it was before the name
    expect(await historyRows(page)).toBe(0);
    await tap(page, ["@mode", "down", "down", "down", "down"]);
    await expect(active(page)).toHaveAttribute("data-id", "preset");
    await expect(row(page, "preset").getByTestId("sheet-value")).toHaveText("AB");
    await expect(row(page, "preset").getByTestId("row-hint")).toHaveText("RAD · STD 12 · point · no keys");
    await tap(page, ["enter"]); // Enter on the row lists the presets
    await expect(title(page)).toHaveText("Mode › Presets");
    expect(await rowIds(page)).toEqual(["p1", "save", "edit"]);
    await expect(row(page, "p1")).toHaveAttribute("data-selected", "true");
  });

  test("a hardware Enter on the name saves and nothing reaches the history; an empty or taken name is refused with a notice; Esc cancels", async ({ page }) => {
    await tap(page, ["d1", "d2"]);
    await tap(page, ["@mode", "d5", "d1"]);
    await page.keyboard.press("Enter");
    await expect(notice(page)).toHaveText("A preset needs a name");
    await expect(label(page)).toHaveText("Preset name"); // still naming
    await page.keyboard.type("Lab");
    await page.keyboard.press("Enter");
    await expect(notice(page)).toHaveText("Saved Lab");
    expect(await historyRows(page)).toBe(0);
    expect(await entryValue(page)).toBe("12");
    await tap(page, ["@mode", "d5", "d2"]); // Save is row 2 now
    await page.keyboard.type("lab");
    await page.keyboard.press("Enter");
    await expect(notice(page)).toHaveText("There is already a preset named lab");
    await expect(label(page)).toHaveText("Preset name");
    await page.keyboard.press("Escape");
    await expect(label(page)).toHaveCount(0);
    expect(await entryValue(page)).toBe("12");
    expect(await historyRows(page)).toBe(0);
    expect(await page.evaluate(() => window.pascaline.session.settings.angle)).toBe("rad");
  });

  test("◀ ▶ on the row apply the previous or next preset with the sheet open; the notice names it; the free keys' faces switch; Counters shows the switches", async ({ page }) => {
    await setKey(page, "u1", "sinh");
    await page.getByTestId("chip-angle").tap(); // DEG
    await saveAs(page, "Lab");
    await page.evaluate(() => {
      const { session, userKeys } = window.pascaline;
      userKeys.reset();
      session.setAngle("rad");
      session.setFormat("sci");
      session.setDigits(4);
    });
    await setKey(page, "u1", "mol");
    await setKey(page, "u2", "pH");
    await saveAs(page, "Chemistry");
    await expect(face(page, "u1")).toHaveText("mol");
    await tap(page, ["@mode", "down", "down", "down", "down", "left"]);
    await expect(notice(page)).toHaveText("Lab: DEG · STD 12 · point · 1 key");
    await expect(title(page)).toHaveText("Mode"); // the sheet stays open
    await expect(row(page, "preset").getByTestId("sheet-value")).toHaveText("Lab");
    await expect(row(page, "preset").getByTestId("row-hint")).toHaveText("DEG · STD 12 · point · 1 key");
    expect(await angle(page)).toBe("deg");
    await expect(face(page, "u1")).toHaveText("sinh");
    await tap(page, ["right"]);
    await expect(notice(page)).toHaveText("Chemistry: RAD · SCI 4 · point · 2 keys");
    await expect(face(page, "u1")).toHaveText("mol");
    await expect(face(page, "u2")).toHaveText("pH");
    await tap(page, ["right"]); // round the end
    await expect(row(page, "preset").getByTestId("sheet-value")).toHaveText("Lab");
    await tap(page, ["d6", "d6"]);
    await expect(title(page)).toHaveText("Mode › Settings › Counters");
    await expect(row(page, "presets").getByTestId("sheet-value")).toHaveText("3");
  });

  test("a later change to a held setting puts a dot after the name; Update on the preset's page takes it away", async ({ page }) => {
    await saveAs(page, "Lab");
    await page.getByTestId("chip-angle").tap(); // DEG: held by Lab's Mode group
    await tap(page, ["@mode"]);
    await expect(row(page, "preset").getByTestId("sheet-value")).toHaveText("Lab •");
    await tap(page, ["d5", "d3"]);
    await expect(title(page)).toHaveText("Mode › Presets › Edit");
    expect(await rowIds(page)).toEqual(["p1"]);
    await tap(page, ["d1"]);
    await expect(title(page)).toHaveText("Presets › Edit › Lab");
    expect(await rowIds(page)).toEqual(["mode", "numbers", "look", "vibration", "keys", "update", "manage"]);
    for (const g of ["mode", "numbers", "look", "vibration", "keys"]) await expect(row(page, g)).toHaveAttribute("data-selected", "true");
    await expect(row(page, "mode").getByTestId("row-hint")).toHaveText("RAD · STD 12 · textbook");
    await expect(row(page, "numbers").getByTestId("row-hint")).toHaveText("Point · Std Sci Eng");
    await expect(row(page, "vibration").getByTestId("row-hint")).toHaveText("Off");
    await expect(row(page, "keys").getByTestId("row-hint")).toHaveText("None set");
    await tap(page, ["d6"]); // Update: the sheet stays
    await expect(notice(page)).toHaveText("Lab updated");
    await expect(row(page, "mode").getByTestId("row-hint")).toHaveText("DEG · STD 12 · textbook");
    await tap(page, ["d3"]); // a tick: Appearance no longer held
    await expect(row(page, "look")).toHaveAttribute("data-selected", "false");
    await expect(row(page, "look").getByTestId("row-hint")).toHaveText("Not held: stays as it is");
    await tap(page, ["esc", "esc", "esc"]);
    await expect(title(page)).toHaveText("Mode");
    await expect(row(page, "preset").getByTestId("sheet-value")).toHaveText("Lab");
  });

  test("Rename or delete: Rename puts the name on the line under its label; Delete removes the preset", async ({ page }) => {
    await saveAs(page, "Lab");
    await tap(page, ["@mode", "d5", "d3", "d1", "d7"]);
    await expect(title(page)).toHaveText("Edit › Lab › Rename or delete");
    expect(await rowIds(page)).toEqual(["rename", "delete"]);
    await tap(page, ["d1"]);
    await expect(sheet(page)).toHaveCount(0);
    await expect(label(page)).toHaveText("Preset name");
    expect(await entryValue(page)).toBe("Lab");
    await tap(page, ["bksp", "bksp", "bksp"]);
    await page.keyboard.type("Bench");
    await tap(page, ["enter"]);
    await expect(notice(page)).toHaveText("Renamed to Bench");
    await tap(page, ["@mode"]);
    await expect(row(page, "preset").getByTestId("sheet-value")).toHaveText("Bench");
    await tap(page, ["d5", "d3", "d1", "d7", "d2"]);
    await expect(sheet(page)).toHaveCount(0);
    await expect(notice(page)).toHaveText("Bench deleted");
    await tap(page, ["@mode"]);
    await expect(row(page, "preset").getByTestId("sheet-value")).toHaveText("None");
    expect(await historyRows(page)).toBe(0);
  });
});

test.describe("by touch", () => {
  test("a tap on the row lists the presets; a pick applies one and closes the sheet; the row's ▶ applies the next", async ({ page }) => {
    await saveAs(page, "Lab");
    await page.getByTestId("chip-angle").tap(); // DEG
    await saveAs(page, "Survey");
    await page.getByTestId("chip-format").tap();
    await row(page, "preset").locator(".label").tap();
    await expect(title(page)).toHaveText("Mode › Presets");
    expect(await rowIds(page)).toEqual(["p1", "p2", "save", "edit"]);
    await expect(row(page, "p2")).toHaveAttribute("data-selected", "true");
    await expect(row(page, "p1").getByTestId("row-hint")).toHaveText("RAD · STD 12 · point · no keys");
    await row(page, "p1").tap();
    await expect(sheet(page)).toHaveCount(0);
    await expect(notice(page)).toHaveText("Lab: RAD · STD 12 · point · no keys");
    expect(await angle(page)).toBe("rad");
    await page.getByTestId("chip-format").tap();
    await row(page, "preset").getByTestId("step-up").tap();
    await expect(notice(page)).toHaveText("Survey: DEG · STD 12 · point · no keys");
    await expect(title(page)).toHaveText("Mode");
    expect(await angle(page)).toBe("deg");
  });

  test("past seven rows the list scrolls with its count", async ({ page }) => {
    await page.evaluate(async () => {
      const { session, userKeys } = window.pascaline;
      const m = (await import(/* @vite-ignore */ "/src/views/modeSheet.ts")) as typeof import("../src/views/modeSheet.ts");
      const presets = await m.presetsFor(session, userKeys);
      for (let i = 1; i <= 8; i++) presets.capture(`Job ${i}`);
    });
    await page.setViewportSize({ width: 360, height: 740 });
    await tap(page, ["@mode", "d5"]);
    await expect(title(page)).toHaveText("Mode › Presets");
    await expect(page.getByTestId("sheet-count")).toHaveText("10 items");
  });
});

for (const [w, h] of [[360, 740], [372, 767]] as const)
  test(`fit at ${w} × ${h}: Mode with DEG, PFX 30, one line and a long preset name shows all six rows`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await page.evaluate(() => {
      const s = window.pascaline.session;
      s.setAngle("deg");
      s.setFormat("pfx");
      s.setDigits(30);
      s.setEntry("line");
    });
    await saveAs(page, "Lab bench: strain-gauge calibration");
    await tap(page, ["@mode"]);
    expect(await rowIds(page)).toEqual(["angle", "format", "digits", "entry", "preset", "settings"]);
    const m = await sheet(page).locator(".list").evaluate((el) => ({ scroll: el.scrollHeight, client: el.clientHeight }));
    expect(m.scroll).toBeLessThanOrEqual(m.client);
    await expect(page.getByTestId("sheet-count")).toHaveCount(0);
    const box = await row(page, "preset").boundingBox();
    expect(box && box.x + box.width).toBeLessThanOrEqual(w); // no row runs off the screen
  });
