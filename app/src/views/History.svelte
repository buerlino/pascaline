<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<script lang="ts">
  import { tick } from "svelte";
  import { t } from "../i18n/index.ts";
  import { CAS_SOFT_BUDGET_MS } from "../calc/port.ts";
  import Math from "../render/Math.svelte";
  import { mathlive } from "../render/mathlive.svelte.ts";
  import { markText } from "../state/displayMode.ts";
  import type { MarkInfo } from "../engine/format.ts";
  import type { HistoryItem, UsedValue } from "../state/session.svelte.ts";

  let {
    items,
    display,
    mark,
    onrecall,
    oninsert,
    oncancel,
    onlongpress,
    selected = null,
  }: {
    items: HistoryItem[];
    /** P4: the row picked with Up from an empty entry line (index into items), or null. */
    selected?: number | null;
    display: (item: HistoryItem) => { text: string; latex: string };
    /** The `=` / `≈` / `⚠ n` before a number result (docs/04 2.4); null for a non-number. */
    mark: (item: HistoryItem) => MarkInfo | null;
    /** Tapping an entry puts it back on the line, with the values of its chips. */
    onrecall: (item: HistoryItem) => void;
    /** L5: tapping a result puts it on the entry line at the cursor, as a chip (docs/04 2.8). */
    oninsert: (item: HistoryItem) => void;
    oncancel: () => void;
    /** A long press on a finished row: its copy actions (docs/04 2.6). */
    onlongpress?: (item: HistoryItem) => void;
  } = $props();

  // A long press (500 ms; the browser cancels the pointer when the finger starts a scroll) opens the row's actions; the tap that follows the lift is not a tap.
  const LONG_PRESS_MS = 500;
  let press: ReturnType<typeof setTimeout> | undefined;
  let longPressed = false;
  function endPress(): void {
    clearTimeout(press);
    press = undefined;
  }
  function pressStart(e: PointerEvent, item: HistoryItem): void {
    endPress();
    longPressed = false;
    if (!onlongpress || item.status !== "done" || e.button > 0) return;
    press = setTimeout(() => {
      press = undefined;
      longPressed = true;
      onlongpress(item);
    }, LONG_PRESS_MS);
  }
  /** Run a tap action unless this click ends a long press. */
  function tapped(act: () => void): void {
    if (longPressed) longPressed = false;
    else act();
  }

  // F28: the stored values a CAS result read, in one muted line: at most three names, then "+n". When all come from
  // one view it is said once at the end; otherwise after each name.
  const USES_SHOWN = 3;
  const viewText = (v: UsedValue["view"]): string => t(v === "home" ? "history.usesHome" : "history.usesCas");
  function usesLine(uses: UsedValue[]): string {
    const shown = uses.slice(0, USES_SHOWN);
    const once = uses.every((u) => u.view === uses[0]?.view);
    const names = shown.map((u) => `${u.name} = ${u.preview}${once ? "" : ` (${viewText(u.view)})`}`).join(", ");
    const more = uses.length > shown.length ? ` +${uses.length - shown.length}` : "";
    return `${names}${more}${once ? ` · ${viewText(uses[0]!.view)}` : ""}`;
  }

  let scroller: HTMLElement | undefined = $state();

  // Only the newest entries are drawn (layout and MathLive markup cost grow with every drawn item, which
  // slowed both the engine start and Enter with a full history). Scrolling to the top draws earlier ones.
  const PAGE = 20;
  let shownCount = $state(PAGE);
  const shown = $derived(items.length > shownCount ? items.slice(items.length - shownCount) : items);
  let sentinel: HTMLElement | undefined = $state();
  $effect(() => {
    if (!sentinel || !scroller) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) void showEarlier();
      },
      { root: scroller },
    );
    io.observe(sentinel);
    return () => io.disconnect();
  });
  async function showEarlier(): Promise<void> {
    if (!scroller || shownCount >= items.length) return;
    const before = scroller.scrollHeight - scroller.scrollTop;
    shownCount += PAGE;
    await tick();
    scroller.scrollTop = scroller.scrollHeight - before; // keep what the user was looking at in place
  }

  // Keep the newest entry in view.
  $effect(() => {
    void items.length;
    void items.at(-1)?.status;
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
  });

  // Keep the picked row in view (drawing earlier rows first if it is above the drawn page).
  $effect(() => {
    if (selected === null || !scroller) return;
    if (selected < items.length - shownCount) shownCount = items.length - selected;
    void tick().then(() => scroller?.querySelector('[data-selected="true"]')?.scrollIntoView({ block: "nearest" }));
  });

  // A running row is as high as a one-line result: an invisible "0" drawn as a result is (MathLive's line box is
  // 0.4 px higher than a text line, so no CSS number would match). Made once, not per Enter (renderStats).
  const strut = $derived(mathlive.mod?.convertLatexToMarkup("0") ?? "0");

  // After CAS_SOFT_BUDGET_MS a running job gets a prominent Cancel (D3).
  let now = $state(performance.now());
  $effect(() => {
    if (items.at(-1)?.status !== "pending") return; // only the newest entry can be running
    const timer = setInterval(() => (now = performance.now()), 500);
    return () => clearInterval(timer);
  });
