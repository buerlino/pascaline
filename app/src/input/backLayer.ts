// SPDX-License-Identifier: GPL-3.0-or-later
// Android back as Esc for the open layer (R21b, backlog C8). A layer (the Settings page, a pick sheet, Find later) pushes
// one history entry when it opens; the platform's back (the Android WebView's goBack(), a browser's back button,
// `history.back()`) pops it and closes the layer. A layer closed any other way (Esc, ×, a pick, a tap in the viewport)
// takes its entry back, so the history never grows and back with nothing open leaves the app. No dependency.

interface Layer {
  readonly close: () => void;
}

const stack: Layer[] = [];
/** history.back() calls whose popstate has not arrived yet: those popstates are ours, not the user's back. */
let ownPops = 0;
/** Layers that opened while one of our own pops was pending: pushed when it arrives (a push before it would be undone). */
const waiting: Layer[] = [];
let listening = false;

function push(layer: Layer): void {
  try {
    history.pushState({ pascalineLayer: stack.length }, "");
  } catch {
    // no history here (a sandboxed frame): the layer works, back just leaves
  }
  stack.push(layer);
}

function onPop(): void {
  if (ownPops > 0) {
    ownPops--;
    if (ownPops === 0) for (const l of waiting.splice(0)) push(l);
    return;
  }
  const top = stack.pop();
  top?.close(); // the user's back: the layer closes; its release() finds it gone and does nothing
}

/** Open a layer: `close` runs when the platform's back pops it. Returns `release`, to call when the layer closes some other way. */
export function openLayer(close: () => void): () => void {
  if (!listening && typeof window !== "undefined") {
    window.addEventListener("popstate", onPop);
    listening = true;
  }
  const layer: Layer = { close };
  if (ownPops > 0) waiting.push(layer);
  else push(layer);
  return () => {
    const w = waiting.indexOf(layer);
    if (w >= 0) {
      waiting.splice(w, 1);
      return;
    }
    const i = stack.indexOf(layer);
    if (i < 0) return; // popped by back already
    stack.splice(i, 1);
    if (i !== stack.length) return; // not the top (cannot happen with one open layer at a time)
    ownPops++;
    history.back();
  };
}
