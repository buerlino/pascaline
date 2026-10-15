// SPDX-License-Identifier: GPL-3.0-or-later
// R27b (F23): the cursor stops only where a key can type into a box. ◀, ▶, ▲, ▼ and every trackpad step skip the
// positions inside a name (EQ, approx, NOT, the one-line sqrt, AND), inside the `if ` of piecewise and the d of ∫,
// between a function name and its bracket (sin‸(2) was read as sin(7·2) after a 7), and before the marks ∂ and the
// evaluate-at subscript; R27c: an upright letter that is not ∫'s d (an i or e in a recalled line) is a stop on either
// side. Lines and offsets probed in MathLive 0.111.1 (Pixel 7 profile, `?engine=fake`, 2026-10-15);
// the expected lines are what a 7 typed at each stop gives (derived: the 7 lands in the box at the cursor).
import { expect, test, type Page } from "@playwright/test";
import { drag, entryValue, open, recordVibrations, tap, vibrations } from "./helpers.ts";

test.beforeEach(async ({ page }) => {
  await recordVibrations(page);
  await open(page);
});

// [line, [stop offset, the line after a 7 typed there]…]: every stop from the start to the end, in order
const STOPS: [string, [number, string][]][] = [
  ["\\sin\\left(2\\right)", [[0, "7\\sin\\left(2\\right)"], [2, "\\sin\\left(72\\right)"], [3, "\\sin\\left(27\\right)"], [4, "\\sin\\left(2\\right)7"]]],
  ["\\log_{2}\\left(8\\right)", [[0, "7\\log_2\\left(8\\right)"], [1, "\\log_{72}\\left(8\\right)"], [2, "\\log_{27}\\left(8\\right)"], [4, "\\log_2\\left(78\\right)"], [5, "\\log_2\\left(87\\right)"], [6, "\\log_2\\left(8\\right)7"]]],
  ["\\operatorname{EQ}\\left(1,2\\right)", [[0, "7\\operatorname{EQ}\\left(1,2\\right)"], [5, "\\operatorname{EQ}\\left(71,2\\right)"], [6, "\\operatorname{EQ}\\left(17,2\\right)"], [7, "\\operatorname{EQ}\\left(1,72\\right)"], [8, "\\operatorname{EQ}\\left(1,27\\right)"], [9, "\\operatorname{EQ}\\left(1,2\\right)7"]]],
  ["\\operatorname{approx}\\left(2\\right)", [[0, "7\\operatorname{approx}\\left(2\\right)"], [9, "\\operatorname{approx}\\left(72\\right)"], [10, "\\operatorname{approx}\\left(27\\right)"], [11, "\\operatorname{approx}\\left(2\\right)7"]]],
  ["\\operatorname{NOT}\\left(1\\right)", [[0, "7\\operatorname{NOT}\\left(1\\right)"], [6, "\\operatorname{NOT}\\left(71\\right)"], [7, "\\operatorname{NOT}\\left(17\\right)"], [8, "\\operatorname{NOT}\\left(1\\right)7"]]],
  ["\\operatorname{sqrt}\\left(4\\right)", [[0, "7\\operatorname{sqrt}\\left(4\\right)"], [7, "\\operatorname{sqrt}\\left(74\\right)"], [8, "\\operatorname{sqrt}\\left(47\\right)"], [9, "\\operatorname{sqrt}\\left(4\\right)7"]]],
  ["1\\operatorname{AND}2", [[0, "71\\operatorname{AND}2"], [1, "17\\operatorname{AND}2"], [6, "1\\operatorname{AND}72"], [7, "1\\operatorname{AND}27"]]],
  ["\\begin{cases}x & \\text{if }x=0\\\\ 1 & \\text{if }x=1\\end{cases}", [
    [0, "7\\begin{cases}x & \\text{if }x=0\\\\ 1 & \\text{if }x=1\\end{cases}"],
    [1, "\\begin{cases}7x & \\text{if }x=0\\\\ 1 & \\text{if }x=1\\end{cases}"],
    [2, "\\begin{cases}x7 & \\text{if }x=0\\\\ 1 & \\text{if }x=1\\end{cases}"],
    [6, "\\begin{cases}x & \\text{if }7x=0\\\\ 1 & \\text{if }x=1\\end{cases}"], // after `if `, typed as maths, not text
    [7, "\\begin{cases}x & \\text{if }x7=0\\\\ 1 & \\text{if }x=1\\end{cases}"],
    [8, "\\begin{cases}x & \\text{if }x=70\\\\ 1 & \\text{if }x=1\\end{cases}"],
    [9, "\\begin{cases}x & \\text{if }x=07\\\\ 1 & \\text{if }x=1\\end{cases}"],
    [10, "\\begin{cases}x & \\text{if }x=0\\\\ 71 & \\text{if }x=1\\end{cases}"],
    [11, "\\begin{cases}x & \\text{if }x=0\\\\ 17 & \\text{if }x=1\\end{cases}"],
    [15, "\\begin{cases}x & \\text{if }x=0\\\\ 1 & \\text{if }7x=1\\end{cases}"],
    [16, "\\begin{cases}x & \\text{if }x=0\\\\ 1 & \\text{if }x7=1\\end{cases}"],
    [17, "\\begin{cases}x & \\text{if }x=0\\\\ 1 & \\text{if }x=71\\end{cases}"],
    [18, "\\begin{cases}x & \\text{if }x=0\\\\ 1 & \\text{if }x=17\\end{cases}"],
    [19, "\\begin{cases}x & \\text{if }x=0\\\\ 1 & \\text{if }x=1\\end{cases}7"],
  ]],
  ["\\int_{0}^{1}x^2\\,\\mathrm{d}x", [[0, "7\\int_0^1x^2\\,\\mathrm{d}x"], [1, "\\int_{70}^1x^2\\,\\mathrm{d}x"], [2, "\\int_{07}^1x^2\\,\\mathrm{d}x"], [3, "\\int_0^{71}x^2\\,\\mathrm{d}x"], [4, "\\int_0^{17}x^2\\,\\mathrm{d}x"], [5, "\\int_0^17x^2\\,\\mathrm{d}x"], [6, "\\int_0^1x7^2\\,\\mathrm{d}x"], [7, "\\int_0^1x^{72}\\,\\mathrm{d}x"], [8, "\\int_0^1x^{27}\\,\\mathrm{d}x"], [9, "\\int_0^1x^27\\,\\mathrm{d}x"], [12, "\\int_0^1x^2\\,\\mathrm{d}x7"]]],
  ["\\lim_{x\\to0}\\left(x\\right)", [[0, "7\\lim_{x\\to0}\\left(x\\right)"], [1, "\\lim_{7x\\to0}\\left(x\\right)"], [2, "\\lim_{x7\\to0}\\left(x\\right)"], [3, "\\lim_{x\\to70}\\left(x\\right)"], [4, "\\lim_{x\\to07}\\left(x\\right)"], [6, "\\lim_{x\\to0}\\left(7x\\right)"], [7, "\\lim_{x\\to0}\\left(x7\\right)"], [8, "\\lim_{x\\to0}\\left(x\\right)7"]]],
  ["\\sum_{k=1}^{3}\\left(k\\right)", [[0, "7\\sum_{k=1}^3\\left(k\\right)"], [1, "\\sum_{7k=1}^3\\left(k\\right)"], [2, "\\sum_{k7=1}^3\\left(k\\right)"], [3, "\\sum_{k=71}^3\\left(k\\right)"], [4, "\\sum_{k=17}^3\\left(k\\right)"], [5, "\\sum_{k=1}^{73}\\left(k\\right)"], [6, "\\sum_{k=1}^{37}\\left(k\\right)"], [8, "\\sum_{k=1}^3\\left(7k\\right)"], [9, "\\sum_{k=1}^3\\left(k7\\right)"], [10, "\\sum_{k=1}^3\\left(k\\right)7"]]],
  ["\\frac{\\partial x^2}{\\partial x}", [[0, "7\\frac{\\partial x^2}{\\partial x}"], [2, "\\frac{\\partial7x^2}{\\partial x}"], [3, "\\frac{\\partial x7^2}{\\partial x}"], [4, "\\frac{\\partial x^{72}}{\\partial x}"], [5, "\\frac{\\partial x^{27}}{\\partial x}"], [6, "\\frac{\\partial x^27}{\\partial x}"], [8, "\\frac{\\partial x^2}{\\partial7x}"], [9, "\\frac{\\partial x^2}{\\partial x7}"], [10, "\\frac{\\partial x^2}{\\partial x}7"]]],
  ["\\left.x^2\\right|_{x=3}", [[0, "7\\left.x^2\\right|_{x=3}"], [1, "\\left.7x^2\\right|_{x=3}"], [2, "\\left.x7^2\\right|_{x=3}"], [3, "\\left.x^{72}\\right|_{x=3}"], [4, "\\left.x^{27}\\right|_{x=3}"], [5, "\\left.x^27\\right|_{x=3}"], [7, "\\left.x^2\\right|_{7x=3}"], [8, "\\left.x^2\\right|_{x7=3}"], [9, "\\left.x^2\\right|_{x=73}"], [10, "\\left.x^2\\right|_{x=37}"], [11, "\\left.x^2\\right|_{x=3}7"]]],
  // R27c: only ∫'s d is a mark; an i or e typed as an upright letter (a recalled or pasted line) is a plain atom
  ["3+2\\mathrm{i}", [[0, "73+2\\mathrm{i}"], [1, "37+2\\mathrm{i}"], [2, "3+72\\mathrm{i}"], [3, "3+27\\mathrm{i}"], [4, "3+2\\mathrm{i}7"]]],
  ["2\\mathrm{e}", [[0, "72\\mathrm{e}"], [1, "27\\mathrm{e}"], [2, "2\\mathrm{e}7"]]],
  // the i and eˣ keys' atoms hold an upright letter inside; the cursor never goes in (e‸² is MathLive's own stop, left as is)
  ["2\\imaginaryI", [[0, "72\\imaginaryI"], [1, "27\\imaginaryI"], [4, "2\\imaginaryI7"]]],
  ["\\exponentialE^{2}", [[0, "7\\exponentialE^2"], [3, "\\exponentialE7^2"], [4, "\\exponentialE^{72}"], [5, "\\exponentialE^{27}"], [6, "\\exponentialE^27"]]],
  // a name one level down (in a numerator)
  ["\\frac{\\operatorname{EQ}\\left(1,2\\right)}{3}", [[0, "7\\frac{\\operatorname{EQ}\\left(1,2\\right)}{3}"], [1, "\\frac{7\\operatorname{EQ}\\left(1,2\\right)}{3}"], [6, "\\frac{\\operatorname{EQ}\\left(71,2\\right)}{3}"], [7, "\\frac{\\operatorname{EQ}\\left(17,2\\right)}{3}"], [8, "\\frac{\\operatorname{EQ}\\left(1,72\\right)}{3}"], [9, "\\frac{\\operatorname{EQ}\\left(1,27\\right)}{3}"], [10, "\\frac{\\operatorname{EQ}\\left(1,2\\right)7}{3}"], [11, "\\frac{\\operatorname{EQ}\\left(1,2\\right)}{73}"], [12, "\\frac{\\operatorname{EQ}\\left(1,2\\right)}{37}"], [13, "\\frac{\\operatorname{EQ}\\left(1,2\\right)}{3}7"]]],
];