</script>

<section class="history" aria-label={t("history.label")} bind:this={scroller}>
  {#if items.length === 0}
    <p class="empty">{t("history.empty")}</p>
  {/if}
  {#if items.length > shown.length}
    <div class="earlier" bind:this={sentinel} aria-hidden="true"></div>
  {/if}
  {#each shown as item, k (item.id)}
    {#if item.status === "note"}
      <div class="item note" data-status="note" data-testid="safe-start" role="status">{item.text}</div>
    {:else}
    <article class="item" data-status={item.status}
      onpointerdown={(e) => pressStart(e, item)} onpointerup={endPress} onpointercancel={endPress}
      oncontextmenu={(e) => e.preventDefault()}
      data-selected={selected !== null && k + items.length - shown.length === selected ? "true" : undefined}>
      <button type="button" class="in" title={t("history.recall")} onclick={() => tapped(() => onrecall(item))}>
        <Math latex={item.latex} />
      </button>
      <div class="out" data-testid="result">
        {#if item.status === "pending"}
          <span class="strut" aria-hidden="true">{@html strut}</span>
          <span class="working late">{t("history.working")}</span>
          <button type="button" class="cancel late" class:prominent={now - item.startedAt > CAS_SOFT_BUDGET_MS} onclick={oncancel}>
            {t("history.cancel")}
          </button>
        {:else if item.status === "cancelled"}
          <span class="note">{t("history.cancelled")}</span>
        {:else if item.status === "error"}
          <span class="error" role="alert">{item.text}</span>
        {:else}
          {@const d = display(item)}
          {@const m = mark(item)}
          {@const noDigit = m?.mark === "⚠" && m.n === 0 && !m.warn}
          {#if m}<span class="mark" data-mark={m.mark} data-testid="mark" title={t(`mark.${m.mark === "=" ? "exact" : m.mark === "≈" ? "approx" : "warn"}`)}>{noDigit ? t("mark.noDigit") : markText(m)}</span>{/if}
          <button type="button" class="result" data-text={d.text} title={t("history.insert")}
            onpointerdown={(e) => e.preventDefault()} onclick={() => tapped(() => oninsert(item))}>
            {#if !noDigit}<Math latex={d.latex} />{/if}
          </button>
        {/if}
      </div>
      {#if item.status === "done" && item.uses?.length}
        <div class="uses" data-testid="uses">{usesLine(item.uses)}</div>
      {/if}
    </article>
    {/if}
  {/each}
</section>

<style>
  .history {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 8px 12px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .earlier {
    min-height: 1px;
  }
  .empty {
    margin: auto;
    color: var(--muted);
    text-align: center;
  }
  .item {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin-top: auto;
    /* a long press opens the row's actions, not the system's text selection */
    -webkit-user-select: none;
    user-select: none;
    -webkit-touch-callout: none;
  }
  .item + .item {
    margin-top: 0;
  }
  .item[data-selected="true"] {
    border-radius: 8px;
    background: var(--panel);
    outline: 2px solid var(--shift);
  }
  .in {
    all: unset;
    cursor: pointer;
    font-size: 22px;
    color: var(--muted);
    align-self: flex-start;
    max-width: 100%;
    overflow-x: auto;
  }
  .out {
    align-self: flex-end;
    font-size: 26px;
    display: flex;
    gap: 10px;
    align-items: baseline;
    max-width: 100%;
    overflow-x: auto;
  }
  .result {
    all: unset;
    cursor: pointer;
    color: var(--text);
  }
  .mark {
    font-size: 20px;
    color: var(--muted);
    white-space: nowrap;
  }
  .uses {
    align-self: flex-end;
    max-width: 100%;
    font-size: 14px;
    color: var(--muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .mark[data-mark="⚠"] {
    color: var(--error);
  }
  .note,
  .working {
    font-size: 14px;
    color: var(--muted);
  }
  .strut {
    visibility: hidden;
    width: 0;
  }
  .working,
  .cancel {
    align-self: center;
  }
  .error {
    font-size: 16px;
    color: var(--error);
  }
  .cancel {
    font: inherit;
    font-size: 14px;
    padding: 4px 12px;
    border-radius: 6px;
    border: 1px solid var(--line);
    background: var(--panel);
    color: var(--text);
  }
  .cancel.prominent {
    background: var(--error);
    color: #fff;
    border-color: var(--error);
    font-weight: 700;
  }
</style>
