// SPDX-License-Identifier: GPL-3.0-or-later
// R24c: the unit view from the keys (docs/04 4.3, docs/archive/r9-unit-pad.md 2.1–2.8). The units key (a flick up on
// Tmpl, or Shift then Tmpl) on a line, on a picked history row and on an empty line opens the read-only formula with
// its slots and the pad up; pad presses fill the active slot and the reading follows; Enter goes on and evaluates in
// the end slot, a flick up on Enter evaluates at once; ◀ ▶ move between slots; Esc leaves and the line keeps its
// slots. Then the probe's 50 units replayed on the pad, and the check of 2026-10-19 (Part 2 point 5) on the engine.
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import { flick, open, tap } from "./helpers.ts";

type Tok = { prefix?: string; unit: string; power?: string };
/** The view is up once its pad is on the keys and its field has the focus (it loads with its first open). */
const up = (page: Page): Promise<unknown> =>
  page.waitForFunction(() => window.pascaline.unitView !== undefined && document.activeElement === window.pascaline.unitView.element && document.querySelector('[data-pad="unit"]') !== null);
const unitsKey = async (page: Page): Promise<void> => {
  await flick(page, "tmpl", "up");
  await up(page);
};
const shown = (page: Page) => page.getByTestId("unit-view");
const reading = (page: Page) => page.getByTestId("unit-reading");
const activeId = (page: Page): Promise<string | undefined> => page.evaluate(() => window.pascaline.unitView?.view.activeId);
const tokens = (page: Page, id: string): Promise<{ tokens: Tok[]; per?: number } | undefined> =>
  page.evaluate((id) => window.pascaline.unitView?.view.model(id)?.slot, id);
/** A slot as the probe writes what it means: "pfx:unit^exp", sorted (exponents below the ÷ negative). */
const meant = (s: { tokens: Tok[]; per?: number } | undefined): string =>
  (s?.tokens ?? [])
    .map((t, i) => {
      const [n, d] = (t.power ?? "1").split("/"); // (a power is "2", "-1" or "1/2")
      const p = (Number(n) / Number(d ?? "1")) * (s?.per !== undefined && i >= s.per ? -1 : 1);
      return `${t.prefix ? `${t.prefix}:` : ""}${t.unit}${p === 1 ? "" : `^${p}`}`;
    })
    .sort()
    .join(" ");

/** Press a probe step: a key id, ↑id (a flick up) or ↓id (a flick down). */
async function step(page: Page, s: string): Promise<void> {
  if (s.startsWith("↑")) await flick(page, s.slice(1), "up");
  else if (s.startsWith("↓")) await flick(page, s.slice(1), "down");
  else await tap(page, [s]);
}

