<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- R11: the picked history row's actions, items 1-5 of the Menu (docs/05 3.3), with R36's why line above them. It is
     drawn only while a row is picked, so it loads with the clipboard code (appLoaders.ts), not in the start chunk (R147).
     R3 (r19 section 3, R147): on an empty line it lies over the entry line's box, with that box's bottom edge and height,
     so neither the history nor the keypad moves; with text on the line it stands above the line in the flow. -->
<script lang="ts">
  import type { ClipActions } from "../clipboard/actions.svelte.ts";
  import type { EntryController } from "../entry/controller.ts";
  import { t } from "../i18n/index.ts";
  import type { HistoryItem } from "../state/session.svelte.ts";

  let { clip, entry, row, height, onaction }: {
    clip: ClipActions;
    entry: EntryController;
    row: HistoryItem;
    /** The entry line's height (px): the slot it covers when `over`. */
    height: number;
    /** A button was pressed: the pick ends before the action runs. */
    onaction: () => void;
  } = $props();

  const why = $derived(clip.rowWhy(row));
  /** Over the empty entry line (R3), else above it (a tap can pick a row while the line has text; ▲ cannot). Read when
   *  the pick starts or moves (entry.value is not reactive): a key that types drops the pick, so the line cannot
   *  change under the buttons. */
  const over = $derived((void row, entry.value === ""));
  /** A tap on a button must not take the caret out of the entry line. */
  const noFocus = (e: Event): void => e.preventDefault();
</script>

<div class="rowslot" class:over style:min-height={over ? `${height}px` : undefined}>
  {#if why}<div class="rowwhy" data-testid="row-why">{why}</div>{/if}
  <div class="rowbar" role="toolbar" aria-label={t("history.actions")} data-testid="row-actions">
    {#each clip.rowButtons(row) as b (b.id)}
      <button type="button" disabled={b.disabled} onpointerdown={noFocus} onclick={() => { onaction(); b.run?.(); }}>{b.label}</button>
    {/each}
  </div>
</div>

<style>
  /* the entry line is the screen's last row in the flow, so bottom 0 is its bottom edge; a long why line rises over the
     history's foot */
  .rowslot.over {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 4;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    background: var(--bg);
  }
  .rowbar {
    display: flex;
    gap: var(--sp-15);
    padding: var(--sp-1) var(--sp-3);
  }
  .rowwhy {
    padding: var(--sp-05) var(--sp-3) 0;
    font-size: var(--fs-note);
    color: var(--muted);
    /* wraps: the σ part (R40f1) comes last and must not be cut off at phone width */
    white-space: normal;
    overflow-wrap: anywhere;
  }
  .rowbar button {
    flex: 1;
    min-height: var(--touch);
    font: inherit;
    font-size: var(--fs-note);
    border-radius: var(--radius);
    border: var(--stroke-thin) solid var(--line);
    background: var(--panel);
    color: var(--text);
    padding: 0 var(--sp-1);
  }
  .rowbar button:disabled {
    color: var(--muted);
  }
</style>
