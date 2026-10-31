// SPDX-License-Identifier: GPL-3.0-or-later
// R88: two presets applied through the model (window.pascaline.presets), then a reload: the settings and the free keys
// of the last one survive, and the model reads its record back with the last one active.
import { expect, test } from "@playwright/test";
import { open } from "./helpers.ts";

test("the settings and free keys of the last preset applied survive a reload", async ({ page }) => {
  await open(page);
  await page.evaluate(async () => {
    const { session, userKeys } = window.pascaline;
    const presets = await window.pascaline.presets();
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
  });
  await expect(page.locator('[data-key="u2"] .main')).toHaveText("mol");
  await page.waitForTimeout(1300); // the store writes are asynchronous, the counters wait 1 s
  await page.reload();
  await page.waitForFunction(() => window.pascaline !== undefined);
  await page.evaluate(() => window.pascaline.entry.ready);
  const after = await page.evaluate(async () => {
    const presets = await window.pascaline.presets();
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
  });
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
