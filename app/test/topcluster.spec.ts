// SPDX-License-Identifier: GPL-3.0-or-later
// R15c2: the top cluster R3 (docs/mockups/top-cluster-r15c.html; decisions.md "R15c"), one test per path of its press
// table, by touch and by keys; the place name and its hit area; the free keys U1–U6. The editing wing's own jobs are in
// editwing.spec.ts. Fake engine.
import { expect, test, type Page } from "@playwright/test";
import { entryValue, flick, open, recordVibrations, tap, touch, vibrations } from "./helpers.ts";

const place = (page: Page) => page.getByTestId("place");
const view = (page: Page) => page.evaluate(() => window.pascaline.session.view);
const app = (page: Page) => page.evaluate(() => window.pascaline.shell.app);
const sheet = (page: Page) => page.getByTestId("menu");
const appsSheet = (page: Page) => page.getByTestId("apps");
const angle = (page: Page) => page.evaluate(() => window.pascaline.session.settings.angle);
const sinh = { label: "sinh", action: { insert: "\\sinh\\left(#0\\right)" } };

test.beforeEach(async ({ page }) => {
  await recordVibrations(page);
  await open(page);
});

test("the cluster is R3: U1-U6 empty in columns 1-2, the round pad, View | Esc, Undo | Copy, ⇤ | ⇥; View dimmed", async ({ page }) => {
  const ids = ["u1", "u2", "up", "view", "esc", "u3", "u4", "left", "right", "undo", "copy", "u5", "u6", "down", "lstart", "lend"];
  const boxes = await page.evaluate(
    (ids) =>
      Object.fromEntries(
        ids.map((id) => {
          const r = document.querySelector(`[data-key="${id}"]`)?.getBoundingClientRect();
          return [id, r ? { x: Math.round(r.x), y: Math.round(r.y) } : null];
        }),
      ),
    ids,
  );
  const rowOf = (ids: string[]) => new Set(ids.map((id) => boxes[id]?.y)).size;
  const colOf = (ids: string[]) => new Set(ids.map((id) => boxes[id]?.x)).size;
  expect(rowOf(["u1", "u2", "up", "view", "esc"])).toBe(1);
  expect(rowOf(["u3", "u4", "left", "right", "undo", "copy"])).toBe(1);
  expect(rowOf(["u5", "u6", "down", "lstart", "lend"])).toBe(1);
  expect(colOf(["u1", "u3", "u5"])).toBe(1);
  expect(colOf(["u2", "u4", "u6"])).toBe(1);
  expect(colOf(["view", "undo", "lstart"])).toBe(1);
  expect(colOf(["esc", "copy", "lend"])).toBe(1);
  for (const u of ["u1", "u2", "u3", "u4", "u5", "u6"]) await expect(page.locator(`[data-key="${u}"]`)).toHaveAttribute("data-user", "empty");
  await expect(page.locator('[data-key="view"]')).toHaveAttribute("data-dead", "true");
  const legends = { view: "Help", esc: "Clear", undo: "Redo", copy: "Paste", lstart: "⇤□", lend: "□⇥" };
  for (const [id, l] of Object.entries(legends)) await expect(page.locator(`[data-key="${id}"] .shiftlegend`), id).toHaveText(l);
  // no letter line in the cluster (vertical space)
  await expect(page.locator('[data-key="esc"] .alphalegend, [data-key="u1"] .alphalegend')).toHaveCount(0);
  await expect(page.locator(["apps", "symb", "plot", "num", "help", "menu", "cancel", "app", "cas"].map((id) => `[data-key="${id}"]`).join(", "))).toHaveCount(0);
});

