<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<script lang="ts">
  import { APPS, placeGlyph } from "../apps/registry.ts";
  import type { AppShell } from "../apps/shell.svelte.ts";
  import { t, type MessageKey } from "../i18n/index.ts";
  import { alphaLower, type Key, type Layer } from "../keyboard/keyboard.ts";
  import type { Session } from "../state/session.svelte.ts";
  import { updateOffer } from "../state/updateOffer.svelte.ts";
  import { ICONS } from "./icons.ts";

  // R97: the status line, out of App.svelte. Props in, events out; no store of its own.
  let { session, shell, busy, cas, onpress, onmode }: {
    session: Session;
    shell: AppShell;
    /** A job runs (session or app). */
    busy: boolean;
    /** The CAS view is under the keys, where Alpha alone types lower case (R58). */
    cas: boolean;
    /** A tap on a control, as the press of a key (the same path as a key press). */
    onpress: (key: Key, layer: Layer) => void;
    /** A tap on a mode chip: the Mode sheet, on that row. */
    onmode: (at: string) => void;
  } = $props();

  /** A status-line control as a key (R15b, R15c1): its tap takes the same path as a key press (an open sheet gives way, it runs at once while an app loads, and waits while a sheet's code loads). */
  const statusKey = (id: string, name: "apps" | "symb" | "plot" | "num" | "menu"): Key => ({ id, row: 0, col: 0, span: 1, cls: "nav", label: { primary: "" }, actions: { primary: { kind: "special", name } } });
  const PLACE_KEY = statusKey("place", "apps"), MENU_KEY = statusKey("menu-status", "menu");
  const TABS = (["symb", "plot", "num"] as const).map((v) => ({ view: v, name: t(`view.${v}`), key: statusKey(`tab-${v}`, v) }));

  // The update note shows only when an update waits (A49): its code and style are a lazy chunk (R97).
  let UpdateNote = $state.raw<typeof import("./UpdateNote.svelte").default | null>(null);
  $effect(() => {
    if (updateOffer.restart && !UpdateNote) void import("./UpdateNote.svelte").then((m) => (UpdateNote = m.default)).catch(() => {});
  });

  const appName = $derived(shell.app ? t(APPS.find((a) => a.id === shell.app)?.name as MessageKey) : "");
  /** Where you are (docs/05 3.2): Home, CAS, or an app and its view. */
  const place = $derived(shell.app === null ? t(`view.${session.view}`) : appName);
  const angle = $derived(session.settings.angle);
  const glyph = $derived(placeGlyph(shell.app ?? session.view));
  /** The tile's ring: a job running, or the engine starting (R82f2: the ⟳ went). */
  const ring = $derived(busy || session.engineState === "starting");
  /** The ⇧ α slot: one sign, underlined when locked; `a` when Alpha types lower case here, `α` when it types capitals (R101). */
  const mod = $derived(
    session.alpha
      ? { alpha: true, lock: session.alphaLock, text: alphaLower(session.shift, true, cas) ? "a" : "α" }
      : session.shift
        ? { alpha: false, lock: session.shiftLock, text: "⇧" }
        : null,
  );
  /** The status line is not a place for typing: a tap on it must not take the caret out of the entry line. */
  const noFocus = (e: Event): void => e.preventDefault();
