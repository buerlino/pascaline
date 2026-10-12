<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<script lang="ts">
  // Num view: x and the functions that are on. One engine call per screen (FunctionApp.refreshNum);
  // numbers through the Home formatter. ▲▼ (or a swipe, or the wheel) scroll by rows; the menu sets start and step.
  import { t } from "../../i18n/index.ts";
  import { CURVE_COLORS, type FunctionApp } from "./app.svelte.ts";

  let { app }: { app: FunctionApp } = $props();

  let box: HTMLElement | undefined = $state();
  const ROW_PX = 34;
  $effect(() => {
    if (!box) return;
    const ro = new ResizeObserver(() => {
      if (box) app.setNumRows(Math.max(3, Math.floor((box.clientHeight - ROW_PX) / ROW_PX)));
    });
    ro.observe(box);
    return () => ro.disconnect();
  });

  let touchY: number | undefined;
  function wheel(e: WheelEvent): void {
    e.preventDefault();
    app.scrollNum(e.deltaY > 0 ? 3 : -3);
  }
  function touchMove(e: TouchEvent): void {
    const y = e.touches[0]?.clientY;
    if (touchY === undefined || y === undefined) return;
    const rows = Math.trunc((touchY - y) / ROW_PX);
    if (rows !== 0) {
      app.scrollNum(rows);
      touchY = y;
    }
  }
</script>

<div class="num" role="grid" tabindex="-1" bind:this={box} onwheel={wheel} ontouchstart={(e) => (touchY = e.touches[0]?.clientY)} ontouchmove={touchMove}>
  {#if app.numSlots.length === 0}
    <p class="empty">{t("num.empty")}</p>
  {:else}
    <table data-testid="num-table">
      <thead>
        <tr>
          <th>x</th>
          {#each app.numSlots as s (s)}<th style:color={CURVE_COLORS[s]}>{app.slots.names[s]}</th>{/each}
        </tr>
      </thead>
      <tbody>
        {#each app.numXs as x, r (r)}
          <tr>
            <td class="x" data-x={x}>{app.fmtX(x)}</td>
            {#each app.numSlots as s, c (s)}
              {@const cell = app.numCell(r, c)}
              <td data-text={cell ? app.fmt(cell) : ""}>{app.fmt(cell)}{#if app.warned(cell)}<span class="warn" data-testid="mark" title={t("mark.warn")}> ⚠</span>{/if}</td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</div>

<style>
  td > .warn {
    color: var(--error);
  }
  .num {
    flex: 1;
    min-height: 0;
    overflow: hidden;
    padding: 0 8px;
    touch-action: none;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-variant-numeric: tabular-nums;
    table-layout: fixed;
  }
  th,
  td {
    height: 34px;
    padding: 0 6px;
    text-align: right;
    border-bottom: 1px solid var(--line);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: 15px;
  }
  th {
    color: var(--muted);
    font-weight: 600;
    background: var(--bg);
  }
  td.x {
    color: var(--muted);
  }
  .empty {
    margin: 40px auto;
    text-align: center;
    color: var(--muted);
  }
</style>