test("Home ↔ CAS: the place name and its sheet, by touch and by keys (the sheet's rows 1 and 2)", async ({ page }) => {
  await place(page).tap();
  await appsSheet(page).getByRole("menuitem").nth(1).tap();
  expect(await view(page)).toBe("cas");
  await place(page).tap();
  await appsSheet(page).getByRole("menuitem").first().tap();
  expect(await view(page)).toBe("home");
  await place(page).tap(); // R15c1: the name opens the sheet, it does not switch
  await expect(appsSheet(page)).toBeVisible();
  await tap(page, ["esc"]);
  await expect(appsSheet(page)).toHaveCount(0);
  // the Apps sheet lists Home and CAS first (S2 point 4)
  await place(page).tap();
  await expect(appsSheet(page).getByRole("menuitem")).toHaveText([/^1\s*Home$/, /^2\s*∫\s*CAS$/, /^3\s*ƒ\s*Function$/, /^4\s*x=\?\s*Solve$/]);
  await tap(page, ["d2"]);
  expect(await view(page)).toBe("cas");
  await tap(page, ["@place", "d1"]);
  expect(await view(page)).toBe("home");
});

test("from an app: the place name opens Apps, whose rows 1 and 2 go to Home and CAS", async ({ page }) => {
  await tap(page, ["@cas", "@plot"]);
  await expect(place(page)).toHaveAttribute("data-view", "plot");
  await place(page).tap();
  await expect(appsSheet(page)).toBeVisible();
  await appsSheet(page).getByRole("menuitem").nth(1).tap();
  await expect(place(page)).toHaveAccessibleName(/^Place: CAS\./);
  expect(await app(page)).toBeNull();
  await tap(page, ["@place", "d4"]);
  await expect(page.locator('[data-app="solve"]')).toBeVisible();
  await tap(page, ["@place", "d1"]);
  await expect(place(page)).toHaveAccessibleName(/^Place: Home\./);
  expect(await app(page)).toBeNull();
});

test("Symb, Plot and Num: one tab each inside the app", async ({ page }) => {
  await tap(page, ["@place", "d3"]);
  for (const v of ["symb", "plot", "num"] as const) {
    await page.getByTestId(`tab-${v}`).tap();
    await expect(place(page)).toHaveAttribute("data-view", v);
  }
});

test("the angle: one tap on its chip; Mode from the format chip, ▲ to Angle, ▶, Enter", async ({ page }) => {
  await page.getByTestId("chip-angle").tap();
  expect(await angle(page)).toBe("deg");
  await page.getByTestId("chip-format").tap();
  await expect(page.getByTestId("sheet-title")).toHaveText("Mode");
  await tap(page, ["up", "right", "enter"]);
  expect(await angle(page)).toBe("rad");
  await expect(sheet(page)).toBeHidden();
});

test("Settings: two taps (a chip, then Mode's last row); Esc goes back to Mode (R49)", async ({ page }) => {
  await page.getByTestId("chip-digits").tap();
  await sheet(page).locator('[data-id="settings"]').tap();
  await expect(page.getByTestId("sheet-title")).toHaveText("Mode › Settings");
  await tap(page, ["esc"]);
  await expect(page.getByTestId("sheet-title")).toHaveText("Mode");
});

test("Esc closes ☰'s menu, and clears the line; Undo brings it back", async ({ page }) => {
  await tap(page, ["d1", "add", "d2", "enter", "@menu"]);
  await expect(sheet(page)).toBeVisible();
  await tap(page, ["esc"]);
  await expect(sheet(page)).toBeHidden();
  await tap(page, ["d7", "esc"]);
  expect(await entryValue(page)).toBe("");
  await tap(page, ["undo"]);
  expect(await entryValue(page)).toBe("7");
});

