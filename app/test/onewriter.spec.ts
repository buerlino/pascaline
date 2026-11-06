// SPDX-License-Identifier: GPL-3.0-or-later
// R95 (night review 2026-10-30, fh-2): two tabs of one browser profile share one store. Every key is written whole from
// a tab's memory, so without one writer the tab that writes last drops what the other wrote. One tab holds the
// writer lock; the others compute but write nothing and say so, with "Use here" to take the store over.
import { expect, test, type Page } from "@playwright/test";
import { open, tap } from "./helpers.ts";

const engineReady = (page: Page) =>
  page.waitForFunction(() => window.n62?.session.engineState === "ready", undefined, { timeout: 20_000 });

/** A line typed and entered; the row is done before this returns. */
async function enter(page: Page, latex: string): Promise<void> {
  const done = await page.locator('[data-status="done"]').count();
  await page.evaluate((l) => window.n62.entry.set(l), latex);
  await tap(page, ["enter"]);
  await expect(page.locator('[data-status="done"]')).toHaveCount(done + 1);
}

/** The page is hidden (a tab switch): its visibilitychange flush writes what it holds. */
async function hide(page: Page): Promise<void> {
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { value: true, configurable: true });
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForTimeout(500); // the store write is asynchronous
}

/** What a new page reads from the store: the user's names and the Home rows. */
async function readStore(page: Page): Promise<{ names: string[]; rows: string[] }> {
  await open(page, "");
  await engineReady(page);
  await page.waitForTimeout(500); // the history is read after the keypad is up
  return page.evaluate(() => ({
    names: window.n62.session.userNames.map((u) => u.name).sort(),
    rows: window.n62.session.home.map((i) => i.latex),
  }));
}

const note = (page: Page) => page.getByTestId("writer-note");

test("a second tab writes nothing: the first tab's definitions and rows survive it (R95)", async ({ page: a }) => {
  await open(a, "");
  await engineReady(a);
  const b = await a.context().newPage();
  await open(b, "");
  await engineReady(b);
  await b.waitForTimeout(500); // B has read the store (empty) before A changes it
  await enter(a, "X:=5");
  await enter(a, "6\\times7");
  await a.waitForTimeout(800); // the history write is debounced (400 ms)
  await a.close(); // its pagehide flush comes first
  await enter(b, "Y:=1");
  await enter(b, "1+1");
  await hide(b); // B is hidden last
  const c = await a.context().newPage();
  const seen = await readStore(c);
  expect(seen.names).toEqual(["X"]);
  expect(seen.rows).toEqual(["X:=5", "6\\times7"]);
  // B said it would keep nothing: one line, with Use here
  await expect(note(b)).toBeVisible();
  await expect(note(b).getByRole("button")).toBeVisible();
  await expect(note(b).getByText("N62 is open in another tab")).toBeVisible();
  await expect(note(b).getByText("Nothing done in this tab is kept")).toBeVisible(); // R111: said in words, not as a title
  await expect(note(c)).toHaveCount(0); // C took the lock: A is gone, B never had it
});

test("Use here hands the store over: the new tab's definitions are kept, the old tab's later ones are not (R95)", async ({ page: a }) => {
  await open(a, "");
  await engineReady(a);
  await enter(a, "V:=4");
  const b = await a.context().newPage();
  await open(b, "");
  await engineReady(b);
  await expect(note(a)).toHaveCount(0);
  await note(b).getByRole("button").click();
  // B reloads as the writer: it reads every key again (A flushed before it let go), and its note is gone
  await b.waitForFunction(
    () => window.n62?.session.engineState === "ready" && document.querySelector('[data-testid="writer-note"]') === null,
    undefined,
    { timeout: 20_000 },
  );
  await expect(note(a)).toBeVisible(); // A is read-only now and says so
  await b.waitForTimeout(300);
  expect(await b.evaluate(() => window.n62.session.userNames.map((u) => u.name))).toEqual(["V"]);
  await enter(b, "Z:=2");
  await enter(a, "W:=3"); // after the hand-over: computed, never stored
  await a.close();
  await hide(b);
  const c = await a.context().newPage();
  const seen = await readStore(c);
  expect(seen.names).toEqual(["V", "Z"]);
  expect(seen.rows).toEqual(["V:=4", "Z:=2"]);
  await expect(note(c)).toBeVisible(); // B still holds the store
});

test("the note says in visible text that nothing is kept, and fits one row with Use here at 360 px (R111)", async ({ page: a }) => {
  await open(a, "");
  await engineReady(a);
  const b = await a.context().newPage();
  await b.setViewportSize({ width: 360, height: 740 });
  await open(b, "");
  await engineReady(b);
  await expect(note(b).getByText("Nothing done in this tab is kept")).toBeVisible();
  await expect(note(b)).not.toHaveAttribute("title", /.+/);
  const box = await note(b).boundingBox();
  const btn = await note(b).getByRole("button").boundingBox();
  expect(box && btn && btn.x + btn.width <= box.x + box.width).toBe(true);
  expect(btn && btn.height < 40).toBe(true); // "Use here" stays on one line
});
