// SPDX-License-Identifier: GPL-3.0-or-later
// R26d (bug F17): ⌫ and Del at a power. MathLive keeps an exponent as an atom of its own after its base: ⌫ that
// deletes the base leaves the exponent on whatever stands before it (`2 + x² ⌫ ⌫` gave 2², `5 eˣ 2 3 ◀ ◀ ⌫ ⌫` gave
// 5²³). The rule (decisions.md "⌫ and Del keep a template whole", points 3, 4 and 6): ⌫ at the start of an exponent
// steps to the end of its base; a ⌫ that would empty a base shows □; ⌫ in an empty base removes the power when the
// exponent is empty or the key's own (x², x⁻¹), and selects it first when the exponent holds typed content. The bases
// of eˣ and 10ˣ are the key's own: they go with their exponent. By keys; expected lines derived from the rule.
import { expect, test, type Page } from "@playwright/test";
import { entryValue, open, tap } from "./helpers.ts";

test.beforeEach(async ({ page }) => {
  await open(page);
});

const PH = "\\placeholder{}";

async function bksp(page: Page): Promise<string> {
  await tap(page, ["bksp"]);
  return entryValue(page);
}
async function del(page: Page): Promise<string> {
  await tap(page, ["shift", "bksp"]);
  return entryValue(page);
}
/** The selected LaTeX, or "" when the selection is collapsed. */
const selected = (page: Page): Promise<string> =>
  page.evaluate(() => {
    const mf = window.pascaline.entry.field;
    return !mf || mf.selectionIsCollapsed ? "" : mf.getValue(mf.selection, "latex");
  });
const position = (page: Page): Promise<number> => page.evaluate(() => window.pascaline.entry.field?.position ?? -1);

test("2 + x² ⌫ ⌫ gives 2: the exponent never lands on the 2", async ({ page }) => {
  await tap(page, ["d2", "add", "sq"]);
  expect(await entryValue(page)).toBe(`2+${PH}^2`);
  expect(await bksp(page)).toBe("2+");
  expect(await bksp(page)).toBe("2");
});

for (const [keys, name] of [
  [["sq"], "x²"],
  [["pow"], "xʸ"],
  [["shift", "div"], "x⁻¹"],
  [["shift", "log"], "10ˣ"],
  [["shift", "ln"], "eˣ"],
] as const) {
  test(`${name} on an empty line, then ⌫ empties it`, async ({ page }) => {
    await tap(page, [...keys]);
    expect(await entryValue(page)).not.toBe("");
    expect(await bksp(page)).toBe("");
  });
}

test("5 xʸ 2 3 ◀ ◀ ⌫ steps to the end of the base and keeps 5^{23}", async ({ page }) => {
  await tap(page, ["d5", "pow", "d2", "d3", "left", "left"]);
  expect(await bksp(page)).toBe("5^{23}");
  expect(await position(page)).toBe(1);
  await tap(page, ["d7"]);
  expect(await entryValue(page)).toBe("57^{23}");
});

test("5 xʸ 2 3 ◀ ◀ ⌫ ⌫: the emptied base shows □; then ⌫ selects the power and ⌫ deletes it", async ({ page }) => {
  await tap(page, ["d5", "pow", "d2", "d3", "left", "left"]);
  await bksp(page);
  expect(await bksp(page)).toBe(`${PH}^{23}`);
  // the □ is selected: a digit typed now is the new base
  expect(await selected(page)).toBe(PH);
  expect(await bksp(page)).toBe(`${PH}^{23}`);
  expect(await selected(page)).toBe(`${PH}^{23}`);
  expect(await bksp(page)).toBe("");
});

test("a digit typed into the emptied base becomes the base", async ({ page }) => {
  await tap(page, ["d5", "pow", "d2", "d3", "left", "left", "bksp", "bksp", "d7"]);
  expect(await entryValue(page)).toBe("7^{23}");
});

test("5 eˣ 2 3 ◀ ◀ ⌫ ⌫ never puts the exponent on the 5: the second ⌫ selects e^23, the third deletes it", async ({ page }) => {
  await tap(page, ["d5", "shift", "ln", "d2", "d3", "left", "left"]);
  const lines = [await bksp(page), await bksp(page)];
  for (const l of lines) expect(l).toBe("5\\exponentialE^{23}");
  expect(await selected(page)).toBe("\\exponentialE^{23}");
  expect(await bksp(page)).toBe("5");
});

test("5 10ˣ 2 3 ◀ ◀ ⌫ ⌫ never shortens the 10: the power goes whole (after a digit the key is ×10ˣ, R27a)", async ({ page }) => {
  await tap(page, ["d5", "shift", "log", "d2", "d3", "left", "left"]);
  expect(await bksp(page)).toBe("5\\times10^{23}");
  expect(await bksp(page)).toBe("5\\times10^{23}");
  expect(await selected(page)).toBe("10^{23}");
  expect(await bksp(page)).toBe("5\\times");
});

