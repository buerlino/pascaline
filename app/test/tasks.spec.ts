// SPDX-License-Identifier: GPL-3.0-or-later
// EN0, the task benchmark (docs/03 section 6, docs/04 section 5.2): replays tests/tasks/tasks.yaml on the real engine.
//  - an ACTIVE task replays its `keys` and fails when it needs more presses than its budget or shows another result;
//  - a PENDING task replays its `baseline` (today's best sequence), so the baseline stays true and its count is printed;
//  - every run prints one table: task, status, baseline presses, target presses, budget.
import { expect, test, type Page } from "@playwright/test";
import { flick, open, tap } from "./helpers.ts";
import { countPresses, keyIds, loadTasks, validate, withinBudget, type Step, type Task } from "./tasks-lib.ts";

const tasks = loadTasks();
const rows: string[] = [];

/** Press the steps in order and return the text of the last Home result (in the unit view: its result, then " " and
 *  its unit when `want` names one). Steps that need a later feature throw. */
async function replay(page: Page, steps: readonly Step[], want?: string): Promise<string> {
  for (const s of steps) {
    if (typeof s === "string") {
      await page.locator(`[data-key="${s}"]`).tap();
    } else if ("up" in s || "down" in s) {
      await ("up" in s ? flick(page, s.up, "up") : flick(page, s.down, "down"));
    } else if ("tap" in s && s.tap === "result:last") {
      await page.locator('[data-testid="result"]').last().locator(".result").tap();
    } else if ("tap" in s && s.tap.startsWith("alt:")) {
      // R63: a chip of the unit view's alternatives row (R62): `alt:si` is the first (the coherent SI unit, r17 0.2),
      // `alt:<unit>` the chip with that text; it is one touch press
      const want = s.tap.slice(4);
      const chips = page.getByTestId("unit-alt");
      await expect(chips.first()).toBeVisible();
      const chip = want === "si" ? chips.first() : chips.filter({ hasText: new RegExp(`^${want.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}$`) });
      const text = (await chip.textContent()) ?? "";
      await chip.tap();
      await expect(page.getByTestId("unit-result")).toHaveAttribute("data-unit", text); // the evaluation of the tap is in
    } else {
      throw new Error(`cannot replay ${JSON.stringify(s)} yet: the feature it taps does not exist`);
    }
  }
  // a task in the unit view (R24c): its result as the view shows it, in the unit it names
  if ((await page.getByTestId("unit-view").count()) > 0) {
    const unit = page.getByTestId("unit-result");
    await expect(unit).toHaveCount(1);
    return `${(await unit.getAttribute("data-text")) ?? ""}${want === undefined ? "" : ` ${(await unit.getAttribute("data-unit")) ?? ""}`}`;
  }
  await expect(page.locator('[data-status="done"]')).toHaveCount(1);
  const text = await page.locator('[data-testid="result"]').last().locator(".result").getAttribute("data-text");
  return text ?? "";
}

/** The counter of every press (R70): what the app counted since the page opened. */
const pressed = (page: Page): Promise<number> => page.evaluate(() => window.pascaline.session.taps.counts.presses);

async function start(page: Page): Promise<void> {
  await open(page, "");
  await page.waitForFunction(() => window.pascaline.session.engineState === "ready", undefined, { timeout: 20_000 });
}

