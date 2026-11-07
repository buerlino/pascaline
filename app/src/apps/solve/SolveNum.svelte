<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<script lang="ts">
  // Num view: the unknowns of the equations that are on, each with its value (the guess, then the
  // answer). ▲▼ or a tap select one; the entry line edits it; Menu → Solve. Below: the info line, with ⚠
  // when the residual check failed, and the polynomial roots when asked for.
  import { t } from "../../i18n/index.ts";
  import { numText } from "../../i18n/enNum.ts";
  import { longpress } from "../longpress.ts";
  import Grouped from "../Grouped.svelte";
  import type { SolveApp } from "./app.svelte.ts";

  let { app }: { app: SolveApp } = $props();

  /** A subscripted unknown x_1 is shown as x with a subscript 1 (L1); the Giac name stays in data-name. */
  const split = (n: string): [string, string] => {
    const i = n.indexOf("_");
    return i < 0 ? [n, ""] : [n.slice(0, i), n.slice(i + 1)];
  };
</script>

{#snippet label(n: string)}{split(n)[0]}{#if split(n)[1]}<sub>{split(n)[1]}</sub>{/if}{/snippet}

<div class="num">
  {#if app.unknowns.length === 0}
    <p class="empty">{numText("solve.empty")}</p>
  {:else}
    <table data-testid="solve-table">
      <tbody>
        {#each app.unknowns as name (name)}
          <tr data-name={name} data-selected={app.selected === name} aria-current={app.selected === name}>
            <th>
              <button type="button" onpointerdown={(e) => e.preventDefault()} onclick={() => app.selectUnknown(name)}>{@render label(name)}</button>
            </th>
            <td use:longpress={() => void app.copyValue(name)} data-value={app.value(name)} data-solved={app.report?.ok && app.report.names.includes(name) && !app.report.roots}>
              <Grouped text={app.drawn(app.fmtValue(name))} />{#if app.warned[name]}<span class="warn" data-testid="mark" title={t("mark.warn")}> ⚠</span>{/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
  {#if app.report}
    <div class="report" data-testid="solve-report" data-warn={app.report.warn} data-ok={app.report.ok}>
      {#if app.report.roots}
        <ol class="roots" data-testid="solve-roots">
          {#each app.report.roots as r, i (i)}<li>{@render label(app.report.names[0] ?? "")} = <Grouped text={app.drawn(app.mark(r))} />{#if app.report.rootWarns?.[i]}<span class="warn" data-testid="mark" title={t("mark.warn")}> ⚠</span>{/if}</li>{/each}
        </ol>
      {/if}
      <p class="info" class:late={app.report.info === t("history.working")}>
        {#if app.report.warn}<span class="warn" title={numText("solve.warnTitle")}>⚠</span>{/if}
        <span data-testid="solve-info">{app.report.info}</span>
      </p>
    </div>
  {/if}
</div>

<style>
  .num {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: var(--sp-1) var(--sp-2);
  }
  .empty {
    color: var(--muted);
    padding: var(--sp-2);
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-variant-numeric: tabular-nums;
  }
  tr {
    border-bottom: var(--stroke-thin) solid var(--panel);
  }
  tr[data-selected="true"] {
    background: var(--panel);
    outline: var(--stroke-thin) solid var(--focus);
  }
  th {
    width: 25%;
    text-align: left;
    font-weight: normal;
  }
  th button {
    all: unset;
    display: block;
    width: 100%;
    padding: var(--sp-2);
    color: var(--muted);
    cursor: pointer;
  }
  td {
    padding: var(--sp-2);
    text-align: right;
    font-size: var(--fs-key);
  }
  .report {
    padding: var(--sp-2);
    font-size: var(--fs-note);
  }
  .roots {
    margin: 0 0 var(--sp-15);
    padding-left: var(--sp-5);
    font-size: var(--fs-glyph);
    font-variant-numeric: tabular-nums;
  }
  .info {
    margin: 0;
    color: var(--muted);
  }
  .warn {
    color: var(--warn);
    font-size: var(--fs-glyph);
    margin-right: var(--sp-1);
  }
</style>