test.describe("the unit view from the keys", () => {
  test.beforeEach(async ({ page }) => open(page, "engine=fake"));

  test("on a line: the slots with the pad up; presses fill the active slot, the reading follows every press", async ({ page }) => {
    await tap(page, ["d7", "d2"]);
    await unitsKey(page);
    await expect(shown(page)).toBeVisible();
    expect(await page.evaluate(() => window.pascaline.unitView?.view.formula)).toEqual({ latex: "72\\placeholder[u1]{}\\to\\placeholder[end]{}", slots: ["u1"] });
    await expect(page.locator('[data-key="d9"][data-pad="unit"]')).toBeVisible(); // the pad is up
    await expect(page.locator('[data-key="d4"][data-pad="prefix"]')).toBeVisible();
    expect(await activeId(page)).toBe("u1");
    await tap(page, ["d4"]);
    await expect(reading(page)).toHaveText("");
    await tap(page, ["d9"]);
    await expect(reading(page)).toHaveText("kilometer");
    await tap(page, ["div"]);
    await flick(page, "d3", "up");
    await expect(reading(page)).toHaveText("kilometer per hour");
    expect(meant(await tokens(page, "u1"))).toBe("h^-1 k:m");
    // the field shows the slot (setPromptValue), never as text on the entry line
    expect(await page.evaluate(() => window.pascaline.unitView?.field.getPromptValue("u1"))).toContain("\\mathrm{km}");
    expect(await page.evaluate(() => window.pascaline.entry.value)).toBe("72");
    await tap(page, ["enter"]);
    expect(await activeId(page)).toBe("end");
    await tap(page, ["d9", "div", "d3"]);
    await expect(reading(page)).toHaveText("meter per second");
  });

  test("◀ ▶ move between slots and stop at the ends; Esc leaves and the line keeps its slots", async ({ page }) => {
    await tap(page, ["d1", "add", "d2"]);
    await tap(page, ["shift", "tmpl"]); // the G2 way: Shift, then the key
    await up(page);
    await tap(page, ["d9"]);
    await tap(page, ["right"]);
    expect(await activeId(page)).toBe("u2");
    await tap(page, ["d3", "right"]);
    expect(await activeId(page)).toBe("end");
    await tap(page, ["right"]); // nothing after the end slot
    expect(await activeId(page)).toBe("end");
    await tap(page, ["left", "left"]);
    expect(await activeId(page)).toBe("u1");
    await tap(page, ["esc"]);
    await expect(shown(page)).toBeHidden();
    await expect(page.locator('[data-key="d9"][data-pad]')).toHaveCount(0); // the keypad is the keypad again
    expect(await page.evaluate(() => window.pascaline.entry.value)).toBe("1+2");
    await tap(page, ["d3"]);
    expect(await page.evaluate(() => window.pascaline.entry.value)).toBe("1+23");
    await tap(page, ["bksp"]);
    await unitsKey(page);
    await expect(shown(page)).toBeVisible();
    expect(meant(await tokens(page, "u1"))).toBe("m");
    expect(meant(await tokens(page, "u2"))).toBe("s");
  });

  test("a refused press shows its message and leaves the slot; a prefix alone cannot be left", async ({ page }) => {
    await unitsKey(page);
    await tap(page, ["sq"]); // a power with no unit before it
    await expect(page.getByTestId("unit-message")).toHaveText("A power needs a unit before it");
    await tap(page, ["d4", "enter"]);
    await expect(page.getByTestId("unit-message")).toHaveText("A prefix needs a unit after it");
    expect(await activeId(page)).toBe("u1");
    await tap(page, ["sin"]); // k A: allowed, if odd; the reading says it
    await expect(reading(page)).toHaveText("kiloampere");
  });

  test("on an empty line: the quantity 1 and its slot; on a picked history row: that row's input", async ({ page }) => {
    await unitsKey(page);
    await expect(shown(page)).toBeVisible();
    expect(await page.evaluate(() => window.pascaline.unitView?.view.formula.latex)).toBe("1\\placeholder[u1]{}\\to\\placeholder[end]{}");
    await tap(page, ["esc"]);
    await tap(page, ["d5", "mul", "d3", "enter"]);
    await expect(page.locator('[data-status="done"]')).toHaveCount(1);
    await tap(page, ["up"]); // picks the row
    await unitsKey(page);
    await expect(shown(page)).toBeVisible();
    expect(await page.evaluate(() => window.pascaline.unitView?.view.formula.slots)).toEqual(["u1", "u2"]);
  });

  test("a hardware key on the field takes the keypad's path: a digit is its prefix cell, a letter does nothing", async ({ page }) => {
    await tap(page, ["d7", "d2"]);
    await unitsKey(page);
    await expect(shown(page)).toBeVisible();
    await page.keyboard.press("4");
    await page.keyboard.press("9");
    await page.keyboard.press("x");
    await page.keyboard.press("/");
    expect(meant(await tokens(page, "u1"))).toBe("k:m");
    await expect(reading(page)).toHaveText("kilometer");
    await page.keyboard.press("Backspace"); // the ÷
    await page.keyboard.press("Enter");
    expect(await activeId(page)).toBe("end");
    await page.keyboard.press("Escape");
    await expect(shown(page)).toBeHidden();
    expect(await page.evaluate(() => window.pascaline.entry.value)).toBe("72");
  });

  test("Delete, Backspace, the arrows, Enter and Escape press the same keys on the unit view as on the entry line (one map)", async ({ page }) => {
    // every hardware key the entry line or the unit view hands to the keypad goes through entry.onKey: record them
    await page.evaluate(() => {
      const e = window.pascaline.entry;
      const on = e.onKey;
      const log: [string, string][] = [];
      (window as unknown as { keyLog: [string, string][] }).keyLog = log;
      e.onKey = (id, layer) => {
        log.push([id, layer]);
        on(id, layer);
      };
    });
    const pressed = async (k: string): Promise<[string, string][]> => {
      await page.evaluate(() => ((window as unknown as { keyLog: unknown[] }).keyLog.length = 0));
      await page.keyboard.press(k);
      return page.evaluate(() => (window as unknown as { keyLog: [string, string][] }).keyLog);
    };
    await tap(page, ["d7", "d2"]);
    expect(await pressed("Delete"), "Delete on the entry line").toEqual([["bksp", "shift"]]);
    await tap(page, ["d2"]);
    await unitsKey(page);
    await tap(page, ["d4", "d9"]);
    expect(await pressed("Delete"), "Delete on the unit view: Shift + ⌫ (Del), as on the entry line").toEqual([["bksp", "shift"]]);
    expect(meant(await tokens(page, "u1")), "Del is no pad cell: the slot keeps its unit").toBe("k:m");
    expect(await pressed("Backspace")).toEqual([["bksp", "primary"]]);
    expect(meant(await tokens(page, "u1")), "⌫ removes the unit and arms its prefix again").toBe("");
    await tap(page, ["bksp"]); // and the armed k (a prefix alone cannot leave its slot)
    expect(await pressed("ArrowRight")).toEqual([["right", "primary"]]);
    expect(await activeId(page)).toBe("end");
    expect(await pressed("ArrowLeft")).toEqual([["left", "primary"]]);
    expect(await activeId(page)).toBe("u1");
    expect(await pressed("Enter")).toEqual([["enter", "primary"]]);
    expect(await activeId(page)).toBe("end");
    expect(await pressed("Escape")).toEqual([["esc", "primary"]]);
    await expect(shown(page)).toBeHidden();
  });

  test("Math opens Find on units; a pick goes into the slot, and the pad is back", async ({ page }) => {
    await unitsKey(page);
    await tap(page, ["math"]);
    const find = page.getByTestId("find");
    await expect(find).toBeVisible();
    await find.getByRole("menuitem").nth(1).tap(); // the empty query shows the units menu (R24d): Length
    await find.getByRole("menuitem").first().tap(); // m
    await expect(find).toBeHidden();
    expect(await tokens(page, "u1")).toEqual({ tokens: [{ unit: "m" }] });
    await expect(page.locator('[data-key="d9"][data-pad="unit"]')).toBeVisible();
  });
});

