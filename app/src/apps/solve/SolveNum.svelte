<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<script lang="ts">
  // Num view: the unknowns of the equations that are on, each with its value (the guess, then the
  // answer). ▲▼ or a tap select one; the entry line edits it; Menu → Solve. Below: the info line, with ⚠
  // when the residual check failed, and the polynomial roots when asked for.
  import { t } from "../../i18n/index.ts";
  import { longpress } from "../longpress.ts";
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
    <p class="empty">{t("solve.empty")}</p>
  {:else}
    <table data-testid="solve-table">
      <tbody>
        {#each app.unknowns as name (name)}
          <tr data-name={name} data-selected={app.selected === name} aria-current={app.selected === name}>
            <th>
              <button type="button" onpointerdown={(e) => e.preventDefault()} onclick={() => app.selectUnknown(name)}>{@render label(name)}</button>
            </th>
            <td use:longpress={() => void app.copyValue(name)} data-value={app.value(name)} data-solved={app.report?.ok && app.report.names.includes(name) && !app.report.roots}>
              {app.fmtValue(name)}{#if app.warned[name]}<span class="warn" data-testid="mark" title={t("mark.warn")}> ⚠</span>{/if}
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
          {#each app.report.roots as r, i (i)}<li>{@render label(app.report.names[0] ?? "")} = {r}{#if app.report.rootWarns?.[i]}<span class="warn" data-testid="mark" title={t("mark.warn")}> ⚠</span>{/if}</li>{/each}
        </ol>
      {/if}
      <p class="info" class:late={app.report.info === t("history.working")}>
        {#if app.report.warn}<span class="warn" title={t("solve.warnTitle")}>⚠</span>{/if}
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
    padding: 4px 8px;
  }
  .empty {
    color: var(--muted);
    padding: 8px;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-variant-numeric: tabular-nums;
  }
  tr {
    border-bottom: 1px solid var(--panel);
  }
  tr[data-selected="true"] {
    background: var(--panel);
    outline: 1px solid var(--focus);
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
    padding: 8px;
    color: var(--muted);
    cursor: pointer;
  }
  td {
    padding: 8px;
    text-align: right;
    font-size: 20px;
  }
  .report {
    padding: 8px;
    font-size: 14px;
  }
  .roots {
    margin: 0 0 6px;
    padding-left: 20px;
    font-size: 18px;
    font-variant-numeric: tabular-nums;
  }
  .info {
    margin: 0;
    color: var(--muted);
  }
  .warn {
    color: var(--warn);
    font-size: 18px;
    margin-right: 4px;
  }
</style>
