// SPDX-License-Identifier: GPL-3.0-or-later
// On-device keypad timings for measurement builds only (VITE_MEASURE=1, started with ?bench=keypad; see main.ts):
// a Shift tap, the fit pass alone, and a pick sheet rising (A4a, docs/04 8.3, docs/05 3.7 and section 7).
// Each tap is a pointerdown + pointerup on the key, so the real handlers run. Times are ms from the dispatch to the
// first frame after it (two animation frames: style, layout and paint of the next frame are done). Output for
// tools/device_run.py: PASCALINE_BENCH keypad {json}, then the mark keypad-done.
import { fitLegends } from "./keyboard/fit.ts";
import { mark } from "./marks.ts";

const r1 = (x: number): number => Math.round(x * 10) / 10;
const pct = (xs: number[], p: number): number => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)] ?? 0;
};
const stats = (xs: number[]): { p50: number; p95: number; max: number; n: number } => ({
  p50: r1(pct(xs, 50)), p95: r1(pct(xs, 95)), max: r1(Math.max(...xs)), n: xs.length,
});
const frame = (): Promise<number> => new Promise((r) => requestAnimationFrame((t) => r(t)));
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

function tap(id: string): void {
  const el = document.querySelector<HTMLElement>(`.pad [data-key="${id}"]`);
  if (!el) throw new Error(`no key ${id}`);
  const r = el.getBoundingClientRect();
  const init = { bubbles: true, cancelable: true, pointerId: 7, pointerType: "touch", isPrimary: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 };
  el.dispatchEvent(new PointerEvent("pointerdown", init));
  el.dispatchEvent(new PointerEvent("pointerup", init));
}

/** Dispatch → the frame after the next one has been produced. */
async function framed(fn: () => void): Promise<number> {
  const t0 = performance.now();
  fn();
  await frame();
  await frame();
  return performance.now() - t0;
}

export async function runKeypadBench(): Promise<void> {
  await sleep(1500); // the keypad and its first fit pass are done
  const pad = document.querySelector<HTMLElement>(".pad");
  if (!pad) throw new Error("no pad");
  const N = 40;
  // Shift on, Shift off (a tap on the one-shot Shift twice returns to the plain layer in this build)
  const shiftTap: number[] = [];
  for (let i = 0; i < N; i++) {
    shiftTap.push(await framed(() => tap("shift")));
    await sleep(120);
  }
  // the fit pass alone (reset, measure, write): synchronous, so the time is the main-thread cost
  const fit: number[] = [];
  for (let i = 0; i < N; i++) {
    const t0 = performance.now();
    fitLegends(pad);
    fit.push(performance.now() - t0);
    await sleep(20);
  }
  // a pick sheet: Tmpl opens it over the keypad, Esc closes it. appearMs = dispatch → the .sheet exists in the DOM;
  // frameMs = dispatch → the frame after the next one; the CSS rise is 100 ms (Sheet.svelte).
  const appear: number[] = [];
  const sheetFrame: number[] = [];
  for (let i = 0; i < N; i++) {
    const t0 = performance.now();
    let seen = 0;
    const mo = new MutationObserver(() => {
      if (!seen && document.querySelector(".sheet")) seen = performance.now() - t0;
    });
    mo.observe(document.body, { childList: true, subtree: true });
    tap("tmpl");
    if (!seen && document.querySelector(".sheet")) seen = performance.now() - t0;
    await frame();
    await frame();
    sheetFrame.push(performance.now() - t0);
    appear.push(seen || NaN);
    mo.disconnect();
    await sleep(300); // let the 100 ms rise finish
    tap("esc");
    await sleep(200);
  }
  const ok = appear.filter((x) => !Number.isNaN(x));
  const summary = {
    shiftTap: stats(shiftTap), fitPass: stats(fit),
    sheetAppear: ok.length ? stats(ok) : null, sheetFrame: stats(sheetFrame), sheetSeen: ok.length,
    keys: pad.querySelectorAll(".key").length,
  };
  console.log(`PASCALINE_BENCH keypad ${JSON.stringify(summary)}`);
  mark("keypad-done");
}
