<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<script lang="ts">
  import { legend } from "../i18n/index.ts";
  import { t } from "../i18n/index.ts";
  import { FlickTracker, PAD_KEYS, REPEAT_KEYS, Repeat, Stepper, type Flick, type PadDir } from "./gestures.ts";
  import { fitLegends } from "./fit.ts";
  import { actionFor, gridPlace, keyboard, labelFor, type Key, type Layer } from "./keyboard.ts";
  import { sheetChunk } from "../views/sheetView.svelte.ts";
  import { unitPad } from "../units/padView.svelte.ts";
  import type { UserKeys } from "./userKeys.svelte.ts";

  let {
    userKeys,
    shift,
    alpha,
    alphaLock = false,
    capsLock = false,
    shiftLock = false,
    cas = false,
    sheet,
    onpress,
    ontouch = () => {},
  }: {
    /** The free keys' slots (U1–U6, R15b, R15c): drawn and fired with the user's actions over the defaults. */
    userKeys: UserKeys;
    shift: boolean;
    alpha: boolean;
    alphaLock?: boolean;
    /** The alpha lock is the lower-case one. */
    capsLock?: boolean;
    shiftLock?: boolean;
    /** The CAS view is under the keys: the letter layer's case is swapped (R58). */
    cas?: boolean;
    /** A sheet is open (docs/05 3.1): keys are read by sheetKeys.ts, and the ones that do nothing there look dead.
     *  `filter`: the open list takes letters. */
    sheet?: { filter: boolean } | undefined;
    /** A key fires; `layer` overrides the Shift/Alpha state: "primary" for a trackpad step, "shift" for a flick up,
     *  "alpha" for a flick down (on Shift and Alpha themselves: the lock flicks). */
    onpress: (key: Key, layer?: Layer) => void;
    /** A finger went down, a gesture made a step, or a flick became armed: the haptic tick. */
    ontouch?: () => void;
  } = $props();

  // The face shows what a tap gives (the active layer). The legends show what the flicks give (P7 point 2): the shift
  // function at the top left (flick up), the letter at the bottom left (flick down). A legend the face already shows
  // is left out; the Shift layer's legend stays under the alpha lock, where a flick up still gives it (`=` in a name).
  /** The keys as drawn and fired: the free keys with the user's slots. */
  const keys = $derived(keyboard.keys.map((k) => userKeys.resolve(k)));
  /** The unit pad is up (R24b): a key that is one of its cells shows the cell, in the same face and legends. */
  const cell = (k: Key) => (sheet ? undefined : unitPad.model?.legends(k.id, shift, alpha));
  const face = (k: Key): string =>
    cell(k)?.face ?? legend(labelFor(k, shift, alpha, cas) || k.label.primary || "");
  const hint = (k: Key): string => cell(k)?.up ?? ((shift && !alpha) || !k.label.shift ? "" : legend(k.label.shift));
  const alphaHint = (k: Key): string => cell(k)?.down ?? (alpha || !k.label.alpha ? "" : k.label.alpha);
  /** Rows with a letter on some key reserve the letter line on every key, so the faces of a row stay level. The upper
   *  cluster has no letters, and no line for them (vertical space, docs/03 rule 9). */
  const letterRows = new Set(keyboard.keys.filter((k) => k.label.alpha).map((k) => k.row));
  const locked = (k: Key): boolean => (k.id === "alpha" && alphaLock) || (k.id === "shift" && shiftLock);
  const pressed = (k: Key): boolean =>
    (k.actions.primary?.kind === "special" && k.actions.primary.name === "shift" && shift) ||
    (k.actions.primary?.kind === "special" && k.actions.primary.name === "alpha" && alpha);

  /** A key that does nothing in the current layer (a key we don't have yet, or a layer it has no function in). */
  const dead = (k: Key): boolean => {
    const c = cell(k);
    if (c) return c.dead;
    if (sheet) return sheetChunk.keys?.sheetKey(k, sheet.filter).kind === "none"; // (not drawn dead before the sheet's code is in)
    const p = k.actions.primary;
    if (p?.kind === "special" && (p.name === "shift" || p.name === "alpha")) return false; // the modifiers work in every layer
    const a = actionFor(k, shift, alpha, false, cas);
    return !a || (a.kind === "special" && a.name === "none");
  };

  // Every face and legend is shrunk until it fits its key: never cut, never overlapping (U0, docs/05 3.7).
  let padEl: HTMLDivElement | undefined = $state();
  $effect(() => {
    // re-fit when the layer changes (the faces change with it) and when the pad's width does
    void shift;
    void alpha;
    void cas;
    void unitPad.model;
    if (!padEl) return;
    const pad = padEl;
    fitLegends(pad);
    if (typeof ResizeObserver === "undefined") return;
    let width = pad.clientWidth;
    const ro = new ResizeObserver(() => {
      if (pad.clientWidth !== width) {
        width = pad.clientWidth;
        fitLegends(pad);
      }
    });
    ro.observe(pad);
    return () => ro.disconnect();
  });

  // ---- gestures (docs/decisions.md P7). One pointer handler on the whole pad, one gesture per finger.
  // The trackpad (K1): the four arrow keys are its tap zones; a drag steps in 2D (gestures.ts), a tap is one step. The
  // hub at its centre (R15c) is the surface too: a drag from it steps, a tap on it is no zone and does nothing.
  const isPadKey = (k: Key): boolean => (PAD_KEYS as readonly string[]).includes(k.id);
  const padArea = ((): { rows: string; cols: string } | undefined => {
    const keys = keyboard.keys.filter(isPadKey);
    if (keys.length === 0) return undefined;
    const rows = keys.map((k) => k.row);
    const starts = keys.map((k) => gridPlace(keyboard, k).start);
    const ends = keys.map((k) => gridPlace(keyboard, k).start + gridPlace(keyboard, k).span);
    return { rows: `${Math.min(...rows) + 1} / ${Math.max(...rows) + 2}`, cols: `${Math.min(...starts)} / ${Math.max(...ends)}` };
  })();

  // Any other key fires when the finger lifts: a tap is the key in the current layer, a flick up or down its shift or
  // letter layer (FlickTracker: distance only, no hold time), a flick slid back to the middle nothing. A sideways slip
  // or a long hold is still a tap. ⌫ fires on touch and repeats while held instead; the trackpad has no flicks.
  type Gesture =
    | { kind: "pad"; key: Key | undefined; x0: number; y0: number; steps: Stepper }
    | { kind: "key"; key: Key | undefined; el: HTMLElement | undefined; x0: number; y0: number; flick: FlickTracker }
    | { kind: "repeat"; repeat: Repeat };

  /** The bubble above a key while a flick is armed (P7 point 2): what the lift will fire, or ✕ for nothing. */
  let bubble = $state<{ x: number; y: number; dir: Flick; text: string; none: boolean } | null>(null);
  let bubbleOwner: number | undefined;

  /** What a flick on this key fires, as the bubble shows it (empty text: nothing). Mirrors App.svelte's press(). */
  function flickText(k: Key, dir: Flick): string {
    const p = k.actions.primary;
    if (p?.kind === "special" && p.name === "shift") {
      if (dir === "down") return "";
      return shiftLock ? t("flick.unlock") : t("flick.shiftLock");
    }
    if (p?.kind === "special" && p.name === "alpha") {
      const lower = dir === "up";
      // the lock state is the same in both views (down: no shift); the CAS view types lower case there (R58)
      const named = lower !== cas;
      return alphaLock && capsLock === lower ? t("flick.unlock") : t(named ? "flick.lowerLock" : "flick.capsLock");
    }
    if (sheet) return dir === "down" && sheet.filter ? (sheetChunk.keys?.letterOf(k) ?? "") : "";
    const c = unitPad.model?.legends(k.id, false, false);
    if (c) return dir === "up" ? c.up : c.down;
    const [sh, al] = dir === "up" ? [true, false] : [false, true];
    const a = actionFor(k, sh, al, false, cas);
    if (!a || (a.kind === "special" && a.name === "none")) return "";
    return legend(labelFor(k, sh, al, cas));
  }

  function showBubble(id: number, g: Extract<Gesture, { kind: "key" }>): void {
    const st = g.flick.state;
    if (!g.key || !g.el || (st !== "up" && st !== "down")) {
      if (bubbleOwner === id) bubble = null;
      return;
    }
    const text = flickText(g.key, st);
    bubbleOwner = id;
    bubble = { x: g.el.offsetLeft + g.el.offsetWidth / 2, y: g.el.offsetTop, dir: st, text: text || "✕", none: text === "" };
  }
  const gestures = new Map<number, Gesture>();
  /** The app goes away (home, app switcher, a lost pointerup): every gesture ends and nothing fires. */
  function cancelAll(): void {
    for (const g of gestures.values()) cancel(g);
    gestures.clear();
    hideBubble();
  }
  $effect(() => {
    const onHide = (): void => {
      if (document.hidden) cancelAll();
    };
    const onBlur = (): void => {
      if (matchMedia("(pointer: coarse)").matches) cancelAll();
    };
    document.addEventListener("visibilitychange", onHide);
    addEventListener("pagehide", cancelAll);
    addEventListener("blur", onBlur);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      removeEventListener("pagehide", cancelAll);
      removeEventListener("blur", onBlur);
      cancelAll();
    };
  });

  function targetOf(ev: PointerEvent): Key | "pad" | undefined {
    const el = ev.target instanceof Element ? ev.target.closest<HTMLElement>("[data-key],[data-trackpad]") : null;
    if (!el) return undefined;
    if (el.dataset["trackpad"] !== undefined) return "pad";
    const k = keyboard.byId.get(el.dataset["key"] ?? "");
    return k && userKeys.resolve(k);
  }

  function down(ev: PointerEvent): void {
    // the keys never take focus, so the caret stays in the entry line
    ev.preventDefault();
    if (ev.pointerType === "mouse" && ev.button !== 0) return;
    // a second finger finishes the first one's gesture, so fast two-thumb typing keeps its order
    for (const g of gestures.values()) finish(g);
    gestures.clear();
    const target = targetOf(ev);
    if (target) ontouch();
    // a mouse has no implicit capture (a touch has): without it the release outside the pad is never seen
    try {
      padEl?.setPointerCapture(ev.pointerId);
    } catch {
      // a synthetic event without an active pointer: the gesture still works while the finger stays on the pad
    }

    if (target && target !== "pad" && REPEAT_KEYS.includes(target.id)) {
      onpress(target);
      // the repeats keep the layer of the first press (Shift ⌫ = Del), which used up a one-shot Shift
      const layer: Layer = alpha ? "alpha" : shift ? "shift" : "primary";
      gestures.set(ev.pointerId, { kind: "repeat", repeat: new Repeat(() => onpress(target, layer)) });
      return;
    }
    const [x0, y0] = [ev.clientX, ev.clientY];
    if (target === "pad" || (target && isPadKey(target)))
      gestures.set(ev.pointerId, { kind: "pad", key: target === "pad" ? undefined : target, x0, y0, steps: new Stepper() });
    else {
      const el = target && padEl ? (padEl.querySelector<HTMLElement>(`[data-key="${target.id}"]`) ?? undefined) : undefined;
      gestures.set(ev.pointerId, { kind: "key", key: target, el, x0, y0, flick: new FlickTracker() });
    }
  }

  function move(ev: PointerEvent): void {
    const g = gestures.get(ev.pointerId);
    if (!g) return;
    if (g.kind === "pad") {
      for (const dir of g.steps.move(ev.clientX - g.x0, ev.clientY - g.y0)) step(dir);
    } else if (g.kind === "key" && g.key) {
      const before = g.flick.state;
      if (g.flick.move(ev.clientX - g.x0, ev.clientY - g.y0)) ontouch(); // the tick at the threshold
      if (g.flick.state !== before) showBubble(ev.pointerId, g);
    }
  }

  function step(dir: PadDir): void {
    const key = keyboard.byId.get(dir);
    if (!key) return;
    ontouch();
    onpress(key, "primary");
  }

  function up(ev: PointerEvent): void {
    const g = gestures.get(ev.pointerId);
    if (!g) return;
    move(ev);
    gestures.delete(ev.pointerId);
    finish(g);
  }

  function hideBubble(): void {
    bubble = null;
    bubbleOwner = undefined;
  }

  /**
   * The finger lifts (or another one comes down): a trackpad touch without a step was a tap on its zone, a key
   * touch is the key, ⌫ stops repeating.
   */
  function finish(g: Gesture): void {
    if (g.kind === "pad") {
      if (g.steps.count === 0 && g.key) onpress(g.key);
    } else if (g.kind === "key") {
      hideBubble();
      const st = g.flick.state;
      if (!g.key || st === "cancelled") return;
      if (st === "tap") onpress(g.key);
      else onpress(g.key, st === "up" ? "shift" : "alpha");
    } else g.repeat.stop();
  }

  /** The browser took the touch (a scroll, a system gesture): nothing fires. */
  function cancel(g: Gesture): void {
    if (g.kind === "repeat") g.repeat.stop();
    if (g.kind === "key") hideBubble();
  }

  function cancelled(ev: PointerEvent): void {
    const g = gestures.get(ev.pointerId);
    if (!g) return;
    gestures.delete(ev.pointerId);
    cancel(g);
  }