</script>

  <!-- the status line (docs/05 3.2, R82f2): the place's glyph tile (the apps list), the views as icons, the fixed ⇧ α
       slot, the mode chips, ☰. At most 28 px (docs/03 rule 9). Nothing in it changes width with Shift, Alpha or the
       engine's state, so a press never moves a view from under the finger; the engine's notes show in the stage. -->
  <!-- svelte-ignore a11y_no_static_element_interactions (only keeps the caret in the entry line; the buttons inside are the controls) -->
  <header data-testid="status" data-engine={session.engineState} data-busy={busy} onpointerdown={noFocus}>
    <button
      type="button"
      class="place"
      data-testid="place"
      data-tip="place"
      data-app={shell.app ?? ""}
      data-view={shell.app === null ? session.view : shell.view}
      aria-label={t("status.place", { place })}
      onclick={() => onpress(PLACE_KEY, "primary")}>
      <!-- the glyph is our own table's text or icon (registry.ts), never user text -->
      <span class="tile math" class:small={"text" in glyph && glyph.text.length > 1} data-ring={ring} aria-hidden="true">{@html "icon" in glyph ? ICONS.home : glyph.text}</span>
      {#if shell.app === null}<span class="name" aria-hidden="true">{place}</span>{/if}
      <span class="caret" aria-hidden="true">▾</span>
    </button>
    {#if shell.app !== null}
      <span class="seg" role="tablist" aria-label={t("status.views")}>
        {#each TABS.filter((tb) => shell.views.includes(tb.view)) as tab (tab.view)}
          <!-- the icons are our own markup (ICONS), never user text -->
          <button
            type="button"
            class="tab"
            role="tab"
            data-testid="tab-{tab.view}"
            aria-selected={shell.view === tab.view}
            aria-label={tab.name}
            title={tab.name}
            onclick={() => onpress(tab.key, "primary")}>
            {@html ICONS[tab.view]}
          </button>
        {/each}
      </span>
    {/if}
    {#if updateOffer.restart && UpdateNote}<UpdateNote restart={updateOffer.restart} />{/if}
    <span class="slot" data-testid="mod-slot">
      <span
        class="mod"
        data-testid={mod ? `mod-${mod.alpha ? "alpha" : "shift"}` : undefined}
        data-lock={mod?.lock}
        aria-label={mod && t(mod.alpha ? "key.alpha" : "key.shift")}>{mod?.text}</span>
    </span>
    <span class="chips">
      <button
        type="button"
        class="chip"
        data-testid="chip-angle"
        data-angle={angle}
        data-changed={angle !== "rad"}
        aria-label={t("status.angle", { angle: t(`angle.${angle}`) })}
        onclick={() => session.setAngle(angle === "rad" ? "deg" : "rad")}>{angle === "rad" ? "RAD" : "DEG"}</button>
      <span class="pill" aria-label={t("status.format", { format: t(`format.${session.settings.format}`) })}>
        <button type="button" class="chip" data-testid="chip-format" onclick={() => onmode("format")}>{session.settings.format.toUpperCase()}</button>
        <button type="button" class="chip" data-testid="chip-digits" onclick={() => onmode("digits")}>{session.settings.digits}</button>
      </span>
    </span>
    <button type="button" class="menubtn" data-testid="menu-button" data-tip="menu" aria-label={t("status.menu")} onclick={() => onpress(MENU_KEY, "primary")}>☰</button>
    <!-- the busy ring is drawn on an aria-hidden tile: a screen reader hears the job from this hidden line (R102) -->
    {#if busy}<span class="sr" role="status" data-testid="busy-status">{t("status.busy")}</span>{/if}
  </header>

<style>
  header {
    display: flex;
    align-items: stretch;
    gap: var(--sp-15);
    box-sizing: border-box;
    height: var(--status-h);
    padding: 0 var(--sp-2);
    /* the line under it as an inset shadow, so the targets keep the full 28 px */
    box-shadow: inset 0 calc(-1 * var(--stroke-thin)) 0 var(--line);
    font-size: var(--fs-note);
    line-height: 1;
  }
  .sr {
    position: absolute;
    width: var(--stroke-thin);
    height: var(--stroke-thin);
    margin: calc(-1 * var(--stroke-thin));
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  header button {
    all: unset;
    box-sizing: border-box;
    cursor: pointer;
  }
  /* the icons come from ICONS through {@html}, outside the component's scope */
  header :global(svg) {
    display: block;
    width: var(--icon-w);
    height: var(--icon-h);
  }
  header :global(.math) {
    font-family: "STIX Two Math", "Cambria Math", "Times New Roman", serif;
    font-style: italic;
  }
  /* The place (R15b, R82f2): its glyph tile and ▾, Home's and CAS's name between; the target is the line's full height,
     from the screen's left edge, and does not reach below the line (the top history row and an app's first slot take
     their own taps). */
  .place {
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--sp-05);
    margin-left: calc(-1 * var(--sp-2));
    padding: 0 var(--sp-1) 0 var(--sp-2);
    white-space: nowrap;
    font-weight: 700;
    color: var(--text);
  }
  .place:active {
    background: var(--key-nav);
    color: var(--key-text);
  }
  .tile {
    position: relative;
    flex: none;
    width: var(--tile-w);
    height: var(--tile-h);
    border-radius: var(--radius-s);
    background: var(--chip-bg);
    color: var(--text);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: var(--fs-glyph);
    font-weight: 400;
  }
  .tile.small {
    font-size: var(--fs-small);
  }
  /* busy or starting: a 2 px ring over the tile, its size unchanged */
  .tile[data-ring="true"]::after {
    content: "";
    position: absolute;
    inset: 0;
    border: var(--stroke) solid var(--alpha);
    border-radius: var(--radius-s);
    box-sizing: border-box;
  }
  .name {
    margin-left: var(--sp-1);
  }
  .caret {
    font-size: var(--fs-caption);
    font-weight: 400;
    color: var(--muted);
  }
  /* the views as icons, one segmented control; the selected one filled */
  .seg {
    flex: none;
    align-self: center;
    display: flex;
    gap: var(--stroke-thin);
    padding: var(--stroke-thin);
    border: var(--stroke-thin) solid var(--line);
    border-radius: calc(var(--radius-s) + var(--stroke-thin));
  }
  .tab {
    width: var(--tile-w);
    height: var(--tab-h);
    border-radius: calc(var(--radius-s) - var(--stroke-thin));
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: var(--fs-ui);
    color: var(--muted);
  }
  .tab[aria-selected="true"] {
    background: var(--chip-bg);
    color: var(--text);
  }
  /* the fixed ⇧ α slot: always 16 px, so Shift or Alpha moves nothing */
  .slot {
    flex: none;
    width: var(--icon-w);
    margin-left: auto;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .mod {
    color: var(--shift);
    font-weight: 700;
    line-height: var(--lh-small);
  }
  .mod[data-testid="mod-alpha"] {
    color: var(--alpha);
  }
  .mod[data-lock="true"] {
    box-shadow: inset 0 calc(-1 * var(--stroke)) 0 currentColor;
  }
  .menubtn {
    flex: none;
    width: var(--menu-w);
    margin-right: calc(-1 * var(--sp-2));
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: var(--fs-key-fn);
    color: var(--text);
  }
  .menubtn:active {
    background: var(--key-nav);
    color: var(--key-text);
  }
  .chips {
    display: flex;
    align-items: center;
    gap: var(--sp-1);
    flex: none;
    color: var(--muted);
  }
  .chip {
    padding: calc(var(--sp-1) + var(--stroke-thin)) var(--sp-15);
    border-radius: var(--radius-s);
    color: var(--muted);
    font-variant-numeric: tabular-nums;
  }
  .chip[data-changed="true"] {
    color: var(--shift);
    font-weight: 700;
  }
  .pill {
    display: flex;
    border: var(--stroke-thin) solid var(--line);
    border-radius: calc(var(--radius-s) + var(--stroke-thin));
  }
  /* the update note (UpdateNote.svelte, a lazy chunk) is the line's own element: the slot after it needs no auto margin */
  header :global(.update + .slot) {
    margin-left: 0;
  }
</style>