test("your own function: one press on a free key, one flick for its Shift slot; it survives a reload", async ({ page }) => {
  await page.evaluate((b) => {
    window.pascaline.userKeys.set("u1", "primary", b);
    window.pascaline.userKeys.set("u1", "shift", { label: "π", action: { insert: "\\pi" } });
  }, sinh);
  await expect(page.locator('[data-key="u1"] .main')).toHaveText("sinh");
  await expect(page.locator('[data-key="u1"]')).toHaveAttribute("data-user", "set");
  await expect(page.locator('[data-key="u1"] .shiftlegend')).toHaveText("π");
  await tap(page, ["u1", "d2"]);
  expect(await entryValue(page)).toBe("\\sinh\\left(2\\right)");
  await page.evaluate(() => window.pascaline.entry.clear());
  await flick(page, "u1", "up");
  expect(await entryValue(page)).toBe("\\pi");
  // stored with the stamp: back after a relaunch
  await page.waitForTimeout(300);
  await page.reload();
  await page.waitForFunction(() => window.pascaline !== undefined && customElements.get("math-field") !== undefined);
  await page.evaluate(() => window.pascaline.entry.ready);
  await expect(page.locator('[data-key="u1"] .main')).toHaveText("sinh");
  await tap(page, ["u1"]);
  expect(await entryValue(page)).toBe("\\sinh\\left(\\placeholder{}\\right)");
  // reset gives every slot its default back: empty
  await page.evaluate(() => window.pascaline.userKeys.reset());
  await expect(page.locator('[data-key="u1"]')).toHaveAttribute("data-user", "empty");
});

// R15c3: the third slot. No letter line in the cluster: the face shows the Alpha binding while Alpha is on, the bubble
// while a flick down is armed; an empty Alpha slot is the tap.
test("a free key's Alpha slot: a flick down and Alpha + tap fire it, the face and the bubble show it; it survives a reload", async ({ page }) => {
  const cosh = { label: "cosh", action: { insert: "\\cosh\\left(#0\\right)" } };
  const wanted = "\\cosh\\left(\\placeholder{}\\right)";
  await page.evaluate(([a, b]) => {
    window.pascaline.userKeys.set("u1", "primary", a!);
    window.pascaline.userKeys.set("u1", "alpha", b!);
    window.pascaline.userKeys.set("u2", "primary", a!); // no Alpha slot: its Alpha is the tap
  }, [sinh, cosh] as const);
  const main = page.locator('[data-key="u1"] .main');
  await expect(main).toHaveText("sinh");
  await expect(page.locator('[data-key="u1"] .alphalegend')).toHaveCount(0); // the cluster keeps no letter line
  // Alpha + the key; the face shows the binding while Alpha is on
  await tap(page, ["alpha"]);
  await expect(main).toHaveText("cosh");
  await expect(page.locator('[data-key="u2"] .main')).toHaveText("sinh");
  await tap(page, ["u1"]);
  expect(await entryValue(page)).toBe(wanted);
  await expect(main).toHaveText("sinh");
  await page.evaluate(() => window.pascaline.entry.clear());
  // a flick down: the bubble names the binding while armed, the lift fires it
  const f = await touch(page, "u1");
  await f.move(0, 35);
  await expect(page.getByTestId("flick-bubble")).toHaveText("cosh");
  await f.end();
  expect(await entryValue(page)).toBe(wanted);
  await page.evaluate(() => window.pascaline.entry.clear());
  // the empty slot falls back to the tap, by Alpha and by flick
  await tap(page, ["alpha", "u2"]);
  expect(await entryValue(page)).toBe("\\sinh\\left(\\placeholder{}\\right)");
  await page.evaluate(() => window.pascaline.entry.clear());
  await flick(page, "u2", "down");
  expect(await entryValue(page)).toBe("\\sinh\\left(\\placeholder{}\\right)");
  await page.evaluate(() => window.pascaline.entry.clear());
  // stored with the stamp: back after a relaunch
  await page.waitForTimeout(300);
  await page.reload();
  await page.waitForFunction(() => window.pascaline !== undefined && customElements.get("math-field") !== undefined);
  await page.evaluate(() => window.pascaline.entry.ready);
  await flick(page, "u1", "down");
  expect(await entryValue(page)).toBe(wanted);
  await page.evaluate(() => window.pascaline.entry.clear());
  await tap(page, ["alpha", "u1"]);
  expect(await entryValue(page)).toBe(wanted);
});

