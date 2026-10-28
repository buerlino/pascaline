<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<script lang="ts">
  // One sheet for every list (docs/05 3.1, decisions.md "R21"). A pick sheet (`over: "keypad"`) rises over the
  // keypad's maths rows, anchored at its bottom edge and as tall as its rows need, in a layer App.svelte places there;
  // its rows and cells shrink to the room down to a floor, and only below the floor does it scroll (sheetFit.ts). A
  // grid whose cells are picked by keys (Shift + 6) draws each cell over its key. A list that takes letters
  // (`over: "view"`) stays above the keypad, over the history or view. The keys drive it through App.svelte and
  // sheetKeys.ts; touch is a shortcut: a tap on a row picks it, ◀ ▶ step a value, ‹ goes back a level, × closes it.
  import { t } from "../i18n/index.ts";
  import { ICONS } from "./icons.ts";
  import MathView from "../render/Math.svelte";
  import type { Sheet } from "./sheet.svelte.ts";
  import { fitCell, fitRow, hasSteps, ROW, rowHeight, showsReason } from "./sheetFit.ts";

  let {
    sheet,
    testid,
    ontap,
    onback,
    onclose,
    over = "view",
    below = 0,
    keyBox,
  }: {
    sheet: Sheet;
    testid: string;
    /** A row was tapped (its index in the level's full list). */
    ontap: (index: number) => void;
    onback: () => void;
    onclose: () => void;
    /** Over the keypad (a pick sheet) or above it, over the history or view (a list that takes letters). */
    over?: "keypad" | "view";
    /** Over the view: the height of the entry line under the sheet, kept free while the rows fit above it. */
    below?: number;
    /** Over the keypad: a key's box on screen, for the cells drawn over the key that picks them. */
    keyBox?: (id: string) => DOMRect | undefined;
  } = $props();

  const level = $derived(sheet.level);
  const rows = $derived(level.rows);
  const items = $derived(rows.map((r) => r.item));
  const columns = $derived(level.columns);
  /** The palettes' normal cell height: Tmpl's templates need more than the Shift palettes' one symbol or word. */
  const normalCell = $derived(sheet.id === "rel" || sheet.id === "sym" ? 46 : 58);

  // ---- fit (R21a): one measure per resize or change of rows, no per-frame work
  let overlay: HTMLDivElement | undefined = $state();
  let panel: HTMLDivElement | undefined = $state();
  let list: HTMLDivElement | undefined = $state();
  let row = $state(ROW);
  let cell = $state(0);
  /** The cells over their keys: the panel's top in the layer, the cells' boxes in the grid. */
  let placed = $state.raw<{ top: number; height: number; cells: { x: number; y: number; w: number; h: number }[] } | null>(null);

  function fit(): void {
    if (over !== "keypad" || !overlay || !panel || !list) {
      row = ROW;
      cell = normalCell;
      placed = null;
      return;
    }
    if (columns !== undefined && keyBox && items.length > 0 && items.every((x) => x.pick)) {
      const boxes = items.map((x) => keyBox(x.pick?.key ?? ""));
      if (boxes.every((b) => b !== undefined && b.height > 0)) {
        const bs = boxes as DOMRect[];
        const top = Math.min(...bs.map((b) => b.top));
        const [o, p, g] = [overlay.getBoundingClientRect(), panel.getBoundingClientRect(), list.getBoundingClientRect()];
        placed = {
          top: top - o.top - (g.top - p.top),
          height: Math.max(...bs.map((b) => b.bottom)) - top,
          cells: bs.map((b) => ({ x: b.left - g.left, y: b.top - top, w: b.width, h: b.height })),
        };
        return;
      }
    }
    placed = null;
    const room = overlay.clientHeight - (panel.offsetHeight - list.offsetHeight);
    if (columns !== undefined) cell = fitCell(room, Math.ceil(items.length / columns), normalCell);
    else row = fitRow(room, items.map((item, i) => ({ reason: showsReason(items, i), steps: hasSteps(item) })));
  }
  $effect(() => {
    void items;
    void columns;
    fit();
    if (!overlay || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(fit);
    ro.observe(overlay);
    return () => ro.disconnect();
  });

  // Scroll cue (fixes finding 5): a fade at each cut edge, and the item count in the title row when not all fit.
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
    void row;
    void cell;
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
  // Over the keypad a key that opens the sheet fires when the finger lifts, and the browser's click that follows lands
  // on whatever is now under the finger: the cell or row the sheet put over that key (Shift + 6 over 6). Only a click
  // whose press began on the sheet counts.
  let pressed = false;
  function onlyPressed(e: MouseEvent): void {
    if (!pressed) {
      e.stopPropagation();
      e.preventDefault();
    }
    pressed = false;
  }
  $effect(() => {
    void sheet;
    pressed = false;
  });
  const px = (n: number | undefined): string | undefined => (n === undefined ? undefined : `${n}px`);
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions (the keypad drives the sheet; a tap beside it closes it) -->
<div
  class="overlay"
  class:keypad={over === "keypad"}
  data-testid={testid}
  bind:this={overlay}
  onpointerdown={noFocus}
  onclick={(e) => over === "view" && e.target === e.currentTarget && onclose()}
>
  {#if over === "keypad"}<div class="dim" data-testid="sheet-dim"></div>{/if}
  <!-- svelte-ignore a11y_interactive_supports_focus (nothing in a sheet takes focus: the caret stays in the entry line) -->
  <div class="sheet" class:placed={placed !== null} role="menu" aria-label={level.title} data-depth={sheet.depth} bind:this={panel} style:top={px(placed?.top)} onpointerdowncapture={() => (pressed = true)} onpointercancel={() => (pressed = false)} onclickcapture={onlyPressed}>
    {#if columns !== undefined}
      <!-- a grid (the palettes, R10 and R18): no title row; the title, the highlighted cell's name and × share the hint
           line. Each cell is drawn as math, no numbers; a cell picked by the key at its place shows that key in its
           corner and, over the keypad, sits on that key (Shift + 6). -->
      <div class="head">
        <span class="gtitle" data-testid="sheet-title">{sheet.path}</span>
        <span class="hint" data-testid="sheet-hint">{level.current?.label ?? ""}</span>
        {#if cutTop || cutBottom}<span class="count" data-testid="sheet-count">{t("sheet.count", { n: String(rows.length) })}</span>{/if}
        <button type="button" class="icon" aria-label={t("apps.close")} onclick={onclose}>×</button>
      </div>
      <div
        class="grid"
        data-grid={sheet.id}
        style:grid-template-columns="repeat({columns}, minmax(0, 1fr))"
        style:height={px(placed?.height)}
        style:--cell={px(cell || normalCell)}
        bind:this={list}
        onscroll={measure}
      >
        {#each rows as r, i (r.index)}
          {@const c = placed?.cells[i]}
          <button
            type="button"
            role="menuitem"
            class="cell"
            aria-label={r.item.pick ? `${r.item.pick.legend} ${r.item.label}` : r.item.label}
            disabled={r.item.disabled}
            data-active={r.index === level.highlight}
            data-id={r.item.id}
            style:left={px(c?.x)}
            style:top={px(c?.y)}
            style:width={px(c?.w)}
            style:height={px(c?.h)}
            onclick={() => ontap(r.index)}
          >{#if r.item.pick}<span class="pick" data-testid="cell-key">{r.item.pick.legend}</span>{/if}<MathView latex={r.item.latex ?? r.item.label} label={r.item.label} /></button>
        {/each}
      </div>
    {:else}
      <div class="head">
        {#if sheet.depth > 1}<button type="button" class="icon" aria-label={t("sheet.back")} onclick={onback}>‹</button>{/if}
        {#if sheet.icon}<span class="ticon" aria-hidden="true">{@html ICONS[sheet.icon]}</span>{/if}<span class="title" data-testid="sheet-title">{sheet.path}</span>
        {#if level.filter !== ""}<span class="filter" data-testid="sheet-filter">{level.filter}</span>{/if}
        {#if cutTop || cutBottom}<span class="count" data-testid="sheet-count">{t("sheet.count", { n: String(rows.length) })}</span>{/if}
        <button type="button" class="icon" aria-label={t("apps.close")} onclick={onclose}>×</button>
      </div>
      <div class="list" class:cut-top={cutTop} class:cut-bottom={cutBottom} style:--row={px(row)} bind:this={list} onscroll={measure}>
        {#each rows as r, i (r.index)}
          {@const steps = hasSteps(r.item)}
          {@const reason = showsReason(items, i)}
          <!-- svelte-ignore a11y_click_events_have_key_events, a11y_interactive_supports_focus (the keypad drives the rows; nothing in a sheet takes focus) -->
          <div
            role="menuitem"
            class="row"
            aria-label={`${r.n === undefined ? "" : r.n % 10} ${r.item.label}`.trim()}
            aria-disabled={r.item.disabled ? "true" : undefined}
            data-selected={r.item.selected}
            data-active={r.index === level.highlight}
            data-id={r.item.id}
            style:height={px(rowHeight(row, { reason, steps }))}
            onclick={() => ontap(r.index)}
          >
            <span class="n">{r.n === undefined ? "" : r.n % 10}</span>{#if r.item.glyph}<span class="tile math" class:small={"text" in r.item.glyph && r.item.glyph.text.length > 1} data-testid="row-glyph" aria-hidden="true">{@html "icon" in r.item.glyph ? ICONS.home : r.item.glyph.text}</span>{/if}<span class="text"><span class="label">{r.item.label}</span>{#if reason}<span class="reason">{r.item.reason}</span>{/if}</span>{#if r.item.note}<span class="note" data-testid="row-note">{r.item.note}</span>{/if}{#if steps}<button type="button" class="step" data-testid="step-down" aria-label={t("sheet.stepDown")} disabled={r.item.disabled} onclick={(e) => { e.stopPropagation(); sheet.adjustAt(r.index, -1); }}>◀</button>{/if}{#if r.item.value !== undefined}<span class="value" data-testid="sheet-value">{r.item.value}</span>{/if}{#if steps}<button type="button" class="step" data-testid="step-up" aria-label={t("sheet.stepUp")} disabled={r.item.disabled} onclick={(e) => { e.stopPropagation(); sheet.adjustAt(r.index, 1); }}>▶</button>{/if}{#if r.item.selected !== undefined}<span class="tick" aria-hidden="true">{r.item.selected ? "✓" : ""}</span>{/if}{#if r.item.submenu}<span class="more" aria-hidden="true">›</span>{/if}
          </div>
        {/each}
        {#if rows.length === 0}<p class="empty" data-testid="sheet-empty">{t("sheet.noMatch")}</p>{/if}
      </div>
      <!-- Find (R4a): the highlighted item's details (docs/04 3.6) -->
      {#if level.current?.preview}<div class="preview" data-testid="find-preview">{level.current.preview}</div>{/if}
    {/if}
  </div>
  <!-- over the view: shrinks first (flex-shrink weighs by size: 1000 × its height against the sheet's 1 × its own) -->
  {#if over === "view"}<div class="room" style:flex-basis="{below}px"></div>{/if}
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
  /* over the keypad: the maths keys a short sheet leaves visible stay live (their sheet job), dimmed */
  .overlay.keypad {
    background: none;
    pointer-events: none;
    overflow: hidden;
  }
  .dim {
    position: absolute;
    inset: 0;
    background: color-mix(in srgb, var(--panel) 60%, transparent);
  }
  .room {
    flex-grow: 0;
    flex-shrink: 1000;
    min-height: 0;
    pointer-events: none;
  }
  .sheet {
    position: relative;
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
  /* over the keypad: the keypad's width, square at its bottom edge */
  .keypad .sheet {
    width: 100%;
    margin: 0;
    max-height: 100%;
    border-bottom: 0;
    border-radius: 12px 12px 0 0;
    /* R82f1 (F117): at the keypad's bottom edge, with no border there, 2 px below the last row are enough; the 4 px
       this saves let Plot's nine Menu rows fit at their floor on the Fairphone 6 (380 px of room), so none is cut */
    padding-bottom: 2px;
    pointer-events: auto;
    box-shadow: 0 -2px 10px color-mix(in srgb, var(--bg) 50%, transparent);
  }
  .keypad .sheet.placed {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    max-height: none;
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
    flex: none;
  }
  .title {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .ticon {
    display: inline-flex;
    align-items: center;
    margin-right: -2px;
  }
  .ticon :global(svg) {
    width: 16px;
    height: 14px;
  }
  .gtitle {
    white-space: nowrap;
  }
  .hint {
    flex: 1;
    min-width: 0;
    color: var(--text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
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
  .note {
    margin-left: 6px;
    font-size: 12px;
    color: var(--muted);
    white-space: nowrap;
  }
  .preview {
    flex: none;
    padding: 4px 8px 0;
    border-top: 1px solid var(--line);
    font-size: 13px;
    color: var(--muted);
    overflow: hidden;
    text-overflow: ellipsis;
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
  /* a row shrinks with the room (sheetFit.ts): its height is set, the type follows it, 18 px at the normal 42 */
  .row {
    display: flex;
    gap: 12px;
    align-items: center;
    box-sizing: border-box;
    padding: 0 12px;
    border-radius: 8px;
    font-size: calc(var(--row, 42px) * 0.4286);
    cursor: pointer;
    flex-shrink: 0;
  }
  .row[data-active="true"] {
    background: var(--key-num);
    box-shadow: inset 3px 0 0 var(--shift);
  }
  .row[aria-disabled="true"] {
    cursor: default;
  }
  .row[aria-disabled="true"] .label,
  .row[aria-disabled="true"] .n {
    color: var(--text-dead);
  }
  .n {
    color: var(--shift);
    font-size: 14px;
    min-width: 1ch;
  }
  /* the status line's glyph tile at row size (R84) */
  .tile {
    flex: none;
    width: 36px;
    height: 28px;
    border-radius: 6px;
    background: var(--chip-bg);
    color: var(--text);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
  }
  .tile.small {
    font-size: 15px;
  }
  .tile :global(svg) {
    width: 16px;
    height: 15px;
  }
  .text {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .label {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .reason {
    font-size: 13px;
    line-height: 16px;
    color: var(--muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .value {
    color: var(--shift);
    font-size: 0.94em;
    white-space: nowrap;
  }
  .row[aria-disabled="true"] .value {
    color: var(--text-dead);
  }
  /* ◀ ▶ beside a value, for the thumb (R21a): at least 44 × 44 px */
  .step {
    all: unset;
    box-sizing: border-box;
    flex: none;
    width: 44px;
    height: 44px;
    margin: 0 -8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 15px;
    color: var(--muted);
    cursor: pointer;
  }
  .step:active {
    color: var(--shift);
  }
  .step:disabled {
    color: var(--text-dead);
    cursor: default;
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
    height: var(--cell);
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
  /* the cells over their keys (Shift + 6): each at its key's box */
  .placed .grid {
    display: block;
    position: relative;
    overflow: visible;
    flex: none;
  }
  .placed button.cell {
    position: absolute;
    background: var(--panel);
  }
  /* the Shift palettes hold one symbol or word per cell: larger type in lower cells */
  .grid:is([data-grid="rel"], [data-grid="sym"]) button.cell {
    font-size: 15px;
  }
  .pick {
    position: absolute;
    top: 2px;
    left: 5px;
    font-size: 11px;
    line-height: 1;
    color: var(--shift);
  }
  button.cell[data-active="true"] {
    background: var(--key-num);
    border-color: var(--shift);
    box-shadow: inset 0 -3px 0 var(--shift);
  }
  .empty {
    margin: 8px 12px;
    color: var(--muted);
  }
</style>
