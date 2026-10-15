// SPDX-License-Identifier: GPL-3.0-or-later
// R31 (F27): the keys of a hardware keyboard (a desktop, a Bluetooth keyboard on the phone or the Tab One) take the
// keypad's path. A character some keypad key types does what that key does (digits, `.`, `+ - * / ^ ( ) ,`, and the
// characters on a Shift or Alpha layer); `e` or `E` right after a number's digits is the exponent key ᴇ; a letter types
// itself as a name letter; a character no key types does nothing. The grid checks every printable ASCII character
// against the same keys pressed on the keypad (taps), in textbook and one-line entry, after a number and at the start
// of the line. Expected values are derived (mathematically provable).
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { devices, expect, test, type Page } from "@playwright/test";
import { parse } from "yaml";
import { entryValue, open, tap } from "./helpers.ts";

const here = dirname(fileURLToPath(import.meta.url));

// ---- the keypad's way to each character, from spec/keyboard.yaml ---------------------------------------------------
type Layer = "primary" | "shift" | "alpha";
interface Act { type?: string }
const doc = parse(readFileSync(join(here, "../../spec/keyboard.yaml"), "utf8")) as { keys: Record<string, unknown>[] };

/** A character a key types (`type:` of one character): the key and its layer, primary before Shift before Alpha. */
const TYPED = new Map<string, [string, Layer]>();
for (const layer of ["primary", "shift", "alpha"] as const)
  for (const key of doc.keys) {
    const t = (key[layer] as Act | undefined)?.type;
    if (t !== undefined && t.length === 1 && !TYPED.has(t)) TYPED.set(t, [key["id"] as string, layer]);
  }

/** One step on the keypad: a key tap, a pick in an open sheet, or a name letter (no key types a lower-case letter). */
type Step = { tap: string } | { item: string } | { letter: string };

/** The keypad's steps for a character; `afterNumber`: the line ends in a number's digits. [] = no key types it. */
function keypad(ch: string, afterNumber: boolean): Step[] {
  const taps = (...ids: string[]): Step[] => ids.map((id) => ({ tap: id }));
  if ((ch === "e" || ch === "E") && afterNumber) return taps("emark");
  // the operator keys (the brief: * is ×, / is ÷, ^ is xʸ, ( is the bracket pair; - is the − key, not (−))
  const op: Record<string, string> = { "-": "sub", "*": "mul", "/": "div", "^": "pow", "(": "paren" };
  if (op[ch]) return taps(op[ch] as string);
  if (ch === "|") return taps("shift", "neg"); // |x|, the absolute value
  // the Shift palettes' own symbols (R18): Shift + 6 picks by key, Shift + 9 by a tap on the cell
  if (ch === "<") return taps("shift", "d6", "d7");
  if (ch === ">") return taps("shift", "d6", "d9");
  if (ch === "!") return [...taps("shift", "d9"), { item: "fact" }];
  const hit = TYPED.get(ch);
  if (hit) return hit[1] === "primary" ? taps(hit[0]) : taps(hit[1], hit[0]);
  if (/^[a-z]$/.test(ch)) return [{ letter: ch }];
  return [];
}

// ---- the page -------------------------------------------------------------------------------------------------------
type Mode = "textbook" | "line";

async function reset(page: Page, mode: Mode): Promise<void> {
  await page.evaluate((m) => {
    const p = window.pascaline;
    p.shell.closeSheet();
    p.session.clearModifiers();
    p.session.setEntry(m);
    p.entry.clear();
    p.entry.focus();
  }, mode);
}

/** The line and what our parser makes of it (or its error). */
async function line(page: Page): Promise<{ value: string; parsed: string }> {
  return page.evaluate(async () => {
    const mf = window.pascaline.entry.field;
    if (!mf) throw new Error("no field");
    const parser = (await (0, eval)('import("/src/input/parser.ts")')) as {
      loadParser: () => Promise<{ latexToGiac: (l: string) => string }>;
    };
    const mod = await parser.loadParser();
    let parsed: string;
    try {
      parsed = mod.latexToGiac(mf.value);
    } catch (e) {
      parsed = `parser: ${(e as Error).message}`;
    }
    return { value: mf.value, parsed };
  });
}

async function onKeypad(page: Page, steps: Step[]): Promise<void> {
  for (const s of steps) {
    if ("tap" in s) await tap(page, [s.tap]);
    else if ("item" in s) await page.getByTestId("menu").locator(`[data-id="${s.item}"]`).tap();
    else await page.evaluate((c) => window.pascaline.entry.run({ kind: "type", text: c }), s.letter);
  }
}

// ---- the grid -------------------------------------------------------------------------------------------------------
const PRINTABLE = Array.from({ length: 0x7f - 0x20 }, (_, i) => String.fromCharCode(0x20 + i));

