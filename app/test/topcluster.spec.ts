// SPDX-License-Identifier: GPL-3.0-or-later
// R15b: the top cluster of layout D (docs/mockups/top-cluster.html), one test per path of its press table, by touch
// and by keys; the place name as the Home ↔ CAS switch and its hit area; the free keys U1–U3. Fake engine.
import { expect, test, type Page } from "@playwright/test";
import { entryValue, flick, open, recordVibrations, tap, vibrations } from "./helpers.ts";

const place = (page: Page) => page.getByTestId("place");
const view = (page: Page) => page.evaluate(() => window.pascaline.session.view);
const app = (page: Page) => page.evaluate(() => window.pascaline.shell.app);
const sheet = (page: Page) => page.getByTestId("menu");
const appsSheet = (page: Page) => page.getByTestId("apps");
const settings = (page: Page) => page.getByTestId("settings");
const angle = (page: Page) => page.evaluate(() => window.pascaline.session.settings.angle);
const sinh = { label: "sinh", action: { insert: "\\sinh\\left(#0\\right)" } };

test.beforeEach(async ({ page }) => {
  await recordVibrations(page);
  await open(page);
});

test("the cluster is layout D: every key at its place, U1 empty, U2 Home, U3 CAS, Help dimmed (R15a)", async ({ page }) => {
  const boxes = await page.evaluate(() =>
    Object.fromEntries(
      ["apps", "symb", "up", "help", "esc", "u1", "plot", "left", "right", "view", "cancel", "u2", "num", "down", "menu", "u3"].map((id) => {
        const r = document.querySelector(`[data-key="${id}"]`)?.getBoundingClientRect();
        return [id, r ? { x: Math.round(r.x), y: Math.round(r.y) } : null];
      }),
    ),
  );
  const rowOf = (ids: string[]) => new Set(ids.map((id) => boxes[id]?.y)).size;
  expect(rowOf(["apps", "symb", "up", "help", "esc"])).toBe(1);
  expect(rowOf(["u1", "plot", "left", "right", "view", "cancel"])).toBe(1);
  expect(rowOf(["u2", "num", "down", "menu", "u3"])).toBe(1);
  // column 1 is Apps, U1, U2; column 6 is Esc, Cancel, U3
  expect(new Set(["apps", "u1", "u2"].map((id) => boxes[id]?.x)).size).toBe(1);
  expect(new Set(["esc", "cancel", "u3"].map((id) => boxes[id]?.x)).size).toBe(1);
  await expect(page.locator('[data-key="u1"]')).toHaveAttribute("data-user", "empty");
  await expect(page.locator('[data-key="u2"]')).toHaveText("Home");
  await expect(page.locator('[data-key="u2"]')).toHaveAttribute("data-user", "set");
  await expect(page.locator('[data-key="u3"]')).toHaveText("CAS");
  await expect(page.locator('[data-key="help"]')).toHaveAttribute("data-dead", "true");
  await expect(page.locator('[data-key="apps"] .shiftlegend')).toHaveText("Mode");
  await expect(page.locator('[data-key="app"], [data-key="cas"]')).toHaveCount(0);
});

test("Home ↔ CAS: one tap on the place name; by keys Apps, 2 and Apps, 1; and U3, U2", async ({ page }) => {
  await place(page).tap();
  expect(await view(page)).toBe("cas");
  await place(page).tap();
  expect(await view(page)).toBe("home");
  // the Apps sheet lists Home and CAS first (S2 point 4)
  await tap(page, ["apps"]);
  await expect(appsSheet(page).getByRole("menuitem")).toHaveText(["1Home", "2CAS", "3Function", "4Solve"]);
  await tap(page, ["d2"]);
  expect(await view(page)).toBe("cas");
  await tap(page, ["apps", "d1"]);
  expect(await view(page)).toBe("home");
  await tap(page, ["u3"]);
  await expect(place(page)).toHaveText("CAS");
  await tap(page, ["u2"]);
  await expect(place(page)).toHaveText("Home");
});

test("from an app: the place name goes back to Home/CAS, U2 and U3 to Home and CAS, the Apps sheet's rows 1 and 2 too", async ({ page }) => {
  await tap(page, ["u3", "plot"]);
  await expect(place(page)).toHaveText("Function › Plot");
  await place(page).tap();
  await expect(place(page)).toHaveText("CAS"); // where the app was opened from
  await tap(page, ["num", "u2"]);
  await expect(place(page)).toHaveText("Home");
  expect(await app(page)).toBeNull();
  await tap(page, ["apps", "d4"]);
  await expect(page.locator('[data-app="solve"]')).toBeVisible();
  await tap(page, ["u3"]);
  await expect(place(page)).toHaveText("CAS");
  await tap(page, ["apps", "d4", "apps", "d1"]);
  await expect(place(page)).toHaveText("Home");
  expect(await app(page)).toBeNull();
});

test("Symb, Plot and Num: one key each, from Home and inside the app", async ({ page }) => {
  await tap(page, ["symb"]);
  await expect(place(page)).toHaveText("Function › Symb");
  await tap(page, ["plot"]);
  await expect(place(page)).toHaveText("Function › Plot");
  await tap(page, ["num"]);
  await expect(place(page)).toHaveText("Function › Num");
});

