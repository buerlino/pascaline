<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<script lang="ts">
  import { legend } from "../i18n/index.ts";
  import { t } from "../i18n/index.ts";
  import { FlickTracker, PAD_KEYS, REPEAT_KEYS, Repeat, Stepper, type Flick, type PadDir } from "./gestures.ts";
  import { fitLegends } from "./fit.ts";
  import { keyNames, loadKeyNames } from "./keyNamesLoader.svelte.ts";
  import { actionFor, gridPlace, keyboard, labelFor, type Key, type Layer } from "./keyboard.ts";
  import { opensSheet } from "./opens.ts";
  import { typesVariable, varLayers } from "./variable.ts";
  import { touchKey, touchPresses } from "../state/pressCount.ts";
  import { sheetChunk } from "../views/sheetView.svelte.ts";
  import type { UserKeys } from "./userKeys.svelte.ts";

  let {
    userKeys,
    shift,
    alpha,
    alphaLock = false,
    capsLock = false,
    shiftLock = false,
    cas = false,
    app = false,
    sheet,
    onpress,
    oncount = () => {},
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
    /** An app is under the keys (R71): ±, which only the unit view's line reads, is dimmed. */
    app?: boolean;
    /** A sheet is open (docs/05 3.1): keys are read by sheetKeys.ts, and the ones that do nothing there look dead.
     *  `filter`: the open list takes letters. */
    sheet?: { filter: boolean } | undefined;
    /** A key fires; `layer` overrides the Shift/Alpha state: "primary" for a trackpad step, "shift" for a flick up,
     *  "alpha" for a flick down (on Shift and Alpha themselves: the lock flicks). A press that closes an open sheet
     *  (R144) is the gesture's last: a drag steps nothing more and a held ⌫ does not repeat until the finger lifts. */
    onpress: (key: Key, layer?: Layer) => void;
    /** One press was made, as docs/04 5.2 counts them (R70): a tap, a flick, a drag, a held ⌫ once. `key`: which one,
     *  "<key id>:<layer>" (R127, state/pressCount.ts). */
    oncount?: (key?: string) => void;
    /** A finger went down on the pad: the key vibration, one pulse per touch (R112). A drag step or an armed flick makes none. */
    ontouch?: () => void;
  } = $props();

  // The face shows what a tap gives (the active layer). The legends show what the flicks give (P7 point 2): the shift
  // function at the top left (flick up), the letter at the bottom left (flick down). A legend the face already shows
  // is left out; the Shift layer's legend stays under the alpha lock, where a flick up still gives it (`=` in a name).
  /** The keys as drawn and fired: the free keys with the user's slots. */
  /** The unit pad is up (R24b): a key that is one of its cells is the cell, in the same face and legends. */
  const keys = $derived(keyboard.keys.map((k) => sheetChunk.pad?.key(k, sheet) ?? userKeys.resolve(k)));
  const face = (k: Key): string =>
    legend(labelFor(k, shift, alpha, cas) || k.label.primary || "");
  const hint = (k: Key): string => (shift && !alpha) || !k.label.shift ? "" : legend(k.label.shift);
  const alphaHint = (k: Key): string => (alpha || !k.label.alpha ? "" : k.label.alpha);
  // R143: a legend whose layer opens a sheet carries the mark ▾ (CSS, on data-opens); the letter line never does
  // R142: a legend is italic, in every mode, exactly when its action types one letter (a variable, ISO 80000-2; variable.ts):
  // the key says which layers type one (data-v), the CSS picks the face or legend that shows that layer
  /** Rows with a letter on some key reserve the letter line on every key, so the faces of a row stay level. The upper
   *  cluster has no letters, and no line for them (vertical space, docs/03 rule 9). */
  const letterRows = new Set(keyboard.keys.filter((k) => k.label.alpha).map((k) => k.row));
  const locked = (k: Key): boolean => (k.id === "alpha" && alphaLock) || (k.id === "shift" && shiftLock);

  /** What a tap on the key does in the current layer. */
  const act = (k: Key) => actionFor(k, shift, alpha, false, cas);
  /** A key that does nothing in the current layer (a key we don't have yet, or a layer it has no function in). */
  const dead = (k: Key): boolean => {
    if (sheet) return sheetChunk.keys?.sheetKey(k, sheet.filter).kind === "none"; // (not drawn dead before the sheet's code is in)
    const p = k.actions.primary;
    if (p?.kind === "special" && (p.name === "shift" || p.name === "alpha")) return false; // the modifiers work in every layer
    const a = act(k);
    return !a || (a.kind === "special" && a.name === "none") || (app && a.kind === "insert" && a.units === true);
  };

  let padEl: HTMLDivElement | undefined = $state();
  // R41: the names a screen reader says, from their own chunk after the first paint (a button is named by its face till then)
  $effect(loadKeyNames);
  $effect(() => {
    const m = keyNames();
    if (m && padEl) m.labelKeys(padEl, keys, shift, alpha, cas);
  });

  // Every face and legend is shrunk until it fits its key: never cut, never overlapping (U0, docs/05 3.7).
  $effect(() => {
    // re-fit when the layer changes (the faces change with it) and when the pad's width does
    void shift;
    void alpha;
    void cas;
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
  /** The round pad's cells; `span` is its width in columns, for the circle's diameter (R141). */
  const padArea = ((): { rows: string; cols: string; span: number } | undefined => {
    const keys = keyboard.keys.filter(isPadKey);
    if (keys.length === 0) return undefined;
    const rows = keys.map((k) => k.row);
    const places = keys.map((k) => gridPlace(keyboard, k));
    const starts = places.map((p) => p.start);
    const ends = places.map((p) => p.start + p.span);
    const [from, to] = [Math.min(...starts), Math.max(...ends)];
    return { rows: `${Math.min(...rows) + 1} / ${Math.max(...rows) + 2}`, cols: `${from} / ${to}`, span: to - from };
  })();

  // Any other key fires when the finger lifts: a tap is the key in the current layer, a flick up or down its shift or
  // letter layer (FlickTracker: distance only, no hold time), a flick slid back to the middle nothing. A sideways slip
  // or a long hold is still a tap. ⌫ fires on touch and repeats while held instead; the trackpad has no flicks.
  type Gesture =
    | { kind: "pad"; key: Key | undefined; x0: number; y0: number; steps: Stepper; open: unknown }
    | { kind: "key"; key: Key | undefined; el: HTMLElement | undefined; x0: number; y0: number; flick: FlickTracker }
    | { kind: "repeat"; repeat: Repeat };

  /** The bubble above a key while a flick is armed (P7 point 2): what the lift will fire, or ✕ for nothing. */
  let bubble = $state<{ x: number; y: number; dir: Flick; text: string; none: boolean; variable: boolean } | null>(null);
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
    // (the bubble's letter follows the same flag as the legend it shows; ✕ is none)
    const variable = text !== "" && typesVariable(actionFor(g.key, st === "up", st === "down", false, cas));
    bubble = { x: g.el.offsetLeft + g.el.offsetWidth / 2, y: g.el.offsetTop, dir: st, text: text || "✕", none: text === "", variable };
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
    return keys.find((k) => k.id === el.dataset["key"]);
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
      // the repeats keep the layer of the first press (Shift ⌫ = Del), which used up a one-shot Shift
      oncount(`${target.id}:${alpha ? "alpha" : shift ? "shift" : "primary"}`);
      const open = sheet;
      onpress(target);
      if (open && !sheet) return; // (R144: the tap closed a sheet; nothing repeats)
      const layer: Layer = alpha ? "alpha" : shift ? "shift" : "primary";
      gestures.set(ev.pointerId, { kind: "repeat", repeat: new Repeat(() => onpress(target, layer)) });
      return;
    }
    const [x0, y0] = [ev.clientX, ev.clientY];
    if (target === "pad" || (target && isPadKey(target)))
      gestures.set(ev.pointerId, { kind: "pad", key: target === "pad" ? undefined : target, x0, y0, steps: new Stepper(), open: sheet });
    else {
      const el = target && padEl ? (padEl.querySelector<HTMLElement>(`[data-key="${target.id}"]`) ?? undefined) : undefined;
      gestures.set(ev.pointerId, { kind: "key", key: target, el, x0, y0, flick: new FlickTracker() });
    }
  }

  function move(ev: PointerEvent): void {
    const g = gestures.get(ev.pointerId);
    if (!g) return;
    if (g.kind === "pad") {
      // (R144: a drag that began over a sheet steps nothing more once a step has closed it)
      for (const dir of g.steps.move(ev.clientX - g.x0, ev.clientY - g.y0)) if (!g.open || sheet) step(dir);
    } else if (g.kind === "key" && g.key) {
      const before = g.flick.state;
      g.flick.move(ev.clientX - g.x0, ev.clientY - g.y0);
      if (g.flick.state !== before) showBubble(ev.pointerId, g);
    }
  }

  function step(dir: PadDir): void {
    const key = keyboard.byId.get(dir);
    if (!key) return;
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
    if (touchPresses(g) > 0) oncount(touchKey(g, { shift, alpha }));
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
  style:--pad-units={keyboard.units}
  style:--pad-span={padArea?.span ?? 0}
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
    <!-- the letter line: the row's, or a pad cell's own flick down (the cluster has none otherwise) -->
    {@const lettered = letterRows.has(key.row) || (key.pad && key.label.alpha)}
    {@const place = gridPlace(keyboard, key)}
    <button
      type="button"
      class={`key ${key.cls}`}
      data-key={key.id}
      tabindex="-1"
      aria-pressed={key.id === "shift" ? shift : key.id === "alpha" ? alpha : undefined}
      data-locked={locked(key) ? "true" : undefined}
      style:grid-row={key.row + 1}
      style:grid-column={`${place.start} / span ${place.span}`}
      data-dead={dead(key) ? "true" : undefined}
      data-zone={isPadKey(key) ? "true" : undefined}
      data-letters={lettered ? "true" : undefined}
      data-user={key.user ? (userKeys.isEmpty(key) ? "empty" : "set") : undefined}
      data-pad={key.pad}
      data-v={varLayers(key)}
    >
      <span class="shiftlegend" data-fit="legend" data-opens={(hint(key) && opensSheet(key.actions.shift)) || undefined}>{hint(key)}</span>
      <span class="main" data-fit="face" data-opens={opensSheet(act(key)) || undefined}>{face(key)}</span>
      {#if lettered}<span class="alphalegend" data-fit="legend">{alphaHint(key)}</span>{/if}
    </button>
  {/each}
  {#if padArea}<div class="hub" data-trackpad data-testid="pad-hub" style:grid-row={padArea.rows} style:grid-column={padArea.cols}></div>{/if}
  {#if bubble}
    <div
      class="bubble"
      data-testid="flick-bubble"
      data-dir={bubble.dir}
      data-none={bubble.none ? "true" : undefined}
      data-var={bubble.variable}
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
    gap: var(--sp-15);
    padding: var(--sp-2);
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
    min-height: var(--key-h);
    min-width: 0;
    padding: 0 var(--key-pad) var(--sp-05);
    border: 0;
    border-radius: var(--radius);
    color: var(--key-text);
    font: inherit;
    font-size: var(--fs-key);
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
    font-size: var(--fs-legend);
    white-space: nowrap;
  }
  .main {
    align-self: center;
    justify-self: center;
    white-space: nowrap;
    line-height: 1.1;
  }
  /* R142: a legend that types a variable is italic in every mode (ISO 80000-2; the Alpha letters, x, y, Greek letters a layer
     types), in the face the entry line draws a typed letter in (MathLive's math italic, from mathlive/static.css, loaded
     for the entry line) and a real italic serif behind it, never a synthesised slant. Functions, units, numbers and
     constants stay upright. No bold anywhere: the meaning is the position and the colour. */
  .bubble[data-var="true"],
  .key[data-v*="s"] .shiftlegend,
  .key[data-v*="a"] .alphalegend,
  .pad:not(.shifted, .alphaed) .key[data-v*="p"] .main,
  .shifted:not(.alphaed) .key[data-v*="s"] .main,
  .alphaed .key[data-v*="a"] .main {
    font-style: italic;
    font-family: KaTeX_Math, "STIX Two Text", "Times New Roman", "Times", serif;
    font-weight: 400;
  }
  /* R143 (owner, 2026-11-06): a legend whose layer opens a menu or grid instead of typing ends in ▾, the sign the status
     line's place name uses for "opens a list". In the legend's own colour (so Plain keys and every family keep it), the
     same everywhere. It hangs after the text out of the flow (absolute, at its static position, in the key's side padding),
     so the text keeps its place: fit.ts counts it, and a face is shifted left by half of it to stay centred as one unit. */
  .main[data-opens="true"] {
    translate: var(--mark-shift) 0;
  }
  [data-opens="true"]::after {
    content: "▾";
    position: absolute;
    margin-left: var(--mark-gap);
    font-size: var(--mark-size);
  }
  /* The press (R12c): the key's own text colour laid over it at once, no fade, a layer of its own so it shows over every
     background, Plain keys' and High contrast's too. It is the only motion in the app. */
  .key:active::after {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background: color-mix(in srgb, var(--key-text) 32%, transparent);
    pointer-events: none;
  }
  .key.enter:active::after {
    background: color-mix(in srgb, var(--on-enter) 28%, transparent);
  }
  .key.op {
    background: var(--key-op);
  }
  .key.fn {
    background: var(--key-fn);
    font-size: var(--fs-key-fn);
  }
  .key.ctl {
    background: var(--key-ctl);
    font-size: var(--fs-body);
  }
  .key.nav {
    min-height: var(--nav-h);
    background: var(--key-nav);
    font-size: var(--fs-ui);
  }
  /* a free key (U1–U6, R15b, R15c): an empty one is an outlined slot, a set one has a thin edge (the user's own key) */
  .key[data-user="empty"] {
    background: transparent;
    box-shadow: inset 0 0 0 var(--stroke-thin) var(--line);
  }
  .key[data-user="set"] {
    box-shadow: inset 0 0 0 var(--stroke-thin) var(--key-muted);
  }
  /* the unit pad's prefix cells (R24b): their own colour, so the prefix m and the metre m never look alike */
  .key[data-pad="prefix"] {
    background: var(--key-pfx);
  }
  /* High contrast leaves the key colours little room to differ: the prefix cells keep an outline there too */
  :global(:root[data-contrast="high"]) .key[data-pad="prefix"] {
    box-shadow: inset 0 0 0 var(--stroke-thin) var(--line);
  }
  .key[data-pad="user"] {
    box-shadow: inset 0 0 0 var(--stroke-thin) var(--key-muted);
  }
  /* a user cell with a flick down has the letter line in the cluster too: the face's track may shrink to what is left of
     the key's 36 px less its 2 px padding (a fixed track, the face overflows it evenly), so the keys below do not move (docs/03 rule 8) */
  .key[data-pad="user"][data-letters="true"] {
    grid-template-rows: var(--legend-h) calc(var(--nav-h) - var(--sp-05) - 2 * var(--legend-h)) var(--legend-h);
  }
  .key[data-pad="empty"] {
    background: transparent;
    box-shadow: inset 0 0 0 var(--stroke-thin) var(--line);
  }
  /* the trackpad in the upper cluster: as low as the keys beside it */
  .key[data-zone="true"] {
    min-height: var(--nav-h);
  }
  /* R82: a short screen (bars, a larger font scale) lowers the rows (514 → 460 px), so the header, the keypad and the Plot
     readout still fit the column without a scroll; a taller screen keeps the full rows */
  @media (max-height: 700px) {
    .key {
      --legend-h: var(--sp-25);
      min-height: var(--key-h-short);
    }
    .key[data-letters="true"] .main {
      line-height: 1; /* a letter row holds two legend lines: 10 + 20 + 10 + 2 = 42 px */
    }
    .key.nav,
    .key[data-zone="true"] {
      min-height: var(--nav-h-short);
    }
  }
  /* the trackpad (K1): one surface under the four arrow keys, which stay as its tap zones; drawn as a true circle (R15c, R3,
     R141) whose diameter is the smaller side of its grid area, centred in it. The area's width is two columns, worked out
     from the pad's own width (a container, so cqw is the pad's content box); its height is the rows'. The hub at the centre
     is the same-sized invisible drag surface: a drag may start there, a tap on it does nothing. */
  .pad {
    container-type: inline-size;
  }
  .trackpad {
    --area-w: calc(
      (100cqw - (var(--pad-units) - 1) * var(--sp-15)) / var(--pad-units) * var(--pad-span) + (var(--pad-span) - 1) * var(--sp-15)
    );
    place-self: center;
    height: min(100%, var(--area-w));
    aspect-ratio: 1;
    border-radius: 50%;
    background: var(--key-ctl);
  }
  .hub {
    position: relative;
    z-index: 2;
    place-self: center;
    width: 28%;
    height: 30%;
    border-radius: 50%;
  }
  .key[data-zone="true"] {
    background: transparent;
    opacity: 0.7;
  }
  /* a zone is a transparent rectangle over the round trackpad: no press layer (its corners would spill past the circle),
     the glyph going from 0.7 to full opacity is its press */
  .key[data-zone="true"]:active {
    opacity: 1;
  }
  .key[data-zone="true"]:active::after {
    content: none;
  }
  /* a key that does nothing in this layer (and only in this layer) is dimmed, still readable */
  .key[data-dead="true"] .main {
    color: var(--key-text-dead);
  }
  .key.enter {
    background: var(--key-enter);
    color: var(--on-enter);
    font-size: var(--fs-body);
  }
  .shiftlegend {
    color: var(--key-shift);
  }
  .alphalegend {
    color: var(--key-alpha);
  }
  .shifted .main {
    color: var(--key-shift);
  }
  .alphaed .main {
    color: var(--key-alpha);
  }
  /* Enter keeps one colour in every layer: the coloured text would not read on its green */
  .key.enter .main,
  .key.enter .shiftlegend,
  .key.enter .alphalegend {
    color: var(--on-enter);
  }
  .shifted .key[data-dead="true"] .main,
  .alphaed .key[data-dead="true"] .main {
    color: var(--key-text-dead);
  }
  /* Shift and Alpha wear the other keys' colour (R140); only the label carries the layer colour. Armed, the key fills
     with it (--on-shift / --on-alpha are black or white at 4.5:1); locked adds the 3 px outline round the fill. */
  .key[data-key="shift"] .main {
    color: var(--key-shift);
  }
  .key[data-key="alpha"] .main {
    color: var(--key-alpha);
  }
  .key[data-key="shift"][aria-pressed="true"] {
    background: var(--key-shift);
    outline: none;
  }
  .key[data-key="alpha"][aria-pressed="true"] {
    background: var(--key-alpha);
    outline: none;
  }
  .key[data-key="shift"][aria-pressed="true"] .main {
    color: var(--on-key-shift);
  }
  .key[data-key="alpha"][aria-pressed="true"] .main {
    color: var(--on-key-alpha);
  }
  .key[data-key="shift"][data-locked="true"],
  .key[data-key="alpha"][data-locked="true"] {
    outline: var(--stroke-thick) solid var(--alpha);
    outline-offset: var(--sp-05);
  }
  .key[data-key="shift"][data-locked="true"] {
    outline-color: var(--shift);
  }
  /* the flick bubble (P7 point 2): above the key, in the colour of the layer it fires; ✕ dimmed when nothing fires */
  .bubble {
    position: absolute;
    z-index: 5;
    transform: translate(-50%, calc(-100% - var(--sp-15)));
    min-width: var(--touch);
    padding: var(--sp-15) var(--sp-25);
    border-radius: var(--radius-m);
    background: var(--panel);
    border: var(--stroke) solid var(--shift);
    color: var(--shift);
    font-size: var(--fs-input);
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
