// SPDX-License-Identifier: GPL-3.0-or-later
// On-device Plot frame rate for measurement builds only (VITE_MEASURE=1, started with ?bench=plot; see main.ts).
// Defines sin(X), X^3-2X and 1/X in the Function app, opens Plot (marks plot-open, and the view's own plot-ready),
// then runs a scripted zoom + pan on the real board for `runs` x `seconds`, counting requestAnimationFrame frames.
// An FPS overlay is shown while it runs; ?bench=plot&manual=1 only shows the overlay (pinch and pan by hand).
// Output for tools/device_run.py page --wait bench-done: PASCALINE_BENCH plot {json} lines in logcat.
import type { AppShell } from "./apps/shell.svelte.ts";
import type { FunctionApp } from "./apps/function/app.svelte.ts";
import { plotHook } from "./apps/function/plotHook.ts";
import { mark } from "./marks.ts";

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
const r1 = (x: number): number => Math.round(x * 10) / 10;
const pct = (xs: number[], p: number): number => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1))] ?? 0;
};

/** Frame stamps from requestAnimationFrame; reset() clears them. */
function startFrameCounter(): { stamps: number[]; reset(): void } {
  const c = {
    stamps: [] as number[],
    reset(): void {
      c.stamps.length = 0;
    },
  };
  const tick = (now: number): void => {
    c.stamps.push(now);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  return c;
}

function overlay(): HTMLElement {
  const el = document.createElement("div");
  el.setAttribute("data-testid", "fps-overlay");
  el.style.cssText = "position:fixed;top:4px;right:4px;z-index:99999;padding:2px 6px;font:12px monospace;background:#000c;color:#0f0;pointer-events:none";
  document.body.appendChild(el);
  return el;
}

/** Frames per second over the stamps at or after fromMs. */
export const fpsOf = (st: number[], fromMs: number): number => {
  const xs = st.filter((s) => s >= fromMs);
  return xs.length > 1 ? ((xs.length - 1) / ((xs[xs.length - 1] as number) - (xs[0] as number))) * 1000 : 0;
};

export async function runPlotBench(shell: AppShell, manual: boolean, runs = 5, seconds = 6): Promise<void> {
  const t0 = performance.now();
  const loaded = await shell.load("function");
  const app = loaded.instance as FunctionApp;
  ["\\sin\\left(x\\right)", "x^3-2x", "\\frac{1}{x}"].forEach((l, i) => app.define(i, l));
  await shell.setView("plot");
  while (!plotHook.board) await sleep(10);
  await new Promise<void>((r) => requestAnimationFrame(() => r()));
  mark("plot-open", { ms: performance.now() - t0, curves: plotHook.curves });
  const board = plotHook.board;
  const frames = startFrameCounter();
  const hud = overlay();
  const hudTimer = setInterval(() => (hud.textContent = `fps ${fpsOf(frames.stamps, performance.now() - 1000).toFixed(1)}`), 500);
  if (manual) return;
  await sleep(1000);
  const runFps: number[] = [];
  const secFps: number[] = [];
  const redraw: number[] = [];
  for (let run = 0; run < runs; run++) {
    frames.reset();
    redraw.length = 0;
    const start = performance.now();
    await new Promise<void>((done) => {
      const step = (now: number): void => {
        const t = (now - start) / 1000;
        if (t > seconds) return done();
        const zoom = 1 + 0.6 * Math.sin(t * 1.3);
        const cx = 3 * Math.sin(t * 0.7);
        const cy = 2 * Math.cos(t * 0.5);
        const hw = 10 * zoom;
        const hh = 7 * zoom;
        const w0 = performance.now();
        board.setBoundingBox([cx - hw, cy + hh, cx + hw, cy - hh], false);
        redraw.push(performance.now() - w0);
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
    runFps.push(fpsOf(frames.stamps, 0));
    for (let s = 0; s < seconds; s++) {
      const a = start + s * 1000;
      secFps.push(frames.stamps.filter((x) => x >= a && x < a + 1000).length);
    }
    console.log(`PASCALINE_BENCH plot-run ${JSON.stringify({ run, fps: r1(runFps[run] as number), redrawMedianMs: r1(pct(redraw, 50)), redrawP95Ms: r1(pct(redraw, 95)) })}`);
    await sleep(500);
  }
  clearInterval(hudTimer);
  console.log(
    `PASCALINE_BENCH plot ${JSON.stringify({ runs, seconds, curves: plotHook.curves, medianFps: r1(pct(runFps, 50)), minRunFps: r1(Math.min(...runFps)), p5SecondFps: r1(pct(secFps, 5)), perRun: runFps.map(r1) })}`,
  );
  mark("bench-done");
}
