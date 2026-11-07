// SPDX-License-Identifier: GPL-3.0-or-later
// R142 (owner, 2026-11-06; ISO 80000-2): a legend that types a variable is italic in every mode, no bold anywhere, and
// Plain keys changes colour only. Every key and layer, with Plain keys off and on: a legend is italic exactly when its
// action types one letter, and the italic is the face the entry line draws a typed letter in (MathLive's math italic),
// not a synthesised slant of "STIX Two Math"; nothing on the keys, the sheet rows or the bubble is above weight 400;
// the unit cells drawn on the keys are upright.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import { parse } from "yaml";
import { open, tap, touch } from "./helpers.ts";

const here = dirname(fileURLToPath(import.meta.url));
interface Act { type?: string }
interface SpecKey { id: string; user?: boolean; label?: { primary?: string; shift?: string; alpha?: string }; primary?: Act; shift?: Act; alpha?: Act }
const spec = (parse(readFileSync(join(here, "../../spec/keyboard.yaml"), "utf8")) as { keys: SpecKey[] }).keys;
const isLetter = (a: Act | undefined): boolean => a?.type !== undefined && /^\p{L}$/u.test(a.type);

const set = (page: Page, keys: string): Promise<void> =>
  page.evaluate(async (keys) => {
    const url = "/src/theme/apply.ts";
    const m = (await import(/* @vite-ignore */ url)) as typeof import("../src/theme/apply.ts");
    await m.applyTheme({ family: "n62", brightness: "dark", contrast: "normal", keys } as never, document.documentElement);
  }, keys);

