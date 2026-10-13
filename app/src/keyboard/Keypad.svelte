<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<script lang="ts">
  import { legend } from "../i18n/index.ts";
  import { KeyHold, PAD_KEYS, REPEAT_KEYS, Repeat, Stepper, type PadDir } from "./gestures.ts";
  import { gridPlace, keyboard, labelFor, type Key, type Layer } from "./keyboard.ts";

  let {
    shift,
    alpha,
    alphaLock = false,
    onpress,
    ontouch = () => {},
  }: {
    shift: boolean;
    alpha: boolean;
    alphaLock?: boolean;
    /** A key fires; `layer` overrides the Shift/Alpha state (trackpad steps, flicks). */
    onpress: (key: Key, layer?: Layer) => void;
    /** A finger went down, or a gesture made a step: the haptic tick. */
    ontouch?: () => void;
  } = $props();

  // The legend printed above a key is its next layer; the face shows the active layer.
  const face = (k: Key): string =>
    legend(labelFor(k, shift, alpha) || k.label.primary || "");
  const hint = (k: Key): string => {
    if (shift || alpha) return "";
    return k.label.shift ? legend(k.label.shift) : "";
  };
  const alphaHint = (k: Key): string => (shift || alpha || !k.label.alpha ? "" : k.label.alpha);
  const pressed = (k: Key): boolean =>
    (k.actions.primary?.kind === "special" && k.actions.primary.name === "shift" && shift) ||
    (k.actions.primary?.kind === "special" && k.actions.primary.name === "alpha" && alpha);

  // ---- gestures (docs/decisions.md P7). One pointer handler on the whole pad, one gesture per finger.
  // The trackpad (K1): the four arrow keys are its tap zones; a drag steps in 2D (gestures.ts), a tap is one step.
  const isPadKey = (k: Key): boolean => (PAD_KEYS as readonly string[]).includes(k.id);
  const padArea = ((): { rows: string; cols: string } | undefined => {
    const keys = keyboard.keys.filter(isPadKey);
    if (keys.length === 0) return undefined;
    const rows = keys.map((k) => k.row);
    const starts = keys.map((k) => gridPlace(keyboard, k).start);
    const ends = keys.map((k) => gridPlace(keyboard, k).start + gridPlace(keyboard, k).span);
    return { rows: `${Math.min(...rows) + 1} / ${Math.max(...rows) + 2}`, cols: `${Math.min(...starts)} / ${Math.max(...ends)}` };
  })();

  // Hold and drag (K2): any other key fires when the finger lifts; held still for HOLD_MS it is the 2D cursor
  // (the keys dim) until the finger lifts. ⌫ fires on touch and repeats while held instead.
  type Gesture =
    | { kind: "pad"; key: Key | undefined; x0: number; y0: number; steps: Stepper }
    | { kind: "key"; x0: number; y0: number; hold: KeyHold }
    | { kind: "repeat"; repeat: Repeat };
  const gestures = new Map<number, Gesture>();
  let padEl: HTMLDivElement | undefined = $state();
  let cursor = $state(false);
  $effect(() => () => {
    for (const g of gestures.values()) cancel(g);
    gestures.clear();
  });

  function targetOf(ev: PointerEvent): Key | "pad" | undefined {
    const el = ev.target instanceof Element ? ev.target.closest<HTMLElement>("[data-key],[data-trackpad]") : null;
    if (!el) return undefined;
    if (el.dataset["trackpad"] !== undefined) return "pad";
    return keyboard.byId.get(el.dataset["key"] ?? "");
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
    if (target && target !== "pad" && REPEAT_KEYS.includes(target.id)) {
      onpress(target);
      // the repeats keep the layer of the first press (Shift ⌫ = Del), which used up a one-shot Shift
      const layer: Layer = alpha ? "alpha" : shift ? "shift" : "primary";
      gestures.set(ev.pointerId, { kind: "repeat", repeat: new Repeat(() => onpress(target, layer)) });
      return;
    }
    try {
      padEl?.setPointerCapture(ev.pointerId);
    } catch {
      // a synthetic event without an active pointer: the gesture still works while the finger stays on the pad
    }
    const [x0, y0] = [ev.clientX, ev.clientY];
    if (target === "pad" || (target && isPadKey(target)))
      gestures.set(ev.pointerId, { kind: "pad", key: target === "pad" ? undefined : target, x0, y0, steps: new Stepper() });
    else {
      // a key, or a gap between keys: the hold works anywhere on the keypad
      const hold = new KeyHold({
        cursor: () => {
          cursor = true;
          ontouch();
        },
        step,
        tap: () => target && onpress(target),
        end: () => (cursor = false),
      });
      gestures.set(ev.pointerId, { kind: "key", x0, y0, hold });
    }
  }

  function move(ev: PointerEvent): void {
    const g = gestures.get(ev.pointerId);
    if (!g || g.kind === "repeat") return;
    const [dx, dy] = [ev.clientX - g.x0, ev.clientY - g.y0];
    if (g.kind === "key") g.hold.move(dx, dy);
    else for (const dir of g.steps.move(dx, dy)) step(dir);
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

  /**
   * The finger lifts (or another one comes down): a trackpad touch without a step was a tap on its zone, a key
   * touch before the hold is the key, a hold ends the cursor, ⌫ stops repeating.
   */
  function finish(g: Gesture): void {
    if (g.kind === "pad") {
      if (g.steps.count === 0 && g.key) onpress(g.key);
    } else if (g.kind === "key") g.hold.release();
    else g.repeat.stop();
  }

  /** The browser took the touch (a scroll, a system gesture): nothing fires, the cursor mode ends. */
  function cancel(g: Gesture): void {
    if (g.kind === "key") g.hold.cancel();
    else if (g.kind === "repeat") g.repeat.stop();
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
  data-cursor={cursor ? "true" : undefined}
  style:grid-template-columns={`repeat(${keyboard.units}, 1fr)`}
  bind:this={padEl}
  onpointerdown={down}
  onpointermove={move}
  onpointerup={up}
  onpointercancel={cancelled}
  onclick={(ev) => ev.preventDefault()}
  role="presentation"
>
  {#if padArea}<div class="trackpad" data-trackpad style:grid-row={padArea.rows} style:grid-column={padArea.cols}></div>{/if}
  {#each keyboard.keys as key (key.id)}
    <button
      type="button"
      class={`key ${key.cls}`}
      data-key={key.id}
      tabindex="-1"
      aria-pressed={key.cls === "ctl" && (key.id === "shift" || key.id === "alpha") ? pressed(key) : undefined}
      data-locked={key.id === "alpha" && alphaLock ? "true" : undefined}
      style:grid-row={key.row + 1}
      style:grid-column={`${gridPlace(keyboard, key).start} / span ${gridPlace(keyboard, key).span}`}
      data-reserved={key.actions.primary?.kind === "special" && key.actions.primary.name === "none" ? "true" : undefined}
      data-zone={isPadKey(key) ? "true" : undefined}
    >
      <span class="main">{face(key)}</span>
      {#if hint(key)}<span class="shiftlegend">{hint(key)}</span>{/if}
      {#if alphaHint(key)}<span class="alphalegend">{alphaHint(key)}</span>{/if}
    </button>
  {/each}
</div>

<style>
  .pad {
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
  .key {
    position: relative;
    min-height: 48px;
    border: 0;
    border-radius: 8px;
    color: var(--text);
    font: inherit;
    font-size: 20px;
    background: var(--key-num);
    -webkit-tap-highlight-color: transparent;
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
  /* the trackpad and Cancel in the upper cluster: as low as the app keys beside them */
  .key[data-key="cancel"],
  .key[data-zone="true"] {
    min-height: 36px;
  }
  /* the trackpad (K1): one surface under the four arrow keys, which stay as its tap zones */
  .trackpad {
    border-radius: 12px;
    background: var(--key-ctl);
  }
  .key[data-zone="true"] {
    background: transparent;
    opacity: 0.7;
  }
  .key[data-zone="true"]:active {
    filter: none;
    opacity: 1;
  }
  /* hold and drag (K2): the keys dim while the keypad is the cursor */
  .key,
  .trackpad {
    transition: opacity 0.12s;
  }
  .pad[data-cursor="true"] .key,
  .pad[data-cursor="true"] .trackpad {
    opacity: 0.3;
  }
  /* a key whose function we don't have yet: only its letter matters */
  .key[data-reserved="true"] .main {
    opacity: 0.4;
    font-size: 14px;
  }
  .key.enter {
    background: var(--key-enter);
    color: #fff;
    font-size: 16px;
  }
  .shiftlegend {
    position: absolute;
    top: 2px;
    right: 6px;
    font-size: 11px;
    color: var(--shift);
  }
  .alphalegend {
    position: absolute;
    top: 2px;
    left: 6px;
    font-size: 11px;
    color: var(--alpha);
  }
  .shifted .main {
    color: var(--shift);
  }
  .alphaed .main {
    color: var(--alpha);
  }
  .key[aria-pressed="true"] {
    outline: 2px solid var(--shift);
  }
  .alphaed .key[data-key="alpha"][aria-pressed="true"] {
    outline-color: var(--alpha);
  }
  .key[data-locked="true"] {
    outline-width: 3px;
    background: color-mix(in srgb, var(--alpha) 25%, transparent);
  }
</style>