test.describe("task list", () => {
  test("tasks.yaml is well formed: ten tasks, real key ids, budgets, sources", () => {
    expect(tasks.map((t) => t.id)).toEqual(["t01", "t02", "t03", "t04", "t05", "t06", "t07", "t08", "t09", "t10"]);
    expect(validate(tasks, keyIds())).toEqual([]);
  });

  test("presses are counted by §5.2: every step, Shift and Alpha included, taps, holds and flicks count 1", () => {
    expect(countPresses(["shift", "d3", "mul", "d2", "enter"])).toBe(5);
    expect(countPresses(["d2", { tap: "prefix:k" }, { hold: "bksp" }, { drag: "trackpad" }, "enter"])).toBe(5);
    expect(countPresses([{ down: "vars" }, { up: "dot" }, "d2", "enter"])).toBe(4); // A=2: Shift and Alpha saved
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

  // R70: the benchmark's planned count is what Settings › Counters shows (the taps that open Settings count too).
  test("t05's four presses are counted, and Settings › Counters shows the count", async ({ page }) => {
    const t05 = tasks.find((t) => t.id === "t05") as Task;
    await replay(page, t05.keys ?? [], undefined);
    expect(await pressed(page)).toBe(countPresses(t05.keys ?? []));
    expect(await pressed(page)).toBe(4);
    await tap(page, ["@menu"]); // 1 more: the ☰ button, a tap on the screen
    await page.getByTestId("menu").getByRole("menuitem").last().tap(); // Settings: 1 more
    await page.getByTestId("menu").locator('[data-id="counters"]').tap(); // Counters: 1 more
    await expect(page.getByTestId("sheet-title")).toHaveText("Home menu › Settings › Counters");
    const value = page.getByTestId("menu").locator('[data-id="presses"]').getByTestId("sheet-value");
    await expect(value).toHaveText("7");
    await page.getByTestId("menu").locator('[data-id="reset"]').tap();
    await expect(value).toHaveText("0");
  });

  // R107f1: a hardware key counts 1 through the real wiring (docs/04 5.2): < > ! (onSymbol), a dead key (onDead) and a
  // bracket closed from inside its pair (hwkeys.ts `leave`); its auto-repeat (KeyboardEvent.repeat) counts 0.
  test("hardware < > !, a dead key and a leaving ) each count 1, and a repeat counts 0", async ({ page }) => {
    await page.locator("math-field").focus();
    const press = async (key: string, repeat = false): Promise<void> => {
      await page.keyboard.down(key);
      if (repeat) await page.keyboard.down(key); // the second down of a held key is an auto-repeat (repeat: true)
      await page.keyboard.up(key);
    };
    for (const key of ["<", ">", "!", "$"]) {
      const before = await pressed(page);
      await press(key);
      expect(await pressed(page), `${key} counts 1`).toBe(before + 1);
      await press(key, true);
      expect(await pressed(page), `${key} held: the first down counts 1, the repeat 0`).toBe(before + 2);
    }
    await press("("); // opens the pair: 1 press
    const open = await pressed(page);
    await press(")"); // typed inside the pair: it leaves it (hwkeys.ts line 98), 1 press
    expect(await pressed(page), "a ) that leaves its pair counts 1").toBe(open + 1);
    await press("(");
    const again = await pressed(page);
    await press(")", true); // first down leaves and counts 1, its auto-repeat is no new press
    expect(await pressed(page), "a held ) counts once").toBe(again + 1);
  });

  // A flick step (R9) replays as a flick, not as Shift + key: 2×π with π flicked up from its key.
  test("a flick step replays as a flick", async ({ page }) => {
    const steps: Step[] = ["d2", "mul", { up: "d3" }, "enter"];
    expect(await replay(page, steps)).toBe("6.28318530718");
    expect(countPresses(steps)).toBe(4);
  });

  for (const t of tasks) {
    if (t.status === "active") {
      test(`${t.id} (active) ${t.title}: result and budget`, async ({ page }) => {
        const steps = t.keys ?? [];
        const unit = typeof t.expect.unit === "string" ? t.expect.unit : undefined;
        expect(await replay(page, steps, unit)).toBe(unit === undefined ? t.expect.text : `${t.expect.text} ${unit}`);
        // R63: a task with σ shows it as the value line does (t10: 39.5 ± 1.2)
        if (typeof t.expect.shown === "string") await expect(page.getByTestId("unit-result").locator(".value")).toHaveText(t.expect.shown);
        const n = countPresses(steps);
        expect(await pressed(page), `${t.id}: the app counted ${n} presses by docs/04 5.2`).toBe(n); // R70
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
