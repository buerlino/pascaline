// SPDX-License-Identifier: GPL-3.0-or-later
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildOutDir, writeServiceWorker } from "../vite-plugin-pwa-lite.ts";

describe("pwa-lite build plugin", () => {
  it("keeps an absolute outDir (regression: it was joined onto the root, so closeBundle failed with ENOENT)", () => {
    expect(buildOutDir("/repo/app", "/scratch/out")).toBe("/scratch/out");
    expect(buildOutDir("/repo/app", "dist")).toBe("/repo/app/dist");
  });

  it("writes sw.js into the output folder, precaching every file except source maps", () => {
    const root = mkdtempSync(join(tmpdir(), "pwa-root-"));
    const out = mkdtempSync(join(tmpdir(), "pwa-out-"));
    mkdirSync(join(root, "pwa"));
    writeFileSync(join(root, "pwa/sw.js"), "const CACHE = '__CACHE__'; const LIST = __PRECACHE__;");
    mkdirSync(join(out, "assets"));
    writeFileSync(join(out, "index.html"), "<!doctype html>");
    writeFileSync(join(out, "assets/a.js"), "1");
    writeFileSync(join(out, "assets/a.js.map"), "{}");

    writeServiceWorker(root, buildOutDir(root, out));

    const sw = readFileSync(join(out, "sw.js"), "utf8");
    expect(sw).toContain(`const LIST = ["./","assets/a.js","index.html"];`);
    expect(sw).toMatch(/const CACHE = 'pascaline-[0-9a-f]{12}';/);
  });
});