// The probe's 50 units, as the probe itself types them (tools/probes/unit-presses.mjs --json, flicks): each sequence,
// its count and what the slot must mean, so a change to the probe's typePad or to the pad changes this replay too.
type ProbeRow = { u: string; presses: string[]; count: number; meant: string; missing: string[] };
const PROBE = JSON.parse(
  execFileSync(process.execPath, [fileURLToPath(new URL("../../tools/probes/unit-presses.mjs", import.meta.url)), "--json"], { encoding: "utf8" }),
) as ProbeRow[];

test("the probe's 50 units replayed on the pad, each within the probe's count and meaning what the probe means", async ({ page }) => {
  test.setTimeout(180_000);
  expect(PROBE.length, "the probe's 50 units").toBe(50);
  await open(page, "engine=fake");
  await unitsKey(page);
  await expect(shown(page)).toBeVisible();
  const wrong: string[] = [];
  let replayed = 0;
  for (const r of PROBE) {
    if (r.missing.length) continue; // not on the pad: the probe counts a Find trip it does not type
    let pressed = 0;
    for (const s of r.presses) {
      await step(page, s);
      pressed++; // a tap or a flick is one press (docs/04 5.2), as the probe counts
    }
    const got = meant(await tokens(page, "u1"));
    if (got !== r.meant) wrong.push(`${r.u}: ${got} (pressed ${r.presses.join(" ")})`);
    else if (pressed > r.count) wrong.push(`${r.u}: ${pressed} presses, the probe counts ${r.count}`);
    else replayed++;
    // empty the slot again (⌫ until empty; the count is the probe's, so this is not counted)
    for (let i = 0; i < 12 && !(await page.evaluate(() => window.pascaline.unitView?.view.model("u1")?.empty)); i++) await tap(page, ["bksp"]);
  }
  expect(wrong, "units that did not mean what the probe means within its count").toEqual([]);
  expect(replayed, "units of the probe's 50 on the pad and replayed").toBeGreaterThanOrEqual(44);
});

