// SPDX-License-Identifier: GPL-3.0-or-later
// A file leaves the app (R11 section 1): on Android our local plugin PascalineFiles opens the system "Save to" screen
// (ACTION_CREATE_DOCUMENT; no permission). In the PWA the browser's save picker (`showSaveFilePicker`) writes it where
// the browser has one; else the text is downloaded as a Blob, which is only "offered": the page cannot know whether a
// file was written (R122). Never throws.

/** `offered`: a web download started; the browser does not say whether it saved the file. */
export type SaveResult = "saved" | "offered" | "cancelled" | "failed";

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
  return "offered";
}

/** The File System Access API's part this uses (Chromium on the desktop; not in Firefox, Safari or Android's browsers). */
interface Writable {
  write(text: string): Promise<void>;
  close(): Promise<void>;
  abort?(): Promise<void>;
}
type SavePicker = (o: { suggestedName: string; types: { accept: Record<string, string[]> }[] }) => Promise<{ createWritable(): Promise<Writable> }>;

/** The save picker: saved once written and closed; cancelled when the user closed it; undefined when the browser has
 *  none or refused to open it (no user gesture left after the backup was read), so the download is offered instead. */
async function pick(name: string, mime: string, text: string): Promise<SaveResult | undefined> {
  const picker = (globalThis as { showSaveFilePicker?: SavePicker }).showSaveFilePicker;
  if (typeof picker !== "function") return undefined;
  let handle: Awaited<ReturnType<SavePicker>>;
  try {
    const ext = /\.\w+$/.exec(name)?.[0] ?? ".txt";
    handle = await picker.call(globalThis, { suggestedName: name, types: [{ accept: { [mime]: [ext] } }] });
  } catch (e) {
    return e instanceof DOMException && e.name === "AbortError" ? "cancelled" : undefined;
  }
  let w: Writable | undefined;
  try {
    w = await handle.createWritable();
    await w.write(text);
    await w.close();
    return "saved";
  } catch {
    await w?.abort?.().catch(() => {});
    return "failed";
  }
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
    return (await pick(name, mime, text)) ?? download(name, mime, text);
  } catch {
    return "failed";
  }
}
