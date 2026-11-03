<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<script lang="ts">
  import { tick } from "svelte";
  import { t } from "../i18n/index.ts";
  import { CAS_SOFT_BUDGET_MS } from "../calc/port.ts";
  import Math from "../render/Math.svelte";
  import { mathlive } from "../render/mathlive.svelte.ts";
  import { markText, noDigit as hasNoDigit } from "../state/displayMode.ts";
  import { edgeFade } from "./edgeFade.ts";
  import type { MarkInfo } from "../engine/format.ts";
  import type { HistoryItem, UsedValue } from "../state/session.svelte.ts";

  let {
    items,
    display,
    input = (item) => item.latex,
    mark,
    onrecall,
    oninsert,
    oncancel,
    onlongpress,
    undo = null,
    onundo,
    selected = null,
  }: {
    items: HistoryItem[];
    /** P4: the row picked with Up from an empty entry line (index into items), or null. */
    selected?: number | null;
    display: (item: HistoryItem) => { text: string; latex: string };
    /** The input as drawn (R100: `;` for its argument commas in comma mode); by default as stored. */
    input?: (item: HistoryItem) => string;
    /** The `=` / `≈` / `⚠ n` before a number result (docs/04 2.4); null for a non-number. */
    mark: (item: HistoryItem) => MarkInfo | null;
    /** Tapping an entry puts it back on the line, with the values of its chips. */
    onrecall: (item: HistoryItem) => void;
    /** L5: tapping a result puts it on the entry line at the cursor, as a chip (docs/04 2.8). */
    oninsert: (item: HistoryItem) => void;
    oncancel: () => void;
    /** A long press on a finished row: its copy actions (docs/04 2.6). */
    onlongpress?: (item: HistoryItem) => void;
    /** R98: what the last Clear history or Delete took, while Undo can bring it back: one note row, a tap on it undoes. */
    undo?: "clear" | "delete" | null;
    onundo?: () => void;
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

  /** R63: a unit row draws its request with the units in it (the line itself, recalled, has none: Home has no units). */
  function drawnInput(item: HistoryItem): string {
    const u = item.units?.input;
    return input(typeof u === "string" ? { ...item, latex: u } : item);
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
    void undo; // the note (R98) is the last row
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
  {#if items.length === 0 && !undo}
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
      <button type="button" class="in" title={t("history.recall")} use:edgeFade onclick={() => tapped(() => onrecall(item))}>
        <Math latex={drawnInput(item)} />
      </button>
      <div class="out" data-testid="result" use:edgeFade={item.status}>
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
          {@const noDigit = hasNoDigit(m)}
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
      {#if item.settingReset}
        <div class="uses" data-testid="setting-reset">{t("history.settingReset")}</div>
      {/if}
      {#if item.status === "done" && typeof item.units?.names === "string"}
        <div class="uses" data-testid="unit-names">{item.units.names}</div>
      {/if}
      {#if item.unitDropped}
        <div class="uses" data-testid="unit-dropped">{t("history.unitDropped")}</div>
      {/if}
    </article>
    {/if}
  {/each}
  {#if undo}
    <button type="button" class="undone" data-testid="undo-note" onpointerdown={(e) => e.preventDefault()} onclick={onundo}>
      {t(undo === "clear" ? "history.cleared" : "history.deleted")}
    </button>
  {/if}
</section>

<style>
  .history {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: var(--sp-2) var(--sp-3);
    display: flex;
    flex-direction: column;
    /* docs/05 3.5 (R12b): a thin divider in the middle of the space between entries; the rows keep their heights. The
       8 px more space docs/05 asks for waits for the owner: on a phone it moves the first of three rows under the
       status line (decisions.md, Needs the user) */
    --between: var(--sp-25);
    gap: var(--between);
  }
  .earlier {
    min-height: var(--stroke-thin);
  }
  .empty {
    margin: auto;
    color: var(--muted);
    text-align: center;
  }
  .item {
    display: flex;
    flex-direction: column;
    gap: var(--sp-05);
    margin-top: auto;
    /* a long press opens the row's actions, not the system's text selection */
    -webkit-user-select: none;
    user-select: none;
    -webkit-touch-callout: none;
  }
  .item + .item {
    margin-top: 0;
  }
  .item {
    position: relative;
  }
  .item + .item::before {
    content: "";
    position: absolute;
    left: 0;
    right: 0;
    top: calc(var(--between) / -2);
    border-top: var(--stroke-thin) solid var(--line);
    pointer-events: none;
  }
  .item[data-selected="true"] {
    border-radius: var(--radius);
    background: var(--pick);
    outline: var(--stroke) solid var(--focus);
  }
  .in {
    all: unset;
    cursor: pointer;
    font-size: var(--fs-input);
    color: var(--muted);
    align-self: flex-start;
    max-width: 100%;
    overflow-x: auto;
  }
  .out {
    align-self: flex-end;
    font-size: var(--fs-result);
    display: flex;
    gap: var(--sp-25);
    align-items: baseline;
    max-width: 100%;
    overflow-x: auto;
  }
  /* a long input or result scrolls sideways; the edge with more behind it fades (edgeFade.ts), never cut without a sign */
  .in:global([data-cut="end"]),
  .out:global([data-cut="end"]) {
    mask-image: linear-gradient(to left, transparent, var(--mask-on) var(--fade));
  }
  .in:global([data-cut="start"]),
  .out:global([data-cut="start"]) {
    mask-image: linear-gradient(to right, transparent, var(--mask-on) var(--fade));
  }
  .in:global([data-cut="both"]),
  .out:global([data-cut="both"]) {
    mask-image: linear-gradient(to right, transparent, var(--mask-on) var(--fade), var(--mask-on) calc(100% - var(--fade)), transparent);
  }
  .result {
    all: unset;
    cursor: pointer;
    color: var(--text);
  }
  .mark {
    font-size: var(--fs-key);
    color: var(--muted);
    white-space: nowrap;
  }
  .uses {
    align-self: flex-end;
    max-width: 100%;
    font-size: var(--fs-note);
    color: var(--muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .mark[data-mark="≈"] {
    color: var(--approx);
  }
  .mark[data-mark="⚠"] {
    color: var(--warn);
  }
  .note,
  .working {
    font-size: var(--fs-note);
    color: var(--muted);
  }
  .undone {
    all: unset;
    cursor: pointer;
    margin-top: auto;
    align-self: center;
    font-size: var(--fs-note);
    padding: var(--sp-15) var(--sp-3);
    color: var(--muted);
  }
  .item + .undone {
    margin-top: 0;
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
    font-size: var(--fs-body);
    white-space: nowrap; /* one line (docs/05 3.5); a long message scrolls with the row */
    color: var(--error);
  }
  .cancel {
    font: inherit;
    font-size: var(--fs-note);
    padding: var(--sp-1) var(--sp-3);
    border-radius: var(--radius-s);
    border: var(--stroke-thin) solid var(--line);
    background: var(--panel);
    color: var(--text);
  }
  .cancel.prominent {
    background: var(--error);
    color: var(--on-error);
    border-color: var(--error);
    font-weight: 700;
  }
</style>