/** The family MathLive draws a typed single letter in (its `.ML__mathit`), read from the entry line itself. */
async function variableFamily(page: Page): Promise<string> {
  await tap(page, ["alpha", "vars"]); // A
  const fam = await page.evaluate(() => {
    const mf = document.querySelector("math-field");
    const el = mf?.shadowRoot?.querySelector(".ML__mathit");
    return el ? getComputedStyle(el).fontFamily : "";
  });
  await page.evaluate(() => window.n62.entry.clear());
  return fam;
}
const first = (family: string): string => (family.split(",")[0] ?? "").trim().replace(/["']/g, "");

interface Seen { key: string; part: string; text: string; style: string; weight: string; family: string }
const legends = (page: Page): Promise<Seen[]> =>
  page.evaluate(() => {
    const out: { key: string; part: string; text: string; style: string; weight: string; family: string }[] = [];
    for (const k of document.querySelectorAll<HTMLElement>(".pad .key"))
      for (const part of ["shiftlegend", "main", "alphalegend"]) {
        const el = k.querySelector<HTMLElement>(`.${part}`);
        if (!el) continue;
        const c = getComputedStyle(el);
        out.push({ key: k.dataset["key"] ?? "", part, text: el.textContent ?? "", style: c.fontStyle, weight: c.fontWeight, family: c.fontFamily });
      }
    return out;
  });

/** What the spec says a legend is, in the layer state: italic exactly when the shown action types one letter. */
function expected(shift: boolean, alpha: boolean, cas: boolean): Map<string, boolean> {
  const m = new Map<string, boolean>();
  for (const k of spec) {
    const lower = alpha && shift !== cas;
    const face = alpha ? (k.alpha ?? k.primary) : shift ? k.shift : k.primary;
    const hasShiftHint = !(shift && !alpha) && k.label?.shift !== undefined;
    const hasAlphaHint = !alpha && k.label?.alpha !== undefined;
    void lower;
    m.set(`${k.id}/main`, isLetter(face));
    m.set(`${k.id}/shiftlegend`, hasShiftHint && isLetter(k.shift));
    m.set(`${k.id}/alphalegend`, hasAlphaHint && isLetter(k.alpha));
  }
  return m;
}

const STATES: [string, boolean, boolean, boolean][] = [
  ["tap", false, false, false],
  ["Shift armed", true, false, false],
  ["Alpha armed", false, true, false],
  ["Shift + Alpha (lower case)", true, true, false],
  ["CAS view, Alpha (lower case)", false, true, true],
  ["CAS view, Shift + Alpha (capitals)", true, true, true],
];

for (const keys of ["colour", "plain"])
  test(`a legend is italic exactly when its action types one letter, in a real italic face, never bold: Plain keys ${keys === "plain" ? "on" : "off"}`, async ({ page }) => {
    await open(page);
    const mathit = first(await variableFamily(page));
    expect(mathit, "MathLive's variable face").not.toBe("");
    await set(page, keys);
    for (const [name, shift, alpha, cas] of STATES) {
      if (cas) await tap(page, ["@cas"]);
      else await page.evaluate(() => void window.n62.shell);
      await page.evaluate(([s, a]) => {
        window.n62.session.shift = s as boolean;
        window.n62.session.alpha = a as boolean;
      }, [shift, alpha]);
      await page.waitForTimeout(120);
      const want = expected(shift, alpha, cas);
      let italics = 0;
      for (const s of await legends(page)) {
        if (s.text === "") continue;
        const w = want.get(`${s.key}/${s.part}`);
        const where = `${name}: ${s.key} ${s.part} "${s.text}"`;
        expect(s.style === "italic", where).toBe(w);
        expect(Number(s.weight), `${where}: weight`).toBeLessThanOrEqual(400);
        if (w) {
          italics++;
          expect(first(s.family), `${where}: family`).toBe(mathit);
          expect(s.family, where).not.toContain("STIX Two Math");
        }
      }
      expect(italics, `${name}: some legends are variables`).toBeGreaterThan(20);
    }
  });

test("`:`, `;`, `#`, digits, operators and functions are upright on the Alpha layer and the tap layer", async ({ page }) => {
  await open(page);
  for (const [shift, alpha] of [[false, true], [false, false], [true, false]] as const) {
    await page.evaluate(([s, a]) => {
      window.n62.session.shift = s as boolean;
      window.n62.session.alpha = a as boolean;
    }, [shift, alpha]);
    await page.waitForTimeout(120);
    for (const s of await legends(page))
      if (/^[:;#0-9+−×÷().,=_≈±∡]$/.test(s.text) || /^(sin|cos|tan|ln|log|Ans|√|π)/.test(s.text)) expect(s.style, `${s.key} ${s.part} "${s.text}"`).toBe("normal");
  }
});

test("the flick bubble's letter is italic, a function's is upright; no bold either way, in both modes", async ({ page }) => {
  await open(page);
  for (const keys of ["colour", "plain"]) {
    await set(page, keys);
    const f = await touch(page, "vars");
    await f.move(0, 35);
    const b = page.getByTestId("flick-bubble");
    await expect(b).toHaveText("A");
    expect(await b.evaluate((e) => [getComputedStyle(e).fontStyle, getComputedStyle(e).fontWeight])).toEqual(["italic", "400"]);
    await f.end();
    await page.evaluate(() => window.n62.entry.clear());
    const g = await touch(page, "sin");
    await g.move(0, -35);
    await expect(b).toHaveText("sin⁻¹");
    expect(await b.evaluate((e) => [getComputedStyle(e).fontStyle, getComputedStyle(e).fontWeight])).toEqual(["normal", "400"]);
    await g.end();
    await page.evaluate(() => window.n62.entry.clear());
  }
});

test("the sheet's row numbers are not bold, Plain keys on or off", async ({ page }) => {
  await open(page);
  for (const keys of ["colour", "plain"]) {
    await set(page, keys);
    await page.evaluate(() => window.n62.shell.showMenu("Test", ["a", "b", "c"].map((n) => ({ id: n, label: n, run: () => {} }))));
    const n = page.getByTestId("menu").locator(".n").first();
    await n.waitFor();
    expect(Number(await n.evaluate((e) => getComputedStyle(e).fontWeight))).toBeLessThanOrEqual(400);
    await tap(page, ["esc"]);
  }
});

test("a user key's legend follows the action it holds", async ({ page }) => {
  await open(page);
  await page.evaluate(() => {
    window.n62.userKeys.set("u1", "primary", { label: "k", action: { type: "k" } } as never);
    window.n62.userKeys.set("u2", "primary", { label: "sin", action: { type: "s" } } as never);
    window.n62.userKeys.set("u3", "primary", { label: "ab", action: { type: "ab" } } as never);
  });
  await page.waitForTimeout(150);
  const seen = await legends(page);
  const st = (id: string): string | undefined => seen.find((s) => s.key === id && s.part === "main")?.style;
  expect([st("u1"), st("u2"), st("u3")]).toEqual(["italic", "italic", "normal"]);
});

test("the unit cells drawn on the keys are upright", async ({ page }) => {
  await open(page, "engine=fake&pad=1");
  await page.waitForFunction(() => (window.n62.unitPad?.model ?? null) !== null);
  for (const [shift, alpha] of [[false, false], [true, false], [false, true]] as const) {
    await page.evaluate(([s, a]) => {
      window.n62.session.shift = s as boolean;
      window.n62.session.alpha = a as boolean;
    }, [shift, alpha]);
    await page.waitForTimeout(120);
    const cells = await page.evaluate(() => (window.n62.unitPad?.model?.cells ?? []).map((c) => c.key));
    expect(cells.length).toBeGreaterThan(10);
    const seen = (await legends(page)).filter((s) => cells.includes(s.key) && s.text !== "");
    expect(seen.length).toBeGreaterThan(10);
    for (const s of seen) expect(s.style, `${s.key} ${s.part} "${s.text}"`).toBe("normal");
  }
});