</script>

<div
  class="pad"
  class:shifted={shift}
  class:alphaed={alpha}
  style:grid-template-columns={`repeat(${keyboard.units}, 1fr)`}
  bind:this={padEl}
  onpointerdown={down}
  onpointermove={move}
  onpointerup={up}
  onpointercancel={cancelled}
  onlostpointercapture={cancelled}
  onclick={(ev) => ev.preventDefault()}
  role="presentation"
>
  {#if padArea}<div class="trackpad" data-trackpad style:grid-row={padArea.rows} style:grid-column={padArea.cols}></div>{/if}
  {#each keys as key (key.id)}
    <button
      type="button"
      class={`key ${key.cls}`}
      data-key={key.id}
      tabindex="-1"
      aria-pressed={key.cls === "ctl" && (key.id === "shift" || key.id === "alpha") ? pressed(key) : undefined}
      data-locked={locked(key) ? "true" : undefined}
      style:grid-row={key.row + 1}
      style:grid-column={`${gridPlace(keyboard, key).start} / span ${gridPlace(keyboard, key).span}`}
      data-dead={dead(key) ? "true" : undefined}
      data-zone={isPadKey(key) ? "true" : undefined}
      data-letters={letterRows.has(key.row) ? "true" : undefined}
      data-user={cell(key)?.user ?? (key.user ? (userKeys.isEmpty(key) ? "empty" : "set") : undefined)}
      data-pad={cell(key)?.kind}
    >
      <span class="shiftlegend" data-fit="legend">{hint(key)}</span>
      <span class="main" data-fit="face">{face(key)}</span>
      {#if letterRows.has(key.row)}<span class="alphalegend" data-fit="legend">{alphaHint(key)}</span>{/if}
    </button>
  {/each}
  {#if padArea}<div class="hub" data-trackpad data-testid="pad-hub" style:grid-row={padArea.rows} style:grid-column={padArea.cols}></div>{/if}
  {#if bubble}
    <div
      class="bubble"
      data-testid="flick-bubble"
      data-dir={bubble.dir}
      data-none={bubble.none ? "true" : undefined}
      style:left={`${bubble.x}px`}
      style:top={`${bubble.y}px`}
      aria-hidden="true"
    >{bubble.text}</div>
  {/if}
</div>

<style>
  .pad {
    position: relative;
    display: grid;
    gap: 6px;
    padding: 8px;
    background: var(--panel);
    user-select: none;
    -webkit-user-select: none;
    /* no scrolling or zooming from the pad: every touch is a key, a flick or a trackpad drag */
    touch-action: none;
    -webkit-touch-callout: none;
  }
  /* Each key has a legend line above the face (the shift function, top left) and one below it (the letter, bottom
     left), never overlapping it (P7 point 2); fit.ts shrinks what is too wide. */
  .key {
    position: relative;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: var(--legend-h) 1fr;
    min-height: 48px;
    min-width: 0;
    padding: 0 var(--key-pad) 2px;
    border: 0;
    border-radius: 8px;
    color: var(--text);
    font: inherit;
    font-size: 20px;
    background: var(--key-num);
    -webkit-tap-highlight-color: transparent;
  }
  .key[data-letters="true"] {
    grid-template-rows: var(--legend-h) 1fr var(--legend-h);
  }
  .shiftlegend,
  .alphalegend {
    justify-self: start;
    height: var(--legend-h);
    line-height: var(--legend-h);
    font-size: 11px;
    white-space: nowrap;
  }
  .main {
    align-self: center;
    justify-self: center;
    white-space: nowrap;
    line-height: 1.1;
  }
  .key:active {
    filter: brightness(1.4);
  }
  .key.op {
    background: var(--key-op);
  }
  .key.fn {
    background: var(--key-fn);
    font-size: 17px;
  }
  .key.ctl {
    background: var(--key-ctl);
    font-size: 16px;
  }
  .key.nav {
    min-height: 36px;
    background: var(--key-nav);
    font-size: 15px;
  }
  /* a free key (U1–U6, R15b, R15c): an empty one is an outlined slot, a set one has a thin edge (the user's own key) */
  .key[data-user="empty"] {
    background: transparent;
    box-shadow: inset 0 0 0 1px var(--line);
  }
  .key[data-user="set"] {
    box-shadow: inset 0 0 0 1px var(--muted);
  }
  /* the unit pad's prefix cells (R24b): their own colour, so the prefix m and the metre m never look alike */
  .key[data-pad="prefix"] {
    background: var(--key-pfx);
  }
  .key[data-pad="user"][data-user="empty"] .main {
    opacity: 0.5;
  }
  /* the trackpad in the upper cluster: as low as the keys beside it */
  .key[data-zone="true"] {
    min-height: 36px;
  }
  /* R82: a short screen (bars, a larger font scale) lowers the rows (514 → 460 px), so the header, the keypad and the Plot
     readout still fit the column without a scroll; a taller screen keeps the full rows */
  @media (max-height: 700px) {
    .key {
      --legend-h: 10px;
      min-height: 42px;
    }
    .key[data-letters="true"] .main {
      line-height: 1; /* a letter row holds two legend lines: 10 + 20 + 10 + 2 = 42 px */
    }
    .key.nav,
    .key[data-zone="true"] {
      min-height: 32px;
    }
  }
  /* the trackpad (K1): one surface under the four arrow keys, which stay as its tap zones; drawn round, the G2's shape
     (R15c, R3), with a dashed hub ring at its centre where a drag may start (a tap there does nothing) */
  .trackpad {
    border-radius: 50%;
    background: var(--key-ctl);
  }
  .hub {
    position: relative;
    z-index: 2;
    place-self: center;
    width: 28%;
    height: 30%;
    box-sizing: border-box;
    border: 1.5px dashed var(--muted);
    border-radius: 50%;
  }
  .key[data-zone="true"] {
    background: transparent;
    opacity: 0.7;
  }
  .key[data-zone="true"]:active {
    filter: none;
    opacity: 1;
  }
  /* a key that does nothing in this layer (and only in this layer) is dimmed, still readable */
  .key[data-dead="true"] .main {
    color: var(--text-dead);
  }
  .key.enter {
    background: var(--key-enter);
    color: var(--on-enter);
    font-size: 16px;
  }
  .shiftlegend {
    color: var(--shift);
  }
  .alphalegend {
    color: var(--alpha);
  }
  .shifted .main {
    color: var(--shift);
  }
  .alphaed .main {
    color: var(--alpha);
  }
  /* Enter keeps one colour in every layer: the coloured text would not read on its green */
  .key.enter .main,
  .key.enter .shiftlegend,
  .key.enter .alphalegend {
    color: var(--on-enter);
  }
  .shifted .key[data-dead="true"] .main,
  .alphaed .key[data-dead="true"] .main {
    color: var(--text-dead);
  }
  .key[aria-pressed="true"] {
    outline: 2px solid var(--key-on);
  }
  .alphaed .key[data-key="alpha"][aria-pressed="true"] {
    outline-color: var(--alpha);
  }
  .key[data-locked="true"] {
    outline-width: 3px;
    background: color-mix(in srgb, var(--alpha) 25%, transparent);
  }
  .key[data-key="shift"][data-locked="true"] {
    outline-color: var(--shift);
    background: color-mix(in srgb, var(--shift) 25%, transparent);
  }
  /* the flick bubble (P7 point 2): above the key, in the colour of the layer it fires; ✕ dimmed when nothing fires */
  .bubble {
    position: absolute;
    z-index: 5;
    transform: translate(-50%, calc(-100% - 6px));
    min-width: 44px;
    padding: 6px 10px;
    border-radius: 10px;
    background: var(--panel);
    border: 2px solid var(--shift);
    color: var(--shift);
    font-size: 22px;
    line-height: 1.1;
    text-align: center;
    white-space: nowrap;
    pointer-events: none;
  }
  .bubble[data-dir="down"] {
    border-color: var(--alpha);
    color: var(--alpha);
  }
  .bubble[data-none="true"] {
    border-color: var(--text-dead);
    color: var(--text-dead);
  }
</style>
