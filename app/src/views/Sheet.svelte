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
  import type { MenuItem } from "../apps/types.ts";
  import type { Row, Sheet } from "./sheet.svelte.ts";
  import { fitCell, fitRow, hasOptions, hasSteps, ROW, rowHeight, showsReason, twoLines } from "./sheetFit.ts";
  import { builtRows, keyedById, plainRow, rowKey, sameRows } from "./sheetWindow.ts";

  let {
    sheet,
    testid,
    ontap,
    onoption,
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
    /** A value button of a row was tapped (R86): the row's index and the option's id. */
    onoption: (index: number, option: string) => void;
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
  /** The rows drawn so far (R132): an item at the same place with the same number stays the same row object. */
  const made = new WeakMap<MenuItem, Row>();
  const rows = $derived(sameRows(made, level.rows));
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
    else row = fitRow(room, items.map((item, i) => ({ reason: twoLines(items, i), steps: hasSteps(item), options: hasOptions(item) })));
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

  // A search's hits (Find, R132, docs/04 3.2 E3): only the rows the room shows plus a margin are built, the rest as the
  // list is scrolled or the highlight moves down, under a spacer as tall as they are (sheetWindow.ts); keyed by item.
  const searching = $derived(level.searching);
  let room = $state(0);
  $effect(() => {
    if (!overlay || typeof ResizeObserver === "undefined") return;
    // the most the list can grow to: the overlay less the sheet's title row, preview and padding
    const ro = new ResizeObserver(() => {
      if (overlay && panel && list) room = overlay.clientHeight - (panel.offsetHeight - list.offsetHeight);
    });
    ro.observe(overlay);
    return () => ro.disconnect();
  });
  /** How far down these rows were scrolled into view (px, a page ahead). */
  let scrolled = $state.raw<{ of: readonly unknown[]; px: number }>({ of: [], px: 0 });
  const at = $derived(searching ? rows.findIndex((r) => r.index === level.highlight) : -1);
  const built = $derived(searching ? builtRows(rows.length, room, scrolled.of === rows ? scrolled.px : 0, at, row) : rows.length);
  const shown = $derived(built < rows.length ? rows.slice(0, built) : rows);
  const byId = $derived(keyedById(rows, searching));
  /** Every hit drawn is plain (Find's are): the light row, the same markup without the blocks it does not need. */
  const plain = $derived(searching && shown.every((r) => plainRow(r.item)));
  const rest = $derived(rows.slice(built).reduce((h, r, k) => h + rowHeight(row, { reason: twoLines(items, built + k), steps: hasSteps(r.item), options: hasOptions(r.item) }), 0));
  function onListScroll(): void {
    measure();
    if (!list || built >= rows.length) return;
    const px = list.scrollTop + 2 * list.clientHeight;
    if (px > (scrolled.of === rows ? scrolled.px : 0)) scrolled = { of: rows, px };
  }

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
  // a text level: ▲ ▼ page through it (Level.nudge counts the pages asked for)
  $effect(() => {
    const n = level.nudge;
    if (n === 0 || !list) return;
    list.scrollBy({ top: n * list.clientHeight * 0.8 });
    level.nudge = 0;
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
            data-count={r.item.count ?? "row"}
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
        {#if (cutTop || cutBottom) && level.text === undefined}<span class="count" data-testid="sheet-count">{t("sheet.count", { n: String(rows.length) })}</span>{/if}
        <button type="button" class="icon" aria-label={t("apps.close")} onclick={onclose}>×</button>
      </div>
      {#if level.text !== undefined}
        <!-- a text to read (R87, a licence): the list's scroll and fade, no rows; ▲ ▼ page through it -->
        <div class="list doc" class:cut-top={cutTop} class:cut-bottom={cutBottom} data-testid="sheet-text" bind:this={list} onscroll={measure}>{level.text}</div>
      {:else}
      <div class="list" class:cut-top={cutTop} class:cut-bottom={cutBottom} style:--row={px(row)} bind:this={list} onscroll={onListScroll}>
        {#if plain}
        {#each shown as r (rowKey(r, byId))}
          <!-- svelte-ignore a11y_click_events_have_key_events, a11y_interactive_supports_focus (the keypad drives the rows; nothing in a sheet takes focus) -->
          <div role="menuitem" class="row" aria-label={r.item.label} data-active={r.index === level.highlight} data-id={r.item.id} data-count={r.item.count ?? "row"} style:height={px(row)} onclick={() => ontap(r.index)}><span class="n"></span><span class="text"><span class="label">{r.item.label}</span></span>{#if r.item.note}<span class="note" data-testid="row-note">{r.item.note}</span>{/if}{#if r.item.value !== undefined}<span class="value" data-testid="sheet-value">{r.item.value}</span>{/if}</div>
        {/each}
        {:else}
        {#each shown as r, i (rowKey(r, byId))}
          {@const steps = hasSteps(r.item)}
          {@const options = r.item.options}
          {@const reason = showsReason(items, i)}
          {@const second = twoLines(items, i)}
          <!-- svelte-ignore a11y_click_events_have_key_events, a11y_interactive_supports_focus (the keypad drives the rows; nothing in a sheet takes focus) -->
          <div
            role="menuitem"
            class="row"
            aria-label={`${r.n === undefined ? "" : r.n % 10} ${r.item.label}`.trim()}
            aria-disabled={r.item.disabled ? "true" : undefined}
            data-selected={r.item.selected}
            data-active={r.index === level.highlight}
            data-id={r.item.id}
            data-count={r.item.count ?? "row"}
            style:height={px(rowHeight(row, { reason: second, steps, options: options !== undefined }))}
            onclick={() => ontap(r.index)}
          >
            <span class="n">{r.n === undefined ? "" : r.n % 10}</span>{#if r.item.glyph}<span class="tile math" class:small={"text" in r.item.glyph && r.item.glyph.text.length > 1} data-testid="row-glyph" aria-hidden="true">{@html "icon" in r.item.glyph ? ICONS.home : r.item.glyph.text}</span>{/if}<span class="text"><span class="label">{r.item.label}</span>{#if reason}<span class="reason">{r.item.reason}</span>{:else if r.item.hint}<span class="reason" data-testid="row-hint">{r.item.hint}</span>{:else if r.item.dots && steps}<span class="dots under" data-testid="row-dots" aria-hidden="true">{#each r.item.dots as c}<i style:background={c}></i>{/each}</span>{/if}</span>{#if r.item.dots && !steps}<span class="dots" data-testid="row-dots" aria-hidden="true">{#each r.item.dots as c}<i style:background={c}></i>{/each}</span>{/if}{#if r.item.note}<span class="note" data-testid="row-note">{r.item.note}</span>{/if}{#if options}<span class="seg" data-testid="row-options">{#each options as o (o.id)}<button type="button" class="opt" data-option={o.id} aria-label={o.spoken} aria-pressed={o.selected} disabled={r.item.disabled || o.disabled} onclick={(e) => { e.stopPropagation(); onoption(r.index, o.id); }}>{o.label}</button>{/each}</span>{/if}{#if steps}<button type="button" class="step" data-testid="step-down" aria-label={t("sheet.stepDown")} disabled={r.item.disabled} onclick={(e) => { e.stopPropagation(); sheet.adjustAt(r.index, -1); }}>◀</button>{/if}{#if r.item.value !== undefined}<span class="value" data-testid="sheet-value">{r.item.value}</span>{/if}{#if steps}<button type="button" class="step" data-testid="step-up" aria-label={t("sheet.stepUp")} disabled={r.item.disabled} onclick={(e) => { e.stopPropagation(); sheet.adjustAt(r.index, 1); }}>▶</button>{/if}{#if r.item.selected !== undefined}<span class="tick" aria-hidden="true">{r.item.selected ? "✓" : ""}</span>{/if}{#if r.item.submenu}<span class="more" aria-hidden="true">›</span>{/if}
          </div>
        {/each}
        {/if}
        {#if built < rows.length}<div class="rest" data-testid="sheet-rest" aria-hidden="true" style:height={px(rest)}></div>{/if}
        {#if rows.length === 0}<p class="empty" data-testid="sheet-empty">{t("sheet.noMatch")}</p>{/if}
      </div>
      {/if}
      <!-- Find (R4a): the highlighted item's details (docs/04 3.6) -->
      {#if level.current?.preview}<div class="preview" class:long={level.longPreview} data-testid="find-preview">{level.current.preview}</div>{/if}
      {#if level.current?.put}<button type="button" class="put" data-testid="find-put" onclick={() => level.current?.put?.run()}>{level.current.put.label} ▶</button>{/if}
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
    width: min(calc(100% - var(--sp-4)), var(--sheet-max));
    margin: 0 var(--sp-2) var(--sp-1);
    background: var(--panel);
    border: var(--stroke-thin) solid var(--line);
    border-radius: var(--radius-l);
    padding: var(--sp-1) var(--sp-15) var(--sp-15);
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    max-height: calc(100% - var(--sp-2));
    min-height: 0;
    flex: 0 1 auto;
  }
  /* over the keypad: the keypad's width, square at its bottom edge */
  .keypad .sheet {
    width: 100%;
    margin: 0;
    max-height: 100%;
    border-bottom: 0;
    border-radius: var(--radius-l) var(--radius-l) 0 0;
    /* R82f1 (F117): at the keypad's bottom edge, with no border there, 2 px below the last row are enough; the 4 px
       this saves let Plot's nine Menu rows fit at their floor on the Fairphone 6 (380 px of room), so none is cut */
    padding-bottom: var(--sp-05);
    pointer-events: auto;
    box-shadow: var(--shadow-sheet) color-mix(in srgb, var(--bg) 50%, transparent);
  }
  .keypad .sheet.placed {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    max-height: none;
  }
  .head {
    display: flex;
    align-items: center;
    gap: var(--sp-15);
    padding: var(--sp-05) var(--sp-1) var(--sp-05) var(--sp-2);
    color: var(--muted);
    font-size: var(--fs-note);
    min-height: var(--head-h);
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
    margin-right: calc(-1 * var(--sp-05));
  }
  .ticon :global(svg) {
    width: var(--icon-w);
    height: var(--icon-h);
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
    padding: var(--stroke-thin) var(--sp-15);
    border-radius: var(--radius-s);
    border: var(--stroke-thin) solid var(--line);
  }
  .count {
    white-space: nowrap;
  }
  .note {
    margin-left: var(--sp-15);
    font-size: var(--fs-caption);
    color: var(--muted);
    white-space: nowrap;
  }
  .preview {
    flex: none;
    padding: var(--sp-1) var(--sp-2) 0;
    border-top: var(--stroke-thin) solid var(--line);
    font-size: var(--fs-small);
    color: var(--muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  /* Find in a unit slot (R24d): the row's second job, a button under the preview */
  .put {
    flex: none;
    margin: var(--sp-05) var(--sp-2) var(--sp-1);
    padding: var(--sp-1) var(--sp-25);
    min-height: var(--head-h);
    align-self: flex-start;
    border: var(--stroke-thin) solid var(--line);
    border-radius: var(--radius-s);
    background: none;
    color: var(--text);
    font-size: var(--fs-small);
  }
  .preview.long {
    white-space: pre-line;
    overflow-wrap: anywhere;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 4;
    line-clamp: 4;
  }
  /* a licence text (R87): plain reading type, wrapped */
  .doc {
    display: block;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    padding: var(--sp-1) var(--sp-2);
    font-size: var(--fs-small);
    line-height: 1.4;
    color: var(--text);
    min-height: var(--doc-min);
  }
  .icon {
    all: unset;
    font-size: var(--fs-input);
    line-height: 1;
    padding: var(--sp-05) var(--sp-2);
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
    mask-image: linear-gradient(to bottom, var(--mask-on) calc(100% - var(--fade)), transparent);
  }
  .list.cut-top {
    mask-image: linear-gradient(to top, var(--mask-on) calc(100% - var(--fade)), transparent);
  }
  .list.cut-top.cut-bottom {
    mask-image: linear-gradient(to bottom, transparent, var(--mask-on) var(--fade), var(--mask-on) calc(100% - var(--fade)), transparent);
  }
  /* a row shrinks with the room (sheetFit.ts): its height is set, the type follows it, 18 px at the normal 42 */
  .row {
    display: flex;
    gap: var(--sp-3);
    align-items: center;
    box-sizing: border-box;
    padding: 0 var(--sp-3);
    border-radius: var(--radius);
    font-size: calc(var(--row, var(--sheet-row)) * 0.4286);
    cursor: pointer;
    flex-shrink: 0;
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
    font-size: var(--fs-note);
    min-width: 1ch;
  }
  /* the status line's glyph tile at row size (R84) */
  .tile {
    flex: none;
    width: var(--row-tile-w);
    height: var(--row-tile-h);
    border-radius: var(--radius-s);
    background: var(--chip-bg);
    color: var(--text);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: var(--fs-key);
  }
  .tile.small {
    font-size: var(--fs-ui);
  }
  .tile :global(svg) {
    width: var(--icon-w);
    height: calc(var(--icon-h) + var(--stroke-thin));
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
    font-size: var(--fs-small);
    line-height: var(--lh-small);
    color: var(--muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  /* a family's colours (Appearance, R50e) */
  .dots {
    display: flex;
    flex: none;
    gap: var(--sp-05);
    margin: 0 calc(-1 * var(--sp-05));
  }
  .dots.under {
    margin: var(--sp-05) 0 0;
    height: var(--sp-3);
    align-items: center;
  }
  .dots i {
    width: var(--dot);
    height: var(--dot);
    border-radius: 50%;
    box-shadow: inset 0 0 0 var(--stroke-thin) var(--line);
  }
  .value {
    color: var(--shift);
    font-size: var(--fs-value);
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
    width: var(--touch);
    height: var(--touch);
    margin: 0 calc(-1 * var(--sp-2));
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: var(--fs-ui);
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
  /* a button per value (R86): the current one marked, each at least 44 × 44 px */
  .seg {
    display: flex;
    flex: none;
    border: var(--stroke-thin) solid var(--line);
    border-radius: var(--radius);
    overflow: hidden;
    margin-right: calc(-1 * var(--sp-1));
  }
  .opt {
    all: unset;
    box-sizing: border-box;
    min-width: var(--touch);
    height: var(--touch);
    padding: 0 var(--sp-2);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: var(--fs-note);
    color: var(--muted);
    white-space: nowrap;
    cursor: pointer;
  }
  .opt + .opt {
    border-left: var(--stroke-thin) solid var(--line);
  }
  .opt[aria-pressed="true"] {
    background: var(--chip-bg);
    color: var(--text);
    font-weight: 700;
  }
  .opt:active {
    color: var(--shift);
  }
  .opt:disabled {
    color: var(--text-dead);
    cursor: default;
  }
  .tick {
    color: var(--shift);
    min-width: 1ch;
  }
  .more {
    color: var(--muted);
    font-size: var(--fs-key);
  }
  .grid {
    display: grid;
    gap: var(--sp-1);
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
    border-radius: var(--radius);
    border: var(--stroke-thin) solid var(--line);
    font-size: var(--fs-cell); /* the widest template (piecewise) fits a sixth of a phone's width */
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
    font-size: var(--fs-ui);
  }
  .pick {
    position: absolute;
    top: var(--sp-05);
    left: calc(var(--sp-1) + var(--stroke-thin));
    font-size: var(--fs-legend);
    line-height: 1;
    color: var(--shift);
  }
  /* The highlighted row or cell (R12b): the picked-row roles, as History's picked row: the --pick ground with a --focus
     edge. Only --text and --muted read on --pick in every theme, so the row's numbers, values and ticks (--shift
     elsewhere) turn --text on it, and a disabled row's label --muted (style.test.ts). */
  .row[data-active="true"] {
    background: var(--pick);
    box-shadow: inset var(--stroke-thick) 0 0 var(--focus);
  }
  .row[data-active="true"] :is(.n, .value, .tick),
  .row[data-active="true"] :is(.step, .opt):active {
    color: var(--text);
  }
  .row[data-active="true"][aria-disabled="true"] :is(.label, .n, .value, .step) {
    color: var(--muted);
  }
  button.cell[data-active="true"] {
    background: var(--pick);
    border-color: var(--focus);
    box-shadow: inset 0 calc(-1 * var(--stroke-thick)) 0 var(--focus);
  }
  button.cell[data-active="true"] .pick {
    color: var(--text);
  }
  /* the hits not built yet (R132): their height, so the scroll and its cues are as with every row there */
  .rest {
    flex-shrink: 0;
  }
  .empty {
    margin: var(--sp-2) var(--sp-3);
    color: var(--muted);
  }
</style>
