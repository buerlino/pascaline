<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<script lang="ts">
  import SlotList from "../SlotList.svelte";
  import type { ViewId } from "../types.ts";
  import type { SolveApp } from "./index.ts";

  let { app, view }: { app: SolveApp; view: ViewId } = $props();
</script>

{#if view === "symb"}
  <SlotList slots={app.slots} label={(i) => `${app.slots.names[i]}:`} onselect={(i) => app.slots.select(i)} />
{/if}
