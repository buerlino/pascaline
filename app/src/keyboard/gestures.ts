// SPDX-License-Identifier: GPL-3.0-or-later
// Keypad gestures (docs/decisions.md P7): plain geometry and timers, no DOM. Keypad.svelte feeds it pointer
// displacements.

/** The four trackpad zones: the arrow keys' ids in spec/keyboard.yaml, which are also NavDir names. */
export type PadDir = "up" | "down" | "left" | "right";
export const PAD_KEYS: readonly PadDir[] = ["up", "down", "left", "right"];

/** Trackpad: one cursor step per this many CSS pixels of drag (P7 point 1). */
export const STEP_PX = 12;

/**
 * Turns a trackpad drag into cursor steps, in both directions at once, like the cursor drag on a phone's
 * space bar. Positions are displacements from where the finger went down; each call returns the steps that
 * became due since the last call, in order (horizontal first). Dragging back steps back.
 */
export class Stepper {
  private sx = 0;
  private sy = 0;
  /** Steps made so far; 0 at release means the touch was a tap. */
  count = 0;

  move(dx: number, dy: number): PadDir[] {
    const out: PadDir[] = [];
    const tx = Math.trunc(dx / STEP_PX);
    const ty = Math.trunc(dy / STEP_PX);
    for (; this.sx < tx; this.sx++) out.push("right");
    for (; this.sx > tx; this.sx--) out.push("left");
    for (; this.sy < ty; this.sy++) out.push("down");
    for (; this.sy > ty; this.sy--) out.push("up");
    this.count += out.length;
    return out;
  }
}

/** ⌫ auto-repeat: the first repeat after this delay, then one every REPEAT_MS. */
export const REPEAT_DELAY_MS = 400;
export const REPEAT_MS = 60;
/** Keys that fire on touch and repeat while held. */
export const REPEAT_KEYS: readonly string[] = ["bksp"];

/** Calls `fire` repeatedly while a key is held (the first press is the caller's, on touch). */
export class Repeat {
  private timer: ReturnType<typeof setTimeout> | undefined;
  private every: ReturnType<typeof setInterval> | undefined;

  constructor(fire: () => void, delay = REPEAT_DELAY_MS, period = REPEAT_MS) {
    this.timer = setTimeout(() => {
      fire();
      this.every = setInterval(fire, period);
    }, delay);
  }

  stop(): void {
    clearTimeout(this.timer);
    clearInterval(this.every);
  }
}
