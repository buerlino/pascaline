<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<script lang="ts">
  import { onMount } from "svelte";
  import { APPS } from "./apps/registry.ts";
  import type { AppShell, PaletteId } from "./apps/shell.svelte.ts";
  import type { ClipActions } from "./clipboard/actions.svelte.ts";
  import type { EntryController } from "./entry/controller.ts";
  import { t, type MessageKey } from "./i18n/index.ts";
  import { openLayer } from "./input/backLayer.ts";
  import { vibrate } from "./input/haptics.ts";
  import Keypad from "./keyboard/Keypad.svelte";
  import { loadShiftPalettes, shiftPalettes } from "./keyboard/palettes.ts";
  import { keyboard, MATHS_ROW, type Key, type Layer, type Palette, type PaletteItem } from "./keyboard/keyboard.ts";
  import * as route from "./keyboard/route.ts";
  import type { RouteCtx } from "./keyboard/route.ts";
  import { resultToEntry } from "./render/insertable.ts";
  import type { UserKeys } from "./keyboard/userKeys.svelte.ts";
  import { noDigit } from "./state/displayMode.ts";
  import type { HistoryItem, Session, View } from "./state/session.svelte.ts";
  import History from "./views/History.svelte";
  // The Mode and Settings lists load when idle after the keypad is drawn, or on the first open (R35: not in the start chunk).
  let modeSheet: typeof import("./views/modeSheet.ts") | null = null;
  const loadModeSheet = async (): Promise<typeof import("./views/modeSheet.ts")> => (modeSheet ??= await import("./views/modeSheet.ts"));
  /** Set while the first Mode or Settings open waits for that code. */
  let sheetLoad: Promise<void> | null = null;
  // The sheet's view (Sheet.svelte with sheetFit.ts) is its own chunk, fetched when idle after the keypad is drawn (R46);
  // the model and the keys stay here. A key that opens a sheet before it is in waits in the queue.
  import { loadSheetView, sheetChunk } from "./views/sheetView.svelte.ts";
  // The Settings page (R21b) is its own chunk: its code loads when idle, or on the first open.
  type SettingsUi = { C: (typeof import("./views/SettingsPage.svelte"))["default"]; SettingsPage: (typeof import("./views/settingsPage.svelte.ts"))["SettingsPage"] };
  let settingsUi: SettingsUi | null = null;
  const loadSettingsUi = async (): Promise<SettingsUi> => {
    if (settingsUi) return settingsUi;
    const [v, m] = await Promise.all([import("./views/SettingsPage.svelte"), import("./views/settingsPage.svelte.ts")]);
    return (settingsUi = { C: v.default, SettingsPage: m.SettingsPage });
  };

  import { paletteAction, paletteItems } from "./views/tmplSheet.ts";

  let { session, entry, shell, userKeys }: { session: Session; entry: EntryController; shell: AppShell; userKeys: UserKeys } = $props();

  /** A status-line control as a key (R15b, R15c1): its tap takes the same path as a key press (an open sheet or the
   *  Settings page gives way, it runs at once while an app loads, and waits while a sheet's code loads). */
  const statusKey = (id: string, name: "apps" | "symb" | "plot" | "num" | "menu"): Key => ({ id, row: 0, col: 0, span: 1, cls: "nav", label: { primary: "" }, actions: { primary: { kind: "special", name } } });
  const PLACE_KEY = statusKey("place", "apps");
  const MENU_KEY = statusKey("menu-status", "menu");
  const TABS = (["symb", "plot", "num"] as const).map((v) => ({ view: v, key: statusKey(`tab-${v}`, v) }));

  /** The open Settings page and its model (null: closed). */
  let settings = $state.raw<{ C: SettingsUi["C"]; page: InstanceType<SettingsUi["SettingsPage"]> } | null>(null);
  const settingsOpen = $derived(settings !== null);
  const sheetOpen = $derived(shell.sheet !== null);

  // The shell paints first; main.ts then loads MathLive, which puts the field into this element.
  onMount(() => {
    if (host) entry.setHost(host);
    // R45: a hardware Enter is the Enter key (a picked row, an open sheet), not a bare submit
    entry.onEnter = () => {
      const key = keyboard.byId.get("enter");
      if (key) press(key, "primary");
      else enter();
    };
    // R15c2: a hardware Escape is the Esc key (an open page, sheet or pick takes it first)
    entry.onEscape = () => {
      const key = keyboard.byId.get("esc");
      if (key) press(key, "primary");
    };
    // R31 (F27): a hardware keyboard's printable keys are taps of the keypad key with that character
    entry.onKey = (id, layer) => {
      const key = keyboard.byId.get(id);
      if (key) press(userKeys.resolve(key), layer);
    };
    entry.onLetter = typeLetter;
    shell.goTo = goTo; // the Apps sheet's Home and CAS rows
    shell.openSettings = openSettings; // the last row of every Menu
    entry.onDead = dead;
  });
  let host: HTMLElement | undefined = $state();
  let entryHeight = $state(0);

  // The pick sheets' layer (R21a): from the top of the first maths row to the keypad's bottom edge, measured once per
  // resize of the keypad.
  let keysEl: HTMLDivElement | undefined = $state();
  let mathsTop = $state(0);
  /** A tap in the viewport closes a pick sheet; a click left over from the press that opened it does not. */
  let catchPressed = false;
  $effect(() => {
    void shell.sheet;
    catchPressed = false;
  });
  const firstMaths = keyboard.keys.find((k) => k.row === MATHS_ROW);
  const keyBox = (id: string): DOMRect | undefined => keysEl?.querySelector(`[data-key="${id}"]`)?.getBoundingClientRect();
  $effect(() => {
    const el = keysEl;
    if (!el || !firstMaths) return;
    const place = (): void => {
      const k = keyBox(firstMaths.id);
      if (k) mathsTop = k.top - el.getBoundingClientRect().top;
    };
    place();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(place);
    ro.observe(el);
    return () => ro.disconnect();
  });

  // Copy, paste and share (docs/04 2.6) load after the engine is ready, once the browser is idle (not in the start chunk).
  // The shell reaches them for the apps (AppHost.copy) and for the Home/CAS Menu.
  let clip = $state.raw<ClipActions | undefined>();
  let clipLoading: Promise<ClipActions> | undefined;
  function loadClip(): Promise<ClipActions> {
    clipLoading ??= import("./clipboard/actions.svelte.ts").then((m) => {
      const c = new m.ClipActions(session, shell, entry, { insert: insertResult, recall: (item) => entry.set(item.latex, item.chips) });
      shell.clip = c;
      shell.homeMenu = () => c.menu();
      clip = c;
      return c;
    });
    return clipLoading;
  }
  /** Run now when loaded, else as soon as the code has arrived (a key pressed before the idle load). */
  function withClip(run: (c: ClipActions) => void): void {
    if (clip) run(clip);
    else void loadClip().then(run);
  }
  $effect(() => {
    // (a browser without requestIdleCallback loads it on the first use)
    if (session.engineState === "ready" && "requestIdleCallback" in window) requestIdleCallback(() => void loadClip(), { timeout: 3000 });
  });

  /** Home/CAS: the entry line is cleared as soon as the job starts; the result arrives in the history. Apps decide themselves. */
  function enter(): void {
    if (shell.app !== null) {
      shell.enter(entry.value);
      return;
    }
    if (session.submit(entry.value, undefined, entry.chips)) entry.clear();
  }

  /** L5 and docs/04 2.8: a tapped or picked result goes on the line as a chip that carries its full value. */
  function insertResult(item: HistoryItem): void {
    // a result with no confirmed digit goes on the line as the bare warning mark, never as its unconfirmed number
    const shown = noDigit(session.mark(item)) ? "⚠" : session.display(item).latex;
    const chip = session.chipFor(item);
    if (chip) entry.insertResult(shown, chip);
    else entry.insert(resultToEntry(shown)); // too long for a chip: as drawn
  }

  /** Home or CAS, from anywhere (an app too). */
  function goTo(view: View): void {
    picked = null;
    shell.close();
    session.setView(view);
  }

  function clearKey(): void {
    if (shell.app === null && entry.value === "") session.clearHistory();
    else entry.clear();
  }

  /** Tmpl: the template palette (R10), a grid on the sheet; a pick inserts its template as its key would. A view
   *  without an entry line (Plot) has nothing to insert into. */
  function openTemplates(): void {
    openPalette("tmpl", t("tmpl.title"), keyboard.palette);
  }
  /** Tmpl, Shift + 6 (relations and logic) and Shift + 9 (symbols and Greek, R18): a palette on the grid sheet. */
  function openPalette(id: PaletteId, title: string, p: Palette, name?: (id: string) => string): void {
    if (!shell.showsEntry) return dead();
    picked = null;
    shell.togglePalette(id, title, () => paletteItems(p.items, insertTemplate, name), p.columns);
  }
  /** The Shift palettes come in their own chunk, loaded with MathLive; until then the key waits for it. */
  function openShiftPalette(id: "rel" | "sym"): void {
    const open = (m: NonNullable<typeof shiftPalettes>): void =>
      openPalette(id, m.paletteText(`${id}.title`), id === "rel" ? m.relations : m.symbols, (cell) => m.paletteText(`${id}.${cell}`));
    if (shiftPalettes) open(shiftPalettes);
    else void loadShiftPalettes().then(open);
  }
  function insertTemplate(p: PaletteItem): void {
    entry.run(paletteAction(p, session.settings.entry === "line"));
  }

  /** Mode's last row (or a user key that holds Settings): the Settings page over everything (R21b, docs/05 3.4). It
   *  opens on its first row. */
  function openSettings(): void {
    const show = (m: NonNullable<typeof modeSheet>, ui: NonNullable<typeof settingsUi>): void => {
      picked = null;
      shell.closeSheet();
      settings = { C: ui.C, page: new ui.SettingsPage(m.settingsSections(session)) };
    };
    if (modeSheet && settingsUi) return show(modeSheet, settingsUi);
    // every key meanwhile waits in the queue (decisions.md R8), so none of them lands on the line before the page is there
    sheetLoad = Promise.all([loadModeSheet(), loadSettingsUi()]).then(
      ([m, ui]) => {
        sheetLoad = null;
        show(m, ui);
      },
      () => {
        sheetLoad = null; // the chunk did not load: the queued keys run without the page
      },
    );
  }
  function closeSettings(): void {
    settings = null;
  }
  // Android back is Esc for the open layer (R21b): the page, or a pick sheet, owns one history entry while it is open.
  $effect(() => {
    if (!settingsOpen) return;
    return openLayer(closeSettings);
  });
  $effect(() => {
    if (!sheetOpen) return;
    return openLayer(() => shell.closeSheet());
  });
  /** A tap on a status chip (`at`: the row to start on), or a user key that holds Mode: the Mode sheet. Without `at`
   *  it starts on Angle, so Mode, ▶, Enter always switches the angle unit. */
  function openMode(at?: string): void {
    onModeSheet((m) => {
      picked = null;
      shell.showMenu(t("mode.title"), m.modeItems(session, openSettings), { remember: false, at });
    });
  }
  /** Run `open` at once when the lists are loaded; else after the load, with every key meanwhile waiting in the queue
   *  (decisions.md R8), so none of them lands on the line before the sheet is there. */
  function onModeSheet(open: (m: NonNullable<typeof modeSheet>) => void): void {
    if (modeSheet && sheetChunk.C) return open(modeSheet);
    sheetLoad = Promise.all([loadModeSheet(), loadSheetView()]).then(
      ([m]) => {
        sheetLoad = null;
        open(m);
      },
      () => {
        sheetLoad = null; // the chunk did not load: the queued keys run without the sheet
      },
    );
  }

  /** A finger went down on the keypad, or a gesture made a step: vibrate when switched on in Settings. */
  function touched(): void {
    const h = session.settings.haptics;
    if (h.on) vibrate(h.strength / 100, h.ms);
  }

  /** A key that does nothing here (docs/05 3.7): a short double haptic and no other effect. */
  function dead(): void {
    const h = session.settings.haptics;
    if (!h.on) return;
    vibrate(h.strength / 100, h.ms);
    setTimeout(() => vibrate(h.strength / 100, h.ms), h.ms + 70);
  }

  /** The picked history row (P4: Up on an empty line; route.ts walks it). */
  let picked = $state<number | null>(null);
  /** The CAS view is under the keys (no app on top): Alpha types lower case there (R58). */
  const casKeys = $derived(session.view === "cas" && shell.app === null);
  /** The key routing (keyboard/route.ts, R15c2) works on this: the models, this component's state and its actions. */
  const ctx: RouteCtx = {
    get session() { return session; },
    get shell() { return shell; },
    get entry() { return entry; },
    get picked() { return picked; },
    set picked(v) { picked = v; },
    get settingsPage() { return settings?.page ?? null; },
    get sheetLoad() { return sheetLoad; },
    set sheetLoad(v) { sheetLoad = v; },
    waiting: [],
    get casKeys() { return casKeys; },
    enter,
    insertResult,
    goTo,
    clearKey,
    openSettings,
    closeSettings,
    openMode,
    openTemplates,
    openShiftPalette,
    withClip,
    loadClip: () => void loadClip(),
    dead,
  };
  const press = (key: Key, layer?: Layer): void => route.press(ctx, key, layer);
  const typeLetter = (ch: string): void => route.typeLetter(ctx, ch);
  const cancel = (): Promise<void> => route.escape(ctx);

  const busy = $derived(session.busy || shell.busy);
  const appName = $derived(shell.app ? t(APPS.find((a) => a.id === shell.app)?.name as MessageKey) : "");
  /** Where you are (docs/05 3.2): Home, CAS, or an app and its view. */
  const place = $derived(shell.app === null ? t(`view.${session.view}`) : appName);
  const angle = $derived(session.settings.angle);
  /** The status line is not a place for typing: a tap on it must not take the caret out of the entry line. */
  const noFocus = (e: Event): void => e.preventDefault();