test("the angle: one tap on its chip; by keys Shift, Apps, ▶, Enter; a flick up on Apps saves the Shift", async ({ page }) => {
  await page.getByTestId("chip-angle").tap();
  expect(await angle(page)).toBe("deg");
  await tap(page, ["shift", "apps", "right", "enter"]);
  expect(await angle(page)).toBe("rad");
  await flick(page, "apps", "up");
  await expect(page.getByTestId("sheet-title")).toHaveText("Mode");
  await tap(page, ["right", "enter"]);
  expect(await angle(page)).toBe("deg");
  await expect(sheet(page)).toBeHidden();
});

test("Settings: two taps (a chip, then Mode's last row); by keys Shift, Apps, 5", async ({ page }) => {
  await page.getByTestId("chip-digits").tap();
  await sheet(page).locator('[data-id="settings"]').tap();
  await expect(settings(page)).toBeVisible();
  await tap(page, ["esc"]);
  await expect(settings(page)).toBeHidden();
  await tap(page, ["shift", "apps", "d5"]);
  await expect(page.getByTestId("settings-title")).toHaveText("Settings");
});

test("Esc, Cancel and Menu: one key each, in their cells", async ({ page }) => {
  await tap(page, ["d1", "add", "d2", "enter", "menu"]);
  await expect(sheet(page)).toBeVisible();
  await tap(page, ["esc"]);
  await expect(sheet(page)).toBeHidden();
  await tap(page, ["menu", "cancel"]);
  await expect(sheet(page)).toBeHidden();
  await tap(page, ["d7", "esc"]);
  expect(await entryValue(page)).toBe("");
  await tap(page, ["d7", "cancel"]);
  expect(await entryValue(page)).toBe("");
  await tap(page, ["shift", "cancel"]); // Undo keeps its key (R16)
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
  // the user's choice wins over a default: U2 emptied stays empty; reset gives Home back
  await page.evaluate(() => window.pascaline.userKeys.set("u2", "primary", null));
  await expect(page.locator('[data-key="u2"]')).toHaveAttribute("data-user", "empty");
  await page.evaluate(() => window.pascaline.userKeys.reset());
  await expect(page.locator('[data-key="u2"] .main')).toHaveText("Home");
  await expect(page.locator('[data-key="u1"]')).toHaveAttribute("data-user", "empty");
});

test("an empty free key and Help give the dead-key haptic and type nothing", async ({ page }) => {
  await page.evaluate(() => window.pascaline.session.setHaptics({ on: true, ms: 10 }));
  for (const id of ["u1", "help"]) {
    const before = (await vibrations(page)).length;
    await tap(page, [id]);
    await expect.poll(async () => (await vibrations(page)).length - before, id).toBe(3); // key down + the double
  }
  await flick(page, "u2", "up"); // U2's Shift slot ships empty
  expect(await entryValue(page)).toBe("");
  expect(await view(page)).toBe("home");
});

test("the place name's target is the line's full height and at least 96 px from the left edge; below the line the history keeps its taps", async ({ page }) => {
  const box = await place(page).boundingBox();
  expect(box?.x).toBe(0);
  expect(box?.width ?? 0).toBeGreaterThanOrEqual(96);
  expect(box?.height).toBe(28);
  await page.touchscreen.tap(93, 14);
  expect(await view(page)).toBe("cas");
  await page.touchscreen.tap(93, 14);
  expect(await view(page)).toBe("home");
  // a full history: the top row's formula lies right under the line, and a tap on it is the row's, not the switch's
  for (let i = 0; i < 12; i++) await tap(page, ["d1", "add", "d2", "enter"]);
  await page.waitForTimeout(300);
  const hit = await page.evaluate(() => (document.elementFromPoint(50, 38)?.closest("article") ? "row" : "other"));
  expect(hit).toBe("row");
  await page.touchscreen.tap(50, 38);
  expect(await view(page)).toBe("home");
  await expect.poll(() => entryValue(page)).not.toBe(""); // the row's tap put it on the line
});

test("a status tap while an app's code loads runs at once, as the place keys do (decisions.md R8)", async ({ page }) => {
  let release = (): void => {};
  const gate = new Promise<void>((r) => (release = r));
  await page.route(/\/src\/apps\/function\/index\.ts/, async (route) => {
    await gate;
    await route.continue();
  });
  await tap(page, ["plot"]);
  expect(await page.evaluate(() => window.pascaline.shell.loading)).toBe("function");
  await place(page).tap();
  expect(await app(page)).toBeNull();
  await expect(place(page)).toHaveText("Home");
  await page.getByTestId("chip-format").tap(); // a chip opens Mode at once too
  await expect(page.getByTestId("sheet-title")).toHaveText("Mode");
  release();
  await page.waitForTimeout(500);
  expect(await app(page)).toBeNull(); // the late load does not take the place back
  await expect(place(page)).toHaveText("Home");
});

test("over an open sheet: the place name and U2/U3 close it and go there; a free key that holds no place does nothing", async ({ page }) => {
  await tap(page, ["tmpl"]);
  await expect(sheet(page)).toBeVisible();
  await place(page).tap();
  await expect(sheet(page)).toBeHidden();
  expect(await view(page)).toBe("cas");
  await tap(page, ["tmpl", "u2"]);
  await expect(sheet(page)).toBeHidden();
  expect(await view(page)).toBe("home");
  await page.evaluate((b) => window.pascaline.userKeys.set("u1", "primary", b), sinh);
  await tap(page, ["tmpl", "u1"]);
  await expect(sheet(page)).toBeVisible();
  await expect(page.locator('[data-key="u1"]')).toHaveAttribute("data-dead", "true");
  expect(await entryValue(page)).toBe("");
});
