<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- R24c: the unit view in the entry line's place (docs/04 4.3): the read-only formula with its slots (the field is
     made by units/open.ts and put in `.formula`), the reading of the active slot in words under it, then a refusal or
     the result as Calc.units() returns it (the full result view is R62's). Loaded with the unit view. -->
<script lang="ts">
  import { unitText } from "../i18n/enUnits.ts";
  import type { UnitView } from "./view.svelte.ts";

  let { view }: { view: UnitView } = $props();
  const shown = $derived(view.shown);
</script>

<div class="unitview" data-testid="unit-view" data-slot={view.activeId}>
  <div class="formula"></div>
  <div class="reading" data-testid="unit-reading" class:marked={view.reading.marked}>
    {#each view.reading.parts as p, i (i)}<span class:rare={p.marked}>{p.text}</span>{" "}{/each}
  </div>
  {#if shown.kind === "message"}
    <div class="message" data-testid="unit-message" role="alert">{shown.text}</div>
  {:else if shown.kind === "working"}
    <div class="working" data-testid="unit-working">{unitText("units.view.working")}</div>
  {:else if shown.kind === "result"}
    <div class="result" data-testid="unit-result" data-text={shown.display} data-unit={shown.unit}>
      <span class="mark">{shown.mark}</span>
      <span class="value">{shown.text}</span>
      {#if shown.unit}<span class="unit">{shown.unit}</span>{/if}
      {#if shown.warn}<span class="warn" data-testid="unit-warn">⚠</span>{/if}
    </div>
    {#if shown.why}<div class="why" data-testid="unit-why">{shown.why}</div>{/if}
    {#if shown.note}<div class="note" data-testid="unit-note">{shown.note}</div>{/if}
  {/if}
</div>

<style>
  .unitview {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
    outline: none; /* it holds the focus for the hardware keys; the active slot is what shows where they go */
  }
  .reading,
  .why,
  .note,
  .working {
    color: var(--muted);
    font-size: 14px;
    min-height: 1.2em;
  }
  .rare {
    color: var(--warn, var(--error));
  }
  .message {
    color: var(--error);
    font-size: 14px;
  }
  .result {
    font-size: 20px;
    display: flex;
    gap: 6px;
    align-items: baseline;
  }
  .result .mark,
  .result .unit {
    color: var(--muted);
  }
  .warn {
    color: var(--warn, var(--error));
  }
</style>
