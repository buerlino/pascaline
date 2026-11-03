// SPDX-License-Identifier: GPL-3.0-or-later
// R88: two presets applied through the model, then a reload: the settings and the free keys of the last one survive, and
// the model reads its record back with the last one active. The model is part of the Mode sheet's chunk; the test
// imports that module from the dev server (the app's own instance) and gives it window.pascaline's session and keys, so
// the start chunk carries no hook for it.
import { expect, test } from "@playwright/test";
import { entryValue, open, tap } from "./helpers.ts";

/** The Mode sheet's module on the dev server: its presetsFor gives the page's model (one per page). */
const MODE_SHEET = "/src/views/modeSheet.ts";
type ModeSheet = typeof import("../src/views/modeSheet.ts");

test("the settings and free keys of the last preset applied survive a reload", async ({ page }) => {
  await open(page);
  await page.evaluate(async (path) => {
    const { session, userKeys } = window.pascaline;
    const presets = await ((await import(/* @vite-ignore */ path)) as ModeSheet).presetsFor(session, userKeys);
    session.setAngle("deg");
    session.setFormat("eng");
    session.setDigits(4);
    session.setDecimalMark("comma");
    userKeys.set("u1", "primary", { label: "sinh", action: { insert: "\\sinh\\left(#0\\right)" } });
    const lab = presets.capture("Lab");
    session.setAngle("rad");
    session.setFormat("sci");
    session.setDigits(6);
    session.setDecimalMark("point");
    userKeys.reset();
    userKeys.set("u2", "primary", { label: "mol", action: { type: "mol" } });
    const chem = presets.capture("Chemistry");
    await presets.apply(chem);
    await presets.apply(lab);
    await presets.apply(chem);
  }, MODE_SHEET);
  await expect(page.locator('[data-key="u2"] .main')).toHaveText("mol");
  await page.waitForTimeout(1300); // the store writes are asynchronous, the counters wait 1 s
  await page.reload();
  await page.waitForFunction(() => window.pascaline !== undefined);
  await page.evaluate(() => window.pascaline.entry.ready);
  const after = await page.evaluate(async (path) => {
    const presets = await ((await import(/* @vite-ignore */ path)) as ModeSheet).presetsFor(window.pascaline.session, window.pascaline.userKeys);
    const s = window.pascaline.session.settings;
    return {
      settings: { angle: s.angle, format: s.format, digits: s.digits, decimalMark: s.decimalMark },
      u1: window.pascaline.userKeys.labelOf("u1", "primary") ?? null,
      u2: window.pascaline.userKeys.labelOf("u2", "primary") ?? null,
      names: presets.list.map((p) => p.name),
      active: presets.list.find((p) => p.id === presets.active)?.name,
      modified: presets.modified,
      switched: window.pascaline.session.taps.counts.presets,
    };
  }, MODE_SHEET);
  expect(after).toEqual({
    settings: { angle: "rad", format: "sci", digits: 6, decimalMark: "point" },
    u1: null,
    u2: "mol",
    names: ["Lab", "Chemistry"],
    active: "Chemistry",
    modified: false,
    switched: 3,
  });
  await expect(page.locator('[data-key="u2"] .main')).toHaveText("mol");
});

// R123 (vr-10): a name typed under "Preset name" holds the entry line for a while; the half-typed line it set aside is
// the one kept (R34). A kill fires no pagehide, so a hide is followed by a fresh page on the same store (persist.spec.ts).
type Page = import("@playwright/test").Page;
async function hidden(page: Page, yes: boolean): Promise<void> {
  await page.evaluate((yes) => {
    Object.defineProperty(document, "hidden", { value: yes, configurable: true });
    Object.defineProperty(document, "visibilityState", { value: yes ? "hidden" : "visible", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  }, yes);
  await page.waitForTimeout(300); // the store write is asynchronous
}
/** A fresh start on the same store, as after a kill: the old page lets go of the writer lock without a flush (R95). */
async function relaunch(page: Page): Promise<Page> {
  await page.evaluate(() => window.pascaline.yieldWriter());
  const next = await page.context().newPage();
  await open(next);
  return next;
}
/** Mode › Presets › Save (row 1 while there are none), then a name typed on a hardware keyboard. */
async function startNaming(page: Page, name: string): Promise<void> {
  await tap(page, ["@mode", "d5", "d1"]);
  await expect(page.getByTestId("entry-label")).toHaveText("Preset name");
  await page.keyboard.type(name);
  expect(await entryValue(page)).toBe(name);
}

test("a hide while a preset is being named keeps the half-typed line, not the name (R123)", async ({ page }) => {
  await open(page);
  await tap(page, ["d2", "add", "d3"]);
  expect(await entryValue(page)).toBe("2+3");
  await startNaming(page, "lab");
  await hidden(page, true);
  const next = await relaunch(page);
  expect(await entryValue(next)).toBe("2+3");
  await page.reload(); // a reload's pagehide flush keeps the same line
  await page.evaluate(() => window.pascaline.entry.ready);
  expect(await entryValue(page)).toBe("2+3");
});

test("C while naming clears the name only: the line comes back after the prompt and its kept copy stays (R123)", async ({ page }) => {
  await open(page);
  await tap(page, ["d2", "add", "d3"]);
  await hidden(page, true); // the line is kept
  await hidden(page, false);
  await tap(page, ["@mode", "d5", "d1"]);
  await expect(page.getByTestId("entry-label")).toHaveText("Preset name");
  await tap(page, ["alpha", "vars", "alpha", "math"]); // a return drops the focus: the name by keys (A, B)
  expect(await entryValue(page)).toBe("AB");
  await tap(page, ["shift", "esc"]); // C
  expect(await entryValue(page)).toBe("");
  await expect(page.getByTestId("entry-label")).toHaveText("Preset name");
  await tap(page, ["esc"]);
  await expect(page.getByTestId("entry-label")).toHaveCount(0);
  expect(await entryValue(page)).toBe("2+3");
  const next = await relaunch(page); // a kill with no hide since: the kept line is still the one stored
  expect(await entryValue(next)).toBe("2+3");
});
