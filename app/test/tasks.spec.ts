// SPDX-License-Identifier: GPL-3.0-or-later
// EN0, the task benchmark (docs/03 section 6, docs/04 section 5.2): replays tests/tasks/tasks.yaml on the real engine.
//  - an ACTIVE task replays its `keys` and fails when it needs more presses than its budget or shows another result;
//  - a PENDING task replays its `baseline` (today's best sequence), so the baseline stays true and its count is printed;
//  - every run prints one table: task, status, baseline presses, target presses, budget.
import { expect, test, type Page } from "@playwright/test";
import { open } from "./helpers.ts";
import { countPresses, keyIds, loadTasks, validate, withinBudget, type Step, type Task } from "./tasks-lib.ts";

const tasks = loadTasks();
const rows: string[] = [];

/** Press the steps in order and return the text of the last Home result. Steps that need a later feature throw. */
async function replay(page: Page, steps: readonly Step[]): Promise<string> {
  for (const s of steps) {
    if (typeof s === "string") {
      await page.locator(`[data-key="${s}"]`).tap();
    } else if ("tap" in s && s.tap === "result:last") {
      await page.locator('[data-testid="result"]').last().locator(".result").tap();
    } else {
      throw new Error(`cannot replay ${JSON.stringify(s)} yet: the feature it taps does not exist`);
    }
  }
  await expect(page.locator('[data-status="done"]')).toHaveCount(1);
  const text = await page.locator('[data-testid="result"]').last().locator(".result").getAttribute("data-text");
  return text ?? "";
}

async function start(page: Page): Promise<void> {
  await open(page, "");
  await page.waitForFunction(() => window.pascaline.session.engineState === "ready", undefined, { timeout: 20_000 });
}

test.describe("task list", () => {
  test("tasks.yaml is well formed: ten tasks, real key ids, budgets, sources", () => {
    expect(tasks.map((t) => t.id)).toEqual(["t01", "t02", "t03", "t04", "t05", "t06", "t07", "t08", "t09", "t10"]);
    expect(validate(tasks, keyIds())).toEqual([]);
  });

  test("presses are counted by §5.2: every step, Shift and Alpha included, taps and holds count 1", () => {
    expect(countPresses(["shift", "d3", "mul", "d2", "enter"])).toBe(5);
    expect(countPresses(["d2", { tap: "prefix:k" }, { hold: "bksp" }, { drag: "trackpad" }, "enter"])).toBe(5);
    expect(withinBudget(["d1", "enter"], 2)).toBe(true);
    expect(withinBudget(["d1", "d2", "enter"], 2)).toBe(false);
  });

  test("validate() rejects a wrong key id, an over-budget plan and a baseline that disagrees with the value", () => {
    const t: Task = { ...(tasks.find((t) => t.id === "t05") as Task), id: "t99", keys: ["math", "zz"], budget: 1 };
    const b: Task = { ...(tasks.find((t) => t.id === "t05") as Task), id: "t98", baseline: { keys: ["d1"], text: "299792459" } };
    const bad = validate([t, b], keyIds());
    expect(bad.some((m) => m.includes('no key "zz"'))).toBe(true);
    expect(bad.some((m) => m.includes("budget 1"))).toBe(true);
    expect(bad.some((m) => m.includes("is not expect.value"))).toBe(true);
  });
});

test.describe("replay", () => {
  test.beforeEach(async ({ page }) => start(page));

  // The active path, exercised with a stand-in so the harness is proven before the first task goes active:
  // t05's baseline as if it were its key list, within a budget it meets and one it misses.
  test("an active task: replay, result and budget", async ({ page }) => {
    const steps = tasks.find((t) => t.id === "t05")?.baseline?.keys ?? [];
    const text = await replay(page, steps);
    expect(text).toBe(tasks.find((t) => t.id === "t05")?.expect.text);
    expect(withinBudget(steps, 10)).toBe(true);
    expect(withinBudget(steps, 9)).toBe(false);
  });

  for (const t of tasks) {
    if (t.status === "active") {
      test(`${t.id} (active) ${t.title}: result and budget`, async ({ page }) => {
        const steps = t.keys ?? [];
        expect(await replay(page, steps)).toBe(t.expect.text);
        const n = countPresses(steps);
        rows.push(`${t.id} | active  | ${t.baseline ? countPresses(t.baseline.keys) : "-"} | ${n} | ${t.budget}`);
        expect(n, `${t.id} takes ${n} presses, budget ${t.budget}`).toBeLessThanOrEqual(t.budget ?? 0);
      });
    } else if (t.baseline) {
      test(`${t.id} (pending) ${t.title}: baseline today`, async ({ page }) => {
        const steps = t.baseline?.keys ?? [];
        expect(await replay(page, steps)).toBe(t.baseline?.text);
        rows.push(`${t.id} | pending | ${countPresses(steps)} | ${t.keys ? countPresses(t.keys) : "-"} | ${t.budget ?? "-"}`);
      });
    } else {
      rows.push(`${t.id} | pending | - | ${t.keys ? countPresses(t.keys) : "-"} | ${t.budget ?? "-"}`);
    }
  }
});

test.afterAll(() => {
  const head = "task | status  | baseline | target | budget";
  console.log(`\nTASK BENCHMARK (presses, §5.2)\n${head}\n${[...rows].sort().join("\n")}`);
});
