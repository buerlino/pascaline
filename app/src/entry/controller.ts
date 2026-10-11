// SPDX-License-Identifier: GPL-3.0-or-later
// The MathLive entry line, driven only by our keyboard. Plain TS. MathLive loads lazily (render/mathlive.svelte.ts):
// keys pressed before it is ready are queued and replayed in order, so the keypad is usable at once.
import type { MathfieldElement } from "mathlive";
import type { ActionBody } from "../keyboard/keyboard.ts";
import { mathlive } from "../render/mathlive.svelte.ts";

/** The literal caret of the one-line mode, as MathLive serialises it (the parser reads it as a power). */
export const CARET = '\\char"5E ';

const FRAC = "\\frac{#@}{#?}";
const MIXED = "\\tfrac{#?}{#?}";
/** A whole number right before the cursor (not part of a decimal, a name or a group). */
const WHOLE_BEFORE = /(?:^|[^\d.}A-Za-z_^])\d+$/;

export class EntryController {
  private mf: MathfieldElement | undefined;
  private host: HTMLElement | undefined;
  private queue: ActionBody[] = [];
  private pendingValue: string | undefined;
  /** Called for a physical Enter / Escape (desktop convenience). */
  onEnter: () => void = () => {};
  onEscape: () => void = () => {};
  /** One-line entry mode (settings): a typed ^ is a literal caret, not a raised exponent (L4). */
  lineMode = false;

  /** Resolves when the entry line is on the page and the queued keys have been replayed. */
  ready: Promise<void> = Promise.resolve();
  private started = false;

  /** The page element the field goes into (set by the shell). */
  setHost(host: HTMLElement): void {
    this.host = host;
  }

  /** Start loading MathLive; safe to call once. */
  load(): Promise<void> {
    if (this.started) return this.ready;
    this.started = true;
    this.ready = mathlive.load().then((m) => this.create(m.MathfieldElement));
    return this.ready;
  }

  private async create(Field: typeof MathfieldElement): Promise<void> {
    // Fonts come from mathlive/static.css (bundled by Vite), not from a fonts folder at run time.
    Field.fontsDirectory = null;
    Field.soundsDirectory = null;
    Field.plonkSound = null;
    Field.keypressSound = null;
    const mf = new Field();
    // MathLive only accepts options once the field is mounted, and it is only fully laid out a frame later.
    const mounted = new Promise<void>((resolve) => {
      mf.addEventListener("mount", () => resolve(), { once: true });
      setTimeout(resolve, 1000); // safety net if the event never comes
    });
    this.host?.append(mf);
    await mounted;
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    this.mf = mf;
    mf.mathVirtualKeyboardPolicy = "manual"; // never open MathLive's own keyboard; ours is the only one
    mf.menuItems = [];
    mf.smartFence = true;
    mf.smartMode = false;
    mf.inlineShortcuts = {};
    mf.removeExtraneousParentheses = true;
    const enforce = (): void => this.forceNoSystemKeyboard();
    void customElements.whenDefined("math-field").then(() => requestAnimationFrame(enforce));
    mf.addEventListener("focusin", enforce);
    // Capture on the host runs before MathLive's own handler inside the shadow root.
    mf.addEventListener(
      "keydown",
      (ev) => {
        if (ev.key !== "^" || !this.lineMode) return;
        ev.preventDefault();
        ev.stopPropagation();
        mf.insert(CARET, { format: "latex" });
      },
      { capture: true },
    );
    mf.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        this.onEnter();
      } else if (ev.key === "Escape") {
        ev.preventDefault();
        this.onEscape();
      }
    });
    if (this.pendingValue !== undefined) mf.value = this.pendingValue;
    this.pendingValue = undefined;
    // Replay the queued keys one by one through the same path as a live keypress. Keys that arrive while
    // we replay (this.mf is set now) go straight in, so drain until the queue is empty.
    mf.focus();
    mf.executeCommand("moveToMathfieldEnd");
    while (this.queue.length > 0) this.run(this.queue.shift() as ActionBody);
  }

  /** The field's hidden textarea must never summon the system keyboard (inputmode=none, again after upgrade). */
  private forceNoSystemKeyboard(): void {
    for (const el of this.mf?.shadowRoot?.querySelectorAll("[inputmode], textarea") ?? []) {
      el.setAttribute("inputmode", "none");
      el.setAttribute("virtualkeyboardpolicy", "manual");
    }
  }

  /** The field itself (undefined until MathLive has loaded). */
  get field(): MathfieldElement | undefined {
    return this.mf;
  }
  get value(): string {
    return this.mf ? this.mf.value : (this.pendingValue ?? "");
  }
  clear(): void {
    this.queue = [];
    this.pendingValue = undefined;
    if (this.mf) this.mf.value = "";
  }
  /** Put a previous entry back on the line. */
  set(latex: string): void {
    if (!this.mf) {
      this.pendingValue = latex;
      this.queue = [];
      return;
    }
    this.mf.value = latex;
    this.mf.focus();
    this.mf.executeCommand("moveToMathfieldEnd");
  }
  /** Insert LaTeX at the cursor (a history result, L5). */
  insert(latex: string): void {
    if (!this.mf) {
      this.pendingValue = (this.pendingValue ?? "") + latex;
      return;
    }
    this.mf.insert(latex, { format: "latex", selectionMode: "after" });
    this.mf.focus();
  }
    focus(): void {
    this.mf?.focus();
  }

  /** The field value right after the a/b key made a fraction from a whole number (see run), else undefined. */
  private mixedAfter: string | undefined;

  /**
   * Run a type / insert / cmd action. Specials belong to the app and are not handled here.
   * `keyId` "frac" (a/b): pressed again right after it turned a whole number into a fraction's numerator,
   * it makes a mixed number instead (2 a/b a/b 1 ▶ 2 → 2½, as \tfrac; L2, assumed, G2 item 17).
   */
  run(a: ActionBody, keyId?: string): void {
    if (a.kind === "special") return;
    if (!this.mf) {
      this.queue.push(a);
      return;
    }
    const mf = this.mf;
    const isFrac = keyId === "frac" && a.kind === "insert" && a.latex === FRAC;
    if (isFrac && this.mixedAfter !== undefined && this.mixedAfter === mf.value) {
      this.mixedAfter = undefined;
      mf.executeCommand("undo");
      mf.insert(MIXED, { selectionMode: "placeholder", format: "latex" });
      mf.focus();
      return;
    }
    const whole = isFrac && WHOLE_BEFORE.test(mf.getValue(0, mf.position, "latex"));
    this.apply(mf, a);
    this.mixedAfter = whole ? mf.value : undefined;
    mf.focus();
  }

  private apply(mf: MathfieldElement, a: ActionBody): void {
    switch (a.kind) {
      case "type":
        mf.executeCommand(["typedText", a.text]);
        break;
      case "insert":
        mf.insert(a.latex, { selectionMode: "placeholder", format: "latex" });
        break;
      case "cmd":
        mf.executeCommand(a.name as never);
        break;
      case "special":
        break;
    }
  }
}
