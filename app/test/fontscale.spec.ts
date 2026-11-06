// SPDX-License-Identifier: GPL-3.0-or-later
// R41 (A4a point 4): at the Android font scale 1.5 and 2.0 the keypad's text still fits: a face stays between its two legend
// lines, a legend inside its own line, nothing is cut by the key edge, in Home and CAS and in every layer. The status line
// keeps its chips on one line at 1.5 (at 2.0 its fixed 28 px header cannot hold the text: R41's report). (The scale is emulated: helpers.ts setFontScale.)
import { expect, test } from "@playwright/test";
import { open, setFontScale, tap } from "./helpers.ts";

const LAYERS: [string, string[]][] = [
  ["primary", []],
  ["shift", ["shift"]],
  ["alpha", ["alpha"]],
  ["shift+alpha", ["shift", "alpha"]],
];

for (const scale of [1.5, 2.0])
  for (const view of ["home", "cas"] as const)
    test(`the keypad's text fits its keys at font scale ${scale} (${view}, 360 px wide)`, async ({ page }) => {
      await page.setViewportSize({ width: 360, height: 740 });
      await open(page);
      if (view === "cas") await tap(page, ["@cas"]);
      await setFontScale(page, scale);
      const faceSize = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--fs-key")));
      expect(faceSize).toBeGreaterThan(20 * scale - 0.5); // the scale is on
      for (const [layer, keys] of LAYERS) {
        await page.evaluate(() => window.n62.session.clearModifiers());
        await tap(page, keys);
        const problems = await page.evaluate(() => {
          const out: string[] = [];
          for (const key of document.querySelectorAll<HTMLElement>(".pad .key")) {
            const id = key.dataset["key"];
            const kb = key.getBoundingClientRect();
            const main = key.querySelector<HTMLElement>(".main");
            const sh = key.querySelector<HTMLElement>(".shiftlegend");
            const al = key.querySelector<HTMLElement>(".alphalegend");
            const text = [main, sh, al].filter((e): e is HTMLElement => e !== null && (e.textContent ?? "").trim() !== "");
            for (const el of text) {
              const range = document.createRange();
              range.selectNodeContents(el);
              const tr = range.getBoundingClientRect();
              if (tr.left < kb.x - 0.5 || tr.right > kb.x + kb.width + 0.5) out.push(`${id}: "${el.textContent}" is cut by the key edge`);
            }
            const m = main?.getBoundingClientRect();
            const s = sh?.getBoundingClientRect();
            const a = al?.getBoundingClientRect();
            if (m && s && m.top < s.bottom - 0.5) out.push(`${id}: the face (${getComputedStyle(main!).fontSize}) rises into the shift legend line`);
            if (m && a && m.bottom > a.top + 0.5) out.push(`${id}: the face sinks into the letter line`);
            if (m && m.bottom > kb.bottom + 0.5) out.push(`${id}: the face is cut at the key's bottom`);
            // a legend's font is at most 1.1 times its own line (fit.ts LEGEND_MAX_EM, the design's ratio)
            for (const el of [sh, al])
              if (el && (el.textContent ?? "").trim() !== "" && parseFloat(getComputedStyle(el).fontSize) > el.getBoundingClientRect().height * 1.1 + 0.5)
                out.push(`${id}: the legend "${el.textContent}" (${getComputedStyle(el).fontSize}) is taller than its line`);
          }
          return out;
        });
        expect(problems, `${view} ${layer}`).toEqual([]);
      }
    });

for (const scale of [1.5])
  test(`the status line keeps its chips on one line at font scale ${scale}`, async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await open(page);
    await setFontScale(page, scale);
    const line = page.getByTestId("status");
    const box = await line.boundingBox();
    expect(box).not.toBeNull();
    const m = await line.evaluate((el) => ({ scroll: el.scrollWidth, client: el.clientWidth, height: el.getBoundingClientRect().height }));
    expect(m.scroll).toBeLessThanOrEqual(m.client + 1);
  });
