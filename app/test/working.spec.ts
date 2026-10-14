// SPDX-License-Identifier: GPL-3.0-or-later
// "Working…" and its Cancel show only once a job has run for 150 ms, so a fast answer never flashes them, and the
// pending row is as high as the result row that replaces it (regression: a 20–40 ms flash and a 6 px jump after Enter).
import { expect, test, type Page } from "@playwright/test";
import { open, tap } from "./helpers.ts";

type Sample = { t: number; status: string | null; working: boolean; cancel: boolean; h: number };

/** Sample the newest history row on every frame: its status, whether Working… and Cancel can be seen, its height. */
async function sampleRows(page: Page): Promise<void> {
  await page.evaluate(() => {
    const samples: Sample[] = [];
    (window as unknown as { __samples: Sample[] }).__samples = samples;
    const seen = (e: Element | null | undefined): boolean => !!e && getComputedStyle(e).visibility === "visible";
    const frame = (): void => {
      const a = [...document.querySelectorAll("article.item")].at(-1);
      if (a)
        samples.push({
          t: performance.now(),
          status: a.getAttribute("data-status"),
          working: seen(a.querySelector(".working")),
          cancel: seen(a.querySelector(".cancel")),
          h: a.getBoundingClientRect().height,
        });
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
}
/** The samples of the newest row, with `t` in ms since its job started (after two more frames, so the last state is in). */
const samples = (page: Page): Promise<Sample[]> =>
  page.evaluate(async () => {
    for (let i = 0; i < 2; i++) await new Promise(requestAnimationFrame);
    const start = window.pascaline.session.items.at(-1)!.startedAt;
    return (window as unknown as { __samples: Sample[] }).__samples.map((s) => ({ ...s, t: s.t - start }));
  });

test("a job shows Working… and Cancel only after 150 ms, and its row keeps the result's height", async ({ page }) => {
  await open(page, "engine=fake&delay=600");
  await tap(page, ["d1", "enter"]); // a first result, so the row heights below are not the first row's
  await expect(page.locator('[data-status="done"]')).toHaveCount(1);
  await sampleRows(page);
  await tap(page, ["d2", "add", "d3", "enter"]);
  await expect(page.locator(".item").last()).toHaveAttribute("data-status", "pending");
  await expect(page.locator(".item").last().locator(".working")).toBeVisible();
  await expect(page.locator(".item").last().locator(".cancel")).toBeVisible();
  await expect(page.locator(".item").last()).toHaveAttribute("data-status", "done");
  await page.waitForTimeout(100);

  const s = (await samples(page)).filter((x) => x.t >= 0);
  const pending = s.filter((x) => x.status === "pending");
  const done = s.filter((x) => x.status === "done");
  expect(pending.length).toBeGreaterThan(5);
  // nothing to see before 150 ms (a frame of slack under it), both after it
  expect(pending.filter((x) => x.t < 130).every((x) => !x.working && !x.cancel)).toBe(true);
  expect(pending.filter((x) => x.t > 200).every((x) => x.working && x.cancel)).toBe(true);
  // one height from Enter to the result
  expect(new Set([...pending, ...done].map((x) => Math.round(x.h * 10)))).toEqual(new Set([Math.round(done[0]!.h * 10)]));
});

test("the Cancel key stops a job before Working… shows", async ({ page }) => {
  await open(page, "engine=fake&delay=2000");
  await sampleRows(page);
  await tap(page, ["d2", "add", "d3", "enter", "cancel"]);
  await expect(page.locator(".item").last()).toHaveAttribute("data-status", "cancelled");
  const s = (await samples(page)).filter((x) => x.t >= 0);
  const cancelledAt = s.find((x) => x.status === "cancelled")!.t;
  expect(cancelledAt).toBeLessThan(150); // the key acted during the delay, while nothing was drawn yet
  expect(s.some((x) => x.working || x.cancel)).toBe(false);
  // the engine is free again
  await tap(page, ["d4", "enter"]);
  await expect(page.locator(".item").last()).toHaveAttribute("data-status", "done");
});

test("Solve: its Working… line shows only after 150 ms", async ({ page }) => {
  await open(page, "engine=fake&delay=600");
  await tap(page, ["apps", "d2"]);
  await expect(page.locator('[data-app="solve"]')).toBeVisible();
  await tap(page, ["symb", "x", "shift", "dot", "d5", "enter", "num"]);
  await expect(page.locator('[data-testid="solve-table"] tr[data-name="x"]')).toBeVisible();
  // every frame: since when the line has said Working…, and whether it can be seen
  await page.evaluate(() => {
    const log: { t: number; seen: boolean }[] = [];
    (window as unknown as { __info: typeof log }).__info = log;
    let since: number | undefined;
    const frame = (): void => {
      const e = document.querySelector('[data-testid="solve-info"]');
      if (e?.textContent === "Working…") {
        since ??= performance.now();
        log.push({ t: performance.now() - since, seen: getComputedStyle(e).visibility === "visible" });
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
  await tap(page, ["menu", "d1"]);
  await expect(page.getByTestId("solve-info")).toHaveText("fake engine"); // the fake engine's info line
  const log = await page.evaluate(() => (window as unknown as { __info: { t: number; seen: boolean }[] }).__info);
  expect(log.filter((x) => x.t > 200).length).toBeGreaterThan(5);
  expect(log.filter((x) => x.t < 130).every((x) => !x.seen)).toBe(true);
  expect(log.filter((x) => x.t > 200).every((x) => x.seen)).toBe(true);
});
