// SPDX-License-Identifier: GPL-3.0-or-later
// R59 (decisions.md S4, archive/r10-connector.md 1-3): Settings › Data › Library. A library comes in through the file
// picker and from the clipboard through the same whole-file check; its functions show in Find with their description; a
// bad text is refused whole with its line; a clash with an own name changes nothing until Replace; the export writes
// the same text back; a body that calls median gives 5/2 (G54); the format for your AI is copied whole. The real engine.
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { open, savePicker, savedText, tap, useClipboardLock } from "./helpers.ts";

test.use({ permissions: ["clipboard-read", "clipboard-write"] });
useClipboardLock();

const BEAMS = fileURLToPath(new URL("../../tools/probes/library/beams.txt", import.meta.url));
const menu = (page: Page) => page.getByTestId("menu");
const row = (page: Page, id: string) => menu(page).locator(`[data-id="${id}"]`);
const notice = (page: Page) => page.getByTestId("notice");
const names = (page: Page): Promise<Record<string, string | undefined>> =>
  page.evaluate(() => Object.fromEntries(window.pascaline.session.userNames.map((u) => [u.name, u.desc])));
const cas = (page: Page, giac: string): Promise<string> => page.evaluate((g) => window.pascaline.calc.cas(g, window.pascaline.session.settings).then((r) => r.text), giac);
const putClipboard = (page: Page, text: string): Promise<void> => page.evaluate((t) => navigator.clipboard.writeText(t), text);

