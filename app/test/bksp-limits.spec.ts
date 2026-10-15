// SPDX-License-Identifier: GPL-3.0-or-later
// R26f (bug F19): ⌫ and Del at lim, Σ, Π and ∫. MathLive keeps their bounds in script branches of one operator atom
// (`subsup`, `extensible-symbol`): ⌫ in an emptied first box deletes the box (`\lim_{\to□}`) and then nothing more;
// ⌫ at the start of a bound steps out in front of the operator and deletes what stands before it; from the end of the
// line ⌫ leaves a bare `\lim` it cannot remove; Del deletes the marks →, =, `\,` and d, and no key types them back.
// The rule (decisions.md "⌫ and Del keep a template whole", points 1-5): the operator, its marks and its boxes are one
// template. lim's boxes are its variable, its target and the bracket body; Σ and Π's the index, its start, the end and
// the body; ∫'s the lower and upper bounds, the integrand and the variable after d (the last two on the line itself).
// By keys; the palette cells by the key path (`run`), as the Tmpl palette inserts them. Expected lines derived from
// the rule.
import { expect, test, type Page } from "@playwright/test";
import { entryValue, open, tap } from "./helpers.ts";

test.beforeEach(async ({ page }) => {
  await open(page);
});

const PH = "\\placeholder{}";
const LIM = "\\lim_{#?\\to#?}\\left(#0\\right)";
const SUM = "\\sum_{#?=#?}^{#?}\\left(#0\\right)";
const PROD = "\\prod_{#?=#?}^{#?}\\left(#0\\right)";
const INT = "\\int_{#?}^{#?}#0\\,\\mathrm{d}#?";

async function bksp(page: Page): Promise<string> {
  await tap(page, ["bksp"]);
  return entryValue(page);
}
async function del(page: Page): Promise<string> {
  await tap(page, ["shift", "bksp"]);
  return entryValue(page);
}
/** A Tmpl palette cell, by the key path (`run`), as the palette inserts it. */
const insert = (page: Page, latex: string): Promise<void> =>
  page.evaluate((l) => window.pascaline.entry.run({ kind: "insert", latex: l }), latex);
/** A MathLive command by the key path (the grid's way to reach the line's ends). */
const cmd = (page: Page, name: string): Promise<void> =>
  page.evaluate((n) => window.pascaline.entry.run({ kind: "cmd", name: n }), name);
/** The selected LaTeX, or "" when the selection is collapsed. */
const selected = (page: Page): Promise<string> =>
  page.evaluate(() => {
    const mf = window.pascaline.entry.field;
    return !mf || mf.selectionIsCollapsed ? "" : mf.getValue(mf.selection, "latex");
  });

// ---- an empty template goes in one ⌫ (point 4) -----------------------------------------------------------------------
for (const [name, latex] of [["lim", LIM], ["Σ", SUM], ["Π", PROD], ["∫", INT]] as const) {
  test(`${name} on an empty line, then ⌫ empties the line`, async ({ page }) => {
    await insert(page, latex);
    expect(await bksp(page)).toBe("");
  });

  test(`5 ${name}, then ⌫ ⌫: the template goes whole, then the 5`, async ({ page }) => {
    await tap(page, ["d5"]);
    await insert(page, latex);
    expect(await bksp(page)).toBe("5");
    expect(await bksp(page)).toBe("");
  });
}

// ---- lim ---------------------------------------------------------------------------------------------------------------
test("5 lim 2 3 ◀ ◀ ⌫ selects the limit, the next ⌫ deletes it, and the 5 stays", async ({ page }) => {
  await tap(page, ["d5"]);
  await insert(page, LIM);
  await tap(page, ["d2", "d3", "left", "left"]);
  const line = `5\\lim_{23\\to${PH}}\\left(${PH}\\right)`;
  expect(await entryValue(page)).toBe(line);
  expect(await bksp(page)).toBe(line);
  expect(await selected(page)).toBe(`\\lim_{23\\to${PH}}\\left(${PH}\\right)`);
  expect(await bksp(page)).toBe("5");
});