/** The offsets ▶ (`dir` 1) or ◀ (-1) visits from one end of `line` to the other, by the key path (`entry.run`). */
function walk(page: Page, line: string, dir: 1 | -1): Promise<number[]> {
  return page.evaluate(
    ([line, dir]) => {
      const entry = window.pascaline.entry;
      const mf = entry.field!;
      entry.set(line);
      mf.position = dir === 1 ? 0 : mf.lastOffset;
      const seen = [mf.position];
      for (let k = 0; k < 40; k++) {
        entry.run({ kind: "cmd", name: dir === 1 ? "moveToNextChar" : "moveToPreviousChar" });
        if (mf.position === seen[seen.length - 1]) break;
        seen.push(mf.position);
      }
      return seen;
    },
    [line, dir] as const,
  );
}

for (const [line, stops] of STOPS) {
  test(`◀ and ▶ stop only where a 7 lands in a box: ${line}`, async ({ page }) => {
    const offsets = stops.map(([o]) => o);
    expect(await walk(page, line, 1)).toEqual(offsets);
    expect(await walk(page, line, -1)).toEqual([...offsets].reverse());
    const typed = await page.evaluate(
      ([line, offsets]) =>
        offsets.map((o) => {
          const entry = window.pascaline.entry;
          entry.set(line);
          entry.field!.position = o;
          entry.run({ kind: "type", text: "7" });
          return entry.value;
        }),
      [line, offsets] as const,
    );
    expect(typed).toEqual(stops.map(([, v]) => v));
  });
}