async function start(page: Page): Promise<void> {
  await page.setViewportSize({ width: 412, height: 915 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page, "");
  await page.waitForFunction(() => window.pascaline.session.engineState === "ready", undefined, { timeout: 30_000 });
}
/** Mode › Settings › Data › Library. */
async function library(page: Page): Promise<void> {
  await tap(page, ["@mode", "d6"]);
  await row(page, "data").tap();
  await row(page, "library").tap();
  await expect(page.getByTestId("sheet-title")).toHaveText(/Settings › Data › Library$/);
}
async function fromClipboard(page: Page, text: string): Promise<void> {
  await putClipboard(page, text);
  await library(page);
  await row(page, "clipboard").tap();
}

test("beams.txt through the picker: beam_M is in Find with its description, and the export writes the same text back", async ({ page }) => {
  await start(page);
  await savePicker(page, "fake");
  await page.reload();
  await page.waitForFunction(() => window.pascaline?.session.engineState === "ready", undefined, { timeout: 30_000 });
  await library(page);
  // the Data level holds one Library row; its level the four rows (no new row in the ☰ menu)
  await expect(menu(page).getByRole("menuitem")).toHaveCount(4);
  const chooser = page.waitForEvent("filechooser");
  await row(page, "import").tap();
  await (await chooser).setFiles(BEAMS);
  await expect(notice(page)).toContainText("4 new");
  await expect(notice(page)).toContainText("radians, no exact-first");
  expect((await names(page))["beam_M"]).toBe("Maximum bending moment of a simply supported beam under a uniform load q over span L: q·L²/8");
  expect(await cas(page, "beam_M(2,4)")).toBe("4");

  // Vars (Find on the user's names, R4b), b e a m: the library's function, its description in the preview
  await tap(page, ["vars", "math", "frac", "vars", "neg"]);
  const find = page.getByTestId("find");
  await expect(find.getByTestId("sheet-filter")).toHaveText("beam");
  await expect(find.locator('[role="menuitem"]').first()).toHaveAttribute("data-id", "userfn:beam_M");
  await expect(find.locator('[role="menuitem"][data-id="userfn:beam_w"]')).toBeVisible();
  await expect(find.getByTestId("find-preview")).toHaveText("beam_M(…) · Maximum bending moment of a simply supported beam under a uniform load q over span L: q·L²/8");
  await tap(page, ["esc"]);

  // the export: the stamp, each description over its definition; imported again it changes nothing, and its own
  // export is the same text
  await library(page);
  await row(page, "export").tap();
  await expect.poll(async () => (await savedText(page))?.text ?? "").toContain("beam_M(q,L):=q*L^2/8");
  const first = (await savedText(page))!;
  expect(first.name).toMatch(/^n62-library-\d{4}-\d{2}-\d{2}\.txt$/);
  expect(first.text).toMatch(/^\/\/ n62 library \d+\n/);
  expect(first.text).toContain("// Maximum bending moment of a simply supported beam under a uniform load q over span L: q·L²/8\nbeam_M(q,L):=q*L^2/8");
  await fromClipboard(page, first.text);
  await expect(notice(page)).toContainText("0 new");
  await page.evaluate(() => ((window as unknown as { __saved?: unknown }).__saved = undefined));
  await library(page);
  await row(page, "export").tap();
  await expect.poll(async () => (await savedText(page))?.text).toBe(first.text);
});

test("from the clipboard: beams.txt imports; a bad text is refused whole with its line; median gives 5/2; the format is copied", async ({ page }) => {
  await start(page);
  await fromClipboard(page, readFileSync(BEAMS, "utf8"));
  await expect(notice(page)).toContainText("4 new");
  expect((await names(page))["beam_M"]).toMatch(/^Maximum bending moment/);

  // a good definition, then a line that is not one: nothing of it is defined
  await fromClipboard(page, "// n62 library 4\n// fine\nokfn(x):=x+1\nassume(x>0)\n");
  await expect(notice(page)).toContainText("line 4");
  await expect(notice(page)).toContainText("nothing changed");
  expect(Object.keys(await names(page))).not.toContain("okfn");
  // a failing test: refused, with its line, and the engine is back without the definition
  await fromClipboard(page, "// n62 library 4\n// twice\ntw(x):=2*x\n// test: tw(2) == 4\n// test: tw(3) == 7\n");
  await expect(notice(page)).toContainText("line 5");
  expect(Object.keys(await names(page))).not.toContain("tw");
  await page.waitForFunction(() => window.pascaline.session.engineState === "ready");
  expect(await cas(page, "type(tw)")).not.toBe("func");

  // G54: a body's median is ours (the median of 1,2,3,4 is 5/2, derived)
  await fromClipboard(page, "// n62 library 4\n// The median of a list\nmed(l):=median(l)\n// test: med([1,2,3,4]) == 5/2\n");
  await expect(notice(page)).toContainText("1 new");
  expect(await cas(page, "med([1,2,3,4])")).toBe("5/2");

  // the format for your AI, copied whole
  await putClipboard(page, "");
  await library(page);
  await row(page, "format").tap();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toContain("// n62 library 4");
  const format = await page.evaluate(() => navigator.clipboard.readText());
  expect(format).toContain("// test:");
  expect(format).not.toContain("SPDX");
});

test("a clash with an own name shows the notice and changes nothing; Replace imports", async ({ page }) => {
  await start(page);
  await page.evaluate(() => window.pascaline.session.setView("cas"));
  await page.evaluate(() => window.pascaline.session.submit("beam_M", "beam_M(q,L):=q*L"));
  await expect(page.locator('[data-status="done"]')).toHaveCount(1);
  await fromClipboard(page, readFileSync(BEAMS, "utf8"));
  await expect(notice(page)).toContainText("beam_M (line 6)");
  await expect(notice(page)).toContainText("Nothing changed");
  await expect(page.getByTestId("sheet-title")).toHaveText("Replace your own names?");
  await row(page, "cancel").tap();
  expect(await cas(page, "beam_M(2,4)")).toBe("8");
  expect(Object.keys(await names(page))).not.toContain("beam_w");

  await fromClipboard(page, readFileSync(BEAMS, "utf8"));
  await expect(page.getByTestId("sheet-title")).toHaveText("Replace your own names?");
  await row(page, "replace").tap();
  await expect(notice(page)).toContainText("1 replaced");
  expect(await cas(page, "beam_M(2,4)")).toBe("4");
  expect(Object.keys(await names(page))).toContain("beam_w");
});
