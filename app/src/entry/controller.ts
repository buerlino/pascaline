// SPDX-License-Identifier: GPL-3.0-or-later
// The MathLive entry line, driven only by our keyboard. Plain TS. MathLive loads lazily (render/mathlive.svelte.ts):
// keys pressed before it is ready are queued and replayed in order, so the keypad is usable at once.
import type { MathfieldElement } from "mathlive";
import type { ActionBody } from "../keyboard/keyboard.ts";
import { mathlive } from "../render/mathlive.svelte.ts";

export class EntryController {
  private mf: MathfieldElement | undefined;
  private host: HTMLElement | undefined;
  private queue: ActionBody[] = [];
  private pendingValue: string | undefined;
  /** Called for a physical Enter / Escape (desktop convenience). */
  onEnter: () => void = () => {};
  onEscape: () => void = () => {};

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

  private create(Field: typeof MathfieldElement): void {
    // Fonts come from mathlive/static.css (bundled by Vite), not from a fonts folder at run time.
    Field.fontsDirectory = null;
    Field.soundsDirectory = null;
    Field.plonkSound = null;
    Field.keypressSound = null;
    const mf = new Field();
    this.mf = mf;
    // MathLive only accepts options once the field is mounted.
    this.host?.append(mf);
    mf.mathVirtualKeyboardPolicy = "manual"; // never open MathLive's own keyboard; ours is the only one
    mf.menuItems = [];
    mf.smartFence = true;
    mf.smartMode = false;
    mf.inlineShortcuts = {};
    mf.removeExtraneousParentheses = true;
    const enforce = (): void => this.forceNoSystemKeyboard();
    void customElements.whenDefined("math-field").then(() => requestAnimationFrame(enforce));
    mf.addEventListener("focusin", enforce);
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
    for (const a of this.queue) this.apply(mf, a);
    this.queue = [];
    mf.focus();
    mf.executeCommand("moveToMathfieldEnd");
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
  focus(): void {
    this.mf?.focus();
  }

  /** Run a type / insert / cmd action. Specials belong to the app and are not handled here. */
  run(a: ActionBody): void {
    if (a.kind === "special") return;
    if (!this.mf) {
      this.queue.push(a);
      return;
    }
    this.apply(this.mf, a);
    this.mf.focus();
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
