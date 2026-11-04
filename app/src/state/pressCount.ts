// SPDX-License-Identifier: GPL-3.0-or-later
// What counts as one press (R70; docs/04 section 5.2): a key tap, a flick (lock flicks too), a held ⌫ (once, when it goes
// down), a trackpad drag (once), a tap on the screen (a history row, a Find result, a chip, a menu item). Nothing is free.
// Pure, so the rules are unit-tested; Keypad.svelte and App.svelte call them.

/** A finished touch on the keypad, as Keypad.svelte holds it (only what counting needs). */
export type FinishedTouch =
  | { kind: "pad"; key: unknown; steps: { count: number } }
  | { kind: "key"; key: unknown; flick: { state: "tap" | "up" | "down" | "cancelled" } }
  | { kind: "repeat" };

/** How many presses a touch is when the finger lifts. A repeating key (⌫) counts once at touch-down, so 0 here. */
export function touchPresses(g: FinishedTouch): 0 | 1 {
  if (g.kind === "pad") return g.steps.count > 0 || g.key !== undefined ? 1 : 0;
  if (g.kind === "key") return g.key !== undefined && g.flick.state !== "cancelled" ? 1 : 0;
  return 0;
}

/** The key and layer of a finished touch, for the per-key counts (R127; a count name is "<key id>:<layer>", and a hardware
 *  key's layer is hw): "<key id>:<layer>" with the layer the pad shows for
 *  a tap (Alpha over Shift) and up or down for a flick; a trackpad drag is "trackpad:drag". Undefined where
 *  `touchPresses` is 0. */
export function touchKey(
  g: { kind: "pad"; key: { id: string } | undefined; steps: { count: number } } | { kind: "key"; key: { id: string } | undefined; flick: { state: "tap" | "up" | "down" | "cancelled" } } | { kind: "repeat" },
  layer: { shift: boolean; alpha: boolean },
): string | undefined {
  if (g.kind === "repeat") return undefined;
  if (g.kind === "pad" && g.steps.count > 0) return "trackpad:drag";
  const st = g.kind === "key" ? g.flick.state : "tap";
  return g.key && st !== "cancelled" ? `${g.key.id}:${st === "tap" ? (layer.alpha ? "alpha" : layer.shift ? "shift" : "primary") : st}` : undefined;
}

/** What a finger can tap on the screen outside the keypad. */
const TAPPABLE = "button, [role=menuitem], [role=button], [data-testid=sheet-catch]";
const KEYPAD = "[data-key], [data-trackpad]";

/** Whether a click is a screen tap that counts: on a button or a row, and not on a keypad key (its gesture counts it). */
export function isScreenTap(target: { closest(selector: string): unknown } | null): boolean {
  if (target === null) return false;
  return target.closest(TAPPABLE) !== null && target.closest(KEYPAD) === null;
}

/** What a screen tap hit, as the count's kind (R127): a menu row's `data-count` (its own kind, R92: units-const,
 *  units-tools; else "row"), else button. */
export function screenKind(target: { closest(selector: string): unknown }): string {
  return `screen:${(target.closest("[data-count]") as { dataset: { count: string } } | null)?.dataset.count ?? "button"}`;
}

/** A hardware key's handler that counts the press first (docs/04 5.2: every key press counts 1; `count` gets the handler's
 *  own arguments, R127). Its last argument is the event's KeyboardEvent.repeat: a held key counts once, so an auto-repeat
 *  runs the key again but counts nothing (R70f1). */
export function counted<A extends unknown[]>(count: (...a: NoInfer<A>) => void, run: (...a: A) => void): (...a: [...A, repeat: boolean]) => void {
  return (...a) => {
    const args = a.slice(0, -1) as A;
    if (a[a.length - 1] !== true) count(...args);
    run(...args);
  };
}

/** Count every tap on the screen (a history row, a Find result, a chip, a menu item). Captured, so the count is in before
 *  the tap's own handler runs (Reset then zeroes it; a Settings tap counts itself). Returns the cleanup. */
export function countScreenTaps(count: (kind: string) => void): () => void {
  const on = (ev: MouseEvent): void => {
    const el = ev.target instanceof Element ? ev.target : null;
    if (el && isScreenTap(el)) count(screenKind(el));
  };
  document.addEventListener("click", on, true);
  return () => document.removeEventListener("click", on, true);
}