test("an empty free key and View give the dead-key haptic and type nothing", async ({ page }) => {
  await page.evaluate(() => window.pascaline.session.setHaptics({ on: true, ms: 10 }));
  for (const id of ["u1", "u6", "view"]) {
    const before = (await vibrations(page)).length;
    await tap(page, [id]);
    await expect.poll(async () => (await vibrations(page)).length - before, id).toBe(3); // key down + the double
  }
  await flick(page, "u2", "up"); // U2's Shift slot ships empty
  await flick(page, "view", "up"); // Help: not built yet
  expect(await entryValue(page)).toBe("");
  expect(await view(page)).toBe("home");
});

test("the place name's target is the line's full height and at least 96 px from the left edge; below the line the history keeps its taps", async ({ page }) => {
  const box = await place(page).boundingBox();
  expect(box?.x).toBe(0);
  expect(box?.width ?? 0).toBeGreaterThanOrEqual(96);
  expect(box?.height).toBe(28);
  await page.touchscreen.tap(93, 14);
  await expect(appsSheet(page)).toBeVisible();
  await page.touchscreen.tap(93, 14);
  await expect(appsSheet(page)).toHaveCount(0);
  // a full history: the top row's formula lies right under the line, and a tap on it is the row's, not the switch's
  for (let i = 0; i < 12; i++) await tap(page, ["d1", "add", "d2", "enter"]);
  await page.waitForTimeout(300);
  const hit = await page.evaluate(() => (document.elementFromPoint(50, 38)?.closest("article") ? "row" : "other"));
  expect(hit).toBe("row");
  await page.touchscreen.tap(50, 38);
  expect(await view(page)).toBe("home");
  await expect.poll(() => entryValue(page)).not.toBe(""); // the row's tap put it on the line
});

test("a status tap while an app's code loads runs at once (decisions.md R8)", async ({ page }) => {
  let release = (): void => {};
  const gate = new Promise<void>((r) => (release = r));
  await page.route(/\/src\/apps\/function\/index\.ts/, async (route) => {
    await gate;
    await route.continue();
  });
  await place(page).tap();
  await appsSheet(page).locator('[data-id="function"]').tap();
  expect(await page.evaluate(() => window.pascaline.shell.loading)).toBe("function");
  await place(page).tap(); // the Apps sheet opens at once, and Home is its first row
  await appsSheet(page).getByRole("menuitem").first().tap();
  expect(await app(page)).toBeNull();
  await expect(place(page)).toHaveAccessibleName(/^Place: Home\./);
  await page.getByTestId("chip-format").tap(); // a chip opens Mode at once too
  await expect(page.getByTestId("sheet-title")).toHaveText("Mode");
  release();
  await page.waitForTimeout(500);
  expect(await app(page)).toBeNull(); // the late load does not take the place back
  await expect(place(page)).toHaveAccessibleName(/^Place: Home\./);
});

test("over an open sheet: the place name, and a free key that holds CAS or Home, close it and go there; a free key that holds no place does nothing", async ({ page }) => {
  await page.evaluate(() => {
    window.pascaline.userKeys.set("u3", "primary", { label: "CAS", action: { special: "cas" } });
    window.pascaline.userKeys.set("u2", "primary", { label: "Home", action: { special: "home" } });
  });
  await tap(page, ["tmpl"]);
  await expect(sheet(page)).toBeVisible();
  await place(page).tap();
  await expect(sheet(page)).toBeHidden();
  await expect(appsSheet(page)).toBeVisible();
  await tap(page, ["esc", "tmpl", "u3", "tmpl", "u2"]);
  await expect(sheet(page)).toBeHidden();
  expect(await view(page)).toBe("home");
  await page.evaluate((b) => window.pascaline.userKeys.set("u1", "primary", b), sinh);
  await tap(page, ["tmpl", "u1"]);
  await expect(sheet(page)).toBeVisible();
  await expect(page.locator('[data-key="u1"]')).toHaveAttribute("data-dead", "true");
  expect(await entryValue(page)).toBe("");
});