test("5 eˣ 2 ⌫ ⌫ gives 5: the emptied exponent shows □, then the power goes", async ({ page }) => {
  await tap(page, ["d5", "shift", "ln", "d2"]);
  expect(await bksp(page)).toBe(`5\\exponentialE^{${PH}}`);
  expect(await bksp(page)).toBe("5");
});

test("x² from the end: ⌫ steps into the exponent, the emptied exponent shows □, then the exponent goes alone", async ({ page }) => {
  await tap(page, ["d5", "sq"]);
  expect(await entryValue(page)).toBe("5^2");
  expect(await bksp(page)).toBe("5^2"); // into the exponent
  expect(await bksp(page)).toBe(`5^{${PH}}`);
  expect(await bksp(page)).toBe("5");
  expect(await bksp(page)).toBe("");
});

// the owner, 2026-10-15: an empty exponent on a typed base goes alone in one ⌫ (one ⌫ per key press)
test("5 xʸ ⌫ gives 5: an empty exponent on a typed base goes alone, the cursor after the 5", async ({ page }) => {
  await tap(page, ["d5", "pow"]);
  expect(await entryValue(page)).toBe(`5^{${PH}}`);
  expect(await bksp(page)).toBe("5");
  await tap(page, ["d7"]);
  expect(await entryValue(page)).toBe("57");
});

test("a bracket base steps (its pair may be the one-line x⁻¹'s own): ( 1 + 2 ) xʸ ⌫ keeps the power", async ({ page }) => {
  await tap(page, ["paren", "d1", "add", "d2", "right", "pow"]);
  expect(await entryValue(page)).toBe(`\\left(1+2\\right)^{${PH}}`);
  expect(await bksp(page)).toBe(`\\left(1+2\\right)^{${PH}}`);
  expect(await position(page)).toBe(5); // right after the pair
});

test("a typed exponent still steps: 5 xʸ 2 ◀ ⌫ keeps 5^2 with the cursor after the 5", async ({ page }) => {
  await tap(page, ["d5", "pow", "d2", "left"]);
  expect(await bksp(page)).toBe("5^2");
  expect(await position(page)).toBe(1);
});

test("an exponent stays on a letter: 2 L x², ⌫ after the L leaves 2□², not 2²", async ({ page }) => {
  await tap(page, ["d2", "alpha", "sq", "sq"]);
  expect(await entryValue(page)).toBe("2L^2");
  await page.evaluate(() => {
    const mf = window.pascaline.entry.field;
    if (mf) mf.position = 2; // right after the L
  });
  expect(await bksp(page)).toBe(`2${PH}^2`);
});

test("a number base shrinks digit by digit: 1 2 xʸ 3, ⌫ after the 2 gives 1^{3}", async ({ page }) => {
  await tap(page, ["d1", "d2", "pow", "d3"]);
  expect(await entryValue(page)).toBe("12^3");
  await page.evaluate(() => {
    const mf = window.pascaline.entry.field;
    if (mf) mf.position = 2; // right after the 2
  });
  expect(await bksp(page)).toBe("1^3");
});

test("Del at the end of a base steps into the exponent and deletes nothing", async ({ page }) => {
  await tap(page, ["d5", "pow", "d2", "d3", "left", "left", "left"]);
  expect(await position(page)).toBe(1);
  expect(await del(page)).toBe("5^{23}");
  await tap(page, ["d7"]);
  expect(await entryValue(page)).toBe("5^{723}");
});

test("Del at the end of a typed exponent selects the power, the next Del deletes it", async ({ page }) => {
  await tap(page, ["shift", "ln", "d2"]);
  expect(await del(page)).toBe("\\exponentialE^2");
  expect(await selected(page)).toBe("\\exponentialE^2");
  expect(await del(page)).toBe("");
});

test("Del right before a base of one digit leaves □ and keeps the exponent", async ({ page }) => {
  await tap(page, ["d5", "pow", "d2", "d3"]);
  await page.evaluate(() => {
    const mf = window.pascaline.entry.field;
    if (mf) mf.position = 0;
  });
  expect(await del(page)).toBe(`${PH}^{23}`);
});

test("Undo brings the base back", async ({ page }) => {
  await tap(page, ["d5", "pow", "d2", "d3", "left", "left", "bksp", "bksp"]);
  expect(await entryValue(page)).toBe(`${PH}^{23}`);
  await tap(page, ["undo"]);
  expect(await entryValue(page)).toBe("5^{23}");
});

test("hardware Backspace takes the same path: 2 + x², two presses give 2", async ({ page }) => {
  await tap(page, ["d2", "add", "sq"]);
  await page.keyboard.press("Backspace");
  await page.keyboard.press("Backspace");
  expect(await entryValue(page)).toBe("2");
});
