// SPDX-License-Identifier: GPL-3.0-or-later
// R139: the two local Capacitor plugins are named N62Files and N62Haptics on both sides. A name that differs on one side
// fails silently (isPluginAvailable is false and the app takes the web path), so the Java annotation, the JS strings and
// MainActivity's registrations are read together.
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const java = (f: string): string => readFileSync(new URL(`../../../android/app/src/main/java/dev/n62/calc/${f}.java`, import.meta.url), "utf8");
const ts = (f: string): string => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");

const PLUGINS = [
  { name: "N62Files", cls: "N62FilesPlugin", js: "clipboard/files.ts" },
  { name: "N62Haptics", cls: "N62HapticsPlugin", js: "input/haptics.ts" },
];

describe("native plugin names", () => {
  for (const p of PLUGINS) {
    it(`${p.name}: the Java annotation, the class and the JS strings agree`, () => {
      expect(existsSync(new URL(`../../../android/app/src/main/java/dev/n62/calc/${p.cls}.java`, import.meta.url))).toBe(true);
      const src = java(p.cls);
      expect(/@CapacitorPlugin\(name = "([^"]+)"\)/.exec(src)?.[1]).toBe(p.name);
      expect(src).toContain(`public class ${p.cls} extends Plugin`);
      const js = ts(p.js);
      expect(/isPluginAvailable\("([^"]+)"\)/.exec(js)?.[1]).toBe(p.name);
      expect(/registerPlugin<\w+>\("([^"]+)"\)/.exec(js)?.[1]).toBe(p.name);
    });
  }
  it("MainActivity registers both before super.onCreate", () => {
    const main = java("MainActivity");
    const sup = main.indexOf("super.onCreate");
    for (const p of PLUGINS) {
      const at = main.indexOf(`registerPlugin(${p.cls}.class)`);
      expect(at, p.cls).toBeGreaterThan(0);
      expect(at, p.cls).toBeLessThan(sup);
    }
  });
});
