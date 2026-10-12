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
