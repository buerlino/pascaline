// SPDX-License-Identifier: GPL-3.0-or-later
// Plot spike (Q6): three functions in JSXGraph, pinch/pan/wheel, rAF-based FPS overlay.
// Point evaluation: LaTeX -> JS closure (ron's parser by default, Compute Engine with ?compiler=ce).
import JXG from "jsxgraph";
import "../node_modules/jsxgraph/distrib/jsxgraph.css";
import { mark } from "./marks";
import { toFn as ronFn } from "./ron/emit-js.ts";

mark("plot-js-start");

const FUNCS = ["\\sin(x)", "x^3-2x", "\\frac{1}{x}"];
const COLORS = ["#4da3ff", "#ff8c42", "#6fd36f"];

// Point evaluation: ron's LaTeX-subset compiler (default) or Compute Engine compile() with ?compiler=ce
// (loaded on demand, so it costs nothing unless asked for). Both give a closure (x) => y without per-call allocation.
type Fn = (x: number) => number;
async function ceFn(latex: string): Promise<Fn> {
  const { compile } = await import("@cortex-js/compute-engine");
  const c = compile(latex, { strict: true });
  if (!c.success) throw new Error(`cannot compile ${latex}`);
  const vars = { x: 0 };
  return (x: number) => {
    vars.x = x;
    return Number(c.run(vars));
  };
}
const useCe = new URLSearchParams(location.search).get("compiler") === "ce";
const t0c = performance.now();
const fns: Fn[] = await Promise.all(FUNCS.map((f) => (useCe ? ceFn(f) : Promise.resolve(ronFn(f)))));
mark("plot-compiled", { compiler: useCe ? "ce" : "ron", compileMs: performance.now() - t0c });

const board = JXG.JSXGraph.initBoard("box", {
  boundingbox: [-8, 6, 8, -6],
  axis: true,
  showCopyright: false,
  showNavigation: false,
  keepAspectRatio: false,
  pan: { enabled: true, needTwoFingers: false },
  zoom: { wheel: true, pinchHorizontal: true, pinchVertical: true, pinchSensitivity: 7, factorX: 1.1, factorY: 1.1 },
});
fns.forEach((fn, i) => {
  board.create("functiongraph", [fn], { strokeColor: COLORS[i], strokeWidth: 2, highlight: false, numberPointsHigh: 400, numberPointsLow: 200 });
});

// FPS: frame deltas from requestAnimationFrame; "busy" = frames longer than 1.5x the display period.
const deltas: number[] = [];
let last = performance.now();
const WINDOW = 5000;
const stamps: number[] = [];
function frame(now: number): void {
  deltas.push(now - last);
  stamps.push(now);
  last = now;
  while (stamps.length && now - (stamps[0] ?? now) > WINDOW) {
    stamps.shift();
    deltas.shift();
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

interface PlotStats { workMedianMs: number; fps: number; p95FrameMs: number; frames: number; displayHz: number }
function stats(): PlotStats {
  const n = deltas.length;
  const ws = [...work].sort((a, b) => a - b);
  const workMedianMs = ws[Math.floor(ws.length / 2)] ?? 0;
  if (n < 2) return { workMedianMs, fps: 0, p95FrameMs: 0, frames: n, displayHz: 0 };
  const span = ((stamps[n - 1] ?? 0) - (stamps[0] ?? 0)) / 1000;
  const sorted = [...deltas].sort((a, b) => a - b);
  const p95 = sorted[Math.min(n - 1, Math.floor(n * 0.95))] ?? 0;
  const med = sorted[Math.floor(n / 2)] ?? 16.7;
  return { workMedianMs, fps: (n - 1) / span, p95FrameMs: p95, frames: n, displayHz: 1000 / med };
}
const hud = document.getElementById("hud") as HTMLElement;
setInterval(() => {
  const s = stats();
  hud.textContent = `fps ${s.fps.toFixed(1)}  p95 ${s.p95FrameMs.toFixed(1)} ms  (${s.displayHz.toFixed(0)} Hz display)`;
}, 500);

// Auto mode: scripted zoom + pan that exercises the same redraw path as a pinch, for repeatable runs.
const work: number[] = []; // ms spent in the synchronous redraw per frame (auto mode)
let auto = false;
let t0 = 0;
const btn = document.getElementById("auto") as HTMLButtonElement;
function autoStep(now: number): void {
  if (!auto) return;
  const t = (now - t0) / 1000;
  const zoom = 1 + 0.6 * Math.sin(t * 1.3); // 0.4x .. 1.6x
  const cx = 3 * Math.sin(t * 0.7);
  const cy = 2 * Math.cos(t * 0.5);
  const hw = 8 * zoom;
  const hh = 6 * zoom;
  const w0 = performance.now();
  board.setBoundingBox([cx - hw, cy + hh, cx + hw, cy - hh], false);
  work.push(performance.now() - w0);
  if (work.length > 600) work.shift();
  requestAnimationFrame(autoStep);
}
function setAuto(on: boolean): void {
  auto = on;
  btn.textContent = `auto zoom/pan: ${on ? "on" : "off"}`;
  if (on) {
    t0 = performance.now();
    requestAnimationFrame(autoStep);
  }
}
btn.addEventListener("click", () => setAuto(!auto));

declare global {
  interface Window { __plot: { stats: () => PlotStats; setAuto: (on: boolean) => void; resetStats: () => void } }
}
window.__plot = {
  stats,
  setAuto,
  resetStats: () => { deltas.length = 0; stamps.length = 0; work.length = 0; },
};

// Device runs: ?autorun=<seconds> starts the scripted zoom/pan, then logs one result mark.
mark("plot-ready");
const autorun = Number(new URLSearchParams(location.search).get("autorun") ?? 0);
if (autorun > 0) {
  setTimeout(() => {
    window.__plot.resetStats();
    setAuto(true);
    setTimeout(() => {
      const s = stats();
      setAuto(false);
      mark("plot-fps", { fps: s.fps, p95FrameMs: s.p95FrameMs, redrawMs: s.workMedianMs, displayHz: s.displayHz, frames: s.frames });
    }, autorun * 1000);
  }, 1000);
}
