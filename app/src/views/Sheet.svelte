<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<script lang="ts">
  // One sheet for every list (docs/05 3.1): rises from just above the entry line over the history or the view, never
  // over the keypad. The keys drive it through App.svelte and sheetKeys.ts; touch is a shortcut: a tap on a row picks
  // it, ‹ goes back a level, × or a tap beside the sheet closes it.
  import { t } from "../i18n/index.ts";
  import MathView from "../render/Math.svelte";
  import type { Sheet } from "./sheet.svelte.ts";

  let {
    sheet,
    testid,
    ontap,
    onback,
    onclose,
    below = 0,
  }: {
    sheet: Sheet;
    testid: string;
    /** Height of the entry line under the sheet: kept free while the rows fit above it, given up when they need it. */
    below?: number;
    /** A row was tapped (its index in the level's full list). */
    ontap: (index: number) => void;
    onback: () => void;
    onclose: () => void;
  } = $props();

  const level = $derived(sheet.level);
  const rows = $derived(level.rows);

  // Scroll cue (fixes finding 5): a fade at each cut edge, and the item count in the title row when not all fit.
  let list: HTMLDivElement | undefined = $state();
  let cutTop = $state(false);
  let cutBottom = $state(false);
  function measure(): void {
    if (!list) return;
    cutTop = list.scrollTop > 1;
    cutBottom = list.scrollTop + list.clientHeight < list.scrollHeight - 1;
  }
  $effect(() => {
    void rows.length;
    void level;
    measure();
    if (!list || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(list);
    return () => ro.disconnect();
  });
  // the highlighted row stays in view
  $effect(() => {
    void level.highlight;
    void rows.length;
    list?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView({ block: "nearest" });
    measure();
  });

  /** Keep the caret in the entry line: nothing in the sheet takes focus. */
  const noFocus = (e: Event): void => e.preventDefault();
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions (the keypad drives the sheet; a tap beside it closes it) -->
<div class="overlay" data-testid={testid} onpointerdown={noFocus} onclick={(e) => e.target === e.currentTarget && onclose()}>
  <div class="sheet" role="menu" aria-label={level.title} data-depth={sheet.depth}>
    <div class="head">
      {#if sheet.depth > 1}<button type="button" class="icon" aria-label={t("sheet.back")} onclick={onback}>‹</button>{/if}
      <span class="title" data-testid="sheet-title">{sheet.path}</span>
      {#if level.filter !== ""}<span class="filter" data-testid="sheet-filter">{level.filter}</span>{/if}
      {#if cutTop || cutBottom}<span class="count" data-testid="sheet-count">{t("sheet.count", { n: String(rows.length) })}</span>{/if}
      <button type="button" class="icon" aria-label={t("apps.close")} onclick={onclose}>×</button>
    </div>
    {#if level.columns !== undefined}
      <!-- a grid (the Tmpl palette, R10): each cell drawn as math, no numbers -->
      <div class="grid" style:grid-template-columns="repeat({level.columns}, minmax(0, 1fr))" bind:this={list}>
        {#each rows as row (row.index)}
          <button
            type="button"
            role="menuitem"
            class="cell"
            aria-label={row.item.label}
            disabled={row.item.disabled}
            data-active={row.index === level.highlight}
            data-id={row.item.id}
            onclick={() => ontap(row.index)}
          ><MathView latex={row.item.latex ?? row.item.label} label={row.item.label} /></button>
        {/each}
      </div>
      <p class="hint" data-testid="sheet-hint">{level.current?.label ?? ""}</p>
    {:else}
    <div class="list" class:cut-top={cutTop} class:cut-bottom={cutBottom} bind:this={list} onscroll={measure}>
      {#each rows as row (row.index)}
        <button
          type="button"
          role="menuitem"
          aria-label={`${row.n === undefined ? "" : row.n % 10} ${row.item.label}`.trim()}
          disabled={row.item.disabled}
          data-selected={row.item.selected}
          data-active={row.index === level.highlight}
          data-id={row.item.id}
          onclick={() => ontap(row.index)}
        ><span class="n">{row.n === undefined ? "" : row.n % 10}</span><span class="text"><span class="label">{row.item.label}</span>{#if row.item.disabled && row.item.reason}<span class="reason">{row.item.reason}</span>{/if}</span>{#if row.item.value !== undefined}<span class="value" data-testid="sheet-value">{row.item.value}</span>{/if}{#if row.item.selected !== undefined}<span class="tick" aria-hidden="true">{row.item.selected ? "✓" : ""}</span>{/if}{#if row.item.submenu}<span class="more" aria-hidden="true">›</span>{/if}</button>
      {/each}
      {#if rows.length === 0}<p class="empty" data-testid="sheet-empty">{t("sheet.noMatch")}</p>{/if}
    </div>
    {/if}
  </div>
  <!-- shrinks first (flex-shrink weighs by size: 1000 × its height against the sheet's 1 × its own) -->
  <div class="room" style:flex-basis="{below}px"></div>
</div>

<style>
  .overlay {
    position: absolute;
    inset: 0;
    background: color-mix(in srgb, var(--bg) 55%, transparent);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-end;
    z-index: 5;
  }
  .room {
    flex-grow: 0;
    flex-shrink: 1000;
    min-height: 0;
    pointer-events: none;
  }
  .sheet {
    width: min(calc(100% - 16px), 420px);
    margin: 0 8px 4px;
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 12px;
    padding: 4px 6px 6px;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    max-height: calc(100% - 8px);
    min-height: 0;
    flex: 0 1 auto;
    animation: rise 100ms ease-out;
  }
  @keyframes rise {
    from {
      transform: translateY(12px);
      opacity: 0.6;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .sheet {
      animation: none;
    }
  }
  .head {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 2px 4px 2px 8px;
    color: var(--muted);
    font-size: 14px;
    min-height: 32px;
  }
  .title {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .filter {
    color: var(--text);
    font-weight: 700;
    padding: 1px 6px;
    border-radius: 6px;
    border: 1px solid var(--line);
  }
  .count {
    white-space: nowrap;
  }
  .icon {
    all: unset;
    font-size: 22px;
    line-height: 1;
    padding: 2px 8px;
    cursor: pointer;
    color: var(--text);
  }
  .list {
    overflow-y: auto;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overscroll-behavior: contain;
  }
  .list.cut-bottom {
    mask-image: linear-gradient(to bottom, black calc(100% - 28px), transparent);
  }
  .list.cut-top {
    mask-image: linear-gradient(to top, black calc(100% - 28px), transparent);
  }
  .list.cut-top.cut-bottom {
    mask-image: linear-gradient(to bottom, transparent, black 28px, black calc(100% - 28px), transparent);
  }
  button[role="menuitem"] {
    all: unset;
    display: flex;
    gap: 12px;
    align-items: center;
    padding: 9px 12px;
    border-radius: 8px;
    font-size: 18px;
    cursor: pointer;
    flex-shrink: 0;
  }
  button[role="menuitem"][data-active="true"] {
    background: var(--key-num);
    box-shadow: inset 3px 0 0 var(--shift);
  }
  button[role="menuitem"]:disabled {
    cursor: default;
  }
  button[role="menuitem"]:disabled .label,
  button[role="menuitem"]:disabled .n {
    color: var(--text-dead);
  }
  .n {
    color: var(--shift);
    font-size: 14px;
    min-width: 1ch;
  }
  .text {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .reason {
    font-size: 13px;
    color: var(--muted);
  }
  .value {
    color: var(--shift);
    font-size: 17px;
    white-space: nowrap;
  }
  button[role="menuitem"]:disabled .value {
    color: var(--text-dead);
  }
  .tick {
    color: var(--shift);
    min-width: 1ch;
  }
  .more {
    color: var(--muted);
    font-size: 20px;
  }
  .grid {
    display: grid;
    gap: 4px;
    overflow-y: auto;
    min-height: 0;
  }
  button.cell {
    all: unset;
    box-sizing: border-box;
    height: 58px;
    min-width: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    position: relative; /* clips MathLive's positioned boxes too */
    border-radius: 8px;
    border: 1px solid var(--line);
    font-size: 10px; /* the widest template (piecewise) fits a sixth of a phone's width */
    cursor: pointer;
  }
  button.cell[data-active="true"] {
    background: var(--key-num);
    border-color: var(--shift);
    box-shadow: inset 0 -3px 0 var(--shift);
  }
  .hint {
    margin: 6px 8px 0;
    min-height: 1.3em;
    color: var(--muted);
    font-size: 14px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .empty {
    margin: 8px 12px;
    color: var(--muted);
  }
</style>
