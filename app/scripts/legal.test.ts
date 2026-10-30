// SPDX-License-Identifier: GPL-3.0-or-later
// A48: one version in every place, the licence texts of what ships, the copyright lines, the privacy statement.
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const read = (p: string): string => readFileSync(join(repo, p), "utf8");

describe("one version (tools/check-version.sh)", () => {
  it("its own test passes: a match, each mismatch, a computed versionName", () => {
    const r = spawnSync(join(repo, "tools/check-version.test.sh"), { encoding: "utf8", timeout: 120_000 });
    expect(r.stderr + r.stdout).toContain("check-version.test.sh: ok");
    expect(r.status).toBe(0);
  });

  it("app/package.json, build.gradle and the F-Droid recipe agree (0.1.0, code 1)", () => {
    const r = spawnSync(join(repo, "tools/check-version.sh"), { encoding: "utf8", timeout: 60_000 });
    expect(r.stderr + r.stdout).toMatch(/0\.1\.0/);
    expect(r.status).toBe(0);
  });

  it("a measurement build is told apart by a versionNameSuffix, not by a computed versionName", () => {
    const gradle = read("android/app/build.gradle");
    expect(gradle).toMatch(/^\s*versionName\s*=?\s*["']0\.1\.0["']\s*$/m);
    expect(gradle).toMatch(/versionNameSuffix[^\n]*-measure/);
    expect(gradle).toMatch(/dependenciesInfo\s*\{[^}]*includeInApk\s*=\s*false[^}]*includeInBundle\s*=\s*false/);
    expect(read("tools/device_run.py")).toContain('endswith("-measure")');
  });
});

interface Row {
  section: string;
  cells: Record<string, string>;
}

/** Every table row of THIRD_PARTY.md, keyed by its header cells, with the `##` heading it sits under. */
function thirdPartyRows(): Row[] {
  const rows: Row[] = [];
  let section = "";
  let header: string[] | null = null;
  for (const line of read("THIRD_PARTY.md").split("\n")) {
    if (line.startsWith("## ")) {
      section = line.slice(3);
      header = null;
    } else if (line.startsWith("|")) {
      const cells = line.split("|").slice(1, -1).map((c) => c.trim());
      if (cells.every((c) => /^-+$/.test(c))) continue;
      if (header === null) header = cells;
      else rows.push({ section, cells: Object.fromEntries(header.map((h, i) => [h, cells[i] ?? ""])) });
    } else if (line.trim() === "") {
      header = null;
    }
  }
  return rows;
}

/** A row ships when the app or the APK carries its code or data (the build tools do not). */
function ships(r: Row): boolean {
  if (r.section.startsWith("Maths engine") || r.section.startsWith("Theme colours")) return true;
  if (r.section.startsWith("Units and constants data")) return (r.cells["Notes"] ?? "").includes("ships in the Find index");
  if (r.section.startsWith("App") || r.section.startsWith("Android")) return (r.cells["Use"] ?? "").includes("shipped");
  return false;
}

function spdxIds(licence: string): string[] {
  return licence
    .replace(/\([^)]*\)/g, " ")
    .split(/\s+(?:OR|AND|WITH)\s+|\s*\/\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
}

describe("licences of what ships (THIRD_PARTY.md, LICENSES/)", () => {
  const shipped = thirdPartyRows().filter(ships);
  const name = (r: Row): string => r.cells["Component"] ?? r.cells["Palette"] ?? "?";

  it("finds the shipped rows", () => {
    expect(shipped.length).toBeGreaterThanOrEqual(20);
    const names = shipped.map(name).join(" | ");
    for (const part of ["Giac", "GMP", "MPFR", "MathLive", "JSXGraph", "AndroidX appcompat", "Solarized"]) expect(names).toContain(part);
  });

  it("every shipped row names licences whose text is in LICENSES/", () => {
    const missing: string[] = [];
    for (const r of shipped) {
      const ids = spdxIds(r.cells["Licence"] ?? "");
      if (ids.length === 0) missing.push(`${name(r)}: no licence`);
      for (const id of ids) {
        const f = join(repo, "LICENSES", `${id}.txt`);
        if (!existsSync(f) || readFileSync(f, "utf8").length < 500) missing.push(`${name(r)}: LICENSES/${id}.txt`);
      }
    }
    expect(missing).toEqual([]);
  });

  it("every shipped row has a copyright line", () => {
    const bad = shipped.filter((r) => !/^Copyright\b.{12,}/.test(r.cells["Copyright"] ?? "")).map(name);
    expect(bad).toEqual([]);
  });

  it("every file in LICENSES/ is a licence some shipped row names", () => {
    const used = new Set(shipped.flatMap((r) => spdxIds(r.cells["Licence"] ?? "")));
    const files = readdirSync(join(repo, "LICENSES")).filter((f) => f.endsWith(".txt")).map((f) => f.slice(0, -4));
    expect(files.filter((f) => !used.has(f))).toEqual([]);
  });
});

describe("copyright and changes", () => {
  it("the owner of the work is Pascaline contributors, in README and package.json", () => {
    expect(read("README.md")).toContain("Copyright © 2026 Pascaline contributors");
    const pkg = JSON.parse(read("app/package.json")) as { author?: string };
    expect(pkg.author).toBe("Pascaline contributors");
  });

  it("each Giac patch says who changed Giac and when (GPL-3.0 section 5a)", () => {
    const dir = join(repo, "engine/giac/patches");
    const patches = readdirSync(dir).filter((f) => f.endsWith(".patch"));
    expect(patches.length).toBeGreaterThanOrEqual(18);
    const bad = patches.filter((f) => !/^# Changed by Pascaline contributors, \d{4}-\d{2}-\d{2}$/m.test(readFileSync(join(dir, f), "utf8").split(/\n(?=---)/)[0] ?? ""));
    expect(bad).toEqual([]);
  });
});

describe("PRIVACY.md", () => {
  const privacy = (): string => read("PRIVACY.md");
  it("names every permission the manifest asks for, and says nothing is sent", () => {
    const manifest = read("android/app/src/main/AndroidManifest.xml");
    const perms = [...manifest.matchAll(/<uses-permission[^>]*android:name="android\.permission\.([A-Z_]+)"/g)].map((m) => m[1] as string);
    expect(perms.length).toBeGreaterThan(0);
    for (const p of perms) expect(privacy()).toContain(p);
    expect(privacy()).toMatch(/IndexedDB/);
    expect(privacy()).toMatch(/pascaline-calc\.org/);
    expect(privacy()).toMatch(/no analytics/i);
    expect(privacy()).toMatch(/no accounts/i);
  });
  it("README and the F-Droid recipe link it", () => {
    expect(read("README.md")).toContain("PRIVACY.md");
    expect(read("fdroid/io.github.buerlino.pascaline.yml")).toContain("PRIVACY.md");
  });
});
