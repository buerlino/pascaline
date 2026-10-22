// SPDX-License-Identifier: GPL-3.0-or-later
// A32: the device run's case selection, and that no build but build.sh --test has WebView debugging on.
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadCore } from "../test/core-lib.ts";
import { deviceLine, planDevice } from "../test-device/core-plan.ts";

const root = (rel: string): string => readFileSync(new URL(`../../${rel}`, import.meta.url), "utf8");

describe("device plan", () => {
  const cases = loadCore();
  const p = planDevice(cases);
  it("selects exactly the active cases, expects known ones to fail, skips needs", () => {
    const rest = cases.filter((c) => c.id !== "c53");
    expect(p.active.map((c) => c.id)).toEqual(rest.filter((c) => !c.known && !c.needs).map((c) => c.id));
    expect(p.known.map((c) => c.id)).toEqual(rest.filter((c) => c.known && !c.needs).map((c) => c.id));
    expect(p.needs.map((c) => c.id).sort()).toEqual(cases.filter((c) => c.needs || c.id === "c53").map((c) => c.id).sort());
    expect(p.active.length + p.known.length + p.needs.length).toBe(cases.length);
    expect(p.active.every((c) => c.known === undefined && c.needs === undefined)).toBe(true);
  });
  it("skips c53 on the device: the native share sheet, counted under needs", () => {
    const c53 = cases.find((c) => c.id === "c53");
    expect(c53).toBeDefined();
    expect(p.needs.map((c) => c.id)).toContain("c53");
    expect(p.active.map((c) => c.id)).not.toContain("c53");
    expect(p.known.map((c) => c.id)).not.toContain("c53");
    expect(p.needs.find((c) => c.id === "c53")?.needs).toBe("desktop-only: the native share sheet");
  });
  it("prints the CORE DEVICE line", () => {
    expect(deviceLine(3, { active: new Array(4).fill(cases[0]), known: [cases[0]!], needs: [] })).toBe("CORE DEVICE 3/4 (known 1, needs 0)");
  });
  it("the device spec replays through R74's replay and check", () => {
    const spec = root("app/test-device/core.device.spec.ts");
    expect(spec).toMatch(/replay\(/);
    expect(spec).toMatch(/check\(/);
    expect(spec).toMatch(/planDevice\(/);
  });
});

describe("WebView debugging", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });
  const android = async (): Promise<{ webContentsDebuggingEnabled?: boolean }> => {
    vi.resetModules();
    return ((await import("../capacitor.config.ts")).default.android ?? {}) as { webContentsDebuggingEnabled?: boolean };
  };
  it("is off in the config build.sh uses without --test, whatever the caller's environment holds", async () => {
    vi.stubEnv("PASCALINE_WEBVIEW_DEBUG", "");
    expect((await android()).webContentsDebuggingEnabled).toBe(false);
    const sh = root("build.sh");
    // build.sh clears a value from the environment before anything reads the config, and sets it only under --test
    const unset = sh.indexOf("unset PASCALINE_WEBVIEW_DEBUG");
    const set = sh.indexOf("export PASCALINE_WEBVIEW_DEBUG=1");
    const build = sh.indexOf("npx cap sync");
    expect(unset).toBeGreaterThan(0);
    expect(set).toBeGreaterThan(unset);
    expect(build).toBeGreaterThan(set);
    expect(sh).toMatch(/\(\( TEST \)\) && export PASCALINE_WEBVIEW_DEBUG=1/);
    expect(sh.match(/PASCALINE_WEBVIEW_DEBUG=1/g)).toHaveLength(1);
  });
  it("is on only with the test flag's variable", async () => {
    vi.stubEnv("PASCALINE_WEBVIEW_DEBUG", "1");
    expect((await android()).webContentsDebuggingEnabled).toBe(true);
  });
  it("is not enabled in the Android sources", () => {
    expect(root("android/app/src/main/java/io/github/buerlino/pascaline/MainActivity.java")).not.toMatch(/setWebContentsDebuggingEnabled\(\s*true/);
    expect(root("fdroid/README.md")).not.toMatch(/--test|WEBVIEW_DEBUG/);
  });
});
