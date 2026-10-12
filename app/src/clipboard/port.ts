// SPDX-License-Identifier: GPL-3.0-or-later
// The clipboard and the share sheet (docs/04 section 8.2). `navigator.clipboard` first: it works in a secure context,
// and Capacitor serves the app from https://localhost. A Capacitor plugin joins only if the device check (A4) shows
// that the WebView needs it. Failures never throw: the caller shows a message.

export interface ClipboardPort {
  /** Put text on the clipboard; false when the platform refused. */
  writeText(text: string): Promise<boolean>;
  /** The clipboard as text; null when it cannot be read (no permission, or the platform has no clipboard). */
  readText(): Promise<string | null>;
  /** Open the system share sheet; false when the platform cannot share (then the caller copies instead). */
  share(title: string, text: string): Promise<boolean>;
}

/** The old way: select a hidden text area and run the copy command. Needs a user gesture, not a permission. */
function copyWithSelection(text: string): boolean {
  if (typeof document === "undefined") return false;
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.setAttribute("inputmode", "none");
  ta.style.cssText = "position:fixed;top:0;left:0;opacity:0;pointer-events:none";
  const active = document.activeElement as HTMLElement | null;
  document.body.append(ta);
  ta.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  ta.remove();
  active?.focus?.();
  return ok;
}

export const webClipboard: ClipboardPort = {
  async writeText(text) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      // not allowed here (no focus, no permission): try the old way
    }
    return copyWithSelection(text);
  },
  async readText() {
    try {
      if (navigator.clipboard?.readText) return await navigator.clipboard.readText();
    } catch {
      // permission denied or not focused
    }
    return null;
  },
  async share(title, text) {
    if (typeof navigator === "undefined" || typeof navigator.share !== "function") return false;
    try {
      await navigator.share({ title, text });
      return true;
    } catch (e) {
      // The user closing the sheet is not a failure of the platform: nothing to copy instead.
      if (e instanceof DOMException && e.name === "AbortError") return true;
      return false;
    }
  },
};
