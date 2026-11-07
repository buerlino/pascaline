<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<script lang="ts">
  // Symb view: the slots of an app, each with its on/off toggle. The selected slot is edited on the shared
  // entry line (the app loads it there); tapping a slot selects it.
  import { t } from "../i18n/index.ts";
  import { numText } from "../i18n/enNum.ts";
  import Math from "../render/Math.svelte";
  import type { SlotsState } from "./slots.svelte.ts";

  let {
    slots,
    label,
    onselect,
    colors = [],
  }: {
    slots: SlotsState;
    /** Plain-text label before the entry, e.g. "F1(x)=". */
    label: (i: number) => string;
    onselect: (i: number) => void;
    /** Optional colour per slot (the curve colour in Plot). */
    colors?: readonly string[];
  } = $props();

  let list: HTMLElement | undefined = $state();
  $effect(() => {
    const el = list?.querySelector<HTMLElement>(`[data-slot="${slots.selected}"]`);
    el?.scrollIntoView({ block: "nearest" });
  });
</script>

<ol class="slots" bind:this={list} aria-label={numText("symb.label")}>
  {#each slots.names as name, i (name)}
    <li class="slot" data-slot={i} data-name={name} data-selected={slots.selected === i} aria-current={slots.selected === i} data-on={slots.enabled[i]}>
      <button
        type="button"
        class="toggle"
        role="switch"
        aria-checked={slots.enabled[i]}
        aria-label={numText("symb.toggle")}
        style:--c={colors[i % colors.length] ?? "var(--text)"}
        onpointerdown={(e) => e.preventDefault()}
        onclick={() => slots.toggle(i)}
      ></button>
      <button type="button" class="body" onpointerdown={(e) => e.preventDefault()} onclick={() => onselect(i)}>
        <span class="name">{label(i)}</span>
        {#if slots.latex[i]}<Math latex={slots.latex[i] ?? ""} />{/if}
      </button>
      {#if slots.errors[i]}<span class="error" role="alert">{slots.errors[i]}</span>{/if}
    </li>
  {/each}
</ol>

<style>
  .slots {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    list-style: none;
    margin: 0;
    padding: var(--sp-1) var(--sp-2);
  }
  .slot {
    display: grid;
    grid-template-columns: var(--row-tile-w) 1fr;
    align-items: center;
    border-radius: var(--radius);
    border: var(--stroke-thin) solid transparent;
  }
  .slot[data-selected="true"] {
    border-color: var(--focus);
    background: var(--panel);
  }
  .toggle {
    width: var(--tile-h);
    height: var(--tile-h);
    margin: 0 calc(var(--sp-15) + var(--stroke-thin));
    border-radius: var(--radius-s);
    border: var(--stroke) solid var(--c);
    background: transparent;
  }
  .toggle[aria-checked="true"] {
    background: var(--c);
  }
  .body {
    all: unset;
    display: flex;
    align-items: baseline;
    gap: var(--sp-2);
    min-height: var(--slot-h);
    padding: var(--sp-1) var(--sp-2) var(--sp-1) 0;
    font-size: var(--fs-key);
    overflow-x: auto;
    cursor: pointer;
  }
  .slot[data-on="false"] .body {
    opacity: 0.5;
  }
  .name {
    color: var(--muted);
    font-size: var(--fs-ui);
    white-space: nowrap;
  }
  .error {
    grid-column: 2;
    font-size: var(--fs-small);
    color: var(--error);
    padding-bottom: var(--sp-1);
  }
</style>
