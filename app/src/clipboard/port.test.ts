// SPDX-License-Identifier: GPL-3.0-or-later
import { afterEach, describe, expect, it, vi } from "vitest";
import { webClipboard } from "./port.ts";

afterEach(() => vi.unstubAllGlobals());

describe("webClipboard", () => {
  it("writes and reads through navigator.clipboard", async () => {
    let held = "";
    vi.stubGlobal("navigator", { clipboard: { writeText: (s: string) => ((held = s), Promise.resolve()), readText: () => Promise.resolve(held) } });
    expect(await webClipboard.writeText("0.5")).toBe(true);
    expect(await webClipboard.readText()).toBe("0.5");
  });
  it("reports a refused read as null, never throws", async () => {
    vi.stubGlobal("navigator", { clipboard: { readText: () => Promise.reject(new Error("denied")) } });
    expect(await webClipboard.readText()).toBeNull();
    vi.stubGlobal("navigator", {});
    expect(await webClipboard.readText()).toBeNull();
  });
  it("reports a refused write as false when there is no page to fall back on", async () => {
    vi.stubGlobal("navigator", { clipboard: { writeText: () => Promise.reject(new Error("denied")) } });
    expect(await webClipboard.writeText("x")).toBe(false); // node: no document for the execCommand fallback
  });
  it("shares through navigator.share, and says false when the platform cannot", async () => {
    const calls: unknown[] = [];
    vi.stubGlobal("navigator", { share: (d: unknown) => (calls.push(d), Promise.resolve()) });
    expect(await webClipboard.share("T", "body")).toBe(true);
    expect(calls).toEqual([{ title: "T", text: "body" }]);
    vi.stubGlobal("navigator", {});
    expect(await webClipboard.share("T", "body")).toBe(false);
    vi.stubGlobal("navigator", { share: () => Promise.reject(new DOMException("closed", "AbortError")) });
    expect(await webClipboard.share("T", "body")).toBe(true); // the user closed the sheet: not a failure
    vi.stubGlobal("navigator", { share: () => Promise.reject(new Error("no")) });
    expect(await webClipboard.share("T", "body")).toBe(false);
  });
});

// A11: the native port and the file port, with @capacitor/* mocked (never a device in unit tests)
const cap = vi.hoisted(() => ({
  native: false,
  available: new Set<string>(),
  files: { save: vi.fn() },
  clip: { write: vi.fn(), read: vi.fn() },
  share: { share: vi.fn() },
}));
vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => cap.native, isPluginAvailable: (n: string) => cap.available.has(n) },
  registerPlugin: (n: string) => (n === "PascalineFiles" ? cap.files : {}),
}));
vi.mock("@capacitor/clipboard", () => ({ Clipboard: cap.clip }));
vi.mock("@capacitor/share", () => ({ Share: cap.share }));

describe("choosePort", () => {
  it("is the native port when native and both plugins are there", async () => {
    const { choosePort } = await import("./native.ts");
    cap.native = true;
    cap.available = new Set(["Clipboard", "Share"]);
    cap.clip.read.mockResolvedValue({ type: "text/plain", value: "1.5e-3" });
    cap.clip.write.mockResolvedValue(undefined);
    cap.share.share.mockResolvedValue({});
    const port = await choosePort();
    expect(port).not.toBe(webClipboard);
    expect(await port.readText()).toBe("1.5e-3");
    expect(await port.writeText("x")).toBe(true);
    expect(cap.clip.write).toHaveBeenCalledWith({ string: "x" });
    expect(await port.share("T", "b")).toBe(true);
    expect(cap.share.share).toHaveBeenCalledWith({ title: "T", text: "b" });
    cap.share.share.mockRejectedValue(new Error("Share canceled"));
    expect(await port.share("T", "b")).toBe(true);
    cap.share.share.mockRejectedValue(new Error("boom"));
    expect(await port.share("T", "b")).toBe(false);
    cap.share.share.mockRejectedValue(new Error("Share failed: request cancelled by system"));
    expect(await port.share("T", "b")).toBe(false);
    cap.clip.read.mockRejectedValue(new Error("no"));
    expect(await port.readText()).toBeNull();
  });
  it("is the web port on the web or when a plugin is missing", async () => {
    const { choosePort } = await import("./native.ts");
    cap.native = false;
    expect(await choosePort()).toBe(webClipboard);
    cap.native = true;
    cap.available = new Set(["Clipboard"]);
    expect(await choosePort()).toBe(webClipboard);
  });
});

describe("saveFile", () => {
  it("maps the plugin's three outcomes", async () => {
    const { saveFile } = await import("./files.ts");
    cap.native = true;
    cap.available = new Set(["PascalineFiles"]);
    cap.files.save.mockResolvedValue({ result: "saved" });
    expect(await saveFile("a.json", "application/json", "{}")).toBe("saved");
    expect(cap.files.save).toHaveBeenCalledWith({ name: "a.json", mime: "application/json", text: "{}" });
    cap.files.save.mockResolvedValue({ result: "cancelled" });
    expect(await saveFile("a.json", "application/json", "{}")).toBe("cancelled");
    cap.files.save.mockRejectedValue(new Error("I/O"));
    expect(await saveFile("a.json", "application/json", "{}")).toBe("failed");
  });
});

// R122 (bu-7): on the web a backup is "saved" only when the browser's save picker wrote it; a download is only offered.
describe("saveFile on the web", () => {
  const clicked: string[] = [];
  const page = (): void => {
    clicked.length = 0;
    const a = { href: "", download: "", click: () => clicked.push(a.download), remove: () => {} };
    vi.stubGlobal("document", { createElement: () => a, body: { append: () => {} } });
  };
  const picker = (handle: () => Promise<unknown>): ReturnType<typeof vi.fn> => {
    const pick = vi.fn(handle);
    vi.stubGlobal("showSaveFilePicker", pick);
    return pick;
  };
  const writable = (written: string[], fail = false): unknown => ({
    createWritable: async () => ({
      write: async (t: string) => (fail ? Promise.reject(new Error("disk full")) : void written.push(t)),
      close: async () => {},
      abort: async () => {},
    }),
  });
  it("without a save picker the download is offered, not saved", async () => {
    const { saveFile } = await import("./files.ts");
    cap.native = false;
    page();
    expect(await saveFile("a.json", "application/json", "{}")).toBe("offered");
    expect(clicked).toEqual(["a.json"]);
  });
  it("with a save picker: saved once written, cancelled when closed, failed when the write fails", async () => {
    const { saveFile } = await import("./files.ts");
    cap.native = false;
    page();
    const written: string[] = [];
    const pick = picker(async () => writable(written));
    expect(await saveFile("a.json", "application/json", "{}")).toBe("saved");
    expect(written).toEqual(["{}"]);
    expect(pick.mock.calls[0]?.[0]).toMatchObject({ suggestedName: "a.json" });
    picker(() => Promise.reject(new DOMException("closed", "AbortError")));
    expect(await saveFile("a.json", "application/json", "{}")).toBe("cancelled");
    picker(async () => writable([], true));
    expect(await saveFile("a.json", "application/json", "{}")).toBe("failed");
    expect(clicked).toEqual([]); // no download besides
  });
  it("a picker the browser refuses (no user gesture left) falls back to the download", async () => {
    const { saveFile } = await import("./files.ts");
    cap.native = false;
    page();
    picker(() => Promise.reject(new DOMException("no gesture", "SecurityError")));
    expect(await saveFile("a.json", "application/json", "{}")).toBe("offered");
    expect(clicked).toEqual(["a.json"]);
  });
});