</script>

<main class="app">
  <!-- the status line (docs/05 3.2): where you are, the mode chips, Shift/Alpha, busy. At most 28 px (docs/03 rule 9).
       The place name is the Home ↔ CAS switch (P12 point 2, R15b); in an app it goes back to Home/CAS. -->
  <!-- svelte-ignore a11y_no_static_element_interactions (only keeps the caret in the entry line; the buttons inside are the controls) -->
  <header data-testid="status" data-engine={session.engineState} data-busy={busy} onpointerdown={noFocus}>
    <button
      type="button"
      class="place"
      data-testid="place"
      data-app={shell.app ?? ""}
      data-view={shell.app === null ? session.view : shell.view}
      aria-label={t("status.place", { place })}
      onclick={() => press(PLACE_KEY, "primary")}>{place}</button>
    {#if shell.app !== null}
      <span class="tabs" role="tablist" aria-label={t("status.views")}>
        {#each TABS.filter((tb) => shell.views.includes(tb.view)) as tab (tab.view)}
          <button
            type="button"
            class="tab"
            role="tab"
            data-testid="tab-{tab.view}"
            aria-selected={shell.view === tab.view}
            onclick={() => press(tab.key, "primary")}>{t(`view.${tab.view}`)}</button>
        {/each}
      </span>
    {/if}
    <span class="chips">
      {#if session.engineState === "starting"}<span class="note">{t("engine.starting")}</span>{/if}
      {#if session.engineState === "failed"}<span class="note">{t("engine.error")}</span>{/if}
      <button
        type="button"
        class="chip"
        data-testid="chip-angle"
        data-angle={angle}
        data-changed={angle !== "rad"}
        aria-label={t("status.angle", { angle: t(`angle.${angle}`) })}
        onclick={() => session.setAngle(angle === "rad" ? "deg" : "rad")}>{angle === "rad" ? "RAD" : "DEG"}</button>
      <span class="pill" aria-label={t("status.format", { format: t(`format.${session.settings.format}`) })}>
        <button type="button" class="chip" data-testid="chip-format" onclick={() => openMode("format")}>{session.settings.format.toUpperCase()}</button>
        <button type="button" class="chip" data-testid="chip-digits" onclick={() => openMode("digits")}>{session.settings.digits}</button>
      </span>
      {#if session.shiftLock}<span class="mod" data-testid="mod-shift">⇧🔒</span>{:else if session.shift}<span class="mod" data-testid="mod-shift">⇧</span>{/if}
      {#if session.alphaLock}<span class="mod" data-testid="mod-alpha">α🔒</span>{:else if session.alpha}<span class="mod" data-testid="mod-alpha">α</span>{/if}
      {#if busy}<span class="busy" role="status" aria-label={t("status.busy")} data-testid="busy">⟳</span>{/if}
    </span>
    <button type="button" class="menubtn" data-testid="menu-button" aria-label={t("status.menu")} onclick={() => press(MENU_KEY, "primary")}>☰</button>
  </header>

  <div class="screen">
    <div class="stage">
      {#if shell.app === null}
        <History
          items={session.items}
          selected={picked}
          display={(item) => session.display(item)}
          mark={(item) => session.mark(item)}
          onrecall={(item) => { picked = null; entry.set(item.latex, item.chips); }}
          oninsert={(item) => { picked = null; insertResult(item); }}
          oncancel={() => void cancel()}
          onlongpress={(item) => withClip((c) => c.openRowMenu(item))}
        />
      {:else if shell.current}
        {@const C = shell.current.Root}
        <C app={shell.current.instance} view={shell.view} />
      {:else}
        <p class="loading">{t("apps.loading")}</p>
      {/if}
    </div>

    {#if clip?.notice}<div class="notice" role="status" data-testid="notice">{clip.notice}</div>{/if}

    <!-- R11: the picked row's actions, items 1-5 of the Menu (docs/05 3.3); shown only while a row is picked -->
    {#if clip && shell.app === null && picked !== null}
      {@const row = session.items[picked]}
      {#if row}
      <div class="rowbar" role="toolbar" aria-label={t("history.actions")} data-testid="row-actions">
        {#each clip.rowButtons(row) as b (b.id)}
          <button type="button" disabled={b.disabled} onpointerdown={noFocus} onclick={() => { picked = null; b.run?.(); }}>{b.label}</button>
        {/each}
      </div>
      {/if}
    {/if}

    <div class="entry" class:hidden={!shell.showsEntry} aria-label={t("entry.label")} bind:clientHeight={entryHeight}>
      {#if shell.entryLabel}<span class="entrylabel" data-testid="entry-label">{shell.entryLabel}</span>{/if}
      <div class="field" bind:this={host}></div>
    </div>

    <!-- a list that takes letters rises from just above the entry line, over the history or view, and takes the entry
         line's room only when its rows need it; while a pick sheet is over the keypad, a tap in the viewport closes it
         (docs/05 3.1) -->
    {#if shell.sheet?.letters}
      {@render sheetView(shell.sheet, "view")}
    {:else if shell.sheet}
      <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions (the Esc and Cancel keys close it too) -->
      <div class="catch" data-testid="sheet-catch" onpointerdown={(e) => { noFocus(e); catchPressed = true; }} onclick={() => {
        if (catchPressed) shell.closeSheet();
        catchPressed = false;
      }}></div>
    {/if}
  </div>

  <div class="keys" bind:this={keysEl}>
    <Keypad
      {userKeys}
      shift={session.shift}
      alpha={session.alpha}
      alphaLock={session.alphaLock}
      capsLock={session.capsLock}
      shiftLock={session.shiftLock}
      cas={casKeys}
      sheet={shell.sheet ? { filter: shell.sheet.level.filterable } : undefined}
      onpress={press}
      ontouch={touched}
    />
    <!-- a pick sheet rises over the maths rows (3–9), anchored at the keypad's bottom edge; the top cluster stays
         uncovered and live, and no key moves (decisions.md "R21") -->
    {#if shell.sheet && !shell.sheet.letters}
      <div class="layer" style:top="{mathsTop}px">{@render sheetView(shell.sheet, "keypad")}</div>
    {/if}
  </div>
</main>

{#if settings}
  <settings.C page={settings.page} onclose={closeSettings} />
{/if}

{#snippet sheetView(sheet: NonNullable<typeof shell.sheet>, over: "keypad" | "view")}
  {#if sheetChunk.C}
  <sheetChunk.C
    {sheet}
    {over}
    testid={shell.switcherOpen ? "apps" : "menu"}
    below={entryHeight}
    {keyBox}
    ontap={(i) => shell.picked(sheet.activate(i))}
    onback={() => sheet.back()}
    onclose={() => shell.closeSheet()}
  />
  {/if}
{/snippet}

<style>
  .app {
    display: flex;
    flex-direction: column;
    height: 100%;
    max-width: 720px;
    margin: 0 auto;
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    box-sizing: border-box;
    height: 28px;
    padding: 0 8px;
    border-bottom: 1px solid var(--line);
    font-size: 14px;
    line-height: 1;
  }
  header button {
    all: unset;
    box-sizing: border-box;
    cursor: pointer;
  }
  /* The place name is a button (R15b). Its target is the line's full height and at least 96 px wide; it does not reach
     below the line, where the top history row's formula and an app's first slot take their own taps (R15b report). */
  .place {
    flex: none;
    max-width: 60%;
    min-width: 96px;
    height: 28px;
    margin-left: -8px; /* from the screen's left edge */
    padding: 0 8px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    line-height: 28px;
    font-weight: 700;
    color: var(--text);
  }
  .place::after {
    content: " ▾";
    font-weight: 400;
    color: var(--muted);
  }
  .place:active {
    background: var(--key-nav);
  }
  .tabs {
    display: flex;
    gap: 2px;
    min-width: 0;
    flex: 0 1 auto;
    overflow: hidden;
  }
  .tab {
    min-width: 0;
    padding: 5px 5px;
    border-radius: 6px;
    font-size: 13px;
    overflow: hidden;
    text-overflow: ellipsis;
    color: var(--muted);
  }
  .tab[aria-selected="true"] {
    background: var(--key-nav);
    color: var(--text);
    font-weight: 700;
  }
  .menubtn {
    flex: none;
    width: 36px;
    height: 28px;
    margin-right: -8px;
    text-align: center;
    line-height: 28px;
    font-size: 17px;
    color: var(--text);
  }
  .menubtn:active {
    background: var(--key-nav);
  }
  .chips {
    display: flex;
    align-items: center;
    gap: 4px;
    flex: none;
    color: var(--muted);
  }
  .chip {
    padding: 5px 6px;
    border-radius: 6px;
    color: var(--muted);
    font-variant-numeric: tabular-nums;
  }
  .chip[data-changed="true"] {
    color: var(--shift);
    font-weight: 700;
  }
  .pill {
    display: flex;
    border: 1px solid var(--line);
    border-radius: 7px;
  }
  .mod {
    color: var(--shift);
    font-weight: 700;
  }
  .busy {
    color: var(--shift);
    display: inline-block;
    animation: spin 1s linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .busy {
      animation: none;
    }
  }
  .screen {
    position: relative;
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
  .stage {
    position: relative;
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
  /* R82 (F110): a view whose root carries data-floor (the Plot view: its readout) is never squeezed below its own
     minimum. Without it a short screen above the keypad (a phone with less height) shrank the stage under the readout and
     the keypad, drawn after it, covered the Root answer. Lists keep min-height 0 and scroll inside themselves. */
  .screen:has(> .stage > :global([data-floor])),
  .stage:has(> :global([data-floor])) {
    min-height: auto;
  }
  .keys {
    position: relative;
  }
  .layer {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 5;
    pointer-events: none; /* the keys a short sheet leaves visible stay live; the sheet itself takes its taps */
  }
  .catch {
    position: absolute;
    inset: 0;
    z-index: 5;
  }
  .loading {
    margin: auto;
    color: var(--muted);
  }
  .rowbar {
    display: flex;
    gap: 6px;
    padding: 4px 12px;
  }
  .rowbar button {
    flex: 1;
    min-height: 44px;
    font: inherit;
    font-size: 14px;
    border-radius: 8px;
    border: 1px solid var(--line);
    background: var(--panel);
    color: var(--text);
    padding: 0 4px;
  }
  .rowbar button:disabled {
    color: var(--muted);
  }
  .notice {
    position: relative;
    align-self: center;
    margin: 0 12px 4px;
    padding: 6px 14px;
    border-radius: 16px;
    background: var(--panel);
    border: 1px solid var(--line);
    color: var(--text);
    font-size: 14px;
  }
  .entry {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    /* room for the field before MathLive has loaded, so nothing jumps */
    min-height: 66px;
  }
  .entry.hidden {
    display: none;
  }
  .entrylabel {
    color: var(--muted);
    white-space: nowrap;
  }
  .field {
    flex: 1;
    min-width: 0;
  }
  .entry :global(math-field) {
    display: block;
    width: 100%;
    font-size: 28px;
    padding: 8px 10px;
    border-radius: 8px;
    background: var(--panel);
    color: var(--text);
    border: 1px solid var(--line);
    --caret-color: var(--focus);
    --selection-background-color: var(--pick);
  }
  .entry :global(math-field::part(virtual-keyboard-toggle)),
  .entry :global(math-field::part(menu-toggle)) {
    display: none;
  }
</style>
