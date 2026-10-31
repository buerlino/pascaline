<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<script lang="ts">
  import { onMount } from "svelte";
  import { ICONS } from "./views/icons.ts";
  import { APPS, placeGlyph } from "./apps/registry.ts";
  import type { AppShell, PaletteId } from "./apps/shell.svelte.ts";
  import type { SubMenu } from "./apps/types.ts";
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
  import { counted, countScreenTaps } from "./state/pressCount.ts";
  import { updateOffer } from "./state/updateOffer.svelte.ts";
  import History from "./views/History.svelte";
  // The Mode and Settings lists load when idle after the keypad is drawn, or on the first open (R35: not in the start chunk).
  let modeSheet: typeof import("./views/modeSheet.ts") | null = null;
  const loadModeSheet = async (): Promise<typeof import("./views/modeSheet.ts")> => (modeSheet ??= await import("./views/modeSheet.ts"));
  /** Set while the first Mode or Settings open waits for that code. */
  let sheetLoad: Promise<void> | null = null;
  // The sheet's view (Sheet.svelte with sheetFit.ts) is its own chunk, fetched when idle after the keypad is drawn (R46);
  // the model and the keys stay here. A key that opens a sheet before it is in waits in the queue.
  import { loadSheetView, sheetChunk } from "./views/sheetView.svelte.ts";

  // Find (R4a) is its own chunk with the index beside it: both load when the browser is idle after the engine is ready
  // (docs/04 3.3), or on the first Math press.
  type FindCode = { m: typeof import("./find/finder.ts"); index: import("./find/finder.ts").FindIndex };
  let findCode: FindCode | null = null;
  let findLoading: Promise<FindCode> | null = null;
  /** `urgent` (a Math press): an idle load under way prepares the rest of the index at once (finder.ts). */
  const loadFind = (urgent = false): Promise<FindCode> =>
    (findLoading ??= import("./find/finder.ts")
      .then(async (m) => {
        m.pauseWhile(() => busy); // the idle preparing gives way to a running job
        return (findCode = { m, index: await m.loadIndex(urgent) });
      })
      .catch((e: unknown) => {
        findLoading = null; // a later Math press tries again
        throw e;
      }));

  let { session, entry, shell, userKeys }: { session: Session; entry: EntryController; shell: AppShell; userKeys: UserKeys } = $props();

  /** A status-line control as a key (R15b, R15c1): its tap takes the same path as a key press (an open sheet gives way, it runs at once while an app loads, and waits while a sheet's code loads). */
  const statusKey = (id: string, name: "apps" | "symb" | "plot" | "num" | "menu"): Key => ({ id, row: 0, col: 0, span: 1, cls: "nav", label: { primary: "" }, actions: { primary: { kind: "special", name } } });
  const PLACE_KEY = statusKey("place", "apps"), MENU_KEY = statusKey("menu-status", "menu");
  const TABS = (["symb", "plot", "num"] as const).map((v) => ({ view: v, name: t(`view.${v}`), key: statusKey(`tab-${v}`, v) }));

  const sheetOpen = $derived(shell.sheet !== null);
  $effect(() => void (userKeys.decimalComma = entry.decimalComma = session.decimalComma)); // R57: the `.` and `,` keys' faces (keypad, tap, hardware key)

  // The shell paints first; main.ts then loads MathLive, which puts the field into this element.
  onMount(() => {
    if (host) entry.setHost(host);
    const count = (): void => session.taps.press(); // R70: a hardware key and a tap on the screen are presses too (docs/04 5.2)
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
    shell.settingsMenu = () => (modeSheet ? (settingsMenu ??= modeSheet.settingsMenu(session, settingsEnv)) : undefined); // (R49)
    shell.homeView = () => (session.view === "cas" ? "cas" : "home"); // the last row of every Menu
    entry.onDead = dead;
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
  /** Run now when loaded, else as soon as the code has arrived (a key pressed before the idle load), with the keys
   *  meanwhile in the queue (decisions.md R8). The Mode code comes too: every Menu's last row is Settings, its submenu (R49). */
  function withClip(run: (c: ClipActions) => void | Promise<void>): void {
    if (clip && modeSheet) return void run(clip);
    const load = Promise.all([loadClip(), loadModeSheet().catch(() => null)]).then(([c]) => run(c));
    if (sheetLoad === null) sheetLoad = load.catch(() => {}).finally(() => (sheetLoad = null));
  }
  $effect(() => {
    // (a browser without requestIdleCallback loads it on the first use)
    if (session.engineState === "ready" && "requestIdleCallback" in window) requestIdleCallback(() => void loadClip(), { timeout: 3000 });
  });
  $effect(() => {
    if (session.engineState !== "ready" || !("requestIdleCallback" in window) || findLoading) return;
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
    if (findCode && sheetChunk.C) return showFind(findCode, slot);
    if (findLoading) void import("./find/finder.ts").then((m) => m.loadIndex(true)).catch(() => {}); // hurry the idle load
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
  const settingsEnv = { get userKeys() { return userKeys; }, chooseFor: (id: string, layer: Layer): void => openFind({ id, layer }), saveBackup: (): void => void loadClip().then((c) => c.saveBackup()).catch(() => import("./state/backup.ts").then((m) => m.saveBackup())).catch(() => {}) }; // saveBackup: R38a (loads the clipboard code if the sheet opened before it came: the backup is for a broken app; if that chunk fails, the file is still written, without the notice)
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

  const busy = $derived(session.busy || shell.busy);
  const appName = $derived(shell.app ? t(APPS.find((a) => a.id === shell.app)?.name as MessageKey) : "");
  /** Where you are (docs/05 3.2): Home, CAS, or an app and its view. */
  const place = $derived(shell.app === null ? t(`view.${session.view}`) : appName);
  const angle = $derived(session.settings.angle);
  const glyph = $derived(placeGlyph(shell.app ?? session.view));
  /** The tile's ring: a job running, or the engine starting (R82f2: the ⟳ went). */
  const ring = $derived(busy || session.engineState === "starting");
  /** The ⇧ α slot: one sign, underlined when locked; Alpha with Shift types lower case, shown as `a`. */
  const mod = $derived(
    session.alpha
      ? { alpha: true, lock: session.alphaLock, text: session.shift ? "a" : "α" }
      : session.shift
        ? { alpha: false, lock: session.shiftLock, text: "⇧" }
        : null,
  );
  /** The status line is not a place for typing: a tap on it must not take the caret out of the entry line. */
  const noFocus = (e: Event): void => e.preventDefault();
</script>

<main class="app">
  <!-- the status line (docs/05 3.2, R82f2): the place's glyph tile (the apps list), the views as icons, the fixed ⇧ α
       slot, the mode chips, ☰. At most 28 px (docs/03 rule 9). Nothing in it changes width with Shift, Alpha or the
       engine's state, so a press never moves a view from under the finger; the engine's notes show in the stage. -->
  <!-- svelte-ignore a11y_no_static_element_interactions (only keeps the caret in the entry line; the buttons inside are the controls) -->
  <header data-testid="status" data-engine={session.engineState} data-busy={busy} onpointerdown={noFocus}>
    <button
      type="button"
      class="place"
      data-testid="place"
      data-app={shell.app ?? ""}
      data-view={shell.app === null ? session.view : shell.view}
      aria-label={t("status.place", { place })}
      onclick={() => press(PLACE_KEY, "primary")}>
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
            onclick={() => press(tab.key, "primary")}>
            {@html ICONS[tab.view]}
          </button>
        {/each}
      </span>
    {/if}
    {#if updateOffer.restart}
      <button type="button" class="update" data-testid="update-note" title={t("update.ready")}
        onclick={updateOffer.restart}>{t("update.restart")}</button>
    {/if}
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
        <button type="button" class="chip" data-testid="chip-format" onclick={() => openMode("format")}>{session.settings.format.toUpperCase()}</button>
        <button type="button" class="chip" data-testid="chip-digits" onclick={() => openMode("digits")}>{session.settings.digits}</button>
      </span>
    </span>
    <button type="button" class="menubtn" data-testid="menu-button" aria-label={t("status.menu")} onclick={() => press(MENU_KEY, "primary")}>☰</button>
  </header>

  <div class="screen">
    <div class="stage">
      {#if session.engineState !== "ready"}<p class="enginenote" role="status" data-testid="engine-note">{t(session.engineState === "failed" ? "engine.error" : "engine.starting")}</p>{/if}
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
  header {
    display: flex;
    align-items: stretch;
    gap: 6px;
    box-sizing: border-box;
    height: 28px;
    padding: 0 8px;
    /* the line under it as an inset shadow, so the targets keep the full 28 px */
    box-shadow: inset 0 -1px 0 var(--line);
    font-size: 14px;
    line-height: 1;
  }
  header button {
    all: unset;
    box-sizing: border-box;
    cursor: pointer;
  }
  /* the icons come from ICONS through {@html}, outside the component's scope */
  header :global(svg) {
    display: block;
    width: 16px;
    height: 14px;
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
    gap: 2px;
    margin-left: -8px;
    padding: 0 4px 0 8px;
    white-space: nowrap;
    font-weight: 700;
    color: var(--text);
  }
  .place:active {
    background: var(--key-nav);
  }
  .tile {
    position: relative;
    flex: none;
    width: 30px;
    height: 22px;
    border-radius: 6px;
    background: var(--chip-bg);
    color: var(--text);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    font-weight: 400;
  }
  .tile.small {
    font-size: 13px;
  }
  /* busy or starting: a 2 px ring over the tile, its size unchanged */
  .tile[data-ring="true"]::after {
    content: "";
    position: absolute;
    inset: 0;
    border: 2px solid var(--alpha);
    border-radius: 6px;
    box-sizing: border-box;
  }
  .name {
    margin-left: 4px;
  }
  .caret {
    font-size: 12px;
    font-weight: 400;
    color: var(--muted);
  }
  /* the views as icons, one segmented control; the selected one filled */
  .seg {
    flex: none;
    align-self: center;
    display: flex;
    gap: 1px;
    padding: 1px;
    border: 1px solid var(--line);
    border-radius: 7px;
  }
  .tab {
    width: 30px;
    height: 20px;
    border-radius: 5px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 15px;
    color: var(--muted);
  }
  .tab[aria-selected="true"] {
    background: var(--chip-bg);
    color: var(--text);
  }
  /* the fixed ⇧ α slot: always 16 px, so Shift or Alpha moves nothing */
  .slot {
    flex: none;
    width: 16px;
    margin-left: auto;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .mod {
    color: var(--shift);
    font-weight: 700;
    line-height: 16px;
  }
  .mod[data-testid="mod-alpha"] {
    color: var(--alpha);
  }
  .mod[data-lock="true"] {
    box-shadow: inset 0 -2px 0 currentColor;
  }
  .update {
    flex: none;
    margin-left: auto;
    padding: 0 6px;
    display: flex;
    align-items: center;
    font-size: 12px;
    font-weight: 700;
    white-space: nowrap;
    color: var(--shift);
  }
  .update:active {
    background: var(--key-nav);
  }
  .update + .slot {
    margin-left: 0;
  }
  .menubtn {
    flex: none;
    width: 36px;
    margin-right: -8px;
    display: flex;
    align-items: center;
    justify-content: center;
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