test.describe("the grid", () => {
  let page: Page;
  test.beforeAll(async ({ browser }) => {
    const port = Number(process.env["PW_PORT"] ?? 5181);
    const ctx = await browser.newContext({ ...devices["Pixel 7"], baseURL: `http://localhost:${port}` });
    page = await ctx.newPage();
    await open(page);
  });
  test.afterAll(async () => {
    await page.context().close();
  });

  test("the yaml gives the keypad's characters (digits, . + - , and the layers' = _ # : ;)", () => {
    for (const ch of "0123456789.+-, =_#:;") expect(TYPED.has(ch), ch).toBe(true);
  });

  for (const ch of PRINTABLE) {
    test(`hardware ${JSON.stringify(ch)} is the keypad's ${JSON.stringify(ch)}`, async () => {
      for (const mode of ["textbook", "line"] as const) {
        for (const [where, before, after, afterNumber] of [
          ["after a number", "2", "3", true],
          ["at the start", "", "3", false],
        ] as const) {
          await reset(page, mode);
          await page.keyboard.type(before + ch + after);
          const hw = await line(page);
          await reset(page, mode);
          if (before !== "") await tap(page, ["d2"]);
          await onKeypad(page, keypad(ch, afterNumber));
          await tap(page, ["d3"]);
          const kp = await line(page);
          const what = `${JSON.stringify(before + ch + after)} ${where}, ${mode}`;
          expect(hw.parsed, `${what}: parses as the keypad's (hardware line ${hw.value}, keypad line ${kp.value})`).toBe(kp.parsed);
          expect(hw.value, `${what}: the same line`).toBe(kp.value);
        }
      }
    });
  }
});

// ---- the brief's cases on the real engine ---------------------------------------------------------------------------
test.describe("on the engine", () => {
  test.beforeEach(async ({ page }) => {
    await open(page, "");
    await page.waitForFunction(() => window.pascaline.session.engineState === "ready", undefined, { timeout: 20_000 });
    await page.evaluate(() => window.pascaline.entry.focus());
  });
  const lastResult = (page: Page) => page.locator('[data-testid="result"]').last().locator(".result");
  const resultIs = async (page: Page, text: string, count: number): Promise<void> => {
    await expect(page.locator('[data-status="done"]')).toHaveCount(count);
    await expect(lastResult(page)).toHaveAttribute("data-text", text);
  };
  const markIs = (page: Page, mark: string) => expect(page.getByTestId("mark").last()).toHaveAttribute("data-mark", mark);

  test("1e-3 is 1ᴇ-3 on the line and 0.001, exact (it was 1·e − 3 = −0.281718171541 ≈)", async ({ page }) => {
    await page.keyboard.type("1e-3");
    expect(await entryValue(page)).toBe("1\\emark-3");
    await expect(page.locator("math-field")).toHaveText(/1ᴇ-3/);
    await page.keyboard.press("Enter");
    await resultIs(page, "0.001", 1);
    await markIs(page, "=");
  });

  test("2.5E3 is 2500, exact (it was 2.5·E·3)", async ({ page }) => {
    await page.keyboard.type("2.5E3");
    expect(await entryValue(page)).toBe("2.5\\emark3");
    await page.keyboard.press("Enter");
    await resultIs(page, "2500", 1);
    await markIs(page, "=");
  });

  test("(1+2)*3: ( is the bracket pair, ) leaves it, * is ×: 9", async ({ page }) => {
    await page.keyboard.type("(1+2)*3");
    expect(await entryValue(page)).toBe("\\left(1+2\\right)\\times3");
    await page.keyboard.press("Enter");
    await resultIs(page, "9", 1);
  });

  test(") leaves the bracket pair from inside a fraction in it: (1/2)*4 = 2", async ({ page }) => {
    await page.keyboard.type("(1/2)*4");
    expect(await entryValue(page)).toBe("\\left(\\frac{1}{2}\\right)\\times4");
    await page.keyboard.press("Enter");
    await resultIs(page, "2", 1);
  });

  test("|−2|*3: | opens the absolute value and the next | leaves it: 6", async ({ page }) => {
    await page.keyboard.type("|-2|*3");
    expect(await entryValue(page)).toBe("\\left|-2\\right|\\times3");
    await page.keyboard.press("Enter");
    await resultIs(page, "6", 1);
  });

  test("an operator on an empty line starts with Ans, as on the keypad: 2+3, then *2 = 10", async ({ page }) => {
    await page.keyboard.type("2+3");
    await page.keyboard.press("Enter");
    await resultIs(page, "5", 1);
    await page.keyboard.type("*2");
    expect(await entryValue(page)).toBe("\\ans\\times2");
    await page.keyboard.press("Enter");
    await resultIs(page, "10", 2);
  });

  test("1.5e-3/2 divides the whole number, as ᴇ then ÷ on the keypad (R14): 0.00075", async ({ page }) => {
    await page.keyboard.type("1.5e-3/2");
    expect(await entryValue(page)).toBe("\\frac{1.5\\emark-3}{2}");
    await page.keyboard.press("Enter");
    await resultIs(page, "0.00075", 1);
  });

  test("letters stay letters: pi is p·i, and e at the start is a name letter", async ({ page }) => {
    await page.keyboard.type("pi");
    expect(await entryValue(page)).toBe("pi");
    await page.evaluate(() => window.pascaline.entry.clear());
    await page.keyboard.type("e");
    expect(await entryValue(page)).toBe("e");
  });

  test("Ctrl combinations stay with the field: Ctrl+A then a digit replaces the line", async ({ page }) => {
    await page.keyboard.type("12");
    await page.keyboard.press("Control+A");
    await page.keyboard.type("7");
    expect(await entryValue(page)).toBe("7");
  });
});