const set = (page: Page, line: string, at?: number): Promise<void> =>
  page.evaluate(
    ([line, at]) => {
      window.pascaline.entry.set(line);
      if (at !== undefined) window.pascaline.entry.field!.position = at;
    },
    [line, at] as const,
  );
const position = (page: Page): Promise<number> => page.evaluate(() => window.pascaline.entry.field!.position);

test("by the keys: ◀ from inside sin's bracket goes before sin; ▶ into piecewise's condition types maths", async ({ page }) => {
  await set(page, "\\sin\\left(2\\right)");
  await tap(page, ["left", "left", "left", "d7"]);
  expect(await entryValue(page)).toBe("7\\sin\\left(2\\right)");
  await set(page, "\\begin{cases}x & \\text{if }x=0\\\\ 1 & \\text{if }x=1\\end{cases}", 2);
  await tap(page, ["right", "d7"]);
  expect(await entryValue(page)).toBe("\\begin{cases}x & \\text{if }7x=0\\\\ 1 & \\text{if }x=1\\end{cases}");
  await set(page, "\\int_{0}^{1}x^2\\,\\mathrm{d}x", 9);
  await tap(page, ["right"]);
  expect(await position(page)).toBe(12); // over the d, to the end of the variable
  await tap(page, ["left"]);
  expect(await position(page)).toBe(9);
});

