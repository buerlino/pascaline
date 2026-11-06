// SPDX-License-Identifier: GPL-3.0-or-later
// The showcase video's clips (tests/core/showcase.yaml), pressed at the song's own beat times
// (tests/core/showcase-timeline.json): the press count per clip, the result, and how late each press came.
// Timing-sensitive, so not part of test:e2e: runs only with SHOWCASE=1 (tests/core/SHOWCASE.md, "Check").
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { parse } from "yaml";
import { flick, tap } from "./helpers.ts";
import { check, replay, start, type CoreExpect, type CoreStep } from "./core-lib.ts";

type Step = CoreStep | { cell: string } | { row: string };
interface Clip {
  id: string;
  blocks: (number | string)[];
  title: string;
  setup?: Step[];
  after?: string;
  presses: Step[];
  eval: Step;
  expect: CoreExpect & { unit?: { text: string; unit: string; has?: string } };
}
interface Beat { t: number; block: number | string; beat: number; kind: string }

const file = (rel: string): string => readFileSync(new URL(rel, import.meta.url), "utf8");
const clips = (parse(file("../../tests/core/showcase.yaml")) as { clips: Clip[] }).clips;
const beats = JSON.parse(file("../../tests/core/showcase-timeline.json")) as Beat[];

/** The beat times of a clip: its blocks' beats 1-7, in order (a long clip's first beat 7 is its extra press; beat 8, the gap, has no press). */
const timesOf = (c: Clip): number[] => c.blocks.flatMap((b) => beats.filter((e) => e.block === b && e.kind !== "gap").map((e) => e.t));

async function press(page: Page, s: Step): Promise<void> {
  if (typeof s === "string") await tap(page, [s]);
  else if ("cell" in s) await page.getByTestId("menu").locator(`[data-id="${s.cell}"]`).tap();
  else if ("row" in s) await page.getByTestId("find").locator(`[role="menuitem"][data-id="${s.row}"]`).tap();
  else if ("up" in s) await flick(page, s.up, "up");
  else if ("down" in s) await flick(page, s.down, "down");
  else await replay(page, [s]);
}

/** Untimed, with the replay's waits (setup and a clip this one continues). */
async function untimed(page: Page, steps: Step[]): Promise<void> {
  for (const s of steps) {
    if (typeof s === "object" && ("cell" in s || "row" in s)) await press(page, s);
    else await replay(page, [s as CoreStep]);
  }
}

const lastRow = async (page: Page): Promise<string> =>
  page.evaluate(() => {
    const rows = document.querySelectorAll("article.item[data-status]");
    const r = rows[rows.length - 1];
    if (!r) return "(no row)";
    const res = r.querySelector(".result");
    const mark = r.querySelector('[data-testid="mark"]')?.getAttribute("data-mark") ?? "none";
    return `${res?.getAttribute("data-text") ?? r.querySelector(".error, .note")?.textContent ?? "?"} [${mark}] (${r.getAttribute("data-status")})`;
  });

test.describe("showcase clips at the song's tempo", () => {
  test.skip(process.env["SHOWCASE"] !== "1", "the showcase check runs only with SHOWCASE=1");
  test.describe.configure({ mode: "parallel" });
  for (const c of clips) {
    test(`${c.id} ${c.title}`, async ({ page }) => {
      test.setTimeout(60_000);
      const times = timesOf(c);
      expect(times.length, `beats for blocks ${c.blocks.join("+")}`).toBe(c.presses.length + 1);
      await start(page);
      if (c.after) {
        const prev = clips.find((p) => p.id === c.after) as Clip;
        await untimed(page, [...(prev.setup ?? []), ...prev.presses, prev.eval]);
      }
      await untimed(page, c.setup ?? []);
      const steps = [...c.presses, c.eval];
      const late: number[] = [];
      const t0 = Date.now() + 300;
      for (const [i, s] of steps.entries()) {
        const due = t0 + ((times[i] as number) - (times[0] as number)) * 1000;
        const wait = due - Date.now();
        if (wait > 0) await page.waitForTimeout(wait);
        late.push(Date.now() - due);
        await press(page, s);
      }
      const gaps = times.slice(1).map((t, i) => t - (times[i] as number));
      const u = c.expect.unit;
      let got = "";
      if (u) {
        const r = page.getByTestId("unit-result");
        await expect(r).toBeVisible({ timeout: 15_000 });
        got = `${await r.getAttribute("data-text")} ${await r.getAttribute("data-unit")} | ${(await r.textContent())?.trim()}`;
      } else {
        await page.waitForFunction(() => !document.querySelector('article.item[data-status="pending"]'), undefined, { timeout: 15_000 });
        got = await lastRow(page);
      }
      console.log(`SHOWCASE ${c.id}: ${c.presses.length} presses + eval; beat ${Math.round(Math.min(...gaps) * 1000)}–${Math.round(Math.max(...gaps) * 1000)} ms; ` +
        `late max ${Math.max(...late)} ms; got ${got}`);
      if (u) {
        const r = page.getByTestId("unit-result");
        await expect(r).toHaveAttribute("data-text", u.text);
        await expect(r).toHaveAttribute("data-unit", u.unit);
        if (u.has) await expect(r).toContainText(u.has);
      } else await check(page, c.expect, c.id);
      expect(Math.max(...late), "a press came later than 80 ms after its beat").toBeLessThan(80);
    });
  }
});
