<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<script lang="ts">
  // Plot view: JSXGraph (D7), loaded the first time Plot opens. Curves are drawn with our own evaluator
  // (compile.ts); the trace readout and every analysis number come from the engine (FunctionApp).
  // Pan with one finger, pinch or wheel to zoom, tap to move the trace; ◀▶ trace, ▲▼ switch function.
  import type JXGType from "jsxgraph";
  import { onMount } from "svelte";
  import { t } from "../../i18n/index.ts";
  import { mark } from "../../marks.ts";
  import { longpress } from "../longpress.ts";
  import { plotHook } from "./plotHook.ts";
  import { CURVE_COLORS, DEFAULT_X, type FunctionApp, type PlotWindow } from "./app.svelte.ts";

  let { app }: { app: FunctionApp } = $props();

  type JXGModule = typeof JXGType;
  type Board = ReturnType<JXGModule["JSXGraph"]["initBoard"]>;

  let box: HTMLElement | undefined = $state();
  let ready = $state(false);
  let board: Board | undefined;
  let JXG: JXGModule | undefined;
  let markEls: { remove(): void }[] = [];

  // D7 options (desktop, CPU 4x slower: canvas redraws in 6.4 ms vs 10.2 ms for SVG; plain sampling is
  // faster than adaptive while moving). Default: canvas, plain sampling while the window moves and adaptive
  // sampling (clean poles) once it rests. ?renderer=svg and ?sampling=adaptive|plain for device comparisons.
  const q = new URLSearchParams(location.search);
  const renderer = q.get("renderer") === "svg" ? "svg" : "canvas";
  const sampling = q.get("sampling") === "adaptive" || q.get("sampling") === "plain" ? q.get("sampling") : "hybrid";
  type Curve = { setAttribute(a: Record<string, unknown>): unknown };
  let curves: Curve[] = [];
  let restTimer: ReturnType<typeof setTimeout> | undefined;
  let moving = false;
  function setAdaptive(on: boolean): void {
    for (const c of curves) c.setAttribute({ doAdvancedPlot: on });
  }

  function defaultWindow(): PlotWindow {
    const w = box?.clientWidth || 1;
    const h = box?.clientHeight || 1;
    const half = ((DEFAULT_X[1] - DEFAULT_X[0]) / 2) * (h / w);
    return { xmin: DEFAULT_X[0], xmax: DEFAULT_X[1], ymin: -half, ymax: half };
  }
  const bbox = (w: PlotWindow): [number, number, number, number] => [w.xmin, w.ymax, w.xmax, w.ymin];

  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  function windowChanged(): void {
    if (!board) return;
    const [x1, y1, x2, y2] = board.getBoundingBox() as [number, number, number, number];
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => app.setWindow({ xmin: x1, xmax: x2, ymin: y2, ymax: y1 }), 150);
    if (sampling !== "hybrid") return;
    if (!moving) {
      moving = true;
      setAdaptive(false);
    }
    clearTimeout(restTimer);
    restTimer = setTimeout(() => {
      moving = false;
      setAdaptive(true);
      board?.update();
    }, 120);
  }

  onMount(() => {
    let disposed = false;
    const t0 = performance.now();
    void import("jsxgraph").then((m) => {
      if (disposed || !box) return;
      const t1 = performance.now();
      JXG = (m as unknown as { default: JXGModule }).default;
      const b = JXG.JSXGraph.initBoard(box, {
        boundingbox: bbox(app.win ?? defaultWindow()),
        axis: true,
        grid: false,
        renderer,
        showCopyright: false,
        showNavigation: false,
        showInfobox: false,
        keepAspectRatio: false,
        pan: { enabled: true, needTwoFingers: false },
        zoom: { enabled: true, wheel: true, needShift: false, pinchHorizontal: true, pinchVertical: true, pinchSensitivity: 7, factorX: 1.15, factorY: 1.15 },
        defaultAxes: {
          x: { strokeColor: "var(--muted)", ticks: { strokeColor: "var(--line)", label: { strokeColor: "var(--muted)" } } },
          y: { strokeColor: "var(--muted)", ticks: { strokeColor: "var(--line)", label: { strokeColor: "var(--muted)" } } },
        },
      } as Parameters<JXGModule["JSXGraph"]["initBoard"]>[1]);
      board = b;
      b.suspendUpdate();
      for (const i of app.active) {
        const fn = app.compiled[i]?.fn;
        if (!fn) continue;
        const c = b.create("functiongraph", [fn], {
          strokeColor: CURVE_COLORS[i],
          strokeWidth: 2,
          highlight: false,
          fixed: true,
          doAdvancedPlot: sampling !== "plain",
          numberPointsHigh: 400,
          numberPointsLow: 120,
        });
        curves.push(c as unknown as Curve);
      }
      // The trace cursor: drawn with the evaluator, its numbers come from the engine.
      b.create(
        "point",
        [
          () => app.traceX,
          () => {
            const fn = app.compiled[app.trace.slot]?.fn;
            const y = fn ? fn(app.traceX) : NaN;
            return Number.isFinite(y) ? y : NaN;
          },
        ],
        { name: "", size: 4, fixed: true, highlight: false, strokeColor: "#fff", fillColor: "#fff", visible: () => app.trace.on && app.active.length > 0 },
      );
      b.unsuspendUpdate();
      b.on("boundingbox", windowChanged);
      if (!app.win) app.setWindow({ ...defaultWindow() });
      ready = true;
      plotHook.board = b;
      plotHook.curves = curves.length;
      // Measurement builds: time from opening Plot to the first drawn board (JSXGraph loads on first open).
      requestAnimationFrame(() =>
        mark("plot-ready", { openMs: performance.now() - t0, importMs: t1 - t0, curves: app.active.length, renderer, sampling: sampling ?? "" }),
      );
    });
    return () => {
      disposed = true;
      clearTimeout(saveTimer);
      clearTimeout(restTimer);
      curves = [];
      if (plotHook.board === board) plotHook.board = undefined;
      if (board && JXG) JXG.JSXGraph.freeBoard(board);
      board = undefined;
    };
  });

  // Default window from the menu (app.win set to null): back to the default box.
  $effect(() => {
    if (!ready || !board || app.win) return;
    const w = defaultWindow();
    board.setBoundingBox(bbox(w), false);
    app.setWindow(w);
  });

  // Trace moved or switched: redraw the cursor.
  $effect(() => {
    void app.trace.x;
    void app.trace.slot;
    if (ready) board?.update();
  });

  // Analysis marks.
  $effect(() => {
    const marks = app.marks;
    if (!ready || !board) return;
    for (const m of markEls) m.remove();
    markEls = [];
    board.suspendUpdate();
    for (const m of marks)
      markEls.push(
        board.create("point", [m.x, m.y], {
          name: "",
          size: 5,
          face: "x",
          fixed: true,
          highlight: false,
          strokeColor: CURVE_COLORS[m.slot],
        }) as unknown as { remove(): void },
      );
    board.unsuspendUpdate();
  });

  // A tap (not a pan) moves the trace there.
  let down: { x: number; y: number; t: number } | undefined;
  function pointerDown(e: PointerEvent): void {
    down = { x: e.clientX, y: e.clientY, t: performance.now() };
  }
  function pointerUp(e: PointerEvent): void {
    if (!down || !board || !JXG) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    const quick = performance.now() - down.t < 400;
    down = undefined;
    if (moved > 6 || !quick) return;
    const [x] = board.getUsrCoordsOfMouse(e);
    if (Number.isFinite(x)) app.traceTo(x);
  }

  const traceName = $derived(app.slots.names[app.trace.slot] ?? "");
