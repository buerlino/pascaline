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

/** What a finger can tap on the screen outside the keypad. */
const TAPPABLE = "button, [role=menuitem], [role=button], [data-testid=sheet-catch]";
const KEYPAD = "[data-key], [data-trackpad]";

/** Whether a click is a screen tap that counts: on a button or a row, and not on a keypad key (its gesture counts it). */
export function isScreenTap(target: { closest(selector: string): unknown } | null): boolean {
  if (target === null) return false;
  return target.closest(TAPPABLE) !== null && target.closest(KEYPAD) === null;
}

/** A hardware key's handler that counts the press first (docs/04 5.2: every key press counts 1). */
export function counted<A extends unknown[]>(count: () => void, run: (...a: A) => void): (...a: A) => void {
  return (...a) => (count(), run(...a));
}

/** Count every tap on the screen (a history row, a Find result, a chip, a menu item). Captured, so the count is in before
 *  the tap's own handler runs (Reset then zeroes it; a Settings tap counts itself). Returns the cleanup. */
export function countScreenTaps(count: () => void): () => void {
  const on = (ev: MouseEvent): void => {
    if (isScreenTap(ev.target instanceof Element ? ev.target : null)) count();
  };
  document.addEventListener("click", on, true);
  return () => document.removeEventListener("click", on, true);
}
