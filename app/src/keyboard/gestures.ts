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

/** Hold and drag (K2, P7 revised): a finger held this long without moving turns the keypad into the trackpad. */
export const HOLD_MS = 350;
/** Movement (CSS px) a finger may make before the hold time without losing the hold: finger jitter. */
export const HOLD_SLOP_PX = 10;

/** What a held finger does: `cursor` when the hold starts, `step`s while dragging, `end` when it stops. */
export interface HoldEvents {
  cursor(): void;
  step(dir: PadDir): void;
  /** The finger lifted before the hold: an ordinary key press. */
  tap(): void;
  end(): void;
}

/**
 * One finger on a key (K2). The key fires when the finger lifts (`tap`), unless it was held still for HOLD_MS:
 * then it is the 2D cursor (the trackpad's stepping) until it lifts, and the key does not fire. A finger that
 * slides past the slop before the hold stays a tap (fast typing slips). Positions are displacements from where
 * the finger went down. `release` and `cancel` are safe to call more than once.
 */
export class KeyHold {
  phase: "wait" | "tap" | "cursor" | "done" = "wait";
  private timer: ReturnType<typeof setTimeout> | undefined;
  private x = 0;
  private y = 0;
  private ox = 0;
  private oy = 0;
  private readonly steps = new Stepper();

  constructor(
    private readonly on: HoldEvents,
    holdMs = HOLD_MS,
  ) {
    this.timer = setTimeout(() => this.hold(), holdMs);
  }

  move(dx: number, dy: number): void {
    this.x = dx;
    this.y = dy;
    if (this.phase === "wait" && Math.hypot(dx, dy) > HOLD_SLOP_PX) {
      clearTimeout(this.timer);
      this.phase = "tap";
    } else if (this.phase === "cursor") for (const dir of this.steps.move(dx - this.ox, dy - this.oy)) this.on.step(dir);
  }

  /** The finger lifts (or another one comes down). */
  release(): void {
    const p = this.stop();
    if (p === "wait" || p === "tap") this.on.tap();
    else if (p === "cursor") this.on.end();
  }

  /** The browser took the touch (scroll, system gesture): nothing fires. */
  cancel(): void {
    if (this.stop() === "cursor") this.on.end();
  }

  private hold(): void {
    if (this.phase !== "wait") return;
    this.phase = "cursor";
    // steps count from here, so the jitter during the hold makes none
    this.ox = this.x;
    this.oy = this.y;
    this.on.cursor();
  }

  private stop(): KeyHold["phase"] {
    clearTimeout(this.timer);
    const p = this.phase;
    this.phase = "done";
    return p;
  }
}

/** ⌫ auto-repeat: the first repeat after this delay, then one every REPEAT_MS. */
export const REPEAT_DELAY_MS = 400;
export const REPEAT_MS = 60;
/** Keys that repeat while held instead of turning into the cursor (P7 revised). */
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