test("5 lim 2, ⌫ from the end of the line: into the body, back through the boxes, □, then the limit goes", async ({ page }) => {
  await tap(page, ["d5"]);
  await insert(page, LIM);
  await tap(page, ["d2"]);
  await cmd(page, "moveToMathfieldEnd");
  const line = `5\\lim_{2\\to${PH}}\\left(${PH}\\right)`;
  expect(await bksp(page)).toBe(line); // into the body: never the bracket alone (F15)
  expect(await selected(page)).toBe(PH);
  expect(await bksp(page)).toBe(line); // to the target's □
  expect(await selected(page)).toBe(PH);
  expect(await bksp(page)).toBe(line); // to the end of the variable
  expect(await selected(page)).toBe("");
  expect(await bksp(page)).toBe(`5\\lim_{${PH}\\to${PH}}\\left(${PH}\\right)`);
  expect(await selected(page)).toBe(PH);
  expect(await bksp(page)).toBe("5");
  expect(await bksp(page)).toBe("");
});

test("lim 2, then Del: the → stays, the boxes are visited, the limit is selected and goes", async ({ page }) => {
  await insert(page, LIM);
  await tap(page, ["d2"]);
  const line = `\\lim_{2\\to${PH}}\\left(${PH}\\right)`;
  expect(await del(page)).toBe(line); // to the target's □
  expect(await selected(page)).toBe(PH);
  expect(await del(page)).toBe(line); // to the body's □
  expect(await selected(page)).toBe(PH);
  expect(await del(page)).toBe(line); // the variable holds the 2: selected first
  expect(await selected(page)).toBe(line);
  expect(await del(page)).toBe("");
});

test("lim x ▶ 0 ◀ ⌫ at the start of the target steps to the end of the variable, and nothing goes", async ({ page }) => {
  await insert(page, LIM);
  await tap(page, ["x", "right", "d0", "left"]);
  const line = `\\lim_{x\\to0}\\left(${PH}\\right)`;
  expect(await entryValue(page)).toBe(line);
  expect(await bksp(page)).toBe(line);
  await tap(page, ["d2"]);
  expect(await entryValue(page)).toBe(`\\lim_{x2\\to0}\\left(${PH}\\right)`);
});

test("lim with only the body typed: ⌫ at the start of the variable keeps the body", async ({ page }) => {
  await insert(page, LIM);
  await tap(page, ["right", "right", "x", "add", "d1"]);
  expect(await entryValue(page)).toBe(`\\lim_{${PH}\\to${PH}}\\left(x+1\\right)`);
  await cmd(page, "moveToMathfieldStart");
  await cmd(page, "moveToNextChar");
  expect(await bksp(page)).toBe("x+1");
});

test("lim x ▶ 0 ▶ 5, ⌫ at the start of the body steps to the end of the target", async ({ page }) => {
  await insert(page, LIM);
  await tap(page, ["x", "right", "d0", "right", "d5", "left"]);
  const line = "\\lim_{x\\to0}\\left(5\\right)";
  expect(await entryValue(page)).toBe(line);
  expect(await bksp(page)).toBe(line);
  await tap(page, ["d1"]);
  expect(await entryValue(page)).toBe("\\lim_{x\\to01}\\left(5\\right)");
});

test("lim lim (nested), then ⌫ ⌫: the inner limit leaves □ in the variable, then the line empties", async ({ page }) => {
  await insert(page, LIM);
  await insert(page, LIM);
  expect(await bksp(page)).toBe(`\\lim_{${PH}\\to${PH}}\\left(${PH}\\right)`);
  expect(await selected(page)).toBe(PH);
  expect(await bksp(page)).toBe("");
});

