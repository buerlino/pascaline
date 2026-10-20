// SPDX-License-Identifier: GPL-3.0-or-later
// A file leaves the app (R11 section 1): on Android our local plugin PascalineFiles opens the system "Save to" screen
// (ACTION_CREATE_DOCUMENT; no permission); in the PWA the text is downloaded as a Blob. Never throws.

export type SaveResult = "saved" | "cancelled" | "failed";

interface PascalineFilesPlugin {
  save(options: { name: string; mime: string; text: string }): Promise<{ result: "saved" | "cancelled" }>;
}

function download(name: string, mime: string, text: string): SaveResult {
  if (typeof document === "undefined" || typeof URL.createObjectURL !== "function") return "failed";
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return "saved";
}

export async function saveFile(name: string, mime: string, text: string): Promise<SaveResult> {
  try {
    const { Capacitor, registerPlugin } = await import("@capacitor/core");
    if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("PascalineFiles")) {
      try {
        const r = await registerPlugin<PascalineFilesPlugin>("PascalineFiles").save({ name, mime, text });
        return r.result === "saved" ? "saved" : "cancelled";
      } catch {
        return "failed";
      }
    }
  } catch {
    // no Capacitor: the web download
  }
  try {
    return download(name, mime, text);
  } catch {
    return "failed";
  }
}