test("the trackpad: three steps left from the end of approx(2) reach the start, one tick per step", async ({ page }) => {
  await page.evaluate(() => window.pascaline.session.setHaptics({ on: true }));
  await set(page, "\\operatorname{approx}\\left(2\\right)");
  const before = (await vibrations(page)).length;
  await drag(page, "left", -40, 0); // three steps (12 px each)
  expect((await vibrations(page)).length - before).toBe(1 + 3); // touch + three steps
  expect(await position(page)).toBe(0);
  await tap(page, ["d7"]);
  expect(await entryValue(page)).toBe("7\\operatorname{approx}\\left(2\\right)");
});

test("▲ and ▼ never leave the cursor inside a name", async ({ page }) => {
  // offsets 2–9 are inside approx and its gap to the bracket; ▲ from the denominator aims at the middle of the numerator
  const line = "\\frac{\\operatorname{approx}\\left(2\\right)}{3}";
  for (const at of [13, 14]) {
    await set(page, line, at);
    await page.evaluate(() => window.pascaline.entry.run({ kind: "cmd", name: "moveUp" }));
    const o = await position(page);
    expect(o >= 2 && o <= 9, `▲ from ${at} landed on ${o}`).toBe(false);
  }
  await set(page, "\\frac{3}{\\operatorname{approx}\\left(2\\right)}", 2);
  await page.evaluate(() => window.pascaline.entry.run({ kind: "cmd", name: "moveDown" }));
  const o = await position(page);
  expect(o >= 4 && o <= 11, `▼ landed on ${o}`).toBe(false);
});
