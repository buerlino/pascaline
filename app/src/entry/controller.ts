// SPDX-License-Identifier: GPL-3.0-or-later
// The MathLive entry line, driven only by our keyboard. Plain TS: the Svelte component just mounts `mf`.
import { MathfieldElement } from "mathlive";
import type { ActionBody } from "../keyboard/keyboard.ts";

let configured = false;
function configureMathLive(): void {
  if (configured) return;
  configured = true;
  // Fonts come from mathlive/static.css (bundled by Vite), not from a fonts folder at run time.
  MathfieldElement.fontsDirectory = null;
  MathfieldElement.soundsDirectory = null;
  MathfieldElement.plonkSound = null;
  MathfieldElement.keypressSound = null;
}

export class EntryController {
  readonly mf: MathfieldElement;

  constructor() {
    configureMathLive();
    this.mf = new MathfieldElement();
  }

  /** Put the field into the page and configure it (MathLive only accepts options once it is mounted). */
  attach(host: HTMLElement): void {
    const mf = this.mf;
    host.append(mf);
    // Never open MathLive's own virtual keyboard; ours is the only one.
    mf.mathVirtualKeyboardPolicy = "manual";
    mf.menuItems = [];
    mf.smartFence = true;
    mf.smartMode = false;
    mf.inlineShortcuts = {};
    mf.removeExtraneousParentheses = true;
    const enforce = (): void => this.forceNoSystemKeyboard();
    void customElements.whenDefined("math-field").then(() => requestAnimationFrame(enforce));
    mf.addEventListener("focusin", enforce);
    mf.focus();
  }

  /** The field's hidden textarea must never summon the system keyboard (inputmode=none, again after upgrade). */
  private forceNoSystemKeyboard(): void {
    for (const el of this.mf.shadowRoot?.querySelectorAll("[inputmode], textarea") ?? []) {
      el.setAttribute("inputmode", "none");
      el.setAttribute("virtualkeyboardpolicy", "manual");
    }
  }

  get value(): string {
    return this.mf.value;
  }
  clear(): void {
    this.mf.value = "";
  }
  /** Put a previous entry back on the line. */
  set(latex: string): void {
    this.mf.value = latex;
    this.mf.focus();
    this.mf.executeCommand("moveToMathfieldEnd");
  }
  focus(): void {
    this.mf.focus();
  }

  /** Run a type / insert / cmd action. Specials belong to the app and are not handled here. */
  run(a: ActionBody): void {
    switch (a.kind) {
      case "type":
        this.mf.executeCommand(["typedText", a.text]);
        break;
      case "insert":
        this.mf.insert(a.latex, { selectionMode: "placeholder", format: "latex" });
        break;
      case "cmd":
        this.mf.executeCommand(a.name as never);
        break;
      case "special":
        break;
    }
    this.mf.focus();
  }
}