// ---- Σ and Π -----------------------------------------------------------------------------------------------------------
for (const [name, latex, op] of [["Σ", SUM, "\\sum"], ["Π", PROD, "\\prod"]] as const) {
  test(`5 ${name} 2 3 ◀ ◀ ⌫ ⌫ selects, then deletes the template, and the 5 stays`, async ({ page }) => {
    await tap(page, ["d5"]);
    await insert(page, latex);
    await tap(page, ["d2", "d3", "left", "left"]);
    const line = `5${op}_{23=${PH}}^{${PH}}\\left(${PH}\\right)`;
    expect(await bksp(page)).toBe(line);
    expect(await selected(page)).toBe(line.slice(1));
    expect(await bksp(page)).toBe("5");
  });

  test(`${name} 2, then Del: the = stays, every box is visited, then the template is selected and goes`, async ({ page }) => {
    await insert(page, latex);
    await tap(page, ["d2"]);
    const line = `${op}_{2=${PH}}^{${PH}}\\left(${PH}\\right)`;
    for (let i = 0; i < 3; i++) {
      expect(await del(page)).toBe(line); // the start, the end, the body: each □ selected
      expect(await selected(page)).toBe(PH);
    }
    expect(await del(page)).toBe(line);
    expect(await selected(page)).toBe(line);
    expect(await del(page)).toBe("");
  });

  test(`${name} x ▶ 1 ◀ ⌫ at the start of the start box steps to the end of the index`, async ({ page }) => {
    await insert(page, latex);
    await tap(page, ["x", "right", "d1", "left"]);
    const line = `${op}_{x=1}^{${PH}}\\left(${PH}\\right)`;
    expect(await entryValue(page)).toBe(line);
    expect(await bksp(page)).toBe(line);
    await tap(page, ["d2"]);
    expect(await entryValue(page)).toBe(`${op}_{x2=1}^{${PH}}\\left(${PH}\\right)`);
  });

  test(`5 ${name} 2, ⌫ from the end of the line empties it without a lone mark`, async ({ page }) => {
    await tap(page, ["d5"]);
    await insert(page, latex);
    await tap(page, ["d2"]);
    await cmd(page, "moveToMathfieldEnd");
    const line = `5${op}_{2=${PH}}^{${PH}}\\left(${PH}\\right)`;
    for (let i = 0; i < 4; i++) expect(await bksp(page)).toBe(line); // body, end, start: □ selected; then after the 2
    expect(await bksp(page)).toBe(`5${op}_{${PH}=${PH}}^{${PH}}\\left(${PH}\\right)`);
    expect(await bksp(page)).toBe("5");
  });
}

// ---- ∫ -----------------------------------------------------------------------------------------------------------------
test("5 ∫ 2 3 ◀ ◀ ⌫ selects the integral, the next ⌫ deletes it, and the 5 stays", async ({ page }) => {
  await tap(page, ["d5"]);
  await insert(page, INT);
  await tap(page, ["d2", "d3", "left", "left"]);
  const line = `5\\int_{23}^{${PH}}${PH}\\,\\mathrm{d}${PH}`;
  expect(await bksp(page)).toBe(line);
  expect(await selected(page)).toBe(line.slice(1));
  expect(await bksp(page)).toBe("5");
});

test("5 ∫ 2, ⌫ from the end of the line: the d and the bounds stay until the integral goes whole", async ({ page }) => {
  await tap(page, ["d5"]);
  await insert(page, INT);
  await tap(page, ["d2"]);
  await cmd(page, "moveToMathfieldEnd");
  const line = `5\\int_2^{${PH}}${PH}\\,\\mathrm{d}${PH}`;
  expect(await bksp(page)).toBe(line); // to the integrand's □
  expect(await selected(page)).toBe(PH);
  expect(await bksp(page)).toBe(line); // to the upper bound's □
  expect(await selected(page)).toBe(PH);
  expect(await bksp(page)).toBe(line); // to the end of the lower bound
  expect(await bksp(page)).toBe(`5\\int_{${PH}}^{${PH}}${PH}\\,\\mathrm{d}${PH}`);
  expect(await bksp(page)).toBe("5");
});

test("∫ 2, then Del: the \\, and the d stay, every box is visited, then the integral is selected and goes", async ({ page }) => {
  await insert(page, INT);
  await tap(page, ["d2"]);
  const line = `\\int_2^{${PH}}${PH}\\,\\mathrm{d}${PH}`;
  for (let i = 0; i < 3; i++) {
    expect(await del(page)).toBe(line); // the upper bound, the integrand, the variable: each □ selected
    expect(await selected(page)).toBe(PH);
  }
  expect(await del(page)).toBe(line);
  expect(await selected(page)).toBe(line);
  expect(await del(page)).toBe("");
});

test("∫ 1 ▶ 2 ▶ x ▶ x: ⌫ at the end shows □ for the variable, and the d stays", async ({ page }) => {
  await insert(page, INT);
  await tap(page, ["d1", "right", "d2", "right", "x", "right", "x"]);
  expect(await entryValue(page)).toBe("\\int_1^2x\\,\\mathrm{d}x");
  expect(await bksp(page)).toBe(`\\int_1^2x\\,\\mathrm{d}${PH}`);
  expect(await selected(page)).toBe(PH);
  expect(await bksp(page)).toBe(`\\int_1^2x\\,\\mathrm{d}${PH}`); // to the end of the integrand
  expect(await bksp(page)).toBe(`\\int_1^2${PH}\\,\\mathrm{d}${PH}`);
});

