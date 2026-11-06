// SPDX-License-Identifier: GPL-3.0-or-later
// A77: the Android identity is N62, application id dev.n62.calc (decisions.md "The name N62"); after v0.1.0 it never changes.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const read = (p: string): string => readFileSync(join(repo, p), "utf8");
const ID = "dev.n62.calc";

describe("the application id dev.n62.calc (A77)", () => {
  it("Gradle's namespace and applicationId", () => {
    const gradle = read("android/app/build.gradle");
    expect(gradle).toMatch(/^\s*namespace\s*=\s*"dev\.n62\.calc"\s*$/m);
    expect(gradle).toMatch(/^\s*applicationId\s+"dev\.n62\.calc"\s*$/m);
  });

  it("Capacitor's appId and appName", () => {
    const cap = read("app/capacitor.config.ts");
    expect(cap).toContain(`appId: '${ID}'`);
    expect(cap).toContain("appName: 'N62'");
  });

  it("strings.xml: the launcher says N62", () => {
    const s = read("android/app/src/main/res/values/strings.xml");
    expect(s).toContain('<string name="app_name">N62</string>');
    expect(s).toContain('<string name="title_activity_main">N62</string>');
    expect(s).toContain(`<string name="package_name">${ID}</string>`);
    expect(s).toContain(`<string name="custom_url_scheme">${ID}</string>`);
  });

  it("the Java sources sit in dev/n62/calc with that package", () => {
    for (const f of ["MainActivity", "N62FilesPlugin", "N62HapticsPlugin"]) {
      const src = read(`android/app/src/main/java/dev/n62/calc/${f}.java`);
      expect(src).toMatch(/^package dev\.n62\.calc;$/m);
    }
    expect(existsSync(join(repo, "android/app/src/main/java/io"))).toBe(false);
  });

  it("the F-Droid draft is fdroid/dev.n62.calc.yml with the N62 names", () => {
    const r = read("fdroid/dev.n62.calc.yml");
    expect(r).toContain("metadata/dev.n62.calc.yml");
    expect(r).toMatch(/^AutoName: N62$/m);
    expect(r).toMatch(/^AuthorName: N62 contributors$/m);
    expect(r).toMatch(/^WebSite: https:\/\/n62\.dev\/$/m);
    expect(r).toMatch(/^SourceCode: https:\/\/github\.com\/n62-dev\/n62$/m);
    expect(r).toMatch(/^IssueTracker: https:\/\/github\.com\/n62-dev\/n62\/issues$/m);
    expect(r).toMatch(/^Repo: https:\/\/github\.com\/n62-dev\/n62\.git$/m);
  });

  it("the release APK is n62-X.Y.Z.apk in build.sh, the release workflow and docs/release.md", () => {
    const sh = read("build.sh");
    expect(sh).toContain('cp "$SRC" "dist/n62-$VNAME.apk"');
    expect(sh).toContain('sha256sum "n62-$VNAME.apk" > "n62-$VNAME.apk.sha256"');
    const wf = read(".github/workflows/release.yml");
    expect(wf).toContain('apk="dist/n62-$v.apk"');
    expect(wf).toContain('sha256sum -c "n62-$v.apk.sha256"');
    expect(wf).not.toMatch(/pascaline-\$v/);
    const doc = read("docs/release.md");
    expect(doc).toContain("n62-X.Y.Z.apk");
    expect(doc).not.toContain("pascaline-X.Y.Z");
  });

  it("the device tools drive dev.n62.calc", () => {
    for (const f of ["app/test-device/core.device.spec.ts", "tools/update-device.ts", "tools/device_run.py", "tools/probes/ime-return.py"]) {
      expect(read(f), f).toContain(`"${ID}"`);
    }
    expect(read("tools/shots.py")).toContain(`${ID}/.MainActivity`);
    expect(read("build.sh")).toContain(`uninstall ${ID}`);
  });

  it("no file names the old id, but the archive, the dated decision of 2026-10-14 and A77's own text", () => {
    const old = ["io.github" + ".buerlino.pascaline", "io/github" + "/buerlino"];
    const r = spawnSync("git", ["grep", "-l", ...old.flatMap((o) => ["-e", o]), "--", ".", ":!docs/archive", ":!docs/decisions.md", ":!docs/shifts/packages/A77.md"], {
      cwd: repo,
      encoding: "utf8",
    });
    expect(r.status, r.stderr).not.toBe(2);
    expect(r.stdout.split("\n").filter(Boolean)).toEqual([]);
  });
});
