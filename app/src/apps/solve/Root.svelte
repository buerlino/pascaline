<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<script lang="ts">
  import SlotList from "../SlotList.svelte";
  import type { ViewId } from "../types.ts";
  import type { SolveApp } from "./app.svelte.ts";
  import SolveNum from "./SolveNum.svelte";

  let { app, view }: { app: SolveApp; view: ViewId } = $props();
</script>

{#if view === "symb"}
  <SlotList slots={app.slots} label={(i) => `${app.slots.names[i]}:`} onselect={(i) => app.selectSlot(i)} />
{:else}
  <SolveNum {app} />
{/if}
