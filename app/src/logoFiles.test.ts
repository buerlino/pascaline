// SPDX-License-Identifier: GPL-3.0-or-later
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// A79: the N62 logo is the one source of every icon; the readers name only files that exist, and the
// committed PWA icon is what gen-icons.mjs writes from logo/ today.
const root = new URL("../../", import.meta.url).pathname;
const read = (p: string) => readFileSync(join(root, p), "utf8");
const readers = ["app/scripts/gen-icons.mjs", "README.md", "logo/README.md"];

/** Every logo file a reader names: logo/… paths, and gen-icons.mjs's layer("x.svg") names under logo/android_logo. */
function named(file: string): string[] {
  const text = read(file);
  const paths = [...text.matchAll(/logo\/[A-Za-z0-9_./-]+\.(?:svg|png|afdesign)/g)].map((m) => m[0]);
  const layers = [...text.matchAll(/layer\("([^"]+\.svg)"\)/g)].map((m) => `logo/android_logo/${m[1]}`);
  return [...paths, ...layers];
}

describe("A79: the logo files", () => {
  for (const file of readers) {
    it(`${file} names only existing logo files, none of the old pascaline_ set`, () => {
      const files = named(file);
      for (const f of files) {
        expect(existsSync(join(root, f)), `${file} names ${f}`).toBe(true);
        expect(f, `${file} names the old file ${f}`).not.toMatch(/pascaline_/);
      }
    });
  }

  it("gen-icons.mjs and README.md name the logo files they read", () => {
    expect(named("app/scripts/gen-icons.mjs")).toEqual(
      expect.arrayContaining(["logo/android_logo/n62_back.svg", "logo/android_logo/n62_front.svg"]),
    );
    expect(named("README.md").length).toBeGreaterThanOrEqual(2);
  });

  it("the icon layers are a 108×108 pair with a solid background", () => {
    const back = read("logo/android_logo/n62_back.svg");
    const front = read("logo/android_logo/n62_front.svg");
    for (const svg of [back, front]) expect(svg).toMatch(/viewBox="0 0 108 108"/);
    expect(back).toMatch(/fill:\s*(#[0-9a-fA-F]{3,8}|rgb\()/);
    expect(back).not.toMatch(/fill-opacity:\s*0/);
  });

  it("app/public/icons/icon.svg is what gen-icons.mjs writes from logo/ today", () => {
    const out = mkdtempSync(join(tmpdir(), "gen-icons-"));
    try {
      execFileSync("node", [join(root, "app/scripts/gen-icons.mjs"), "--svg-only"], {
        env: { ...process.env, GEN_ICONS_OUT: out },
      });
      expect(readFileSync(join(out, "pwa/icon.svg"), "utf8")).toBe(read("app/public/icons/icon.svg"));
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  });
});
