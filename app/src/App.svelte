<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<script lang="ts">
  import { onMount } from "svelte";
  import type { AppShell, PaletteId } from "./apps/shell.svelte.ts";
  import type { SubMenu } from "./apps/types.ts";
  import type { ClipActions } from "./clipboard/actions.svelte.ts";
  import type { EntryController } from "./entry/controller.ts";
  import { t } from "./i18n/index.ts";
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
  import { counted, countScreenTaps } from "./state/pressCount.ts";
  import { createLoaders, type FindCode, type ModeSheetCode } from "./appLoaders.ts";
  import { tipsDue } from "./state/tips.ts";
  import History from "./views/History.svelte";
  import StatusLine from "./views/StatusLine.svelte";
  /** Set while the first Mode or Settings open waits for that code. */
  let sheetLoad: Promise<void> | null = null;
  // The sheet's view (Sheet.svelte with sheetFit.ts) is its own chunk, fetched when idle after the keypad is drawn (R46);
  // the model and the keys stay here. A key that opens a sheet before it is in waits in the queue.
  import { loadSheetView, sheetChunk } from "./views/sheetView.svelte.ts";

  let { session, entry, shell, userKeys }: { session: Session; entry: EntryController; shell: AppShell; userKeys: UserKeys } = $props();

  // The lazy code (appLoaders.ts, R97): the Mode lists, Find with its index, and copy, paste and share. None is in the start chunk.
  let clip = $state.raw<ClipActions | undefined>();
  // svelte-ignore state_referenced_locally (main.ts mounts App once with these three objects; none is ever replaced)
  const loaders = createLoaders({
    session,
    shell,
    entry,
    busy: () => busy,
    insertResult: (item) => insertResult(item),
    onClip: (c) => (clip = c),
  });
  const { loadModeSheet, loadFind, loadClip } = loaders;

  // R15c4: the first-start tips, a lazy chunk (views/tipsHost.ts) shown once on a fresh profile and again from Settings › Help and about.
  const showTips = (): void => void import("./views/tipsHost.ts").then((m) => m.showTips(), () => {});

  const sheetOpen = $derived(shell.sheet !== null);
  $effect(() => entry.setNames(session.userNames)); // R33: the stored names are drawn in their colour on the line
  $effect(() => void (userKeys.decimalComma = entry.decimalComma = session.decimalComma)); // R57: the `.` and `,` keys' faces (keypad, tap, hardware key)

  // The shell paints first; main.ts then loads MathLive, which puts the field into this element.
  onMount(() => {
    if (host) entry.setHost(host);
    const count = (): void => session.taps.press(); // R70, R107: a hardware key (`<` `>` `!` and a dead one too) and a tap are presses (docs/04 5.2)
    // R45: a hardware Enter is the Enter key (a picked row, an open sheet), not a bare submit
    entry.onEnter = counted(count, () => {
      const key = keyboard.byId.get("enter");
      if (key) press(key, "primary");
      else enter();
    });
    // R15c2: a hardware Escape is the Esc key (an open sheet or pick takes it first)
    entry.onEscape = counted(count, () => {
      const key = keyboard.byId.get("esc");
      if (key) press(key, "primary");
    });
    // R31 (F27): a hardware keyboard's printable keys are taps of the keypad key with that character
    entry.onKey = counted(count, (id, layer) => {
      const key = keyboard.byId.get(id);
      if (key) press(userKeys.resolve(key), layer);
    });
    entry.onLetter = counted(count, typeLetter);
    shell.goTo = goTo; // the Apps sheet's Home and CAS rows
    shell.openSettings = openSettings;
    shell.settingsMenu = () => (loaders.modeSheet ? (settingsMenu ??= loaders.modeSheet.settingsMenu(session, settingsEnv)) : undefined); // (R49)
    shell.homeView = () => (session.view === "cas" ? "cas" : "home"); // the last row of every Menu
    entry.onSymbol = counted(count, (ch) => entry.run({ kind: "insert", latex: ch }));
    entry.onDead = counted(count, dead);
    entry.onPress = counted(count, () => {}); // R107f1: a leaving ) or | is a press that needs nothing more
    // the first start (R15c4): once the keypad is drawn and the browser is idle, so the tips never compete with the start
    void tipsDue(location.search).then((due) => due && ("requestIdleCallback" in window ? requestIdleCallback(showTips, { timeout: 2000 }) : setTimeout(showTips, 500)));
    return countScreenTaps(count);
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

  /** Run now when loaded, else as soon as the code has arrived (a key pressed before the idle load), with the keys
   *  meanwhile in the queue (decisions.md R8). The Mode code comes too: every Menu's last row is Settings, its submenu (R49). */
  function withClip(run: (c: ClipActions) => void | Promise<void>): void {
    if (clip && loaders.modeSheet) return void run(clip);
    const load = Promise.all([loadClip(), loadModeSheet().catch(() => null)]).then(([c]) => run(c));
    if (sheetLoad === null) sheetLoad = load.catch(() => {}).finally(() => (sheetLoad = null));
  }
  $effect(() => {
    // (a browser without requestIdleCallback loads it on the first use)
    if (session.engineState === "ready" && "requestIdleCallback" in window) requestIdleCallback(() => void loadClip(), { timeout: 3000 });
  });
  $effect(() => {
    if (session.engineState !== "ready" || !("requestIdleCallback" in window) || loaders.findLoading) return;
    // not while a job runs (its Working… timing, working.spec.ts); this runs again when it ends
    if (!busy) requestIdleCallback(() => void loadFind().catch(() => {}), { timeout: 5000 }); // the first Math press tries again
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
    const chip = session.chipFor(item);
    // a unit row with no chip (R63f1): Home's number alone, never its σ or unit (Home has no units); its chip shows both
    const { units, ...number } = item;
    const shown = noDigit(session.mark(item)) ? "⚠" : session.display(units && !chip ? number : item).latex;
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
    if (shell.app === null && entry.value === "") void session.clearHistory();
    else entry.clear();
  }

  /** Tmpl: the template palette (R10), a grid on the sheet; a pick inserts its template as its key would. A view
   *  without an entry line (Plot) has nothing to insert into. */
  function openTemplates(): void {
    withPalettes((m) => openPalette("tmpl", m.paletteText("tmpl.title"), m.tmpl, (cell) => m.paletteText(`tmpl.${cell}`)));
  }
  /** Run `open` with the palettes' chunk (loaded with MathLive): at once when it is in, else after the load, with every key
   *  meanwhile in the queue (decisions.md R8). If the chunk does not load, the queued keys run without the sheet. */
  function withPalettes(open: (m: NonNullable<typeof shiftPalettes>) => void): void {
    if (shiftPalettes) return open(shiftPalettes);
    sheetLoad = loadShiftPalettes().then(open, () => {}).finally(() => (sheetLoad = null));
  }
  /** Tmpl, Shift + 6 (relations and logic) and Shift + 9 (symbols and Greek, R18): a palette on the grid sheet. */
  function openPalette(id: PaletteId, title: string, p: Palette, name: (id: string) => string): void {
    if (!shell.showsEntry) return dead();
    const cells = sheetChunk.palette; // (R91: with the sheet's view; the palette keys wait for it in the queue)
    if (!cells) return void loadSheetView().then(() => openPalette(id, title, p, name), dead);
    picked = null;
    shell.togglePalette(id, title, () => cells.paletteItems(p.items, insertTemplate, name), p.columns);
  }
  /** The palettes (Tmpl too, R91) come in their own chunk, loaded with MathLive; until then the key waits for it. */
  function openShiftPalette(id: "rel" | "sym"): void {
    withPalettes((m) => openPalette(id, m.paletteText(`${id}.title`), id === "rel" ? m.relations : m.symbols, (cell) => m.paletteText(`${id}.${cell}`)));
  }
  /** Math (R4a): Find (find/finder.ts). Until its code and the index are in, every key waits in the queue (decisions.md
   *  R8). No entry line, nothing to insert into. `slot` (R4b, Settings › Your keys): a pick sets that free key's slot. */
  function openFind(slot?: FindSlot): void {
    if (!slot && !shell.showsEntry) return dead();
    if (loaders.findCode && sheetChunk.C) return showFind(loaders.findCode, slot);
    if (loaders.findLoading) void import("./find/finder.ts").then((m) => m.loadIndex(true)).catch(() => {}); // hurry the idle load
    onFind(loadFind(true), (f) => showFind(f, slot));
  }
  type FindSlot = { id: string; layer: Layer };
  const showFind = (f: FindCode, slot?: FindSlot): void => { picked = null; f.m.showFind(shell, entry, f.index, slot && { ...slot, userKeys }); };
  /** Vars and Shift + Math (R4b): Find on the user's variables and functions, or Memory (the code only, not the index). */
  function openNames(memory: boolean): void {
    if (!memory && !shell.showsEntry) return dead();
    onFind(import("./find/finder.ts"), (m) => { picked = null; m.showNames(shell, entry, session, memory); });
  }
  function onFind<T>(load: Promise<T>, show: (t: T) => void): void {
    sheetLoad = Promise.all([load, loadSheetView()]).then(([t]) => { sheetLoad = null; show(t); }, () => { sheetLoad = null; dead(); }); // (a load that fails: the queued keys run without the sheet)
  }
  function insertTemplate(p: PaletteItem): void {
    const cells = sheetChunk.palette;
    if (cells) entry.run(cells.paletteAction(p, session.settings.entry === "line")); // (a pick is of an open palette, so it is loaded)
  }

  /** What Settings › Your keys needs (R4b): the slots, and Find to pick a slot's content from. */
  // svelte-ignore state_referenced_locally (main.ts mounts App once; shell and entry are never replaced)
  const settingsEnv = { get userKeys() { return userKeys; }, shell, entry, tips: showTips, chooseFor: (id: string, layer: Layer): void => openFind({ id, layer }), data: withClip }; // data: Settings › Data (R38a, R38b; as a long press on a history row: waits for the clipboard and Mode code if the sheet opened before they came; no import of its own in the start chunk)
  /** Settings as the ☰ menus' last row opens it (R49): one per session, its rows read the settings on every draw. */
  let settingsMenu: SubMenu | undefined;
  /** A user key that holds Settings, or a ☰ menu's last row before the Mode code is in: Mode › Settings, on its first
   *  row (R49, docs/05 3.4). */
  function openSettings(): void {
    onModeSheet((m) => {
      picked = null;
      shell.showMenu(t("mode.title"), m.modeItems(session, settingsEnv), { remember: false, at: "settings" });
      shell.sheet?.enter(); // its submenu: a level on top
    });
  }
  // Android back is Esc for the open sheet (R21b, R49): it goes back one level, and the root closes. Each level it goes
  // back takes a new history entry for the level now on top.
  let backs = $state(0);
  $effect(() => {
    void backs;
    if (!sheetOpen) return;
    return openLayer(() => {
      if (shell.sheet?.back()) backs++;
      else shell.closeSheet();
    });
  });
  /** A tap on a status chip (`at`: the row to start on; "digits": its list, one level down), or a user key that holds
   *  Mode: the Mode sheet. Without `at` it starts on Angle, so Mode, ▶, Enter always switches the angle unit. */
  function openMode(at?: string): void {
    onModeSheet((m) => {
      picked = null;
      shell.showMenu(t("mode.title"), m.modeItems(session, settingsEnv), { remember: false, at });
      if (at === "digits") shell.sheet?.enter(); // R86: the digits chip opens the list itself, Mode under it
    });
  }
  /** Run `open` at once when the lists are loaded; else after the load, with every key meanwhile waiting in the queue
   *  (decisions.md R8), so none of them lands on the line before the sheet is there. */
  function onModeSheet(open: (m: ModeSheetCode) => void): void {
    if (loaders.modeSheet && sheetChunk.C) return open(loaders.modeSheet);
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

  /** A finger went down on the keypad: vibrate when switched on in Settings (one pulse per touch, R112). */
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
    get sheetLoad() { return sheetLoad; },
    set sheetLoad(v) { sheetLoad = v; },
    waiting: [],
    get casKeys() { return casKeys; },
    enter,
    insertResult,
    goTo,
    clearKey,
    openSettings,
    openMode,
    openTemplates,
    openShiftPalette,
    openFind,
    openNames,
    withClip,
    loadClip: () => void loadClip(),
    dead,
  };
  const press = (key: Key, layer?: Layer): void => route.press(ctx, key, layer);
  const typeLetter = (ch: string): void => route.typeLetter(ctx, ch);
  const cancel = (): Promise<void> => route.escape(ctx);

  /** A tap on the status line's strip, or on a row bar button, is not a place for typing: it must not take the caret out of the entry line. */
  const noFocus = (e: Event): void => e.preventDefault();

  const busy = $derived(session.busy || shell.busy);
</script>

<main class="app">
  <StatusLine {session} {shell} {busy} cas={casKeys} onpress={press} onmode={openMode} />

  <div class="screen">
    <div class="stage">
      {#if session.engineState !== "ready"}<p class="enginenote" role="status" data-testid="engine-note">{t(session.engineState === "failed" ? "engine.error" : "engine.starting")}</p>{/if}
      {#if shell.app === null}
        <History
          items={session.items}
          selected={picked}
          display={(item) => session.display(item, true)}
          input={(item) => session.input(item)}
          mark={(item) => session.mark(item)}
          onrecall={(item) => { picked = null; shell.prompt?.cancel(); entry.set(session.input(item), item.chips); }}
          oninsert={(item) => { picked = null; shell.prompt?.cancel(); insertResult(item); }}
          oncancel={() => void cancel()}
          onlongpress={(item) => withClip((c) => c.openRowMenu(item))}
          undo={session.undoCopy?.view === session.view ? session.undoCopy.kind : null}
          onundo={() => { picked = null; session.undoRemoved(); }}
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
      {@const why = clip.rowWhy(row)}
      {#if why}<div class="rowwhy" data-testid="row-why">{why}</div>{/if}
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
      cas={casKeys} app={shell.app !== null}
      sheet={shell.sheet ? { filter: shell.sheet.level.filterable } : undefined}
      onpress={press}
      oncount={() => session.taps.press()}
      ontouch={touched}
    />
    <!-- a pick sheet rises over the maths rows (3–9), anchored at the keypad's bottom edge; the top cluster stays
         uncovered and live, and no key moves (decisions.md "R21") -->
    {#if shell.sheet && !shell.sheet.letters}
      <div class="layer" style:top="{mathsTop}px">{@render sheetView(shell.sheet, "keypad")}</div>
    {/if}
  </div>
</main>


{#snippet sheetView(sheet: NonNullable<typeof shell.sheet>, over: "keypad" | "view")}
  {#if sheetChunk.C}
  <sheetChunk.C
    {sheet}
    {over}
    testid={shell.switcherOpen ? "apps" : sheet.id === "find" ? "find" : "menu"}
    below={entryHeight}
    {keyBox}
    ontap={(i) => shell.picked(sheet.activate(i))}
    onoption={(i, o) => shell.picked(sheet.pickOption(i, o))}
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
  /* the engine's start and failure notes, in the stage (R82f2: not in the status line) */
  .enginenote {
    position: absolute;
    top: 8px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 1;
    margin: 0;
    padding: 6px 14px;
    border-radius: 16px;
    background: var(--panel);
    border: 1px solid var(--line);
    color: var(--muted);
    font-size: 14px;
    white-space: nowrap;
    pointer-events: none;
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
  .rowwhy {
    padding: 2px 12px 0;
    font-size: 14px;
    color: var(--muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
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