test("∫ 1 ▶ 2 ▶ x ▶ x, ⌫ at the start of the integrand steps to the end of the upper bound", async ({ page }) => {
  await insert(page, INT);
  await tap(page, ["d1", "right", "d2", "right", "x", "right", "x"]);
  await tap(page, ["left", "left"]); // over the variable and the d, then to the start of the integrand (R27b)
  const line = "\\int_1^2x\\,\\mathrm{d}x";
  expect(await bksp(page)).toBe(line);
  await tap(page, ["d0"]);
  expect(await entryValue(page)).toBe("\\int_1^{20}x\\,\\mathrm{d}x");
});

test("∫ with only the integrand typed: ⌫ at the start of the lower bound keeps it", async ({ page }) => {
  await insert(page, INT);
  await tap(page, ["right", "right", "x", "add", "d1"]);
  expect(await entryValue(page)).toBe(`\\int_{${PH}}^{${PH}}x+1\\,\\mathrm{d}${PH}`);
  await cmd(page, "moveToMathfieldStart");
  await cmd(page, "moveToNextChar");
  expect(await bksp(page)).toBe("x+1");
});

test("∫ ▶ ▶ ∫ (an integral in the integrand), then ⌫: the inner one leaves □ there", async ({ page }) => {
  await insert(page, INT);
  await tap(page, ["right", "right"]);
  await insert(page, INT);
  expect(await bksp(page)).toBe(`\\int_{${PH}}^{${PH}}${PH}\\,\\mathrm{d}${PH}`);
  expect(await selected(page)).toBe(PH);
});

test("∫ 1 ▶ 2 ▶ x ▶ x + 3: ⌫ deletes the 3 and the + as usual, then reaches the variable", async ({ page }) => {
  await insert(page, INT);
  await tap(page, ["d1", "right", "d2", "right", "x", "right", "x", "add", "d3"]);
  expect(await bksp(page)).toBe("\\int_1^2x\\,\\mathrm{d}x+");
  expect(await bksp(page)).toBe("\\int_1^2x\\,\\mathrm{d}x");
  expect(await bksp(page)).toBe(`\\int_1^2x\\,\\mathrm{d}${PH}`);
});

// ---- the places that are no box: ◀ and ▶ skip them since R27b (F23), a tap can still put the cursor there ---------------
/** Put the cursor at offset `o`, as a tap there does. */
const at = (page: Page, o: number): Promise<void> => page.evaluate((o) => void (window.pascaline.entry.field!.position = o), o);

test("lim x ▶ 0 ▶ 5, the cursor between the bounds and the bracket, ⌫ steps to the end of the target and Del into the body", async ({ page }) => {
  await insert(page, LIM);
  await tap(page, ["x", "right", "d0", "right", "d5"]);
  await at(page, 5); // between the bounds and the bracket
  const line = "\\lim_{x\\to0}\\left(5\\right)";
  expect(await bksp(page)).toBe(line);
  await tap(page, ["d1"]);
  expect(await entryValue(page)).toBe("\\lim_{x\\to01}\\left(5\\right)");
  await at(page, 6); // the gap again (▶ goes on into the body)
  expect(await del(page)).toBe("\\lim_{x\\to01}\\left(5\\right)");
  await tap(page, ["d2"]);
  expect(await entryValue(page)).toBe("\\lim_{x\\to01}\\left(25\\right)");
});

test("∫ 1 ▶ 2 ▶ x ▶ x, the cursor between \\, and d, ⌫ steps to the end of the integrand and Del to the variable", async ({ page }) => {
  await insert(page, INT);
  await tap(page, ["d1", "right", "d2", "right", "x", "right", "x"]);
  await at(page, 7); // between \, and d
  const line = "\\int_1^2x\\,\\mathrm{d}x";
  expect(await bksp(page)).toBe(line);
  await tap(page, ["d3"]);
  expect(await entryValue(page)).toBe("\\int_1^2x3\\,\\mathrm{d}x");
  await at(page, 8); // between \, and d again (▶ goes on over the d)
  expect(await del(page)).toBe("\\int_1^2x3\\,\\mathrm{d}x");
  expect(await del(page)).toBe(`\\int_1^2x3\\,\\mathrm{d}${PH}`);
});

test("∫ 1 ▶ 2 ▶ x ▶ x + 3 ◀ ◀: Del right after the variable deletes the +, as after any template", async ({ page }) => {
  await insert(page, INT);
  await tap(page, ["d1", "right", "d2", "right", "x", "right", "x", "add", "d3", "left", "left"]);
  expect(await del(page)).toBe("\\int_1^2x\\,\\mathrm{d}x3");
  expect(await selected(page)).toBe("");
});
