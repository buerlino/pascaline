// SPDX-License-Identifier: GPL-3.0-or-later
// The Android clipboard and share sheet through @capacitor/clipboard and @capacitor/share (A11; decisions.md "A4a" point 5):
// the Tab One's WebView 131 denies navigator.clipboard.readText and has no navigator.share. Loaded inside the clipboard
// chunk only. On the web, or when a plugin is missing, the web port stays.
import { webClipboard, type ClipboardPort } from "./port.ts";

export async function choosePort(): Promise<ClipboardPort> {
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable("Clipboard") || !Capacitor.isPluginAvailable("Share")) return webClipboard;
    const [{ Clipboard }, { Share }] = await Promise.all([import("@capacitor/clipboard"), import("@capacitor/share")]);
    return {
      async writeText(text) {
        try {
          await Clipboard.write({ string: text });
          return true;
        } catch {
          return webClipboard.writeText(text);
        }
      },
      async readText() {
        try {
          const r = await Clipboard.read();
          return typeof r.value === "string" ? r.value : null;
        } catch {
          return null;
        }
      },
      async share(title, text) {
        try {
          await Share.share({ title, text });
          return true;
        } catch (e) {
          // closing the sheet is not a failure of the platform
          return e instanceof Error && e.message === "Share canceled";
        }
      },
    };
  } catch {
    return webClipboard;
  }
}