test.describe("on the engine (check 2026-10-19, Part 2 point 5)", () => {
  test.beforeEach(async ({ page }) => {
    await open(page, "");
    await page.waitForFunction(() => window.pascaline.session.engineState === "ready", undefined, { timeout: 20_000 });
  });
  const message = (page: Page) => page.getByTestId("unit-message");
  const result = (page: Page) => page.getByTestId("unit-result");
  /** ± has no key until R71 (Shift + `,`): it goes on the line as the key will put it. */
  const pm = (page: Page): Promise<void> => page.evaluate(() => window.pascaline.entry.insert("\\pm"));

  test("0 m + 1 s is refused (G35), not 1 s", async ({ page }) => {
    await tap(page, ["d0", "add", "d1"]);
    await unitsKey(page);
    await tap(page, ["d9", "enter", "d3"]);
    await flick(page, "enter", "up"); // evaluate at once
    await expect(message(page)).toContainText("Units don't match");
    await expect(result(page)).toHaveCount(0);
  });

  test("20 °C → K is 293.15 K; Enter in the end slot evaluates", async ({ page }) => {
    await tap(page, ["d2", "d0"]);
    await unitsKey(page);
    await flick(page, "space", "up");
    await expect(reading(page)).toHaveText("degree Celsius");
    await tap(page, ["enter", "space", "enter"]);
    await expect(result(page)).toHaveAttribute("data-text", "293.15");
    await expect(result(page)).toHaveAttribute("data-unit", "K");
  });

  test("−(20 ± 0.5 °C) is refused with G35's message", async ({ page }) => {
    await tap(page, ["neg", "paren", "d2", "d0"]);
    await pm(page);
    await tap(page, ["d0", "dot", "d5"]);
    await unitsKey(page);
    await flick(page, "space", "up");
    await flick(page, "enter", "up");
    await expect(message(page)).toHaveText("Put the minus on the number, not before the bracket around °C");
  });

  test("cos(0 ± 0.1) shows σ with ⚠ and its why-line (G41)", async ({ page }) => {
    await tap(page, ["cos", "d0"]);
    await pm(page);
    await tap(page, ["d0", "dot", "d1"]);
    await unitsKey(page);
    await flick(page, "enter", "up");
    await expect(result(page)).toContainText("±");
    await expect(page.getByTestId("unit-warn")).toHaveText("⚠");
    await expect(page.getByTestId("unit-why")).toHaveText("first order does not hold here");
  });

  test("kg·m²/s³ → W on an empty line is 1 W; without an end slot the typed unit is kept", async ({ page }) => {
    await unitsKey(page);
    for (const s of "d4 d6 d9 sq div d3 pow enter paren enter".split(" ")) await step(page, s);
    await expect(result(page)).toHaveAttribute("data-text", "1");
    await expect(result(page)).toHaveAttribute("data-unit", "W");
    await tap(page, ["esc", "d7", "d2"]);
    await unitsKey(page);
    for (const s of "d4 d9 div ↑d3".split(" ")) await step(page, s);
    await flick(page, "enter", "up");
    await expect(result(page)).toHaveAttribute("data-text", "72");
    await expect(result(page)).toHaveAttribute("data-unit", "km/h");
  });
});