</script>

<div class="plot">
  <div class="board" bind:this={box} onpointerdown={pointerDown} onpointerup={pointerUp} aria-label={t("plot.label")} role="img"></div>
  {#if !ready}<p class="note">{t("plot.loading")}</p>{/if}
  {#if ready && app.active.length === 0}<p class="note">{t("plot.empty")}</p>{/if}
  {#if app.active.length > 0}
    <div class="readout" data-testid="readout">
      {#if app.readout}
        {#each app.readout.lines as l (l.label)}
          <span class="pair"><span class="k">{l.label}</span> <span class="v" data-testid={`readout-${l.label}`} use:longpress={l.cell ? () => void app.copyReadout(l) : undefined}>{l.value}</span></span>
        {/each}
        {#if app.readout.info}
          <span class="info" class:warn={app.readout.warn} data-testid="readout-info"
            >{#if app.readout.warn}⚠ {/if}{app.readout.info}</span>
        {/if}
      {:else}
        <span class="pair" style:color={CURVE_COLORS[app.trace.slot]}>{traceName}</span>
        <span class="pair"><span class="k">x</span> <span class="v" data-testid="trace-x">{app.fmtX(app.trace.x)}</span></span>
        <span class="pair"><span class="k">y</span> <span class="v" data-testid="trace-y" data-text={app.traceY ? app.fmt(app.traceY) : ""}>{app.fmt(app.traceY)}</span>{#if app.warned(app.traceY)}<span class="warn" data-testid="mark" title={t("mark.warn")}> ⚠</span>{/if}</span>
      {/if}
    </div>
  {/if}
</div>

<style>
  .pair > .warn {
    color: var(--error);
  }
  .plot {
    position: relative;
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
  .board {
    position: relative;
    flex: 1;
    min-height: 0;
    overflow: hidden;
    touch-action: none;
    background: var(--bg);
  }
  .board :global(svg),
  .board :global(canvas) {
    position: absolute;
    inset: 0;
  }
  /* a hint sits in a box at the top of the board, above the axes, never drawn over them */
  .note {
    position: absolute;
    inset: 8px 12px auto;
    margin: 0;
    padding: 8px 12px;
    border-radius: 8px;
    text-align: center;
    background: var(--panel);
    color: var(--muted);
    pointer-events: none;
  }
  .readout {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 14px;
    padding: 6px 12px;
    border-top: 1px solid var(--line);
    font-variant-numeric: tabular-nums;
    font-size: 15px;
    min-height: 34px;
  }
  .k {
    color: var(--muted);
  }
  .info {
    flex-basis: 100%;
    font-size: 13px;
    color: var(--muted);
  }
  .info.warn {
    color: var(--shift);
  }
</style>
