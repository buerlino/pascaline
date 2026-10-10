// SPDX-License-Identifier: GPL-3.0-or-later
// Desktop FPS run: serves dist/, turns on the scripted zoom/pan, reports fps per run and the median of runs.
// usage: npm run build && node scripts/fps.mjs [runs] [seconds] [cpuThrottle]
import { chromium, firefox } from "@playwright/test";
import { preview } from "vite";

const runs = Number(process.argv[2] ?? 5);
const secs = Number(process.argv[3] ?? 6);
const throttle = Number(process.argv[4] ?? 1);
const server = await preview({ preview: { port: 4174, strictPort: true } });
const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];

for (const [name, type] of [["chromium", chromium], ["firefox", firefox]]) {
  let browser;
  try { browser = await type.launch(); } catch (e) { console.log(name, "not installed, skipped"); continue; }
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  if (name === "chromium" && throttle > 1) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: throttle });
  }
  await page.goto("http://localhost:4174/");
  await page.waitForFunction(() => window.__plot);
  const fps = [], p95 = [], wk = [];
  for (let i = 0; i < runs; i++) {
    await page.evaluate(() => { window.__plot.resetStats(); window.__plot.setAuto(true); });
    await page.waitForTimeout(secs * 1000);
    const s = await page.evaluate(() => window.__plot.stats());
    await page.evaluate(() => window.__plot.setAuto(false));
    fps.push(s.fps); p95.push(s.p95FrameMs); wk.push(s.workMedianMs);
    console.log(`${name} run ${i + 1}: ${s.fps.toFixed(1)} fps, p95 frame ${s.p95FrameMs.toFixed(1)} ms, display ${s.displayHz.toFixed(0)} Hz, redraw ${s.workMedianMs.toFixed(2)} ms`);
  }
  console.log(`${name} (cpu throttle x${throttle}) median of ${runs}: ${median(fps).toFixed(1)} fps, p95 frame ${median(p95).toFixed(1)} ms, redraw ${median(wk).toFixed(2)} ms`);
  await browser.close();
}
server.httpServer.close();
