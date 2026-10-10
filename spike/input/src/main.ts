// SPDX-License-Identifier: GPL-3.0-or-later
// Spike page: MathLive entry driven only by our own on-screen keyboard.
import { MathfieldElement } from "mathlive";
import "./style.css";
import { ROWS, type Action, type Key } from "./layout";

// Relative to the page, so it also works when the page is served from a sub-folder (spike/app/public/input/).
MathfieldElement.fontsDirectory = new URL("fonts", location.href).href;
MathfieldElement.soundsDirectory = null;
// Never open MathLive's own virtual keyboard; ours is the only one.
MathfieldElement.plonkSound = null;
MathfieldElement.keypressSound = null;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const mf = new MathfieldElement();
mf.id = "mf";
$("entry").prepend(mf);
mf.mathVirtualKeyboardPolicy = "manual";
mf.menuItems = [];
mf.smartFence = true;
mf.smartMode = false;
mf.inlineShortcuts = {};
mf.removeExtraneousParentheses = true;

// Belt and braces: the field's hidden textarea must not summon the system keyboard.
// MathLive sets inputmode=none on it already; enforce it again after the shadow DOM is ready.
function forceNoSystemKeyboard(): void {
  for (const el of mf.shadowRoot?.querySelectorAll("[inputmode], textarea") ?? []) {
    el.setAttribute("inputmode", "none");
    el.setAttribute("virtualkeyboardpolicy", "manual");
  }
}
customElements.whenDefined("math-field").then(() => requestAnimationFrame(forceNoSystemKeyboard));
mf.addEventListener("focusin", forceNoSystemKeyboard);

let shifted = false;
const keyEls = new Map<string, HTMLButtonElement>();

function setShift(on: boolean): void {
  shifted = on;
  $("pad").classList.toggle("shifted", on);
  keyEls.get("shift")?.setAttribute("aria-pressed", String(on));
}

function run(action: Action): void {
  switch (action.kind) {
    case "type":
      mf.executeCommand(["typedText", action.text]);
      break;
    case "insert":
      mf.insert(action.latex, { selectionMode: "placeholder", format: "latex" });
      break;
    case "cmd":
      mf.executeCommand(action.name as never);
      break;
    case "clear":
      mf.value = "";
      break;
    case "enter":
      document.dispatchEvent(new CustomEvent("pascaline:enter", { detail: mf.value }));
      break;
    case "shift":
      break;
  }
}

function press(key: Key): void {
  if (key.action.kind === "shift") {
    setShift(!shifted);
    return;
  }
  const action = shifted && key.shiftAction ? key.shiftAction : key.action;
  run(action);
  if (shifted) setShift(false);
  mf.focus();
  report();
}

function build(): void {
  const pad = $("pad");
  for (const row of ROWS) {
    for (const key of row) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = `key ${key.cls}`;
      b.dataset["key"] = key.id;
      b.tabIndex = -1; // focus must stay in the math field
      const main = document.createElement("span");
      main.className = "main";
      main.textContent = key.label;
      b.append(main);
      if (key.shiftLabel) {
        const s = document.createElement("span");
        s.className = "alt";
        s.textContent = key.shiftLabel;
        b.append(s);
      }
      // pointerdown + preventDefault: the button never takes focus, so the caret stays in the field.
      b.addEventListener("pointerdown", (ev) => {
        ev.preventDefault();
        press(key);
      });
      b.addEventListener("click", (ev) => ev.preventDefault());
      keyEls.set(key.id, b);
      pad.append(b);
    }
  }
}
build();

// Compute Engine is large (about 4 MB unminified): load it in the background after first paint.
type Serializer = typeof import("./serialize");
let serializer: Serializer | undefined;
const timing: { entryReadyMs: number; serializerReadyMs?: number } = { entryReadyMs: 0 };
function loadSerializer(): void {
  import("./serialize").then((m) => {
    serializer = m;
    m.latexToGiac("1"); // warm up the engine instance
    timing.serializerReadyMs = Math.round(performance.now());
    report();
  });
}

function giacText(): string {
  if (!serializer) return "(serializer loading)";
  try {
    return serializer.latexToGiac(mf.value);
  } catch (e) {
    return `(${e instanceof Error ? e.message : String(e)})`;
  }
}

function report(): void {
  $("o-latex").textContent = mf.value;
  $("o-giac").textContent = mf.value ? giacText() : "";
  $("o-kb").textContent = `ready ${timing.entryReadyMs} ms, serializer ${timing.serializerReadyMs ?? "…"} ms; activeElement=${document.activeElement?.tagName.toLowerCase()} mathVK.visible=${String(window.mathVirtualKeyboard?.visible)}`;
}
mf.addEventListener("input", report);
document.addEventListener("pascaline:enter", report);

declare global {
  interface Window {
    pascalineInput: { press: (id: string) => void; giac: () => string; timing: { entryReadyMs: number; serializerReadyMs?: number }; mf: MathfieldElement };
  }
}
window.pascalineInput = {
  mf,
  timing,
  giac: giacText,
  press: (id) => {
    for (const row of ROWS) for (const k of row) if (k.id === id) press(k);
  },
};
mf.focus();
timing.entryReadyMs = Math.round(performance.now());
report();
requestAnimationFrame(() => setTimeout(loadSerializer, 0));
