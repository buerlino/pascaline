<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<script lang="ts">
  import SlotList from "../SlotList.svelte";
  import type { ViewId } from "../types.ts";
  import { CURVE_COLORS, type FunctionApp } from "./app.svelte.ts";
  import FunctionNum from "./FunctionNum.svelte";
  import FunctionPlot from "./FunctionPlot.svelte";

  let { app, view }: { app: FunctionApp; view: ViewId } = $props();
</script>

{#if view === "symb"}
  <SlotList slots={app.slots} label={(i) => `${app.slots.names[i]}(x)=`} onselect={(i) => app.select(i)} colors={CURVE_COLORS} />
{:else if view === "plot"}
  <FunctionPlot {app} />
{:else}
  <FunctionNum {app} />
{/if}
