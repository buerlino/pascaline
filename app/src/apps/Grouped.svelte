<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<script lang="ts">
  // R125: a readout's grouped text (apps/grouped.ts). The thin space is drawn as a gap, not a character, as Home's
  // MathLive row draws `\,`: the cell's text stays the digits (a screen reader, a selection); `’` and `,` are text.
  let { text }: { text: string } = $props();
  const parts = $derived(text.split("\u2009"));
</script>

{#each parts as p, i (i)}{#if i > 0}<span class="gsep" aria-hidden="true"></span>{/if}{p}{/each}

<style>
  .gsep {
    display: inline-block;
    width: var(--group-gap);
  }
</style>
